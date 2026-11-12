/**
 * Export du reporting au format existant (section 9 de CLAUDE.md).
 *
 * L'export **ecrit dans un classeur fourni en entree** et n'en modifie pas la structure :
 * colonnes, en-tetes, noms d'onglets, mise en forme et formules ressortent intacts. Voir
 * `src/server/lib/xlsx/ecriture.ts` pour le detail de la mecanique.
 *
 * Onglet « Suivi Quotidien », un bloc par jour :
 *   ligne vide, ligne d'en-tete recopiee, puis les lignes de donnees
 *   A : date en texte JJ/MM/AAAA     C : client ou pays        F : produit et reference
 *   G : description numerotee orientee resultat, terminee par « : Statut »
 *   H : livrables finalises          I : priorite du lendemain
 *   B, D, E : laissees vides
 *
 * Onglet « sem N » (N = numero de semaine ISO moins 26 en 2026) :
 *   colonnes B a F = lundi a vendredi
 *   ligne 4 nouveaux leads ; lignes 5, 6, 7, 12, 14 indicateurs numeriques
 *   lignes 8 a 11 laissees vides ; lignes 13, 15, 16, 17 syntheses texte ; ligne 18 points bloquants
 *   aucune reference (BL, commande, booking) dans cet onglet
 *
 * Regle commune : un meme dossier dans la journee donne une seule ligne, au dernier etat connu.
 */
import { and, asc, eq, gte, inArray, lt, sql, type SQL } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { db, schema } from '../../db/client';
import { ErreurHttp } from '../../lib/http';
import { journaliser } from '../../lib/evenements';
import { ClasseurModifiable, type LigneAAjouter } from '../../lib/xlsx/ecriture';
import { lireClasseur, ongletNomme, valeur as valeurCellule } from '../../lib/xlsx/lecture';
import { retirerTiretsLongs } from '@shared/tirets';
import { FAMILLE_HORS_PERIMETRE, statutReporting, type StatutReporting } from '@shared/constantes';
import type { Auteur } from '../demandes/service';

export const ONGLET_SUIVI = 'Suivi Quotidien';

/** Colonnes du format (1 = A). */
const COL = { date: 1, client: 3, produit: 6, description: 7, livrables: 8, priorite: 9 } as const;

/** En 2026, l'onglet « sem N » porte le numero de semaine ISO diminue de 26. */
export function numeroOngletSemaine(semaineIso: number, annee: number): number {
  return annee === 2026 ? semaineIso - 26 : semaineIso;
}

export function nomOngletSemaine(semaineIso: number, annee: number): string {
  return `sem ${numeroOngletSemaine(semaineIso, annee)}`;
}

// ---------------------------------------------------------------------------
// Suivi Quotidien
// ---------------------------------------------------------------------------

export interface LigneJour {
  dossierId: number;
  client: string;
  produit: string;
  description: string;
  statut: StatutReporting;
  livrables: string;
  prioriteLendemain: string;
}

export interface BlocJour {
  jour: string; // AAAA-MM-JJ
  lignes: LigneJour[];
}

/**
 * Construit les lignes du jour pour un compte.
 *
 * Un dossier ne donne qu'une ligne, au dernier etat connu de la journee. La description est
 * orientee resultat (« ou en est le dossier ») et se termine par le statut de reporting exact.
 * Les familles hors perimetre sont exclues, et aucune appreciation sur le collaborateur n'est
 * reprise : seuls l'etat factuel et l'action qui debloque figurent dans la description.
 */
