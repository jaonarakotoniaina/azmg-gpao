import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Bell, Clock } from 'lucide-react';
import { api, messageErreur } from '../lib/api';
import { useAuth } from '../lib/auth';
import { complementActeur, dateHeure, duree, jour, libelleActeur, libelleFamilleCourt, libelleStatut, relatif, tonStatut } from '../lib/format';
import { Alerte, Badge, Bouton, Carte, ChampSelect, Chargement, EntetePage, Indicateur, Vide, useNotifier } from '../composants/ui';
import { ACTEURS, DEFINITIONS_STATUTS, FAMILLES_PILOTAGE, STATUTS_OUVERTS, type Statut } from '@shared/constantes';

interface LigneFile {
  id: number;
  dossierId: number;
  dossier: string;
  client: string;
  famille: string;
  objet: string;
  statut: Statut;
  acteurAttendu: string;
  priorite: string;
  echeanceLe: string | null;
  slaEcheanceLe: string | null;
  niveauRelance: number;
  ouverteLe: string;
  dernierEvenementLe: string | null;
  ageMinutes: number;
  attenteMinutes: number;
  slaDepasse: boolean;
  joursAvantEcheance: number | null;
}

interface Compte {
  id: number;
  nom: string;
}

/** Statuts proposes en action rapide, dans l'ordre d'usage courant du poste. */
const ACTIONS_RAPIDES: { statut: Statut; libelle: string }[] = [
  { statut: 'en_cours', libelle: 'Je m’en occupe' },
  { statut: 'attente_do', libelle: 'Validation DO demandee' },
  { statut: 'attente_tiers', libelle: 'En attente du destinataire' },
  { statut: 'bloque', libelle: 'Bloque' },
  { statut: 'termine', libelle: 'Termine' },
];

