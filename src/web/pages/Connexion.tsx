import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { messageErreur } from '../lib/api';
import { Alerte, Bouton, Carte, ChampTexte } from '../composants/ui';

export default function Connexion() {
  const { utilisateur, connecter, chargement } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const depuis = (location.state as { depuis?: string } | null)?.depuis ?? '/';
  if (!chargement && utilisateur) return <Navigate to={depuis} replace />;

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnvoi(true);
    try {
      await connecter(email, motDePasse);
    } catch (x) {
      setErreur(messageErreur(x));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-3xl">AZMG GPAO</h1>
          <p className="mt-1 text-texte-doux">Pilotage operationnel des postes places</p>
        </div>
        <Carte>
          <form onSubmit={soumettre} className="space-y-4">
            {erreur && <Alerte>{erreur}</Alerte>}
            <ChampTexte
              libelle="Adresse email"
              type="email"
              autoComplete="username"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <ChampTexte
              libelle="Mot de passe"
              type="password"
              autoComplete="current-password"
              required
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
            />
            <div className="flex items-center justify-between gap-3">
              <Bouton type="submit" variante="plein" chargement={envoi}>
                Se connecter
              </Bouton>
              <Link to="/mot-de-passe-oublie" className="text-sm">
                Mot de passe oublie
              </Link>
            </div>
          </form>
        </Carte>
      </div>
    </div>
  );
}
