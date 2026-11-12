import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { api, messageErreur } from '../lib/api';
import { libelleFamilleCourt, libelleInterlocuteur, libelleNature, libelleSource, libelleStatut } from '../lib/format';
import { Alerte, Badge, Bouton, Carte, Case, ChampSelect, ChampTexte, ChampZone, EntetePage, useNotifier } from '../composants/ui';
import {
  DEFINITIONS_NATURES,
  FAMILLES_PILOTAGE,
  INTERLOCUTEURS,
  PRIORITES,
  SENS,
  SOURCES,
  definitionNature,
  type Interlocuteur,
  type Nature,
  type Priorite,
  type Sens,
  type Source,
} from '@shared/constantes';

/** Le sens vu par le poste : ce qui arrive, ce qui part, ce qui reste interne. */
const LIBELLES_SENS: Record<Sens, string> = {
  entrant: 'recu',
  sortant: 'envoye',
  interne: 'interne',
};

interface Compte {
  id: number;
  nom: string;
}

interface DossierTrouve {
  id: number;
  libelle: string;
  client: string;
  statut: string;
  demandesOuvertes: number;
}

/**
 * Saisie rapide : objectif 30 secondes au clavier, utilisable sur mobile.
 * Un seul appel cree le dossier manquant, ouvre la demande si la nature le prevoit,
 * et enregistre l'evenement.
 */
