/**
 * Genere le classeur de test `tests/fixtures/SUIVI_MENSUEL_FICTIF_07-11.xlsx`.
 *
 * Il reproduit la structure du classeur reel decrite dans la section 9 de CLAUDE.md
 * (onglets « Suivi Quotidien », « sem 45 », « Recap Mensuelle ») avec des donnees
 * ENTIEREMENT FICTIVES : aucun client, produit, prix ou reference reel de Masenz Group.
 *
 * Il porte volontairement des styles, une largeur de colonne, une cellule fusionnee et une
 * formule, pour que le test d'export de la phase 2 puisse verifier qu'ils ressortent intacts.
 *
 *   npx tsx scripts/generer-classeur-fictif.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { ecrireZip } from '../src/server/lib/xlsx/ecriture-zip';
import { encoderXml, lettreColonne } from '../src/server/lib/xlsx/lecture';

const ENTETES = ['Date', 'Ref', 'Client / Pays', 'Zone', 'Canal', 'Produit et reference', 'Description des travaux', 'Livrables finalises', 'Priorite du lendemain'];

/** Une ligne de donnees du suivi quotidien. Colonnes B, D et E restent vides. */
interface LigneJour {
  client: string;
  produit: string;
  description: string;
  livrables: string;
  priorite: string;
}

const BLOCS: { jour: string; lignes: LigneJour[] }[] = [
  {
    jour: '03/11/2026',
    lignes: [
      {
        client: 'Alpha Pharma (Algerie)',
        produit: 'Gelules vitamine C 180 kg',
        description: '1. Cotation aerienne demandee a trois transitaires, deux offres recues : En cours',
        livrables: 'Tableau comparatif des offres',
        priorite: 'Relancer le troisieme transitaire',
      },
      {
        client: 'Beta Distrib (Libye)',
        produit: 'Sirop multivitamine 2 palettes',
        description: '2. Jeu de documents envoye au client pour accord : En attente client',
        livrables: 'Projet de BL, packing list',
        priorite: 'Verifier le retour du client',
      },
    ],
  },
  {
    jour: '04/11/2026',
    lignes: [
      {
        client: 'Alpha Pharma (Algerie)',
        produit: 'Gelules vitamine C 180 kg',
        description: '1. Comparatif transmis a la responsable export pour validation du transitaire : En cours',
        livrables: 'Comparatif valide',
        priorite: 'Attendre la validation',
      },
      {
        client: 'Gamma Sante (Emirats arabes unis)',
        produit: 'Complement magnesium 400 kg',
        description: '2. Proforma reeditee en dollars apres validation : Termine',
        livrables: 'Proforma PRO-FICTIVE-004',
        priorite: 'Aucune',
      },
      {
        client: 'Epsilon Trade (Maroc)',
        produit: 'Huile de poisson 1 FCL',
        description: "3. Legalisation du certificat de vente libre, autorite injoignable : Bloque",
        livrables: '',
        priorite: "Rappeler l'autorite",
      },
    ],
  },
  {
    jour: '05/11/2026',
    lignes: [
      {
        client: 'Beta Distrib (Libye)',
        produit: 'Sirop multivitamine 2 palettes',
        description: '1. BL corrige apres remarque sur le NIF, accord obtenu, scan archive : Termine',
        livrables: 'BL FICTIF-BL-0912, scan archive',
        priorite: 'Aucune',
      },
      {
        client: 'Delta Medic (France)',
        produit: 'Comprimes zinc 90 kg',
        description: '2. Deuxieme relance envoyee sur le solde restant : En attente client',
        livrables: 'Relance N2',
        priorite: 'Troisieme relance si pas de reponse',
      },
      {
        client: 'Zeta Import (Tunisie)',
        produit: 'Echantillons gratuits 5 kg',
        description: '3. Commande annulee par le client avant enlevement : Annule',
        livrables: '',
        priorite: 'Aucune',
      },
    ],
  },
];

