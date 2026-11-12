import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Copy } from 'lucide-react';
import { api, messageErreur } from '../lib/api';
import { duree } from '../lib/format';
import { Alerte, Badge, Bouton, Carte, ChampSelect, Chargement, EntetePage, Vide, useNotifier } from '../composants/ui';

interface Compte {
  id: number;
  nom: string;
}

interface LigneDigest {
  demandeId: number;
  dossierId: number;
  dossier: string;
  famille: string;
  objet: string;
  decisionAttendue: string;
  minutesAttente: number;
  urgent: boolean;
  elements: { libelle: string; valeur: string }[];
  derniereDemande: string | null;
}

interface Digest {
  compte: string;
  donneurOrdre: string | null;
  moment: 'matin' | 'apres-midi';
  lignes: LigneDigest[];
  brouillon: string;
}

export default function DigestDo() {
  const notifier = useNotifier();
  const [compteId, setCompteId] = useState('');
  const { data: comptes } = useQuery({ queryKey: ['comptes'], queryFn: () => api.get<Compte[]>('/api/comptes') });

  useEffect(() => {
    if (!compteId && comptes?.length === 1) setCompteId(String(comptes[0].id));
  }, [comptes, compteId]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['digest', compteId],
    queryFn: () => api.get<Digest>(`/api/digest/validation-do?compteId=${compteId}`),
    enabled: Boolean(compteId),
  });

  async function copier() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.brouillon);
      notifier('Brouillon copie');
    } catch {
      notifier('Copie impossible : selectionnez le texte et copiez-le a la main', 'rouge');
    }
  }

  return (
    <>
      <EntetePage
        titre="Digest de validation"
        description="Toutes les decisions qui attendent la donneuse d’ordre, avec leur temps d’attente en heures ouvrees. Le texte ci-dessous est un brouillon : rien n’est envoye par l’application."
        actions={
          data && (
            <Bouton variante="plein" icone={<Copy className="h-4 w-4" aria-hidden />} onClick={copier}>
              Copier le brouillon
            </Bouton>
          )
        }
      />

      <Alerte ton="bleu">
        Regle d&rsquo;or : l&rsquo;IA prepare, l&rsquo;humain envoie. Relisez ce texte, puis envoyez-le vous-meme par le canal habituel.
      </Alerte>

      <Carte className="my-6">
        <ChampSelect libelle="Compte client" value={compteId} onChange={(e) => setCompteId(e.target.value)}>
          <option value="">Choisir un compte</option>
          {comptes?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}
            </option>
          ))}
        </ChampSelect>
      </Carte>

      {error && <Alerte>{messageErreur(error)}</Alerte>}
      {!compteId ? (
        <Vide>Choisissez un compte client.</Vide>
      ) : isLoading ? (
        <Chargement texte="Preparation du digest" />
      ) : !data ? null : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Carte titre={`Decisions attendues (${data.lignes.length})`} id="decisions">
            {!data.lignes.length ? (
              <Vide>Aucune decision n&rsquo;attend la donneuse d&rsquo;ordre.</Vide>
            ) : (
              <ol className="space-y-3">
                {data.lignes.map((l, i) => (
                  <li key={l.demandeId} className="border-b border-ligne pb-3">
                    <p className="font-medium">
                      {i + 1}. {l.decisionAttendue}
                    </p>
                    <p className="mt-0.5 text-sm">
                      <Link to={`/dossiers/${l.dossierId}`}>{l.dossier}</Link>
                    </p>
                    {l.derniereDemande && <p className="mt-1 text-sm text-texte-doux">{l.derniereDemande}</p>}
                    {l.elements.length > 0 && (
                      <p className="mt-1 text-xs text-texte-discret">
                        {l.elements.map((e) => `${e.libelle} ${e.valeur}`).join(' ; ')}
                      </p>
                    )}
                    <p className="mt-1">
                      <Badge ton={l.urgent ? 'rouge' : 'ambre'}>en attente depuis {duree(l.minutesAttente)}</Badge>{' '}
                      <Link to={`/demandes/${l.demandeId}`} className="text-xs">
                        voir la demande
                      </Link>
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Carte>

          <Carte titre="Brouillon a relire" id="brouillon">
            <label htmlFor="texte-brouillon" className="sr-only">
              Texte du digest
            </label>
            <textarea id="texte-brouillon" className="champ min-h-[420px] font-mono text-xs" readOnly value={data.brouillon} />
            <p className="aide">
              Prepare pour {data.donneurOrdre ?? 'la donneuse d’ordre'}, point du {data.moment}. Aucun envoi automatique.
            </p>
          </Carte>
        </div>
      )}
    </>
  );
}
