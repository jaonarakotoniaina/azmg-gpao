/**
 * Brouillons prepares par l'application (phase 5, section 10 de CLAUDE.md).
 *
 * **Aucune action sortante sans validation humaine.** Rien ici n'envoie quoi que ce soit : chaque
 * fonction produit un texte a relire, que le poste copie dans son client de messagerie ou dans
 * son classeur. Le cycle de vie d'un brouillon est `prepare`, puis `utilise` (le poste l'a envoye
 * lui-meme) ou `ecarte`.
 *
 * **Chaque brouillon cite ses sources.** Le champ `sources` porte les identifiants des evenements
 * qui l'ont produit, et le texte lui-meme reprend les faits dates. On doit toujours pouvoir
 * remonter d'une phrase du brouillon a l'evenement qui la justifie.
 */
import { and, asc, desc, eq, gte, inArray, lt, sql, type SQL } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { db, schema } from '../../db/client';
import { ErreurHttp } from '../../lib/http';
import { journaliser } from '../../lib/evenements';
import { horairesDuCompte, lireParametres } from '../../lib/parametres';
import { tempsDemandeAvecHoraires, type Demande } from '../demandes/service';
import { construireBlocJour, construireColonneSemaine, nomOngletSemaine } from '../export/service';
import { retirerTiretsLongs } from '@shared/tirets';
import { formaterDuree, minutesParJourOuvre, type HorairesOuvres } from '@shared/heures-ouvrees';
import { FAMILLE_HORS_PERIMETRE, LIBELLES_ECHEANCES, libelleStatut, statutReporting, type Acteur, type TypeEcheance } from '@shared/constantes';
import type { Auteur } from '../demandes/service';

export type Brouillon = typeof schema.brouillons.$inferSelect;

export type TypeBrouillon = 'relance' | 'daily' | 'semaine' | 'situation_client' | 'comparatif_cotations';

export interface EntreeBrouillon {
  compteId: number;
  type: TypeBrouillon;
  dossierId?: number | null;
  demandeId?: number | null;
  titre: string;
  contenu: string;
  donnees?: Record<string, unknown>;
  sources: number[];
  niveau?: number | null;
  /** Cle de regroupement : un seul brouillon du meme type par cible et par periode. */
  cleUnicite: string;
}

/**
 * Enregistre un brouillon, ou renvoie celui qui existe deja pour la meme cle.
 *
 * L'unicite evite qu'un second passage du cron le matin produise un doublon, et surtout qu'il
 * ecrase un brouillon que le poste a deja traite.
 */
export async function enregistrerBrouillon(entree: EntreeBrouillon, auteur: Auteur): Promise<{ brouillon: Brouillon; cree: boolean }> {
  const [deja] = await db.select().from(schema.brouillons).where(eq(schema.brouillons.cleUnicite, entree.cleUnicite));
  if (deja) return { brouillon: deja, cree: false };

  const [brouillon] = await db
    .insert(schema.brouillons)
    .values({
      compteId: entree.compteId,
      type: entree.type,
      dossierId: entree.dossierId ?? null,
      demandeId: entree.demandeId ?? null,
      titre: retirerTiretsLongs(entree.titre),
      // Dernier filtre avant qu'un texte arrive sous les yeux d'un humain.
      contenu: retirerTiretsLongs(entree.contenu),
      donnees: entree.donnees ?? {},
      sources: entree.sources,
      niveau: entree.niveau ?? null,
      cleUnicite: entree.cleUnicite,
    })
    .returning();

  await journaliser('brouillon_prepare', {
    utilisateurId: auteur.utilisateurId,
    auteurType: auteur.type,
    entite: 'brouillon',
    entiteId: brouillon.id,
    details: { type: entree.type, demandeId: entree.demandeId ?? null, sources: entree.sources.length },
  });
  return { brouillon, cree: true };
}

