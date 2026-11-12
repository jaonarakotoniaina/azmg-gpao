/**
 * Commandes d'administration :
 *   migrate                        applique les migrations et les referentiels
 *   seed                           donnees de demonstration fictives (refuse en production)
 *   creer-admin <email> <nom>      cree un compte administrateur (mot de passe via ADMIN_PASSWORD)
 *   creer-utilisateur <email> <role> <nom>
 */
import './charger-env';
import { migrer, fermerDb } from './db/client';
import './modules';
import { initialiserChecklistsEtGrilles, initialiserReferentiel } from './db/referentiel';
import { initialiserRegles } from './modules/typage/service';
import { config } from './config';
import { ROLES, type Role } from '@shared/constantes';

async function principal() {
  const [commande, ...args] = process.argv.slice(2);
  if (commande === 'migrate') {
    await migrer();
    const { ajoutees } = await initialiserReferentiel();
    await initialiserChecklistsEtGrilles();
    const regles = await initialiserRegles();
    console.log(`Migrations appliquees. Referentiels : ${ajoutees} entree(s), regles de typage : ${regles.ajoutees}.`);
  } else if (commande === 'seed') {
    if (config.production && !process.env.FORCER_SEED) throw new Error('Le seed de demonstration est desactive en production.');
    const { seedDemo } = await import('./db/seed');
    const bilan = await seedDemo();
    console.log('Donnees de demonstration creees :', JSON.stringify(bilan));
  } else if (commande === 'creer-admin' || commande === 'creer-utilisateur') {
    const motDePasse = process.env.ADMIN_PASSWORD;
    if (!motDePasse || motDePasse.length < 10) throw new Error('ADMIN_PASSWORD manquant ou trop court (10 caracteres minimum)');
    let email: string;
    let role: Role;
    let nom: string;
    if (commande === 'creer-admin') {
      const [e, ...reste] = args;
      email = e ?? '';
      role = 'admin';
      nom = reste.join(' ') || 'Administrateur';
    } else {
      const [e, r, ...reste] = args;
      email = e ?? '';
      if (!ROLES.includes(r as Role)) throw new Error(`Role inconnu : ${r}. Attendu : ${ROLES.join(', ')}`);
      role = r as Role;
      nom = reste.join(' ') || email || 'Utilisateur';
    }
    if (!email) throw new Error('Usage : ADMIN_PASSWORD=... npm run cli creer-admin email@domaine "Nom"');
    const { creerUtilisateur } = await import('./modules/auth/service');
    await creerUtilisateur({ email, nom, role, motDePasse });
    console.log(`Compte cree : ${email} (${role})`);
  } else {
    console.error('Commandes : migrate, seed, creer-admin, creer-utilisateur');
    process.exitCode = 1;
  }
}

principal()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => fermerDb());
