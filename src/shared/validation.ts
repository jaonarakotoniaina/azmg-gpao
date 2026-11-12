/** Schemas zod partages front et back : une seule definition des contrats d'API. */
import { z } from 'zod';
import { ACTEURS, CODES_FAMILLES, INTERLOCUTEURS, NATURES, PRIORITES, ROLES, SENS, SOURCES, STATUTS, STATUTS_DOSSIER, TYPES_ECHEANCE } from './constantes';

export const motDePasseSchema = z.string().min(10, 'Le mot de passe doit contenir au moins 10 caracteres').max(200);
export const emailSchema = z.string().trim().toLowerCase().email('Adresse email invalide');

/** Famille : les codes du referentiel initial, ou tout code ajoute dans les Parametres. */
export const familleSchema = z.string().trim().min(2).max(10);
export const familleConnueSchema = z.enum(CODES_FAMILLES as [string, ...string[]]);

const instant = z.union([z.string().datetime({ offset: true }), z.string().datetime(), z.date()]).transform((v) => new Date(v));
export const instantSchema = instant;
const instantOptionnel = instant.nullable().optional();

// ---------------------------------------------------------------------------
// Authentification et utilisateurs
// ---------------------------------------------------------------------------

export const connexionSchema = z.object({ email: emailSchema, motDePasse: z.string().min(1, 'Mot de passe requis') });

export const creationUtilisateurSchema = z.object({
  email: emailSchema,
  nom: z.string().trim().min(2, 'Nom trop court').max(120),
  role: z.enum(ROLES),
  motDePasse: motDePasseSchema,
});

