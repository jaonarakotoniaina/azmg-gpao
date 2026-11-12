import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, messageErreur } from '../lib/api';
import { Alerte, Bouton, Carte, ChampTexte } from '../composants/ui';

export default function MotDePasseOublie() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnvoi(true);
    try {
      const r = await api.post<{ message: string }>('/api/auth/mot-de-passe-oublie', { email });
      setMessage(r.message);
    } catch (x) {
      setErreur(messageErreur(x));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <h1 className="mb-6 text-center text-2xl">Mot de passe oublie</h1>
        <Carte>
          {message ? (
            <div className="space-y-4">
              <Alerte ton="vert">{message}</Alerte>
              <Link to="/connexion">Revenir a la connexion</Link>
            </div>
          ) : (
            <form onSubmit={soumettre} className="space-y-4">
              {erreur && <Alerte>{erreur}</Alerte>}
              <ChampTexte
                libelle="Adresse email"
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aide="Un lien de reinitialisation sera prepare si un compte existe pour cette adresse."
              />
              <div className="flex items-center justify-between gap-3">
                <Bouton type="submit" variante="plein" chargement={envoi}>
                  Envoyer le lien
                </Bouton>
                <Link to="/connexion" className="text-sm">
                  Annuler
                </Link>
              </div>
            </form>
          )}
        </Carte>
      </div>
    </div>
  );
}
