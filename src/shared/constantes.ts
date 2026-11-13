/**
 * Referentiel metier de la GPAO (section 4 de CLAUDE.md).
 * Ces listes sont les valeurs initiales : elles sont copiees en base au premier demarrage
 * (table `referentiels`) et modifiables ensuite dans l'ecran Parametres sans redeploiement.
 */

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export const ROLES = ['admin', 'manager', 'collaborateur', 'client_lecture'] as const;
export type Role = (typeof ROLES)[number];

export const LIBELLES_ROLES: Record<Role, string> = {
  admin: 'administrateur',
  manager: 'manager de compte',
  collaborateur: 'collaborateur',
  client_lecture: 'client (lecture seule)',
};

// ---------------------------------------------------------------------------
// Familles de demandes (audit du poste, 999 fils analyses)
// ---------------------------------------------------------------------------

export interface Famille {
  code: string;
  libelle: string;
  /** Validation humaine deja en place cote client, reprise telle quelle dans la GPAO. */
  validation: string;
  /** T00 : hors perimetre du poste, exclu de toute vue de pilotage et de tout export. */
  horsPerimetre?: boolean;
  /** Temps standard en minutes, utilise pour la charge estimee du tableau de bord. */
  tempsStandardMinutes: number;
  /** Delai cible de premiere reponse, en heures ouvrees du client. */
  slaHeures: number;
}

export const FAMILLES: readonly Famille[] = [
  { code: 'T00', libelle: 'Hors perimetre (notifications systeme, infolettres, spam)', validation: 'exclu du pilotage', horsPerimetre: true, tempsStandardMinutes: 0, slaHeures: 0 },
  { code: 'T01', libelle: 'Cotations fret et relances transitaires (FCL, LCL, aerien)', validation: 'la DO valide transitaire, prix et booking', tempsStandardMinutes: 25, slaHeures: 8 },
  { code: 'T02', libelle: "Enlevements, transport local, documents d'expedition (BL, PL, AWB, shipping marks)", validation: 'le client valide, la DO pour les exceptions', tempsStandardMinutes: 30, slaHeures: 8 },
  { code: 'T03', libelle: 'Proformas, factures, modifications, pre-domiciliation', validation: 'la DO valide chaque modification', tempsStandardMinutes: 20, slaHeures: 8 },
  { code: 'T04', libelle: 'Relances clients, paiements, SWIFT, soldes, pieces manquantes', validation: 'aucune', tempsStandardMinutes: 15, slaHeures: 16 },
  { code: 'T05', libelle: 'Reglementaire : enregistrement pays, FSC, GMP, COC, legalisation', validation: "la DO et l'autorite du pays", tempsStandardMinutes: 40, slaHeures: 24 },
  { code: 'T06', libelle: 'Tableaux de situation par client ou pays', validation: 'la DO', tempsStandardMinutes: 35, slaHeures: 24 },
  { code: 'T07', libelle: 'COA, BAT, etiquettes, echantillons avec la Qualite', validation: 'la Qualite et le client', tempsStandardMinutes: 30, slaHeures: 24 },
  { code: 'T08', libelle: 'Leads, catalogue, offres, Clientify', validation: 'la DO pour les prix et le MOQ', tempsStandardMinutes: 20, slaHeures: 24 },
  { code: 'T09', libelle: 'Reporting quotidien', validation: 'la DO lit', tempsStandardMinutes: 25, slaHeures: 8 },
  { code: 'T10', libelle: 'Stagiaires : onboarding, instructions, evaluations', validation: 'la DO', tempsStandardMinutes: 20, slaHeures: 24 },
  { code: 'T11', libelle: 'Salons : acces, rendez-vous, saisie de contacts', validation: 'la DO', tempsStandardMinutes: 20, slaHeures: 24 },
  { code: 'T12', libelle: "Lettres d'invitation et courriers types", validation: 'signature de la DO', tempsStandardMinutes: 15, slaHeures: 16 },
  { code: 'T13', libelle: 'Transferts a la DO pour decision', validation: 'la DO', tempsStandardMinutes: 10, slaHeures: 4 },
  { code: 'T14', libelle: 'Tracking, transporteurs express, surestaries', validation: 'aucune', tempsStandardMinutes: 10, slaHeures: 8 },
  // Familles du poste de designer. Elles etaient confondues avec T00 tant qu'un seul poste etait
  // pilote : le travail de la designer etait hors du perimetre de l'assistante export, et donc
  // hors de tout. Il a desormais ses propres familles, et son propre poste.
  { code: 'D01', libelle: 'Publications et reseaux sociaux (LinkedIn, pages)', validation: 'la DO valide avant publication', tempsStandardMinutes: 30, slaHeures: 16 },
  { code: 'D02', libelle: 'Visuels et supports (brochures, bannieres, PLV, packaging)', validation: 'la DO valide le visuel', tempsStandardMinutes: 45, slaHeures: 24 },
  { code: 'D03', libelle: 'Catalogue, fiches produits et contenus marketing', validation: 'la DO pour les textes et les prix', tempsStandardMinutes: 40, slaHeures: 24 },
] as const;

