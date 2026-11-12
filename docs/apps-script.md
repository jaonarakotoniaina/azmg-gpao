# Collecte des mails par Google Apps Script

Une boite Gmail recoit une copie des mails du poste, envoyes et recus. Ce script, installe sur cette
boite, pousse chaque nouveau message vers la GPAO.

C'est le mode recommande : il ne demande aucun mot de passe d'application, aucune ouverture de port
IMAP, et il tourne sur l'infrastructure de Google. Le mode `imap` reste disponible pour une boite
qui n'est pas chez Google.

## Choisir la boite, et ce que le script y lit

Le script tourne dans l'un de deux cas, selon la constante `LIBELLE_SOURCE`.

**Boite dediee (recommande), `LIBELLE_SOURCE` laisse vide.** La boite ne sert qu'au suivi d'un
compte client : tout ce qu'elle contient concerne le poste. Le script lit la boite de reception et
les messages envoyes. C'est le cas le plus simple et le plus sur, parce que le perimetre est celui
de la boite elle-meme.

Un seul prerequis, a verifier une fois : la boite doit recevoir une copie des mails du poste **dans
les deux sens**, recus comme envoyes. Une regle qui ne copierait que les mails recus priverait la
GPAO de tout ce que le poste envoie, et donc de toute demande de validation.

**Boite partagee, `LIBELLE_SOURCE` renseigne.** La boite est celle d'un dirigeant ou d'un manager,
qui contient aussi d'autres clients et du courrier personnel. Le libelle est alors **la seule chose**
qui dit au script ce qu'il a le droit d'envoyer. Trois consequences, a ne pas contourner :

1. **La recherche porte sur le libelle, jamais sur la boite de reception.** Une requete comme
   `in:inbox OR in:sent` enverrait toute la boite a la GPAO d'un seul compte client.
2. **Un libelle par compte client**, donc deux projets Apps Script pour deux clients, chacun avec
   son `COMPTE_ID` et son libelle.
3. **Le script s'arrete si le libelle n'existe pas.** Un libelle mal orthographie ne doit pas se
   traduire par un envoi plus large, ni par un silence que personne ne remarque.

Dans les deux cas, ce qui arrive sans concerner le poste (infolettres, notifications d'outils,
travail de la designer) n'a pas besoin d'etre trie a la main : la GPAO le classe en famille T00,
hors perimetre, et l'ecarte de toutes les vues de pilotage et de tous les exports.

## Ce que fait le script

Toutes les cinq minutes, il cherche les fils de discussion arrives depuis son dernier passage,
envoie chaque message complet a la GPAO, puis pose une etiquette sur le fil pour ne pas le renvoyer.

Trois contraintes, constatees a la mise en service sur o2switch le 12/11/2026, sont gerees par le
script :

- **Taille des envois.** Google refuse un envoi de plus de 50 Mo et la GPAO au-dela de 25 Mo. Le
  script decoupe les messages en lots d'environ 12 millions de caracteres (8 lots au plus par
  passage, le reste part au passage suivant). Un message de plus de 10 Mo a lui seul part sans ses
  pieces jointes : memes en-tetes (donc meme identifiant et meme fil), texte, et liste des pieces
  jointes en fin de texte. Un fil n'est etiquete qu'une fois tous ses messages acceptes.
- **Controle anti-robots d'o2switch.** Au premier appel, l'hebergeur repond `307` vers la meme
  adresse en posant un cookie `o2s-chl`. Un navigateur le renvoie seul, Apps Script non : le script
  recupere ce cookie et rejoue l'appel avec lui. Aucun reglage TigerProtect n'est a modifier.
- **Encodage de la signature.** Les mails contiennent des accents. Le script encode la charge une
  seule fois en UTF-8 et signe ces octets exacts, ceux-la memes qu'il envoie. Signer la chaine
  sans fixer l'encodage produit une signature que la GPAO rejette (`401`).

La GPAO se charge du reste : dedoublonnage par identifiant de message, rattachement au fil,
typage, et creation ou avancement de la demande.

## Mise en place, une seule fois

### 0. Dire a la GPAO qui est le poste et qui est la donneuse d'ordre

Dans « Parametres », onglet « Comptes clients », renseigner pour le compte :

- **Adresses du poste** : les adresses depuis lesquelles le collaborateur ecrit. Ce sont souvent des
  adresses du client, pas des adresses AZMG.
- **Adresse de la donneuse d'ordre** : son adresse exacte.

Cette etape n'est pas optionnelle. Le poste et la donneuse d'ordre partagent generalement le meme
domaine (une boite « info » et une boite « export » chez le meme client) : sans les adresses, la
GPAO lit tout ce que le poste envoie comme du courrier recu, aucune demande ne passe en attente DO,
et le digest de validation reste vide.

