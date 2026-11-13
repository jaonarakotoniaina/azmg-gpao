import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { api, messageErreur } from '../lib/api';
import { jour as formaterJour } from '../lib/format';
import { Alerte, Badge, Carte, ChampSelect, Chargement, EntetePage, Indicateur, Vide } from '../composants/ui';
import { libelleStatut, LIBELLES_PRIORITES, type Statut } from '@shared/constantes';

interface Compte {
  id: number;
  nom: string;
}

interface Poste {
  id: number;
  compteId: number;
  intitule: string;
  collaborateur: string | null;
  actif: boolean;
}

interface Ligne {
  demandeId: number;
  dossierId: number;
  ouverteLe: string;
  priorite: string;
  statut: Statut;
  famille: string;
  reprise: boolean;
  cause: string | null;
  causeLibelle: string | null;
  sujet: string;
  demande: string;
  action: string;
  poste: string | null;
  commentaire: string;
  lienMail: string;
  statutClasseur: string;
  type: string;
  echeanceLe: string | null;
  clotureeLe: string | null;
  delaiHeures: number | null;
  attenteHeures: number | null;
}

const TONS_PRIORITE: Record<string, 'rouge' | 'ambre' | 'neutre'> = { critique: 'rouge', haute: 'rouge', normale: 'ambre', basse: 'neutre' };

function heures(valeur: number | null): string {
  return valeur === null ? '' : `${valeur} h`;
}

export default function Suivi() {
  const [compteId, setCompteId] = useState('');
  const [posteId, setPosteId] = useState('');
  const [reprisesSeules, setReprisesSeules] = useState(false);

  const { data: comptes } = useQuery({ queryKey: ['comptes'], queryFn: () => api.get<Compte[]>('/api/comptes') });
  const { data: postes } = useQuery({ queryKey: ['postes'], queryFn: () => api.get<Poste[]>('/api/postes') });

  useEffect(() => {
    if (!compteId && comptes?.length === 1) setCompteId(String(comptes[0].id));
  }, [comptes, compteId]);

  const parametres = new URLSearchParams();
  if (posteId) parametres.set('posteId', posteId);
  if (reprisesSeules) parametres.set('reprisesSeules', 'true');

  const { data, isLoading, error } = useQuery({
    queryKey: ['suivi', compteId, posteId, reprisesSeules],
    queryFn: () => api.get<Ligne[]>(`/api/comptes/${compteId}/suivi?${parametres.toString()}`),
    enabled: Boolean(compteId),
  });

  const reprises = data?.filter((l) => l.reprise).length ?? 0;
  const closes = data?.filter((l) => l.delaiHeures !== null) ?? [];
  const delaiMoyen = closes.length ? Math.round((closes.reduce((s, l) => s + (l.delaiHeures ?? 0), 0) / closes.length) * 10) / 10 : null;

  return (
    <>
      <EntetePage
        titre="Suivi des demandes"
        description="Le tableau du suivi, tenu par la GPAO. Les colonnes du classeur, et celles qui lui manquaient : echeance, cloture et delai de traitement, comptes en heures ouvrees du client."
      />

      <Carte className="mb-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <ChampSelect libelle="Compte client" value={compteId} onChange={(e) => setCompteId(e.target.value)}>
            <option value="">Choisir un compte</option>
            {comptes?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </ChampSelect>
          <ChampSelect libelle="Poste" value={posteId} onChange={(e) => setPosteId(e.target.value)}>
            <option value="">Tous les postes</option>
            {postes
              ?.filter((p) => p.actif && (!compteId || p.compteId === Number(compteId)))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.intitule}
                  {p.collaborateur ? ` (${p.collaborateur})` : ''}
                </option>
              ))}
          </ChampSelect>
          <ChampSelect
            libelle="Lignes affichees"
            value={reprisesSeules ? 'reprises' : 'toutes'}
            onChange={(e) => setReprisesSeules(e.target.value === 'reprises')}
          >
            <option value="toutes">Toutes les demandes</option>
            <option value="reprises">Les reprises seulement</option>
          </ChampSelect>
        </div>
      </Carte>

      {error && <Alerte>{messageErreur(error)}</Alerte>}
      {!compteId ? (
        <Vide>Choisissez un compte client.</Vide>
      ) : isLoading ? (
        <Chargement texte="Chargement du suivi" />
      ) : !data?.length ? (
        <Vide>
          Aucune demande pour ces filtres. Le classeur de suivi s&rsquo;importe depuis{' '}
          <Link to="/import">Import du classeur</Link>, au format « Suivi des demandes ».
        </Vide>
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <Indicateur libelle="Lignes" valeur={data.length} />
            <Indicateur libelle="Reprises" valeur={reprises} detail={`sur ${data.length} lignes`} />
            <Indicateur libelle="Delai moyen de cloture" valeur={delaiMoyen === null ? 'non mesure' : `${delaiMoyen} h`} detail="en heures ouvrees" />
          </div>

          <Carte id="tableau">
            <div className="overflow-x-auto">
              <table className="tableau">
                <caption className="sr-only">Suivi des demandes</caption>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Priorite</th>
                    <th scope="col">Statut</th>
                    <th scope="col">Type</th>
                    <th scope="col">Sujet ou dossier</th>
                    <th scope="col">Demande</th>
                    <th scope="col">Action attendue</th>
                    <th scope="col">Poste</th>
                    <th scope="col">Cause</th>
                    <th scope="col">Delai</th>
                    <th scope="col">Mail</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((l) => (
                    <tr key={l.demandeId}>
                      <td className="whitespace-nowrap">{formaterJour(l.ouverteLe)}</td>
                      <td>
                        <Badge ton={TONS_PRIORITE[l.priorite] ?? 'neutre'}>{LIBELLES_PRIORITES[l.priorite as never] ?? l.priorite}</Badge>
                      </td>
                      <td className="whitespace-nowrap">{libelleStatut(l.statut)}</td>
                      <td>{l.reprise ? <Badge ton="violet">Reprise</Badge> : l.type || ''}</td>
                      <td>
                        <Link to={`/dossiers/${l.dossierId}`}>{l.sujet}</Link>
                      </td>
                      <td className="max-w-[26rem] text-sm text-texte-doux">{l.demande}</td>
                      <td className="max-w-[22rem]">
                        <Link to={`/demandes/${l.demandeId}`}>{l.action}</Link>
                        {l.commentaire && <p className="text-xs text-texte-discret">{l.commentaire}</p>}
                      </td>
                      <td className="whitespace-nowrap text-sm">{l.poste ?? ''}</td>
                      <td className="text-sm">{l.causeLibelle ?? ''}</td>
                      <td className="whitespace-nowrap text-sm">
                        {l.delaiHeures !== null ? (
                          heures(l.delaiHeures)
                        ) : (
                          <span className="text-texte-discret">{heures(l.attenteHeures)} en cours</span>
                        )}
                      </td>
                      <td>
                        {l.lienMail && (
                          <a href={l.lienMail} target="_blank" rel="noreferrer" aria-label="Ouvrir le mail d’origine">
                            <ExternalLink className="h-4 w-4" aria-hidden />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Carte>
        </>
      )}
    </>
  );
}
