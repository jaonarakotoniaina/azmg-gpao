# Collecte des mails par Google Apps Script

Une boite Gmail recoit une copie des mails du poste, envoyes et recus, rangee sous un **libelle**.
Ce script, installe sur cette boite, pousse vers la GPAO les nouveaux messages **de ce libelle, et
d'eux seuls**.

C'est le mode recommande : il ne demande aucun mot de passe d'application, aucune ouverture de port
IMAP, et il tourne sur l'infrastructure de Google. Le mode `imap` reste disponible pour une boite
qui n'est pas chez Google.

## Le libelle est la seule limite du perimetre

La boite qui recoit la copie n'est pas toujours une boite dediee : ce peut etre celle d'un dirigeant,
ou celle d'un manager, qui contient aussi d'autres clients et du courrier personnel. Le libelle est
alors **la seule chose** qui dit au script ce qu'il a le droit d'envoyer.

Trois consequences, a ne pas contourner :

1. **La recherche du script porte sur le libelle, jamais sur la boite de reception.** Une requete
   comme `in:inbox OR in:sent` enverrait toute la boite a la GPAO d'un seul compte client.
2. **Un libelle par compte client.** Deux clients dans la meme boite demandent deux libelles et deux
   projets Apps Script, chacun avec son `COMPTE_ID`.
3. **Le script s'arrete si le libelle n'existe pas.** Un libelle mal orthographie ne doit pas se
   traduire par un envoi plus large, ni par un silence que personne ne remarque.

Ce qui tombe dans le libelle sans concerner le poste (infolettres, notifications d'outils, travail de
la designer) n'a pas besoin d'etre trie a la main : la GPAO le classe en famille T00, hors perimetre,
et l'ecarte de toutes les vues de pilotage et de tous les exports.

## Ce que fait le script

Toutes les cinq minutes, il cherche les fils de discussion arrives depuis son dernier passage,
envoie chaque message complet a la GPAO, puis pose une etiquette sur le fil pour ne pas le renvoyer.

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
4. Renseigner les quatre constantes en tete : l'adresse de la GPAO, le secret, l'identifiant du
   compte client (visible dans l'URL de l'ecran Dossiers, ou demande au manager), et **le libelle
   exact** sous lequel les mails du poste sont ranges, majuscules et accents compris.

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
 * Libelle qui delimite le perimetre, et rien d'autre.
 *
 * La boite peut contenir d'autres clients et du courrier personnel : ne jamais elargir la
 * recherche a `in:inbox` ni a `in:sent`, ce qui enverrait toute la boite a ce compte client.
 */
const LIBELLE_SOURCE = 'Masenz';

/** Etiquette posee sur les fils deja envoyes, pour ne jamais les renvoyer. */
const ETIQUETTE = 'GPAO traite';
/** Nombre de messages envoyes par passage. La GPAO en accepte 100 au maximum. */
const LOT = 50;

function collecter() {
  // Un libelle absent (renomme, mal orthographie) doit arreter le script : sans ce controle, la
  // recherche ne renverrait rien et l'arret passerait pour un « rien a collecter » normal.
  if (!GmailApp.getUserLabelByName(LIBELLE_SOURCE)) {
    throw new Error('Libelle source introuvable : ' + LIBELLE_SOURCE);
  }
  const etiquette = obtenirEtiquette_();
  // Les fils du libelle source, non encore traites. Le libelle porte les mails recus comme envoyes.
  const requete = 'label:"' + LIBELLE_SOURCE + '" -label:"' + ETIQUETTE + '" newer_than:14d';
  const fils = GmailApp.search(requete, 0, 25);
  if (fils.length === 0) {
    Logger.log('Rien a collecter.');
    return;
  }

  const messages = [];
  const filsEnvoyes = [];

  for (const fil of fils) {
    if (messages.length >= LOT) break;
    for (const message of fil.getMessages()) {
      if (messages.length >= LOT) break;
      messages.push({ brut: message.getRawContent() });
    }
    filsEnvoyes.push(fil);
  }

  const charge = JSON.stringify({ compteId: COMPTE_ID, messages: messages });
  const reponse = UrlFetchApp.fetch(URL_GPAO, {
    method: 'post',
    contentType: 'application/json',
    payload: charge,
    headers: { 'X-AZMG-Signature': signer_(charge) },
    muteHttpExceptions: true,
  });

  const code = reponse.getResponseCode();
  if (code !== 200) {
    // On ne pose pas l'etiquette : les messages repartiront au prochain passage.
    Logger.log('Echec (' + code + ') : ' + reponse.getContentText().slice(0, 300));
    return;
  }

  // Succes : les fils envoyes sont etiquetes et ne reviendront plus.
  for (const fil of filsEnvoyes) fil.addLabel(etiquette);
  Logger.log('Envoye : ' + messages.length + ' message(s). ' + reponse.getContentText().slice(0, 200));
}

/** Signature HMAC SHA-256 du corps, en hexadecimal. */
function signer_(corps) {
  const octets = Utilities.computeHmacSha256Signature(corps, SECRET);
  return octets
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
| `401 Signature invalide` | la cle du script n'est pas celle du `.env`, ou le corps a ete modifie en route |
| `400 Charge invalide` | `COMPTE_ID` absent ou faux dans le script |
| Rien n'arrive, aucune erreur | la recherche Gmail ne trouve rien : verifier l'etiquette « GPAO traite » et la fenetre `newer_than` |
| `Libelle source introuvable` | `LIBELLE_SOURCE` ne correspond a aucun libelle : recopier le nom exact, accents et majuscules compris. Un libelle imbrique s'ecrit en entier, par exemple `A - Clients/Masenz` |
| Des mails etrangers au poste arrivent dans la GPAO | ils sont hors perimetre et classes T00, donc absents du pilotage. S'ils sont nombreux, c'est le libelle qui est trop large cote Gmail |
| Les memes messages reviennent | l'etiquette n'est pas posee : le dernier appel a echoue, regarder le journal |

La GPAO dedoublonne de toute facon sur l'identifiant du message : un envoi en double ne cree jamais
deux fois le meme evenement.

## Reprendre l'historique

Pour les mails anterieurs a la mise en place, l'ecran « Import des mails » de la GPAO accepte des
fichiers `.eml` et `.mbox`. Dans Gmail, l'export passe par
[Google Takeout](https://takeout.google.com) : choisir Mail, puis le libelle voulu. Le fichier
`.mbox` obtenu peut etre depose directement.

L'import et la collecte se dedoublonnent entre eux : importer un historique qui recouvre deja
quelques jours collectes ne cree aucun doublon.
