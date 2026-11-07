import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, messageErreur } from '../lib/api';
import { relatif } from '../lib/format';
import { Alerte, Badge, Carte, ChampSelect, ChampTexte, Chargement, EntetePage, Vide } from '../composants/ui';
import { LIBELLES_STATUTS_DOSSIER, type StatutDossier } from '@shared/constantes';

interface Compte {
  id: number;
  nom: string;
}

interface DossierTrouve {
  id: number;
  libelle: string;
  client: string;
  pays: string | null;
  produit: string | null;
  operation: string | null;
  statut: StatutDossier;
  resume: string | null;
  majLe: string;
  demandesOuvertes: number;
}

const TONS: Record<StatutDossier, 'violet' | 'ambre' | 'vert' | 'neutre'> = {
  ouvert: 'violet',
  en_attente: 'ambre',
  clos: 'vert',
  annule: 'neutre',
};

export default function Dossiers() {
  const [compteId, setCompteId] = useState('');
  const [recherche, setRecherche] = useState('');
  const { data: comptes } = useQuery({ queryKey: ['comptes'], queryFn: () => api.get<Compte[]>('/api/comptes') });

  useEffect(() => {
    if (!compteId && comptes?.length === 1) setCompteId(String(comptes[0].id));
  }, [comptes, compteId]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['dossiers', 'liste', compteId, recherche],
    queryFn: () =>
      api.get<DossierTrouve[]>(`/api/dossiers?${new URLSearchParams({ ...(compteId ? { compteId } : {}), q: recherche, limite: '50' })}`),
  });

  return (
    <>
      <EntetePage
        titre="Dossiers"
        description="Un dossier regroupe les demandes, les evenements, les echeances et les pieces d’une meme operation : un client, un produit, une operation."
      />

      <Carte className="mb-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <ChampSelect libelle="Compte client" value={compteId} onChange={(e) => setCompteId(e.target.value)}>
            <option value="">Tous mes comptes</option>
            {comptes?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </ChampSelect>
          <ChampTexte
            libelle="Rechercher"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="client, produit, pays, operation"
          />
        </div>
      </Carte>

      {error && <Alerte>{messageErreur(error)}</Alerte>}
      {isLoading ? (
        <Chargement texte="Chargement des dossiers" />
      ) : !data?.length ? (
        <Vide>Aucun dossier. Creez-en un depuis la saisie rapide, ou importez le classeur de suivi.</Vide>
      ) : (
        <div className="carte overflow-x-auto">
          <table className="tableau">
            <caption className="sr-only">Liste des dossiers</caption>
            <thead>
              <tr>
                <th scope="col">Dossier</th>
                <th scope="col">Statut</th>
                <th scope="col">Etat en une ligne</th>
                <th scope="col">Demandes ouvertes</th>
                <th scope="col">Derniere activite</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.id}>
                  <td>
                    <Link to={`/dossiers/${d.id}`} className="font-medium">
                      {d.libelle}
                    </Link>
                  </td>
                  <td>
                    <Badge ton={TONS[d.statut]}>{LIBELLES_STATUTS_DOSSIER[d.statut]}</Badge>
                  </td>
                  <td className="text-texte-doux">{d.resume ?? ''}</td>
                  <td>{d.demandesOuvertes}</td>
                  <td className="text-texte-discret">{relatif(d.majLe)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