/** Une cellule de chaine partagee ou un nombre, selon le type. */
function cellule(ref: string, indiceChaine: number | null, nombre: number | null, style: number | null, formule?: string): string {
  const attributs = [`r="${ref}"`];
  if (style !== null) attributs.push(`s="${style}"`);
  if (indiceChaine !== null) attributs.push('t="s"');
  const corps = formule
    ? `<f>${encoderXml(formule)}</f>`
    : indiceChaine !== null
      ? `<v>${indiceChaine}</v>`
      : nombre !== null
        ? `<v>${nombre}</v>`
        : '';
  return corps ? `<c ${attributs.join(' ')}>${corps}</c>` : `<c ${attributs.join(' ')}/>`;
}

function principal() {
  const chaines: string[] = [];
  const indice = (texte: string) => {
    const deja = chaines.indexOf(texte);
    if (deja >= 0) return deja;
    chaines.push(texte);
    return chaines.length - 1;
  };

  // --- Onglet « Suivi Quotidien » : un bloc par jour (ligne vide, en-tetes, donnees) ---
  const lignesSuivi: string[] = [];
  let numero = 1;
  // Titre general, cellules fusionnees A1:I1.
  lignesSuivi.push(`<row r="${numero}"><c r="A1" s="1" t="s"><v>${indice('SUIVI QUOTIDIEN (donnees fictives)')}</v></c></row>`);
  numero += 1;

  for (const bloc of BLOCS) {
    lignesSuivi.push(`<row r="${numero}"/>`); // ligne vide de separation
    numero += 1;
    const entetes = ENTETES.map((e, i) => cellule(`${lettreColonne(i + 1)}${numero}`, indice(e), null, 2)).join('');
    lignesSuivi.push(`<row r="${numero}">${entetes}</row>`);
    numero += 1;
    for (const [rang, l] of bloc.lignes.entries()) {
      const cellules = [
        // La date n'est portee que par la premiere ligne du bloc, comme dans le classeur reel.
        cellule(`A${numero}`, rang === 0 ? indice(bloc.jour) : null, null, 3),
        cellule(`C${numero}`, indice(l.client), null, null),
        cellule(`F${numero}`, indice(l.produit), null, null),
        cellule(`G${numero}`, indice(l.description), null, 4),
        l.livrables ? cellule(`H${numero}`, indice(l.livrables), null, null) : '',
        l.priorite ? cellule(`I${numero}`, indice(l.priorite), null, null) : '',
      ].join('');
      lignesSuivi.push(`<row r="${numero}">${cellules}</row>`);
      numero += 1;
    }
  }

  const suiviXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="12.5" customWidth="1"/><col min="3" max="3" width="28" customWidth="1"/><col min="6" max="6" width="30" customWidth="1"/><col min="7" max="7" width="62" customWidth="1"/><col min="8" max="9" width="30" customWidth="1"/></cols><sheetData>${lignesSuivi.join('')}</sheetData><mergeCells count="1"><mergeCell ref="A1:I1"/></mergeCells></worksheet>`;

  // --- Onglet « sem 45 » : colonnes B a F = lundi a vendredi, lignes KPI et synthese ---
  const libellesSemaine: Record<number, string> = {
    2: 'Semaine 45 : du 02/11/2026 au 06/11/2026',
    3: 'Indicateur',
    4: 'Nouveaux leads',
    5: 'Dossiers traites',
    6: 'Documents emis',
    7: 'Relances envoyees',
    12: 'Validations obtenues',
    13: 'Faits marquants',
    14: 'Expeditions parties',
    15: 'Points de vigilance',
    16: 'Actions de la semaine suivante',
    17: 'Appui demande',
    18: 'Points bloquants',
  };
  const valeursSemaine: Record<number, (number | string)[]> = {
    4: [1, 0, 2, 0, 1],
    5: [3, 4, 5, 4, 3],
    6: [2, 3, 2, 4, 1],
    7: [1, 0, 2, 1, 2],
    12: [0, 1, 2, 1, 1],
    14: [0, 0, 1, 0, 2],
    13: ['Comparatif fret rendu', 'Proforma validee', 'BL corrige et archive', 'Relance solde', 'Dossier Maroc en attente'],
    15: ['Rien a signaler', 'Rien a signaler', 'NIF a verifier en amont', 'Rien a signaler', 'Autorite injoignable'],
    16: ['Relancer le transitaire', 'Suivre le paiement', 'Preparer l’enlevement', 'Relancer le solde', 'Rappeler l’autorite'],
    17: ['Aucun', 'Aucun', 'Aucun', 'Aucun', 'Arbitrage sur le delai'],
    18: ['', '', '', '', 'Legalisation bloquee au Maroc'],
  };

  const lignesSemaine: string[] = [];
  for (let r = 2; r <= 18; r++) {
    const cellules: string[] = [];
    if (libellesSemaine[r]) cellules.push(cellule(`A${r}`, indice(libellesSemaine[r]), null, r === 3 ? 2 : 1));
    const valeurs = valeursSemaine[r];
    if (valeurs) {
      valeurs.forEach((v, i) => {
        const ref = `${lettreColonne(i + 2)}${r}`;
        cellules.push(typeof v === 'number' ? cellule(ref, null, v, null) : v ? cellule(ref, indice(v), null, null) : '');
      });
    }
    // Une formule de total, pour verifier qu'un export ne la casse pas.
    if (r === 5) cellules.push(`<c r="G5"><f>SUM(B5:F5)</f><v>19</v></c>`);
    lignesSemaine.push(`<row r="${r}">${cellules.join('')}</row>`);
  }
  const semaineXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="34" customWidth="1"/><col min="2" max="6" width="18" customWidth="1"/></cols><sheetData>${lignesSemaine.join('')}</sheetData></worksheet>`;

  // --- Onglet « Recap Mensuelle » ---
  const recapXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" s="1" t="s"><v>${indice('Recapitulatif mensuel (donnees fictives)')}</v></c></row><row r="3"><c r="A3" s="2" t="s"><v>${indice('Indicateur')}</v></c><c r="B3" s="2" t="s"><v>${indice('Novembre 2026')}</v></c></row><row r="4"><c r="A4" t="s"><v>${indice('Dossiers traites')}</v></c><c r="B4"><v>19</v></c></row><row r="5"><c r="A5" t="s"><v>${indice('Expeditions parties')}</v></c><c r="B5"><v>3</v></c></row></sheetData></worksheet>`;

  const sharedStrings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${chaines.length}" uniqueCount="${chaines.length}">${chaines
    .map((c) => `<si><t xml:space="preserve">${encoderXml(c)}</t></si>`)
    .join('')}</sst>`;

  // Styles : 0 par defaut, 1 titre, 2 en-tete sur fond gris, 3 date, 4 texte renvoye a la ligne.
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF4F3B78"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Suivi Quotidien" sheetId="1" r:id="rId1"/><sheet name="sem 45" sheetId="2" r:id="rId2"/><sheet name="Recap Mensuelle" sheetId="3" r:id="rId3"/></sheets></workbook>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>`;

  const racineRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

  const archive = ecrireZip([
    { nom: '[Content_Types].xml', contenu: Buffer.from(contentTypes, 'utf8') },
    { nom: '_rels/.rels', contenu: Buffer.from(racineRels, 'utf8') },
    { nom: 'xl/workbook.xml', contenu: Buffer.from(workbook, 'utf8') },
    { nom: 'xl/_rels/workbook.xml.rels', contenu: Buffer.from(rels, 'utf8') },
    { nom: 'xl/worksheets/sheet1.xml', contenu: Buffer.from(suiviXml, 'utf8') },
    { nom: 'xl/worksheets/sheet2.xml', contenu: Buffer.from(semaineXml, 'utf8') },
    { nom: 'xl/worksheets/sheet3.xml', contenu: Buffer.from(recapXml, 'utf8') },
    { nom: 'xl/styles.xml', contenu: Buffer.from(styles, 'utf8') },
    { nom: 'xl/sharedStrings.xml', contenu: Buffer.from(sharedStrings, 'utf8') },
  ]);

  const sortie = path.resolve(__dirname, '..', 'tests', 'fixtures', 'SUIVI_MENSUEL_FICTIF_07-11.xlsx');
  fs.mkdirSync(path.dirname(sortie), { recursive: true });
  fs.writeFileSync(sortie, archive);
  console.log(`Classeur fictif ecrit : ${sortie} (${archive.length} octets, ${chaines.length} chaines)`);
}

principal();
