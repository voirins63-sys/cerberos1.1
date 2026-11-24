import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  EyeOff,
  Lock,
  Newspaper,
  RefreshCw,
  Save,
  Send,
  X,
} from 'lucide-react';
import {
  DEFAULT_DISCORD_CONFIG,
  isValidDiscordWebhookUrl,
} from '@/src/services/cartelFirestore';
import type {
  AlbumState,
  CatalogGroupsMap,
  DiscordGazetteConfig,
  HierarchyMember,
  InventoryPrices,
  InventoryStock,
  MemberRankingsMap,
  MissionScheduleMeta,
  MissionStates,
  RewardStocks,
  TreasuryMoney,
  WeaponsStock,
} from '@/src/types/cartel';
import {
  buildDailyGazetteData,
  type DailyGazetteData,
  getAllGazettePhotoChoices,
  renderGazetteCanvasDataUrl,
  sendGazetteToDiscord,
} from '@/src/utils/discordGazette';
import { isoDate } from '@/src/utils/finance';

interface DiscordGazetteModalProps {
  open: boolean;
  readonly: boolean;
  senderName: string;
  getIdToken: () => Promise<string>;
  discordConfig: DiscordGazetteConfig;
  hasEnvFallback?: boolean;
  missionStates: MissionStates;
  scheduleMeta: MissionScheduleMeta;
  inventoryStock: InventoryStock;
  inventoryPrices: InventoryPrices;
  weaponsStock: WeaponsStock;
  rewardStocks: RewardStocks;
  treasuryMoney: TreasuryMoney;
  weaponsLossAmount: number;
  hierMembers: HierarchyMember[];
  memberRankings: MemberRankingsMap;
  catalogGroups: CatalogGroupsMap;
  albumState: AlbumState;
  onClose: () => void;
  onSaveConfig: (nextConfig: DiscordGazetteConfig) => Promise<void>;
  onRequestUnlock: () => void;
  onShowToast: (msg: string) => void;
}

