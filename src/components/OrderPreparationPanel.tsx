import React, { useMemo, useState } from 'react';
import { DAY_NAMES } from '@/src/data/cartelData';
import type {
  CatalogGroupsMap,
  InventoryPrices,
  InventoryStock,
  MissionScheduleMeta,
  MissionStates,
  TreasuryMoney,
} from '@/src/types/cartel';
import { formatMoney, isTodayName } from '@/src/utils/finance';
import { simulateMissionSupplyPlan } from '@/src/utils/missionSupply';

interface OrderPreparationPanelProps {
  missionStates: MissionStates;
  scheduleMeta?: MissionScheduleMeta;
  inventoryStock: InventoryStock;
  inventoryPrices?: InventoryPrices;
  catalogGroups?: CatalogGroupsMap;
  treasuryMoney: TreasuryMoney;
  readonly: boolean;
  onReceiveOrder: (
    orderMap: Record<string, number>,
    debitAccount: 'none' | 'legal' | 'illegal',
    debitAmount: number
  ) => void;
  onSendToEminenceCart?: (
    catalogItemsQty: Record<string, number>,
    options?: { navigateToOrders?: boolean; replaceCart?: boolean }
  ) => void;
  onShowToast: (msg: string) => void;
}

const DAY_PRESETS = [1, 2, 3, 5, 7, 14];

type PrepOrderMode = 'optimal' | 'packs';

interface UnifiedPrepRow {
  rowKey: string;
  stockKey: string;
  catalogItemId: string | null;
  name: string;
  typeLabel: string;
  unitPrice: number;
  needed: number;
  inVaultLabel: string;
  shortage: number;
  orderQty: number;
  orderCost: number;
  autoDays: number;
  autoOver30: boolean;
  isUnscheduled: boolean;
}

