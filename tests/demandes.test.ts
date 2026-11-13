/**
 * Cycle de vie des demandes : transitions horodatees, temps par statut et par acteur,
 * effets des natures d'evenement, exclusion du hors perimetre.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { eq, sql } from 'drizzle-orm';
import { baseVierge, creerCompteDeTest, creerPosteDeTest, db, schema } from './aide';
import { trouverOuCreerDossier } from '../src/server/modules/dossiers/service';
import { ajouterEvenement, effetNature } from '../src/server/modules/evenements/service';
import { changerStatut, creerDemande, fileDuJour, tempsDemande, AUTEUR_SYSTEME } from '../src/server/modules/demandes/service';
import { modifierParametres } from '../src/server/lib/parametres';
import { joursFeriesEspagne, FUSEAU_CLIENT_DEFAUT } from '../src/shared/heures-ouvrees';
import { DEFINITIONS_NATURES, DEFINITIONS_STATUTS, statutReporting } from '../src/shared/constantes';

const AUTEUR = AUTEUR_SYSTEME;

/** Instant precis dans le fuseau du client, pour des calculs de delais reproductibles. */
function t(iso: string): Date {
  return DateTime.fromISO(iso, { zone: FUSEAU_CLIENT_DEFAUT }).toJSDate();
}

let compteId: number;
let posteId: number;
let dossierId: number;

beforeAll(async () => {
  await baseVierge();
  // Calendrier de feries couvrant les annees utilisees par les tests.
  await modifierParametres((p) => {
    p.horaires.feriesClient = [...joursFeriesEspagne(2025), ...joursFeriesEspagne(2026)];
    p.horaires.feriesCollaborateur = false;
  });
});

beforeEach(async () => {
  // Seules les donnees metier sont remises a zero : les parametres restent.
  await db.execute(sql`TRUNCATE comptes_clients, dossiers, demandes, evenements, transitions_statut, echeances RESTART IDENTITY CASCADE`);
  const compte = await creerCompteDeTest();
  compteId = compte.id;
  posteId = (await creerPosteDeTest(compteId)).id;
  const { dossier } = await trouverOuCreerDossier(
    { compteId, posteId, client: 'Alpha Pharma', pays: 'Algerie', produit: 'Gelules 180 kg', operation: 'aerien vers Alger' },
    AUTEUR,
  );
  dossierId = dossier.id;
});

describe('creation d’une demande', () => {
  it('ouvre la demande au statut Nouveau et ecrit la transition initiale', async () => {
    const demande = await creerDemande({ dossierId, famille: 'T01', objet: 'Cotation fret', ouverteLe: t('2026-03-03T10:00') }, AUTEUR);
    expect(demande.statut).toBe('nouveau');
    expect(demande.acteurAttendu).toBe('poste');

    const transitions = await db.select().from(schema.transitionsStatut).where(eq(schema.transitionsStatut.demandeId, demande.id));
    expect(transitions).toHaveLength(1);
    expect(transitions[0].statutAvant).toBeNull();
    expect(transitions[0].statutApres).toBe('nouveau');
    expect(transitions[0].minutesOuvrees).toBe(0);
  });

  it('calcule l’echeance SLA en heures ouvrees du client', async () => {
    // T01 : delai cible de 8 heures ouvrees. Depart mardi 16 h, donc mercredi 15 h.
    const demande = await creerDemande({ dossierId, famille: 'T01', objet: 'Cotation', ouverteLe: t('2026-03-03T16:00') }, AUTEUR);
    expect(demande.slaHeures).toBe(8);
    expect(DateTime.fromJSDate(demande.slaEcheanceLe!).setZone(FUSEAU_CLIENT_DEFAUT).toFormat('yyyy-MM-dd HH:mm')).toBe('2026-03-04 15:00');
  });

  it('refuse une demande hors perimetre (T00)', async () => {
    await expect(creerDemande({ dossierId, famille: 'T00', objet: 'Newsletter' }, AUTEUR)).rejects.toThrow(/hors perimetre/i);
  });
});