### 1. Secret partage

Sur le serveur, ajouter a `~/azmg-gpao/shared/.env` une cle longue et aleatoire :

```
COLLECTE_MAIL=apps_script
APPS_SCRIPT_SECRET=<la cle>
```

La generer avec `openssl rand -hex 32`. Redemarrer l'application :
`touch ~/azmg-gpao/app/tmp/restart.txt`.

### 2. Creer le projet Apps Script

1. Ouvrir [script.google.com](https://script.google.com) avec le compte Google de la boite qui
   recoit la copie des mails.
2. Nouveau projet, le nommer `Collecte GPAO`.
3. Coller le script ci-dessous dans `Code.gs`.
4. Renseigner les constantes en tete : l'adresse de la GPAO, le secret, et l'identifiant du compte
   client (visible dans l'URL de l'ecran Dossiers, ou demande au manager). Sur une boite dediee,
   laisser `LIBELLE_SOURCE` vide. Sur une boite partagee, y mettre **le libelle exact**, majuscules
   et accents compris.

### 3. Declencheur

Dans le menu de gauche, « Declencheurs », puis « Ajouter un declencheur » :

- Fonction : `collecter`
- Source : `Declencheur horaire`
- Type : `Minuteur par minutes`, toutes les 5 minutes

Google demande d'autoriser le script a lire Gmail et a joindre un service externe. L'autorisation
est donnee une fois.

### 4. Verifier

Dans l'editeur, lancer `collecter` a la main une premiere fois, puis regarder le journal
d'execution. Cote GPAO, l'ecran « Import des mails » affiche le bilan du dernier passage.

## Le script

```javascript
/**
 * Collecte GPAO : pousse vers AZMG GPAO les nouveaux messages d'un libelle Gmail.
 * Declencheur : toutes les 5 minutes sur la fonction collecter().
 */
const URL_GPAO = 'https://gpao.intranet.azmg-solutions.com/api/collecte/apps-script';
const SECRET = 'COLLER_ICI_LA_MEME_CLE_QUE_APPS_SCRIPT_SECRET';
const COMPTE_ID = 1;

/**
 * Libelle qui delimite le perimetre.
 *
 * Vide sur une boite dediee au suivi d'un seul compte : le script lit alors la boite de reception
 * et les messages envoyes, ce qui est sans risque puisque tout y concerne le poste.
 *
 * Renseigne sur une boite partagee (celle d'un dirigeant, d'un manager) : le script ne lit que ce
 * libelle. Ne jamais elargir la recherche a `in:inbox` ni a `in:sent` dans ce cas, cela enverrait
 * toute la boite, autres clients et courrier prive compris, a ce seul compte client.
 */
const LIBELLE_SOURCE = '';

/** Etiquette posee sur les fils deja envoyes, pour ne jamais les renvoyer. */
const ETIQUETTE = 'GPAO traite';
/** Nombre maximal de messages par envoi. La GPAO en accepte 100 au maximum. */
const LOT = 50;
/**
 * Taille maximale d'un envoi, en caracteres. Google refuse au-dela de 50 Mo et la GPAO au-dela
 * de 25 Mo : 12 millions de caracteres laissent une marge pour l'encodage.
 */
const BUDGET = 12 * 1024 * 1024;
/** Au-dela, un message part sans ses pieces jointes (texte et en-tetes seulement). */
const TAILLE_MAX_MESSAGE = 10 * 1024 * 1024;
/** Nombre maximal d'envois par passage, pour rester sous la limite de 6 minutes d'execution. */
const ENVOIS_MAX = 8;

function collecter() {
  const etiquette = obtenirEtiquette_();
  // Boite dediee : la boite de reception et les messages envoyes. Boite partagee : le libelle seul.
  var perimetre = '(in:inbox OR in:sent)';
  if (LIBELLE_SOURCE) {
    // Un libelle absent (renomme, mal orthographie) doit arreter le script : sans ce controle, la
    // recherche ne renverrait rien et l'arret passerait pour un « rien a collecter » normal.
    if (!GmailApp.getUserLabelByName(LIBELLE_SOURCE)) {
      throw new Error('Libelle source introuvable : ' + LIBELLE_SOURCE);
    }
    perimetre = 'label:"' + LIBELLE_SOURCE + '"';
  }
  const requete = perimetre + ' -label:"' + ETIQUETTE + '" newer_than:14d';
  const fils = GmailApp.search(requete, 0, 25);
  if (fils.length === 0) {
    Logger.log('Rien a collecter.');
    return;
  }

  // restants[i] : messages du fil i pas encore envoyes. Un fil n'est etiquete qu'une fois
  // tous ses messages acceptes par la GPAO.
  const restants = [];
  var lot = [];
  var tailleLot = 0;
  var envois = 0;
  var total = 0;
  var alleges = 0;

  for (var i = 0; i < fils.length; i++) {
    const messages = fils[i].getMessages();
    restants[i] = messages.length;
    for (const message of messages) {
      var brut = message.getRawContent();
      if (brut.length > TAILLE_MAX_MESSAGE) {
        brut = versionAllegee_(message);
        alleges++;
      }
      if (lot.length > 0 && (tailleLot + brut.length > BUDGET || lot.length >= LOT)) {
        if (!envoyer_(lot, fils, restants, etiquette)) return;
        total += lot.length;
        envois++;
        lot = [];
        tailleLot = 0;
        if (envois >= ENVOIS_MAX) {
          Logger.log('Envoye : ' + total + ' message(s). Suite au prochain passage.');
          return;
        }
      }
      lot.push({ fil: i, brut: brut });
      tailleLot += brut.length;
    }
  }
  if (lot.length > 0) {
    if (!envoyer_(lot, fils, restants, etiquette)) return;
    total += lot.length;
  }
  Logger.log('Envoye : ' + total + ' message(s)' + (alleges ? ', dont ' + alleges + ' sans pieces jointes (trop volumineux)' : '') + '.');
}

/** Envoie un lot a la GPAO. Renvoie false en cas d'echec : rien n'est etiquete, tout repartira. */
function envoyer_(lot, fils, restants, etiquette) {
  const charge = JSON.stringify({
    compteId: COMPTE_ID,
    messages: lot.map(function (u) {
      return { brut: u.brut };
    }),
  });
  const reponse = appeler_(charge);
  const code = reponse.getResponseCode();
  if (code !== 200) {
    Logger.log('Echec (' + code + ') : ' + reponse.getContentText().slice(0, 300));
    return false;
  }
  for (const u of lot) {
    restants[u.fil]--;
    if (restants[u.fil] === 0) fils[u.fil].addLabel(etiquette);
  }
  return true;
}

/**
 * Message trop volumineux : on reconstruit un message avec les memes en-tetes (donc le meme
 * identifiant, pour le dedoublonnage et le rattachement au fil) et le texte seul. La liste des
 * pieces jointes est ajoutee a la fin du texte pour garder la trace de ce qui a ete envoye.
 */
function versionAllegee_(message) {
  const lignes = [];
  ['Message-ID', 'Date', 'From', 'To', 'Cc', 'Subject', 'In-Reply-To', 'References'].forEach(function (nom) {
    const valeur = message.getHeader(nom);
    if (valeur) lignes.push(nom + ': ' + valeur.replace(/[\r\n]+/g, ' '));
  });
  if (!message.getHeader('Message-ID')) lignes.push('Message-ID: <gmail-' + message.getId() + '@collecte-gpao>');
  const pieces = message.getAttachments({ includeInlineImages: false }).map(function (p) {
    return p.getName() + ' (' + Math.round(p.getSize() / 1024) + ' Ko)';
  });
  const texte = message.getPlainBody() + '\n\n[Pieces jointes non transmises, message trop volumineux : ' + (pieces.join(', ') || 'aucune listee') + ']';
  const corps = Utilities.base64Encode(texte, Utilities.Charset.UTF_8).replace(/(.{76})/g, '$1\r\n');
  lignes.push('MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', corps);
  return lignes.join('\r\n');
}

/**
 * Cookie de controle anti-robots d'o2switch. Au premier appel, l'hebergeur repond 307 vers la meme
 * adresse en posant un cookie « o2s-chl » ; un navigateur le renvoie automatiquement, Apps Script
 * non. On le recupere et on rejoue l'appel avec lui. Il est garde pour les envois suivants du passage.
 */
var cookieO2switch_ = '';

function appeler_(charge) {
  // Un seul encodage UTF-8, utilise a la fois pour la signature et pour l'envoi.
  const octets = Utilities.newBlob(charge).getBytes();
  const signature = signer_(octets);
  var reponse;
  for (var essai = 0; essai < 3; essai++) {
    const entetes = { 'X-AZMG-Signature': signature };
    if (cookieO2switch_) entetes['Cookie'] = cookieO2switch_;
    reponse = UrlFetchApp.fetch(URL_GPAO, {
      method: 'post',
      contentType: 'application/json; charset=utf-8',
      payload: octets,
      headers: entetes,
      followRedirects: false,
      muteHttpExceptions: true,
    });
    if (reponse.getResponseCode() !== 307) return reponse;
    const h = reponse.getAllHeaders();
    var cookies = h['Set-Cookie'] || h['set-cookie'];
    if (!cookies) return reponse;
    if (!Array.isArray(cookies)) cookies = [cookies];
    const nouveau = cookies
      .map(function (c) {
        return c.split(';')[0].trim();
      })
      .filter(function (c) {
        return c.indexOf('o2s-') === 0;
      })
      .join('; ');
    if (!nouveau) return reponse;
    cookieO2switch_ = nouveau;
  }
  return reponse;
}

/**
 * Signature HMAC SHA-256, en hexadecimal, calculee sur les octets UTF-8 exacts envoyes. Les mails
 * contiennent des accents : signer la chaine sans fixer l'encodage donnerait une signature
 * differente de celle que la GPAO recalcule sur le corps recu.
 */
function signer_(octets) {
  const signature = Utilities.computeHmacSha256Signature(octets, Utilities.newBlob(SECRET).getBytes());
  return signature
    .map(function (o) {
      return ('0' + (o & 0xff).toString(16)).slice(-2);
    })
    .join('');
}

function obtenirEtiquette_() {
  return GmailApp.getUserLabelByName(ETIQUETTE) || GmailApp.createLabel(ETIQUETTE);
}
```

## Pourquoi une signature

Sans elle, toute personne connaissant l'adresse du webhook pourrait injecter de faux messages dans
le pilotage du poste. La GPAO verifie que la signature correspond au corps recu, octet pour octet,
et rejette l'appel sinon. Le secret ne circule jamais : seule la signature voyage.

## Diagnostic

| Symptome | Cause probable |
|---|---|
| `503 Collecte Apps Script non configuree` | `APPS_SCRIPT_SECRET` absent du `.env`, ou application non redemarree |
| `401 Signature invalide` | la cle du script n'est pas celle du `.env` (comparer les empreintes, voir plus bas), ou une ancienne version du script qui signe sans fixer l'encodage UTF-8 |
| `Echec (307)` | ancienne version du script, qui ne gere pas le cookie de controle `o2s-chl` d'o2switch : reprendre le script de cette page |
| `Limite depassee : Taille POST URLFetch` | ancienne version du script, qui envoie 50 messages d'un coup sans tenir compte de leur taille : reprendre le script de cette page |
| `400 Charge invalide` | `COMPTE_ID` absent ou faux dans le script |
| Rien n'arrive, aucune erreur | la recherche Gmail ne trouve rien : verifier l'etiquette « GPAO traite » et la fenetre `newer_than` |
| `404 Compte client N inconnu ou inactif` | le `COMPTE_ID` du script ne correspond a aucun compte actif. Le relever dans l'URL de l'ecran Dossiers. Les fils ne sont pas etiquetes, ils repartiront au passage suivant une fois la constante corrigee |
| `Libelle source introuvable` | `LIBELLE_SOURCE` ne correspond a aucun libelle : recopier le nom exact, accents et majuscules compris. Un libelle imbrique s'ecrit en entier, par exemple `A - Clients/Masenz`. Sur une boite dediee, laisser la constante vide |
| Les mails recus arrivent, ceux du poste non | la boite ne recoit qu'une copie des mails entrants. Completer la regle de copie dans les deux sens, sans quoi aucune demande ne passera en attente DO |
| Des mails etrangers au poste arrivent dans la GPAO | ils sont hors perimetre et classes T00, donc absents du pilotage. S'ils sont nombreux, c'est le libelle qui est trop large cote Gmail |
| Les memes messages reviennent | l'etiquette n'est pas posee : le dernier appel a echoue, regarder le journal |

**Comparer les cles sans les afficher.** Sur le serveur :

```
v=$(grep '^APPS_SCRIPT_SECRET=' ~/azmg-gpao/shared/.env | cut -d= -f2-); echo "longueur ${#v} empreinte $(printf %s "$v" | sha256sum | cut -c1-8)"; unset v
```

Dans l'editeur Apps Script, ajouter puis executer temporairement :

```javascript
function verifierCle() {
  const h = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, SECRET, Utilities.Charset.UTF_8);
  const hex = h.map(function (o) { return ('0' + (o & 0xff).toString(16)).slice(-2); }).join('');
  Logger.log('longueur ' + SECRET.length + ' empreinte ' + hex.slice(0, 8));
}
```

Les deux lignes doivent etre identiques. Supprimer la fonction une fois la verification faite.

La GPAO dedoublonne de toute facon sur l'identifiant du message : un envoi en double ne cree jamais
deux fois le meme evenement.

## Reprendre l'historique

Pour les mails anterieurs a la mise en place, l'ecran « Import des mails » de la GPAO accepte des
fichiers `.eml` et `.mbox`. Dans Gmail, l'export passe par
[Google Takeout](https://takeout.google.com) : choisir Mail, puis le libelle voulu. Le fichier
`.mbox` obtenu peut etre depose directement.

L'import et la collecte se dedoublonnent entre eux : importer un historique qui recouvre deja
quelques jours collectes ne cree aucun doublon.
