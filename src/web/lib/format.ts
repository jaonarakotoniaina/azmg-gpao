/** Formatage pour l'interface : libelles francais, durees et dates a Antananarivo. */
import { DateTime } from 'luxon';
import { formaterDuree } from '@shared/heures-ouvrees';
import {
  LIBELLES_INTERLOCUTEURS,
  LIBELLES_SOURCES,
  definitionNature,
  definitionStatut,
  famille as familleRef,
  statutReporting,
  type Acteur,
  type Interlocuteur,
  type Nature,
  type Priorite,
  type Source,
  type Statut,
} from '@shared/constantes';

export const FUSEAU = 'Indian/Antananarivo';

export function dateHeure(valeur: string | Date | null | undefined): string {
  if (!valeur) return '';
  return DateTime.fromJSDate(typeof valeur === 'string' ? new Date(valeur) : valeur).setZone(FUSEAU).setLocale('fr').toFormat("d LLL yyyy 'a' HH'h'mm");
}

export function jour(valeur: string | Date | null | undefined): string {
  if (!valeur) return '';
  return DateTime.fromJSDate(typeof valeur === 'string' ? new Date(valeur) : valeur).setZone(FUSEAU).setLocale('fr').toFormat('d LLL yyyy');
}

/** « il y a 2 jours », « dans 3 heures ». */
export function relatif(valeur: string | Date | null | undefined): string {
  if (!valeur) return '';
  return DateTime.fromJSDate(typeof valeur === 'string' ? new Date(valeur) : valeur).setLocale('fr').toRelative() ?? '';
}

export const duree = formaterDuree;

export const LIBELLES_ACTEURS: Record<Acteur, string> = {
  poste: 'le poste',
  do: 'la DO',
  client: 'le client',
  tiers: 'un tiers',
  aucun: 'personne',
};

/** Forme contractee, pour les tournures « en attente ... ». */
const COMPLEMENTS_ACTEURS: Record<Acteur, string> = {
  poste: 'du poste',
  do: 'de la DO',
  client: 'du client',
  tiers: "d'un tiers",
  aucun: 'de personne',
};

export function complementActeur(code: Acteur | string): string {
  return COMPLEMENTS_ACTEURS[code as Acteur] ?? `de ${code}`;
}

export const LIBELLES_PRIORITES: Record<Priorite, string> = {
  basse: 'basse',
  normale: 'normale',
  haute: 'haute',
  critique: 'critique',
};

export function libelleStatut(code: Statut | string): string {
  return definitionStatut(code)?.libelle ?? code;
}

/** Statut tel qu'il apparaitra dans le reporting client, avec sa mention eventuelle. */
export function libelleReporting(code: Statut | string): string {
  const def = definitionStatut(code);
  if (!def) return statutReporting(code);
  return def.mention ? `${def.reporting} (${def.mention})` : def.reporting;
}

export function libelleFamille(code: string): string {
  const f = familleRef(code);
  return f ? `${f.code} ${f.libelle}` : code;
}

export function libelleFamilleCourt(code: string): string {
  const f = familleRef(code);
  if (!f) return code;
  // Premier segment avant la premiere parenthese ou le premier deux-points.
  return f.libelle.split(/[(:]/)[0].trim();
}

export function libelleNature(code: Nature | string): string {
  return definitionNature(code as Nature)?.libelle ?? code;
}

export function libelleInterlocuteur(code: Interlocuteur | string | null | undefined): string {
  if (!code) return '';
  return LIBELLES_INTERLOCUTEURS[code as Interlocuteur] ?? code;
}

export function libelleSource(code: Source | string): string {
  return LIBELLES_SOURCES[code as Source] ?? code;
}

export function libelleActeur(code: Acteur | string): string {
  return LIBELLES_ACTEURS[code as Acteur] ?? code;
}

/** Ton de badge associe a un statut, pour une lecture visuelle rapide de la file. */
export function tonStatut(code: Statut | string): 'neutre' | 'violet' | 'vert' | 'ambre' | 'rouge' | 'bleu' {
  switch (code) {
    case 'nouveau':
      return 'violet';
    case 'en_cours':
      return 'bleu';
    case 'attente_tiers':
      return 'ambre';
    case 'attente_do':
      return 'ambre';
    case 'bloque':
      return 'rouge';
    case 'termine':
      return 'vert';
    default:
      return 'neutre';
  }
}
