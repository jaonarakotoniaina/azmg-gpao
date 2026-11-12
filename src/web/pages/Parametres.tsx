import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, messageErreur } from '../lib/api';
import { useAuth } from '../lib/auth';
import { libelleActeur, libelleReporting } from '../lib/format';
import { Alerte, Badge, Bouton, Carte, ChampTexte, Chargement, EntetePage, Interrupteur, Onglets, Panneau, Vide, useNotifier } from '../composants/ui';
import { AUTOMATISATIONS, type Parametres as ParametresType } from '@shared/parametres';
import { DEFINITIONS_NATURES, DEFINITIONS_STATUTS, FAMILLES, LIBELLES_ROLES, type Role } from '@shared/constantes';

interface Reponse {
  parametres: ParametresType;
  integrationsSimulees: string[];
  perimetre: { comptes: number[] | null; postes: number[]; lectureSeule: boolean };
}

interface CompteClient {
  id: number;
  nom: string;
  donneurOrdreNom: string | null;
  donneurOrdreEmail: string | null;
  adressesIgnorees: string[];
}

interface PosteClient {
  id: number;
  compteId: number;
  compte: string;
  intitule: string;
  collaborateur: string | null;
  metier: string;
  adresses: string[];
  familles: string[];
  actif: boolean;
}

interface Utilisateur {
  id: number;
  email: string;
  nom: string;
  role: Role;
  actif: boolean;
  derniereConnexionLe: string | null;
}