describe('transitions et temps par statut', () => {
  it('cumule les minutes ouvrees du statut quitte, week-end exclu', async () => {
    // Vendredi 6 mars 16 h : ouverture. Lundi 9 mars 10 h : passage en cours.
    // Attendu : 2 h le vendredi, 1 h le lundi, soit 180 minutes dans Nouveau.
    const demande = await creerDemande({ dossierId, famille: 'T01', objet: 'Cotation', ouverteLe: t('2026-03-06T16:00') }, AUTEUR);
    const maj = await changerStatut(demande.id, 'en_cours', AUTEUR, { survenuLe: t('2026-03-09T10:00') });
    expect((maj.minutesParStatut as Record<string, number>).nouveau).toBe(180);
    expect((maj.minutesParActeur as Record<string, number>).poste).toBe(180);
  });

  it('exclut un jour ferie du client du temps passe', async () => {
    // Vendredi 9 octobre 16 h vers mardi 13 octobre 10 h. Lundi 12 est ferie en Espagne.
    // Attendu : 2 h le vendredi, 0 le lundi, 1 h le mardi, soit 180 minutes.
    const demande = await creerDemande({ dossierId, famille: 'T01', objet: 'Cotation', ouverteLe: t('2026-10-09T16:00') }, AUTEUR);
    const maj = await changerStatut(demande.id, 'en_cours', AUTEUR, { survenuLe: t('2026-10-13T10:00') });
    expect((maj.minutesParStatut as Record<string, number>).nouveau).toBe(180);
  });

  it('repartit le temps entre les acteurs au fil des transitions', async () => {
    const demande = await creerDemande({ dossierId, famille: 'T01', objet: 'Cotation', ouverteLe: t('2026-03-02T09:00') }, AUTEUR);
    // Lundi 9 h a 12 h chez le poste (Nouveau), puis 3 h en attente DO, puis retour au poste.
    await changerStatut(demande.id, 'attente_do', AUTEUR, { survenuLe: t('2026-03-02T12:00') });
    await changerStatut(demande.id, 'en_cours', AUTEUR, { survenuLe: t('2026-03-02T15:00') });
    const maj = await changerStatut(demande.id, 'termine', AUTEUR, { survenuLe: t('2026-03-02T17:00') });

    const parActeur = maj.minutesParActeur as Record<string, number>;
    expect(parActeur.poste).toBe(300); // 180 en Nouveau plus 120 en cours
    expect(parActeur.do).toBe(180);
    const parStatut = maj.minutesParStatut as Record<string, number>;
    expect(parStatut.nouveau).toBe(180);
    expect(parStatut.attente_do).toBe(180);
    expect(parStatut.en_cours).toBe(120);
  });

  it('arrete le chrono sur un statut ferme', async () => {
    const demande = await creerDemande({ dossierId, famille: 'T01', objet: 'Cotation', ouverteLe: t('2026-03-02T09:00') }, AUTEUR);
    const close = await changerStatut(demande.id, 'termine', AUTEUR, { survenuLe: t('2026-03-02T12:00') });
    expect(close.termineeLe).not.toBeNull();
    // Une semaine plus tard, le temps total n'a pas bouge.
    const temps = await tempsDemande(close, t('2026-03-09T12:00'));
    expect(temps.total).toBe(180);
    expect(temps.statutCourant).toBe(0);
  });

  it('ajoute le segment en cours au temps lu', async () => {
    const demande = await creerDemande({ dossierId, famille: 'T01', objet: 'Cotation', ouverteLe: t('2026-03-02T09:00') }, AUTEUR);
    const temps = await tempsDemande(demande, t('2026-03-02T11:00'));
    expect(temps.statutCourant).toBe(120);
    expect(temps.parStatut.nouveau).toBe(120);
    expect(temps.total).toBe(120);
  });

  it('n’ecrit pas de transition quand rien ne change', async () => {
    const demande = await creerDemande({ dossierId, famille: 'T01', objet: 'Cotation' }, AUTEUR);
    await changerStatut(demande.id, 'nouveau', AUTEUR);
    const transitions = await db.select().from(schema.transitionsStatut).where(eq(schema.transitionsStatut.demandeId, demande.id));
    expect(transitions).toHaveLength(1);
  });

  it('horodate chaque transition avec son auteur et son type', async () => {
    const demande = await creerDemande({ dossierId, famille: 'T01', objet: 'Cotation' }, AUTEUR);
    await changerStatut(demande.id, 'en_cours', { utilisateurId: null, type: 'claude' }, { motif: 'via le connecteur' });
    const transitions = await db
      .select()
      .from(schema.transitionsStatut)
      .where(eq(schema.transitionsStatut.demandeId, demande.id))
      .orderBy(schema.transitionsStatut.id);
    expect(transitions[1].auteurType).toBe('claude');
    expect(transitions[1].motif).toBe('via le connecteur');
    expect(transitions[1].survenuLe).toBeInstanceOf(Date);
  });
});

