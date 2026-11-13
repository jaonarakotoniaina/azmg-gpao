/**
 * Pilotage de l'accompagnement d'un collaborateur, semaine par semaine.
 *
 * Repond a une question precise : **est-ce que ca s'ameliore ?** Un releve de reprises dit
 * seulement combien il y en a eu. Ce qui permet de decider, c'est la pente entre deux semaines,
 * la part de reprises qui reviennent sur le meme dossier ou la meme cause, et le temps qu'il faut
 * pour cloturer.
 *
 * Les delais sont comptes en heures ouvrees du client : trois jours calendaires dont un week-end
 * ne sont pas trois jours de travail, et confondre les deux fausserait le jugement porte sur
 * quelqu'un.
 */
import { and, asc, eq, gte, inArray, lt, sql, type SQL } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { db, schema } from '../../db/client';
import { horairesDuCompte } from '../../lib/parametres';
import { tempsDemandeAvecHoraires, type Demande } from '../demandes/service';
import { minutesOuvrees, type HorairesOuvres } from '@shared/heures-ouvrees';
import { FAMILLE_HORS_PERIMETRE, LIBELLES_CAUSES, type Cause } from '@shared/constantes';

export interface SemaineAccompagnement {
  /** Lundi de la semaine, en AAAA-MM-JJ. */
  debut: string;
  /** Numero de semaine ISO, pour le libelle. */
  semaine: number;
  demandesOuvertes: number;
  reprises: number;
  /** Reprises qui tombent sur un dossier ou une cause deja vus avant cette semaine. */
  recidives: number;
  tauxRecidive: number | null;
  /** Delai median de cloture, en heures ouvrees du client. */
  delaiMedianHeures: number | null;
  /** Demandes prioritaires encore ouvertes au-dela de leur echeance SLA. */
  p1EnRetard: number;
}

export interface Accompagnement {
  posteId: number;
  poste: string;
  collaborateur: string | null;
  periode: { debut: string; fin: string };
  semaines: SemaineAccompagnement[];
  /** Causes des reprises sur toute la periode, de la plus frequente a la moins frequente. */
  causes: { cause: Cause | null; libelle: string; nombre: number }[];
  /** Dossiers sur lesquels la donneuse d'ordre a du revenir plusieurs fois. */
  dossiersRepetes: { dossierId: number; libelle: string; reprises: number }[];
  /** Retours positifs recus sur la periode : validations de la DO sans correction. */
  retoursPositifs: number;
  total: { demandesOuvertes: number; reprises: number; recidives: number; delaiMedianHeures: number | null };
}

function mediane(valeurs: number[]): number | null {
  if (!valeurs.length) return null;
  const tries = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(tries.length / 2);
  return tries.length % 2 ? tries[milieu] : (tries[milieu - 1] + tries[milieu]) / 2;
}

/** Lundi de la semaine qui contient `jour`. */
function lundi(jour: DateTime): DateTime {
  return jour.startOf('week');
}