/** Marque un brouillon comme utilise ou ecarte. L'application n'envoie toujours rien. */
export async function deciderBrouillon(id: number, statut: 'utilise' | 'ecarte', auteur: Auteur): Promise<Brouillon> {
  // Un brouillon ne se tranche qu'une fois : sans ce garde-fou, un second clic effacerait
  // l'auteur et l'horodatage de la premiere decision.
  const [maj] = await db
    .update(schema.brouillons)
    .set({ statut, decideLe: new Date(), decideParId: auteur.utilisateurId, majLe: new Date() })
    .where(and(eq(schema.brouillons.id, id), eq(schema.brouillons.statut, 'prepare')))
    .returning();
  if (!maj) {
    const [existe] = await db.select({ statut: schema.brouillons.statut }).from(schema.brouillons).where(eq(schema.brouillons.id, id));
    if (!existe) throw new ErreurHttp(404, 'Brouillon introuvable');
    throw new ErreurHttp(409, `Ce brouillon a deja ete traite (${existe.statut === 'utilise' ? 'envoye' : 'ecarte'}).`);
  }
  await journaliser('brouillon_decide', {
    utilisateurId: auteur.utilisateurId,
    auteurType: auteur.type,
    entite: 'brouillon',
    entiteId: id,
    details: { statut, type: maj.type },
  });
  return maj;
}

export async function listerBrouillons(compteId: number, opts: { statut?: string; type?: TypeBrouillon; limite?: number } = {}) {
  const conditions: SQL[] = [eq(schema.brouillons.compteId, compteId)];
  if (opts.statut) conditions.push(eq(schema.brouillons.statut, opts.statut));
  if (opts.type) conditions.push(eq(schema.brouillons.type, opts.type));
  return db
    .select({
      brouillon: schema.brouillons,
      dossier: schema.dossiers.libelle,
      objet: schema.demandes.objet,
    })
    .from(schema.brouillons)
    .leftJoin(schema.dossiers, eq(schema.dossiers.id, schema.brouillons.dossierId))
    .leftJoin(schema.demandes, eq(schema.demandes.id, schema.brouillons.demandeId))
    .where(and(...conditions))
    .orderBy(desc(schema.brouillons.prepareLe))
    .limit(Math.min(opts.limite ?? 100, 300));
}

// ---------------------------------------------------------------------------
// Relances N1, N2, N3
// ---------------------------------------------------------------------------

export type Langue = 'fr' | 'en' | 'es';

/** Langue deduite du domaine de l'interlocuteur, pour rediger dans la bonne langue. */
export function langueDe(adresse: string | null | undefined): Langue {
  const domaine = (adresse ?? '').split('@')[1]?.toLowerCase() ?? '';
  if (/\.(es|mx|ar|co|cl|pe)$/.test(domaine)) return 'es';
  if (/\.(com|co\.uk|uk|us|ae|sa|in|sg)$/.test(domaine)) return 'en';
  return 'fr';
}

const FORMULES: Record<Langue, { bonjour: string; relance: (n: number) => string; attente: (d: string) => string; fin: string }> = {
  fr: {
    bonjour: 'Bonjour,',
    relance: (n) => (n === 1 ? 'Je me permets de revenir vers vous concernant le point ci-dessous.' : n === 2 ? 'Sans retour de votre part, je reviens vers vous sur ce point.' : 'Ce dossier reste bloque faute de retour. Pouvez-vous nous indiquer une date ?'),
    attente: (d) => `Ce point est en attente depuis ${d} ouvrees.`,
    fin: 'Merci par avance de votre retour.\nBien cordialement,',
  },
  en: {
    bonjour: 'Hello,',
    relance: (n) => (n === 1 ? 'I am following up on the point below.' : n === 2 ? 'As we have not heard back, I am following up again on this point.' : 'This file is still on hold without an answer. Could you confirm a date?'),
    attente: (d) => `This item has been pending for ${d} of working time.`,
    fin: 'Thank you in advance for your reply.\nKind regards,',
  },
  es: {
    bonjour: 'Buenos dias,',
    relance: (n) => (n === 1 ? 'Me permito volver a escribirle sobre el punto siguiente.' : n === 2 ? 'Al no haber recibido respuesta, insisto sobre este punto.' : 'Este expediente sigue bloqueado sin respuesta. Podria indicarnos una fecha?'),
    attente: (d) => `Este punto lleva ${d} de tiempo laborable en espera.`,
    fin: 'Gracias de antemano por su respuesta.\nAtentamente,',
  },
};