export async function construireBlocJour(compteId: number, jour: string): Promise<BlocJour> {
  const debut = DateTime.fromISO(jour, { zone: 'utc' }).startOf('day').toJSDate();
  const fin = DateTime.fromISO(jour, { zone: 'utc' }).plus({ days: 1 }).startOf('day').toJSDate();

  const conditions: SQL[] = [
    eq(schema.demandes.compteId, compteId),
    sql`${schema.demandes.famille} <> ${FAMILLE_HORS_PERIMETRE}`,
    // Toute demande qui a bouge dans la journee, ou qui reste ouverte apres y etre entree.
    sql`(
      (${schema.demandes.dernierEvenementLe} >= ${debut} AND ${schema.demandes.dernierEvenementLe} < ${fin})
      OR (${schema.demandes.ouverteLe} < ${fin} AND ${schema.demandes.statut} NOT IN ('termine', 'annule'))
    )`,
  ];

  const demandes = await db
    .select({ demande: schema.demandes, dossier: schema.dossiers })
    .from(schema.demandes)
    .innerJoin(schema.dossiers, eq(schema.dossiers.id, schema.demandes.dossierId))
    .where(and(...conditions))
    .orderBy(asc(schema.dossiers.client), asc(schema.demandes.ouverteLe));

  // Un dossier, une ligne : la demande la plus recemment touchee porte l'etat du dossier.
  const parDossier = new Map<number, { dossier: typeof schema.dossiers.$inferSelect; demandes: (typeof schema.demandes.$inferSelect)[] }>();
  for (const l of demandes) {
    const deja = parDossier.get(l.dossier.id) ?? { dossier: l.dossier, demandes: [] };
    deja.demandes.push(l.demande);
    parDossier.set(l.dossier.id, deja);
  }

  // Derniers resumes d'evenement de la journee, pour decrire ce qui s'est passe.
  const demandeIds = demandes.map((l) => l.demande.id);
  const evenements = demandeIds.length
    ? await db
        .select({ demandeId: schema.evenements.demandeId, resume: schema.evenements.resume, objet: schema.evenements.objet, survenuLe: schema.evenements.survenuLe })
        .from(schema.evenements)
        .where(and(inArray(schema.evenements.demandeId, demandeIds), gte(schema.evenements.survenuLe, debut), lt(schema.evenements.survenuLe, fin)))
        .orderBy(asc(schema.evenements.survenuLe))
    : [];
  const dernierResume = new Map<number, string>();
  for (const e of evenements) {
    if (e.demandeId !== null && (e.resume || e.objet)) dernierResume.set(e.demandeId, (e.resume || e.objet)!);
  }

  const lignes: LigneJour[] = [];
  let numero = 0;
  for (const { dossier, demandes: liste } of parDossier.values()) {
    // La demande qui porte l'etat du dossier : la plus recemment touchee.
    const porteuse = [...liste].sort(
      (a, b) => (b.dernierEvenementLe?.getTime() ?? b.ouverteLe.getTime()) - (a.dernierEvenementLe?.getTime() ?? a.ouverteLe.getTime()),
    )[0];
    const statut = statutReporting(porteuse.statut);
    numero++;

    const faits = liste
      .map((d) => dernierResume.get(d.id))
      .filter((x): x is string => Boolean(x))
      .join(' ');
    const corps = faits || porteuse.objet;
    // Description numerotee, orientee resultat, terminee par le statut exact du reporting.
    const description = retirerTiretsLongs(`${numero}. ${nettoyerPhrase(corps)} : ${statut}`);

    const livrables = liste
      .filter((d) => d.statut === 'termine')
      .map((d) => d.objet)
      .join(' ; ');
    const prioriteLendemain = liste.some((d) => d.statut !== 'termine' && d.statut !== 'annule')
      ? retirerTiretsLongs(nettoyerPhrase(porteuse.objet))
      : 'Aucune';

    lignes.push({
      dossierId: dossier.id,
      client: retirerTiretsLongs(dossier.pays ? `${dossier.client} (${dossier.pays})` : dossier.client),
      produit: retirerTiretsLongs(dossier.produit ?? ''),
      description,
      statut,
      livrables: retirerTiretsLongs(livrables),
      prioriteLendemain,
    });
  }

  return { jour, lignes };
}

/** Phrase compacte, sans point final en double ni espaces superflus. */
function nettoyerPhrase(texte: string): string {
  return texte.replace(/\s+/g, ' ').replace(/\s*\.\s*$/, '').trim();
}

/**
 * Ecrit un bloc de jour a la suite de l'onglet « Suivi Quotidien » :
 * une ligne vide, la ligne d'en-tete recopiee a l'identique, puis les lignes de donnees.
 */
export function ecrireBlocJour(classeur: ClasseurModifiable, bloc: BlocJour, modele: ModeleSuivi) {
  const dateTexte = DateTime.fromISO(bloc.jour).toFormat('dd/MM/yyyy');
  const lignes: LigneAAjouter[] = [{ cellules: [] }]; // ligne vide de separation

  // En-tete recopiee : exactement les libelles deja presents dans le classeur.
  lignes.push({
    cellules: modele.entetes.map((texte, i) => ({ colonne: i + 1, valeur: texte })),
    ligneModele: modele.ligneEntete,
  });

  bloc.lignes.forEach((l, rang) => {
    lignes.push({
      // B, D et E restent vides : elles ne sont pas ecrites du tout.
      cellules: [
        { colonne: COL.date, valeur: rang === 0 ? dateTexte : null },
        { colonne: COL.client, valeur: l.client },
        { colonne: COL.produit, valeur: l.produit },
        { colonne: COL.description, valeur: l.description },
        { colonne: COL.livrables, valeur: l.livrables || null },
        { colonne: COL.priorite, valeur: l.prioriteLendemain || null },
      ],
      ligneModele: modele.ligneDonnees,
    });
  });

  classeur.ajouterLignes(ONGLET_SUIVI, lignes);
}

