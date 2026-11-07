/**
 * Journal applicatif minimal (JSON, une ligne par évènement).
 * Aucune donnée personnelle : les emails et numéros de téléphone sont masqués avant écriture.
 */
import { config } from '../config';

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const TELEPHONE = /(?<![\d-])(\+\d{2,3}|00\d{2,3}|0)[\s.]?\d{2}[\s.]?\d{2}[\s.]?\d{3}[\s.]?\d{2}(?!\d)/g;

export function masquer(texte: string): string {
  return texte.replace(EMAIL, '[email]').replace(TELEPHONE, '[telephone]');
}

type Niveau = 'debug' | 'info' | 'warn' | 'error';
const ordre: Record<Niveau, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function ecrire(niveau: Niveau, message: string, details?: Record<string, unknown>) {
  const seuil = (process.env.LOG_LEVEL as Niveau) || (config.test ? 'warn' : 'info');
  if (ordre[niveau] < ordre[seuil]) return;
  const ligne = masquer(JSON.stringify({ t: new Date().toISOString(), niveau, message, ...(details ?? {}) }));
  if (niveau === 'error' || niveau === 'warn') console.error(ligne);
  else process.stdout.write(ligne + '\n');
}

export const journal = {
  debug: (m: string, d?: Record<string, unknown>) => ecrire('debug', m, d),
  info: (m: string, d?: Record<string, unknown>) => ecrire('info', m, d),
  warn: (m: string, d?: Record<string, unknown>) => ecrire('warn', m, d),
  error: (m: string, d?: Record<string, unknown>) => ecrire('error', m, d),
};

export function messageErreur(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
