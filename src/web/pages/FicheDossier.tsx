import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CalendarClock, FileText, MessageSquare, Repeat } from 'lucide-react';
import { api, messageErreur } from '../lib/api';
import {
  dateHeure,
  duree,
  jour,
  libelleActeur,
  libelleInterlocuteur,
  libelleNature,
  libelleReporting,
  libelleSource,
  libelleStatut,
  tonStatut,
} from '../lib/format';
import { Alerte, Badge, Bouton, Carte, ChampZone, Chargement, EntetePage, Onglets, Vide, useNotifier } from '../composants/ui';
import { LIBELLES_ECHEANCES, LIBELLES_STATUTS_DOSSIER, type Statut, type StatutDossier, type TypeEcheance } from '@shared/constantes';

interface Temps {
  parStatut: Record<string, number>;
  parActeur: Record<string, number>;
  total: number;
  premiereReponse: number | null;
  statutCourant: number;
}

interface DemandeFiche {
  id: number;
  famille: string;
  objet: string;
  statut: Statut;
  acteurAttendu: string;
  priorite: string;
  niveauRelance: number;
  echeanceLe: string | null;
  ouverteLe: string;
  termineeLe: string | null;
  temps: Temps;
}

interface Reponse {
  dossier: {
    id: number;
    libelle: string;
    client: string;
    pays: string | null;
    produit: string | null;
    operation: string | null;
    statut: StatutDossier;
    resume: string | null;
    references: Record<string, unknown>;
    notes: string | null;
    majLe: string;
  };
  demandes: DemandeFiche[];
  echeances: { id: number; type: TypeEcheance; libelle: string | null; echeanceLe: string; honoreeLe: string | null }[];
  pieces: { id: number; type: string; reference: string | null; nomFichier: string | null; creeLe: string }[];
}

interface LigneChronologie {
  type: 'evenement' | 'transition' | 'echeance' | 'piece';
  survenuLe: string;
  titre: string;
  detail: string | null;
  demandeId: number | null;
  meta?: Record<string, unknown>;
}

const ICONES = {
  evenement: MessageSquare,
  transition: ArrowRight,
  echeance: CalendarClock,
  piece: FileText,
} as const;

