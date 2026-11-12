/** Auteur d'une action, deduit de la requete : utilisateur connecte ou connecteur Claude. */
import type { Request } from 'express';
import type { Auteur } from '../modules/demandes/service';

export function auteurDe(req: Request): Auteur {
  return { utilisateurId: req.utilisateur?.id ?? null, type: 'humain' };
}

/** Auteur « claude » : trace exigee pour les outils d'ecriture du connecteur MCP. */
export function auteurClaude(utilisateurId: number | null): Auteur {
  return { utilisateurId, type: 'claude' };
}
