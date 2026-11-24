import React from 'react';

export type ToastVariant = 'default' | 'warning' | 'critical';

interface ToastProps {
  message: string | null;
  variant?: ToastVariant;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  variant = 'default',
  actionLabel,
  onAction,
  onDismiss,
}) => {
  const borderClass =
    variant === 'critical'
      ? 'border-red-500/80 bg-red-950/95 shadow-red-950/60'
      : variant === 'warning'
        ? 'border-amber-400/80 bg-charcoal/95 shadow-amber-950/50'
        : 'border-gold/60 bg-slateDark';

  const dotClass =
    variant === 'critical'
      ? 'bg-red-400'
      : variant === 'warning'
        ? 'bg-amber-400'
        : 'bg-crimson-light';

  return (
    <div
      className={`fixed bottom-5 right-5 z-50 max-w-md transform transition-all duration-300 ${
        message ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-20 opacity-0 pointer-events-none'
      }`}
    >
      <div
        className={`border text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 ${borderClass}`}
      >
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotClass}`} />
        <span className="text-xs font-semibold leading-snug">{message || 'Action effectuée'}</span>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="ml-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-gold hover:bg-gold-light text-obsidian transition shrink-0 cursor-pointer"
          >
            {actionLabel}
          </button>
        )}
        {variant !== 'default' && onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Fermer la notification"
            className="text-zinc-400 hover:text-white text-sm font-bold leading-none px-1 cursor-pointer shrink-0"
          >
            &times;
          </button>
        )}
      </div>
    </div>
  );
};
