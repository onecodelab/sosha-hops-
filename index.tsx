// Baro OS Initialization
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { supabase } from './supabase';

// Start auth session fetch immediately to warm up the cache
// This happens in parallel with React hydration
const authSessionPromise = supabase.auth.getSession();

const purgeStaleBrowserState = async () => {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
  } catch (err) {
    console.warn('Service worker cleanup skipped:', err);
  }

  try {
    if ('caches' in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((key) => caches.delete(key)));
    }
  } catch (err) {
    console.warn('Cache cleanup skipped:', err);
  }
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#000] text-foreground p-6">
          <div className="max-w-xl w-full rounded-3xl border border-white/10 bg-[#0A0A0A] p-8 shadow-2xl">
            <h1 className="text-2xl font-black mb-3">Baro is reloading</h1>
            <p className="text-sm text-muted-foreground mb-6">
              A cached app chunk failed to load. Refreshing the app will pull the latest version.
            </p>
            <button
              onClick={async () => {
                await purgeStaleBrowserState();
                window.location.reload();
              }}
              className="px-5 py-3 rounded-2xl bg-[#FFB800] text-black font-bold"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const root = ReactDOM.createRoot(rootElement);

// Render immediately — don't block on cache cleanup
root.render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);

// Purge stale SW/caches in the background
purgeStaleBrowserState().catch(() => {});
