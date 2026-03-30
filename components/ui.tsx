import React, { ButtonHTMLAttributes, InputHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Utility ---
export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

// --- Responsive Helpers ---
export const MobileView: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cn("block md:hidden", className)}>{children}</div>
);

export const DesktopView: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cn("hidden md:block", className)}>{children}</div>
);

// --- Button ---
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'glass';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  className, variant = 'primary', size = 'default', isLoading, children, disabled, ...props
}) => {
  const baseStyles = "inline-flex items-center justify-center rounded-xl font-bold uppercase tracking-widest transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-50 disabled:pointer-events-none active:scale-95 select-none";

  const variants = {
    // Primary: Brand Gold, high prominence
    primary: "bg-primary text-black shadow-[0_4px_20px_-5px_var(--primary-glow)] hover:shadow-[0_8px_30px_-5px_var(--primary-glow)] hover:-translate-y-0.5 border border-primary/20",

    // Secondary: Brand Lime, for alternative success actions
    secondary: "bg-secondary text-black shadow-[0_4px_15px_-3px_var(--bubble-2)] hover:shadow-[0_8px_25px_-3px_var(--bubble-2)] hover:-translate-y-0.5",

    // Destructive: Subtle background, clear red text/border
    destructive: "bg-red-500/5 text-red-500 border border-red-500/20 hover:bg-red-500/10",

    // Outline: Professional, low weight
    outline: "border border-primary/20 bg-white/5 hover:bg-white/10 text-foreground backdrop-blur-sm",

    // Ghost: Contextual, blends into background
    ghost: "hover:bg-white/5 text-muted-foreground hover:text-foreground",

    // Glass: Specialized elevated surface
    glass: "bg-white/5 backdrop-blur-md border border-primary/20 text-foreground hover:bg-white/10 shadow-lg"
  };

  const sizes = {
    default: "h-11 px-6 text-[10px]",
    sm: "h-9 rounded-lg px-4 text-[9px]",
    lg: "h-12 rounded-2xl px-10 text-xs",
    icon: "h-11 w-11",
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
interface InputProps extends InputHTMLAttributes<HTMLInputElement> { }

export const Input: React.FC<InputProps> = ({ className, ...props }) => {
  return (
    <input
      className={cn(
        "flex h-11 w-full rounded-xl border border-primary/20 bg-[var(--input-bg)] px-3 py-2 text-sm text-foreground shadow-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-300 hover:border-primary/40",
        className
      )}
      {...props}
    />
  );
};

// --- Card ---
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'interactive' | 'outline';
}

export const Card: React.FC<CardProps> = ({ className, variant = 'default', children, ...props }) => {
  const variants = {
    // Default surface: Highly opaque for depth
    default: "bg-card border-primary/20 shadow-xl",
    // Elevated: Near-solid for maximum contrast
    elevated: "bg-card border-primary/30 shadow-2xl",
    // Interactive: Clear feedback
    interactive: "bg-card border-primary/20 hover:border-primary/40 hover:bg-muted/10 cursor-pointer shadow-md hover:shadow-xl",
    // Outline: Minimal weight
    outline: "bg-transparent border-primary/20"
  };

  return (
    <div
      className={cn(
        "rounded-[1.5rem] border text-foreground transition-all duration-300",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => {
  return <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props}>{children}</div>;
};

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, children, ...props }) => {
  return <h3 className={cn("text-lg font-bold leading-none tracking-tight", className)} {...props}>{children}</h3>;
};

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => {
  return <div className={cn("p-6 pt-0", className)} {...props}>{children}</div>;
};

// --- Badge ---
interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'outline' | 'secondary' | 'glass';
}

export const Badge: React.FC<BadgeProps> = ({ className, variant = 'default', ...props }) => {
  const variants = {
    default: "bg-primary text-black shadow-[0_0_10px_-2px_var(--primary-glow)]",
    success: "bg-green-500/15 text-green-500 border border-green-500/20",
    warning: "bg-yellow-500/15 text-yellow-500 border border-yellow-500/20",
    destructive: "bg-red-500/15 text-red-500 border border-red-500/20",
    outline: "text-muted-foreground border border-border",
    secondary: "bg-white/5 text-muted-foreground",
    glass: "bg-white/5 backdrop-blur-md border border-primary/20 text-foreground"
  };

  return (
    <div className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold transition-colors uppercase tracking-wider", variants[variant], className)} {...props} />
  );
};

// --- Modal/Dialog ---
interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
  showTitle?: boolean;
}

export const Dialog: React.FC<DialogProps> = ({ isOpen, onClose, title, children, maxWidth = "max-w-lg", showTitle = true }) => {
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = 'unset'; };
    }
  }, [isOpen]);

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/90 backdrop-blur-2xl transition-all"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            transition={{ type: "spring", damping: 25, stiffness: 450 }}
            className={cn(
              "w-full max-h-[95vh] rounded-[1.5rem] bg-card border border-primary/20 shadow-2xl overflow-hidden flex flex-col relative backdrop-blur-xl", 
              maxWidth
            )}
          >
            {/* Soft Header highlight */}
            <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-muted-foreground/10 to-transparent pointer-events-none opacity-50" />
            
            {showTitle && (
              <div className="flex items-center justify-between px-6 py-5 md:px-10 md:py-8 border-b border-primary/20 bg-card/40 backdrop-blur-xl relative z-10 shrink-0">
                <h2 className="text-lg md:text-xl font-black text-foreground tracking-tighter uppercase">{title}</h2>
                <button 
                  onClick={onClose} 
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-primary/5 border border-primary/20 text-muted hover:text-foreground hover:bg-primary/10 hover:shadow-lg transition-all duration-500 hover:rotate-90 group"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:scale-110"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 relative z-0">
              <div className="p-4">
                {children}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
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

  toast.className = `pointer-events-auto flex items-center w-full max-w-xs p-4 rounded-xl shadow-2xl text-white ${bgClass} animate-in slide-in-from-right fade-in duration-300 mb-2 border border-primary/20 backdrop-blur-md`;

  toast.innerHTML = `
    <div class="text-sm font-bold tracking-wide">${message}</div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out', 'slide-out-to-right');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
};
