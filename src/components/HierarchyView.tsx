import React, { useState } from 'react';
import { HIER_TIERS, HIER_UNITS } from '@/src/data/cartelData';
import type { HierarchyMember, HierarchyUnitKey } from '@/src/types/cartel';

interface HierarchyViewProps {
  members: HierarchyMember[];
  readonly: boolean;
  onSaveMember: (member: {
    id?: string;
    name: string;
    unit: HierarchyUnitKey;
    dossier: string;
  }) => void;
  onDeleteMember: (id: string) => void;
  onShowToast: (msg: string) => void;
}

const UNIT_KEYS = Object.keys(HIER_UNITS) as HierarchyUnitKey[];

export const HierarchyView: React.FC<HierarchyViewProps> = ({
  members,
  readonly,
  onSaveMember,
  onDeleteMember,
  onShowToast,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [unitInput, setUnitInput] = useState<HierarchyUnitKey>('mando');
  const [dossierInput, setDossierInput] = useState('');
  const [delArmId, setDelArmId] = useState<string | null>(null);

  const sortedMembers = [...members].sort(
    (x, y) => (x.order || 0) - (y.order || 0) || x.name.localeCompare(y.name)
  );

  const resetForm = () => {
    setEditingId(null);
    setNameInput('');
    setDossierInput('');
    setUnitInput('mando');
  };

  const handleEdit = (m: HierarchyMember) => {
    setEditingId(m.id);
    setNameInput(m.name);
    setUnitInput(m.unit);
    setDossierInput(m.dossier || '');
  };

  const handleSave = () => {
    if (readonly) return;
    const trimmedName = nameInput.trim();
    const trimmedDossier = dossierInput.trim();
    if (!trimmedName) {
      onShowToast('Indique le nom du membre.');
      return;
    }
    if (trimmedDossier && !/^https:\/\//i.test(trimmedDossier)) {
      onShowToast('Le lien du dossier doit commencer par https://');
      return;
    }
    onSaveMember({
      id: editingId || undefined,
      name: trimmedName,
      unit: unitInput,
      dossier: trimmedDossier,
    });
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (readonly) return;
    if (delArmId !== id) {
      setDelArmId(id);
      return;
    }
    setDelArmId(null);
    if (editingId === id) resetForm();
    onDeleteMember(id);
  };

  const renderMemberRow = (m: HierarchyMember) => (
    <div
      key={m.id}
      className="rounded-md bg-charcoal border border-zinc-800 px-3 py-1.5 text-sm text-zinc-100 flex items-center justify-between gap-2"
    >
      <span className="font-semibold">{m.name}</span>
      <span className="flex items-center gap-2 shrink-0">
        {m.dossier && /^https:\/\//i.test(m.dossier) && (
          <a
            href={m.dossier}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-bold text-gold hover:text-gold-light underline"
          >
            Dossier
          </a>
        )}
        {!readonly && (
          <>
            <button
              type="button"
              title="Modifier"
              onClick={() => handleEdit(m)}
              className="text-zinc-400 hover:text-gold text-xs cursor-pointer"
            >
              ✎
            </button>
            <button
              type="button"
              title="Supprimer"
              onClick={() => handleDelete(m.id)}
              className={`text-xs cursor-pointer ${
                delArmId === m.id
                  ? 'text-red-300 font-bold'
                  : 'text-zinc-400 hover:text-red-400'
              }`}
            >
              {delArmId === m.id ? 'Confirmer ?' : '✕'}
            </button>
          </>
        )}
      </span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-charcoal/90 gold-border rounded-2xl p-6 shadow-xl">
        <div className="text-center pb-5 border-b border-zinc-800">
          <h2 className="font-display text-xl sm:text-2xl font-extrabold tracking-wider text-gold">
            HIÉRARCHIE DU CARTEL
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Membres et postes, du plus haut grade au plus bas
          </p>
        </div>

        {!readonly && (
          <div className="mt-5 rounded-xl border border-gold/40 bg-obsidian/70 p-4 space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gold">
              {editingId ? `Modifier : ${nameInput}` : 'Ajouter un membre'}
            </div>
            <div className="grid sm:grid-cols-3 gap-2">
              <input
                type="text"
                maxLength={60}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Nom du membre"
                className="bg-obsidian border border-zinc-700 focus:border-gold outline-none rounded-lg px-3 py-2 text-sm text-white"
              />
              <select
                value={unitInput}
                onChange={(e) => setUnitInput(e.target.value as HierarchyUnitKey)}
                className="bg-obsidian border border-zinc-700 focus:border-gold outline-none rounded-lg px-3 py-2 text-sm text-white"
              >
                {UNIT_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {HIER_UNITS[k]}
                  </option>
                ))}
              </select>
              <input
                type="url"
                value={dossierInput}
                onChange={(e) => setDossierInput(e.target.value)}
                placeholder="Lien du dossier (https://...)"
                className="bg-obsidian border border-zinc-700 focus:border-gold outline-none rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-gold hover:bg-gold-light text-obsidian transition cursor-pointer"
              >
                {editingId ? 'Enregistrer' : 'Ajouter'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-charcoal border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition cursor-pointer"
                >
                  Annuler
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col items-center pt-6">
          {HIER_TIERS.map((tier, idx) => (
            <React.Fragment key={tier.title}>
              {idx > 0 && <div className="w-px h-8 bg-gold/50" />}
              <div
                className={
                  tier.top
                    ? 'w-full max-w-md text-center rounded-xl border-2 border-gold bg-gradient-to-b from-gold/15 to-obsidian p-5 shadow-lg shadow-gold/10'
                    : 'w-full rounded-xl border border-red-900/70 bg-slateDark/80 p-5'
                }
              >
                <div className="text-center">
                  <div
                    className={`text-[10px] font-bold tracking-[0.3em] uppercase ${
                      tier.top ? 'text-gold' : 'text-red-500'
                    }`}
                  >
                    {tier.grade}
                  </div>
                  <div
                    className={`font-display font-extrabold text-white ${
                      tier.top ? 'text-xl mt-1' : 'text-lg'
                    }`}
                  >
                    {tier.title}
                  </div>
                </div>

                {tier.units.length === 1 ? (
                  <div
                    className={
                      tier.flat ? 'grid sm:grid-cols-2 gap-2 mt-4' : 'space-y-2 mt-3 text-left'
                    }
                  >
                    {sortedMembers.filter((m) => m.unit === tier.units[0]).length > 0 ? (
                      sortedMembers
                        .filter((m) => m.unit === tier.units[0])
                        .map((m) => renderMemberRow(m))
                    ) : (
                      <p className="text-sm italic text-zinc-500">Pas encore de recrue</p>
                    )}
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-4 mt-4">
                    {tier.units.map((unitKey) => {
                      const unitMembers = sortedMembers.filter((m) => m.unit === unitKey);
                      return (
                        <div
                          key={unitKey}
                          className="rounded-lg border border-zinc-700 bg-obsidian/70 p-4"
                        >
                          <div className="font-display text-sm font-bold text-gold">
                            {HIER_UNITS[unitKey]}
                          </div>
                          <div className="mt-2 space-y-1.5">
                            {unitMembers.length > 0 ? (
                              unitMembers.map((m) => renderMemberRow(m))
                            ) : (
                              <p className="text-sm italic text-zinc-500">Pas encore de recrue</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </React.Fragment>
          ))}
        </div>

        {readonly && (
          <p className="text-[11px] text-zinc-500 text-center mt-4">
            Déverrouille le mode éditeur (badge en haut) pour ajouter ou modifier des membres.
          </p>
        )}
      </div>
    </div>
  );
};
