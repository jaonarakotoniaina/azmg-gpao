import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { api, messageErreur } from '../lib/api';
import { jour, relatif } from '../lib/format';
import { Alerte, Badge, Carte, ChampSelect, Chargement, EntetePage, Vide } from '../composants/ui';
import { LIBELLES_ECHEANCES, type TypeEcheance } from '@shared/constantes';

interface Compte {
  id: number;
  nom: string;
}

interface LigneEcheance {
  echeance: { id: number; type: TypeEcheance; libelle: string | null; echeanceLe: string; honoreeLe: string | null; annulee: boolean };
  dossierId: number;
  dossier: string;
  client: string;
  compteId: number;
}

export default function Echeancier() {
  const [compteId, setCompteId] = useState('');
  const [jours, setJours] = useState('30');
  const { data: comptes } = useQuery({ queryKey: ['comptes'], queryFn: () => api.get<Compte[]>('/api/comptes') });

  useEffect(() => {
    if (!compteId && comptes?.length === 1) setCompteId(String(comptes[0].id));
  }, [comptes, compteId]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['echeances', compteId, jours],
    queryFn: () => api.get<LigneEcheance[]>(`/api/echeances?${new URLSearchParams({ ...(compteId ? { compteId } : {}), jours })}`),
  });

  const maintenant = DateTime.now();
  const lignes = (data ?? []).filter((l) => !l.echeance.annulee);

  /** Alerte J-2 et J0 : une echeance a moins de deux jours est signalee dans la file. */
  function tonEcheance(l: LigneEcheance): { ton: 'rouge' | 'ambre' | 'vert' | 'neutre'; libelle: string } {
    if (l.echeance.honoreeLe) return { ton: 'vert', libelle: 'honoree' };
    const restant = Math.floor(DateTime.fromISO(l.echeance.echeanceLe).diff(maintenant, 'days').days);
    if (restant < 0) return { ton: 'rouge', libelle: 'depassee' };
    if (restant === 0) return { ton: 'rouge', libelle: "aujourd'hui" };
    if (restant <= 2) return { ton: 'ambre', libelle: `dans ${restant} j` };
    return { ton: 'neutre', libelle: `dans ${restant} j` };
  }

  return (
    <>
      <EntetePage
        titre="Echeancier"
        description="Cut-off, departs et arrivees prevus, validites d’offre, expirations de document et creneaux d’entrepot. Les echeances a deux jours ou moins sont signalees dans la file du jour."
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
          <ChampSelect libelle="Horizon" value={jours} onChange={(e) => setJours(e.target.value)}>
            <option value="7">7 jours</option>
            <option value="14">14 jours</option>
            <option value="30">30 jours</option>
            <option value="90">90 jours</option>
          </ChampSelect>
        </div>
      </Carte>

      {error && <Alerte>{messageErreur(error)}</Alerte>}
      {isLoading ? (
        <Chargement texte="Chargement de l&rsquo;echeancier" />
      ) : !lignes.length ? (
        <Vide>Aucune echeance sur cet horizon.</Vide>
      ) : (
        <div className="carte overflow-x-auto">
          <table className="tableau">
            <caption className="sr-only">Echeances a venir</caption>
            <thead>
              <tr>
                <th scope="col">Echeance</th>
                <th scope="col">Type</th>
                <th scope="col">Dossier</th>
                <th scope="col">Date</th>
                <th scope="col">Delai</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => {
                const t = tonEcheance(l);
                return (
                  <tr key={l.echeance.id}>
                    <td>{l.echeance.libelle ?? LIBELLES_ECHEANCES[l.echeance.type] ?? l.echeance.type}</td>
                    <td className="text-texte-doux">{LIBELLES_ECHEANCES[l.echeance.type] ?? l.echeance.type}</td>
                    <td>
                      <Link to={`/dossiers/${l.dossierId}`}>{l.dossier}</Link>
                    </td>
                    <td className="whitespace-nowrap" title={relatif(l.echeance.echeanceLe)}>
                      {jour(l.echeance.echeanceLe)}
                    </td>
                    <td>
                      <Badge ton={t.ton}>{t.libelle}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
