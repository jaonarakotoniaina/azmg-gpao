/**
 * Indicateurs de pilotage (section 8.4, 8.5 et 8.10 de CLAUDE.md).
 *
 * Quatre familles de mesures, toutes bornees au perimetre de pilotage (T00 exclu partout) :
 *  - flux   : entrees et sorties par jour et par famille ;
 *  - stock  : demandes ouvertes a un instant donne, et age de ce stock ;
 *  - delais : premiere reponse, delai total, temps d'attente par acteur, respect du SLA ;
 *  - charge : volume multiplie par le temps standard de la famille.
 *
 * Tous les delais sont en minutes ouvrees du client. Les comparaisons se font a periode egale
 * (meme nombre de jours), pour que la semaine precedente soit vraiment comparable.
 */
import { and, eq, gte, inArray, lt, lte, sql, type SQL } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { db, schema } from '../../db/client';
import { horairesDuCompte, lireParametres } from '../../lib/parametres';
import { tempsDemandeAvecHoraires, type Demande } from '../demandes/service';
import {
  FAMILLE_HORS_PERIMETRE,
  FAMILLES_PILOTAGE,
  famille as familleRef,
  STATUTS_OUVERTS,
  type Acteur,
  type Statut,
} from '@shared/constantes';
import { minutesParJourOuvre, type HorairesOuvres } from '@shared/heures-ouvrees';

export interface Periode {
  debut: Date;
  fin: Date;
}

export interface FiltresIndicateurs {
  compteId?: number;
  posteId?: number;
}

/** Periode de N jours qui se termine maintenant, et la periode de meme duree qui la precede. */
export function periodesComparees(jours: number, maintenant = new Date()): { courante: Periode; precedente: Periode } {
  const fin = maintenant;
  const debut = new Date(fin.getTime() - jours * 86_400_000);
  return {
    courante: { debut, fin },
    precedente: { debut: new Date(debut.getTime() - jours * 86_400_000), fin: debut },
  };
}

function conditionsCommunes(filtres: FiltresIndicateurs): SQL[] {
  const conditions: SQL[] = [sql`${schema.demandes.famille} <> ${FAMILLE_HORS_PERIMETRE}`];
  if (filtres.compteId) conditions.push(eq(schema.demandes.compteId, filtres.compteId));
  if (filtres.posteId) conditions.push(eq(schema.demandes.posteId, filtres.posteId));
  return conditions;
}

// ---------------------------------------------------------------------------
// Flux : entrees et sorties
// ---------------------------------------------------------------------------

export interface Flux {
  /** Demandes ouvertes pendant la periode. */
  entrees: number;
  /** Demandes terminees ou annulees pendant la periode. */
  sorties: number;
  /** Solde : positif si le stock grossit. */
  solde: number;
  /** Detail par jour (AAAA-MM-JJ), utile a la courbe du tableau de bord. */
  parJour: { jour: string; entrees: number; sorties: number }[];
  parFamille: { famille: string; entrees: number; sorties: number }[];
}