export interface ModeleSuivi {
  /** Libelles de l'en-tete, repris du classeur pour etre recopies a l'identique. */
  entetes: string[];
  ligneEntete: number;
  ligneDonnees: number;
}

/**
 * Repere dans le classeur la derniere ligne d'en-tete et la derniere ligne de donnees :
 * leurs styles servent de modele aux lignes ajoutees, pour que le bloc ajoute ait le meme
 * aspect que les precedents.
 */
export function repererModele(buffer: Buffer): ModeleSuivi {
  const classeur = lireClasseur(buffer);
  const onglet = ongletNomme(classeur, ONGLET_SUIVI);
  if (!onglet) {
    throw new ErreurHttp(400, `Onglet « ${ONGLET_SUIVI} » absent du classeur. Onglets trouves : ${classeur.onglets.map((o) => o.nom).join(', ') || 'aucun'}`);
  }

  let ligneEntete = 0;
  let ligneDonnees = 0;
  let entetes: string[] = [];
  for (let n = 1; n <= onglet.derniereLigne; n++) {
    const cellules = onglet.lignes.get(n);
    if (!cellules?.length) continue;
    const a = valeurCellule(cellules, COL.date).toLowerCase();
    const g = valeurCellule(cellules, COL.description).toLowerCase();
    const estEntete = a.startsWith('date') || g.includes('description') || g.includes('travaux') || g.includes('taches');
    if (estEntete) {
      ligneEntete = n;
      const largeur = Math.max(...cellules.map((c) => c.colonne));
      entetes = Array.from({ length: largeur }, (_, i) => valeurCellule(cellules, i + 1));
    } else if (ligneEntete && valeurCellule(cellules, COL.client)) {
      ligneDonnees = n;
    }
  }
  if (!ligneEntete) throw new ErreurHttp(400, `Aucune ligne d'en-tete reperee dans l'onglet « ${ONGLET_SUIVI} »`);
  return { entetes, ligneEntete, ligneDonnees: ligneDonnees || ligneEntete + 1 };
}

// ---------------------------------------------------------------------------
// Onglet « sem N »
// ---------------------------------------------------------------------------

/** Lignes de l'onglet hebdomadaire, telles que decrites dans la section 9. */
export const LIGNES_SEMAINE = {
  nouveauxLeads: 4,
  dossiersTraites: 5,
  documentsEmis: 6,
  relancesEnvoyees: 7,
  // Lignes 8 a 11 : laissees vides, l'export n'y touche pas.
  validationsObtenues: 12,
  faitsMarquants: 13,
  expeditionsParties: 14,
  pointsVigilance: 15,
  actionsSemaineSuivante: 16,
  appuiDemande: 17,
  pointsBloquants: 18,
} as const;

/** Lignes que l'export laisse intactes, quoi qu'il arrive. */
export const LIGNES_SEMAINE_INTOUCHABLES = [8, 9, 10, 11];

export interface ColonneSemaine {
  /** Indicateurs numeriques du jour. */
  nouveauxLeads: number;
  dossiersTraites: number;
  documentsEmis: number;
  relancesEnvoyees: number;
  validationsObtenues: number;
  expeditionsParties: number;
  /** Syntheses texte, sans aucune reference (BL, commande, booking). */
  faitsMarquants: string;
  pointsVigilance: string;
  actionsSemaineSuivante: string;
  appuiDemande: string;
  pointsBloquants: string;
}

/** Motifs de reference interdits dans les onglets « sem » (regle de la section 9). */
const MOTIFS_REFERENCE = [
  /\bBL\s*[-\s:]?\s*[A-Z0-9][A-Z0-9-]{2,}/gi,
  /\bAWB\s*[-\s:]?\s*[A-Z0-9][A-Z0-9-]{2,}/gi,
  /\bPFI\s*[-\s:]?\s*[A-Z0-9][A-Z0-9-]{2,}/gi,
  /\bbooking\s*[-\s:]?\s*[A-Z0-9][A-Z0-9-]{2,}/gi,
  /\bcommande\s*(?:n[o°]?\s*)?[-\s:]?\s*[A-Z0-9][A-Z0-9-]{2,}/gi,
  /\b(?:facture|proforma)\s*(?:n[o°]?\s*)?[-\s:]?\s*[A-Z0-9][A-Z0-9-]{2,}/gi,
];