/**
 * Action qui debloque, par famille : la formulation de repli quand le message ne porte aucune
 * phrase de demande reconnaissable.
 *
 * Elle ne devine rien du cas particulier : elle dit le travail que la famille designe, au niveau
 * ou le referentiel le connait. C'est la difference entre une colonne qui ne dit rien (« Re:
 * facture LAM ») et une colonne qui dit quoi faire (« Etablir ou corriger la facture ou la
 * proforma : Re: facture LAM »). L'IA, quand la routine tourne, remplace cette phrase par
 * l'action reelle lue dans le message.
 */
export const ACTIONS_PAR_FAMILLE: Record<string, string> = {
  T01: 'Obtenir ou relancer la cotation fret',
  T02: "Preparer l'enlevement et les documents d'expedition",
  T03: 'Etablir ou corriger la facture ou la proforma',
  T04: 'Relancer le client sur le paiement ou les pieces manquantes',
  T05: 'Avancer le dossier reglementaire',
  T06: 'Mettre a jour le tableau de situation',
  T07: 'Traiter le COA, le BAT ou les etiquettes',
  T08: "Repondre au lead ou mettre a jour l'offre",
  T09: 'Produire le reporting quotidien',
  T10: 'Encadrer le stagiaire',
  T11: 'Preparer le salon',
  T12: 'Preparer le courrier a signer',
  T13: "Transmettre a la donneuse d'ordre pour decision",
  T14: 'Suivre le tracking ou les surestaries',
  D01: 'Preparer la publication et la faire valider',
  D02: 'Produire le visuel ou le support et le faire valider',
  D03: 'Mettre a jour le catalogue ou la fiche produit',
};

