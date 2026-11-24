import {
  DAY_NAMES,
  DEFAULT_CATALOG_GROUPS,
  DISTINCTION_DEFS,
  INVENTORY_ITEMS,
  RANK_LEVELS,
  REWARD_ITEMS,
  TOTAL_WEEKLY_MISSIONS,
  WEEKLY_SCHEDULE,
} from '@/src/data/cartelData';
import type {
  CatalogGroupsMap,
  CatalogItem,
  CatalogItemCategory,
  CurrentWeekPayrollState,
  DistinctionKey,
  GearKey,
  HierarchyMember,
  InventoryPrices,
  InventoryStock,
  MemberRankingsMap,
  Mission,
  MissionFinance,
  MissionScheduleMeta,
  MissionStateEntry,
  MissionStates,
  MissionStatus,
  PayrollBasis,
  PayrollMemberRow,
  RewardStocks,
  TreasuryMoney,
  WeaponsStock,
  WeeklyArchiveDayRow,
  WeeklyArchiveGlobalSnapshot,
  WeeklyArchiveMissionRow,
  WeeklyArchiveRecord,
} from '@/src/types/cartel';
import { getEffectiveSchedule } from '@/src/utils/schedule';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseIso(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function currentWeekStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export function isWeekStale(missionStates: MissionStates): boolean {
  const w = missionStates.__week;
  return !!w && w !== isoDate(currentWeekStart());
}

export function displayWeekStart(missionStates: MissionStates): Date {
  const w = missionStates.__week;
  return w && isWeekStale(missionStates) ? parseIso(w) : currentWeekStart();
}

export function dayDate(dayName: string, missionStates: MissionStates): Date {
  const base = displayWeekStart(missionStates);
  const d = new Date(base);
  const idx = DAY_NAMES.indexOf(dayName);
  d.setDate(base.getDate() + (idx >= 0 ? idx : 0));
  return d;
}

export function fmtShort(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

export function fmtLong(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

export function isTodayName(dayName: string, missionStates: MissionStates): boolean {
  return !isWeekStale(missionStates) && isoDate(dayDate(dayName, missionStates)) === isoDate(new Date());
}

export function weekRangeText(missionStates: MissionStates): string {
  const start = displayWeekStart(missionStates);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `du ${fmtLong(start)} au ${fmtLong(end)} ${end.getFullYear()}`;
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' $';
}

export function formatSigned(v: number): string {
  return (v > 0 ? '+' : v < 0 ? '-' : '') + formatMoney(Math.abs(v));
}

export function netClass(v: number): string {
  return v > 0 ? 'text-emerald-400' : v < 0 ? 'text-crimson-light' : 'text-zinc-400';
}

export function getMissionEntry(
  missionStates: MissionStates,
  id: string
): MissionStateEntry {
  const raw = missionStates[id];
  if (raw && typeof raw === 'object') {
    return raw;
  }
  return {};
}

export function getStatus(st?: MissionStateEntry): MissionStatus {
  if (!st) return '';
  if (st.status) return st.status;
  return st.completed ? 'success' : '';
}

export function getCatalogStockKey(itemId: string): string {
  const safe = itemId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 28);
  return `cat_${safe || 'item'}`;
}

export interface CatalogExtraInventoryItem {
  key: string;
  itemId: string;
  groupId: string;
  groupName: string;
  name: string;
  price: number;
  category: CatalogItemCategory;
}

export function getCatalogExtraInventoryItems(
  catalogGroups?: CatalogGroupsMap
): CatalogExtraInventoryItem[] {
  if (!catalogGroups) return [];
  const seenKeys = new Set<string>();
  const result: CatalogExtraInventoryItem[] = [];
  Object.values(catalogGroups)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr-FR'))
    .forEach((group) => {
      group.items.forEach((item) => {
        if (item.tradeType !== 'sell') return;
        if (item.linkedGearKey) return;
        if (item.category === 'reparation' || item.category === 'butin') return;
        const key = getCatalogStockKey(item.id);
        if (seenKeys.has(key)) return;
        seenKeys.add(key);
        result.push({
          key,
          itemId: item.id,
          groupId: group.id,
          groupName: group.name,
          name: item.name,
          price: Math.max(0, Math.round(Number(item.price) || 0)),
          category: item.category,
        });
      });
    });
  return result;
}

export const REWARD_KEY_TO_CATALOG_BUYBACK_ID: Record<string, string> = {
  boite_bijoux: 'br_bijoux',
  peinture_volee: 'br_peinture',
  lingot_or: 'br_lingot',
  carte_graphique: 'br_gpu',
  processeur: 'br_cpu',
  montre_or: 'br_montre',
  collier_or: 'br_collier',
  vetement_luxe: 'br_vetement',
  lunette_luxe: 'br_lunette',
  whiskey_luxe: 'em_whiskey',
};

export const CATALOG_BUYBACK_ID_TO_REWARD_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(REWARD_KEY_TO_CATALOG_BUYBACK_ID).map(([rewardKey, catId]) => [catId, rewardKey])
);

export function resolveCatalogSellItemPrice(
  item: CatalogItem,
  inventoryPrices?: InventoryPrices
): number {
  const fallback = Math.max(0, Math.round(Number(item.price) || 0));
  if (item.tradeType !== 'sell') return fallback;
  let stockKey: string | null = null;
  if (item.linkedGearKey && INVENTORY_ITEMS.some((inv) => inv.key === item.linkedGearKey)) {
    stockKey = item.linkedGearKey;
  } else if (item.category !== 'reparation' && item.category !== 'butin') {
    stockKey = getCatalogStockKey(item.id);
  }
  if (stockKey && inventoryPrices && inventoryPrices[stockKey] !== undefined) {
    return Math.max(0, Math.round(Number(inventoryPrices[stockKey]) || 0));
  }
  return fallback;
}

export function getCatalogFallbackPriceByStockKey(
  key: string,
  catalogGroups?: CatalogGroupsMap
): number | undefined {
  const checkGroups = (groups?: CatalogGroupsMap): number | undefined => {
    if (!groups) return undefined;
    for (const group of Object.values(groups)) {
      for (const item of group.items) {
        if (item.tradeType !== 'sell') continue;
        if (item.linkedGearKey === key) {
          return Math.max(0, Math.round(Number(item.price) || 0));
        }
        if (!item.linkedGearKey && getCatalogStockKey(item.id) === key) {
          return Math.max(0, Math.round(Number(item.price) || 0));
        }
      }
    }
    return undefined;
  };

  const fromCustom = checkGroups(catalogGroups);
  if (fromCustom !== undefined) return fromCustom;
  return checkGroups(DEFAULT_CATALOG_GROUPS);
}

export function getInventoryItemPrice(
  key: string,
  inventoryPrices?: InventoryPrices,
  fallbackPrice?: number,
  catalogGroups?: CatalogGroupsMap
): number {
  if (inventoryPrices && inventoryPrices[key] !== undefined) {
    return Math.max(0, Number(inventoryPrices[key]) || 0);
  }
  const found = INVENTORY_ITEMS.find((i) => i.key === key);
  if (found) return found.price;
  if (fallbackPrice !== undefined) {
    return Math.max(0, Number(fallbackPrice) || 0);
  }
  const catFallback = getCatalogFallbackPriceByStockKey(key, catalogGroups);
  return catFallback !== undefined ? catFallback : 0;
}

export function calcUsedGearCost(
  usedGear: Record<string, number> | undefined,
  inventoryPrices?: InventoryPrices,
  catalogGroups?: CatalogGroupsMap
): { cost: number; hasItems: boolean } {
  if (!usedGear || typeof usedGear !== 'object') {
    return { cost: 0, hasItems: false };
  }
  let cost = 0;
  let hasItems = false;
  Object.entries(usedGear).forEach(([key, rawQty]) => {
    const qty = Math.max(0, Math.floor(Number(rawQty) || 0));
    if (qty <= 0) return;
    hasItems = true;
    const unitPrice = getInventoryItemPrice(key, inventoryPrices, undefined, catalogGroups);
    cost += qty * unitPrice;
  });
  return { cost, hasItems };
}

export function getMissionCost(
  m: Mission,
  inventoryPrices?: InventoryPrices,
  catalogGroups?: CatalogGroupsMap
): number {
  if (m.gearKey && m.gearKey !== 'none') {
    if (INVENTORY_ITEMS.some((i) => i.key === m.gearKey)) {
      return getInventoryItemPrice(m.gearKey, inventoryPrices, m.cost, catalogGroups);
    }
    if (m.gearKey === 'amu') {
      return getInventoryItemPrice('cat_em_cle_ammunation', inventoryPrices, m.cost, catalogGroups);
    }
  }
  return Math.max(0, Number(m.cost) || 0);
}

export function getMissionGearLabel(
  m: Mission,
  inventoryPrices?: InventoryPrices,
  catalogGroups?: CatalogGroupsMap
): string {
  if (!m.gearKey || m.gearKey === 'none' || m.gearKey === 'fbi' || m.gearKey === 'uni') {
    return m.gearName;
  }
  const liveCost = getMissionCost(m, inventoryPrices, catalogGroups);
  if (m.gearKey === 'drg') {
    return `Clé USB 3.1 (${liveCost > 0 ? formatMoney(liveCost) : 'Prix à définir'})`;
  }
  const baseName = m.gearName.replace(/\s*\([^)]*\)\s*$/, '').trim();
  return `${baseName} (${liveCost > 0 ? formatMoney(liveCost) : 'Prix à définir'})`;
}

