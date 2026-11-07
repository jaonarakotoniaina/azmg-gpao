/**
 * File de traitements asynchrones `jobs_queue`, consommee par le cron « tick ».
 *
 * Hebergement mutualise o2switch : pas de Redis, pas de worker permanent. Chaque passage du
 * cron traite un lot borne dans le temps, avec verrou, reprise sur erreur et backoff exponentiel.
 * Un traitement qui fait tomber le processus ne bloque pas la file : il est repris en differe
 * puis abandonne au bout de ses essais, avec une trace dans le journal.
 */
import { sql } from 'drizzle-orm';
import os from 'node:os';
import { db, schema } from '../db/client';
import { journal, messageErreur } from './journal';
import { journaliser } from './evenements';

export type GestionnaireTache = (payload: any, tache: { id: number; essais: number }) => Promise<void>;
const gestionnaires = new Map<string, GestionnaireTache>();

export function enregistrerGestionnaire(type: string, fn: GestionnaireTache) {
  gestionnaires.set(type, fn);
}

export function gestionnairesConnus(): string[] {
  return [...gestionnaires.keys()].sort();
}

export interface OptionsEnfiler {
  priorite?: number;
  executerA?: Date;
  /** Cle unique : une tache deja en file pour la meme cle n'est pas dupliquee. */
  cle?: string;
  essaisMax?: number;
}

export async function enfiler(type: string, payload: Record<string, unknown> = {}, opts: OptionsEnfiler = {}): Promise<number | null> {
  const [ligne] = await db
    .insert(schema.jobsQueue)
    .values({
      type,
      payload,
      priorite: opts.priorite ?? 50,
      executerA: opts.executerA ?? new Date(),
      cleDedoublonnage: opts.cle ?? null,
      essaisMax: opts.essaisMax ?? 5,
    })
    .onConflictDoNothing()
    .returning({ id: schema.jobsQueue.id });
  return ligne?.id ?? null;
}

function delaiReprise(essai: number): number {
  return Math.min(60 * 60 * 1000, 30_000 * 2 ** Math.max(0, essai - 1));
}

/** Duree maximale d'un traitement : au-dela, il compte comme un echec (reprise differee). */
export const DUREE_MAX_TRAITEMENT_MS = 2 * 60_000;

/** Delai avant de considerer qu'un traitement « en cours » a ete interrompu. */
export const MINUTES_AVANT_INTERRUPTION = 6;

const MESSAGE_INTERRUPTION = "Traitement interrompu (processus arrete par l'hebergeur : delai depasse ou memoire insuffisante)";

/**
 * Taches restees « en cours » apres l'arret du processus : reprise differee avec backoff,
 * puis abandon au-dela du nombre d'essais. Sans cela, une tache qui fait tomber le processus
 * repasse en tete a chaque passage et bloque toute la file.
 */
export async function recupererTachesBloquees(minutes = MINUTES_AVANT_INTERRUPTION): Promise<number> {
  const res = await db.execute(sql`
    SELECT id, type, payload, essais, essais_max AS "essaisMax" FROM jobs_queue
    WHERE statut = 'running' AND verrouille_le < now() - make_interval(mins => ${minutes}::int)`);
  const lignes = res.rows as { id: string | number; type: string; payload: unknown; essais: number; essaisMax: number }[];
  for (const t of lignes) {
    const id = Number(t.id);
    if (t.essais < t.essaisMax) {
      await db.execute(sql`
        UPDATE jobs_queue SET statut = 'failed', verrouille_le = NULL, verrouille_par = NULL,
          derniere_erreur = ${MESSAGE_INTERRUPTION}, executer_a = ${new Date(Date.now() + delaiReprise(t.essais))}
        WHERE id = ${id} AND statut = 'running'`);
      continue;
    }
    await db.execute(sql`
      UPDATE jobs_queue SET statut = 'dead', verrouille_le = NULL, verrouille_par = NULL, termine_le = now(),
        derniere_erreur = ${MESSAGE_INTERRUPTION}
      WHERE id = ${id} AND statut = 'running'`);
    await journaliser('tache_abandonnee', {
      auteurType: 'systeme',
      entite: 'jobs_queue',
      entiteId: id,
      details: { type: t.type, erreur: MESSAGE_INTERRUPTION },
    });
  }
  return lignes.length;
}