/** Familles de chaque metier, pour pre-remplir le perimetre d'un poste a sa creation. */
export const FAMILLES_PAR_METIER = {
  export: ['T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'T07', 'T08', 'T09', 'T10', 'T11', 'T12', 'T13', 'T14'],
  designer: ['D01', 'D02', 'D03', 'T07', 'T09', 'T13'],
} as const;

export type Metier = keyof typeof FAMILLES_PAR_METIER;
export const LIBELLES_METIERS: Record<Metier, string> = {
  export: 'Assistante export et customer support',
  designer: 'Designer',
};

export const CODES_FAMILLES = FAMILLES.map((f) => f.code);
export const FAMILLE_HORS_PERIMETRE = 'T00';
/** Familles visibles dans le pilotage et les exports (T00 exclu partout). */
export const FAMILLES_PILOTAGE = FAMILLES.filter((f) => !f.horsPerimetre);

export function famille(code: string): Famille | undefined {
  return FAMILLES.find((f) => f.code === code);
}

export function estHorsPerimetre(code: string | null | undefined): boolean {
  return code === FAMILLE_HORS_PERIMETRE;
}

// ---------------------------------------------------------------------------
// Sens, natures, interlocuteurs
// ---------------------------------------------------------------------------

export const SENS = ['entrant', 'sortant', 'interne'] as const;
export type Sens = (typeof SENS)[number];

export const NATURES = [
  'demande_entrante',
  'consigne_do',
  'envoi_livrable',
  'demande_validation_do',
  'validation_do',
  'refus_do',
  'relance_emise',
  'relance_recue',
  'reponse_tiers',
  'information',
] as const;
export type Nature = (typeof NATURES)[number];

export interface DefinitionNature {
  code: Nature;
  libelle: string;
  /** Sens compatibles. `null` : tous les sens. */
  sens: readonly Sens[] | null;
  effet: string;
}

export const DEFINITIONS_NATURES: readonly DefinitionNature[] = [
  { code: 'demande_entrante', libelle: 'Demande entrante', sens: ['entrant'], effet: 'cree une demande au statut Nouveau' },
  { code: 'consigne_do', libelle: 'Consigne de la DO', sens: ['entrant'], effet: 'cree ou reoriente une demande' },
  { code: 'envoi_livrable', libelle: 'Envoi de livrable', sens: ['sortant'], effet: 'passe en attente du destinataire' },
  { code: 'demande_validation_do', libelle: 'Demande de validation a la DO', sens: ['sortant'], effet: 'passe en attente DO et lance le chrono de validation' },
  { code: 'validation_do', libelle: 'Validation de la DO', sens: ['entrant'], effet: 'repasse la demande en cours' },
  { code: 'refus_do', libelle: 'Refus de la DO', sens: ['entrant'], effet: 'repasse la demande en cours avec correction a faire' },
  { code: 'relance_emise', libelle: 'Relance emise', sens: ['sortant'], effet: 'incremente le niveau de relance (N1, N2, N3)' },
  { code: 'relance_recue', libelle: 'Relance recue', sens: ['entrant'], effet: 'signale un delai depasse cote poste' },
  { code: 'reponse_tiers', libelle: 'Reponse du tiers', sens: ['entrant'], effet: 'repasse la demande en cours' },
  { code: 'information', libelle: 'Information, accuse, notification', sens: null, effet: 'aucun changement, seulement trace' },
] as const;

export function definitionNature(code: string): DefinitionNature | undefined {
  return DEFINITIONS_NATURES.find((n) => n.code === code);
}

export const INTERLOCUTEURS = [
  'client',
  'prospect',
  'transitaire',
  'transporteur',
  'qualite',
  'fournisseur',
  'autorite',
  'do',
  'stagiaire',
  'interne_azmg',
] as const;
export type Interlocuteur = (typeof INTERLOCUTEURS)[number];

export const LIBELLES_INTERLOCUTEURS: Record<Interlocuteur, string> = {
  client: 'client',
  prospect: 'prospect',
  transitaire: 'transitaire',
  transporteur: 'transporteur',
  qualite: 'Qualite',
  fournisseur: 'fournisseur',
  autorite: 'autorite ou chambre',
  do: 'donneuse d’ordre',
  stagiaire: 'stagiaire',
  interne_azmg: 'interne AZMG',
};

// ---------------------------------------------------------------------------
// Statuts de demande et correspondance reporting client
// ---------------------------------------------------------------------------

export const STATUTS = ['nouveau', 'en_cours', 'attente_tiers', 'attente_do', 'bloque', 'termine', 'annule'] as const;
export type Statut = (typeof STATUTS)[number];

/** Acteur dont on attend l'action : sert au calcul du temps d'attente par acteur. */
export const ACTEURS = ['poste', 'do', 'client', 'tiers', 'aucun'] as const;
export type Acteur = (typeof ACTEURS)[number];

/** Statuts de reporting client, repris exactement (section 3 de CLAUDE.md). */
export const STATUTS_REPORTING = ['Termine', 'En attente client', 'En cours', 'Bloque', 'Annule'] as const;
export type StatutReporting = (typeof STATUTS_REPORTING)[number];

export interface DefinitionStatut {
  code: Statut;
  libelle: string;
  reporting: StatutReporting;
  /** Mention ajoutee au reporting, sans changer le statut repris. */
  mention?: string;
  /** Acteur attendu par defaut quand la demande prend ce statut. */
  acteur: Acteur;
  /** Une demande a ce statut est fermee : elle sort de la file du jour et du stock. */
  fermee: boolean;
}

export const DEFINITIONS_STATUTS: readonly DefinitionStatut[] = [
  { code: 'nouveau', libelle: 'Nouveau', reporting: 'En cours', acteur: 'poste', fermee: false },
  { code: 'en_cours', libelle: 'En cours', reporting: 'En cours', acteur: 'poste', fermee: false },
  { code: 'attente_tiers', libelle: 'En attente client / tiers', reporting: 'En attente client', acteur: 'client', fermee: false },
  { code: 'attente_do', libelle: 'En attente DO', reporting: 'En cours', mention: 'validation DO attendue', acteur: 'do', fermee: false },
  { code: 'bloque', libelle: 'Bloque', reporting: 'Bloque', acteur: 'poste', fermee: false },
  { code: 'termine', libelle: 'Termine', reporting: 'Termine', acteur: 'aucun', fermee: true },
  { code: 'annule', libelle: 'Annule', reporting: 'Annule', acteur: 'aucun', fermee: true },
] as const;

export function definitionStatut(code: string): DefinitionStatut | undefined {
  return DEFINITIONS_STATUTS.find((s) => s.code === code);
}

export function libelleStatut(code: string): string {
  return definitionStatut(code)?.libelle ?? code;
}

export function statutReporting(code: string): StatutReporting {
  return definitionStatut(code)?.reporting ?? 'En cours';
}

export const STATUTS_OUVERTS = DEFINITIONS_STATUTS.filter((s) => !s.fermee).map((s) => s.code);
export const STATUTS_FERMES = DEFINITIONS_STATUTS.filter((s) => s.fermee).map((s) => s.code);

/** Un statut ferme ne consomme plus de delai : le chrono s'arrete. */
export function estFerme(statut: string): boolean {
  return STATUTS_FERMES.includes(statut as Statut);
}

// ---------------------------------------------------------------------------
// Sources d'evenement, priorites, types d'echeance
// ---------------------------------------------------------------------------

export const SOURCES = ['mail', 'whatsapp', 'vocal', 'saisie', 'import'] as const;
export type Source = (typeof SOURCES)[number];

export const LIBELLES_SOURCES: Record<Source, string> = {
  mail: 'mail',
  whatsapp: 'WhatsApp',
  vocal: 'vocal WhatsApp',
  saisie: 'saisie directe',
  import: 'import',
};

/**
 * Causes d'une reprise, en liste fermee.
 *
 * C'est ce qui transforme un releve en plan d'accompagnement : le compte des reclamations dit
 * combien, la cause dit sur quoi travailler. La liste est fermee pour que le compte ait un sens,
 * et volontairement courte pour rester renseignable en deux secondes.
 */
export const CAUSES = [
  'delai_reponse',
  'procedure_non_suivie',
  'erreur_document',
  'classement_tracabilite',
  'qualite_livrable',
  'manque_autonomie',
] as const;
export type Cause = (typeof CAUSES)[number];

export const LIBELLES_CAUSES: Record<Cause, string> = {
  delai_reponse: 'Delai de reponse',
  procedure_non_suivie: 'Procedure non suivie',
  erreur_document: 'Erreur de document',
  classement_tracabilite: 'Classement et tracabilite',
  qualite_livrable: 'Qualite du livrable',
  manque_autonomie: 'Manque d’autonomie',
};

export const PRIORITES = ['basse', 'normale', 'haute', 'critique'] as const;
export type Priorite = (typeof PRIORITES)[number];

export const POIDS_PRIORITES: Record<Priorite, number> = { critique: 0, haute: 1, normale: 2, basse: 3 };

export const LIBELLES_PRIORITES: Record<Priorite, string> = {
  critique: 'Critique',
  haute: 'Haute',
  normale: 'Normale',
  basse: 'Basse',
};

export const TYPES_ECHEANCE = ['cut_off', 'etd', 'eta', 'validite_offre', 'expiration_document', 'creneau_entrepot'] as const;
export type TypeEcheance = (typeof TYPES_ECHEANCE)[number];

export const LIBELLES_ECHEANCES: Record<TypeEcheance, string> = {
  cut_off: 'cut-off',
  etd: 'ETD (depart prevu)',
  eta: 'ETA (arrivee prevue)',
  validite_offre: "validite d’offre",
  expiration_document: 'expiration de document',
  creneau_entrepot: "creneau d’entrepot",
};

/** Statuts de dossier (le dossier regroupe les demandes d'un client x produit x operation). */
export const STATUTS_DOSSIER = ['ouvert', 'en_attente', 'clos', 'annule'] as const;
export type StatutDossier = (typeof STATUTS_DOSSIER)[number];

export const LIBELLES_STATUTS_DOSSIER: Record<StatutDossier, string> = {
  ouvert: 'ouvert',
  en_attente: 'en attente',
  clos: 'clos',
  annule: 'annule',
};

export const EMAIL_CONTACT = 'contact@azmg-solutions.com';
export const NOM_SOCIETE = 'AZMG-Solutions';
