import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react';
import { api, messageErreur } from '../lib/api';
import { complementActeur, duree, jour, libelleActeur, libelleFamilleCourt, libelleStatut } from '../lib/format';
import { Alerte, Badge, Carte, ChampSelect, Chargement, EntetePage, Indicateur, Vide } from '../composants/ui';
import { LIBELLES_ECHEANCES, type Acteur, type TypeEcheance } from '@shared/constantes';

interface Compte {
  id: number;
  nom: string;
}

interface Flux {
  entrees: number;
  sorties: number;
  solde: number;
  parJour: { jour: string; entrees: number; sorties: number }[];
  parFamille: { famille: string; entrees: number; sorties: number }[];
}

interface Delais {
  terminees: number;
  premiereReponseMedianeMinutes: number | null;
  delaiTotalMedianMinutes: number | null;
  attenteParActeurMinutes: Record<Acteur, number>;
  respectSla: number | null;
  parFamille: { famille: string; terminees: number; delaiMedianMinutes: number; respectSla: number | null }[];
}

interface TableauDeBordReponse {
  aucunCompte?: true;
  periode: { debut: string; fin: string; jours: number };
  flux: Flux;
  stock: {
    total: number;
    parStatut: Record<string, number>;
    parFamille: Record<string, number>;
    parActeur: Record<string, number>;
    ageMoyenMinutes: number;
    ageMedianMinutes: number;
    tranchesAge: { tranche: string; nombre: number }[];
    slaDepasse: number;
    chargeEstimeeMinutes: number;
  };
  delais: Delais;
  charge: { totalMinutes: number; totalJours: number; parFamille: { famille: string; libelle: string; volume: number; minutes: number }[] };
  precedent: { flux: Flux; delais: Delais; charge: { totalJours: number } };
  echeancesProches: { dossierId: number; dossier: string; type: TypeEcheance; libelle: string | null; echeanceLe: string; joursRestants: number }[];
  attentesDoLongues: { demandeId: number; objet: string; dossier: string; minutesAttente: number }[];
}

/**
 * Variation entre deux periodes.
 * Le sens de lecture est explicite : un delai qui baisse est une bonne nouvelle, un volume qui
 * monte n'en est ni une bonne ni une mauvaise, et reste donc neutre.
 */
function Variation({
  valeur,
  precedent,
  sensFavorable = 'neutre',
  suffixe = '',
}: {
  valeur: number | null;
  precedent: number | null;
  sensFavorable?: 'hausse' | 'baisse' | 'neutre';
  suffixe?: string;
}) {
  if (valeur === null || precedent === null || precedent === 0) return null;
  const ecart = valeur - precedent;
  if (ecart === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-texte-discret">
        <ArrowRight className="h-3 w-3" aria-hidden /> stable
      </span>
    );
  }
  const part = Math.round((ecart / Math.abs(precedent)) * 100);
  const hausse = ecart > 0;
  const couleur =
    sensFavorable === 'neutre' ? 'text-texte-doux' : (sensFavorable === 'hausse') === hausse ? 'text-vert' : 'text-rouge';
  const Icone = hausse ? ArrowUp : ArrowDown;
  return (
    <span className={`inline-flex items-center gap-1 ${couleur}`}>
      <Icone className="h-3 w-3" aria-hidden />
      {hausse ? '+' : ''}
      {part} %{suffixe} sur la periode precedente
    </span>
  );
}

/** Barre de repartition simple, lisible sans couleur seule (la valeur est toujours ecrite). */
function Barre({
  libelle,
  valeur,
  total,
  titre,
  format = (v) => String(v),
}: {
  libelle: string;
  valeur: number;
  total: number;
  titre?: string;
  /** Mise en forme de la valeur : nombre brut par defaut, duree pour des minutes ouvrees. */
  format?: (valeur: number) => string;
}) {
  const part = total > 0 ? Math.round((valeur / total) * 100) : 0;
  return (
    <li className="space-y-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span title={titre}>{libelle}</span>
        <span className="tabular-nums text-texte-doux">
          {format(valeur)} ({part} %)
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-entete">
        <div className="h-full rounded-full bg-violet" style={{ width: `${part}%` }} role="presentation" />
      </div>
    </li>
  );
}

