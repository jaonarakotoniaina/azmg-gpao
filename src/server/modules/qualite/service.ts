/**
 * Check-lists avant envoi et controle qualite (sections 8.6 et 8.8 de CLAUDE.md).
 *
 * Check-list avant envoi : par type d'envoi, declaree conforme ou non. Les non-conformites
 * alimentent la qualite, ce qui evite une double saisie.
 *
 * Controle qualite : grille ponderee par famille, echantillon hebdomadaire tire automatiquement
 * (10 % des envois par defaut), note sur 100, taux de reprise et « bon du premier coup »
 * (document valide par la DO sans correction).
 */
import { and, desc, eq, gte, inArray, isNull, lt, sql, type SQL } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { db, schema } from '../../db/client';
import { ErreurHttp } from '../../lib/http';
import { journaliser } from '../../lib/evenements';
import { lireParametres } from '../../lib/parametres';
import { FAMILLE_HORS_PERIMETRE } from '@shared/constantes';
import type { Auteur } from '../demandes/service';

export type Checklist = typeof schema.checklists.$inferSelect;
export type ControleEnvoi = typeof schema.controlesEnvoi.$inferSelect;
export type GrilleQualite = typeof schema.grillesQualite.$inferSelect;
export type ControleQualite = typeof schema.controlesQualite.$inferSelect;

export interface PointChecklist {
  cle: string;
  libelle: string;
  obligatoire: boolean;
}

export interface CritereGrille {
  cle: string;
  libelle: string;
  poids: number;
}

// ---------------------------------------------------------------------------
// Check-lists avant envoi
// ---------------------------------------------------------------------------

/** Check-lists applicables a une famille : celles qui la citent, ou celles sans famille (generiques). */
export async function checklistsPourFamille(famille: string, compteId?: number): Promise<Checklist[]> {
  const toutes = await db.select().from(schema.checklists).where(eq(schema.checklists.actif, true));
  return toutes.filter((c) => {
    if (c.compteId && compteId && c.compteId !== compteId) return false;
    const familles = (c.familles as string[]) ?? [];
    return familles.length === 0 || familles.includes(famille);
  });
}

export interface EntreeControleEnvoi {
  demandeId: number;
  checklistId: number;
  /** Reponse point par point : { cle: boolean }. */
  reponses: Record<string, boolean>;
  commentaire?: string | null;
  evenementId?: number | null;
}

/**
 * Enregistre un controle avant envoi. L'envoi est declare conforme si tous les points
 * **obligatoires** de la check-list sont coches ; un point facultatif non coche ne rend pas
 * l'envoi non conforme, il est seulement trace.
 */
export async function enregistrerControleEnvoi(entree: EntreeControleEnvoi, auteur: Auteur): Promise<ControleEnvoi> {
  const [demande] = await db.select().from(schema.demandes).where(eq(schema.demandes.id, entree.demandeId));
  if (!demande) throw new ErreurHttp(404, 'Demande introuvable');
  const [checklist] = await db.select().from(schema.checklists).where(eq(schema.checklists.id, entree.checklistId));
  if (!checklist) throw new ErreurHttp(404, 'Check-list introuvable');

  const points = (checklist.points as PointChecklist[]) ?? [];
  const inconnus = Object.keys(entree.reponses).filter((cle) => !points.some((p) => p.cle === cle));
  if (inconnus.length) throw new ErreurHttp(400, `Points inconnus pour cette check-list : ${inconnus.join(', ')}`);

  const manquants = points.filter((p) => p.obligatoire && entree.reponses[p.cle] !== true);
  const conforme = manquants.length === 0;

  const [controle] = await db
    .insert(schema.controlesEnvoi)
    .values({
      demandeId: entree.demandeId,
      checklistId: entree.checklistId,
      evenementId: entree.evenementId ?? null,
      reponses: entree.reponses,
      conforme,
      commentaire: entree.commentaire ?? null,
      controleParId: auteur.utilisateurId,
    })
    .returning();

  await journaliser('controle_envoi', {
    utilisateurId: auteur.utilisateurId,
    auteurType: auteur.type,
    entite: 'demande',
    entiteId: entree.demandeId,
    details: { checklist: checklist.code, conforme, pointsManquants: manquants.map((p) => p.cle) },
  });
  return controle;
}

