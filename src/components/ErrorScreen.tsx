
import React from 'react';
import { Button } from './ui';
import { AlertTriangle } from 'lucide-react';

interface ErrorScreenProps {
  message?: string;
  error?: Error | null;
  onRetry: () => void;
}

export function ErrorScreen({ 
  message = 'Failed to load your profile', 
  error,
  onRetry 
}: ErrorScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-white bg-[#050505] text-center font-sans">
      <div className="mb-6 animate-in zoom-in duration-500">
        <div className="p-4 bg-yellow-500/10 rounded-full">
          <AlertTriangle className="w-12 h-12 text-[#FFB800]" />
        </div>
      </div>
      
      <h2 className="text-2xl font-bold mb-2 tracking-tight">{message}</h2>
      
      {error && (
        <p className="text-sm text-gray-500 mb-8 max-w-md break-words font-medium">
          {error.message || JSON.stringify(error)}
        </p>
      )}
      
      <Button 
        onClick={onRetry} 
        className="min-w-[160px] bg-[#FFB800] hover:bg-[#EAB308] text-black font-black py-6 rounded-xl shadow-[0_10px_30px_rgba(255,184,0,0.2)] transition-all active:scale-95"
      >
        Retry
      </Button>
    </div>
  );
}
