import { DAY_NAMES, INVENTORY_ITEMS, WEEKLY_SCHEDULE } from '@/src/data/cartelData';
import {
  EMINENCE_MISSIONS,
  type EminenceMissionBlueprint,
  getEminenceCatalogItemsMap,
  resolveCatalogItemStockKey,
} from '@/src/data/eminenceMissions';
import type {
  CatalogGroupsMap,
  InventoryPrices,
  InventoryStock,
  MissionScheduleMeta,
  MissionStates,
} from '@/src/types/cartel';
import {
  getInventoryItemPrice,
  getMissionEntry,
  getStatus,
  isTodayName,
} from '@/src/utils/finance';
import { getEffectiveSchedule } from '@/src/utils/schedule';

export interface ResolvedMissionRequirement {
  itemId: string;
  stockKey: string;
  displayName: string;
  qty: number;
  unitPrice: number;
  stockQty: number;
}

export interface MissingComponentNeed {
  itemId: string;
  stockKey: string;
  name: string;
  missingQty: number;
  unitPrice: number;
  totalCost: number;
}

export interface MissionSupplyOverview {
  mission: EminenceMissionBlueprint;
  packStockKey: string | null;
  packItemId: string | null;
  packDisplayName: string;
  packQty: number;
  packPrice: number;
  isSingleUnifiedKey: boolean;
  canAssembleOrUnpack: boolean;
  distinctReqs: ResolvedMissionRequirement[];
  soloReadyRuns: number;
  totalReadyRuns: number;
  soloFullPrice: number;
  packSavingsVsSolo: number;
  isPartial: boolean;
  missingComponents: MissingComponentNeed[];
  missingCostToCompleteOne: number;
  cheaperToCompleteSolo: boolean;
  // Linked to the weekly schedule (from today onward)
  scheduledThisWeekCount: number;
  scheduledThisWeekDays: string[];
  scheduledCoveredThisWeek: number;
  scheduledMissingThisWeek: number;
  nextShortageDay: string | null;
  coveredDays: number;
  hasMoreThan30: boolean;
  ruptureDayName: string | null;
}

export interface ScheduledMissionAllocation {
  missionId: string;
  gearKey: string;
  dayName: string;
  coveredBy: 'none' | 'pack' | 'solo' | 'missing';
  available: boolean;
  viaSoloOnly: boolean;
  missingItems: MissingComponentNeed[];
  missingCost: number;
  packPrice: number;
  recommendedMode: 'pack' | 'solo_missing' | 'none';
}

export interface HorizonOrderNeed {
  daysAhead: number;
  startDay: string;
  coveredDays: Array<{ day: string; isNextCycle: boolean; missionCount: number }>;
  // Uncovered scheduled missions across horizon (after existing packs + shared solo pool)
  uncoveredMissionsCount: number;
  // Strategy 1: Buy complete Packs (or main tools) for uncovered missions
  packOrderRows: Array<{
    stockKey: string;
    catalogItemId: string | null;
    name: string;
    category: string;
    unitPrice: number;
    neededTotal: number;
    coveredByVault: number;
    shortage: number;
  }>;
  packOrderTotalCost: number;
  // Strategy 2: Optimal solo completion (buy only exact missing keys/utilities + unified packs)
  optimalOrderRows: Array<{
    stockKey: string;
    catalogItemId: string;
    name: string;
    kind: 'pack' | 'key' | 'utility';
    unitPrice: number;
    neededInHorizon: number;
    inVault: number;
    missingQty: number;
  }>;
  optimalOrderTotalCost: number;
  optimalSavingsVsPacks: number;
}

export interface SupplySimulationResult {
  startDay: string;
  missionsOverview: MissionSupplyOverview[];
  overviewByCode: Record<string, MissionSupplyOverview>;
  overviewByGearKey: Record<string, MissionSupplyOverview>;
  allocationsByMissionId: Record<string, ScheduledMissionAllocation>;
  // Global KPIs
  totalMissionsCount: number;
  readyMissionsCount: number;
  craftablePacksTotal: number;
  weekRemainingMissionsCount: number;
  weekCoveredCount: number;
  weekUncoveredCount: number;
  weekMissingOptimalItems: Record<string, number>; // catalogItemId -> qty
  weekMissingOptimalCost: number;
  minDaysCovered: number;
  allOver30Days: boolean;
  limitingMissions: Array<{
    code: string;
    title: string;
    coveredDays: number;
    ruptureDayName: string | null;
  }>;
  computeHorizonOrder: (daysAhead: number, excludeDone: boolean) => HorizonOrderNeed;
}

