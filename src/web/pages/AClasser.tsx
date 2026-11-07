import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { api, messageErreur } from '../lib/api';
import { useAuth } from '../lib/auth';
import { dateHeure, libelleFamilleCourt, libelleInterlocuteur, libelleNature, libelleSource } from '../lib/format';
import { Alerte, Badge, Bouton, Carte, ChampSelect, Chargement, EntetePage, Onglets, Panneau, Vide, useNotifier } from '../composants/ui';
import { DEFINITIONS_NATURES, FAMILLES_PILOTAGE, INTERLOCUTEURS, SENS, type Interlocuteur, type Nature, type Sens } from '@shared/constantes';

interface LigneAClasser {
  evenement: {
    id: number;
    objet: string | null;
    resume: string | null;
    sens: Sens;
    nature: Nature;
    famille: string | null;
    interlocuteur: Interlocuteur | null;
    source: string;
    expediteur: string | null;
    confianceTypage: number | null;
    justificatifs: string[];
    survenuLe: string;
  };
  dossier: string | null;
}

interface ReglePropose {
  id: number;
  libelle: string;
  domaine: string | null;
  motsCles: string[];
  famille: string | null;
  nature: Nature | null;
  interlocuteur: Interlocuteur | null;
  creeLe: string;
}

/** Correction d'un evenement mal classe : trois listes et un bouton. */
function Correction({ ligne, onCorrige }: { ligne: LigneAClasser; onCorrige: () => void }) {
  const notifier = useNotifier();
  const [famille, setFamille] = useState(ligne.evenement.famille ?? '');
  const [nature, setNature] = useState<Nature>(ligne.evenement.nature);
  const [interlocuteur, setInterlocuteur] = useState<Interlocuteur | ''>(ligne.evenement.interlocuteur ?? '');
  const [sens, setSens] = useState<Sens>(ligne.evenement.sens);

  const corriger = useMutation({
    mutationFn: () =>
      api.post(`/api/evenements/${ligne.evenement.id}/typage`, {
        famille: famille || undefined,
        nature,
        interlocuteur: interlocuteur || null,
        sens,
      }),
    onSuccess: () => {
      notifier('Classement corrige, une regle est proposee');
      onCorrige();
    },
    onError: (e) => notifier(messageErreur(e), 'rouge'),
  });

  const confiance = ligne.evenement.confianceTypage;

  return (
    <li className="carte p-4">
      <div className="mb-3">
        <p className="font-medium">{ligne.evenement.objet ?? 'Sans objet'}</p>
        {ligne.evenement.resume && <p className="mt-0.5 text-sm text-texte-doux">{ligne.evenement.resume}</p>}
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-texte-discret">
          <span>{dateHeure(ligne.evenement.survenuLe)}</span>
          {ligne.dossier && <span>{ligne.dossier}</span>}
          {ligne.evenement.expediteur && <span>{ligne.evenement.expediteur}</span>}
          <span>par {libelleSource(ligne.evenement.source)}</span>
          {confiance !== null && (
            <Badge ton={confiance >= 0.5 ? 'ambre' : 'rouge'} titre="Indice de confiance du typage automatique">
              confiance {Math.round(confiance * 100)} %
            </Badge>
          )}
        </p>
        {ligne.evenement.justificatifs?.length > 0 && (
          <p className="mt-1 text-xs text-texte-discret">
            Propose par : {ligne.evenement.justificatifs.join(' ; ')}
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ChampSelect libelle="Famille" value={famille} onChange={(e) => setFamille(e.target.value)}>
          <option value="">a choisir</option>
          {FAMILLES_PILOTAGE.map((f) => (
            <option key={f.code} value={f.code}>
              {f.code} {libelleFamilleCourt(f.code)}
            </option>
          ))}
        </ChampSelect>
        <ChampSelect libelle="Nature" value={nature} onChange={(e) => setNature(e.target.value as Nature)}>
          {DEFINITIONS_NATURES.map((n) => (
            <option key={n.code} value={n.code}>
              {n.libelle}
            </option>
          ))}
        </ChampSelect>
        <ChampSelect libelle="Sens" value={sens} onChange={(e) => setSens(e.target.value as Sens)}>
          {SENS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </ChampSelect>
        <ChampSelect libelle="Interlocuteur" value={interlocuteur} onChange={(e) => setInterlocuteur(e.target.value as Interlocuteur | '')}>
          <option value="">non precise</option>
          {INTERLOCUTEURS.map((c) => (
            <option key={c} value={c}>
              {libelleInterlocuteur(c)}
            </option>
          ))}
        </ChampSelect>
      </div>

      <div className="mt-3">
        <Bouton variante="plein" disabled={!famille} chargement={corriger.isPending} onClick={() => corriger.mutate()}>
          Classer
        </Bouton>
      </div>
    </li>
  );
}

export default function AClasser() {
  const { peut } = useAuth();
  const notifier = useNotifier();
  const client = useQueryClient();
  const [onglet, setOnglet] = useState<'messages' | 'regles'>('messages');

  const { data: lignes, isLoading, error } = useQuery({
    queryKey: ['a-classer'],
    queryFn: () => api.get<LigneAClasser[]>('/api/evenements/a-classer'),
  });

  const { data: propositions } = useQuery({
    queryKey: ['regles', 'proposees'],
    queryFn: () => api.get<ReglePropose[]>('/api/typage/regles/proposees'),
  });

  const decider = useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'accepter' | 'refuser' }) => api.post(`/api/typage/regles/${id}/${action}`),
    onSuccess: (_r, v) => {
      notifier(v.action === 'accepter' ? 'Regle acceptee, elle classera les prochains messages' : 'Regle ecartee');
      client.invalidateQueries({ queryKey: ['regles'] });
    },
    onError: (e) => notifier(messageErreur(e), 'rouge'),
  });

  return (
    <>
      <EntetePage
        titre="A classer"
        description="Messages dont le classement automatique n’est pas assez sur, ou dont la famille manque. Chaque correction propose une regle, qui ne classera rien tant qu’elle n’aura pas ete acceptee."
      />

      <Onglets
        actif={onglet}
        onChange={setOnglet}
        prefixe="classer"
        libelle="Sections de la file a classer"
        onglets={[
          { id: 'messages', libelle: `Messages (${lignes?.length ?? 0})` },
          { id: 'regles', libelle: `Regles proposees (${propositions?.length ?? 0})` },
        ]}
      />

      {onglet === 'messages' && (
        <Panneau prefixe="classer" id="messages">
          {error && <Alerte>{messageErreur(error)}</Alerte>}
          {isLoading ? (
            <Chargement />
          ) : !lignes?.length ? (
            <Vide>
              Rien a classer. Les messages dont le typage automatique depasse le seuil de confiance sont ranges directement ; les
              messages hors perimetre sont ecartes sans passer par ici.
            </Vide>
          ) : (
            <ul className="space-y-3">
              {lignes.map((l) => (
                <Correction key={l.evenement.id} ligne={l} onCorrige={() => client.invalidateQueries()} />
              ))}
            </ul>
          )}
        </Panneau>
      )}

      {onglet === 'regles' && (
        <Panneau prefixe="classer" id="regles">
          <Carte>
            <Alerte ton="bleu">
              Une regle tiree d&rsquo;un seul message se trompe souvent. Elle attend donc votre accord avant de classer quoi que ce
              soit, et reste modifiable dans les Parametres.
            </Alerte>
            {!propositions?.length ? (
              <div className="mt-4">
                <Vide>Aucune regle en attente.</Vide>
              </div>
            ) : (
              <ul className="mt-4 space-y-3">
                {propositions.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 border-b border-ligne pb-3">
                    <div className="min-w-0">
                      <p className="font-medium">{r.libelle}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        {r.famille && <Badge ton="violet">{r.famille}</Badge>}
                        {r.nature && <Badge>{libelleNature(r.nature)}</Badge>}
                        {r.interlocuteur && <Badge>{libelleInterlocuteur(r.interlocuteur)}</Badge>}
                        {r.domaine && <Badge ton="bleu">domaine {r.domaine}</Badge>}
                      </p>
                      <p className="mt-1 text-xs text-texte-discret">
                        Mots retenus : {r.motsCles.join(', ') || 'aucun'} ; proposee le {dateHeure(r.creeLe)}
                      </p>
                    </div>
                    {peut('admin', 'manager') && (
                      <div className="flex items-center gap-2">
                        <Bouton variante="contour" icone={<Check className="h-4 w-4" aria-hidden />} onClick={() => decider.mutate({ id: r.id, action: 'accepter' })}>
                          Accepter
                        </Bouton>
                        <Bouton variante="danger" icone={<X className="h-4 w-4" aria-hidden />} onClick={() => decider.mutate({ id: r.id, action: 'refuser' })}>
                          Ecarter
                        </Bouton>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Carte>
        </Panneau>
      )}

      <p className="mt-6 text-sm text-texte-discret">
        Les regles actives sont visibles dans <Link to="/parametres">les Parametres</Link>.
      </p>
    </>
  );
}
