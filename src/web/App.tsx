import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { Layout } from './composants/Layout';
import { Chargement } from './composants/ui';
import { GroupePages, type PageDuGroupe } from './composants/GroupePages';
import Connexion from './pages/Connexion';

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

/**
 * Les groupes de la navigation : un onglet de gauche, plusieurs pages dedans.
 *
 * L'ordre est celui de la journee de travail : ce qui arrive, ce qu'on enregistre, le registre,
 * ce qui attend un envoi, ce qu'on mesure, les echanges de fichiers, le reglage.
 */
export const GROUPES: { libelle: string; pages: PageDuGroupe[] }[] = [
  {
    libelle: 'File du jour',
    pages: [
      { id: 'file', libelle: 'Ma file', chemin: '/', element: <FileDuJour /> },
      { id: 'a-classer', libelle: 'A classer', chemin: '/a-classer', element: <AClasser />, roles: ['admin', 'manager', 'collaborateur'] },
      { id: 'echeancier', libelle: 'Echeances', chemin: '/echeancier', element: <Echeancier /> },
    ],
  },
  {
    libelle: 'Dossiers',
    pages: [
      { id: 'dossiers', libelle: 'Dossiers', chemin: '/dossiers', element: <Dossiers /> },
      { id: 'suivi', libelle: 'Suivi des demandes', chemin: '/suivi', element: <Suivi /> },
    ],
  },
  {
    libelle: 'Brouillons',
    pages: [
      { id: 'brouillons', libelle: 'Brouillons', chemin: '/brouillons', element: <Brouillons /> },
      { id: 'digest', libelle: 'Digest de validation', chemin: '/digest', element: <DigestDo /> },
    ],
  },
  {
    libelle: 'Pilotage',
    pages: [
      { id: 'tableau-de-bord', libelle: 'Tableau de bord', chemin: '/tableau-de-bord', element: <TableauDeBord /> },
      { id: 'pilotage', libelle: 'Par collaborateur', chemin: '/pilotage', element: <Pilotage />, roles: ['admin', 'manager'] },
      { id: 'qualite', libelle: 'Qualite', chemin: '/qualite', element: <Qualite /> },
    ],
  },
  {
    libelle: 'Imports et exports',
    pages: [
      { id: 'import-mails', libelle: 'Import des mails', chemin: '/import-mails', element: <ImportMails />, roles: ['admin', 'manager'] },
      { id: 'import', libelle: 'Import du classeur', chemin: '/import', element: <ImportClasseur />, roles: ['admin', 'manager'] },
      { id: 'export', libelle: 'Export du reporting', chemin: '/export', element: <Export />, roles: ['admin', 'manager'] },
    ],
  },
];

function Protege({ children }: { children: ReactNode }) {
  const { utilisateur, chargement } = useAuth();
  const location = useLocation();
  if (chargement) return <Chargement />;
  if (!utilisateur) return <Navigate to="/connexion" replace state={{ depuis: location.pathname + location.search }} />;
  return <>{children}</>;
}

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Chargement />}>
        <Routes>
          <Route path="/connexion" element={<Connexion />} />
          <Route path="/mot-de-passe-oublie" element={<MotDePasseOublie />} />
          <Route path="/reinitialiser" element={<Reinitialiser />} />
          <Route
            element={
              <Protege>
                <Layout />
              </Protege>
            }
          >
            {GROUPES.flatMap((groupe) =>
              groupe.pages.map((page) => (
                <Route
                  key={page.chemin}
                  path={page.chemin === '/' ? undefined : page.chemin.slice(1)}
                  index={page.chemin === '/' || undefined}
                  element={<GroupePages libelle={groupe.libelle} pages={groupe.pages} />}
                />
              )),
            )}
            <Route path="saisie" element={<SaisieRapide />} />
            <Route path="dossiers/:id" element={<FicheDossier />} />
            <Route path="demandes/:id" element={<FicheDemande />} />
            <Route path="parametres" element={<Parametres />} />
            <Route path="*" element={<p>Page introuvable.</p>} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