const UNITES: Record<Langue, { jour: [string, string]; heure: [string, string]; et: string; moinsDUneHeure: string }> = {
  fr: { jour: ['jour', 'jours'], heure: ['heure', 'heures'], et: 'et', moinsDUneHeure: 'moins d’une heure' },
  en: { jour: ['day', 'days'], heure: ['hour', 'hours'], et: 'and', moinsDUneHeure: 'less than an hour' },
  es: { jour: ['dia', 'dias'], heure: ['hora', 'horas'], et: 'y', moinsDUneHeure: 'menos de una hora' },
};

/**
 * Duree d'attente en mots, dans la langue du brouillon.
 *
 * `formaterDuree` abrege en francais (« 3 j 2 h »), ce qui est juste dans l'interface mais detonne
 * dans un message adresse a un transitaire anglophone ou hispanophone.
 */
export function dureeLocalisee(minutes: number, langue: Langue, minutesParJour = 540): string {
  const u = UNITES[langue];
  const jours = Math.floor(minutes / minutesParJour);
  const heures = Math.floor((minutes - jours * minutesParJour) / 60);
  const morceaux: string[] = [];
  if (jours) morceaux.push(`${jours} ${jours > 1 ? u.jour[1] : u.jour[0]}`);
  if (heures) morceaux.push(`${heures} ${heures > 1 ? u.heure[1] : u.heure[0]}`);
  if (!morceaux.length) return u.moinsDUneHeure;
  return morceaux.join(` ${u.et} `);
}

export interface RelanceAPreparer {
  demande: Demande;
  dossier: string;
  niveau: 1 | 2 | 3;
  minutesAttente: number;
  destinataire: string | null;
  sources: number[];
  /** Resumes des derniers evenements, repris tels quels dans le brouillon. */
  faits: { le: Date; resume: string }[];
  /** Longueur d'un jour ouvre du compte, pour exprimer l'attente en jours justes. */
  minutesParJour: number;
}

/**
 * Demandes qui meritent une relance, et a quel niveau.
 *
 * Le niveau depend du temps d'attente en heures ouvrees, pas du nombre de relances deja envoyees :
 * une demande qui attend depuis trois jours merite un N2, meme si aucune relance n'est partie.
 * Une relance deja preparee au meme niveau n'est pas reproposee (cle d'unicite).
 */
export async function relancesAPreparer(compteId: number, maintenant = new Date()): Promise<RelanceAPreparer[]> {
  const parametres = await lireParametres();
  const seuils = parametres.sla.relances;

  const lignes = await db
    .select({ demande: schema.demandes, dossier: schema.dossiers.libelle })
    .from(schema.demandes)
    .innerJoin(schema.dossiers, eq(schema.dossiers.id, schema.demandes.dossierId))
    .where(
      and(
        eq(schema.demandes.compteId, compteId),
        sql`${schema.demandes.famille} <> ${FAMILLE_HORS_PERIMETRE}`,
        // Une relance ne concerne que ce qui attend quelqu'un d'autre que le poste.
        inArray(schema.demandes.statut, ['attente_tiers', 'attente_do']),
      ),
    );
  if (!lignes.length) return [];

  const horaires: HorairesOuvres = await horairesDuCompte(compteId);
  const debuts = await debutsDeStatut(lignes.map((l) => l.demande));
  const sorties: RelanceAPreparer[] = [];

  // Niveau de relance de chaque demande eligible, calcule avant de toucher aux evenements.
  const eligibles: { demande: Demande; dossier: string; niveau: 1 | 2 | 3; minutesAttente: number }[] = [];
  for (const { demande, dossier } of lignes) {
    const temps = tempsDemandeAvecHoraires(demande, debuts.get(demande.id) ?? demande.ouverteLe, horaires, maintenant);
    const attente = temps.statutCourant / 60;
    const niveau = attente >= seuils.n3 ? 3 : attente >= seuils.n2 ? 2 : attente >= seuils.n1 ? 1 : 0;
    if (!niveau) continue;
    // Une relance deja emise a ce niveau ou au-dela n'est pas reproposee.
    if (demande.niveauRelance >= niveau) continue;
    eligibles.push({ demande, dossier, niveau: niveau as 1 | 2 | 3, minutesAttente: temps.statutCourant });
  }
  if (!eligibles.length) return [];

  // Un seul passage sur les evenements des demandes retenues, plutot qu'une requete par demande.
  const evenements = await db
    .select()
    .from(schema.evenements)
    .where(inArray(schema.evenements.demandeId, eligibles.map((e) => e.demande.id)))
    .orderBy(desc(schema.evenements.survenuLe));
  const parDemande = new Map<number, typeof evenements>();
  for (const e of evenements) {
    if (!e.demandeId) continue;
    const liste = parDemande.get(e.demandeId) ?? [];
    // Les quatre derniers suffisent : le brouillon ne cite que des faits recents.
    if (liste.length < 4) liste.push(e);
    parDemande.set(e.demandeId, liste);
  }

  for (const { demande, dossier, niveau, minutesAttente } of eligibles) {
    const recents = parDemande.get(demande.id) ?? [];
    const dernierSortant = recents.find((e) => e.sens === 'sortant');
    sorties.push({
      demande,
      dossier,
      niveau,
      minutesAttente,
      destinataire: dernierSortant?.destinataires ? ((dernierSortant.destinataires as string[])[0] ?? null) : null,
      sources: recents.map((e) => e.id),
      faits: recents
        .filter((e) => e.resume)
        .slice(0, 3)
        .map((e) => ({ le: e.survenuLe, resume: e.resume! })),
      minutesParJour: minutesParJourOuvre(horaires),
    });
  }

  return sorties.sort((a, b) => b.minutesAttente - a.minutesAttente);
}

