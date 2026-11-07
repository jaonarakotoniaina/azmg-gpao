/**
 * Tokens de design : charte graphique AZMG-Solutions v1.0 (4 septembre 2026).
 * Fichier unique : toute évolution de la charte se fait ici.
 */
export const theme = {
  couleurs: {
    violet: { DEFAULT: '#8B25CF', fonce: '#7A1FB6', pale: '#F7F1FD' },
    bleu: { logo: '#5AA5F2', fond: '#0F66BD', clair: '#1170D0' },
    fond: '#FAF8F5',
    carte: '#FFFFFF',
    ligne: { DEFAULT: '#E7E2DA', forte: '#D6CFC4' },
    entete: '#F4F1EC',
    sombre: '#0A0612',
    texte: { DEFAULT: '#1A1626', doux: '#57506B', discret: '#746C89' },
    vert: { DEFAULT: '#0E815E', pale: '#ECF7F2' },
    ambre: { DEFAULT: '#9B6508', pale: '#FBF4E6' },
    rouge: { DEFAULT: '#B42318', pale: '#FDF0EF' },
  },
  polices: {
    titres: ['Fraunces', 'Georgia', 'Times New Roman', 'serif'],
    texte: ['Inter', 'Segoe UI', 'Arial', 'sans-serif'],
  },
  // Le rayon encode la fonction : image 4 px, bouton et étiquette 6 px, carte et tableau 8 px.
  rayons: { image: '4px', bouton: '6px', carte: '8px' },
  ombreSurvol: '0 2px 10px rgba(26,22,38,.06)',
  degradeTexte: 'linear-gradient(135deg,#8B25CF,#0F66BD)',
} as const;
