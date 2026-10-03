import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Déploiement dans un sous-dossier ? Renseignez base: '/mon-dossier/'
  base: '/',
});
