
import React, { ButtonHTMLAttributes, InputHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

// --- Utility ---
export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

// --- Button ---
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  className, variant = 'primary', size = 'default', isLoading, children, disabled, ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:pointer-events-none";
  
  const variants = {
    // Updated primary to use var(--primary-glow) for theme-aware shadows
    primary: "bg-primary text-black hover:bg-primary/90 shadow-[0_4px_20px_var(--primary-glow)] hover:shadow-[0_8px_25px_var(--primary-glow)] hover:-translate-y-0.5",
    secondary: "bg-gray-200 text-gray-900 hover:bg-gray-300 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 dark:border dark:border-white/5",
    destructive: "bg-red-500/10 text-red-600 border border-red-500/20 hover:bg-red-500/20 dark:bg-red-900/50 dark:text-red-200 dark:border-red-900",
    outline: "border border-border bg-transparent hover:bg-black/5 dark:hover:bg-white/5 text-foreground",
    ghost: "hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground",
  };

  const sizes = {
    default: "h-11 px-4 py-2",
    sm: "h-9 rounded-md px-3",
    lg: "h-11 rounded-md px-8",
    icon: "h-10 w-10",
  };

  return (
    <button 
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
};

// --- Input ---
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input: React.FC<InputProps> = ({ className, ...props }) => {
  return (
    <input
      className={cn(
        "flex h-11 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
        className
      )}
      {...props}
    />
  );
};

// --- Card ---
export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => {
  return (
    <div className={cn("rounded-xl border border-border bg-card text-foreground shadow-sm transition-colors", className)} {...props}>
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => {
  return <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props}>{children}</div>;
};

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, children, ...props }) => {
  return <h3 className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props}>{children}</h3>;
};

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => {
  return <div className={cn("p-6 pt-0", className)} {...props}>{children}</div>;
};

// --- Badge ---
interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'outline' | 'secondary';
}

export const Badge: React.FC<BadgeProps> = ({ className, variant = 'default', ...props }) => {
  const variants = {
    default: "bg-primary text-black",
    success: "bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/20",
    warning: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20",
    destructive: "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/20",
    outline: "text-muted-foreground border border-border",
    secondary: "bg-black/5 dark:bg-white/10 text-muted-foreground",
  };
  
  return (
    <div className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", variants[variant], className)} {...props} />
  );
};

// --- Modal/Dialog ---
interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export const Dialog: React.FC<DialogProps> = ({ isOpen, onClose, title, children, maxWidth = "max-w-lg" }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className={cn("w-full rounded-[2rem] bg-card border border-border shadow-2xl animate-in fade-in zoom-in duration-200 overflow-hidden flex flex-col", maxWidth)}>
        <div className="flex items-center justify-between px-8 py-6 border-b border-border bg-black/20">
          <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-muted hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
};

// --- Toast (Simplified) ---
export const ToastContainer = () => <div id="toast-container" className="fixed top-4 right-4 z-[110] flex flex-col gap-2 pointer-events-none" />;

export const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  
  let bgClass = 'bg-green-600';
  if (type === 'error') bgClass = 'bg-red-600';
  if (type === 'warning') bgClass = 'bg-yellow-600';
  
  toast.className = `pointer-events-auto flex items-center w-full max-w-xs p-4 rounded-lg shadow-lg text-white ${bgClass} animate-in slide-in-from-right fade-in duration-300 mb-2`;
  
  toast.innerHTML = `
    <div class="text-sm font-normal">${message}</div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out', 'slide-out-to-right');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
};
