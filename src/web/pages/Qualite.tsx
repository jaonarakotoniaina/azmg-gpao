import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { api, messageErreur } from '../lib/api';
import { useAuth } from '../lib/auth';
import { dateHeure } from '../lib/format';
import { Alerte, Badge, Bouton, Carte, Case, ChampSelect, ChampTexte, ChampZone, Chargement, EntetePage, Indicateur, Onglets, Panneau, Vide, useNotifier } from '../composants/ui';

interface Compte {
  id: number;
  nom: string;
}

interface Critere {
  cle: string;
  libelle: string;
  poids: number;
}

interface LigneControle {
  controle: {
    id: number;
    semaine: string | null;
    notes: Record<string, number>;
    note: string | null;
    reprise: boolean;
    bonDuPremierCoup: boolean | null;
    commentaire: string | null;
    creeLe: string;
  };
  demande: { id: number; objet: string; famille: string };
  dossier: string;
  grille: string | null;
  criteres: Critere[] | null;
}

interface Indicateurs {
  tires: number;
  notes: number;
  noteMoyenne: number | null;
  tauxReprise: number | null;
  bonDuPremierCoup: number | null;
  envoisControles: number;
  tauxConformite: number | null;
  pointsManques: { cle: string; libelle: string; manques: number }[];
}

function semaineCourante(): string {
  const d = DateTime.now();
  return `${d.weekYear}-W${String(d.weekNumber).padStart(2, '0')}`;
}

/** Formulaire de notation d'un controle, replie tant qu'on ne l'ouvre pas. */
function Notation({ ligne, onEnregistre }: { ligne: LigneControle; onEnregistre: () => void }) {
  const notifier = useNotifier();
  const [ouvert, setOuvert] = useState(false);
  const [notes, setNotes] = useState<Record<string, number>>(ligne.controle.notes ?? {});
  const [reprise, setReprise] = useState(ligne.controle.reprise);
  const [bon, setBon] = useState<boolean | null>(ligne.controle.bonDuPremierCoup);
  const [commentaire, setCommentaire] = useState(ligne.controle.commentaire ?? '');

  const enregistrer = useMutation({
    mutationFn: () => api.post(`/api/qualite/controle/${ligne.controle.id}/note`, { notes, reprise, bonDuPremierCoup: bon, commentaire: commentaire || null }),
    onSuccess: () => {
      notifier('Controle note');
      setOuvert(false);
      onEnregistre();
    },
    onError: (e) => notifier(messageErreur(e), 'rouge'),
  });

  const criteres = ligne.criteres ?? [];

  return (
    <li className="carte p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/demandes/${ligne.demande.id}`} className="font-medium">
            {ligne.demande.objet}
          </Link>
          <p className="truncate text-sm text-texte-doux">{ligne.dossier}</p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-texte-discret">
            <Badge>{ligne.demande.famille}</Badge>
            {ligne.controle.note !== null && <Badge ton={Number(ligne.controle.note) >= 80 ? 'vert' : Number(ligne.controle.note) >= 60 ? 'ambre' : 'rouge'}>{Number(ligne.controle.note)} / 100</Badge>}
            {ligne.controle.reprise && <Badge ton="rouge">reprise</Badge>}
            {ligne.controle.bonDuPremierCoup && <Badge ton="vert">bon du premier coup</Badge>}
            <span>tire le {dateHeure(ligne.controle.creeLe)}</span>
          </p>
        </div>
        <Bouton variante={ouvert ? 'lien' : 'contour'} onClick={() => setOuvert((v) => !v)}>
          {ouvert ? 'Fermer' : ligne.controle.note === null ? 'Noter' : 'Modifier la note'}
        </Bouton>
      </div>

      {ouvert && (
        <div className="mt-4 space-y-3 border-t border-ligne pt-4">
          {!criteres.length && <Alerte ton="ambre">Aucune grille rattachee a ce controle.</Alerte>}
          {criteres.map((c) => (
            <div key={c.cle} className="flex flex-wrap items-center gap-3">
              <label htmlFor={`note-${ligne.controle.id}-${c.cle}`} className="min-w-0 flex-1 text-sm">
                {c.libelle} <span className="text-texte-discret">(poids {c.poids})</span>
              </label>
              <input
                id={`note-${ligne.controle.id}-${c.cle}`}
                type="number"
                min={0}
                max={100}
                className="champ w-24"
                value={notes[c.cle] ?? ''}
                onChange={(e) => setNotes({ ...notes, [c.cle]: Number(e.target.value) })}
              />
            </div>
          ))}
          <div className="flex flex-wrap gap-4">
            <Case libelle="Le document a du etre repris" checked={reprise} onChange={(e) => setReprise(e.target.checked)} />
            <Case libelle="Valide par la DO sans correction" checked={bon === true} onChange={(e) => setBon(e.target.checked ? true : false)} />
          </div>
          <ChampZone libelle="Commentaire" value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />
          <Bouton variante="plein" chargement={enregistrer.isPending} onClick={() => enregistrer.mutate()}>
            Enregistrer la note
          </Bouton>
        </div>
      )}
    </li>
  );
}