/** Redige le brouillon d'une relance. Il cite les faits dates qui le justifient. */
export function redigerRelance(relance: RelanceAPreparer): string {
  const langue = langueDe(relance.destinataire);
  const f = FORMULES[langue];
  const lignes = [f.bonjour, '', f.relance(relance.niveau), '', `${relance.dossier} : ${relance.demande.objet}`];

  if (relance.faits.length) {
    lignes.push('');
    for (const fait of relance.faits) {
      lignes.push(`  ${DateTime.fromJSDate(fait.le).toFormat('dd/MM/yyyy')} : ${fait.resume}`);
    }
  }

  lignes.push('', f.attente(dureeLocalisee(relance.minutesAttente, langue, relance.minutesParJour)), '', f.fin);
  return retirerTiretsLongs(lignes.join('\n'));
}

export async function preparerRelances(compteId: number, auteur: Auteur, maintenant = new Date()) {
  const aPreparer = await relancesAPreparer(compteId, maintenant);
  const jour = DateTime.fromJSDate(maintenant).toISODate();
  let crees = 0;
  for (const relance of aPreparer) {
    const { cree } = await enregistrerBrouillon(
      {
        compteId,
        type: 'relance',
        dossierId: relance.demande.dossierId,
        demandeId: relance.demande.id,
        niveau: relance.niveau,
        titre: `Relance N${relance.niveau} : ${relance.demande.objet}`,
        contenu: redigerRelance(relance),
        donnees: { minutesAttente: relance.minutesAttente, destinataire: relance.destinataire, langue: langueDe(relance.destinataire) },
        sources: relance.sources,
        // Une seule relance par demande et par niveau, quel que soit le nombre de passages.
        cleUnicite: `relance:${relance.demande.id}:n${relance.niveau}`,
      },
      auteur,
    );
    if (cree) crees++;
  }
  return { candidates: aPreparer.length, crees, jour };
}

// ---------------------------------------------------------------------------
// Daily et onglet « sem »
// ---------------------------------------------------------------------------

export async function preparerDaily(compteId: number, jour: string, auteur: Auteur) {
  const bloc = await construireBlocJour(compteId, jour);
  if (!bloc.lignes.length) return { cree: false, lignes: 0 };

  const date = DateTime.fromISO(jour).toFormat('dd/MM/yyyy');
  const corps = bloc.lignes.map((l) => `${l.description}\n  ${l.client} | ${l.produit}${l.livrables ? `\n  Livrables : ${l.livrables}` : ''}${l.prioriteLendemain && l.prioriteLendemain !== 'Aucune' ? `\n  Demain : ${l.prioriteLendemain}` : ''}`);

  const contenu = [
    `Reporting du ${date}`,
    '',
    ...corps,
    '',
    `${bloc.lignes.length} dossier(s) suivi(s) ce jour.`,
    '',
    "Ce texte est un brouillon. L'ecriture dans le classeur se fait dans l'ecran Export.",
  ].join('\n');

  const sources = await evenementsDuJour(compteId, jour);
  const { cree } = await enregistrerBrouillon(
    {
      compteId,
      type: 'daily',
      titre: `Reporting du ${date}`,
      contenu,
      donnees: { jour, lignes: bloc.lignes },
      sources,
      cleUnicite: `daily:${compteId}:${jour}`,
    },
    auteur,
  );
  return { cree, lignes: bloc.lignes.length };
}

