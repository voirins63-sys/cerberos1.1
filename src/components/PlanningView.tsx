import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, RefreshCw, RotateCcw, ScrollText, AlertTriangle } from 'lucide-react';
import {
  DAY_NAMES,
  INVENTORY_ITEMS,
  REGULATION_FAIRPLAY_NOTE,
  REGULATION_TABLE_ROWS,
  REWARD_ITEMS,
} from '@/src/data/cartelData';
import {
  checkMissionStockAvailability,
  getStockKeyDisplayName,
} from '@/src/data/eminenceMissions';
import { simulateMissionSupplyPlan } from '@/src/utils/missionSupply';
import type {
  CatalogGroupsMap,
  HierarchyMember,
  InventoryPrices,
  InventoryStock,
  Mission,
  MissionScheduleMeta,
  MissionStateEntry,
  MissionStates,
} from '@/src/types/cartel';
import {
  dayDate,
  displayWeekStart,
  fmtLong,
  fmtShort,
  formatMoney,
  formatSigned,
  getMissionCost,
  getMissionEntry,
  getMissionGearLabel,
  isTodayName,
  missionFin,
  netClass,
} from '@/src/utils/finance';
import { type EffectiveMission, getEffectiveSchedule } from '@/src/utils/schedule';

interface PlanningViewProps {
  missionStates: MissionStates;
  scheduleMeta: MissionScheduleMeta;
  inventoryStock: InventoryStock;
  inventoryPrices?: InventoryPrices;
  catalogGroups?: CatalogGroupsMap;
  members: HierarchyMember[];
  readonly: boolean;
  onOpenMissionValidation: (
    mission: Mission,
    dayName: string,
    initialStatus: 'success' | 'fail'
  ) => void;
  onResetMission: (missionId: string) => void;
  onToggleWholeDay: (dayName: string) => void;
  onToggleAllWeek: () => void;
  onRecalculateSchedule: () => void;
  onResetScheduleOverrides: () => void;
  onSendToEminenceCart?: (
    catalogItemsQty: Record<string, number>,
    options?: { navigateToOrders?: boolean; replaceCart?: boolean }
  ) => void;
}

