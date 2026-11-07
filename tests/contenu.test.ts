/**
 * Regles de contenu et de confidentialite de la section 3 de CLAUDE.md.
 *
 * Le test central : aucun tiret long (cadratin, demi-cadratin, barre horizontale, tiret de
 * liste) dans l'interface, les exports, les emails, les textes generes et les prompts.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { contientTiretLong, nettoyerProfondement, retirerTiretsLongs, TIRETS_LONGS } from '../src/shared/tirets';
import { lireClasseur } from '../src/server/lib/xlsx/lecture';
import {
  CODES_FAMILLES,
  DEFINITIONS_NATURES,
  DEFINITIONS_STATUTS,
  FAMILLES,
  FAMILLES_PILOTAGE,
  INTERLOCUTEURS,
  LIBELLES_ECHEANCES,
  LIBELLES_INTERLOCUTEURS,
  LIBELLES_ROLES,
  LIBELLES_SOURCES,
  NATURES,
  ROLES,
  SOURCES,
  STATUTS,
  STATUTS_REPORTING,
  TYPES_ECHEANCE,
  definitionNature,
  definitionStatut,
  estHorsPerimetre,
} from '../src/shared/constantes';
import { entreesInitiales, CHECKLISTS_INITIALES, GRILLES_INITIALES } from '../src/server/db/referentiel';
import { parametresParDefaut } from '../src/shared/parametres';

const RACINE = path.resolve(__dirname, '..');

/** Fichiers porteurs de texte destine a un humain : interface, referentiels, prompts, modeles. */
function fichiersATexte(): string[] {
  const dossiers = ['src/web', 'src/shared', 'src/server/ai', 'src/server/emails', 'src/server/db/referentiel.ts', 'src/server/modules'];
  const sortie: string[] = [];
  const parcourir = (chemin: string) => {
    if (!fs.existsSync(chemin)) return;
    const stat = fs.statSync(chemin);
    if (stat.isFile()) {
      if (/\.(ts|tsx|html|css|md|txt|json)$/.test(chemin)) sortie.push(chemin);
      return;
    }
    for (const entree of fs.readdirSync(chemin)) parcourir(path.join(chemin, entree));
  };
  for (const d of dossiers) parcourir(path.join(RACINE, d));
  return sortie;
}

describe('aucun tiret long', () => {
  it('dans aucun fichier porteur de texte destine a un humain', () => {
    const fautifs: { fichier: string; ligne: number; extrait: string }[] = [];
    for (const fichier of fichiersATexte()) {
      const lignes = fs.readFileSync(fichier, 'utf8').split('\n');
      lignes.forEach((ligne, i) => {
        if (TIRETS_LONGS.test(ligne)) {
          fautifs.push({ fichier: path.relative(RACINE, fichier), ligne: i + 1, extrait: ligne.trim().slice(0, 120) });
        }
      });
    }
    expect(fautifs, `Tirets longs trouves :\n${fautifs.map((f) => `  ${f.fichier}:${f.ligne} ${f.extrait}`).join('\n')}`).toEqual([]);
  });

  it('dans aucun libelle du referentiel initial', () => {
    const libelles = [
      ...FAMILLES.flatMap((f) => [f.libelle, f.validation]),
      ...DEFINITIONS_NATURES.flatMap((n) => [n.libelle, n.effet]),
      ...DEFINITIONS_STATUTS.flatMap((s) => [s.libelle, s.reporting, s.mention ?? '']),
      ...Object.values(LIBELLES_INTERLOCUTEURS),
      ...Object.values(LIBELLES_SOURCES),
      ...Object.values(LIBELLES_ECHEANCES),
      ...Object.values(LIBELLES_ROLES),
      ...entreesInitiales().map((e) => e.libelle),
      ...CHECKLISTS_INITIALES.flatMap((c) => [c.libelle, ...c.points.map((p) => p.libelle)]),
      ...GRILLES_INITIALES.flatMap((g) => [g.libelle, ...g.criteres.map((c) => c.libelle)]),
    ];
    const fautifs = libelles.filter((l) => contientTiretLong(l));
    expect(fautifs).toEqual([]);
  });

  it('dans le classeur fictif de test', () => {
    const fixture = path.join(RACINE, 'tests', 'fixtures', 'SUIVI_MENSUEL_FICTIF_07-11.xlsx');
    const classeur = lireClasseur(fs.readFileSync(fixture));
    const fautifs = classeur.chainesPartagees.filter((c: string) => contientTiretLong(c));
    expect(fautifs).toEqual([]);
  });
});

