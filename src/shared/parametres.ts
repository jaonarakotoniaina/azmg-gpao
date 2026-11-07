/** Parametres de l'application, valides par zod et partages front et back. */
import { z } from 'zod';
import { CODES_FAMILLES, FAMILLES } from './constantes';
import { HORAIRES_PAR_DEFAUT, horairesCompteParDefaut, type HorairesOuvres } from './heures-ouvrees';

const heure = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Heure attendue au format HH:MM');
const jourIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ');

export const plageSchema = z.object({ debut: heure, fin: heure });

export const horairesSchema: z.ZodType<HorairesOuvres> = z.object({
  fuseau: z.string().min(1),
  semaine: z.record(z.enum(['1', '2', '3', '4', '5', '6', '7']), z.array(plageSchema)).transform((v) => {
    const sortie: Record<number, { debut: string; fin: string }[]> = {};
    for (const [cle, plages] of Object.entries(v)) sortie[Number(cle)] = plages ?? [];
    return sortie;
  }),
  feriesClient: z.array(jourIso),
  feriesLocaux: z.array(jourIso),
  feriesCollaborateur: z.boolean(),
}) as unknown as z.ZodType<HorairesOuvres>;

/** Mode d'automatisation d'une action sortante. Aucun mail ne part seul : `auto` reste un brouillon pret. */
export const MODES_AUTOMATISATION = ['auto', 'brouillon', 'manuel'] as const;
export type ModeAutomatisation = (typeof MODES_AUTOMATISATION)[number];

export const AUTOMATISATIONS = [
  { cle: 'relances', libelle: 'Preparation des relances N1, N2 et N3', defaut: 'brouillon' },
  { cle: 'digest_do', libelle: 'Digest de validation pour la DO', defaut: 'brouillon' },
  { cle: 'daily', libelle: 'Reporting quotidien', defaut: 'brouillon' },
  { cle: 'typage_ia', libelle: 'Typage des evenements par l’IA', defaut: 'auto' },
  { cle: 'echantillon_qualite', libelle: 'Tirage de l’echantillon qualite hebdomadaire', defaut: 'auto' },
] as const;

export type CleAutomatisation = (typeof AUTOMATISATIONS)[number]['cle'];

export const parametresSchema = z.object({
  /** Interrupteur general : coupe toute preparation automatique. */
  pauseAutomatisations: z.boolean(),
  automatisations: z.record(z.string(), z.object({ mode: z.enum(MODES_AUTOMATISATION), actif: z.boolean() })),
  /** Horaires ouvres de reference, utilises quand un compte client n'en definit pas. */
  horaires: horairesSchema,
  sla: z.object({
    /** Delai cible de premiere reponse par famille, en heures ouvrees. */
    parFamille: z.record(z.string(), z.number().min(0).max(400)),
    /** Delai au-dela duquel une attente DO est signalee, en heures ouvrees. */
    attenteDoHeures: z.number().min(1).max(400),
    /** Delais avant relance N1, N2 et N3, en heures ouvrees. */
    relances: z.object({ n1: z.number().min(1).max(400), n2: z.number().min(1).max(400), n3: z.number().min(1).max(400) }),
  }),
  alertes: z.object({
    /** Jours avant echeance declenchant une alerte dans la file. */
    joursAvantEcheance: z.array(z.number().int().min(0).max(30)),
  }),
  qualite: z.object({
    /** Part des envois tires au sort chaque semaine pour le controle qualite. */
    tauxEchantillon: z.number().min(0).max(1),
  }),
  /** Heure (fuseau Antananarivo) de preparation du reporting quotidien. */
  heureDaily: z.number().int().min(0).max(23),
  /** Seuil de confiance du typage automatique : en dessous, la file « A classer ». */
  seuilConfianceTypage: z.number().min(0).max(1),
});

export type Parametres = z.infer<typeof parametresSchema>;

export function parametresParDefaut(annee = new Date().getUTCFullYear()): Parametres {
  const slaParFamille: Record<string, number> = {};
  for (const f of FAMILLES) slaParFamille[f.code] = f.slaHeures;
  const automatisations: Parametres['automatisations'] = {};
  for (const a of AUTOMATISATIONS) automatisations[a.cle] = { mode: a.defaut, actif: true };
  return {
    pauseAutomatisations: false,
    automatisations,
    horaires: horairesCompteParDefaut(annee - 1, 4),
    sla: {
      parFamille: slaParFamille,
      attenteDoHeures: 8,
      relances: { n1: 16, n2: 32, n3: 56 },
    },
    alertes: { joursAvantEcheance: [2, 0] },
    qualite: { tauxEchantillon: 0.1 },
    heureDaily: 16,
    seuilConfianceTypage: 0.8,
  };
}

export { CODES_FAMILLES, HORAIRES_PAR_DEFAUT };
