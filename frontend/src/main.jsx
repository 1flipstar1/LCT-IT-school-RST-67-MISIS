import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@atomaro/ui-kit/styles/atomaro-default-light-all.css';
import './styles/tokens.css';
import './styles/base.css';
import { App } from './app/App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
