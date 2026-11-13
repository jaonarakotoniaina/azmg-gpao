/**
 * La navigation de l'application, en un seul endroit.
 *
 * Elle sert a deux lecteurs qui doivent dire la meme chose : les routes (`App.tsx`) et la barre
 * de gauche (`Layout.tsx`). Les separer avait produit l'erreur previsible : des pages joignables
 * mais introuvables, parce que le nom du groupe ne nommait pas ce qu'il contenait.
 *
 * D'ou la regle tenue ici : **toute page de cette liste est affichee dans la barre**, sous la tete
 * de son groupe. Sept groupes pour hierarchiser, aucune page cachee.
 */
import { lazy, type ReactNode } from 'react';
import { ListTodo, Zap, FolderOpen, PenLine, TrendingUp, ArrowDownUp, Settings } from 'lucide-react';
import type { Role } from '@shared/constantes';

const TableauDeBord = lazy(() => import('./pages/TableauDeBord'));
const FileDuJour = lazy(() => import('./pages/FileDuJour'));
const SaisieRapide = lazy(() => import('./pages/SaisieRapide'));
const Dossiers = lazy(() => import('./pages/Dossiers'));
const FicheDossier = lazy(() => import('./pages/FicheDossier'));
const FicheDemande = lazy(() => import('./pages/FicheDemande'));
const Echeancier = lazy(() => import('./pages/Echeancier'));
const ImportClasseur = lazy(() => import('./pages/ImportClasseur'));
const Export = lazy(() => import('./pages/Export'));
const Qualite = lazy(() => import('./pages/Qualite'));
const DigestDo = lazy(() => import('./pages/DigestDo'));
const Brouillons = lazy(() => import('./pages/Brouillons'));
const Pilotage = lazy(() => import('./pages/Pilotage'));
const Suivi = lazy(() => import('./pages/Suivi'));
const AClasser = lazy(() => import('./pages/AClasser'));
const ImportMails = lazy(() => import('./pages/ImportMails'));
const Parametres = lazy(() => import('./pages/Parametres'));
const MotDePasseOublie = lazy(() => import('./pages/MotDePasseOublie'));
const Reinitialiser = lazy(() => import('./pages/Reinitialiser'));

export interface PageDuGroupe {
  id: string;
  libelle: string;
  /** Adresse propre de la page, conservee pour les liens et les favoris. */
  chemin: string;
  element: ReactNode;
  roles?: Role[];
  /** Vrai pour la page qui porte le compteur « a classer » dans la barre. */
  compteurAClasser?: boolean;
}

export interface GroupeDeNavigation {
  libelle: string;
  icone: ReactNode;
  roles?: Role[];
  pages: PageDuGroupe[];
}

/**
 * Les groupes de la navigation : une tete de groupe, ses pages dessous.
 *
 * L'ordre est celui de la journee de travail : ce qui arrive, ce qu'on enregistre, le registre,
 * ce qui attend un envoi, ce qu'on mesure, les echanges de fichiers, le reglage.
 *
 * Deux regles, qui viennent de deux ecrans livres puis introuvables :
 *  - **une page garde le nom sous lequel elle a ete demandee**, jamais un synonyme ;
 *  - **un groupe n'est jamais nomme comme une de ses pages**, sinon la tete masque la page et on
 *    croit que l'ecran a disparu.
 */
export const GROUPES: GroupeDeNavigation[] = [
  {
    libelle: 'Travail du jour',
    icone: <ListTodo className="h-4 w-4" aria-hidden />,
    pages: [
      { id: 'file', libelle: 'File du jour', chemin: '/', element: <FileDuJour /> },
      {
        id: 'a-classer',
        libelle: 'A classer',
        chemin: '/a-classer',
        element: <AClasser />,
        roles: ['admin', 'manager', 'collaborateur'],
        compteurAClasser: true,
      },
      { id: 'echeancier', libelle: 'Echeancier', chemin: '/echeancier', element: <Echeancier /> },
    ],
  },
  {
    libelle: 'Saisie rapide',
    icone: <Zap className="h-4 w-4" aria-hidden />,
    roles: ['admin', 'manager', 'collaborateur'],
    pages: [{ id: 'saisie', libelle: 'Saisie rapide', chemin: '/saisie', element: <SaisieRapide /> }],
  },
  {
    libelle: 'Dossiers et demandes',
    icone: <FolderOpen className="h-4 w-4" aria-hidden />,
    pages: [
      { id: 'dossiers', libelle: 'Dossiers', chemin: '/dossiers', element: <Dossiers /> },
      { id: 'suivi', libelle: 'Suivi des demandes', chemin: '/suivi', element: <Suivi /> },
    ],
  },
  {
    libelle: 'Envois a preparer',
    icone: <PenLine className="h-4 w-4" aria-hidden />,
    pages: [
      { id: 'brouillons', libelle: 'Brouillons', chemin: '/brouillons', element: <Brouillons /> },
      { id: 'digest', libelle: 'Digest de validation', chemin: '/digest', element: <DigestDo /> },
    ],
  },
  {
    libelle: 'Indicateurs',
    icone: <TrendingUp className="h-4 w-4" aria-hidden />,
    pages: [
      { id: 'tableau-de-bord', libelle: 'Tableau de bord', chemin: '/tableau-de-bord', element: <TableauDeBord /> },
      { id: 'pilotage', libelle: 'Pilotage', chemin: '/pilotage', element: <Pilotage />, roles: ['admin', 'manager'] },
      { id: 'qualite', libelle: 'Qualite', chemin: '/qualite', element: <Qualite /> },
    ],
  },
  {
    libelle: 'Imports et exports',
    icone: <ArrowDownUp className="h-4 w-4" aria-hidden />,
    roles: ['admin', 'manager'],
    pages: [
      { id: 'import-mails', libelle: 'Import des mails', chemin: '/import-mails', element: <ImportMails />, roles: ['admin', 'manager'] },
      { id: 'import', libelle: 'Import du classeur', chemin: '/import', element: <ImportClasseur />, roles: ['admin', 'manager'] },
      { id: 'export', libelle: 'Export du reporting', chemin: '/export', element: <Export />, roles: ['admin', 'manager'] },
    ],
  },
  {
    libelle: 'Parametres',
    icone: <Settings className="h-4 w-4" aria-hidden />,
    pages: [{ id: 'parametres', libelle: 'Parametres', chemin: '/parametres', element: <Parametres /> }],
  },
];

/** Pages hors navigation : on y arrive par un lien, jamais par la barre. */
export const PAGES_SANS_ENTREE = [
  { chemin: 'dossiers/:id', element: <FicheDossier /> },
  { chemin: 'demandes/:id', element: <FicheDemande /> },
];

export const PAGES_PUBLIQUES = {
  motDePasseOublie: <MotDePasseOublie />,
  reinitialiser: <Reinitialiser />,
};