export async function controlesEnvoiDeLaDemande(demandeId: number) {
  return db
    .select({ controle: schema.controlesEnvoi, checklist: schema.checklists.libelle, points: schema.checklists.points })
    .from(schema.controlesEnvoi)
    .leftJoin(schema.checklists, eq(schema.checklists.id, schema.controlesEnvoi.checklistId))
    .where(eq(schema.controlesEnvoi.demandeId, demandeId))
    .orderBy(desc(schema.controlesEnvoi.creeLe));
}

// ---------------------------------------------------------------------------
// Echantillon hebdomadaire
// ---------------------------------------------------------------------------

/** Semaine ISO au format AAAA-Www, cle de l'echantillon. */
export function cleSemaine(date: Date): string {
  const d = DateTime.fromJSDate(date);
  return `${d.weekYear}-W${String(d.weekNumber).padStart(2, '0')}`;
}

export function bornesSemaine(semaine: string): { debut: Date; fin: Date } {
  const [annee, numero] = semaine.split('-W');
  const d = DateTime.fromObject({ weekYear: Number(annee), weekNumber: Number(numero), weekday: 1 }).startOf('day');
  return { debut: d.toJSDate(), fin: d.plus({ weeks: 1 }).toJSDate() };
}

/**
 * Tire l'echantillon qualite d'une semaine : une part des envois du poste, choisie au hasard.
 *
 * « Envoi » veut dire ici une demande qui a donne lieu a au moins un evenement sortant dans la
 * semaine : c'est ce que la grille controle. Le tirage est **idempotent** : relancer la tache
 * pour la meme semaine ne cree pas de nouveau controle pour une demande deja tiree.
 */
export async function tirerEchantillon(
  semaine: string,
  opts: { compteId?: number; taux?: number; grilleId?: number } = {},
  auteur: Auteur,
): Promise<{ semaine: string; envois: number; tires: number; deja: number }> {
  const parametres = await lireParametres();
  const taux = opts.taux ?? parametres.qualite.tauxEchantillon;
  const { debut, fin } = bornesSemaine(semaine);

  const conditions: SQL[] = [
    eq(schema.evenements.sens, 'sortant'),
    gte(schema.evenements.survenuLe, debut),
    lt(schema.evenements.survenuLe, fin),
    sql`${schema.evenements.demandeId} IS NOT NULL`,
    sql`${schema.demandes.famille} <> ${FAMILLE_HORS_PERIMETRE}`,
  ];
  if (opts.compteId) conditions.push(eq(schema.evenements.compteId, opts.compteId));

  const envois = await db
    .selectDistinct({ demandeId: schema.evenements.demandeId, famille: schema.demandes.famille })
    .from(schema.evenements)
    .innerJoin(schema.demandes, eq(schema.demandes.id, schema.evenements.demandeId))
    .where(and(...conditions));

  const deja = await db
    .select({ demandeId: schema.controlesQualite.demandeId })
    .from(schema.controlesQualite)
    .where(eq(schema.controlesQualite.semaine, semaine));
  const dejaTirees = new Set(deja.map((d) => d.demandeId));

  const candidats = envois.filter((e) => e.demandeId !== null && !dejaTirees.has(e.demandeId));
  // Cible de la semaine : la part demandee, avec au moins un envoi controle des qu'il y en a.
  // Le plancher porte sur la cible, pas sur le complement, sinon un second passage tirerait
  // toujours un envoi de plus et le tirage ne serait pas idempotent.
  const cible = envois.length === 0 ? 0 : Math.max(1, Math.round(envois.length * taux));
  const aTirer = Math.max(0, Math.min(cible - dejaTirees.size, candidats.length));
  const melange = [...candidats].sort(() => Math.random() - 0.5).slice(0, aTirer);

  if (melange.length) {
    const grilleId = opts.grilleId ?? (await grilleParDefaut(opts.compteId))?.id ?? null;
    await db.insert(schema.controlesQualite).values(
      melange.map((e) => ({ demandeId: e.demandeId!, grilleId, semaine, notes: {}, reprise: false })),
    );
  }

  await journaliser('echantillon_qualite_tire', {
    utilisateurId: auteur.utilisateurId,
    auteurType: auteur.type,
    details: { semaine, envois: envois.length, tires: melange.length, taux },
  });

  return { semaine, envois: envois.length, tires: melange.length, deja: dejaTirees.size };
}

