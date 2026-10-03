import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import VillaPage from './VillaPage';
import './styles/base.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <VillaPage />
  </StrictMode>,
);
