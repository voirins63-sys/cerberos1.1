import type { User } from 'firebase/auth';
import {
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  DAY_NAMES,
  DEFAULT_CATALOG_GROUPS,
  DEFAULT_SECRET_CODE,
  DISTINCTION_DEFS,
  HIER_DEFAULTS,
  INVENTORY_ITEMS,
} from '@/src/data/cartelData';
import {
  ADMIN_EMAILS,
  CARTEL_ID,
  db,
  handleFirestoreError,
  OperationType,
} from '@/src/firebase';
import type {
  AlbumPhotoCategory,
  AlbumPhotoRecord,
  AlbumState,
  CatalogContact,
  CatalogGroup,
  CatalogGroupColor,
  CatalogGroupsMap,
  CatalogItem,
  CatalogItemCategory,
  CatalogTradeType,
  CurrentWeekPayrollState,
  DiscordGazetteConfig,
  DistinctionKey,
  GearKey,
  HierarchyMember,
  HierarchyUnitKey,
  HistoryState,
  InventoryPrices,
  InventoryStock,
  LostWeaponRecord,
  MemberRankingAdjustment,
  MemberRankingsMap,
  MissionScheduleMeta,
  MissionStateEntry,
  MissionStates,
  PayrollBasis,
  PayrollMemberRow,
  RewardStockEntry,
  RewardStocks,
  TreasuryMoney,
  WeaponEntry,
  WeaponsStock,
  WeeklyArchiveDayRow,
  WeeklyArchiveGlobalSnapshot,
  WeeklyArchiveMissionRow,
  WeeklyArchivePayrollSnapshot,
  WeeklyArchiveRecord,
} from '@/src/types/cartel';
import { currentWeekStart, isoDate } from '@/src/utils/finance';

export type MemberRole = 'viewer' | 'editor';

export interface LocalSeedData {
  missionStates: MissionStates;
  inventoryStock: InventoryStock;
  treasuryMoney: TreasuryMoney;
  rewardStocks: RewardStocks;
  weaponsLossAmount: number;
  secretCode: string;
  hierMembers: HierarchyMember[];
}

export interface SyncedCartelData {
  missionStates: MissionStates;
  inventoryStock: InventoryStock;
  treasuryMoney: TreasuryMoney;
  rewardStocks: RewardStocks;
  weaponsLossAmount: number;
  hierMembers: HierarchyMember[];
  memberRole: MemberRole;
}

export function isAdminUser(user: User | null): boolean {
  const email = user?.email?.toLowerCase();
  return (
    !!user &&
    user.emailVerified === true &&
    !!email &&
    ADMIN_EMAILS.some((adminEmail) => adminEmail.toLowerCase() === email)
  );
}

function sanitizeDisplayName(raw: string): string {
  const cleaned = raw.trim().slice(0, 80);
  return cleaned || 'Membre Cartel';
}

function sanitizeMissionEntry(value: MissionStateEntry): MissionStateEntry {
  const cleanLoot: Record<string, number> = {};
  if (value.loot && typeof value.loot === 'object') {
    Object.entries(value.loot)
      .slice(0, 30)
      .forEach(([k, q]) => {
        const qty = Math.max(0, Math.floor(Number(q) || 0));
        if (k && qty > 0) cleanLoot[k.slice(0, 64)] = qty;
      });
  }

  const cleanUsedGear: Record<string, number> = {};
  if (value.usedGear && typeof value.usedGear === 'object') {
    Object.entries(value.usedGear)
      .slice(0, 20)
      .forEach(([k, q]) => {
        const qty = Math.max(0, Math.floor(Number(q) || 0));
        if (k && qty > 0) cleanUsedGear[k.slice(0, 64)] = qty;
      });
  }

  const cleanLostWeapons: LostWeaponRecord[] = Array.isArray(value.lostWeapons)
    ? value.lostWeapons
        .filter((w): w is LostWeaponRecord => !!w && typeof w === 'object' && typeof w.name === 'string')
        .slice(0, 20)
        .map((w) => ({
          id: String(w.id || '').slice(0, 64),
          name: String(w.name).trim().slice(0, 80),
          value: Math.max(0, Number(w.value) || 0),
          holderId: String(w.holderId || 'coffre').slice(0, 80),
          holderName: String(w.holderName || 'Coffre Cartel').slice(0, 80),
        }))
    : [];

  return {
    status: value.status || '',
    completed: Boolean(value.completed),
    gain: Math.max(0, Number(value.gain) || 0),
    cashGain: Math.max(0, Number(value.cashGain) || 0),
    extra: Math.max(0, Number(value.extra) || 0),
    players: Array.isArray(value.players)
      ? value.players.filter((p): p is string => typeof p === 'string').slice(0, 30)
      : [],
    gearConsumed: Boolean(value.gearConsumed) || Object.keys(cleanUsedGear).length > 0,
    usedGear: cleanUsedGear,
    loot: cleanLoot,
    lostWeapons: cleanLostWeapons,
    cashLossDebitAccount:
      value.cashLossDebitAccount === 'legal' || value.cashLossDebitAccount === 'illegal'
        ? value.cashLossDebitAccount
        : 'none',
    cashLossDebitAmount: Math.max(0, Math.round(Number(value.cashLossDebitAmount) || 0)),
  };
}

function splitMissionStates(ms: MissionStates): {
  week: string;
  entries: Record<string, MissionStateEntry>;
} {
  const week =
    typeof ms.__week === 'string' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(ms.__week)
      ? ms.__week
      : isoDate(currentWeekStart());
  const entries: Record<string, MissionStateEntry> = {};
  Object.entries(ms).forEach(([key, value]) => {
    if (key === '__week' || !value || typeof value !== 'object') return;
    entries[key] = sanitizeMissionEntry(value);
  });
  return { week, entries };
}

function membersArrayToMap(
  list: HierarchyMember[]
): Record<string, HierarchyMember> {
  const map: Record<string, HierarchyMember> = {};
  list.slice(0, 100).forEach((m) => {
    if (!m || !m.id) return;
    map[m.id] = {
      id: m.id,
      name: m.name.trim().slice(0, 80),
      unit: m.unit,
      order: Number(m.order) || 0,
      dossier: (m.dossier || '').trim().slice(0, 500),
    };
  });
  return map;
}

function membersMapToArray(
  raw: unknown
): HierarchyMember[] {
  if (!raw || typeof raw !== 'object') return HIER_DEFAULTS;
  const list = Object.values(raw as Record<string, HierarchyMember>).filter(
    (m) => m && typeof m === 'object' && typeof m.id === 'string' && typeof m.name === 'string'
  );
  return list.length > 0 ? list : HIER_DEFAULTS;
}

function sanitizeWeaponsMap(raw: unknown): WeaponsStock {
  if (!raw || typeof raw !== 'object') return {};
  const clean: WeaponsStock = {};
  Object.entries(raw as Record<string, WeaponEntry>)
    .slice(0, 150)
    .forEach(([key, entry]) => {
      if (!entry || typeof entry !== 'object') return;
      const id = (typeof entry.id === 'string' ? entry.id : key)
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .slice(0, 64);
      const name = typeof entry.name === 'string' ? entry.name.trim().slice(0, 80) : '';
      if (!id || !name) return;
      clean[id] = {
        id,
        name,
        value: Math.max(0, Number(entry.value) || 0),
        qty: Math.max(1, Math.floor(Number(entry.qty) || 1)),
        holderId:
          typeof entry.holderId === 'string' && entry.holderId.trim()
            ? entry.holderId.trim().slice(0, 80)
            : 'coffre',
        notes: typeof entry.notes === 'string' ? entry.notes.trim().slice(0, 160) : '',
      };
    });
  return clean;
}

function sanitizeScheduleMeta(
  rawOverrides: unknown,
  rawUnplaced: unknown,
  rawLastDate: unknown,
  rawLastAt: unknown
): MissionScheduleMeta {
  const validDays = new Set(DAY_NAMES);
  const scheduleOverrides: Record<string, string> = {};
  if (rawOverrides && typeof rawOverrides === 'object') {
    Object.entries(rawOverrides as Record<string, unknown>)
      .slice(0, 120)
      .forEach(([k, v]) => {
        const cleanKey = k.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
        if (cleanKey && typeof v === 'string' && validDays.has(v)) {
          scheduleOverrides[cleanKey] = v;
        }
      });
  }

  const unplacedMissionIds: string[] = Array.isArray(rawUnplaced)
    ? rawUnplaced
        .filter((id): id is string => typeof id === 'string')
        .map((id) => id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64))
        .filter(Boolean)
        .slice(0, 120)
    : [];

  const lastRecalcDate =
    typeof rawLastDate === 'string' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(rawLastDate)
      ? rawLastDate.slice(0, 20)
      : '';
  const lastRecalcAt = typeof rawLastAt === 'string' ? rawLastAt.slice(0, 40) : '';

  return {
    scheduleOverrides,
    unplacedMissionIds,
    lastRecalcDate,
    lastRecalcAt,
  };
}

function sanitizeInventoryPrices(raw: unknown): InventoryPrices {
  if (!raw || typeof raw !== 'object') return {};
  const clean: InventoryPrices = {};
  Object.entries(raw as Record<string, unknown>)
    .slice(0, 100)
    .forEach(([k, val]) => {
      const key = k.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
      if (!key) return;
      const num = Number(val);
      if (Number.isFinite(num) && num >= 0) {
        clean[key] = Math.round(num);
      }
    });
  return clean;
}

function sanitizeMemberRankings(raw: unknown): MemberRankingsMap {
  if (!raw || typeof raw !== 'object') return {};
  const validBadges = new Set(DISTINCTION_DEFS.map((d) => d.key));
  const clean: MemberRankingsMap = {};
  Object.entries(raw as Record<string, MemberRankingAdjustment>)
    .slice(0, 100)
    .forEach(([memberId, adj]) => {
      const id = memberId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
      if (!id || !adj || typeof adj !== 'object') return;
      const bonusPoints = Math.trunc(Number(adj.bonusPoints) || 0);
      const note = typeof adj.note === 'string' ? adj.note.trim().slice(0, 160) : '';
      const manualBadges = Array.isArray(adj.manualBadges)
        ? adj.manualBadges.filter((b): b is DistinctionKey => validBadges.has(b)).slice(0, 6)
        : [];
      if (bonusPoints !== 0 || note.length > 0 || manualBadges.length > 0) {
        clean[id] = { bonusPoints, note, manualBadges };
      }
    });
  return clean;
}

