import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from '@/src/components/ErrorBoundary';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  void navigator.serviceWorker
    .getRegistrations()
    .then((regs) => {
      regs.forEach((reg) => {
        void reg.unregister();
      });
    })
    .catch(() => {
      // ignore SW cleanup errors
    });
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