describe('effets des natures d’evenement', () => {
  it('une demande entrante ouvre une demande', async () => {
    const r = await ajouterEvenement(
      { dossierId, sens: 'entrant', nature: 'demande_entrante', famille: 'T01', interlocuteur: 'client', source: 'mail', objet: 'Cotation' },
      AUTEUR,
    );
    expect(r.demandeCreee).toBe(true);
    expect(r.demande?.statut).toBe('nouveau');
  });

  it('un envoi de livrable passe en attente du destinataire', async () => {
    const r1 = await ajouterEvenement(
      { dossierId, sens: 'entrant', nature: 'demande_entrante', famille: 'T02', interlocuteur: 'client', source: 'mail', objet: 'BL' },
      AUTEUR,
    );
    const r2 = await ajouterEvenement(
      { demandeId: r1.demande!.id, sens: 'sortant', nature: 'envoi_livrable', famille: 'T02', interlocuteur: 'client', source: 'mail' },
      AUTEUR,
    );
    expect(r2.demande?.statut).toBe('attente_tiers');
    expect(r2.demande?.acteurAttendu).toBe('client');
    expect(r2.demande?.premiereReponseLe).not.toBeNull();
  });

  it('une demande de validation passe en attente DO, la validation la rend au poste', async () => {
    const r1 = await ajouterEvenement(
      { dossierId, sens: 'entrant', nature: 'demande_entrante', famille: 'T03', interlocuteur: 'client', source: 'mail', objet: 'Proforma' },
      AUTEUR,
    );
    const r2 = await ajouterEvenement(
      { demandeId: r1.demande!.id, sens: 'sortant', nature: 'demande_validation_do', famille: 'T03', interlocuteur: 'do', source: 'mail' },
      AUTEUR,
    );
    expect(r2.demande?.statut).toBe('attente_do');
    expect(r2.demande?.acteurAttendu).toBe('do');

    const r3 = await ajouterEvenement(
      { demandeId: r1.demande!.id, sens: 'entrant', nature: 'validation_do', famille: 'T03', interlocuteur: 'do', source: 'mail' },
      AUTEUR,
    );
    expect(r3.demande?.statut).toBe('en_cours');
    expect(r3.demande?.acteurAttendu).toBe('poste');
  });

  it('une relance emise incremente le niveau sans depasser N3', async () => {
    const r = await ajouterEvenement(
      { dossierId, sens: 'entrant', nature: 'demande_entrante', famille: 'T04', interlocuteur: 'client', source: 'mail', objet: 'Solde' },
      AUTEUR,
    );
    const id = r.demande!.id;
    for (let i = 0; i < 4; i++) {
      await ajouterEvenement({ demandeId: id, sens: 'sortant', nature: 'relance_emise', famille: 'T04', interlocuteur: 'client', source: 'mail' }, AUTEUR);
    }
    const [maj] = await db.select().from(schema.demandes).where(eq(schema.demandes.id, id));
    expect(maj.niveauRelance).toBe(3);
  });

  it('une information ne change pas le statut mais rafraichit la demande', async () => {
    const r1 = await ajouterEvenement(
      { dossierId, sens: 'entrant', nature: 'demande_entrante', famille: 'T01', interlocuteur: 'client', source: 'mail', objet: 'Cotation' },
      AUTEUR,
    );
    const r2 = await ajouterEvenement(
      { demandeId: r1.demande!.id, sens: 'interne', nature: 'information', famille: 'T01', source: 'saisie', resume: 'note' },
      AUTEUR,
    );
    expect(r2.statutApplique).toBeNull();
    const [maj] = await db.select().from(schema.demandes).where(eq(schema.demandes.id, r1.demande!.id));
    expect(maj.statut).toBe('nouveau');
  });

  it('refuse une nature incompatible avec le sens', async () => {
    await expect(
      ajouterEvenement({ dossierId, sens: 'sortant', nature: 'demande_entrante', famille: 'T01', source: 'mail' }, AUTEUR),
    ).rejects.toThrow(/sens/i);
  });

  it('couvre toutes les natures du referentiel', () => {
    for (const n of DEFINITIONS_NATURES) {
      expect(() => effetNature(n.code)).not.toThrow();
    }
  });

  it('dedoublonne sur l’identifiant de message', async () => {
    const entree = {
      dossierId,
      sens: 'entrant' as const,
      nature: 'demande_entrante' as const,
      famille: 'T01',
      source: 'mail' as const,
      objet: 'Cotation',
      messageId: '<abc@exemple.test>',
    };
    const a = await ajouterEvenement(entree, AUTEUR);
    const b = await ajouterEvenement(entree, AUTEUR);
    expect(b.evenement.id).toBe(a.evenement.id);
    expect(b.demandeCreee).toBe(false);
    const evenements = await db.select().from(schema.evenements).where(eq(schema.evenements.dossierId, dossierId));
    expect(evenements).toHaveLength(1);
  });
});

