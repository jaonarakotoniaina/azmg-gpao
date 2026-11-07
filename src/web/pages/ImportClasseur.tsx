import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, messageErreur } from '../lib/api';
import { dateHeure } from '../lib/format';
import { Alerte, Bouton, Carte, ChampSelect, Chargement, EntetePage, Indicateur, Vide, useNotifier } from '../composants/ui';

interface Compte {
  id: number;
  nom: string;
}

interface Bilan {
  lignesLues: number;
  lignesIgnorees: number;
  dossiersCrees: number;
  dossiersMisAJour: number;
  jourDebut: string | null;
  jourFin: string | null;
  anomalies: { ligne: number; raison: string }[];
}

interface ImportPasse {
  id: number;
  nomFichier: string;
  bilan: Bilan;
  jourDebut: string | null;
  jourFin: string | null;
  creeLe: string;
}

export default function ImportClasseur() {
  const notifier = useNotifier();
  const client = useQueryClient();
  const champFichier = useRef<HTMLInputElement>(null);
  const [compteId, setCompteId] = useState('');
  const [fichier, setFichier] = useState<File | null>(null);
  const [resultat, setResultat] = useState<{ bilan: Bilan; dossiers: { id: number; libelle: string; resume: string | null }[] } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const { data: comptes } = useQuery({ queryKey: ['comptes'], queryFn: () => api.get<Compte[]>('/api/comptes') });

  useEffect(() => {
    if (!compteId && comptes?.length === 1) setCompteId(String(comptes[0].id));
  }, [comptes, compteId]);

  const { data: historique, isLoading } = useQuery({
    queryKey: ['imports', compteId],
    queryFn: () => api.get<ImportPasse[]>(`/api/import?compteId=${compteId}`),
    enabled: Boolean(compteId),
  });

  const importer = useMutation({
    mutationFn: () => {
      const corps = new FormData();
      corps.append('fichier', fichier!);
      corps.append('compteId', compteId);
      return api.post<{ bilan: Bilan; dossiers: { id: number; libelle: string; resume: string | null }[] }>('/api/import/classeur', corps);
    },
    onSuccess: (r) => {
      setResultat(r);
      setFichier(null);
      if (champFichier.current) champFichier.current.value = '';
      notifier(`${r.bilan.dossiersCrees} dossier(s) cree(s), ${r.bilan.dossiersMisAJour} mis a jour`);
      client.invalidateQueries({ queryKey: ['imports'] });
      client.invalidateQueries({ queryKey: ['dossiers'] });
    },
    onError: (e) => setErreur(messageErreur(e)),
  });

  return (
    <>
      <EntetePage
        titre="Import du classeur de suivi"
        description="Lit l’onglet « Suivi Quotidien » d’un classeur SUIVI_MENSUEL : client (colonne C), produit (F) et dernier statut connu, extrait de la fin de la description (G). L’import ne cree pas de demandes et peut etre relance sans creer de doublon."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Carte titre="Nouvel import" id="import">
          <div className="space-y-4">
            {erreur && <Alerte>{erreur}</Alerte>}
            <ChampSelect libelle="Compte client" value={compteId} onChange={(e) => setCompteId(e.target.value)} required>
              <option value="">Choisir un compte</option>
              {comptes?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </ChampSelect>
            <div>
              <label htmlFor="fichier" className="etiquette">
                Classeur .xlsx
              </label>
              <input
                ref={champFichier}
                id="fichier"
                type="file"
                accept=".xlsx"
                className="champ"
                onChange={(e) => {
                  setErreur(null);
                  setFichier(e.target.files?.[0] ?? null);
                }}
              />
              <span className="aide">Le classeur n&rsquo;est pas conserve : seul le bilan de l&rsquo;import est enregistre.</span>
            </div>
            <Bouton variante="plein" disabled={!fichier || !compteId} chargement={importer.isPending} onClick={() => importer.mutate()}>
              Importer
            </Bouton>
          </div>
        </Carte>

        <Carte titre="Resultat du dernier import" id="resultat">
          {!resultat ? (
            <Vide>Aucun import lance dans cette session.</Vide>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Indicateur libelle="Lignes lues" valeur={resultat.bilan.lignesLues} />
                <Indicateur libelle="Dossiers crees" valeur={resultat.bilan.dossiersCrees} />
                <Indicateur libelle="Dossiers mis a jour" valeur={resultat.bilan.dossiersMisAJour} />
                <Indicateur libelle="Lignes ignorees" valeur={resultat.bilan.lignesIgnorees} />
              </div>
              {resultat.bilan.jourDebut && (
                <p className="text-sm text-texte-doux">
                  Periode lue : du {resultat.bilan.jourDebut} au {resultat.bilan.jourFin}.
                </p>
              )}
              {resultat.bilan.anomalies.length > 0 && (
                <Alerte ton="ambre">
                  <p className="font-medium">Lignes ecartees</p>
                  <ul className="mt-1 list-disc pl-5">
                    {resultat.bilan.anomalies.map((a) => (
                      <li key={a.ligne}>
                        ligne {a.ligne} : {a.raison}
                      </li>
                    ))}
                  </ul>
                </Alerte>
              )}
              <div>
                <h3 className="mb-2 text-sm font-semibold">Dossiers du classeur</h3>
                <ul className="space-y-1 text-sm">
                  {resultat.dossiers.map((d) => (
                    <li key={d.id}>
                      <Link to={`/dossiers/${d.id}`}>{d.libelle}</Link>
                      {d.resume && <span className="text-texte-discret"> : {d.resume}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </Carte>
      </div>

      <Carte titre="Imports precedents" id="historique" className="mt-6">
        {!compteId ? (
          <Vide>Choisissez un compte client pour voir son historique.</Vide>
        ) : isLoading ? (
          <Chargement />
        ) : !historique?.length ? (
          <Vide>Aucun import enregistre pour ce compte.</Vide>
        ) : (
          <div className="overflow-x-auto">
            <table className="tableau">
              <caption className="sr-only">Historique des imports</caption>
              <thead>
                <tr>
                  <th scope="col">Fichier</th>
                  <th scope="col">Importe le</th>
                  <th scope="col">Periode</th>
                  <th scope="col">Lignes</th>
                  <th scope="col">Crees</th>
                  <th scope="col">Mis a jour</th>
                </tr>
              </thead>
              <tbody>
                {historique.map((i) => (
                  <tr key={i.id}>
                    <td>{i.nomFichier}</td>
                    <td className="whitespace-nowrap">{dateHeure(i.creeLe)}</td>
                    <td className="whitespace-nowrap">{i.jourDebut ? `${i.jourDebut} au ${i.jourFin}` : ''}</td>
                    <td>{i.bilan?.lignesLues ?? 0}</td>
                    <td>{i.bilan?.dossiersCrees ?? 0}</td>
                    <td>{i.bilan?.dossiersMisAJour ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Carte>
    </>
  );
}