export async function flux(periode: Periode, filtres: FiltresIndicateurs = {}): Promise<Flux> {
  const base = conditionsCommunes(filtres);

  const entrees = await db
    .select({
      jour: sql<string>`to_char(${schema.demandes.ouverteLe} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`.as('jour'),
      famille: schema.demandes.famille,
      nombre: sql<number>`count(*)::int`.as('nombre'),
    })
    .from(schema.demandes)
    .where(and(...base, gte(schema.demandes.ouverteLe, periode.debut), lt(schema.demandes.ouverteLe, periode.fin)))
    .groupBy(sql`1`, schema.demandes.famille);

  const sorties = await db
    .select({
      jour: sql<string>`to_char(${schema.demandes.termineeLe} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`.as('jour'),
      famille: schema.demandes.famille,
      nombre: sql<number>`count(*)::int`.as('nombre'),
    })
    .from(schema.demandes)
    .where(and(...base, sql`${schema.demandes.termineeLe} IS NOT NULL`, gte(schema.demandes.termineeLe, periode.debut), lt(schema.demandes.termineeLe, periode.fin)))
    .groupBy(sql`1`, schema.demandes.famille);

  const parJour = new Map<string, { entrees: number; sorties: number }>();
  const parFamille = new Map<string, { entrees: number; sorties: number }>();
  const cumuler = (lignes: { jour: string; famille: string; nombre: number }[], cle: 'entrees' | 'sorties') => {
    for (const l of lignes) {
      const j = parJour.get(l.jour) ?? { entrees: 0, sorties: 0 };
      j[cle] += l.nombre;
      parJour.set(l.jour, j);
      const f = parFamille.get(l.famille) ?? { entrees: 0, sorties: 0 };
      f[cle] += l.nombre;
      parFamille.set(l.famille, f);
    }
  };
  cumuler(entrees, 'entrees');
  cumuler(sorties, 'sorties');

  const totalEntrees = entrees.reduce((s, l) => s + l.nombre, 0);
  const totalSorties = sorties.reduce((s, l) => s + l.nombre, 0);

  return {
    entrees: totalEntrees,
    sorties: totalSorties,
    solde: totalEntrees - totalSorties,
    parJour: [...parJour.entries()].map(([jour, v]) => ({ jour, ...v })).sort((a, b) => a.jour.localeCompare(b.jour)),
    parFamille: [...parFamille.entries()].map(([famille, v]) => ({ famille, ...v })).sort((a, b) => b.entrees - a.entrees),
  };
}

// ---------------------------------------------------------------------------
// Stock et age du stock
// ---------------------------------------------------------------------------

export interface Stock {
  /** Demandes ouvertes a l'instant demande. */
  total: number;
  parStatut: Record<string, number>;
  parFamille: Record<string, number>;
  parActeur: Record<string, number>;
  /** Age du stock en minutes ouvrees : moyenne et mediane. */
  ageMoyenMinutes: number;
  ageMedianMinutes: number;
  /** Repartition par tranche d'age, en jours ouvres. */
  tranchesAge: { tranche: string; nombre: number }[];
  /** Demandes dont l'echeance SLA est depassee. */
  slaDepasse: number;
  /** Charge estimee du stock : volume multiplie par le temps standard de la famille. */
  chargeEstimeeMinutes: number;
}

const TRANCHES = [
  { tranche: 'moins d’un jour', max: 1 },
  { tranche: '1 a 2 jours', max: 2 },
  { tranche: '3 a 5 jours', max: 5 },
  { tranche: '6 a 10 jours', max: 10 },
  { tranche: 'plus de 10 jours', max: Infinity },
];

export async function stock(filtres: FiltresIndicateurs = {}, maintenant = new Date()): Promise<Stock> {
  const base = conditionsCommunes(filtres);
  const demandes = await db
    .select()
    .from(schema.demandes)
    .where(and(...base, inArray(schema.demandes.statut, STATUTS_OUVERTS)));

  const debuts = await debutsDeStatut(demandes);
  const horaires = await horairesParCompte(demandes);
  const minutesJour = minutesParJourOuvre(horaires.values().next().value ?? (await horairesDuCompte(filtres.compteId)));

  const parStatut: Record<string, number> = {};
  const parFamille: Record<string, number> = {};
  const parActeur: Record<string, number> = {};
  const ages: number[] = [];
  let slaDepasse = 0;
  let chargeEstimeeMinutes = 0;

  for (const d of demandes) {
    parStatut[d.statut] = (parStatut[d.statut] ?? 0) + 1;
    parFamille[d.famille] = (parFamille[d.famille] ?? 0) + 1;
    parActeur[d.acteurAttendu] = (parActeur[d.acteurAttendu] ?? 0) + 1;
    const temps = tempsDemandeAvecHoraires(d, debuts.get(d.id) ?? d.ouverteLe, horaires.get(d.compteId)!, maintenant);
    ages.push(temps.total);
    if (d.slaEcheanceLe && d.slaEcheanceLe <= maintenant) slaDepasse++;
    chargeEstimeeMinutes += familleRef(d.famille)?.tempsStandardMinutes ?? 0;
  }

  ages.sort((a, b) => a - b);
  const tranches = TRANCHES.map((t) => ({ tranche: t.tranche, nombre: 0 }));
  for (const age of ages) {
    const jours = age / minutesJour;
    const indice = TRANCHES.findIndex((t) => jours <= t.max);
    tranches[indice === -1 ? TRANCHES.length - 1 : indice].nombre++;
  }

  return {
    total: demandes.length,
    parStatut,
    parFamille,
    parActeur,
    ageMoyenMinutes: ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0,
    ageMedianMinutes: ages.length ? Math.round(ages[Math.floor(ages.length / 2)]) : 0,
    tranchesAge: tranches,
    slaDepasse,
    chargeEstimeeMinutes,
  };
}

