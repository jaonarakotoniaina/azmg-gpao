/**
 * Calcul des delais en heures ouvrees du client (section 5 de CLAUDE.md).
 *
 * Stockage en UTC, affichage a Antananarivo, mais les delais et les SLA se comptent dans
 * les heures ouvrees du client (Barcelone par defaut), avec un calendrier de feries parametrable.
 *
 * Regle du compte Masenz Group :
 *   - ferie commun a l'Espagne et a Madagascar : non travaille ;
 *   - ferie propre a l'Espagne : non travaille ;
 *   - ferie propre a Madagascar : travaille.
 * Autrement dit, le calendrier non travaille est celui du client. La regle reste parametrable
 * (`feriesCollaborateur`) pour un futur compte ou l'on voudrait aussi chomer les feries locaux.
 */
import { DateTime } from 'luxon';

export const FUSEAU_TANA = 'Indian/Antananarivo';
export const FUSEAU_CLIENT_DEFAUT = 'Europe/Madrid';

/** Une plage horaire d'une journee de travail, en heure locale du client. */
export interface Plage {
  debut: string; // HH:MM
  fin: string; // HH:MM
}

export interface HorairesOuvres {
  fuseau: string;
  /** Plages par jour de la semaine ISO (1 = lundi ... 7 = dimanche). Jour absent ou vide : non travaille. */
  semaine: Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7, Plage[]>>;
  /** Feries du pays du client (AAAA-MM-JJ), non travailles. */
  feriesClient: string[];
  /** Feries du pays du collaborateur. Chomes seulement si `feriesCollaborateur` est vrai. */
  feriesLocaux: string[];
  /** Regle du compte : les feries propres au pays du collaborateur sont-ils chomes ? */
  feriesCollaborateur: boolean;
}

export const HORAIRES_PAR_DEFAUT: HorairesOuvres = {
  fuseau: FUSEAU_CLIENT_DEFAUT,
  semaine: {
    1: [{ debut: '09:00', fin: '18:00' }],
    2: [{ debut: '09:00', fin: '18:00' }],
    3: [{ debut: '09:00', fin: '18:00' }],
    4: [{ debut: '09:00', fin: '18:00' }],
    5: [{ debut: '09:00', fin: '18:00' }],
  },
  feriesClient: [],
  feriesLocaux: [],
  feriesCollaborateur: false,
};

// ---------------------------------------------------------------------------
// Calendriers de jours feries
// ---------------------------------------------------------------------------

/** Dimanche de Paques (algorithme de Meeus), dans le fuseau demande. */
export function paques(annee: number, fuseau: string): DateTime {
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31);
  const jour = ((h + l - 7 * m + 114) % 31) + 1;
  return DateTime.fromObject({ year: annee, month: mois, day: jour }, { zone: fuseau });
}

/** Feries nationaux d'Espagne (socle commun, hors feries de communaute autonome). */
export function joursFeriesEspagne(annee: number): string[] {
  const fixes = ['01-01', '01-06', '05-01', '08-15', '10-12', '11-01', '12-06', '12-08', '12-25'].map((j) => `${annee}-${j}`);
  const p = paques(annee, FUSEAU_CLIENT_DEFAUT);
  // Vendredi saint (2 jours avant Paques), seul ferie mobile national.
  const mobiles = [p.minus({ days: 2 }).toISODate()!];
  return [...fixes, ...mobiles].sort();
}

/** Feries legaux de Madagascar. */
export function joursFeriesMadagascar(annee: number): string[] {
  const fixes = ['01-01', '03-29', '05-01', '06-26', '08-15', '11-01', '12-25'].map((j) => `${annee}-${j}`);
  const p = paques(annee, FUSEAU_TANA);
  // Lundi de Paques, Ascension, lundi de Pentecote.
  const mobiles = [1, 39, 50].map((n) => p.plus({ days: n }).toISODate()!);
  return [...fixes, ...mobiles].sort();
}

/** Horaires par defaut d'un compte, avec les feries des deux pays pre-remplis sur une plage d'annees. */
export function horairesCompteParDefaut(anneeDebut: number, nombreAnnees = 3): HorairesOuvres {
  const annees = Array.from({ length: nombreAnnees }, (_, i) => anneeDebut + i);
  return {
    ...HORAIRES_PAR_DEFAUT,
    feriesClient: annees.flatMap(joursFeriesEspagne),
    feriesLocaux: annees.flatMap(joursFeriesMadagascar),
  };
}

// ---------------------------------------------------------------------------
// Jours et plages ouvres
// ---------------------------------------------------------------------------

function jourNonTravaille(h: HorairesOuvres, iso: string): boolean {
  if (h.feriesClient.includes(iso)) return true;
  return h.feriesCollaborateur && h.feriesLocaux.includes(iso);
}

/** Plages de travail d'une journee donnee, en heure locale du client (vide si jour non travaille). */
export function plagesDuJour(h: HorairesOuvres, jour: DateTime): Plage[] {
  const j = jour.setZone(h.fuseau).startOf('day');
  const iso = j.toISODate()!;
  if (jourNonTravaille(h, iso)) return [];
  return h.semaine[j.weekday as 1 | 2 | 3 | 4 | 5 | 6 | 7] ?? [];
}

