import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Service Worker handling: only register in production; clean up in development
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('SW registered: ', registration);
        })
        .catch(registrationError => {
          console.log('SW registration failed: ', registrationError);
        });
    });
  } else {
    // In development, ensure no stale service workers or caches interfere with Vite HMR
    navigator.serviceWorker.getRegistrations?.().then(regs => {
      regs.forEach(r => r.unregister());
    }).catch(() => {});
    // Attempt to clear any app caches used by the SW
    // This is safe in dev and prevents module load failures from stale caches
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).caches?.keys?.().then((keys: string[]) => {
      keys.forEach(key => (window as any).caches.delete(key));
    }).catch(() => {});
  }
}

createRoot(document.getElementById("root")!).render(<App />);