// ---------------------------------------------------------------------------
// Delais : premiere reponse, delai total, attente par acteur, SLA
// ---------------------------------------------------------------------------

export interface Delais {
  /** Nombre de demandes terminees dans la periode, base de tous les delais ci-dessous. */
  terminees: number;
  premiereReponseMoyenneMinutes: number | null;
  premiereReponseMedianeMinutes: number | null;
  delaiTotalMoyenMinutes: number | null;
  delaiTotalMedianMinutes: number | null;
  /** Minutes ouvrees cumulees d'attente, par acteur, sur les demandes terminees. */
  attenteParActeurMinutes: Record<Acteur, number>;
  /** Part des demandes terminees dans leur delai cible, entre 0 et 1. */
  respectSla: number | null;
  /** Detail par famille, pour reperer celle qui decroche. */
  parFamille: { famille: string; terminees: number; delaiMedianMinutes: number; respectSla: number | null }[];
}

function mediane(valeurs: number[]): number | null {
  if (!valeurs.length) return null;
  const tri = [...valeurs].sort((a, b) => a - b);
  return Math.round(tri[Math.floor(tri.length / 2)]);
}

function moyenne(valeurs: number[]): number | null {
  if (!valeurs.length) return null;
  return Math.round(valeurs.reduce((a, b) => a + b, 0) / valeurs.length);
}

export async function delais(periode: Periode, filtres: FiltresIndicateurs = {}): Promise<Delais> {
  const base = conditionsCommunes(filtres);
  const demandes = await db
    .select()
    .from(schema.demandes)
    .where(and(...base, sql`${schema.demandes.termineeLe} IS NOT NULL`, gte(schema.demandes.termineeLe, periode.debut), lt(schema.demandes.termineeLe, periode.fin)));

  const horaires = await horairesParCompte(demandes);
  const premieres: number[] = [];
  const totaux: number[] = [];
  const attente: Record<string, number> = {};
  const parFamille = new Map<string, { delais: number[]; dansSla: number; avecSla: number }>();
  let dansSla = 0;
  let avecSla = 0;

  for (const d of demandes) {
    // Une demande fermee ne bouge plus : ses compteurs enregistres sont definitifs.
    const temps = tempsDemandeAvecHoraires(d, d.termineeLe!, horaires.get(d.compteId)!, d.termineeLe!);
    totaux.push(temps.total);
    if (temps.premiereReponse !== null) premieres.push(temps.premiereReponse);
    for (const [acteur, minutes] of Object.entries(temps.parActeur)) attente[acteur] = (attente[acteur] ?? 0) + minutes;

    const f = parFamille.get(d.famille) ?? { delais: [], dansSla: 0, avecSla: 0 };
    f.delais.push(temps.total);
    if (d.slaEcheanceLe) {
      avecSla++;
      f.avecSla++;
      // Respecte si la demande a ete terminee avant son echeance SLA.
      if (d.termineeLe! <= d.slaEcheanceLe) {
        dansSla++;
        f.dansSla++;
      }
    }
    parFamille.set(d.famille, f);
  }

  const attenteParActeurMinutes = { poste: 0, do: 0, client: 0, tiers: 0, aucun: 0 } as Record<Acteur, number>;
  for (const [acteur, minutes] of Object.entries(attente)) {
    if (acteur in attenteParActeurMinutes) attenteParActeurMinutes[acteur as Acteur] = Math.round(minutes);
  }

  return {
    terminees: demandes.length,
    premiereReponseMoyenneMinutes: moyenne(premieres),
    premiereReponseMedianeMinutes: mediane(premieres),
    delaiTotalMoyenMinutes: moyenne(totaux),
    delaiTotalMedianMinutes: mediane(totaux),
    attenteParActeurMinutes,
    respectSla: avecSla ? dansSla / avecSla : null,
    parFamille: [...parFamille.entries()]
      .map(([famille, v]) => ({
        famille,
        terminees: v.delais.length,
        delaiMedianMinutes: mediane(v.delais) ?? 0,
        respectSla: v.avecSla ? v.dansSla / v.avecSla : null,
      }))
      .sort((a, b) => b.terminees - a.terminees),
  };
}

