import React, { useEffect, useState } from 'react';

interface LoadingSpinnerProps {
  timeout?: number;
  onTimeout?: () => void;
}

export function LoadingSpinner({ 
  timeout = 10000, 
  onTimeout 
}: LoadingSpinnerProps) {
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    const warningTimer = setTimeout(() => {
      setShowWarning(true);
    }, 5000);

    const timeoutTimer = setTimeout(() => {
      if (onTimeout) onTimeout();
    }, timeout);

    return () => {
      clearTimeout(warningTimer);
      clearTimeout(timeoutTimer);
    };
  }, [timeout, onTimeout]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-white bg-background">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      <p className="mt-4 text-lg font-medium text-gray-200">Loading your profile...</p>
      {showWarning && (
        <p className="mt-2 text-yellow-500 text-sm">
          Taking longer than usual...
        </p>
      )}
    </div>
  );
}