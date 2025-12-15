import React from 'react';
import { Button } from './ui';

interface ErrorScreenProps {
  message?: string;
  error?: Error | null;
  onRetry: () => void;
}

export function ErrorScreen({ 
  message = 'Something went wrong', 
  error,
  onRetry 
}: ErrorScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-white bg-background text-center">
      <div className="text-red-500 mb-4 text-5xl">⚠️</div>
      <h2 className="text-xl font-bold mb-2">{message}</h2>
      {error && (
        <p className="text-sm text-gray-400 mb-6 max-w-md break-words">
          {error.message || JSON.stringify(error)}
        </p>
      )}
      <Button onClick={onRetry} variant="primary" className="min-w-[120px]">
        Retry
      </Button>
    </div>
  );
}