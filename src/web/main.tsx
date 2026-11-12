import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { FournisseurAuth } from './lib/auth';
import { FournisseurNotifications } from './composants/ui';
import './styles.css';

const client = new QueryClient({
  defaultOptions: {
    queries: {
      // Le poste travaille parfois sur une connexion lente : on evite les rechargements inutiles.
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById('racine')!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <FournisseurAuth>
        <FournisseurNotifications>
          <App />
        </FournisseurNotifications>
      </FournisseurAuth>
    </QueryClientProvider>
  </StrictMode>,
);
