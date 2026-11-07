/**
 * Brouillons de la phase 5 : relances, daily, onglet « sem », situation client, comparatif de
 * cotations, preparation du matin.
 *
 * Deux exigences de la section 10 sont verifiees ici de bout en bout : **aucune action sortante
 * sans validation humaine** (rien ne part, le brouillon reste a l'etat « prepare ») et **chaque
 * brouillon cite ses evenements sources**.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { eq, sql } from 'drizzle-orm';
import { baseVierge, creerCompteDeTest, creerPosteDeTest, db, schema } from './aide';
import { changerStatut, creerDemande, AUTEUR_SYSTEME } from '../src/server/modules/demandes/service';
import { ajouterEvenement } from '../src/server/modules/evenements/service';
import { trouverOuCreerDossier } from '../src/server/modules/dossiers/service';
import {
  deciderBrouillon,
  dureeLocalisee,
  extraireOffre,
  langueDe,
  listerBrouillons,
  preparerComparatifCotations,
  preparerDaily,
  preparerLeMatin,
  preparerRelances,
  preparerSemaine,
  preparerSituationClient,
  redigerRelance,
  relancesAPreparer,
} from '../src/server/modules/brouillons/service';
import { modifierParametres } from '../src/server/lib/parametres';
import { FUSEAU_CLIENT_DEFAUT } from '../src/shared/heures-ouvrees';
import { TIRETS_LONGS } from '../src/shared/tirets';

const AUTEUR = AUTEUR_SYSTEME;

function t(iso: string): Date {
  return DateTime.fromISO(iso, { zone: FUSEAU_CLIENT_DEFAUT }).toJSDate();
}

let compteId: number;
let posteId: number;
let dossierId: number;

beforeAll(async () => {
  await baseVierge();
  await modifierParametres((p) => {
    p.horaires.feriesClient = [];
    p.horaires.feriesLocaux = [];
  });
});

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE comptes_clients, dossiers, demandes, evenements, transitions_statut, echeances, brouillons RESTART IDENTITY CASCADE`,
  );
  const compte = await creerCompteDeTest();
  compteId = compte.id;
  posteId = (await creerPosteDeTest(compteId)).id;
  dossierId = (
    await trouverOuCreerDossier(
      { compteId, posteId, client: 'Alpha Pharma', pays: 'Algerie', produit: 'Gelules 180 kg', operation: 'aerien vers Alger' },
      AUTEUR,
    )
  ).dossier.id;
});

// ---------------------------------------------------------------------------
// Relances
// ---------------------------------------------------------------------------

/** Demande en attente d'un tiers depuis `depuis`, avec un evenement sortant qui la justifie. */
async function demandeEnAttente(opts: { depuis: Date; objet?: string; destinataire?: string; statut?: 'attente_tiers' | 'attente_do' }) {
  const demande = await creerDemande(
    { dossierId, famille: 'T01', objet: opts.objet ?? 'Cotation aerien Alger', ouverteLe: opts.depuis },
    AUTEUR,
  );
  await ajouterEvenement(
    {
      demandeId: demande.id,
      sens: 'sortant',
      nature: 'envoi_livrable',
      famille: 'T01',
      interlocuteur: 'transitaire',
      source: 'saisie',
      survenuLe: opts.depuis,
      objet: 'Demande de cotation',
      resume: 'Demande de cotation envoyee pour 180 kg au depart de Barcelone',
      destinataires: [opts.destinataire ?? 'operations@transitaire-fictif.test'],
    },
    AUTEUR,
  );
  await changerStatut(demande.id, opts.statut ?? 'attente_tiers', AUTEUR, { survenuLe: opts.depuis });
  return demande;
}

/**
 * Insere une demande T00 en contournant le garde-fou de `creerDemande`, pour verifier que les
 * vues de pilotage l'excluent aussi de leur cote (defense en profondeur, section 3).
 */
async function demandeT00(statut: 'attente_tiers' | 'en_cours') {
  const [demande] = await db
    .insert(schema.demandes)
    .values({
      dossierId,
      compteId,
      posteId,
      famille: 'T00',
      objet: 'Infolettre fournisseur',
      statut,
      acteurAttendu: statut === 'attente_tiers' ? 'tiers' : 'poste',
      ouverteLe: t('2026-11-02T09:00'),
    })
    .returning();
  return demande;
}