const VALID_CATALOG_COLORS = new Set<CatalogGroupColor>([
  'blue',
  'gold',
  'crimson',
  'emerald',
  'purple',
]);
const VALID_CATALOG_CATEGORIES = new Set<CatalogItemCategory>([
  'munitions',
  'accessoires',
  'gilets',
  'armes',
  'reparation',
  'materiel',
  'butin',
  'autre',
]);
const VALID_GEAR_KEYS = new Set<string>(INVENTORY_ITEMS.map((i) => i.key));

export function sanitizeCatalogGroups(raw: unknown): CatalogGroupsMap {
  if (!raw || typeof raw !== 'object') return {};
  const clean: CatalogGroupsMap = {};

  Object.entries(raw as Record<string, CatalogGroup>)
    .slice(0, 40)
    .forEach(([key, group]) => {
      if (!group || typeof group !== 'object') return;
      const id = (typeof group.id === 'string' ? group.id : key)
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .slice(0, 64);
      const name = typeof group.name === 'string' ? group.name.trim().slice(0, 80) : '';
      if (!id || !name) return;

      const specialty =
        typeof group.specialty === 'string' ? group.specialty.trim().slice(0, 120) : '';
      const color: CatalogGroupColor = VALID_CATALOG_COLORS.has(group.color)
        ? group.color
        : 'gold';
      const notes = typeof group.notes === 'string' ? group.notes.trim().slice(0, 300) : '';

      const contacts: CatalogContact[] = Array.isArray(group.contacts)
        ? group.contacts
            .filter((c): c is CatalogContact => !!c && typeof c === 'object')
            .slice(0, 20)
            .map((c, idx) => ({
              id:
                typeof c.id === 'string' && c.id.trim()
                  ? c.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
                  : `c_${idx + 1}`,
              name: typeof c.name === 'string' ? c.name.trim().slice(0, 80) : '',
              role: typeof c.role === 'string' ? c.role.trim().slice(0, 60) : '',
              phone: typeof c.phone === 'string' ? c.phone.trim().slice(0, 40) : '',
              notes: typeof c.notes === 'string' ? c.notes.trim().slice(0, 160) : '',
            }))
            .filter((c) => c.name.length > 0 || c.phone.length > 0)
        : [];

      const items: CatalogItem[] = Array.isArray(group.items)
        ? group.items
            .filter((it): it is CatalogItem => !!it && typeof it === 'object')
            .slice(0, 100)
            .map((it, idx) => {
              const itemName =
                typeof it.name === 'string' ? it.name.trim().slice(0, 80) : '';
              const tradeType: CatalogTradeType =
                it.tradeType === 'buyback' ? 'buyback' : 'sell';
              const category: CatalogItemCategory = VALID_CATALOG_CATEGORIES.has(it.category)
                ? it.category
                : 'autre';
              const rawGear = typeof it.linkedGearKey === 'string' ? it.linkedGearKey.trim() : '';
              const linkedGearKey: GearKey | '' = VALID_GEAR_KEYS.has(rawGear)
                ? (rawGear as GearKey)
                : '';
              return {
                id:
                  typeof it.id === 'string' && it.id.trim()
                    ? it.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
                    : `it_${idx + 1}`,
                name: itemName,
                tradeType,
                category,
                price: Math.max(0, Math.round(Number(it.price) || 0)),
                linkedGearKey,
                notes: typeof it.notes === 'string' ? it.notes.trim().slice(0, 160) : '',
              };
            })
            .filter((it) => it.name.length > 0)
        : [];

      clean[id] = {
        id,
        name,
        specialty,
        color,
        notes,
        contacts,
        items,
      };
    });

  return clean;
}

export const DEFAULT_ALBUM_STATE: AlbumState = {
  photos: {},
  favorites: [],
};

const VALID_ALBUM_CATEGORIES = new Set<AlbumPhotoCategory>([
  'heists',
  'police',
  'hq',
  'identity',
  'members',
]);

export function sanitizeAlbumState(raw: unknown): AlbumState {
  if (!raw || typeof raw !== 'object') {
    return { photos: {}, favorites: [] };
  }
  const obj = raw as { photos?: unknown; favorites?: unknown };
  const photos: Record<string, AlbumPhotoRecord> = {};

  if (obj.photos && typeof obj.photos === 'object') {
    Object.entries(obj.photos as Record<string, AlbumPhotoRecord>)
      .slice(0, 100)
      .forEach(([key, entry]) => {
        if (!entry || typeof entry !== 'object') return;
        const rawId = typeof entry.id === 'string' && entry.id.trim() ? entry.id : key;
        const id = rawId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
        const title =
          typeof entry.title === 'string' ? entry.title.trim().slice(0, 90) : '';
        if (!id || !title) return;

        const category: AlbumPhotoCategory = VALID_ALBUM_CATEGORIES.has(entry.category)
          ? entry.category
          : 'members';
        const caption =
          typeof entry.caption === 'string' ? entry.caption.trim().slice(0, 260) : '';
        const location =
          typeof entry.location === 'string' ? entry.location.trim().slice(0, 80) : '';
        const dateLabel =
          typeof entry.dateLabel === 'string' ? entry.dateLabel.trim().slice(0, 40) : '';
        const authorName =
          typeof entry.authorName === 'string'
            ? entry.authorName.trim().slice(0, 60)
            : 'Los Cerberos';
        const createdAtIso =
          typeof entry.createdAtIso === 'string' && entry.createdAtIso.trim()
            ? entry.createdAtIso.trim().slice(0, 40)
            : new Date().toISOString();

        const record: AlbumPhotoRecord = {
          id,
          title,
          category,
          caption,
          location,
          dateLabel,
          authorName,
          createdAtIso,
        };

        if (typeof entry.mediaId === 'string' && entry.mediaId.trim()) {
          record.mediaId = entry.mediaId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
        }
        if (typeof entry.externalUrl === 'string' && entry.externalUrl.trim()) {
          record.externalUrl = entry.externalUrl.trim().slice(0, 500);
        }

        if (record.mediaId || record.externalUrl) {
          photos[id] = record;
        }
      });
  }

  const favorites = Array.isArray(obj.favorites)
    ? Array.from(
        new Set(
          obj.favorites
            .filter((f): f is string => typeof f === 'string')
            .map((f) => f.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64))
            .filter(Boolean)
        )
      ).slice(0, 150)
    : [];

  return { photos, favorites };
}

const VALID_HIERARCHY_UNITS = new Set<HierarchyUnitKey>([
  'mando',
  'ojos',
  'bocas',
  'brazos',
  'cerebros',
  'cerberos',
]);

export function createDefaultCurrentPayroll(week?: string): CurrentWeekPayrollState {
  const validWeek =
    typeof week === 'string' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(week)
      ? week
      : isoDate(currentWeekStart());
  return {
    week: validWeek,
    cartelPercent: 70,
    membersPercent: 30,
    basis: 'net_cartel',
    paidMemberIds: [],
    settled: false,
    settledAt: '',
    settledBy: '',
    settledAmount: 0,
    debitAccount: 'none',
    debitAmount: 0,
  };
}

export const DEFAULT_HISTORY_STATE: HistoryState = {
  archives: {},
  currentPayroll: createDefaultCurrentPayroll(),
};

function sanitizeCurrentPayroll(raw: unknown): CurrentWeekPayrollState {
  const fallback = createDefaultCurrentPayroll();
  if (!raw || typeof raw !== 'object') return fallback;
  const obj = raw as Record<string, unknown>;
  const week =
    typeof obj.week === 'string' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(obj.week)
      ? obj.week
      : fallback.week;
  const rawCartel = Number(obj.cartelPercent);
  const cartelPercent = Number.isFinite(rawCartel)
    ? Math.max(0, Math.min(100, Math.round(rawCartel)))
    : 70;
  const membersPercent = 100 - cartelPercent;
  const basis: PayrollBasis = obj.basis === 'net_member' ? 'net_member' : 'net_cartel';
  const paidMemberIds = Array.isArray(obj.paidMemberIds)
    ? Array.from(
        new Set(
          obj.paidMemberIds
            .filter((id): id is string => typeof id === 'string')
            .map((id) => id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64))
            .filter(Boolean)
        )
      ).slice(0, 100)
    : [];
  const debitAccount =
    obj.debitAccount === 'legal' || obj.debitAccount === 'illegal' ? obj.debitAccount : 'none';

  return {
    week,
    cartelPercent,
    membersPercent,
    basis,
    paidMemberIds,
    settled: Boolean(obj.settled),
    settledAt: typeof obj.settledAt === 'string' ? obj.settledAt.slice(0, 40) : '',
    settledBy: typeof obj.settledBy === 'string' ? obj.settledBy.slice(0, 80) : '',
    settledAmount: Math.max(0, Math.round(Number(obj.settledAmount) || 0)),
    debitAccount,
    debitAmount:
      debitAccount !== 'none' ? Math.max(0, Math.round(Number(obj.debitAmount) || 0)) : 0,
  };
}

function sanitizePayrollMemberRows(raw: unknown): PayrollMemberRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === 'object'))
    .slice(0, 100)
    .map((r) => {
      const memberId =
        typeof r.memberId === 'string'
          ? r.memberId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
          : '';
      const unit: HierarchyUnitKey =
        typeof r.unit === 'string' && VALID_HIERARCHY_UNITS.has(r.unit as HierarchyUnitKey)
          ? (r.unit as HierarchyUnitKey)
          : 'cerberos';
      return {
        memberId: memberId || 'unknown',
        memberName:
          typeof r.memberName === 'string' && r.memberName.trim()
            ? r.memberName.trim().slice(0, 80)
            : 'Membre',
        unit,
        missionsOk: Math.max(0, Math.floor(Number(r.missionsOk) || 0)),
        missionsKo: Math.max(0, Math.floor(Number(r.missionsKo) || 0)),
        heistsOk: Math.max(0, Math.floor(Number(r.heistsOk) || 0)),
        grossRevenue: Math.max(0, Math.round(Number(r.grossRevenue) || 0)),
        materialCostShare: Math.max(0, Math.round(Number(r.materialCostShare) || 0)),
        lossShare: Math.max(0, Math.round(Number(r.lossShare) || 0)),
        netContribution: Math.round(Number(r.netContribution) || 0),
        sharePercent: Math.max(0, Math.min(100, Number(r.sharePercent) || 0)),
        payrollAmount: Math.max(0, Math.round(Number(r.payrollAmount) || 0)),
        paid: Boolean(r.paid),
      };
    });
}