export default function FileDuJour() {
  const { utilisateur } = useAuth();
  const notifier = useNotifier();
  const client = useQueryClient();
  const [compteId, setCompteId] = useState('');
  const [famille, setFamille] = useState('');
  const [acteur, setActeur] = useState('');
  const [statut, setStatut] = useState('');
  const [risque, setRisque] = useState(false);

  const { data: comptes } = useQuery({ queryKey: ['comptes'], queryFn: () => api.get<Compte[]>('/api/comptes') });

  const parametresUrl = useMemo(() => {
    const p = new URLSearchParams();
    if (compteId) p.set('compteId', compteId);
    if (famille) p.set('famille', famille);
    if (acteur) p.set('acteur', acteur);
    if (statut) p.set('statut', statut);
    if (risque) p.set('risque', '1');
    return p.toString();
  }, [compteId, famille, acteur, statut, risque]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['file', parametresUrl],
    queryFn: () => api.get<LigneFile[]>(`/api/demandes/file${parametresUrl ? `?${parametresUrl}` : ''}`),
    refetchInterval: 120_000,
  });

  const changer = useMutation({
    mutationFn: ({ id, statut: nouveau }: { id: number; statut: Statut }) => api.post(`/api/demandes/${id}/statut`, { statut: nouveau }),
    onSuccess: (_r, v) => {
      notifier(`Demande passee en « ${libelleStatut(v.statut)} »`);
      client.invalidateQueries({ queryKey: ['file'] });
    },
    onError: (e) => notifier(messageErreur(e), 'rouge'),
  });

  const lignes = useMemo(() => data ?? [], [data]);
  const indicateurs = useMemo(() => {
    const enRetard = lignes.filter((l) => l.slaDepasse).length;
    const echeanceProche = lignes.filter((l) => l.joursAvantEcheance !== null && l.joursAvantEcheance <= 2).length;
    const attenteDo = lignes.filter((l) => l.statut === 'attente_do').length;
    const ageMoyen = lignes.length ? Math.round(lignes.reduce((s, l) => s + l.ageMinutes, 0) / lignes.length) : 0;
    return { enRetard, echeanceProche, attenteDo, ageMoyen };
  }, [lignes]);

  return (
    <>
      <EntetePage
        surtitre={utilisateur?.role === 'collaborateur' ? 'Votre file' : 'Toutes les demandes ouvertes de votre perimetre'}
        titre="File du jour"
        description="Demandes ouvertes triees par urgence : delai cible depasse, echeance proche, priorite, puis anciennete. Les delais sont comptes en heures ouvrees du client."
        actions={
          <Bouton variante="plein" onClick={() => client.invalidateQueries({ queryKey: ['file'] })}>
            Actualiser
          </Bouton>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicateur libelle="Demandes ouvertes" valeur={lignes.length} />
        <Indicateur libelle="Delai cible depasse" valeur={indicateurs.enRetard} detail={indicateurs.enRetard ? 'a traiter en premier' : 'aucun retard'} />
        <Indicateur libelle="Echeance a 2 jours ou moins" valeur={indicateurs.echeanceProche} />
        <Indicateur libelle="En attente de la DO" valeur={indicateurs.attenteDo} detail={`age moyen ${duree(indicateurs.ageMoyen)}`} />
      </div>

      <Carte titre="Filtres" id="filtres" className="mb-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <ChampSelect libelle="Compte client" value={compteId} onChange={(e) => setCompteId(e.target.value)}>
            <option value="">Tous mes comptes</option>
            {comptes?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </ChampSelect>
          <ChampSelect libelle="Famille" value={famille} onChange={(e) => setFamille(e.target.value)}>
            <option value="">Toutes les familles</option>
            {FAMILLES_PILOTAGE.map((f) => (
              <option key={f.code} value={f.code}>
                {f.code} {libelleFamilleCourt(f.code)}
              </option>
            ))}
          </ChampSelect>
          <ChampSelect libelle="Acteur attendu" value={acteur} onChange={(e) => setActeur(e.target.value)}>
            <option value="">Tous les acteurs</option>
            {ACTEURS.filter((a) => a !== 'aucun').map((a) => (
              <option key={a} value={a}>
                {libelleActeur(a)}
              </option>
            ))}
          </ChampSelect>
          <ChampSelect libelle="Statut" value={statut} onChange={(e) => setStatut(e.target.value)}>
            <option value="">Tous les statuts ouverts</option>
            {DEFINITIONS_STATUTS.filter((s) => STATUTS_OUVERTS.includes(s.code)).map((s) => (
              <option key={s.code} value={s.code}>
                {s.libelle}
              </option>
            ))}
          </ChampSelect>
          <div className="flex items-end">
            <Bouton variante={risque ? 'plein' : 'contour'} onClick={() => setRisque((v) => !v)} icone={<AlertTriangle className="h-4 w-4" aria-hidden />}>
              {risque ? 'A risque seulement' : 'Tout afficher'}
            </Bouton>
          </div>
        </div>
      </Carte>

      {error && <Alerte>{messageErreur(error)}</Alerte>}
      {isLoading ? (
        <Chargement texte="Chargement de la file" />
      ) : !lignes.length ? (
        <Vide>
          Aucune demande ouverte avec ces filtres. Utilisez la saisie rapide pour enregistrer une consigne recue par WhatsApp ou par mail.
        </Vide>
      ) : (
        <ul className="space-y-3">
          {lignes.map((l) => (
            <li key={l.id}>
              <article className="carte carte-survol p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge ton={tonStatut(l.statut)}>{libelleStatut(l.statut)}</Badge>
                      <Badge titre={`Famille ${l.famille}`}>{l.famille}</Badge>
                      {l.slaDepasse && (
                        <Badge ton="rouge" titre="Le delai cible de premiere reponse est depasse">
                          delai depasse
                        </Badge>
                      )}
                      {l.joursAvantEcheance !== null && l.joursAvantEcheance <= 2 && (
                        <Badge ton="ambre" titre="Echeance du dossier proche">
                          {l.joursAvantEcheance <= 0 ? "echeance aujourd'hui" : `echeance dans ${l.joursAvantEcheance} j`}
                        </Badge>
                      )}
                      {l.niveauRelance > 0 && (
                        <Badge ton="violet" titre="Niveau de relance atteint">
                          <Bell className="h-3 w-3" aria-hidden /> N{l.niveauRelance}
                        </Badge>
                      )}
                      {l.priorite !== 'normale' && <Badge ton={l.priorite === 'basse' ? 'neutre' : 'rouge'}>priorite {l.priorite}</Badge>}
                    </div>
                    <h2 className="truncate text-base font-semibold">
                      <Link to={`/demandes/${l.id}`}>{l.objet}</Link>
                    </h2>
                    <p className="mt-0.5 truncate text-sm text-texte-doux">
                      <Link to={`/dossiers/${l.dossierId}`}>{l.dossier}</Link>
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-texte-discret">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" aria-hidden />
                        ouverte depuis {duree(l.ageMinutes)}
                      </span>
                      <span>en attente {complementActeur(l.acteurAttendu)} depuis {duree(l.attenteMinutes)}</span>
                      {l.dernierEvenementLe && <span>dernier evenement {relatif(l.dernierEvenementLe)}</span>}
                      {l.echeanceLe && <span>echeance de la demande le {jour(l.echeanceLe)}</span>}
                      {l.slaEcheanceLe && <span title={dateHeure(l.slaEcheanceLe)}>delai cible {relatif(l.slaEcheanceLe)}</span>}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <ChampSelect
                      libelle="Action rapide"
                      className="w-56"
                      value=""
                      disabled={changer.isPending}
                      onChange={(e) => {
                        if (e.target.value) changer.mutate({ id: l.id, statut: e.target.value as Statut });
                      }}
                    >
                      <option value="">Changer de statut</option>
                      {ACTIONS_RAPIDES.filter((a) => a.statut !== l.statut).map((a) => (
                        <option key={a.statut} value={a.statut}>
                          {a.libelle}
                        </option>
                      ))}
                    </ChampSelect>
                    <Link to={`/demandes/${l.id}`} className="text-sm">
                      Ouvrir la demande
                    </Link>
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