/** Un traitement qui ne rend jamais la main ne bloque pas la file : echec apres le delai. */
function avecDelai<T>(promesse: Promise<T>, ms: number): Promise<T> {
  let minuteur: NodeJS.Timeout | undefined;
  const delai = new Promise<never>((_, rejeter) => {
    minuteur = setTimeout(() => rejeter(new Error(`Traitement trop long (plus de ${Math.round(ms / 1000)} s)`)), ms);
  });
  return Promise.race([promesse, delai]).finally(() => clearTimeout(minuteur));
}

async function prendreTache(ouvrier: string) {
  const res = await db.execute(sql`
    UPDATE jobs_queue SET statut = 'running', verrouille_le = now(), verrouille_par = ${ouvrier}, essais = essais + 1
    WHERE id = (
      SELECT id FROM jobs_queue
      WHERE statut IN ('pending', 'failed') AND executer_a <= now()
      ORDER BY priorite ASC, executer_a ASC, id ASC
      LIMIT 1 FOR UPDATE SKIP LOCKED
    )
    RETURNING id, type, payload, essais, essais_max AS "essaisMax"`);
  return (res.rows[0] as { id: string | number; type: string; payload: any; essais: number; essaisMax: number } | undefined) ?? null;
}

export interface BilanFile {
  traitees: number;
  erreurs: number;
}

export async function traiterFile(opts: { limite?: number; budgetMs?: number; dureeMaxTraitementMs?: number } = {}): Promise<BilanFile> {
  const limite = opts.limite ?? 200;
  const fin = Date.now() + (opts.budgetMs ?? 4 * 60 * 1000);
  const ouvrier = `${os.hostname()}:${process.pid}`;
  const bilan: BilanFile = { traitees: 0, erreurs: 0 };
  try {
    await recupererTachesBloquees();
  } catch (e) {
    journal.error('Recuperation des traitements interrompus impossible', { erreur: messageErreur(e) });
  }
  while (bilan.traitees + bilan.erreurs < limite && Date.now() < fin) {
    const tache = await prendreTache(ouvrier);
    if (!tache) break;
    const id = Number(tache.id);
    const fn = gestionnaires.get(tache.type);
    try {
      if (!fn) throw new Error(`Aucun gestionnaire pour le type « ${tache.type} »`);
      await avecDelai(fn(tache.payload, { id, essais: tache.essais }), opts.dureeMaxTraitementMs ?? DUREE_MAX_TRAITEMENT_MS);
      await db.execute(sql`UPDATE jobs_queue SET statut = 'done', termine_le = now(), verrouille_le = NULL, derniere_erreur = NULL WHERE id = ${id}`);
      bilan.traitees++;
    } catch (e) {
      bilan.erreurs++;
      const message = messageErreur(e).slice(0, 2000);
      const definitif = tache.essais >= tache.essaisMax;
      journal.warn('Echec de tache', { type: tache.type, id, essai: tache.essais, definitif, erreur: message });
      await db.execute(sql`
        UPDATE jobs_queue SET statut = ${definitif ? 'dead' : 'failed'}, verrouille_le = NULL, derniere_erreur = ${message},
          executer_a = ${new Date(Date.now() + delaiReprise(tache.essais))}
        WHERE id = ${id}`);
      if (definitif) {
        await journaliser('tache_abandonnee', {
          auteurType: 'systeme',
          entite: 'jobs_queue',
          entiteId: id,
          details: { type: tache.type, erreur: message },
        });
      }
    }
  }
  return bilan;
}

/** Relance manuelle d'une tache abandonnee. */
export async function relancerTache(id: number) {
  await db.execute(sql`UPDATE jobs_queue SET statut = 'pending', essais = 0, executer_a = now(), derniere_erreur = NULL WHERE id = ${id}`);
}

export async function etatFile() {
  const res = await db.execute(sql`
    SELECT statut, count(*)::int AS nombre, min(created_at) AS "plusAncienne" FROM jobs_queue
    WHERE statut IN ('pending', 'failed', 'running', 'dead') GROUP BY statut`);
  return res.rows as { statut: string; nombre: number; plusAncienne: string }[];
}

/** Traite la file jusqu'a epuisement (tests et developpement uniquement). */
export async function viderFile(maxTours = 50) {
  let total = 0;
  for (let i = 0; i < maxTours; i++) {
    const b = await traiterFile({ limite: 500, budgetMs: 60_000 });
    total += b.traitees + b.erreurs;
    if (b.traitees + b.erreurs === 0) break;
  }
  return total;
}
