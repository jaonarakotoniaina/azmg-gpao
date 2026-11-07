/**
 * Moteur de delais en heures ouvrees du client.
 * Critere de la phase 1 : « le temps par statut est juste sur un jeu de test incluant
 * week-end et ferie ».
 */
import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import {
  ajouterHeuresOuvrees,
  estJourOuvre,
  formaterDuree,
  horairesCompteParDefaut,
  joursFeriesEspagne,
  joursFeriesMadagascar,
  minutesOuvrees,
  minutesParJourOuvre,
  paques,
  type HorairesOuvres,
} from '../src/shared/heures-ouvrees';

const FUSEAU = 'Europe/Madrid';

/** Horaires de reference : lundi au vendredi, 9 h a 18 h, feries espagnols chomes. */
function horaires(options: Partial<HorairesOuvres> = {}): HorairesOuvres {
  return {
    fuseau: FUSEAU,
    semaine: {
      1: [{ debut: '09:00', fin: '18:00' }],
      2: [{ debut: '09:00', fin: '18:00' }],
      3: [{ debut: '09:00', fin: '18:00' }],
      4: [{ debut: '09:00', fin: '18:00' }],
      5: [{ debut: '09:00', fin: '18:00' }],
    },
    feriesClient: joursFeriesEspagne(2026),
    feriesLocaux: joursFeriesMadagascar(2026),
    feriesCollaborateur: false,
    ...options,
  };
}

function instant(iso: string): Date {
  return DateTime.fromISO(iso, { zone: FUSEAU }).toJSDate();
}

describe('calendriers de jours feries', () => {
  it('place Paques 2026 au 5 avril', () => {
    expect(paques(2026, FUSEAU).toISODate()).toBe('2026-04-05');
  });

  it('inclut le vendredi saint dans les feries espagnols', () => {
    expect(joursFeriesEspagne(2026)).toContain('2026-04-03');
  });

  it('inclut les feries propres a chaque pays', () => {
    // 12 octobre : fete nationale espagnole, jour ouvre a Madagascar.
    expect(joursFeriesEspagne(2026)).toContain('2026-10-12');
    expect(joursFeriesMadagascar(2026)).not.toContain('2026-10-12');
    // 26 juin : fete nationale malgache, jour ouvre en Espagne.
    expect(joursFeriesMadagascar(2026)).toContain('2026-06-26');
    expect(joursFeriesEspagne(2026)).not.toContain('2026-06-26');
  });
});

describe('regle des feries du compte Masenz', () => {
  const h = horaires();

  it('ne travaille pas un ferie commun aux deux pays', () => {
    // 1er mai : ferie en Espagne et a Madagascar. 2026-05-01 est un vendredi.
    expect(estJourOuvre(h, instant('2026-05-01T10:00'))).toBe(false);
  });

  it('ne travaille pas un ferie propre a l’Espagne', () => {
    // 12 octobre 2026 est un lundi.
    expect(estJourOuvre(h, instant('2026-10-12T10:00'))).toBe(false);
  });

  it('travaille un ferie propre a Madagascar', () => {
    // 26 juin 2026 est un vendredi, ferie malgache seulement.
    expect(estJourOuvre(h, instant('2026-06-26T10:00'))).toBe(true);
  });

  it('chome aussi les feries locaux quand le compte le demande', () => {
    const avecLocaux = horaires({ feriesCollaborateur: true });
    expect(estJourOuvre(avecLocaux, instant('2026-06-26T10:00'))).toBe(false);
  });
});

