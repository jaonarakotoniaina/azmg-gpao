import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, messageErreur } from '../lib/api';
import {
  dateHeure,
  duree,
  jour,
  complementActeur,
  libelleActeur,
  libelleFamille,
  libelleInterlocuteur,
  libelleNature,
  libelleReporting,
  libelleSource,
  libelleStatut,
  tonStatut,
} from '../lib/format';
import { Alerte, Badge, Bouton, Carte, ChampSelect, ChampTexte, Chargement, Duree, EntetePage, Indicateur, Vide, useNotifier } from '../composants/ui';
import { ACTEURS, DEFINITIONS_STATUTS, type Acteur, type Statut } from '@shared/constantes';

interface Temps {
  parStatut: Record<string, number>;
  parActeur: Record<string, number>;
  total: number;
  premiereReponse: number | null;
  statutCourant: number;
}

interface Reponse {
  demande: {
    id: number;
    dossierId: number;
    famille: string;
    objet: string;
    statut: Statut;
    acteurAttendu: Acteur;
    priorite: string;
    origine: string;
    echeanceLe: string | null;
    slaHeures: number | null;
    slaEcheanceLe: string | null;
    niveauRelance: number;
    ouverteLe: string;
    premiereReponseLe: string | null;
    termineeLe: string | null;
    notes: string | null;
  };
  dossier: { id: number; libelle: string; client: string };
  temps: Temps;
  transitions: {
    id: number;
    statutAvant: Statut | null;
    statutApres: Statut;
    acteurAvant: Acteur | null;
    acteurApres: Acteur;
    survenuLe: string;
    minutesOuvrees: number;
    motif: string | null;
    auteurType: string;
  }[];
  evenements: {
    id: number;
    sens: string;
    nature: string;
    interlocuteur: string | null;
    source: string;
    survenuLe: string;
    objet: string | null;
    resume: string | null;
  }[];
}