export function missionFin(
  m: Mission,
  missionStates: MissionStates,
  inventoryPrices?: InventoryPrices,
  catalogGroups?: CatalogGroupsMap
): MissionFinance {
  const st = getMissionEntry(missionStates, m.id);
  const status = getStatus(st);
  const done = status !== '';
  const success = status === 'success';
  const fail = status === 'fail';
  let cost = 0;
  if (done) {
    const used = calcUsedGearCost(st.usedGear, inventoryPrices, catalogGroups);
    cost = used.hasItems ? used.cost : getMissionCost(m, inventoryPrices, catalogGroups);
  }
  const gain = success ? Number(st.gain) || 0 : 0;
  const extra = done ? Number(st.extra) || 0 : 0;
  return {
    status,
    done,
    success,
    fail,
    cost,
    gain,
    extra,
    net: gain - cost - extra,
  };
}

export function checkStockAvailability(
  gearKey: GearKey,
  inventoryStock: InventoryStock
): { available: boolean; count: number } {
  if (!gearKey || gearKey === 'none') {
    return { available: true, count: 999 };
  }
  const currentStock = inventoryStock[gearKey] || 0;
  return { available: currentStock > 0, count: currentStock };
}

export interface ItemAutonomyInfo {
  key: string;
  coveredDays: number;
  hasMoreThan30: boolean;
  ruptureDayName: string | null;
  neededPerWeek: number;
  todayNeeded: number;
  todayShortage: number;
}

export interface StockAutonomyResult {
  startDay: string;
  minDaysCovered: number;
  allOver30Days: boolean;
  limitingItems: Array<{ key: string; name: string; coveredDays: number; ruptureDayName: string | null }>;
  byKey: Record<string, ItemAutonomyInfo>;
}

export function calcStockAutonomy(params: {
  inventoryStock: InventoryStock;
  missionStates: MissionStates;
  scheduleMeta?: MissionScheduleMeta;
  startDayName?: string;
  excludeDone?: boolean;
}): StockAutonomyResult {
  const { inventoryStock, missionStates, scheduleMeta, startDayName, excludeDone = true } = params;
  const detectedToday = DAY_NAMES.find((d) => isTodayName(d, missionStates)) || 'Lundi';
  const safeStartDay =
    startDayName && DAY_NAMES.includes(startDayName) ? startDayName : detectedToday;
  const startIdx = Math.max(0, DAY_NAMES.indexOf(safeStartDay));
  const effectiveDays = getEffectiveSchedule(missionStates, scheduleMeta).days;

  // Weekly baseline requirement per gear key
  const weeklyNeeds: Record<string, number> = {};
  WEEKLY_SCHEDULE.forEach((day) => {
    day.missions.forEach((m) => {
      if (m.gearKey === 'none') return;
      if (!INVENTORY_ITEMS.some((i) => i.key === m.gearKey)) return;
      weeklyNeeds[m.gearKey] = (weeklyNeeds[m.gearKey] || 0) + 1;
    });
  });

  // Remaining mission requirement for a given simulated day offset d (0..34)
  const MAX_SIM_DAYS = 35;
  const byKey: Record<string, ItemAutonomyInfo> = {};

  INVENTORY_ITEMS.forEach((item) => {
    const startStock = Math.max(0, Math.floor(Number(inventoryStock[item.key]) || 0));
    const neededPerWeek = weeklyNeeds[item.key] || 0;

    // First day requirement
    const firstSchedule = effectiveDays[startIdx] || WEEKLY_SCHEDULE[startIdx];
    let todayNeeded = 0;
    if (firstSchedule) {
      firstSchedule.missions.forEach((m) => {
        if (m.gearKey !== item.key) return;
        if (excludeDone && getStatus(getMissionEntry(missionStates, m.id)) !== '') return;
        todayNeeded++;
      });
    }
    const todayShortage = Math.max(0, todayNeeded - startStock);

    if (neededPerWeek === 0) {
      byKey[item.key] = {
        key: item.key,
        coveredDays: 30,
        hasMoreThan30: true,
        ruptureDayName: null,
        neededPerWeek: 0,
        todayNeeded: 0,
        todayShortage: 0,
      };
      return;
    }

    let remaining = startStock;
    let coveredDays = 0;
    let ruptureDayName: string | null = null;

    for (let d = 0; d < MAX_SIM_DAYS; d++) {
      const rawIdx = startIdx + d;
      const dayIdx = rawIdx % 7;
      const isNextCycle = rawIdx >= 7;
      const schedule = isNextCycle
        ? WEEKLY_SCHEDULE[dayIdx]
        : effectiveDays[dayIdx] || WEEKLY_SCHEDULE[dayIdx];
      let dayNeed = 0;
      if (schedule) {
        schedule.missions.forEach((m) => {
          if (m.gearKey !== item.key) return;
          if (!isNextCycle && excludeDone && getStatus(getMissionEntry(missionStates, m.id)) !== '') {
            return;
          }
          dayNeed++;
        });
      }

      if (remaining >= dayNeed) {
        remaining -= dayNeed;
        coveredDays++;
      } else {
        ruptureDayName = schedule?.day || null;
        break;
      }
    }

    const hasMoreThan30 = coveredDays >= 31;
    byKey[item.key] = {
      key: item.key,
      coveredDays: hasMoreThan30 ? 30 : coveredDays,
      hasMoreThan30,
      ruptureDayName: hasMoreThan30 ? null : ruptureDayName,
      neededPerWeek,
      todayNeeded,
      todayShortage,
    };
  });

  const scheduledEntries = INVENTORY_ITEMS.filter(
    (item) => (weeklyNeeds[item.key] || 0) > 0
  ).map((item) => ({
    item,
    info: byKey[item.key],
  }));

  const minDaysCovered =
    scheduledEntries.length > 0
      ? Math.min(...scheduledEntries.map((e) => e.info.coveredDays))
      : 30;
  const allOver30Days =
    scheduledEntries.length > 0 && scheduledEntries.every((e) => e.info.hasMoreThan30);

  const limitingItems = scheduledEntries
    .filter((e) => !allOver30Days && e.info.coveredDays === minDaysCovered)
    .map((e) => ({
      key: e.item.key,
      name: e.item.name,
      coveredDays: e.info.coveredDays,
      ruptureDayName: e.info.ruptureDayName,
    }));

  return {
    startDay: safeStartDay,
    minDaysCovered,
    allOver30Days,
    limitingItems,
    byKey,
  };
}

export function calcInventoryTotalValue(
  inventoryStock: InventoryStock,
  inventoryPrices?: InventoryPrices,
  catalogGroups?: CatalogGroupsMap
): number {
  const staticSum = INVENTORY_ITEMS.reduce((sum, item) => {
    const qty = Math.max(0, Number(inventoryStock[item.key]) || 0);
    const price = getInventoryItemPrice(item.key, inventoryPrices, item.price, catalogGroups);
    return sum + qty * price;
  }, 0);
  const dynamicSum = getCatalogExtraInventoryItems(catalogGroups).reduce((sum, item) => {
    const qty = Math.max(0, Number(inventoryStock[item.key]) || 0);
    const price = getInventoryItemPrice(item.key, inventoryPrices, item.price, catalogGroups);
    return sum + qty * price;
  }, 0);
  return staticSum + dynamicSum;
}

export function calcRewardsTotalValue(rewardStocks: RewardStocks): number {
  return REWARD_ITEMS.reduce((sum, item) => {
    const dat = rewardStocks[item.key] || { qty: 0, val: item.defaultVal };
    const qty = Math.max(0, Number(dat.qty) || 0);
    const val = dat.val !== undefined ? Math.max(0, Number(dat.val) || 0) : item.defaultVal;
    return sum + qty * val;
  }, 0);
}