export const modificationUtilisateurSchema = z.object({
  nom: z.string().trim().min(2).max(120).optional(),
  role: z.enum(ROLES).optional(),
  actif: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Comptes clients et postes
// ---------------------------------------------------------------------------

export const compteSchema = z.object({
  nom: z.string().trim().min(2).max(160),
  code: z.string().trim().regex(/^[a-z0-9-]{2,60}$/, 'Code attendu en minuscules, chiffres et tirets').optional(),
  pays: z.string().trim().max(80).nullish(),
  ville: z.string().trim().max(80).nullish(),
  fuseau: z.string().trim().min(3).max(64).optional(),
  donneurOrdreNom: z.string().trim().max(120).nullish(),
  donneurOrdreEmail: z.union([emailSchema, z.literal('')]).nullish(),
  /** Adresses depuis lesquelles le poste ecrit, souvent des adresses du client. */
  adressesPoste: z.array(emailSchema).max(10).optional(),
  managerId: z.number().int().positive().nullish(),
});

export const modificationCompteSchema = compteSchema.partial().extend({ actif: z.boolean().optional(), horaires: z.unknown().optional() });

export const posteSchema = z.object({
  compteId: z.number().int().positive(),
  intitule: z.string().trim().min(2).max(160),
  collaborateurId: z.number().int().positive().nullish(),
});

export const modificationPosteSchema = z.object({
  intitule: z.string().trim().min(2).max(160).optional(),
  collaborateurId: z.number().int().positive().nullish(),
  actif: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Dossiers
// ---------------------------------------------------------------------------

export const dossierSchema = z.object({
  compteId: z.number().int().positive(),
  posteId: z.number().int().positive().nullish(),
  client: z.string().trim().min(1, 'Client obligatoire').max(160),
  pays: z.string().trim().max(80).nullish(),
  produit: z.string().trim().max(200).nullish(),
  operation: z.string().trim().max(200).nullish(),
  libelle: z.string().trim().max(300).optional(),
  statut: z.enum(STATUTS_DOSSIER).optional(),
  references: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().trim().max(5000).nullish(),
});

export const modificationDossierSchema = dossierSchema.partial().omit({ compteId: true }).extend({ resume: z.string().trim().max(500).nullish() });

// ---------------------------------------------------------------------------
// Demandes
// ---------------------------------------------------------------------------

export const demandeSchema = z.object({
  dossierId: z.number().int().positive(),
  famille: familleSchema,
  objet: z.string().trim().min(2, 'Objet trop court').max(300),
  origine: z.enum(SOURCES).optional(),
  priorite: z.enum(PRIORITES).optional(),
  statut: z.enum(STATUTS).optional(),
  echeanceLe: instantOptionnel,
  notes: z.string().trim().max(5000).nullish(),
});

export const changementStatutSchema = z.object({
  statut: z.enum(STATUTS),
  motif: z.string().trim().max(300).nullish(),
  acteurAttendu: z.enum(ACTEURS).optional(),
});

export const modificationDemandeSchema = z.object({
  objet: z.string().trim().min(2).max(300).optional(),
  famille: familleSchema.optional(),
  priorite: z.enum(PRIORITES).optional(),
  echeanceLe: instantOptionnel,
  notes: z.string().trim().max(5000).nullish(),
  posteId: z.number().int().positive().nullish(),
});

export const filtresFileSchema = z.object({
  compteId: z.coerce.number().int().positive().optional(),
  posteId: z.coerce.number().int().positive().optional(),
  famille: z.string().trim().optional(),
  acteur: z.enum(ACTEURS).optional(),
  statut: z.enum(STATUTS).optional(),
  risque: z.enum(['0', '1', 'true', 'false']).optional(),
  limite: z.coerce.number().int().min(1).max(1000).optional(),
});

// ---------------------------------------------------------------------------
// Evenements
// ---------------------------------------------------------------------------

export const evenementSchema = z
  .object({
    demandeId: z.number().int().positive().nullish(),
    dossierId: z.number().int().positive().nullish(),
    sens: z.enum(SENS),
    nature: z.enum(NATURES),
    famille: familleSchema.nullish(),
    interlocuteur: z.enum(INTERLOCUTEURS).nullish(),
    source: z.enum(SOURCES),
    survenuLe: instant.optional(),
    objet: z.string().trim().max(300).nullish(),
    resume: z.string().trim().max(1000).nullish(),
    contenu: z.string().trim().max(50_000).nullish(),
    filId: z.string().trim().max(200).nullish(),
    messageId: z.string().trim().max(400).nullish(),
    expediteur: z.string().trim().max(320).nullish(),
    destinataires: z.array(z.string().trim().max(320)).max(50).optional(),
    priorite: z.enum(PRIORITES).optional(),
    echeanceLe: instantOptionnel,
  })
  .refine((v) => Boolean(v.demandeId || v.dossierId), { message: 'Rattachez l’evenement a une demande ou a un dossier' });

export const correctionTypageSchema = z
  .object({
    famille: familleSchema.optional(),
    nature: z.enum(NATURES).optional(),
    interlocuteur: z.enum(INTERLOCUTEURS).nullish(),
    sens: z.enum(SENS).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Indiquez au moins une correction' });

// ---------------------------------------------------------------------------
// Saisie rapide : un seul appel cree le dossier si besoin, la demande et l'evenement
// ---------------------------------------------------------------------------

export const saisieRapideSchema = z
  .object({
    compteId: z.number().int().positive(),
    /** Dossier existant, ou description d'un dossier a creer a la volee. */
    dossierId: z.number().int().positive().nullish(),
    nouveauDossier: dossierSchema.omit({ compteId: true }).partial({ client: true }).optional(),
    /** Demande existante a faire avancer, sinon une demande est ouverte si la nature le prevoit. */
    demandeId: z.number().int().positive().nullish(),
    famille: familleSchema,
    objet: z.string().trim().min(2, 'Objet trop court').max(300),
    sens: z.enum(SENS).default('entrant'),
    nature: z.enum(NATURES).default('demande_entrante'),
    interlocuteur: z.enum(INTERLOCUTEURS).nullish(),
    source: z.enum(SOURCES).default('saisie'),
    survenuLe: instant.optional(),
    resume: z.string().trim().max(1000).nullish(),
    contenu: z.string().trim().max(50_000).nullish(),
    priorite: z.enum(PRIORITES).optional(),
    echeanceLe: instantOptionnel,
  })
  .refine((v) => Boolean(v.dossierId || v.demandeId || v.nouveauDossier?.client), {
    message: 'Choisissez un dossier existant ou renseignez le client du nouveau dossier',
  });

// ---------------------------------------------------------------------------
// Echeances
// ---------------------------------------------------------------------------

export const echeanceSchema = z.object({
  dossierId: z.number().int().positive(),
  demandeId: z.number().int().positive().nullish(),
  type: z.enum(TYPES_ECHEANCE),
  libelle: z.string().trim().max(200).nullish(),
  echeanceLe: instant,
  phraseSource: z.string().trim().max(1000).nullish(),
});

export const modificationEcheanceSchema = z.object({
  libelle: z.string().trim().max(200).nullish(),
  echeanceLe: instant.optional(),
  honoree: z.boolean().optional(),
  annulee: z.boolean().optional(),
});
