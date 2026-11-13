/**
 * Import du classeur « Suivi des demandes » tenu par le manager.
 *
 * C'est un relevé, ligne par ligne, de ce que la donneuse d'ordre demande au poste : date, heure,
 * priorite, statut, sujet, demande, action attendue, et la reference du mail d'origine. Il est
 * tenu a jour chaque jour, et l'import est donc fait pour etre rejoue : une ligne deja connue
 * n'est pas recreee, son statut et sa priorite sont mis a jour.
 *
 * La **famille metier** n'est pas dans le classeur : elle est deduite par le moteur de regles, a
 * partir du sujet, de la demande et de l'action attendue. Sous le seuil de confiance, la demande
 * part dans la file « A classer » plutot que d'etre rangee au hasard.
 */
import { and, eq } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { db, schema } from '../../db/client';
import { ErreurHttp } from '../../lib/http';
import { lireClasseur, type Onglet } from '../../lib/xlsx/lecture';
import { journaliser } from '../../lib/evenements';
import { normaliser } from '@shared/texte';
import { appliquerRegles } from '../typage/regles';
import { reglesActives } from '../typage/service';
import { lireParametres } from '../../lib/parametres';
import { changerStatut, creerDemande, type Auteur } from '../demandes/service';
import { trouverOuCreerDossier } from '../dossiers/service';
import { FUSEAU_TANA } from '@shared/heures-ouvrees';
import type { Priorite, Statut } from '@shared/constantes';

/** Colonnes du format (1 = A). */
const COL = {
  date: 1,
  heure: 2,
  priorite: 3,
  statut: 4,
  type: 5,
  sujet: 6,
  demande: 7,
  action: 8,
  responsable: 9,
  commentaire: 10,
  refMail: 11,
  lienMail: 12,
} as const;

/** Priorites du classeur. P1 est le plus urgent. */
const PRIORITES_CLASSEUR: Record<string, Priorite> = { p1: 'haute', p2: 'normale', p3: 'basse' };

/**
 * Statuts du classeur.
 *
 * « A verifier » veut dire que la reponse du poste n'a pas ete controlee dans les fils de mails :
 * du point de vue de la GPAO, la demande est en cours. Le libelle d'origine est conserve dans les
 * notes, pour ne pas perdre la nuance que le manager a voulu poser.
 */
const STATUTS_CLASSEUR: Record<string, Statut> = {
  'a traiter': 'nouveau',
  'en cours': 'en_cours',
  'a verifier': 'en_cours',
  traite: 'termine',
};

export interface LigneSuiviDemande {
  ligne: number;
  onglet: string;
  jour: string;
  heure: string | null;
  priorite: Priorite;
  statut: Statut;
  statutClasseur: string;
  type: string;
  sujet: string;
  demande: string;
  action: string;
  responsable: string;
  commentaire: string;
  refMail: string;
  lienMail: string;
}

export interface BilanSuiviDemandes {
  lignesLues: number;
  lignesIgnorees: number;
  demandesCreees: number;
  demandesMisesAJour: number;
  dossiersCrees: number;
  aClasser: number;
  anomalies: { onglet: string; ligne: number; raison: string }[];
}

function valeur(cellules: Map<number, string>, colonne: number): string {
  return (cellules.get(colonne) ?? '').trim();
}

/** Ligne d'en-tete du format : « Date » en A et « Action attendue » en H. */
function estEnTete(cellules: Map<number, string>): boolean {
  return normaliser(valeur(cellules, COL.date)) === 'date' && normaliser(valeur(cellules, COL.action)).startsWith('action');
}

/** Date du classeur : une date reelle, ou un texte `JJ/MM/AAAA`. */
export function lireDateCellule(texte: string): string | null {
  const brut = texte.trim();
  if (!brut) return null;
  const jjmmaaaa = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(brut);
  if (jjmmaaaa) {
    const d = DateTime.fromObject({ day: Number(jjmmaaaa[1]), month: Number(jjmmaaaa[2]), year: Number(jjmmaaaa[3]) });
    return d.isValid ? d.toISODate() : null;
  }
  const iso = DateTime.fromISO(brut.slice(0, 10));
  return iso.isValid ? iso.toISODate() : null;
}

