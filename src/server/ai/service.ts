/**
 * Fournisseur IA interchangeable (section 6.1 de CLAUDE.md), priorite au cout nul.
 *
 *  - `agent` (defaut en production) : la tache est ecrite dans `ai_tasks` et attend qu'une
 *    routine Claude Code la releve par l'API agent. Aucun cout API.
 *  - `api`   : appel direct de l'API Anthropic, si une cle est fournie.
 *  - `mock`  : reponse simulee deterministe, pour le developpement et les tests.
 *
 * Toute sortie passe par le filtre « aucun tiret long » avant d'etre rendue, quel que soit le
 * fournisseur : c'est la derniere barriere avant qu'un texte arrive sous les yeux d'un humain.
 */
import { and, asc, eq, lt, or, sql } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { config } from '../config';
import { journal, messageErreur } from '../lib/journal';
import { sha256 } from '../lib/securite';
import { nettoyerProfondement } from '@shared/tirets';

export type TypeTacheIa =
  | 'typer_evenement'
  | 'synthetiser_demande'
  | 'extraire_elements'
  | 'resumer_dossier'
  | 'rediger_relance'
  | 'rediger_digest_validation'
  | 'rediger_daily';

export interface DemandeIa<E = Record<string, unknown>> {
  type: TypeTacheIa;
  versionPrompt: string;
  prompt: string;
  schema: Record<string, unknown>;
  entree: E;
  contexte?: Record<string, unknown>;
  priorite?: number;
}

export interface ResultatIa<S = Record<string, unknown>> {
  /** `null` quand la tache est partie en file et attend la routine. */
  sortie: S | null;
  statut: 'traite' | 'en_attente' | 'echec';
  fournisseur: string;
  tacheId: number | null;
}

/** Reponses simulees, par type de tache : deterministes, pour que les tests ne dependent de rien. */
type Simulateur = (entree: Record<string, unknown>) => Record<string, unknown>;
const simulateurs = new Map<TypeTacheIa, Simulateur>();

export function enregistrerSimulateur(type: TypeTacheIa, fn: Simulateur) {
  simulateurs.set(type, fn);
}

/**
 * Soumet une tache au fournisseur configure.
 *
 * En mode `agent`, la tache est enfilee et la fonction rend `en_attente` : l'appelant doit
 * prevoir ce cas et ne jamais bloquer dessus. C'est la contrepartie du cout nul.
 */
export async function demanderIa<E extends Record<string, unknown>, S extends Record<string, unknown>>(
  demande: DemandeIa<E>,
): Promise<ResultatIa<S>> {
  const fournisseur = config.ia.fournisseur;

  if (fournisseur === 'mock') {
    const simulateur = simulateurs.get(demande.type);
    if (!simulateur) return { sortie: null, statut: 'echec', fournisseur, tacheId: null };
    return { sortie: nettoyerProfondement(simulateur(demande.entree)) as S, statut: 'traite', fournisseur, tacheId: null };
  }

  const empreinte = sha256(JSON.stringify({ type: demande.type, version: demande.versionPrompt, entree: demande.entree }));

  // Une tache identique deja traitee rend son resultat sans repasser par le fournisseur.
  const [deja] = await db
    .select()
    .from(schema.aiTasks)
    .where(and(eq(schema.aiTasks.empreinteEntree, empreinte), eq(schema.aiTasks.statut, 'traite')))
    .limit(1);
  if (deja?.sortie) return { sortie: nettoyerProfondement(deja.sortie) as S, statut: 'traite', fournisseur, tacheId: deja.id };

  if (fournisseur === 'api') {
    try {
      const sortie = await appelerApi<S>(demande);
      return { sortie: nettoyerProfondement(sortie), statut: 'traite', fournisseur, tacheId: null };
    } catch (e) {
      journal.warn('Appel IA en echec, bascule en file', { type: demande.type, erreur: messageErreur(e) });
    }
  }

  // Mode agent, ou repli apres un echec d'API : la tache attend la routine.
  const [tache] = await db
    .insert(schema.aiTasks)
    .values({
      type: demande.type,
      versionPrompt: demande.versionPrompt,
      entree: demande.entree,
      empreinteEntree: empreinte,
      contexte: { ...(demande.contexte ?? {}), prompt: demande.prompt, schema: demande.schema },
      statut: 'en_attente',
      priorite: demande.priorite ?? 50,
      fournisseur,
    })
    .returning();
  return { sortie: null, statut: 'en_attente', fournisseur, tacheId: tache.id };
}