describe('relances N1, N2 et N3', () => {
  it('ne propose rien avant le seuil N1', async () => {
    // 8 heures ouvrees d'attente, le seuil N1 est a 16.
    await demandeEnAttente({ depuis: t('2026-11-04T09:00') });
    expect(await relancesAPreparer(compteId, t('2026-11-04T17:00'))).toHaveLength(0);
  });

  it('propose un N1 au seuil, un N2 puis un N3 selon le temps d’attente ouvre', async () => {
    const depuis = t('2026-11-02T09:00');
    await demandeEnAttente({ depuis });
    // 2 jours ouvres = 18 heures ouvrees, au-dela du seuil N1 (16).
    expect((await relancesAPreparer(compteId, t('2026-11-04T09:00')))[0].niveau).toBe(1);
    // 4 jours ouvres = 36 heures, au-dela du seuil N2 (32).
    expect((await relancesAPreparer(compteId, t('2026-11-06T09:00')))[0].niveau).toBe(2);
    // 7 jours ouvres = 63 heures, au-dela du seuil N3 (56).
    expect((await relancesAPreparer(compteId, t('2026-11-11T09:00')))[0].niveau).toBe(3);
  });

  it('ne compte pas le week-end dans le temps d’attente', async () => {
    // Du vendredi 09:00 au lundi 09:00 : un seul jour ouvre, donc sous le seuil N1.
    await demandeEnAttente({ depuis: t('2026-11-06T09:00') });
    expect(await relancesAPreparer(compteId, t('2026-11-09T09:00'))).toHaveLength(0);
  });

  it('ignore une demande qui attend le poste lui-meme', async () => {
    const demande = await creerDemande({ dossierId, famille: 'T04', objet: 'Relance paiement', ouverteLe: t('2026-11-02T09:00') }, AUTEUR);
    await changerStatut(demande.id, 'en_cours', AUTEUR, { survenuLe: t('2026-11-02T09:00') });
    expect(await relancesAPreparer(compteId, t('2026-11-11T09:00'))).toHaveLength(0);
  });

  it('exclut le hors perimetre T00', async () => {
    // `creerDemande` refuse deja T00. On insere donc en direct pour verifier la seconde barriere :
    // meme si une ligne T00 existait (import, donnees anciennes), elle ne genere aucune relance.
    await demandeT00('attente_tiers');
    expect(await relancesAPreparer(compteId, t('2026-11-11T09:00'))).toHaveLength(0);
  });

  it('ne repropose pas un niveau de relance deja emis', async () => {
    const demande = await demandeEnAttente({ depuis: t('2026-11-02T09:00') });
    await db.update(schema.demandes).set({ niveauRelance: 1 }).where(eq(schema.demandes.id, demande.id));
    // Le temps d'attente justifie un N1, deja emis : rien a proposer.
    expect(await relancesAPreparer(compteId, t('2026-11-04T09:00'))).toHaveLength(0);
    // Le temps d'attente justifie maintenant un N2, qui reste a emettre.
    expect((await relancesAPreparer(compteId, t('2026-11-06T09:00')))[0].niveau).toBe(2);
  });

  it('cite les evenements sources et les faits dates dans le brouillon', async () => {
    const demande = await demandeEnAttente({ depuis: t('2026-11-02T09:00') });
    const [relance] = await relancesAPreparer(compteId, t('2026-11-04T09:00'));
    const [evenement] = await db.select().from(schema.evenements).where(eq(schema.evenements.demandeId, demande.id));
    expect(relance.sources).toContain(evenement.id);
    const texte = redigerRelance(relance);
    expect(texte).toContain('02/11/2026');
    expect(texte).toContain('Demande de cotation envoyee');
    expect(texte).toContain('Alpha Pharma');
  });

  it('exprime l’attente dans la langue du brouillon', () => {
    // `formaterDuree` abrege en francais (« 3 j 2 h ») : un brouillon anglais ou espagnol ne doit
    // pas porter d'unite francaise.
    expect(dureeLocalisee(540 * 3 + 120, 'fr')).toBe('3 jours et 2 heures');
    expect(dureeLocalisee(540 * 3 + 120, 'en')).toBe('3 days and 2 hours');
    expect(dureeLocalisee(540 * 3 + 120, 'es')).toBe('3 dias y 2 horas');
    expect(dureeLocalisee(540, 'en')).toBe('1 day');
    expect(dureeLocalisee(30, 'en')).toBe('less than an hour');
    expect(dureeLocalisee(0, 'fr')).toBe('moins d’une heure');
  });

  it('n’embarque aucune unite francaise dans un brouillon anglais', async () => {
    await demandeEnAttente({ depuis: t('2026-10-26T09:00'), destinataire: 'sales@forwarder-fictif.com' });
    const [relance] = await relancesAPreparer(compteId, t('2026-11-04T09:00'));
    const texte = redigerRelance(relance);
    expect(texte).toContain('Hello,');
    expect(texte).toMatch(/pending for \d+ days?/);
    expect(texte).not.toMatch(/\d+ j\b|heures?|jours?/);
  });

  it('redige dans la langue de l’interlocuteur', () => {
    expect(langueDe('ventes@transitaire.es')).toBe('es');
    expect(langueDe('sales@forwarder.com')).toBe('en');
    expect(langueDe('contact@transitaire.fr')).toBe('fr');
    expect(langueDe(null)).toBe('fr');
  });

  it('enregistre un brouillon par demande et par niveau, sans doublon au second passage', async () => {
    await demandeEnAttente({ depuis: t('2026-11-02T09:00') });
    const premier = await preparerRelances(compteId, AUTEUR, t('2026-11-04T09:00'));
    expect(premier.crees).toBe(1);
    const second = await preparerRelances(compteId, AUTEUR, t('2026-11-04T09:00'));
    expect(second.crees).toBe(0);
    expect(await listerBrouillons(compteId, { type: 'relance' })).toHaveLength(1);
  });

  it('laisse le brouillon a l’etat prepare : rien ne part tout seul', async () => {
    await demandeEnAttente({ depuis: t('2026-11-02T09:00') });
    await preparerRelances(compteId, AUTEUR, t('2026-11-04T09:00'));
    const [ligne] = await listerBrouillons(compteId);
    expect(ligne.brouillon.statut).toBe('prepare');
    expect(ligne.brouillon.decideLe).toBeNull();
    // Le niveau de relance de la demande n'a pas bouge : aucune relance n'a ete emise.
    const [demande] = await db.select().from(schema.demandes).where(eq(schema.demandes.id, ligne.brouillon.demandeId!));
    expect(demande.niveauRelance).toBe(0);
  });

  it('prepare plusieurs relances en un passage, chacune avec ses propres sources', async () => {
    const a = await demandeEnAttente({ depuis: t('2026-11-02T09:00'), objet: 'Cotation Alger' });
    const b = await demandeEnAttente({ depuis: t('2026-10-26T09:00'), objet: 'Cotation Tripoli' });
    const relances = await relancesAPreparer(compteId, t('2026-11-04T09:00'));
    expect(relances).toHaveLength(2);
    // Triees par anciennete d'attente : la plus vieille d'abord.
    expect(relances[0].demande.id).toBe(b.id);
    expect(relances[0].niveau).toBe(3);
    expect(relances[1].niveau).toBe(1);
    // Les sources de chaque relance restent celles de sa propre demande.
    const sourcesA = new Set(relances.find((r) => r.demande.id === a.id)!.sources);
    const sourcesB = new Set(relances.find((r) => r.demande.id === b.id)!.sources);
    expect([...sourcesA].some((id) => sourcesB.has(id))).toBe(false);
  });

  it('refuse de trancher deux fois le meme brouillon', async () => {
    await demandeEnAttente({ depuis: t('2026-11-02T09:00') });
    await preparerRelances(compteId, AUTEUR, t('2026-11-04T09:00'));
    const [ligne] = await listerBrouillons(compteId);
    await deciderBrouillon(ligne.brouillon.id, 'utilise', AUTEUR);
    // Le second clic ne doit pas effacer l'auteur ni l'horodatage de la premiere decision.
    await expect(deciderBrouillon(ligne.brouillon.id, 'ecarte', AUTEUR)).rejects.toThrow(/deja ete traite/);
    const [apres] = await db.select().from(schema.brouillons).where(eq(schema.brouillons.id, ligne.brouillon.id));
    expect(apres.statut).toBe('utilise');
  });

  it('enregistre la decision du poste sur un brouillon', async () => {
    await demandeEnAttente({ depuis: t('2026-11-02T09:00') });
    await preparerRelances(compteId, AUTEUR, t('2026-11-04T09:00'));
    const [ligne] = await listerBrouillons(compteId);
    const maj = await deciderBrouillon(ligne.brouillon.id, 'utilise', AUTEUR);
    expect(maj.statut).toBe('utilise');
    expect(maj.decideLe).not.toBeNull();
    expect(await listerBrouillons(compteId, { statut: 'prepare' })).toHaveLength(0);
    expect(await listerBrouillons(compteId, { statut: 'utilise' })).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Daily et onglet « sem »
// ---------------------------------------------------------------------------

describe('daily et onglet « sem » pre-remplis', () => {
  async function journeeDeTravail(jour: string) {
    const demande = await creerDemande({ dossierId, famille: 'T03', objet: 'Proforma a emettre', ouverteLe: t(`${jour}T09:00`) }, AUTEUR);
    await ajouterEvenement(
      {
        demandeId: demande.id,
        sens: 'sortant',
        nature: 'envoi_livrable',
        famille: 'T03',
        interlocuteur: 'client',
        source: 'saisie',
        survenuLe: t(`${jour}T11:00`),
        objet: 'Proforma PFI-FICTIVE-004',
        resume: 'Proforma transmise au client pour signature',
      },
      AUTEUR,
    );
    await changerStatut(demande.id, 'termine', AUTEUR, { survenuLe: t(`${jour}T12:00`) });
    return demande;
  }

  it('pre-remplit le daily d’un jour travaille et cite ses evenements', async () => {
    await journeeDeTravail('2026-11-04');
    const bilan = await preparerDaily(compteId, '2026-11-04', AUTEUR);
    expect(bilan.cree).toBe(true);
    const [ligne] = await listerBrouillons(compteId, { type: 'daily' });
    expect(ligne.brouillon.contenu).toContain('04/11/2026');
    expect(ligne.brouillon.contenu).toContain('Alpha Pharma');
    expect((ligne.brouillon.sources as number[]).length).toBeGreaterThan(0);
  });

  it('ne cree pas de daily pour une journee sans activite', async () => {
    expect((await preparerDaily(compteId, '2026-11-04', AUTEUR)).cree).toBe(false);
  });

  it('ne cree pas deux daily pour le meme jour', async () => {
    await journeeDeTravail('2026-11-04');
    await preparerDaily(compteId, '2026-11-04', AUTEUR);
    expect((await preparerDaily(compteId, '2026-11-04', AUTEUR)).cree).toBe(false);
    expect(await listerBrouillons(compteId, { type: 'daily' })).toHaveLength(1);
  });

  it('pre-remplit l’onglet de la semaine sans aucune reference de dossier', async () => {
    await journeeDeTravail('2026-11-04');
    const bilan = await preparerSemaine(compteId, '2026-11-04', AUTEUR);
    expect(bilan.cree).toBe(true);
    const [ligne] = await listerBrouillons(compteId, { type: 'semaine' });
    // Les onglets « sem » ne portent jamais de reference (section 9).
    expect(ligne.brouillon.contenu).not.toMatch(/PFI-FICTIVE-004/);
    expect(ligne.brouillon.contenu).toContain('Dossiers traites');
  });
});

// ---------------------------------------------------------------------------
// Situation client
// ---------------------------------------------------------------------------

describe('tableau de situation par client', () => {
  it('reprend les statuts exacts du reporting client et la prochaine echeance', async () => {
    const demande = await creerDemande({ dossierId, famille: 'T02', objet: 'Enlevement a programmer', ouverteLe: t('2026-11-02T09:00') }, AUTEUR);
    await changerStatut(demande.id, 'attente_tiers', AUTEUR, { survenuLe: t('2026-11-02T10:00') });
    await db.insert(schema.echeances).values({
      dossierId,
      demandeId: demande.id,
      type: 'cut_off',
      libelle: 'Cut-off documentaire',
      echeanceLe: t('2026-11-12T12:00'),
    });

    const { brouillon } = await preparerSituationClient(compteId, 'Alpha Pharma', AUTEUR, t('2026-11-04T09:00'));
    expect(brouillon.contenu).toContain('En attente client');
    expect(brouillon.contenu).toContain('Cut-off documentaire le 12/11/2026');
    expect(brouillon.contenu).toContain('Alpha Pharma');
    // Aucun code technique ne doit remonter dans un texte destine au client.
    expect(brouillon.contenu).not.toMatch(/attente_tiers|cut_off/);
  });

  it('nomme une echeance sans libelle par son type, en francais', async () => {
    const demande = await creerDemande({ dossierId, famille: 'T02', objet: 'Enlevement', ouverteLe: t('2026-11-02T09:00') }, AUTEUR);
    await changerStatut(demande.id, 'attente_tiers', AUTEUR, { survenuLe: t('2026-11-02T10:00') });
    await db.insert(schema.echeances).values({ dossierId, demandeId: demande.id, type: 'etd', echeanceLe: t('2026-11-12T12:00') });
    const { brouillon } = await preparerSituationClient(compteId, 'Alpha Pharma', AUTEUR, t('2026-11-04T09:00'));
    expect(brouillon.contenu).toMatch(/Prochaine echeance : .+ le 12\/11\/2026/);
    expect(brouillon.contenu).not.toContain('etd le');
  });

  it('marque la validation DO attendue', async () => {
    const demande = await creerDemande({ dossierId, famille: 'T03', objet: 'Modification de facture', ouverteLe: t('2026-11-02T09:00') }, AUTEUR);
    await changerStatut(demande.id, 'attente_do', AUTEUR, { survenuLe: t('2026-11-02T10:00') });
    const { brouillon } = await preparerSituationClient(compteId, 'Alpha Pharma', AUTEUR, t('2026-11-04T09:00'));
    expect(brouillon.contenu).toContain('validation DO attendue');
  });

  it('refuse un client sans dossier', async () => {
    await expect(preparerSituationClient(compteId, 'Client inconnu', AUTEUR)).rejects.toThrow(/Aucun dossier/);
  });

  it('exclut les demandes hors perimetre', async () => {
    await demandeT00('en_cours');
    await expect(preparerSituationClient(compteId, 'Alpha Pharma', AUTEUR)).rejects.toThrow(/Aucune demande en perimetre/);
  });
});

// ---------------------------------------------------------------------------
// Comparatif de cotations
// ---------------------------------------------------------------------------

describe('comparatif de cotations fret', () => {
  it('lit prix, cut-off, ETD, ETA, transit et validite dans une offre', () => {
    const offre = extraireOffre(
      'Notre meilleure offre : 1 250 EUR tout compris. Cut-off documentaire le 12/11/2026. ETD 15/11/2026, ETA 22/11/2026. Transit 7 jours. Validite 30/11/2026.',
      42,
      'transitaire-alpha',
      new Date(),
    );
    expect(offre.prix).toBe('1 250');
    expect(offre.devise).toBe('EUR');
    expect(offre.cutOff).toBe('12/11/2026');
    expect(offre.etd).toBe('15/11/2026');
    expect(offre.eta).toBe('22/11/2026');
    expect(offre.transit).toBe('7 jours');
    expect(offre.validite).toBe('30/11/2026');
  });

  it('laisse vide ce qui n’est pas dans le texte, sans rien inventer', () => {
    const offre = extraireOffre('Bonjour, nous revenons vers vous rapidement avec notre cotation.', 1, 'transitaire-beta', new Date());
    expect(offre.prix).toBeNull();
    expect(offre.cutOff).toBeNull();
    expect(offre.etd).toBeNull();
    expect(offre.eta).toBeNull();
    expect(offre.transit).toBeNull();
    expect(offre.validite).toBeNull();
  });

  async function offreRecue(expediteur: string, contenu: string) {
    return ajouterEvenement(
      {
        dossierId,
        sens: 'entrant',
        nature: 'reponse_tiers',
        famille: 'T01',
        interlocuteur: 'transitaire',
        source: 'mail',
        survenuLe: t('2026-11-03T10:00'),
        objet: 'Cotation aerien Barcelone Alger',
        contenu,
        expediteur,
        resume: 'Cotation recue',
      },
      AUTEUR,
    );
  }

  it('construit le comparatif a partir des offres recues et les cite toutes', async () => {
    const a = await offreRecue('ventes@alpha-fret.test', 'Tarif 1 250 EUR. ETD 15/11/2026. Transit 7 jours.');
    const b = await offreRecue('sales@beta-cargo.test', 'Our rate is 1 400 USD. ETD 13/11/2026. Transit 5 days.');
    const { brouillon, offres } = await preparerComparatifCotations(dossierId, AUTEUR);
    expect(offres).toHaveLength(2);
    expect(brouillon.contenu).toContain('1 250 EUR');
    expect(brouillon.contenu).toContain('1 400 USD');
    expect(brouillon.contenu).toContain('Cut-off');
    expect(brouillon.sources).toEqual(expect.arrayContaining([a.evenement.id, b.evenement.id]));
    // Le choix reste humain.
    expect(brouillon.contenu).toContain('revient a la DO');
  });

  it('signale les cases a completer plutot que de deviner un prix', async () => {
    await offreRecue('ventes@alpha-fret.test', 'Nous reviendrons vers vous avec notre tarif.');
    const { brouillon } = await preparerComparatifCotations(dossierId, AUTEUR);
    expect(brouillon.contenu).toContain("rien n'a ete devine");
  });

  it('refuse un dossier sans offre recue', async () => {
    await expect(preparerComparatifCotations(dossierId, AUTEUR)).rejects.toThrow(/Aucune offre/);
  });
});

// ---------------------------------------------------------------------------
// Preparation du matin
// ---------------------------------------------------------------------------

describe('preparation du matin', () => {
  it('prepare relances et daily de la veille, et reste idempotente', async () => {
    await demandeEnAttente({ depuis: t('2026-11-02T09:00') });
    // Mercredi matin : la veille (mardi) a vu passer la demande en attente.
    const premier = await preparerLeMatin(compteId, AUTEUR, t('2026-11-04T06:30'));
    expect(premier.ignore).toBe(false);
    expect(premier.ignore === false && premier.relances).toBe(1);
    const second = await preparerLeMatin(compteId, AUTEUR, t('2026-11-04T06:30'));
    expect(second.ignore === false && second.relances).toBe(0);
  });

  it('ne prepare rien quand les automatisations sont en pause', async () => {
    await demandeEnAttente({ depuis: t('2026-11-02T09:00') });
    await modifierParametres((p) => {
      p.pauseAutomatisations = true;
    });
    try {
      const bilan = await preparerLeMatin(compteId, AUTEUR, t('2026-11-04T06:30'));
      expect(bilan.ignore).toBe(true);
      expect(await listerBrouillons(compteId)).toHaveLength(0);
    } finally {
      await modifierParametres((p) => {
        p.pauseAutomatisations = false;
      });
    }
  });

  it('respecte l’interrupteur de la preparation des relances', async () => {
    await demandeEnAttente({ depuis: t('2026-11-02T09:00') });
    await modifierParametres((p) => {
      p.automatisations.relances = { ...p.automatisations.relances, actif: false };
    });
    try {
      const bilan = await preparerLeMatin(compteId, AUTEUR, t('2026-11-04T06:30'));
      expect(bilan.ignore === false && bilan.relances).toBe(0);
    } finally {
      await modifierParametres((p) => {
        p.automatisations.relances = { ...p.automatisations.relances, actif: true };
      });
    }
  });
});

describe('contenu des brouillons', () => {
  it('ne laisse passer aucun tiret long', async () => {
    await demandeEnAttente({ depuis: t('2026-11-02T09:00'), objet: 'Cotation \u2014 aerien Alger' });
    await preparerRelances(compteId, AUTEUR, t('2026-11-04T09:00'));
    const [ligne] = await listerBrouillons(compteId);
    expect(ligne.brouillon.titre).toContain('Cotation, aerien');
    expect(TIRETS_LONGS.test(ligne.brouillon.contenu)).toBe(false);
    expect(TIRETS_LONGS.test(ligne.brouillon.titre)).toBe(false);
  });
});