describe('minutesOuvrees', () => {
  const h = horaires();

  it('compte les minutes a l’interieur d’une meme journee', () => {
    expect(minutesOuvrees(h, instant('2026-03-03T09:30'), instant('2026-03-03T11:00'))).toBe(90);
  });

  it('ignore les heures en dehors de la plage de travail', () => {
    // De 17 h a 19 h un mardi : seule l'heure avant 18 h compte.
    expect(minutesOuvrees(h, instant('2026-03-03T17:00'), instant('2026-03-03T19:00'))).toBe(60);
  });

  it('ignore une duree entierement hors plage', () => {
    expect(minutesOuvrees(h, instant('2026-03-03T19:00'), instant('2026-03-03T23:00'))).toBe(0);
  });

  it('saute le week-end', () => {
    // Vendredi 17 h au lundi 10 h : 1 h le vendredi, 1 h le lundi, rien le samedi ni le dimanche.
    expect(minutesOuvrees(h, instant('2026-03-06T17:00'), instant('2026-03-09T10:00'))).toBe(120);
  });

  it('saute un jour ferie du client', () => {
    // Jeudi 1er janvier 2026 est ferie. Du mercredi 31 decembre 17 h au vendredi 2 janvier 10 h :
    // 1 h le 31, 0 le 1er, 1 h le 2.
    const h2 = horaires({ feriesClient: [...joursFeriesEspagne(2025), ...joursFeriesEspagne(2026)] });
    expect(minutesOuvrees(h2, instant('2025-12-31T17:00'), instant('2026-01-02T10:00'))).toBe(120);
  });

  it('compte une journee complete a 540 minutes', () => {
    expect(minutesOuvrees(h, instant('2026-03-03T09:00'), instant('2026-03-03T18:00'))).toBe(540);
  });

  it('renvoie zero quand la fin precede le debut', () => {
    expect(minutesOuvrees(h, instant('2026-03-03T11:00'), instant('2026-03-03T09:00'))).toBe(0);
  });

  it('gere plusieurs plages dans la journee (coupure de midi)', () => {
    const coupure = horaires({
      semaine: {
        1: [
          { debut: '09:00', fin: '13:00' },
          { debut: '15:00', fin: '18:00' },
        ],
      },
    });
    // Lundi 9 h a 18 h : 4 h le matin, 3 h l'apres-midi, la coupure ne compte pas.
    expect(minutesOuvrees(coupure, instant('2026-03-02T09:00'), instant('2026-03-02T18:00'))).toBe(420);
  });
});

describe('ajouterHeuresOuvrees', () => {
  const h = horaires();

  it('reporte au lendemain quand la journee ne suffit pas', () => {
    // Mardi 16 h plus 4 h ouvrees : 2 h jusqu'a 18 h, puis 2 h le mercredi, soit 11 h.
    const r = ajouterHeuresOuvrees(h, instant('2026-03-03T16:00'), 4);
    expect(DateTime.fromJSDate(r).setZone(FUSEAU).toFormat('yyyy-MM-dd HH:mm')).toBe('2026-03-04 11:00');
  });

  it('reporte un depart hors plage a l’ouverture suivante', () => {
    // Samedi 10 h plus 1 h : la premiere plage disponible est le lundi 9 h.
    const r = ajouterHeuresOuvrees(h, instant('2026-03-07T10:00'), 1);
    expect(DateTime.fromJSDate(r).setZone(FUSEAU).toFormat('yyyy-MM-dd HH:mm')).toBe('2026-03-09 10:00');
  });

  it('saute un ferie du client', () => {
    // Vendredi 9 octobre 16 h plus 4 h : lundi 12 octobre est ferie, donc mardi 13 a 11 h.
    const r = ajouterHeuresOuvrees(h, instant('2026-10-09T16:00'), 4);
    expect(DateTime.fromJSDate(r).setZone(FUSEAU).toFormat('yyyy-MM-dd HH:mm')).toBe('2026-10-13 11:00');
  });

  it('est l’inverse de minutesOuvrees', () => {
    const depart = instant('2026-03-03T10:30');
    const arrivee = ajouterHeuresOuvrees(h, depart, 12);
    expect(minutesOuvrees(h, depart, arrivee)).toBe(720);
  });
});

describe('formatage et constantes', () => {
  it('formate des durees lisibles sans tiret long', () => {
    expect(formaterDuree(0)).toBe('0 min');
    expect(formaterDuree(45)).toBe('45 min');
    expect(formaterDuree(540)).toBe('1 j');
    expect(formaterDuree(600)).toBe('1 j 1 h');
    expect(formaterDuree(120)).toBe('2 h');
  });

  it('calcule la duree d’une journee ouvree type', () => {
    expect(minutesParJourOuvre(horaires())).toBe(540);
  });

  it('pre-remplit les deux calendriers de feries d’un compte', () => {
    const h = horairesCompteParDefaut(2026, 2);
    expect(h.feriesClient).toContain('2026-10-12');
    expect(h.feriesClient).toContain('2027-10-12');
    expect(h.feriesLocaux).toContain('2026-06-26');
    expect(h.feriesCollaborateur).toBe(false);
  });
});