/**
 * Heure du classeur, `HH:MM`, `HH:MM:SS`, ou une fraction de journee.
 *
 * Un tableur range une heure comme une fraction de journee : 9 h 25 s'ecrit 0,39236. C'est sous
 * cette forme que la cellule arrive quand le manager saisit une vraie heure plutot qu'un texte.
 */
export function lireHeureCellule(texte: string): string | null {
  const brut = texte.trim();
  if (!brut) return null;

  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(brut);
  if (m) {
    const h = Number(m[1]);
    const min = Number(m[2]);
    return h > 23 || min > 59 ? null : `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }

  const fraction = Number(brut);
  if (!Number.isFinite(fraction) || fraction < 0 || fraction >= 1) return null;
  // Arrondi a la minute : la fraction porte des decimales qui ne veulent rien dire ici.
  const minutes = Math.round(fraction * 24 * 60);
  const h = Math.floor(minutes / 60) % 24;
  return `${String(h).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** Lit les lignes de donnees d'un onglet au format « Suivi des demandes ». */
export function lireOngletSuivi(onglet: Onglet): { lignes: LigneSuiviDemande[]; anomalies: { onglet: string; ligne: number; raison: string }[] } {
  const lignes: LigneSuiviDemande[] = [];
  const anomalies: { onglet: string; ligne: number; raison: string }[] = [];
  let enTeteVue = false;

  for (let numero = 1; numero <= onglet.derniereLigne; numero++) {
    const cellules = new Map<number, string>();
    for (const c of onglet.lignes.get(numero) ?? []) cellules.set(c.colonne, c.texte);
    if (cellules.size === 0) continue;

    if (estEnTete(cellules)) {
      enTeteVue = true;
      continue;
    }
    if (!enTeteVue) continue; // titre et compteurs au-dessus de l'en-tete

    const jour = lireDateCellule(valeur(cellules, COL.date));
    const sujet = valeur(cellules, COL.sujet);
    const action = valeur(cellules, COL.action);
    if (!jour && !sujet && !action) continue; // ligne vide

    if (!jour) {
      anomalies.push({ onglet: onglet.nom, ligne: numero, raison: 'date illisible' });
      continue;
    }
    if (!sujet) {
      anomalies.push({ onglet: onglet.nom, ligne: numero, raison: 'sujet ou dossier absent' });
      continue;
    }

    const statutClasseur = valeur(cellules, COL.statut);
    const statut = STATUTS_CLASSEUR[normaliser(statutClasseur)];
    if (!statut) {
      anomalies.push({ onglet: onglet.nom, ligne: numero, raison: `statut inconnu : « ${statutClasseur || 'vide'} »` });
      continue;
    }

    lignes.push({
      ligne: numero,
      onglet: onglet.nom,
      jour,
      heure: lireHeureCellule(valeur(cellules, COL.heure)),
      priorite: PRIORITES_CLASSEUR[normaliser(valeur(cellules, COL.priorite))] ?? 'normale',
      statut,
      statutClasseur,
      type: valeur(cellules, COL.type),
      sujet,
      demande: valeur(cellules, COL.demande),
      action: action || sujet,
      responsable: valeur(cellules, COL.responsable),
      commentaire: valeur(cellules, COL.commentaire),
      refMail: valeur(cellules, COL.refMail),
      lienMail: valeur(cellules, COL.lienMail),
    });
  }

  return { lignes, anomalies };
}

/**
 * Identifiant stable d'une ligne, qui sert au dedoublonnage entre deux imports.
 *
 * La reference du mail est preferee : c'est la meme que celle de la collecte automatique, donc une
 * ligne et le mail qui l'a provoquee ne font qu'un evenement. A defaut, une cle construite sur le
 * compte, l'onglet, le jour et le sujet, qui ne bouge pas tant que le manager ne reecrit pas la
 * ligne.
 */
export function cleLigne(ligne: LigneSuiviDemande, compteId: number): string {
  if (ligne.refMail) return `<${ligne.refMail}@mail.gmail.com>`;
  return `<suivi-${compteId}-${normaliser(ligne.onglet).replace(/\s+/g, '-')}-${ligne.jour}-${normaliser(ligne.sujet).replace(/\s+/g, '-').slice(0, 80)}@azmg-gpao>`;
}

/** Instant d'ouverture, en UTC, a partir du jour et de l'heure du classeur (heure d'Antananarivo). */
export function instantLigne(ligne: LigneSuiviDemande): Date {
  const heure = ligne.heure ?? '09:00';
  return DateTime.fromISO(`${ligne.jour}T${heure}`, { zone: FUSEAU_TANA }).toUTC().toJSDate();
}

/** Poste concerne : le nom de l'onglet, puis le premier mot de la colonne « Responsable AZMG ». */
export function nomPosteDeLigne(ligne: LigneSuiviDemande): string[] {
  const premierMot = ligne.responsable.split(/[(,]/)[0].trim();
  return [ligne.onglet, premierMot].filter(Boolean);
}

/**
 * Importe un classeur « Suivi des demandes ».
 *
 * Rejouable : une ligne deja connue n'est pas recreee. Son statut et sa priorite sont repris du
 * classeur s'ils ont change, avec une transition horodatee, parce que le manager tient ce fichier
 * a jour et que c'est lui qui fait foi sur l'avancement.
 */
export async function importerSuiviDemandes(
  buffer: Buffer,
  opts: { compteId: number; nomFichier: string },
  auteur: Auteur,
): Promise<BilanSuiviDemandes> {
  let classeur;
  try {
    classeur = lireClasseur(buffer);
  } catch (e) {
    throw new ErreurHttp(400, `Classeur illisible : ${e instanceof Error ? e.message : String(e)}`);
  }

  const bilan: BilanSuiviDemandes = {
    lignesLues: 0,
    lignesIgnorees: 0,
    demandesCreees: 0,
    demandesMisesAJour: 0,
    dossiersCrees: 0,
    aClasser: 0,
    anomalies: [],
  };

  const toutes: LigneSuiviDemande[] = [];
  for (const onglet of classeur.onglets) {
    const { lignes, anomalies } = lireOngletSuivi(onglet);
    toutes.push(...lignes);
    bilan.anomalies.push(...anomalies);
  }
  bilan.lignesIgnorees = bilan.anomalies.length;
  if (!toutes.length) {
    throw new ErreurHttp(
      400,
      'Aucune ligne au format « Suivi des demandes ». L’en-tete attendue porte « Date » en colonne A et « Action attendue » en colonne H.',
    );
  }

  const postes = await db
    .select({ id: schema.postes.id, intitule: schema.postes.intitule, collaborateur: schema.utilisateurs.nom })
    .from(schema.postes)
    .leftJoin(schema.utilisateurs, eq(schema.utilisateurs.id, schema.postes.collaborateurId))
    .where(and(eq(schema.postes.compteId, opts.compteId), eq(schema.postes.actif, true)));

  /** Poste dont l'intitule ou le collaborateur porte l'un des noms donnes. */
  const posteDe = (noms: string[]): number | null => {
    for (const nom of noms.map(normaliser).filter(Boolean)) {
      const trouve = postes.find((p) => normaliser(p.intitule).includes(nom) || normaliser(p.collaborateur ?? '').includes(nom));
      if (trouve) return trouve.id;
    }
    return null;
  };

  const regles = await reglesActives(opts.compteId);
  const seuil = (await lireParametres()).seuilConfianceTypage;

  for (const ligne of toutes) {
    bilan.lignesLues++;
    try {
      const cle = cleLigne(ligne, opts.compteId);
      const [connu] = await db
        .select({ id: schema.evenements.id, demandeId: schema.evenements.demandeId })
        .from(schema.evenements)
        .where(eq(schema.evenements.messageId, cle));

      if (connu?.demandeId) {
        // Ligne deja importee : seul l'avancement peut avoir bouge.
        const [demande] = await db.select().from(schema.demandes).where(eq(schema.demandes.id, connu.demandeId));
        if (demande && (demande.statut !== ligne.statut || demande.priorite !== ligne.priorite)) {
          if (demande.priorite !== ligne.priorite) {
            await db.update(schema.demandes).set({ priorite: ligne.priorite, majLe: new Date() }).where(eq(schema.demandes.id, demande.id));
          }
          if (demande.statut !== ligne.statut) {
            await changerStatut(demande.id, ligne.statut, auteur, {
              motif: `suivi du manager : « ${ligne.statutClasseur} »`,
              survenuLe: instantLigne(ligne),
            });
          }
          bilan.demandesMisesAJour++;
        }
        continue;
      }

      // Famille deduite du contenu : le classeur ne la porte pas.
      const texte = [ligne.sujet, ligne.demande, ligne.action].filter(Boolean).join('. ');
      const typage = appliquerRegles({ objet: ligne.sujet, corps: texte, sens: 'entrant' }, regles);
      const applicable = Boolean(typage && typage.typage.famille && typage.typage.confiance >= seuil);
      if (!applicable) bilan.aClasser++;

      const { dossier, cree } = await trouverOuCreerDossier(
        { compteId: opts.compteId, posteId: posteDe(nomPosteDeLigne(ligne)), client: ligne.sujet, produit: null, operation: null },
        auteur,
      );
      if (cree) bilan.dossiersCrees++;

      const demande = await creerDemande(
        {
          dossierId: dossier.id,
          famille: applicable ? typage!.typage.famille! : 'T13',
          objet: ligne.action,
          origine: 'import',
          priorite: ligne.priorite,
          ouverteLe: instantLigne(ligne),
          notes: [
            ligne.demande && `Demande de la donneuse d’ordre : ${ligne.demande}`,
            ligne.type && `Type au suivi : ${ligne.type}`,
            ligne.statutClasseur && `Statut au suivi : ${ligne.statutClasseur}`,
            ligne.commentaire && `Commentaire de suivi : ${ligne.commentaire}`,
            ligne.lienMail && `Mail : ${ligne.lienMail}`,
          ]
            .filter(Boolean)
            .join('\n'),
        },
        auteur,
      );
      bilan.demandesCreees++;

      // L'evenement porte la cle de dedoublonnage : c'est lui qui rend l'import rejouable.
      await db.insert(schema.evenements).values({
        compteId: opts.compteId,
        dossierId: dossier.id,
        demandeId: demande.id,
        sens: 'entrant',
        nature: 'demande_entrante',
        famille: applicable ? typage!.typage.famille : null,
        interlocuteur: 'do',
        source: 'import',
        messageId: cle,
        filId: cle,
        survenuLe: instantLigne(ligne),
        objet: ligne.sujet,
        resume: (ligne.demande || ligne.action).slice(0, 500),
        contenu: texte.slice(0, 50_000),
        confianceTypage: typage?.typage.confiance ?? null,
        justificatifs: typage?.typage.justificatifs ?? [],
      });

      if (ligne.statut !== 'nouveau') {
        await changerStatut(demande.id, ligne.statut, auteur, {
          motif: `suivi du manager : « ${ligne.statutClasseur} »`,
          survenuLe: instantLigne(ligne),
        });
      }
    } catch (e) {
      bilan.anomalies.push({ onglet: ligne.onglet, ligne: ligne.ligne, raison: e instanceof Error ? e.message.slice(0, 200) : String(e) });
      bilan.lignesIgnorees++;
    }
  }

  await journaliser('import_suivi_demandes', {
    utilisateurId: auteur.utilisateurId,
    auteurType: auteur.type,
    entite: 'compte',
    entiteId: opts.compteId,
    details: { fichier: opts.nomFichier, ...bilan, anomalies: bilan.anomalies.length },
  });
  return bilan;
}