export async function preparerSemaine(compteId: number, jourDansLaSemaine: string, auteur: Auteur) {
  const reference = DateTime.fromISO(jourDansLaSemaine);
  const onglet = nomOngletSemaine(reference.weekNumber, reference.weekYear);
  const colonnes: { jour: string; libelle: string; donnees: Awaited<ReturnType<typeof construireColonneSemaine>> }[] = [];

  for (let jourSemaine = 1; jourSemaine <= 5; jourSemaine++) {
    const jour = reference.set({ weekday: jourSemaine as 1 | 2 | 3 | 4 | 5 }).toISODate()!;
    colonnes.push({
      jour,
      libelle: DateTime.fromISO(jour).setLocale('fr').toFormat('cccc dd/MM'),
      donnees: await construireColonneSemaine(compteId, jour),
    });
  }

  const total = colonnes.reduce((s, c) => s + c.donnees.dossiersTraites, 0);
  const contenu = [
    `Onglet « ${onglet} », semaine ${reference.weekNumber}`,
    '',
    ...colonnes.map((c) =>
      [
        c.libelle,
        `  Nouveaux leads : ${c.donnees.nouveauxLeads}`,
        `  Dossiers traites : ${c.donnees.dossiersTraites}`,
        `  Documents emis : ${c.donnees.documentsEmis}`,
        `  Relances envoyees : ${c.donnees.relancesEnvoyees}`,
        `  Validations obtenues : ${c.donnees.validationsObtenues}`,
        `  Expeditions parties : ${c.donnees.expeditionsParties}`,
        c.donnees.faitsMarquants ? `  Faits marquants : ${c.donnees.faitsMarquants}` : null,
        c.donnees.pointsBloquants ? `  Points bloquants : ${c.donnees.pointsBloquants}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
    ),
    '',
    `${total} dossier(s) traite(s) sur la semaine.`,
    '',
    "Les onglets « sem » ne portent aucune reference de dossier : seules les syntheses y figurent.",
  ].join('\n\n');

  const sources = (await Promise.all(colonnes.map((c) => evenementsDuJour(compteId, c.jour)))).flat();
  const { cree } = await enregistrerBrouillon(
    {
      compteId,
      type: 'semaine',
      titre: `Onglet ${onglet}, semaine ${reference.weekNumber}`,
      contenu,
      donnees: { onglet, semaine: reference.weekNumber, colonnes },
      sources: [...new Set(sources)],
      cleUnicite: `semaine:${compteId}:${reference.weekYear}-W${String(reference.weekNumber).padStart(2, '0')}`,
    },
    auteur,
  );
  return { cree, onglet };
}

// ---------------------------------------------------------------------------
// Tableau de situation par client
// ---------------------------------------------------------------------------

/** Complement correct apres « en attente » : « du poste », « de la DO », jamais « de le poste ». */
function complementActeur(acteur: Acteur): string {
  switch (acteur) {
    case 'poste':
      return 'de notre cote';
    case 'do':
      return 'de la validation de la donneuse d’ordre';
    case 'client':
      return 'de votre retour';
    case 'tiers':
      return 'du retour d’un tiers';
    default:
      return 'de personne';
  }
}

export async function preparerSituationClient(compteId: number, client: string, auteur: Auteur, maintenant = new Date()) {
  const dossiers = await db
    .select()
    .from(schema.dossiers)
    .where(and(eq(schema.dossiers.compteId, compteId), eq(schema.dossiers.client, client)))
    .orderBy(asc(schema.dossiers.libelle));
  if (!dossiers.length) throw new ErreurHttp(404, `Aucun dossier pour le client « ${client} »`);

  const horaires = await horairesDuCompte(compteId);
  const ids = dossiers.map((d) => d.id);

  // Trois requetes pour tout le client, au lieu de trois par dossier.
  const toutesDemandes = await db
    .select()
    .from(schema.demandes)
    .where(and(inArray(schema.demandes.dossierId, ids), sql`${schema.demandes.famille} <> ${FAMILLE_HORS_PERIMETRE}`))
    .orderBy(desc(schema.demandes.ouverteLe));
  const debuts = await debutsDeStatut(toutesDemandes);

  const prochaines = toutesDemandes.length
    ? await db
        .select()
        .from(schema.echeances)
        .where(
          and(
            inArray(schema.echeances.dossierId, ids),
            eq(schema.echeances.annulee, false),
            sql`${schema.echeances.honoreeLe} IS NULL`,
          ),
        )
        .orderBy(asc(schema.echeances.echeanceLe))
    : [];
  const derniersEvenements = await db
    .select({ id: schema.evenements.id, dossierId: schema.evenements.dossierId })
    .from(schema.evenements)
    .where(inArray(schema.evenements.dossierId, ids))
    .orderBy(desc(schema.evenements.survenuLe));

  const parDossier = <T extends { dossierId: number | null }>(liste: T[]) => {
    const carte = new Map<number, T[]>();
    for (const item of liste) {
      if (item.dossierId === null) continue;
      const deja = carte.get(item.dossierId) ?? [];
      deja.push(item);
      carte.set(item.dossierId, deja);
    }
    return carte;
  };
  const demandesParDossier = parDossier(toutesDemandes);
  const echeancesParDossier = parDossier(prochaines);
  const evenementsParDossier = parDossier(derniersEvenements);

  const lignes: string[] = [];
  const sources: number[] = [];
  const donnees: Record<string, unknown>[] = [];

  for (const dossier of dossiers) {
    const demandes = demandesParDossier.get(dossier.id) ?? [];
    if (!demandes.length) continue;

    const ouvertes = demandes.filter((d) => d.statut !== 'termine' && d.statut !== 'annule');
    const porteuse = ouvertes[0] ?? demandes[0];
    const temps = tempsDemandeAvecHoraires(porteuse, debuts.get(porteuse.id) ?? porteuse.ouverteLe, horaires, maintenant);

    const echeance = (echeancesParDossier.get(dossier.id) ?? [])[0];
    const prochaine = echeance
      ? `${echeance.libelle ?? LIBELLES_ECHEANCES[echeance.type as TypeEcheance] ?? echeance.type} le ${DateTime.fromJSDate(echeance.echeanceLe).toFormat('dd/MM/yyyy')}`
      : null;

    lignes.push(
      [
        `${dossier.libelle}`,
        `  Etat : ${statutReporting(porteuse.statut)}${porteuse.statut === 'attente_do' ? ' (validation DO attendue)' : ''}`,
        `  En cours : ${porteuse.objet}`,
        ouvertes.length > 1 ? `  Autres points ouverts : ${ouvertes.length - 1}` : null,
        `  En attente ${complementActeur(porteuse.acteurAttendu)} depuis ${formaterDuree(temps.statutCourant)}`,
        prochaine ? `  Prochaine echeance : ${prochaine}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
    );
    donnees.push({ dossierId: dossier.id, libelle: dossier.libelle, statut: statutReporting(porteuse.statut), ouvertes: ouvertes.length });
    sources.push(...(evenementsParDossier.get(dossier.id) ?? []).slice(0, 3).map((e) => e.id));
  }

  if (!lignes.length) throw new ErreurHttp(404, `Aucune demande en perimetre pour le client « ${client} »`);

  const date = DateTime.fromJSDate(maintenant).setLocale('fr').toFormat('dd/MM/yyyy');
  const contenu = [`Situation ${client} au ${date}`, '', ...lignes, '', 'Brouillon a relire avant envoi.'].join('\n\n');

  const { cree, brouillon } = await enregistrerBrouillon(
    {
      compteId,
      type: 'situation_client',
      titre: `Situation ${client} au ${date}`,
      contenu,
      donnees: { client, dossiers: donnees },
      sources: [...new Set(sources)],
      cleUnicite: `situation:${compteId}:${client}:${DateTime.fromJSDate(maintenant).toISODate()}`,
    },
    auteur,
  );
  return { cree, brouillon };
}

// ---------------------------------------------------------------------------
// Comparatif de cotations fret
// ---------------------------------------------------------------------------

export interface OffreFret {
  evenementId: number;
  transitaire: string;
  prix: string | null;
  devise: string | null;
  cutOff: string | null;
  etd: string | null;
  eta: string | null;
  transit: string | null;
  validite: string | null;
  recuLe: Date;
}

/**
 * Extrait les elements d'une offre de fret du texte d'un message.
 *
 * Ce sont des expressions regulieres, pas une comprehension du texte : un champ absent reste
 * **vide**, jamais devine. Mieux vaut une colonne vide que le poste complete, qu'un chiffre
 * invente dans un comparatif de prix soumis a la DO.
 */
export function extraireOffre(texte: string, evenementId: number, transitaire: string, recuLe: Date): OffreFret {
  const t = texte.replace(/\s+/g, ' ');
  const prix = /(\d[\d\s.,]{1,12})\s*(eur|euros?|usd|dollars?|\$|€)/i.exec(t);
  const devise = prix ? normaliserDevise(prix[2]) : null;
  const cutOff = /cut[\s-]?off[^.]{0,40}?(\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?)/i.exec(t);
  const etd = /\betd\b[^.]{0,30}?(\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?)/i.exec(t);
  const eta = /\beta\b[^.]{0,30}?(\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?)/i.exec(t);
  const transit = /transit[^.]{0,20}?(\d{1,3})\s*(jours?|days?|j\b)/i.exec(t);
  const validite = /validit[ey][^.]{0,30}?(\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?|\d{1,3}\s*jours?)/i.exec(t);

  return {
    evenementId,
    transitaire,
    prix: prix ? prix[1].trim().replace(/\s/g, ' ') : null,
    devise,
    cutOff: cutOff ? cutOff[1] : null,
    etd: etd ? etd[1] : null,
    eta: eta ? eta[1] : null,
    transit: transit ? `${transit[1]} jours` : null,
    validite: validite ? validite[1] : null,
    recuLe,
  };
}

function normaliserDevise(brut: string): string {
  const v = brut.toLowerCase();
  if (v.startsWith('eur') || v === '€') return 'EUR';
  if (v.startsWith('usd') || v.startsWith('dollar') || v === '$') return 'USD';
  return brut.toUpperCase();
}

export async function preparerComparatifCotations(dossierId: number, auteur: Auteur, maintenant = new Date()) {
  const [dossier] = await db.select().from(schema.dossiers).where(eq(schema.dossiers.id, dossierId));
  if (!dossier) throw new ErreurHttp(404, 'Dossier introuvable');

  // Les offres sont les messages entrants de la famille des cotations fret.
  const evenements = await db
    .select()
    .from(schema.evenements)
    .where(and(eq(schema.evenements.dossierId, dossierId), eq(schema.evenements.sens, 'entrant'), eq(schema.evenements.famille, 'T01')))
    .orderBy(asc(schema.evenements.survenuLe));
  if (!evenements.length) throw new ErreurHttp(404, 'Aucune offre de fret recue sur ce dossier');

  const offres = evenements.map((e) =>
    extraireOffre(`${e.objet ?? ''} ${e.contenu ?? e.resume ?? ''}`, e.id, (e.expediteur ?? 'transitaire inconnu').split('@')[0], e.survenuLe),
  );

  const colonnes = ['Transitaire', 'Prix', 'Cut-off', 'ETD', 'ETA', 'Transit', 'Validite'];
  const lignes = offres.map((o) => [
    o.transitaire,
    o.prix ? `${o.prix}${o.devise ? ` ${o.devise}` : ''}` : '',
    o.cutOff ?? '',
    o.etd ?? '',
    o.eta ?? '',
    o.transit ?? '',
    o.validite ?? '',
  ]);

  const largeurs = colonnes.map((c, i) => Math.max(c.length, ...lignes.map((l) => l[i].length)));
  const ligneTexte = (cellules: string[]) => cellules.map((c, i) => c.padEnd(largeurs[i])).join('  ').trimEnd();
  const manquants = offres.filter((o) => !o.prix).length;

  const contenu = [
    `Comparatif des cotations : ${dossier.libelle}`,
    `Au ${DateTime.fromJSDate(maintenant).toFormat('dd/MM/yyyy')}, ${offres.length} offre(s) recue(s).`,
    '',
    ligneTexte(colonnes),
    largeurs.map((l) => '-'.repeat(l)).join('  '),
    ...lignes.map(ligneTexte),
    '',
    manquants
      ? `${manquants} offre(s) sans prix lisible : les cases vides sont a completer a la main, rien n'a ete devine.`
      : 'Tous les prix ont ete lus dans les messages recus.',
    '',
    'Brouillon a relire. Le choix du transitaire et du prix revient a la DO.',
  ].join('\n');

  const { cree, brouillon } = await enregistrerBrouillon(
    {
      compteId: dossier.compteId,
      type: 'comparatif_cotations',
      dossierId,
      titre: `Comparatif des cotations : ${dossier.libelle}`,
      contenu,
      donnees: { offres, colonnes },
      sources: offres.map((o) => o.evenementId),
      cleUnicite: `comparatif:${dossierId}:${offres.length}:${offres.map((o) => o.evenementId).join('-')}`,
    },
    auteur,
  );
  return { cree, brouillon, offres };
}

// ---------------------------------------------------------------------------
// Preparation du matin
// ---------------------------------------------------------------------------

/**
 * Prepare les brouillons du matin pour un compte : les relances, le daily de la veille et,
 * le lundi, l'onglet de la semaine ecoulee. Idempotent : un second passage ne cree rien.
 */
export async function preparerLeMatin(compteId: number, auteur: Auteur, maintenant = new Date()) {
  const parametres = await lireParametres();
  if (parametres.pauseAutomatisations) return { ignore: true as const, raison: 'automatisations en pause' };

  const bilan = { relances: 0, daily: 0, semaine: 0 };

  if (parametres.automatisations.relances?.actif !== false) {
    bilan.relances = (await preparerRelances(compteId, auteur, maintenant)).crees;
  }

  if (parametres.automatisations.daily?.actif !== false) {
    const veille = DateTime.fromJSDate(maintenant).minus({ days: 1 }).toISODate()!;
    if ((await preparerDaily(compteId, veille, auteur)).cree) bilan.daily++;
    // Le lundi, l'onglet de la semaine qui vient de s'achever.
    if (DateTime.fromJSDate(maintenant).weekday === 1) {
      if ((await preparerSemaine(compteId, veille, auteur)).cree) bilan.semaine++;
    }
  }

  return { ignore: false as const, ...bilan };
}

// ---------------------------------------------------------------------------
// Aides
// ---------------------------------------------------------------------------

async function debutsDeStatut(demandes: Demande[]): Promise<Map<number, Date>> {
  if (!demandes.length) return new Map();
  const lignes = await db
    .select({ demandeId: schema.transitionsStatut.demandeId, debut: sql<Date>`max(${schema.transitionsStatut.survenuLe})`.as('debut') })
    .from(schema.transitionsStatut)
    .where(inArray(schema.transitionsStatut.demandeId, demandes.map((d) => d.id)))
    .groupBy(schema.transitionsStatut.demandeId);
  return new Map(lignes.map((l) => [l.demandeId, new Date(l.debut)]));
}

/** Evenements d'une journee, cites comme sources d'un brouillon. */
async function evenementsDuJour(compteId: number, jour: string): Promise<number[]> {
  const debut = DateTime.fromISO(jour, { zone: 'utc' }).startOf('day').toJSDate();
  const fin = DateTime.fromISO(jour, { zone: 'utc' }).plus({ days: 1 }).startOf('day').toJSDate();
  const lignes = await db
    .select({ id: schema.evenements.id })
    .from(schema.evenements)
    .where(
      and(
        eq(schema.evenements.compteId, compteId),
        gte(schema.evenements.survenuLe, debut),
        lt(schema.evenements.survenuLe, fin),
        sql`coalesce(${schema.evenements.famille}, '') <> ${FAMILLE_HORS_PERIMETRE}`,
      ),
    )
    .limit(200);
  return lignes.map((l) => l.id);
}

export { libelleStatut, type Acteur };
