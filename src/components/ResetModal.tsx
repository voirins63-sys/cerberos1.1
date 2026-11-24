import React, { useEffect, useState } from 'react';
import { AlertTriangle, Archive } from 'lucide-react';

interface ResetModalProps {
  open: boolean;
  hasWeekActivity?: boolean;
  onClose: () => void;
  onConfirm: (archiveBeforeReset: boolean) => void;
}

export const ResetModal: React.FC<ResetModalProps> = ({
  open,
  hasWeekActivity = false,
  onClose,
  onConfirm,
}) => {
  const [archiveBeforeReset, setArchiveBeforeReset] = useState(hasWeekActivity);

  useEffect(() => {
    if (open) {
      setArchiveBeforeReset(hasWeekActivity);
    }
  }, [open, hasWeekActivity]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-charcoal gold-border rounded-2xl max-w-md w-full p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 text-red-400 mb-3">
          <div className="w-10 h-10 rounded-full bg-crimson/20 border border-crimson-light/40 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <h3 className="font-display text-lg font-bold text-white">
            Réinitialiser la semaine ?
          </h3>
        </div>

        <p className="text-sm text-zinc-300 leading-relaxed mb-4">
          Toutes les cases cochées, les gains enregistrés, les pertes globales de la semaine et la paye en cours de{' '}
          <strong className="text-white">LOS CERBEROS</strong> seront remis à zéro.
        </p>

        <label className="flex items-start gap-2.5 rounded-xl bg-obsidian/80 border border-gold/35 px-3.5 py-3 mb-6 cursor-pointer hover:border-gold/60 transition">
          <input
            type="checkbox"
            checked={archiveBeforeReset}
            onChange={(e) => setArchiveBeforeReset(e.target.checked)}
            className="mt-0.5 accent-amber-400 w-4 h-4 shrink-0 cursor-pointer"
          />
          <span className="text-xs text-zinc-200 leading-relaxed">
            <span className="font-bold text-gold-light inline-flex items-center gap-1.5">
              <Archive className="w-3.5 h-3.5" />
              Archiver cette semaine dans l&apos;historique avant réinitialisation
            </span>
            <span className="block text-[11px] text-zinc-400 mt-0.5">
              Conserve le bilan comptable et le calcul de paye dans les Archives.
            </span>
          </span>
        </label>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => onConfirm(archiveBeforeReset)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-gold hover:bg-gold-light text-obsidian transition shadow-lg shadow-gold/20 cursor-pointer"
          >
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
};