/**
 * Retire les references d'une synthese hebdomadaire.
 * L'onglet « sem » decrit l'activite, pas les dossiers : y laisser un numero de BL ou de booking
 * serait une fuite d'information vers un document de synthese partage.
 */
export function retirerReferences(texte: string): string {
  let sortie = texte;
  for (const motif of MOTIFS_REFERENCE) sortie = sortie.replace(motif, (m) => m.split(/[\s:-]/)[0]);
  return sortie.replace(/\s{2,}/g, ' ').trim();
}

/** Compte les indicateurs d'une journee pour l'onglet hebdomadaire. */
export async function construireColonneSemaine(compteId: number, jour: string): Promise<ColonneSemaine> {
  const debut = DateTime.fromISO(jour, { zone: 'utc' }).startOf('day').toJSDate();
  const fin = DateTime.fromISO(jour, { zone: 'utc' }).plus({ days: 1 }).startOf('day').toJSDate();
  const horsPerimetre = sql`${schema.demandes.famille} <> ${FAMILLE_HORS_PERIMETRE}`;

  const [nouveaux] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.demandes)
    .where(and(eq(schema.demandes.compteId, compteId), horsPerimetre, eq(schema.demandes.famille, 'T08'), gte(schema.demandes.ouverteLe, debut), lt(schema.demandes.ouverteLe, fin)));

  const [traites] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.demandes)
    .where(and(eq(schema.demandes.compteId, compteId), horsPerimetre, sql`${schema.demandes.termineeLe} IS NOT NULL`, gte(schema.demandes.termineeLe, debut), lt(schema.demandes.termineeLe, fin)));

  const parNature = await db
    .select({ nature: schema.evenements.nature, n: sql<number>`count(*)::int` })
    .from(schema.evenements)
    .innerJoin(schema.demandes, eq(schema.demandes.id, schema.evenements.demandeId))
    .where(and(eq(schema.evenements.compteId, compteId), horsPerimetre, gte(schema.evenements.survenuLe, debut), lt(schema.evenements.survenuLe, fin)))
    .groupBy(schema.evenements.nature);
  const compte = (nature: string) => parNature.find((p) => p.nature === nature)?.n ?? 0;

  const [expeditions] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.echeances)
    .innerJoin(schema.dossiers, eq(schema.dossiers.id, schema.echeances.dossierId))
    .where(and(eq(schema.dossiers.compteId, compteId), eq(schema.echeances.type, 'etd'), gte(schema.echeances.echeanceLe, debut), lt(schema.echeances.echeanceLe, fin)));

  const bloc = await construireBlocJour(compteId, jour);
  const bloques = bloc.lignes.filter((l) => l.statut === 'Bloque');
  const termines = bloc.lignes.filter((l) => l.statut === 'Termine');
  const enCours = bloc.lignes.filter((l) => l.statut === 'En cours' || l.statut === 'En attente client');

  // Les syntheses decrivent l'activite sans reprendre la moindre reference de dossier.
  const synthese = (lignes: typeof bloc.lignes, maximum = 3) =>
    retirerTiretsLongs(
      retirerReferences(
        lignes
          .slice(0, maximum)
          .map((l) => `${l.client} : ${l.description.replace(/^\d+\.\s*/, '').replace(/\s*:\s*[^:]*$/, '')}`)
          .join(' ; '),
      ),
    );

  return {
    nouveauxLeads: nouveaux?.n ?? 0,
    dossiersTraites: traites?.n ?? 0,
    documentsEmis: compte('envoi_livrable'),
    relancesEnvoyees: compte('relance_emise'),
    validationsObtenues: compte('validation_do'),
    expeditionsParties: expeditions?.n ?? 0,
    faitsMarquants: synthese(termines.length ? termines : enCours),
    pointsVigilance: bloques.length ? synthese(bloques) : 'Rien a signaler',
    actionsSemaineSuivante: synthese(enCours),
    appuiDemande: bloques.length ? 'Arbitrage demande sur les dossiers bloques' : 'Aucun',
    pointsBloquants: bloques.length ? synthese(bloques) : '',
  };
}

