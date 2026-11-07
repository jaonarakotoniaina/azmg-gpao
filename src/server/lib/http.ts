import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export class ErreurHttp extends Error {
  constructor(
    public statut: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const introuvable = (quoi = 'Ressource') => new ErreurHttp(404, `${quoi} introuvable`);
export const interdit = () => new ErreurHttp(403, 'Accès refusé');

export function valider<T extends z.ZodType>(schema: T, donnees: unknown): z.infer<T> {
  const r = schema.safeParse(donnees);
  if (!r.success) {
    throw new ErreurHttp(
      400,
      'Données invalides',
      r.error.issues.map((i) => ({ champ: i.path.join('.'), message: i.message })),
    );
  }
  return r.data;
}

export function idParam(req: Request, nom = 'id'): number {
  const v = Number(String(req.params[nom]));
  if (!Number.isInteger(v) || v <= 0) throw new ErreurHttp(400, 'Identifiant invalide');
  return v;
}

export function gestionErreurs(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ErreurHttp) {
    res.status(err.statut).json({ erreur: err.message, details: err.details });
    return;
  }
  const e = err as { type?: string; status?: number; code?: string; message?: string };
  if (e?.type === 'entity.too.large' || e?.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ erreur: 'Fichier ou requête trop volumineux' });
    return;
  }
  if (e?.status && e.status >= 400 && e.status < 500) {
    res.status(e.status).json({ erreur: 'Requête invalide' });
    return;
  }
  console.error(JSON.stringify({ niveau: 'error', message: 'Erreur serveur', erreur: (e?.message ?? String(err)).slice(0, 500) }));
  res.status(500).json({ erreur: 'Erreur interne du serveur' });
}