/** Appel direct de l'API Anthropic. Utilise seulement si `AI_PROVIDER=api` et qu'une cle existe. */
async function appelerApi<S>(demande: DemandeIa): Promise<S> {
  if (!config.ia.cleApi) throw new Error('ANTHROPIC_API_KEY absente');
  const modele = config.ia.modeleRapide || config.ia.modeleIntelligent;
  if (!modele) throw new Error('Aucun modele configure (ANTHROPIC_MODEL_FAST ou ANTHROPIC_MODEL_SMART)');

  const reponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': config.ia.cleApi,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: modele,
      max_tokens: 1024,
      system: demande.prompt,
      messages: [{ role: 'user', content: JSON.stringify(demande.entree) }],
    }),
    signal: AbortSignal.timeout(config.ia.timeoutMs),
  });
  if (!reponse.ok) throw new Error(`API Anthropic : ${reponse.status}`);
  const corps = (await reponse.json()) as { content?: { type: string; text?: string }[] };
  const texte = corps.content?.find((c) => c.type === 'text')?.text ?? '';
  const json = /\{[\s\S]*\}/.exec(texte)?.[0];
  if (!json) throw new Error('Reponse de l’API sans objet JSON');
  return JSON.parse(json) as S;
}

// ---------------------------------------------------------------------------
// File des taches, pour la routine Claude Code
// ---------------------------------------------------------------------------

/** Verrou pose sur une tache relevee, pour qu'une seule routine la traite a la fois. */
const DUREE_VERROU_MS = 15 * 60_000;

/** Taches en attente, servies a la routine avec leur prompt et leur schema. */
export async function tachesEnAttente(limite = 50) {
  const maintenant = new Date();
  const taches = await db
    .select()
    .from(schema.aiTasks)
    .where(
      and(
        or(eq(schema.aiTasks.statut, 'en_attente'), eq(schema.aiTasks.statut, 'echec')),
        or(sql`${schema.aiTasks.verrouilleJusqua} IS NULL`, lt(schema.aiTasks.verrouilleJusqua, maintenant)),
        lt(schema.aiTasks.essais, schema.aiTasks.essaisMax),
      ),
    )
    .orderBy(asc(schema.aiTasks.priorite), asc(schema.aiTasks.creeLe))
    .limit(Math.min(Math.max(limite, 1), 200));

  if (taches.length) {
    const verrou = new Date(maintenant.getTime() + DUREE_VERROU_MS);
    for (const t of taches) {
      await db.update(schema.aiTasks).set({ verrouilleJusqua: verrou, majLe: maintenant }).where(eq(schema.aiTasks.id, t.id));
    }
  }

  return taches.map((t) => {
    const contexte = (t.contexte ?? {}) as { prompt?: string; schema?: unknown };
    return {
      id: t.id,
      type: t.type,
      version_prompt: t.versionPrompt,
      prompt: contexte.prompt ?? '',
      schema_sortie: contexte.schema ?? {},
      entree: t.entree,
      essais: t.essais,
    };
  });
}

/**
 * Enregistre le resultat d'une tache.
 * La sortie est validee par l'appelant contre le schema zod de la tache ; ici on ne fait que
 * ranger le resultat, compter l'essai et filtrer les tirets longs.
 */
export async function enregistrerResultat(
  id: number,
  sortie: Record<string, unknown> | null,
  erreur?: string,
): Promise<{ statut: string; essais: number }> {
  const [tache] = await db.select().from(schema.aiTasks).where(eq(schema.aiTasks.id, id));
  if (!tache) throw new Error('Tache IA introuvable');

  const essais = tache.essais + 1;
  if (sortie) {
    await db
      .update(schema.aiTasks)
      .set({ sortie: nettoyerProfondement(sortie), statut: 'traite', essais, erreur: null, verrouilleJusqua: null, termineLe: new Date(), majLe: new Date() })
      .where(eq(schema.aiTasks.id, id));
    return { statut: 'traite', essais };
  }

  // Au-dela du nombre d'essais, la tache est abandonnee : un humain classera.
  const statut = essais >= tache.essaisMax ? 'abandonne' : 'echec';
  await db
    .update(schema.aiTasks)
    .set({ statut, essais, erreur: (erreur ?? 'sortie invalide').slice(0, 1000), verrouilleJusqua: null, majLe: new Date() })
    .where(eq(schema.aiTasks.id, id));
  return { statut, essais };
}

/** Etat de la file IA, affiche dans le tableau de bord. */
export async function etatFileIa() {
  const lignes = await db
    .select({ statut: schema.aiTasks.statut, nombre: sql<number>`count(*)::int`, plusAncienne: sql<Date | null>`min(${schema.aiTasks.creeLe})` })
    .from(schema.aiTasks)
    .groupBy(schema.aiTasks.statut);
  const enAttente = lignes.find((l) => l.statut === 'en_attente');
  return {
    fournisseur: config.ia.fournisseur,
    parStatut: Object.fromEntries(lignes.map((l) => [l.statut, l.nombre])),
    enAttente: enAttente?.nombre ?? 0,
    plusAncienneEnAttente: enAttente?.plusAncienne ?? null,
  };
}
