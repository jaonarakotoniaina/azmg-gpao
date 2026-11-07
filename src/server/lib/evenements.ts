/** Journal des actions : trace de qui a fait quoi, sans donnee personnelle du client. */
import { db, schema } from '../db/client';

export type AuteurType = 'humain' | 'systeme' | 'claude';

export interface OptionsJournal {
  utilisateurId?: number | null;
  auteurType?: AuteurType;
  entite?: string;
  entiteId?: number | null;
  details?: Record<string, unknown>;
}

/**
 * Enregistre une action dans le journal.
 * Les outils d'ecriture du connecteur Claude passent `auteurType: 'claude'` (exigence section 8.13).
 */
export async function journaliser(action: string, opts: OptionsJournal = {}) {
  await db.insert(schema.journalActions).values({
    action,
    utilisateurId: opts.utilisateurId ?? null,
    auteurType: opts.auteurType ?? 'humain',
    entite: opts.entite ?? null,
    entiteId: opts.entiteId ?? null,
    details: opts.details ?? {},
  });
}
