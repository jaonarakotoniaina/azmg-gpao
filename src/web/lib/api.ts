/** Client HTTP du back-office : cookies de session, jeton CSRF, erreurs en français. */

export class ErreurApi extends Error {
  constructor(
    public statut: number,
    message: string,
    public details?: { champ: string; message: string }[],
  ) {
    super(message);
  }
}

function lireCookie(nom: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${nom}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

async function requete<T>(methode: string, url: string, corps?: unknown): Promise<T> {
  const entetes: Record<string, string> = { accept: 'application/json' };
  const estFormulaire = typeof FormData !== 'undefined' && corps instanceof FormData;
  if (corps !== undefined && !estFormulaire) entetes['content-type'] = 'application/json';
  if (methode !== 'GET') {
    const csrf = lireCookie('azmg_csrf');
    if (csrf) entetes['x-csrf-token'] = csrf;
  }
  const r = await fetch(url, {
    method: methode,
    headers: entetes,
    credentials: 'same-origin',
    body: corps === undefined ? undefined : estFormulaire ? (corps as FormData) : JSON.stringify(corps),
  });
  if (r.status === 204) return undefined as T;
  const texte = await r.text();
  const donnees = texte ? JSON.parse(texte) : null;
  if (!r.ok) {
    if (r.status === 401 && !url.startsWith('/api/auth/')) window.dispatchEvent(new Event('azmg:deconnecte'));
    throw new ErreurApi(r.status, donnees?.erreur ?? 'Erreur inattendue', donnees?.details);
  }
  return donnees as T;
}

export const api = {
  get: <T = any>(url: string) => requete<T>('GET', url),
  post: <T = any>(url: string, corps?: unknown) => requete<T>('POST', url, corps ?? {}),
  put: <T = any>(url: string, corps: unknown) => requete<T>('PUT', url, corps),
  patch: <T = any>(url: string, corps: unknown) => requete<T>('PATCH', url, corps),
  delete: <T = any>(url: string) => requete<T>('DELETE', url),
};

export function messageErreur(e: unknown): string {
  if (e instanceof ErreurApi) {
    if (e.details?.length) return `${e.message} : ${e.details.map((d) => (d.champ ? `${d.champ} (${d.message})` : d.message)).join(', ')}`;
    return e.message;
  }
  return e instanceof Error ? e.message : 'Erreur inattendue';
}