// ---------------------------------------------------------------------------
// Charge estimee
// ---------------------------------------------------------------------------

export interface Charge {
  /** Minutes de travail estimees sur la periode : volume multiplie par le temps standard. */
  totalMinutes: number;
  /** Equivalent en jours ouvres du client. */
  totalJours: number;
  parFamille: { famille: string; libelle: string; volume: number; tempsStandardMinutes: number; minutes: number }[];
}

export async function charge(periode: Periode, filtres: FiltresIndicateurs = {}): Promise<Charge> {
  const base = conditionsCommunes(filtres);
  const lignes = await db
    .select({ famille: schema.demandes.famille, volume: sql<number>`count(*)::int`.as('volume') })
    .from(schema.demandes)
    .where(and(...base, gte(schema.demandes.ouverteLe, periode.debut), lt(schema.demandes.ouverteLe, periode.fin)))
    .groupBy(schema.demandes.famille);

  const horaires = await horairesDuCompte(filtres.compteId);
  const minutesJour = minutesParJourOuvre(horaires);
  const parFamille = lignes.map((l) => {
    const ref = familleRef(l.famille);
    const tempsStandardMinutes = ref?.tempsStandardMinutes ?? 0;
    return {
      famille: l.famille,
      libelle: ref?.libelle ?? l.famille,
      volume: l.volume,
      tempsStandardMinutes,
      minutes: l.volume * tempsStandardMinutes,
    };
  });
  const totalMinutes = parFamille.reduce((s, f) => s + f.minutes, 0);

  return {
    totalMinutes,
    totalJours: Math.round((totalMinutes / minutesJour) * 10) / 10,
    parFamille: parFamille.sort((a, b) => b.minutes - a.minutes),
  };
}

// ---------------------------------------------------------------------------
// Tableau de bord complet
// ---------------------------------------------------------------------------

export interface TableauDeBord {
  periode: { debut: string; fin: string; jours: number };
  flux: Flux;
  stock: Stock;
  delais: Delais;
  charge: Charge;
  /** Memes mesures sur la periode precedente de meme duree, pour la comparaison. */
  precedent: { flux: Flux; delais: Delais; charge: Charge };
  /** Echeances a venir dans l'horizon d'alerte des parametres. */
  echeancesProches: { dossierId: number; dossier: string; type: string; libelle: string | null; echeanceLe: Date; joursRestants: number }[];
  /** Demandes en attente DO depuis plus que le seuil des parametres. */
  attentesDoLongues: { demandeId: number; objet: string; dossier: string; minutesAttente: number }[];
  /**
   * Vrai quand le compte n'a jamais recu la moindre demande, toutes periodes confondues.
   *
   * Des zeros partout veulent dire deux choses tres differentes : une semaine sans activite, ou
   * une GPAO qui n'a encore rien recu. L'ecran doit pouvoir les distinguer, sans quoi une mise en
   * route qui n'a pas abouti ressemble a un calme plat.
   */
  miseEnRoute: boolean;
}