export default function SaisieRapide() {
  const notifier = useNotifier();
  const navigate = useNavigate();
  const client = useQueryClient();
  const champObjet = useRef<HTMLInputElement>(null);

  const [compteId, setCompteId] = useState('');
  const [recherche, setRecherche] = useState('');
  const [dossierId, setDossierId] = useState<number | null>(null);
  const [nouveauDossier, setNouveauDossier] = useState(false);
  const [clientDossier, setClientDossier] = useState('');
  const [pays, setPays] = useState('');
  const [produit, setProduit] = useState('');
  const [operation, setOperation] = useState('');

  const [objet, setObjet] = useState('');
  const [famille, setFamille] = useState('T01');
  const [sens, setSens] = useState<Sens>('entrant');
  const [nature, setNature] = useState<Nature>('demande_entrante');
  const [interlocuteur, setInterlocuteur] = useState<Interlocuteur | ''>('client');
  const [source, setSource] = useState<Source>('whatsapp');
  const [priorite, setPriorite] = useState<Priorite>('normale');
  const [resume, setResume] = useState('');
  const [echeance, setEcheance] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

  const { data: comptes } = useQuery({ queryKey: ['comptes'], queryFn: () => api.get<Compte[]>('/api/comptes') });

  // Un seul compte dans le perimetre : il est preselectionne, un champ de moins a remplir.
  useEffect(() => {
    if (!compteId && comptes?.length === 1) setCompteId(String(comptes[0].id));
  }, [comptes, compteId]);

  const { data: dossiers } = useQuery({
    queryKey: ['dossiers', 'recherche', compteId, recherche],
    queryFn: () => api.get<DossierTrouve[]>(`/api/dossiers?${new URLSearchParams({ ...(compteId ? { compteId } : {}), q: recherche, limite: '8' })}`),
    enabled: Boolean(compteId),
  });

  // Le sens compatible est impose par la nature : on evite une combinaison refusee par le serveur.
  const sensPossibles = useMemo(() => definitionNature(nature)?.sens ?? SENS, [nature]);
  useEffect(() => {
    if (!sensPossibles.includes(sens)) setSens(sensPossibles[0]);
  }, [sensPossibles, sens]);

  const enregistrer = useMutation({
    mutationFn: () =>
      api.post<{ dossierId: number; dossierCree: boolean; demande: { id: number; statut: string } | null; demandeCreee: boolean; statutApplique: string | null }>(
        '/api/saisie/rapide',
        {
          compteId: Number(compteId),
          dossierId: nouveauDossier ? null : dossierId,
          nouveauDossier: nouveauDossier
            ? { client: clientDossier, pays: pays || null, produit: produit || null, operation: operation || null }
            : undefined,
          famille,
          objet,
          sens,
          nature,
          interlocuteur: interlocuteur || null,
          source,
          priorite,
          resume: resume || null,
          echeanceLe: echeance ? new Date(`${echeance}T12:00:00`).toISOString() : null,
        },
      ),
    onSuccess: (r) => {
      const quoi = [r.dossierCree && 'dossier cree', r.demandeCreee && 'demande ouverte', !r.demandeCreee && r.statutApplique && `statut « ${libelleStatut(r.statutApplique)} »`]
        .filter(Boolean)
        .join(', ');
      notifier(`Saisie enregistree${quoi ? ` : ${quoi}` : ''}`);
      client.invalidateQueries({ queryKey: ['file'] });
      client.invalidateQueries({ queryKey: ['dossiers'] });
      // Reinitialisation partielle : le compte et le dossier restent, pour enchainer les saisies.
      setObjet('');
      setResume('');
      setEcheance('');
      setNouveauDossier(false);
      if (r.dossierCree) setDossierId(r.dossierId);
      champObjet.current?.focus();
    },
    onError: (e) => setErreur(messageErreur(e)),
  });

  const pret = Boolean(compteId && objet.trim().length >= 2 && (nouveauDossier ? clientDossier.trim() : dossierId));

  function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (!pret) {
      setErreur('Choisissez un dossier (ou renseignez le client du nouveau dossier) et saisissez un objet.');
      return;
    }
    enregistrer.mutate();
  }

  return (
    <>
      <EntetePage
        titre="Saisie rapide"
        description="Pour une consigne recue par WhatsApp, un vocal ou un mail. Le dossier est cree a la volee si besoin, et la demande s’ouvre selon la nature choisie."
      />

      <form onSubmit={soumettre} className="grid gap-6 lg:grid-cols-2">
        <Carte titre="1. Dossier" id="dossier">
          <div className="space-y-4">
            <ChampSelect libelle="Compte client" value={compteId} onChange={(e) => setCompteId(e.target.value)} required>
              <option value="">Choisir un compte</option>
              {comptes?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </ChampSelect>

            <Case
              libelle="Creer un nouveau dossier"
              aide="Un dossier est un client, un produit et une operation. Un dossier identique existant est reutilise."
              checked={nouveauDossier}
              onChange={(e) => setNouveauDossier(e.target.checked)}
            />

            {nouveauDossier ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <ChampTexte libelle="Client" required value={clientDossier} onChange={(e) => setClientDossier(e.target.value)} placeholder="Alpha Pharma" />
                <ChampTexte libelle="Pays" value={pays} onChange={(e) => setPays(e.target.value)} placeholder="Algerie" />
                <ChampTexte libelle="Produit et quantite" value={produit} onChange={(e) => setProduit(e.target.value)} placeholder="Gelules 272 kg" />
                <ChampTexte libelle="Operation" value={operation} onChange={(e) => setOperation(e.target.value)} placeholder="aerien vers Alger" />
              </div>
            ) : (
              <>
                <ChampTexte
                  libelle="Rechercher un dossier"
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  disabled={!compteId}
                  placeholder="client, produit, pays"
                  aide={compteId ? undefined : "Choisissez d’abord un compte client."}
                />
                <ul className="space-y-2" aria-label="Dossiers proposes">
                  {dossiers?.length ? (
                    dossiers.map((d) => (
                      <li key={d.id}>
                        <button
                          type="button"
                          onClick={() => setDossierId(d.id)}
                          aria-pressed={dossierId === d.id}
                          className={`w-full rounded-bouton border px-3 py-2 text-left text-sm ${
                            dossierId === d.id ? 'border-violet bg-violet-pale' : 'border-ligne hover:border-ligne-forte'
                          }`}
                        >
                          <span className="block font-medium">{d.libelle}</span>
                          <span className="text-xs text-texte-discret">
                            {d.demandesOuvertes} demande(s) ouverte(s)
                          </span>
                        </button>
                      </li>
                    ))
                  ) : (
                    <li className="flex items-center gap-2 text-sm text-texte-discret">
                      <Search className="h-4 w-4" aria-hidden /> Aucun dossier trouve. Cochez « Creer un nouveau dossier ».
                    </li>
                  )}
                </ul>
              </>
            )}
          </div>
        </Carte>

        <Carte titre="2. Ce qui s’est passe" id="evenement">
          <div className="space-y-4">
            {erreur && <Alerte>{erreur}</Alerte>}
            <ChampTexte
              ref={champObjet}
              libelle="Objet"
              required
              autoFocus
              value={objet}
              onChange={(e) => setObjet(e.target.value)}
              placeholder="Cotation fret aerien 180 kg vers Alger"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <ChampSelect libelle="Famille" value={famille} onChange={(e) => setFamille(e.target.value)}>
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
                {sensPossibles.map((s) => (
                  <option key={s} value={s}>
                    {LIBELLES_SENS[s]}
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
              <ChampSelect libelle="Source" value={source} onChange={(e) => setSource(e.target.value as Source)}>
                {SOURCES.filter((s) => s !== 'import').map((s) => (
                  <option key={s} value={s}>
                    {libelleSource(s)}
                  </option>
                ))}
              </ChampSelect>
              <ChampSelect libelle="Priorite" value={priorite} onChange={(e) => setPriorite(e.target.value as Priorite)}>
                {PRIORITES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </ChampSelect>
            </div>
            <ChampTexte libelle="Echeance de la demande" type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} />
            <ChampZone
              libelle="Resume"
              value={resume}
              onChange={(e) => setResume(e.target.value)}
              placeholder="Ce que demande l’interlocuteur, en une ou deux phrases."
              aide="Decrivez l’etat factuel du dossier et l’action attendue, pas une appreciation."
            />
            <p className="text-sm text-texte-doux">
              Effet attendu : <Badge ton="violet">{libelleNature(nature)}</Badge>{' '}
              {definitionNature(nature)?.effet}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Bouton type="submit" variante="plein" chargement={enregistrer.isPending} disabled={!pret}>
                Enregistrer
              </Bouton>
              {dossierId && (
                <Link to={`/dossiers/${dossierId}`} className="text-sm">
                  Voir le dossier
                </Link>
              )}
              <Bouton variante="lien" onClick={() => navigate('/')}>
                Revenir a la file
              </Bouton>
            </div>
          </div>
        </Carte>
      </form>
    </>
  );
}
