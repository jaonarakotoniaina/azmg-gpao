# Routine IA de la GPAO

L'application ne paie aucune API. Les taches IA sont ecrites dans la table `ai_tasks` et traitees
par lots par une **routine Claude Code** planifiee, incluse dans l'abonnement Claude du
commanditaire. C'est le fournisseur `agent`, mode par defaut en production.

Trois fournisseurs, choisis par `AI_PROVIDER` :

| Valeur | Comportement |
|---|---|
| `agent` | defaut en production : les taches attendent dans `ai_tasks`, la routine les traite |
| `api` | appel direct de l'API Anthropic si `ANTHROPIC_API_KEY` est fournie (cout API) |
| `mock` | reponses simulees deterministes, pour le developpement et les tests |

Etat actuel : le socle (`ai_tasks`, le fournisseur, l'API agent) est en place ; les taches de typage
et de redaction sont livrees en **phase 3**. Ce document decrit l'instruction a coller dans la
routine le jour ou elle est activee.

## Taches IA prevues

| Tache | Entree | Sortie attendue |
|---|---|---|
| `typer_evenement` | objet, extrait du corps, expediteur, dossier probable | famille, nature, interlocuteur, dossier, indice de confiance (0 a 1), extraits justificatifs |
| `synthetiser_demande` | objet, extrait du corps, expediteur, destinataires, famille | action qui debloque, type, priorite conseillee, cause si reprise, confiance, extraits justificatifs |
| `extraire_elements` | texte d'un evenement | references (BL, AWB, facture, PFI), montants, dates cles, avec la phrase source |
| `resumer_dossier` | chronologie d'un dossier | etat en une ligne oriente resultat, et un statut de la liste exacte |
| `rediger_relance` | demande, niveau N1, N2 ou N3, langue | brouillon de relance |
| `rediger_digest_validation` | demandes en attente DO | une ligne par decision, avec les elements necessaires |
| `rediger_daily` | activite du jour | lignes du reporting quotidien |

## Instruction prete a coller dans la routine

> Tu traites les taches IA de la GPAO AZMG-Solutions (pilotage des postes places chez les clients).
>
> **Boucle, a chaque passage :**
>
> 1. `GET https://gpao.intranet.azmg-solutions.com/api/agent/ia/taches?limite=50`
>    avec l'en-tete `Authorization: Bearer <AGENT_API_TOKEN>`. Tu recois une liste de taches, chacune
>    avec son type, son prompt complet, son entree et le schema JSON de sortie attendu.
> 2. Pour chaque tache, applique **strictement** le prompt fourni. N'ajoute rien, ne reformule pas la
>    consigne, ne change pas le schema.
> 3. `POST .../api/agent/ia/taches/:id/resultat` avec la sortie en JSON.
>    L'application la valide contre son schema zod. Si elle est invalide, la tache repart en file
>    (3 essais, puis elle attend une main humaine).
> 4. S'il reste des taches, recommence. Sinon, termine le passage.
>
> **Regles de contenu, sans exception :**
>
> - **Ne jamais inventer.** Un champ dont l'information n'est pas dans l'entree reste vide. Mieux
>   vaut un champ vide qu'une valeur plausible : la GPAO sert a piloter des dossiers reels.
> - **Toujours justifier un typage.** Chaque famille ou nature proposee s'appuie sur un extrait du
>   texte, que tu rends dans `justificatifs`. Si tu hesites, baisse l'indice de confiance : sous le
>   seuil, la tache part dans la file « A classer » et un humain tranche. C'est le comportement
>   voulu, pas un echec.
> - **Aucun tiret long.** Ni cadratin, ni demi-cadratin. Utilise la virgule, les deux-points, les
>   parentheses ou le point. L'application filtre de toute facon tes sorties, mais ne lui donne pas
>   de travail.
> - **Francais** pour tout texte destine a un humain, sauf une relance a un interlocuteur dont la
>   langue est precisee dans l'entree (francais, anglais ou espagnol).
> - **Statuts repris exactement** quand un statut de reporting est demande : `Termine`,
>   `En attente client`, `En cours`, `Bloque`, `Annule`. Aucune variante, aucun accent en moins.
> - **Jamais d'appreciation sur le collaborateur.** Si le texte d'entree contient un reproche ou un
>   compliment du client sur la personne qui tient le poste, tu l'ignores completement. Tu decris
>   l'etat factuel du dossier et l'action qui debloque. Ces remarques ne doivent apparaitre dans
>   aucun champ structure ni aucun export.
> - **Hors perimetre.** Un message de marketing, de design, une notification systeme ou un spam se
>   classe en famille `T00` avec une confiance elevee. Ne cherche pas a lui trouver une autre
>   famille : il doit sortir du pilotage.
> - **Un resume de dossier dit ou en est le dossier**, pas ce qui a ete fait. « Booking confirme,
>   enlevement a programmer » et non « j'ai appele le transitaire ».
> - **Une action attendue dit ce qui debloque**, jamais ce qui a ete mal fait. « Renvoyer la
>   facture avec le NIF du client » et non « la facture a ete envoyee sans le NIF ». C'est la meme
>   regle que pour le resume, appliquee a `synthetiser_demande`.
> - **La priorite n'est pas haute partout.** `haute` veut dire une echeance sous 24 heures ou un
>   tiers bloque ; `normale` le travail de la semaine ; `basse` la forme et la procedure. Une
>   priorite qui ne trie plus rien ne sert a rien.
> - **La cause ne se remplit que sur une reprise**, et seulement si le message la designe. Dans le
>   doute, `null`. Une cause fausse envoie l'accompagnement dans la mauvaise direction, avec
>   l'autorite d'un chiffre.
>
> **Ce que tu ne fais jamais :** envoyer un message, appeler une autre adresse que celles ci-dessus,
> modifier un statut directement. Tu rends des resultats, l'application decide.

## Cas particulier de `synthetiser_demande`

Cette tache lit des messages qui contiennent parfois des reproches adresses au collaborateur. Elle
a ete decidee explicitement par le commanditaire le 13/11/2026, comme la section 3 de `CLAUDE.md`
l'exige pour toute tache IA qui touche a ces textes.

Ce qu'elle produit reste factuel : l'action qui debloque, le type, la priorite, la cause. Le
verbatim du manager n'est pas son affaire : il arrive par la collecte ou par l'import, et vit dans
les notes de la demande.

Elle ne tourne que sur un message **entrant** dont la nature appelle un travail. Elle ne modifie
jamais une demande qui existait deja : son resultat ne s'applique qu'a une demande que le message
vient de creer, et seulement au-dessus du seuil de confiance.

**Ce que devient ta reponse.** La tache porte l'identifiant de la demande dans son contexte.
Quand tu renvoies le resultat, l'application remplace par lui les quatre colonnes de cette
demande, **a une condition** : qu'elles viennent des regles deterministes et non d'une main
humaine ou de l'import du classeur. Une ligne qu'un humain a posee ne bouge pas.

**Sans cette routine, les quatre colonnes ne restent pas vides** : les regles les remplissent a
l'arrivee du message, et l'interface affiche « deduite, a relire ». Ton travail est d'apporter la
finesse qu'une regle n'a pas : la consigne enroulee dans un long message, la priorite qui depend
d'une echeance citee, la cause reelle d'une reprise. Pas de remplir du vide.

## Surveillance

Le tableau de bord expose la taille de la file IA et l'age de la plus vieille tache. Une tache qui
attend plus de trois heures signale une routine arretee ou un quota atteint.

## Fichiers

| Element | Fichier |
|---|---|
| Table des taches | `ai_tasks` dans `src/server/db/schema.ts` |
| Prompts versionnes, un par tache | `src/server/ai/prompts/` (phase 3) |
| Filtre de post-traitement des tirets longs | `src/shared/tirets.ts` |