describe('filtre de post-traitement', () => {
  it('remplace une incise par une virgule', () => {
    expect(retirerTiretsLongs('Le dossier — bloque — attend la DO')).toBe('Le dossier, bloque, attend la DO');
  });

  it('remplace une plage de nombres par « a »', () => {
    expect(retirerTiretsLongs('10–20 kg')).toBe('10 à 20 kg');
  });

  it('remplace un tiret de puce par un tiret court', () => {
    expect(retirerTiretsLongs('— premier point')).toBe('- premier point');
  });

  it('laisse intact un texte sans tiret long', () => {
    const texte = 'Cotation demandee, reponse attendue sous 8 heures ouvrees.';
    expect(retirerTiretsLongs(texte)).toBe(texte);
  });

  it('nettoie recursivement une structure JSON, comme une sortie de Claude', () => {
    const sortie = nettoyerProfondement({
      resume: 'Dossier — en attente',
      lignes: ['prix 10–20 euros', { note: 'validation – DO' }],
      confiance: 0.9,
    });
    expect(JSON.stringify(sortie)).not.toMatch(TIRETS_LONGS);
    expect(sortie.confiance).toBe(0.9);
  });
});

describe('coherence du referentiel', () => {
  it('reprend exactement les cinq statuts de reporting client', () => {
    expect([...STATUTS_REPORTING]).toEqual(['Termine', 'En attente client', 'En cours', 'Bloque', 'Annule']);
  });

  it('definit les quinze familles de l’audit, de T00 a T14', () => {
    expect(CODES_FAMILLES).toHaveLength(15);
    expect(CODES_FAMILLES[0]).toBe('T00');
    expect(CODES_FAMILLES[14]).toBe('T14');
    expect(FAMILLES_PILOTAGE).toHaveLength(14);
    expect(FAMILLES_PILOTAGE.some((f) => estHorsPerimetre(f.code))).toBe(false);
  });

  it('donne un delai cible et un temps standard a chaque famille de pilotage', () => {
    for (const f of FAMILLES_PILOTAGE) {
      expect(f.slaHeures, `famille ${f.code}`).toBeGreaterThan(0);
      expect(f.tempsStandardMinutes, `famille ${f.code}`).toBeGreaterThan(0);
      expect(f.validation.length, `famille ${f.code}`).toBeGreaterThan(0);
    }
  });

  it('declare un sens et un effet pour chaque nature', () => {
    for (const code of NATURES) {
      const def = definitionNature(code);
      expect(def, `nature ${code}`).toBeDefined();
      expect(def!.effet.length).toBeGreaterThan(0);
    }
  });

  it('associe chaque statut a un statut de reporting valide', () => {
    for (const code of STATUTS) {
      const def = definitionStatut(code);
      expect(def, `statut ${code}`).toBeDefined();
      expect(STATUTS_REPORTING).toContain(def!.reporting);
    }
  });

  it('produit les entrees initiales de tous les referentiels', () => {
    const entrees = entreesInitiales();
    const parType = new Map<string, number>();
    for (const e of entrees) parType.set(e.type, (parType.get(e.type) ?? 0) + 1);
    expect(parType.get('famille')).toBe(FAMILLES.length);
    expect(parType.get('nature')).toBe(NATURES.length);
    expect(parType.get('statut')).toBe(STATUTS.length);
    expect(parType.get('interlocuteur')).toBe(INTERLOCUTEURS.length);
    expect(parType.get('source')).toBe(SOURCES.length);
    expect(parType.get('echeance')).toBe(TYPES_ECHEANCE.length);
    // Aucune cle dupliquee.
    const cles = entrees.map((e) => `${e.type}:${e.code}`);
    expect(new Set(cles).size).toBe(cles.length);
  });

  it('donne un libelle a chaque role', () => {
    for (const r of ROLES) expect(LIBELLES_ROLES[r]).toBeTruthy();
  });
});

describe('parametres par defaut', () => {
  it('couvrent toutes les familles et restent valides', () => {
    const p = parametresParDefaut(2026);
    for (const code of CODES_FAMILLES) expect(p.sla.parFamille).toHaveProperty(code);
    expect(p.seuilConfianceTypage).toBe(0.8);
    expect(p.qualite.tauxEchantillon).toBe(0.1);
    expect(p.alertes.joursAvantEcheance).toEqual([2, 0]);
  });

  it('appliquent la regle du compte Masenz sur les feries', () => {
    const p = parametresParDefaut(2026);
    expect(p.horaires.feriesCollaborateur).toBe(false);
    expect(p.horaires.feriesClient.length).toBeGreaterThan(0);
    expect(p.horaires.feriesLocaux.length).toBeGreaterThan(0);
  });

  it('ne declenchent aucun envoi automatique vers l’exterieur', () => {
    const p = parametresParDefaut(2026);
    // Regle d'or : l'IA prepare, l'humain envoie. Rien ne part sans relecture.
    expect(p.automatisations.relances.mode).toBe('brouillon');
    expect(p.automatisations.digest_do.mode).toBe('brouillon');
    expect(p.automatisations.daily.mode).toBe('brouillon');
  });
});
