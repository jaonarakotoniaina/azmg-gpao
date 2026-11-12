import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, messageErreur } from '../lib/api';
import { useAuth } from '../lib/auth';
import { dateHeure } from '../lib/format';
import { Alerte, Badge, Bouton, Carte, ChampSelect, Chargement, EntetePage, Indicateur, Vide, useNotifier } from '../composants/ui';

interface Compte {
  id: number;
  nom: string;
}

interface DossierTrouve {
  id: number;
  libelle: string;
}

interface Bilan {
  lus: number;
  crees: number;
  doublons: number;
  ignores: number;
  horsPerimetre: number;
  aClasser: number;
  piecesRangees: number;
  erreurs: { messageId: string; raison: string }[];
}

interface Etat {
  mode: 'apps_script' | 'imap' | 'mock';
  webhookConfigure: boolean;
  dernierePasse: { le: string; bilan: Bilan } | null;
}

const LIBELLES_MODE: Record<Etat['mode'], string> = {
  apps_script: 'webhook Google Apps Script',
  imap: 'relevage IMAP',
  mock: 'simule, aucune collecte automatique',
};

export default function ImportMails() {
  const { peut } = useAuth();
  const notifier = useNotifier();
  const client = useQueryClient();
  const champFichiers = useRef<HTMLInputElement>(null);
  const [compteId, setCompteId] = useState('');
  const [dossierId, setDossierId] = useState('');
  const [fichiers, setFichiers] = useState<FileList | null>(null);
  const [bilan, setBilan] = useState<Bilan | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const { data: comptes } = useQuery({ queryKey: ['comptes'], queryFn: () => api.get<Compte[]>('/api/comptes') });
  const { data: etat } = useQuery({ queryKey: ['collecte', 'etat'], queryFn: () => api.get<Etat>('/api/collecte/etat') });
  const { data: dossiers } = useQuery({
    queryKey: ['dossiers', 'import-mails', compteId],
    queryFn: () => api.get<DossierTrouve[]>(`/api/dossiers?compteId=${compteId}&limite=50`),
    enabled: Boolean(compteId),
  });

  useEffect(() => {
    if (!compteId && comptes?.length === 1) setCompteId(String(comptes[0].id));
  }, [comptes, compteId]);

  const importer = useMutation({
    mutationFn: () => {
      const corps = new FormData();
      for (const fichier of Array.from(fichiers ?? [])) corps.append('fichiers', fichier);
      corps.append('compteId', compteId);
      if (dossierId) corps.append('dossierId', dossierId);
      return api.post<{ bilan: Bilan; illisibles: { fichier: string; raison: string }[] }>('/api/collecte/import', corps);
    },
    onSuccess: (r) => {
      setBilan(r.bilan);
      setFichiers(null);
      if (champFichiers.current) champFichiers.current.value = '';
      notifier(`${r.bilan.crees} message(s) enregistre(s), ${r.bilan.doublons} deja connu(s)`);
      client.invalidateQueries();
    },
    onError: (e) => setErreur(messageErreur(e)),
  });

  const relever = useMutation({
    mutationFn: () => api.post<{ bilan: Bilan }>('/api/collecte/relever', { compteId: Number(compteId) }),
    onSuccess: (r) => {
      setBilan(r.bilan);
      notifier(`${r.bilan.crees} message(s) releve(s)`);
      client.invalidateQueries();
    },
    onError: (e) => setErreur(messageErreur(e)),
  });

  return (
    <>
      <EntetePage
        titre="Import des mails"
        description="Reprend l’historique de la boite de suivi a partir de fichiers .eml ou .mbox. Un fil importe deux fois ne cree aucun doublon : le dedoublonnage se fait sur l’identifiant du message."
      />

      {etat && (
        <Alerte ton={etat.mode === 'mock' ? 'ambre' : 'bleu'}>
          Collecte automatique : <strong>{LIBELLES_MODE[etat.mode]}</strong>.{' '}
          {etat.mode === 'mock'
            ? "Renseignez APPS_SCRIPT_SECRET ou les variables IMAP_* pour l’activer. En attendant, l’import de fichiers ci-dessous fonctionne."
            : 'Les nouveaux messages arrivent tout seuls ; cet ecran sert a reprendre l’historique.'}
        </Alerte>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Carte titre="Importer des fichiers" id="import">
          <div className="space-y-4">
            {erreur && <Alerte>{erreur}</Alerte>}
            <ChampSelect libelle="Compte client" value={compteId} onChange={(e) => setCompteId(e.target.value)} required>
              <option value="">Choisir un compte</option>
              {comptes?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </ChampSelect>

            <ChampSelect
              libelle="Dossier de rattachement"
              value={dossierId}
              onChange={(e) => setDossierId(e.target.value)}
              aide="Facultatif. Sans dossier, chaque message rejoint son fil, ou ouvre un dossier a reclasser."
            >
              <option value="">deduit du fil</option>
              {dossiers?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.libelle}
                </option>
              ))}
            </ChampSelect>

            <div>
              <label htmlFor="fichiers-mails" className="etiquette">
                Fichiers .eml ou .mbox
              </label>
              <input
                ref={champFichiers}
                id="fichiers-mails"
                type="file"
                accept=".eml,.mbox"
                multiple
                className="champ"
                onChange={(e) => {
                  setErreur(null);
                  setFichiers(e.target.files);
                }}
              />
              <span className="aide">
                Un export Google Takeout de la boite de suivi convient directement. Les pieces jointes sont rangees hors du dossier
                public et servies par une route authentifiee.
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Bouton variante="plein" disabled={!fichiers?.length || !compteId} chargement={importer.isPending} onClick={() => importer.mutate()}>
                Importer
              </Bouton>
              {peut('admin', 'manager') && etat?.mode === 'imap' && (
                <Bouton variante="contour" disabled={!compteId} chargement={relever.isPending} onClick={() => relever.mutate()}>
                  Relever la boite maintenant
                </Bouton>
              )}
            </div>
          </div>
        </Carte>

        <Carte titre="Bilan" id="bilan">
          {!bilan ? (
            <Vide>Aucun import lance dans cette session.</Vide>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Indicateur libelle="Messages lus" valeur={bilan.lus} />
                <Indicateur libelle="Enregistres" valeur={bilan.crees} />
                <Indicateur libelle="Deja connus" valeur={bilan.doublons} detail="le dedoublonnage a joue" />
                <Indicateur libelle="Pieces jointes" valeur={bilan.piecesRangees} />
              </div>
              <ul className="space-y-1 text-sm">
                <li className="flex items-center justify-between gap-3">
                  <span>Adresses a ne pas suivre, non collectes</span>
                  <Badge>{bilan.ignores}</Badge>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span>Hors perimetre, ecartes du pilotage</span>
                  <Badge>{bilan.horsPerimetre}</Badge>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span>
                    A classer, <Link to="/a-classer">a relire</Link>
                  </span>
                  <Badge ton={bilan.aClasser ? 'ambre' : 'neutre'}>{bilan.aClasser}</Badge>
                </li>
              </ul>
              {bilan.erreurs.length > 0 && (
                <Alerte ton="ambre">
                  <p className="font-medium">Messages non enregistres</p>
                  <ul className="mt-1 list-disc pl-5">
                    {bilan.erreurs.slice(0, 10).map((e) => (
                      <li key={e.messageId}>
                        {e.messageId} : {e.raison}
                      </li>
                    ))}
                  </ul>
                </Alerte>
              )}
            </div>
          )}
        </Carte>
      </div>

      {etat?.dernierePasse && (
        <Carte titre="Dernier passage de la collecte" id="derniere-passe" className="mt-6">
          <p className="text-sm text-texte-doux">
            {dateHeure(etat.dernierePasse.le)} : {etat.dernierePasse.bilan?.crees ?? 0} message(s) enregistre(s),{' '}
            {etat.dernierePasse.bilan?.doublons ?? 0} deja connu(s).
          </p>
        </Carte>
      )}

      {!etat && <Chargement />}
    </>
  );
}
