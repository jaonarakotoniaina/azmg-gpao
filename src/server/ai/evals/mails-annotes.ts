/**
 * Jeu d'evaluation du typage : 60 mails FICTIFS annotes a la main.
 *
 * Critere de la phase 3 (section 10 de CLAUDE.md) : au moins 85 % des mails doivent etre bien
 * classes en famille **et** en nature.
 *
 * Tout y est invente : clients, produits, references, montants, noms et adresses. Aucun echange
 * reel de Masenz Group n'entre dans le depot (section 3). Les domaines utilisent des noms de
 * fantaisie en `.test`, reserve par la norme et jamais routable.
 *
 * Le jeu couvre les 15 familles, les 10 natures et les trois sens, avec des formulations variees
 * pour que la mesure reste honnete : si les regles ne tiennent que sur une tournure, elles
 * echouent ici.
 */
import type { Interlocuteur, Nature, Sens } from '@shared/constantes';

export interface MailAnnote {
  reference: string;
  expediteur: string;
  objet: string;
  corps: string;
  sens: Sens;
  /** Classement attendu, pose a la main. */
  attendu: { famille: string; nature: Nature; interlocuteur?: Interlocuteur };
}

export const MAILS_ANNOTES: MailAnnote[] = [
  // --- T01 : cotations fret et relances transitaires ------------------------
  {
    reference: 'T01-1',
    expediteur: 'operations@transit-azur.test',
    objet: 'Cotation fret aerien Barcelone vers Alger',
    corps: 'Suite a votre demande, voici notre offre pour 180 kg en aerien. Transit 3 jours, cut off le jeudi 12h.',
    sens: 'entrant',
    attendu: { famille: 'T01', nature: 'reponse_tiers', interlocuteur: 'transitaire' },
  },
  {
    reference: 'T01-2',
    expediteur: 'elysa@azmg-solutions.test',
    objet: 'Demande de cotation LCL vers Tripoli',
    corps: 'Bonjour, pourriez vous nous communiquer un taux de fret pour 2 palettes en LCL ? Merci de preciser le booking possible.',
    sens: 'sortant',
    attendu: { famille: 'T01', nature: 'envoi_livrable', interlocuteur: 'transitaire' },
  },
  {
    reference: 'T01-3',
    expediteur: 'elysa@azmg-solutions.test',
    objet: 'Relance cotation fret maritime',
    corps: 'Je me permets de revenir vers vous concernant notre demande de cotation FCL restee sans reponse.',
    sens: 'sortant',
    attendu: { famille: 'T01', nature: 'relance_emise', interlocuteur: 'transitaire' },
  },
  {
    reference: 'T01-4',
    expediteur: 'booking@maritime-lusitania.test',
    objet: 'Confirmation de booking BK fictif',
    corps: 'Nous confirmons le booking. ETD le 18, ETA le 29. Merci de nous retourner les documents avant le cut off.',
    sens: 'entrant',
    attendu: { famille: 'T01', nature: 'reponse_tiers', interlocuteur: 'transitaire' },
  },
  {
    reference: 'T01-5',
    expediteur: 'elysa@azmg-solutions.test',
    objet: 'Comparatif de cotations pour validation',
    corps: 'Voici le comparatif des trois offres de fret. Merci de valider le transitaire et le prix retenu.',
    sens: 'sortant',
    attendu: { famille: 'T01', nature: 'demande_validation_do', interlocuteur: 'do' },
  },

  // --- T02 : enlevements et documents d'expedition --------------------------
  {
    reference: 'T02-1',
    expediteur: 'elysa@azmg-solutions.test',
    objet: 'Projet de BL et packing list',
    corps: 'Veuillez trouver ci joint le projet de bill of lading et la packing list pour accord avant emission.',
    sens: 'sortant',
    attendu: { famille: 'T02', nature: 'envoi_livrable', interlocuteur: 'client' },
  },
  {
    reference: 'T02-2',
    expediteur: 'achat@alpha-pharma.test',
    objet: 'Correction sur le connaissement',
    corps: 'En reponse a votre envoi, merci de corriger notre numero fiscal sur le connaissement avant emission.',
    sens: 'entrant',
    attendu: { famille: 'T02', nature: 'reponse_tiers', interlocuteur: 'client' },
  },
  {
    reference: 'T02-3',
    expediteur: 'do@masenz-fictif.test',
    objet: 'Enlevement de mardi',
    corps: 'Merci de preparer l enlevement de mardi matin et de verifier le shipping mark avant le chargement.',
    sens: 'entrant',
    attendu: { famille: 'T02', nature: 'consigne_do', interlocuteur: 'do' },
  },
  {
    reference: 'T02-4',
    expediteur: 'logistique@beta-distrib.test',
    objet: 'Photos du chargement',
    corps: 'Pour information, voici les photos prises lors de l empotage du conteneur.',
    sens: 'entrant',
    attendu: { famille: 'T02', nature: 'information', interlocuteur: 'client' },
  },
  {
    reference: 'T02-5',
    expediteur: 'elysa@azmg-solutions.test',
    objet: 'AWB emis pour le lot aerien',
    corps: 'Je vous transmets la lettre de transport aerien emise ce matin, ainsi que le scan signe.',
    sens: 'sortant',
    attendu: { famille: 'T02', nature: 'envoi_livrable', interlocuteur: 'client' },
  },

  // --- T03 : proformas, factures, modifications -----------------------------
  {
    reference: 'T03-1',
    expediteur: 'elysa@azmg-solutions.test',
    objet: 'Proforma a valider en dollars',
    corps: 'Le client demande la proforma en dollars au lieu d euros. Merci de valider la modification.',
    sens: 'sortant',
    attendu: { famille: 'T03', nature: 'demande_validation_do', interlocuteur: 'do' },
  },
  {
    reference: 'T03-2',
    expediteur: 'do@masenz-fictif.test',
    objet: 'Re : Proforma en dollars',
    corps: 'Je valide la proforma en dollars, tu peux y aller.',
    sens: 'entrant',
    attendu: { famille: 'T03', nature: 'validation_do', interlocuteur: 'do' },
  },
  {
    reference: 'T03-3',
    expediteur: 'compta@gamma-sante.test',
    objet: 'Facture definitive attendue',
    corps: 'Pouvez vous nous dire ou en est la facture definitive ? Nous attendons toujours pour lancer le reglement.',
    sens: 'entrant',
    attendu: { famille: 'T03', nature: 'relance_recue', interlocuteur: 'client' },
  },
  {
    reference: 'T03-4',
    expediteur: 'elysa@azmg-solutions.test',
    objet: 'Facture rectificative',
    corps: 'Veuillez trouver ci joint la facture rectificative apres correction de la quantite.',
    sens: 'sortant',
    attendu: { famille: 'T03', nature: 'envoi_livrable', interlocuteur: 'client' },
  },
  {
    reference: 'T03-5',
    expediteur: 'banque@delta-medic.test',
    objet: 'Pre domiciliation du dossier',
    corps: 'Suite a votre demande, le dossier de pre domiciliation est ouvert. Merci de nous adresser la facture proforma signee.',
    sens: 'entrant',
    attendu: { famille: 'T03', nature: 'reponse_tiers', interlocuteur: 'client' },
  },

  // --- T04 : relances clients, paiements, SWIFT -----------------------------
  {
    reference: 'T04-1',
    expediteur: 'elysa@azmg-solutions.test',
    objet: 'Relance solde a payer',
    corps: 'Pour rappel, le solde reste du a ce jour. Merci de nous transmettre le SWIFT des que le virement est passe.',
    sens: 'sortant',
    attendu: { famille: 'T04', nature: 'relance_emise', interlocuteur: 'client' },
  },
  {
    reference: 'T04-2',
    expediteur: 'finance@epsilon-trade.test',
    objet: 'SWIFT du virement',
    corps: 'Veuillez trouver ci joint le SWIFT correspondant au reglement du solde effectue hier.',
    sens: 'entrant',
    attendu: { famille: 'T04', nature: 'reponse_tiers', interlocuteur: 'client' },
  },
  {
    reference: 'T04-3',
    expediteur: 'elysa@azmg-solutions.test',
    objet: 'Pieces manquantes au dossier',
    corps: 'Il nous manque encore deux documents pour completer le dossier. Je reviens vers vous a ce sujet.',
    sens: 'sortant',
    attendu: { famille: 'T04', nature: 'relance_emise', interlocuteur: 'client' },
  },
  {
    reference: 'T04-4',
    expediteur: 'compta@zeta-import.test',
    objet: 'Avis de credit recu',
    corps: 'Pour information, notre banque nous confirme l avis de credit. Le paiement est parti ce matin.',
    sens: 'entrant',
    attendu: { famille: 'T04', nature: 'information', interlocuteur: 'client' },
  },
  {
    reference: 'T04-5',
    expediteur: 'do@masenz-fictif.test',
    objet: 'Impaye sur le dossier Maroc',
    corps: 'Merci de preparer un etat des impayes et de relancer le client cette semaine.',
    sens: 'entrant',
    attendu: { famille: 'T04', nature: 'consigne_do', interlocuteur: 'do' },
  },

  // --- T05 : reglementaire --------------------------------------------------
  {
    reference: 'T05-1',
    expediteur: 'elysa@azmg-solutions.test',
    objet: 'Depot du dossier de legalisation',
    corps: 'Je vous transmets le dossier complet pour legalisation du certificat de vente libre.',
    sens: 'sortant',
    attendu: { famille: 'T05', nature: 'envoi_livrable', interlocuteur: 'autorite' },
  },
  {
    reference: 'T05-2',
    expediteur: 'secretariat@chambre-commerce.test',
    objet: 'Certificat legalise disponible',
    corps: 'En reponse a votre demande, le certificat legalise est pret. Il peut etre retire des demain.',
    sens: 'entrant',
    attendu: { famille: 'T05', nature: 'reponse_tiers', interlocuteur: 'autorite' },
  },
  {
    reference: 'T05-3',
    expediteur: 'do@masenz-fictif.test',
    objet: 'Enregistrement produit en Algerie',
    corps: 'Lance la procedure d enregistrement du produit aupres des autorites algeriennes cette semaine.',
    sens: 'entrant',
    attendu: { famille: 'T05', nature: 'consigne_do', interlocuteur: 'do' },
  },
  {
    reference: 'T05-4',
    expediteur: 'quality@usine-fictive.test',
    objet: 'Certificat GMP renouvele',
    corps: 'Pour information, notre certificat GMP a ete renouvele jusqu en decembre prochain.',
    sens: 'entrant',
    attendu: { famille: 'T05', nature: 'information', interlocuteur: 'fournisseur' },
  },
  {
    reference: 'T05-5',
    expediteur: 'elysa@azmg-solutions.test',
    objet: 'Relance sur la legalisation',
    corps: 'Je me permets de revenir vers vous, notre dossier de legalisation est depose depuis trois semaines.',
    sens: 'sortant',
    attendu: { famille: 'T05', nature: 'relance_emise', interlocuteur: 'autorite' },
  },

  // --- T06 : tableaux de situation ------------------------------------------
  {
    reference: 'T06-1',
    expediteur: 'elysa@azmg-solutions.test',
    objet: 'Tableau de situation par pays',
    corps: 'Veuillez trouver ci joint le tableau de situation mis a jour par pays.',
    sens: 'sortant',
    attendu: { famille: 'T06', nature: 'envoi_livrable', interlocuteur: 'do' },
  },
  {
    reference: 'T06-2',
    expediteur: 'do@masenz-fictif.test',
    objet: 'Point de situation Libye',
    corps: 'Merci de preparer un point de situation sur tous les dossiers Libye avant vendredi.',
    sens: 'entrant',
    attendu: { famille: 'T06', nature: 'consigne_do', interlocuteur: 'do' },
  },
  {
    reference: 'T06-3',
    expediteur: 'do@masenz-fictif.test',
    objet: 'Re : Tableau de situation',
    corps: 'Bien recu, merci. C est tres clair.',
    sens: 'entrant',
    attendu: { famille: 'T06', nature: 'information', interlocuteur: 'do' },
  },
  {
    reference: 'T06-4',
    expediteur: 'elysa@azmg-solutions.test',
    objet: 'Etat des commandes en cours',
    corps: 'Je te soumets l etat des commandes en cours pour validation avant diffusion au client.',
    sens: 'sortant',
    attendu: { famille: 'T06', nature: 'demande_validation_do', interlocuteur: 'do' },
  },

  // --- T07 : qualite, COA, BAT, etiquettes ----------------------------------
  {
    reference: 'T07-1',
    expediteur: 'qualite@usine-fictive.test',
    objet: 'COA du lot',
    corps: 'Veuillez trouver ci joint le certificat d analyse du lot produit cette semaine.',
    sens: 'entrant',
    attendu: { famille: 'T07', nature: 'reponse_tiers', interlocuteur: 'qualite' },
  },
  {
    reference: 'T07-2',
    expediteur: 'elysa@azmg-solutions.test',
    objet: 'BAT etiquette a valider',
    corps: 'Je vous transmets le bon a tirer de l etiquette pour accord avant impression.',
    sens: 'sortant',
    attendu: { famille: 'T07', nature: 'envoi_livrable', interlocuteur: 'client' },
  },
  {
    reference: 'T07-3',
    expediteur: 'achat@alpha-pharma.test',
    objet: 'Demande d echantillon',
    corps: 'Pourriez vous nous faire parvenir un echantillon du nouveau conditionnement ?',
    sens: 'entrant',
    attendu: { famille: 'T07', nature: 'demande_entrante', interlocuteur: 'client' },
  },
  {
    reference: 'T07-4',
    expediteur: 'service qualite@usine-fictive.test',
    objet: 'Notice produit mise a jour',
    corps: 'Pour information, la notice produit a ete mise a jour suite au changement de packaging.',
    sens: 'entrant',
    attendu: { famille: 'T07', nature: 'information', interlocuteur: 'qualite' },
  },

  // --- T08 : leads, catalogue, offres ---------------------------------------
  {
    reference: 'T08-1',
    expediteur: 'contact@nouveau-prospect.test',
    objet: 'Demande de partenariat',
    corps: 'Nous sommes un nouveau client potentiel et souhaitons recevoir votre catalogue et votre liste de prix.',
    sens: 'entrant',
    attendu: { famille: 'T08', nature: 'demande_entrante', interlocuteur: 'prospect' },
  },
  {
    reference: 'T08-2',
    expediteur: 'elysa@azmg-solutions.test',
    objet: 'Catalogue et MOQ',
    corps: 'Je te soumets la proposition de prix et le MOQ pour ce prospect, pour validation avant envoi.',
    sens: 'sortant',
    attendu: { famille: 'T08', nature: 'demande_validation_do', interlocuteur: 'do' },
  },
  {
    reference: 'T08-3',
    expediteur: 'elysa@azmg-solutions.test',
    objet: 'Envoi du catalogue',
    corps: 'Veuillez trouver ci joint notre catalogue complet ainsi que la liste de prix a jour.',
    sens: 'sortant',
    attendu: { famille: 'T08', nature: 'envoi_livrable', interlocuteur: 'prospect' },
  },
  {
    reference: 'T08-4',
    expediteur: 'do@masenz-fictif.test',
    objet: 'Saisie Clientify',
    corps: 'Merci de preparer la fiche Clientify pour les trois prospects rencontres la semaine derniere.',
    sens: 'entrant',
    attendu: { famille: 'T08', nature: 'consigne_do', interlocuteur: 'do' },
  },

  // --- T09 : reporting quotidien --------------------------------------------
  {
    reference: 'T09-1',
    expediteur: 'elysa@azmg-solutions.test',
    objet: 'Rapport quotidien du jour',
    corps: 'Veuillez trouver ci joint le reporting du jour avec les dossiers traites et les priorites de demain.',
    sens: 'sortant',
    attendu: { famille: 'T09', nature: 'envoi_livrable', interlocuteur: 'do' },
  },
  {
    reference: 'T09-2',
    expediteur: 'do@masenz-fictif.test',
    objet: 'Re : Rapport quotidien',
    corps: 'Bien note, merci pour le suivi quotidien.',
    sens: 'entrant',
    attendu: { famille: 'T09', nature: 'information', interlocuteur: 'do' },
  },
  {
    reference: 'T09-3',
    expediteur: 'do@masenz-fictif.test',
    objet: 'Daily manquant',
    corps: 'Nous attendons toujours le compte rendu du jour d hier.',
    sens: 'entrant',
    attendu: { famille: 'T09', nature: 'relance_recue', interlocuteur: 'do' },
  },

  // --- T10 : stagiaires -----------------------------------------------------
  {
    reference: 'T10-1',
    expediteur: 'do@masenz-fictif.test',
    objet: 'Arrivee de la stagiaire',
    corps: 'Merci de preparer l onboarding de la nouvelle stagiaire qui arrive lundi.',
    sens: 'entrant',
    attendu: { famille: 'T10', nature: 'consigne_do', interlocuteur: 'do' },
  },
  {
    reference: 'T10-2',
    expediteur: 'elysa@azmg-solutions.test',
    objet: 'Evaluation de stage',
    corps: 'Veuillez trouver ci joint l evaluation de stage completee pour signature.',
    sens: 'sortant',
    attendu: { famille: 'T10', nature: 'envoi_livrable', interlocuteur: 'do' },
  },
  {
    reference: 'T10-3',
    expediteur: 'stagiaire@universite-fictive.test',
    objet: 'Convention de stage',
    corps: 'Bonjour, pourriez vous me renvoyer la convention de stage signee ?',
    sens: 'entrant',
    attendu: { famille: 'T10', nature: 'demande_entrante', interlocuteur: 'stagiaire' },
  },

  // --- T11 : salons ---------------------------------------------------------
  {
    reference: 'T11-1',
    expediteur: 'inscription@salon-fictif.test',
    objet: 'Votre badge exposant',
    corps: 'Pour information, votre badge exposant est disponible au retrait a l entree du salon.',
    sens: 'entrant',
    attendu: { famille: 'T11', nature: 'information' },
  },
  {
    reference: 'T11-2',
    expediteur: 'do@masenz-fictif.test',
    objet: 'Rendez vous sur le salon',
    corps: 'Merci de preparer le planning des rendez vous sur le salon et de saisir les contacts rencontres.',
    sens: 'entrant',
    attendu: { famille: 'T11', nature: 'consigne_do', interlocuteur: 'do' },
  },
  {
    reference: 'T11-3',
    expediteur: 'elysa@azmg-solutions.test',
    objet: 'Demande d acces au stand',
    corps: 'Je vous transmets la liste des personnes a accrediter pour notre stand.',
    sens: 'sortant',
    attendu: { famille: 'T11', nature: 'envoi_livrable' },
  },

  // --- T12 : lettres d'invitation et courriers types ------------------------
  {
    reference: 'T12-1',
    expediteur: 'achat@alpha-pharma.test',
    objet: 'Lettre d invitation pour visa',
    corps: 'Pourriez vous nous etablir une lettre d invitation pour la demande de visa de notre directeur ?',
    sens: 'entrant',
    attendu: { famille: 'T12', nature: 'demande_entrante', interlocuteur: 'client' },
  },
  {
    reference: 'T12-2',
    expediteur: 'elysa@azmg-solutions.test',
    objet: 'Lettre d invitation pour signature',
    corps: 'Je te soumets la lettre d invitation redigee, pour validation et signature.',
    sens: 'sortant',
    attendu: { famille: 'T12', nature: 'demande_validation_do', interlocuteur: 'do' },
  },
  {
    reference: 'T12-3',
    expediteur: 'elysa@azmg-solutions.test',
    objet: 'Attestation transmise',
    corps: 'Veuillez trouver ci joint l attestation signee demandee la semaine derniere.',
    sens: 'sortant',
    attendu: { famille: 'T12', nature: 'envoi_livrable', interlocuteur: 'client' },
  },

  // --- T13 : transferts a la DO pour decision -------------------------------
  {
    reference: 'T13-1',
    expediteur: 'elysa@azmg-solutions.test',
    objet: 'Arbitrage sur le delai client',
    corps: 'Le client demande une remise exceptionnelle. Je te laisse trancher, je ne peux pas decider seule.',
    sens: 'sortant',
    attendu: { famille: 'T13', nature: 'demande_validation_do', interlocuteur: 'do' },
  },
  {
    reference: 'T13-2',
    expediteur: 'do@masenz-fictif.test',
    objet: 'Re : Arbitrage sur le delai client',
    corps: 'D accord pour la remise exceptionnelle, mais une seule fois.',
    sens: 'entrant',
    attendu: { famille: 'T13', nature: 'validation_do', interlocuteur: 'do' },
  },
  {
    reference: 'T13-3',
    expediteur: 'do@masenz-fictif.test',
    objet: 'Re : Changement de transitaire',
    corps: 'Je ne valide pas ce changement. On ne fait pas appel a ce transitaire cette annee.',
    sens: 'entrant',
    attendu: { famille: 'T13', nature: 'refus_do', interlocuteur: 'do' },
  },

  // --- T14 : tracking et transporteurs express ------------------------------
  {
    reference: 'T14-1',
    expediteur: 'achat@alpha-pharma.test',
    objet: 'Numero de suivi du colis',
    corps: 'Pourriez vous nous communiquer le numero de suivi du colis echantillon envoye lundi ?',
    sens: 'entrant',
    attendu: { famille: 'T14', nature: 'demande_entrante', interlocuteur: 'client' },
  },
  {
    reference: 'T14-2',
    expediteur: 'elysa@azmg-solutions.test',
    objet: 'Tracking DHL',
    corps: 'Je vous transmets le numero de suivi DHL ainsi que la date de livraison estimee.',
    sens: 'sortant',
    attendu: { famille: 'T14', nature: 'envoi_livrable', interlocuteur: 'client' },
  },
  {
    reference: 'T14-3',
    expediteur: 'operations@transit-azur.test',
    objet: 'Surestaries en cours',
    corps: 'Pour information, des surestaries courent depuis hier sur le conteneur bloque au port.',
    sens: 'entrant',
    attendu: { famille: 'T14', nature: 'information', interlocuteur: 'transitaire' },
  },

  // --- T00 : hors perimetre --------------------------------------------------
  {
    reference: 'T00-1',
    expediteur: 'news@salon-fictif.test',
    objet: 'Newsletter de novembre',
    corps: 'Decouvrez les tendances du secteur. Pour ne plus recevoir nos messages, cliquez sur se desinscrire.',
    sens: 'entrant',
    attendu: { famille: 'T00', nature: 'information' },
  },
  {
    reference: 'T00-2',
    expediteur: 'noreply@outil-fictif.test',
    objet: 'Votre mot de passe expire bientot',
    corps: 'Message automatique, ne pas repondre. Votre compte necessite une mise a jour de securite.',
    sens: 'entrant',
    attendu: { famille: 'T00', nature: 'information' },
  },
  {
    reference: 'T00-3',
    expediteur: 'design@azmg-solutions.test',
    objet: 'Maquette du nouveau visuel',
    corps: 'Voici la maquette du visuel reseaux sociaux pour la campagne marketing du mois.',
    sens: 'entrant',
    attendu: { famille: 'T00', nature: 'information' },
  },
  {
    reference: 'T00-4',
    expediteur: 'promo@fournisseur-inconnu.test',
    objet: 'Offre speciale sur nos services',
    corps: 'Profitez de notre promotion exceptionnelle. Inscrivez vous a notre webinaire gratuit.',
    sens: 'entrant',
    attendu: { famille: 'T00', nature: 'information' },
  },
  {
    reference: 'T00-5',
    expediteur: 'noreply@reseau-social.test',
    objet: 'Vous avez de nouvelles notifications',
    corps: 'Notification automatique : trois personnes ont consulte votre profil cette semaine.',
    sens: 'entrant',
    attendu: { famille: 'T00', nature: 'information' },
  },

  // --- Cas volontairement ambigus, pour que la mesure reste honnete ---------
  {
    reference: 'MIX-1',
    expediteur: 'achat@alpha-pharma.test',
    objet: 'Facture et numero de suivi',
    corps: 'Nous avons bien recu la facture. Pourriez vous nous donner le numero de suivi du colis ?',
    sens: 'entrant',
    // Le sujet dominant est la demande de suivi : la facture n'est qu'un accuse.
    attendu: { famille: 'T14', nature: 'demande_entrante', interlocuteur: 'client' },
  },
  {
    reference: 'MIX-2',
    expediteur: 'do@masenz-fictif.test',
    objet: 'Cotation Alger',
    corps: 'Ok pour le transitaire retenu, tu peux y aller.',
    sens: 'entrant',
    attendu: { famille: 'T01', nature: 'validation_do', interlocuteur: 'do' },
  },
  {
    reference: 'MIX-3',
    expediteur: 'elysa@azmg-solutions.test',
    objet: 'BL corrige',
    corps: 'Veuillez trouver ci joint le bill of lading corrige apres votre remarque sur le numero fiscal.',
    sens: 'sortant',
    attendu: { famille: 'T02', nature: 'envoi_livrable', interlocuteur: 'client' },
  },
  {
    reference: 'MIX-4',
    expediteur: 'finance@epsilon-trade.test',
    objet: 'Relance sur notre commande',
    corps: 'Nous relancons : ou en est notre commande ? Nous attendons toujours une date de depart.',
    sens: 'entrant',
    attendu: { famille: 'T04', nature: 'relance_recue', interlocuteur: 'client' },
  },
  {
    reference: 'MIX-5',
    expediteur: 'operations@transit-azur.test',
    objet: 'Documents pour le cut off',
    corps: 'Comme convenu, merci de nous faire parvenir la packing list avant le cut off de jeudi.',
    sens: 'entrant',
    // Annote « reponse du tiers » au premier jet, corrige ensuite : malgre le « comme convenu »,
    // le transitaire demande une piece, c'est donc bien une demande entrante.
    attendu: { famille: 'T01', nature: 'demande_entrante', interlocuteur: 'transitaire' },
  },
];

/** Controle de coherence du jeu : utilise par les tests. */
export const RESUME_JEU = {
  total: MAILS_ANNOTES.length,
  familles: [...new Set(MAILS_ANNOTES.map((m) => m.attendu.famille))].sort(),
  natures: [...new Set(MAILS_ANNOTES.map((m) => m.attendu.nature))].sort(),
};