export function sanitizeHistoryState(raw: unknown): HistoryState {
  if (!raw || typeof raw !== 'object') {
    return {
      archives: {},
      currentPayroll: createDefaultCurrentPayroll(),
    };
  }
  const obj = raw as { archives?: unknown; currentPayroll?: unknown };
  const archives: Record<string, WeeklyArchiveRecord> = {};

  if (obj.archives && typeof obj.archives === 'object') {
    Object.entries(obj.archives as Record<string, unknown>)
      .slice(0, 60)
      .forEach(([key, rawRecord]) => {
        if (!rawRecord || typeof rawRecord !== 'object') return;
        const rec = rawRecord as Record<string, unknown>;
        const rawId = typeof rec.id === 'string' && rec.id.trim() ? rec.id : key;
        const id = rawId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
        const week =
          typeof rec.week === 'string' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(rec.week)
            ? rec.week
            : '';
        if (!id || !week) return;

        const sumObj =
          rec.summary && typeof rec.summary === 'object'
            ? (rec.summary as Record<string, unknown>)
            : {};

        const dailyRows: WeeklyArchiveDayRow[] = Array.isArray(rec.dailyRows)
          ? rec.dailyRows
              .filter((d): d is Record<string, unknown> => Boolean(d && typeof d === 'object'))
              .slice(0, 14)
              .map((d) => ({
                day: typeof d.day === 'string' ? d.day.slice(0, 20) : '',
                dateLabel: typeof d.dateLabel === 'string' ? d.dateLabel.slice(0, 40) : '',
                ok: Math.max(0, Math.floor(Number(d.ok) || 0)),
                ko: Math.max(0, Math.floor(Number(d.ko) || 0)),
                totalMissions: Math.max(0, Math.floor(Number(d.totalMissions) || 0)),
                cost: Math.max(0, Math.round(Number(d.cost) || 0)),
                extra: Math.max(0, Math.round(Number(d.extra) || 0)),
                gains: Math.max(0, Math.round(Number(d.gains) || 0)),
                net: Math.round(Number(d.net) || 0),
              }))
          : [];

        const missions: WeeklyArchiveMissionRow[] = Array.isArray(rec.missions)
          ? rec.missions
              .filter((m): m is Record<string, unknown> => Boolean(m && typeof m === 'object'))
              .slice(0, 60)
              .map((m) => ({
                id: typeof m.id === 'string' ? m.id.slice(0, 64) : '',
                name: typeof m.name === 'string' ? m.name.slice(0, 80) : '',
                day: typeof m.day === 'string' ? m.day.slice(0, 20) : '',
                major: Boolean(m.major),
                status: m.status === 'fail' ? 'fail' : 'success',
                gain: Math.max(0, Math.round(Number(m.gain) || 0)),
                cost: Math.max(0, Math.round(Number(m.cost) || 0)),
                extra: Math.max(0, Math.round(Number(m.extra) || 0)),
                net: Math.round(Number(m.net) || 0),
                players: Array.isArray(m.players)
                  ? m.players
                      .filter((p): p is string => typeof p === 'string')
                      .map((p) => p.slice(0, 80))
                      .slice(0, 20)
                  : [],
              }))
          : [];

        const rawPay =
          rec.payroll && typeof rec.payroll === 'object'
            ? (rec.payroll as Record<string, unknown>)
            : {};
        const rawCartelPct = Number(rawPay.cartelPercent);
        const cartelPercent = Number.isFinite(rawCartelPct)
          ? Math.max(0, Math.min(100, Math.round(rawCartelPct)))
          : 70;
        const membersPercent = 100 - cartelPercent;
        const debitAccount =
          rawPay.debitAccount === 'legal' || rawPay.debitAccount === 'illegal'
            ? rawPay.debitAccount
            : 'none';

        const payroll: WeeklyArchivePayrollSnapshot = {
          cartelPercent,
          membersPercent,
          basis: rawPay.basis === 'net_member' ? 'net_member' : 'net_cartel',
          distributableBase: Math.max(0, Math.round(Number(rawPay.distributableBase) || 0)),
          cartelShareAmount: Math.round(Number(rawPay.cartelShareAmount) || 0),
          payrollPoolAmount: Math.max(0, Math.round(Number(rawPay.payrollPoolAmount) || 0)),
          unattributedNet: Math.round(Number(rawPay.unattributedNet) || 0),
          settled: Boolean(rawPay.settled),
          settledAt: typeof rawPay.settledAt === 'string' ? rawPay.settledAt.slice(0, 40) : '',
          settledBy: typeof rawPay.settledBy === 'string' ? rawPay.settledBy.slice(0, 80) : '',
          debitAccount,
          debitAmount:
            debitAccount !== 'none'
              ? Math.max(0, Math.round(Number(rawPay.debitAmount) || 0))
              : 0,
          rows: sanitizePayrollMemberRows(rawPay.rows),
        };

        const cleanNotes =
          typeof rec.notes === 'string' ? rec.notes.trim().slice(0, 500) : '';

        let globalSnapshot: WeeklyArchiveGlobalSnapshot | undefined;
        if (rec.globalSnapshot && typeof rec.globalSnapshot === 'object') {
          const gs = rec.globalSnapshot as Record<string, unknown>;
          const treasuryLegal = Math.max(0, Math.round(Number(gs.treasuryLegal) || 0));
          const treasuryIllegal = Math.max(0, Math.round(Number(gs.treasuryIllegal) || 0));
          const treasuryTotal = Math.max(
            0,
            Math.round(Number(gs.treasuryTotal) || treasuryLegal + treasuryIllegal)
          );
          const rewardsValue = Math.max(0, Math.round(Number(gs.rewardsValue) || 0));
          const rewardsCount = Math.max(0, Math.floor(Number(gs.rewardsCount) || 0));
          const inventoryValue = Math.max(0, Math.round(Number(gs.inventoryValue) || 0));
          const weaponsValue = Math.max(0, Math.round(Number(gs.weaponsValue) || 0));
          const weaponsCount = Math.max(0, Math.floor(Number(gs.weaponsCount) || 0));
          const totalWealth = Math.max(
            0,
            Math.round(
              Number(gs.totalWealth) ||
                treasuryTotal + rewardsValue + inventoryValue + weaponsValue
            )
          );
          globalSnapshot = {
            treasuryLegal,
            treasuryIllegal,
            treasuryTotal,
            rewardsValue,
            rewardsCount,
            inventoryValue,
            weaponsValue,
            weaponsCount,
            totalWealth,
            heistsOk: Math.max(0, Math.floor(Number(gs.heistsOk) || 0)),
            heistsTotal: Math.max(0, Math.floor(Number(gs.heistsTotal) || 0)),
            activeMembersCount: Math.max(0, Math.floor(Number(gs.activeMembersCount) || 0)),
            completionRate: Math.max(
              0,
              Math.min(100, Math.round((Number(gs.completionRate) || 0) * 10) / 10)
            ),
            mvpName:
              typeof gs.mvpName === 'string' && gs.mvpName.trim()
                ? gs.mvpName.trim().slice(0, 80)
                : '—',
            mvpPoints: Math.max(0, Math.floor(Number(gs.mvpPoints) || 0)),
          };
        }

        archives[id] = {
          id,
          week,
          label: typeof rec.label === 'string' ? rec.label.slice(0, 80) : week,
          archivedAt:
            typeof rec.archivedAt === 'string'
              ? rec.archivedAt.slice(0, 40)
              : new Date().toISOString().slice(0, 40),
          archivedBy: typeof rec.archivedBy === 'string' ? rec.archivedBy.slice(0, 80) : '',
          ...(cleanNotes ? { notes: cleanNotes } : {}),
          summary: {
            successCount: Math.max(0, Math.floor(Number(sumObj.successCount) || 0)),
            failCount: Math.max(0, Math.floor(Number(sumObj.failCount) || 0)),
            totalMissions: Math.max(0, Math.floor(Number(sumObj.totalMissions) || 0)),
            grossGains: Math.max(0, Math.round(Number(sumObj.grossGains) || 0)),
            materialCost: Math.max(0, Math.round(Number(sumObj.materialCost) || 0)),
            missionLoss: Math.max(0, Math.round(Number(sumObj.missionLoss) || 0)),
            weaponsLossAmount: Math.max(0, Math.round(Number(sumObj.weaponsLossAmount) || 0)),
            netProfit: Math.round(Number(sumObj.netProfit) || 0),
          },
          ...(globalSnapshot ? { globalSnapshot } : {}),
          dailyRows,
          missions,
          payroll,
        };
      });
  }

  return {
    archives,
    currentPayroll: sanitizeCurrentPayroll(obj.currentPayroll),
  };
}

