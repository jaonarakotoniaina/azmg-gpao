import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { Layout } from './composants/Layout';
import { Chargement } from './composants/ui';
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
const AClasser = lazy(() => import('./pages/AClasser'));
const ImportMails = lazy(() => import('./pages/ImportMails'));
const Parametres = lazy(() => import('./pages/Parametres'));
const MotDePasseOublie = lazy(() => import('./pages/MotDePasseOublie'));
const Reinitialiser = lazy(() => import('./pages/Reinitialiser'));

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
            <Route index element={<FileDuJour />} />
            <Route path="tableau-de-bord" element={<TableauDeBord />} />
            <Route path="saisie" element={<SaisieRapide />} />
            <Route path="dossiers" element={<Dossiers />} />
            <Route path="dossiers/:id" element={<FicheDossier />} />
            <Route path="demandes/:id" element={<FicheDemande />} />
            <Route path="echeancier" element={<Echeancier />} />
            <Route path="import" element={<ImportClasseur />} />
            <Route path="export" element={<Export />} />
            <Route path="qualite" element={<Qualite />} />
            <Route path="digest" element={<DigestDo />} />
            <Route path="brouillons" element={<Brouillons />} />
            <Route path="a-classer" element={<AClasser />} />
            <Route path="import-mails" element={<ImportMails />} />
            <Route path="parametres" element={<Parametres />} />
            <Route path="*" element={<p>Page introuvable.</p>} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
