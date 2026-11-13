/**
 * Adaptateur de collecte des mails du poste (phase 4, section 10 de CLAUDE.md).
 *
 * Trois implementations derriere une seule interface :
 *  - `apps_script` : un script Google Apps Script installe sur la boite de suivi appelle un
 *    webhook signe de l'application a chaque nouveau message (voir docs/apps-script.md) ;
 *  - `imap`        : relevage direct de la boite, pour une boite qui n'est pas chez Google ;
 *  - `mock`        : aucune collecte, l'application vit de la saisie rapide et de l'import.
 *
 * L'implementation est choisie par la configuration : si le secret manque, c'est `mock` qui
 * s'active et l'application fonctionne quand meme. Le manque est liste dans docs/A_FOURNIR.md.
 */
import crypto from 'node:crypto';
import { simpleParser, type ParsedMail } from 'mailparser';
import { config } from '../config';
import { journal, messageErreur } from '../lib/journal';

/** Un message collecte, deja normalise : c'est tout ce que la GPAO connait d'un mail. */
export interface MessageCollecte {
  /** Identifiant RFC 5322 du message. Cle du dedoublonnage. */
  messageId: string;
  /** Identifiant du fil : premier message de la chaine de references, sinon le message lui-meme. */
  filId: string;
  expediteur: string;
  destinataires: string[];
  objet: string;
  /** Corps en texte brut. Le HTML est converti, jamais conserve tel quel. */
  corps: string;
  /** Horodatage d'origine du message, conserve tel quel. */
  survenuLe: Date;
  /**
   * Lien vers le message dans sa boite d'origine, quand la source le connait.
   *
   * Seul le script installe sur la boite peut le construire : l'identifiant RFC 5322 ne suffit
   * pas. Un message importe depuis un fichier `.eml` n'en a pas, et c'est normal.
   */
  lienExterne?: string;
  pieces: { nomFichier: string; contenu: Buffer; typeMime: string }[];
}

export interface AdaptateurCollecte {
  readonly mode: 'apps_script' | 'imap' | 'mock';
  /** Releve les messages non encore collectes. Le dedoublonnage est fait en aval. */
  relever(limite?: number): Promise<MessageCollecte[]>;
}

// ---------------------------------------------------------------------------
// Normalisation d'un message brut
// ---------------------------------------------------------------------------

/** Adresse d'un champ d'en-tete, en minuscules, sans le nom affiche. */
function adresse(valeur: unknown): string {
  if (!valeur) return '';
  const v = valeur as { value?: { address?: string }[]; text?: string };
  const premiere = v.value?.[0]?.address;
  if (premiere) return premiere.toLowerCase();
  const m = /<([^>]+)>/.exec(v.text ?? '');
  return (m ? m[1] : (v.text ?? '')).trim().toLowerCase();
}

function adresses(valeur: unknown): string[] {
  if (!valeur) return [];
  const liste = Array.isArray(valeur) ? valeur : [valeur];
  const sortie: string[] = [];
  for (const v of liste as { value?: { address?: string }[] }[]) {
    for (const a of v.value ?? []) if (a.address) sortie.push(a.address.toLowerCase());
  }
  return [...new Set(sortie)];
}