export default function FicheDossier() {
  const { id } = useParams();
  const notifier = useNotifier();
  const client = useQueryClient();
  const [onglet, setOnglet] = useState<'chronologie' | 'demandes' | 'echeances'>('chronologie');
  const [note, setNote] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['dossier', id],
    queryFn: () => api.get<Reponse>(`/api/dossiers/${id}`),
    enabled: Boolean(id),
  });

  const { data: chronologie } = useQuery({
    queryKey: ['dossier', id, 'chronologie'],
    queryFn: () => api.get<LigneChronologie[]>(`/api/dossiers/${id}/chronologie`),
    enabled: Boolean(id),
  });

  const ajouterNote = useMutation({
    mutationFn: () => api.post('/api/saisie/note', { dossierId: Number(id), texte: note }),
    onSuccess: () => {
      notifier('Note enregistree');
      setNote('');
      client.invalidateQueries({ queryKey: ['dossier', id] });
    },
    onError: (e) => notifier(messageErreur(e), 'rouge'),
  });

  if (error) return <Alerte>{messageErreur(error)}</Alerte>;
  if (isLoading || !data) return <Chargement texte="Chargement du dossier" />;

  const { dossier, demandes, echeances, pieces } = data;
  const ouvertes = demandes.filter((d) => d.statut !== 'termine' && d.statut !== 'annule');
  const references = Object.entries(dossier.references ?? {});

  return (
    <>
      <EntetePage
        surtitre={[dossier.client, dossier.pays].filter(Boolean).join(', ')}
        titre={dossier.libelle}
        description={dossier.resume ?? undefined}
        actions={
          <>
            <Badge ton={dossier.statut === 'ouvert' ? 'violet' : dossier.statut === 'clos' ? 'vert' : 'ambre'}>
              {LIBELLES_STATUTS_DOSSIER[dossier.statut]}
            </Badge>
            <Link to="/saisie" className="text-sm">
              Saisie rapide
            </Link>
          </>
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Carte titre="Identification" id="identification" className="lg:col-span-2">
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-texte-discret">Client</dt>
              <dd>{dossier.client}</dd>
            </div>
            <div>
              <dt className="text-texte-discret">Pays</dt>
              <dd>{dossier.pays ?? 'non precise'}</dd>
            </div>
            <div>
              <dt className="text-texte-discret">Produit</dt>
              <dd>{dossier.produit ?? 'non precise'}</dd>
            </div>
            <div>
              <dt className="text-texte-discret">Operation</dt>
              <dd>{dossier.operation ?? 'non precisee'}</dd>
            </div>
            {references.map(([cle, valeur]) => (
              <div key={cle}>
                <dt className="text-texte-discret">{cle}</dt>
                <dd>{String(valeur)}</dd>
              </div>
            ))}
          </dl>
          {dossier.notes && <p className="mt-4 border-t border-ligne pt-3 text-sm text-texte-doux">{dossier.notes}</p>}
        </Carte>

        <Carte titre="Note interne" id="note">
          <div className="space-y-3">
            <ChampZone
              libelle="Ajouter une note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aide="Etat factuel et action qui debloque. Les notes sont tracees dans la chronologie."
            />
            <Bouton variante="plein" chargement={ajouterNote.isPending} disabled={note.trim().length < 1} onClick={() => ajouterNote.mutate()}>
              Enregistrer la note
            </Bouton>
          </div>
        </Carte>
      </div>

      <Onglets
        actif={onglet}
        onChange={setOnglet}
        onglets={[
          { id: 'chronologie', libelle: `Chronologie (${chronologie?.length ?? 0})` },
          { id: 'demandes', libelle: `Demandes (${ouvertes.length} ouverte(s) sur ${demandes.length})` },
          { id: 'echeances', libelle: `Echeances (${echeances.length}) et pieces (${pieces.length})` },
        ]}
      />

      {onglet === 'chronologie' && (
        <Carte id="chrono">
          {!chronologie?.length ? (
            <Vide>Aucun evenement enregistre sur ce dossier.</Vide>
          ) : (
            <ol className="space-y-4">
              {chronologie.map((l, i) => {
                const Icone = ICONES[l.type];
                const meta = (l.meta ?? {}) as { nature?: string; interlocuteur?: string; source?: string; minutesOuvrees?: number; auteurType?: string };
                return (
                  <li key={`${l.type}-${i}`} className="flex gap-3">
                    <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-entete text-texte-doux">
                      <Icone className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1 border-b border-ligne pb-3">
                      <p className="text-sm font-medium">{l.titre}</p>
                      {l.detail && <p className="mt-0.5 text-sm text-texte-doux">{l.detail}</p>}
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-texte-discret">
                        <span title={dateHeure(l.survenuLe)}>{dateHeure(l.survenuLe)}</span>
                        {l.type === 'evenement' && meta.nature && <span>{libelleNature(meta.nature)}</span>}
                        {l.type === 'evenement' && meta.interlocuteur && <span>{libelleInterlocuteur(meta.interlocuteur)}</span>}
                        {l.type === 'evenement' && meta.source && <span>par {libelleSource(meta.source)}</span>}
                        {l.type === 'transition' && typeof meta.minutesOuvrees === 'number' && meta.minutesOuvrees > 0 && (
                          <span>apres {duree(meta.minutesOuvrees)} dans le statut precedent</span>
                        )}
                        {l.type === 'transition' && meta.auteurType === 'claude' && <Badge ton="bleu">Claude</Badge>}
                        {l.demandeId && (
                          <Link to={`/demandes/${l.demandeId}`} className="text-xs">
                            voir la demande
                          </Link>
                        )}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Carte>
      )}

      {onglet === 'demandes' && (
        <Carte id="demandes">
          {!demandes.length ? (
            <Vide>Aucune demande sur ce dossier.</Vide>
          ) : (
            <div className="overflow-x-auto">
              <table className="tableau">
                <caption className="sr-only">Demandes du dossier</caption>
                <thead>
                  <tr>
                    <th scope="col">Objet</th>
                    <th scope="col">Famille</th>
                    <th scope="col">Statut</th>
                    <th scope="col">Reporting client</th>
                    <th scope="col">Attendu de</th>
                    <th scope="col">Delai total</th>
                    <th scope="col">1re reponse</th>
                  </tr>
                </thead>
                <tbody>
                  {demandes.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <Link to={`/demandes/${d.id}`}>{d.objet}</Link>
                        {d.niveauRelance > 0 && (
                          <Badge ton="violet" titre="Niveau de relance">
                            <Repeat className="h-3 w-3" aria-hidden /> N{d.niveauRelance}
                          </Badge>
                        )}
                      </td>
                      <td>{d.famille}</td>
                      <td>
                        <Badge ton={tonStatut(d.statut)}>{libelleStatut(d.statut)}</Badge>
                      </td>
                      <td className="text-texte-doux">{libelleReporting(d.statut)}</td>
                      <td>{libelleActeur(d.acteurAttendu)}</td>
                      <td title="en heures ouvrees du client">{duree(d.temps.total)}</td>
                      <td>{d.temps.premiereReponse === null ? 'en attente' : duree(d.temps.premiereReponse)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Carte>
      )}

      {onglet === 'echeances' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Carte titre="Echeances" id="echeances">
            {!echeances.length ? (
              <Vide>Aucune echeance enregistree.</Vide>
            ) : (
              <ul className="space-y-2 text-sm">
                {echeances.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 border-b border-ligne pb-2">
                    <span>
                      <span className="font-medium">{LIBELLES_ECHEANCES[e.type] ?? e.type}</span>
                      {e.libelle && <span className="text-texte-doux"> : {e.libelle}</span>}
                    </span>
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      {jour(e.echeanceLe)}
                      {e.honoreeLe && <Badge ton="vert">honoree</Badge>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Carte>
          <Carte titre="Pieces" id="pieces">
            {!pieces.length ? (
              <Vide>Aucune piece rattachee.</Vide>
            ) : (
              <ul className="space-y-2 text-sm">
                {pieces.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 border-b border-ligne pb-2">
                    <span>
                      <span className="font-medium">{p.type}</span>
                      {p.reference && <span className="text-texte-doux"> {p.reference}</span>}
                    </span>
                    <span className="whitespace-nowrap text-texte-discret">{jour(p.creeLe)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Carte>
        </div>
      )}
    </>
  );
}
