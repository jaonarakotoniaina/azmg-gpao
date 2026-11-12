/**
 * Collecte des mails (phase 4).
 *
 * Criteres de la section 10 :
 *  - un fil importe deux fois ne cree aucun doublon ;
 *  - un mail sortant de demande de validation fait passer la demande en « En attente DO » ;
 *  - la reponse de la DO la fait repasser en cours.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import { eq, sql } from 'drizzle-orm';
import { baseVierge, creerCompteDeTest, creerPosteDeTest, db, schema } from './aide';
import { trouverOuCreerDossier } from '../src/server/modules/dossiers/service';
import { AUTEUR_SYSTEME } from '../src/server/modules/demandes/service';
import { analyserMessage, decouperMbox, identifiantFil, signerCharge, verifierSignature } from '../src/server/adapters/collecte-mail';
import {
  configDuCompte,
  demandeDuFil,
  enregistrerLot,
  exigerCompteCollecte,
  enregistrerMessage,
  objetNormalise,
  posteDuMessage,
  sensDuMessage,
} from '../src/server/modules/collecte/service';
import { creerPoste } from '../src/server/modules/comptes/service';
import { appliquerRegles } from '../src/server/modules/typage/regles';
import { initialiserRegles } from '../src/server/modules/typage/service';
import { cheminAbsolu, extensionAcceptee, rangerFichier } from '../src/server/lib/stockage';

const AUTEUR = AUTEUR_SYSTEME;

let compteId: number;
let posteId: number;
let dossierId: number;

/** Construit un mail brut au format RFC 5322, avec ses en-tetes de fil. */
function mailBrut(o: {
  messageId: string;
  de: string;
  a: string;
  objet: string;
  corps: string;
  date?: string;
  references?: string;
  inReplyTo?: string;
}): Buffer {
  const lignes = [
    `Message-ID: ${o.messageId}`,
    `From: ${o.de}`,
    `To: ${o.a}`,
    `Subject: ${o.objet}`,
    `Date: ${o.date ?? 'Mon, 02 Mar 2026 09:00:00 +0100'}`,
    o.references ? `References: ${o.references}` : null,
    o.inReplyTo ? `In-Reply-To: ${o.inReplyTo}` : null,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
  ].filter((l): l is string => l !== null);
  // La ligne vide separe les en-tetes du corps : elle ne doit surtout pas etre filtree.
  return Buffer.from([...lignes, '', o.corps].join('\r\n'), 'utf8');
}

