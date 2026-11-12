import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, messageErreur } from '../lib/api';
import { useAuth } from '../lib/auth';
import { libelleActeur, libelleReporting } from '../lib/format';
import {
  Alerte,
  Badge,
  Bouton,
  Carte,
  ChampSelect,
  ChampTexte,
  Chargement,
  EntetePage,
  Interrupteur,
  Onglets,
  Panneau,
  Vide,
  useNotifier,
} from '../composants/ui';
import { AUTOMATISATIONS, type Parametres as ParametresType } from '@shared/parametres';
import { DEFINITIONS_NATURES, DEFINITIONS_STATUTS, FAMILLES, LIBELLES_METIERS, LIBELLES_ROLES, type Metier, type Role } from '@shared/constantes';

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
  const { peut, utilisateur } = useAuth();
  const notifier = useNotifier();
  const client = useQueryClient();
  const [onglet, setOnglet] = useState<'referentiels' | 'delais' | 'automatisations' | 'comptes' | 'equipe' | 'mon-compte'>(
    'referentiels',
  );
  const [motDePasse, setMotDePasse] = useState({ actuel: '', nouveau: '', confirmation: '' });
  /** Saisie en cours : adresse de la DO par compte, adresses par poste. */
  const [adresseDo, setAdresseDo] = useState<Record<number, string>>({});
  const [adressesIgnorees, setAdressesIgnorees] = useState<Record<number, string>>({});
  /** Creation d'un compte client et d'un poste, depuis l'onglet « Comptes clients ». */
  const [nouveauCompte, setNouveauCompte] = useState({ nom: '', pays: '', ville: '', donneurOrdreNom: '', donneurOrdreEmail: '' });
  const [nouvelUtilisateur, setNouvelUtilisateur] = useState({ nom: '', email: '', role: 'collaborateur' as Role, motDePasse: '' });
  const [nouveauPoste, setNouveauPoste] = useState<
    Record<number, { intitule: string; metier: Metier; adresses: string; collaborateurId: string }>
  >({});
  const [adressesPoste, setAdressesPoste] = useState<Record<number, string>>({});
  const [brouillon, setBrouillon] = useState<ParametresType | null>(null);

  const { data, isLoading, error } = useQuery({ queryKey: ['parametres'], queryFn: () => api.get<Reponse>('/api/parametres') });
  const {
    data: comptes,
    error: erreurComptes,
    isLoading: chargeComptes,
  } = useQuery({
    queryKey: ['comptes-clients'],
    queryFn: () => api.get<CompteClient[]>('/api/comptes'),
    enabled: peut('admin', 'manager'),
  });
  const {
    data: postes,
    error: erreurPostes,
    isLoading: chargePostes,
  } = useQuery({
    queryKey: ['postes'],
    queryFn: () => api.get<PosteClient[]>('/api/postes'),
    enabled: peut('admin', 'manager'),
  });
  const {
    data: equipe,
    error: erreurEquipe,
    isLoading: chargeEquipe,
  } = useQuery({
    queryKey: ['utilisateurs'],
    queryFn: () => api.get<Utilisateur[]>('/api/utilisateurs'),
    enabled: peut('admin', 'manager'),
  });

  useEffect(() => {
    if (data?.parametres && !brouillon) setBrouillon(structuredClone(data.parametres));
  }, [data, brouillon]);

  const changerMotDePasse = useMutation({
    mutationFn: () => api.post('/api/auth/changer-mot-de-passe', { actuel: motDePasse.actuel, nouveau: motDePasse.nouveau }),
    onSuccess: () => {
      notifier('Mot de passe change');
      setMotDePasse({ actuel: '', nouveau: '', confirmation: '' });
    },
    onError: (e) => notifier(messageErreur(e), 'rouge'),
  });

  const creerUtilisateur = useMutation({
    mutationFn: () =>
      api.post('/api/utilisateurs', {
        nom: nouvelUtilisateur.nom.trim(),
        email: nouvelUtilisateur.email.trim(),
        role: nouvelUtilisateur.role,
        motDePasse: nouvelUtilisateur.motDePasse,
      }),
    onSuccess: () => {
      notifier('Compte utilisateur cree');
      setNouvelUtilisateur({ nom: '', email: '', role: 'collaborateur', motDePasse: '' });
      void client.invalidateQueries({ queryKey: ['utilisateurs'] });
    },
    onError: (e) => notifier(messageErreur(e), 'rouge'),
  });

  const modifierUtilisateur = useMutation({
    mutationFn: (v: { id: number; role?: Role; actif?: boolean }) => {
      const { id, ...modifs } = v;
      return api.patch(`/api/utilisateurs/${id}`, modifs);
    },
    onSuccess: () => {
      notifier('Compte utilisateur mis a jour');
      void client.invalidateQueries({ queryKey: ['utilisateurs'] });
    },
    onError: (e) => notifier(messageErreur(e), 'rouge'),
  });

  const creerCompte = useMutation({
    mutationFn: () =>
      api.post('/api/comptes', {
        nom: nouveauCompte.nom.trim(),
        pays: nouveauCompte.pays.trim() || null,
        ville: nouveauCompte.ville.trim() || null,
        donneurOrdreNom: nouveauCompte.donneurOrdreNom.trim() || null,
        donneurOrdreEmail: nouveauCompte.donneurOrdreEmail.trim() || null,
      }),
    onSuccess: () => {
      notifier('Compte client cree');
      setNouveauCompte({ nom: '', pays: '', ville: '', donneurOrdreNom: '', donneurOrdreEmail: '' });
      void client.invalidateQueries({ queryKey: ['comptes-clients'] });
      void client.invalidateQueries({ queryKey: ['comptes'] });
    },
    onError: (e) => notifier(messageErreur(e), 'rouge'),
  });

  const creerPoste = useMutation({
    mutationFn: (v: { compteId: number; intitule: string; metier: Metier; adresses: string[]; collaborateurId: number | null }) =>
      api.post('/api/postes', v),
    onSuccess: (_r, v) => {
      notifier('Poste cree');
      setNouveauPoste((p) => {
        const suite = { ...p };
        delete suite[v.compteId];
        return suite;
      });
      void client.invalidateQueries({ queryKey: ['postes'] });
    },
    onError: (e) => notifier(messageErreur(e), 'rouge'),
  });

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
            { id: 'mon-compte', libelle: 'Mon compte' },
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
          ) : erreurComptes || erreurPostes ? (
            // Sans ce cas, une erreur de chargement laisse un chargement qui tourne sans fin, et
            // ressemble a une liste vide. L'ecran doit dire ce qui ne va pas.
            <Alerte>{messageErreur(erreurComptes ?? erreurPostes)}</Alerte>
          ) : chargeComptes || chargePostes || !comptes || !postes ? (
            <Chargement />
          ) : (
            <>
              <Alerte ton="bleu">
                Un collaborateur ecrit souvent depuis une adresse du client, sur le meme domaine que la donneuse d&rsquo;ordre. Ces
                adresses servent a deux choses : dire si un message part ou arrive, et dire a quel poste il appartient quand le compte
                en porte plusieurs. Sans elles, un mail parti du poste est lu comme un mail recu, et une demande de validation ne passe
                jamais en attente DO.
              </Alerte>

              {admin && (
                <form
                  className="mt-4 rounded-carte border border-ligne p-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (nouveauCompte.nom.trim()) creerCompte.mutate();
                  }}
                >
                  <p className="font-medium">Nouveau compte client</p>
                  <p className="aide">Le code du compte est derive du nom. Les horaires ouvres suivent les parametres generaux.</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <ChampTexte
                      libelle="Nom du client"
                      required
                      value={nouveauCompte.nom}
                      onChange={(e) => setNouveauCompte((c) => ({ ...c, nom: e.target.value }))}
                    />
                    <ChampTexte
                      libelle="Pays"
                      value={nouveauCompte.pays}
                      onChange={(e) => setNouveauCompte((c) => ({ ...c, pays: e.target.value }))}
                    />
                    <ChampTexte
                      libelle="Ville"
                      value={nouveauCompte.ville}
                      onChange={(e) => setNouveauCompte((c) => ({ ...c, ville: e.target.value }))}
                    />
                    <ChampTexte
                      libelle="Nom de la donneuse d’ordre"
                      value={nouveauCompte.donneurOrdreNom}
                      onChange={(e) => setNouveauCompte((c) => ({ ...c, donneurOrdreNom: e.target.value }))}
                    />
                    <ChampTexte
                      libelle="Adresse de la donneuse d’ordre"
                      type="email"
                      value={nouveauCompte.donneurOrdreEmail}
                      onChange={(e) => setNouveauCompte((c) => ({ ...c, donneurOrdreEmail: e.target.value }))}
                    />
                    <div className="flex items-end">
                      <Bouton type="submit" variante="plein" disabled={!nouveauCompte.nom.trim()} chargement={creerCompte.isPending}>
                        Creer le compte
                      </Bouton>
                    </div>
                  </div>
                </form>
              )}

              {!comptes.length && (
                <Vide>
                  Aucun compte client pour le moment.
                  {admin ? ' Creez le premier avec le formulaire ci-dessus.' : ' Un administrateur doit creer le premier compte.'}
                </Vide>
              )}
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
                        <p className="aide mt-3">Aucun poste actif sur ce compte. Creez-en un ci-dessous.</p>
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

                      <form
                        className="mt-4 grid gap-3 pl-4 border-l border-ligne sm:grid-cols-[1fr_1fr_1fr_1fr_auto] sm:items-end"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const n = nouveauPoste[c.id] ?? { intitule: '', metier: 'export' as Metier, adresses: '', collaborateurId: '' };
                          if (!n.intitule.trim()) return;
                          creerPoste.mutate({
                            compteId: c.id,
                            intitule: n.intitule.trim(),
                            metier: n.metier,
                            collaborateurId: n.collaborateurId ? Number(n.collaborateurId) : null,
                            adresses: n.adresses
                              .split(',')
                              .map((a) => a.trim())
                              .filter(Boolean),
                          });
                        }}
                      >
                        <ChampTexte
                          libelle="Nouveau poste"
                          aide="Intitule, par exemple « Assistante export »"
                          value={nouveauPoste[c.id]?.intitule ?? ''}
                          onChange={(e) =>
                            setNouveauPoste((p) => ({
                              ...p,
                              [c.id]: {
                                ...(p[c.id] ?? { metier: 'export' as Metier, adresses: '', collaborateurId: '' }),
                                intitule: e.target.value,
                              },
                            }))
                          }
                        />
                        <ChampSelect
                          libelle="Metier"
                          aide="Il pre-remplit le perimetre de familles"
                          value={nouveauPoste[c.id]?.metier ?? 'export'}
                          onChange={(e) =>
                            setNouveauPoste((p) => ({
                              ...p,
                              [c.id]: {
                                ...(p[c.id] ?? { intitule: '', adresses: '', collaborateurId: '' }),
                                metier: e.target.value as Metier,
                              },
                            }))
                          }
                        >
                          {Object.entries(LIBELLES_METIERS).map(([cle, libelle]) => (
                            <option key={cle} value={cle}>
                              {libelle}
                            </option>
                          ))}
                        </ChampSelect>
                        <ChampTexte
                          libelle="Adresses du poste"
                          aide="Separees par des virgules"
                          value={nouveauPoste[c.id]?.adresses ?? ''}
                          onChange={(e) =>
                            setNouveauPoste((p) => ({
                              ...p,
                              [c.id]: {
                                ...(p[c.id] ?? { intitule: '', metier: 'export' as Metier, collaborateurId: '' }),
                                adresses: e.target.value,
                              },
                            }))
                          }
                        />
                        <ChampSelect
                          libelle="Collaborateur"
                          aide="Sans rattachement, personne ne voit la file de ce poste"
                          value={nouveauPoste[c.id]?.collaborateurId ?? ''}
                          onChange={(e) =>
                            setNouveauPoste((p) => ({
                              ...p,
                              [c.id]: {
                                ...(p[c.id] ?? { intitule: '', metier: 'export' as Metier, adresses: '' }),
                                collaborateurId: e.target.value,
                              },
                            }))
                          }
                        >
                          <option value="">A rattacher plus tard</option>
                          {equipe
                            ?.filter((u) => u.actif)
                            .map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.nom}
                              </option>
                            ))}
                        </ChampSelect>
                        <Bouton type="submit" disabled={!nouveauPoste[c.id]?.intitule.trim()} chargement={creerPoste.isPending}>
                          Creer le poste
                        </Bouton>
                      </form>
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
          ) : erreurEquipe ? (
            <Alerte>{messageErreur(erreurEquipe)}</Alerte>
          ) : chargeEquipe || !equipe ? (
            <Chargement />
          ) : (
            <>
              {admin && (
                <form
                  className="mb-6 rounded-carte border border-ligne p-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (nouvelUtilisateur.nom.trim() && nouvelUtilisateur.email.trim() && nouvelUtilisateur.motDePasse.length >= 10) {
                      creerUtilisateur.mutate();
                    }
                  }}
                >
                  <p className="font-medium">Nouveau compte utilisateur</p>
                  <p className="aide">
                    Le mot de passe initial est a transmettre par un autre canal que le courriel. Chacun peut le changer ensuite
                    depuis son compte.
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-5 sm:items-end">
                    <ChampTexte
                      libelle="Nom"
                      required
                      value={nouvelUtilisateur.nom}
                      onChange={(e) => setNouvelUtilisateur((u) => ({ ...u, nom: e.target.value }))}
                    />
                    <ChampTexte
                      libelle="Adresse email"
                      type="email"
                      required
                      value={nouvelUtilisateur.email}
                      onChange={(e) => setNouvelUtilisateur((u) => ({ ...u, email: e.target.value }))}
                    />
                    <ChampSelect
                      libelle="Role"
                      value={nouvelUtilisateur.role}
                      onChange={(e) => setNouvelUtilisateur((u) => ({ ...u, role: e.target.value as Role }))}
                    >
                      {Object.entries(LIBELLES_ROLES).map(([cle, libelle]) => (
                        <option key={cle} value={cle}>
                          {libelle}
                        </option>
                      ))}
                    </ChampSelect>
                    <ChampTexte
                      libelle="Mot de passe initial"
                      type="password"
                      required
                      minLength={10}
                      aide="10 caracteres au moins"
                      value={nouvelUtilisateur.motDePasse}
                      onChange={(e) => setNouvelUtilisateur((u) => ({ ...u, motDePasse: e.target.value }))}
                    />
                    <Bouton
                      type="submit"
                      variante="plein"
                      disabled={
                        !nouvelUtilisateur.nom.trim() || !nouvelUtilisateur.email.trim() || nouvelUtilisateur.motDePasse.length < 10
                      }
                      chargement={creerUtilisateur.isPending}
                    >
                      Creer le compte
                    </Bouton>
                  </div>
                </form>
              )}

              {!equipe.length ? (
                <Vide>Aucun compte utilisateur.</Vide>
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
                        {admin && <th scope="col">Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {equipe.map((u) => (
                        <tr key={u.id}>
                          <td>{u.nom}</td>
                          <td>{u.email}</td>
                          <td>
                            {admin && u.id !== utilisateur?.id ? (
                              <>
                                <label className="sr-only" htmlFor={`role-${u.id}`}>
                                  Role de {u.nom}
                                </label>
                                <select
                                  id={`role-${u.id}`}
                                  className="champ"
                                  value={u.role}
                                  onChange={(e) => modifierUtilisateur.mutate({ id: u.id, role: e.target.value as Role })}
                                >
                                  {Object.entries(LIBELLES_ROLES).map(([cle, libelle]) => (
                                    <option key={cle} value={cle}>
                                      {libelle}
                                    </option>
                                  ))}
                                </select>
                              </>
                            ) : (
                              LIBELLES_ROLES[u.role]
                            )}
                          </td>
                          <td>{u.actif ? <Badge ton="vert">actif</Badge> : <Badge ton="neutre">desactive</Badge>}</td>
                          {admin && (
                            <td>
                              {u.id === utilisateur?.id ? (
                                <span className="text-sm text-texte-discret">votre compte</span>
                              ) : (
                                <Bouton
                                  onClick={() => modifierUtilisateur.mutate({ id: u.id, actif: !u.actif })}
                                  chargement={modifierUtilisateur.isPending}
                                >
                                  {u.actif ? 'Desactiver' : 'Reactiver'}
                                </Bouton>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="aide mt-3">
                    Desactiver un compte ferme ses sessions ouvertes. Un administrateur ne peut pas retirer ses propres droits.
                  </p>
                </div>
              )}
            </>
          )}
        </Carte>
        </Panneau>
      )}

      {onglet === 'mon-compte' && (
        <Panneau prefixe="parametres" id="mon-compte">
        <Carte titre="Mon compte" id="mon-compte">
          <p>
            {utilisateur?.nom} ({utilisateur?.email}), {utilisateur ? LIBELLES_ROLES[utilisateur.role] : ''}.
          </p>
          <form
            className="mt-4 grid gap-3 sm:max-w-md"
            onSubmit={(e) => {
              e.preventDefault();
              if (motDePasse.nouveau.length < 10) return;
              if (motDePasse.nouveau !== motDePasse.confirmation) {
                notifier('Les deux mots de passe ne sont pas identiques', 'rouge');
                return;
              }
              changerMotDePasse.mutate();
            }}
          >
            <ChampTexte
              libelle="Mot de passe actuel"
              type="password"
              required
              autoComplete="current-password"
              value={motDePasse.actuel}
              onChange={(e) => setMotDePasse((m) => ({ ...m, actuel: e.target.value }))}
            />
            <ChampTexte
              libelle="Nouveau mot de passe"
              type="password"
              required
              minLength={10}
              autoComplete="new-password"
              aide="10 caracteres au moins"
              value={motDePasse.nouveau}
              onChange={(e) => setMotDePasse((m) => ({ ...m, nouveau: e.target.value }))}
            />
            <ChampTexte
              libelle="Confirmer le nouveau mot de passe"
              type="password"
              required
              autoComplete="new-password"
              erreur={
                motDePasse.confirmation && motDePasse.nouveau !== motDePasse.confirmation
                  ? 'Les deux mots de passe ne sont pas identiques'
                  : undefined
              }
              value={motDePasse.confirmation}
              onChange={(e) => setMotDePasse((m) => ({ ...m, confirmation: e.target.value }))}
            />
            <div>
              <Bouton
                type="submit"
                variante="plein"
                disabled={!motDePasse.actuel || motDePasse.nouveau.length < 10}
                chargement={changerMotDePasse.isPending}
              >
                Changer le mot de passe
              </Bouton>
            </div>
          </form>
        </Carte>
        </Panneau>
      )}
    </>
  );
}
