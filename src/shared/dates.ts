import { DateTime } from 'luxon';
import { FUSEAU_TANA } from './heures-ouvrees';

export { FUSEAU_TANA };

/** « mardi 29 septembre 2026 a 10 h 00 » dans le fuseau demande (Antananarivo par defaut). */
export function formaterDateHeure(d: Date | string, fuseau = FUSEAU_TANA): string {
  const dt = DateTime.fromJSDate(typeof d === 'string' ? new Date(d) : d).setZone(fuseau).setLocale('fr');
  return `${dt.toFormat('cccc d LLLL yyyy')} a ${dt.toFormat("HH 'h' mm")}`;
}

export function formaterDate(d: Date | string, fuseau = FUSEAU_TANA): string {
  return DateTime.fromJSDate(typeof d === 'string' ? new Date(d) : d).setZone(fuseau).setLocale('fr').toFormat('d LLLL yyyy');
}

export function formaterHeure(d: Date | string, fuseau = FUSEAU_TANA): string {
  return DateTime.fromJSDate(typeof d === 'string' ? new Date(d) : d).setZone(fuseau).toFormat("HH 'h' mm");
}

/** Format du reporting client : JJ/MM/AAAA (section 9 de CLAUDE.md). */
export function formaterDateReporting(d: Date | string, fuseau = FUSEAU_TANA): string {
  return DateTime.fromJSDate(typeof d === 'string' ? new Date(d) : d).setZone(fuseau).toFormat('dd/MM/yyyy');
}

/** Date du jour (AAAA-MM-JJ) et heure courante a Antananarivo. */
export function maintenantTana() {
  const dt = DateTime.now().setZone(FUSEAU_TANA);
  return { jour: dt.toISODate()!, heure: dt.hour, dt };
}

export function debutJourTana(decalageJours = 0): Date {
  return DateTime.now().setZone(FUSEAU_TANA).startOf('day').plus({ days: decalageJours }).toJSDate();
}

/** Numero de semaine ISO d'une date. */
export function semaineIso(d: Date | string): number {
  return DateTime.fromJSDate(typeof d === 'string' ? new Date(d) : d).weekNumber;
}
