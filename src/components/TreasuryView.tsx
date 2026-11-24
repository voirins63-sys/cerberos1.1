import React from 'react';
import { LootSaleSection } from '@/src/components/LootSaleSection';
import { INVENTORY_ITEMS, REWARD_ITEMS, WEEKLY_SCHEDULE } from '@/src/data/cartelData';
import type {
  CatalogGroupsMap,
  HierarchyMember,
  InventoryPrices,
  InventoryStock,
  LostWeaponRecord,
  MissionStates,
  RewardStocks,
  TreasuryMoney,
  WeaponsStock,
} from '@/src/types/cartel';
import {
  calcInventoryTotalValue,
  calcRewardsTotalValue,
  calcTotalWealth,
  calcWeaponsTotalValue,
  formatMoney,
  getCatalogExtraInventoryItems,
  getInventoryItemPrice,
  getMissionEntry,
  getWeaponHolderName,
  missionFin,
} from '@/src/utils/finance';

interface TreasuryViewProps {
  treasuryMoney: TreasuryMoney;
  rewardStocks: RewardStocks;
  inventoryStock: InventoryStock;
  inventoryPrices?: InventoryPrices;
  weaponsStock: WeaponsStock;
  missionStates: MissionStates;
  weaponsLossAmount: number;
  members: HierarchyMember[];
  catalogGroups?: CatalogGroupsMap;
  readonly: boolean;
  onUpdateTreasuryMoney: (type: keyof TreasuryMoney, val: number) => void;
  onUpdateRewardQty: (key: string, delta: number) => void;
  onUpdateRewardValue: (key: string, val: number) => void;
  onApplyOfficialRewardPrices?: () => void;
  onSellRewards: (
    soldQuantities: Record<string, number>,
    channelLabel: string,
    customAmountOverride?: number
  ) => void;
}