export default function FicheDemande() {
  const { id } = useParams();
  const notifier = useNotifier();
  const client = useQueryClient();
  const [statut, setStatut] = useState<Statut | ''>('');
  const [acteur, setActeur] = useState<Acteur | ''>('');
  const [motif, setMotif] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['demande', id],
    queryFn: () => api.get<Reponse>(`/api/demandes/${id}`),
    enabled: Boolean(id),
  });

  const changer = useMutation({
    mutationFn: () => api.post(`/api/demandes/${id}/statut`, { statut, motif: motif || null, acteurAttendu: acteur || undefined }),
    onSuccess: () => {
      notifier(`Statut passe en « ${libelleStatut(statut)} »`);
      setStatut('');
      setActeur('');
      setMotif('');
      client.invalidateQueries({ queryKey: ['demande', id] });
      client.invalidateQueries({ queryKey: ['file'] });
    },
    onError: (e) => notifier(messageErreur(e), 'rouge'),
  });

  const relancer = useMutation({
    mutationFn: () => api.post(`/api/demandes/${id}/relance`),
    onSuccess: () => {
      notifier('Relance enregistree');
      client.invalidateQueries({ queryKey: ['demande', id] });
      client.invalidateQueries({ queryKey: ['file'] });
    },
    onError: (e) => notifier(messageErreur(e), 'rouge'),
  });

  if (error) return <Alerte>{messageErreur(error)}</Alerte>;
  if (isLoading || !data) return <Chargement texte="Chargement de la demande" />;

  const { demande, dossier, temps, transitions, evenements } = data;
  const cibleMinutes = demande.slaHeures ? demande.slaHeures * 60 : null;

  return (
    <>
      <EntetePage
        surtitre={
          <Link to={`/dossiers/${dossier.id}`}>
            {dossier.libelle}
          </Link>
        }
        titre={demande.objet}
        description={libelleFamille(demande.famille)}
        actions={
          <>
            <Badge ton={tonStatut(demande.statut)}>{libelleStatut(demande.statut)}</Badge>
            <Badge titre="Statut tel qu'il apparait dans le reporting client">{libelleReporting(demande.statut)}</Badge>
          </>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicateur libelle="Delai total" valeur={duree(temps.total)} detail="en heures ouvrees du client" />
        <Indicateur
          libelle="Premiere reponse"
          valeur={temps.premiereReponse === null ? 'en attente' : duree(temps.premiereReponse)}
          detail={cibleMinutes ? `cible ${duree(cibleMinutes)}` : 'aucune cible'}
        />
        <Indicateur libelle={`Attente ${complementActeur(demande.acteurAttendu)}`} valeur={duree(temps.statutCourant)} />
        <Indicateur libelle="Niveau de relance" valeur={demande.niveauRelance === 0 ? 'aucune' : `N${demande.niveauRelance}`} />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Carte titre="Changer de statut" id="statut" className="lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-3">
            <ChampSelect libelle="Nouveau statut" value={statut} onChange={(e) => setStatut(e.target.value as Statut)}>
              <option value="">Choisir</option>
              {DEFINITIONS_STATUTS.filter((s) => s.code !== demande.statut).map((s) => (
                <option key={s.code} value={s.code}>
                  {s.libelle}
                </option>
              ))}
            </ChampSelect>
            <ChampSelect
              libelle="Acteur attendu"
              value={acteur}
              onChange={(e) => setActeur(e.target.value as Acteur)}
              aide="Par defaut, celui du statut choisi."
            >
              <option value="">par defaut</option>
              {ACTEURS.map((a) => (
                <option key={a} value={a}>
                  {libelleActeur(a)}
                </option>
              ))}
            </ChampSelect>
            <ChampTexte libelle="Motif" value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="facultatif" />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Bouton variante="plein" disabled={!statut} chargement={changer.isPending} onClick={() => changer.mutate()}>
              Appliquer
            </Bouton>
            <Bouton variante="lien" chargement={relancer.isPending} onClick={() => relancer.mutate()}>
              Enregistrer une relance emise
            </Bouton>
          </div>
        </Carte>

        <Carte titre="Temps par acteur" id="temps-acteur">
          <ul className="space-y-2 text-sm">
            {Object.entries(temps.parActeur)
              .filter(([, minutes]) => minutes > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([a, minutes]) => (
                <li key={a} className="flex items-center justify-between gap-3">
                  <span>{libelleActeur(a)}</span>
                  <Duree minutes={minutes} />
                </li>
              ))}
            {!Object.values(temps.parActeur).some((m) => m > 0) && <li className="text-texte-discret">Aucun temps mesure.</li>}
          </ul>
          <h3 className="mb-2 mt-4 border-t border-ligne pt-3 text-sm font-semibold">Temps par statut</h3>
          <ul className="space-y-2 text-sm">
            {Object.entries(temps.parStatut)
              .filter(([, minutes]) => minutes > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([s, minutes]) => (
                <li key={s} className="flex items-center justify-between gap-3">
                  <span>{libelleStatut(s)}</span>
                  <Duree minutes={minutes} />
                </li>
              ))}
          </ul>
        </Carte>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Carte titre={`Evenements (${evenements.length})`} id="evenements">
          {!evenements.length ? (
            <Vide>Aucun evenement.</Vide>
          ) : (
            <ol className="space-y-3">
              {evenements.map((e) => (
                <li key={e.id} className="border-b border-ligne pb-3 text-sm">
                  <p className="font-medium">{e.objet ?? libelleNature(e.nature)}</p>
                  {e.resume && <p className="mt-0.5 text-texte-doux">{e.resume}</p>}
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-texte-discret">
                    <span>{dateHeure(e.survenuLe)}</span>
                    <span>{e.sens}</span>
                    <span>{libelleNature(e.nature)}</span>
                    {e.interlocuteur && <span>{libelleInterlocuteur(e.interlocuteur)}</span>}
                    <span>par {libelleSource(e.source)}</span>
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Carte>

        <Carte titre={`Transitions de statut (${transitions.length})`} id="transitions">
          <ol className="space-y-3 text-sm">
            {transitions.map((t) => (
              <li key={t.id} className="border-b border-ligne pb-3">
                <p className="font-medium">
                  {t.statutAvant ? `${libelleStatut(t.statutAvant)} vers ${libelleStatut(t.statutApres)}` : `Ouverture en ${libelleStatut(t.statutApres)}`}
                </p>
                {t.motif && <p className="mt-0.5 text-texte-doux">{t.motif}</p>}
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-texte-discret">
                  <span>{dateHeure(t.survenuLe)}</span>
                  {t.minutesOuvrees > 0 && <span>apres {duree(t.minutesOuvrees)}</span>}
                  <span>attendu de {libelleActeur(t.acteurApres)}</span>
                  {t.auteurType !== 'humain' && <Badge ton={t.auteurType === 'claude' ? 'bleu' : 'neutre'}>{t.auteurType}</Badge>}
                </p>
              </li>
            ))}
          </ol>
        </Carte>
      </div>

      <Carte titre="Reperes" id="reperes" className="mt-4">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-texte-discret">Ouverte le</dt>
            <dd>{dateHeure(demande.ouverteLe)}</dd>
          </div>
          <div>
            <dt className="text-texte-discret">Origine</dt>
            <dd>{libelleSource(demande.origine)}</dd>
          </div>
          <div>
            <dt className="text-texte-discret">Priorite</dt>
            <dd>{demande.priorite}</dd>
          </div>
          <div>
            <dt className="text-texte-discret">Echeance de la demande</dt>
            <dd>{demande.echeanceLe ? jour(demande.echeanceLe) : 'aucune'}</dd>
          </div>
          <div>
            <dt className="text-texte-discret">Delai cible</dt>
            <dd>{demande.slaHeures ? `${demande.slaHeures} h ouvrees, soit ${dateHeure(demande.slaEcheanceLe)}` : 'aucun'}</dd>
          </div>
          <div>
            <dt className="text-texte-discret">Terminee le</dt>
            <dd>{demande.termineeLe ? dateHeure(demande.termineeLe) : 'en cours'}</dd>
          </div>
        </dl>
        {demande.notes && <p className="mt-4 border-t border-ligne pt-3 text-sm text-texte-doux">{demande.notes}</p>}
      </Carte>
    </>
  );
}