describe('hors perimetre (T00)', () => {
  it('trace l’evenement sans creer ni faire avancer de demande', async () => {
    const r = await ajouterEvenement(
      { dossierId, sens: 'entrant', nature: 'demande_entrante', famille: 'T00', interlocuteur: 'prospect', source: 'mail', objet: 'Newsletter' },
      AUTEUR,
    );
    expect(r.horsPerimetre).toBe(true);
    expect(r.demandeCreee).toBe(false);
    expect(r.demande).toBeNull();
    const evenements = await db.select().from(schema.evenements).where(eq(schema.evenements.famille, 'T00'));
    expect(evenements).toHaveLength(1);
  });

  it('n’apparait dans aucune vue de pilotage', async () => {
    await ajouterEvenement(
      { dossierId, sens: 'entrant', nature: 'demande_entrante', famille: 'T00', source: 'mail', objet: 'Spam' },
      AUTEUR,
    );
    await ajouterEvenement(
      { dossierId, sens: 'entrant', nature: 'demande_entrante', famille: 'T01', source: 'mail', objet: 'Cotation' },
      AUTEUR,
    );
    const file = await fileDuJour({ compteId });
    expect(file).toHaveLength(1);
    expect(file[0].famille).toBe('T01');

    const { chronologieDossier } = await import('../src/server/modules/dossiers/service');
    const chrono = await chronologieDossier(dossierId);
    expect(chrono.some((l) => l.titre.includes('Spam'))).toBe(false);
    expect(chrono.some((l) => l.titre.includes('Cotation'))).toBe(true);
  });

  it('porte sur chaque evenement l’action qui debloque, et un brief lisible', async () => {
    const { chronologieDossier } = await import('../src/server/modules/dossiers/service');
    await ajouterEvenement(
      {
        dossierId,
        sens: 'entrant',
        nature: 'demande_entrante',
        famille: 'T01',
        source: 'mail',
        objet: 'TR: cotation aerien',
        // Un mail transfere : le brief doit sauter le bloc d'en-tetes et garder le message.
        resume: [
          'De : client@exemple-fictif.test <client@exemple-fictif.test>',
          "A : 'Poste' <poste@exemple-fictif.test>",
          '',
          'Merci de nous donner une cotation aerienne pour 180 kg.',
        ].join('\n'),
      },
      AUTEUR,
    );

    const chrono = await chronologieDossier(dossierId);
    const ligne = chrono.find((l) => l.titre === 'TR: cotation aerien');
    expect(ligne).toBeDefined();
    // Le brief : le message, pas la liste des destinataires.
    expect(ligne?.detail).toBe('Merci de nous donner une cotation aerienne pour 180 kg.');
    // L'action qui debloque, lisible sans ouvrir la demande.
    expect((ligne?.meta as { action?: string }).action).toBe('TR: cotation aerien');
  });
});

describe('file du jour', () => {
  it('place en tete les demandes dont le delai cible est depasse', async () => {
    const recente = await creerDemande({ dossierId, famille: 'T05', objet: 'Recente', ouverteLe: new Date() }, AUTEUR);
    const ancienne = await creerDemande({ dossierId, famille: 'T01', objet: 'Ancienne', ouverteLe: t('2026-01-05T09:00') }, AUTEUR);
    const file = await fileDuJour({ compteId });
    expect(file[0].id).toBe(ancienne.id);
    expect(file[0].slaDepasse).toBe(true);
    expect(file.map((l) => l.id)).toContain(recente.id);
  });

  it('exclut les demandes fermees', async () => {
    const d = await creerDemande({ dossierId, famille: 'T01', objet: 'Close' }, AUTEUR);
    await changerStatut(d.id, 'termine', AUTEUR);
    const file = await fileDuJour({ compteId });
    expect(file.map((l) => l.id)).not.toContain(d.id);
  });

  it('filtre par famille et par acteur attendu', async () => {
    await creerDemande({ dossierId, famille: 'T01', objet: 'Cotation' }, AUTEUR);
    const b = await creerDemande({ dossierId, famille: 'T03', objet: 'Proforma' }, AUTEUR);
    await changerStatut(b.id, 'attente_do', AUTEUR);

    expect((await fileDuJour({ compteId, familles: ['T03'] }))).toHaveLength(1);
    const attenteDo = await fileDuJour({ compteId, acteurs: ['do'] });
    expect(attenteDo).toHaveLength(1);
    expect(attenteDo[0].id).toBe(b.id);
  });
});

describe('correspondance des statuts vers le reporting client', () => {
  it('reprend exactement les cinq libelles attendus', () => {
    expect(statutReporting('nouveau')).toBe('En cours');
    expect(statutReporting('en_cours')).toBe('En cours');
    expect(statutReporting('attente_tiers')).toBe('En attente client');
    expect(statutReporting('attente_do')).toBe('En cours');
    expect(statutReporting('bloque')).toBe('Bloque');
    expect(statutReporting('termine')).toBe('Termine');
    expect(statutReporting('annule')).toBe('Annule');
  });

  it('marque l’attente DO par une mention, sans changer le statut repris', () => {
    const def = DEFINITIONS_STATUTS.find((s) => s.code === 'attente_do')!;
    expect(def.reporting).toBe('En cours');
    expect(def.mention).toBe('validation DO attendue');
  });
});
