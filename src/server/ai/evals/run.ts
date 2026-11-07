/**
 * Mesure du typage sur le jeu de mails fictifs annotes.
 *
 *   npx tsx src/server/ai/evals/run.ts            moteur de regles seul
 *   npx tsx src/server/ai/evals/run.ts --detail   avec le detail des erreurs
 *
 * Critere de la phase 3 : au moins 85 % des mails bien classes en famille ET en nature.
 */
import { appliquerRegles } from '../../modules/typage/regles';
import { MAILS_ANNOTES, type MailAnnote } from './mails-annotes';
import { MAILS_TEMOINS } from './mails-temoins';

export interface BilanEval {
  total: number;
  familleJuste: number;
  natureJuste: number;
  /** Famille et nature justes toutes les deux : c'est la mesure du critere. */
  lesDeux: number;
  interlocuteurJuste: number;
  /** Mails pour lesquels aucune regle n'a repondu. */
  sansReponse: number;
  tauxFamille: number;
  tauxNature: number;
  tauxLesDeux: number;
  erreurs: {
    reference: string;
    objet: string;
    attendu: { famille: string; nature: string };
    obtenu: { famille: string | null; nature: string | null; confiance: number };
  }[];
}

export function evaluer(jeu: MailAnnote[] = MAILS_ANNOTES): BilanEval {
  const bilan: BilanEval = {
    total: jeu.length,
    familleJuste: 0,
    natureJuste: 0,
    lesDeux: 0,
    interlocuteurJuste: 0,
    sansReponse: 0,
    tauxFamille: 0,
    tauxNature: 0,
    tauxLesDeux: 0,
    erreurs: [],
  };

  for (const mail of jeu) {
    const resultat = appliquerRegles({ objet: mail.objet, corps: mail.corps, expediteur: mail.expediteur, sens: mail.sens });
    const obtenu = resultat?.typage ?? { famille: null, nature: null, interlocuteur: null, confiance: 0 };
    if (!resultat) bilan.sansReponse++;

    const familleOk = obtenu.famille === mail.attendu.famille;
    const natureOk = obtenu.nature === mail.attendu.nature;
    if (familleOk) bilan.familleJuste++;
    if (natureOk) bilan.natureJuste++;
    if (familleOk && natureOk) bilan.lesDeux++;
    if (mail.attendu.interlocuteur && obtenu.interlocuteur === mail.attendu.interlocuteur) bilan.interlocuteurJuste++;

    if (!familleOk || !natureOk) {
      bilan.erreurs.push({
        reference: mail.reference,
        objet: mail.objet,
        attendu: { famille: mail.attendu.famille, nature: mail.attendu.nature },
        obtenu: { famille: obtenu.famille, nature: obtenu.nature, confiance: obtenu.confiance },
      });
    }
  }

  bilan.tauxFamille = bilan.familleJuste / bilan.total;
  bilan.tauxNature = bilan.natureJuste / bilan.total;
  bilan.tauxLesDeux = bilan.lesDeux / bilan.total;
  return bilan;
}

function afficher(titre: string, bilan: BilanEval, detail: boolean) {
  const pourcent = (v: number) => `${Math.round(v * 1000) / 10} %`;
  console.log(`\n${titre} (${bilan.total} mails)`);
  console.log(`  famille juste          : ${bilan.familleJuste}/${bilan.total}  ${pourcent(bilan.tauxFamille)}`);
  console.log(`  nature juste           : ${bilan.natureJuste}/${bilan.total}  ${pourcent(bilan.tauxNature)}`);
  console.log(`  famille ET nature      : ${bilan.lesDeux}/${bilan.total}  ${pourcent(bilan.tauxLesDeux)}  (critere : 85 %)`);
  console.log(`  aucune regle ne repond : ${bilan.sansReponse}`);
  if (detail && bilan.erreurs.length) {
    console.log('  Erreurs :');
    for (const e of bilan.erreurs) {
      console.log(`    ${e.reference} « ${e.objet} »`);
      console.log(`      attendu : ${e.attendu.famille} / ${e.attendu.nature}`);
      console.log(`      obtenu  : ${e.obtenu.famille ?? 'aucune'} / ${e.obtenu.nature ?? 'aucune'} (confiance ${e.obtenu.confiance})`);
    }
  }
}

if (require.main === module) {
  const detail = process.argv.includes('--detail');
  const principal = evaluer(MAILS_ANNOTES);
  const temoin = evaluer(MAILS_TEMOINS);
  afficher('Jeu principal, qui a servi a regler les regles', principal, detail);
  afficher('Jeu temoin, jamais utilise pour regler les regles', temoin, detail);
  console.log('\nC\u2019est le jeu temoin qui mesure honnetement ce que le typage sait faire.');
  // Le critere porte sur le jeu temoin : c'est lui qui dit si le moteur generalise.
  process.exit(temoin.tauxLesDeux >= 0.85 ? 0 : 1);
}