export async function bootstrapAndJoinCartel(
  user: User,
  seed: LocalSeedData
): Promise<'ready' | 'uninitialized'> {
  const cartelPath = `cartels/${CARTEL_ID}`;
  const cartelRef = doc(db, 'cartels', CARTEL_ID);
  const authConfigPath = `cartels/${CARTEL_ID}/private/auth`;
  const authConfigRef = doc(db, 'cartels', CARTEL_ID, 'private', 'auth');
  const memberPath = `cartels/${CARTEL_ID}/members/${user.uid}`;
  const memberRef = doc(db, 'cartels', CARTEL_ID, 'members', user.uid);
  const admin = isAdminUser(user);

  if (admin) {
    let cartelSnap;
    try {
      cartelSnap = await getDoc(cartelRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, cartelPath);
    }
    if (!cartelSnap.exists()) {
      try {
        await setDoc(cartelRef, {
          name: 'LOS CERBEROS',
          ownerUid: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, cartelPath);
      }
    }

    let authSnap;
    try {
      authSnap = await getDoc(authConfigRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, authConfigPath);
    }
    if (!authSnap.exists()) {
      const code = (seed.secretCode || DEFAULT_SECRET_CODE).trim().slice(0, 64);
      try {
        await setDoc(authConfigRef, {
          secretCode: code.length >= 4 ? code : DEFAULT_SECRET_CODE,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, authConfigPath);
      }
    }

    const missionsRef = doc(db, 'cartels', CARTEL_ID, 'state', 'missions');
    let missionsSnap;
    try {
      missionsSnap = await getDoc(missionsRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `cartels/${CARTEL_ID}/state/missions`);
    }
    if (!missionsSnap.exists()) {
      const { week, entries } = splitMissionStates(seed.missionStates);
      try {
        await setDoc(missionsRef, {
          week,
          entries,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `cartels/${CARTEL_ID}/state/missions`);
      }
    }

    const inventoryRef = doc(db, 'cartels', CARTEL_ID, 'state', 'inventory');
    let inventorySnap;
    try {
      inventorySnap = await getDoc(inventoryRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `cartels/${CARTEL_ID}/state/inventory`);
    }
    if (!inventorySnap.exists()) {
      try {
        await setDoc(inventoryRef, {
          stock: seed.inventoryStock || {},
          weapons: {},
          prices: {},
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `cartels/${CARTEL_ID}/state/inventory`);
      }
    }

    const treasuryRef = doc(db, 'cartels', CARTEL_ID, 'state', 'treasury');
    let treasurySnap;
    try {
      treasurySnap = await getDoc(treasuryRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `cartels/${CARTEL_ID}/state/treasury`);
    }
    if (!treasurySnap.exists()) {
      try {
        await setDoc(treasuryRef, {
          legal: Math.max(0, Number(seed.treasuryMoney?.legal) || 0),
          illegal: Math.max(0, Number(seed.treasuryMoney?.illegal) || 0),
          rewards: seed.rewardStocks || {},
          weaponsLossAmount: Math.max(0, Number(seed.weaponsLossAmount) || 0),
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `cartels/${CARTEL_ID}/state/treasury`);
      }
    }

    const hierarchyRef = doc(db, 'cartels', CARTEL_ID, 'state', 'hierarchy');
    let hierarchySnap;
    try {
      hierarchySnap = await getDoc(hierarchyRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `cartels/${CARTEL_ID}/state/hierarchy`);
    }
    if (!hierarchySnap.exists()) {
      try {
        await setDoc(hierarchyRef, {
          members: membersArrayToMap(
            seed.hierMembers?.length > 0 ? seed.hierMembers : HIER_DEFAULTS
          ),
          rankings: {},
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `cartels/${CARTEL_ID}/state/hierarchy`);
      }
    }

    const catalogRef = doc(db, 'cartels', CARTEL_ID, 'state', 'catalog');
    let catalogSnap;
    try {
      catalogSnap = await getDoc(catalogRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `cartels/${CARTEL_ID}/state/catalog`);
    }
    if (!catalogSnap.exists()) {
      try {
        await setDoc(catalogRef, {
          groups: sanitizeCatalogGroups(DEFAULT_CATALOG_GROUPS),
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `cartels/${CARTEL_ID}/state/catalog`);
      }
    }

    const albumRef = doc(db, 'cartels', CARTEL_ID, 'state', 'album');
    let albumSnap;
    try {
      albumSnap = await getDoc(albumRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `cartels/${CARTEL_ID}/state/album`);
    }
    if (!albumSnap.exists()) {
      try {
        await setDoc(albumRef, {
          photos: {},
          favorites: [],
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `cartels/${CARTEL_ID}/state/album`);
      }
    }

    const historyRef = doc(db, 'cartels', CARTEL_ID, 'state', 'history');
    let historySnap;
    try {
      historySnap = await getDoc(historyRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `cartels/${CARTEL_ID}/state/history`);
    }
    if (!historySnap.exists()) {
      try {
        await setDoc(historyRef, {
          archives: {},
          currentPayroll: createDefaultCurrentPayroll(),
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `cartels/${CARTEL_ID}/state/history`);
      }
    }
  }

  let memberSnap;
  try {
    memberSnap = await getDoc(memberRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, memberPath);
  }

  if (!memberSnap.exists()) {
    try {
      await setDoc(memberRef, {
        uid: user.uid,
        displayName: sanitizeDisplayName(user.displayName || user.email || 'Membre'),
        role: admin ? 'editor' : 'viewer',
        accessCode: '',
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (!admin && msg.toLowerCase().includes('permission')) {
        return 'uninitialized';
      }
      handleFirestoreError(error, OperationType.CREATE, memberPath);
    }
  }

  return 'ready';
}

export function subscribeCartelState(
  uid: string,
  callbacks: {
    onMissions: (ms: MissionStates) => void;
    onScheduleMeta?: (meta: MissionScheduleMeta) => void;
    onInventory: (stock: InventoryStock) => void;
    onInventoryPrices?: (prices: InventoryPrices) => void;
    onWeapons: (weapons: WeaponsStock) => void;
    onTreasury: (data: {
      treasuryMoney: TreasuryMoney;
      rewardStocks: RewardStocks;
      weaponsLossAmount: number;
    }) => void;
    onHierarchy: (members: HierarchyMember[]) => void;
    onMemberRankings?: (rankings: MemberRankingsMap) => void;
    onCatalog?: (groups: CatalogGroupsMap) => void;
    onAlbum?: (album: AlbumState) => void;
    onHistory?: (history: HistoryState) => void;
    onRole: (role: MemberRole) => void;
    onError: (err: Error) => void;
  }
): () => void {
  const unsubMissions = onSnapshot(
    doc(db, 'cartels', CARTEL_ID, 'state', 'missions'),
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const week =
        typeof data.week === 'string' ? data.week : isoDate(currentWeekStart());
      const entries =
        data.entries && typeof data.entries === 'object'
          ? (data.entries as Record<string, MissionStateEntry>)
          : {};
      callbacks.onMissions({ __week: week, ...entries });
      callbacks.onScheduleMeta?.(
        sanitizeScheduleMeta(
          data.scheduleOverrides,
          data.unplacedMissionIds,
          data.lastRecalcDate,
          data.lastRecalcAt
        )
      );
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, `cartels/${CARTEL_ID}/state/missions`);
      } catch (err) {
        callbacks.onError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  );

  const unsubInventory = onSnapshot(
    doc(db, 'cartels', CARTEL_ID, 'state', 'inventory'),
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const stock =
        data.stock && typeof data.stock === 'object'
          ? (data.stock as InventoryStock)
          : {};
      callbacks.onInventory(stock);
      callbacks.onInventoryPrices?.(sanitizeInventoryPrices(data.prices));
      callbacks.onWeapons(sanitizeWeaponsMap(data.weapons));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, `cartels/${CARTEL_ID}/state/inventory`);
      } catch (err) {
        callbacks.onError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  );

  const unsubTreasury = onSnapshot(
    doc(db, 'cartels', CARTEL_ID, 'state', 'treasury'),
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      callbacks.onTreasury({
        treasuryMoney: {
          legal: Math.max(0, Number(data.legal) || 0),
          illegal: Math.max(0, Number(data.illegal) || 0),
        },
        rewardStocks:
          data.rewards && typeof data.rewards === 'object'
            ? (data.rewards as RewardStocks)
            : {},
        weaponsLossAmount: Math.max(0, Number(data.weaponsLossAmount) || 0),
      });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, `cartels/${CARTEL_ID}/state/treasury`);
      } catch (err) {
        callbacks.onError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  );

  const unsubHierarchy = onSnapshot(
    doc(db, 'cartels', CARTEL_ID, 'state', 'hierarchy'),
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      callbacks.onHierarchy(membersMapToArray(data.members));
      callbacks.onMemberRankings?.(sanitizeMemberRankings(data.rankings));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, `cartels/${CARTEL_ID}/state/hierarchy`);
      } catch (err) {
        callbacks.onError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  );

  const unsubMember = onSnapshot(
    doc(db, 'cartels', CARTEL_ID, 'members', uid),
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      callbacks.onRole(data.role === 'editor' ? 'editor' : 'viewer');
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, `cartels/${CARTEL_ID}/members/${uid}`);
      } catch (err) {
        callbacks.onError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  );

  const unsubCatalog = onSnapshot(
    doc(db, 'cartels', CARTEL_ID, 'state', 'catalog'),
    (snap) => {
      if (!snap.exists()) {
        callbacks.onCatalog?.(DEFAULT_CATALOG_GROUPS);
        return;
      }
      const data = snap.data();
      callbacks.onCatalog?.(sanitizeCatalogGroups(data.groups));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, `cartels/${CARTEL_ID}/state/catalog`);
      } catch (err) {
        callbacks.onError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  );

  const unsubAlbum = onSnapshot(
    doc(db, 'cartels', CARTEL_ID, 'state', 'album'),
    (snap) => {
      if (!snap.exists()) {
        callbacks.onAlbum?.(DEFAULT_ALBUM_STATE);
        return;
      }
      callbacks.onAlbum?.(sanitizeAlbumState(snap.data()));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, `cartels/${CARTEL_ID}/state/album`);
      } catch (err) {
        callbacks.onError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  );

  const unsubHistory = onSnapshot(
    doc(db, 'cartels', CARTEL_ID, 'state', 'history'),
    (snap) => {
      if (!snap.exists()) {
        callbacks.onHistory?.({
          archives: {},
          currentPayroll: createDefaultCurrentPayroll(),
        });
        return;
      }
      callbacks.onHistory?.(sanitizeHistoryState(snap.data()));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, `cartels/${CARTEL_ID}/state/history`);
      } catch (err) {
        callbacks.onError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  );

  return () => {
    unsubMissions();
    unsubInventory();
    unsubTreasury();
    unsubHierarchy();
    unsubMember();
    unsubCatalog();
    unsubAlbum();
    unsubHistory();
  };
}

export async function saveMissionEntry(
  uid: string,
  missionId: string,
  entry: MissionStateEntry
): Promise<void> {
  const path = `cartels/${CARTEL_ID}/state/missions`;
  const cleanEntry = sanitizeMissionEntry(entry);
  try {
    await updateDoc(doc(db, 'cartels', CARTEL_ID, 'state', 'missions'), {
      [`entries.${missionId}`]: cleanEntry,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveMissionWithSideEffects(
  uid: string,
  missionId: string,
  entry: MissionStateEntry,
  sideEffects?: {
    inventoryPatch?: Record<string, number>;
    weapons?: WeaponsStock;
    rewardPatches?: Record<string, RewardStockEntry>;
    treasuryMoneyPatch?: Partial<TreasuryMoney>;
  }
): Promise<void> {
  const path = `cartels/${CARTEL_ID}/state/missions`;
  const batch = writeBatch(db);
  batch.update(doc(db, 'cartels', CARTEL_ID, 'state', 'missions'), {
    [`entries.${missionId}`]: sanitizeMissionEntry(entry),
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });

  if (
    sideEffects?.inventoryPatch ||
    sideEffects?.weapons !== undefined
  ) {
    const invUpdate: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    };
    if (sideEffects.inventoryPatch) {
      Object.entries(sideEffects.inventoryPatch).forEach(([k, q]) => {
        invUpdate[`stock.${k}`] = Math.max(0, Math.floor(q));
      });
    }
    if (sideEffects.weapons !== undefined) {
      invUpdate.weapons = sanitizeWeaponsMap(sideEffects.weapons);
    }
    batch.update(doc(db, 'cartels', CARTEL_ID, 'state', 'inventory'), invUpdate);
  }

  const hasRewards =
    sideEffects?.rewardPatches && Object.keys(sideEffects.rewardPatches).length > 0;
  const hasMoneyPatch =
    sideEffects?.treasuryMoneyPatch &&
    (sideEffects.treasuryMoneyPatch.legal !== undefined ||
      sideEffects.treasuryMoneyPatch.illegal !== undefined);

  if (hasRewards || hasMoneyPatch) {
    const treasUpdate: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    };
    if (sideEffects?.rewardPatches) {
      Object.entries(sideEffects.rewardPatches).forEach(([k, val]) => {
        treasUpdate[`rewards.${k}`] = {
          qty: Math.max(0, Math.floor(Number(val.qty) || 0)),
          val: Math.max(0, Number(val.val) || 0),
        };
      });
    }
    if (sideEffects?.treasuryMoneyPatch?.legal !== undefined) {
      treasUpdate.legal = Math.max(0, Number(sideEffects.treasuryMoneyPatch.legal) || 0);
    }
    if (sideEffects?.treasuryMoneyPatch?.illegal !== undefined) {
      treasUpdate.illegal = Math.max(0, Number(sideEffects.treasuryMoneyPatch.illegal) || 0);
    }
    batch.update(doc(db, 'cartels', CARTEL_ID, 'state', 'treasury'), treasUpdate);
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveSchedulePlan(
  uid: string,
  meta: MissionScheduleMeta
): Promise<void> {
  const path = `cartels/${CARTEL_ID}/state/missions`;
  const clean = sanitizeScheduleMeta(
    meta.scheduleOverrides,
    meta.unplacedMissionIds,
    meta.lastRecalcDate,
    meta.lastRecalcAt
  );
  try {
    await updateDoc(doc(db, 'cartels', CARTEL_ID, 'state', 'missions'), {
      scheduleOverrides: clean.scheduleOverrides,
      unplacedMissionIds: clean.unplacedMissionIds,
      lastRecalcDate: clean.lastRecalcDate,
      lastRecalcAt: clean.lastRecalcAt,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveAllMissionEntries(
  uid: string,
  week: string,
  entries: Record<string, MissionStateEntry>,
  scheduleMeta?: MissionScheduleMeta
): Promise<void> {
  const path = `cartels/${CARTEL_ID}/state/missions`;
  const cleanEntries: Record<string, MissionStateEntry> = {};
  Object.entries(entries).forEach(([k, v]) => {
    if (k === '__week' || !v) return;
    cleanEntries[k] = sanitizeMissionEntry(v);
  });
  const payload: Record<string, unknown> = {
    week,
    entries: cleanEntries,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  };
  if (scheduleMeta) {
    const clean = sanitizeScheduleMeta(
      scheduleMeta.scheduleOverrides,
      scheduleMeta.unplacedMissionIds,
      scheduleMeta.lastRecalcDate,
      scheduleMeta.lastRecalcAt
    );
    payload.scheduleOverrides = clean.scheduleOverrides;
    payload.unplacedMissionIds = clean.unplacedMissionIds;
    payload.lastRecalcDate = clean.lastRecalcDate;
    payload.lastRecalcAt = clean.lastRecalcAt;
  }
  try {
    await updateDoc(doc(db, 'cartels', CARTEL_ID, 'state', 'missions'), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveAllMissionEntriesWithSideEffects(
  uid: string,
  week: string,
  entries: Record<string, MissionStateEntry>,
  sideEffects?: {
    inventoryPatch?: Record<string, number>;
    weapons?: WeaponsStock;
    rewardPatches?: Record<string, RewardStockEntry>;
    treasuryMoneyPatch?: Partial<TreasuryMoney>;
  }
): Promise<void> {
  const path = `cartels/${CARTEL_ID}/state/missions`;
  const cleanEntries: Record<string, MissionStateEntry> = {};
  Object.entries(entries).forEach(([k, v]) => {
    if (k === '__week' || !v) return;
    cleanEntries[k] = sanitizeMissionEntry(v);
  });

  const batch = writeBatch(db);
  batch.update(doc(db, 'cartels', CARTEL_ID, 'state', 'missions'), {
    week,
    entries: cleanEntries,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });

  if (
    (sideEffects?.inventoryPatch && Object.keys(sideEffects.inventoryPatch).length > 0) ||
    sideEffects?.weapons !== undefined
  ) {
    const invUpdate: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    };
    if (sideEffects.inventoryPatch) {
      Object.entries(sideEffects.inventoryPatch).forEach(([k, q]) => {
        invUpdate[`stock.${k}`] = Math.max(0, Math.floor(q));
      });
    }
    if (sideEffects.weapons !== undefined) {
      invUpdate.weapons = sanitizeWeaponsMap(sideEffects.weapons);
    }
    batch.update(doc(db, 'cartels', CARTEL_ID, 'state', 'inventory'), invUpdate);
  }

  const hasRewards =
    sideEffects?.rewardPatches && Object.keys(sideEffects.rewardPatches).length > 0;
  const hasMoneyPatch =
    sideEffects?.treasuryMoneyPatch &&
    (sideEffects.treasuryMoneyPatch.legal !== undefined ||
      sideEffects.treasuryMoneyPatch.illegal !== undefined);

  if (hasRewards || hasMoneyPatch) {
    const treasUpdate: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    };
    if (sideEffects?.rewardPatches) {
      Object.entries(sideEffects.rewardPatches).forEach(([k, val]) => {
        treasUpdate[`rewards.${k}`] = {
          qty: Math.max(0, Math.floor(Number(val.qty) || 0)),
          val: Math.max(0, Number(val.val) || 0),
        };
      });
    }
    if (sideEffects?.treasuryMoneyPatch?.legal !== undefined) {
      treasUpdate.legal = Math.max(0, Number(sideEffects.treasuryMoneyPatch.legal) || 0);
    }
    if (sideEffects?.treasuryMoneyPatch?.illegal !== undefined) {
      treasUpdate.illegal = Math.max(0, Number(sideEffects.treasuryMoneyPatch.illegal) || 0);
    }
    batch.update(doc(db, 'cartels', CARTEL_ID, 'state', 'treasury'), treasUpdate);
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveInventoryItem(
  uid: string,
  key: string,
  qty: number
): Promise<void> {
  const path = `cartels/${CARTEL_ID}/state/inventory`;
  try {
    await updateDoc(doc(db, 'cartels', CARTEL_ID, 'state', 'inventory'), {
      [`stock.${key}`]: Math.max(0, Math.floor(qty)),
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveInventoryItemPrice(
  uid: string,
  key: string,
  price: number
): Promise<void> {
  const path = `cartels/${CARTEL_ID}/state/inventory`;
  const cleanKey = key.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
  if (!cleanKey) return;
  try {
    await updateDoc(doc(db, 'cartels', CARTEL_ID, 'state', 'inventory'), {
      [`prices.${cleanKey}`]: Math.max(0, Math.round(Number(price) || 0)),
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveInventoryPricesBatch(
  uid: string,
  prices: Record<string, number>
): Promise<void> {
  const path = `cartels/${CARTEL_ID}/state/inventory`;
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  };
  let count = 0;
  Object.entries(prices).forEach(([key, price]) => {
    const cleanKey = key.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
    if (!cleanKey) return;
    payload[`prices.${cleanKey}`] = Math.max(0, Math.round(Number(price) || 0));
    count++;
  });
  if (count === 0) return;
  try {
    await updateDoc(doc(db, 'cartels', CARTEL_ID, 'state', 'inventory'), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function resetAllInventory(uid: string): Promise<void> {
  const path = `cartels/${CARTEL_ID}/state/inventory`;
  try {
    await updateDoc(doc(db, 'cartels', CARTEL_ID, 'state', 'inventory'), {
      stock: {},
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveInventoryOrderReceipt(
  uid: string,
  stockPatch: Record<string, number>,
  treasuryMoneyPatch?: Partial<TreasuryMoney>
): Promise<void> {
  const path = `cartels/${CARTEL_ID}/state/inventory`;
  const hasStock = Object.keys(stockPatch).length > 0;
  const hasMoney = Boolean(
    treasuryMoneyPatch &&
      (treasuryMoneyPatch.legal !== undefined || treasuryMoneyPatch.illegal !== undefined)
  );
  if (!hasStock && !hasMoney) return;

  const batch = writeBatch(db);
  if (hasStock) {
    const invUpdate: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    };
    Object.entries(stockPatch).forEach(([k, q]) => {
      invUpdate[`stock.${k}`] = Math.max(0, Math.floor(q));
    });
    batch.update(doc(db, 'cartels', CARTEL_ID, 'state', 'inventory'), invUpdate);
  }

  if (hasMoney && treasuryMoneyPatch) {
    const treasUpdate: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    };
    if (treasuryMoneyPatch.legal !== undefined) {
      treasUpdate.legal = Math.max(0, Number(treasuryMoneyPatch.legal) || 0);
    }
    if (treasuryMoneyPatch.illegal !== undefined) {
      treasUpdate.illegal = Math.max(0, Number(treasuryMoneyPatch.illegal) || 0);
    }
    batch.update(doc(db, 'cartels', CARTEL_ID, 'state', 'treasury'), treasUpdate);
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveWeaponsStock(
  uid: string,
  weapons: WeaponsStock
): Promise<void> {
  const path = `cartels/${CARTEL_ID}/state/inventory`;
  try {
    await updateDoc(doc(db, 'cartels', CARTEL_ID, 'state', 'inventory'), {
      weapons: sanitizeWeaponsMap(weapons),
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveWeaponsWithTreasury(
  uid: string,
  weapons: WeaponsStock,
  treasuryMoneyPatch?: Partial<TreasuryMoney>
): Promise<void> {
  const path = `cartels/${CARTEL_ID}/state/inventory`;
  const batch = writeBatch(db);
  batch.update(doc(db, 'cartels', CARTEL_ID, 'state', 'inventory'), {
    weapons: sanitizeWeaponsMap(weapons),
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });

  if (
    treasuryMoneyPatch &&
    (treasuryMoneyPatch.legal !== undefined || treasuryMoneyPatch.illegal !== undefined)
  ) {
    const treasUpdate: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    };
    if (treasuryMoneyPatch.legal !== undefined) {
      treasUpdate.legal = Math.max(0, Number(treasuryMoneyPatch.legal) || 0);
    }
    if (treasuryMoneyPatch.illegal !== undefined) {
      treasUpdate.illegal = Math.max(0, Number(treasuryMoneyPatch.illegal) || 0);
    }
    batch.update(doc(db, 'cartels', CARTEL_ID, 'state', 'treasury'), treasUpdate);
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveWeaponLossGlobal(
  uid: string,
  weapons: WeaponsStock,
  weaponsLossAmount: number
): Promise<void> {
  const path = `cartels/${CARTEL_ID}/state/inventory`;
  const batch = writeBatch(db);
  batch.update(doc(db, 'cartels', CARTEL_ID, 'state', 'inventory'), {
    weapons: sanitizeWeaponsMap(weapons),
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
  batch.update(doc(db, 'cartels', CARTEL_ID, 'state', 'treasury'), {
    weaponsLossAmount: Math.max(0, Number(weaponsLossAmount) || 0),
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveTreasuryMoneyField(
  uid: string,
  type: keyof TreasuryMoney,
  value: number
): Promise<void> {
  const path = `cartels/${CARTEL_ID}/state/treasury`;
  try {
    await updateDoc(doc(db, 'cartels', CARTEL_ID, 'state', 'treasury'), {
      [type]: Math.max(0, Number(value) || 0),
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveRewardItem(
  uid: string,
  key: string,
  entry: RewardStockEntry
): Promise<void> {
  const path = `cartels/${CARTEL_ID}/state/treasury`;
  try {
    await updateDoc(doc(db, 'cartels', CARTEL_ID, 'state', 'treasury'), {
      [`rewards.${key}`]: {
        qty: Math.max(0, Math.floor(Number(entry.qty) || 0)),
        val: Math.max(0, Number(entry.val) || 0),
      },
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveRewardPricesBatch(
  uid: string,
  entries: Record<string, RewardStockEntry>
): Promise<void> {
  const keys = Object.keys(entries);
  if (keys.length === 0) return;
  const path = `cartels/${CARTEL_ID}/state/treasury`;
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  };
  keys.forEach((key) => {
    const cleanKey = key.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    if (!cleanKey) return;
    const entry = entries[key];
    payload[`rewards.${cleanKey}`] = {
      qty: Math.max(0, Math.floor(Number(entry.qty) || 0)),
      val: Math.max(0, Number(entry.val) || 0),
    };
  });
  try {
    await updateDoc(doc(db, 'cartels', CARTEL_ID, 'state', 'treasury'), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveLootSale(
  uid: string,
  rewardPatches: Record<string, RewardStockEntry>,
  updatedIllegal: number
): Promise<void> {
  const keys = Object.keys(rewardPatches);
  const path = `cartels/${CARTEL_ID}/state/treasury`;
  const payload: Record<string, unknown> = {
    illegal: Math.max(0, Math.round(Number(updatedIllegal) || 0)),
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  };
  keys.forEach((key) => {
    const cleanKey = key.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    if (!cleanKey) return;
    const entry = rewardPatches[key];
    payload[`rewards.${cleanKey}`] = {
      qty: Math.max(0, Math.floor(Number(entry.qty) || 0)),
      val: Math.max(0, Number(entry.val) || 0),
    };
  });
  try {
    await updateDoc(doc(db, 'cartels', CARTEL_ID, 'state', 'treasury'), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveWeaponsLoss(uid: string, amount: number): Promise<void> {
  const path = `cartels/${CARTEL_ID}/state/treasury`;
  try {
    await updateDoc(doc(db, 'cartels', CARTEL_ID, 'state', 'treasury'), {
      weaponsLossAmount: Math.max(0, Number(amount) || 0),
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveHierarchyMembers(
  uid: string,
  members: HierarchyMember[]
): Promise<void> {
  const path = `cartels/${CARTEL_ID}/state/hierarchy`;
  try {
    await updateDoc(doc(db, 'cartels', CARTEL_ID, 'state', 'hierarchy'), {
      members: membersArrayToMap(members),
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveMemberRankings(
  uid: string,
  rankings: MemberRankingsMap
): Promise<void> {
  const path = `cartels/${CARTEL_ID}/state/hierarchy`;
  try {
    await updateDoc(doc(db, 'cartels', CARTEL_ID, 'state', 'hierarchy'), {
      rankings: sanitizeMemberRankings(rankings),
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveCatalogGroups(
  uid: string,
  groups: CatalogGroupsMap
): Promise<void> {
  const path = `cartels/${CARTEL_ID}/state/catalog`;
  try {
    await setDoc(doc(db, 'cartels', CARTEL_ID, 'state', 'catalog'), {
      groups: sanitizeCatalogGroups(groups),
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveAlbumState(
  uid: string,
  albumState: AlbumState
): Promise<void> {
  const path = `cartels/${CARTEL_ID}/state/album`;
  const clean = sanitizeAlbumState(albumState);
  try {
    await setDoc(doc(db, 'cartels', CARTEL_ID, 'state', 'album'), {
      photos: clean.photos,
      favorites: clean.favorites,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveAlbumPhotoWithMedia(
  uid: string,
  photo: AlbumPhotoRecord,
  nextAlbumState: AlbumState,
  media?: { imageUrl: string; mimeType: string }
): Promise<void> {
  const cleanState = sanitizeAlbumState(nextAlbumState);
  const albumPath = `cartels/${CARTEL_ID}/state/album`;
  const mediaId = photo.mediaId?.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);

  if (media && mediaId) {
    const mediaPath = `cartels/${CARTEL_ID}/albumMedia/${mediaId}`;
    try {
      await setDoc(doc(db, 'cartels', CARTEL_ID, 'albumMedia', mediaId), {
        id: mediaId,
        imageUrl: media.imageUrl.slice(0, 700000),
        mimeType: (media.mimeType || 'image/jpeg').slice(0, 40),
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, mediaPath);
    }
  }

  try {
    await setDoc(doc(db, 'cartels', CARTEL_ID, 'state', 'album'), {
      photos: cleanState.photos,
      favorites: cleanState.favorites,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, albumPath);
  }
}

export async function deleteAlbumPhotoWithMedia(
  uid: string,
  photo: AlbumPhotoRecord,
  nextAlbumState: AlbumState
): Promise<void> {
  const cleanState = sanitizeAlbumState(nextAlbumState);
  const albumPath = `cartels/${CARTEL_ID}/state/album`;

  try {
    await setDoc(doc(db, 'cartels', CARTEL_ID, 'state', 'album'), {
      photos: cleanState.photos,
      favorites: cleanState.favorites,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, albumPath);
  }

  if (photo.mediaId) {
    const mediaId = photo.mediaId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    if (mediaId) {
      const mediaPath = `cartels/${CARTEL_ID}/albumMedia/${mediaId}`;
      try {
        await deleteDoc(doc(db, 'cartels', CARTEL_ID, 'albumMedia', mediaId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, mediaPath);
      }
    }
  }
}

export async function fetchAlbumMediaUrl(mediaId: string): Promise<string | null> {
  const cleanId = mediaId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  if (!cleanId) return null;
  const mediaPath = `cartels/${CARTEL_ID}/albumMedia/${cleanId}`;
  try {
    const snap = await getDoc(doc(db, 'cartels', CARTEL_ID, 'albumMedia', cleanId));
    if (!snap.exists()) return null;
    const data = snap.data();
    return typeof data.imageUrl === 'string' && data.imageUrl.trim() ? data.imageUrl : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, mediaPath);
  }
}

export async function saveHistoryState(
  uid: string,
  historyState: HistoryState
): Promise<void> {
  const path = `cartels/${CARTEL_ID}/state/history`;
  const clean = sanitizeHistoryState(historyState);
  try {
    await setDoc(doc(db, 'cartels', CARTEL_ID, 'state', 'history'), {
      archives: clean.archives,
      currentPayroll: clean.currentPayroll,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function savePayrollSettlementWithTreasury(
  uid: string,
  historyState: HistoryState,
  treasuryMoneyPatch?: Partial<TreasuryMoney>
): Promise<void> {
  const path = `cartels/${CARTEL_ID}/state/history`;
  const clean = sanitizeHistoryState(historyState);
  const batch = writeBatch(db);

  batch.set(doc(db, 'cartels', CARTEL_ID, 'state', 'history'), {
    archives: clean.archives,
    currentPayroll: clean.currentPayroll,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });

  if (
    treasuryMoneyPatch &&
    (treasuryMoneyPatch.legal !== undefined || treasuryMoneyPatch.illegal !== undefined)
  ) {
    const treasUpdate: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    };
    if (treasuryMoneyPatch.legal !== undefined) {
      treasUpdate.legal = Math.max(0, Math.round(Number(treasuryMoneyPatch.legal) || 0));
    }
    if (treasuryMoneyPatch.illegal !== undefined) {
      treasUpdate.illegal = Math.max(0, Math.round(Number(treasuryMoneyPatch.illegal) || 0));
    }
    batch.update(doc(db, 'cartels', CARTEL_ID, 'state', 'treasury'), treasUpdate);
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function archiveWeekAndResetMissions(
  uid: string,
  params: {
    historyState: HistoryState;
    nextWeek: string;
    weaponsLossAmount: number;
  }
): Promise<void> {
  const path = `cartels/${CARTEL_ID}/state/history`;
  const clean = sanitizeHistoryState(params.historyState);
  const batch = writeBatch(db);

  batch.set(doc(db, 'cartels', CARTEL_ID, 'state', 'history'), {
    archives: clean.archives,
    currentPayroll: clean.currentPayroll,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });

  batch.update(doc(db, 'cartels', CARTEL_ID, 'state', 'missions'), {
    week: params.nextWeek,
    entries: {},
    scheduleOverrides: {},
    unplacedMissionIds: [],
    lastRecalcDate: '',
    lastRecalcAt: '',
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });

  batch.update(doc(db, 'cartels', CARTEL_ID, 'state', 'treasury'), {
    weaponsLossAmount: Math.max(0, Math.round(Number(params.weaponsLossAmount) || 0)),
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function unlockEditorWithCode(
  user: User,
  code: string
): Promise<boolean> {
  const trimmed = code.trim().slice(0, 64);
  if (!trimmed) return false;

  if (isAdminUser(user)) {
    const authConfigPath = `cartels/${CARTEL_ID}/private/auth`;
    try {
      const snap = await getDoc(doc(db, 'cartels', CARTEL_ID, 'private', 'auth'));
      const currentSecret = snap.exists() ? String(snap.data().secretCode || '') : DEFAULT_SECRET_CODE;
      if (trimmed !== currentSecret) {
        return false;
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, authConfigPath);
    }
  }

  const memberPath = `cartels/${CARTEL_ID}/members/${user.uid}`;
  try {
    await updateDoc(doc(db, 'cartels', CARTEL_ID, 'members', user.uid), {
      role: 'editor',
      accessCode: trimmed,
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.toLowerCase().includes('permission')) {
      return false;
    }
    handleFirestoreError(error, OperationType.UPDATE, memberPath);
  }
}

export async function lockEditorRole(user: User): Promise<void> {
  const memberPath = `cartels/${CARTEL_ID}/members/${user.uid}`;
  try {
    await updateDoc(doc(db, 'cartels', CARTEL_ID, 'members', user.uid), {
      role: 'viewer',
      accessCode: '',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, memberPath);
  }
}

export async function updateCartelSecretCode(
  uid: string,
  newCode: string
): Promise<void> {
  const trimmed = newCode.trim().slice(0, 64);
  const path = `cartels/${CARTEL_ID}/private/auth`;
  try {
    await updateDoc(doc(db, 'cartels', CARTEL_ID, 'private', 'auth'), {
      secretCode: trimmed,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export const DISCORD_WEBHOOK_URL_REGEX =
  /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/[0-9]+\/[A-Za-z0-9._-]+$/;

export const DEFAULT_DISCORD_CONFIG: DiscordGazetteConfig = {
  webhookUrl: '',
  autoEnabled: false,
  sendHour: 9,
  sendMinute: 30,
  includePhoto: true,
  customMessage: '',
  lastSentDate: '',
  lastSentAt: '',
  lastSentBy: '',
};

export function isValidDiscordWebhookUrl(raw: string): boolean {
  const trimmed = raw.trim();
  return trimmed.length > 0 && trimmed.length <= 300 && DISCORD_WEBHOOK_URL_REGEX.test(trimmed);
}

export function sanitizeDiscordConfig(raw: unknown): DiscordGazetteConfig {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_DISCORD_CONFIG };
  }
  const obj = raw as Record<string, unknown>;
  const rawWebhook = typeof obj.webhookUrl === 'string' ? obj.webhookUrl.trim().slice(0, 300) : '';
  const webhookUrl = rawWebhook && DISCORD_WEBHOOK_URL_REGEX.test(rawWebhook) ? rawWebhook : '';

  const rawHour = Number(obj.sendHour);
  const sendHour = Number.isFinite(rawHour)
    ? Math.max(0, Math.min(23, Math.trunc(rawHour)))
    : 9;

  const rawMinute = Number(obj.sendMinute);
  const sendMinute = Number.isFinite(rawMinute)
    ? Math.max(0, Math.min(59, Math.trunc(rawMinute)))
    : 30;

  const rawLastDate =
    typeof obj.lastSentDate === 'string' ? obj.lastSentDate.trim().slice(0, 20) : '';
  const lastSentDate = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(rawLastDate) ? rawLastDate : '';

  return {
    webhookUrl,
    autoEnabled: Boolean(obj.autoEnabled),
    sendHour,
    sendMinute,
    includePhoto: obj.includePhoto === undefined ? true : Boolean(obj.includePhoto),
    customMessage:
      typeof obj.customMessage === 'string' ? obj.customMessage.trim().slice(0, 300) : '',
    lastSentDate,
    lastSentAt: typeof obj.lastSentAt === 'string' ? obj.lastSentAt.trim().slice(0, 40) : '',
    lastSentBy: typeof obj.lastSentBy === 'string' ? obj.lastSentBy.trim().slice(0, 80) : '',
  };
}

export function subscribeDiscordConfig(callbacks: {
  onConfig: (config: DiscordGazetteConfig) => void;
  onError: (err: Error) => void;
}): () => void {
  const path = `cartels/${CARTEL_ID}/private/discord`;
  return onSnapshot(
    doc(db, 'cartels', CARTEL_ID, 'private', 'discord'),
    (snap) => {
      if (!snap.exists()) {
        callbacks.onConfig({ ...DEFAULT_DISCORD_CONFIG });
        return;
      }
      callbacks.onConfig(sanitizeDiscordConfig(snap.data()));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (err) {
        callbacks.onError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  );
}

export async function saveDiscordConfig(
  uid: string,
  config: DiscordGazetteConfig
): Promise<void> {
  const path = `cartels/${CARTEL_ID}/private/discord`;
  const clean = sanitizeDiscordConfig(config);
  try {
    await setDoc(doc(db, 'cartels', CARTEL_ID, 'private', 'discord'), {
      ...clean,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export interface ClaimDailyDispatchResult {
  claimed: boolean;
  config?: DiscordGazetteConfig;
  previousLastSentDate: string;
  previousLastSentAt: string;
  previousLastSentBy: string;
}

export async function claimDailyDiscordDispatch(
  uid: string,
  todayIso: string,
  senderName: string,
  allowServerFallback = false
): Promise<ClaimDailyDispatchResult> {
  const path = `cartels/${CARTEL_ID}/private/discord`;
  const ref = doc(db, 'cartels', CARTEL_ID, 'private', 'discord');
  const cleanSender = sanitizeDisplayName(senderName).slice(0, 80);

  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const current = snap.exists()
        ? sanitizeDiscordConfig(snap.data())
        : { ...DEFAULT_DISCORD_CONFIG };
      const hasWebhook =
        isValidDiscordWebhookUrl(current.webhookUrl) || Boolean(allowServerFallback);
      if (!current.autoEnabled || !hasWebhook || current.lastSentDate === todayIso) {
        return {
          claimed: false,
          previousLastSentDate: current.lastSentDate,
          previousLastSentAt: current.lastSentAt,
          previousLastSentBy: current.lastSentBy,
        };
      }

      const nowIso = new Date().toISOString().slice(0, 40);
      const next: DiscordGazetteConfig = {
        ...current,
        lastSentDate: todayIso,
        lastSentAt: nowIso,
        lastSentBy: cleanSender,
      };
      if (snap.exists()) {
        tx.update(ref, {
          ...next,
          updatedAt: serverTimestamp(),
          updatedBy: uid,
        });
      } else {
        tx.set(ref, {
          ...next,
          updatedAt: serverTimestamp(),
          updatedBy: uid,
        });
      }

      return {
        claimed: true,
        config: next,
        previousLastSentDate: current.lastSentDate,
        previousLastSentAt: current.lastSentAt,
        previousLastSentBy: current.lastSentBy,
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function rollbackDailyDiscordDispatch(
  uid: string,
  expectedTodayIso: string,
  previous: {
    lastSentDate: string;
    lastSentAt: string;
    lastSentBy: string;
  }
): Promise<void> {
  const path = `cartels/${CARTEL_ID}/private/discord`;
  const ref = doc(db, 'cartels', CARTEL_ID, 'private', 'discord');
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const current = sanitizeDiscordConfig(snap.data());
      if (current.lastSentDate !== expectedTodayIso) return;
      tx.update(ref, {
        ...current,
        lastSentDate: previous.lastSentDate,
        lastSentAt: previous.lastSentAt,
        lastSentBy: previous.lastSentBy,
        updatedAt: serverTimestamp(),
        updatedBy: uid,
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export interface CartelBackupMediaEntry {
  imageUrl: string;
  mimeType: string;
}

export interface CartelBackupSnapshot {
  schemaVersion: 1;
  exportedAt: string;
  cartelId: string;
  missions: {
    week: string;
    entries: Record<string, MissionStateEntry>;
    scheduleOverrides: Record<string, string>;
    unplacedMissionIds: string[];
    lastRecalcDate: string;
    lastRecalcAt: string;
  };
  inventory: {
    stock: InventoryStock;
    prices: InventoryPrices;
    weapons: WeaponsStock;
  };
  treasury: {
    legal: number;
    illegal: number;
    rewards: RewardStocks;
    weaponsLossAmount: number;
  };
  hierarchy: {
    members: HierarchyMember[];
    rankings: MemberRankingsMap;
  };
  catalog: {
    groups: CatalogGroupsMap;
  };
  album: AlbumState;
  albumMedia: Record<string, CartelBackupMediaEntry>;
  history: HistoryState;
}

export interface CartelBackupPreview {
  exportedAt: string;
  week: string;
  missionCount: number;
  inventoryCount: number;
  weaponsCount: number;
  legal: number;
  illegal: number;
  membersCount: number;
  catalogGroupsCount: number;
  albumPhotosCount: number;
  albumMediaCount: number;
  archivesCount: number;
}

function sanitizeInventoryStockMap(raw: unknown): InventoryStock {
  if (!raw || typeof raw !== 'object') return {};
  const clean: InventoryStock = {};
  Object.entries(raw as Record<string, unknown>)
    .slice(0, 100)
    .forEach(([k, v]) => {
      const key = k.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
      if (!key) return;
      const qty = Math.max(0, Math.floor(Number(v) || 0));
      clean[key] = qty;
    });
  return clean;
}

function sanitizeRewardStocksMap(raw: unknown): RewardStocks {
  if (!raw || typeof raw !== 'object') return {};
  const clean: RewardStocks = {};
  Object.entries(raw as Record<string, unknown>)
    .slice(0, 40)
    .forEach(([k, v]) => {
      const key = k.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
      if (!key || !v || typeof v !== 'object') return;
      const entry = v as Record<string, unknown>;
      clean[key] = {
        qty: Math.max(0, Math.floor(Number(entry.qty) || 0)),
        val: Math.max(0, Math.round(Number(entry.val ?? entry.price) || 0)),
      };
    });
  return clean;
}

function sanitizeBackupAlbumMedia(raw: unknown): Record<string, CartelBackupMediaEntry> {
  if (!raw || typeof raw !== 'object') return {};
  const clean: Record<string, CartelBackupMediaEntry> = {};
  Object.entries(raw as Record<string, unknown>)
    .slice(0, 100)
    .forEach(([rawId, val]) => {
      const id = rawId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
      if (!id || !val || typeof val !== 'object') return;
      const obj = val as Record<string, unknown>;
      const imageUrl = typeof obj.imageUrl === 'string' ? obj.imageUrl.trim() : '';
      const mimeType =
        typeof obj.mimeType === 'string' && obj.mimeType.trim()
          ? obj.mimeType.trim().slice(0, 40)
          : 'image/jpeg';
      if (imageUrl.length >= 1 && imageUrl.length <= 700000) {
        clean[id] = { imageUrl, mimeType };
      }
    });
  return clean;
}

export async function exportCartelBackupSnapshot(input: {
  missionStates: MissionStates;
  scheduleMeta: MissionScheduleMeta;
  inventoryStock: InventoryStock;
  inventoryPrices: InventoryPrices;
  weaponsStock: WeaponsStock;
  treasuryMoney: TreasuryMoney;
  rewardStocks: RewardStocks;
  weaponsLossAmount: number;
  hierMembers: HierarchyMember[];
  memberRankings: MemberRankingsMap;
  catalogGroups: CatalogGroupsMap;
  albumState: AlbumState;
  historyState: HistoryState;
}): Promise<CartelBackupSnapshot> {
  const { week, entries } = splitMissionStates(input.missionStates);
  const cleanSchedule = sanitizeScheduleMeta(
    input.scheduleMeta.scheduleOverrides,
    input.scheduleMeta.unplacedMissionIds,
    input.scheduleMeta.lastRecalcDate,
    input.scheduleMeta.lastRecalcAt
  );
  const cleanAlbum = sanitizeAlbumState(input.albumState);

  const albumMedia: Record<string, CartelBackupMediaEntry> = {};
  const mediaIds = Array.from(
    new Set(
      Object.values(cleanAlbum.photos)
        .map((photo) => photo.mediaId?.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64))
        .filter((id): id is string => Boolean(id))
    )
  ).slice(0, 100);

  await Promise.all(
    mediaIds.map(async (mediaId) => {
      const mediaPath = `cartels/${CARTEL_ID}/albumMedia/${mediaId}`;
      try {
        const snap = await getDoc(doc(db, 'cartels', CARTEL_ID, 'albumMedia', mediaId));
        if (!snap.exists()) return;
        const data = snap.data() as Record<string, unknown>;
        const imageUrl = typeof data.imageUrl === 'string' ? data.imageUrl : '';
        const mimeType =
          typeof data.mimeType === 'string' && data.mimeType
            ? data.mimeType.slice(0, 40)
            : 'image/jpeg';
        if (imageUrl.length >= 1 && imageUrl.length <= 700000) {
          albumMedia[mediaId] = { imageUrl, mimeType };
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, mediaPath);
      }
    })
  );

  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    cartelId: CARTEL_ID,
    missions: {
      week,
      entries,
      ...cleanSchedule,
    },
    inventory: {
      stock: sanitizeInventoryStockMap(input.inventoryStock),
      prices: sanitizeInventoryPrices(input.inventoryPrices),
      weapons: sanitizeWeaponsMap(input.weaponsStock),
    },
    treasury: {
      legal: Math.max(0, Number(input.treasuryMoney.legal) || 0),
      illegal: Math.max(0, Number(input.treasuryMoney.illegal) || 0),
      rewards: sanitizeRewardStocksMap(input.rewardStocks),
      weaponsLossAmount: Math.max(0, Number(input.weaponsLossAmount) || 0),
    },
    hierarchy: {
      members: Object.values(membersArrayToMap(input.hierMembers)),
      rankings: sanitizeMemberRankings(input.memberRankings),
    },
    catalog: {
      groups: sanitizeCatalogGroups(input.catalogGroups),
    },
    album: cleanAlbum,
    albumMedia,
    history: sanitizeHistoryState(input.historyState),
  };
}

export function parseCartelBackupSnapshot(raw: unknown): {
  snapshot: CartelBackupSnapshot;
  preview: CartelBackupPreview;
} {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Fichier JSON invalide : objet attendu.');
  }
  const obj = raw as Record<string, unknown>;
  if (obj.schemaVersion !== 1 || !obj.missions || !obj.inventory || !obj.treasury) {
    throw new Error(
      'Format de sauvegarde non reconnu. Utilisez un fichier exporté depuis Los Cerberos.'
    );
  }

  const rawMissions = obj.missions as Record<string, unknown>;
  const rawEntries: MissionStates = {
    __week:
      typeof rawMissions.week === 'string' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(rawMissions.week)
        ? rawMissions.week
        : isoDate(currentWeekStart()),
  };
  if (rawMissions.entries && typeof rawMissions.entries === 'object') {
    Object.entries(rawMissions.entries as Record<string, unknown>)
      .slice(0, 120)
      .forEach(([k, v]) => {
        if (k !== '__week' && v && typeof v === 'object') {
          rawEntries[k] = sanitizeMissionEntry(v as MissionStateEntry);
        }
      });
  }
  const { week, entries } = splitMissionStates(rawEntries);
  const cleanSchedule = sanitizeScheduleMeta(
    rawMissions.scheduleOverrides,
    rawMissions.unplacedMissionIds,
    rawMissions.lastRecalcDate,
    rawMissions.lastRecalcAt
  );

  const rawInv = obj.inventory as Record<string, unknown>;
  const stock = sanitizeInventoryStockMap(rawInv.stock);
  const prices = sanitizeInventoryPrices(rawInv.prices);
  const weapons = sanitizeWeaponsMap(rawInv.weapons);

  const rawTreas = obj.treasury as Record<string, unknown>;
  const legal = Math.max(0, Number(rawTreas.legal) || 0);
  const illegal = Math.max(0, Number(rawTreas.illegal) || 0);
  const rewards = sanitizeRewardStocksMap(rawTreas.rewards);
  const weaponsLossAmount = Math.max(0, Number(rawTreas.weaponsLossAmount) || 0);

  const rawHier = (obj.hierarchy && typeof obj.hierarchy === 'object'
    ? obj.hierarchy
    : {}) as Record<string, unknown>;
  const rawMembersList = Array.isArray(rawHier.members)
    ? (rawHier.members as HierarchyMember[])
    : rawHier.members && typeof rawHier.members === 'object'
      ? (Object.values(rawHier.members as Record<string, unknown>) as HierarchyMember[])
      : HIER_DEFAULTS;
  const membersMap = membersArrayToMap(
    rawMembersList.length > 0 ? rawMembersList : HIER_DEFAULTS
  );
  const members = Object.values(membersMap);
  const rankings = sanitizeMemberRankings(rawHier.rankings);

  const rawCatalog = (obj.catalog && typeof obj.catalog === 'object'
    ? obj.catalog
    : {}) as Record<string, unknown>;
  const groups = sanitizeCatalogGroups(rawCatalog.groups ?? DEFAULT_CATALOG_GROUPS);

  const album = sanitizeAlbumState(obj.album);
  const albumMedia = sanitizeBackupAlbumMedia(obj.albumMedia);
  const history = sanitizeHistoryState(obj.history);

  const exportedAt =
    typeof obj.exportedAt === 'string' && obj.exportedAt.trim()
      ? obj.exportedAt.trim().slice(0, 40)
      : new Date().toISOString();

  const snapshot: CartelBackupSnapshot = {
    schemaVersion: 1,
    exportedAt,
    cartelId: CARTEL_ID,
    missions: {
      week,
      entries,
      ...cleanSchedule,
    },
    inventory: {
      stock,
      prices,
      weapons,
    },
    treasury: {
      legal,
      illegal,
      rewards,
      weaponsLossAmount,
    },
    hierarchy: {
      members,
      rankings,
    },
    catalog: {
      groups,
    },
    album,
    albumMedia,
    history,
  };

  const preview: CartelBackupPreview = {
    exportedAt,
    week,
    missionCount: Object.keys(entries).length,
    inventoryCount: Object.keys(stock).length,
    weaponsCount: Object.keys(weapons).length,
    legal,
    illegal,
    membersCount: members.length,
    catalogGroupsCount: Object.keys(groups).length,
    albumPhotosCount: Object.keys(album.photos).length,
    albumMediaCount: Object.keys(albumMedia).length,
    archivesCount: Object.keys(history.archives).length,
  };

  return { snapshot, preview };
}

export async function importCartelBackupSnapshot(
  uid: string,
  snapshot: CartelBackupSnapshot
): Promise<void> {
  const membersMap = membersArrayToMap(snapshot.hierarchy.members);

  const batch = writeBatch(db);
  batch.set(doc(db, 'cartels', CARTEL_ID, 'state', 'missions'), {
    week: snapshot.missions.week,
    entries: snapshot.missions.entries,
    scheduleOverrides: snapshot.missions.scheduleOverrides,
    unplacedMissionIds: snapshot.missions.unplacedMissionIds,
    lastRecalcDate: snapshot.missions.lastRecalcDate,
    lastRecalcAt: snapshot.missions.lastRecalcAt,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
  batch.set(doc(db, 'cartels', CARTEL_ID, 'state', 'inventory'), {
    stock: snapshot.inventory.stock,
    prices: snapshot.inventory.prices,
    weapons: snapshot.inventory.weapons,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
  batch.set(doc(db, 'cartels', CARTEL_ID, 'state', 'treasury'), {
    legal: snapshot.treasury.legal,
    illegal: snapshot.treasury.illegal,
    rewards: snapshot.treasury.rewards,
    weaponsLossAmount: snapshot.treasury.weaponsLossAmount,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
  batch.set(doc(db, 'cartels', CARTEL_ID, 'state', 'hierarchy'), {
    members: membersMap,
    rankings: snapshot.hierarchy.rankings,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
  batch.set(doc(db, 'cartels', CARTEL_ID, 'state', 'catalog'), {
    groups: snapshot.catalog.groups,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
  batch.set(doc(db, 'cartels', CARTEL_ID, 'state', 'album'), {
    photos: snapshot.album.photos,
    favorites: snapshot.album.favorites,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
  batch.set(doc(db, 'cartels', CARTEL_ID, 'state', 'history'), {
    archives: snapshot.history.archives,
    currentPayroll: snapshot.history.currentPayroll,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `cartels/${CARTEL_ID}/state/*`);
  }

  // Restore any embedded album media documents that do not already exist
  const mediaEntries = Object.entries(snapshot.albumMedia || {}).slice(0, 100);
  for (const [mediaId, entry] of mediaEntries) {
    const cleanId = mediaId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    if (!cleanId) continue;
    const mediaPath = `cartels/${CARTEL_ID}/albumMedia/${cleanId}`;
    const mediaRef = doc(db, 'cartels', CARTEL_ID, 'albumMedia', cleanId);
    try {
      const existing = await getDoc(mediaRef);
      if (existing.exists()) continue;
      await setDoc(mediaRef, {
        id: cleanId,
        imageUrl: entry.imageUrl,
        mimeType: entry.mimeType.slice(0, 40),
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, mediaPath);
    }
  }
}

