/**
 * Digest de validation pour la donneuse d'ordre (section 8.9 de CLAUDE.md).
 *
 * Regle d'or respectee ici : **l'IA prepare, l'humain envoie**. Ce module produit un
 * brouillon, jamais un envoi. Rien ne part automatiquement vers la DO.
 *
 * Le digest regroupe toutes les decisions attendues de la DO, une ligne par decision, avec le
 * temps d'attente de chacune et les elements necessaires a la decision (references, montants,
 * echeances du dossier). Les appreciations du client sur le collaborateur n'y figurent jamais :
 * on decrit l'etat factuel du dossier et l'action qui debloque.
 */
import { and, asc, eq, inArray, lte, sql, type SQL } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { db, schema } from '../../db/client';
import { horairesDuCompte, lireParametres } from '../../lib/parametres';
import { tempsDemandeAvecHoraires, type Demande } from '../demandes/service';
import { retirerTiretsLongs } from '@shared/tirets';
import { formaterDuree, type HorairesOuvres } from '@shared/heures-ouvrees';
import { FAMILLE_HORS_PERIMETRE, famille as familleRef, LIBELLES_ECHEANCES, type TypeEcheance } from '@shared/constantes';

export interface LigneDigest {
  demandeId: number;
  dossierId: number;
  dossier: string;
  client: string;
  famille: string;
  objet: string;
  /** Ce que la DO doit decider, formule en une ligne orientee decision. */
  decisionAttendue: string;
  minutesAttente: number;
  attenteLisible: string;
  /** Depasse le seuil d'attente des parametres. */
  urgent: boolean;
  /** Elements utiles a la decision, repris du dossier sans rien inventer. */
  elements: { libelle: string; valeur: string }[];
  /** Resume du dernier evenement sortant, qui porte la demande de validation. */
  derniereDemande: string | null;
}

export interface Digest {
  compteId: number;
  compte: string;
  donneurOrdre: string | null;
  genereLe: string;
  /** Moment de la journee : le digest est prepare deux fois par jour. */
  moment: 'matin' | 'apres-midi';
  lignes: LigneDigest[];
  /** Texte pret a relire puis a envoyer. Aucun envoi automatique. */
  brouillon: string;
}

/** Formule la decision attendue a partir de la famille, sans inventer de contenu. */
function decisionAttendue(famille: string, objet: string): string {
  const validation = familleRef(famille)?.validation ?? '';
  switch (famille) {
    case 'T01':
      return `Valider le transitaire et le prix : ${objet}`;
    case 'T02':
      return `Trancher l'exception sur l'expedition : ${objet}`;
    case 'T03':
      return `Valider la modification de la facture ou de la proforma : ${objet}`;
    case 'T05':
      return `Valider la demarche reglementaire : ${objet}`;
    case 'T06':
      return `Valider le tableau de situation : ${objet}`;
    case 'T08':
      return `Valider le prix et le MOQ : ${objet}`;
    case 'T12':
      return `Signer le courrier : ${objet}`;
    case 'T13':
      return `Decider : ${objet}`;
    default:
      return validation ? `${objet} (validation : ${validation})` : objet;
  }
}

/** Elements de decision repris du dossier : references et montants deja approuves, echeances. */
function elementsDeDecision(
  references: Record<string, unknown>,
  montants: Record<string, unknown>,
  echeances: { type: string; libelle: string | null; echeanceLe: Date }[],
): { libelle: string; valeur: string }[] {
  const sortie: { libelle: string; valeur: string }[] = [];
  for (const [cle, valeur] of Object.entries(references ?? {})) {
    if (valeur !== null && valeur !== undefined && String(valeur).trim()) sortie.push({ libelle: cle, valeur: String(valeur) });
  }
  for (const [cle, valeur] of Object.entries(montants ?? {})) {
    if (valeur !== null && valeur !== undefined && String(valeur).trim()) sortie.push({ libelle: `montant approuve ${cle}`, valeur: String(valeur) });
  }
  for (const e of echeances) {
    sortie.push({
      libelle: e.libelle || LIBELLES_ECHEANCES[e.type as TypeEcheance] || e.type,
      valeur: DateTime.fromJSDate(e.echeanceLe).setLocale('fr').toFormat('dd/MM/yyyy'),
    });
  }
  return sortie;
}

/**
 * Construit le digest d'un compte. `moment` sert seulement a dater le brouillon : le contenu
 * est toujours l'etat courant des validations attendues.
 */