export const OrderPreparationPanel: React.FC<OrderPreparationPanelProps> = ({
  missionStates,
  scheduleMeta,
  inventoryStock,
  inventoryPrices,
  catalogGroups,
  treasuryMoney,
  readonly,
  onReceiveOrder,
  onSendToEminenceCart,
  onShowToast,
}) => {
  const detectedToday = useMemo(
    () => DAY_NAMES.find((d) => isTodayName(d, missionStates)) || 'Lundi',
    [missionStates]
  );

  const [daysAhead, setDaysAhead] = useState<number>(3);
  const [startDay, setStartDay] = useState<string>(detectedToday);
  const [excludeDone, setExcludeDone] = useState<boolean>(true);
  const [showFullCatalog, setShowFullCatalog] = useState<boolean>(false);
  const [orderMode, setOrderMode] = useState<PrepOrderMode>('optimal');
  const [manualDeltas, setManualDeltas] = useState<Record<string, number>>({});
  const [debitAccount, setDebitAccount] = useState<'none' | 'legal' | 'illegal'>('illegal');

  const safeStartDay = DAY_NAMES.includes(startDay) ? startDay : detectedToday;

  const supplyPlan = useMemo(
    () =>
      simulateMissionSupplyPlan({
        inventoryStock,
        inventoryPrices,
        catalogGroups,
        missionStates,
        scheduleMeta,
        startDayName: safeStartDay,
      }),
    [
      inventoryStock,
      inventoryPrices,
      catalogGroups,
      missionStates,
      scheduleMeta,
      safeStartDay,
    ]
  );

  const horizon = useMemo(
    () => supplyPlan.computeHorizonOrder(daysAhead, excludeDone),
    [supplyPlan, daysAhead, excludeDone]
  );

  const rows: UnifiedPrepRow[] = useMemo(() => {
    if (orderMode === 'optimal') {
      return horizon.optimalOrderRows.map((entry) => {
        const deltaKey = `optimal:${entry.stockKey}`;
        const manual = manualDeltas[deltaKey] || 0;
        const orderQty = Math.max(0, entry.missingQty + manual);
        const typeLabel =
          entry.kind === 'key'
            ? 'Clé / Accès'
            : entry.kind === 'utility'
              ? 'Utilitaire'
              : 'Pack / Kit';
        return {
          rowKey: deltaKey,
          stockKey: entry.stockKey,
          catalogItemId: entry.catalogItemId,
          name: entry.name,
          typeLabel,
          unitPrice: entry.unitPrice,
          needed: entry.neededInHorizon,
          inVaultLabel: `${entry.inVault} libre${entry.inVault > 1 ? 's' : ''}`,
          shortage: entry.missingQty,
          orderQty,
          orderCost: orderQty * entry.unitPrice,
          autoDays: supplyPlan.minDaysCovered,
          autoOver30: supplyPlan.allOver30Days,
          isUnscheduled: false,
        };
      });
    }

    return horizon.packOrderRows.map((entry) => {
      const deltaKey = `packs:${entry.stockKey}`;
      const manual = manualDeltas[deltaKey] || 0;
      const orderQty = Math.max(0, entry.shortage + manual);
      const ov = supplyPlan.overviewByGearKey[entry.stockKey];
      const autoDays = ov?.coveredDays ?? 0;
      const autoOver30 = ov?.hasMoreThan30 ?? false;
      const isUnscheduled = !ov || (ov.scheduledThisWeekCount === 0 && ov.hasMoreThan30);
      const packStock = Math.max(0, Math.floor(Number(inventoryStock[entry.stockKey]) || 0));
      const soloExtra = ov && !ov.isSingleUnifiedKey ? ov.soloReadyRuns : 0;
      const inVaultLabel =
        soloExtra > 0 ? `${packStock} + ${soloExtra} solo` : String(packStock);

      return {
        rowKey: deltaKey,
        stockKey: entry.stockKey,
        catalogItemId: entry.catalogItemId,
        name: entry.name,
        typeLabel: entry.category === 'heist_pack' ? 'Gros Coup' : 'Outillage',
        unitPrice: entry.unitPrice,
        needed: entry.neededTotal,
        inVaultLabel,
        shortage: entry.shortage,
        orderQty,
        orderCost: orderQty * entry.unitPrice,
        autoDays,
        autoOver30,
        isUnscheduled,
      };
    });
  }, [orderMode, horizon, manualDeltas, supplyPlan, inventoryStock]);

  const visibleRows = useMemo(() => {
    if (showFullCatalog || orderMode === 'optimal') return rows;
    return rows.filter((r) => r.needed > 0 || r.orderQty > 0);
  }, [rows, showFullCatalog, orderMode]);

  const orderSummary = useMemo(() => {
    let totalUnits = 0;
    let totalCost = 0;
    const orderMap: Record<string, number> = {};
    const catalogItemsMap: Record<string, number> = {};

    rows.forEach((r) => {
      if (r.orderQty > 0) {
        totalUnits += r.orderQty;
        totalCost += r.orderCost;
        orderMap[r.stockKey] = (orderMap[r.stockKey] || 0) + r.orderQty;
        if (r.catalogItemId) {
          catalogItemsMap[r.catalogItemId] =
            (catalogItemsMap[r.catalogItemId] || 0) + r.orderQty;
        }
      }
    });

    return { totalUnits, totalCost, orderMap, catalogItemsMap };
  }, [rows]);

  const adjustOrderQty = (rowKey: string, shortage: number, delta: number) => {
    setManualDeltas((prev) => {
      const currentManual = prev[rowKey] || 0;
      const currentOrder = Math.max(0, shortage + currentManual);
      const nextOrder = Math.max(0, currentOrder + delta);
      const nextManual = nextOrder - shortage;
      const copy = { ...prev };
      if (nextManual === 0) delete copy[rowKey];
      else copy[rowKey] = nextManual;
      return copy;
    });
  };

  const handleCopyOrder = async () => {
    const dayRangeStr = horizon.coveredDays
      .map((d) => (d.isNextCycle ? `${d.day} (Sem.+1)` : d.day))
      .join(' → ');

    let text = '```asciidoc\n';
    text += `= COMMANDE ${orderMode === 'optimal' ? 'OPTIMISÉE (ITEMS MANQUANTS)' : 'PACKS COMPLETS'} (${daysAhead} JOUR${daysAhead > 1 ? 'S' : ''}) =\n`;
    text += `Période : ${dayRangeStr}\n\n`;

    if (orderSummary.totalUnits === 0) {
      text += 'Stock actuel suffisant (packs + items en coffre) — aucune pièce à commander.\n';
    } else {
      rows
        .filter((r) => r.orderQty > 0)
        .forEach((r) => {
          text += `- ${r.orderQty}x ${r.name} (${formatMoney(r.unitPrice)}/u) = ${formatMoney(r.orderCost)}\n`;
        });
      text += `\nTotal pièces : ${orderSummary.totalUnits}\n`;
      text += `COÛT TOTAL COMMANDE : ${formatMoney(orderSummary.totalCost)}\n`;
    }
    text += '```';

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        onShowToast('Bon de commande copié dans le presse-papiers !');
        return;
      }
    } catch {
      // Fallback below
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      onShowToast('Bon de commande copié dans le presse-papiers !');
    } catch {
      onShowToast('Erreur de copie.');
    }
    document.body.removeChild(textarea);
  };

  const handleConfirmReceipt = () => {
    if (readonly || orderSummary.totalUnits <= 0) return;
    onReceiveOrder(orderSummary.orderMap, debitAccount, orderSummary.totalCost);
    setManualDeltas({});
    setDebitAccount('illegal');
  };

  const handleSendOptimalToEminence = () => {
    if (!onSendToEminenceCart || Object.keys(orderSummary.catalogItemsMap).length === 0) {
      return;
    }
    onSendToEminenceCart(orderSummary.catalogItemsMap, { navigateToOrders: false });
    const panel = document.getElementById('order-catalog-panel');
    if (panel) {
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div id="order-prep-panel" className="bg-charcoal/95 gold-border rounded-2xl p-6 shadow-xl space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-4 border-b border-bronze/40">
        <div>
          <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
            <span className="text-gold">🛒</span> Préparation de Commande Intelligente
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Déduit automatiquement les packs complets ET les items seuls déjà en coffre sans double comptage sur le planning.
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="text-[10px] uppercase font-bold text-zinc-500 block">
            Coût de la Commande ({orderSummary.totalUnits} pièce{orderSummary.totalUnits > 1 ? 's' : ''})
          </span>
          <span className="font-display text-lg font-extrabold text-gold tabular-nums">
            {formatMoney(orderSummary.totalCost)}
          </span>
          {orderMode === 'optimal' && horizon.optimalSavingsVsPacks > 0 && (
            <span className="block text-[10px] font-mono text-emerald-300 font-bold tabular-nums">
              Économie : -{formatMoney(horizon.optimalSavingsVsPacks)} vs Packs complets
            </span>
          )}
        </div>
      </div>

      {/* MODE D'OPTIMISATION + PARAMÈTRES DE PRÉPARATION */}
      <div className="bg-obsidian/80 border border-bronze/40 rounded-xl p-4 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-bronze/30">
          <div className="inline-flex bg-charcoal border border-bronze/50 rounded-xl p-1 gap-1 self-start">
            <button
              type="button"
              onClick={() => setOrderMode('optimal')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                orderMode === 'optimal'
                  ? 'bg-gold text-obsidian shadow'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              ⚡ Mode Optimisé (Items manquants)
            </button>
            <button
              type="button"
              onClick={() => setOrderMode('packs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                orderMode === 'packs'
                  ? 'bg-gold text-obsidian shadow'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              📦 Mode Packs complets
            </button>
          </div>

          <div className="text-[11px] font-mono text-zinc-300 tabular-nums">
            {horizon.uncoveredMissionsCount === 0 ? (
              <span className="text-emerald-300 font-semibold">
                ✅ 100 % des missions couvertes sur {daysAhead} jour{daysAhead > 1 ? 's' : ''}
              </span>
            ) : (
              <span>
                <strong className="text-amber-300">{horizon.uncoveredMissionsCount}</strong>{' '}
                mission{horizon.uncoveredMissionsCount > 1 ? 's' : ''} à compléter ·{' '}
                Optimisé <strong className="text-emerald-300">{formatMoney(horizon.optimalOrderTotalCost)}</strong>
                {' vs '}
                Packs <strong className="text-zinc-300">{formatMoney(horizon.packOrderTotalCost)}</strong>
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-gold-light block">
              Nombre de jours d&apos;avance souhaité
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-charcoal border border-bronze/60 rounded-lg p-1">
                <button
                  type="button"
                  disabled={daysAhead <= 1}
                  onClick={() => setDaysAhead((d) => Math.max(1, d - 1))}
                  className="w-7 h-7 rounded bg-gunmetal hover:bg-bronze disabled:opacity-35 text-white font-bold flex items-center justify-center cursor-pointer"
                >
                  -
                </button>
                <span className="font-mono font-extrabold text-gold px-2.5 text-sm tabular-nums">
                  {daysAhead} j
                </span>
                <button
                  type="button"
                  disabled={daysAhead >= 14}
                  onClick={() => setDaysAhead((d) => Math.min(14, d + 1))}
                  className="w-7 h-7 rounded bg-gunmetal hover:bg-gold hover:text-obsidian disabled:opacity-35 text-white font-bold flex items-center justify-center cursor-pointer"
                >
                  +
                </button>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {DAY_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDaysAhead(preset)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                      daysAhead === preset
                        ? 'bg-gold text-obsidian border-gold'
                        : 'bg-charcoal text-zinc-300 border-gunmetal hover:border-bronze'
                    }`}
                  >
                    {preset}j
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
              Commencer à compter à partir de
            </label>
            <select
              value={safeStartDay}
              onChange={(e) => setStartDay(e.target.value)}
              className="w-full bg-charcoal border border-bronze/60 focus:border-gold rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
            >
              {DAY_NAMES.map((day) => (
                <option key={day} value={day}>
                  {day}
                  {day === detectedToday ? " (Aujourd'hui)" : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col justify-end gap-2">
            <label className="inline-flex items-center gap-2 text-xs text-zinc-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={excludeDone}
                onChange={(e) => setExcludeDone(e.target.checked)}
                className="w-4 h-4 accent-amber-400 cursor-pointer"
              />
              Exclure les missions déjà validées cette semaine
            </label>
            {orderMode === 'packs' && (
              <label className="inline-flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showFullCatalog}
                  onChange={(e) => setShowFullCatalog(e.target.checked)}
                  className="w-4 h-4 accent-amber-400 cursor-pointer"
                />
                Afficher tout le catalogue packs ({horizon.packOrderRows.length} articles)
              </label>
            )}
          </div>
        </div>

        {/* JOURS COUVERTS */}
        <div className="pt-2.5 border-t border-bronze/30 flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-semibold text-zinc-400 mr-1">
            Période couverte :
          </span>
          {horizon.coveredDays.map((d, idx) => (
            <span
              key={`${d.day}-${idx}`}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border tabular-nums ${
                d.isNextCycle
                  ? 'bg-gold/10 text-gold-light border-gold/30'
                  : 'bg-charcoal text-zinc-200 border-gunmetal'
              }`}
            >
              <span>{d.day}</span>
              {d.isNextCycle && <span className="text-[9px] text-gold">(Sem.+1)</span>}
            </span>
          ))}
        </div>
      </div>

      {/* TABLEAU DES BESOINS VS STOCK */}
      {visibleRows.length === 0 ? (
        <div className="bg-emerald-950/20 border border-emerald-500/35 rounded-xl p-4 text-center text-xs text-emerald-200">
          ✅ Votre stock actuel (packs + items seuls en coffre) couvre déjà 100 % des {daysAhead} prochains jours !
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-bronze/45 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                <th className="py-2.5 px-3">
                  {orderMode === 'optimal' ? 'Composant / Clé / Pack' : 'Matériel / Pack'}
                </th>
                {orderMode === 'packs' && <th className="py-2.5 px-3 text-center">Autonomie</th>}
                <th className="py-2.5 px-3 text-center">Besoin ({daysAhead}j)</th>
                <th className="py-2.5 px-3 text-center">
                  {orderMode === 'optimal' ? 'Dispo libre' : 'En coffre'}
                </th>
                <th className="py-2.5 px-3 text-center">Manquant</th>
                <th className="py-2.5 px-3 text-center">À commander</th>
                <th className="py-2.5 px-3 text-right">Coût</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bronze/25 text-xs tabular-nums">
              {visibleRows.map((r) => (
                <tr
                  key={r.rowKey}
                  className={`transition ${
                    r.orderQty > 0 ? 'bg-gold/5 hover:bg-gold/10' : 'hover:bg-slateDark/60'
                  }`}
                >
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white">{r.name}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                        · {r.typeLabel}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-400">
                      {r.unitPrice > 0 ? `${formatMoney(r.unitPrice)} / u` : 'Prix à définir'}
                    </span>
                  </td>

                  {orderMode === 'packs' && (
                    <td className="py-2.5 px-3 text-center font-mono">
                      {r.isUnscheduled ? (
                        <span className="text-zinc-500 text-[11px]">Libre</span>
                      ) : r.autoOver30 ? (
                        <span className="text-emerald-300 font-bold text-[11px]">30+ j</span>
                      ) : r.autoDays === 0 ? (
                        <span className="text-crimson-light font-bold text-[11px]">0 j</span>
                      ) : r.autoDays < 3 ? (
                        <span className="text-amber-300 font-bold text-[11px]">{r.autoDays} j</span>
                      ) : (
                        <span className="text-emerald-300 font-semibold text-[11px]">
                          {r.autoDays} j
                        </span>
                      )}
                    </td>
                  )}

                  <td className="py-2.5 px-3 text-center font-mono font-bold text-zinc-200">
                    {r.needed}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-zinc-200">
                    {r.inVaultLabel}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono">
                    {r.shortage > 0 ? (
                      <span className="text-crimson-light font-bold text-[11px]">
                        -{r.shortage}
                      </span>
                    ) : (
                      <span className="text-emerald-400 text-[11px] font-semibold">OK</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        disabled={r.orderQty <= 0}
                        onClick={() => adjustOrderQty(r.rowKey, r.shortage, -1)}
                        className="w-6 h-6 rounded bg-gunmetal hover:bg-bronze disabled:opacity-35 text-white font-bold flex items-center justify-center cursor-pointer"
                      >
                        -
                      </button>
                      <span
                        className={`font-mono font-extrabold w-7 text-center ${
                          r.orderQty > 0 ? 'text-gold' : 'text-zinc-500'
                        }`}
                      >
                        {r.orderQty}
                      </span>
                      <button
                        type="button"
                        onClick={() => adjustOrderQty(r.rowKey, r.shortage, 1)}
                        className="w-6 h-6 rounded bg-gunmetal hover:bg-gold hover:text-obsidian text-white font-bold flex items-center justify-center cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-gold">
                    {r.orderCost > 0 ? formatMoney(r.orderCost) : '0 $'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ACTIONS DE COMMANDE */}
      <div className="bg-obsidian/85 border border-gold/35 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="text-xs space-y-0.5 tabular-nums">
          {orderSummary.totalUnits === 0 ? (
            <span className="text-emerald-300 font-semibold">
              ✅ Votre stock actuel couvre déjà les {daysAhead} jour{daysAhead > 1 ? 's' : ''} prévus !
            </span>
          ) : (
            <>
              <div className="text-zinc-300">
                À commander pour <strong>{daysAhead} jour{daysAhead > 1 ? 's' : ''}</strong> :{' '}
                <strong className="text-gold">
                  {orderSummary.totalUnits} article{orderSummary.totalUnits > 1 ? 's' : ''}
                </strong>
              </div>
              <div className="text-[11px] text-zinc-400">
                Coût total estimé :{' '}
                <strong className="font-mono text-gold-light">
                  {formatMoney(orderSummary.totalCost)}
                </strong>
                {orderMode === 'optimal' && horizon.optimalSavingsVsPacks > 0 && (
                  <span className="text-emerald-300 ml-2 font-semibold">
                    (Économie de {formatMoney(horizon.optimalSavingsVsPacks)} par rapport aux packs)
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-end">
          <button
            type="button"
            onClick={handleCopyOrder}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-charcoal hover:bg-gunmetal text-gold-light border border-gold/40 transition cursor-pointer whitespace-nowrap"
          >
            📋 Copier la commande
          </button>

          {orderSummary.totalUnits > 0 &&
            onSendToEminenceCart &&
            Object.keys(orderSummary.catalogItemsMap).length > 0 && (
              <button
                type="button"
                onClick={handleSendOptimalToEminence}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-purple-500/20 hover:bg-purple-500/35 text-purple-100 border border-purple-400/50 transition cursor-pointer whitespace-nowrap"
                title="Envoie cette liste dans le panier Éminences ci-dessous pour passer commande avec les contacts"
              >
                📲 Envoyer au panier Éminences
              </button>
            )}

          {!readonly && orderSummary.totalUnits > 0 && (
            <>
              <select
                value={debitAccount}
                onChange={(e) =>
                  setDebitAccount(e.target.value as 'none' | 'legal' | 'illegal')
                }
                className="bg-charcoal border border-bronze/60 focus:border-gold rounded-xl px-2.5 py-2 text-xs text-zinc-200 focus:outline-none"
                title="Débiter ou non le coût de la commande de la Trésorerie"
              >
                <option value="none">Stock seul (ne pas débiter la caisse)</option>
                <option value="illegal">
                  Débiter Argent Sale ({formatMoney(treasuryMoney.illegal || 0)})
                </option>
                <option value="legal">
                  Débiter Argent Légal ({formatMoney(treasuryMoney.legal || 0)})
                </option>
              </select>
              <button
                type="button"
                onClick={handleConfirmReceipt}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-gold hover:bg-gold-light text-obsidian transition shadow-lg cursor-pointer whitespace-nowrap"
              >
                ✅ Réceptionner (+Stock)
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