export function calcWeaponsTotalValue(weaponsStock: WeaponsStock): number {
  return Object.values(weaponsStock).reduce((sum, w) => {
    if (!w || typeof w !== 'object') return sum;
    const qty = Math.max(0, Number(w.qty) || 0);
    const val = Math.max(0, Number(w.value) || 0);
    return sum + qty * val;
  }, 0);
}

export function getWeaponHolderName(
  holderId: string,
  members: HierarchyMember[]
): string {
  if (!holderId || holderId === 'coffre') return 'Coffre Cartel';
  const found = members.find((m) => m.id === holderId);
  return found ? found.name : 'Ancien membre';
}

export function calcTotalWealth(params: {
  treasuryMoney: TreasuryMoney;
  rewardStocks: RewardStocks;
  inventoryStock: InventoryStock;
  inventoryPrices?: InventoryPrices;
  weaponsStock?: WeaponsStock;
  catalogGroups?: CatalogGroupsMap;
}): number {
  const {
    treasuryMoney,
    rewardStocks,
    inventoryStock,
    inventoryPrices,
    weaponsStock = {},
    catalogGroups,
  } = params;
  return (
    Math.max(0, Number(treasuryMoney.legal) || 0) +
    Math.max(0, Number(treasuryMoney.illegal) || 0) +
    calcRewardsTotalValue(rewardStocks) +
    calcInventoryTotalValue(inventoryStock, inventoryPrices, catalogGroups) +
    calcWeaponsTotalValue(weaponsStock)
  );
}

export interface RankedMemberEntry {
  member: HierarchyMember;
  rank: number;
  missionsOk: number;
  missionsKo: number;
  missionsTotal: number;
  heistsOk: number;
  smallOpsOk: number;
  estimatedRevenue: number;
  grossRevenue: number;
  materialCostShare: number;
  lossShare: number;
  weaponsHeldCount: number;
  weaponsHeldValue: number;
  autoPoints: number;
  bonusPoints: number;
  totalPoints: number;
  levelTitle: string;
  autoBadges: DistinctionKey[];
  manualBadges: DistinctionKey[];
  unlockedBadges: DistinctionKey[];
  note: string;
}

export function computeMemberLeaderboard(params: {
  members: HierarchyMember[];
  missionStates: MissionStates;
  weaponsStock: WeaponsStock;
  memberRankings: MemberRankingsMap;
  inventoryPrices?: InventoryPrices;
  catalogGroups?: CatalogGroupsMap;
}): RankedMemberEntry[] {
  const {
    members,
    missionStates,
    weaponsStock,
    memberRankings,
    inventoryPrices,
    catalogGroups,
  } = params;
  const stats = new Map<
    string,
    {
      missionsOk: number;
      missionsKo: number;
      heistsOk: number;
      smallOpsOk: number;
      grossSum: number;
      costSum: number;
      lossSum: number;
    }
  >();

  WEEKLY_SCHEDULE.forEach((dayObj) => {
    dayObj.missions.forEach((m) => {
      const f = missionFin(m, missionStates, inventoryPrices, catalogGroups);
      if (!f.done) return;
      const entry = getMissionEntry(missionStates, m.id);
      const players = Array.isArray(entry.players) ? entry.players : [];
      if (players.length === 0) return;

      const grossPerPlayer = f.success ? f.gain / players.length : 0;
      const costPerPlayer = f.cost / players.length;
      const lossPerPlayer = f.extra / players.length;

      players.forEach((pid) => {
        const cur = stats.get(pid) || {
          missionsOk: 0,
          missionsKo: 0,
          heistsOk: 0,
          smallOpsOk: 0,
          grossSum: 0,
          costSum: 0,
          lossSum: 0,
        };
        if (f.success) {
          cur.missionsOk++;
          if (m.major) cur.heistsOk++;
          else cur.smallOpsOk++;
          cur.grossSum += grossPerPlayer;
        } else if (f.fail) {
          cur.missionsKo++;
        }
        cur.costSum += costPerPlayer;
        cur.lossSum += lossPerPlayer;
        stats.set(pid, cur);
      });
    });
  });

  const weaponsByHolder = new Map<string, { count: number; value: number }>();
  Object.values(weaponsStock).forEach((w) => {
    if (!w || !w.holderId || w.holderId === 'coffre') return;
    const qty = Math.max(0, Number(w.qty) || 0);
    const val = Math.max(0, Number(w.value) || 0);
    if (qty <= 0) return;
    const cur = weaponsByHolder.get(w.holderId) || { count: 0, value: 0 };
    cur.count += qty;
    cur.value += qty * val;
    weaponsByHolder.set(w.holderId, cur);
  });

  const validBadgeKeys = new Set(DISTINCTION_DEFS.map((d) => d.key));

  const preliminary = members.map((member) => {
    const st = stats.get(member.id) || {
      missionsOk: 0,
      missionsKo: 0,
      heistsOk: 0,
      smallOpsOk: 0,
      grossSum: 0,
      costSum: 0,
      lossSum: 0,
    };
    const wp = weaponsByHolder.get(member.id) || { count: 0, value: 0 };
    const adj = memberRankings[member.id];
    const bonusPoints = adj ? Math.trunc(Number(adj.bonusPoints) || 0) : 0;
    const manualBadges = Array.isArray(adj?.manualBadges)
      ? adj.manualBadges.filter((b): b is DistinctionKey => validBadgeKeys.has(b))
      : [];
    const note = typeof adj?.note === 'string' ? adj.note.trim() : '';

    const grossRevenue = Math.round(st.grossSum);
    const materialCostShare = Math.round(st.costSum);
    const lossShare = Math.round(st.lossSum);
    const estimatedRevenue = grossRevenue - materialCostShare - lossShare;

    const autoPoints = st.smallOpsOk * 100 + st.heistsOk * 250 + st.missionsKo * 25;
    const totalPoints = Math.max(0, autoPoints + bonusPoints);
    const missionsTotal = st.missionsOk + st.missionsKo;

    const levelObj =
      RANK_LEVELS.find((lvl) => totalPoints >= lvl.minPoints) ||
      RANK_LEVELS[RANK_LEVELS.length - 1];

    const autoBadges: DistinctionKey[] = [];
    if (missionsTotal >= 10) autoBadges.push('sang_fidele');
    if (st.missionsOk >= 5) autoBadges.push('frere_armes');
    if (st.smallOpsOk >= 3) autoBadges.push('loup_solitaire');
    if (st.heistsOk >= 2) autoBadges.push('stratege');
    if (totalPoints >= 1200) autoBadges.push('homme_confiance');
    if (totalPoints >= 2500) autoBadges.push('legende');

    return {
      member,
      rank: 1,
      missionsOk: st.missionsOk,
      missionsKo: st.missionsKo,
      missionsTotal,
      heistsOk: st.heistsOk,
      smallOpsOk: st.smallOpsOk,
      estimatedRevenue,
      grossRevenue,
      materialCostShare,
      lossShare,
      weaponsHeldCount: wp.count,
      weaponsHeldValue: wp.value,
      autoPoints,
      bonusPoints,
      totalPoints,
      levelTitle: levelObj.title,
      autoBadges,
      manualBadges,
      unlockedBadges: Array.from(new Set<DistinctionKey>([...autoBadges, ...manualBadges])),
      note,
    };
  });

  preliminary.sort(
    (a, b) =>
      b.totalPoints - a.totalPoints ||
      b.missionsOk - a.missionsOk ||
      b.heistsOk - a.heistsOk ||
      b.estimatedRevenue - a.estimatedRevenue ||
      (a.member.order || 0) - (b.member.order || 0) ||
      a.member.name.localeCompare(b.member.name, 'fr-FR')
  );

  return preliminary.map((entry, idx) => {
    const rank = idx + 1;
    let unlocked = entry.unlockedBadges;
    let auto = entry.autoBadges;
    if (rank === 1 && entry.totalPoints > 0 && !auto.includes('legende')) {
      auto = [...auto, 'legende'];
      unlocked = Array.from(new Set<DistinctionKey>([...auto, ...entry.manualBadges]));
    }
    return {
      ...entry,
      rank,
      autoBadges: auto,
      unlockedBadges: unlocked,
    };
  });
}