export const DiscordGazetteModal: React.FC<DiscordGazetteModalProps> = ({
  open,
  readonly,
  senderName,
  getIdToken,
  discordConfig,
  hasEnvFallback = false,
  missionStates,
  scheduleMeta,
  inventoryStock,
  inventoryPrices,
  weaponsStock,
  rewardStocks,
  treasuryMoney,
  weaponsLossAmount,
  hierMembers,
  memberRankings,
  catalogGroups,
  albumState,
  onClose,
  onSaveConfig,
  onRequestUnlock,
  onShowToast,
}) => {
  const [draftWebhook, setDraftWebhook] = useState('');
  const [draftAutoEnabled, setDraftAutoEnabled] = useState(false);
  const [draftHour, setDraftHour] = useState(9);
  const [draftMinute, setDraftMinute] = useState(30);
  const [draftIncludePhoto, setDraftIncludePhoto] = useState(true);
  const [draftCustomMessage, setDraftCustomMessage] = useState('');
  const [selectedPhotoId, setSelectedPhotoId] = useState<string>('');
  const [showWebhook, setShowWebhook] = useState(false);

  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<DailyGazetteData | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const photoChoices = useMemo(
    () => getAllGazettePhotoChoices(albumState),
    [albumState]
  );

  useEffect(() => {
    if (!open) return;
    setDraftWebhook(discordConfig.webhookUrl || '');
    setDraftAutoEnabled(Boolean(discordConfig.autoEnabled));
    setDraftHour(
      Number.isFinite(discordConfig.sendHour) ? discordConfig.sendHour : 9
    );
    setDraftMinute(
      Number.isFinite(discordConfig.sendMinute) ? discordConfig.sendMinute : 30
    );
    setDraftIncludePhoto(discordConfig.includePhoto ?? true);
    setDraftCustomMessage(discordConfig.customMessage || '');
    setErrorMsg(null);
  }, [open, discordConfig]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const regeneratePreview = useCallback(async () => {
    setIsRendering(true);
    setErrorMsg(null);
    try {
      const data = await buildDailyGazetteData({
        missionStates,
        scheduleMeta,
        inventoryStock,
        inventoryPrices,
        weaponsStock,
        rewardStocks,
        treasuryMoney,
        weaponsLossAmount,
        hierMembers,
        memberRankings,
        catalogGroups,
        albumState,
        customMessage: draftCustomMessage,
        selectedPhotoId: selectedPhotoId || undefined,
      });
      const url = await renderGazetteCanvasDataUrl(data, {
        includePhoto: draftIncludePhoto,
      });
      setPreviewData(data);
      setPreviewDataUrl(url);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Impossible de générer l’aperçu de la Gazette.'
      );
    } finally {
      setIsRendering(false);
    }
  }, [
    missionStates,
    scheduleMeta,
    inventoryStock,
    inventoryPrices,
    weaponsStock,
    rewardStocks,
    treasuryMoney,
    weaponsLossAmount,
    hierMembers,
    memberRankings,
    catalogGroups,
    albumState,
    draftCustomMessage,
    selectedPhotoId,
    draftIncludePhoto,
  ]);

  useEffect(() => {
    if (!open) return;
    void regeneratePreview();
  }, [open, selectedPhotoId, draftIncludePhoto, regeneratePreview]);

  if (!open) return null;

  const trimmedWebhook = draftWebhook.trim();
  const webhookValid =
    trimmedWebhook === '' || isValidDiscordWebhookUrl(trimmedWebhook);
  const canSendNow =
    isValidDiscordWebhookUrl(trimmedWebhook) ||
    (trimmedWebhook === '' && hasEnvFallback);

  const buildNextConfig = (overrides?: Partial<DiscordGazetteConfig>): DiscordGazetteConfig => ({
    ...DEFAULT_DISCORD_CONFIG,
    ...discordConfig,
    webhookUrl: trimmedWebhook,
    autoEnabled: draftAutoEnabled,
    sendHour: Math.max(0, Math.min(23, Math.trunc(Number(draftHour) || 0))),
    sendMinute: Math.max(0, Math.min(59, Math.trunc(Number(draftMinute) || 0))),
    includePhoto: draftIncludePhoto,
    customMessage: draftCustomMessage.trim().slice(0, 300),
    ...overrides,
  });

  const handleSave = async () => {
    if (readonly || isSaving) return;
    if (!webhookValid) {
      setErrorMsg(
        'Le lien Webhook doit commencer par https://discord.com/api/webhooks/...'
      );
      return;
    }
    setIsSaving(true);
    setErrorMsg(null);
    try {
      await onSaveConfig(buildNextConfig());
      onShowToast('Configuration Discord enregistrée.');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendNow = async () => {
    if (readonly || isSending) return;
    if (!canSendNow) {
      setErrorMsg(
        'Renseignez un lien Webhook Discord valide (https://discord.com/api/webhooks/...) avant d’envoyer.'
      );
      return;
    }

    setIsSending(true);
    setErrorMsg(null);
    try {
      const data = await buildDailyGazetteData({
        missionStates,
        scheduleMeta,
        inventoryStock,
        inventoryPrices,
        weaponsStock,
        rewardStocks,
        treasuryMoney,
        weaponsLossAmount,
        hierMembers,
        memberRankings,
        catalogGroups,
        albumState,
        customMessage: draftCustomMessage,
        selectedPhotoId: selectedPhotoId || undefined,
      });
      const imageBase64 = await renderGazetteCanvasDataUrl(data, {
        includePhoto: draftIncludePhoto,
      });
      setPreviewData(data);
      setPreviewDataUrl(imageBase64);

      const idToken = await getIdToken();
      await sendGazetteToDiscord({
        idToken,
        webhookUrl: trimmedWebhook,
        imageBase64,
        data,
      });

      const todayIso = isoDate(new Date());
      await onSaveConfig(
        buildNextConfig({
          lastSentDate: todayIso,
          lastSentAt: new Date().toISOString().slice(0, 40),
          lastSentBy: senderName.slice(0, 80),
        })
      );

      onShowToast('Gazette envoyée sur Discord avec succès.');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Échec de l’envoi sur Discord.'
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleDownloadPng = () => {
    if (!previewDataUrl) return;
    const link = document.createElement('a');
    link.href = previewDataUrl;
    link.download = `gazette-los-cerberos-${previewData?.todayIso || isoDate(new Date())}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onShowToast('Image PNG téléchargée.');
  };

  const todayIso = isoDate(new Date());
  const alreadySentToday = discordConfig.lastSentDate === todayIso;
  const formattedLastSent = discordConfig.lastSentAt
    ? new Date(discordConfig.lastSentAt).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 sm:p-5 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-charcoal gold-border rounded-2xl max-w-5xl w-full p-5 sm:p-6 shadow-2xl space-y-5 my-auto max-h-[94vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-bronze/40 pb-3.5">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-gold-light flex items-center gap-1.5">
              <Newspaper className="w-3.5 h-3.5 text-gold" />
              Rapport Visuel &amp; Envoi Salon Discord
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-extrabold text-white mt-0.5">
              La Gazette Quotidienne — Los Cerberos
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-obsidian/70 hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left: Aperçu PNG */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                Aperçu de la carte PNG (1200×760)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void regeneratePreview()}
                  disabled={isRendering}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-obsidian hover:bg-slateDark text-zinc-200 border border-bronze/50 transition inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRendering ? 'animate-spin' : ''}`} />
                  Actualiser
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPng}
                  disabled={!previewDataUrl || isRendering}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-gold/15 hover:bg-gold hover:text-obsidian text-gold-light border border-gold/45 transition inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  Télécharger PNG
                </button>
              </div>
            </div>

            <div className="relative rounded-xl overflow-hidden border border-gold/40 bg-obsidian aspect-[1200/760] flex items-center justify-center shadow-xl">
              {previewDataUrl ? (
                <img
                  src={previewDataUrl}
                  alt="Aperçu Gazette Quotidienne Los Cerberos"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-xs text-zinc-400 p-6 text-center">
                  Génération de la Gazette en cours...
                </div>
              )}
              {isRendering && (
                <div className="absolute inset-0 bg-obsidian/65 flex items-center justify-center text-xs font-semibold text-gold">
                  Rendu de l&apos;image en cours...
                </div>
              )}
            </div>

            {/* Sélecteur photo du jour */}
            <div className="bg-obsidian/70 border border-bronze/40 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-gold-light shrink-0">
                <Camera className="w-4 h-4 text-gold" />
                Photo du jour :
              </div>
              <select
                value={selectedPhotoId}
                onChange={(e) => setSelectedPhotoId(e.target.value)}
                className="flex-1 bg-charcoal border border-zinc-700 focus:border-gold rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
              >
                <option value="">Rotation automatique quotidienne (Album)</option>
                {photoChoices.map((photo) => (
                  <option key={photo.id} value={photo.id}>
                    {photo.title} {photo.location ? `— ${photo.location}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Right: Webhook & Automatisation 09h30 */}
          <div className="lg:col-span-5 space-y-4 bg-obsidian/60 border border-bronze/45 rounded-xl p-4">
            {readonly ? (
              <div className="space-y-3 py-4 text-center">
                <Lock className="w-7 h-7 text-gold mx-auto" />
                <h3 className="font-display text-base font-bold text-white">
                  Configuration réservée aux Éditeurs
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Vous pouvez prévisualiser et télécharger la Gazette ci-contre. Déverrouillez le mode éditeur pour configurer le Webhook Discord ou envoyer le briefing dans le salon.
                </p>
                <button
                  type="button"
                  onClick={onRequestUnlock}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-gold hover:bg-gold-light text-obsidian transition cursor-pointer"
                >
                  🔑 Déverrouiller l&apos;édition
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="discord-webhook-input"
                      className="text-[11px] font-bold uppercase tracking-wider text-gold-light"
                    >
                      Lien Webhook Discord (modifiable à tout moment)
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowWebhook((v) => !v)}
                      className="text-[11px] text-zinc-400 hover:text-white inline-flex items-center gap-1 cursor-pointer"
                    >
                      {showWebhook ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" /> Masquer
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" /> Afficher
                        </>
                      )}
                    </button>
                  </div>
                  <input
                    id="discord-webhook-input"
                    type={showWebhook ? 'text' : 'password'}
                    value={draftWebhook}
                    onChange={(e) => setDraftWebhook(e.target.value)}
                    placeholder={
                      hasEnvFallback
                        ? 'Webhook serveur par défaut actif (laissez vide ou collez-en un autre)'
                        : 'https://discord.com/api/webhooks/...'
                    }
                    className={`w-full bg-charcoal border rounded-xl px-3 py-2 text-xs text-white focus:outline-none ${
                      webhookValid
                        ? 'border-zinc-700 focus:border-gold'
                        : 'border-crimson-light focus:border-crimson-light'
                    }`}
                  />
                  {hasEnvFallback && trimmedWebhook === '' && (
                    <div className="rounded-lg bg-emerald-950/50 border border-emerald-500/40 px-2.5 py-1.5 text-[11px] text-emerald-200 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>
                        Webhook Discord configuré sur le serveur. Collez un autre lien ici si vous changez de serveur.
                      </span>
                    </div>
                  )}
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Vous pouvez tester avec un salon provisoire puis remplacer ce lien à tout moment par celui du Discord principal du cartel.
                  </p>
                </div>

                {/* Note du jour */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="gazette-custom-msg"
                    className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300"
                  >
                    Mot / Consigne du Commandement (optionnel)
                  </label>
                  <textarea
                    id="gazette-custom-msg"
                    rows={2}
                    maxLength={300}
                    value={draftCustomMessage}
                    onChange={(e) => setDraftCustomMessage(e.target.value)}
                    placeholder="Ex : Rassemblement à 21h devant l’hacienda pour la Fleeca..."
                    className="w-full bg-charcoal border border-zinc-700 focus:border-gold rounded-xl px-3 py-2 text-xs text-white focus:outline-none resize-none"
                  />
                </div>

                {/* Options */}
                <div className="space-y-2.5 pt-1 border-t border-bronze/35">
                  <label className="flex items-center gap-2.5 text-xs text-zinc-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draftIncludePhoto}
                      onChange={(e) => setDraftIncludePhoto(e.target.checked)}
                      className="rounded border-zinc-600 bg-charcoal text-gold focus:ring-gold"
                    />
                    Inclure la photo de l&apos;album dans l&apos;image
                  </label>

                  <label className="flex items-start gap-2.5 text-xs text-zinc-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draftAutoEnabled}
                      onChange={(e) => setDraftAutoEnabled(e.target.checked)}
                      className="mt-0.5 rounded border-zinc-600 bg-charcoal text-gold focus:ring-gold"
                    />
                    <span>
                      <strong className="text-gold-light">Envoi automatique quotidien</strong>{' '}
                      (dès qu&apos;un éditeur ouvre le site après l&apos;heure choisie, 1 fois/jour)
                    </span>
                  </label>

                  <div className="flex items-center gap-2 pl-6">
                    <Clock className="w-3.5 h-3.5 text-gold" />
                    <span className="text-[11px] text-zinc-400">Heure d&apos;envoi :</span>
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={draftHour}
                      onChange={(e) => setDraftHour(Number(e.target.value))}
                      className="w-14 bg-charcoal border border-zinc-700 focus:border-gold rounded-lg px-2 py-1 text-xs text-white text-center font-mono"
                    />
                    <span className="text-xs text-zinc-400">h</span>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={draftMinute}
                      onChange={(e) => setDraftMinute(Number(e.target.value))}
                      className="w-14 bg-charcoal border border-zinc-700 focus:border-gold rounded-lg px-2 py-1 text-xs text-white text-center font-mono"
                    />
                  </div>
                </div>

                {/* Statut dernier envoi */}
                <div className="rounded-xl bg-charcoal/80 border border-bronze/35 px-3 py-2 text-[11px] flex items-center justify-between gap-2">
                  <span className="text-zinc-400 flex items-center gap-1.5">
                    {alreadySentToday ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    )}
                    {discordConfig.lastSentDate
                      ? `Dernier envoi : ${formattedLastSent || discordConfig.lastSentDate}${discordConfig.lastSentBy ? ` (${discordConfig.lastSentBy})` : ''}`
                      : 'Aucun envoi Discord enregistré'}
                  </span>
                  {alreadySentToday && (
                    <span className="text-emerald-400 font-bold shrink-0">Fait</span>
                  )}
                </div>

                {errorMsg && (
                  <div className="rounded-xl bg-crimson/20 border border-crimson-light/60 px-3 py-2 text-xs text-red-200">
                    {errorMsg}
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving || isSending || !webhookValid}
                    className="flex-1 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-charcoal hover:bg-slateDark text-gold-light border border-gold/45 transition inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSendNow}
                    disabled={isSending || isSaving || !canSendNow}
                    className="flex-1 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-gold hover:bg-gold-light text-obsidian transition inline-flex items-center justify-center gap-1.5 shadow-lg shadow-gold/15 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {isSending ? 'Envoi...' : 'Envoyer sur Discord'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