function buildResolvedRequirements(
  mission: EminenceMissionBlueprint,
  packStockKey: string | null,
  inventoryStock: InventoryStock,
  inventoryPrices: InventoryPrices | undefined,
  catalogMap: ReturnType<typeof getEminenceCatalogItemsMap>
): {
  distinctReqs: ResolvedMissionRequirement[];
  isSingleUnifiedKey: boolean;
} {
  const seen = new Set<string>();
  const resolved: ResolvedMissionRequirement[] = [];

  mission.requirements.forEach((req) => {
    const catItem = catalogMap.get(req.itemId);
    const stockKey = resolveCatalogItemStockKey(catItem);
    if (!catItem || !stockKey) return;
    if (seen.has(stockKey)) {
      const prev = resolved.find((r) => r.stockKey === stockKey);
      if (prev) prev.qty += Math.max(1, req.qty);
      return;
    }
    seen.add(stockKey);
    const staticInv = INVENTORY_ITEMS.find((i) => i.key === stockKey);
    const stockQty = Math.max(0, Math.floor(Number(inventoryStock[stockKey]) || 0));
    const unitPrice = getInventoryItemPrice(
      stockKey,
      inventoryPrices,
      staticInv?.price ?? catItem.price
    );
    resolved.push({
      itemId: req.itemId,
      stockKey,
      displayName: staticInv?.name || catItem.name,
      qty: Math.max(1, req.qty),
      unitPrice,
      stockQty,
    });
  });

  const distinctReqs = resolved.filter((r) => r.stockKey !== packStockKey);
  const isSingleUnifiedKey =
    Boolean(packStockKey) && (resolved.length === 0 || distinctReqs.length === 0);

  return { distinctReqs, isSingleUnifiedKey };
}

