import type { Page } from '@playwright/test';

export const COMPTES = {
  ceo: { email: 'ceo@azmg-solutions.com', motDePasse: 'MotDePasseE2E2026' },
  collaboratrice: { email: 'elysa@azmg-solutions.com', motDePasse: 'MotDePasseE2E2026' },
};

export async function seConnecter(page: Page, compte: { email: string; motDePasse: string }) {
  await page.goto('/connexion');
  await page.getByRole('textbox', { name: 'Adresse email' }).fill(compte.email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(compte.motDePasse);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL('**/');
}
