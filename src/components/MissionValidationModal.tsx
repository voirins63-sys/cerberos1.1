import React, { useEffect, useMemo, useRef, useState } from 'react';
import { INVENTORY_ITEMS, REWARD_ITEMS } from '@/src/data/cartelData';
import {
  getEminenceCatalogItemsMap,
  getEminenceMissionByGearKey,
  getStockKeyDisplayName,
  resolveCatalogItemStockKey,
} from '@/src/data/eminenceMissions';
import type {
  CatalogGroupsMap,
  HierarchyMember,
  InventoryPrices,
  InventoryStock,
  LostWeaponRecord,
  Mission,
  MissionStateEntry,
  RewardStocks,
  TreasuryMoney,
  WeaponsStock,
} from '@/src/types/cartel';
import {
  calcUsedGearCost,
  formatMoney,
  formatSigned,
  getMissionCost,
  getMissionGearLabel,
  getStatus,
  getWeaponHolderName,
} from '@/src/utils/finance';

export interface MissionValidationPayload {
  missionId: string;
  status: 'success' | 'fail';
  usedGear: Record<string, number>;
  loot: Record<string, number>;
  cashGain: number;
  lostWeapons: LostWeaponRecord[];
  cashLoss: number;
  treasuryDebitAccount: 'none' | 'illegal' | 'legal';
  treasuryDebitAmount: number;
  players: string[];
}

interface MissionValidationModalProps {
  open: boolean;
  mission: Mission | null;
  dayName: string;
  initialStatus?: 'success' | 'fail';
  entry: MissionStateEntry;
  inventoryStock: InventoryStock;
  inventoryPrices?: InventoryPrices;
  catalogGroups?: CatalogGroupsMap;
  weaponsStock: WeaponsStock;
  rewardStocks: RewardStocks;
  treasuryMoney: TreasuryMoney;
  members: HierarchyMember[];
  onClose: () => void;
  onConfirm: (payload: MissionValidationPayload) => void;
  onResetMission: (missionId: string) => void;
}

function getPreviousUsedGear(
  entry: MissionStateEntry,
  mission: Mission
): Record<string, number> {
  if (entry.usedGear && typeof entry.usedGear === 'object') {
    const clean: Record<string, number> = {};
    Object.entries(entry.usedGear).forEach(([k, q]) => {
      const qty = Math.max(0, Math.floor(Number(q) || 0));
      if (qty > 0) clean[k] = qty;
    });
    if (Object.keys(clean).length > 0) return clean;
  }
  if (entry.gearConsumed && mission.gearKey !== 'none') {
    if (INVENTORY_ITEMS.some((i) => i.key === mission.gearKey)) {
      return { [mission.gearKey]: 1 };
    }
    if (mission.gearKey === 'amu') {
      return { cat_em_cle_ammunation: 1 };
    }
  }
  return {};
}

