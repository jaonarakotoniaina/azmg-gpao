import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import type { Role } from '@shared/constantes';

export interface Utilisateur {
  id: number;
  email: string;
  nom: string;
  role: Role;
}

interface ContexteAuth {
  utilisateur: Utilisateur | null;
  chargement: boolean;
  connecter: (email: string, motDePasse: string) => Promise<void>;
  deconnecter: () => Promise<void>;
  peut: (...roles: Role[]) => boolean;
  /** Vrai pour un role qui n'ecrit pas (client_lecture). */
  lectureSeule: boolean;
}

const Contexte = createContext<ContexteAuth | null>(null);

export function FournisseurAuth({ children }: { children: ReactNode }) {
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    api
      .get<{ utilisateur: Utilisateur }>('/api/auth/moi')
      .then((r) => setUtilisateur(r.utilisateur))
      .catch(() => setUtilisateur(null))
      .finally(() => setChargement(false));
    const surDeconnexion = () => setUtilisateur(null);
    window.addEventListener('azmg:deconnecte', surDeconnexion);
    return () => window.removeEventListener('azmg:deconnecte', surDeconnexion);
  }, []);

  const connecter = useCallback(async (email: string, motDePasse: string) => {
    const r = await api.post<{ utilisateur: Utilisateur }>('/api/auth/connexion', { email, motDePasse });
    setUtilisateur(r.utilisateur);
  }, []);

  const deconnecter = useCallback(async () => {
    await api.post('/api/auth/deconnexion');
    setUtilisateur(null);
  }, []);

  const peut = useCallback((...roles: Role[]) => Boolean(utilisateur && roles.includes(utilisateur.role)), [utilisateur]);

  return (
    <Contexte.Provider value={{ utilisateur, chargement, connecter, deconnecter, peut, lectureSeule: utilisateur?.role === 'client_lecture' }}>
      {children}
    </Contexte.Provider>
  );
}

export function useAuth(): ContexteAuth {
  const c = useContext(Contexte);
  if (!c) throw new Error('useAuth hors du fournisseur');
  return c;
}