export function buildDiscordReport(params: {
  missionStates: MissionStates;
  scheduleMeta?: MissionScheduleMeta;
  treasuryMoney: TreasuryMoney;
  rewardStocks: RewardStocks;
  inventoryStock?: InventoryStock;
  inventoryPrices?: InventoryPrices;
  weaponsStock?: WeaponsStock;
  weaponsLossAmount: number;
  hierMembers?: HierarchyMember[];
  catalogGroups?: CatalogGroupsMap;
}): string {
  const {
    missionStates,
    scheduleMeta,
    treasuryMoney,
    rewardStocks,
    inventoryStock = {},
    inventoryPrices,
    weaponsStock = {},
    weaponsLossAmount,
    hierMembers = [],
    catalogGroups,
  } = params;
  const effectiveScheduleDays = getEffectiveSchedule(missionStates, scheduleMeta).days;
  let discordText = '```asciidoc\n';
  discordText += '= BILAN COMPTABLE & TRÉSORERIE LOS CERBEROS =\n';
  discordText += `Semaine ${weekRangeText(missionStates)}\n\n`;

  discordText += `Argent Légal en Caisse  : ${formatMoney(treasuryMoney.legal || 0)}\n`;
  discordText += `Argent Illégal en Caisse: ${formatMoney(treasuryMoney.illegal || 0)}\n`;

  let rewardsValTotal = 0;
  REWARD_ITEMS.forEach((i) => {
    const dat = rewardStocks[i.key] || { qty: 0, val: i.defaultVal };
    const qty = Math.max(0, Number(dat.qty) || 0);
    const val = dat.val !== undefined ? Math.max(0, Number(dat.val) || 0) : i.defaultVal;
    const sub = qty * val;
    rewardsValTotal += sub;
    if (qty > 0) {
      discordText += `- ${i.name} (${qty}x) : ${formatMoney(sub)}\n`;
    }
  });

  const inventoryValTotal = calcInventoryTotalValue(
    inventoryStock,
    inventoryPrices,
    catalogGroups
  );
  INVENTORY_ITEMS.forEach((i) => {
    const qty = Math.max(0, Number(inventoryStock[i.key]) || 0);
    if (qty > 0) {
      const price = getInventoryItemPrice(i.key, inventoryPrices, i.price, catalogGroups);
      discordText += `- [Stock] ${i.name} (${qty}x) : ${formatMoney(qty * price)}\n`;
    }
  });
  getCatalogExtraInventoryItems(catalogGroups).forEach((i) => {
    const qty = Math.max(0, Number(inventoryStock[i.key]) || 0);
    if (qty > 0) {
      const price = getInventoryItemPrice(i.key, inventoryPrices, i.price, catalogGroups);
      discordText += `- [Stock] ${i.name} (${qty}x) : ${formatMoney(qty * price)}\n`;
    }
  });

  const weaponsValTotal = calcWeaponsTotalValue(weaponsStock);
  Object.values(weaponsStock).forEach((w) => {
    if (!w) return;
    const qty = Math.max(0, Number(w.qty) || 0);
    const val = Math.max(0, Number(w.value) || 0);
    if (qty > 0) {
      const holderName = getWeaponHolderName(w.holderId, hierMembers);
      discordText += `- [Arme] ${w.name} (${qty}x) — ${holderName} : ${formatMoney(qty * val)}\n`;
    }
  });

  discordText += `Valeur Marché Noir (Total): ${formatMoney(rewardsValTotal)}\n`;
  discordText += `Valeur Inventaire (Stock) : ${formatMoney(inventoryValTotal)}\n`;
  discordText += `Valeur Arsenal (Armes)    : ${formatMoney(weaponsValTotal)}\n`;
  discordText += `PATRIMOINE GLOBAL CARTEL  : ${formatMoney(
    calcTotalWealth({
      treasuryMoney,
      rewardStocks,
      inventoryStock,
      inventoryPrices,
      weaponsStock,
      catalogGroups,
    })
  )}\n`;
  discordText += `---------------------------------------------\n`;

  let totalCost = 0;
  let totalExtra = 0;
  let totalGains = 0;
  let totalOk = 0;
  let totalKo = 0;

  effectiveScheduleDays.forEach((day) => {
    let ok = 0;
    let ko = 0;
    let cost = 0;
    let extra = 0;
    let gains = 0;
    day.missions.forEach((m) => {
      const f = missionFin(m, missionStates, inventoryPrices, catalogGroups);
      if (f.success) ok++;
      if (f.fail) ko++;
      cost += f.cost;
      extra += f.extra;
      gains += f.gain;
    });
    totalOk += ok;
    totalKo += ko;
    totalCost += cost;
    totalExtra += extra;
    totalGains += gains;
    discordText += `[ ${day.day} ${fmtShort(dayDate(day.day, missionStates))} ] : ${ok} réussies / ${ko} échouées | Matériel: ${formatMoney(cost)} | Pertes: ${formatMoney(extra)} | Gains: ${formatMoney(gains)}\n`;
  });

  const playerStats = new Map<string, { ok: number; ko: number }>();
  WEEKLY_SCHEDULE.forEach((day) => {
    day.missions.forEach((m) => {
      const f = missionFin(m, missionStates, inventoryPrices, catalogGroups);
      if (!f.done) return;
      const entry = getMissionEntry(missionStates, m.id);
      const players = Array.isArray(entry.players) ? entry.players : [];
      players.forEach((pid) => {
        const cur = playerStats.get(pid) || { ok: 0, ko: 0 };
        if (f.success) cur.ok++;
        else if (f.fail) cur.ko++;
        playerStats.set(pid, cur);
      });
    });
  });

  const net = totalGains - (totalCost + totalExtra + weaponsLossAmount);
  discordText += `\nMatériel utilisé      : ${formatMoney(totalCost)}\n`;
  discordText += `Pertes missions       : ${formatMoney(totalExtra)}\n`;
  discordText += `Pertes globales armes : ${formatMoney(weaponsLossAmount)}\n`;
  discordText += `Missions              : ${totalOk} réussies / ${totalKo} échouées (sur ${TOTAL_WEEKLY_MISSIONS})\n`;
  discordText += `BÉNÉFICE NET          : ${formatMoney(net)}\n`;

  if (playerStats.size > 0) {
    discordText += `\nParticipations joueurs:\n`;
    const sorted = [...hierMembers].sort(
      (a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name)
    );
    sorted.forEach((member) => {
      const stats = playerStats.get(member.id);
      if (stats && stats.ok + stats.ko > 0) {
        discordText += `- ${member.name} : ${stats.ok} réussie(s) / ${stats.ko} échouée(s)\n`;
      }
    });
  }

  discordText += '```';

  return discordText;
}

export interface SundayPayrollResult {
  week: string;
  weekLabel: string;
  cartelPercent: number;
  membersPercent: number;
  basis: PayrollBasis;
  grossGains: number;
  materialCost: number;
  missionLoss: number;
  weaponsLossAmount: number;
  netWeekProfit: number;
  distributableBase: number;
  payrollPoolAmount: number;
  cartelShareAmount: number;
  unattributedNet: number;
  rows: PayrollMemberRow[];
  totalMemberPositiveNet: number;
  paidTotalAmount: number;
  unpaidTotalAmount: number;
  paidMembersCount: number;
  eligibleMembersCount: number;
}

