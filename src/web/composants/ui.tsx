/**
 * Composants d'interface accessibles, conformes à la charte AZMG-Solutions :
 * un seul bouton plein par écran (action principale), actions secondaires en liens soulignés,
 * rayons 6 px (boutons, étiquettes) et 8 px (cartes, tableaux), focus violet visible.
 */
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Loader2, X } from 'lucide-react';
import { formaterDuree } from '@shared/heures-ouvrees';

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

type VarianteBouton = 'plein' | 'lien' | 'discret' | 'danger' | 'contour';

export const Bouton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBouton; chargement?: boolean; icone?: ReactNode }>(
  function Bouton({ variante = 'lien', chargement, icone, className, children, disabled, type = 'button', ...reste }, ref) {
    const styles: Record<VarianteBouton, string> = {
      plein: 'bg-violet text-white hover:bg-violet-fonce rounded-bouton px-4 py-2 font-semibold min-h-[40px]',
      lien: 'text-bleu-clair underline underline-offset-2 hover:text-violet px-1 py-1',
      discret: 'text-texte-doux hover:text-texte hover:bg-entete rounded-bouton px-2 py-1',
      danger: 'text-rouge underline underline-offset-2 hover:text-rouge px-1 py-1',
      contour: 'border border-ligne-forte bg-white text-texte hover:border-violet rounded-bouton px-3 py-1.5 font-medium',
    };
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || chargement}
        className={cx('inline-flex items-center gap-2 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed', styles[variante], className)}
        {...reste}
      >
        {chargement ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icone}
        {children}
      </button>
    );
  },
);

