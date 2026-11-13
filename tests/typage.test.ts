/**
 * Typage des evenements : moteur de regles, jeu d'evaluation, file « A classer »,
 * proposition de regle et exclusion du hors perimetre.
 *
 * Criteres de la phase 3 (section 10 de CLAUDE.md) :
 *  - au moins 85 % des mails fictifs annotes bien classes en famille ET nature ;
 *  - un mail T00 n'apparait dans aucune vue ni aucun export ;
 *  - aucune remarque interne extraite.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { baseVierge, creerCompteDeTest, creerPosteDeTest, creerUtilisateurDeTest, db, schema } from './aide';
import { trouverOuCreerDossier } from '../src/server/modules/dossiers/service';
import { ajouterEvenement, aClasser, corrigerTypage } from '../src/server/modules/evenements/service';
import { fileDuJour, AUTEUR_SYSTEME } from '../src/server/modules/demandes/service';
import { construireBlocJour } from '../src/server/modules/export/service';
import { appliquerRegles, REGLES_INITIALES } from '../src/server/modules/typage/regles';
import { accepterRegle, initialiserRegles, reglesActives, reglesProposees, typerMessage } from '../src/server/modules/typage/service';
import { evaluer } from '../src/server/ai/evals/run';
import { MAILS_ANNOTES } from '../src/server/ai/evals/mails-annotes';
import { CODES_FAMILLES } from '../src/shared/constantes';
import { MAILS_TEMOINS } from '../src/server/ai/evals/mails-temoins';
import { contientExpression, estExpediteurAutomatique, normaliserTypage } from '../src/shared/typage';
import { lireParametres, modifierParametres } from '../src/server/lib/parametres';

const AUTEUR = AUTEUR_SYSTEME;

let compteId: number;
let dossierId: number;

beforeAll(async () => {
  await baseVierge();
});

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE comptes_clients, utilisateurs, dossiers, demandes, evenements, transitions_statut, regles_typage, ai_tasks, journal_actions RESTART IDENTITY CASCADE`,
  );
  await creerUtilisateurDeTest('ceo@azmg-solutions.com', 'admin', 'Le CEO');
  compteId = (await creerCompteDeTest()).id;
  const poste = await creerPosteDeTest(compteId);
  dossierId = (await trouverOuCreerDossier({ compteId, posteId: poste.id, client: 'Alpha Pharma', produit: 'Gelules' }, AUTEUR)).dossier.id;
});

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

describe('normalisation', () => {
  it('retire accents et ponctuation, garde les domaines', () => {
    expect(normaliserTypage('Référence : BL-2026/118')).toBe('reference bl 2026 118');
    expect(normaliserTypage('ecrire a contact@exemple-fictif.test')).toBe('ecrire a contact@exemple fictif.test');
  });

  it('transforme un point de fin de phrase en espace', () => {
    // Sans cela, un mot-cle place en fin de phrase ne serait jamais reconnu.
    expect(normaliserTypage('Le SWIFT est en piece jointe.')).toBe('le swift est en piece jointe');
    expect(contientExpression(normaliserTypage('Le SWIFT est en piece jointe.'), 'en piece jointe')).toBe(true);
  });

  it('reconnait un mot au pluriel', () => {
    const texte = normaliserTypage('Comparatif des cotations et des surestaries');
    expect(contientExpression(texte, 'cotation')).toBe(true);
    expect(contientExpression(texte, 'surestarie')).toBe(true);
  });

  it('ne reconnait pas un mot inclus dans un autre', () => {
    expect(contientExpression(normaliserTypage('facturation mensuelle'), 'facture')).toBe(false);
  });

  it('cherche une expression de plusieurs mots telle quelle', () => {
    expect(contientExpression(normaliserTypage('merci de valider le prix'), 'merci de valider')).toBe(true);
    expect(contientExpression(normaliserTypage('en attente de votre retour'), 'merci de valider')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Critere principal de la phase 3
// ---------------------------------------------------------------------------

describe('jeu d’evaluation', () => {
  it('contient 60 mails fictifs au moins, couvrant toutes les familles et les 10 natures', () => {
    expect(MAILS_ANNOTES.length).toBeGreaterThanOrEqual(60);
    // Chaque famille du referentiel est representee, celles de la designer comprises.
    const couvertes = new Set(MAILS_ANNOTES.map((m) => m.attendu.famille));
    for (const code of CODES_FAMILLES) expect([...couvertes], `famille ${code}`).toContain(code);
    expect(new Set(MAILS_ANNOTES.map((m) => m.attendu.nature)).size).toBe(10);
  });

  it('classe au moins 85 % des mails en famille ET nature', () => {
    const bilan = evaluer(MAILS_ANNOTES);
    expect(bilan.tauxLesDeux, `obtenu ${Math.round(bilan.tauxLesDeux * 100)} %`).toBeGreaterThanOrEqual(0.85);
  });

  it('tient le meme niveau sur un jeu temoin qui n’a pas servi a regler les regles', () => {
    // C'est cette mesure qui compte : le jeu principal a servi a construire le moteur, y briller
    // ne prouve rien. Le jeu temoin a ete ecrit apres coup, avec d'autres tournures.
    const bilan = evaluer(MAILS_TEMOINS);
    expect(bilan.tauxLesDeux, `obtenu ${Math.round(bilan.tauxLesDeux * 100)} % sur le jeu temoin`).toBeGreaterThanOrEqual(0.85);
  });

  it('n’utilise que des donnees fictives', () => {
    for (const mail of [...MAILS_ANNOTES, ...MAILS_TEMOINS]) {
      // Les adresses sont toutes en .test, domaine reserve et jamais routable.
      expect(mail.expediteur, mail.reference).toMatch(/\.test$/);
      expect(mail.expediteur, mail.reference).not.toMatch(/masenz\.|@masenz\.com/);
    }
  });
});

// ---------------------------------------------------------------------------
// Moteur de regles
// ---------------------------------------------------------------------------

describe('moteur de regles', () => {
  it('applique la regle la plus prioritaire qui correspond', () => {
    const r = appliquerRegles({ objet: 'Cotation fret aerien', corps: 'Voici notre offre.', sens: 'entrant' });
    expect(r?.typage.famille).toBe('T01');
    expect(r?.typage.origine).toBe('regle');
  });

  it('cumule les regles : une donne la famille, une autre la nature', () => {
    const r = appliquerRegles({ objet: 'Proforma a valider', corps: 'Merci de valider la modification.', sens: 'sortant' });
    expect(r?.typage.famille).toBe('T03');
    expect(r?.typage.nature).toBe('demande_validation_do');
  });

  it('respecte le sens impose par une regle', () => {
    // « je valide » est une validation de la DO, seulement sur un message entrant.
    expect(appliquerRegles({ objet: 'Re : prix', corps: 'Je valide le prix.', sens: 'entrant' })?.typage.nature).toBe('validation_do');
    expect(appliquerRegles({ objet: 'Re : prix', corps: 'Je valide le prix.', sens: 'sortant' })?.typage.nature).not.toBe('validation_do');
  });

  it('ecarte une regle quand un mot d’exclusion est present', () => {
    // La regle « design » exclut les etiquettes, qui relevent de la qualite.
    const r = appliquerRegles({ objet: 'Maquette etiquette produit', corps: 'Voici la maquette de l etiquette.', sens: 'entrant' });
    expect(r?.typage.famille).not.toBe('T00');
  });

  it('donne une confiance elevee au hors perimetre, qui doit sortir vite', () => {
    const r = appliquerRegles({ objet: 'Newsletter de novembre', corps: 'Pour ne plus recevoir nos messages.', sens: 'entrant' });
    expect(r?.typage.famille).toBe('T00');
    expect(r?.typage.confiance).toBeGreaterThanOrEqual(0.85);
  });

  it('garde une confiance basse quand il deduit la nature du sens', () => {
    // Une regle donne la famille, aucune ne donne la nature : elle est deduite du sens, et la
    // confiance baisse pour que le cas puisse passer sous le seuil.
    const r = appliquerRegles({ objet: 'Dossier de cotation Alger', corps: 'Quelques elements sur le dossier.', sens: 'entrant' });
    expect(r?.typage.famille).toBe('T01');
    expect(r?.typage.nature).toBe('information');
    expect(r?.typage.confiance).toBeLessThan(0.8);
  });

  it('ne repond rien plutot que d\u2019inventer quand aucune regle ne correspond', () => {
    // Un message sans aucun signal ne recoit pas de nature par defaut : il n'y a rien sur quoi
    // s'appuyer, et un classement invente vaut moins qu'un passage par « A classer ».
    expect(appliquerRegles({ objet: 'Dossier', corps: 'Quelques elements.', sens: 'entrant' })).toBeNull();
    expect(appliquerRegles({ objet: '', corps: '' })).toBeNull();
  });
});

describe('regles en base', () => {
  it('copie le referentiel initial au premier demarrage, sans doublon', async () => {
    const premier = await initialiserRegles();
    expect(premier.ajoutees).toBe(REGLES_INITIALES.length);
    const second = await initialiserRegles();
    expect(second.ajoutees).toBe(0);
    const actives = await reglesActives();
    expect(actives.length).toBe(REGLES_INITIALES.length);
  });

  it('retombe sur le referentiel initial si la base est vide', async () => {
    const actives = await reglesActives();
    expect(actives.length).toBe(REGLES_INITIALES.length);
  });
});

// ---------------------------------------------------------------------------
// Typage d'un message et file « A classer »
// ---------------------------------------------------------------------------

describe('expediteurs automatiques et notifications', () => {
  it('reconnait une boite a laquelle on ne peut pas repondre', () => {
    for (const adresse of [
      'no-reply@exemple-fictif.test',
      'noreply@exemple-fictif.test',
      'noresponder@exemple-fictif.test',
      'ne-pas-repondre@exemple-fictif.test',
      'MAILER-DAEMON@exemple-fictif.test',
      'bounces+123@exemple-fictif.test',
    ]) {
      expect(estExpediteurAutomatique(adresse), adresse).toBe(true);
    }
  });

  it('ne prend pas un humain, ni un avis de transporteur, pour un automate', () => {
    // « tracking@ » et « notification@ » sont volontairement hors de la liste : un avis de
    // transporteur porte sur un dossier reel, et le classer hors perimetre cacherait du travail.
    for (const adresse of [
      'export@exemple-fictif.test',
      'marketing@exemple-fictif.test',
      'tracking@transitaire-fictif.test',
      'notification@transitaire-fictif.test',
      'replay@exemple-fictif.test',
    ]) {
      expect(estExpediteurAutomatique(adresse), adresse).toBe(false);
    }
  });

  it('classe hors perimetre un message venu d’un automate, sans passer par l’IA', async () => {
    const resultat = await typerMessage({
      objet: 'Votre rapport hebdomadaire est disponible',
      corps: 'Consultez votre rapport en ligne.',
      expediteur: 'no-reply@outil-fictif.test',
      destinataires: ['info@client-fictif.test'],
      sens: 'entrant',
    });
    expect(resultat.typage.famille).toBe('T00');
    expect(resultat.applicable).toBe(true);
    // Aucune tache IA n'est creee : le test est structurel et gratuit.
    expect(resultat.tacheIaId).toBeNull();
  });

  it('classe hors perimetre les notifications du CRM, sur leur domaine d’envoi', () => {
    const resultat = appliquerRegles(
      {
        objet: 'Societe fictive Dupont',
        corps: 'Societe fictive https://exemple.clientify.test/contacts/details/1/ revision contact new warm lead',
        expediteur: 'export@clientes.clientifymail.com',
        destinataires: ['info@client-fictif.test'],
        sens: 'entrant',
      },
      REGLES_INITIALES,
    );
    expect(resultat?.typage.famille).toBe('T00');
  });

  it('laisse passer une consigne de la donneuse d’ordre, elle n’est pas une notification', () => {
    const resultat = appliquerRegles(
      {
        objet: 'RE: DAILY REPORT - Retouche du catalogue',
        corps: 'Tu dois revoir le catalogue, les fiches techniques contiennent tous les details. Echeance le 15.',
        expediteur: 'export@client-fictif.test',
        destinataires: ['marketing@client-fictif.test'],
        sens: 'entrant',
      },
      REGLES_INITIALES,
    );
    expect(resultat?.typage.famille).not.toBe('T00');
    expect(resultat?.typage.confiance).toBeGreaterThanOrEqual(0.8);
  });
});

describe('typage d’un message', () => {
  it('applique le typage au-dessus du seuil', async () => {
    const r = await typerMessage({ objet: 'Cotation fret aerien vers Alger', corps: 'Merci de nous coter 180 kg.', sens: 'entrant' });
    expect(r.applicable).toBe(true);
    expect(r.typage.famille).toBe('T01');
  });

  it('ne l’applique pas sous le seuil', async () => {
    const r = await typerMessage({ objet: 'Suite', corps: 'Bonjour, merci de votre retour.', sens: 'entrant' }, { sansIa: true });
    expect(r.applicable).toBe(false);
    expect(r.typage.confiance).toBeLessThan((await lireParametres()).seuilConfianceTypage);
  });

  it('tranche le hors perimetre sans passer par l’IA', async () => {
    const r = await typerMessage({ objet: 'Webinaire gratuit', corps: 'Inscrivez vous a notre webinaire.', sens: 'entrant' });
    expect(r.typage.famille).toBe('T00');
    expect(r.applicable).toBe(true);
    expect(r.tacheIaId).toBeNull();
  });

  it('respecte l’interrupteur des automatisations', async () => {
    await modifierParametres((p) => {
      p.pauseAutomatisations = true;
    });
    const r = await typerMessage({ objet: 'Message ambigu', corps: 'Quelques mots.', sens: 'entrant' });
    expect(r.tacheIaId).toBeNull();
    await modifierParametres((p) => {
      p.pauseAutomatisations = false;
    });
  });
});

describe('typage automatique a l’ajout d’un evenement', () => {
  it('complete la famille manquante', async () => {
    const r = await ajouterEvenement(
      {
        dossierId,
        sens: 'entrant',
        nature: 'demande_entrante',
        source: 'mail',
        objet: 'Cotation fret aerien vers Alger',
        contenu: 'Pourriez vous nous coter 180 kg en aerien ?',
        expediteur: 'ops@transit-fictif.test',
      },
      AUTEUR,
      { typerAutomatiquement: true },
    );
    expect(r.evenement.famille).toBe('T01');
    expect(r.evenement.confianceTypage).toBeGreaterThan(0);
  });

  it('n’ecrase jamais ce qu’un humain a saisi', async () => {
    const r = await ajouterEvenement(
      {
        dossierId,
        sens: 'entrant',
        nature: 'demande_entrante',
        famille: 'T06',
        source: 'mail',
        objet: 'Cotation fret aerien',
        contenu: 'Merci de coter.',
      },
      AUTEUR,
      { typerAutomatiquement: true },
    );
    // Le typage aurait dit T01 : la saisie humaine prime.
    expect(r.evenement.famille).toBe('T06');
  });

  it('laisse l’evenement sans famille quand la confiance est trop basse', async () => {
    const r = await ajouterEvenement(
      { dossierId, sens: 'entrant', nature: 'information', source: 'mail', objet: 'Suite', contenu: 'Bonjour.' },
      AUTEUR,
      { typerAutomatiquement: true },
    );
    expect(r.evenement.famille).toBeNull();
    const parametres = await lireParametres();
    const liste = await aClasser(parametres.seuilConfianceTypage);
    expect(liste.some((l) => l.evenement.id === r.evenement.id)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Proposition de regle a chaque correction
// ---------------------------------------------------------------------------

describe('proposition de regle', () => {
  async function evenementAClasser() {
    const [evenement] = await db
      .insert(schema.evenements)
      .values({
        dossierId,
        compteId,
        sens: 'entrant',
        nature: 'information',
        source: 'mail',
        survenuLe: new Date(),
        objet: 'Avis de surestaries terminal Casablanca',
        expediteur: 'ops@terminal-fictif.test',
        famille: null,
        confianceTypage: 0.3,
      })
      .returning();
    return evenement;
  }

  it('propose une regle a chaque correction manuelle', async () => {
    const evenement = await evenementAClasser();
    await corrigerTypage(evenement.id, { famille: 'T14', interlocuteur: 'transporteur' }, AUTEUR);
    const propositions = await reglesProposees();
    expect(propositions).toHaveLength(1);
    expect(propositions[0].famille).toBe('T14');
    expect(propositions[0].motsCles as string[]).toContain('surestaries');
    expect(propositions[0].domaine).toBe('terminal-fictif.test');
  });

  it('ne classe rien tant qu’elle n’est pas acceptee', async () => {
    await initialiserRegles();
    const evenement = await evenementAClasser();
    await corrigerTypage(evenement.id, { famille: 'T14' }, AUTEUR);
    const avant = await reglesActives();
    expect(avant.some((r) => r.libelle.startsWith('Propose depuis'))).toBe(false);

    const [proposition] = await reglesProposees();
    await accepterRegle(proposition.id, AUTEUR);
    const apres = await reglesActives();
    expect(apres.some((r) => r.libelle.startsWith('Propose depuis'))).toBe(true);
  });

  it('ne retient pas le domaine du poste lui-meme', async () => {
    const [evenement] = await db
      .insert(schema.evenements)
      .values({
        dossierId,
        compteId,
        sens: 'sortant',
        nature: 'envoi_livrable',
        source: 'mail',
        survenuLe: new Date(),
        objet: 'Transmission du connaissement corrige',
        expediteur: 'elysa@azmg-solutions.com',
        famille: null,
      })
      .returning();
    await corrigerTypage(evenement.id, { famille: 'T02' }, AUTEUR);
    const [proposition] = await reglesProposees();
    // Une regle sur le domaine du poste classerait tous ses propres envois de la meme facon.
    expect(proposition.domaine).toBeNull();
    expect(proposition.motsCles as string[]).toContain('connaissement');
  });

  it('ecarte les mots vides de l’objet', async () => {
    const [evenement] = await db
      .insert(schema.evenements)
      .values({
        dossierId,
        compteId,
        sens: 'entrant',
        nature: 'information',
        source: 'mail',
        survenuLe: new Date(),
        objet: 'Re : Bonjour, merci pour votre message',
        expediteur: 'client@exemple-fictif.test',
        famille: null,
      })
      .returning();
    await corrigerTypage(evenement.id, { famille: 'T04' }, AUTEUR);
    const [proposition] = await reglesProposees();
    const mots = (proposition?.motsCles as string[]) ?? [];
    for (const vide of ['bonjour', 'merci', 'votre', 'pour']) expect(mots).not.toContain(vide);
  });
});

// ---------------------------------------------------------------------------
// Hors perimetre et confidentialite
// ---------------------------------------------------------------------------

describe('hors perimetre (T00)', () => {
  it('un mail T00 type automatiquement n’apparait dans aucune vue ni aucun export', async () => {
    const jour = new Date().toISOString().slice(0, 10);
    await ajouterEvenement(
      {
        dossierId,
        sens: 'entrant',
        nature: 'demande_entrante',
        source: 'mail',
        objet: 'Newsletter de novembre',
        contenu: 'Pour ne plus recevoir nos messages, cliquez sur se desinscrire.',
        expediteur: 'news@veille-fictive.test',
      },
      AUTEUR,
      { typerAutomatiquement: true },
    );
    // Un evenement utile le meme jour, pour verifier que l'export n'est pas vide par accident.
    await ajouterEvenement(
      {
        dossierId,
        sens: 'entrant',
        nature: 'demande_entrante',
        source: 'mail',
        objet: 'Cotation fret aerien vers Alger',
        contenu: 'Pourriez vous nous coter 180 kg ?',
        expediteur: 'ops@transit-fictif.test',
      },
      AUTEUR,
      { typerAutomatiquement: true },
    );

    const evenements = await db.select().from(schema.evenements).where(eq(schema.evenements.famille, 'T00'));
    expect(evenements).toHaveLength(1);
    // Trace, mais aucune demande ouverte.
    expect(evenements[0].demandeId).toBeNull();

    const file = await fileDuJour({ compteId });
    expect(file.every((l) => l.famille !== 'T00')).toBe(true);

    const bloc = await construireBlocJour(compteId, jour);
    expect(JSON.stringify(bloc)).not.toContain('Newsletter');
    expect(bloc.lignes.length).toBeGreaterThan(0);

    const { chronologieDossier } = await import('../src/server/modules/dossiers/service');
    const chrono = await chronologieDossier(dossierId);
    expect(chrono.some((l) => l.titre.includes('Newsletter'))).toBe(false);
  });

  it('n’apparait pas dans la file « A classer » : il n’y a rien a classer', async () => {
    await ajouterEvenement(
      { dossierId, sens: 'entrant', nature: 'demande_entrante', source: 'mail', objet: 'Webinaire gratuit', contenu: 'Inscrivez vous.' },
      AUTEUR,
      { typerAutomatiquement: true },
    );
    const liste = await aClasser(0.8);
    expect(liste.every((l) => l.evenement.famille !== 'T00')).toBe(true);
  });
});

describe('confidentialite du typage', () => {
  it('le prompt interdit de reprendre une appreciation sur le collaborateur', async () => {
    const { promptTyperEvenement } = await import('../src/server/ai/prompts/typer-evenement');
    const prompt = promptTyperEvenement();
    expect(prompt).toMatch(/appreciation du client sur la personne qui tient le poste/i);
    expect(prompt).toMatch(/n.invente rien/i);
    expect(prompt).toMatch(/tiret long/i);
  });

  it('n’extrait aucune remarque interne dans les justificatifs', async () => {
    // Un message qui contient un reproche : le typage ne doit retenir que le sujet du dossier.
    const r = await typerMessage(
      {
        objet: 'Cotation fret aerien vers Alger',
        corps: 'Pourriez vous nous coter 180 kg ? Par ailleurs votre assistante est tres lente et peu rigoureuse.',
        sens: 'entrant',
      },
      { sansIa: true },
    );
    const texte = JSON.stringify(r.typage.justificatifs);
    for (const mot of ['lente', 'rigoureuse', 'assistante']) expect(texte.toLowerCase()).not.toContain(mot);
  });

  it('les justificatifs des regles nomment la regle, pas le contenu du message', async () => {
    const r = appliquerRegles({ objet: 'Relance solde a payer', corps: 'Pour rappel, le solde reste du.', sens: 'sortant' });
    expect(r?.typage.justificatifs.every((j) => typeof j === 'string' && j.length < 120)).toBe(true);
    expect(r?.typage.justificatifs.join(' ')).not.toContain('solde reste du');
  });
});
