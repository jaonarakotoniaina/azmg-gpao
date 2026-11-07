/**
 * Referentiels initiaux (section 4 de CLAUDE.md), copies en base au premier `migrate`.
 *
 * Les listes de `@shared/constantes` sont la source de verite au demarrage ; une fois en base,
 * elles sont modifiables dans l'ecran Parametres. Cette fonction est idempotente : elle complete
 * les codes absents et ne touche jamais un libelle deja modifie par un utilisateur.
 */
import { and, eq } from 'drizzle-orm';
import { db, schema } from './client';
import {
  DEFINITIONS_NATURES,
  DEFINITIONS_STATUTS,
  FAMILLES,
  INTERLOCUTEURS,
  LIBELLES_INTERLOCUTEURS,
  LIBELLES_SOURCES,
  SOURCES,
  TYPES_ECHEANCE,
  LIBELLES_ECHEANCES,
} from '@shared/constantes';

export const TYPES_REFERENTIEL = ['famille', 'nature', 'statut', 'interlocuteur', 'source', 'echeance'] as const;
export type TypeReferentiel = (typeof TYPES_REFERENTIEL)[number];

interface Entree {
  type: TypeReferentiel;
  code: string;
  libelle: string;
  attributs: Record<string, unknown>;
  ordre: number;
}

export function entreesInitiales(): Entree[] {
  const entrees: Entree[] = [];
  FAMILLES.forEach((f, i) =>
    entrees.push({
      type: 'famille',
      code: f.code,
      libelle: f.libelle,
      attributs: {
        validation: f.validation,
        horsPerimetre: Boolean(f.horsPerimetre),
        tempsStandardMinutes: f.tempsStandardMinutes,
        slaHeures: f.slaHeures,
      },
      ordre: i,
    }),
  );
  DEFINITIONS_NATURES.forEach((n, i) =>
    entrees.push({ type: 'nature', code: n.code, libelle: n.libelle, attributs: { sens: n.sens, effet: n.effet }, ordre: i }),
  );
  DEFINITIONS_STATUTS.forEach((s, i) =>
    entrees.push({
      type: 'statut',
      code: s.code,
      libelle: s.libelle,
      attributs: { reporting: s.reporting, mention: s.mention ?? null, acteur: s.acteur, fermee: s.fermee },
      ordre: i,
    }),
  );
  INTERLOCUTEURS.forEach((c, i) => entrees.push({ type: 'interlocuteur', code: c, libelle: LIBELLES_INTERLOCUTEURS[c], attributs: {}, ordre: i }));
  SOURCES.forEach((c, i) => entrees.push({ type: 'source', code: c, libelle: LIBELLES_SOURCES[c], attributs: {}, ordre: i }));
  TYPES_ECHEANCE.forEach((c, i) => entrees.push({ type: 'echeance', code: c, libelle: LIBELLES_ECHEANCES[c], attributs: {}, ordre: i }));
  return entrees;
}

/** Cree les entrees de referentiel absentes. Ne modifie aucune entree existante. */
export async function initialiserReferentiel(): Promise<{ ajoutees: number }> {
  const entrees = entreesInitiales();
  let ajoutees = 0;
  for (const e of entrees) {
    const [existe] = await db
      .select({ id: schema.referentiels.id })
      .from(schema.referentiels)
      .where(and(eq(schema.referentiels.type, e.type), eq(schema.referentiels.code, e.code)));
    if (existe) continue;
    await db.insert(schema.referentiels).values(e).onConflictDoNothing();
    ajoutees++;
  }
  return { ajoutees };
}

/** Check-lists avant envoi initiales (exemples de la section 8.8 de CLAUDE.md). */
export const CHECKLISTS_INITIALES = [
  {
    code: 'documents_expedition',
    libelle: "Documents d'expedition",
    familles: ['T02', 'T03'],
    points: [
      { cle: 'facture_packing', libelle: 'Facture et packing list joints ensemble', obligatoire: true },
      { cle: 'nif_client', libelle: 'NIF du client present sur AWB et BL', obligatoire: true },
      { cle: 'validation_avant_original', libelle: "Validation du client obtenue avant emission d'un original", obligatoire: true },
      { cle: 'photo_shipping_mark', libelle: 'Photo du shipping mark prise avant depart', obligatoire: true },
      { cle: 'scan_bl', libelle: 'Scan du BL joint au dossier', obligatoire: true },
      { cle: 'pieces_archivees', libelle: 'Pieces archivees dans le dossier serveur', obligatoire: true },
    ],
  },
  {
    code: 'cotation_fret',
    libelle: 'Cotation de fret envoyee au client',
    familles: ['T01'],
    points: [
      { cle: 'prix_valide_do', libelle: 'Prix valide par la DO', obligatoire: true },
      { cle: 'validite_offre', libelle: "Date de validite de l'offre indiquee", obligatoire: true },
      { cle: 'cutoff_etd', libelle: 'Cut-off et ETD indiques', obligatoire: true },
      { cle: 'incoterm', libelle: 'Incoterm precise', obligatoire: false },
    ],
  },
  {
    code: 'facture_proforma',
    libelle: 'Proforma ou facture envoyee',
    familles: ['T03'],
    points: [
      { cle: 'modification_validee', libelle: 'Chaque modification validee par la DO', obligatoire: true },
      { cle: 'coordonnees_bancaires', libelle: 'Coordonnees bancaires verifiees', obligatoire: true },
      { cle: 'reference_dossier', libelle: 'Reference du dossier reportee', obligatoire: true },
    ],
  },
] as const;

/** Grille de controle qualite initiale, ponderee, applicable a toutes les familles de pilotage. */
export const GRILLES_INITIALES = [
  {
    code: 'envoi_standard',
    libelle: 'Qualite d’un envoi du poste',
    familles: [] as string[],
    criteres: [
      { cle: 'exactitude', libelle: 'Exactitude des references et des montants', poids: 30 },
      { cle: 'completude', libelle: 'Completude des pieces attendues', poids: 25 },
      { cle: 'delai', libelle: 'Respect du delai annonce', poids: 20 },
      { cle: 'redaction', libelle: 'Redaction claire dans la langue de l’interlocuteur', poids: 15 },
      { cle: 'tracabilite', libelle: 'Tracabilite dans le dossier (pieces archivees)', poids: 10 },
    ],
  },
] as const;

/** Cree les check-lists et grilles de reference absentes (idempotent). */
export async function initialiserChecklistsEtGrilles(compteId: number | null = null) {
  for (const c of CHECKLISTS_INITIALES) {
    const [existe] = await db.select({ id: schema.checklists.id }).from(schema.checklists).where(eq(schema.checklists.code, c.code));
    if (existe) continue;
    await db.insert(schema.checklists).values({ compteId, code: c.code, libelle: c.libelle, points: c.points, familles: c.familles });
  }
  for (const g of GRILLES_INITIALES) {
    const [existe] = await db.select({ id: schema.grillesQualite.id }).from(schema.grillesQualite).where(eq(schema.grillesQualite.code, g.code));
    if (existe) continue;
    await db.insert(schema.grillesQualite).values({ compteId, code: g.code, libelle: g.libelle, criteres: g.criteres, familles: g.familles });
  }
}