export function Carte({ titre, actions, children, className, id }: { titre?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section className={cx('carte p-5', className)} aria-labelledby={titre && id ? `${id}-titre` : undefined} id={id}>
      {(titre || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          {titre && (
            <h2 id={id ? `${id}-titre` : undefined} className="text-lg">
              {titre}
            </h2>
          )}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function EntetePage({ titre, surtitre, description, actions }: { titre: ReactNode; surtitre?: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {surtitre && <p className="text-sm text-texte-discret">{surtitre}</p>}
        <h1 className="text-2xl md:text-3xl">{titre}</h1>
        {description && <p className="mt-1 max-w-3xl text-texte-doux">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

export type TonBadge = 'neutre' | 'violet' | 'vert' | 'ambre' | 'rouge' | 'bleu';
export function Badge({ ton = 'neutre', children, titre }: { ton?: TonBadge; children: ReactNode; titre?: string }) {
  const tons: Record<TonBadge, string> = {
    neutre: 'bg-entete text-texte-doux',
    violet: 'bg-violet-pale text-violet',
    vert: 'bg-vert-pale text-vert',
    ambre: 'bg-ambre-pale text-ambre',
    rouge: 'bg-rouge-pale text-rouge',
    bleu: 'bg-[#EAF2FB] text-bleu-clair',
  };
  return (
    <span title={titre} className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-bouton px-2 py-0.5 text-xs font-medium', tons[ton])}>
      {children}
    </span>
  );
}

/** Duree en minutes ouvrees, avec un ton qui signale le depassement du delai cible. */
export function Duree({ minutes, cible, minutesParJour = 540 }: { minutes: number | null | undefined; cible?: number | null; minutesParJour?: number }) {
  if (minutes === null || minutes === undefined) return <Badge>non mesure</Badge>;
  const libelle = formaterDuree(minutes, minutesParJour);
  if (!cible) return <Badge>{libelle}</Badge>;
  const part = minutes / cible;
  const ton: TonBadge = part >= 1 ? 'rouge' : part >= 0.8 ? 'ambre' : 'vert';
  const explication = part >= 1 ? 'delai cible depasse' : part >= 0.8 ? 'delai cible bientot atteint' : 'dans le delai cible';
  return (
    <Badge ton={ton} titre={`${libelle} en heures ouvrees du client, ${explication}`}>
      {libelle}
    </Badge>
  );
}

interface PropsChamp {
  libelle: string;
  aide?: ReactNode;
  erreur?: string | null;
}

export const ChampTexte = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & PropsChamp>(function ChampTexte({ libelle, aide, erreur, id, className, ...reste }, ref) {
  const auto = useId();
  const cle = id ?? auto;
  return (
    <div className={className}>
      <label htmlFor={cle} className="etiquette">
        {libelle}
      </label>
      <input ref={ref} id={cle} className="champ" aria-invalid={Boolean(erreur)} aria-describedby={aide || erreur ? `${cle}-aide` : undefined} {...reste} />
      {(aide || erreur) && (
        <span id={`${cle}-aide`} className={cx('aide', erreur && 'text-rouge')}>
          {erreur ?? aide}
        </span>
      )}
    </div>
  );
});

export function ChampZone({ libelle, aide, erreur, id, className, ...reste }: TextareaHTMLAttributes<HTMLTextAreaElement> & PropsChamp) {
  const auto = useId();
  const cle = id ?? auto;
  return (
    <div className={className}>
      <label htmlFor={cle} className="etiquette">
        {libelle}
      </label>
      <textarea id={cle} className="champ min-h-[100px]" aria-invalid={Boolean(erreur)} aria-describedby={aide || erreur ? `${cle}-aide` : undefined} {...reste} />
      {(aide || erreur) && (
        <span id={`${cle}-aide`} className={cx('aide', erreur && 'text-rouge')}>
          {erreur ?? aide}
        </span>
      )}
    </div>
  );
}

export function ChampSelect({ libelle, aide, id, className, children, ...reste }: SelectHTMLAttributes<HTMLSelectElement> & PropsChamp) {
  const auto = useId();
  const cle = id ?? auto;
  return (
    <div className={className}>
      <label htmlFor={cle} className="etiquette">
        {libelle}
      </label>
      <select id={cle} className="champ" {...reste}>
        {children}
      </select>
      {aide && <span className="aide">{aide}</span>}
    </div>
  );
}

export function Case({ libelle, aide, id, ...reste }: InputHTMLAttributes<HTMLInputElement> & { libelle: ReactNode; aide?: ReactNode }) {
  const auto = useId();
  const cle = id ?? auto;
  return (
    <div className="flex items-start gap-2">
      <input id={cle} type="checkbox" className="mt-1 h-4 w-4 accent-violet" {...reste} />
      <label htmlFor={cle} className="text-sm">
        {libelle}
        {aide && <span className="aide">{aide}</span>}
      </label>
    </div>
  );
}

export function Interrupteur({ actif, onChange, libelle, desactive }: { actif: boolean; onChange: (v: boolean) => void; libelle: string; desactive?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={actif}
      aria-label={libelle}
      disabled={desactive}
      onClick={() => onChange(!actif)}
      className={cx('relative inline-flex h-6 w-11 flex-none items-center rounded-full transition-colors disabled:opacity-50', actif ? 'bg-vert' : 'bg-ligne-forte')}
    >
      <span className={cx('inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform', actif ? 'translate-x-5' : 'translate-x-0.5')} />
    </button>
  );
}

export function Chargement({ texte = 'Chargement' }: { texte?: string }) {
  return (
    <div className="flex items-center gap-2 p-6 text-texte-doux" role="status">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> {texte}
    </div>
  );
}

export function Alerte({ ton = 'rouge', children }: { ton?: 'rouge' | 'ambre' | 'vert' | 'bleu'; children: ReactNode }) {
  const tons = { rouge: 'bg-rouge-pale text-rouge border-[#F2C9C5]', ambre: 'bg-ambre-pale text-ambre border-[#EBD9B4]', vert: 'bg-vert-pale text-vert border-[#BFE3D2]', bleu: 'bg-[#EAF2FB] text-bleu-fond border-[#C9DDF2]' };
  return (
    <div role={ton === 'rouge' ? 'alert' : 'status'} className={cx('rounded-bouton border px-4 py-3 text-sm', tons[ton])}>
      {children}
    </div>
  );
}

export function Vide({ children }: { children: ReactNode }) {
  return <p className="rounded-carte border border-dashed border-ligne-forte p-6 text-center text-texte-doux">{children}</p>;
}

/** Fenêtre modale accessible (élément dialog natif : piège du focus et touche Échap gérés par le navigateur). */
export function Dialogue({ ouvert, onFermer, titre, children, pied }: { ouvert: boolean; onFermer: () => void; titre: string; children: ReactNode; pied?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  // Identifiant unique : plusieurs dialogues peuvent coexister sur une page (nom accessible correct pour chacun).
  const idTitre = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (ouvert && !d.open) d.showModal();
    if (!ouvert && d.open) d.close();
  }, [ouvert]);
  return (
    <dialog ref={ref} onClose={onFermer} className="w-[min(640px,92vw)] rounded-carte border border-ligne p-0 backdrop:bg-sombre/50" aria-labelledby={idTitre}>
      <div className="flex items-center justify-between border-b border-ligne px-5 py-3">
        <h2 id={idTitre} className="text-lg">
          {titre}
        </h2>
        <button type="button" onClick={onFermer} className="rounded-bouton p-1 text-texte-doux hover:bg-entete" aria-label="Fermer">
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
      {pied && <div className="flex justify-end gap-3 border-t border-ligne px-5 py-3">{pied}</div>}
    </dialog>
  );
}

/**
 * Barre d'onglets accessible. Le contenu de l'onglet actif doit etre enveloppe dans
 * <Panneau prefixe={...} id={ongletActif}> pour que la relation onglet / panneau soit annoncee.
 */
export function Onglets<T extends string>({
  onglets,
  actif,
  onChange,
  prefixe = 'onglet',
  libelle = 'Sections de la page',
}: {
  onglets: { id: T; libelle: ReactNode }[];
  actif: T;
  onChange: (id: T) => void;
  prefixe?: string;
  libelle?: string;
}) {
  return (
    <div role="tablist" aria-label={libelle} className="mb-4 flex flex-wrap gap-1 border-b border-ligne">
      {onglets.map((o) => (
        <button
          key={o.id}
          id={`${prefixe}-${o.id}`}
          role="tab"
          type="button"
          aria-selected={actif === o.id}
          aria-controls={`${prefixe}-panneau-${o.id}`}
          tabIndex={actif === o.id ? 0 : -1}
          onClick={() => onChange(o.id)}
          className={cx('-mb-px border-b-2 px-3 py-2 text-sm', actif === o.id ? 'border-violet font-semibold text-texte' : 'border-transparent text-texte-doux hover:text-texte')}
        >
          {o.libelle}
        </button>
      ))}
    </div>
  );
}

/** Panneau d'un onglet : porte le role et l'identifiant attendus par la barre d'onglets. */
export function Panneau({ prefixe = 'onglet', id, children }: { prefixe?: string; id: string; children: ReactNode }) {
  return (
    <div role="tabpanel" id={`${prefixe}-panneau-${id}`} aria-labelledby={`${prefixe}-${id}`} tabIndex={0}>
      {children}
    </div>
  );
}

export function Indicateur({ libelle, valeur, detail }: { libelle: string; valeur: ReactNode; detail?: ReactNode }) {
  return (
    <div className="carte p-4">
      <p className="text-sm text-texte-doux">{libelle}</p>
      <p className="mt-1 font-display text-3xl font-semibold">{valeur}</p>
      {detail && <p className="mt-1 text-xs text-texte-discret">{detail}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notifications (région annoncée aux lecteurs d'écran)
// ---------------------------------------------------------------------------

type Notification = { id: number; texte: string; ton: 'vert' | 'rouge' };
const ContexteNotifications = createContext<(texte: string, ton?: 'vert' | 'rouge') => void>(() => undefined);

export function FournisseurNotifications({ children }: { children: ReactNode }) {
  const [liste, setListe] = useState<Notification[]>([]);
  const notifier = useCallback((texte: string, ton: 'vert' | 'rouge' = 'vert') => {
    const id = Date.now() + Math.random();
    setListe((l) => [...l, { id, texte, ton }]);
    setTimeout(() => setListe((l) => l.filter((n) => n.id !== id)), 5000);
  }, []);
  return (
    <ContexteNotifications.Provider value={notifier}>
      {children}
      <div aria-live="polite" className="fixed bottom-4 right-4 z-50 flex w-[min(380px,90vw)] flex-col gap-2">
        {liste.map((n) => (
          <div key={n.id} className={cx('rounded-carte border px-4 py-3 text-sm shadow-survol', n.ton === 'vert' ? 'border-[#BFE3D2] bg-vert-pale text-vert' : 'border-[#F2C9C5] bg-rouge-pale text-rouge')}>
            {n.texte}
          </div>
        ))}
      </div>
    </ContexteNotifications.Provider>
  );
}

export function useNotifier() {
  return useContext(ContexteNotifications);
}