export function computeSundayPayroll(params: {
  members: HierarchyMember[];
  missionStates: MissionStates;
  scheduleMeta?: MissionScheduleMeta;
  weaponsLossAmount: number;
  inventoryPrices?: InventoryPrices;
  catalogGroups?: CatalogGroupsMap;
  cartelPercent?: number;
  basis?: PayrollBasis;
  paidMemberIds?: string[];
}): SundayPayrollResult {
  const {
    members,
    missionStates,
    scheduleMeta,
    weaponsLossAmount,
    inventoryPrices,
    catalogGroups,
    cartelPercent: rawCartelPercent = 70,
    basis = 'net_cartel',
    paidMemberIds = [],
  } = params;

  const cartelPercent = Math.max(0, Math.min(100, Math.round(Number(rawCartelPercent) || 70)));
  const membersPercent = 100 - cartelPercent;
  const paidSet = new Set(paidMemberIds);

  const memberNameMap = new Map(members.map((m) => [m.id, m]));
  const stats = new Map<
    string,
    {
      missionsOk: number;
      missionsKo: number;
      heistsOk: number;
      grossSum: number;
      costSum: number;
      lossSum: number;
    }
  >();

  let grossGains = 0;
  let materialCost = 0;
  let missionLoss = 0;
  let unattributedNet = 0;

  WEEKLY_SCHEDULE.forEach((dayObj) => {
    dayObj.missions.forEach((m) => {
      const f = missionFin(m, missionStates, inventoryPrices, catalogGroups);
      if (!f.done) return;
      grossGains += f.gain;
      materialCost += f.cost;
      missionLoss += f.extra;

      const entry = getMissionEntry(missionStates, m.id);
      const players = Array.isArray(entry.players) ? entry.players : [];
      if (players.length === 0) {
        unattributedNet += f.net;
        return;
      }

      const grossPerPlayer = f.success ? f.gain / players.length : 0;
      const costPerPlayer = f.cost / players.length;
      const lossPerPlayer = f.extra / players.length;

      players.forEach((pid) => {
        const cur = stats.get(pid) || {
          missionsOk: 0,
          missionsKo: 0,
          heistsOk: 0,
          grossSum: 0,
          costSum: 0,
          lossSum: 0,
        };
        if (f.success) {
          cur.missionsOk++;
          if (m.major) cur.heistsOk++;
          cur.grossSum += grossPerPlayer;
        } else if (f.fail) {
          cur.missionsKo++;
        }
        cur.costSum += costPerPlayer;
        cur.lossSum += lossPerPlayer;
        stats.set(pid, cur);
      });
    });
  });

  // Ensure even unassigned/former participant IDs still appear if they have missions recorded
  const allParticipantIds = new Set<string>(members.map((m) => m.id));
  stats.forEach((_val, pid) => allParticipantIds.add(pid));

  const cleanWeaponsLoss = Math.max(0, Math.round(Number(weaponsLossAmount) || 0));
  const netWeekProfit = grossGains - materialCost - missionLoss - cleanWeaponsLoss;

  const baseRows = Array.from(allParticipantIds).map((pid) => {
    const memberObj = memberNameMap.get(pid);
    const st = stats.get(pid) || {
      missionsOk: 0,
      missionsKo: 0,
      heistsOk: 0,
      grossSum: 0,
      costSum: 0,
      lossSum: 0,
    };
    const grossRevenue = Math.round(st.grossSum);
    const materialCostShare = Math.round(st.costSum);
    const lossShare = Math.round(st.lossSum);
    const netContribution = grossRevenue - materialCostShare - lossShare;
    return {
      memberId: pid,
      memberName: memberObj?.name || 'Ancien membre',
      unit: memberObj?.unit || 'cerberos',
      order: memberObj?.order ?? 999,
      missionsOk: st.missionsOk,
      missionsKo: st.missionsKo,
      heistsOk: st.heistsOk,
      grossRevenue,
      materialCostShare,
      lossShare,
      netContribution,
      positiveContribution: Math.max(0, netContribution),
    };
  });

  const totalMemberPositiveNet = baseRows.reduce((s, r) => s + r.positiveContribution, 0);

  let distributableBase = 0;
  const payoutByMemberId = new Map<string, number>();

  if (basis === 'net_member') {
    distributableBase = totalMemberPositiveNet;
    baseRows.forEach((r) => {
      payoutByMemberId.set(
        r.memberId,
        r.positiveContribution > 0
          ? Math.round((r.positiveContribution * membersPercent) / 100)
          : 0
      );
    });
  } else {
    distributableBase =
      netWeekProfit > 0 && totalMemberPositiveNet > 0
        ? Math.min(netWeekProfit, totalMemberPositiveNet)
        : 0;
    const targetPool = Math.round((distributableBase * membersPercent) / 100);
    if (targetPool > 0 && totalMemberPositiveNet > 0) {
      const exacts = baseRows.map((r) => {
        const exact = (targetPool * r.positiveContribution) / totalMemberPositiveNet;
        const floored = Math.floor(exact);
        return {
          memberId: r.memberId,
          floored,
          remainder: exact - floored,
          positive: r.positiveContribution,
        };
      });
      let remaining =
        targetPool - exacts.reduce((sum, item) => sum + item.floored, 0);
      const byRemainder = [...exacts]
        .filter((e) => e.positive > 0)
        .sort((a, b) => b.remainder - a.remainder);
      for (let i = 0; i < byRemainder.length && remaining > 0; i++) {
        byRemainder[i].floored += 1;
        remaining -= 1;
      }
      exacts.forEach((e) => {
        payoutByMemberId.set(e.memberId, e.floored);
      });
    }
  }

  const rows: PayrollMemberRow[] = baseRows
    .map((r) => {
      const payrollAmount = payoutByMemberId.get(r.memberId) || 0;
      const sharePercent =
        totalMemberPositiveNet > 0 && r.positiveContribution > 0
          ? Math.round((r.positiveContribution / totalMemberPositiveNet) * 1000) / 10
          : 0;
      return {
        memberId: r.memberId,
        memberName: r.memberName,
        unit: r.unit,
        missionsOk: r.missionsOk,
        missionsKo: r.missionsKo,
        heistsOk: r.heistsOk,
        grossRevenue: r.grossRevenue,
        materialCostShare: r.materialCostShare,
        lossShare: r.lossShare,
        netContribution: r.netContribution,
        sharePercent,
        payrollAmount,
        paid: paidSet.has(r.memberId),
      };
    })
    .filter(
      (r) =>
        r.missionsOk + r.missionsKo > 0 ||
        r.payrollAmount > 0 ||
        memberNameMap.has(r.memberId)
    )
    .sort(
      (a, b) =>
        b.payrollAmount - a.payrollAmount ||
        b.netContribution - a.netContribution ||
        b.missionsOk - a.missionsOk ||
        a.memberName.localeCompare(b.memberName, 'fr-FR')
    );

  const payrollPoolAmount = rows.reduce((s, r) => s + r.payrollAmount, 0);
  const cartelShareAmount = netWeekProfit - payrollPoolAmount;

  let paidTotalAmount = 0;
  let unpaidTotalAmount = 0;
  let paidMembersCount = 0;
  let eligibleMembersCount = 0;
  rows.forEach((r) => {
    if (r.payrollAmount > 0) {
      eligibleMembersCount++;
      if (r.paid) {
        paidMembersCount++;
        paidTotalAmount += r.payrollAmount;
      } else {
        unpaidTotalAmount += r.payrollAmount;
      }
    }
  });

  // Preserve unused parameter lint safety if scheduleMeta passed for future daily context
  void scheduleMeta;

  const week =
    typeof missionStates.__week === 'string' &&
    /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(missionStates.__week)
      ? missionStates.__week
      : isoDate(currentWeekStart());

  return {
    week,
    weekLabel: weekRangeText(missionStates),
    cartelPercent,
    membersPercent,
    basis,
    grossGains,
    materialCost,
    missionLoss,
    weaponsLossAmount: cleanWeaponsLoss,
    netWeekProfit,
    distributableBase,
    payrollPoolAmount,
    cartelShareAmount,
    unattributedNet,
    rows,
    totalMemberPositiveNet,
    paidTotalAmount,
    unpaidTotalAmount,
    paidMembersCount,
    eligibleMembersCount,
  };
}