export default function TableauDeBord() {
  const [compteId, setCompteId] = useState('');
  const [jours, setJours] = useState('7');
  const { data: comptes } = useQuery({ queryKey: ['comptes'], queryFn: () => api.get<Compte[]>('/api/comptes') });

  useEffect(() => {
    if (!compteId && comptes?.length === 1) setCompteId(String(comptes[0].id));
  }, [comptes, compteId]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['tableau-de-bord', compteId, jours],
    queryFn: () => api.get<TableauDeBordReponse>(`/api/indicateurs/tableau-de-bord?${new URLSearchParams({ ...(compteId ? { compteId } : {}), jours })}`),
    enabled: Boolean(compteId) || comptes?.length === 0,
  });

  const maxJour = useMemo(() => Math.max(1, ...(data?.flux.parJour ?? []).flatMap((j) => [j.entrees, j.sorties])), [data]);

  return (
    <>
      <EntetePage
        titre="Tableau de bord"
        description="Flux, stock, delais et charge du poste. Tous les delais sont comptes en heures ouvrees du client. La comparaison porte sur la periode precedente de meme duree."
      />

      <Carte className="mb-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <ChampSelect libelle="Compte client" value={compteId} onChange={(e) => setCompteId(e.target.value)}>
            <option value="">Choisir un compte</option>
            {comptes?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </ChampSelect>
          <ChampSelect libelle="Periode" value={jours} onChange={(e) => setJours(e.target.value)}>
            <option value="7">7 derniers jours</option>
            <option value="14">14 derniers jours</option>
            <option value="30">30 derniers jours</option>
            <option value="90">90 derniers jours</option>
          </ChampSelect>
        </div>
      </Carte>

      {error && <Alerte>{messageErreur(error)}</Alerte>}
      {!compteId && comptes?.length !== 0 ? (
        <Vide>Choisissez un compte client. Les indicateurs ne se cumulent pas entre comptes.</Vide>
      ) : isLoading ? (
        <Chargement texte="Calcul des indicateurs" />
      ) : !data || data.aucunCompte ? (
        <Vide>Aucun compte client dans votre perimetre.</Vide>
      ) : (
        <div className="space-y-6">
          <section aria-labelledby="titre-synthese">
            <h2 id="titre-synthese" className="mb-3 text-lg">
              Synthese
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Indicateur
                libelle="Demandes entrees"
                valeur={data.flux.entrees}
                detail={<Variation valeur={data.flux.entrees} precedent={data.precedent.flux.entrees} />}
              />
              <Indicateur
                libelle="Demandes terminees"
                valeur={data.flux.sorties}
                detail={<Variation valeur={data.flux.sorties} precedent={data.precedent.flux.sorties} sensFavorable="hausse" />}
              />
              <Indicateur
                libelle="Stock ouvert"
                valeur={data.stock.total}
                detail={`solde de la periode : ${data.flux.solde >= 0 ? '+' : ''}${data.flux.solde}`}
              />
              <Indicateur
                libelle="Cible depassee"
                valeur={data.stock.slaDepasse}
                detail={data.stock.slaDepasse ? 'demandes du stock hors delai' : 'tout le stock est dans les delais'}
              />
            </div>
          </section>

          <section aria-labelledby="titre-delais">
            <h2 id="titre-delais" className="mb-3 text-lg">
              Delais des demandes terminees
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Indicateur
                libelle="Premiere reponse (mediane)"
                valeur={data.delais.premiereReponseMedianeMinutes === null ? 'non mesure' : duree(data.delais.premiereReponseMedianeMinutes)}
                detail={
                  <Variation
                    valeur={data.delais.premiereReponseMedianeMinutes}
                    precedent={data.precedent.delais.premiereReponseMedianeMinutes}
                    sensFavorable="baisse"
                  />
                }
              />
              <Indicateur
                libelle="Delai total (mediane)"
                valeur={data.delais.delaiTotalMedianMinutes === null ? 'non mesure' : duree(data.delais.delaiTotalMedianMinutes)}
                detail={<Variation valeur={data.delais.delaiTotalMedianMinutes} precedent={data.precedent.delais.delaiTotalMedianMinutes} sensFavorable="baisse" />}
              />
              <Indicateur
                libelle="Delai cible respecte"
                valeur={data.delais.respectSla === null ? 'non mesure' : `${Math.round(data.delais.respectSla * 100)} %`}
                detail={`${data.delais.terminees} demande(s) terminee(s)`}
              />
              <Indicateur
                libelle="Age moyen du stock"
                valeur={duree(data.stock.ageMoyenMinutes)}
                detail={`mediane ${duree(data.stock.ageMedianMinutes)}`}
              />
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Carte titre="Ou attend le temps" id="attente">
              <p className="mb-3 text-sm text-texte-doux">
                Minutes ouvrees cumulees sur les demandes terminees de la periode. C&rsquo;est la mesure qui dit ou se perd
                reellement le temps.
              </p>
              <ul className="space-y-3">
                {(Object.entries(data.delais.attenteParActeurMinutes) as [Acteur, number][])
                  .filter(([, minutes]) => minutes > 0)
                  .sort((a, b) => b[1] - a[1])
                  .map(([acteur, minutes]) => (
                    <Barre
                      key={acteur}
                      libelle={libelleActeur(acteur)}
                      valeur={minutes}
                      total={Object.values(data.delais.attenteParActeurMinutes).reduce((a, b) => a + b, 0)}
                      format={duree}
                    />
                  ))}
                {!Object.values(data.delais.attenteParActeurMinutes).some((m) => m > 0) && (
                  <li className="text-sm text-texte-discret">Aucune demande terminee sur la periode.</li>
                )}
              </ul>
            </Carte>

            <Carte titre="Age du stock" id="age">
              <ul className="space-y-3">
                {data.stock.tranchesAge.map((t) => (
                  <Barre key={t.tranche} libelle={t.tranche} valeur={t.nombre} total={data.stock.total} />
                ))}
              </ul>
            </Carte>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Carte titre="Stock par statut" id="stock-statut">
              <ul className="space-y-3">
                {Object.entries(data.stock.parStatut)
                  .sort((a, b) => b[1] - a[1])
                  .map(([statut, nombre]) => (
                    <Barre key={statut} libelle={libelleStatut(statut)} valeur={nombre} total={data.stock.total} />
                  ))}
                {!data.stock.total && <li className="text-sm text-texte-discret">Aucune demande ouverte.</li>}
              </ul>
            </Carte>

            <Carte titre="Stock par acteur attendu" id="stock-acteur">
              <ul className="space-y-3">
                {Object.entries(data.stock.parActeur)
                  .sort((a, b) => b[1] - a[1])
                  .map(([acteur, nombre]) => (
                    <Barre key={acteur} libelle={`en attente ${complementActeur(acteur)}`} valeur={nombre} total={data.stock.total} />
                  ))}
                {!data.stock.total && <li className="text-sm text-texte-discret">Aucune demande ouverte.</li>}
              </ul>
            </Carte>
          </div>

          <Carte titre="Flux par jour" id="flux">
            {!data.flux.parJour.length ? (
              <Vide>Aucun mouvement sur la periode.</Vide>
            ) : (
              <div className="overflow-x-auto">
                <table className="tableau">
                  <caption className="sr-only">Entrees et sorties par jour</caption>
                  <thead>
                    <tr>
                      <th scope="col">Jour</th>
                      <th scope="col">Entrees</th>
                      <th scope="col">Sorties</th>
                      <th scope="col">Repartition</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.flux.parJour.map((j) => (
                      <tr key={j.jour}>
                        <td className="whitespace-nowrap">{jour(`${j.jour}T12:00:00Z`)}</td>
                        <td className="tabular-nums">{j.entrees}</td>
                        <td className="tabular-nums">{j.sorties}</td>
                        <td>
                          <span className="flex items-center gap-1" aria-hidden>
                            <span className="inline-block h-2 rounded-full bg-violet" style={{ width: `${(j.entrees / maxJour) * 90}px` }} />
                            <span className="inline-block h-2 rounded-full bg-vert" style={{ width: `${(j.sorties / maxJour) * 90}px` }} />
                          </span>
                          <span className="sr-only">
                            {j.entrees} entree(s), {j.sorties} sortie(s)
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Carte>

          <Carte titre="Charge estimee par famille" id="charge">
            <p className="mb-3 text-sm text-texte-doux">
              Volume de la periode multiplie par le temps standard de chaque famille, soit{' '}
              <strong>{data.charge.totalJours} jour(s) ouvre(s)</strong> de travail estime.{' '}
              <Variation valeur={data.charge.totalJours} precedent={data.precedent.charge.totalJours} />
            </p>
            {!data.charge.parFamille.length ? (
              <Vide>Aucune demande ouverte sur la periode.</Vide>
            ) : (
              <div className="overflow-x-auto">
                <table className="tableau">
                  <caption className="sr-only">Charge estimee par famille</caption>
                  <thead>
                    <tr>
                      <th scope="col">Famille</th>
                      <th scope="col">Volume</th>
                      <th scope="col">Charge estimee</th>
                      <th scope="col">Delai median</th>
                      <th scope="col">Cible respectee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.charge.parFamille.map((f) => {
                      const d = data.delais.parFamille.find((x) => x.famille === f.famille);
                      return (
                        <tr key={f.famille}>
                          <td title={f.libelle}>
                            {f.famille} {libelleFamilleCourt(f.famille)}
                          </td>
                          <td className="tabular-nums">{f.volume}</td>
                          <td className="tabular-nums">{duree(f.minutes)}</td>
                          <td className="tabular-nums">{d ? duree(d.delaiMedianMinutes) : ''}</td>
                          <td>
                            {d?.respectSla === null || d === undefined ? (
                              ''
                            ) : (
                              <Badge ton={d.respectSla >= 0.9 ? 'vert' : d.respectSla >= 0.7 ? 'ambre' : 'rouge'}>
                                {Math.round(d.respectSla * 100)} %
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Carte>

          <div className="grid gap-4 lg:grid-cols-2">
            <Carte titre={`En attente de la DO depuis trop longtemps (${data.attentesDoLongues.length})`} id="attente-do">
              {!data.attentesDoLongues.length ? (
                <Vide>Aucune validation ne depasse le seuil.</Vide>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.attentesDoLongues.map((a) => (
                    <li key={a.demandeId} className="flex items-start justify-between gap-3 border-b border-ligne pb-2">
                      <span className="min-w-0">
                        <Link to={`/demandes/${a.demandeId}`} className="block truncate font-medium">
                          {a.objet}
                        </Link>
                        <span className="block truncate text-xs text-texte-discret">{a.dossier}</span>
                      </span>
                      <Badge ton="ambre">{duree(a.minutesAttente)}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Carte>

            <Carte titre={`Echeances proches (${data.echeancesProches.length})`} id="echeances-proches">
              {!data.echeancesProches.length ? (
                <Vide>Aucune echeance dans l&rsquo;horizon d&rsquo;alerte.</Vide>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.echeancesProches.map((e, i) => (
                    <li key={`${e.dossierId}-${i}`} className="flex items-start justify-between gap-3 border-b border-ligne pb-2">
                      <span className="min-w-0">
                        <span className="block font-medium">{e.libelle ?? LIBELLES_ECHEANCES[e.type] ?? e.type}</span>
                        <Link to={`/dossiers/${e.dossierId}`} className="block truncate text-xs">
                          {e.dossier}
                        </Link>
                      </span>
                      <Badge ton={e.joursRestants <= 0 ? 'rouge' : 'ambre'}>
                        {e.joursRestants < 0 ? 'depassee' : e.joursRestants === 0 ? "aujourd'hui" : `dans ${e.joursRestants} j`}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Carte>
          </div>
        </div>
      )}
    </>
  );
}