async function grilleParDefaut(compteId?: number): Promise<GrilleQualite | undefined> {
  const grilles = await db.select().from(schema.grillesQualite).where(eq(schema.grillesQualite.actif, true));
  return grilles.find((g) => g.compteId === compteId) ?? grilles.find((g) => !g.compteId) ?? grilles[0];
}

// ---------------------------------------------------------------------------
// Notation
// ---------------------------------------------------------------------------

/**
 * Note sur 100 : moyenne des notes par critere, ponderee par le poids du critere.
 * Chaque note par critere est attendue entre 0 et 100. Un critere non note est ignore,
 * ce qui evite de penaliser un controle partiel.
 */
export function calculerNote(criteres: CritereGrille[], notes: Record<string, number>): number | null {
  const notes_ = criteres
    .map((c) => ({ poids: c.poids, note: notes[c.cle] }))
    .filter((x) => typeof x.note === 'number' && Number.isFinite(x.note));
  if (!notes_.length) return null;
  const poidsTotal = notes_.reduce((s, x) => s + x.poids, 0);
  if (poidsTotal <= 0) return null;
  return Math.round((notes_.reduce((s, x) => s + x.note * x.poids, 0) / poidsTotal) * 100) / 100;
}

export interface EntreeNotation {
  notes: Record<string, number>;
  reprise?: boolean;
  bonDuPremierCoup?: boolean | null;
  commentaire?: string | null;
}

export async function noterControle(controleId: number, entree: EntreeNotation, auteur: Auteur): Promise<ControleQualite> {
  const [controle] = await db.select().from(schema.controlesQualite).where(eq(schema.controlesQualite.id, controleId));
  if (!controle) throw new ErreurHttp(404, 'Controle qualite introuvable');

  let criteres: CritereGrille[] = [];
  if (controle.grilleId) {
    const [grille] = await db.select().from(schema.grillesQualite).where(eq(schema.grillesQualite.id, controle.grilleId));
    criteres = (grille?.criteres as CritereGrille[]) ?? [];
  }
  const inconnus = Object.keys(entree.notes).filter((cle) => !criteres.some((c) => c.cle === cle));
  if (criteres.length && inconnus.length) throw new ErreurHttp(400, `Criteres inconnus pour cette grille : ${inconnus.join(', ')}`);
  const horsPlage = Object.entries(entree.notes).filter(([, n]) => n < 0 || n > 100);
  if (horsPlage.length) throw new ErreurHttp(400, `Note attendue entre 0 et 100 : ${horsPlage.map(([c]) => c).join(', ')}`);

  const note = calculerNote(criteres, entree.notes);
  const [maj] = await db
    .update(schema.controlesQualite)
    .set({
      notes: entree.notes,
      note: note === null ? null : String(note),
      reprise: entree.reprise ?? controle.reprise,
      bonDuPremierCoup: entree.bonDuPremierCoup !== undefined ? entree.bonDuPremierCoup : controle.bonDuPremierCoup,
      commentaire: entree.commentaire ?? controle.commentaire,
      controleParId: auteur.utilisateurId,
    })
    .where(eq(schema.controlesQualite.id, controleId))
    .returning();

  await journaliser('controle_qualite_note', {
    utilisateurId: auteur.utilisateurId,
    auteurType: auteur.type,
    entite: 'controle_qualite',
    entiteId: controleId,
    details: { note, reprise: maj.reprise, bonDuPremierCoup: maj.bonDuPremierCoup },
  });
  return maj;
}

// ---------------------------------------------------------------------------
// Indicateurs qualite
// ---------------------------------------------------------------------------

export interface IndicateursQualite {
  /** Controles tires sur la periode. */
  tires: number;
  /** Controles effectivement notes. */
  notes: number;
  noteMoyenne: number | null;
  /** Part des controles ayant donne lieu a une reprise, entre 0 et 1. */
  tauxReprise: number | null;
  /** Part des documents valides par la DO sans correction, entre 0 et 1. */
  bonDuPremierCoup: number | null;
  /** Conformite des check-lists avant envoi sur la periode. */
  envoisControles: number;
  tauxConformite: number | null;
  /** Points de check-list les plus souvent manques, pour cibler la correction. */
  pointsManques: { cle: string; libelle: string; manques: number }[];
}

