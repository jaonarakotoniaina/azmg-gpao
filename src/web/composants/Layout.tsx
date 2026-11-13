import { useState, type ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ListTodo, Zap, FolderOpen, CalendarClock, Upload, Settings, Menu, LogOut, LayoutDashboard, ClipboardCheck, MailCheck, PenLine, TrendingUp, Table, FileSpreadsheet, Inbox, Mails } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { cx, Badge } from './ui';
import { LIBELLES_ROLES, type Role } from '@shared/constantes';

interface Lien {
  vers: string;
  libelle: string;
  icone: ReactNode;
  roles?: Role[];
  /** Nombre affiche a droite du lien : ce qui attend une action. */
  compteur?: number;
}

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

  const liens: Lien[] = [
    { vers: '/', libelle: 'File du jour', icone: <ListTodo className="h-4 w-4" aria-hidden /> },
    { vers: '/tableau-de-bord', libelle: 'Tableau de bord', icone: <LayoutDashboard className="h-4 w-4" aria-hidden /> },
    { vers: '/saisie', libelle: 'Saisie rapide', icone: <Zap className="h-4 w-4" aria-hidden />, roles: ['admin', 'manager', 'collaborateur'] },
    { vers: '/dossiers', libelle: 'Dossiers', icone: <FolderOpen className="h-4 w-4" aria-hidden /> },
    { vers: '/suivi', libelle: 'Suivi des demandes', icone: <Table className="h-4 w-4" aria-hidden /> },
    { vers: '/a-classer', libelle: 'A classer', icone: <Inbox className="h-4 w-4" aria-hidden />, roles: ['admin', 'manager', 'collaborateur'], compteur: aClasser?.length },
    { vers: '/echeancier', libelle: 'Echeancier', icone: <CalendarClock className="h-4 w-4" aria-hidden /> },
    { vers: '/digest', libelle: 'Digest de validation', icone: <MailCheck className="h-4 w-4" aria-hidden /> },
    { vers: '/brouillons', libelle: 'Brouillons', icone: <PenLine className="h-4 w-4" aria-hidden /> },
    { vers: '/qualite', libelle: 'Qualite', icone: <ClipboardCheck className="h-4 w-4" aria-hidden /> },
    { vers: '/pilotage', libelle: 'Pilotage', icone: <TrendingUp className="h-4 w-4" aria-hidden />, roles: ['admin', 'manager'] },
    { vers: '/export', libelle: 'Export du reporting', icone: <FileSpreadsheet className="h-4 w-4" aria-hidden />, roles: ['admin', 'manager'] },
    { vers: '/import-mails', libelle: 'Import des mails', icone: <Mails className="h-4 w-4" aria-hidden />, roles: ['admin', 'manager'] },
    { vers: '/import', libelle: 'Import du classeur', icone: <Upload className="h-4 w-4" aria-hidden />, roles: ['admin', 'manager'] },
    { vers: '/parametres', libelle: 'Parametres', icone: <Settings className="h-4 w-4" aria-hidden /> },
  ];
  const visibles = liens.filter((l) => !l.roles || (utilisateur && l.roles.includes(utilisateur.role)));

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
          <ul className="space-y-1">
            {visibles.map((l) => (
              <li key={l.vers}>
                <NavLink
                  to={l.vers}
                  end={l.vers === '/'}
                  onClick={() => setMenuOuvert(false)}
                  className={({ isActive }) =>
                    cx(
                      'flex items-center gap-2 rounded-bouton px-3 py-2 text-sm no-underline',
                      isActive ? 'bg-violet-pale font-semibold text-violet' : 'text-texte hover:bg-entete',
                    )
                  }
                >
                  {l.icone}
                  <span className="flex-1">{l.libelle}</span>
                  {l.compteur ? <Badge ton="ambre">{l.compteur}</Badge> : null}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <main id="contenu" className="min-w-0 flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
