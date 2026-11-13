import { Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { Layout } from './composants/Layout';
import { Chargement } from './composants/ui';
import { GroupePages } from './composants/GroupePages';
import { GROUPES, PAGES_PUBLIQUES, PAGES_SANS_ENTREE } from './navigation';
import Connexion from './pages/Connexion';

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
          <Route path="/mot-de-passe-oublie" element={PAGES_PUBLIQUES.motDePasseOublie} />
          <Route path="/reinitialiser" element={PAGES_PUBLIQUES.reinitialiser} />
          <Route
            element={
              <Protege>
                <Layout />
              </Protege>
            }
          >
            {/*
              Une route par page, toutes rendues par le conteneur de leur groupe : chaque page
              garde son adresse propre, et ouvre le groupe sur le bon onglet.
            */}
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
            {PAGES_SANS_ENTREE.map((page) => (
              <Route key={page.chemin} path={page.chemin} element={page.element} />
            ))}
            <Route path="*" element={<p>Page introuvable.</p>} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
