import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Menu, LogOut } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { cx, Badge } from './ui';
import { GROUPES } from '../navigation';
import { LIBELLES_ROLES } from '@shared/constantes';

export function Layout() {
  const { utilisateur, deconnecter } = useAuth();
  const [menuOuvert, setMenuOuvert] = useState(false);
  const { data: aClasser } = useQuery({
    queryKey: ['a-classer'],
    queryFn: () => api.get<unknown[]>('/api/evenements/a-classer'),
    staleTime: 60_000,
    refetchInterval: 180_000,
  });
  const { data: parametres } = useQuery({
    queryKey: ['parametres'],
    queryFn: () => api.get<{ integrationsSimulees: string[]; parametres: { pauseAutomatisations: boolean } }>('/api/parametres'),
    staleTime: 120_000,
  });

  // La barre se construit depuis `GROUPES` : la meme liste que les routes, pour qu'une page
  // joignable soit toujours une page visible. C'est la lecon de « Pilotage » puis de « Suivi des
  // demandes », tous deux livres puis introuvables parce que leur nom n'etait ecrit nulle part.
  //
  // Les tetes de groupe hierarchisent, elles ne cachent rien : toutes les pages sont listees.
  const autorise = (roles?: readonly string[]) => !roles || Boolean(utilisateur && roles.includes(utilisateur.role));
  const groupes = GROUPES.filter((g) => autorise(g.roles))
    .map((g) => ({ ...g, pages: g.pages.filter((p) => autorise(p.roles)) }))
    .filter((g) => g.pages.length > 0);

  return (
    <div className="min-h-screen">
      <a href="#contenu" className="sr-only-focusable absolute left-2 top-2 z-50 rounded-bouton bg-white px-3 py-2">
        Aller au contenu
      </a>
      <header className="bg-sombre text-white">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-bouton p-1 hover:bg-white/10 lg:hidden"
              onClick={() => setMenuOuvert((v) => !v)}
              aria-expanded={menuOuvert}
              aria-controls="navigation"
              aria-label="Menu"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
            <NavLink to="/" className="flex items-center gap-2 text-white no-underline">
              <span className="font-semibold">AZMG GPAO</span>
            </NavLink>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {parametres?.parametres?.pauseAutomatisations && <Badge ton="ambre">Automatisations en pause</Badge>}
            {(parametres?.integrationsSimulees?.length ?? 0) > 0 && (
              <span className="hidden md:inline">
                <Badge ton="bleu" titre={parametres!.integrationsSimulees.join(', ')}>
                  Mode simule : {parametres!.integrationsSimulees.length} integration(s)
                </Badge>
              </span>
            )}
            <span className="hidden text-white/80 sm:inline">
              {utilisateur?.nom} ({utilisateur ? LIBELLES_ROLES[utilisateur.role] : ''})
            </span>
            <button
              type="button"
              onClick={() => deconnecter()}
              className="inline-flex items-center gap-1 rounded-bouton px-2 py-1 text-white/90 hover:bg-white/10"
            >
              <LogOut className="h-4 w-4" aria-hidden /> Deconnexion
            </button>
          </div>
        </div>
        <div className="h-[3px] bg-gradient-to-r from-violet to-bleu-fond" aria-hidden />
      </header>
      <div className="mx-auto flex max-w-[1400px]">
        <nav
          id="navigation"
          aria-label="Navigation principale"
          className={cx('w-60 flex-none border-r border-ligne bg-carte p-3 lg:block', menuOuvert ? 'block' : 'hidden')}
        >
          <ul className="space-y-3">
            {groupes.map((groupe) => {
              // Un groupe d'une seule page n'a pas besoin de tete : la page est son propre titre.
              const seule = groupe.pages.length === 1 ? groupe.pages[0] : null;
              return (
                <li key={groupe.libelle}>
                  {seule ? (
                    <NavLink
                      to={seule.chemin}
                      end={seule.chemin === '/'}
                      onClick={() => setMenuOuvert(false)}
                      className={({ isActive }) =>
                        cx(
                          'flex items-center gap-2 rounded-bouton px-3 py-2 text-sm no-underline',
                          isActive ? 'bg-violet-pale font-semibold text-violet' : 'text-texte hover:bg-entete',
                        )
                      }
                    >
                      {groupe.icone}
                      <span className="flex-1">{seule.libelle}</span>
                    </NavLink>
                  ) : (
                    <>
                      <p className="flex items-center gap-2 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-texte-discret">
                        {groupe.icone}
                        <span>{groupe.libelle}</span>
                      </p>
                      <ul>
                        {groupe.pages.map((page) => (
                          <li key={page.chemin}>
                            <NavLink
                              to={page.chemin}
                              end={page.chemin === '/'}
                              onClick={() => setMenuOuvert(false)}
                              className={({ isActive }) =>
                                cx(
                                  'flex items-center gap-2 rounded-bouton py-1.5 pl-9 pr-3 text-sm no-underline',
                                  isActive ? 'bg-violet-pale font-semibold text-violet' : 'text-texte hover:bg-entete',
                                )
                              }
                            >
                              <span className="flex-1">{page.libelle}</span>
                              {page.compteurAClasser && aClasser?.length ? <Badge ton="ambre">{aClasser.length}</Badge> : null}
                            </NavLink>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
        <main id="contenu" className="min-w-0 flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
