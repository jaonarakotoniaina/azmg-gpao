import type { Request, Response, NextFunction } from 'express';
import { parse as parseCookie } from 'cookie';
import { lireSession, type Utilisateur } from './service';
import { ErreurHttp } from '../../lib/http';
import { egaliteConstante } from '../../lib/securite';
import type { Role } from '@shared/constantes';

declare module 'express-serve-static-core' {
  interface Request {
    utilisateur?: Utilisateur;
    csrfAttendu?: string;
  }
}

export const COOKIE_SESSION = 'azmg_gpao_session';
export const COOKIE_CSRF = 'azmg_gpao_csrf';

export function lireCookies(req: Request): Record<string, string | undefined> {
  return parseCookie(req.headers.cookie ?? '');
}

/** Charge l'utilisateur de la session si un cookie est present (sans l'exiger). */
export async function chargerSession(req: Request, _res: Response, next: NextFunction) {
  try {
    const s = await lireSession(lireCookies(req)[COOKIE_SESSION]);
    if (s) {
      req.utilisateur = s.utilisateur;
      req.csrfAttendu = s.csrf;
    }
    next();
  } catch (e) {
    next(e);
  }
}

/** Exige une session valide et, pour les requetes qui modifient des donnees, le jeton CSRF. */
export function exigerConnexion(req: Request, _res: Response, next: NextFunction) {
  if (!req.utilisateur) return next(new ErreurHttp(401, 'Authentification requise'));
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const jeton = String(req.headers['x-csrf-token'] ?? '');
    if (!req.csrfAttendu || !jeton || !egaliteConstante(jeton, req.csrfAttendu)) {
      return next(new ErreurHttp(403, 'Jeton CSRF invalide'));
    }
  }
  next();
}

export function exigerRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.utilisateur) return next(new ErreurHttp(401, 'Authentification requise'));
    if (!roles.includes(req.utilisateur.role)) return next(new ErreurHttp(403, 'Acces refuse pour votre role'));
    next();
  };
}

/** Roles autorises a ecrire dans le pilotage. Le role client_lecture est en lecture seule. */
export const exigerEcriture = exigerRole('admin', 'manager', 'collaborateur');
export const exigerPilotage = exigerRole('admin', 'manager');