export const MissionValidationModal: React.FC<MissionValidationModalProps> = ({
  open,
  mission,
  dayName,
  initialStatus,
  entry,
  inventoryStock,
  inventoryPrices,
  catalogGroups,
  weaponsStock,
  rewardStocks,
  treasuryMoney,
  members,
  onClose,
  onConfirm,
  onResetMission,
}) => {
  const [status, setStatus] = useState<'success' | 'fail'>('success');
  const [usedGear, setUsedGear] = useState<Record<string, number>>({});
  const [showOtherGear, setShowOtherGear] = useState(false);
  const [loot, setLoot] = useState<Record<string, number>>({});
  const [cashGain, setCashGain] = useState<string>('');
  const [lostWeapons, setLostWeapons] = useState<LostWeaponRecord[]>([]);
  const [selectedWeaponId, setSelectedWeaponId] = useState<string>('');
  const [cashLoss, setCashLoss] = useState<string>('');
  const [treasuryDebitAccount, setTreasuryDebitAccount] = useState<'none' | 'illegal' | 'legal'>('none');
  const [players, setPlayers] = useState<string[]>([]);
  const initKeyRef = useRef<string>('');

  useEffect(() => {
    if (!open || !mission) {
      initKeyRef.current = '';
      return;
    }

    const key = `${mission.id}:${initialStatus || ''}`;
    if (initKeyRef.current === key) return;
    initKeyRef.current = key;

    const currentStatus = getStatus(entry);
    setStatus(initialStatus || (currentStatus === 'fail' ? 'fail' : 'success'));

    const prevUsed = getPreviousUsedGear(entry, mission);
    const hasMissionGear =
      mission.gearKey !== 'none' && INVENTORY_ITEMS.some((i) => i.key === mission.gearKey);
    const blueprint = getEminenceMissionByGearKey(mission.gearKey);
    const catalogMap = getEminenceCatalogItemsMap(catalogGroups);

    if (Object.keys(prevUsed).length > 0) {
      setUsedGear(prevUsed);
    } else if (hasMissionGear && (inventoryStock[mission.gearKey] || 0) > 0) {
      setUsedGear({ [mission.gearKey]: 1 });
    } else if (blueprint && blueprint.requirements.length > 0) {
      // Fallback: auto-select solo Éminences components if a full kit is available in vault
      const candidate: Record<string, number> = {};
      let allInStock = true;
      blueprint.requirements.forEach((req) => {
        const sk = resolveCatalogItemStockKey(catalogMap.get(req.itemId));
        if (!sk) {
          allInStock = false;
          return;
        }
        const avail = Math.max(0, Math.floor(Number(inventoryStock[sk]) || 0));
        if (avail < req.qty) {
          allInStock = false;
        } else {
          candidate[sk] = (candidate[sk] || 0) + req.qty;
        }
      });
      if (allInStock && Object.keys(candidate).length > 0) {
        setUsedGear(candidate);
      } else {
        setUsedGear({});
      }
    } else {
      setUsedGear({});
    }
    setShowOtherGear(false);

    const initLoot: Record<string, number> = {};
    let initLootVal = 0;
    if (entry.loot && typeof entry.loot === 'object') {
      Object.entries(entry.loot).forEach(([k, q]) => {
        const qty = Math.max(0, Math.floor(Number(q) || 0));
        if (qty > 0) {
          initLoot[k] = qty;
          const itemRef = REWARD_ITEMS.find((i) => i.key === k);
          const unitVal =
            rewardStocks[k]?.val !== undefined
              ? Math.max(0, Number(rewardStocks[k].val) || 0)
              : itemRef?.defaultVal || 0;
          initLootVal += qty * unitVal;
        }
      });
    }
    setLoot(initLoot);

    const existingGain = Math.max(0, Number(entry.gain) || 0);
    const initialCash =
      entry.cashGain !== undefined
        ? Math.max(0, Number(entry.cashGain) || 0)
        : Math.max(0, existingGain - initLootVal);
    setCashGain(initialCash > 0 ? String(initialCash) : '');

    const initLost = Array.isArray(entry.lostWeapons) ? [...entry.lostWeapons] : [];
    setLostWeapons(initLost);
    const initLostVal = initLost.reduce((s, w) => s + Math.max(0, Number(w.value) || 0), 0);
    const existingExtra = Math.max(0, Number(entry.extra) || 0);
    const initialOtherLoss = Math.max(0, existingExtra - initLostVal);
    setCashLoss(initialOtherLoss > 0 ? String(initialOtherLoss) : '');
    setTreasuryDebitAccount(
      initialOtherLoss > 0 ? entry.cashLossDebitAccount || 'none' : 'none'
    );
    setPlayers(Array.isArray(entry.players) ? [...entry.players] : []);
  }, [open, mission, initialStatus, entry, inventoryStock, rewardStocks, catalogGroups]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const sortedMembers = useMemo(
    () =>
      [...members].sort(
        (a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name)
      ),
    [members]
  );

  // Pool of available weapons = current stock + previously lost on this mission - currently staged lost in modal
  const availableWeapons = useMemo(() => {
    const map: WeaponsStock = {};
    Object.values(weaponsStock).forEach((w) => {
      if (w && (Number(w.qty) || 0) > 0) {
        map[w.id] = { ...w, qty: Math.floor(Number(w.qty) || 0) };
      }
    });
    const prevLost = Array.isArray(entry.lostWeapons) ? entry.lostWeapons : [];
    prevLost.forEach((lw) => {
      if (!lw.id) return;
      if (map[lw.id]) {
        map[lw.id] = { ...map[lw.id], qty: map[lw.id].qty + 1 };
      } else {
        map[lw.id] = {
          id: lw.id,
          name: lw.name,
          value: Math.max(0, Number(lw.value) || 0),
          qty: 1,
          holderId: lw.holderId || 'coffre',
          notes: '',
        };
      }
    });
    lostWeapons.forEach((lw) => {
      if (!lw.id || !map[lw.id]) return;
      if (map[lw.id].qty <= 1) {
        delete map[lw.id];
      } else {
        map[lw.id] = { ...map[lw.id], qty: map[lw.id].qty - 1 };
      }
    });
    return Object.values(map)
      .filter((w) => w.qty > 0)
      .sort((a, b) => a.name.localeCompare(b.name, 'fr-FR'));
  }, [weaponsStock, entry.lostWeapons, lostWeapons]);

  if (!open || !mission) return null;

  const prevUsedGear = getPreviousUsedGear(entry, mission);
  const gearItem = INVENTORY_ITEMS.find((i) => i.key === mission.gearKey);

  const eminenceCatalogMap = getEminenceCatalogItemsMap(catalogGroups);
  const missionBlueprint = getEminenceMissionByGearKey(mission.gearKey);
  const missionComponentItems = (() => {
    if (!missionBlueprint) return [] as Array<{ key: string; name: string; category: string; reqQty: number }>;
    const list: Array<{ key: string; name: string; category: string; reqQty: number }> = [];
    const seen = new Set<string>();
    missionBlueprint.requirements.forEach((req) => {
      const catItem = eminenceCatalogMap.get(req.itemId);
      const sk = resolveCatalogItemStockKey(catItem);
      if (!catItem || !sk || sk === mission.gearKey || seen.has(sk)) return;
      seen.add(sk);
      const std = INVENTORY_ITEMS.find((i) => i.key === sk);
      list.push({
        key: sk,
        name: std?.name || catItem.name,
        category: std?.category || 'tool',
        reqQty: req.qty,
      });
    });
    return list;
  })();

  const getMaxGearForKey = (k: string) =>
    Math.max(0, Number(inventoryStock[k]) || 0) + Math.max(0, Number(prevUsedGear[k]) || 0);

  const adjustGear = (k: string, delta: number) => {
    const maxAllowed = getMaxGearForKey(k);
    setUsedGear((prev) => {
      const cur = Math.max(0, Number(prev[k]) || 0);
      const nextQty = Math.max(0, Math.min(maxAllowed, cur + delta));
      const copy = { ...prev };
      if (nextQty === 0) delete copy[k];
      else copy[k] = nextQty;
      return copy;
    });
  };

  const componentKeySet = new Set(missionComponentItems.map((c) => c.key));
  const extraSelectedGearItems: Array<{ key: string; name: string; category: string }> = [
    ...INVENTORY_ITEMS.filter(
      (item) =>
        item.key !== mission.gearKey &&
        !componentKeySet.has(item.key) &&
        ((usedGear[item.key] || 0) > 0 || (inventoryStock[item.key] || 0) > 0)
    ),
    ...Object.keys(usedGear)
      .filter(
        (k) =>
          k !== mission.gearKey &&
          !componentKeySet.has(k) &&
          !INVENTORY_ITEMS.some((i) => i.key === k)
      )
      .map((k) => ({
        key: k,
        name: getStockKeyDisplayName(k, catalogGroups),
        category: 'tool',
      })),
  ];

  const lootTotalVal =
    status === 'success'
      ? REWARD_ITEMS.reduce((sum, item) => {
          const q = Math.max(0, Number(loot[item.key]) || 0);
          const unitVal =
            rewardStocks[item.key]?.val !== undefined
              ? Math.max(0, Number(rewardStocks[item.key].val) || 0)
              : item.defaultVal;
          return sum + q * unitVal;
        }, 0)
      : 0;

  const parsedCashGain = status === 'success' ? Math.max(0, Number(cashGain) || 0) : 0;
  const prevCreditedCash = Math.max(0, Number(entry.cashGain) || 0);
  const illegalCashDelta = parsedCashGain - prevCreditedCash;
  const totalMissionGain = lootTotalVal + parsedCashGain;
  const weaponsLossVal = lostWeapons.reduce((s, w) => s + Math.max(0, Number(w.value) || 0), 0);
  const parsedCashLoss = Math.max(0, Number(cashLoss) || 0);
  const totalMissionExtra = weaponsLossVal + parsedCashLoss;
  const usedCostInfo = calcUsedGearCost(usedGear, inventoryPrices, catalogGroups);
  const missionCost = usedCostInfo.hasItems
    ? usedCostInfo.cost
    : getMissionCost(mission, inventoryPrices, catalogGroups);
  const netEstimate = totalMissionGain - missionCost - totalMissionExtra;

  const chosenWeaponId =
    selectedWeaponId && availableWeapons.some((w) => w.id === selectedWeaponId)
      ? selectedWeaponId
      : availableWeapons[0]?.id || '';

  const adjustLoot = (key: string, delta: number) => {
    setLoot((prev) => {
      const nextQty = Math.max(0, (prev[key] || 0) + delta);
      const copy = { ...prev };
      if (nextQty === 0) delete copy[key];
      else copy[key] = nextQty;
      return copy;
    });
  };

  const addLostWeapon = () => {
    if (!chosenWeaponId) return;
    const weapon = availableWeapons.find((w) => w.id === chosenWeaponId);
    if (!weapon) return;
    setLostWeapons((prev) => [
      ...prev,
      {
        id: weapon.id,
        name: weapon.name,
        value: Math.max(0, Number(weapon.value) || 0),
        holderId: weapon.holderId || 'coffre',
        holderName: getWeaponHolderName(weapon.holderId, members),
      },
    ]);
  };

  const removeLostWeapon = (idx: number) => {
    setLostWeapons((prev) => prev.filter((_, i) => i !== idx));
  };

  const togglePlayer = (pid: string) => {
    setPlayers((prev) =>
      prev.includes(pid) ? prev.filter((id) => id !== pid) : [...prev, pid]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const debitAmount = treasuryDebitAccount !== 'none' ? parsedCashLoss : 0;
    onConfirm({
      missionId: mission.id,
      status,
      usedGear,
      loot: status === 'success' ? loot : {},
      cashGain: parsedCashGain,
      lostWeapons,
      cashLoss: parsedCashLoss,
      treasuryDebitAccount,
      treasuryDebitAmount: debitAmount,
      players,
    });
  };

  const wasAlreadyDone = getStatus(entry) !== '';

  const renderGearRow = (
    item: { key: string; name: string; category: string },
    reqQtyHint?: number
  ) => {
    const qty = usedGear[item.key] || 0;
    const prevQty = prevUsedGear[item.key] || 0;
    const maxAvail = getMaxGearForKey(item.key);
    const remainingAfter = Math.max(0, maxAvail - qty);
    const isLastHeistPack = item.category === 'heist_pack' && qty > 0 && remainingAfter === 0;
    const isToolEmpty = item.category === 'tool' && qty > 0 && remainingAfter === 0;
    const isToolLastOne = item.category === 'tool' && qty > 0 && remainingAfter === 1;

    return (
      <div
        key={item.key}
        className={`flex items-center justify-between gap-3 flex-wrap rounded-lg border px-3 py-2 text-xs ${
          isLastHeistPack || isToolEmpty
            ? 'bg-red-950/35 border-red-500/50'
            : isToolLastOne
              ? 'bg-amber-500/15 border-amber-400/60'
              : qty > 0
                ? 'bg-amber-500/10 border-amber-500/40'
                : 'bg-zinc-950/70 border-zinc-800'
        }`}
      >
        <div className="min-w-0">
          <div className="font-bold text-white flex items-center gap-1.5 flex-wrap">
            <span>
              📦 {reqQtyHint && reqQtyHint > 1 ? `${reqQtyHint}× ` : ''}
              {item.name}
            </span>
            {prevQty > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-300 font-normal">
                Déjà débité : {prevQty}
              </span>
            )}
            {isLastHeistPack && (
              <span className="px-1.5 py-0.5 rounded bg-red-500/25 border border-red-500/50 text-[10px] text-red-200 font-bold">
                🚨 Dernier pack en stock !
              </span>
            )}
            {isToolEmpty && (
              <span className="px-1.5 py-0.5 rounded bg-red-500/25 border border-red-500/50 text-[10px] text-red-200 font-bold">
                🚨 Stock épuisé après validation
              </span>
            )}
            {isToolLastOne && (
              <span className="px-1.5 py-0.5 rounded bg-amber-500/25 border border-amber-400/50 text-[10px] text-amber-200 font-bold">
                ⚠️ Plus que 1 restant après
              </span>
            )}
          </div>
          <div className="text-[11px] text-zinc-400 tabular-nums mt-0.5">
            Stock dispo :{' '}
            <strong className={maxAvail > 0 ? 'text-emerald-300' : 'text-red-300'}>
              {maxAvail}
            </strong>
            {qty > 0 && (
              <span className="text-amber-300">
                {' '}
                → restera <strong>{remainingAfter}</strong> en stock
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            disabled={qty <= 0}
            onClick={() => adjustGear(item.key, -1)}
            className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-35 text-white font-bold flex items-center justify-center cursor-pointer"
          >
            -
          </button>
          <span className="font-mono font-bold text-amber-300 w-6 text-center tabular-nums">
            {qty}
          </span>
          <button
            type="button"
            disabled={qty >= maxAvail}
            onClick={() => adjustGear(item.key, 1)}
            className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-gold hover:text-obsidian disabled:opacity-35 text-white font-bold flex items-center justify-center cursor-pointer"
          >
            +
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-charcoal gold-border rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-5 my-auto max-h-[92vh] overflow-y-auto"
      >
        {/* HEADER */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-zinc-800">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-gold block">
              {dayName} · Validation de mission
            </span>
            <h3 className="font-display text-lg sm:text-xl font-extrabold text-white mt-0.5">
              {mission.name}
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              👥 {mission.crims} · ⏱️ {mission.wait} · 📦{' '}
              {getMissionGearLabel(mission, inventoryPrices, catalogGroups)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white text-xl font-bold leading-none cursor-pointer px-1"
            aria-label="Fermer"
          >
            &times;
          </button>
        </div>

        {/* 1. ISSUE DE LA MISSION */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
            1. Résultat de l&apos;opération
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setStatus('success')}
              className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold border transition cursor-pointer ${
                status === 'success'
                  ? 'bg-emerald-500 text-obsidian border-emerald-400 shadow-lg shadow-emerald-500/20'
                  : 'bg-obsidian/80 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/15'
              }`}
            >
              ✅ Mission Réussie
            </button>
            <button
              type="button"
              onClick={() => setStatus('fail')}
              className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold border transition cursor-pointer ${
                status === 'fail'
                  ? 'bg-red-600 text-white border-red-400 shadow-lg shadow-red-600/20'
                  : 'bg-obsidian/80 text-red-300 border-red-500/30 hover:bg-red-500/15'
              }`}
            >
              ❌ Mission Échouée / Perdue
            </button>
          </div>
        </div>

        {/* 2. MATÉRIEL UTILISÉ (DÉBIT INVENTAIRE) */}
        <div className="bg-obsidian/75 border border-zinc-800 rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
              📦 Matériel utilisé (→ Débit Inventaire)
            </span>
            {extraSelectedGearItems.length > 0 && (
              <button
                type="button"
                onClick={() => setShowOtherGear((v) => !v)}
                className="text-[11px] font-semibold text-gold hover:text-gold-light underline underline-offset-4 cursor-pointer"
              >
                {showOtherGear
                  ? 'Masquer les autres matériels'
                  : '+ Débiter un autre matériel du stock'}
              </button>
            )}
          </div>

          {gearItem ? (
            renderGearRow(gearItem)
          ) : missionComponentItems.length === 0 ? (
            <p className="text-[11px] text-zinc-400">
              Aucun pack obligatoire tarifé sur cette mission — tu peux quand même débiter un outil/pack ci-dessous si utilisé (ex: Outil de hacking).
            </p>
          ) : null}

          {missionComponentItems.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {gearItem && (
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Ou items Éminences à l&apos;unité utilisés :
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {missionComponentItems.map((comp) => renderGearRow(comp, comp.reqQty))}
              </div>
            </div>
          )}

          {(showOtherGear ||
            (!gearItem && missionComponentItems.length === 0 && extraSelectedGearItems.length > 0) ||
            extraSelectedGearItems.some((it) => (usedGear[it.key] || 0) > 0)) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {extraSelectedGearItems
                .filter(
                  (it) =>
                    showOtherGear ||
                    (!gearItem && missionComponentItems.length === 0) ||
                    (usedGear[it.key] || 0) > 0
                )
                .map((item) => renderGearRow(item))}
            </div>
          )}
        </div>

        {/* 3. ITEMS RÉCUPÉRÉS & GAINS (SI RÉUSSIE) */}
        {status === 'success' && (
          <div className="bg-emerald-950/15 border border-emerald-500/30 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                💎 Objets récupérés (→ Inventaire &amp; Trésorerie)
              </span>
              <span className="text-xs font-mono font-bold text-emerald-300 tabular-nums">
                Valeur objets : +{formatMoney(lootTotalVal)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {REWARD_ITEMS.map((item) => {
                const qty = loot[item.key] || 0;
                const unitVal =
                  rewardStocks[item.key]?.val !== undefined
                    ? Math.max(0, Number(rewardStocks[item.key].val) || 0)
                    : item.defaultVal;
                return (
                  <div
                    key={item.key}
                    className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-xs ${
                      qty > 0
                        ? 'bg-amber-500/15 border-amber-500/50 text-amber-100'
                        : 'bg-zinc-950/80 border-zinc-800 text-zinc-300'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{item.name}</div>
                      <div className="text-[10px] font-mono text-zinc-400">
                        {formatMoney(unitVal)} / u
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={qty <= 0}
                        onClick={() => adjustLoot(item.key, -1)}
                        className="w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-35 text-white font-bold flex items-center justify-center cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-mono font-bold text-gold w-5 text-center tabular-nums">
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => adjustLoot(item.key, 1)}
                        className="w-6 h-6 rounded bg-zinc-800 hover:bg-gold hover:text-obsidian text-white font-bold flex items-center justify-center cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-emerald-500/20 space-y-1.5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <label className="text-xs font-semibold text-zinc-200">
                  💰 Gains en Argent Sale ($) <span className="text-emerald-300/90">(→ Trésorerie Argent Illégal)</span> :
                </label>
                <div className="relative w-40">
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={cashGain}
                    onChange={(e) => setCashGain(e.target.value)}
                    placeholder="0"
                    className="w-full bg-zinc-950 border border-zinc-700 focus:border-emerald-400 rounded-lg pl-3 pr-7 py-1.5 text-right text-xs font-mono tabular-nums text-emerald-300 focus:outline-none"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-zinc-500">
                    $
                  </span>
                </div>
              </div>
              {(parsedCashGain > 0 || prevCreditedCash > 0) && (
                <div className="text-[11px] text-right font-mono tabular-nums">
                  {illegalCashDelta > 0 ? (
                    <span className="text-emerald-300">
                      +{formatMoney(illegalCashDelta)} crédités dans Argent Illégal / Sale
                    </span>
                  ) : illegalCashDelta < 0 ? (
                    <span className="text-amber-300">
                      -{formatMoney(Math.abs(illegalCashDelta))} ajustés sur Argent Illégal / Sale
                    </span>
                  ) : (
                    <span className="text-zinc-400">
                      Déjà crédité en Argent Sale : {formatMoney(prevCreditedCash)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. ARMES PERDUES & PERTES TRÉSORERIE */}
        <div
          className={`rounded-xl p-4 space-y-3 border ${
            status === 'fail'
              ? 'bg-red-950/25 border-red-500/45'
              : 'bg-obsidian/70 border-zinc-800'
          }`}
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider text-red-300">
              🔫 Armes perdues &amp; Débit Trésorerie
            </span>
            {totalMissionExtra > 0 && (
              <span className="text-xs font-mono font-bold text-red-300 tabular-nums">
                Total pertes : -{formatMoney(totalMissionExtra)}
              </span>
            )}
          </div>

          {lostWeapons.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {lostWeapons.map((lw, idx) => (
                <span
                  key={`${lw.id}-${idx}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-red-950/70 border border-red-500/50 text-red-200 tabular-nums"
                >
                  <span>
                    {lw.name} ({lw.holderName}) · -{formatMoney(lw.value)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeLostWeapon(idx)}
                    className="text-red-300 hover:text-white font-bold cursor-pointer"
                    title="Retirer cette arme perdue"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}

          {availableWeapons.length > 0 ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <select
                value={chosenWeaponId}
                onChange={(e) => setSelectedWeaponId(e.target.value)}
                className="flex-1 min-w-0 bg-zinc-950 border border-zinc-700 focus:border-red-400 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none"
              >
                {availableWeapons.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} — {getWeaponHolderName(w.holderId, members)} ({formatMoney(w.value)}) [x{w.qty}]
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={addLostWeapon}
                className="px-3.5 py-2 rounded-lg text-xs font-bold bg-crimson/35 hover:bg-crimson/55 text-red-100 border border-crimson-light/40 transition whitespace-nowrap cursor-pointer"
              >
                + Déclarer perdue (-1)
              </button>
            </div>
          ) : (
            <p className="text-[11px] italic text-zinc-400">
              Aucune arme disponible en stock dans l&apos;Armurerie.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-zinc-800/70">
            <div>
              <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                Autre montant perdu / Amende ($) :
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={cashLoss}
                  onChange={(e) => setCashLoss(e.target.value)}
                  placeholder="0"
                  className="w-full bg-zinc-950 border border-zinc-700 focus:border-red-400 rounded-lg pl-3 pr-7 py-1.5 text-right text-xs font-mono tabular-nums text-red-300 focus:outline-none"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-zinc-500">
                  $
                </span>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                Débiter ce montant cash de la caisse :
              </label>
              <select
                value={treasuryDebitAccount}
                disabled={parsedCashLoss <= 0}
                onChange={(e) =>
                  setTreasuryDebitAccount(e.target.value as 'none' | 'illegal' | 'legal')
                }
                className="w-full bg-zinc-950 border border-zinc-700 focus:border-red-400 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none disabled:opacity-45"
              >
                <option value="none">Comptabilité seule (ne pas toucher au cash)</option>
                <option value="illegal">
                  Déduire de l&apos;Argent Illégal ({formatMoney(treasuryMoney.illegal || 0)})
                </option>
                <option value="legal">
                  Déduire de l&apos;Argent Légal ({formatMoney(treasuryMoney.legal || 0)})
                </option>
              </select>
            </div>
          </div>
          {weaponsLossVal > 0 && (
            <p className="text-[11px] text-red-200/80">
              ℹ️ Les armes perdues ({formatMoney(weaponsLossVal)}) sont automatiquement déduites du stock Armurerie, de la Trésorerie &amp; Actifs Totaux, et ajoutées aux pertes de la mission.
            </p>
          )}
        </div>

        {/* 5. JOUEURS PARTICIPANTS */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              👥 Joueurs participants ({players.length})
            </span>
          </div>
          {sortedMembers.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {sortedMembers.map((member) => {
                const selected = players.includes(member.id);
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => togglePlayer(member.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border transition cursor-pointer ${
                      selected
                        ? 'bg-gold/20 border-gold text-gold-light font-semibold'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    {selected ? '✓ ' : '+ '}
                    {member.name}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs italic text-zinc-500">Aucun membre configuré.</p>
          )}
        </div>

        {/* RÉCAP & ACTIONS */}
        <div className="bg-obsidian/90 border border-gold/30 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs space-y-0.5 tabular-nums">
            <div className="text-zinc-400">
              Gains : <strong className="text-emerald-400">+{formatMoney(totalMissionGain)}</strong> ·
              Matériel : <strong className="text-amber-300">-{formatMoney(missionCost)}</strong> ·
              Pertes : <strong className="text-red-400">-{formatMoney(totalMissionExtra)}</strong>
            </div>
            <div className="font-bold text-white">
              Résultat net mission :{' '}
              <span className={netEstimate >= 0 ? 'text-emerald-400' : 'text-crimson-light'}>
                {netEstimate >= 0 ? '+' : '-'}
                {formatMoney(Math.abs(netEstimate))}
              </span>
              {players.length > 0 && (
                <span className="text-[11px] font-normal text-zinc-400 ml-2">
                  ({formatSigned(Math.round(netEstimate / players.length))} / pers.)
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {wasAlreadyDone && (
              <button
                type="button"
                onClick={() => {
                  onResetMission(mission.id);
                  onClose();
                }}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-red-300 border border-red-500/30 transition cursor-pointer"
              >
                Annuler statut
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer"
            >
              Fermer
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-gold hover:bg-gold-light text-obsidian transition shadow-lg cursor-pointer"
            >
              ✅ Valider la mission
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
