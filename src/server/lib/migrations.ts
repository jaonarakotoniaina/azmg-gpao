/**
 * Etat des migrations de base, expose par `/health`.
 *
 * Une mise en ligne peut tres bien servir le bon code et tourner sur une base restee en arriere :
 * l'application repond, et le defaut n'apparait qu'au premier ecran qui touche une colonne
 * absente. Ce controle rend la question verifiable d'un coup d'oeil, depuis l'exterieur.
 */
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config';
import { getPool } from '../db/client';

export interface EtatMigrations {
  /** Nombre de migrations presentes dans le depot. */
  attendues: number;
  /** Nombre de migrations enregistrees comme appliquees dans la base. */
  appliquees: number;
  /** Nom de la derniere migration appliquee, si elle a pu etre identifiee. */
  derniere: string | null;
  aJour: boolean;
  /** Renseigne seulement quand l'etat n'a pas pu etre lu. */
  erreur?: string;
}

interface EntreeJournal {
  when: number;
  tag: string;
}

let journal: EntreeJournal[] | null = null;

/** Journal des migrations, lu une fois : il ne change pas au cours de la vie du processus. */
function lireJournal(): EntreeJournal[] {
  if (journal) return journal;
  const chemin = path.join(config.racine, 'drizzle', 'meta', '_journal.json');
  const brut = JSON.parse(fs.readFileSync(chemin, 'utf8')) as { entries?: EntreeJournal[] };
  journal = (brut.entries ?? []).map((e) => ({ when: Number(e.when), tag: String(e.tag) }));
  return journal;
}

export async function etatMigrations(): Promise<EtatMigrations> {
  let attendues = 0;
  try {
    const entrees = lireJournal();
    attendues = entrees.length;
    // Drizzle enregistre chaque migration appliquee avec l'horodatage du journal : c'est lui qui
    // permet de remonter au nom, la table ne stockant que l'empreinte du fichier SQL.
    const { rows } = await getPool().query<{ total: string; dernier: string | null }>(
      'SELECT count(*)::text AS total, max(created_at)::text AS dernier FROM drizzle.__drizzle_migrations',
    );
    const appliquees = Number(rows[0]?.total ?? 0);
    const dernier = rows[0]?.dernier ? Number(rows[0].dernier) : null;
    return {
      attendues,
      appliquees,
      derniere: entrees.find((e) => e.when === dernier)?.tag ?? null,
      aJour: appliquees >= attendues,
    };
  } catch (e) {
    // Une base neuve, ou un schema `drizzle` absent, ne doit pas faire echouer le controle de
    // sante : l'information manque, elle n'est pas fausse.
    return { attendues, appliquees: 0, derniere: null, aJour: false, erreur: (e as Error).message.slice(0, 120) };
  }
}
