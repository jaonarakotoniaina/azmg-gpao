import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, messageErreur } from '../lib/api';
import { Alerte, Bouton, Carte, ChampTexte } from '../composants/ui';

export default function Reinitialiser() {
  const [params] = useSearchParams();
  const jeton = params.get('jeton') ?? '';
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [fait, setFait] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (motDePasse !== confirmation) {
      setErreur('Les deux mots de passe ne correspondent pas');
      return;
    }
    setEnvoi(true);
    try {
      await api.post('/api/auth/reinitialiser', { jeton, motDePasse });
      setFait(true);
    } catch (x) {
      setErreur(messageErreur(x));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <h1 className="mb-6 text-center text-2xl">Nouveau mot de passe</h1>
        <Carte>
          {fait ? (
            <div className="space-y-4">
              <Alerte ton="vert">Mot de passe enregistre.</Alerte>
              <Link to="/connexion">Se connecter</Link>
            </div>
          ) : !jeton ? (
            <Alerte>Lien incomplet : le jeton de reinitialisation est absent.</Alerte>
          ) : (
            <form onSubmit={soumettre} className="space-y-4">
              {erreur && <Alerte>{erreur}</Alerte>}
              <ChampTexte
                libelle="Nouveau mot de passe"
                type="password"
                autoComplete="new-password"
                required
                minLength={10}
                autoFocus
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                aide="10 caracteres minimum."
              />
              <ChampTexte
                libelle="Confirmation"
                type="password"
                autoComplete="new-password"
                required
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
              <Bouton type="submit" variante="plein" chargement={envoi}>
                Enregistrer
              </Bouton>
            </form>
          )}
        </Carte>
      </div>
    </div>
  );
}