export default function Parametres() {
  const { peut } = useAuth();
  const notifier = useNotifier();
  const client = useQueryClient();
  const [onglet, setOnglet] = useState<'referentiels' | 'delais' | 'automatisations' | 'comptes' | 'equipe'>('referentiels');
  /** Saisie en cours : adresse de la DO par compte, adresses par poste. */
  const [adresseDo, setAdresseDo] = useState<Record<number, string>>({});
  const [adressesIgnorees, setAdressesIgnorees] = useState<Record<number, string>>({});
  const [adressesPoste, setAdressesPoste] = useState<Record<number, string>>({});
  const [brouillon, setBrouillon] = useState<ParametresType | null>(null);

  const { data, isLoading, error } = useQuery({ queryKey: ['parametres'], queryFn: () => api.get<Reponse>('/api/parametres') });
  const { data: comptes } = useQuery({
    queryKey: ['comptes-clients'],
    queryFn: () => api.get<CompteClient[]>('/api/comptes'),
    enabled: peut('admin', 'manager'),
  });
  const { data: postes } = useQuery({
    queryKey: ['postes'],
    queryFn: () => api.get<PosteClient[]>('/api/postes'),
    enabled: peut('admin', 'manager'),
  });
  const { data: equipe } = useQuery({
    queryKey: ['utilisateurs'],
    queryFn: () => api.get<Utilisateur[]>('/api/utilisateurs'),
    enabled: peut('admin', 'manager'),
  });

  useEffect(() => {
    if (data?.parametres && !brouillon) setBrouillon(structuredClone(data.parametres));
  }, [data, brouillon]);

  const enregistrerCompte = useMutation({
    mutationFn: (v: { id: number; donneurOrdreEmail: string | null; adressesIgnorees: string[] }) =>
      api.patch(`/api/comptes/${v.id}`, { donneurOrdreEmail: v.donneurOrdreEmail, adressesIgnorees: v.adressesIgnorees }),
    onSuccess: (_r, v) => {
      notifier('Compte enregistre');
      setAdresseDo((a) => {
        const suite = { ...a };
        delete suite[v.id];
        return suite;
      });
      setAdressesIgnorees((a) => {
        const suite = { ...a };
        delete suite[v.id];
        return suite;
      });
      void client.invalidateQueries({ queryKey: ['comptes-clients'] });
    },
    onError: (e) => notifier(messageErreur(e), 'rouge'),
  });

  const enregistrerPoste = useMutation({
    mutationFn: (v: { id: number; adresses: string[] }) => api.patch(`/api/postes/${v.id}`, { adresses: v.adresses }),
    onSuccess: (_r, v) => {
      notifier('Adresses du poste enregistrees');
      setAdressesPoste((a) => {
        const suite = { ...a };
        delete suite[v.id];
        return suite;
      });
      void client.invalidateQueries({ queryKey: ['postes'] });
    },
    onError: (e) => notifier(messageErreur(e), 'rouge'),
  });

  const enregistrer = useMutation({
    mutationFn: () => api.put('/api/parametres', brouillon),
    onSuccess: () => {
      notifier('Parametres enregistres');
      client.invalidateQueries({ queryKey: ['parametres'] });
      setBrouillon(null);
    },
    onError: (e) => notifier(messageErreur(e), 'rouge'),
  });

  if (error) return <Alerte>{messageErreur(error)}</Alerte>;
  if (isLoading || !data || !brouillon) return <Chargement texte="Chargement des parametres" />;

  const admin = peut('admin');
  const modifie = JSON.stringify(brouillon) !== JSON.stringify(data.parametres);

  return (
    <>
      <EntetePage
        titre="Parametres"
        description="Referentiels, delais cibles, horaires ouvres du client et modes d’automatisation. Seul un administrateur peut enregistrer."
        actions={
          admin && (
            <Bouton variante="plein" disabled={!modifie} chargement={enregistrer.isPending} onClick={() => enregistrer.mutate()}>
              Enregistrer
            </Bouton>
          )
        }
      />

      {data.integrationsSimulees.length > 0 && (
        <Alerte ton="bleu">
          <p className="font-medium">Integrations en mode simule</p>
          <ul className="mt-1 list-disc pl-5">
            {data.integrationsSimulees.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
          <p className="mt-1">L&rsquo;application fonctionne entierement. Les elements a fournir sont listes dans docs/A_FOURNIR.md.</p>
        </Alerte>
      )}

      <div className="mt-6">
        <Onglets
          actif={onglet}
          onChange={setOnglet}
          prefixe="parametres"
          libelle="Sections des parametres"
          onglets={[
            { id: 'referentiels', libelle: 'Referentiels' },
            { id: 'delais', libelle: 'Delais et horaires' },
            { id: 'automatisations', libelle: 'Automatisations' },
            { id: 'comptes', libelle: 'Comptes clients' },
            { id: 'equipe', libelle: 'Equipe' },
          ]}
        />
      </div>

      {onglet === 'referentiels' && (
        <Panneau prefixe="parametres" id="referentiels">
        <div className="space-y-4">
          <Carte titre="Familles de demandes" id="familles">
            <p className="mb-3 text-sm text-texte-doux">
              Issues de l&rsquo;audit du poste. La famille T00 est hors perimetre : un evenement ainsi classe est trace mais
              n&rsquo;apparait dans aucune vue de pilotage ni aucun export.
            </p>
            <div className="overflow-x-auto">
              <table className="tableau">
                <caption className="sr-only">Familles de demandes</caption>
                <thead>
                  <tr>
                    <th scope="col">Code</th>
                    <th scope="col">Famille</th>
                    <th scope="col">Validation humaine</th>
                    <th scope="col">Temps standard</th>
                    <th scope="col">Delai cible</th>
                  </tr>
                </thead>
                <tbody>
                  {FAMILLES.map((f) => (
                    <tr key={f.code}>
                      <td>
                        {f.code} {f.horsPerimetre && <Badge ton="neutre">hors perimetre</Badge>}
                      </td>
                      <td>{f.libelle}</td>
                      <td className="text-texte-doux">{f.validation}</td>
                      <td>{f.tempsStandardMinutes ? `${f.tempsStandardMinutes} min` : ''}</td>
                      <td>
                        {admin && !f.horsPerimetre ? (
                          <input
                            type="number"
                            min={0}
                            max={400}
                            step={1}
                            className="champ w-24"
                            aria-label={`Delai cible de la famille ${f.code}, en heures ouvrees`}
                            value={brouillon.sla.parFamille[f.code] ?? 0}
                            onChange={(e) =>
                              setBrouillon({
                                ...brouillon,
                                sla: { ...brouillon.sla, parFamille: { ...brouillon.sla.parFamille, [f.code]: Number(e.target.value) } },
                              })
                            }
                          />
                        ) : (
                          <span>{f.horsPerimetre ? '' : `${brouillon.sla.parFamille[f.code] ?? 0} h`}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Carte>

          <Carte titre="Statuts et correspondance reporting" id="statuts">
            <div className="overflow-x-auto">
              <table className="tableau">
                <caption className="sr-only">Statuts de demande</caption>
                <thead>
                  <tr>
                    <th scope="col">Statut GPAO</th>
                    <th scope="col">Statut reporting client</th>
                    <th scope="col">Acteur attendu</th>
                    <th scope="col">Chrono</th>
                  </tr>
                </thead>
                <tbody>
                  {DEFINITIONS_STATUTS.map((s) => (
                    <tr key={s.code}>
                      <td>{s.libelle}</td>
                      <td>{libelleReporting(s.code)}</td>
                      <td>{libelleActeur(s.acteur)}</td>
                      <td className="text-texte-doux">{s.fermee ? 'arrete' : 'en cours'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Carte>

          <Carte titre="Natures d&rsquo;evenement et effet sur la demande" id="natures">
            <div className="overflow-x-auto">
              <table className="tableau">
                <caption className="sr-only">Natures d&rsquo;evenement</caption>
                <thead>
                  <tr>
                    <th scope="col">Nature</th>
                    <th scope="col">Sens</th>
                    <th scope="col">Effet</th>
                  </tr>
                </thead>
                <tbody>
                  {DEFINITIONS_NATURES.map((n) => (
                    <tr key={n.code}>
                      <td>{n.libelle}</td>
                      <td className="text-texte-doux">{n.sens ? n.sens.join(', ') : 'tous'}</td>
                      <td>{n.effet}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Carte>
        </div>
        </Panneau>
      )}

      {onglet === 'delais' && (
        <Panneau prefixe="parametres" id="delais">
        <div className="space-y-4">
          <Carte titre="Horaires ouvres du client" id="horaires">
            <p className="mb-3 text-sm text-texte-doux">
              Tous les delais de la GPAO sont comptes dans ces heures. Fuseau : {brouillon.horaires.fuseau}. Regle du compte :
              les feries du pays du collaborateur sont{' '}
              {brouillon.horaires.feriesCollaborateur ? 'chomes' : 'travailles'}, les feries du pays du client ne le sont jamais.
            </p>
            <ul className="space-y-1 text-sm">
              {(['1', '2', '3', '4', '5', '6', '7'] as const).map((j, i) => {
                const plages = (brouillon.horaires.semaine as Record<string, { debut: string; fin: string }[]>)[j] ?? [];
                const nom = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'][i];
                return (
                  <li key={j} className="flex items-center justify-between gap-3 border-b border-ligne pb-1">
                    <span className="capitalize">{nom}</span>
                    <span className="text-texte-doux">
                      {plages.length ? plages.map((p) => `${p.debut} a ${p.fin}`).join(', ') : 'non travaille'}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-texte-discret">
              {brouillon.horaires.feriesClient.length} jour(s) ferie(s) du client et {brouillon.horaires.feriesLocaux.length} ferie(s)
              locaux sont enregistres. La modification des plages et des calendriers se fait pour l&rsquo;instant en base ou par
              l&rsquo;API des parametres.
            </p>
          </Carte>

          <Carte titre="Delais et relances" id="delais">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ChampTexte
                libelle="Attente DO signalee au-dela de"
                type="number"
                min={1}
                max={400}
                disabled={!admin}
                value={brouillon.sla.attenteDoHeures}
                onChange={(e) => setBrouillon({ ...brouillon, sla: { ...brouillon.sla, attenteDoHeures: Number(e.target.value) } })}
                aide="heures ouvrees"
              />
              {(['n1', 'n2', 'n3'] as const).map((n) => (
                <ChampTexte
                  key={n}
                  libelle={`Relance ${n.toUpperCase()} apres`}
                  type="number"
                  min={1}
                  max={400}
                  disabled={!admin}
                  value={brouillon.sla.relances[n]}
                  onChange={(e) =>
                    setBrouillon({ ...brouillon, sla: { ...brouillon.sla, relances: { ...brouillon.sla.relances, [n]: Number(e.target.value) } } })
                  }
                  aide="heures ouvrees"
                />
              ))}
              <ChampTexte
                libelle="Heure de preparation du daily"
                type="number"
                min={0}
                max={23}
                disabled={!admin}
                value={brouillon.heureDaily}
                onChange={(e) => setBrouillon({ ...brouillon, heureDaily: Number(e.target.value) })}
                aide="heure d&rsquo;Antananarivo"
              />
              <ChampTexte
                libelle="Seuil de confiance du typage"
                type="number"
                min={0}
                max={1}
                step={0.05}
                disabled={!admin}
                value={brouillon.seuilConfianceTypage}
                onChange={(e) => setBrouillon({ ...brouillon, seuilConfianceTypage: Number(e.target.value) })}
                aide="en dessous, la file « A classer »"
              />
              <ChampTexte
                libelle="Part des envois controlee"
                type="number"
                min={0}
                max={1}
                step={0.05}
                disabled={!admin}
                value={brouillon.qualite.tauxEchantillon}
                onChange={(e) => setBrouillon({ ...brouillon, qualite: { tauxEchantillon: Number(e.target.value) } })}
                aide="echantillon qualite hebdomadaire"
              />
            </div>
          </Carte>
        </div>
        </Panneau>
      )}

      {onglet === 'automatisations' && (
        <Panneau prefixe="parametres" id="automatisations">
        <Carte titre="Modes d&rsquo;automatisation" id="automatisations">
          <Alerte ton="bleu">
            Regle d&rsquo;or : l&rsquo;IA prepare, l&rsquo;humain envoie. Aucun mail ne part automatiquement vers un client, un
            transitaire ou la DO. Le mode « auto » prepare un brouillon pret a relire, il n&rsquo;envoie rien.
          </Alerte>
          <div className="mt-4 flex items-center justify-between gap-3 border-b border-ligne pb-3">
            <div>
              <p className="font-medium">Interrupteur general</p>
              <p className="text-sm text-texte-doux">Coupe toute preparation automatique.</p>
            </div>
            <Interrupteur
              libelle="Pause des automatisations"
              desactive={!admin}
              actif={brouillon.pauseAutomatisations}
              onChange={(v) => setBrouillon({ ...brouillon, pauseAutomatisations: v })}
            />
          </div>
          <ul className="mt-3 space-y-3">
            {AUTOMATISATIONS.map((a) => {
              const etat = brouillon.automatisations[a.cle] ?? { mode: a.defaut, actif: true };
              return (
                <li key={a.cle} className="flex flex-wrap items-center justify-between gap-3 border-b border-ligne pb-3">
                  <span className="min-w-0">
                    <span className="block font-medium">{a.libelle}</span>
                    <span className="text-sm text-texte-doux">mode : {etat.mode}</span>
                  </span>
                  <Interrupteur
                    libelle={a.libelle}
                    desactive={!admin || brouillon.pauseAutomatisations}
                    actif={etat.actif && !brouillon.pauseAutomatisations}
                    onChange={(v) =>
                      setBrouillon({ ...brouillon, automatisations: { ...brouillon.automatisations, [a.cle]: { ...etat, actif: v } } })
                    }
                  />
                </li>
              );
            })}
          </ul>
        </Carte>
        </Panneau>
      )}

      {onglet === 'comptes' && (
        <Panneau prefixe="parametres" id="comptes">
        <Carte titre="Adresses des comptes et des postes" id="comptes">
          {!peut('admin', 'manager') ? (
            <Vide>Seuls un administrateur et un manager voient les comptes clients.</Vide>
          ) : !comptes?.length || !postes ? (
            <Chargement />
          ) : (
            <>
              <Alerte ton="bleu">
                Un collaborateur ecrit souvent depuis une adresse du client, sur le meme domaine que la donneuse d&rsquo;ordre. Ces
                adresses servent a deux choses : dire si un message part ou arrive, et dire a quel poste il appartient quand le compte
                en porte plusieurs. Sans elles, un mail parti du poste est lu comme un mail recu, et une demande de validation ne passe
                jamais en attente DO.
              </Alerte>
              <ul className="mt-4 space-y-6">
                {comptes.map((c) => {
                  const saisieDo = adresseDo[c.id] ?? c.donneurOrdreEmail ?? '';
                  const saisieIgnorees = adressesIgnorees[c.id] ?? c.adressesIgnorees.join(', ');
                  const modifieCompte = saisieDo !== (c.donneurOrdreEmail ?? '') || saisieIgnorees !== c.adressesIgnorees.join(', ');
                  const postesDuCompte = postes.filter((p) => p.compteId === c.id && p.actif);
                  return (
                    <li key={c.id} className="border-b border-ligne pb-6 last:border-0">
                      <p className="font-medium">{c.nom}</p>
                      <form
                        className="mt-2 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                        onSubmit={(e) => {
                          e.preventDefault();
                          enregistrerCompte.mutate({
                            id: c.id,
                            donneurOrdreEmail: saisieDo.trim() || null,
                            adressesIgnorees: saisieIgnorees
                              .split(',')
                              .map((a) => a.trim())
                              .filter(Boolean),
                          });
                        }}
                      >
                        <ChampTexte
                          libelle="Adresse de la donneuse d’ordre"
                          aide={c.donneurOrdreNom ? `Actuellement : ${c.donneurOrdreNom}` : 'Seule autorite de validation du compte'}
                          value={saisieDo}
                          onChange={(e) => setAdresseDo((a) => ({ ...a, [c.id]: e.target.value }))}
                        />
                        <ChampTexte
                          libelle="Adresses a ne pas suivre"
                          aide="Leurs messages ne sont pas collectes. Separees par des virgules"
                          value={saisieIgnorees}
                          onChange={(e) => setAdressesIgnorees((a) => ({ ...a, [c.id]: e.target.value }))}
                        />
                        <Bouton type="submit" disabled={!modifieCompte} chargement={enregistrerCompte.isPending}>
                          Enregistrer
                        </Bouton>
                      </form>

                      {!postesDuCompte.length ? (
                        <p className="aide mt-3">Aucun poste actif sur ce compte.</p>
                      ) : (
                        <ul className="mt-4 space-y-3 pl-4 border-l border-ligne">
                          {postesDuCompte.map((p) => {
                            const saisie = adressesPoste[p.id] ?? p.adresses.join(', ');
                            return (
                              <li key={p.id}>
                                <p className="text-sm">
                                  {p.intitule}
                                  {p.collaborateur && <span className="text-texte-doux"> ({p.collaborateur})</span>}{' '}
                                  <Badge>{p.familles.length} famille(s)</Badge>
                                </p>
                                <form
                                  className="mt-1 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    enregistrerPoste.mutate({
                                      id: p.id,
                                      adresses: saisie
                                        .split(',')
                                        .map((a) => a.trim())
                                        .filter(Boolean),
                                    });
                                  }}
                                >
                                  <ChampTexte
                                    libelle={`Adresses du poste « ${p.intitule} »`}
                                    aide="Separees par des virgules"
                                    value={saisie}
                                    onChange={(e) => setAdressesPoste((a) => ({ ...a, [p.id]: e.target.value }))}
                                  />
                                  <Bouton
                                    type="submit"
                                    disabled={saisie === p.adresses.join(', ')}
                                    chargement={enregistrerPoste.isPending}
                                  >
                                    Enregistrer
                                  </Bouton>
                                </form>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Carte>
        </Panneau>
      )}

      {onglet === 'equipe' && (
        <Panneau prefixe="parametres" id="equipe">
        <Carte titre="Comptes utilisateurs" id="equipe">
          {!peut('admin', 'manager') ? (
            <Vide>Seuls un administrateur et un manager voient la liste des comptes.</Vide>
          ) : !equipe?.length ? (
            <Chargement />
          ) : (
            <div className="overflow-x-auto">
              <table className="tableau">
                <caption className="sr-only">Comptes utilisateurs</caption>
                <thead>
                  <tr>
                    <th scope="col">Nom</th>
                    <th scope="col">Email</th>
                    <th scope="col">Role</th>
                    <th scope="col">Etat</th>
                  </tr>
                </thead>
                <tbody>
                  {equipe.map((u) => (
                    <tr key={u.id}>
                      <td>{u.nom}</td>
                      <td>{u.email}</td>
                      <td>{LIBELLES_ROLES[u.role]}</td>
                      <td>{u.actif ? <Badge ton="vert">actif</Badge> : <Badge ton="neutre">desactive</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Carte>
        </Panneau>
      )}
    </>
  );
}