export const PlanningView: React.FC<PlanningViewProps> = ({
  missionStates,
  scheduleMeta,
  inventoryStock,
  inventoryPrices,
  catalogGroups,
  members,
  readonly,
  onOpenMissionValidation,
  onResetMission,
  onToggleWholeDay,
  onToggleAllWeek,
  onRecalculateSchedule,
  onResetScheduleOverrides,
  onSendToEminenceCart,
}) => {
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [showRegulation, setShowRegulation] = useState<boolean>(false);
  const [showUnplaced, setShowUnplaced] = useState<boolean>(false);
  const [openDays, setOpenDays] = useState<Set<string>>(() => {
    const today = DAY_NAMES.find((d) => isTodayName(d, missionStates));
    return new Set(today ? [today] : []);
  });
  const didScrollTodayRef = useRef(false);
  const todayCardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!didScrollTodayRef.current && activeFilter === 'ALL' && todayCardRef.current) {
      didScrollTodayRef.current = true;
      const el = todayCardRef.current;
      const timer = window.setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
      return () => window.clearTimeout(timer);
    }
  }, [activeFilter]);

  const start = displayWeekStart(missionStates);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const handleFilterDay = (day: string) => {
    setActiveFilter(day);
    if (day !== 'ALL') {
      setOpenDays((prev) => {
        const next = new Set(prev);
        next.add(day);
        return next;
      });
    }
  };

  const toggleDay = (day: string) => {
    setOpenDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  const toggleAllDays = () => {
    setOpenDays((prev) => {
      if (prev.size >= DAY_NAMES.length) return new Set();
      return new Set(DAY_NAMES);
    });
  };

  const memberNameMap = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((m) => map.set(m.id, m.name));
    return map;
  }, [members]);

  const renderValidatedSummaryBadges = (st: MissionStateEntry) => {
    const usedGearEntries =
      st.usedGear && typeof st.usedGear === 'object'
        ? Object.entries(st.usedGear).filter(([, q]) => (Number(q) || 0) > 0)
        : [];
    const cashGainVal =
      st.status !== 'fail' ? Math.max(0, Number(st.cashGain) || 0) : 0;
    const lootItems = REWARD_ITEMS.filter(
      (item) => st.loot && (Number(st.loot[item.key]) || 0) > 0
    );
    const lostWeapons = Array.isArray(st.lostWeapons) ? st.lostWeapons : [];
    const playerIds = Array.isArray(st.players) ? st.players : [];
    const playerNames = playerIds
      .map((id) => memberNameMap.get(id))
      .filter((n): n is string => Boolean(n));

    if (
      usedGearEntries.length === 0 &&
      !st.gearConsumed &&
      cashGainVal <= 0 &&
      lootItems.length === 0 &&
      lostWeapons.length === 0 &&
      playerNames.length === 0
    ) {
      return null;
    }

    return (
      <div className="flex flex-wrap gap-1.5">
        {usedGearEntries.length > 0 ? (
          usedGearEntries.map(([gKey, qty]) => {
            const gLabel = getStockKeyDisplayName(gKey, catalogGroups);
            return (
              <span
                key={gKey}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 tabular-nums"
              >
                📦 -{qty} {gLabel}
              </span>
            );
          })
        ) : st.gearConsumed ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            📦 -1 matériel débité
          </span>
        ) : null}
        {cashGainVal > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-red-500/15 text-red-200 border border-red-500/35 tabular-nums">
            💰 +{formatMoney(cashGainVal)} Argent Sale
          </span>
        )}
        {lootItems.map((item) => (
          <span
            key={item.key}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-500/15 text-emerald-200 border border-emerald-500/35 tabular-nums"
          >
            💎 {item.name} &times;{st.loot![item.key]}
          </span>
        ))}
        {lostWeapons.map((lw, idx) => (
          <span
            key={`${lw.id}-${idx}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-red-950/60 text-red-200 border border-red-500/40 tabular-nums"
          >
            🔫 {lw.name} ({lw.holderName}) · -{formatMoney(lw.value)}
          </span>
        ))}
        {playerNames.map((name) => (
          <span
            key={name}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-gold/15 text-gold-light border border-gold/35"
          >
            👥 {name}
          </span>
        ))}
      </div>
    );
  };

  const effectiveSchedule = useMemo(
    () => getEffectiveSchedule(missionStates, scheduleMeta),
    [missionStates, scheduleMeta]
  );

  const supplyPlan = useMemo(
    () =>
      simulateMissionSupplyPlan({
        inventoryStock,
        inventoryPrices,
        catalogGroups,
        missionStates,
        scheduleMeta,
      }),
    [inventoryStock, inventoryPrices, catalogGroups, missionStates, scheduleMeta]
  );

  const hasScheduleAdjustments =
    effectiveSchedule.movedCount > 0 || effectiveSchedule.unplacedMissions.length > 0;

  const formattedLastRecalc = useMemo(() => {
    if (!scheduleMeta.lastRecalcAt) return null;
    const dt = new Date(scheduleMeta.lastRecalcAt);
    if (Number.isNaN(dt.getTime())) return scheduleMeta.lastRecalcDate || null;
    return dt.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [scheduleMeta.lastRecalcAt, scheduleMeta.lastRecalcDate]);

  const single = activeFilter !== 'ALL';
  const filteredDays = single
    ? effectiveSchedule.days.filter((d) => d.day === activeFilter)
    : effectiveSchedule.days;

  const renderSingleDayRows = (dayName: string, missions: EffectiveMission[]) => {
    const cols = 'lg:grid-cols-[minmax(0,2.4fr)_90px_230px_110px_110px_110px]';

    return (
      <div className="p-3 sm:p-4">
        <div
          className={`hidden lg:grid ${cols} gap-3 px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500`}
        >
          <span>Mission</span>
          <span className="text-right">Matériel</span>
          <span className="text-center">Statut</span>
          <span className="text-right">Gains</span>
          <span className="text-right">Pertes</span>
          <span className="text-right">Résultat</span>
        </div>
        <div className="space-y-1.5">
          {missions.map((m) => {
            const st = getMissionEntry(missionStates, m.id);
            const f = missionFin(m, missionStates, inventoryPrices, catalogGroups);
            const missionCost = f.done ? f.cost : getMissionCost(m, inventoryPrices, catalogGroups);
            const gearLabel = getMissionGearLabel(m, inventoryPrices, catalogGroups);
            const alloc = supplyPlan.allocationsByMissionId[m.id];
            const fallbackCheck = alloc
              ? null
              : checkMissionStockAvailability(m.gearKey, inventoryStock, catalogGroups);
            const hasStock = alloc ? alloc.available : Boolean(fallbackCheck?.available);
            const viaSoloOnly = alloc ? alloc.viaSoloOnly : Boolean(fallbackCheck?.viaSoloOnly);
            const missingShortLabel =
              !hasStock && alloc && alloc.missingItems.length > 0
                ? alloc.missingItems
                    .map((mi) => (mi.missingQty > 1 ? `${mi.missingQty}× ${mi.name}` : mi.name))
                    .join(' + ')
                : null;
            const missingOrderMap: Record<string, number> = {};
            if (alloc) {
              alloc.missingItems.forEach((mi) => {
                missingOrderMap[mi.itemId] = (missingOrderMap[mi.itemId] || 0) + mi.missingQty;
              });
            }
            const isTenMin = m.wait === '10 min';
            const rowClass = f.success
              ? 'bg-emerald-950/30 border-emerald-500/50'
              : f.fail
                ? 'bg-red-950/30 border-red-500/50'
                : hasStock
                  ? 'bg-charcoal/60 border-bronze/50'
                  : 'bg-obsidian/60 border-gunmetal';

            const btnBase =
              'flex-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition whitespace-nowrap cursor-pointer';
            const okBtn =
              btnBase +
              (f.success
                ? ' bg-emerald-500 text-obsidian border-emerald-400'
                : ' bg-zinc-900 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/15');
            const koBtn =
              btnBase +
              (f.fail
                ? ' bg-red-600 text-white border-red-400'
                : ' bg-zinc-900 text-red-300 border-red-500/40 hover:bg-red-500/15');

            const badges = f.done ? renderValidatedSummaryBadges(st) : null;

            return (
              <div
                key={m.id}
                className={`border rounded-xl px-3 py-2.5 grid grid-cols-1 ${cols} gap-2 lg:gap-3 lg:items-center transition ${rowClass}`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-zinc-100">{m.name}</span>
                    {m.major && (
                      <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider rounded bg-gradient-to-r from-gold to-gold-light text-obsidian">
                        Gros Coup
                      </span>
                    )}
                    {m.isRescheduled && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        🔄 Reportée de {m.originalDay}
                      </span>
                    )}
                    {f.done && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-gold/20 text-gold-light border border-gold/40">
                        ✓ Validée
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-400">
                    <span>👥 {m.crims}</span>
                    <span className={`font-mono tabular-nums ${isTenMin ? 'text-red-300 font-semibold' : ''}`}>
                      ⏱️ {m.wait}
                    </span>
                    <span className={hasStock ? 'text-emerald-300' : 'text-red-300'}>
                      {hasStock
                        ? viaSoloOnly
                          ? '✅ Matériel OK (items seuls)'
                          : '✅ Matériel OK'
                        : missingShortLabel
                          ? `⚠️ Manque ${missingShortLabel}${alloc && alloc.missingCost > 0 ? ` (${formatMoney(alloc.missingCost)})` : ''}`
                          : '⚠️ Stock insuffisant'}
                    </span>
                    {!f.done && !hasStock && Object.keys(missingOrderMap).length > 0 && onSendToEminenceCart && (
                      <button
                        type="button"
                        onClick={() =>
                          onSendToEminenceCart(missingOrderMap, { navigateToOrders: true })
                        }
                        className="px-2 py-0.5 rounded bg-gold/15 hover:bg-gold hover:text-obsidian text-gold-light border border-gold/40 text-[10px] font-bold transition cursor-pointer whitespace-nowrap"
                        title="Ajouter les items manquants au panier Éminences"
                      >
                        🛒 Commander
                      </button>
                    )}
                    <span className="text-zinc-500 truncate">{gearLabel}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between lg:justify-end gap-2">
                  <span className="lg:hidden text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Matériel
                  </span>
                  <span
                    className={`font-mono tabular-nums text-xs font-bold ${
                      missionCost > 0 ? 'text-amber-300' : 'text-zinc-500'
                    }`}
                  >
                    {missionCost > 0 ? '-' + formatMoney(missionCost) : '0 $'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onOpenMissionValidation(m, dayName, 'success')}
                    className={okBtn}
                    title="Ouvrir le formulaire de validation (Réussie)"
                  >
                    ✅ Réussie
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenMissionValidation(m, dayName, 'fail')}
                    className={koBtn}
                    title="Ouvrir le formulaire de validation (Échouée)"
                  >
                    ❌ Échec
                  </button>
                  {f.done && !readonly && (
                    <button
                      type="button"
                      onClick={() => onResetMission(m.id)}
                      title="Annuler la validation"
                      className="px-2 py-1.5 rounded-lg text-[11px] font-bold bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-red-300 border border-zinc-700 transition cursor-pointer"
                    >
                      ↺
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between lg:justify-end gap-2">
                  <span className="lg:hidden text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Gains
                  </span>
                  <span
                    className={`font-mono tabular-nums text-xs font-bold ${
                      f.gain > 0 ? 'text-emerald-300' : 'text-zinc-500'
                    }`}
                  >
                    {f.success ? formatMoney(f.gain) : '—'}
                  </span>
                </div>

                <div className="flex items-center justify-between lg:justify-end gap-2">
                  <span className="lg:hidden text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Pertes
                  </span>
                  <span
                    className={`font-mono tabular-nums text-xs font-bold ${
                      f.extra > 0 ? 'text-red-300' : 'text-zinc-500'
                    }`}
                  >
                    {f.done && f.extra > 0 ? '-' + formatMoney(f.extra) : '0 $'}
                  </span>
                </div>

                <div className="flex items-center justify-between lg:justify-end gap-2">
                  <span className="lg:hidden text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Résultat
                  </span>
                  <span
                    className={`font-mono tabular-nums text-sm font-extrabold ${
                      f.done ? netClass(f.net) : 'text-zinc-600'
                    }`}
                  >
                    {f.done ? formatSigned(f.net) : '—'}
                  </span>
                </div>

                {badges && (
                  <div className="lg:col-span-full pt-2 mt-1 border-t border-zinc-800/70">
                    {badges}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* BARRE COMPACTE RECALCUL 09H30 & RÈGLEMENT */}
      <div className="bg-charcoal/75 border border-bronze/40 rounded-xl px-3.5 py-2 text-xs space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-zinc-300">
            <span className="inline-flex items-center gap-1.5 font-semibold text-gold-light">
              <Clock className="w-3.5 h-3.5 text-gold" />
              Recalcul auto 09h30
            </span>
            {formattedLastRecalc && (
              <span className="text-[11px] text-zinc-500">
                (dernier : {formattedLastRecalc})
              </span>
            )}
            {effectiveSchedule.movedCount > 0 && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/35 tabular-nums">
                🔄 {effectiveSchedule.movedCount} reportée{effectiveSchedule.movedCount > 1 ? 's' : ''}
              </span>
            )}
            {effectiveSchedule.unplacedMissions.length > 0 && (
              <button
                type="button"
                onClick={() => setShowUnplaced((v) => !v)}
                className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/35 tabular-nums transition cursor-pointer inline-flex items-center gap-1"
              >
                <AlertTriangle className="w-3 h-3" />
                {effectiveSchedule.unplacedMissions.length} hors quota {showUnplaced ? '▴' : '▾'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {supplyPlan.weekRemainingMissionsCount > 0 && (
              <span
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border tabular-nums ${
                  supplyPlan.weekUncoveredCount === 0
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                    : 'bg-amber-500/15 text-amber-200 border-amber-500/35'
                }`}
              >
                📦 Stock sem. : {supplyPlan.weekCoveredCount}/{supplyPlan.weekRemainingMissionsCount}
              </span>
            )}
            {supplyPlan.weekUncoveredCount > 0 &&
              Object.keys(supplyPlan.weekMissingOptimalItems).length > 0 &&
              onSendToEminenceCart && (
                <button
                  type="button"
                  onClick={() =>
                    onSendToEminenceCart(supplyPlan.weekMissingOptimalItems, {
                      navigateToOrders: true,
                    })
                  }
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-crimson/25 hover:bg-crimson/40 text-red-100 border border-crimson-light/45 transition cursor-pointer whitespace-nowrap tabular-nums"
                  title="Envoyer les manquants de la semaine au panier Éminences"
                >
                  🛒 Manquants ({formatMoney(supplyPlan.weekMissingOptimalCost)})
                </button>
              )}
            <button
              type="button"
              onClick={() => setShowRegulation((v) => !v)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition flex items-center gap-1 cursor-pointer ${
                showRegulation
                  ? 'bg-gold text-obsidian border-gold'
                  : 'bg-obsidian/70 hover:bg-obsidian text-zinc-300 border-bronze/40 hover:border-gold/50'
              }`}
            >
              <ScrollText className="w-3 h-3" />
              Règlement
            </button>
            {!readonly && (
              <>
                <button
                  type="button"
                  onClick={onRecalculateSchedule}
                  title="Répartir les missions en retard sur le reste de la semaine selon le règlement"
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-gold/90 hover:bg-gold text-obsidian transition flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  Recalculer
                </button>
                {hasScheduleAdjustments && (
                  <button
                    type="button"
                    onClick={onResetScheduleOverrides}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 transition flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Origine
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {showRegulation && (
          <div className="pt-2.5 border-t border-bronze/35 space-y-2.5">
            <div className="overflow-x-auto rounded-xl border border-bronze/40 bg-obsidian/75">
              <table className="w-full text-left text-xs">
                <thead className="bg-charcoal/90 text-[10px] uppercase tracking-wider text-gold-light border-b border-bronze/40">
                  <tr>
                    <th className="px-3 py-2">Cible</th>
                    <th className="px-3 py-2">Criminels</th>
                    <th className="px-3 py-2 text-center">Par jour</th>
                    <th className="px-3 py-2 text-center">Par semaine</th>
                    <th className="px-3 py-2 text-right">Planning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70">
                  {REGULATION_TABLE_ROWS.map((row) => (
                    <tr key={row.label} className="hover:bg-charcoal/50">
                      <td className="px-3 py-1.5 font-semibold text-zinc-100">{row.label}</td>
                      <td className="px-3 py-1.5 text-zinc-300">{row.criminals}</td>
                      <td className="px-3 py-1.5 text-center font-mono text-gold-light font-semibold">
                        {row.daily}
                      </td>
                      <td className="px-3 py-1.5 text-center font-mono text-zinc-200 font-semibold">
                        {row.weekly}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {row.inPlanning ? (
                          <span className="text-[10px] font-semibold text-emerald-300">
                            Suivi auto
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-500">Hors semainier</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/35 px-3 py-2 text-xs text-amber-200 font-medium">
              ⚖️ {REGULATION_FAIRPLAY_NOTE}
            </div>
          </div>
        )}

        {showUnplaced && effectiveSchedule.unplacedMissions.length > 0 && (
          <div className="pt-2.5 border-t border-crimson-light/30 space-y-2">
            <p className="text-[11px] text-zinc-300">
              Missions en retard non replaçables sans dépasser la limite journalière du règlement :
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {effectiveSchedule.unplacedMissions.map(({ mission, originalDay, reason }) => (
                <div
                  key={mission.id}
                  className="rounded-lg bg-obsidian/80 border border-red-500/30 px-3 py-2 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-100 truncate">
                      {mission.name}{' '}
                      <span className="text-zinc-400 font-normal">({originalDay})</span>
                    </p>
                    <p className="text-[10px] text-amber-300/90 truncate">{reason}</p>
                  </div>
                  {!readonly && (
                    <button
                      type="button"
                      onClick={() => onOpenMissionValidation(mission, originalDay, 'success')}
                      title="Valider rétroactivement si effectuée"
                      className="px-2 py-1 rounded-lg text-[10px] font-bold bg-zinc-900 hover:bg-zinc-800 text-gold-light border border-gold/40 shrink-0 cursor-pointer"
                    >
                      Valider
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => handleFilterDay('ALL')}
            className={
              activeFilter === 'ALL'
                ? 'px-3.5 py-1.5 rounded-lg text-xs font-bold bg-gold text-obsidian transition whitespace-nowrap cursor-pointer'
                : 'px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-charcoal text-zinc-300 hover:text-white border border-zinc-800 transition whitespace-nowrap cursor-pointer'
            }
          >
            Toute la semaine ({fmtShort(start)} → {fmtShort(end)})
          </button>
          {DAY_NAMES.map((day) => {
            const isToday = isTodayName(day, missionStates);
            const isActive = activeFilter === day;
            return (
              <button
                key={day}
                type="button"
                onClick={() => handleFilterDay(day)}
                className={
                  isActive
                    ? 'px-3.5 py-1.5 rounded-lg text-xs font-bold bg-gold text-obsidian transition whitespace-nowrap cursor-pointer'
                    : 'px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-charcoal text-zinc-300 hover:text-white border border-zinc-800 transition whitespace-nowrap cursor-pointer'
                }
              >
                {isToday ? '• ' : ''}
                {day} {fmtShort(dayDate(day, missionStates))}
              </button>
            );
          })}
        </div>

        {!readonly && (
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={toggleAllDays}
              className="text-xs font-semibold text-zinc-300 hover:text-white underline underline-offset-4 transition cursor-pointer"
            >
              Tout déplier / replier
            </button>
            <button
              type="button"
              onClick={onToggleAllWeek}
              className="text-xs font-semibold text-gold hover:text-gold-light underline underline-offset-4 transition cursor-pointer"
            >
              Tout cocher / décocher
            </button>
            <p className="text-xs text-zinc-400 italic">
              Cliquez sur Réussie ou Échouée pour renseigner et valider la mission.
            </p>
          </div>
        )}
      </div>

      <div
        className={
          single
            ? 'grid grid-cols-1 gap-4 items-start'
            : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start'
        }
      >
        {filteredDays.map((dayObj) => {
          let okCount = 0;
          let koCount = 0;
          let dayCost = 0;
          let dayExtra = 0;
          let dayGains = 0;

          dayObj.missions.forEach((m) => {
            const f = missionFin(m, missionStates, inventoryPrices, catalogGroups);
            if (f.success) okCount++;
            if (f.fail) koCount++;
            dayCost += f.cost;
            dayExtra += f.extra;
            dayGains += f.gain;
          });

          const dayNet = dayGains - dayCost - dayExtra;
          const isDayFullyDone = okCount + koCount === dayObj.missions.length;
          const todayCard = isTodayName(dayObj.day, missionStates);
          const isOpen = single || openDays.has(dayObj.day);

          return (
            <div
              key={dayObj.day}
              ref={todayCard ? todayCardRef : undefined}
              className={`bg-charcoal/85 gold-border rounded-2xl shadow-xl overflow-hidden flex flex-col transition hover:border-gold/60 ${
                todayCard ? 'ring-2 ring-gold/80' : ''
              }`}
            >
              <div
                onClick={single ? undefined : () => toggleDay(dayObj.day)}
                className={`p-3 sm:p-4 ${
                  single ? '' : 'cursor-pointer select-none hover:brightness-125'
                } transition bg-gradient-to-r from-crimson-dark/40 via-slateDark to-obsidian ${
                  isOpen ? 'border-b' : ''
                } border-gold/20 flex items-center justify-between gap-3`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-obsidian border border-gold/40 flex items-center justify-center font-display font-extrabold text-gold text-sm shadow-inner">
                    {dayObj.day.substring(0, 3).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-display text-base font-bold text-white tracking-wider flex items-center gap-2 flex-wrap">
                      {!single && (
                        <span className="text-zinc-500 text-xs">{isOpen ? '▾' : '▸'}</span>
                      )}
                      {dayObj.day}{' '}
                      <span className="font-sans text-xs font-semibold text-gold">
                        {fmtLong(dayDate(dayObj.day, missionStates))}
                      </span>
                      {todayCard && (
                        <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider rounded bg-gold text-obsidian">
                          Aujourd&apos;hui
                        </span>
                      )}
                      {dayObj.day === 'Dimanche' && (
                        <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-amber-500/20 text-amber-200 border border-amber-400/45">
                          💎 Jour de revente
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] font-medium tabular-nums">
                      <span className="text-emerald-400">✅ {okCount}</span>{' '}
                      <span className="text-red-400 ml-1">❌ {koCount}</span>{' '}
                      <span className="text-zinc-500 ml-1">/ {dayObj.missions.length}</span>
                      {dayObj.carriedOutCount > 0 && (
                        <span className="text-amber-300/80 ml-1.5">
                          ({dayObj.carriedOutCount} reportée{dayObj.carriedOutCount > 1 ? 's' : ''})
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold tracking-wider uppercase text-zinc-500 block">
                    Résultat du jour
                  </span>
                  <span className={`font-mono tabular-nums text-xs font-bold ${netClass(dayNet)}`}>
                    {formatSigned(dayNet)}
                  </span>
                </div>
              </div>

              {isOpen && (
                <>
                  {single ? (
                    renderSingleDayRows(dayObj.day, dayObj.missions)
                  ) : (
                    <div className="p-3.5 sm:p-4 space-y-2.5 flex-1">
                      {dayObj.missions.map((mission) => {
                        const st = getMissionEntry(missionStates, mission.id);
                        const f = missionFin(mission, missionStates, inventoryPrices, catalogGroups);
                        const missionCost = f.done
                          ? f.cost
                          : getMissionCost(mission, inventoryPrices, catalogGroups);
                        const gearLabel = getMissionGearLabel(
                          mission,
                          inventoryPrices,
                          catalogGroups
                        );
                        const isTenMin = mission.wait === '10 min';
                        const alloc = supplyPlan.allocationsByMissionId[mission.id];
                        const fallbackCheck = alloc
                          ? null
                          : checkMissionStockAvailability(
                              mission.gearKey,
                              inventoryStock,
                              catalogGroups
                            );
                        const hasStock = alloc
                          ? alloc.available
                          : Boolean(fallbackCheck?.available);
                        const viaSoloOnly = alloc
                          ? alloc.viaSoloOnly
                          : Boolean(fallbackCheck?.viaSoloOnly);
                        const missingShortLabel =
                          !hasStock && alloc && alloc.missingItems.length > 0
                            ? alloc.missingItems
                                .map((mi) =>
                                  mi.missingQty > 1 ? `${mi.missingQty}× ${mi.name}` : mi.name
                                )
                                .join(' + ')
                            : null;
                        const missingOrderMap: Record<string, number> = {};
                        if (alloc) {
                          alloc.missingItems.forEach((mi) => {
                            missingOrderMap[mi.itemId] =
                              (missingOrderMap[mi.itemId] || 0) + mi.missingQty;
                          });
                        }

                        const cardClass = f.success
                          ? 'bg-emerald-950/30 border-emerald-500/50'
                          : f.fail
                            ? 'bg-red-950/30 border-red-500/50'
                            : hasStock
                              ? 'bg-emerald-950/20 border-emerald-500/40 shadow-sm shadow-emerald-500/5'
                              : 'bg-zinc-950/40 border-zinc-800/60 opacity-75';

                        const btnBase =
                          'flex-1 px-2 py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer';
                        const okBtn =
                          btnBase +
                          (f.success
                            ? ' bg-emerald-500 text-obsidian border-emerald-400'
                            : ' bg-zinc-900 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/15');
                        const koBtn =
                          btnBase +
                          (f.fail
                            ? ' bg-red-600 text-white border-red-400'
                            : ' bg-zinc-900 text-red-300 border-red-500/40 hover:bg-red-500/15');

                        const badges = f.done ? renderValidatedSummaryBadges(st) : null;

                        return (
                          <div
                            key={mission.id}
                            className={`border rounded-xl p-3 transition ${cardClass}`}
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                <span className="font-semibold text-sm text-zinc-100 leading-snug">
                                  {mission.name}
                                </span>
                                {mission.isRescheduled && (
                                  <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                    🔄 Reportée de {mission.originalDay}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {mission.major && (
                                  <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider rounded bg-gradient-to-r from-gold to-gold-light text-obsidian shadow-sm">
                                    Gros Coup
                                  </span>
                                )}
                                <span
                                  className={`font-mono tabular-nums text-xs font-bold ${
                                    missionCost > 0 ? 'text-amber-300/90' : 'text-zinc-500'
                                  }`}
                                >
                                  {missionCost > 0 ? '-' + formatMoney(missionCost) : '0 $'}
                                </span>
                              </div>
                            </div>

                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-900 text-zinc-300 border border-zinc-800">
                                👥 {mission.crims}
                              </span>
                              <span
                                className={`font-mono tabular-nums inline-flex items-center gap-1 px-2 py-0.5 rounded-md border ${
                                  isTenMin
                                    ? 'bg-crimson/25 text-red-200 border-crimson-light/40 font-semibold'
                                    : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                                }`}
                              >
                                ⏱️ {mission.wait}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border ${
                                  hasStock
                                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                    : 'bg-red-500/15 text-red-300 border-red-500/30'
                                }`}
                              >
                                {hasStock
                                  ? viaSoloOnly
                                    ? '✅ Matériel OK (items seuls)'
                                    : '✅ Matériel OK'
                                  : missingShortLabel
                                    ? `⚠️ Manque ${missingShortLabel}`
                                    : '⚠️ Stock insuffisant'}
                              </span>
                              {!f.done &&
                                !hasStock &&
                                Object.keys(missingOrderMap).length > 0 &&
                                onSendToEminenceCart && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onSendToEminenceCart(missingOrderMap, {
                                        navigateToOrders: true,
                                      })
                                    }
                                    className="px-2 py-0.5 rounded-md bg-gold/15 hover:bg-gold hover:text-obsidian text-gold-light border border-gold/40 text-[10px] font-bold transition cursor-pointer whitespace-nowrap"
                                    title="Ajouter les manquants au panier Éminences"
                                  >
                                    🛒 Commander ({formatMoney(alloc?.missingCost || 0)})
                                  </button>
                                )}
                            </div>
                            <p className="text-[11px] text-zinc-400 mt-1.5 leading-snug">
                              <span className="text-zinc-500">Matériel :</span> {gearLabel}
                            </p>

                            <div className="mt-2.5 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenMissionValidation(mission, dayObj.day, 'success')
                                }
                                className={okBtn}
                              >
                                ✅ Réussie
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenMissionValidation(mission, dayObj.day, 'fail')
                                }
                                className={koBtn}
                              >
                                ❌ Échouée
                              </button>
                            </div>

                            {f.done && (
                              <div className="mt-2.5 pt-2 border-t border-zinc-800/70 space-y-2">
                                <div className="flex items-center justify-between gap-2 text-xs tabular-nums">
                                  <span className="text-zinc-400">
                                    {f.success ? (
                                      <>
                                        Gains :{' '}
                                        <strong className="font-mono text-emerald-300">
                                          +{formatMoney(f.gain)}
                                        </strong>
                                      </>
                                    ) : (
                                      <span className="text-red-300 font-semibold">
                                        Mission échouée
                                      </span>
                                    )}
                                    {f.extra > 0 && (
                                      <span className="ml-2">
                                        · Pertes :{' '}
                                        <strong className="font-mono text-red-300">
                                          -{formatMoney(f.extra)}
                                        </strong>
                                      </span>
                                    )}
                                  </span>
                                  <span
                                    className={`font-mono font-extrabold ${netClass(f.net)}`}
                                  >
                                    {formatSigned(f.net)}
                                  </span>
                                </div>

                                {badges}

                                {!readonly && (
                                  <div className="flex items-center justify-end gap-2 pt-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onOpenMissionValidation(
                                          mission,
                                          dayObj.day,
                                          f.fail ? 'fail' : 'success'
                                        )
                                      }
                                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-zinc-900 hover:bg-zinc-800 text-gold-light border border-gold/40 transition cursor-pointer"
                                    >
                                      ✎ Modifier
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onResetMission(mission.id)}
                                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-zinc-900 hover:bg-zinc-800 text-red-300 border border-red-500/30 transition cursor-pointer"
                                    >
                                      Annuler
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="px-4 py-2.5 bg-obsidian/85 border-t border-zinc-800/80 flex items-center justify-between text-xs gap-2 flex-wrap">
                    <div className="flex items-center gap-x-2 gap-y-1 flex-wrap tabular-nums">
                      <span className="text-zinc-400">
                        Matériel :{' '}
                        <strong className="font-mono text-amber-300">
                          {formatMoney(dayCost)}
                        </strong>
                      </span>
                      {dayExtra > 0 && (
                        <>
                          <span className="text-zinc-600">|</span>
                          <span className="text-zinc-400">
                            Pertes :{' '}
                            <strong className="font-mono text-red-400">
                              {formatMoney(dayExtra)}
                            </strong>
                          </span>
                        </>
                      )}
                      {dayGains > 0 && (
                        <>
                          <span className="text-zinc-600">|</span>
                          <span className="text-zinc-400">
                            Gains :{' '}
                            <strong className="font-mono text-emerald-400">
                              {formatMoney(dayGains)}
                            </strong>
                          </span>
                        </>
                      )}
                    </div>
                    {!readonly && (
                      <button
                        type="button"
                        onClick={() => onToggleWholeDay(dayObj.day)}
                        className="text-gold hover:text-gold-light font-semibold transition cursor-pointer"
                      >
                        {isDayFullyDone ? 'Tout remettre à zéro' : 'Tout valider (réussies)'}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