export default function Qualite() {
  const { peut } = useAuth();
  const notifier = useNotifier();
  const client = useQueryClient();
  const [onglet, setOnglet] = useState<'echantillon' | 'indicateurs'>('echantillon');
  const [compteId, setCompteId] = useState('');
  const [semaine, setSemaine] = useState(semaineCourante());

  const { data: comptes } = useQuery({ queryKey: ['comptes'], queryFn: () => api.get<Compte[]>('/api/comptes') });
  useEffect(() => {
    if (!compteId && comptes?.length === 1) setCompteId(String(comptes[0].id));
  }, [comptes, compteId]);

  const { data: echantillon, isLoading } = useQuery({
    queryKey: ['qualite', 'echantillon', compteId, semaine],
    queryFn: () => api.get<{ semaine: string; controles: LigneControle[] }>(`/api/qualite/echantillon?${new URLSearchParams({ ...(compteId ? { compteId } : {}), semaine })}`),
  });

  const { data: indicateurs } = useQuery({
    queryKey: ['qualite', 'indicateurs', compteId],
    queryFn: () => api.get<Indicateurs>(`/api/qualite/indicateurs?${new URLSearchParams({ ...(compteId ? { compteId } : {}), jours: '30' })}`),
  });

  const tirer = useMutation({
    mutationFn: () => api.post('/api/qualite/echantillon', { compteId: Number(compteId), semaine }),
    onSuccess: (r: { envois: number; tires: number; deja: number }) => {
      notifier(r.tires ? `${r.tires} envoi(s) tire(s) sur ${r.envois}` : `Echantillon deja complet (${r.deja} controle(s))`);
      client.invalidateQueries({ queryKey: ['qualite'] });
    },
    onError: (e) => notifier(messageErreur(e), 'rouge'),
  });

  const pourcentage = (v: number | null) => (v === null ? 'non mesure' : `${Math.round(v * 100)} %`);

  return (
    <>
      <EntetePage
        titre="Qualite"
        description="Echantillon hebdomadaire des envois du poste, note sur une grille ponderee. Les non-conformites relevees aux check-lists avant envoi alimentent les memes indicateurs."
        actions={
          peut('admin', 'manager') && (
            <Bouton variante="plein" disabled={!compteId} chargement={tirer.isPending} onClick={() => tirer.mutate()}>
              Tirer l&rsquo;echantillon de la semaine
            </Bouton>
          )
        }
      />

      <Carte className="mb-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <ChampSelect libelle="Compte client" value={compteId} onChange={(e) => setCompteId(e.target.value)}>
            <option value="">Tous mes comptes</option>
            {comptes?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </ChampSelect>
          <ChampTexte libelle="Semaine (AAAA-Www)" value={semaine} onChange={(e) => setSemaine(e.target.value)} pattern="\d{4}-W\d{2}" />
        </div>
      </Carte>

      <Onglets
        actif={onglet}
        onChange={setOnglet}
        prefixe="qualite"
        libelle="Sections de la qualite"
        onglets={[
          { id: 'echantillon', libelle: `Echantillon (${echantillon?.controles.length ?? 0})` },
          { id: 'indicateurs', libelle: 'Indicateurs' },
        ]}
      />

      {onglet === 'echantillon' && (
        <Panneau prefixe="qualite" id="echantillon">
          {isLoading ? (
            <Chargement />
          ) : !echantillon?.controles.length ? (
            <Vide>
              Aucun controle tire pour la semaine {semaine}. Utilisez le bouton de tirage : la part des envois controlee se regle dans les
              Parametres.
            </Vide>
          ) : (
            <ul className="space-y-3">
              {echantillon.controles.map((l) => (
                <Notation key={l.controle.id} ligne={l} onEnregistre={() => client.invalidateQueries({ queryKey: ['qualite'] })} />
              ))}
            </ul>
          )}
        </Panneau>
      )}

      {onglet === 'indicateurs' && (
        <Panneau prefixe="qualite" id="indicateurs">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Indicateur libelle="Note moyenne" valeur={indicateurs?.noteMoyenne === null || indicateurs === undefined ? 'non mesure' : `${indicateurs.noteMoyenne} / 100`} detail={`${indicateurs?.notes ?? 0} controle(s) note(s)`} />
              <Indicateur libelle="Taux de reprise" valeur={pourcentage(indicateurs?.tauxReprise ?? null)} detail="sur 30 jours" />
              <Indicateur libelle="Bon du premier coup" valeur={pourcentage(indicateurs?.bonDuPremierCoup ?? null)} detail="valide par la DO sans correction" />
              <Indicateur libelle="Envois conformes" valeur={pourcentage(indicateurs?.tauxConformite ?? null)} detail={`${indicateurs?.envoisControles ?? 0} check-list(s) remplie(s)`} />
            </div>

            <Carte titre="Points de check-list les plus manques" id="points-manques">
              {!indicateurs?.pointsManques.length ? (
                <Vide>Aucun point obligatoire manque sur la periode.</Vide>
              ) : (
                <ul className="space-y-2 text-sm">
                  {indicateurs.pointsManques.map((p) => (
                    <li key={p.cle} className="flex items-center justify-between gap-3 border-b border-ligne pb-2">
                      <span>{p.libelle}</span>
                      <Badge ton="ambre">{p.manques} fois</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Carte>
          </div>
        </Panneau>
      )}
    </>
  );
}