/** Texte brut du message : le texte s'il existe, sinon le HTML debarrasse de ses balises. */
function corpsTexte(mail: ParsedMail): string {
  if (mail.text?.trim()) return mail.text.trim();
  const html = typeof mail.html === 'string' ? mail.html : '';
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Identifiant du fil.
 *
 * Le premier identifiant de la chaine `References` designe le message qui a ouvert le fil ;
 * a defaut, `In-Reply-To` ; a defaut, le message est lui-meme la tete du fil. C'est ce qui
 * permet de rattacher une reponse a la demande qu'elle fait avancer.
 */
export function identifiantFil(messageId: string, references?: string | string[], inReplyTo?: string): string {
  const liste = Array.isArray(references) ? references : references ? references.split(/\s+/) : [];
  const premier = liste.map((r) => r.trim()).find((r) => r.startsWith('<'));
  return premier || inReplyTo?.trim() || messageId;
}

/** Transforme un message brut (RFC 5322) en message collecte. */
export async function analyserMessage(brut: Buffer | string): Promise<MessageCollecte> {
  const mail = await simpleParser(brut, { skipImageLinks: true });
  const messageId = (mail.messageId ?? '').trim() || `<sans-id-${crypto.createHash('sha256').update(String(brut)).digest('hex').slice(0, 32)}@azmg-gpao>`;

  return {
    messageId,
    filId: identifiantFil(messageId, mail.references, mail.inReplyTo),
    expediteur: adresse(mail.from),
    destinataires: [...adresses(mail.to), ...adresses(mail.cc)],
    objet: (mail.subject ?? '').trim(),
    corps: corpsTexte(mail),
    // L'horodatage d'origine est conserve tel quel : c'est lui qui fait foi pour les delais.
    survenuLe: mail.date ?? new Date(),
    pieces: (mail.attachments ?? [])
      .filter((p) => p.content && p.filename)
      .map((p) => ({ nomFichier: p.filename!, contenu: p.content as Buffer, typeMime: p.contentType ?? 'application/octet-stream' })),
  };
}

/** Decoupe un fichier `.mbox` en messages. Le format separe les messages par une ligne « From  ». */
export function decouperMbox(contenu: Buffer): Buffer[] {
  const texte = contenu.toString('binary');
  const lignes = texte.split(/\r?\n/);
  const messages: string[][] = [];
  let courant: string[] | null = null;

  for (const ligne of lignes) {
    if (/^From .+\d{4}$/.test(ligne) || /^From \S+@\S+ /.test(ligne)) {
      if (courant?.length) messages.push(courant);
      courant = [];
      continue;
    }
    if (courant === null) continue;
    // Le format mbox echappe les lignes du corps qui commencent par « From ».
    courant.push(ligne.replace(/^>(>*From )/, '$1'));
  }
  if (courant?.length) messages.push(courant);

  return messages.map((m) => Buffer.from(m.join('\n'), 'binary'));
}

// ---------------------------------------------------------------------------
// Implementations
// ---------------------------------------------------------------------------

/** Mode simule : aucune collecte. La GPAO vit de la saisie rapide et de l'import. */
class CollecteSimulee implements AdaptateurCollecte {
  readonly mode = 'mock' as const;
  async relever(): Promise<MessageCollecte[]> {
    return [];
  }
}

/**
 * Mode `apps_script` : rien a relever activement. Le script Google pousse les messages vers le
 * webhook signe `POST /api/collecte/apps-script`, qui les enregistre a l'arrivee.
 */
class CollecteAppsScript implements AdaptateurCollecte {
  readonly mode = 'apps_script' as const;
  async relever(): Promise<MessageCollecte[]> {
    return [];
  }
}

/** Mode `imap` : relevage direct de la boite de suivi. */
class CollecteImap implements AdaptateurCollecte {
  readonly mode = 'imap' as const;

  async relever(limite = 50): Promise<MessageCollecte[]> {
    const { ImapFlow } = await import('imapflow');
    const client = new ImapFlow({
      host: config.collecte.imap.hote,
      port: config.collecte.imap.port,
      secure: config.collecte.imap.securise,
      auth: { user: config.collecte.imap.utilisateur, pass: config.collecte.imap.motDePasse },
      logger: false,
    });

    const messages: MessageCollecte[] = [];
    await client.connect();
    try {
      const verrou = await client.getMailboxLock(config.collecte.imap.dossier);
      try {
        // Les messages non lus seulement : le marquage fait office de curseur cote boite.
        for await (const message of client.fetch({ seen: false }, { source: true, uid: true })) {
          if (messages.length >= limite) break;
          if (!message.source) continue;
          try {
            messages.push(await analyserMessage(message.source));
            await client.messageFlagsAdd({ uid: String(message.uid) }, ['\\Seen'], { uid: true });
          } catch (e) {
            journal.warn('Message IMAP illisible, ignore', { erreur: messageErreur(e) });
          }
        }
      } finally {
        verrou.release();
      }
    } finally {
      await client.logout().catch(() => undefined);
    }
    return messages;
  }
}

let instance: AdaptateurCollecte | null = null;

export function adaptateurCollecte(): AdaptateurCollecte {
  if (instance) return instance;
  switch (config.collecte.mode) {
    case 'imap':
      instance = new CollecteImap();
      break;
    case 'apps_script':
      instance = new CollecteAppsScript();
      break;
    default:
      instance = new CollecteSimulee();
  }
  return instance;
}

/** Remet l'adaptateur a zero (utilise par les tests quand la configuration change). */
export function reinitialiserAdaptateurCollecte() {
  instance = null;
}

// ---------------------------------------------------------------------------
// Signature du webhook Apps Script
// ---------------------------------------------------------------------------

/**
 * Signature HMAC du corps du webhook.
 *
 * Le script Google signe chaque appel avec le secret partage : sans cela, n'importe qui
 * connaissant l'adresse pourrait injecter de faux mails dans le pilotage du poste.
 */
export function signerCharge(corps: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(corps).digest('hex');
}

export function verifierSignature(corps: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false;
  const attendue = signerCharge(corps, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(attendue);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Etiquettes d'en-tete d'un mail transfere, dans les langues et les clients qu'on rencontre. */
const ETIQUETTE_ENTETE =
  /^(de|from|envoye|envoyee|sent|a|to|cc|cci|bcc|copie|objet|subject|date|reply-to|repondre a|importance|priorite)\s*:/i;

/** Marque le debut d'une citation ou d'un transfert : tout ce qui suit appartient au passe. */
const DEBUT_CITATION = [
  /^>/,
  /^-{2,}\s*(message|forwarded|original)/i,
  /^_{5,}$/,
  /^le .{5,80}a ecrit\s*:?$/i,
  /^on .{5,80}wrote\s*:?$/i,
  /^el .{5,80}escribio\s*:?$/i,
];

/**
 * Vrai quand la ligne appartient a un bloc d'en-tetes de transfert.
 *
 * Deux formes se rencontrent. Une ligne par champ, quand le mail est en texte brut. Et tous les
 * champs sur une seule ligne, quand le HTML a ete aplati : c'est le cas le plus frequent, et
 * c'est celui qui remplissait la chronologie d'adresses.
 */
function estLigneEntete(ligne: string): boolean {
  if (ETIQUETTE_ENTETE.test(ligne)) return true;
  const etiquettes = ligne.match(/(?:^|\s)(?:de|from|envoye|envoyee|sent|a|to|cc|cci|objet|subject|date)\s*:/gi);
  return (etiquettes?.length ?? 0) >= 2;
}

/**
 * Le texte utile d'un mail : ce qu'une personne a ecrit, sans la machinerie autour.
 *
 * Trois choses sont retirees : le bloc d'en-tetes d'un transfert, la chaine des reponses citees,
 * et la signature. Un mail transfere commence par ses en-tetes, donc le bloc de tete est
 * **saute**, pas pris pour la fin du message : c'est la difference entre afficher une liste
 * d'adresses et afficher la demande.
 *
 * Rend une chaine vide quand il ne reste rien de lisible. C'est voulu : l'appelant affiche alors
 * le brief de la demande, ou rien. Afficher des en-tetes a la place d'un message ne renseigne
 * personne, et c'est precisement ce qu'on corrige.
 */
export function partieUtile(corps: string): string {
  const lignes = corps.replace(/\r\n/g, '\n').split('\n');
  const utiles: string[] = [];
  let commence = false;

  for (const brute of lignes) {
    const ligne = brute.trim();

    if (DEBUT_CITATION.some((motif) => motif.test(ligne))) break;
    // Une signature ferme le message, mais seulement si du texte a deja ete pris.
    if (/^--\s*$/.test(ligne)) {
      if (commence) break;
      continue;
    }

    if (estLigneEntete(ligne)) {
      // Un bloc d'en-tetes en tete de message est saute ; un bloc qui arrive apres du texte
      // annonce un transfert imbrique, et ferme le message.
      if (commence) break;
      continue;
    }

    if (!ligne && !commence) continue;
    commence = commence || Boolean(ligne);
    utiles.push(ligne);
  }

  return utiles.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