export async function indicateursQualite(
  periode: { debut: Date; fin: Date },
  filtres: { compteId?: number } = {},
): Promise<IndicateursQualite> {
  const conditionsControle: SQL[] = [gte(schema.controlesQualite.creeLe, periode.debut), lt(schema.controlesQualite.creeLe, periode.fin)];
  if (filtres.compteId) conditionsControle.push(eq(schema.demandes.compteId, filtres.compteId));
  const controles = await db
    .select({ controle: schema.controlesQualite })
    .from(schema.controlesQualite)
    .innerJoin(schema.demandes, eq(schema.demandes.id, schema.controlesQualite.demandeId))
    .where(and(...conditionsControle));

  const avecNote = controles.filter((c) => c.controle.note !== null);
  const avecBon = controles.filter((c) => c.controle.bonDuPremierCoup !== null);

  const conditionsEnvoi: SQL[] = [gte(schema.controlesEnvoi.creeLe, periode.debut), lt(schema.controlesEnvoi.creeLe, periode.fin)];
  if (filtres.compteId) conditionsEnvoi.push(eq(schema.demandes.compteId, filtres.compteId));
  const envois = await db
    .select({ controle: schema.controlesEnvoi, points: schema.checklists.points })
    .from(schema.controlesEnvoi)
    .innerJoin(schema.demandes, eq(schema.demandes.id, schema.controlesEnvoi.demandeId))
    .leftJoin(schema.checklists, eq(schema.checklists.id, schema.controlesEnvoi.checklistId))
    .where(and(...conditionsEnvoi));

  const manques = new Map<string, { libelle: string; manques: number }>();
  for (const e of envois) {
    const points = (e.points as PointChecklist[]) ?? [];
    const reponses = (e.controle.reponses as Record<string, boolean>) ?? {};
    for (const p of points) {
      if (p.obligatoire && reponses[p.cle] !== true) {
        const deja = manques.get(p.cle) ?? { libelle: p.libelle, manques: 0 };
        deja.manques++;
        manques.set(p.cle, deja);
      }
    }
  }

  return {
    tires: controles.length,
    notes: avecNote.length,
    noteMoyenne: avecNote.length ? Math.round((avecNote.reduce((s, c) => s + Number(c.controle.note), 0) / avecNote.length) * 100) / 100 : null,
    tauxReprise: controles.length ? controles.filter((c) => c.controle.reprise).length / controles.length : null,
    bonDuPremierCoup: avecBon.length ? avecBon.filter((c) => c.controle.bonDuPremierCoup).length / avecBon.length : null,
    envoisControles: envois.length,
    tauxConformite: envois.length ? envois.filter((e) => e.controle.conforme).length / envois.length : null,
    pointsManques: [...manques.entries()].map(([cle, v]) => ({ cle, ...v })).sort((a, b) => b.manques - a.manques),
  };
}

/** Controles qualite d'une semaine, avec de quoi les noter. */
export async function controlesDeLaSemaine(semaine: string, compteId?: number) {
  const conditions: SQL[] = [eq(schema.controlesQualite.semaine, semaine)];
  if (compteId) conditions.push(eq(schema.demandes.compteId, compteId));
  return db
    .select({
      controle: schema.controlesQualite,
      demande: schema.demandes,
      dossier: schema.dossiers.libelle,
      grille: schema.grillesQualite.libelle,
      criteres: schema.grillesQualite.criteres,
    })
    .from(schema.controlesQualite)
    .innerJoin(schema.demandes, eq(schema.demandes.id, schema.controlesQualite.demandeId))
    .innerJoin(schema.dossiers, eq(schema.dossiers.id, schema.demandes.dossierId))
    .leftJoin(schema.grillesQualite, eq(schema.grillesQualite.id, schema.controlesQualite.grilleId))
    .where(and(...conditions))
    .orderBy(desc(schema.controlesQualite.creeLe));
}

export { inArray, isNull };
