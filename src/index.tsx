// Baro OS Initialization
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { supabase } from '@/lib/supabase';

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
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    const isChunkError = error.name === 'ChunkLoadError' || 
                         error.name === 'CSSChunkLoadError' ||
                         error.message?.includes('loading chunk') || 
                         error.message?.includes('dynamically imported');

    // Automatic recovery for new deployments (ChunkLoadError)
    if (isChunkError) {
      const lastReload = sessionStorage.getItem('baro-last-chunk-reload');
      const now = Date.now();
      
      // Only auto-reload once every 30 seconds to prevent loops
      if (!lastReload || (now - parseInt(lastReload)) > 30000) {
        sessionStorage.setItem('baro-last-chunk-reload', now.toString());
        purgeStaleBrowserState().then(() => {
          window.location.reload();
        });
      }
    }
  }

  render() {
    if (this.state.hasError) {
      const isChunkError = this.state.error?.name === 'ChunkLoadError';
      
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#000] text-foreground p-6 font-sans">
          <div className="max-w-xl w-full rounded-[2.5rem] border border-white/5 bg-[#0D0D0D] p-10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#FFB800]/50 to-transparent opacity-50" />
            
            <div className="w-16 h-16 rounded-2xl bg-[#FFB800]/10 flex items-center justify-center mb-8 border border-[#FFB800]/20">
              <div className="w-8 h-8 rounded-full border-4 border-[#FFB800] border-t-transparent animate-spin" />
            </div>

            <h1 className="text-3xl font-black mb-4 tracking-tighter">Baro is syncing</h1>
            <p className="text-base text-zinc-400 mb-8 leading-relaxed">
              {isChunkError 
                ? "A new version of Baro OS was just deployed. We're updating your dashboard now."
                : "We encountered an issue while loading your workspace. This usually happens after a system update or session change."}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={async () => {
                  await purgeStaleBrowserState();
                  window.location.reload();
                }}
                className="flex-1 px-6 py-4 rounded-2xl bg-[#FFB800] text-black font-black uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-[#FFB800]/20"
              >
                Reload App
              </button>
              
              <button
                onClick={async () => {
                  localStorage.clear();
                  sessionStorage.clear();
                  await supabase.auth.signOut();
                  window.location.href = '/login?reason=reset';
                }}
                className="flex-1 px-6 py-4 rounded-2xl bg-white/5 text-white font-black uppercase tracking-widest text-xs border border-white/10 hover:bg-white/10 transition-all"
              >
                Reset & Login
              </button>
            </div>

            <p className="mt-8 text-[10px] text-zinc-600 font-black uppercase tracking-[0.3em]">
              System Integrity Check: {this.state.error?.name || 'Unknown Error'}
            </p>
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
