/**
 * Configuration centralisee, lue depuis les variables d'environnement.
 * Regle CLAUDE.md : une integration dont le secret est absent bascule automatiquement en mode `mock`,
 * l'application continue de fonctionner et le manque est liste dans docs/A_FOURNIR.md.
 */
import path from 'node:path';

/** Valeur d'environnement nettoyee : espaces, retour chariot et guillemets retires. */
function lire(nom: string, defaut = ''): string {
  const brut = process.env[nom];
  if (brut === undefined) return defaut;
  const v = brut.trim().replace(/^(['"])(.*)\1$/, '$2').trim();
  return v === '' ? defaut : v;
}
function lireBool(nom: string, defaut = false): boolean {
  const v = process.env[nom];
  if (v === undefined || v === '') return defaut;
  return ['1', 'true', 'oui', 'yes'].includes(v.toLowerCase());
}
function lireEntier(nom: string, defaut: number): number {
  const v = Number(process.env[nom]);
  return Number.isFinite(v) && process.env[nom] !== '' && process.env[nom] !== undefined ? v : defaut;
}

export type ModeAdaptateur = 'real' | 'mock';

function construire() {
  const env = lire('NODE_ENV', 'development');
  const production = env === 'production';
  const test = env === 'test';
  const racine = path.resolve(__dirname, '..', '..');

  const cleAnthropic = lire('ANTHROPIC_API_KEY');
  const jetonAgent = lire('AGENT_API_TOKEN', production ? '' : 'jeton-agent-developpement');
  const fournisseurDemande = lire('AI_PROVIDER');
  let fournisseurIa: 'agent' | 'api' | 'mock';
  if (fournisseurDemande === 'api') fournisseurIa = cleAnthropic ? 'api' : 'mock';
  else if (fournisseurDemande === 'agent') fournisseurIa = jetonAgent ? 'agent' : 'mock';
  else if (fournisseurDemande === 'mock') fournisseurIa = 'mock';
  else fournisseurIa = production && jetonAgent ? 'agent' : 'mock';

  // Collecte des mails du poste (phase 4) : webhook Apps Script, IMAP, ou simule.
  const collecteDemandee = lire('COLLECTE_MAIL');
  const secretAppsScript = lire('APPS_SCRIPT_SECRET');
  const imapConfigure = Boolean(lire('IMAP_HOST') && lire('IMAP_PASSWORD'));
  let collecteMail: 'apps_script' | 'imap' | 'mock';
  if (test) collecteMail = 'mock';
  else if (collecteDemandee === 'apps_script') collecteMail = secretAppsScript ? 'apps_script' : 'mock';
  else if (collecteDemandee === 'imap') collecteMail = imapConfigure ? 'imap' : 'mock';
  else if (secretAppsScript) collecteMail = 'apps_script';
  else if (imapConfigure) collecteMail = 'imap';
  else collecteMail = 'mock';

  const smtpMode: ModeAdaptateur = lire('SMTP_HOST') && !test ? 'real' : 'mock';

  return {
    env,
    production,
    test,
    racine,
    port: lireEntier('PORT', 3000),
    trustProxy: lireBool('TRUST_PROXY', production),
    databaseUrl: lire(
      'DATABASE_URL',
      test ? 'postgresql://azmg:azmg@localhost:5432/azmg_gpao_test' : 'postgresql://azmg:azmg@localhost:5432/azmg_gpao_dev',
    ),
    databaseSsl: lireBool('DATABASE_SSL', false),
    sessionSecret: lire('SESSION_SECRET', production ? '' : 'secret-de-developpement-a-changer-absolument'),
    url: lire('APP_URL', 'http://localhost:3000').replace(/\/$/, ''),
    stockage: path.resolve(racine, lire('STORAGE_DIR', test ? 'storage/test' : 'storage')),
    /** Fuseau d'affichage de l'interface : le poste travaille a Antananarivo. */
    fuseau: 'Indian/Antananarivo',
    agent: { jeton: jetonAgent },
    /** Connecteur Claude (MCP) : cle d'au moins 32 caracteres, sinon /mcp reste ferme. */
    mcp: {
      jeton: lire('AZMG_MCP_TOKEN', test ? 'cle-connecteur-claude-des-tests-0123456789' : '').trim(),
      utilisateur: lire('AZMG_MCP_UTILISATEUR', '').trim().toLowerCase(),
    },
    ia: {
      fournisseur: fournisseurIa,
      cleApi: cleAnthropic,
      modeleRapide: lire('ANTHROPIC_MODEL_FAST'),
      modeleIntelligent: lire('ANTHROPIC_MODEL_SMART'),
      timeoutMs: lireEntier('AI_TIMEOUT_MS', 90000),
    },
    collecte: {
      mode: collecteMail,
      secretAppsScript,
      imap: {
        hote: lire('IMAP_HOST'),
        port: lireEntier('IMAP_PORT', 993),
        securise: lireBool('IMAP_SECURE', true),
        utilisateur: lire('IMAP_USER'),
        motDePasse: lire('IMAP_PASSWORD'),
        dossier: lire('IMAP_FOLDER', 'INBOX'),
      },
    },
    smtp: {
      mode: smtpMode,
      hote: lire('SMTP_HOST'),
      port: lireEntier('SMTP_PORT', 465),
      securise: lireBool('SMTP_SECURE', true),
      utilisateur: lire('SMTP_USER'),
      motDePasse: lire('SMTP_PASSWORD'),
      expediteur: lire('SMTP_FROM', 'AZMG GPAO <gpao@azmg-solutions.com>'),
    },
    emailAlerte: lire('ALERT_EMAIL'),
    cronEnProcessus: lireBool('CRON_INPROCESS', false),
    seedDemo: lireBool('SEED_DEMO', !production),
    /** Taille maximale d'un classeur importe. */
    tailleMaxImportOctets: lireEntier('IMPORT_MAX_BYTES', 15 * 1024 * 1024),
  };
}

export type Config = ReturnType<typeof construire>;
export let config: Config = construire();

/** Relit l'environnement (utilise par les tests). */
export function rechargerConfig(): Config {
  config = construire();
  return config;
}

/** Liste des integrations en mode simule, affichee dans l'interface et dans docs/A_FOURNIR.md. */
export function integrationsSimulees(): string[] {
  const liste: string[] = [];
  if (config.ia.fournisseur === 'mock') liste.push('IA (AI_PROVIDER, AGENT_API_TOKEN ou ANTHROPIC_API_KEY)');
  if (config.collecte.mode === 'mock') liste.push('Collecte des mails du poste (APPS_SCRIPT_SECRET ou IMAP_*)');
  if (config.smtp.mode === 'mock') liste.push('Envoi des emails (SMTP_*)');
  if (!config.mcp.jeton) liste.push('Connecteur Claude (AZMG_MCP_TOKEN)');
  return liste;
}