export function simulateMissionSupplyPlan(params: {
  inventoryStock: InventoryStock;
  inventoryPrices?: InventoryPrices;
  catalogGroups?: CatalogGroupsMap;
  missionStates: MissionStates;
  scheduleMeta?: MissionScheduleMeta;
  startDayName?: string;
}): SupplySimulationResult {
  const {
    inventoryStock,
    inventoryPrices,
    catalogGroups,
    missionStates,
    scheduleMeta,
    startDayName,
  } = params;

  const catalogMap = getEminenceCatalogItemsMap(catalogGroups);
  const detectedToday = DAY_NAMES.find((d) => isTodayName(d, missionStates)) || 'Lundi';
  const safeStartDay =
    startDayName && DAY_NAMES.includes(startDayName) ? startDayName : detectedToday;
  const startIdx = Math.max(0, DAY_NAMES.indexOf(safeStartDay));
  const effectiveDays = getEffectiveSchedule(missionStates, scheduleMeta).days;

  // 1. Build static + isolated snapshot for each Eminence mission
  const missionMetaByCode = new Map<
    string,
    {
      mission: EminenceMissionBlueprint;
      packStockKey: string | null;
      packItemId: string | null;
      packDisplayName: string;
      packQty: number;
      packPrice: number;
      isSingleUnifiedKey: boolean;
      canAssembleOrUnpack: boolean;
      distinctReqs: ResolvedMissionRequirement[];
      soloReadyRuns: number;
      totalReadyRuns: number;
      soloFullPrice: number;
      packSavingsVsSolo: number;
      isPartial: boolean;
      missingComponents: MissingComponentNeed[];
      missingCostToCompleteOne: number;
      cheaperToCompleteSolo: boolean;
    }
  >();

  const missionByGearKey = new Map<string, EminenceMissionBlueprint>();
  let craftablePacksTotal = 0;

  EMINENCE_MISSIONS.forEach((mission) => {
    if (mission.planningGearKey) {
      missionByGearKey.set(mission.planningGearKey, mission);
    }

    const packCatItem = mission.packItemId ? catalogMap.get(mission.packItemId) : undefined;
    const packStockKey = resolveCatalogItemStockKey(packCatItem);
    const packStaticInv = packStockKey
      ? INVENTORY_ITEMS.find((i) => i.key === packStockKey)
      : undefined;
    const packQty = packStockKey
      ? Math.max(0, Math.floor(Number(inventoryStock[packStockKey]) || 0))
      : 0;
    const packPrice = packStockKey
      ? getInventoryItemPrice(
          packStockKey,
          inventoryPrices,
          packStaticInv?.price ?? packCatItem?.price ?? 0
        )
      : 0;
    const packDisplayName =
      packStaticInv?.name || packCatItem?.name || `Pack ${mission.code}`;

    const { distinctReqs, isSingleUnifiedKey } = buildResolvedRequirements(
      mission,
      packStockKey,
      inventoryStock,
      inventoryPrices,
      catalogMap
    );

    let soloReadyRuns = 0;
    let soloFullPrice = 0;
    let hasPartial = false;
    const missingComponents: MissingComponentNeed[] = [];

    if (!isSingleUnifiedKey && distinctReqs.length > 0) {
      soloReadyRuns = Math.min(
        ...distinctReqs.map((r) => Math.floor(r.stockQty / Math.max(1, r.qty)))
      );
      distinctReqs.forEach((r) => {
        soloFullPrice += r.qty * r.unitPrice;
        if (r.stockQty > 0) hasPartial = true;
        const missingQty = Math.max(0, r.qty - r.stockQty);
        if (missingQty > 0) {
          missingComponents.push({
            itemId: r.itemId,
            stockKey: r.stockKey,
            name: r.displayName,
            missingQty,
            unitPrice: r.unitPrice,
            totalCost: missingQty * r.unitPrice,
          });
        }
      });
    } else if (isSingleUnifiedKey) {
      soloFullPrice = packPrice;
    }

    const totalReadyRuns = isSingleUnifiedKey ? packQty : packQty + soloReadyRuns;
    const missingCostToCompleteOne = missingComponents.reduce((s, c) => s + c.totalCost, 0);
    const isPartial = totalReadyRuns === 0 && hasPartial;
    const canAssembleOrUnpack =
      Boolean(packStockKey) && !isSingleUnifiedKey && distinctReqs.length > 0;
    const packSavingsVsSolo =
      packStockKey && !isSingleUnifiedKey && soloFullPrice > packPrice
        ? soloFullPrice - packPrice
        : 0;
    const cheaperToCompleteSolo =
      !isSingleUnifiedKey &&
      missingComponents.length > 0 &&
      (packPrice === 0 || missingCostToCompleteOne < packPrice);

    if (canAssembleOrUnpack && soloReadyRuns > 0) {
      craftablePacksTotal += soloReadyRuns;
    }

    missionMetaByCode.set(mission.code, {
      mission,
      packStockKey,
      packItemId: mission.packItemId,
      packDisplayName,
      packQty,
      packPrice,
      isSingleUnifiedKey,
      canAssembleOrUnpack,
      distinctReqs,
      soloReadyRuns,
      totalReadyRuns,
      soloFullPrice,
      packSavingsVsSolo,
      isPartial,
      missingComponents,
      missingCostToCompleteOne,
      cheaperToCompleteSolo,
    });
  });

  // 2. Shared-Pool Weekly + 35-Day Schedule Simulation (Pack first, then Solo Pool)
  const simPool: Record<string, number> = {};
  Object.entries(inventoryStock).forEach(([k, v]) => {
    simPool[k] = Math.max(0, Math.floor(Number(v) || 0));
  });

  const allocationsByMissionId: Record<string, ScheduledMissionAllocation> = {};
  const weekStatsByCode: Record<
    string,
    {
      needed: number;
      covered: number;
      missing: number;
      days: string[];
      nextShortageDay: string | null;
    }
  > = {};
  const coveredDaysByCode: Record<string, number> = {};
  const ruptureDayByCode: Record<string, string | null> = {};
  const failedOnceCode = new Set<string>();

  EMINENCE_MISSIONS.forEach((m) => {
    weekStatsByCode[m.code] = {
      needed: 0,
      covered: 0,
      missing: 0,
      days: [],
      nextShortageDay: null,
    };
    coveredDaysByCode[m.code] = 0;
    ruptureDayByCode[m.code] = null;
  });

  const weekMissingOptimalItems: Record<string, number> = {};
  let weekMissingOptimalCost = 0;
  let weekRemainingMissionsCount = 0;
  let weekCoveredCount = 0;
  let weekUncoveredCount = 0;

  const MAX_SIM_DAYS = 35;
  for (let d = 0; d < MAX_SIM_DAYS; d++) {
    const rawIdx = startIdx + d;
    const dayIdx = rawIdx % 7;
    const isCurrentWeek = rawIdx < 7;
    const schedule = isCurrentWeek
      ? effectiveDays[dayIdx] || WEEKLY_SCHEDULE[dayIdx]
      : WEEKLY_SCHEDULE[dayIdx];
    if (!schedule) continue;

    // Track whether a given mission code succeeded for the entire day d
    const dayMissionSuccess = new Map<string, boolean>();

    schedule.missions.forEach((m) => {
      const status = isCurrentWeek ? getStatus(getMissionEntry(missionStates, m.id)) : '';
      if (isCurrentWeek && status !== '') {
        return;
      }

      if (m.gearKey === 'none') {
        if (isCurrentWeek) {
          allocationsByMissionId[m.id] = {
            missionId: m.id,
            gearKey: m.gearKey,
            dayName: schedule.day,
            coveredBy: 'none',
            available: true,
            viaSoloOnly: false,
            missingItems: [],
            missingCost: 0,
            packPrice: 0,
            recommendedMode: 'none',
          };
        }
        return;
      }

      const blueprint = missionByGearKey.get(m.gearKey);
      const meta = blueprint ? missionMetaByCode.get(blueprint.code) : undefined;

      // Consume 1 Pack if available in pool
      const packStockKey = meta?.packStockKey || m.gearKey;
      const packAvail = Math.max(0, simPool[packStockKey] || 0);
      let coveredBy: 'pack' | 'solo' | 'missing' = 'missing';
      const missingItems: MissingComponentNeed[] = [];
      let missingCost = 0;

      if (packAvail > 0) {
        simPool[packStockKey] = packAvail - 1;
        coveredBy = 'pack';
      } else if (meta && !meta.isSingleUnifiedKey && meta.distinctReqs.length > 0) {
        const allSoloOk = meta.distinctReqs.every(
          (req) => Math.max(0, simPool[req.stockKey] || 0) >= req.qty
        );
        if (allSoloOk) {
          meta.distinctReqs.forEach((req) => {
            simPool[req.stockKey] = Math.max(0, (simPool[req.stockKey] || 0) - req.qty);
          });
          coveredBy = 'solo';
        } else {
          // Compute exact shortage after deducting partial pool reserves for this mission
          meta.distinctReqs.forEach((req) => {
            const avail = Math.max(0, simPool[req.stockKey] || 0);
            const usedFromPool = Math.min(avail, req.qty);
            if (isCurrentWeek && usedFromPool > 0) {
              // Reserve available partial items so subsequent missions don't double-count them
              simPool[req.stockKey] = avail - usedFromPool;
            }
            const lack = Math.max(0, req.qty - avail);
            if (lack > 0) {
              const cost = lack * req.unitPrice;
              missingItems.push({
                itemId: req.itemId,
                stockKey: req.stockKey,
                name: req.displayName,
                missingQty: lack,
                unitPrice: req.unitPrice,
                totalCost: cost,
              });
              missingCost += cost;
              if (isCurrentWeek) {
                weekMissingOptimalItems[req.itemId] =
                  (weekMissingOptimalItems[req.itemId] || 0) + lack;
                weekMissingOptimalCost += cost;
              }
            }
          });
        }
      } else if (meta?.packItemId) {
        // Unified item/pack (e.g. ATM / Maison / Supérettes) missing 1 unit
        const catItem = catalogMap.get(meta.packItemId);
        const unitPrice = meta.packPrice;
        missingItems.push({
          itemId: meta.packItemId,
          stockKey: packStockKey,
          name: catItem?.name || meta.packDisplayName,
          missingQty: 1,
          unitPrice,
          totalCost: unitPrice,
        });
        missingCost = unitPrice;
        if (isCurrentWeek) {
          weekMissingOptimalItems[meta.packItemId] =
            (weekMissingOptimalItems[meta.packItemId] || 0) + 1;
          weekMissingOptimalCost += unitPrice;
        }
      }

      if (isCurrentWeek && blueprint) {
        weekRemainingMissionsCount++;
        const st = weekStatsByCode[blueprint.code];
        st.needed++;
        if (!st.days.includes(schedule.day)) st.days.push(schedule.day);
        if (coveredBy === 'pack' || coveredBy === 'solo') {
          st.covered++;
          weekCoveredCount++;
        } else {
          st.missing++;
          weekUncoveredCount++;
          if (!st.nextShortageDay) st.nextShortageDay = schedule.day;
        }

        const packPrice = meta?.packPrice || 0;
        const recommendedMode: 'pack' | 'solo_missing' | 'none' =
          coveredBy !== 'missing'
            ? 'none'
            : packPrice > 0 && (missingCost === 0 || packPrice <= missingCost)
              ? 'pack'
              : 'solo_missing';

        allocationsByMissionId[m.id] = {
          missionId: m.id,
          gearKey: m.gearKey,
          dayName: schedule.day,
          coveredBy,
          available: coveredBy === 'pack' || coveredBy === 'solo',
          viaSoloOnly: coveredBy === 'solo',
          missingItems,
          missingCost,
          packPrice,
          recommendedMode,
        };
      }

      if (blueprint) {
        const prevDayOk = dayMissionSuccess.get(blueprint.code);
        const okNow = coveredBy === 'pack' || coveredBy === 'solo';
        dayMissionSuccess.set(blueprint.code, prevDayOk === undefined ? okNow : prevDayOk && okNow);
      }
    });

    // Update continuous coveredDays per mission code
    EMINENCE_MISSIONS.forEach((bp) => {
      if (failedOnceCode.has(bp.code)) return;
      const ok = dayMissionSuccess.get(bp.code);
      if (ok === false) {
        failedOnceCode.add(bp.code);
        ruptureDayByCode[bp.code] = schedule.day;
      } else {
        coveredDaysByCode[bp.code] = (coveredDaysByCode[bp.code] || 0) + 1;
      }
    });
  }

  // Also ensure baseline (Monday..Sunday) weekly scheduled mission counts are considered for autonomy relevance
  const baselineNeedsByCode: Record<string, number> = {};
  WEEKLY_SCHEDULE.forEach((d) => {
    d.missions.forEach((m) => {
      const bp = missionByGearKey.get(m.gearKey);
      if (bp) {
        baselineNeedsByCode[bp.code] = (baselineNeedsByCode[bp.code] || 0) + 1;
      }
    });
  });

  const missionsOverview: MissionSupplyOverview[] = [];
  const overviewByCode: Record<string, MissionSupplyOverview> = {};
  const overviewByGearKey: Record<string, MissionSupplyOverview> = {};

  EMINENCE_MISSIONS.forEach((bp) => {
    const meta = missionMetaByCode.get(bp.code)!;
    const wk = weekStatsByCode[bp.code];
    const rawDays = coveredDaysByCode[bp.code] || 0;
    const isScheduledBaseline = (baselineNeedsByCode[bp.code] || 0) > 0;
    const hasMoreThan30 = !isScheduledBaseline || rawDays >= 31;
    const coveredDays = hasMoreThan30 ? 30 : rawDays;
    const ruptureDayName = hasMoreThan30 ? null : ruptureDayByCode[bp.code];

    const entry: MissionSupplyOverview = {
      ...meta,
      scheduledThisWeekCount: wk.needed,
      scheduledThisWeekDays: wk.days,
      scheduledCoveredThisWeek: wk.covered,
      scheduledMissingThisWeek: wk.missing,
      nextShortageDay: wk.nextShortageDay,
      coveredDays,
      hasMoreThan30,
      ruptureDayName,
    };
    missionsOverview.push(entry);
    overviewByCode[bp.code] = entry;
    if (bp.planningGearKey) {
      overviewByGearKey[bp.planningGearKey] = entry;
    }
  });

  const scheduledOverviews = missionsOverview.filter(
    (o) => (baselineNeedsByCode[o.mission.code] || 0) > 0
  );
  const minDaysCovered =
    scheduledOverviews.length > 0
      ? Math.min(...scheduledOverviews.map((o) => o.coveredDays))
      : 30;
  const allOver30Days =
    scheduledOverviews.length > 0 && scheduledOverviews.every((o) => o.hasMoreThan30);
  const limitingMissions = scheduledOverviews
    .filter((o) => !allOver30Days && o.coveredDays === minDaysCovered)
    .map((o) => ({
      code: o.mission.code,
      title: o.mission.title,
      coveredDays: o.coveredDays,
      ruptureDayName: o.ruptureDayName,
    }));

  const readyMissionsCount = missionsOverview.filter((o) => o.totalReadyRuns > 0).length;

  // 3. On-demand Horizon Order Calculator (for OrderPreparationPanel)
  const computeHorizonOrder = (daysAhead: number, excludeDone: boolean): HorizonOrderNeed => {
    const horizonPool: Record<string, number> = {};
    Object.entries(inventoryStock).forEach(([k, v]) => {
      horizonPool[k] = Math.max(0, Math.floor(Number(v) || 0));
    });

    const coveredDaysList: Array<{ day: string; isNextCycle: boolean; missionCount: number }> = [];
    const totalMissionsByGear: Record<string, number> = {};
    const coveredByVaultByGear: Record<string, number> = {};
    const packShortageByGear: Record<string, number> = {};
    const optimalNeededMap = new Map<
      string,
      {
        stockKey: string;
        catalogItemId: string;
        name: string;
        kind: 'pack' | 'key' | 'utility';
        unitPrice: number;
        neededInHorizon: number;
      }
    >();

    let uncoveredMissionsCount = 0;

    for (let i = 0; i < daysAhead; i++) {
      const rawIdx = startIdx + i;
      const dayIdx = rawIdx % 7;
      const isNextCycle = rawIdx >= 7;
      const daySchedule = isNextCycle
        ? WEEKLY_SCHEDULE[dayIdx]
        : effectiveDays[dayIdx] || WEEKLY_SCHEDULE[dayIdx];
      if (!daySchedule) continue;

      let counted = 0;
      daySchedule.missions.forEach((m) => {
        if (m.gearKey === 'none') return;
        if (!isNextCycle && excludeDone) {
          const st = getStatus(getMissionEntry(missionStates, m.id));
          if (st !== '') return;
        }
        const blueprint = missionByGearKey.get(m.gearKey);
        const meta = blueprint ? missionMetaByCode.get(blueprint.code) : undefined;
        const hasInvEntry = INVENTORY_ITEMS.some((it) => it.key === m.gearKey);
        if (!hasInvEntry && !meta) return;

        counted++;
        totalMissionsByGear[m.gearKey] = (totalMissionsByGear[m.gearKey] || 0) + 1;

        const packKey = meta?.packStockKey || m.gearKey;
        const packAvail = Math.max(0, horizonPool[packKey] || 0);
        if (packAvail > 0) {
          horizonPool[packKey] = packAvail - 1;
          coveredByVaultByGear[m.gearKey] = (coveredByVaultByGear[m.gearKey] || 0) + 1;
          return;
        }

        if (meta && !meta.isSingleUnifiedKey && meta.distinctReqs.length > 0) {
          const allSoloOk = meta.distinctReqs.every(
            (r) => Math.max(0, horizonPool[r.stockKey] || 0) >= r.qty
          );
          if (allSoloOk) {
            meta.distinctReqs.forEach((r) => {
              horizonPool[r.stockKey] = Math.max(0, (horizonPool[r.stockKey] || 0) - r.qty);
            });
            coveredByVaultByGear[m.gearKey] = (coveredByVaultByGear[m.gearKey] || 0) + 1;
            return;
          }

          // Uncovered: add requirements to optimal solo list (subtracting remaining pool at end)
          uncoveredMissionsCount++;
          packShortageByGear[m.gearKey] = (packShortageByGear[m.gearKey] || 0) + 1;
          meta.distinctReqs.forEach((r) => {
            const kind: 'pack' | 'key' | 'utility' = r.itemId.startsWith('em_cle_') || r.itemId.startsWith('em_deto_')
              ? 'key'
              : 'utility';
            const existing = optimalNeededMap.get(r.stockKey);
            if (existing) {
              existing.neededInHorizon += r.qty;
            } else {
              optimalNeededMap.set(r.stockKey, {
                stockKey: r.stockKey,
                catalogItemId: r.itemId,
                name: r.displayName,
                kind,
                unitPrice: r.unitPrice,
                neededInHorizon: r.qty,
              });
            }
          });
        } else {
          // Unified item/pack (e.g. ATM, Maison, Supérettes, USB)
          uncoveredMissionsCount++;
          packShortageByGear[m.gearKey] = (packShortageByGear[m.gearKey] || 0) + 1;
          const catItem = meta?.packItemId ? catalogMap.get(meta.packItemId) : undefined;
          const catalogItemId = meta?.packItemId || '';
          const invRef = INVENTORY_ITEMS.find((it) => it.key === m.gearKey);
          const unitPrice = getInventoryItemPrice(
            m.gearKey,
            inventoryPrices,
            invRef?.price ?? catItem?.price ?? 0
          );
          if (catalogItemId) {
            const existing = optimalNeededMap.get(packKey);
            if (existing) {
              existing.neededInHorizon += 1;
            } else {
              optimalNeededMap.set(packKey, {
                stockKey: packKey,
                catalogItemId,
                name: invRef?.name || catItem?.name || m.gearName,
                kind: 'pack',
                unitPrice,
                neededInHorizon: 1,
              });
            }
          }
        }
      });

      coveredDaysList.push({
        day: daySchedule.day,
        isNextCycle,
        missionCount: counted,
      });
    }

    const packOrderRows = INVENTORY_ITEMS.filter(
      (i) => i.category === 'tool' || i.category === 'heist_pack'
    ).map((item) => {
      const bp = missionByGearKey.get(item.key);
      const unitPrice = getInventoryItemPrice(item.key, inventoryPrices);
      const neededTotal = totalMissionsByGear[item.key] || 0;
      const coveredByVault = coveredByVaultByGear[item.key] || 0;
      const shortage = packShortageByGear[item.key] || 0;
      return {
        stockKey: item.key as string,
        catalogItemId: bp?.packItemId || null,
        name: item.name,
        category: item.category,
        unitPrice,
        neededTotal,
        coveredByVault,
        shortage,
      };
    });

    // Include any non-INVENTORY_ITEMS scheduled mission like 'amu' (Ammunation)
    const extraScheduledBp = EMINENCE_MISSIONS.find((bp) => bp.planningGearKey === 'amu');
    if (extraScheduledBp && (totalMissionsByGear['amu'] || 0) > 0) {
      const meta = missionMetaByCode.get(extraScheduledBp.code);
      const amuReq = meta?.distinctReqs[0];
      if (amuReq) {
        packOrderRows.push({
          stockKey: amuReq.stockKey,
          catalogItemId: amuReq.itemId,
          name: amuReq.displayName,
          category: 'tool',
          unitPrice: amuReq.unitPrice,
          neededTotal: totalMissionsByGear['amu'] || 0,
          coveredByVault: coveredByVaultByGear['amu'] || 0,
          shortage: packShortageByGear['amu'] || 0,
        });
      }
    }

    const optimalOrderRows = Array.from(optimalNeededMap.values())
      .map((entry) => {
        const remainingInVault = Math.max(0, horizonPool[entry.stockKey] || 0);
        const missingQty = Math.max(0, entry.neededInHorizon - remainingInVault);
        return {
          ...entry,
          inVault: remainingInVault,
          missingQty,
        };
      })
      .sort((a, b) => b.missingQty - a.missingQty || a.name.localeCompare(b.name, 'fr-FR'));

    const packOrderTotalCost = packOrderRows.reduce(
      (sum, r) => sum + r.shortage * r.unitPrice,
      0
    );
    const optimalOrderTotalCost = optimalOrderRows.reduce(
      (sum, r) => sum + r.missingQty * r.unitPrice,
      0
    );
    const optimalSavingsVsPacks = Math.max(0, packOrderTotalCost - optimalOrderTotalCost);

    return {
      daysAhead,
      startDay: safeStartDay,
      coveredDays: coveredDaysList,
      uncoveredMissionsCount,
      packOrderRows,
      packOrderTotalCost,
      optimalOrderRows,
      optimalOrderTotalCost,
      optimalSavingsVsPacks,
    };
  };

  return {
    startDay: safeStartDay,
    missionsOverview,
    overviewByCode,
    overviewByGearKey,
    allocationsByMissionId,
    totalMissionsCount: EMINENCE_MISSIONS.length,
    readyMissionsCount,
    craftablePacksTotal,
    weekRemainingMissionsCount,
    weekCoveredCount,
    weekUncoveredCount,
    weekMissingOptimalItems,
    weekMissingOptimalCost,
    minDaysCovered,
    allOver30Days,
    limitingMissions,
    computeHorizonOrder,
  };
}