beforeAll(async () => {
  await baseVierge();
  await initialiserRegles();
});

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE comptes_clients, dossiers, demandes, evenements, transitions_statut, pieces, journal_actions RESTART IDENTITY CASCADE`,
  );
  compteId = (await creerCompteDeTest()).id;
  posteId = (await creerPosteDeTest(compteId)).id;
  dossierId = (await trouverOuCreerDossier({ compteId, posteId, client: 'Alpha Pharma', produit: 'Gelules 180 kg' }, AUTEUR)).dossier.id;
});

// ---------------------------------------------------------------------------
// Analyse d'un message
// ---------------------------------------------------------------------------

describe('analyse d’un message', () => {
  it('extrait les en-tetes, le corps et l’horodatage d’origine', async () => {
    const message = await analyserMessage(
      mailBrut({
        messageId: '<a1@exemple-fictif.test>',
        de: 'Operations <ops@transit-fictif.test>',
        a: 'elysa@azmg-solutions.com',
        objet: 'Cotation fret aerien vers Alger',
        corps: 'Voici notre offre pour 180 kg.',
        date: 'Tue, 03 Mar 2026 14:30:00 +0100',
      }),
    );
    expect(message.messageId).toBe('<a1@exemple-fictif.test>');
    expect(message.expediteur).toBe('ops@transit-fictif.test');
    expect(message.destinataires).toContain('elysa@azmg-solutions.com');
    expect(message.objet).toBe('Cotation fret aerien vers Alger');
    expect(message.corps).toContain('180 kg');
    expect(message.survenuLe.toISOString()).toBe('2026-03-03T13:30:00.000Z');
  });

  it('convertit un corps HTML en texte lisible', async () => {
    const brut = Buffer.from(
      [
        'Message-ID: <html1@exemple-fictif.test>',
        'From: a@exemple-fictif.test',
        'To: b@azmg-solutions.com',
        'Subject: Essai',
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=utf-8',
        '',
        '<p>Bonjour,</p><p>Le <b>BL</b> est pret.</p><style>p{color:red}</style>',
      ].join('\r\n'),
      'utf8',
    );
    const message = await analyserMessage(brut);
    expect(message.corps).toContain('Bonjour');
    expect(message.corps).toContain('BL');
    expect(message.corps).not.toContain('<p>');
    expect(message.corps).not.toContain('color:red');
  });

  it('donne un identifiant de secours a un message qui n’en a pas', async () => {
    const brut = Buffer.from('From: a@exemple-fictif.test\r\nSubject: Sans identifiant\r\n\r\nCorps.', 'utf8');
    const message = await analyserMessage(brut);
    expect(message.messageId).toMatch(/@azmg-gpao>$/);
  });

  it('prend la tete du fil dans les references', () => {
    expect(identifiantFil('<c3@x.test>', '<a1@x.test> <b2@x.test>')).toBe('<a1@x.test>');
    expect(identifiantFil('<c3@x.test>', undefined, '<b2@x.test>')).toBe('<b2@x.test>');
    expect(identifiantFil('<c3@x.test>')).toBe('<c3@x.test>');
  });

  it('normalise un objet de reponse ou de transfert', () => {
    expect(objetNormalise('Re : Cotation fret')).toBe('Cotation fret');
    expect(objetNormalise('TR: Fwd: Cotation fret')).toBe('Cotation fret');
    expect(objetNormalise('Cotation fret')).toBe('Cotation fret');
  });

  it('deduit le sens selon le domaine de l’expediteur', () => {
    const base = { messageId: '<x>', filId: '<x>', destinataires: [], objet: '', corps: '', survenuLe: new Date(), pieces: [] };
    const interne = { domainesInternes: ['azmg-solutions.com'] };
    expect(sensDuMessage({ ...base, expediteur: 'elysa@azmg-solutions.com' }, interne)).toBe('sortant');
    expect(sensDuMessage({ ...base, expediteur: 'client@exemple-fictif.test' }, interne)).toBe('entrant');
  });

  it('reconnait un envoi du poste depuis une adresse du client', () => {
    // Cas reel du poste : il ecrit depuis une boite du client, sur le meme domaine que la DO.
    // Au domaine seul, tout ce qu'il envoie serait lu comme du courrier recu.
    const base = { messageId: '<x>', filId: '<x>', objet: '', corps: '', survenuLe: new Date(), pieces: [] };
    const config = { adressesPoste: ['info@client-fictif.test'], domainesInternes: ['azmg-solutions.com'] };
    expect(sensDuMessage({ ...base, destinataires: ['do@client-fictif.test'], expediteur: 'info@client-fictif.test' }, config)).toBe('sortant');
    // La DO, sur le meme domaine, reste un interlocuteur entrant.
    expect(sensDuMessage({ ...base, destinataires: ['info@client-fictif.test'], expediteur: 'do@client-fictif.test' }, config)).toBe('entrant');
    // Mise en forme avec nom d'affichage et chevrons.
    expect(sensDuMessage({ ...base, destinataires: [], expediteur: '"Le Poste" <INFO@client-fictif.test>' }, config)).toBe('sortant');
  });

  it('lit comme entrant un message adresse au poste par un interne', () => {
    const base = { messageId: '<x>', filId: '<x>', objet: '', corps: '', survenuLe: new Date(), pieces: [] };
    const config = { adressesPoste: ['info@client-fictif.test'], domainesInternes: ['azmg-solutions.com'] };
    expect(
      sensDuMessage({ ...base, expediteur: 'manager@azmg-solutions.com', destinataires: ['info@client-fictif.test'] }, config),
    ).toBe('entrant');
  });
});

/**
 * Forme reelle du compte : le poste ecrit depuis une boite du client (par exemple « info »), sur
 * le meme domaine que la donneuse d'ordre (« export »). Le sens ne peut alors pas se deduire du
 * domaine, et c'est le cas qui compte en production.
 */
describe('poste et donneuse d’ordre sur le domaine du client', () => {
  beforeEach(async () => {
    await db.update(schema.postes).set({ adresses: ['info@client-fictif.test'] }).where(eq(schema.postes.id, posteId));
    await db
      .update(schema.comptesClients)
      .set({ donneurOrdreEmail: 'export@client-fictif.test' })
      .where(eq(schema.comptesClients.id, compteId));
  });

  it('passe en attente DO sur un envoi a la DO, meme sans mot de validation', async () => {
    const messages = await Promise.all(
      [
        mailBrut({
          messageId: '<d1@exemple-fictif.test>',
          de: 'achat@alpha-fictif.test',
          a: 'info@client-fictif.test',
          objet: 'Proforma a etablir',
          corps: 'Pourriez vous nous etablir la proforma en dollars pour cette commande ?',
          date: 'Mon, 02 Mar 2026 09:00:00 +0100',
        }),
        // Un simple transfert a la DO, sans aucun mot de validation : c'est la forme habituelle.
        mailBrut({
          messageId: '<d2@exemple-fictif.test>',
          de: 'info@client-fictif.test',
          a: 'export@client-fictif.test',
          objet: 'TR: Proforma a etablir',
          corps: 'fw',
          date: 'Mon, 02 Mar 2026 11:00:00 +0100',
          references: '<d1@exemple-fictif.test>',
        }),
      ].map((m) => analyserMessage(m)),
    );

    await enregistrerLot(messages, { compteId, posteId, dossierParDefautId: dossierId }, AUTEUR);
    const [demande] = await db.select().from(schema.demandes);
    expect(demande.statut).toBe('attente_do');
    expect(demande.acteurAttendu).toBe('do');

    // Le message du poste est bien enregistre comme sortant, et son interlocuteur est la DO.
    const [, sortant] = await db.select().from(schema.evenements).orderBy(schema.evenements.survenuLe);
    expect(sortant.sens).toBe('sortant');
    expect(sortant.interlocuteur).toBe('do');
  });

  it('repasse en cours sur la reponse de la DO, venue du meme domaine que le poste', async () => {
    const messages = await Promise.all(
      [
        mailBrut({
          messageId: '<e1@exemple-fictif.test>',
          de: 'achat@alpha-fictif.test',
          a: 'info@client-fictif.test',
          objet: 'Proforma a etablir',
          corps: 'Pourriez vous nous etablir la proforma en dollars pour cette commande ?',
          date: 'Mon, 02 Mar 2026 08:00:00 +0100',
        }),
        mailBrut({
          messageId: '<e2@exemple-fictif.test>',
          de: 'info@client-fictif.test',
          a: 'export@client-fictif.test',
          objet: 'TR: Proforma a etablir',
          corps: 'Peux tu valider la proforma avant envoi au client ?',
          date: 'Mon, 02 Mar 2026 09:00:00 +0100',
          references: '<e1@exemple-fictif.test>',
        }),
        mailBrut({
          messageId: '<e3@exemple-fictif.test>',
          de: 'export@client-fictif.test',
          a: 'info@client-fictif.test',
          objet: 'RE: Proforma a etablir',
          corps: 'Je valide, tu peux envoyer.',
          date: 'Mon, 02 Mar 2026 15:00:00 +0100',
          references: '<e1@exemple-fictif.test> <e2@exemple-fictif.test>',
        }),
      ].map((m) => analyserMessage(m)),
    );

    await enregistrerLot(messages, { compteId, posteId, dossierParDefautId: dossierId }, AUTEUR);
    const [demande] = await db.select().from(schema.demandes);
    expect(demande.statut).toBe('en_cours');
    expect(demande.acteurAttendu).toBe('poste');
  });

  it('n’ouvre aucune demande sur un simple envoi du poste', async () => {
    const message = await analyserMessage(
      mailBrut({
        messageId: '<f9@exemple-fictif.test>',
        de: 'info@client-fictif.test',
        a: 'client@alpha-fictif.test',
        objet: 'Documents d’expedition',
        corps: 'Veuillez trouver ci-joint le BL et la packing list.',
        date: 'Mon, 02 Mar 2026 09:00:00 +0100',
      }),
    );
    await enregistrerLot([message], { compteId, posteId, dossierParDefautId: dossierId }, AUTEUR);
    const [evenement] = await db.select().from(schema.evenements);
    // Lu comme sortant grace a l'adresse du poste, et non comme une demande du client.
    expect(evenement.sens).toBe('sortant');
    expect(await db.select().from(schema.demandes)).toHaveLength(0);
  });
});

/**
 * Un compte peut porter plusieurs postes : l'assistante export et la designer. Leurs mails
 * arrivent dans la meme boite de suivi, et chacun doit rejoindre son poste.
 */
describe('plusieurs postes sur un meme compte', () => {
  let posteDesignerId: number;

  beforeEach(async () => {
    await db.update(schema.postes).set({ adresses: ['info@client-fictif.test'] }).where(eq(schema.postes.id, posteId));
    posteDesignerId = (
      await creerPoste({ compteId, intitule: 'Designer', metier: 'designer', adresses: ['marketing@client-fictif.test'] }, AUTEUR)
    ).id;
    await db
      .update(schema.comptesClients)
      .set({ donneurOrdreEmail: 'export@client-fictif.test' })
      .where(eq(schema.comptesClients.id, compteId));
  });

  const base = { messageId: '<x>', filId: '<x>', objet: '', corps: '', survenuLe: new Date(), pieces: [] };

  it('rattache un message au poste dont l’adresse est l’expediteur', async () => {
    const config = await configDuCompte(compteId);
    expect(posteDuMessage({ ...base, expediteur: 'marketing@client-fictif.test', destinataires: [] }, config.postes, null)).toBe(
      posteDesignerId,
    );
    expect(posteDuMessage({ ...base, expediteur: 'info@client-fictif.test', destinataires: [] }, config.postes, null)).toBe(posteId);
  });

  it('rattache au poste destinataire quand l’expediteur est un tiers', async () => {
    const config = await configDuCompte(compteId);
    expect(
      posteDuMessage({ ...base, expediteur: 'do@client-fictif.test', destinataires: ['marketing@client-fictif.test'] }, config.postes, null),
    ).toBe(posteDesignerId);
  });

  it('se rabat sur la famille quand aucune adresse ne tranche', async () => {
    const config = await configDuCompte(compteId);
    // D02 n'appartient qu'au poste de designer, T01 qu'au poste d'export.
    expect(posteDuMessage({ ...base, expediteur: 'tiers@inconnu.test', destinataires: [] }, config.postes, 'D02')).toBe(posteDesignerId);
    expect(posteDuMessage({ ...base, expediteur: 'tiers@inconnu.test', destinataires: [] }, config.postes, 'T01')).toBe(posteId);
  });

  it('ne choisit pas au hasard sur une famille partagee par les deux postes', async () => {
    const config = await configDuCompte(compteId);
    // T09, le reporting quotidien, appartient aux deux : mieux vaut un rattachement a la main.
    expect(posteDuMessage({ ...base, expediteur: 'tiers@inconnu.test', destinataires: [] }, config.postes, 'T09')).toBeNull();
  });

  it('lit comme sortant un mail parti de la designer, et le range sur son poste', async () => {
    const message = await analyserMessage(
      mailBrut({
        messageId: '<g1@exemple-fictif.test>',
        de: 'marketing@client-fictif.test',
        a: 'export@client-fictif.test',
        objet: 'Brouillon linkedin a valider',
        corps: 'Voici le brouillon linkedin des publications de la semaine, merci de valider.',
        date: 'Mon, 02 Mar 2026 09:00:00 +0100',
      }),
    );
    await enregistrerLot([message], { compteId }, AUTEUR);
    const [evenement] = await db.select().from(schema.evenements);
    expect(evenement.sens).toBe('sortant');
    // Le travail de la designer a sa famille : il n'est plus avale par T00.
    expect(evenement.famille).toBe('D01');
    const [dossier] = await db.select().from(schema.dossiers).where(eq(schema.dossiers.posteId, posteDesignerId));
    expect(dossier).toBeDefined();
  });

  it('laisse le travail de la designer hors de la file de l’assistante export', async () => {
    const messages = await Promise.all(
      [
        mailBrut({
          messageId: '<h1@exemple-fictif.test>',
          de: 'marketing@client-fictif.test',
          a: 'export@client-fictif.test',
          objet: 'Banniere du salon',
          corps: 'La banniere et le kakemono du stand sont prets, merci de valider.',
          date: 'Mon, 02 Mar 2026 09:00:00 +0100',
        }),
        mailBrut({
          messageId: '<h2@exemple-fictif.test>',
          de: 'achat@alpha-fictif.test',
          a: 'info@client-fictif.test',
          objet: 'Proforma a etablir',
          corps: 'Pourriez vous nous etablir la proforma en dollars pour cette commande ?',
          date: 'Mon, 02 Mar 2026 10:00:00 +0100',
        }),
      ].map((m) => analyserMessage(m)),
    );
    await enregistrerLot(messages, { compteId }, AUTEUR);

    const demandes = await db.select({ posteId: schema.demandes.posteId, famille: schema.demandes.famille }).from(schema.demandes);
    const dExport = demandes.filter((d) => d.posteId === posteId);
    const dDesigner = demandes.filter((d) => d.posteId === posteDesignerId);
    // Chaque poste ne voit que son travail, et aucun des deux n'est vide.
    expect(dExport.every((d) => d.famille.startsWith('T'))).toBe(true);
    expect(dExport.some((d) => d.famille.startsWith('D'))).toBe(false);
    expect(demandes).toHaveLength(dExport.length + dDesigner.length);
  });
});

describe('garde-fou du webhook : le compte doit exister', () => {
  it('accepte un compte actif', async () => {
    await expect(exigerCompteCollecte(compteId)).resolves.toBeUndefined();
  });

  it('refuse un compte inconnu, pour que le script reessaie', async () => {
    // Le script n'etiquette un fil qu'apres un succes. Un refus le fait reessayer ; un succes avec
    // des erreurs dans le bilan lui ferait etiqueter des fils dont rien n'a ete enregistre, et les
    // mails seraient consommes et perdus sans reprise possible.
    await expect(exigerCompteCollecte(999_999)).rejects.toThrow(/inconnu ou inactif/);
  });

  it('refuse un compte desactive', async () => {
    await db.update(schema.comptesClients).set({ actif: false }).where(eq(schema.comptesClients.id, compteId));
    await expect(exigerCompteCollecte(compteId)).rejects.toThrow(/inconnu ou inactif/);
  });

  it('nomme la constante a corriger dans le script', async () => {
    // Le message est lu dans le journal d'execution d'Apps Script, loin du code : il doit dire
    // quoi corriger, et pas seulement que quelque chose ne va pas.
    await expect(exigerCompteCollecte(999_999)).rejects.toThrow(/COMPTE_ID/);
  });
});

describe('adresses du compte a ne pas suivre', () => {
  beforeEach(async () => {
    await db.update(schema.postes).set({ adresses: ['info@client-fictif.test'] }).where(eq(schema.postes.id, posteId));
    await db
      .update(schema.comptesClients)
      .set({ adressesIgnorees: ['sales@client-fictif.test'] })
      .where(eq(schema.comptesClients.id, compteId));
  });

  async function collecter(de: string, a: string[]) {
    const message = await analyserMessage(
      mailBrut({
        messageId: `<i${de}${a.join()}@exemple-fictif.test>`,
        de,
        a: a.join(', '),
        objet: 'Proforma a etablir',
        corps: 'Pourriez vous nous etablir la proforma en dollars pour cette commande ?',
        date: 'Mon, 02 Mar 2026 09:00:00 +0100',
      }),
    );
    return enregistrerLot([message], { compteId, posteId, dossierParDefautId: dossierId }, AUTEUR);
  }

  it('ecarte un message qui ne concerne qu’une adresse a ne pas suivre', async () => {
    const bilan = await collecter('tiers@inconnu.test', ['sales@client-fictif.test']);
    expect(bilan.ignores).toBe(1);
    expect(bilan.crees).toBe(0);
    // Rien n'est enregistre : ni evenement a lire, ni dossier, ni demande.
    expect(await db.select().from(schema.evenements)).toHaveLength(0);
    expect(await db.select().from(schema.demandes)).toHaveLength(0);
  });

  it('collecte un message adresse a la fois au poste et a l’adresse ignoree', async () => {
    // L'adresse du poste l'emporte : c'est bien du travail du poste.
    const bilan = await collecter('tiers@inconnu.test', ['sales@client-fictif.test', 'info@client-fictif.test']);
    expect(bilan.ignores).toBe(0);
    expect(bilan.crees).toBe(1);
  });

  it('ne change rien quand aucune adresse n’est ignoree', async () => {
    await db.update(schema.comptesClients).set({ adressesIgnorees: [] }).where(eq(schema.comptesClients.id, compteId));
    const bilan = await collecter('tiers@inconnu.test', ['sales@client-fictif.test']);
    expect(bilan.ignores).toBe(0);
    expect(bilan.crees).toBe(1);
  });

  it('reconnait un encadrant AZMG qui ecrit au poste', async () => {
    const message = await analyserMessage(
      mailBrut({
        messageId: '<j1@exemple-fictif.test>',
        de: 'dirigeant@azmg-solutions.com',
        a: 'info@client-fictif.test',
        objet: 'Tableau de situation du client',
        corps: 'Peux tu m’envoyer le tableau de situation par client avant vendredi ?',
        date: 'Mon, 02 Mar 2026 09:00:00 +0100',
      }),
    );
    await enregistrerLot([message], { compteId, posteId, dossierParDefautId: dossierId }, AUTEUR);
    const [evenement] = await db.select().from(schema.evenements);
    // Un interne qui ecrit au poste, c'est un message qui arrive, pas un message qui part : le
    // domaine AZMG ne doit pas l'emporter sur l'adresse du poste parmi les destinataires.
    expect(evenement.sens).toBe('entrant');
    // La nature n'etant que deduite du sens, la confiance reste sous le seuil et le message part
    // en « A classer » plutot que d'etre applique d'office. Le typage s'y lit dans les
    // justificatifs, sans etre pose sur l'evenement.
    expect(evenement.famille).toBeNull();
    expect(evenement.justificatifs).toContain('expediteur sur un domaine interne AZMG');
  });

  it('reconnait l’interne AZMG au seul domaine, sans aucun mot-cle', () => {
    const typage = appliquerRegles({
      objet: 'Tableau de situation du client',
      corps: 'Peux tu m’envoyer le tableau de situation par client avant vendredi ?',
      expediteur: 'dirigeant@azmg-solutions.com',
      sens: 'entrant',
    });
    expect(typage?.typage.interlocuteur).toBe('interne_azmg');
  });
});

describe('decoupage d’un fichier mbox', () => {
  it('separe les messages sur les lignes « From »', () => {
    const mbox = Buffer.from(
      [
        'From ops@transit-fictif.test Mon Mar  2 09:00:00 2026',
        'Message-ID: <m1@x.test>',
        'Subject: Premier',
        '',
        'Corps du premier.',
        '',
        'From client@exemple-fictif.test Tue Mar  3 09:00:00 2026',
        'Message-ID: <m2@x.test>',
        'Subject: Deuxieme',
        '',
        'Corps du deuxieme.',
      ].join('\n'),
      'utf8',
    );
    const messages = decouperMbox(mbox);
    expect(messages).toHaveLength(2);
    expect(messages[0].toString()).toContain('<m1@x.test>');
    expect(messages[1].toString()).toContain('<m2@x.test>');
  });

  it('retablit une ligne du corps echappee par le format', () => {
    const mbox = Buffer.from(
      ['From a@x.test Mon Mar  2 09:00:00 2026', 'Message-ID: <m1@x.test>', '', '>From la part du client, tout va bien.'].join('\n'),
      'utf8',
    );
    expect(decouperMbox(mbox)[0].toString()).toContain('From la part du client');
  });
});

// ---------------------------------------------------------------------------
// Critere : un fil importe deux fois ne cree aucun doublon
// ---------------------------------------------------------------------------

describe('dedoublonnage', () => {
  const fil = [
    mailBrut({
      messageId: '<f1@exemple-fictif.test>',
      de: 'achat@alpha-fictif.test',
      a: 'elysa@azmg-solutions.com',
      objet: 'Cotation fret aerien vers Alger',
      corps: 'Pourriez vous nous coter 180 kg en aerien ?',
      date: 'Mon, 02 Mar 2026 09:00:00 +0100',
    }),
    mailBrut({
      messageId: '<f2@exemple-fictif.test>',
      de: 'elysa@azmg-solutions.com',
      a: 'ops@transit-fictif.test',
      objet: 'Re : Cotation fret aerien vers Alger',
      corps: 'Veuillez trouver ci joint la demande de cotation.',
      date: 'Mon, 02 Mar 2026 10:00:00 +0100',
      references: '<f1@exemple-fictif.test>',
    }),
  ];

  async function importer() {
    const messages = await Promise.all(fil.map((m) => analyserMessage(m)));
    return enregistrerLot(messages, { compteId, posteId, dossierParDefautId: dossierId }, AUTEUR);
  }

  it('cree les evenements au premier import', async () => {
    const bilan = await importer();
    expect(bilan.lus).toBe(2);
    expect(bilan.crees).toBe(2);
    expect(bilan.doublons).toBe(0);
  });

  it('ne cree rien au second import du meme fil', async () => {
    await importer();
    const second = await importer();
    expect(second.lus).toBe(2);
    expect(second.crees).toBe(0);
    expect(second.doublons).toBe(2);

    const evenements = await db.select().from(schema.evenements);
    expect(evenements).toHaveLength(2);
    const demandes = await db.select().from(schema.demandes);
    expect(demandes).toHaveLength(1);
  });

  it('rattache la reponse au meme fil que la demande', async () => {
    await importer();
    const evenements = await db.select().from(schema.evenements).orderBy(schema.evenements.survenuLe);
    expect(evenements[0].filId).toBe('<f1@exemple-fictif.test>');
    expect(evenements[1].filId).toBe('<f1@exemple-fictif.test>');
    expect(evenements[1].demandeId).toBe(evenements[0].demandeId);
  });

  it('conserve l’horodatage d’origine, pas celui de la collecte', async () => {
    await importer();
    const [premier] = await db.select().from(schema.evenements).orderBy(schema.evenements.survenuLe);
    expect(premier.survenuLe.toISOString()).toBe('2026-03-02T08:00:00.000Z');
  });

  it('retrouve la demande d’un fil connu', async () => {
    await importer();
    const trouve = await demandeDuFil('<f1@exemple-fictif.test>', compteId);
    expect(trouve?.dossierId).toBe(dossierId);
    expect(trouve?.demandeId).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Critere : la validation DO suit le fil, sans aucune saisie
// ---------------------------------------------------------------------------

describe('cycle de validation par la DO', () => {
  it('passe en attente DO sur le mail sortant, puis repasse en cours sur la reponse', async () => {
    const messages = await Promise.all(
      [
        mailBrut({
          messageId: '<v1@exemple-fictif.test>',
          de: 'achat@alpha-fictif.test',
          a: 'elysa@azmg-solutions.com',
          objet: 'Proforma a modifier',
          corps: 'Pourriez vous nous etablir la proforma en dollars ?',
          date: 'Mon, 02 Mar 2026 09:00:00 +0100',
        }),
        mailBrut({
          messageId: '<v2@exemple-fictif.test>',
          de: 'elysa@azmg-solutions.com',
          a: 'do@client-fictif.test',
          objet: 'Re : Proforma a modifier',
          corps: 'Merci de valider la modification de devise avant que je reponde au client.',
          date: 'Mon, 02 Mar 2026 11:00:00 +0100',
          references: '<v1@exemple-fictif.test>',
        }),
        mailBrut({
          messageId: '<v3@exemple-fictif.test>',
          de: 'do@client-fictif.test',
          a: 'elysa@azmg-solutions.com',
          objet: 'Re : Proforma a modifier',
          corps: 'Je valide la proforma en dollars, tu peux y aller.',
          date: 'Mon, 02 Mar 2026 15:00:00 +0100',
          references: '<v1@exemple-fictif.test> <v2@exemple-fictif.test>',
        }),
      ].map((m) => analyserMessage(m)),
    );

    // Deux premiers messages : la demande doit etre en attente DO.
    await enregistrerLot(messages.slice(0, 2), { compteId, posteId, dossierParDefautId: dossierId }, AUTEUR);
    const [apresDemande] = await db.select().from(schema.demandes);
    expect(apresDemande.statut).toBe('attente_do');
    expect(apresDemande.acteurAttendu).toBe('do');

    // Troisieme message : la reponse de la DO la fait repasser en cours.
    await enregistrerLot(messages.slice(2), { compteId, posteId, dossierParDefautId: dossierId }, AUTEUR);
    const [apresValidation] = await db.select().from(schema.demandes);
    expect(apresValidation.statut).toBe('en_cours');
    expect(apresValidation.acteurAttendu).toBe('poste');

    // Les transitions sont horodatees sur les dates des mails, pas sur celle de la collecte.
    const transitions = await db
      .select()
      .from(schema.transitionsStatut)
      .where(eq(schema.transitionsStatut.demandeId, apresValidation.id))
      .orderBy(schema.transitionsStatut.survenuLe);
    expect(transitions).toHaveLength(3);
    expect(transitions[1].survenuLe.toISOString()).toBe('2026-03-02T10:00:00.000Z');
    expect(transitions[2].survenuLe.toISOString()).toBe('2026-03-02T14:00:00.000Z');
  });

  it('traite les messages du plus ancien au plus recent, quel que soit l’ordre recu', async () => {
    const messages = await Promise.all(
      [
        mailBrut({
          messageId: '<o2@exemple-fictif.test>',
          de: 'elysa@azmg-solutions.com',
          a: 'do@client-fictif.test',
          objet: 'Re : Cotation fret aerien',
          corps: 'Merci de valider le transitaire retenu.',
          date: 'Mon, 02 Mar 2026 11:00:00 +0100',
          references: '<o1@exemple-fictif.test>',
        }),
        mailBrut({
          messageId: '<o1@exemple-fictif.test>',
          de: 'achat@alpha-fictif.test',
          a: 'elysa@azmg-solutions.com',
          objet: 'Cotation fret aerien',
          corps: 'Pourriez vous nous coter 180 kg ?',
          date: 'Mon, 02 Mar 2026 09:00:00 +0100',
        }),
      ].map((m) => analyserMessage(m)),
    );
    await enregistrerLot(messages, { compteId, posteId, dossierParDefautId: dossierId }, AUTEUR);
    const demandes = await db.select().from(schema.demandes);
    // Une seule demande : la reponse a rejoint le fil ouvert par le premier message.
    expect(demandes).toHaveLength(1);
    expect(demandes[0].statut).toBe('attente_do');
  });
});

// ---------------------------------------------------------------------------
// Hors perimetre, pieces jointes, signature
// ---------------------------------------------------------------------------

describe('hors perimetre a la collecte', () => {
  it('trace le message sans ouvrir de demande', async () => {
    const message = await analyserMessage(
      mailBrut({
        messageId: '<n1@exemple-fictif.test>',
        de: 'news@veille-fictive.test',
        a: 'elysa@azmg-solutions.com',
        objet: 'Newsletter de novembre',
        corps: 'Pour ne plus recevoir nos messages, cliquez sur se desinscrire.',
      }),
    );
    const bilan = await enregistrerLot([message], { compteId, posteId, dossierParDefautId: dossierId }, AUTEUR);
    expect(bilan.horsPerimetre).toBe(1);
    const demandes = await db.select().from(schema.demandes);
    expect(demandes).toHaveLength(0);
    const [evenement] = await db.select().from(schema.evenements);
    expect(evenement.famille).toBe('T00');
    expect(evenement.demandeId).toBeNull();
  });
});

describe('pieces jointes', () => {
  it('range la piece hors du dossier public et la reference au dossier', async () => {
    const brut = Buffer.from(
      [
        'Message-ID: <p1@exemple-fictif.test>',
        'From: ops@transit-fictif.test',
        'To: elysa@azmg-solutions.com',
        'Subject: Cotation fret aerien avec piece',
        'MIME-Version: 1.0',
        'Content-Type: multipart/mixed; boundary="SEP"',
        '',
        '--SEP',
        'Content-Type: text/plain; charset=utf-8',
        '',
        'Voici notre offre en piece jointe.',
        '--SEP',
        'Content-Type: application/pdf; name="offre.pdf"',
        'Content-Disposition: attachment; filename="offre.pdf"',
        'Content-Transfer-Encoding: base64',
        '',
        Buffer.from('%PDF-1.4 contenu fictif').toString('base64'),
        '--SEP--',
      ].join('\r\n'),
      'utf8',
    );
    const message = await analyserMessage(brut);
    expect(message.pieces).toHaveLength(1);

    const bilan = await enregistrerLot([message], { compteId, posteId, dossierParDefautId: dossierId }, AUTEUR);
    expect(bilan.piecesRangees).toBe(1);

    const [piece] = await db.select().from(schema.pieces);
    expect(piece.nomFichier).toBe('offre.pdf');
    expect(piece.chemin).toMatch(/^pieces\//);
    // Le nom d'origine n'apparait pas sur le disque : le chemin derive de l'empreinte.
    expect(piece.chemin).not.toContain('offre');
    await expect(fs.access(cheminAbsolu(piece.chemin!))).resolves.toBeUndefined();
  });

  it('refuse une extension non prevue', () => {
    expect(extensionAcceptee('offre.pdf')).toBe(true);
    expect(extensionAcceptee('bl.xlsx')).toBe(true);
    expect(extensionAcceptee('script.exe')).toBe(false);
    expect(extensionAcceptee('archive.tar.gz')).toBe(false);
  });

  it('ne range qu’une fois un contenu identique', async () => {
    const contenu = Buffer.from('contenu fictif identique');
    const premier = await rangerFichier(contenu, 'a.pdf');
    const second = await rangerFichier(contenu, 'b.pdf');
    expect(second.chemin).toBe(premier.chemin);
    expect(second.deja).toBe(true);
  });

  it('refuse un chemin qui sort du dossier de stockage', () => {
    expect(() => cheminAbsolu('../../etc/passwd')).toThrow(/hors du dossier/i);
  });
});

describe('signature du webhook', () => {
  it('accepte une charge correctement signee', () => {
    const corps = JSON.stringify({ compteId: 1, messages: [] });
    const signature = signerCharge(corps, 'secret-de-test');
    expect(verifierSignature(corps, signature, 'secret-de-test')).toBe(true);
  });

  it('refuse une charge modifiee ou mal signee', () => {
    const corps = JSON.stringify({ compteId: 1, messages: [] });
    const signature = signerCharge(corps, 'secret-de-test');
    expect(verifierSignature(`${corps} `, signature, 'secret-de-test')).toBe(false);
    expect(verifierSignature(corps, signature, 'autre-secret')).toBe(false);
    expect(verifierSignature(corps, '', 'secret-de-test')).toBe(false);
  });
});

describe('dossier de rattachement', () => {
  it('ouvre un dossier a reclasser quand le fil et le dossier sont inconnus', async () => {
    const message = await analyserMessage(
      mailBrut({
        messageId: '<i1@exemple-fictif.test>',
        de: 'inconnu@societe-fictive.test',
        a: 'elysa@azmg-solutions.com',
        objet: 'Cotation fret aerien pour un nouveau client',
        corps: 'Pourriez vous nous coter un envoi ?',
      }),
    );
    await enregistrerMessage(message, { compteId, posteId }, AUTEUR);
    const dossiers = await db.select().from(schema.dossiers).where(eq(schema.dossiers.client, 'inconnu'));
    expect(dossiers).toHaveLength(1);
    expect(dossiers[0].notes).toMatch(/a reclasser/i);
  });
});