/** Ecrit une colonne de jour (B a F) dans l'onglet hebdomadaire. */
export function ecrireColonneSemaine(classeur: ClasseurModifiable, onglet: string, colonne: number, donnees: ColonneSemaine) {
  const ecrire = (ligne: number, valeur: string | number | null) => classeur.definirCellule(onglet, colonne, ligne, valeur);
  ecrire(LIGNES_SEMAINE.nouveauxLeads, donnees.nouveauxLeads);
  ecrire(LIGNES_SEMAINE.dossiersTraites, donnees.dossiersTraites);
  ecrire(LIGNES_SEMAINE.documentsEmis, donnees.documentsEmis);
  ecrire(LIGNES_SEMAINE.relancesEnvoyees, donnees.relancesEnvoyees);
  ecrire(LIGNES_SEMAINE.validationsObtenues, donnees.validationsObtenues);
  ecrire(LIGNES_SEMAINE.expeditionsParties, donnees.expeditionsParties);
  ecrire(LIGNES_SEMAINE.faitsMarquants, donnees.faitsMarquants || null);
  ecrire(LIGNES_SEMAINE.pointsVigilance, donnees.pointsVigilance || null);
  ecrire(LIGNES_SEMAINE.actionsSemaineSuivante, donnees.actionsSemaineSuivante || null);
  ecrire(LIGNES_SEMAINE.appuiDemande, donnees.appuiDemande || null);
  ecrire(LIGNES_SEMAINE.pointsBloquants, donnees.pointsBloquants || null);
}

// ---------------------------------------------------------------------------
// Export complet
// ---------------------------------------------------------------------------

export interface OptionsExport {
  compteId: number;
  /** Jours a ecrire dans « Suivi Quotidien », au format AAAA-MM-JJ. */
  jours: string[];
  /** Ecrire aussi l'onglet hebdomadaire correspondant a la semaine des jours demandes. */
  ongletSemaine?: boolean;
}

export interface BilanExport {
  joursEcrits: string[];
  lignesEcrites: number;
  ongletSemaine: string | null;
  coloneesSemaine: number;
  /** Onglets presents dans le classeur, pour que l'utilisateur verifie qu'il a fourni le bon. */
  onglets: string[];
}

export async function exporterReporting(
  buffer: Buffer,
  options: OptionsExport,
  auteur: Auteur,
): Promise<{ fichier: Buffer; bilan: BilanExport }> {
  if (!options.jours.length) throw new ErreurHttp(400, 'Indiquez au moins un jour a exporter');
  const modele = repererModele(buffer);
  const classeur = new ClasseurModifiable(buffer);

  let lignesEcrites = 0;
  const joursEcrits: string[] = [];
  for (const jour of [...options.jours].sort()) {
    const bloc = await construireBlocJour(options.compteId, jour);
    if (!bloc.lignes.length) continue;
    ecrireBlocJour(classeur, bloc, modele);
    lignesEcrites += bloc.lignes.length;
    joursEcrits.push(jour);
  }

  let nomSemaine: string | null = null;
  let colonnesSemaine = 0;
  if (options.ongletSemaine && joursEcrits.length) {
    const premier = DateTime.fromISO(joursEcrits[0]);
    const candidat = nomOngletSemaine(premier.weekNumber, premier.weekYear);
    const present = classeur.nomsOnglets().find((n) => n.trim().toLowerCase() === candidat.toLowerCase());
    if (!present) {
      throw new ErreurHttp(
        400,
        `Onglet « ${candidat} » absent du classeur. Onglets presents : ${classeur.nomsOnglets().join(', ')}. Verifiez la plage de dates de l'en-tete.`,
      );
    }
    nomSemaine = present;
    // Colonnes B a F = lundi a vendredi.
    for (let jourSemaine = 1; jourSemaine <= 5; jourSemaine++) {
      const jour = premier.set({ weekday: jourSemaine as 1 | 2 | 3 | 4 | 5 }).toISODate()!;
      if (!joursEcrits.includes(jour)) continue;
      ecrireColonneSemaine(classeur, present, jourSemaine + 1, await construireColonneSemaine(options.compteId, jour));
      colonnesSemaine++;
    }
  }

  const fichier = classeur.versBuffer();
  const bilan: BilanExport = {
    joursEcrits,
    lignesEcrites,
    ongletSemaine: nomSemaine,
    coloneesSemaine: colonnesSemaine,
    onglets: classeur.nomsOnglets(),
  };

  await journaliser('reporting_exporte', {
    utilisateurId: auteur.utilisateurId,
    auteurType: auteur.type,
    entite: 'compte',
    entiteId: options.compteId,
    details: { ...bilan },
  });
  return { fichier, bilan };
}