export function buildArchiveRecordFromWeek(params: {
  archiveId: string;
  archivedBy: string;
  missionStates: MissionStates;
  scheduleMeta?: MissionScheduleMeta;
  weaponsLossAmount: number;
  members: HierarchyMember[];
  inventoryPrices?: InventoryPrices;
  catalogGroups?: CatalogGroupsMap;
  currentPayroll?: CurrentWeekPayrollState;
  treasuryMoney?: TreasuryMoney;
  rewardStocks?: RewardStocks;
  inventoryStock?: InventoryStock;
  weaponsStock?: WeaponsStock;
  memberRankings?: MemberRankingsMap;
  notes?: string;
}): WeeklyArchiveRecord {
  const {
    archiveId,
    archivedBy,
    missionStates,
    scheduleMeta,
    weaponsLossAmount,
    members,
    inventoryPrices,
    catalogGroups,
    currentPayroll,
    treasuryMoney = { legal: 0, illegal: 0 },
    rewardStocks = {},
    inventoryStock = {},
    weaponsStock = {},
    memberRankings = {},
    notes = '',
  } = params;

  const week =
    typeof missionStates.__week === 'string' &&
    /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(missionStates.__week)
      ? missionStates.__week
      : isoDate(currentWeekStart());

  const effectiveDays = getEffectiveSchedule(missionStates, scheduleMeta).days;
  const dailyRows: WeeklyArchiveDayRow[] = [];
  const missions: WeeklyArchiveMissionRow[] = [];
  const memberNameById = new Map(members.map((m) => [m.id, m.name]));

  let successCount = 0;
  let failCount = 0;
  let totalMissions = 0;
  let heistsOk = 0;
  let heistsTotal = 0;
  let grossGains = 0;
  let materialCost = 0;
  let missionLoss = 0;

  effectiveDays.forEach((dayObj) => {
    let ok = 0;
    let ko = 0;
    let cost = 0;
    let extra = 0;
    let gains = 0;
    dayObj.missions.forEach((m) => {
      totalMissions++;
      if (m.major) heistsTotal++;
      const f = missionFin(m, missionStates, inventoryPrices, catalogGroups);
      if (f.success) {
        ok++;
        if (m.major) heistsOk++;
      }
      if (f.fail) ko++;
      cost += f.cost;
      extra += f.extra;
      gains += f.gain;

      if (f.done && (f.status === 'success' || f.status === 'fail')) {
        const entry = getMissionEntry(missionStates, m.id);
        const players = Array.isArray(entry.players)
          ? entry.players.map((pid) => memberNameById.get(pid) || pid).slice(0, 20)
          : [];
        missions.push({
          id: m.id,
          name: m.name,
          day: dayObj.day,
          major: Boolean(m.major),
          status: f.status,
          gain: f.gain,
          cost: f.cost,
          extra: f.extra,
          net: f.net,
          players,
        });
      }
    });
    successCount += ok;
    failCount += ko;
    grossGains += gains;
    materialCost += cost;
    missionLoss += extra;

    dailyRows.push({
      day: dayObj.day,
      dateLabel: fmtLong(dayDate(dayObj.day, missionStates)),
      ok,
      ko,
      totalMissions: dayObj.missions.length,
      cost,
      extra,
      gains,
      net: gains - cost - extra,
    });
  });

  const cleanWeaponsLoss = Math.max(0, Math.round(Number(weaponsLossAmount) || 0));
  const netProfit = grossGains - materialCost - missionLoss - cleanWeaponsLoss;

  const isSameWeekPayroll = !currentPayroll?.week || currentPayroll.week === week;
  const payrollCalc = computeSundayPayroll({
    members,
    missionStates,
    scheduleMeta,
    weaponsLossAmount: cleanWeaponsLoss,
    inventoryPrices,
    catalogGroups,
    cartelPercent: isSameWeekPayroll ? currentPayroll?.cartelPercent ?? 70 : 70,
    basis: isSameWeekPayroll ? currentPayroll?.basis ?? 'net_cartel' : 'net_cartel',
    paidMemberIds: isSameWeekPayroll ? currentPayroll?.paidMemberIds ?? [] : [],
  });

  const treasuryLegal = Math.max(0, Math.round(Number(treasuryMoney.legal) || 0));
  const treasuryIllegal = Math.max(0, Math.round(Number(treasuryMoney.illegal) || 0));
  const treasuryTotal = treasuryLegal + treasuryIllegal;
  const rewardsValue = calcRewardsTotalValue(rewardStocks);
  const rewardsCount = REWARD_ITEMS.reduce(
    (sum, item) => sum + Math.max(0, Math.floor(Number(rewardStocks[item.key]?.qty) || 0)),
    0
  );
  const inventoryValue = calcInventoryTotalValue(inventoryStock, inventoryPrices, catalogGroups);
  const weaponsValue = calcWeaponsTotalValue(weaponsStock);
  const weaponsCount = Object.values(weaponsStock).reduce(
    (sum, w) => sum + (w && typeof w === 'object' ? Math.max(0, Math.floor(Number(w.qty) || 0)) : 0),
    0
  );
  const totalWealth = treasuryTotal + rewardsValue + inventoryValue + weaponsValue;
  const activeMembersCount = payrollCalc.rows.filter(
    (r) => r.missionsOk + r.missionsKo > 0
  ).length;
  const completionRate =
    totalMissions > 0
      ? Math.round(((successCount + failCount) / totalMissions) * 1000) / 10
      : 0;

  const leaderboard = computeMemberLeaderboard({
    members,
    missionStates,
    weaponsStock,
    memberRankings,
    inventoryPrices,
    catalogGroups,
  });
  const topLeader = leaderboard[0];
  const mvpName = topLeader && topLeader.totalPoints > 0 ? topLeader.member.name : '—';
  const mvpPoints = topLeader && topLeader.totalPoints > 0 ? topLeader.totalPoints : 0;

  const globalSnapshot: WeeklyArchiveGlobalSnapshot = {
    treasuryLegal,
    treasuryIllegal,
    treasuryTotal,
    rewardsValue,
    rewardsCount,
    inventoryValue,
    weaponsValue,
    weaponsCount,
    totalWealth,
    heistsOk,
    heistsTotal,
    activeMembersCount,
    completionRate,
    mvpName,
    mvpPoints,
  };

  const cleanNotes = typeof notes === 'string' ? notes.trim().slice(0, 500) : '';

  return {
    id: archiveId,
    week,
    label: weekRangeText(missionStates),
    archivedAt: new Date().toISOString().slice(0, 40),
    archivedBy: archivedBy.slice(0, 80),
    ...(cleanNotes ? { notes: cleanNotes } : {}),
    summary: {
      successCount,
      failCount,
      totalMissions,
      grossGains,
      materialCost,
      missionLoss,
      weaponsLossAmount: cleanWeaponsLoss,
      netProfit,
    },
    globalSnapshot,
    dailyRows,
    missions,
    payroll: {
      cartelPercent: payrollCalc.cartelPercent,
      membersPercent: payrollCalc.membersPercent,
      basis: payrollCalc.basis,
      distributableBase: payrollCalc.distributableBase,
      cartelShareAmount: payrollCalc.cartelShareAmount,
      payrollPoolAmount: payrollCalc.payrollPoolAmount,
      unattributedNet: payrollCalc.unattributedNet,
      settled: isSameWeekPayroll ? Boolean(currentPayroll?.settled) : false,
      settledAt: isSameWeekPayroll ? currentPayroll?.settledAt || '' : '',
      settledBy: isSameWeekPayroll ? currentPayroll?.settledBy || '' : '',
      debitAccount: isSameWeekPayroll ? currentPayroll?.debitAccount || 'none' : 'none',
      debitAmount: isSameWeekPayroll ? Math.max(0, Number(currentPayroll?.debitAmount) || 0) : 0,
      rows: payrollCalc.rows,
    },
  };
}

export function buildDiscordPayrollReport(params: {
  weekLabel: string;
  cartelPercent: number;
  membersPercent: number;
  netWeekProfit: number;
  cartelShareAmount: number;
  payrollPoolAmount: number;
  rows: PayrollMemberRow[];
  settled?: boolean;
}): string {
  const {
    weekLabel,
    netWeekProfit,
    cartelShareAmount,
    payrollPoolAmount,
    rows,
    settled,
  } = params;

  let text = '```asciidoc\n';
  text += '= PAYE DU DIMANCHE LOS CERBEROS =\n';
  text += `Semaine ${weekLabel}\n`;
  text += `Base        : Selon les gains nets rapportés\n`;
  if (settled) {
    text += `Statut      : PAYE VALIDÉE\n`;
  }
  text += `\nBénéfice Net Semaine  : ${formatSigned(netWeekProfit)}\n`;
  text += `Part Cartel           : ${formatMoney(Math.max(0, cartelShareAmount))}\n`;
  text += `Enveloppe Paie        : ${formatMoney(payrollPoolAmount)}\n`;
  text += `---------------------------------------------\n`;

  const activeRows = rows.filter((r) => r.payrollAmount > 0 || r.missionsOk + r.missionsKo > 0);
  if (activeRows.length === 0) {
    text += 'Aucune participation enregistrée cette semaine.\n';
  } else {
    activeRows.forEach((r) => {
      const statusMark = r.payrollAmount > 0 ? (r.paid ? '[PAYÉ]' : '[À PAYER]') : '[0 $]';
      text += `- ${r.memberName.padEnd(18, ' ')} ${statusMark} : ${formatMoney(r.payrollAmount)} `;
      text += `(Apport net: ${formatSigned(r.netContribution)} · ${r.missionsOk}✓/${r.missionsKo}✗)\n`;
    });
  }

  text += '```';
  return text;
}

