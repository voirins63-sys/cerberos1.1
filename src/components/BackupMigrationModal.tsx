import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FileJson,
  Upload,
  X,
} from 'lucide-react';
import {
  type CartelBackupPreview,
  type CartelBackupSnapshot,
  parseCartelBackupSnapshot,
} from '@/src/services/cartelFirestore';
import { formatMoney } from '@/src/utils/finance';

interface BackupMigrationModalProps {
  open: boolean;
  isUnlocked: boolean;
  onClose: () => void;
  onExportBackup: () => Promise<CartelBackupSnapshot>;
  onImportBackup: (snapshot: CartelBackupSnapshot) => Promise<void>;
}

export const BackupMigrationModal: React.FC<BackupMigrationModalProps> = ({
  open,
  isUnlocked,
  onClose,
  onExportBackup,
  onImportBackup,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [pendingImport, setPendingImport] = useState<{
    fileName: string;
    snapshot: CartelBackupSnapshot;
    preview: CartelBackupPreview;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPendingImport(null);
      setErrorMsg(null);
      setSuccessMsg(null);
      setIsExporting(false);
      setIsImporting(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isExporting && !isImporting) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, isExporting, isImporting]);

  if (!open) return null;

  const handleExportClick = async () => {
    if (isExporting) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsExporting(true);
    try {
      const snapshot = await onExportBackup();
      const dateStamp = new Date().toISOString().slice(0, 10);
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `los-cerberos-sauvegarde-${dateStamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccessMsg(
        `Sauvegarde exportée (${Object.keys(snapshot.missions.entries).length} missions, ${snapshot.hierarchy.members.length} membres, ${Object.keys(snapshot.history.archives).length} archives).`
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Impossible de générer le fichier de sauvegarde.'
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setPendingImport(null);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const { snapshot, preview } = parseCartelBackupSnapshot(parsed);
      setPendingImport({
        fileName: file.name,
        snapshot,
        preview,
      });
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Fichier JSON illisible ou format invalide.'
      );
    }
  };

  const handleConfirmImport = async () => {
    if (!pendingImport || isImporting || !isUnlocked) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsImporting(true);
    try {
      await onImportBackup(pendingImport.snapshot);
      setSuccessMsg('Importation terminée : toutes les données du cartel ont été restaurées.');
      setPendingImport(null);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Erreur lors de l'importation dans Firestore."
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={() => {
        if (!isExporting && !isImporting) onClose();
      }}
    >
      <div
        className="bg-charcoal gold-border rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gold/15 border border-gold/40 flex items-center justify-center text-gold">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-white">
                Sauvegarde &amp; Migration JSON
              </h3>
              <p className="text-[11px] text-zinc-400">
                Exportez ou restaurez toutes les données du cartel en un clic
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isExporting || isImporting}
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg transition cursor-pointer disabled:opacity-40"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Export section */}
        <div className="bg-obsidian/80 border border-zinc-800 rounded-xl p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-gold-light flex items-center gap-1.5">
                <Download className="w-4 h-4 text-gold" />
                Exporter une sauvegarde complète
              </h4>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Télécharge un fichier <code className="text-zinc-200">.json</code> contenant le
                planning, les stocks, les armes, la trésorerie, la hiérarchie, le classement,
                le catalogue, les archives, les paies et l&apos;album photo. Les codes secrets et
                webhooks Discord ne sont pas inclus.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isExporting || isImporting}
            onClick={handleExportClick}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold bg-gold hover:bg-gold-light disabled:opacity-50 text-obsidian transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <FileJson className="w-4 h-4" />
            {isExporting ? 'Préparation du fichier...' : 'Télécharger la sauvegarde (.json)'}
          </button>
        </div>

        {/* Import section */}
        <div className="bg-obsidian/80 border border-zinc-800 rounded-xl p-4 space-y-3">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Upload className="w-4 h-4 text-gold" />
              Importer / Restaurer une sauvegarde
            </h4>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              Chargez un fichier <code className="text-zinc-200">.json</code> exporté depuis
              Los Cerberos pour migrer ou restaurer les données sur cette base Firebase.
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFileChange}
            className="hidden"
          />

          {!isUnlocked ? (
            <p className="text-xs text-amber-300 bg-amber-950/40 border border-amber-500/30 rounded-lg px-3 py-2">
              Passez en mode <strong>Éditeur</strong> pour pouvoir importer une sauvegarde.
            </p>
          ) : (
            <button
              type="button"
              disabled={isExporting || isImporting}
              onClick={() => fileInputRef.current?.click()}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-100 border border-gold/35 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4 text-gold" />
              Choisir un fichier .json
            </button>
          )}

          {pendingImport && (
            <div className="mt-3 bg-charcoal border border-gold/40 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-gold-light truncate">
                  📄 {pendingImport.fileName}
                </span>
                <span className="text-[10px] font-mono text-zinc-400 shrink-0">
                  Semaine {pendingImport.preview.week}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                <div className="bg-obsidian/80 rounded-lg px-2.5 py-2 border border-zinc-800">
                  <div className="text-zinc-400">Trésorerie Propre</div>
                  <div className="font-mono font-bold text-emerald-400">
                    {formatMoney(pendingImport.preview.legal)}
                  </div>
                </div>
                <div className="bg-obsidian/80 rounded-lg px-2.5 py-2 border border-zinc-800">
                  <div className="text-zinc-400">Argent Sale</div>
                  <div className="font-mono font-bold text-crimson-light">
                    {formatMoney(pendingImport.preview.illegal)}
                  </div>
                </div>
                <div className="bg-obsidian/80 rounded-lg px-2.5 py-2 border border-zinc-800">
                  <div className="text-zinc-400">Membres</div>
                  <div className="font-mono font-bold text-white">
                    {pendingImport.preview.membersCount}
                  </div>
                </div>
                <div className="bg-obsidian/80 rounded-lg px-2.5 py-2 border border-zinc-800">
                  <div className="text-zinc-400">Stocks / Armes</div>
                  <div className="font-mono font-bold text-white">
                    {pendingImport.preview.inventoryCount} / {pendingImport.preview.weaponsCount}
                  </div>
                </div>
                <div className="bg-obsidian/80 rounded-lg px-2.5 py-2 border border-zinc-800">
                  <div className="text-zinc-400">Archives / Album</div>
                  <div className="font-mono font-bold text-white">
                    {pendingImport.preview.archivesCount} / {pendingImport.preview.albumPhotosCount}
                  </div>
                </div>
                <div className="bg-obsidian/80 rounded-lg px-2.5 py-2 border border-zinc-800">
                  <div className="text-zinc-400">Missions / Catalogues</div>
                  <div className="font-mono font-bold text-white">
                    {pendingImport.preview.missionCount} / {pendingImport.preview.catalogGroupsCount}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2 text-[11px] text-amber-200 bg-amber-950/40 border border-amber-500/35 rounded-lg p-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  Confirmer remplacera les données actuelles de cette base Firebase par le contenu
                  de cette sauvegarde.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={isImporting}
                  onClick={() => setPendingImport(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={isImporting}
                  onClick={handleConfirmImport}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition cursor-pointer"
                >
                  {isImporting ? 'Restauration en cours...' : 'Confirmer la restauration'}
                </button>
              </div>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="text-xs text-red-200 bg-crimson-dark/50 border border-crimson/60 rounded-xl px-3.5 py-2.5 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-crimson-light shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="text-xs text-emerald-200 bg-emerald-950/60 border border-emerald-500/40 rounded-xl px-3.5 py-2.5 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button
            type="button"
            disabled={isExporting || isImporting}
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer disabled:opacity-40"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
