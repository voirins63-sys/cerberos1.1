import React, { useEffect, useState } from 'react';

interface AuthModalProps {
  open: boolean;
  isUnlocked: boolean;
  onClose: () => void;
  onVerifyCode: (code: string) => Promise<boolean>;
  onLock: () => Promise<void>;
  onUpdateSecretCode: (newCode: string) => Promise<void>;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  open,
  isUnlocked,
  onClose,
  onVerifyCode,
  onLock,
  onUpdateSecretCode,
}) => {
  const [codeInput, setCodeInput] = useState('');
  const [newCodeInput, setNewCodeInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setCodeInput('');
      setNewCodeInput('');
      setIsSubmitting(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onVerifyCode(codeInput);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-charcoal gold-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
            <span className="text-gold">🔑</span> Accès Éditeur — LOS CERBEROS
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white text-lg font-bold cursor-pointer"
            aria-label="Fermer"
          >
            &times;
          </button>
        </div>

        <p className="text-xs text-zinc-300 leading-relaxed">
          Entrez le <strong>Code Secret du Cartel</strong> pour activer la modification en temps réel du planning, des gains et des stocks. Les autres membres restent en lecture seule.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="secret-code-input"
              className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5"
            >
              Code Secret
            </label>
            <input
              id="secret-code-input"
              type="password"
              autoFocus
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="Entrez le code secret..."
              className="w-full bg-obsidian border border-zinc-700 focus:border-gold rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
            />
          </div>

          {isUnlocked && (
            <div className="pt-2 border-t border-zinc-800 space-y-2">
              <label
                htmlFor="new-secret-code-input"
                className="block text-[11px] font-bold uppercase tracking-wider text-gold"
              >
                Changer le code secret :
              </label>
              <div className="flex gap-2">
                <input
                  id="new-secret-code-input"
                  type="text"
                  value={newCodeInput}
                  onChange={(e) => setNewCodeInput(e.target.value)}
                  placeholder="Nouveau code secret"
                  className="flex-1 bg-obsidian border border-zinc-700 focus:border-gold rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={async () => {
                    if (isSubmitting) return;
                    setIsSubmitting(true);
                    try {
                      await onUpdateSecretCode(newCodeInput);
                      setNewCodeInput('');
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-gold border border-gold/40 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 flex-wrap">
            {isUnlocked && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={async () => {
                  if (isSubmitting) return;
                  setIsSubmitting(true);
                  try {
                    await onLock();
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-crimson/20 text-red-300 border border-crimson/40 hover:bg-crimson/30 disabled:opacity-50 transition cursor-pointer"
              >
                Verrouiller (Lecture seule)
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer"
            >
              Fermer
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-gold hover:bg-gold-light disabled:opacity-50 text-obsidian transition shadow-lg cursor-pointer"
            >
              {isSubmitting ? 'Vérification...' : 'Déverrouiller'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