export function buildArchivedWeekDiscordReport(archive: WeeklyArchiveRecord): string {
  const gs = archive.globalSnapshot;
  const doneCount = archive.summary.successCount + archive.summary.failCount;
  const successRate =
    doneCount > 0 ? Math.round((archive.summary.successCount / doneCount) * 100) : 0;

  let text = '```asciidoc\n';
  text += '= ARCHIVE GLOBALE & PAYE LOS CERBEROS =\n';
  text += `Semaine ${archive.label}\n`;
  if (archive.notes) {
    text += `Note    : ${archive.notes}\n`;
  }
  text += '\n';

  if (gs) {
    text += `Patrimoine Global   : ${formatMoney(gs.totalWealth)} (Cash ${formatMoney(gs.treasuryTotal)} | Recel ${formatMoney(gs.rewardsValue)} | Stock ${formatMoney(gs.inventoryValue)} | Arsenal ${formatMoney(gs.weaponsValue)})\n`;
    text += `Gros Coups Réussis  : ${gs.heistsOk} / ${gs.heistsTotal} | Membres actifs : ${gs.activeMembersCount}\n`;
    if (gs.mvpName && gs.mvpName !== '—') {
      text += `MVP de la Semaine   : ${gs.mvpName} (${gs.mvpPoints} pts)\n`;
    }
    text += `---------------------------------------------\n`;
  }

  archive.dailyRows.forEach((d) => {
    text += `[ ${d.day} ] : ${d.ok} réussies / ${d.ko} échouées | Mat.: ${formatMoney(d.cost)} | Pertes: ${formatMoney(d.extra)} | Gains: ${formatMoney(d.gains)} | Net: ${formatSigned(d.net)}\n`;
  });

  if (archive.summary.weaponsLossAmount > 0) {
    text += `\nPertes globales armes : -${formatMoney(archive.summary.weaponsLossAmount)}\n`;
  }
  text += `---------------------------------------------\n`;
  text += `Missions       : ${archive.summary.successCount} réussies / ${archive.summary.failCount} échouées (${successRate}% réussite)\n`;
  text += `Gains bruts    : ${formatMoney(archive.summary.grossGains)}\n`;
  text += `Matériel + Pertes : -${formatMoney(archive.summary.materialCost + archive.summary.missionLoss + archive.summary.weaponsLossAmount)}\n`;
  text += `BÉNÉFICE NET   : ${formatSigned(archive.summary.netProfit)}\n`;
  text += `Part Cartel    : ${formatMoney(Math.max(0, archive.payroll.cartelShareAmount))}\n`;
  text += `Enveloppe Paie : ${formatMoney(archive.payroll.payrollPoolAmount)}\n`;

  const paidRows = archive.payroll.rows.filter((r) => r.payrollAmount > 0);
  if (paidRows.length > 0) {
    text += `\nPayes du Dimanche :\n`;
    paidRows.forEach((r) => {
      text += `- ${r.memberName} : ${formatMoney(r.payrollAmount)} (${r.paid ? 'Payé' : 'En attente'})\n`;
    });
  }

  text += '```';
  return text;
}

export function getArchiveHeistsStats(archive: WeeklyArchiveRecord): {
  heistsOk: number;
  heistsTotal: number;
} {
  if (archive.globalSnapshot) {
    return {
      heistsOk: archive.globalSnapshot.heistsOk,
      heistsTotal: archive.globalSnapshot.heistsTotal,
    };
  }
  const heistsOk = archive.missions.filter((m) => m.major && m.status === 'success').length;
  const heistsTotal = archive.missions.filter((m) => m.major).length;
  return { heistsOk, heistsTotal };
}

export function getArchiveSuccessRate(archive: WeeklyArchiveRecord): number {
  const done = archive.summary.successCount + archive.summary.failCount;
  if (done <= 0) return 0;
  return Math.round((archive.summary.successCount / done) * 1000) / 10;
}

export function getArchiveActiveMembersCount(archive: WeeklyArchiveRecord): number {
  if (archive.globalSnapshot) {
    return archive.globalSnapshot.activeMembersCount;
  }
  return archive.payroll.rows.filter((r) => r.missionsOk + r.missionsKo > 0).length;
}

export function buildLiveWeekAsArchivePreview(params: {
  missionStates: MissionStates;
  scheduleMeta?: MissionScheduleMeta;
  weaponsLossAmount: number;
  members: HierarchyMember[];
  inventoryPrices?: InventoryPrices;
  catalogGroups?: CatalogGroupsMap;
  currentPayroll?: CurrentWeekPayrollState;
  treasuryMoney?: TreasuryMoney;
  rewardStocks?: RewardStocks;
  inventoryStock?: InventoryStock;
  weaponsStock?: WeaponsStock;
  memberRankings?: MemberRankingsMap;
}): WeeklyArchiveRecord {
  const rec = buildArchiveRecordFromWeek({
    archiveId: '__live__',
    archivedBy: 'En direct',
    ...params,
  });
  return {
    ...rec,
    label: `${rec.label} (En cours)`,
  };
}

export interface ArchiveMetricDelta {
  a: number;
  b: number;
  delta: number;
  percentChange: number | null;
}

export interface ArchiveDayComparisonRow {
  day: string;
  okA: number;
  okB: number;
  koA: number;
  koB: number;
  gainsA: number;
  gainsB: number;
  costA: number;
  costB: number;
  netA: number;
  netB: number;
  netDelta: number;
}

export interface ArchiveMemberComparisonRow {
  memberId: string;
  memberName: string;
  missionsOkA: number;
  missionsKoA: number;
  missionsOkB: number;
  missionsKoB: number;
  netA: number;
  netB: number;
  netDelta: number;
  payrollA: number;
  payrollB: number;
  payrollDelta: number;
}

export interface WeeklyArchiveComparison {
  netProfit: ArchiveMetricDelta;
  grossGains: ArchiveMetricDelta;
  materialCost: ArchiveMetricDelta;
  totalLosses: ArchiveMetricDelta;
  successCount: ArchiveMetricDelta;
  failCount: ArchiveMetricDelta;
  successRate: ArchiveMetricDelta;
  heistsOk: ArchiveMetricDelta;
  cartelShare: ArchiveMetricDelta;
  payrollPool: ArchiveMetricDelta;
  activeMembers: ArchiveMetricDelta;
  hasBothSnapshots: boolean;
  totalWealth: ArchiveMetricDelta;
  treasuryTotal: ArchiveMetricDelta;
  dayComparisons: ArchiveDayComparisonRow[];
  memberComparisons: ArchiveMemberComparisonRow[];
}

function makeDelta(a: number, b: number): ArchiveMetricDelta {
  const delta = Math.round((b - a) * 10) / 10;
  let percentChange: number | null = null;
  if (a === 0 && b === 0) {
    percentChange = 0;
  } else if (a !== 0) {
    percentChange = Math.round(((b - a) / Math.abs(a)) * 1000) / 10;
  }
  return { a, b, delta, percentChange };
}

export function compareWeeklyArchives(
  weekA: WeeklyArchiveRecord,
  weekB: WeeklyArchiveRecord
): WeeklyArchiveComparison {
  const totalLossesA =
    weekA.summary.missionLoss + weekA.summary.weaponsLossAmount;
  const totalLossesB =
    weekB.summary.missionLoss + weekB.summary.weaponsLossAmount;

  const heistsA = getArchiveHeistsStats(weekA).heistsOk;
  const heistsB = getArchiveHeistsStats(weekB).heistsOk;
  const rateA = getArchiveSuccessRate(weekA);
  const rateB = getArchiveSuccessRate(weekB);
  const activeA = getArchiveActiveMembersCount(weekA);
  const activeB = getArchiveActiveMembersCount(weekB);

  const hasBothSnapshots = Boolean(weekA.globalSnapshot && weekB.globalSnapshot);
  const wealthA = weekA.globalSnapshot?.totalWealth ?? 0;
  const wealthB = weekB.globalSnapshot?.totalWealth ?? 0;
  const cashA = weekA.globalSnapshot?.treasuryTotal ?? 0;
  const cashB = weekB.globalSnapshot?.treasuryTotal ?? 0;

  const dayMapA = new Map(weekA.dailyRows.map((d) => [d.day, d]));
  const dayMapB = new Map(weekB.dailyRows.map((d) => [d.day, d]));
  const dayComparisons: ArchiveDayComparisonRow[] = DAY_NAMES.map((day) => {
    const dA = dayMapA.get(day);
    const dB = dayMapB.get(day);
    const netA = dA?.net ?? 0;
    const netB = dB?.net ?? 0;
    return {
      day,
      okA: dA?.ok ?? 0,
      okB: dB?.ok ?? 0,
      koA: dA?.ko ?? 0,
      koB: dB?.ko ?? 0,
      gainsA: dA?.gains ?? 0,
      gainsB: dB?.gains ?? 0,
      costA: dA?.cost ?? 0,
      costB: dB?.cost ?? 0,
      netA,
      netB,
      netDelta: netB - netA,
    };
  });

  const memberRowMapA = new Map(weekA.payroll.rows.map((r) => [r.memberId, r]));
  const memberRowMapB = new Map(weekB.payroll.rows.map((r) => [r.memberId, r]));
  const allMemberIds = new Set<string>([
    ...memberRowMapA.keys(),
    ...memberRowMapB.keys(),
  ]);

  const memberComparisons: ArchiveMemberComparisonRow[] = Array.from(allMemberIds)
    .map((memberId) => {
      const rA = memberRowMapA.get(memberId);
      const rB = memberRowMapB.get(memberId);
      const netA = rA?.netContribution ?? 0;
      const netB = rB?.netContribution ?? 0;
      const payrollA = rA?.payrollAmount ?? 0;
      const payrollB = rB?.payrollAmount ?? 0;
      return {
        memberId,
        memberName: rB?.memberName || rA?.memberName || 'Membre',
        missionsOkA: rA?.missionsOk ?? 0,
        missionsKoA: rA?.missionsKo ?? 0,
        missionsOkB: rB?.missionsOk ?? 0,
        missionsKoB: rB?.missionsKo ?? 0,
        netA,
        netB,
        netDelta: netB - netA,
        payrollA,
        payrollB,
        payrollDelta: payrollB - payrollA,
      };
    })
    .filter(
      (row) =>
        row.missionsOkA + row.missionsKoA + row.missionsOkB + row.missionsKoB > 0 ||
        row.payrollA > 0 ||
        row.payrollB > 0 ||
        row.netA !== 0 ||
        row.netB !== 0
    )
    .sort(
      (a, b) =>
        Math.max(Math.abs(b.netB), Math.abs(b.netA), Math.abs(b.netDelta)) -
          Math.max(Math.abs(a.netB), Math.abs(a.netA), Math.abs(a.netDelta)) ||
        a.memberName.localeCompare(b.memberName, 'fr-FR')
    );

  return {
    netProfit: makeDelta(weekA.summary.netProfit, weekB.summary.netProfit),
    grossGains: makeDelta(weekA.summary.grossGains, weekB.summary.grossGains),
    materialCost: makeDelta(weekA.summary.materialCost, weekB.summary.materialCost),
    totalLosses: makeDelta(totalLossesA, totalLossesB),
    successCount: makeDelta(weekA.summary.successCount, weekB.summary.successCount),
    failCount: makeDelta(weekA.summary.failCount, weekB.summary.failCount),
    successRate: makeDelta(rateA, rateB),
    heistsOk: makeDelta(heistsA, heistsB),
    cartelShare: makeDelta(
      weekA.payroll.cartelShareAmount,
      weekB.payroll.cartelShareAmount
    ),
    payrollPool: makeDelta(
      weekA.payroll.payrollPoolAmount,
      weekB.payroll.payrollPoolAmount
    ),
    activeMembers: makeDelta(activeA, activeB),
    hasBothSnapshots,
    totalWealth: makeDelta(wealthA, wealthB),
    treasuryTotal: makeDelta(cashA, cashB),
    dayComparisons,
    memberComparisons,
  };
}