export async function construireDigest(compteId: number, maintenant = new Date()): Promise<Digest> {
  const [compte] = await db.select().from(schema.comptesClients).where(eq(schema.comptesClients.id, compteId));
  if (!compte) throw new Error(`Compte client ${compteId} introuvable`);
  const parametres = await lireParametres();
  const seuilMinutes = parametres.sla.attenteDoHeures * 60;

  const conditions: SQL[] = [
    eq(schema.demandes.compteId, compteId),
    eq(schema.demandes.statut, 'attente_do'),
    sql`${schema.demandes.famille} <> ${FAMILLE_HORS_PERIMETRE}`,
  ];
  const lignesBrutes = await db
    .select({ demande: schema.demandes, dossier: schema.dossiers })
    .from(schema.demandes)
    .innerJoin(schema.dossiers, eq(schema.dossiers.id, schema.demandes.dossierId))
    .where(and(...conditions))
    .orderBy(asc(schema.demandes.ouverteLe));

  const horaires: HorairesOuvres = await horairesDuCompte(compteId);
  const debuts = await debutsDeStatut(lignesBrutes.map((l) => l.demande));
  const dossierIds = [...new Set(lignesBrutes.map((l) => l.dossier.id))];
  const echeances = dossierIds.length
    ? await db
        .select()
        .from(schema.echeances)
        .where(
          and(
            inArray(schema.echeances.dossierId, dossierIds),
            eq(schema.echeances.annulee, false),
            sql`${schema.echeances.honoreeLe} IS NULL`,
            lte(schema.echeances.echeanceLe, new Date(maintenant.getTime() + 30 * 86_400_000)),
          ),
        )
        .orderBy(asc(schema.echeances.echeanceLe))
    : [];
  const echeancesParDossier = new Map<number, typeof echeances>();
  for (const e of echeances) {
    const liste = echeancesParDossier.get(e.dossierId) ?? [];
    liste.push(e);
    echeancesParDossier.set(e.dossierId, liste);
  }

  // Dernier evenement sortant de chaque demande : c'est lui qui porte la demande de validation.
  const demandeIds = lignesBrutes.map((l) => l.demande.id);
  const derniers = demandeIds.length
    ? await db
        .select({ demandeId: schema.evenements.demandeId, resume: schema.evenements.resume, survenuLe: schema.evenements.survenuLe })
        .from(schema.evenements)
        .where(and(inArray(schema.evenements.demandeId, demandeIds), eq(schema.evenements.nature, 'demande_validation_do')))
        .orderBy(asc(schema.evenements.survenuLe))
    : [];
  const derniereParDemande = new Map<number, string | null>();
  for (const d of derniers) if (d.demandeId !== null) derniereParDemande.set(d.demandeId, d.resume);

  const lignes: LigneDigest[] = lignesBrutes.map((l) => {
    const temps = tempsDemandeAvecHoraires(l.demande, debuts.get(l.demande.id) ?? l.demande.ouverteLe, horaires, maintenant);
    return {
      demandeId: l.demande.id,
      dossierId: l.dossier.id,
      dossier: l.dossier.libelle,
      client: l.dossier.client,
      famille: l.demande.famille,
      objet: l.demande.objet,
      decisionAttendue: decisionAttendue(l.demande.famille, l.demande.objet),
      minutesAttente: temps.statutCourant,
      attenteLisible: formaterDuree(temps.statutCourant),
      urgent: temps.statutCourant >= seuilMinutes,
      elements: elementsDeDecision(
        (l.dossier.references as Record<string, unknown>) ?? {},
        (l.dossier.montantsApprouves as Record<string, unknown>) ?? {},
        echeancesParDossier.get(l.dossier.id) ?? [],
      ),
      derniereDemande: derniereParDemande.get(l.demande.id) ?? null,
    };
  });

  lignes.sort((a, b) => b.minutesAttente - a.minutesAttente);

  const dt = DateTime.fromJSDate(maintenant).setLocale('fr');
  const moment: 'matin' | 'apres-midi' = dt.hour < 13 ? 'matin' : 'apres-midi';

  return {
    compteId,
    compte: compte.nom,
    donneurOrdre: compte.donneurOrdreNom,
    genereLe: maintenant.toISOString(),
    moment,
    lignes,
    brouillon: redigerBrouillon({ compte: compte.nom, donneurOrdre: compte.donneurOrdreNom, lignes, dt }),
  };
}

/**
 * Brouillon texte, une ligne par decision. Passe par le filtre « aucun tiret long » comme toute
 * sortie destinee a un humain.
 */
function redigerBrouillon(donnees: { compte: string; donneurOrdre: string | null; lignes: LigneDigest[]; dt: DateTime }): string {
  const { donneurOrdre, lignes, dt } = donnees;
  const date = dt.toFormat('cccc d LLLL yyyy');
  const entete = `Bonjour${donneurOrdre ? ` ${donneurOrdre}` : ''},`;

  if (!lignes.length) {
    return retirerTiretsLongs(
      [entete, '', `Point du ${date} : aucune decision n'est en attente de votre part a cette heure.`, '', 'Bien cordialement,'].join('\n'),
    );
  }

  const corps = lignes.map((l, i) => {
    const morceaux = [`${i + 1}. ${l.decisionAttendue}`];
    morceaux.push(`   Dossier : ${l.dossier}`);
    morceaux.push(`   En attente depuis : ${l.attenteLisible} (heures ouvrees)${l.urgent ? ', au-dela du delai habituel' : ''}`);
    if (l.derniereDemande) morceaux.push(`   Point de situation : ${l.derniereDemande}`);
    if (l.elements.length) morceaux.push(`   Elements : ${l.elements.map((e) => `${e.libelle} ${e.valeur}`).join(' ; ')}`);
    return morceaux.join('\n');
  });

  const urgentes = lignes.filter((l) => l.urgent).length;
  const resume =
    lignes.length === 1
      ? 'Une decision attend votre retour.'
      : `${lignes.length} decisions attendent votre retour${urgentes ? `, dont ${urgentes} depuis plus longtemps que d'habitude` : ''}.`;

  return retirerTiretsLongs(
    [entete, '', `Point du ${date}. ${resume}`, '', ...corps, '', 'Merci de votre retour.', 'Bien cordialement,'].join('\n'),
  );
}

async function debutsDeStatut(demandes: Demande[]): Promise<Map<number, Date>> {
  if (!demandes.length) return new Map();
  const lignes = await db
    .select({ demandeId: schema.transitionsStatut.demandeId, debut: sql<Date>`max(${schema.transitionsStatut.survenuLe})`.as('debut') })
    .from(schema.transitionsStatut)
    .where(inArray(schema.transitionsStatut.demandeId, demandes.map((d) => d.id)))
    .groupBy(schema.transitionsStatut.demandeId);
  return new Map(lignes.map((l) => [l.demandeId, new Date(l.debut)]));
}