export async function accompagnement(
  posteId: number,
  periode: { debut: Date; fin: Date },
  maintenant = new Date(),
): Promise<Accompagnement> {
  const [poste] = await db
    .select({
      id: schema.postes.id,
      compteId: schema.postes.compteId,
      intitule: schema.postes.intitule,
      collaborateur: schema.utilisateurs.nom,
    })
    .from(schema.postes)
    .leftJoin(schema.utilisateurs, eq(schema.utilisateurs.id, schema.postes.collaborateurId))
    .where(eq(schema.postes.id, posteId));
  if (!poste) throw new Error('Poste introuvable');

  const horaires: HorairesOuvres = await horairesDuCompte(poste.compteId);

  const conditions: SQL[] = [
    eq(schema.demandes.posteId, posteId),
    sql`${schema.demandes.famille} <> ${FAMILLE_HORS_PERIMETRE}`,
    gte(schema.demandes.ouverteLe, periode.debut),
    lt(schema.demandes.ouverteLe, periode.fin),
  ];
  const demandes = await db
    .select({ demande: schema.demandes, dossier: schema.dossiers.libelle })
    .from(schema.demandes)
    .innerJoin(schema.dossiers, eq(schema.dossiers.id, schema.demandes.dossierId))
    .where(and(...conditions))
    .orderBy(asc(schema.demandes.ouverteLe));

  const debuts = await debutsDeStatut(demandes.map((l) => l.demande));

  // Une reprise est une recidive si son dossier ou sa cause est deja apparu plus tot.
  const dossiersVus = new Set<number>();
  const causesVues = new Set<string>();
  const parSemaine = new Map<string, SemaineAccompagnement>();
  const parCause = new Map<string, number>();
  const parDossier = new Map<number, { libelle: string; reprises: number }>();
  const delaisPeriode: number[] = [];

  for (const { demande, dossier } of demandes) {
    const cle = lundi(DateTime.fromJSDate(demande.ouverteLe)).toISODate()!;
    const semaine =
      parSemaine.get(cle) ??
      {
        debut: cle,
        semaine: DateTime.fromISO(cle).weekNumber,
        demandesOuvertes: 0,
        reprises: 0,
        recidives: 0,
        tauxRecidive: null,
        delaiMedianHeures: null,
        p1EnRetard: 0,
      };
    parSemaine.set(cle, semaine);
    semaine.demandesOuvertes++;

    if (demande.reprise) {
      semaine.reprises++;
      const dejaVu = dossiersVus.has(demande.dossierId) || (demande.cause !== null && causesVues.has(demande.cause));
      if (dejaVu) semaine.recidives++;
      dossiersVus.add(demande.dossierId);
      if (demande.cause) causesVues.add(demande.cause);

      const cause = demande.cause ?? 'inconnue';
      parCause.set(cause, (parCause.get(cause) ?? 0) + 1);
      const suivi = parDossier.get(demande.dossierId) ?? { libelle: dossier, reprises: 0 };
      suivi.reprises++;
      parDossier.set(demande.dossierId, suivi);
    }

    if (demande.termineeLe) {
      const heures = minutesOuvrees(horaires, demande.ouverteLe, demande.termineeLe) / 60;
      delaisPeriode.push(heures);
      const delaisSemaine = (semaine as SemaineAccompagnement & { _delais?: number[] })._delais ?? [];
      delaisSemaine.push(heures);
      (semaine as SemaineAccompagnement & { _delais?: number[] })._delais = delaisSemaine;
    } else if (demande.priorite === 'haute' || demande.priorite === 'critique') {
      const temps = tempsDemandeAvecHoraires(demande, debuts.get(demande.id) ?? demande.ouverteLe, horaires, maintenant);
      const depasse = demande.slaHeures !== null && temps.total / 60 > demande.slaHeures;
      if (depasse) semaine.p1EnRetard++;
    }
  }

  const semaines = [...parSemaine.values()]
    .sort((a, b) => a.debut.localeCompare(b.debut))
    .map((s) => {
      const delais = (s as SemaineAccompagnement & { _delais?: number[] })._delais ?? [];
      delete (s as SemaineAccompagnement & { _delais?: number[] })._delais;
      return {
        ...s,
        tauxRecidive: s.reprises ? Math.round((s.recidives / s.reprises) * 100) / 100 : null,
        delaiMedianHeures: mediane(delais),
      };
    });

  const retoursPositifs = await compterRetoursPositifs(posteId, periode);

  return {
    posteId,
    poste: poste.intitule,
    collaborateur: poste.collaborateur,
    periode: { debut: periode.debut.toISOString(), fin: periode.fin.toISOString() },
    semaines,
    causes: [...parCause.entries()]
      .map(([cause, nombre]) => ({
        cause: cause === 'inconnue' ? null : (cause as Cause),
        libelle: cause === 'inconnue' ? 'Cause non renseignee' : LIBELLES_CAUSES[cause as Cause],
        nombre,
      }))
      .sort((a, b) => b.nombre - a.nombre),
    dossiersRepetes: [...parDossier.entries()]
      .filter(([, d]) => d.reprises > 1)
      .map(([dossierId, d]) => ({ dossierId, libelle: d.libelle, reprises: d.reprises }))
      .sort((a, b) => b.reprises - a.reprises),
    retoursPositifs,
    total: {
      demandesOuvertes: demandes.length,
      reprises: semaines.reduce((s, x) => s + x.reprises, 0),
      recidives: semaines.reduce((s, x) => s + x.recidives, 0),
      delaiMedianHeures: mediane(delaisPeriode),
    },
  };
}

/**
 * Retours positifs recus par le poste sur la periode.
 *
 * Un releve qui ne porte que des reproches donne une image fausse, et ne tient ni devant le client
 * ni devant le collaborateur. Les validations de la donneuse d'ordre sont deja enregistrees : il
 * suffit de les compter.
 */
async function compterRetoursPositifs(posteId: number, periode: { debut: Date; fin: Date }): Promise<number> {
  const [ligne] = await db
    .select({ nombre: sql<number>`count(*)::int` })
    .from(schema.evenements)
    .innerJoin(schema.demandes, eq(schema.demandes.id, schema.evenements.demandeId))
    .where(
      and(
        eq(schema.demandes.posteId, posteId),
        eq(schema.evenements.nature, 'validation_do'),
        gte(schema.evenements.survenuLe, periode.debut),
        lt(schema.evenements.survenuLe, periode.fin),
      ),
    );
  return ligne?.nombre ?? 0;
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