export const TreasuryView: React.FC<TreasuryViewProps> = ({
  treasuryMoney,
  rewardStocks,
  inventoryStock,
  inventoryPrices,
  weaponsStock,
  missionStates,
  weaponsLossAmount,
  members,
  catalogGroups,
  readonly,
  onUpdateTreasuryMoney,
  onUpdateRewardQty,
  onUpdateRewardValue,
  onApplyOfficialRewardPrices,
  onSellRewards,
}) => {
  const rewardsValTotal = calcRewardsTotalValue(rewardStocks);
  const inventoryValTotal = calcInventoryTotalValue(inventoryStock, inventoryPrices, catalogGroups);
  const weaponsValTotal = calcWeaponsTotalValue(weaponsStock);
  const totalWeaponsCount = Object.values(weaponsStock).reduce(
    (sum, w) => sum + Math.max(0, Number(w?.qty) || 0),
    0
  );
  const totalWealth = calcTotalWealth({
    treasuryMoney,
    rewardStocks,
    inventoryStock,
    inventoryPrices,
    weaponsStock,
    catalogGroups,
  });
  const catalogExtraItems = getCatalogExtraInventoryItems(catalogGroups);
  const stockedItems = [
    ...INVENTORY_ITEMS.map((item) => ({
      key: item.key,
      name: item.name,
      fallbackPrice: item.price,
    })),
    ...catalogExtraItems.map((item) => ({
      key: item.key,
      name: item.name,
      fallbackPrice: item.price,
    })),
  ].filter((item) => (Number(inventoryStock[item.key]) || 0) > 0);
  const stockedWeapons = Object.values(weaponsStock).filter(
    (w) => w && (Number(w.qty) || 0) > 0
  );
  const stockedRewards = REWARD_ITEMS.map((item) => {
    const dat = rewardStocks[item.key] || { qty: 0, val: item.defaultVal };
    const qty = Math.max(0, Number(dat.qty) || 0);
    const val = dat.val !== undefined ? Math.max(0, Number(dat.val) || 0) : item.defaultVal;
    return { item, qty, val, subTotal: qty * val };
  }).filter((r) => r.qty > 0);
  const totalRewardsQty = stockedRewards.reduce((sum, r) => sum + r.qty, 0);
  const receleurValTotal = stockedRewards
    .filter((r) => r.item.buyerGroup !== 'whiskey')
    .reduce((sum, r) => sum + r.subTotal, 0);
  const whiskeyValTotal = Math.max(0, rewardsValTotal - receleurValTotal);

  let weekMaterialCost = 0;
  let weekExtraLoss = 0;
  const missionLostWeapons: Array<LostWeaponRecord & { missionName: string }> = [];
  WEEKLY_SCHEDULE.forEach((day) => {
    day.missions.forEach((m) => {
      const f = missionFin(m, missionStates, inventoryPrices, catalogGroups);
      weekMaterialCost += f.cost;
      weekExtraLoss += f.extra;
      const entry = getMissionEntry(missionStates, m.id);
      if (Array.isArray(entry.lostWeapons)) {
        entry.lostWeapons.forEach((lw) => {
          missionLostWeapons.push({ ...lw, missionName: `${day.day} · ${m.name}` });
        });
      }
    });
  });
  const totalDebitedLosses = weekExtraLoss + Math.max(0, Number(weaponsLossAmount) || 0);

  return (
    <div className="space-y-6">
      <div className="bg-charcoal/90 gold-border rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-zinc-800">
          <div>
            <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
              <span className="text-gold">🏛️</span> Trésorerie, Argent &amp; Marché Noir (Éminences)
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Gérez les fonds du cartel (argent légal, illégal), les récompenses du recel et la valeur du stock (matériel + armes).
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-zinc-500 block">
              Valeur Totale Trésor
            </span>
            <span className="font-display text-lg font-extrabold text-gold tabular-nums">
              {formatMoney(totalWealth)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="bg-obsidian/80 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                💵 Argent Légal en Caisse
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">Propre</span>
            </div>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="1000"
                value={treasuryMoney.legal || 0}
                disabled={readonly}
                onChange={(e) =>
                  onUpdateTreasuryMoney('legal', Math.max(0, Number(e.target.value) || 0))
                }
                placeholder="0"
                className="w-full bg-zinc-950 border border-zinc-700 focus:border-emerald-500 rounded-xl pl-3.5 pr-7 py-2.5 text-right font-mono tabular-nums text-base font-bold text-emerald-300 focus:outline-none disabled:opacity-60"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-sm text-zinc-500 pointer-events-none">
                $
              </span>
            </div>
          </div>

          <div className="bg-obsidian/80 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-crimson-light">
                💰 Argent Illégal / Sale
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">À blanchir</span>
            </div>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="1000"
                value={treasuryMoney.illegal || 0}
                disabled={readonly}
                onChange={(e) =>
                  onUpdateTreasuryMoney('illegal', Math.max(0, Number(e.target.value) || 0))
                }
                placeholder="0"
                className="w-full bg-zinc-950 border border-zinc-700 focus:border-crimson-light rounded-xl pl-3.5 pr-7 py-2.5 text-right font-mono tabular-nums text-base font-bold text-red-300 focus:outline-none disabled:opacity-60"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-sm text-zinc-500 pointer-events-none">
                $
              </span>
            </div>
          </div>

          <div className="bg-obsidian/80 border border-amber-500/40 rounded-xl p-4 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                💎 Objets à Vendre
              </span>
              <span className="text-[10px] text-zinc-400 font-mono tabular-nums">
                {totalRewardsQty} objet{totalRewardsQty > 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5">
              <span className="text-[11px] text-zinc-400">
                Recel / Whiskey
              </span>
              <span className="font-mono tabular-nums text-base font-bold text-gold">
                {formatMoney(rewardsValTotal)}
              </span>
            </div>
            <div className="text-[10px] font-mono text-zinc-400 tabular-nums">
              Receleur {formatMoney(receleurValTotal)} · Whiskey {formatMoney(whiskeyValTotal)}
            </div>
          </div>

          <div className="bg-obsidian/80 border border-gold/30 rounded-xl p-4 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gold">
                💣 Matériel Braquage
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">Packs &amp; outils</span>
            </div>
            <div className="flex items-baseline justify-between gap-2 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5">
              <span className="text-[11px] text-zinc-400">Stock</span>
              <span className="font-mono tabular-nums text-base font-bold text-gold">
                {formatMoney(inventoryValTotal)}
              </span>
            </div>
          </div>

          <div className="bg-obsidian/80 border border-crimson/40 rounded-xl p-4 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-red-300">
                🔫 Arsenal (Armes)
              </span>
              <span className="text-[10px] text-zinc-400 font-mono tabular-nums">
                {totalWeaponsCount} arme{totalWeaponsCount > 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5">
              <span className="text-[11px] text-zinc-400">Armurerie</span>
              <span className="font-mono tabular-nums text-base font-bold text-white">
                {formatMoney(weaponsValTotal)}
              </span>
            </div>
          </div>
        </div>

        {(stockedItems.length > 0 || stockedWeapons.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-obsidian/60 border border-zinc-800/80 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                  💣 Matériel de Braquage en stock
                </span>
                <span className="text-xs font-mono font-bold text-gold tabular-nums">
                  {formatMoney(inventoryValTotal)}
                </span>
              </div>
              {stockedItems.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {stockedItems.map((item) => {
                    const qty = Number(inventoryStock[item.key]) || 0;
                    const unitPrice = getInventoryItemPrice(
                      item.key,
                      inventoryPrices,
                      item.fallbackPrice
                    );
                    return (
                      <span
                        key={item.key}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-700/80 text-[11px] text-zinc-200 tabular-nums"
                      >
                        <span>📦 {item.name}</span>
                        <span className="font-mono text-zinc-400">&times;{qty}</span>
                        <span className="font-mono font-bold text-gold">
                          ({formatMoney(qty * unitPrice)})
                        </span>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-zinc-500 italic">Aucun matériel de braquage en stock.</p>
              )}
            </div>

            <div className="bg-obsidian/60 border border-zinc-800/80 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-red-300">
                  🔫 Arsenal (Armes) comptabilisé
                </span>
                <span className="text-xs font-mono font-bold text-gold tabular-nums">
                  {formatMoney(weaponsValTotal)}
                </span>
              </div>
              {stockedWeapons.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {stockedWeapons.map((w) => {
                    const qty = Math.max(1, Number(w.qty) || 1);
                    const val = Math.max(0, Number(w.value) || 0);
                    const holderName = getWeaponHolderName(w.holderId, members);
                    return (
                      <span
                        key={w.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-crimson/10 border border-crimson/40 text-[11px] text-zinc-100 tabular-nums"
                      >
                        <span>🔫 {w.name}</span>
                        <span className="font-mono text-zinc-400">&times;{qty}</span>
                        <span className="text-zinc-300">— {holderName}</span>
                        <span className="font-mono font-bold text-gold">
                          ({formatMoney(qty * val)})
                        </span>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-zinc-500 italic">Aucune arme enregistrée.</p>
              )}
            </div>
          </div>
        )}

        {(totalDebitedLosses > 0 || weekMaterialCost > 0 || missionLostWeapons.length > 0) && (
          <div className="bg-red-950/20 border border-red-500/35 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-red-300">
                📉 Pertes &amp; Débits de la semaine (déduits de l&apos;Inventaire &amp; du Trésor)
              </span>
              <span className="text-xs font-mono font-bold text-red-300 tabular-nums">
                Pertes armes/missions : -{formatMoney(totalDebitedLosses)} · Matériel utilisé : -{formatMoney(weekMaterialCost)}
              </span>
            </div>
            {missionLostWeapons.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {missionLostWeapons.map((lw, idx) => (
                  <span
                    key={`${lw.id}-${idx}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-950/60 border border-red-500/40 text-[11px] text-red-200 tabular-nums"
                  >
                    <span>🔫 {lw.name}</span>
                    <span className="text-zinc-400">({lw.holderName})</span>
                    <span className="text-zinc-500">· {lw.missionName}</span>
                    <span className="font-mono font-bold text-red-300">
                      -{formatMoney(lw.value)}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      <LootSaleSection
        rewardStocks={rewardStocks}
        treasuryMoney={treasuryMoney}
        readonly={readonly}
        allowPriceEdit
        onUpdateRewardQty={onUpdateRewardQty}
        onUpdateRewardValue={onUpdateRewardValue}
        onApplyOfficialRewardPrices={onApplyOfficialRewardPrices}
        onSellRewards={onSellRewards}
      />
    </div>
  );
};
