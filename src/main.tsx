import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { installCanvasPolyfills } from './cluster/renderer/compat';
// Fonts are self-hosted (no request to a font CDN; see docs/PRIVACY.md). Latin only.
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/barlow-semi-condensed/latin-400.css';
import '@fontsource/barlow-semi-condensed/latin-500.css';
import '@fontsource/barlow-semi-condensed/latin-600.css';
import './app/styles.css';

installCanvasPolyfills();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