export async function tableauDeBord(jours: number, filtres: FiltresIndicateurs = {}, maintenant = new Date()): Promise<TableauDeBord> {
  const { courante, precedente } = periodesComparees(jours, maintenant);
  const parametres = await lireParametres();

  const [fluxCourant, stockCourant, delaisCourant, chargeCourante, fluxPrecedent, delaisPrecedent, chargePrecedente] = await Promise.all([
    flux(courante, filtres),
    stock(filtres, maintenant),
    delais(courante, filtres),
    charge(courante, filtres),
    flux(precedente, filtres),
    delais(precedente, filtres),
    charge(precedente, filtres),
  ]);

  const horizonJours = Math.max(...parametres.alertes.joursAvantEcheance, 0);
  const horizon = new Date(maintenant.getTime() + horizonJours * 86_400_000);
  const conditionsEcheance: SQL[] = [eq(schema.echeances.annulee, false), sql`${schema.echeances.honoreeLe} IS NULL`, lte(schema.echeances.echeanceLe, horizon)];
  if (filtres.compteId) conditionsEcheance.push(eq(schema.dossiers.compteId, filtres.compteId));
  const echeances = await db
    .select({
      dossierId: schema.dossiers.id,
      dossier: schema.dossiers.libelle,
      type: schema.echeances.type,
      libelle: schema.echeances.libelle,
      echeanceLe: schema.echeances.echeanceLe,
    })
    .from(schema.echeances)
    .innerJoin(schema.dossiers, eq(schema.dossiers.id, schema.echeances.dossierId))
    .where(and(...conditionsEcheance))
    .orderBy(schema.echeances.echeanceLe)
    .limit(50);

  const seuilAttenteMinutes = parametres.sla.attenteDoHeures * 60;
  const enAttenteDo = await db
    .select({ demande: schema.demandes, dossier: schema.dossiers.libelle })
    .from(schema.demandes)
    .innerJoin(schema.dossiers, eq(schema.dossiers.id, schema.demandes.dossierId))
    .where(and(...conditionsCommunes(filtres), eq(schema.demandes.statut, 'attente_do')));
  const debutsDo = await debutsDeStatut(enAttenteDo.map((l) => l.demande));
  const horairesDo = await horairesParCompte(enAttenteDo.map((l) => l.demande));
  const attentesDoLongues = enAttenteDo
    .map((l) => {
      const temps = tempsDemandeAvecHoraires(l.demande, debutsDo.get(l.demande.id) ?? l.demande.ouverteLe, horairesDo.get(l.demande.compteId)!, maintenant);
      return { demandeId: l.demande.id, objet: l.demande.objet, dossier: l.dossier, minutesAttente: temps.statutCourant };
    })
    .filter((l) => l.minutesAttente >= seuilAttenteMinutes)
    .sort((a, b) => b.minutesAttente - a.minutesAttente);

  // Une seule demande suffit a dire que le compte a deja vecu : on ne compte pas au-dela.
  const [premiere] = await db
    .select({ id: schema.demandes.id })
    .from(schema.demandes)
    .where(and(...conditionsCommunes(filtres)))
    .limit(1);

  return {
    miseEnRoute: !premiere,
    periode: { debut: courante.debut.toISOString(), fin: courante.fin.toISOString(), jours },
    flux: fluxCourant,
    stock: stockCourant,
    delais: delaisCourant,
    charge: chargeCourante,
    precedent: { flux: fluxPrecedent, delais: delaisPrecedent, charge: chargePrecedente },
    echeancesProches: echeances.map((e) => ({
      ...e,
      joursRestants: Math.floor((e.echeanceLe.getTime() - maintenant.getTime()) / 86_400_000),
    })),
    attentesDoLongues,
  };
}

// ---------------------------------------------------------------------------
// Aides partagees
// ---------------------------------------------------------------------------

/** Debut du statut courant de chaque demande, en une seule requete. */
async function debutsDeStatut(demandes: Demande[]): Promise<Map<number, Date>> {
  if (!demandes.length) return new Map();
  const lignes = await db
    .select({ demandeId: schema.transitionsStatut.demandeId, debut: sql<Date>`max(${schema.transitionsStatut.survenuLe})`.as('debut') })
    .from(schema.transitionsStatut)
    .where(inArray(schema.transitionsStatut.demandeId, demandes.map((d) => d.id)))
    .groupBy(schema.transitionsStatut.demandeId);
  return new Map(lignes.map((l) => [l.demandeId, new Date(l.debut)]));
}

/** Horaires ouvres de chaque compte concerne, lus une seule fois par compte. */
async function horairesParCompte(demandes: Demande[]): Promise<Map<number, HorairesOuvres>> {
  const sortie = new Map<number, HorairesOuvres>();
  for (const compteId of new Set(demandes.map((d) => d.compteId))) {
    sortie.set(compteId, await horairesDuCompte(compteId));
  }
  return sortie;
}

export { FAMILLES_PILOTAGE, DateTime, type Statut };
