import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { api, messageErreur } from '../lib/api';
import { jour as formaterJour } from '../lib/format';
import { Alerte, Badge, Bouton, Carte, Case, ChampSelect, Chargement, EntetePage, Indicateur, Vide, useNotifier } from '../composants/ui';

interface Compte {
  id: number;
  nom: string;
}

interface LigneApercu {
  client: string;
  produit: string;
  description: string;
  statut: string;
  livrables: string;
  prioriteLendemain: string;
}

interface Bilan {
  joursEcrits: string[];
  lignesEcrites: number;
  ongletSemaine: string | null;
  coloneesSemaine: number;
  onglets: string[];
}

/** Les sept derniers jours, du plus recent au plus ancien. */
function derniersJours(nombre: number): string[] {
  return Array.from({ length: nombre }, (_, i) => DateTime.now().minus({ days: i }).toISODate()!);
}

export default function Export() {
  const notifier = useNotifier();
  const [compteId, setCompteId] = useState('');
  const [joursChoisis, setJoursChoisis] = useState<string[]>([DateTime.now().toISODate()!]);
  const [ongletSemaine, setOngletSemaine] = useState(false);
  const [fichier, setFichier] = useState<File | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [bilan, setBilan] = useState<Bilan | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const { data: comptes } = useQuery({ queryKey: ['comptes'], queryFn: () => api.get<Compte[]>('/api/comptes') });
  useEffect(() => {
    if (!compteId && comptes?.length === 1) setCompteId(String(comptes[0].id));
  }, [comptes, compteId]);

  const jourApercu = useMemo(() => [...joursChoisis].sort().at(-1) ?? '', [joursChoisis]);
  const { data: apercu, isLoading: chargementApercu } = useQuery({
    queryKey: ['export', 'apercu', compteId, jourApercu],
    queryFn: () => api.get<{ jour: string; lignes: LigneApercu[] }>(`/api/export/apercu?compteId=${compteId}&jour=${jourApercu}`),
    enabled: Boolean(compteId && jourApercu),
  });

  function basculerJour(j: string) {
    setJoursChoisis((liste) => (liste.includes(j) ? liste.filter((x) => x !== j) : [...liste, j]));
  }

  /**
   * L'export renvoie le classeur modifie : on le telecharge directement.
   * Le classeur d'origine n'est ni conserve ni ecrase cote serveur.
   */
  async function exporter() {
    if (!fichier || !compteId || !joursChoisis.length) return;
    setErreur(null);
    setEnvoi(true);
    try {
      const corps = new FormData();
      corps.append('fichier', fichier);
      corps.append('compteId', compteId);
      corps.append('jours', [...joursChoisis].sort().join(','));
      corps.append('ongletSemaine', ongletSemaine ? '1' : '0');

      const csrf = document.cookie.match(/(?:^|; )azmg_gpao_csrf=([^;]*)/)?.[1];
      const r = await fetch('/api/export/reporting', {
        method: 'POST',
        headers: csrf ? { 'x-csrf-token': decodeURIComponent(csrf) } : {},
        credentials: 'same-origin',
        body: corps,
      });
      if (!r.ok) {
        const texte = await r.text();
        throw new Error(JSON.parse(texte || '{}').erreur ?? 'Export impossible');
      }
      const entete = r.headers.get('x-bilan-export');
      if (entete) setBilan(JSON.parse(decodeURIComponent(entete)));

      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const lien = document.createElement('a');
      lien.href = url;
      lien.download = fichier.name.replace(/\.xlsx$/i, '') + '-complete.xlsx';
      lien.click();
      URL.revokeObjectURL(url);
      notifier('Classeur complete et telecharge');
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <>
      <EntetePage
        titre="Export du reporting"
        description="Ecrit les blocs de jour dans votre classeur SUIVI_MENSUEL, a la suite de ce qu’il contient deja. La structure du classeur n’est pas modifiee : colonnes, en-tetes, noms d’onglets, mise en forme et formules ressortent intacts."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Carte titre="1. Ce qu’il faut exporter" id="choix">
          <div className="space-y-4">
            <ChampSelect libelle="Compte client" value={compteId} onChange={(e) => setCompteId(e.target.value)} required>
              <option value="">Choisir un compte</option>
              {comptes?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </ChampSelect>

            <fieldset>
              <legend className="etiquette">Jours a ecrire</legend>
              <div className="space-y-2">
                {derniersJours(10).map((j) => (
                  <Case key={j} libelle={formaterJour(`${j}T12:00:00Z`)} checked={joursChoisis.includes(j)} onChange={() => basculerJour(j)} />
                ))}
              </div>
              <span className="aide">Un bloc par jour sera ajoute : ligne vide, en-tete recopiee, puis les lignes de donnees.</span>
            </fieldset>

            <Case
              libelle="Remplir aussi l&rsquo;onglet de la semaine"
              aide="L&rsquo;onglet « sem N » doit exister dans le classeur, sinon l&rsquo;export s&rsquo;arrete et vous le signale."
              checked={ongletSemaine}
              onChange={(e) => setOngletSemaine(e.target.checked)}
            />
          </div>
        </Carte>

        <Carte titre="2. Votre classeur" id="classeur">
          <div className="space-y-4">
            {erreur && <Alerte>{erreur}</Alerte>}
            <div>
              <label htmlFor="classeur-export" className="etiquette">
                Classeur SUIVI_MENSUEL (.xlsx)
              </label>
              <input
                id="classeur-export"
                type="file"
                accept=".xlsx"
                className="champ"
                onChange={(e) => {
                  setErreur(null);
                  setFichier(e.target.files?.[0] ?? null);
                }}
              />
              <span className="aide">
                Le fichier n&rsquo;est pas conserve sur le serveur. Vous telechargez une copie completee, votre original reste intact.
              </span>
            </div>
            <Bouton variante="plein" disabled={!fichier || !compteId || !joursChoisis.length} chargement={envoi} onClick={exporter}>
              Completer le classeur et le telecharger
            </Bouton>

            {bilan && (
              <div className="space-y-3 border-t border-ligne pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <Indicateur libelle="Jours ecrits" valeur={bilan.joursEcrits.length} />
                  <Indicateur libelle="Lignes ecrites" valeur={bilan.lignesEcrites} />
                </div>
                {bilan.ongletSemaine && (
                  <p className="text-sm text-texte-doux">
                    Onglet <strong>{bilan.ongletSemaine}</strong> : {bilan.coloneesSemaine} colonne(s) remplie(s).
                  </p>
                )}
                <p className="text-xs text-texte-discret">Onglets du classeur : {bilan.onglets.join(', ')}.</p>
              </div>
            )}
          </div>
        </Carte>
      </div>

      <Carte titre={`Apercu du ${apercu?.jour ? formaterJour(`${apercu.jour}T12:00:00Z`) : 'jour choisi'}`} id="apercu" className="mt-6">
        {!compteId ? (
          <Vide>Choisissez un compte client.</Vide>
        ) : chargementApercu ? (
          <Chargement />
        ) : !apercu?.lignes.length ? (
          <Vide>Aucune activite ce jour-la : aucun bloc ne sera ecrit.</Vide>
        ) : (
          <div className="overflow-x-auto">
            <table className="tableau">
              <caption className="sr-only">Lignes qui seront ecrites dans le classeur</caption>
              <thead>
                <tr>
                  <th scope="col">Client ou pays (C)</th>
                  <th scope="col">Produit et reference (F)</th>
                  <th scope="col">Description (G)</th>
                  <th scope="col">Livrables (H)</th>
                  <th scope="col">Priorite du lendemain (I)</th>
                </tr>
              </thead>
              <tbody>
                {apercu.lignes.map((l, i) => (
                  <tr key={i}>
                    <td>{l.client}</td>
                    <td>{l.produit}</td>
                    <td>
                      {l.description}
                      <Badge ton={l.statut === 'Termine' ? 'vert' : l.statut === 'Bloque' ? 'rouge' : 'ambre'}>{l.statut}</Badge>
                    </td>
                    <td>{l.livrables}</td>
                    <td>{l.prioriteLendemain}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Carte>
    </>
  );
}
