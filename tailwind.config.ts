import type { Config } from 'tailwindcss';
import { theme } from './src/web/theme';

export default {
  content: ['./src/web/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: theme.couleurs,
      fontFamily: { display: [...theme.polices.titres], sans: [...theme.polices.texte] },
      borderRadius: theme.rayons,
      boxShadow: { survol: theme.ombreSurvol },
      spacing: { 13: '52px', 19: '76px', 5.5: '22px' },
      maxWidth: { contenu: '1080px' },
    },
  },
  plugins: [],
} satisfies Config;
