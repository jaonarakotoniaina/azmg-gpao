/**
 * Ecriture chirurgicale dans un classeur xlsx existant.
 *
 * Exigence de la section 9 de CLAUDE.md : l'export doit ecrire dans un classeur fourni en entree
 * « sans en modifier la structure » (colonnes, en-tetes, noms d'onglets, mise en forme, formules).
 *
 * D'ou le parti pris suivant : on ne reconstruit jamais le classeur. On ouvre l'archive, on ne
 * reecrit que les parties strictement necessaires (la feuille modifiee et, si de nouveaux textes
 * apparaissent, la table des chaines partagees), et toutes les autres entrees sont recopiees
 * telles quelles. Dans la feuille elle-meme, on ne touche qu'aux cellules visees :
 *
 *  - une cellule existante conserve son attribut de style `s` et donc sa mise en forme ;
 *  - une formule n'est jamais remplacee par sa valeur, et une cellule qui en porte une est
 *    refusee a l'ecriture plutot que d'etre ecrasee silencieusement ;
 *  - les lignes existantes qu'on ne modifie pas ressortent octet pour octet ;
 *  - une nouvelle ligne reprend les styles de la ligne modele indiquee, pour garder l'aspect.
 */
import { lireZip, type EntreeZip } from './zip';
import { ecrireZip } from './ecriture-zip';
import { decoderRef, encoderXml, lettreColonne } from './lecture';

export type ValeurCellule = string | number | null;

/** Une cellule a ecrire, designee par sa colonne (1 = A). */
export interface CelluleAEcrire {
  colonne: number;
  valeur: ValeurCellule;
}

/** Une ligne a ajouter en fin de feuille. */
export interface LigneAAjouter {
  cellules: CelluleAEcrire[];
  /**
   * Numero d'une ligne existante dont les styles sont repris, colonne par colonne.
   * Sans modele, les nouvelles cellules n'ont aucun style (aspect par defaut du classeur).
   */
  ligneModele?: number;
}

const SIGNATURE_CHAINES = 'xl/sharedStrings.xml';

export class ClasseurModifiable {
  private entrees: Map<string, EntreeZip>;
  private chaines: string[];
  private indexChaines: Map<string, number>;
  private chainesModifiees = false;
  /** Feuilles reecrites, par chemin dans l'archive. */
  private feuilles = new Map<string, string>();
  private cheminsParNom = new Map<string, string>();

  constructor(buffer: Buffer) {
    this.entrees = lireZip(buffer);
    this.chaines = this.lireChaines();
    this.indexChaines = new Map(this.chaines.map((c, i) => [c, i]));
    for (const { nom, chemin } of this.lireOnglets()) this.cheminsParNom.set(nom.trim().toLowerCase(), chemin);
  }

  /** Noms des onglets, dans l'ordre du classeur. */
  nomsOnglets(): string[] {
    return this.lireOnglets().map((o) => o.nom);
  }