export function buildArchiveComparisonDiscordReport(
  weekA: WeeklyArchiveRecord,
  weekB: WeeklyArchiveRecord,
  comp: WeeklyArchiveComparison
): string {
  const fmtPct = (v: number | null) =>
    v === null ? 'n/a' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;

  let text = '```asciidoc\n';
  text += '= COMPARATIF HEBDOMADAIRE LOS CERBEROS =\n';
  text += `Semaine A (Réf.) : ${weekA.label}\n`;
  text += `Semaine B (Comp.): ${weekB.label}\n`;
  text += `---------------------------------------------\n`;
  text += `Bénéfice Net     : ${formatSigned(comp.netProfit.a)} -> ${formatSigned(comp.netProfit.b)} (Écart ${formatSigned(comp.netProfit.delta)} | ${fmtPct(comp.netProfit.percentChange)})\n`;
  text += `Gains Bruts      : ${formatMoney(comp.grossGains.a)} -> ${formatMoney(comp.grossGains.b)} (Écart ${formatSigned(comp.grossGains.delta)})\n`;
  text += `Matériel Utilisé : ${formatMoney(comp.materialCost.a)} -> ${formatMoney(comp.materialCost.b)} (Écart ${formatSigned(comp.materialCost.delta)})\n`;
  text += `Pertes Totales   : ${formatMoney(comp.totalLosses.a)} -> ${formatMoney(comp.totalLosses.b)} (Écart ${formatSigned(comp.totalLosses.delta)})\n`;
  text += `Missions OK/KO   : ${comp.successCount.a}/${comp.failCount.a} -> ${comp.successCount.b}/${comp.failCount.b} (Taux ${comp.successRate.a.toFixed(1)}% -> ${comp.successRate.b.toFixed(1)}%)\n`;
  text += `Gros Coups OK    : ${comp.heistsOk.a} -> ${comp.heistsOk.b}\n`;
  text += `Part Cartel      : ${formatSigned(comp.cartelShare.a)} -> ${formatSigned(comp.cartelShare.b)}\n`;
  text += `Enveloppe Paie   : ${formatMoney(comp.payrollPool.a)} -> ${formatMoney(comp.payrollPool.b)}\n`;
  if (comp.hasBothSnapshots) {
    text += `Patrimoine Global: ${formatMoney(comp.totalWealth.a)} -> ${formatMoney(comp.totalWealth.b)} (Écart ${formatSigned(comp.totalWealth.delta)})\n`;
  }
  text += '```';
  return text;
}

function escapeCsvCell(value: string | number): string {
  const s = String(value);
  if (s.includes(';') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildArchiveCsvContent(archives: WeeklyArchiveRecord[]): string {
  const header = [
    'Semaine',
    'Libelle',
    'ArchiveLe',
    'ArchivePar',
    'MissionsReussies',
    'MissionsEchouees',
    'TauxReussitePct',
    'GrosCoupsOK',
    'GainsBruts',
    'Materiel',
    'PertesMissions',
    'PertesArmes',
    'BeneficeNet',
    'PartCartel',
    'EnveloppePaie',
    'PayeValidee',
    'PatrimoineSnapshot',
    'CashSnapshot',
    'MVP',
    'Note',
  ];

  const rows = archives.map((a) => {
    const heists = getArchiveHeistsStats(a);
    const rate = getArchiveSuccessRate(a);
    return [
      a.week,
      a.label,
      a.archivedAt,
      a.archivedBy,
      a.summary.successCount,
      a.summary.failCount,
      rate.toFixed(1),
      heists.heistsOk,
      a.summary.grossGains,
      a.summary.materialCost,
      a.summary.missionLoss,
      a.summary.weaponsLossAmount,
      a.summary.netProfit,
      a.payroll.cartelShareAmount,
      a.payroll.payrollPoolAmount,
      a.payroll.settled ? 'Oui' : 'Non',
      a.globalSnapshot ? a.globalSnapshot.totalWealth : '',
      a.globalSnapshot ? a.globalSnapshot.treasuryTotal : '',
      a.globalSnapshot?.mvpName || '',
      a.notes || '',
    ].map(escapeCsvCell);
  });

  return '\uFEFF' + [header.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
}

export function buildComparisonCsvContent(
  weekA: WeeklyArchiveRecord,
  weekB: WeeklyArchiveRecord,
  comp: WeeklyArchiveComparison
): string {
  const header = ['Indicateur', weekA.label, weekB.label, 'Ecart_B_moins_A', 'Variation_Pct'];
  const lines: Array<Array<string | number>> = [
    ['Benefice Net', comp.netProfit.a, comp.netProfit.b, comp.netProfit.delta, comp.netProfit.percentChange ?? ''],
    ['Gains Bruts', comp.grossGains.a, comp.grossGains.b, comp.grossGains.delta, comp.grossGains.percentChange ?? ''],
    ['Materiel Utilise', comp.materialCost.a, comp.materialCost.b, comp.materialCost.delta, comp.materialCost.percentChange ?? ''],
    ['Pertes Totales', comp.totalLosses.a, comp.totalLosses.b, comp.totalLosses.delta, comp.totalLosses.percentChange ?? ''],
    ['Missions Reussies', comp.successCount.a, comp.successCount.b, comp.successCount.delta, comp.successCount.percentChange ?? ''],
    ['Missions Echouees', comp.failCount.a, comp.failCount.b, comp.failCount.delta, comp.failCount.percentChange ?? ''],
    ['Taux de Reussite (%)', comp.successRate.a, comp.successRate.b, comp.successRate.delta, comp.successRate.percentChange ?? ''],
    ['Gros Coups Reussis', comp.heistsOk.a, comp.heistsOk.b, comp.heistsOk.delta, comp.heistsOk.percentChange ?? ''],
    ['Part Cartel', comp.cartelShare.a, comp.cartelShare.b, comp.cartelShare.delta, comp.cartelShare.percentChange ?? ''],
    ['Enveloppe Paie', comp.payrollPool.a, comp.payrollPool.b, comp.payrollPool.delta, comp.payrollPool.percentChange ?? ''],
  ];
  if (comp.hasBothSnapshots) {
    lines.push(['Patrimoine Global', comp.totalWealth.a, comp.totalWealth.b, comp.totalWealth.delta, comp.totalWealth.percentChange ?? '']);
    lines.push(['Tresorerie Cash', comp.treasuryTotal.a, comp.treasuryTotal.b, comp.treasuryTotal.delta, comp.treasuryTotal.percentChange ?? '']);
  }

  return (
    '\uFEFF' +
    [header.join(';'), ...lines.map((row) => row.map(escapeCsvCell).join(';'))].join('\n')
  );
}
