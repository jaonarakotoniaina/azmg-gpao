# Collecte des mails par Google Apps Script

La boite Gmail de suivi recoit une copie des mails du poste, envoyes et recus. Ce script, installe
sur cette boite, pousse chaque nouveau message vers la GPAO.

C'est le mode recommande : il ne demande aucun mot de passe d'application, aucune ouverture de port
IMAP, et il tourne sur l'infrastructure de Google. Le mode `imap` reste disponible pour une boite
qui n'est pas chez Google.

## Ce que fait le script

Toutes les cinq minutes, il cherche les fils de discussion arrives depuis son dernier passage,
envoie chaque message complet a la GPAO, puis pose une etiquette sur le fil pour ne pas le renvoyer.

La GPAO se charge du reste : dedoublonnage par identifiant de message, rattachement au fil,
typage, et creation ou avancement de la demande.

## Mise en place, une seule fois

### 1. Secret partage

Sur le serveur, ajouter a `~/azmg-gpao/shared/.env` une cle longue et aleatoire :

```
COLLECTE_MAIL=apps_script
APPS_SCRIPT_SECRET=<la cle>
```

La generer avec `openssl rand -hex 32`. Redemarrer l'application :
`touch ~/azmg-gpao/app/tmp/restart.txt`.

### 2. Creer le projet Apps Script

1. Ouvrir [script.google.com](https://script.google.com) avec le compte Google de la boite de suivi.
2. Nouveau projet, le nommer `Collecte GPAO`.
3. Coller le script ci-dessous dans `Code.gs`.
4. Renseigner les trois constantes en tete : l'adresse de la GPAO, le secret, et l'identifiant du
   compte client (visible dans l'URL de l'ecran Dossiers, ou demande au manager).

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
 * Collecte GPAO : pousse les nouveaux messages de la boite de suivi vers AZMG GPAO.
 * Declencheur : toutes les 5 minutes sur la fonction collecter().
 */
const URL_GPAO = 'https://gpao.intranet.azmg-solutions.com/api/collecte/apps-script';
const SECRET = 'COLLER_ICI_LA_MEME_CLE_QUE_APPS_SCRIPT_SECRET';
const COMPTE_ID = 1;

/** Etiquette posee sur les fils deja envoyes, pour ne jamais les renvoyer. */
const ETIQUETTE = 'GPAO traite';
/** Nombre de messages envoyes par passage. La GPAO en accepte 100 au maximum. */
const LOT = 50;

function collecter() {
  const etiquette = obtenirEtiquette_();
  // Les fils de la boite de reception et des messages envoyes, non encore traites.
  const requete = '(in:inbox OR in:sent) -label:"' + ETIQUETTE + '" newer_than:14d';
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
| Rien n'arrive, aucune erreur | la recherche Gmail ne trouve rien : verifier l'etiquette et la fenetre `newer_than` |
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