export function estJourOuvre(h: HorairesOuvres, jour: Date | DateTime): boolean {
  const dt = jour instanceof Date ? DateTime.fromJSDate(jour) : jour;
  return plagesDuJour(h, dt).length > 0;
}

function bornes(h: HorairesOuvres, jour: DateTime, plage: Plage): { debut: DateTime; fin: DateTime } | null {
  const [hd, md] = plage.debut.split(':').map(Number);
  const [hf, mf] = plage.fin.split(':').map(Number);
  const base = jour.setZone(h.fuseau).startOf('day');
  const debut = base.set({ hour: hd, minute: md });
  const fin = base.set({ hour: hf, minute: mf });
  return fin > debut ? { debut, fin } : null;
}

/** Garde-fou : un calcul ne balaie jamais plus de 10 ans de calendrier. */
const JOURS_MAX = 3660;

/**
 * Minutes ouvrees ecoulees entre deux instants, selon les horaires du client.
 * Renvoie 0 si `fin` precede `debut`.
 */
export function minutesOuvrees(h: HorairesOuvres, debut: Date, fin: Date): number {
  if (fin <= debut) return 0;
  const d = DateTime.fromJSDate(debut).setZone(h.fuseau);
  const f = DateTime.fromJSDate(fin).setZone(h.fuseau);
  let total = 0;
  let jour = d.startOf('day');
  for (let i = 0; i < JOURS_MAX && jour <= f; i++, jour = jour.plus({ days: 1 })) {
    for (const plage of plagesDuJour(h, jour)) {
      const b = bornes(h, jour, plage);
      if (!b) continue;
      const debutUtile = b.debut > d ? b.debut : d;
      const finUtile = b.fin < f ? b.fin : f;
      if (finUtile > debutUtile) total += finUtile.diff(debutUtile, 'minutes').minutes;
    }
  }
  return Math.round(total);
}

export function heuresOuvrees(h: HorairesOuvres, debut: Date, fin: Date): number {
  return minutesOuvrees(h, debut, fin) / 60;
}

/**
 * Instant obtenu en ajoutant un nombre de minutes ouvrees a un point de depart.
 * Sert a calculer l'echeance SLA d'une demande. Un depart hors plage est reporte
 * a l'ouverture de la prochaine plage.
 */
export function ajouterMinutesOuvrees(h: HorairesOuvres, depart: Date, minutes: number): Date {
  if (minutes <= 0) return depart;
  let reste = minutes;
  const d = DateTime.fromJSDate(depart).setZone(h.fuseau);
  let jour = d.startOf('day');
  for (let i = 0; i < JOURS_MAX; i++, jour = jour.plus({ days: 1 })) {
    for (const plage of plagesDuJour(h, jour)) {
      const b = bornes(h, jour, plage);
      if (!b) continue;
      if (b.fin <= d) continue;
      const debutUtile = b.debut > d ? b.debut : d;
      const disponible = b.fin.diff(debutUtile, 'minutes').minutes;
      if (disponible >= reste) return debutUtile.plus({ minutes: reste }).toJSDate();
      reste -= disponible;
    }
  }
  // Calendrier de feries insuffisant : on rend la derniere date balayee plutot que de boucler.
  return jour.toJSDate();
}

export function ajouterHeuresOuvrees(h: HorairesOuvres, depart: Date, heures: number): Date {
  return ajouterMinutesOuvrees(h, depart, Math.round(heures * 60));
}

/** Duree lisible en francais a partir de minutes ouvrees (« 2 j 3 h », « 45 min »). */
export function formaterDuree(minutes: number, minutesParJour = 540): string {
  if (minutes <= 0) return '0 min';
  const jours = Math.floor(minutes / minutesParJour);
  const resteJour = minutes - jours * minutesParJour;
  const heures = Math.floor(resteJour / 60);
  const min = Math.round(resteJour - heures * 60);
  const morceaux: string[] = [];
  if (jours) morceaux.push(`${jours} j`);
  if (heures) morceaux.push(`${heures} h`);
  if (min && !jours) morceaux.push(`${min} min`);
  return morceaux.join(' ') || '0 min';
}

/** Total de minutes ouvrees d'une journee type, pour convertir des minutes en jours. */
export function minutesParJourOuvre(h: HorairesOuvres): number {
  const totaux = ([1, 2, 3, 4, 5, 6, 7] as const)
    .map((j) => (h.semaine[j] ?? []).reduce((s, p) => {
      const [hd, md] = p.debut.split(':').map(Number);
      const [hf, mf] = p.fin.split(':').map(Number);
      return s + Math.max(0, hf * 60 + mf - (hd * 60 + md));
    }, 0))
    .filter((t) => t > 0);
  if (!totaux.length) return 540;
  return Math.round(totaux.reduce((a, b) => a + b, 0) / totaux.length);
}