  private lireOnglets(): { nom: string; chemin: string }[] {
    const classeur = this.entrees.get('xl/workbook.xml');
    if (!classeur) throw new Error('Classeur invalide : xl/workbook.xml absent');
    const relations = this.entrees.get('xl/_rels/workbook.xml.rels');
    const cibles = new Map<string, string>();
    if (relations) {
      const xml = relations.contenu.toString('utf8');
      const motif = /<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"[^>]*\/?>/g;
      let m: RegExpExecArray | null;
      while ((m = motif.exec(xml))) {
        const cible = m[2].startsWith('/') ? m[2].slice(1) : `xl/${m[2].replace(/^\.\//, '')}`;
        cibles.set(m[1], cible);
      }
    }
    const xml = classeur.contenu.toString('utf8');
    const sortie: { nom: string; chemin: string }[] = [];
    const motif = /<sheet\b([^>]*)\/?>/g;
    let m: RegExpExecArray | null;
    let indice = 0;
    while ((m = motif.exec(xml))) {
      const nom = /\bname="([^"]*)"/.exec(m[1])?.[1];
      if (nom === undefined) continue;
      indice++;
      const idRelation = /\br:id="([^"]*)"/.exec(m[1])?.[1];
      sortie.push({ nom, chemin: (idRelation && cibles.get(idRelation)) || `xl/worksheets/sheet${indice}.xml` });
    }
    return sortie;
  }

  private lireChaines(): string[] {
    const partie = this.entrees.get(SIGNATURE_CHAINES);
    if (!partie) return [];
    const xml = partie.contenu.toString('utf8');
    const chaines: string[] = [];
    const motif = /<si(?:\s[^>]*)?>([\s\S]*?)<\/si>|<si(?:\s[^>]*)?\/>/g;
    let m: RegExpExecArray | null;
    while ((m = motif.exec(xml))) {
      if (m[1] === undefined) {
        chaines.push('');
        continue;
      }
      let texte = '';
      const motifT = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g;
      let x: RegExpExecArray | null;
      while ((x = motifT.exec(m[1]))) texte += decoderEntites(x[1] ?? '');
      chaines.push(texte);
    }
    return chaines;
  }

  /** Index d'une chaine dans la table partagee, ajoutee si elle n'y est pas encore. */
  private indexChaine(texte: string): number {
    const deja = this.indexChaines.get(texte);
    if (deja !== undefined) return deja;
    const indice = this.chaines.length;
    this.chaines.push(texte);
    this.indexChaines.set(texte, indice);
    this.chainesModifiees = true;
    return indice;
  }

  private cheminOnglet(nom: string): string {
    const chemin = this.cheminsParNom.get(nom.trim().toLowerCase());
    if (!chemin) throw new Error(`Onglet « ${nom} » absent du classeur. Onglets presents : ${this.nomsOnglets().join(', ')}`);
    return chemin;
  }

  private feuille(nom: string): string {
    const chemin = this.cheminOnglet(nom);
    const deja = this.feuilles.get(chemin);
    if (deja !== undefined) return deja;
    const partie = this.entrees.get(chemin);
    if (!partie) throw new Error(`Feuille introuvable dans l'archive : ${chemin}`);
    const xml = partie.contenu.toString('utf8');
    this.feuilles.set(chemin, xml);
    return xml;
  }

  private ecrireFeuille(nom: string, xml: string) {
    this.feuilles.set(this.cheminOnglet(nom), xml);
  }

  /** Numero de la derniere ligne portant des donnees. */
  derniereLigne(nom: string): number {
    const xml = this.feuille(nom);
    let max = 0;
    const motif = /<row\b[^>]*\br="(\d+)"/g;
    let m: RegExpExecArray | null;
    while ((m = motif.exec(xml))) max = Math.max(max, Number(m[1]));
    return max;
  }

  /** Styles de chaque colonne d'une ligne existante, pour servir de modele. */
  stylesDeLaLigne(nom: string, ligne: number): Map<number, string> {
    const sortie = new Map<number, string>();
    const brut = this.extraireLigne(this.feuille(nom), ligne);
    if (!brut) return sortie;
    const motif = /<c\b([^>]*?)(?:\/>|>[\s\S]*?<\/c>)/g;
    let m: RegExpExecArray | null;
    while ((m = motif.exec(brut))) {
      const ref = /\br="([A-Z]+\d+)"/.exec(m[1])?.[1];
      const style = /\bs="(\d+)"/.exec(m[1])?.[1];
      if (ref && style) sortie.set(decoderRef(ref).colonne, style);
    }
    return sortie;
  }

  /** Le fragment XML complet d'une ligne, ou null si elle n'existe pas. */
  private extraireLigne(xml: string, ligne: number): string | null {
    const motif = new RegExp(`<row\\b[^>]*\\br="${ligne}"[^>]*(?:/>|>[\\s\\S]*?</row>)`, '');
    return motif.exec(xml)?.[0] ?? null;
  }

  /** Vrai si la cellule porte une formule : on ne l'ecrase jamais. */
  porteUneFormule(nom: string, ref: string): boolean {
    const { ligne } = decoderRef(ref);
    const brut = this.extraireLigne(this.feuille(nom), ligne);
    if (!brut) return false;
    const motif = new RegExp(`<c\\b[^>]*\\br="${ref}"[^>]*>([\\s\\S]*?)</c>`, '');
    const corps = motif.exec(brut)?.[1];
    return Boolean(corps && /<f[\s>/]/.test(corps));
  }

  /** Construit le XML d'une cellule, en conservant les attributs fournis. */
  private xmlCellule(ref: string, valeur: ValeurCellule, style?: string): string {
    const attributs = [`r="${ref}"`];
    if (style !== undefined) attributs.push(`s="${style}"`);
    if (valeur === null || valeur === '') return `<c ${attributs.join(' ')}/>`;
    if (typeof valeur === 'number') {
      if (!Number.isFinite(valeur)) throw new Error(`Valeur numerique invalide pour ${ref}`);
      return `<c ${attributs.join(' ')}><v>${valeur}</v></c>`;
    }
    attributs.push('t="s"');
    return `<c ${attributs.join(' ')}><v>${this.indexChaine(valeur)}</v></c>`;
  }

  /**
   * Ecrit une valeur dans une cellule existante ou absente, sans toucher a sa mise en forme.
   * Une cellule qui porte une formule est refusee : l'ecraser detruirait le calcul du classeur.
   */
  definirCellule(nom: string, colonne: number, ligne: number, valeur: ValeurCellule) {
    const ref = `${lettreColonne(colonne)}${ligne}`;
    if (this.porteUneFormule(nom, ref)) {
      throw new Error(`La cellule ${ref} de l'onglet « ${nom} » porte une formule : l'export ne l'ecrase pas`);
    }
    let xml = this.feuille(nom);
    const brutLigne = this.extraireLigne(xml, ligne);

    if (!brutLigne) {
      // Ligne absente : on l'insere a sa place, dans l'ordre croissant des numeros de ligne.
      const nouvelle = `<row r="${ligne}">${this.xmlCellule(ref, valeur)}</row>`;
      this.ecrireFeuille(nom, this.insererLigne(xml, ligne, nouvelle));
      return;
    }

    const motifCellule = new RegExp(`<c\\b[^>]*\\br="${ref}"[^>]*(?:/>|>[\\s\\S]*?</c>)`, '');
    const celluleExistante = motifCellule.exec(brutLigne)?.[0];
    let nouvelleLigne: string;

    if (celluleExistante) {
      // Le style de la cellule est conserve : seule sa valeur change.
      const style = /\bs="(\d+)"/.exec(celluleExistante)?.[1];
      nouvelleLigne = brutLigne.replace(motifCellule, this.xmlCellule(ref, valeur, style));
    } else {
      nouvelleLigne = this.insererCellule(brutLigne, colonne, this.xmlCellule(ref, valeur));
    }
    xml = xml.replace(brutLigne, nouvelleLigne);
    this.ecrireFeuille(nom, xml);
  }

  /** Insere une cellule dans une ligne, en respectant l'ordre croissant des colonnes. */
  private insererCellule(brutLigne: string, colonne: number, xmlCellule: string): string {
    const motif = /<c\b([^>]*?)(?:\/>|>[\s\S]*?<\/c>)/g;
    let m: RegExpExecArray | null;
    let position = -1;
    while ((m = motif.exec(brutLigne))) {
      const ref = /\br="([A-Z]+\d+)"/.exec(m[1])?.[1];
      if (ref && decoderRef(ref).colonne > colonne) {
        position = m.index;
        break;
      }
    }
    if (position >= 0) return `${brutLigne.slice(0, position)}${xmlCellule}${brutLigne.slice(position)}`;
    // Apres la derniere cellule : avant la balise fermante, ou en remplacant une ligne vide.
    if (/\/>\s*$/.test(brutLigne)) return `${brutLigne.replace(/\/>\s*$/, '>')}${xmlCellule}</row>`;
    return brutLigne.replace(/<\/row>\s*$/, `${xmlCellule}</row>`);
  }

  /** Insere une ligne entiere a sa place dans `sheetData`. */
  private insererLigne(xml: string, ligne: number, xmlLigne: string): string {
    const motif = /<row\b[^>]*\br="(\d+)"[^>]*(?:\/>|>[\s\S]*?<\/row>)/g;
    let m: RegExpExecArray | null;
    while ((m = motif.exec(xml))) {
      if (Number(m[1]) > ligne) return `${xml.slice(0, m.index)}${xmlLigne}${xml.slice(m.index)}`;
    }
    if (/<sheetData\s*\/>/.test(xml)) return xml.replace(/<sheetData\s*\/>/, `<sheetData>${xmlLigne}</sheetData>`);
    return xml.replace(/<\/sheetData>/, `${xmlLigne}</sheetData>`);
  }

  /** Ajoute des lignes a la suite de la derniere ligne existante. */
  ajouterLignes(nom: string, lignes: LigneAAjouter[]): number {
    if (!lignes.length) return this.derniereLigne(nom);
    let numero = this.derniereLigne(nom);
    const fragments: string[] = [];
    for (const l of lignes) {
      numero++;
      const styles = l.ligneModele ? this.stylesDeLaLigne(nom, l.ligneModele) : new Map<number, string>();
      const cellules = [...l.cellules]
        .sort((a, b) => a.colonne - b.colonne)
        .map((c) => this.xmlCellule(`${lettreColonne(c.colonne)}${numero}`, c.valeur, styles.get(c.colonne)))
        .join('');
      fragments.push(cellules ? `<row r="${numero}">${cellules}</row>` : `<row r="${numero}"/>`);
    }
    let xml = this.feuille(nom);
    xml = /<sheetData\s*\/>/.test(xml)
      ? xml.replace(/<sheetData\s*\/>/, `<sheetData>${fragments.join('')}</sheetData>`)
      : xml.replace(/<\/sheetData>/, `${fragments.join('')}</sheetData>`);
    this.ecrireFeuille(nom, this.majDimension(xml, numero));
    return numero;
  }

  /** Met a jour la plage declaree de la feuille, si elle est presente. */
  private majDimension(xml: string, derniereLigne: number): string {
    return xml.replace(/<dimension\s+ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\s*\/>/, (tout, c1, l1, c2, l2) => {
      const fin = Math.max(Number(l2), derniereLigne);
      return fin === Number(l2) ? tout : `<dimension ref="${c1}${l1}:${c2}${fin}"/>`;
    });
  }

  /** Reconstitue l'archive : seules les parties modifiees sont reecrites. */
  versBuffer(): Buffer {
    const sortie: { nom: string; contenu: Buffer; dateHeureDos?: number; dateDos?: number }[] = [];
    for (const [nom, entree] of this.entrees) {
      let contenu = entree.contenu;
      if (this.feuilles.has(nom)) contenu = Buffer.from(this.feuilles.get(nom)!, 'utf8');
      else if (nom === SIGNATURE_CHAINES && this.chainesModifiees) contenu = Buffer.from(this.xmlChaines(), 'utf8');
      sortie.push({ nom, contenu, dateHeureDos: entree.dateHeureDos, dateDos: entree.dateDos });
    }
    // Classeur sans table de chaines partagees auquel l'export en ajoute : il faut la creer,
    // la declarer dans les relations et dans les types de contenu.
    if (this.chainesModifiees && !this.entrees.has(SIGNATURE_CHAINES)) {
      throw new Error(
        "Ce classeur n'a pas de table de chaines partagees. Fournissez un classeur produit par Excel ou LibreOffice, qui en contient toujours une.",
      );
    }
    return ecrireZip(sortie);
  }

  private xmlChaines(): string {
    const entrees = this.chaines.map((c) => `<si><t xml:space="preserve">${encoderXml(c)}</t></si>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${this.chaines.length}" uniqueCount="${this.chaines.length}">${entrees}</sst>`;
  }
}

const ENTITES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decoderEntites(texte: string): string {
  return texte.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (tout, code: string) => {
    if (code.startsWith('#x') || code.startsWith('#X')) return String.fromCodePoint(parseInt(code.slice(2), 16));
    if (code.startsWith('#')) return String.fromCodePoint(parseInt(code.slice(1), 10));
    return ENTITES[code] ?? tout;
  });
}
