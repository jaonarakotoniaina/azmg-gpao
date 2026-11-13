/**
 * Groupe de pages reunies sous un seul onglet de navigation.
 *
 * Quinze entrees dans la barre de gauche, c'etait une entree par fonction livree, pas une par
 * question que l'on se pose. Les pages sont donc regroupees par moment de travail : ce que je dois
 * traiter, le registre, ce qui attend un envoi, les indicateurs, les imports et exports.
 *
 * Chaque page garde son adresse propre : un lien vers `/suivi` continue de marcher, il ouvre
 * simplement le groupe sur le bon onglet. Rien n'est supprime, rien n'est deplace dans le code
 * des pages elles-memes.
 */
import { type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Onglets, Panneau } from './ui';
import type { Role } from '@shared/constantes';

export interface PageDuGroupe {
  id: string;
  libelle: string;
  /** Adresse propre de la page, conservee pour les liens et les favoris. */
  chemin: string;
  element: ReactNode;
  roles?: Role[];
}

export function GroupePages({ libelle, pages }: { libelle: string; pages: PageDuGroupe[] }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { utilisateur } = useAuth();

  const visibles = pages.filter((p) => !p.roles || (utilisateur && p.roles.includes(utilisateur.role)));
  // L'onglet actif vient de l'adresse : c'est elle qui fait foi, pas un etat local, sinon le
  // bouton « precedent » du navigateur et les liens entrants ne marcheraient plus.
  const actif = visibles.find((p) => p.chemin === pathname) ?? visibles[0];
  if (!actif) return null;

  return (
    <>
      {visibles.length > 1 && (
        <Onglets
          prefixe="groupe"
          libelle={libelle}
          onglets={visibles.map((p) => ({ id: p.id, libelle: p.libelle }))}
          actif={actif.id}
          onChange={(id) => {
            const page = visibles.find((p) => p.id === id);
            if (page) navigate(page.chemin);
          }}
        />
      )}
      <Panneau prefixe="groupe" id={actif.id}>
        {actif.element}
      </Panneau>
    </>
  );
}
