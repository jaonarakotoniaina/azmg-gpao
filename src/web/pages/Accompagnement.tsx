import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, messageErreur } from '../lib/api';
import { Alerte, Badge, Carte, ChampSelect, Chargement, EntetePage, Indicateur, Vide } from '../composants/ui';

interface Poste {
  id: number;
  compteId: number;
  compte: string;
  intitule: string;
  collaborateur: string | null;
  actif: boolean;
}

interface Semaine {
  debut: string;
  semaine: number;
  demandesOuvertes: number;
  reprises: number;
  recidives: number;
  tauxRecidive: number | null;
  delaiMedianHeures: number | null;
  p1EnRetard: number;
}

interface Reponse {
  poste: string;
  collaborateur: string | null;
  semaines: Semaine[];
  causes: { cause: string | null; libelle: string; nombre: number }[];
  dossiersRepetes: { dossierId: number; libelle: string; reprises: number }[];
  retoursPositifs: number;
  total: { demandesOuvertes: number; reprises: number; recidives: number; delaiMedianHeures: number | null };
  ecartsPriorite: { demandeId: number; objet: string; dossier: string; declaree: string; conseillee: string; raison: string }[];
}

function heures(valeur: number | null): string {
  return valeur === null ? 'non mesure' : `${Math.round(valeur)} h`;
}

export default function Accompagnement() {
  const [posteId, setPosteId] = useState('');
  const { data: postes } = useQuery({ queryKey: ['postes'], queryFn: () => api.get<Poste[]>('/api/postes') });

  useEffect(() => {
    const actifs = postes?.filter((p) => p.actif) ?? [];
    if (!posteId && actifs.length) setPosteId(String(actifs[0].id));
  }, [postes, posteId]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['accompagnement', posteId],
    queryFn: () => api.get<Reponse>(`/api/postes/${posteId}/accompagnement`),
    enabled: Boolean(posteId),
  });

  return (
    <>
      <EntetePage
        titre="Accompagnement"
        description="Est-ce que ca s’ameliore ? Les causes disent sur quoi travailler, la courbe dit si l’effort porte. Les delais sont comptes en heures ouvrees du client."
      />

      <Carte className="mb-6">
        <ChampSelect libelle="Poste suivi" value={posteId} onChange={(e) => setPosteId(e.target.value)}>
          <option value="">Choisir un poste</option>
          {postes
            ?.filter((p) => p.actif)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.compte} : {p.intitule}
                {p.collaborateur ? ` (${p.collaborateur})` : ''}
              </option>
            ))}
        </ChampSelect>
      </Carte>

      {error && <Alerte>{messageErreur(error)}</Alerte>}
      {!posteId ? (
        <Vide>Choisissez un poste.</Vide>
      ) : isLoading ? (
        <Chargement texte="Calcul de l’accompagnement" />
      ) : !data ? null : !data.total.demandesOuvertes ? (
        <Vide>Aucune demande sur la periode pour ce poste.</Vide>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-4">
            <Indicateur libelle="Demandes" valeur={data.total.demandesOuvertes} />
            <Indicateur libelle="Reprises" valeur={data.total.reprises} detail={`dont ${data.total.recidives} recidive(s)`} />
            <Indicateur libelle="Delai median de cloture" valeur={heures(data.total.delaiMedianHeures)} detail="en heures ouvrees" />
            <Indicateur libelle="Retours positifs" valeur={data.retoursPositifs} detail="validations sans correction" />
          </div>

          <Carte titre="Sur quoi travailler" id="causes">
            {!data.causes.length ? (
              <Vide>Aucune reprise sur la periode.</Vide>
            ) : (
              <>
                <p className="aide">
                  C&rsquo;est le chiffre le plus solide de cet ecran : il ne depend pas du nombre de semaines observees.
                </p>
                <ul className="mt-3 space-y-2">
                  {data.causes.map((c) => (
                    <li key={c.libelle} className="flex items-center justify-between gap-3 border-b border-ligne pb-2 last:border-0">
                      <span className={c.cause ? '' : 'text-texte-discret'}>{c.libelle}</span>
                      <Badge ton={c.cause ? 'violet' : 'neutre'}>{c.nombre}</Badge>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Carte>

          <Carte titre="Semaine par semaine" id="semaines">
            <div className="overflow-x-auto">
              <table className="tableau">
                <caption className="sr-only">Indicateurs par semaine</caption>
                <thead>
                  <tr>
                    <th scope="col">Semaine</th>
                    <th scope="col">Demandes</th>
                    <th scope="col">Reprises</th>
                    <th scope="col">Taux de recidive</th>
                    <th scope="col">Delai median</th>
                    <th scope="col">P1 en retard</th>
                  </tr>
                </thead>
                <tbody>
                  {data.semaines.map((s) => (
                    <tr key={s.debut}>
                      <td>
                        S{s.semaine} <span className="text-texte-discret">({s.debut})</span>
                      </td>
                      <td>{s.demandesOuvertes}</td>
                      <td>{s.reprises}</td>
                      <td>{s.tauxRecidive === null ? 'sans objet' : `${Math.round(s.tauxRecidive * 100)} %`}</td>
                      <td>{heures(s.delaiMedianHeures)}</td>
                      <td>{s.p1EnRetard}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.semaines.length < 3 && (
              <p className="aide mt-3">
                {data.semaines.length} semaine(s) observee(s) : assez pour voir une pente, pas pour en tirer une tendance. Le releve
                doit continuer d&rsquo;etre alimente chaque jour.
              </p>
            )}
          </Carte>

          {data.dossiersRepetes.length > 0 && (
            <Carte titre="Dossiers sur lesquels il a fallu revenir" id="recidives">
              <ul className="space-y-2">
                {data.dossiersRepetes.map((d) => (
                  <li key={d.dossierId} className="flex items-center justify-between gap-3 border-b border-ligne pb-2 last:border-0">
                    <Link to={`/dossiers/${d.dossierId}`}>{d.libelle}</Link>
                    <Badge ton="ambre">{d.reprises} reprises</Badge>
                  </li>
                ))}
              </ul>
            </Carte>
          )}

          {data.ecartsPriorite.length > 0 && (
            <Carte titre={`Priorites a recalibrer (${data.ecartsPriorite.length})`} id="priorites">
              <p className="aide">
                Quand tout est prioritaire, la priorite ne trie plus rien. Rien n&rsquo;est modifie ici : la regle conseille, vous
                tranchez depuis la demande.
              </p>
              <ul className="mt-3 space-y-2">
                {data.ecartsPriorite.slice(0, 20).map((e) => (
                  <li key={e.demandeId} className="border-b border-ligne pb-2 last:border-0">
                    <Link to={`/demandes/${e.demandeId}`}>{e.objet}</Link>
                    <p className="text-sm text-texte-doux">
                      {e.dossier} : marquee <Badge ton="rouge">{e.declaree}</Badge> , conseillee{' '}
                      <Badge ton="vert">{e.conseillee}</Badge> ({e.raison})
                    </p>
                  </li>
                ))}
              </ul>
            </Carte>
          )}
        </div>
      )}
    </>
  );
}
