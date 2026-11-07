import crypto from 'node:crypto';
import { config } from '../config';

export function jetonAleatoire(octets = 24): string {
  return crypto.randomBytes(octets).toString('base64url');
}

export function sha256(donnee: string | Buffer): string {
  return crypto.createHash('sha256').update(donnee).digest('hex');
}

export function hmac(valeur: string): string {
  if (!config.sessionSecret) throw new Error('SESSION_SECRET manquant');
  return crypto.createHmac('sha256', config.sessionSecret).update(valeur).digest('base64url');
}

/** Lien signé à durée limitée : `valeur.expiration.signature`. */
export function signer(valeur: string, expireLe: Date): string {
  const exp = Math.floor(expireLe.getTime() / 1000).toString(36);
  return `${valeur}.${exp}.${hmac(`${valeur}.${exp}`)}`;
}

export function verifierSignature(jeton: string): string | null {
  const morceaux = jeton.split('.');
  if (morceaux.length !== 3) return null;
  const [valeur, exp, sig] = morceaux;
  const attendu = hmac(`${valeur}.${exp}`);
  if (sig.length !== attendu.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(attendu))) return null;
  if (parseInt(exp, 36) * 1000 < Date.now()) return null;
  return valeur;
}

export function egaliteConstante(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}
