import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Sunrise, X } from 'lucide-react';
import { api, messageErreur } from '../lib/api';
import { duree } from '../lib/format';
import {
  Alerte,
  Badge,
  Bouton,
  Carte,
  ChampSelect,
  ChampTexte,
  Chargement,
  EntetePage,
  Onglets,
  Panneau,
  Vide,
  useNotifier,
} from '../composants/ui';

interface Compte {
  id: number;
  nom: string;
}

interface Brouillon {
  id: number;
  type: string;
  titre: string;
  contenu: string;
  statut: string;
  niveau: number | null;
  sources: number[];
  dossierId: number | null;
  demandeId: number | null;
  prepareLe: string;
}

interface LigneBrouillon {
  brouillon: Brouillon;
  dossier: string | null;
  objet: string | null;
}

const LIBELLES_TYPE: Record<string, string> = {
  relance: 'Relance',
  daily: 'Reporting quotidien',
  semaine: 'Onglet de semaine',
  situation_client: 'Situation client',
  comparatif_cotations: 'Comparatif de cotations',
};

const STATUTS = [
  { cle: 'prepare', libelle: 'A relire' },
  { cle: 'utilise', libelle: 'Envoyes' },
  { cle: 'ecarte', libelle: 'Ecartes' },
] as const;

export default function Brouillons() {
  const notifier = useNotifier();
  const client = useQueryClient();
  const [compteId, setCompteId] = useState('');
  const [statut, setStatut] = useState<'prepare' | 'utilise' | 'ecarte'>('prepare');
  const [ouvert, setOuvert] = useState<number | null>(null);
  const [client0, setClient0] = useState('');

  const { data: comptes } = useQuery({ queryKey: ['comptes'], queryFn: () => api.get<Compte[]>('/api/comptes') });
  useEffect(() => {
    if (!compteId && comptes?.length === 1) setCompteId(String(comptes[0].id));
  }, [comptes, compteId]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['brouillons', compteId, statut],
    queryFn: () => api.get<LigneBrouillon[]>(`/api/brouillons?compteId=${compteId}&statut=${statut}`),
    enabled: Boolean(compteId),
  });

  function rafraichir() {
    void client.invalidateQueries({ queryKey: ['brouillons'] });
  }

  const matin = useMutation({
    mutationFn: () => api.post<{ ignore: boolean; relances?: number; daily?: number; semaine?: number }>('/api/brouillons/matin', { compteId: Number(compteId) }),
    onSuccess: (r) => {
      notifier(
        r.ignore
          ? 'Automatisations en pause : aucun brouillon prepare'
          : `Prepare : ${r.relances ?? 0} relance(s), ${r.daily ?? 0} reporting, ${r.semaine ?? 0} onglet de semaine`,
      );
      rafraichir();
    },
    onError: (e) => notifier(messageErreur(e), 'rouge'),
  });

  const situation = useMutation({
    mutationFn: () => api.post('/api/brouillons/situation-client', { compteId: Number(compteId), client: client0.trim() }),
    onSuccess: () => {
      notifier('Tableau de situation prepare');
      setClient0('');
      rafraichir();
    },
    onError: (e) => notifier(messageErreur(e), 'rouge'),
  });

  const decider = useMutation({
    mutationFn: (v: { id: number; statut: 'utilise' | 'ecarte' }) => api.post(`/api/brouillons/${v.id}/decision`, { statut: v.statut }),
    onSuccess: (_r, v) => {
      notifier(v.statut === 'utilise' ? 'Brouillon marque comme envoye' : 'Brouillon ecarte');
      rafraichir();
    },
    onError: (e) => notifier(messageErreur(e), 'rouge'),
  });

  async function copier(texte: string) {
    try {
      await navigator.clipboard.writeText(texte);
      notifier('Brouillon copie');
    } catch {
      notifier('Copie impossible : selectionnez le texte et copiez-le a la main', 'rouge');
    }
  }

  return (
    <>
      <EntetePage
        titre="Brouillons"
        description="Relances, reporting, situations client et comparatifs de cotations prepares par l’application. Rien ne part tout seul : vous relisez, vous copiez, vous envoyez."
        actions={
          compteId && (
            <Bouton
              variante="plein"
              icone={<Sunrise className="h-4 w-4" aria-hidden />}
              chargement={matin.isPending}
              onClick={() => matin.mutate()}
            >
              Preparer maintenant
            </Bouton>
          )
        }
      />

      <Alerte ton="bleu">
        Regle d&rsquo;or : l&rsquo;application prepare, l&rsquo;humain envoie. Aucun message ne part vers un client, un transitaire ou la donneuse
        d&rsquo;ordre sans votre action.
      </Alerte>

      <Carte className="my-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <ChampSelect libelle="Compte client" value={compteId} onChange={(e) => setCompteId(e.target.value)}>
            <option value="">Choisir un compte</option>
            {comptes?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </ChampSelect>
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (client0.trim()) situation.mutate();
            }}
          >
            <ChampTexte
              libelle="Situation d’un client"
              aide="Nom du client tel qu’il figure dans les dossiers"
              value={client0}
              onChange={(e) => setClient0(e.target.value)}
              className="flex-1"
            />
            <Bouton type="submit" chargement={situation.isPending} disabled={!compteId || !client0.trim()}>
              Preparer
            </Bouton>
          </form>
        </div>
      </Carte>

      {error && <Alerte>{messageErreur(error)}</Alerte>}

      {!compteId ? (
        <Vide>Choisissez un compte client.</Vide>
      ) : (
        <>
          <Onglets
            actif={statut}
            onChange={setStatut}
            onglets={STATUTS.map((s) => ({ id: s.cle, libelle: s.libelle }))}
            prefixe="brouillons"
            libelle="Etat des brouillons"
          />
          <Panneau prefixe="brouillons" id={statut}>
            {isLoading ? (
              <Chargement texte="Chargement des brouillons" />
            ) : !data?.length ? (
              <Vide>
                {statut === 'prepare'
                  ? 'Aucun brouillon a relire. La preparation du matin tourne chaque jour a 6 h.'
                  : 'Aucun brouillon dans cette liste.'}
              </Vide>
            ) : (
              <ul id="liste-brouillons" className="space-y-3">
                {data.map(({ brouillon, dossier }) => (
                  <li key={brouillon.id}>
                    <Carte>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{brouillon.titre}</p>
                          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-texte-doux">
                            <Badge>{LIBELLES_TYPE[brouillon.type] ?? brouillon.type}</Badge>
                            {brouillon.niveau && <Badge ton="ambre">N{brouillon.niveau}</Badge>}
                            {dossier && brouillon.dossierId && <Link to={`/dossiers/${brouillon.dossierId}`}>{dossier}</Link>}
                            <span className="text-xs text-texte-discret">
                              prepare il y a {duree(Math.round((Date.now() - new Date(brouillon.prepareLe).getTime()) / 60_000))}
                            </span>
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Bouton icone={<Copy className="h-4 w-4" aria-hidden />} onClick={() => void copier(brouillon.contenu)}>
                            Copier
                          </Bouton>
                          <Bouton onClick={() => setOuvert(ouvert === brouillon.id ? null : brouillon.id)}>
                            {ouvert === brouillon.id ? 'Replier' : 'Lire'}
                          </Bouton>
                          {brouillon.statut === 'prepare' && (
                            <>
                              <Bouton
                                variante="plein"
                                icone={<Check className="h-4 w-4" aria-hidden />}
                                onClick={() => decider.mutate({ id: brouillon.id, statut: 'utilise' })}
                              >
                                Je l&rsquo;ai envoye
                              </Bouton>
                              <Bouton
                                icone={<X className="h-4 w-4" aria-hidden />}
                                onClick={() => decider.mutate({ id: brouillon.id, statut: 'ecarte' })}
                              >
                                Ecarter
                              </Bouton>
                            </>
                          )}
                        </div>
                      </div>

                      {ouvert === brouillon.id && (
                        <div className="mt-3">
                          <label htmlFor={`texte-${brouillon.id}`} className="sr-only">
                            Texte du brouillon
                          </label>
                          <textarea
                            id={`texte-${brouillon.id}`}
                            className="champ min-h-[260px] font-mono text-xs"
                            readOnly
                            value={brouillon.contenu}
                          />
                          <p className="aide">
                            {brouillon.sources.length} evenement(s) cite(s) a l&rsquo;appui.
                            {brouillon.demandeId && (
                              <>
                                {' '}
                                <Link to={`/demandes/${brouillon.demandeId}`}>Voir la demande</Link>
                              </>
                            )}
                          </p>
                        </div>
                      )}
                    </Carte>
                  </li>
                ))}
              </ul>
            )}
          </Panneau>
        </>
      )}
    </>
  );
}
