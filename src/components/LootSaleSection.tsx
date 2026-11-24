import React, { useMemo, useState } from 'react';
import { Bell, Calendar, CheckCircle2, Coins, RotateCcw, Wine } from 'lucide-react';
import { REWARD_ITEMS } from '@/src/data/cartelData';
import type { RewardStocks, TreasuryMoney } from '@/src/types/cartel';
import { formatMoney, isoDate } from '@/src/utils/finance';

interface LootSaleSectionProps {
  rewardStocks: RewardStocks;
  treasuryMoney: TreasuryMoney;
  readonly: boolean;
  allowPriceEdit?: boolean;
  onUpdateRewardQty: (key: string, delta: number) => void;
  onUpdateRewardValue?: (key: string, val: number) => void;
  onApplyOfficialRewardPrices?: () => void;
  onSellRewards: (
    soldQuantities: Record<string, number>,
    channelLabel: string,
    customAmountOverride?: number
  ) => void;
}

export const LootSaleSection: React.FC<LootSaleSectionProps> = ({
  rewardStocks,
  treasuryMoney,
  readonly,
  allowPriceEdit = false,
  onUpdateRewardQty,
  onUpdateRewardValue,
  onApplyOfficialRewardPrices,
  onSellRewards,
}) => {
  const [receleurCart, setReceleurCart] = useState<Record<string, number>>({});
  const [whiskeySellQty, setWhiskeySellQty] = useState<number>(0);
  const [receleurCustomAmount, setReceleurCustomAmount] = useState<string | null>(null);
  const [whiskeyCustomAmount, setWhiskeyCustomAmount] = useState<string | null>(null);

  const today = new Date();
  const todayIso = isoDate(today);
  const dayOfWeek = today.getDay(); // 0 = Dimanche
  const isSunday = dayOfWeek === 0;
  const daysUntilSunday = isSunday ? 0 : 7 - dayOfWeek;
  const dismissKey = `cerberos_sunday_resale_dismissed_${todayIso}`;

  const [dismissedToday, setDismissedToday] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(dismissKey) === '1';
    } catch {
      return false;
    }
  });

  const handleDismissSundayBanner = () => {
    setDismissedToday(true);
    try {
      window.localStorage.setItem(dismissKey, '1');
    } catch {
      // ignore storage errors
    }
  };

  const receleurItems = useMemo(
    () => REWARD_ITEMS.filter((item) => item.buyerGroup !== 'whiskey'),
    []
  );
  const whiskeyItems = useMemo(
    () => REWARD_ITEMS.filter((item) => item.buyerGroup === 'whiskey'),
    []
  );

  const receleurRows = useMemo(() => {
    return receleurItems.map((item) => {
      const data = rewardStocks[item.key] || { qty: 0, val: item.defaultVal };
      const qty = Math.max(0, Math.floor(Number(data.qty) || 0));
      const unitVal =
        data.val !== undefined ? Math.max(0, Number(data.val) || 0) : item.defaultVal;
      const subTotal = qty * unitVal;
      const rawSelected = Math.max(0, Math.floor(Number(receleurCart[item.key]) || 0));
      const sellQty = Math.min(qty, rawSelected);
      const sellVal = sellQty * unitVal;
      return {
        item,
        qty,
        unitVal,
        subTotal,
        sellQty,
        sellVal,
      };
    });
  }, [receleurItems, rewardStocks, receleurCart]);

  const receleurSummary = useMemo(() => {
    let stockQty = 0;
    let stockVal = 0;
    let selectedQty = 0;
    let selectedVal = 0;
    const soldMap: Record<string, number> = {};

    receleurRows.forEach((r) => {
      stockQty += r.qty;
      stockVal += r.subTotal;
      if (r.sellQty > 0) {
        selectedQty += r.sellQty;
        selectedVal += r.sellVal;
        soldMap[r.item.key] = r.sellQty;
      }
    });

    return { stockQty, stockVal, selectedQty, selectedVal, soldMap };
  }, [receleurRows]);

  const whiskeyItem = whiskeyItems[0];
  const whiskeyData = whiskeyItem
    ? rewardStocks[whiskeyItem.key] || { qty: 0, val: whiskeyItem.defaultVal }
    : { qty: 0, val: 15 };
  const whiskeyStockQty = Math.max(0, Math.floor(Number(whiskeyData.qty) || 0));
  const whiskeyUnitVal =
    whiskeyData.val !== undefined
      ? Math.max(0, Number(whiskeyData.val) || 0)
      : whiskeyItem?.defaultVal ?? 15;
  const whiskeyStockVal = whiskeyStockQty * whiskeyUnitVal;
  const clampedWhiskeySellQty = Math.min(
    whiskeyStockQty,
    Math.max(0, Math.floor(Number(whiskeySellQty) || 0))
  );
  const clampedWhiskeySellVal = clampedWhiskeySellQty * whiskeyUnitVal;

  const currentIllegal = Math.max(0, Number(treasuryMoney.illegal) || 0);

  const effectiveReceleurAmount =
    receleurCustomAmount !== null
      ? Math.max(0, Math.round(Number(receleurCustomAmount) || 0))
      : receleurSummary.selectedVal;
  const effectiveWhiskeyAmount =
    whiskeyCustomAmount !== null
      ? Math.max(0, Math.round(Number(whiskeyCustomAmount) || 0))
      : clampedWhiskeySellVal;

  const setReceleurItemQty = (key: string, nextQty: number, maxQty: number) => {
    const clean = Math.min(maxQty, Math.max(0, Math.floor(Number(nextQty) || 0)));
    setReceleurCart((prev) => {
      const copy = { ...prev };
      if (clean <= 0) delete copy[key];
      else copy[key] = clean;
      return copy;
    });
  };

  const handleSelectAllReceleur = () => {
    const all: Record<string, number> = {};
    receleurRows.forEach((r) => {
      if (r.qty > 0) all[r.item.key] = r.qty;
    });
    setReceleurCart(all);
    setReceleurCustomAmount(null);
  };

  const handleValidateReceleurSale = () => {
    if (readonly) return;
    if (receleurSummary.selectedQty <= 0 && effectiveReceleurAmount <= 0) return;
    onSellRewards(
      receleurSummary.soldMap,
      'Receleur (Marché Noir)',
      receleurCustomAmount !== null ? effectiveReceleurAmount : undefined
    );
    setReceleurCart({});
    setReceleurCustomAmount(null);
  };

  const handleValidateWhiskeySale = () => {
    if (readonly || !whiskeyItem) return;
    if (clampedWhiskeySellQty <= 0 && effectiveWhiskeyAmount <= 0) return;
    const soldMap =
      clampedWhiskeySellQty > 0 ? { [whiskeyItem.key]: clampedWhiskeySellQty } : {};
    onSellRewards(
      soldMap,
      'Whiskey (Acheteur séparé)',
      whiskeyCustomAmount !== null ? effectiveWhiskeyAmount : undefined
    );
    setWhiskeySellQty(0);
    setWhiskeyCustomAmount(null);
  };

  const hasCustomOfficialPrices = REWARD_ITEMS.some((item) => {
    const stored = rewardStocks[item.key]?.val;
    return stored !== undefined && Number(stored) !== item.defaultVal;
  });

  const totalPendingQty = receleurSummary.stockQty + whiskeyStockQty;
  const totalPendingVal = receleurSummary.stockVal + whiskeyStockVal;

  return (
    <div id="loot-sale-section" className="space-y-6">
      {/* RAPPEL JOUR DE REVENTE (DIMANCHE) */}
      {isSunday && !dismissedToday && (
        <div className="bg-amber-500/15 border border-amber-400/60 rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/50 flex items-center justify-center shrink-0 text-amber-300">
              <Bell className="w-4 h-4" />
            </div>
            <div className="text-xs space-y-0.5">
              <div className="font-display font-bold text-amber-200 uppercase tracking-wider">
                🔔 Rappel — Aujourd&apos;hui Dimanche : Jour de Revente du Cartel
              </div>
              <p className="text-zinc-200 leading-relaxed tabular-nums">
                {totalPendingQty > 0 ? (
                  <>
                    Stock à écouler aujourd&apos;hui :{' '}
                    <strong className="text-gold-light">
                      {receleurSummary.stockQty} objet{receleurSummary.stockQty > 1 ? 's' : ''} Receleur ({formatMoney(receleurSummary.stockVal)})
                    </strong>{' '}
                    et{' '}
                    <strong className="text-amber-300">
                      {whiskeyStockQty} Whiskey ({formatMoney(whiskeyStockVal)})
                    </strong>{' '}
                    (Total estimé : <strong>{formatMoney(totalPendingVal)}</strong>). Validez vos ventes ci-dessous pour créditer l&apos;Argent Sale.
                  </>
                ) : (
                  <>
                    C&apos;est le jour de revente hebdomadaire (Receleur + Éminences / Whiskey). Si vous avez des objets non enregistrés en coffre, saisissez directement le montant encaissé ci-dessous.
                  </>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismissSundayBanner}
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-obsidian/80 hover:bg-charcoal text-amber-200 border border-amber-400/40 transition shrink-0 cursor-pointer"
          >
            Compris
          </button>
        </div>
      )}

      {/* PÔLE 1 : RECELEUR / MARCHÉ NOIR (BRAD) */}
      <div className="bg-charcoal/95 gold-border rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-bronze/40">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
                <span className="text-gold">💎</span> Objets à Vendre — Receleur (Marché Noir)
              </h2>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border tabular-nums ${
                  isSunday
                    ? 'bg-amber-500/20 text-amber-200 border-amber-400/50'
                    : 'bg-obsidian/80 text-zinc-300 border-bronze/45'
                }`}
              >
                <Calendar className="w-3 h-3 text-gold" />
                {isSunday
                  ? 'Jour de revente : Aujourd’hui (Dimanche)'
                  : `Revente : Dimanche (dans ${daysUntilSunday} j)`}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Lingots, bijoux, montres, électronique, peintures... Sélectionnez les objets vendus et ajustez le montant si les prix changent ou si l&apos;inventaire n&apos;est pas exact (hors Whiskey).
            </p>
          </div>
          <div className="flex items-center gap-4 flex-wrap justify-end">
            {!readonly &&
              allowPriceEdit &&
              onApplyOfficialRewardPrices &&
              hasCustomOfficialPrices && (
                <button
                  type="button"
                  onClick={onApplyOfficialRewardPrices}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-gold/20 hover:bg-gold hover:text-obsidian text-gold-light border border-gold/50 transition cursor-pointer"
                >
                  Tarifs officiels receleur
                </button>
              )}
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-zinc-500 block">
                Stock Receleur ({receleurSummary.stockQty} objet
                {receleurSummary.stockQty > 1 ? 's' : ''})
              </span>
              <span className="font-display text-lg font-extrabold text-gold tabular-nums">
                {formatMoney(receleurSummary.stockVal)}
              </span>
            </div>
          </div>
        </div>

        {/* BARRE DE VALIDATION VENTE RECELEUR (AVEC MONTANT MODIFIABLE) */}
        {!readonly && (
          <div
            className={`rounded-xl border p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3 transition ${
              receleurSummary.selectedQty > 0 || effectiveReceleurAmount > 0
                ? 'bg-emerald-950/30 border-emerald-500/50'
                : 'bg-obsidian/70 border-bronze/40'
            }`}
          >
            <div className="flex items-start sm:items-center gap-2.5 text-xs">
              <Coins className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5 sm:mt-0" />
              <div className="space-y-0.5">
                {receleurSummary.selectedQty > 0 || effectiveReceleurAmount > 0 ? (
                  <div className="text-zinc-200 tabular-nums">
                    Vente :{' '}
                    <strong className="text-white">
                      {receleurSummary.selectedQty > 0
                        ? `${receleurSummary.selectedQty} objet${receleurSummary.selectedQty > 1 ? 's' : ''}`
                        : 'Montant libre (sans déduction stock)'}
                    </strong>{' '}
                    →{' '}
                    <strong className="text-emerald-300 font-mono">
                      +{formatMoney(effectiveReceleurAmount)}
                    </strong>{' '}
                    en Argent Sale{' '}
                    <span className="text-zinc-400 font-mono">
                      (Coffre : {formatMoney(currentIllegal)} →{' '}
                      <strong className="text-emerald-200">
                        {formatMoney(currentIllegal + effectiveReceleurAmount)}
                      </strong>
                      )
                    </span>
                  </div>
                ) : (
                  <div className="text-zinc-400 tabular-nums">
                    Coffre Argent Sale actuel :{' '}
                    <strong className="text-red-300 font-mono">
                      {formatMoney(currentIllegal)}
                    </strong>{' '}
                    · Sélectionnez des objets ci-dessous ou saisissez directement le montant encaissé.
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
              {receleurSummary.stockQty > 0 &&
                receleurSummary.selectedQty < receleurSummary.stockQty && (
                  <button
                    type="button"
                    onClick={handleSelectAllReceleur}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gold/15 hover:bg-gold hover:text-obsidian text-gold-light border border-gold/45 transition cursor-pointer tabular-nums"
                  >
                    Tout sélectionner ({receleurSummary.stockQty})
                  </button>
                )}
              {receleurSummary.selectedQty > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setReceleurCart({});
                    setReceleurCustomAmount(null);
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-charcoal hover:bg-gunmetal text-zinc-300 border border-gunmetal transition cursor-pointer"
                >
                  Vider
                </button>
              )}

              <div className="flex items-center gap-1.5 bg-charcoal border border-bronze/55 rounded-lg px-2.5 py-1">
                <span className="text-[11px] text-zinc-400 whitespace-nowrap">
                  Montant encaissé :
                </span>
                <div className="relative w-24">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={
                      receleurCustomAmount !== null
                        ? receleurCustomAmount
                        : String(receleurSummary.selectedVal)
                    }
                    onChange={(e) => setReceleurCustomAmount(e.target.value)}
                    title="Modifiez ce montant si les prix ont changé ou si le stock ne correspond pas"
                    className="w-full bg-obsidian border border-emerald-500/45 focus:border-emerald-400 rounded pl-2 pr-5 py-0.5 text-right font-mono tabular-nums text-xs font-bold text-emerald-200 focus:outline-none"
                  />
                  <span className="absolute right-1.5 top-1/2 -translate-y-1/2 font-mono text-[10px] text-zinc-500 pointer-events-none">
                    $
                  </span>
                </div>
                {receleurCustomAmount !== null && (
                  <button
                    type="button"
                    onClick={() => setReceleurCustomAmount(null)}
                    title={`Revenir au montant calculé (${formatMoney(receleurSummary.selectedVal)})`}
                    className="p-1 rounded text-amber-300 hover:bg-gunmetal transition cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
              </div>

              <button
                type="button"
                disabled={receleurSummary.selectedQty <= 0 && effectiveReceleurAmount <= 0}
                onClick={handleValidateReceleurSale}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-obsidian transition inline-flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed tabular-nums shadow-md"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Valider la vente Receleur
                {effectiveReceleurAmount > 0
                  ? ` (+${formatMoney(effectiveReceleurAmount)})`
                  : ''}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {receleurRows.map(({ item, qty, unitVal, subTotal, sellQty }) => (
            <div
              key={item.key}
              className={`bg-obsidian/80 border rounded-xl p-4 flex flex-col justify-between gap-3 shadow-md transition ${
                sellQty > 0
                  ? 'border-emerald-500/65 ring-1 ring-emerald-500/25'
                  : qty > 0
                    ? 'border-gold/45'
                    : 'border-bronze/40'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-bold text-sm text-white">{item.name}</h4>
                  <span className="text-xs font-mono tabular-nums text-zinc-400">
                    {formatMoney(unitVal)} l&apos;unité ·{' '}
                    <strong className="text-gold">{formatMoney(subTotal)}</strong>
                  </span>
                </div>
                <span
                  className={`font-mono text-xs font-bold tabular-nums shrink-0 ${
                    qty > 0 ? 'text-gold-light' : 'text-zinc-500'
                  }`}
                >
                  {qty > 0 ? `${qty} en coffre` : '0'}
                </span>
              </div>

              <div className="space-y-2 pt-2 border-t border-bronze/35 text-xs">
                {allowPriceEdit && onUpdateRewardValue && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-zinc-400">Valeur unitaire ($) :</span>
                    <div className="relative w-24">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={unitVal}
                        disabled={readonly}
                        onChange={(e) =>
                          onUpdateRewardValue(
                            item.key,
                            Math.max(0, Number(e.target.value) || 0)
                          )
                        }
                        className="w-full bg-charcoal border border-bronze/60 focus:border-gold rounded-lg pl-2 pr-5 py-1 text-right font-mono tabular-nums text-xs font-bold text-white focus:outline-none disabled:opacity-60"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[11px] text-zinc-500 pointer-events-none">
                        $
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2">
                  <span className="text-zinc-400">Quantité en coffre :</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={readonly || qty <= 0}
                      onClick={() => onUpdateRewardQty(item.key, -1)}
                      className="w-7 h-7 bg-gunmetal hover:bg-bronze disabled:opacity-40 text-white rounded-lg font-bold flex items-center justify-center transition cursor-pointer disabled:cursor-not-allowed"
                    >
                      -
                    </button>
                    <span className="font-mono tabular-nums text-sm font-bold text-white w-8 text-center">
                      {qty}
                    </span>
                    <button
                      type="button"
                      disabled={readonly}
                      onClick={() => onUpdateRewardQty(item.key, 1)}
                      className="w-7 h-7 bg-gunmetal hover:bg-gold hover:text-obsidian disabled:opacity-40 text-white rounded-lg font-bold flex items-center justify-center transition cursor-pointer disabled:cursor-not-allowed"
                    >
                      +
                    </button>
                  </div>
                </div>

                {!readonly && qty > 0 && (
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-bronze/25">
                    <span className="text-emerald-300 font-semibold">À vendre :</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={sellQty <= 0}
                        onClick={() => setReceleurItemQty(item.key, sellQty - 1, qty)}
                        className="w-6 h-6 bg-charcoal hover:bg-gunmetal disabled:opacity-35 text-white rounded border border-bronze/50 font-bold flex items-center justify-center cursor-pointer"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        max={qty}
                        value={sellQty}
                        onChange={(e) =>
                          setReceleurItemQty(
                            item.key,
                            Math.max(0, Number(e.target.value) || 0),
                            qty
                          )
                        }
                        className="w-12 h-6 bg-charcoal border border-emerald-500/40 focus:border-emerald-400 rounded text-center font-mono tabular-nums text-xs font-bold text-emerald-200 focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={sellQty >= qty}
                        onClick={() => setReceleurItemQty(item.key, sellQty + 1, qty)}
                        className="w-6 h-6 bg-charcoal hover:bg-emerald-500 hover:text-obsidian disabled:opacity-35 text-emerald-200 rounded border border-emerald-500/40 font-bold flex items-center justify-center cursor-pointer"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        disabled={sellQty >= qty}
                        onClick={() => setReceleurItemQty(item.key, qty, qty)}
                        className="px-2 h-6 bg-emerald-500/15 hover:bg-emerald-500 hover:text-obsidian disabled:opacity-35 text-emerald-200 rounded border border-emerald-500/45 text-[10px] font-bold cursor-pointer"
                      >
                        Tout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PÔLE 2 : WHISKEY DE LUXE (ACHETEUR SÉPARÉ) */}
      {whiskeyItem && (
        <div className="bg-charcoal/95 border border-amber-500/50 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-amber-500/25">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
                  <Wine className="w-5 h-5 text-amber-300" />
                  Whiskey de Luxe — Éminences (Acheteur Séparé)
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-200 border border-amber-500/40">
                  Hors Receleur
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Le Whiskey se revend auprès d&apos;Éminences ({formatMoney(whiskeyUnitVal)} / bouteille), un contact séparé du receleur classique : validez sa vente ici (montant ajustable si besoin) pour créditer directement l&apos;Argent Sale.
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-zinc-500 block">
                Stock Whiskey ({whiskeyStockQty} bouteille
                {whiskeyStockQty > 1 ? 's' : ''})
              </span>
              <span className="font-display text-lg font-extrabold text-amber-300 tabular-nums">
                {formatMoney(whiskeyStockVal)}
              </span>
            </div>
          </div>

          <div className="bg-obsidian/80 border border-amber-500/35 rounded-xl p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-bold text-sm text-white">{whiskeyItem.name}</span>
                <span className="text-xs font-mono tabular-nums text-zinc-400">
                  {formatMoney(whiskeyUnitVal)} / bouteille
                </span>
                <span
                  className={`font-mono text-xs font-bold tabular-nums ${
                    whiskeyStockQty > 0 ? 'text-amber-300' : 'text-zinc-500'
                  }`}
                >
                  · {whiskeyStockQty} en coffre
                </span>
              </div>

              {allowPriceEdit && onUpdateRewardValue && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-zinc-400">Prix rachat ($) :</span>
                  <div className="relative w-24">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={whiskeyUnitVal}
                      disabled={readonly}
                      onChange={(e) =>
                        onUpdateRewardValue(
                          whiskeyItem.key,
                          Math.max(0, Number(e.target.value) || 0)
                        )
                      }
                      className="w-full bg-charcoal border border-bronze/60 focus:border-amber-400 rounded-lg pl-2 pr-5 py-1 text-right font-mono tabular-nums text-xs font-bold text-white focus:outline-none disabled:opacity-60"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[11px] text-zinc-500 pointer-events-none">
                      $
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 text-xs pt-1">
                <span className="text-zinc-400">Quantité en coffre :</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={readonly || whiskeyStockQty <= 0}
                    onClick={() => onUpdateRewardQty(whiskeyItem.key, -1)}
                    className="w-7 h-7 bg-gunmetal hover:bg-bronze disabled:opacity-40 text-white rounded-lg font-bold flex items-center justify-center transition cursor-pointer disabled:cursor-not-allowed"
                  >
                    -
                  </button>
                  <span className="font-mono tabular-nums text-sm font-bold text-white w-8 text-center">
                    {whiskeyStockQty}
                  </span>
                  <button
                    type="button"
                    disabled={readonly}
                    onClick={() => onUpdateRewardQty(whiskeyItem.key, 1)}
                    className="w-7 h-7 bg-gunmetal hover:bg-amber-400 hover:text-obsidian disabled:opacity-40 text-white rounded-lg font-bold flex items-center justify-center transition cursor-pointer disabled:cursor-not-allowed"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {!readonly && (
              <div className="flex flex-wrap items-center gap-2.5 pt-3 xl:pt-0 border-t xl:border-t-0 border-amber-500/20 justify-end">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-amber-200 font-semibold whitespace-nowrap">
                    À vendre :
                  </span>
                  <button
                    type="button"
                    disabled={clampedWhiskeySellQty <= 0}
                    onClick={() => {
                      setWhiskeySellQty(Math.max(0, clampedWhiskeySellQty - 1));
                      setWhiskeyCustomAmount(null);
                    }}
                    className="w-7 h-7 bg-charcoal hover:bg-gunmetal disabled:opacity-35 text-white rounded-lg border border-bronze/50 font-bold flex items-center justify-center cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="0"
                    max={whiskeyStockQty}
                    disabled={whiskeyStockQty <= 0}
                    value={clampedWhiskeySellQty}
                    onChange={(e) => {
                      setWhiskeySellQty(
                        Math.min(
                          whiskeyStockQty,
                          Math.max(0, Math.floor(Number(e.target.value) || 0))
                        )
                      );
                      setWhiskeyCustomAmount(null);
                    }}
                    className="w-14 h-7 bg-charcoal border border-amber-500/45 focus:border-amber-400 rounded-lg text-center font-mono tabular-nums text-xs font-bold text-amber-200 focus:outline-none disabled:opacity-40"
                  />
                  <button
                    type="button"
                    disabled={clampedWhiskeySellQty >= whiskeyStockQty}
                    onClick={() => {
                      setWhiskeySellQty(Math.min(whiskeyStockQty, clampedWhiskeySellQty + 1));
                      setWhiskeyCustomAmount(null);
                    }}
                    className="w-7 h-7 bg-charcoal hover:bg-amber-400 hover:text-obsidian disabled:opacity-35 text-amber-200 rounded-lg border border-amber-500/45 font-bold flex items-center justify-center cursor-pointer"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    disabled={whiskeyStockQty <= 0 || clampedWhiskeySellQty >= whiskeyStockQty}
                    onClick={() => {
                      setWhiskeySellQty(whiskeyStockQty);
                      setWhiskeyCustomAmount(null);
                    }}
                    className="px-2.5 h-7 bg-amber-500/15 hover:bg-amber-400 hover:text-obsidian disabled:opacity-35 text-amber-200 rounded-lg border border-amber-500/45 text-[11px] font-bold cursor-pointer"
                  >
                    Tout ({whiskeyStockQty})
                  </button>
                </div>

                <div className="flex items-center gap-1.5 bg-charcoal border border-amber-500/40 rounded-lg px-2.5 py-1">
                  <span className="text-[11px] text-zinc-400 whitespace-nowrap">
                    Montant encaissé :
                  </span>
                  <div className="relative w-24">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={
                        whiskeyCustomAmount !== null
                          ? whiskeyCustomAmount
                          : String(clampedWhiskeySellVal)
                      }
                      onChange={(e) => setWhiskeyCustomAmount(e.target.value)}
                      title="Modifiez ce montant si le prix change ou si le stock n'est pas exact"
                      className="w-full bg-obsidian border border-amber-500/45 focus:border-amber-400 rounded pl-2 pr-5 py-0.5 text-right font-mono tabular-nums text-xs font-bold text-amber-200 focus:outline-none"
                    />
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 font-mono text-[10px] text-zinc-500 pointer-events-none">
                      $
                    </span>
                  </div>
                  {whiskeyCustomAmount !== null && (
                    <button
                      type="button"
                      onClick={() => setWhiskeyCustomAmount(null)}
                      title={`Revenir au montant calculé (${formatMoney(clampedWhiskeySellVal)})`}
                      className="p-1 rounded text-amber-300 hover:bg-gunmetal transition cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  disabled={clampedWhiskeySellQty <= 0 && effectiveWhiskeyAmount <= 0}
                  onClick={handleValidateWhiskeySale}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-obsidian transition inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed tabular-nums shadow-md shrink-0"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Valider vente Whiskey
                  {effectiveWhiskeyAmount > 0
                    ? ` (+${formatMoney(effectiveWhiskeyAmount)} Argent Sale)`
                    : ''}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
