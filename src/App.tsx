import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  Archive,
  Banknote,
  BarChart3,
  BookOpen,
  Calendar,
  Camera,
  Car,
  ClipboardCopy,
  ExternalLink,
  Globe,
  LayoutDashboard,
  LayoutGrid,
  Lock,
  LogIn,
  LogOut,
  Menu,
  Newspaper,
  Package,
  ShoppingCart,
  Trophy,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { AuthModal } from '@/src/components/AuthModal';
import { DashboardHomeView } from '@/src/components/DashboardHomeView';
import type { MissionValidationPayload } from '@/src/components/MissionValidationModal';
import { OfflineIndicator } from '@/src/components/OfflineIndicator';
import { Toast, type ToastVariant } from '@/src/components/Toast';

const AccountingView = lazy(() =>
  import('@/src/components/AccountingView').then((m) => ({ default: m.AccountingView }))
);
const AlbumView = lazy(() =>
  import('@/src/components/AlbumView').then((m) => ({ default: m.AlbumView }))
);
const ArchivesView = lazy(() =>
  import('@/src/components/ArchivesView').then((m) => ({ default: m.ArchivesView }))
);
const CatalogView = lazy(() =>
  import('@/src/components/CatalogView').then((m) => ({ default: m.CatalogView }))
);
const DiscordGazetteModal = lazy(() =>
  import('@/src/components/DiscordGazetteModal').then((m) => ({
    default: m.DiscordGazetteModal,
  }))
);
const GarageView = lazy(() =>
  import('@/src/components/GarageView').then((m) => ({ default: m.GarageView }))
);
const HierarchyView = lazy(() =>
  import('@/src/components/HierarchyView').then((m) => ({ default: m.HierarchyView }))
);
const InventoryView = lazy(() =>
  import('@/src/components/InventoryView').then((m) => ({ default: m.InventoryView }))
);
const MissionValidationModal = lazy(() =>
  import('@/src/components/MissionValidationModal').then((m) => ({
    default: m.MissionValidationModal,
  }))
);
const OrdersView = lazy(() =>
  import('@/src/components/OrdersView').then((m) => ({ default: m.OrdersView }))
);
const PlanningView = lazy(() =>
  import('@/src/components/PlanningView').then((m) => ({ default: m.PlanningView }))
);
const RankingView = lazy(() =>
  import('@/src/components/RankingView').then((m) => ({ default: m.RankingView }))
);
const TreasuryView = lazy(() =>
  import('@/src/components/TreasuryView').then((m) => ({ default: m.TreasuryView }))
);
const WeeklyHistoryPayrollView = lazy(() =>
  import('@/src/components/WeeklyHistoryPayrollView').then((m) => ({
    default: m.WeeklyHistoryPayrollView,
  }))
);
import {
  DEFAULT_CATALOG_GROUPS,
  DEFAULT_SECRET_CODE,
  HIER_DEFAULTS,
  INVENTORY_ITEMS,
  PREVIOUS_REWARD_DEFAULTS,
  REWARD_ITEMS,
  TOTAL_WEEKLY_MISSIONS,
  WEEKLY_SCHEDULE,
} from '@/src/data/cartelData';
import {
  checkMissionStockAvailability,
  EMINENCE_MISSIONS,
  getEminenceCatalogItemsMap,
  getEminenceMissionByGearKey,
  getSoloKitStockRequirements,
  getStockKeyDisplayName,
  resolveCatalogItemStockKey,
} from '@/src/data/eminenceMissions';
import { auth, googleProvider } from '@/src/firebase';
import {
  archiveWeekAndResetMissions,
  bootstrapAndJoinCartel,
  claimDailyDiscordDispatch,
  createDefaultCurrentPayroll,
  DEFAULT_ALBUM_STATE,
  DEFAULT_DISCORD_CONFIG,
  DEFAULT_FLEET_STATE,
  DEFAULT_HISTORY_STATE,
  deleteAlbumPhotoWithMedia,
  isValidDiscordWebhookUrl,
  type LocalSeedData,
  lockEditorRole,
  type MemberRole,
  resetAllInventory,
  rollbackDailyDiscordDispatch,
  saveAlbumPhotoWithMedia,
  saveAlbumState,
  saveAllMissionEntries,
  saveAllMissionEntriesWithSideEffects,
  saveCatalogGroups,
  saveDiscordConfig,
  saveFleetState,
  saveHierarchyMembers,
  saveHistoryState,
  saveInventoryItem,
  saveInventoryItemPrice,
  saveInventoryPricesBatch,
  saveInventoryOrderReceipt,
  saveLootSale,
  saveMemberRankings,
  saveMissionEntry,
  saveMissionWithSideEffects,
  savePayrollSettlementWithTreasury,
  saveRewardItem,
  saveRewardPricesBatch,
  saveSchedulePlan,
  saveTreasuryMoneyField,
  saveWeaponLossGlobal,
  saveWeaponsLoss,
  saveWeaponsStock,
  saveWeaponsWithTreasury,
  subscribeCartelState,
  subscribeDiscordConfig,
  unlockEditorWithCode,
  updateCartelSecretCode,
} from '@/src/services/cartelFirestore';
import type {
  AlbumPhotoRecord,
  AlbumState,
  CatalogGroup,
  CatalogGroupsMap,
  CurrentWeekPayrollState,
  DiscordGazetteConfig,
  FleetState,
  GearKey,
  HierarchyMember,
  HierarchyUnitKey,
  HistoryState,
  InventoryPrices,
  InventoryStock,
  LostWeaponRecord,
  MemberRankingsMap,
  Mission,
  MissionScheduleMeta,
  MissionStateEntry,
  MissionStates,
  MissionStatus,
  RewardStockEntry,
  RewardStocks,
  TabKey,
  TreasuryMoney,
  WeaponsStock,
} from '@/src/types/cartel';
import {
  CATALOG_BUYBACK_ID_TO_REWARD_KEY,
  REWARD_KEY_TO_CATALOG_BUYBACK_ID,
  buildArchiveRecordFromWeek,
  buildDiscordReport,
  calcRewardsTotalValue,
  calcTotalWealth,
  calcUsedGearCost,
  computeSundayPayroll,
  currentWeekStart,
  formatMoney,
  getCatalogExtraInventoryItems,
  getCatalogStockKey,
  getInventoryItemPrice,
  getMissionCost,
  getMissionEntry,
  getStatus,
  isoDate,
  isWeekStale,
  missionFin,
  resolveCatalogSellItemPrice,
  weekRangeText,
} from '@/src/utils/finance';
import {
  EMPTY_SCHEDULE_META,
  applyManualMissionMove,
  applyManualMissionSwap,
  computeRecalculatedSchedule,
  getCurrentWeekTodayName,
  getEffectiveSchedule,
  getMsUntilNextDailyRecalc,
  isPastDailyRecalcTime,
} from '@/src/utils/schedule';
import { simulateMissionSupplyPlan } from '@/src/utils/missionSupply';

const LEGACY_STORAGE_KEYS = {
  missions: 'los_cerberos_local_state',
  inventory: 'los_cerberos_inventory_stock',
  treasury: 'los_cerberos_treasury_money',
  rewards: 'los_cerberos_rewards',
  weaponsLoss: 'los_cerberos_weapons_loss',
  secretCode: 'los_cerberos_secret_code',
  hierarchy: 'los_cerberos_hierarchy_members',
} as const;

function safeReadJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeReadString(key: string, fallback: string): string {
  try {
    return window.localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function readLegacyLocalSeed(): LocalSeedData {
  const loadedMissions = safeReadJson<MissionStates>(LEGACY_STORAGE_KEYS.missions, {});
  if (!loadedMissions.__week) {
    loadedMissions.__week = isoDate(currentWeekStart());
  }
  const savedHier = safeReadJson<HierarchyMember[] | null>(LEGACY_STORAGE_KEYS.hierarchy, null);
  const weaponsVal = Number(safeReadString(LEGACY_STORAGE_KEYS.weaponsLoss, '0'));
  return {
    missionStates: loadedMissions,
    inventoryStock: safeReadJson<InventoryStock>(LEGACY_STORAGE_KEYS.inventory, {}),
    treasuryMoney: safeReadJson<TreasuryMoney>(LEGACY_STORAGE_KEYS.treasury, {
      legal: 0,
      illegal: 0,
    }),
    rewardStocks: safeReadJson<RewardStocks>(LEGACY_STORAGE_KEYS.rewards, {}),
    weaponsLossAmount: Number.isFinite(weaponsVal) ? Math.max(0, weaponsVal) : 0,
    secretCode: safeReadString(LEGACY_STORAGE_KEYS.secretCode, DEFAULT_SECRET_CODE),
    hierMembers:
      savedHier && Array.isArray(savedHier) && savedHier.length > 0
        ? savedHier
        : HIER_DEFAULTS,
  };
}

function extractEntriesRecord(
  states: MissionStates
): Record<string, MissionStateEntry> {
  const entries: Record<string, MissionStateEntry> = {};
  Object.entries(states).forEach(([k, v]) => {
    if (k !== '__week' && v && typeof v === 'object') {
      entries[k] = v;
    }
  });
  return entries;
}

function buildValidationStockAlert(params: {
  debitedKeys: string[];
  missionGearKey: string;
  nextInventory: InventoryStock;
  catalogGroups?: CatalogGroupsMap;
}): { variant: ToastVariant; message: string } | null {
  const { debitedKeys, missionGearKey, nextInventory, catalogGroups } = params;
  const alerts: Array<{ variant: ToastVariant; text: string }> = [];

  const keysToCheck =
    debitedKeys.length > 0
      ? debitedKeys
      : missionGearKey !== 'none'
        ? [missionGearKey]
        : [];

  keysToCheck.forEach((gKey) => {
    const item = INVENTORY_ITEMS.find((i) => i.key === gKey);
    const remaining = Math.max(0, Math.floor(Number(nextInventory[gKey]) || 0));

    if (!item) {
      if (gKey.startsWith('cat_em_') && debitedKeys.includes(gKey)) {
        const label = getStockKeyDisplayName(gKey, catalogGroups);
        if (remaining === 0) {
          alerts.push({
            variant: 'critical',
            text: `Stock épuisé : 0 ${label} restant`,
          });
        } else if (remaining === 1) {
          alerts.push({
            variant: 'warning',
            text: `Plus que 1 ${label} en stock`,
          });
        }
      }
      return;
    }

    if (item.category === 'heist_pack') {
      if (remaining === 0) {
        if (!debitedKeys.includes(gKey) && checkMissionStockAvailability(gKey, nextInventory, catalogGroups).available) {
          return;
        }
        alerts.push({
          variant: 'critical',
          text:
            debitedKeys.includes(gKey)
              ? `Dernier ${item.name} utilisé (0 restant en stock)`
              : `Stock à 0 : ${item.name} manquant`,
        });
      }
      return;
    }

    if (item.category === 'tool' || item.category === 'protection') {
      if (remaining === 0) {
        if (!debitedKeys.includes(gKey) && checkMissionStockAvailability(gKey, nextInventory, catalogGroups).available) {
          return;
        }
        alerts.push({
          variant: 'critical',
          text: debitedKeys.includes(gKey)
            ? `Stock épuisé : 0 ${item.name} restant`
            : `Stock à 0 : ${item.name} manquant`,
        });
      } else if (remaining === 1 && debitedKeys.includes(gKey)) {
        alerts.push({
          variant: 'warning',
          text: `Plus que 1 ${item.name} en stock`,
        });
      }
    }
  });

  if (alerts.length === 0) return null;
  const hasCritical = alerts.some((a) => a.variant === 'critical');
  const prefix = hasCritical ? '🚨' : '⚠️';
  return {
    variant: hasCritical ? 'critical' : 'warning',
    message: `${prefix} ${alerts.map((a) => a.text).join(' · ')}`,
  };
}

export default function App() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cartelStatus, setCartelStatus] = useState<'loading' | 'ready' | 'uninitialized'>(
    'loading'
  );
  const [memberRole, setMemberRole] = useState<MemberRole>('viewer');
  const [syncError, setSyncError] = useState<Error | null>(null);
  const [retryCounter, setRetryCounter] = useState(0);

  const [missionStates, setMissionStates] = useState<MissionStates>(() => ({
    __week: isoDate(currentWeekStart()),
  }));
  const [scheduleMeta, setScheduleMeta] = useState<MissionScheduleMeta>(EMPTY_SCHEDULE_META);
  const [scheduleSynced, setScheduleSynced] = useState(false);
  const [inventoryStock, setInventoryStock] = useState<InventoryStock>({});
  const [inventoryPrices, setInventoryPrices] = useState<InventoryPrices>({});
  const [weaponsStock, setWeaponsStock] = useState<WeaponsStock>({});
  const [treasuryMoney, setTreasuryMoney] = useState<TreasuryMoney>({
    legal: 0,
    illegal: 0,
  });
  const [rewardStocks, setRewardStocks] = useState<RewardStocks>({});
  const [weaponsLossAmount, setWeaponsLossAmount] = useState<number>(0);
  const [hierMembers, setHierMembers] = useState<HierarchyMember[]>(HIER_DEFAULTS);
  const [memberRankings, setMemberRankings] = useState<MemberRankingsMap>({});
  const [catalogGroups, setCatalogGroups] = useState<CatalogGroupsMap>(DEFAULT_CATALOG_GROUPS);
  const [albumState, setAlbumState] = useState<AlbumState>(DEFAULT_ALBUM_STATE);
  const [fleetState, setFleetState] = useState<FleetState>(DEFAULT_FLEET_STATE);
  const [historyState, setHistoryState] = useState<HistoryState>(DEFAULT_HISTORY_STATE);
  const [discordConfig, setDiscordConfig] = useState<DiscordGazetteConfig>(DEFAULT_DISCORD_CONFIG);
  const [discordConfigSynced, setDiscordConfigSynced] = useState(false);
  const [hasDiscordEnvFallback, setHasDiscordEnvFallback] = useState(false);
  const [selectedCatalogGroupId, setSelectedCatalogGroupId] = useState<string>('marabunta');
  const [groupOrderCarts, setGroupOrderCarts] = useState<Record<string, Record<string, number>>>({});

  const [currentTab, setCurrentTab] = useState<TabKey>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [gazetteModalOpen, setGazetteModalOpen] = useState(false);
  const [validatingMission, setValidatingMission] = useState<{
    mission: Mission;
    dayName: string;
    initialStatus: 'success' | 'fail';
  } | null>(null);
  const [toastState, setToastState] = useState<{
    message: string;
    variant: ToastVariant;
    actionType?: 'stock' | 'loot';
  } | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [, setDayTick] = useState(() => isoDate(new Date()));
  const [recalcClockTick, setRecalcClockTick] = useState(() => Date.now());
  const toastTimerRef = useRef<number | null>(null);
  const didMigrateRewardPricesRef = useRef(false);
  const didMigrateWhiskeyCatalogRef = useRef(false);
  const didMigrateMarabuntaLinksRef = useRef(false);
  const didMigrateEminenceCatalogRef = useRef(false);
  const didMigrateConteneurFourgonRef = useRef(false);
  const didMigratePricesAndMunitionKeyRef = useRef(false);
  const didMigrateZeroInventoryPricesRef = useRef(false);
  const didTriggerSundayToastRef = useRef(false);
  const didMigrateOldWebhookRef = useRef(false);
  const autoRecalcAttemptedDateRef = useRef<string>('');
  const autoDiscordAttemptedDateRef = useRef<string>('');

  if (syncError) {
    throw syncError;
  }

  const showToast = useCallback(
    (
      msg: string,
      options?: {
        variant?: ToastVariant;
        durationMs?: number;
        withStockShortcut?: boolean;
        actionType?: 'stock' | 'loot';
      }
    ) => {
      const variant = options?.variant ?? 'default';
      const durationMs = options?.durationMs ?? (variant === 'default' ? 3500 : 6500);
      const actionType =
        options?.actionType ?? (options?.withStockShortcut ? 'stock' : undefined);
      setToastState({
        message: msg,
        variant,
        actionType,
      });
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      toastTimerRef.current = window.setTimeout(() => {
        setToastState(null);
      }, durationMs);
    },
    []
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthReady(true);
      if (!user) {
        setCartelStatus('loading');
        setMemberRole('viewer');
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !authUser) return;

    let cancelled = false;
    let unsubSync: (() => void) | null = null;
    setCartelStatus('loading');
    setScheduleSynced(false);

    const startSync = async () => {
      try {
        const seed = readLegacyLocalSeed();
        const status = await bootstrapAndJoinCartel(authUser, seed);
        if (cancelled) return;
        if (status === 'uninitialized') {
          setCartelStatus('uninitialized');
          return;
        }
        setCartelStatus('ready');
        unsubSync = subscribeCartelState(authUser.uid, {
          onMissions: (ms) => setMissionStates(ms),
          onScheduleMeta: (meta) => {
            setScheduleMeta(meta);
            setScheduleSynced(true);
          },
          onInventory: (stock) => setInventoryStock(stock),
          onInventoryPrices: (prices) => setInventoryPrices(prices),
          onWeapons: (weapons) => setWeaponsStock(weapons),
          onTreasury: (data) => {
            setTreasuryMoney(data.treasuryMoney);
            setRewardStocks(data.rewardStocks);
            setWeaponsLossAmount(data.weaponsLossAmount);
          },
          onHierarchy: (members) => setHierMembers(members),
          onMemberRankings: (rankings) => setMemberRankings(rankings),
          onCatalog: (groups) => setCatalogGroups(groups),
          onAlbum: (album) => setAlbumState(album),
          onHistory: (history) => setHistoryState(history),
          onFleet: (fleet) => setFleetState(fleet),
          onRole: (role) => setMemberRole(role),
          onError: (err) => setSyncError(err),
        });
      } catch (err) {
        if (!cancelled) {
          setSyncError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    };

    void startSync();

    return () => {
      cancelled = true;
      setScheduleSynced(false);
      if (unsubSync) unsubSync();
    };
  }, [authReady, authUser, retryCounter]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = isoDate(new Date());
      setDayTick((prev) => (prev !== now ? now : prev));
    }, 60000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const ms = getMsUntilNextDailyRecalc(new Date());
    const timer = window.setTimeout(() => {
      setRecalcClockTick(Date.now());
    }, ms);
    return () => window.clearTimeout(timer);
  }, [recalcClockTick]);

  const isUnlocked = memberRole === 'editor';
  const readonly = !isUnlocked;

  // Editor-only subscription to private Discord Gazette configuration & server fallback status
  useEffect(() => {
    if (cartelStatus !== 'ready' || !isUnlocked || !authUser) {
      setDiscordConfigSynced(false);
      setHasDiscordEnvFallback(false);
      setDiscordConfig(DEFAULT_DISCORD_CONFIG);
      return;
    }

    let cancelled = false;
    void authUser
      .getIdToken()
      .then((token) =>
        fetch('/api/discord/status', {
          headers: { Authorization: `Bearer ${token}` },
        })
      )
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { hasEnvFallback?: boolean } | null) => {
        if (!cancelled && json) {
          setHasDiscordEnvFallback(Boolean(json.hasEnvFallback));
        }
      })
      .catch(() => {
        // ignore status check error
      });

    const unsub = subscribeDiscordConfig({
      onConfig: (cfg) => {
        setDiscordConfig(cfg);
        setDiscordConfigSynced(true);
      },
      onError: (err) => setSyncError(err),
    });

    return () => {
      cancelled = true;
      unsub();
      setDiscordConfigSynced(false);
    };
  }, [cartelStatus, isUnlocked, authUser]);

  // Clear legacy hardcoded webhook in Firestore so updated server .env fallback takes effect
  useEffect(() => {
    if (
      didMigrateOldWebhookRef.current ||
      cartelStatus !== 'ready' ||
      !discordConfigSynced ||
      !isUnlocked ||
      !authUser
    ) {
      return;
    }
    if (!discordConfig.webhookUrl.includes('/api/webhooks/1574145344894406770/')) {
      return;
    }
    didMigrateOldWebhookRef.current = true;
    const nextCfg: DiscordGazetteConfig = {
      ...discordConfig,
      webhookUrl: '',
    };
    setDiscordConfig(nextCfg);
    void saveDiscordConfig(authUser.uid, nextCfg).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
  }, [cartelStatus, discordConfigSynced, isUnlocked, authUser, discordConfig]);

  // Schedule wake-up timer if Discord Gazette auto-send time is later today
  useEffect(() => {
    if (
      cartelStatus !== 'ready' ||
      !isUnlocked ||
      !authUser ||
      !discordConfig.autoEnabled
    ) {
      return;
    }
    const now = new Date();
    const target = new Date(now);
    target.setHours(discordConfig.sendHour, discordConfig.sendMinute, 2, 0);
    if (target.getTime() <= now.getTime()) return;
    const ms = Math.max(1000, target.getTime() - now.getTime());
    const timer = window.setTimeout(() => {
      setRecalcClockTick(Date.now());
    }, ms);
    return () => window.clearTimeout(timer);
  }, [
    cartelStatus,
    isUnlocked,
    authUser,
    discordConfig.autoEnabled,
    discordConfig.sendHour,
    discordConfig.sendMinute,
  ]);

  // Automatic daily 09:30 schedule recalculation for uncompleted overdue missions
  useEffect(() => {
    if (
      cartelStatus !== 'ready' ||
      !scheduleSynced ||
      !isUnlocked ||
      !authUser ||
      isWeekStale(missionStates)
    ) {
      return;
    }

    const now = new Date();
    const todayIso = isoDate(now);
    if (!isPastDailyRecalcTime(now)) return;
    if (scheduleMeta.lastRecalcDate === todayIso) return;
    if (autoRecalcAttemptedDateRef.current === todayIso) return;

    const todayDayName = getCurrentWeekTodayName(missionStates, now);
    if (!todayDayName) return;

    autoRecalcAttemptedDateRef.current = todayIso;
    const res = computeRecalculatedSchedule({
      missionStates,
      currentMeta: scheduleMeta,
      targetStartDayName: todayDayName,
      now,
    });

    setScheduleMeta(res.meta);
    void saveSchedulePlan(authUser.uid, res.meta).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );

    if (res.changed && (res.movedCount > 0 || res.unplacedCount > 0)) {
      const msg =
        res.unplacedCount > 0
          ? `Recalcul 09h30 : ${res.movedCount} mission(s) reportée(s), ${res.unplacedCount} hors quota.`
          : `Recalcul 09h30 : ${res.movedCount} mission(s) reportée(s) sur le reste de la semaine.`;
      showToast(msg);
    }
  }, [
    cartelStatus,
    scheduleSynced,
    isUnlocked,
    authUser,
    missionStates,
    scheduleMeta,
    recalcClockTick,
    showToast,
  ]);

  // Automatic daily Discord Gazette dispatch (at >= sendHour:sendMinute on first editor open)
  useEffect(() => {
    if (
      cartelStatus !== 'ready' ||
      !scheduleSynced ||
      !discordConfigSynced ||
      !isUnlocked ||
      !authUser
    ) {
      return;
    }

    const hasEffectiveWebhook =
      isValidDiscordWebhookUrl(discordConfig.webhookUrl) || hasDiscordEnvFallback;
    if (!discordConfig.autoEnabled || !hasEffectiveWebhook) {
      return;
    }

    const now = new Date();
    const todayIso = isoDate(now);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const targetMinutes = discordConfig.sendHour * 60 + discordConfig.sendMinute;
    if (nowMinutes < targetMinutes) return;

    // Wait for the 09:30 schedule recalc to run first when active this week
    if (
      !isWeekStale(missionStates) &&
      isPastDailyRecalcTime(now) &&
      getCurrentWeekTodayName(missionStates, now) &&
      scheduleMeta.lastRecalcDate !== todayIso
    ) {
      return;
    }

    if (discordConfig.lastSentDate === todayIso) return;
    if (autoDiscordAttemptedDateRef.current === todayIso) return;

    autoDiscordAttemptedDateRef.current = todayIso;
    const senderName =
      authUser.displayName || authUser.email?.split('@')[0] || 'Éditeur';

    void (async () => {
      let claimedPrev: {
        lastSentDate: string;
        lastSentAt: string;
        lastSentBy: string;
      } | null = null;
      try {
        const claim = await claimDailyDiscordDispatch(
          authUser.uid,
          todayIso,
          senderName,
          hasDiscordEnvFallback
        );
        if (!claim.claimed || !claim.config) return;
        claimedPrev = {
          lastSentDate: claim.previousLastSentDate,
          lastSentAt: claim.previousLastSentAt,
          lastSentBy: claim.previousLastSentBy,
        };

        const { buildDailyGazetteData, renderGazetteCanvasDataUrl, sendGazetteToDiscord } =
          await import('@/src/utils/discordGazette');
        const gazetteData = await buildDailyGazetteData({
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
          customMessage: claim.config.customMessage,
          now,
        });
        const imageBase64 = await renderGazetteCanvasDataUrl(gazetteData, {
          includePhoto: claim.config.includePhoto,
        });
        const idToken = await authUser.getIdToken();
        await sendGazetteToDiscord({
          idToken,
          webhookUrl: claim.config.webhookUrl,
          imageBase64,
          data: gazetteData,
          config: claim.config,
        });

        setDiscordConfig(claim.config);
        showToast('📰 Gazette quotidienne envoyée automatiquement sur Discord !');
      } catch (err) {
        if (claimedPrev) {
          void rollbackDailyDiscordDispatch(
            authUser.uid,
            todayIso,
            claimedPrev
          ).catch(() => {
            // ignore rollback secondary failure
          });
        }
        const msg = err instanceof Error ? err.message : 'Erreur Discord';
        showToast(`Échec de l’envoi auto Discord : ${msg}`, {
          variant: 'warning',
        });
      }
    })();
  }, [
    cartelStatus,
    scheduleSynced,
    discordConfigSynced,
    hasDiscordEnvFallback,
    isUnlocked,
    authUser,
    discordConfig,
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
    recalcClockTick,
    showToast,
  ]);

  useEffect(() => {
    if (
      didMigrateRewardPricesRef.current ||
      cartelStatus !== 'ready' ||
      !isUnlocked ||
      !authUser ||
      Object.keys(rewardStocks).length === 0
    ) {
      return;
    }

    didMigrateRewardPricesRef.current = true;
    const patch: Record<string, RewardStockEntry> = {};

    REWARD_ITEMS.forEach((item) => {
      const prevDefault = PREVIOUS_REWARD_DEFAULTS[item.key];
      const existing = rewardStocks[item.key];
      if (
        prevDefault !== undefined &&
        existing &&
        Number(existing.val) === prevDefault
      ) {
        patch[item.key] = {
          qty: Math.max(0, Number(existing.qty) || 0),
          val: item.defaultVal,
        };
      }
    });

    if (Object.keys(patch).length === 0) return;

    setRewardStocks((prev) => ({
      ...prev,
      ...patch,
    }));
    void saveRewardPricesBatch(authUser.uid, patch).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
  }, [cartelStatus, isUnlocked, authUser, rewardStocks]);

  useEffect(() => {
    if (
      didMigrateWhiskeyCatalogRef.current ||
      cartelStatus !== 'ready' ||
      !isUnlocked ||
      !authUser
    ) {
      return;
    }
    const brad = catalogGroups.brad_recel;
    const hasLegacyWhiskeyInBrad = brad?.items.some((it) => it.id === 'br_whiskey');
    if (!hasLegacyWhiskeyInBrad) return;

    didMigrateWhiskeyCatalogRef.current = true;
    const nextGroups: CatalogGroupsMap = {
      ...catalogGroups,
      brad_recel: {
        ...brad,
        items: brad.items.filter((it) => it.id !== 'br_whiskey'),
      },
      ...(catalogGroups.eminence
        ? {}
        : { eminence: DEFAULT_CATALOG_GROUPS.eminence }),
    };
    setCatalogGroups(nextGroups);
    void saveCatalogGroups(authUser.uid, nextGroups).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
  }, [cartelStatus, isUnlocked, authUser, catalogGroups]);

  useEffect(() => {
    if (
      didMigrateEminenceCatalogRef.current ||
      cartelStatus !== 'ready' ||
      !isUnlocked ||
      !authUser ||
      Object.keys(catalogGroups).length === 0
    ) {
      return;
    }

    didMigrateEminenceCatalogRef.current = true;
    if (catalogGroups.eminence) return;

    const legacyWhiskey = catalogGroups.whiskey_acheteur;
    const nextGroups: CatalogGroupsMap = { ...catalogGroups };
    const eminenceGroup = {
      ...DEFAULT_CATALOG_GROUPS.eminence,
      contacts:
        legacyWhiskey && legacyWhiskey.contacts.length > 0
          ? legacyWhiskey.contacts
          : DEFAULT_CATALOG_GROUPS.eminence.contacts,
    };
    nextGroups.eminence = eminenceGroup;

    if (
      legacyWhiskey &&
      legacyWhiskey.items.every((it) => it.id === 'wh_whiskey' || it.id === 'br_whiskey')
    ) {
      delete nextGroups.whiskey_acheteur;
    }

    setCatalogGroups(nextGroups);
    void saveCatalogGroups(authUser.uid, nextGroups).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
  }, [cartelStatus, isUnlocked, authUser, catalogGroups]);

  useEffect(() => {
    if (
      didMigrateMarabuntaLinksRef.current ||
      cartelStatus !== 'ready' ||
      !isUnlocked ||
      !authUser
    ) {
      return;
    }
    const marabunta = catalogGroups.marabunta;
    if (!marabunta) return;

    didMigrateMarabuntaLinksRef.current = true;
    const expectedLinks: Record<string, GearKey> = {
      mg_9mm: 'mun_9mm',
      mg_45acp: 'mun_45acp',
      mg_44mag: 'mun_44mag',
      mg_50ae: 'mun_50ae',
      mg_chg_fusil: 'acc_chg_fusil',
      mg_chg_pompe: 'acc_chg_pompe',
      mg_lunette_macro: 'acc_lunette_macro',
      mg_poignee: 'acc_poignee',
      mg_petite_lunette: 'acc_petite_lunette',
    };

    let changed = false;
    const updatedItems = marabunta.items.map((item) => {
      const targetKey = expectedLinks[item.id];
      if (!targetKey) return item;
      if (!item.linkedGearKey || item.linkedGearKey === 'mun_pistolet') {
        changed = true;
        return { ...item, linkedGearKey: targetKey };
      }
      return item;
    });

    if (!changed) return;

    const nextGroups: CatalogGroupsMap = {
      ...catalogGroups,
      marabunta: {
        ...marabunta,
        items: updatedItems,
      },
    };
    setCatalogGroups(nextGroups);
    void saveCatalogGroups(authUser.uid, nextGroups).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
  }, [cartelStatus, isUnlocked, authUser, catalogGroups]);

  useEffect(() => {
    if (didMigrateConteneurFourgonRef.current) return;
    if (cartelStatus !== 'ready' || !isUnlocked || !authUser) return;
    const eminence = catalogGroups.eminence;
    if (!eminence) return;

    didMigrateConteneurFourgonRef.current = true;
    let changed = false;

    const filteredItems = eminence.items.filter((item) => {
      if (item.id === 'em_pack_08_conteneurs') {
        changed = true;
        return false;
      }
      return true;
    });

    const updatedItems = filteredItems.map((item) => {
      if (item.id === 'em_cle_fourgon') {
        if (item.linkedGearKey !== 'frg' || item.notes !== 'Documents · Stock unifié Fourgon') {
          changed = true;
          return {
            ...item,
            linkedGearKey: 'frg' as GearKey,
            notes: 'Documents · Stock unifié Fourgon',
          };
        }
      } else if (item.id === 'em_pack_04_fourgon' && item.notes === 'Pack braquage · Perceuse de forage') {
        changed = true;
        return { ...item, notes: 'Pack braquage · Clé fourgon blindé' };
      } else if (item.id === 'em_pack_06_fleeca' && item.notes === 'Pack braquage · Perceuse de forage') {
        changed = true;
        return { ...item, notes: 'Pack braquage · Clé banque Fleeca + Perceuse' };
      } else if (item.id === 'em_pack_09_train' && item.notes === 'Pack braquage · Meuleuse de forage') {
        changed = true;
        return { ...item, notes: 'Pack braquage · Clé braquage train + Meuleuse' };
      }
      return item;
    });

    if (!changed) return;

    const nextGroups: CatalogGroupsMap = {
      ...catalogGroups,
      eminence: {
        ...eminence,
        items: updatedItems,
      },
    };
    setCatalogGroups(nextGroups);
    void saveCatalogGroups(authUser.uid, nextGroups).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
  }, [cartelStatus, isUnlocked, authUser, catalogGroups]);

  useEffect(() => {
    if (didMigratePricesAndMunitionKeyRef.current) return;
    if (cartelStatus !== 'ready' || !isUnlocked || !authUser) return;
    if (Object.keys(catalogGroups).length === 0) return;

    didMigratePricesAndMunitionKeyRef.current = true;

    let catalogChanged = false;
    const nextGroups: CatalogGroupsMap = { ...catalogGroups };

    if (catalogGroups.eminence) {
      const nextEminenceItems = catalogGroups.eminence.items.filter((item) => {
        if (item.id === 'em_cle_munition') {
          catalogChanged = true;
          return false;
        }
        return true;
      });
      if (catalogChanged) {
        nextGroups.eminence = {
          ...catalogGroups.eminence,
          items: nextEminenceItems,
        };
      }
    }

    if (catalogGroups.marabunta) {
      let marabuntaChanged = false;
      const nextMarabuntaItems = catalogGroups.marabunta.items.map((item) => {
        if (item.id === 'mg_gilet' && Number(item.price) === 0) {
          marabuntaChanged = true;
          return {
            ...item,
            price: 500,
            notes:
              item.notes === 'Protection renforcée · Tarif à confirmer avec le contact'
                ? 'Protection renforcée · Tarif unitaire 500 $'
                : item.notes,
          };
        }
        return item;
      });
      if (marabuntaChanged) {
        catalogChanged = true;
        nextGroups.marabunta = {
          ...catalogGroups.marabunta,
          items: nextMarabuntaItems,
        };
      }
    }

    if (catalogChanged) {
      setCatalogGroups(nextGroups);
      void saveCatalogGroups(authUser.uid, nextGroups).catch((err) =>
        setSyncError(err instanceof Error ? err : new Error(String(err)))
      );
    }
  }, [cartelStatus, isUnlocked, authUser, catalogGroups]);

  useEffect(() => {
    if (didMigrateZeroInventoryPricesRef.current) return;
    if (cartelStatus !== 'ready' || !isUnlocked || !authUser) return;

    const priceFixes: Array<{ key: string; price: number }> = [];
    if (inventoryPrices.gilet === 0) {
      priceFixes.push({ key: 'gilet', price: 500 });
    }
    if (inventoryPrices.drg === 0) {
      priceFixes.push({ key: 'drg', price: 750 });
    }
    if (priceFixes.length === 0) return;

    didMigrateZeroInventoryPricesRef.current = true;
    setInventoryPrices((prev) => {
      const next = { ...prev };
      priceFixes.forEach((p) => {
        next[p.key] = p.price;
      });
      return next;
    });
    priceFixes.forEach((p) => {
      void saveInventoryItemPrice(authUser.uid, p.key, p.price).catch((err) =>
        setSyncError(err instanceof Error ? err : new Error(String(err)))
      );
    });
  }, [cartelStatus, isUnlocked, authUser, inventoryPrices]);

  useEffect(() => {
    if (didTriggerSundayToastRef.current || cartelStatus !== 'ready') return;
    const now = new Date();
    if (now.getDay() !== 0) return;

    const sundayKey = `cerberos_sunday_toast_${isoDate(now)}`;
    try {
      if (window.localStorage.getItem(sundayKey) === '1') {
        didTriggerSundayToastRef.current = true;
        return;
      }
    } catch {
      // ignore storage errors
    }

    didTriggerSundayToastRef.current = true;
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(sundayKey, '1');
      } catch {
        // ignore storage errors
      }
      showToast(
        "💎 C'est dimanche : jour de revente du cartel ! Pensez à vendre vos objets en coffre.",
        {
          variant: 'warning',
          durationMs: 8500,
          actionType: 'loot',
        }
      );
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [cartelStatus, showToast]);

  const kpis = useMemo(() => {
    let totalCost = 0;
    let extraLoss = 0;
    let grossGains = 0;
    let successCount = 0;
    let failCount = 0;

    WEEKLY_SCHEDULE.forEach((day) => {
      day.missions.forEach((mission) => {
        const f = missionFin(mission, missionStates, inventoryPrices, catalogGroups);
        if (f.success) successCount++;
        if (f.fail) failCount++;
        totalCost += f.cost;
        extraLoss += f.extra;
        grossGains += f.gain;
      });
    });

    const netProfit = grossGains - (totalCost + extraLoss + weaponsLossAmount);

    const rewardsValTotal = calcRewardsTotalValue(rewardStocks);
    const rewardsItemCount = REWARD_ITEMS.reduce(
      (sum, item) => sum + Math.max(0, Number(rewardStocks[item.key]?.qty) || 0),
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

    return {
      successCount,
      failCount,
      grossGains,
      netProfit,
      totalWealth,
      rewardsValTotal,
      rewardsItemCount,
    };
  }, [
    missionStates,
    weaponsLossAmount,
    rewardStocks,
    treasuryMoney,
    inventoryStock,
    inventoryPrices,
    weaponsStock,
    catalogGroups,
  ]);

  const handleGoToOrderPrep = useCallback(() => {
    setToastState(null);
    setCurrentTab('orders');
    window.setTimeout(() => {
      const el = document.getElementById('order-prep-panel');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 80);
  }, []);

  const handleGoToLootSale = useCallback(() => {
    setToastState(null);
    setCurrentTab('inventory');
    window.setTimeout(() => {
      const el = document.getElementById('loot-sale-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 80);
  }, []);

  const staleWeek = isWeekStale(missionStates);
  const todayText = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code?: string }).code)
          : '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        showToast('Connexion annulée.');
        return;
      }
      if (code === 'auth/unauthorized-domain') {
        const host = window.location.hostname;
        const msg = `Domaine non autorisé (${host}). Ajoutez "${host}" dans Firebase Console > Authentication > Settings > Domaines autorisés.`;
        setAuthError(msg);
        showToast('Domaine non autorisé pour la connexion Google.');
        return;
      }
      if (code === 'auth/popup-blocked') {
        const msg = 'La fenêtre pop-up Google a été bloquée par le navigateur. Autorisez les pop-ups pour ce site puis réessayez.';
        setAuthError(msg);
        showToast('Pop-up bloquée par le navigateur.');
        return;
      }
      const msg = `Erreur lors de la connexion Google${code ? ` (${code})` : ''}.`;
      setAuthError(msg);
      showToast(msg);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      showToast('Déconnecté.');
    } catch {
      showToast('Erreur lors de la déconnexion.');
    }
  };

  const handleSetMissionStatus = (id: string, status: Exclude<MissionStatus, ''>) => {
    if (readonly || !authUser) return;
    const cur = getMissionEntry(missionStates, id);
    const prevStatus = getStatus(cur);
    const next = prevStatus === status ? '' : status;
    const mission = WEEKLY_SCHEDULE.flatMap((d) => d.missions).find((m) => m.id === id);

    let nextGearConsumed = Boolean(cur.gearConsumed);
    let nextUsedGear: Record<string, number> =
      cur.usedGear && typeof cur.usedGear === 'object' ? { ...cur.usedGear } : {};
    if (
      Object.keys(nextUsedGear).length === 0 &&
      cur.gearConsumed &&
      mission &&
      mission.gearKey !== 'none'
    ) {
      if (INVENTORY_ITEMS.some((i) => i.key === mission.gearKey)) {
        nextUsedGear[mission.gearKey] = 1;
      } else if (mission.gearKey === 'amu') {
        nextUsedGear.cat_em_cle_ammunation = 1;
      }
    }

    let inventoryPatch: Record<string, number> | undefined;
    if (prevStatus === '' && next !== '' && mission && mission.gearKey !== 'none') {
      const currentQty = inventoryStock[mission.gearKey] || 0;
      if (currentQty > 0) {
        const updatedQty = currentQty - 1;
        inventoryPatch = { [mission.gearKey]: updatedQty };
        nextGearConsumed = true;
        nextUsedGear = { ...nextUsedGear, [mission.gearKey]: (nextUsedGear[mission.gearKey] || 0) + 1 };
        setInventoryStock((prev) => ({ ...prev, [mission.gearKey]: updatedQty }));
      } else {
        const soloReqs = getSoloKitStockRequirements(mission.gearKey, catalogGroups);
        const canUseSolo =
          soloReqs.length > 0 &&
          soloReqs.every(
            ({ stockKey, qty }) =>
              Math.max(0, Math.floor(Number(inventoryStock[stockKey]) || 0)) >= qty
          );
        if (canUseSolo) {
          inventoryPatch = {};
          const updatedStock = { ...inventoryStock };
          soloReqs.forEach(({ stockKey, qty }) => {
            const updatedQty = Math.max(0, (updatedStock[stockKey] || 0) - qty);
            updatedStock[stockKey] = updatedQty;
            inventoryPatch![stockKey] = updatedQty;
            nextUsedGear[stockKey] = (nextUsedGear[stockKey] || 0) + qty;
          });
          nextGearConsumed = true;
          setInventoryStock(updatedStock);
        }
      }
    } else if (prevStatus !== '' && next === '') {
      const keysToRestore = Object.keys(nextUsedGear);
      if (keysToRestore.length > 0) {
        inventoryPatch = {};
        const updatedStock = { ...inventoryStock };
        keysToRestore.forEach((gKey) => {
          const count = Math.max(0, Number(nextUsedGear[gKey]) || 0);
          if (count <= 0) return;
          const updatedQty = (updatedStock[gKey] || 0) + count;
          updatedStock[gKey] = updatedQty;
          inventoryPatch![gKey] = updatedQty;
        });
        setInventoryStock(updatedStock);
        nextUsedGear = {};
        nextGearConsumed = false;
      } else if (cur.gearConsumed && mission && mission.gearKey !== 'none') {
        const fallbackKey =
          mission.gearKey === 'amu' ? 'cat_em_cle_ammunation' : mission.gearKey;
        const updatedQty = (inventoryStock[fallbackKey] || 0) + 1;
        inventoryPatch = { [fallbackKey]: updatedQty };
        nextGearConsumed = false;
        setInventoryStock((prev) => ({ ...prev, [fallbackKey]: updatedQty }));
      }
    }

    let nextGain = Number(cur.gain) || 0;
    let nextCashGain = Math.max(0, Number(cur.cashGain) || 0);
    let nextLoot = cur.loot ? { ...cur.loot } : {};
    let rewardPatches: Record<string, RewardStockEntry> | undefined;
    let nextLegalBalance = Math.max(0, Number(treasuryMoney.legal) || 0);
    let nextIllegalBalance = Math.max(0, Number(treasuryMoney.illegal) || 0);
    let legalTouched = false;
    let illegalTouched = false;

    if (prevStatus === 'success' && next !== 'success') {
      if (Object.keys(nextLoot).length > 0) {
        rewardPatches = {};
        const nextRewards = { ...rewardStocks };
        Object.entries(nextLoot).forEach(([rKey, lQty]) => {
          const count = Math.max(0, Number(lQty) || 0);
          if (count <= 0) return;
          const itemRef = REWARD_ITEMS.find((i) => i.key === rKey);
          const existing = nextRewards[rKey] || { qty: 0, val: itemRef ? itemRef.defaultVal : 200 };
          const unitVal = existing.val !== undefined ? Number(existing.val) : itemRef ? itemRef.defaultVal : 200;
          const updatedEntry: RewardStockEntry = {
            qty: Math.max(0, (Number(existing.qty) || 0) - count),
            val: unitVal,
          };
          nextRewards[rKey] = updatedEntry;
          rewardPatches![rKey] = updatedEntry;
          nextGain = Math.max(0, nextGain - count * unitVal);
        });
        setRewardStocks(nextRewards);
        nextLoot = {};
      }
      if (nextCashGain > 0) {
        nextIllegalBalance = Math.max(0, nextIllegalBalance - nextCashGain);
        illegalTouched = true;
        nextGain = Math.max(0, nextGain - nextCashGain);
        nextCashGain = 0;
      }
    }

    let nextExtra = Number(cur.extra) || 0;
    let nextLostWeapons: LostWeaponRecord[] = Array.isArray(cur.lostWeapons)
      ? [...cur.lostWeapons]
      : [];
    let nextWeaponsArg: WeaponsStock | undefined;
    let nextCashLossDebitAccount: 'none' | 'legal' | 'illegal' =
      cur.cashLossDebitAccount === 'legal' || cur.cashLossDebitAccount === 'illegal'
        ? cur.cashLossDebitAccount
        : 'none';
    let nextCashLossDebitAmount = Math.max(0, Number(cur.cashLossDebitAmount) || 0);

    if (prevStatus !== '' && next === '') {
      if (nextLostWeapons.length > 0) {
        const updatedWeapons = { ...weaponsStock };
        nextLostWeapons.forEach((lw) => {
          const existing = updatedWeapons[lw.id];
          if (existing) {
            updatedWeapons[lw.id] = {
              ...existing,
              qty: Math.max(1, (Number(existing.qty) || 0) + 1),
            };
          } else if (lw.id) {
            updatedWeapons[lw.id] = {
              id: lw.id,
              name: lw.name,
              value: Math.max(0, Number(lw.value) || 0),
              qty: 1,
              holderId: lw.holderId || 'coffre',
              notes: '',
            };
          }
        });
        setWeaponsStock(updatedWeapons);
        nextWeaponsArg = updatedWeapons;
        nextLostWeapons = [];
      }

      if (nextCashLossDebitAmount > 0 && nextCashLossDebitAccount !== 'none') {
        if (nextCashLossDebitAccount === 'legal') {
          nextLegalBalance += nextCashLossDebitAmount;
          legalTouched = true;
        } else {
          nextIllegalBalance += nextCashLossDebitAmount;
          illegalTouched = true;
        }
      }

      nextGain = 0;
      nextCashGain = 0;
      nextLoot = {};
      nextExtra = 0;
      nextLostWeapons = [];
      nextCashLossDebitAccount = 'none';
      nextCashLossDebitAmount = 0;
    }

    let resetTreasuryPatch: Partial<TreasuryMoney> | undefined;
    if (legalTouched || illegalTouched) {
      resetTreasuryPatch = {};
      if (legalTouched) resetTreasuryPatch.legal = nextLegalBalance;
      if (illegalTouched) resetTreasuryPatch.illegal = nextIllegalBalance;
      setTreasuryMoney((prev) => ({
        ...prev,
        ...(legalTouched ? { legal: nextLegalBalance } : {}),
        ...(illegalTouched ? { illegal: nextIllegalBalance } : {}),
      }));
    }

    const updatedEntry: MissionStateEntry = {
      ...cur,
      status: next,
      completed: next !== '',
      gain: nextGain,
      cashGain: nextCashGain,
      extra: nextExtra,
      players: Array.isArray(cur.players) ? cur.players : [],
      gearConsumed: nextGearConsumed,
      usedGear: nextUsedGear,
      loot: nextLoot,
      lostWeapons: nextLostWeapons,
      cashLossDebitAccount: nextCashLossDebitAccount,
      cashLossDebitAmount: nextCashLossDebitAmount,
    };
    setMissionStates((prev) => ({ ...prev, [id]: updatedEntry }));

    if (inventoryPatch || rewardPatches || nextWeaponsArg !== undefined || resetTreasuryPatch) {
      void saveMissionWithSideEffects(authUser.uid, id, updatedEntry, {
        inventoryPatch,
        rewardPatches,
        weapons: nextWeaponsArg,
        treasuryMoneyPatch: resetTreasuryPatch,
      }).catch((err) => setSyncError(err instanceof Error ? err : new Error(String(err))));
    } else {
      void saveMissionEntry(authUser.uid, id, updatedEntry).catch((err) =>
        setSyncError(err instanceof Error ? err : new Error(String(err)))
      );
    }

    const hasTrackableMissionGear =
      !!mission &&
      mission.gearKey !== 'none' &&
      (INVENTORY_ITEMS.some((i) => i.key === mission.gearKey) ||
        Boolean(getEminenceMissionByGearKey(mission.gearKey)) ||
        getMissionCost(mission, inventoryPrices, catalogGroups) > 0);

    if (prevStatus === '' && next !== '' && mission && hasTrackableMissionGear) {
      const updatedMap = inventoryPatch
        ? { ...inventoryStock, ...inventoryPatch }
        : inventoryStock;
      const stockAlert = buildValidationStockAlert({
        debitedKeys: inventoryPatch ? Object.keys(inventoryPatch) : [],
        missionGearKey: mission.gearKey,
        nextInventory: updatedMap,
        catalogGroups,
      });

      const debitedEntries = inventoryPatch ? Object.entries(nextUsedGear) : [];
      const debitedLabel =
        debitedEntries.length > 0
          ? debitedEntries
              .map(([k, q]) => `${q}× ${getStockKeyDisplayName(k, catalogGroups)}`)
              .join(' + ')
          : getStockKeyDisplayName(
              mission.gearKey === 'amu' ? 'cat_em_cle_ammunation' : mission.gearKey,
              catalogGroups
            );
      const debitedCost =
        inventoryPatch && Object.keys(nextUsedGear).length > 0
          ? calcUsedGearCost(nextUsedGear, inventoryPrices, catalogGroups).cost
          : getMissionCost(mission, inventoryPrices, catalogGroups);

      if (stockAlert) {
        const baseMsg = inventoryPatch
          ? `Mission validée (-${debitedLabel})`
          : `Mission validée`;
        showToast(`${stockAlert.message} · ${baseMsg}`, {
          variant: stockAlert.variant,
          withStockShortcut: true,
        });
      } else if (inventoryPatch) {
        showToast(
          `Mission validée — ${debitedLabel} débité de l'inventaire (-${formatMoney(debitedCost)}).`
        );
      } else {
        showToast(`Mission validée (stock ${debitedLabel} déjà à 0).`);
      }
    } else if (prevStatus !== '' && next === '' && (inventoryPatch || resetTreasuryPatch)) {
      showToast('Mission annulée — matériel et trésorerie restaurés.');
    }
  };

  const handleOpenMissionValidation = (
    mission: Mission,
    dayName: string,
    initialStatus: 'success' | 'fail'
  ) => {
    if (readonly) {
      setAuthModalOpen(true);
      showToast("Déverrouillez l'édition avec le code secret pour valider une mission.");
      return;
    }
    setValidatingMission({ mission, dayName, initialStatus });
  };

  const handleConfirmMissionValidation = (payload: MissionValidationPayload) => {
    if (readonly || !authUser) return;
    const mission = WEEKLY_SCHEDULE.flatMap((d) => d.missions).find(
      (m) => m.id === payload.missionId
    );
    if (!mission) return;

    const cur = getMissionEntry(missionStates, payload.missionId);

    // 1. Material stock diff (supports any inventory items used on the mission)
    const prevUsedGear: Record<string, number> = {};
    if (cur.usedGear && typeof cur.usedGear === 'object') {
      Object.entries(cur.usedGear).forEach(([k, q]) => {
        const qty = Math.max(0, Math.floor(Number(q) || 0));
        if (qty > 0) prevUsedGear[k] = qty;
      });
    }
    if (
      Object.keys(prevUsedGear).length === 0 &&
      cur.gearConsumed &&
      mission.gearKey !== 'none'
    ) {
      if (INVENTORY_ITEMS.some((i) => i.key === mission.gearKey)) {
        prevUsedGear[mission.gearKey] = 1;
      } else if (mission.gearKey === 'amu') {
        prevUsedGear.cat_em_cle_ammunation = 1;
      }
    }

    const nextUsedGear: Record<string, number> = {};
    const inventoryPatch: Record<string, number> = {};
    const nextInventory = { ...inventoryStock };
    const newlyDebitedLabels: string[] = [];
    const newlyDebitedKeys: string[] = [];
    const allGearKeys = new Set([
      ...Object.keys(prevUsedGear),
      ...Object.keys(payload.usedGear || {}),
    ]);

    allGearKeys.forEach((gKey) => {
      const oldQty = Math.max(0, Math.floor(Number(prevUsedGear[gKey]) || 0));
      const wantQty = Math.max(0, Math.floor(Number(payload.usedGear[gKey]) || 0));
      const curStock = Math.max(0, Math.floor(Number(nextInventory[gKey]) || 0));
      const maxAllowed = curStock + oldQty;
      const clampedNext = Math.min(wantQty, maxAllowed);
      if (clampedNext > 0) {
        nextUsedGear[gKey] = clampedNext;
      }
      const diff = clampedNext - oldQty;
      if (diff !== 0) {
        const updatedStockQty = Math.max(0, curStock - diff);
        nextInventory[gKey] = updatedStockQty;
        inventoryPatch[gKey] = updatedStockQty;
        if (diff > 0) {
          const gName = getStockKeyDisplayName(gKey, catalogGroups);
          newlyDebitedLabels.push(`-${diff} ${gName}`);
          newlyDebitedKeys.push(gKey);
        }
      }
    });

    const hasInventoryPatch = Object.keys(inventoryPatch).length > 0;
    if (hasInventoryPatch) {
      setInventoryStock(nextInventory);
    }
    const nextGearConsumed = Object.keys(nextUsedGear).length > 0;

    // 2. Loot & Reward stock diff
    const prevLoot = cur.loot || {};
    const nextLoot = payload.status === 'success' ? payload.loot : {};
    const allLootKeys = new Set([...Object.keys(prevLoot), ...Object.keys(nextLoot)]);
    const rewardPatches: Record<string, RewardStockEntry> = {};
    const nextRewards = { ...rewardStocks };
    let lootValTotal = 0;

    allLootKeys.forEach((rKey) => {
      const itemRef = REWARD_ITEMS.find((i) => i.key === rKey);
      if (!itemRef) return;
      const oldQty = Math.max(0, Number(prevLoot[rKey]) || 0);
      const newQty = Math.max(0, Number(nextLoot[rKey]) || 0);
      const existing = nextRewards[rKey] || { qty: 0, val: itemRef.defaultVal };
      const unitVal =
        existing.val !== undefined ? Math.max(0, Number(existing.val) || 0) : itemRef.defaultVal;
      lootValTotal += newQty * unitVal;
      const diff = newQty - oldQty;
      if (diff !== 0) {
        const updatedReward: RewardStockEntry = {
          qty: Math.max(0, (Number(existing.qty) || 0) + diff),
          val: unitVal,
        };
        nextRewards[rKey] = updatedReward;
        rewardPatches[rKey] = updatedReward;
      }
    });
    if (Object.keys(rewardPatches).length > 0) {
      setRewardStocks(nextRewards);
    }

    // 3. Weapons stock diff (restore previous lost weapons then deduct new lost weapons)
    const prevLost = Array.isArray(cur.lostWeapons) ? cur.lostWeapons : [];
    const nextLost = payload.lostWeapons;
    const nextWeapons = { ...weaponsStock };
    let weaponsTouched = prevLost.length > 0 || nextLost.length > 0;

    if (weaponsTouched) {
      prevLost.forEach((lw) => {
        if (!lw.id) return;
        const existing = nextWeapons[lw.id];
        if (existing) {
          nextWeapons[lw.id] = {
            ...existing,
            qty: Math.max(1, (Number(existing.qty) || 0) + 1),
          };
        } else {
          nextWeapons[lw.id] = {
            id: lw.id,
            name: lw.name,
            value: Math.max(0, Number(lw.value) || 0),
            qty: 1,
            holderId: lw.holderId || 'coffre',
            notes: '',
          };
        }
      });

      nextLost.forEach((lw) => {
        if (!lw.id) return;
        const existing = nextWeapons[lw.id];
        if (!existing) return;
        if ((Number(existing.qty) || 0) <= 1) {
          delete nextWeapons[lw.id];
        } else {
          nextWeapons[lw.id] = {
            ...existing,
            qty: existing.qty - 1,
          };
        }
      });

      setWeaponsStock(nextWeapons);
    } else {
      weaponsTouched = false;
    }

    // 4. Credit mission dirty cash gain to Argent Sale (illegal) & apply optional treasury cash debit
    let nextLegal = Math.max(0, Number(treasuryMoney.legal) || 0);
    let nextIllegal = Math.max(0, Number(treasuryMoney.illegal) || 0);
    let legalTouched = false;
    let illegalTouched = false;

    const prevCashGain = Math.max(0, Number(cur.cashGain) || 0);
    const nextCashGain =
      payload.status === 'success' ? Math.max(0, Number(payload.cashGain) || 0) : 0;
    const cashGainDiff = nextCashGain - prevCashGain;
    if (cashGainDiff !== 0) {
      nextIllegal = Math.max(0, nextIllegal + cashGainDiff);
      illegalTouched = true;
    }

    const prevDebitAccount =
      cur.cashLossDebitAccount === 'legal' || cur.cashLossDebitAccount === 'illegal'
        ? cur.cashLossDebitAccount
        : 'none';
    const prevDebitAmount =
      prevDebitAccount !== 'none' ? Math.max(0, Number(cur.cashLossDebitAmount) || 0) : 0;

    if (prevDebitAmount > 0 && prevDebitAccount !== 'none') {
      if (prevDebitAccount === 'legal') {
        nextLegal += prevDebitAmount;
        legalTouched = true;
      } else {
        nextIllegal += prevDebitAmount;
        illegalTouched = true;
      }
    }

    const nextDebitAccount: 'none' | 'legal' | 'illegal' =
      payload.treasuryDebitAccount !== 'none' && payload.treasuryDebitAmount > 0
        ? payload.treasuryDebitAccount
        : 'none';
    const nextDebitAmount =
      nextDebitAccount !== 'none'
        ? Math.max(0, Math.round(Number(payload.treasuryDebitAmount) || 0))
        : 0;

    if (nextDebitAccount !== 'none' && nextDebitAmount > 0) {
      if (nextDebitAccount === 'legal') {
        nextLegal = Math.max(0, nextLegal - nextDebitAmount);
        legalTouched = true;
      } else {
        nextIllegal = Math.max(0, nextIllegal - nextDebitAmount);
        illegalTouched = true;
      }
    }

    let treasuryMoneyPatch: Partial<TreasuryMoney> | undefined;
    if (legalTouched || illegalTouched) {
      treasuryMoneyPatch = {};
      if (legalTouched) treasuryMoneyPatch.legal = nextLegal;
      if (illegalTouched) treasuryMoneyPatch.illegal = nextIllegal;
      setTreasuryMoney((prev) => ({
        ...prev,
        ...(legalTouched ? { legal: nextLegal } : {}),
        ...(illegalTouched ? { illegal: nextIllegal } : {}),
      }));
    }

    const weaponsLossVal = nextLost.reduce((s, w) => s + Math.max(0, Number(w.value) || 0), 0);
    const nextGain = payload.status === 'success' ? lootValTotal + nextCashGain : 0;
    const nextExtra = weaponsLossVal + Math.max(0, payload.cashLoss);

    const updatedEntry: MissionStateEntry = {
      ...cur,
      status: payload.status,
      completed: true,
      gain: nextGain,
      cashGain: nextCashGain,
      extra: nextExtra,
      players: payload.players,
      gearConsumed: nextGearConsumed,
      usedGear: nextUsedGear,
      loot: nextLoot,
      lostWeapons: nextLost,
      cashLossDebitAccount: nextDebitAccount,
      cashLossDebitAmount: nextDebitAmount,
    };

    setMissionStates((prev) => ({ ...prev, [payload.missionId]: updatedEntry }));
    setValidatingMission(null);

    const hasSideEffects =
      hasInventoryPatch ||
      Object.keys(rewardPatches).length > 0 ||
      weaponsTouched ||
      Boolean(treasuryMoneyPatch);

    if (hasSideEffects) {
      void saveMissionWithSideEffects(authUser.uid, payload.missionId, updatedEntry, {
        inventoryPatch: hasInventoryPatch ? inventoryPatch : undefined,
        rewardPatches: Object.keys(rewardPatches).length > 0 ? rewardPatches : undefined,
        weapons: weaponsTouched ? nextWeapons : undefined,
        treasuryMoneyPatch,
      }).catch((err) => setSyncError(err instanceof Error ? err : new Error(String(err))));
    } else {
      void saveMissionEntry(authUser.uid, payload.missionId, updatedEntry).catch((err) =>
        setSyncError(err instanceof Error ? err : new Error(String(err)))
      );
    }

    const gearSummary =
      newlyDebitedLabels.length > 0 ? ` · Stock débité : ${newlyDebitedLabels.join(', ')}` : '';
    const cashSummary =
      cashGainDiff > 0
        ? ` · Argent Sale : +${formatMoney(cashGainDiff)}`
        : cashGainDiff < 0
          ? ` · Argent Sale : -${formatMoney(Math.abs(cashGainDiff))}`
          : '';

    const stockAlert = buildValidationStockAlert({
      debitedKeys: newlyDebitedKeys,
      missionGearKey: mission.gearKey,
      nextInventory,
      catalogGroups,
    });

    if (stockAlert) {
      showToast(
        `${stockAlert.message} · Mission "${mission.name}" validée${cashSummary}`,
        {
          variant: stockAlert.variant,
          withStockShortcut: true,
        }
      );
    } else {
      showToast(
        `Mission "${mission.name}" validée (${payload.status === 'success' ? 'Réussie' : 'Échouée'})${gearSummary}${cashSummary} !`
      );
    }

    // Instant Discord alerts for critical events (non-blocking)
    const canSendInstantAlert =
      (discordConfig.alertsEnabled ?? true) &&
      (isValidDiscordWebhookUrl(discordConfig.webhookUrl) || hasDiscordEnvFallback);

    if (canSendInstantAlert) {
      const isMajorFail = payload.status === 'fail' && Boolean(mission.major);
      const hasWeaponLoss = nextLost.length > 0;
      const isCriticalStockZero = stockAlert?.variant === 'critical';

      if (isMajorFail || hasWeaponLoss || isCriticalStockZero) {
        const alertReasons: string[] = [];
        if (isMajorFail) alertReasons.push(`Échec opération majeure : ${mission.name}`);
        if (hasWeaponLoss) {
          alertReasons.push(
            `${nextLost.length} arme${nextLost.length > 1 ? 's' : ''} perdue${nextLost.length > 1 ? 's' : ''} (${formatMoney(weaponsLossVal)})`
          );
        }
        if (isCriticalStockZero && stockAlert) {
          alertReasons.push(stockAlert.message.replace(/^🚨\s*/, ''));
        }

        const alertFields: Array<{ name: string; value: string; inline?: boolean }> = [
          {
            name: 'Opération',
            value: `${mission.name} (${payload.status === 'success' ? 'Réussie' : 'Échouée'})`,
            inline: true,
          },
          {
            name: 'Équipe',
            value: payload.players.length > 0 ? payload.players.join(', ') : 'Non renseignée',
            inline: true,
          },
        ];
        if (hasWeaponLoss) {
          alertFields.push({
            name: 'Armes perdues',
            value: nextLost.map((w) => `${w.name} (${formatMoney(w.value)})`).join(' · '),
            inline: false,
          });
        }
        if (isCriticalStockZero && stockAlert) {
          alertFields.push({
            name: 'Rupture stock',
            value: stockAlert.message,
            inline: false,
          });
        }

        const alertTitle = isMajorFail
          ? `Alerte Échec Majeur — ${mission.name}`
          : hasWeaponLoss
            ? `Perte d'Arme Signalée — ${mission.name}`
            : `Rupture de Stock Critique — ${mission.name}`;

        void authUser
          .getIdToken()
          .then(async (idToken) => {
            const { sendInstantDiscordAlert } = await import('@/src/utils/discordGazette');
            return sendInstantDiscordAlert({
              idToken,
              webhookUrl: discordConfig.webhookUrl,
              severity: isMajorFail || hasWeaponLoss ? 'critical' : 'warning',
              title: alertTitle,
              description: alertReasons.join('\n'),
              fields: alertFields,
              footer: `Los Cerberos · Validé par ${authUser.displayName || authUser.email?.split('@')[0] || 'Éditeur'}`,
            });
          })
          .catch(() => {
            // Non-blocking alert: ignore network failure so mission save is never disrupted
          });
      }
    }
  };

  const handleResetMissionFromModal = (missionId: string) => {
    const cur = getMissionEntry(missionStates, missionId);
    const currentStatus = getStatus(cur);
    if (currentStatus) {
      handleSetMissionStatus(missionId, currentStatus);
    }
  };

  const bulkToggleMissions = (missions: Mission[]): boolean => {
    if (!authUser) return false;
    const allDone = missions.every((m) => getStatus(getMissionEntry(missionStates, m.id)) !== '');
    const week = missionStates.__week || isoDate(currentWeekStart());
    const nextStates: MissionStates = { ...missionStates, __week: week };
    const nextInventory = { ...inventoryStock };
    const inventoryPatch: Record<string, number> = {};
    const nextRewards = { ...rewardStocks };
    const rewardPatches: Record<string, RewardStockEntry> = {};
    const nextWeapons = { ...weaponsStock };
    let weaponsTouched = false;
    let bulkLegalDelta = 0;
    let bulkIllegalDelta = 0;

    missions.forEach((m) => {
      const cur = getMissionEntry(missionStates, m.id);
      const prevStatus = getStatus(cur);
      const status: MissionStatus = allDone ? '' : prevStatus || 'success';

      let nextGearConsumed = Boolean(cur.gearConsumed);
      let nextUsedGear: Record<string, number> =
        cur.usedGear && typeof cur.usedGear === 'object' ? { ...cur.usedGear } : {};
      if (
        Object.keys(nextUsedGear).length === 0 &&
        cur.gearConsumed &&
        m.gearKey !== 'none'
      ) {
        if (INVENTORY_ITEMS.some((i) => i.key === m.gearKey)) {
          nextUsedGear[m.gearKey] = 1;
        } else if (m.gearKey === 'amu') {
          nextUsedGear.cat_em_cle_ammunation = 1;
        }
      }

      if (prevStatus === '' && status !== '' && m.gearKey !== 'none') {
        const curQty = nextInventory[m.gearKey] || 0;
        if (curQty > 0) {
          nextInventory[m.gearKey] = curQty - 1;
          inventoryPatch[m.gearKey] = curQty - 1;
          nextGearConsumed = true;
          nextUsedGear = { ...nextUsedGear, [m.gearKey]: (nextUsedGear[m.gearKey] || 0) + 1 };
        } else {
          const soloReqs = getSoloKitStockRequirements(m.gearKey, catalogGroups);
          const canUseSolo =
            soloReqs.length > 0 &&
            soloReqs.every(
              ({ stockKey, qty }) =>
                Math.max(0, Math.floor(Number(nextInventory[stockKey]) || 0)) >= qty
            );
          if (canUseSolo) {
            soloReqs.forEach(({ stockKey, qty }) => {
              const updatedQty = Math.max(0, (nextInventory[stockKey] || 0) - qty);
              nextInventory[stockKey] = updatedQty;
              inventoryPatch[stockKey] = updatedQty;
              nextUsedGear[stockKey] = (nextUsedGear[stockKey] || 0) + qty;
            });
            nextGearConsumed = true;
          }
        }
      } else if (prevStatus !== '' && status === '') {
        const keys = Object.keys(nextUsedGear);
        if (keys.length > 0) {
          keys.forEach((gKey) => {
            const count = Math.max(0, Number(nextUsedGear[gKey]) || 0);
            if (count <= 0) return;
            const updatedQty = (nextInventory[gKey] || 0) + count;
            nextInventory[gKey] = updatedQty;
            inventoryPatch[gKey] = updatedQty;
          });
          nextUsedGear = {};
          nextGearConsumed = false;
        } else if (cur.gearConsumed && m.gearKey !== 'none') {
          const fallbackKey = m.gearKey === 'amu' ? 'cat_em_cle_ammunation' : m.gearKey;
          const updatedQty = (nextInventory[fallbackKey] || 0) + 1;
          nextInventory[fallbackKey] = updatedQty;
          inventoryPatch[fallbackKey] = updatedQty;
          nextGearConsumed = false;
        }
      }

      let nextGain = Number(cur.gain) || 0;
      let nextCashGain = Math.max(0, Number(cur.cashGain) || 0);
      let nextLoot = cur.loot ? { ...cur.loot } : {};
      if (prevStatus === 'success' && status !== 'success') {
        if (Object.keys(nextLoot).length > 0) {
          Object.entries(nextLoot).forEach(([rKey, lQty]) => {
            const count = Math.max(0, Number(lQty) || 0);
            if (count <= 0) return;
            const itemRef = REWARD_ITEMS.find((i) => i.key === rKey);
            const existing = nextRewards[rKey] || { qty: 0, val: itemRef ? itemRef.defaultVal : 200 };
            const unitVal = existing.val !== undefined ? Number(existing.val) : itemRef ? itemRef.defaultVal : 200;
            const updatedEntry: RewardStockEntry = {
              qty: Math.max(0, (Number(existing.qty) || 0) - count),
              val: unitVal,
            };
            nextRewards[rKey] = updatedEntry;
            rewardPatches[rKey] = updatedEntry;
            nextGain = Math.max(0, nextGain - count * unitVal);
          });
          nextLoot = {};
        }
        if (nextCashGain > 0) {
          bulkIllegalDelta -= nextCashGain;
          nextGain = Math.max(0, nextGain - nextCashGain);
          nextCashGain = 0;
        }
      }

      let nextExtra = Number(cur.extra) || 0;
      let nextLostWeapons: LostWeaponRecord[] = Array.isArray(cur.lostWeapons)
        ? [...cur.lostWeapons]
        : [];
      let nextCashLossDebitAccount: 'none' | 'legal' | 'illegal' =
        cur.cashLossDebitAccount === 'legal' || cur.cashLossDebitAccount === 'illegal'
          ? cur.cashLossDebitAccount
          : 'none';
      let nextCashLossDebitAmount = Math.max(0, Number(cur.cashLossDebitAmount) || 0);

      if (prevStatus !== '' && status === '') {
        if (nextLostWeapons.length > 0) {
          nextLostWeapons.forEach((lw) => {
            const existing = nextWeapons[lw.id];
            if (existing) {
              nextWeapons[lw.id] = {
                ...existing,
                qty: Math.max(1, (Number(existing.qty) || 0) + 1),
              };
            } else if (lw.id) {
              nextWeapons[lw.id] = {
                id: lw.id,
                name: lw.name,
                value: Math.max(0, Number(lw.value) || 0),
                qty: 1,
                holderId: lw.holderId || 'coffre',
                notes: '',
              };
            }
            weaponsTouched = true;
          });
        }

        if (nextCashLossDebitAmount > 0 && nextCashLossDebitAccount !== 'none') {
          if (nextCashLossDebitAccount === 'legal') {
            bulkLegalDelta += nextCashLossDebitAmount;
          } else {
            bulkIllegalDelta += nextCashLossDebitAmount;
          }
        }

        nextGain = 0;
        nextCashGain = 0;
        nextLoot = {};
        nextExtra = 0;
        nextLostWeapons = [];
        nextCashLossDebitAccount = 'none';
        nextCashLossDebitAmount = 0;
      }

      nextStates[m.id] = {
        ...cur,
        status,
        completed: status !== '',
        gain: nextGain,
        cashGain: nextCashGain,
        extra: nextExtra,
        players: Array.isArray(cur.players) ? cur.players : [],
        gearConsumed: nextGearConsumed,
        usedGear: nextUsedGear,
        loot: nextLoot,
        lostWeapons: nextLostWeapons,
        cashLossDebitAccount: nextCashLossDebitAccount,
        cashLossDebitAmount: nextCashLossDebitAmount,
      };
    });

    if (Object.keys(inventoryPatch).length > 0) setInventoryStock(nextInventory);
    if (Object.keys(rewardPatches).length > 0) setRewardStocks(nextRewards);
    if (weaponsTouched) setWeaponsStock(nextWeapons);

    let bulkTreasuryPatch: Partial<TreasuryMoney> | undefined;
    if (bulkLegalDelta !== 0 || bulkIllegalDelta !== 0) {
      bulkTreasuryPatch = {};
      if (bulkLegalDelta !== 0) {
        bulkTreasuryPatch.legal = Math.max(0, (Number(treasuryMoney.legal) || 0) + bulkLegalDelta);
      }
      if (bulkIllegalDelta !== 0) {
        bulkTreasuryPatch.illegal = Math.max(0, (Number(treasuryMoney.illegal) || 0) + bulkIllegalDelta);
      }
      setTreasuryMoney((prev) => ({
        ...prev,
        ...bulkTreasuryPatch,
      }));
    }

    setMissionStates(nextStates);

    const hasSideEffects =
      Object.keys(inventoryPatch).length > 0 ||
      Object.keys(rewardPatches).length > 0 ||
      weaponsTouched ||
      Boolean(bulkTreasuryPatch);

    if (hasSideEffects) {
      void saveAllMissionEntriesWithSideEffects(authUser.uid, week, extractEntriesRecord(nextStates), {
        inventoryPatch: Object.keys(inventoryPatch).length > 0 ? inventoryPatch : undefined,
        rewardPatches: Object.keys(rewardPatches).length > 0 ? rewardPatches : undefined,
        weapons: weaponsTouched ? nextWeapons : undefined,
        treasuryMoneyPatch: bulkTreasuryPatch,
      }).catch((err) => setSyncError(err instanceof Error ? err : new Error(String(err))));
    } else {
      void saveAllMissionEntries(authUser.uid, week, extractEntriesRecord(nextStates)).catch((err) =>
        setSyncError(err instanceof Error ? err : new Error(String(err)))
      );
    }
    return allDone;
  };

  const handleToggleWholeDay = (dayName: string) => {
    if (readonly) return;
    const effective = getEffectiveSchedule(missionStates, scheduleMeta);
    const dayObj = effective.days.find((d) => d.day === dayName);
    if (!dayObj) return;
    const cleared = bulkToggleMissions(dayObj.missions);
    showToast(cleared ? `${dayName} remis à zéro` : `Journée de ${dayName} validée !`);
  };

  const handleRecalculateScheduleNow = () => {
    if (readonly || !authUser) return;
    if (isWeekStale(missionStates)) {
      showToast('Démarrez d’abord la nouvelle semaine avant de recalculer le planning.');
      return;
    }
    const now = new Date();
    const targetStartDayName = getCurrentWeekTodayName(missionStates, now) || 'Lundi';
    const res = computeRecalculatedSchedule({
      missionStates,
      currentMeta: scheduleMeta,
      targetStartDayName,
      now,
    });
    autoRecalcAttemptedDateRef.current = res.meta.lastRecalcDate;
    setScheduleMeta(res.meta);
    void saveSchedulePlan(authUser.uid, res.meta).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );

    if (res.movedCount === 0 && res.unplacedCount === 0) {
      showToast('Planning à jour : aucune mission en retard à reporter.');
    } else if (res.unplacedCount > 0) {
      showToast(
        `Planning recalculé : ${res.movedCount} reportée(s), ${res.unplacedCount} hors quota règlement.`
      );
    } else {
      showToast(`Planning recalculé : ${res.movedCount} mission(s) répartie(s) sur la semaine !`);
    }
  };

  const handleResetScheduleOverrides = () => {
    if (readonly || !authUser) return;
    const now = new Date();
    const todayIso = isoDate(now);
    const nextMeta: MissionScheduleMeta = {
      scheduleOverrides: {},
      unplacedMissionIds: [],
      lastRecalcDate: todayIso,
      lastRecalcAt: now.toISOString(),
    };
    autoRecalcAttemptedDateRef.current = todayIso;
    setScheduleMeta(nextMeta);
    void saveSchedulePlan(authUser.uid, nextMeta).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
    showToast("Planning d'origine restauré !");
  };

  const handleMoveMissionDay = (missionId: string, targetDayName: string) => {
    if (readonly || !authUser) return;
    const mission = WEEKLY_SCHEDULE.flatMap((d) => d.missions).find(
      (m) => m.id === missionId
    );
    const nextMeta = applyManualMissionMove(scheduleMeta, missionId, targetDayName);
    setScheduleMeta(nextMeta);
    void saveSchedulePlan(authUser.uid, nextMeta).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
    showToast(
      `📅 ${mission?.name || 'Mission'} déplacée sur ${targetDayName} !`
    );
  };

  const handleSwapMissions = (missionAId: string, missionBId: string) => {
    if (readonly || !authUser) return;
    const allMissions = WEEKLY_SCHEDULE.flatMap((d) => d.missions);
    const mA = allMissions.find((m) => m.id === missionAId);
    const mB = allMissions.find((m) => m.id === missionBId);
    const nextMeta = applyManualMissionSwap(scheduleMeta, missionAId, missionBId);
    setScheduleMeta(nextMeta);
    void saveSchedulePlan(authUser.uid, nextMeta).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
    showToast(
      `🔄 Échange validé : ${mA?.name || 'Mission 1'} ↔ ${mB?.name || 'Mission 2'} !`
    );
  };

  const handleToggleAllWeek = () => {
    if (readonly) return;
    const cleared = bulkToggleMissions(WEEKLY_SCHEDULE.flatMap((d) => d.missions));
    showToast(
      cleared ? 'Toutes les missions remises à zéro' : 'Toute la semaine validée !'
    );
  };

  const buildUniqueArchiveId = (
    weekKey: string,
    existingArchives: Record<string, unknown>
  ): string => {
    const cleanBase = weekKey.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48) || 'week';
    if (!existingArchives[cleanBase]) return cleanBase;
    return `${cleanBase}_${Date.now().toString(36)}`.slice(0, 64);
  };

  const handleStartNewWeek = () => {
    if (readonly || !authUser) return;
    const closingWeek = missionStates.__week || isoDate(currentWeekStart());
    const newWeek = isoDate(currentWeekStart());
    const hasActivity =
      kpis.successCount + kpis.failCount > 0 ||
      weaponsLossAmount > 0 ||
      historyState.currentPayroll.settled;

    const nextArchives = { ...historyState.archives };
    if (hasActivity) {
      const archiveId = buildUniqueArchiveId(closingWeek, nextArchives);
      const actorName =
        authUser.displayName || authUser.email?.split('@')[0] || 'Éditeur';
      nextArchives[archiveId] = buildArchiveRecordFromWeek({
        archiveId,
        archivedBy: actorName,
        missionStates,
        scheduleMeta,
        weaponsLossAmount,
        members: hierMembers,
        inventoryPrices,
        catalogGroups,
        currentPayroll: historyState.currentPayroll,
        treasuryMoney,
        rewardStocks,
        inventoryStock,
        weaponsStock,
        memberRankings,
      });
    }

    const nextHistoryState: HistoryState = {
      archives: nextArchives,
      currentPayroll: createDefaultCurrentPayroll(newWeek),
    };

    autoRecalcAttemptedDateRef.current = '';
    setMissionStates({ __week: newWeek });
    setScheduleMeta(EMPTY_SCHEDULE_META);
    setWeaponsLossAmount(0);
    setHistoryState(nextHistoryState);
    void archiveWeekAndResetMissions(authUser.uid, {
      historyState: nextHistoryState,
      nextWeek: newWeek,
      weaponsLossAmount: 0,
    }).catch((err) => setSyncError(err instanceof Error ? err : new Error(String(err))));
    showToast(
      hasActivity
        ? 'Semaine précédente archivée et nouvelle semaine démarrée !'
        : 'Nouvelle semaine démarrée !'
    );
  };

  const handleUpdateStock = (key: string, delta: number, deductIllegal: boolean = true) => {
    if (readonly || !authUser) return;
    const prevQty = Math.max(0, Number(inventoryStock[key]) || 0);
    const nextQty = Math.max(0, prevQty + delta);
    const addedQty = Math.max(0, nextQty - prevQty);
    setInventoryStock((prev) => ({
      ...prev,
      [key]: nextQty,
    }));

    const stdItem = INVENTORY_ITEMS.find((i) => i.key === key);
    const extraItem = stdItem
      ? undefined
      : getCatalogExtraInventoryItems(catalogGroups).find((i) => i.key === key);
    const unitPrice = getInventoryItemPrice(key, inventoryPrices, extraItem?.price);
    const cost = addedQty * unitPrice;

    if (deductIllegal && addedQty > 0 && cost > 0) {
      const currentIllegal = Math.max(0, Number(treasuryMoney.illegal) || 0);
      const updatedIllegal = Math.max(0, currentIllegal - cost);
      setTreasuryMoney((prev) => ({ ...prev, illegal: updatedIllegal }));
      void saveInventoryOrderReceipt(
        authUser.uid,
        { [key]: nextQty },
        { illegal: updatedIllegal }
      ).catch((err) => setSyncError(err instanceof Error ? err : new Error(String(err))));

      const itemName = stdItem?.name || extraItem?.name || key;
      if (currentIllegal < cost) {
        showToast(
          `+${addedQty} ${itemName} · Argent Sale à 0 $ (manquait ${formatMoney(cost - currentIllegal)})`,
          { variant: 'warning' }
        );
      } else {
        showToast(`+${addedQty} ${itemName} · -${formatMoney(cost)} Argent Sale`);
      }
      return;
    }

    void saveInventoryItem(authUser.uid, key, nextQty).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
  };

  const handleUpdateItemPrice = (key: string, price: number) => {
    if (readonly || !authUser) return;
    const cleanPrice = Math.max(0, Math.round(Number(price) || 0));
    setInventoryPrices((prev) => ({
      ...prev,
      [key]: cleanPrice,
    }));
    void saveInventoryItemPrice(authUser.uid, key, cleanPrice).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );

    let catalogChanged = false;
    const nextGroups: CatalogGroupsMap = {};
    Object.entries(catalogGroups).forEach(([gId, grp]) => {
      let grpChanged = false;
      const nextItems = grp.items.map((item) => {
        if (item.tradeType !== 'sell') return item;
        const itemStockKey = resolveCatalogItemStockKey(item);
        if (itemStockKey === key && Math.round(Number(item.price) || 0) !== cleanPrice) {
          grpChanged = true;
          catalogChanged = true;
          return { ...item, price: cleanPrice };
        }
        return item;
      });
      nextGroups[gId] = grpChanged ? { ...grp, items: nextItems } : grp;
    });

    if (catalogChanged) {
      setCatalogGroups(nextGroups);
      void saveCatalogGroups(authUser.uid, nextGroups).catch((err) =>
        setSyncError(err instanceof Error ? err : new Error(String(err)))
      );
    }
  };

  const handleResetStock = () => {
    if (readonly || !authUser) return;
    setInventoryStock({});
    void resetAllInventory(authUser.uid).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
    showToast('Inventaire remis à zéro !');
  };

  const handleSaveWeapon = (payload: {
    id?: string;
    name: string;
    value: number;
    qty: number;
    holderId: string;
    notes: string;
    deductIllegal?: boolean;
  }) => {
    if (readonly || !authUser) return;
    const id = payload.id || 'w_' + Date.now().toString(36);
    const cleanName = payload.name.trim().slice(0, 80);
    const cleanVal = Math.max(0, Number(payload.value) || 0);
    const cleanQty = Math.max(1, Math.floor(Number(payload.qty) || 1));
    const prevQty = payload.id
      ? Math.max(1, Math.floor(Number(weaponsStock[payload.id]?.qty) || 1))
      : 0;
    const addedUnits = payload.id ? Math.max(0, cleanQty - prevQty) : cleanQty;

    const nextWeapons: WeaponsStock = {
      ...weaponsStock,
      [id]: {
        id,
        name: cleanName,
        value: cleanVal,
        qty: cleanQty,
        holderId: payload.holderId || 'coffre',
        notes: payload.notes.trim().slice(0, 160),
      },
    };
    setWeaponsStock(nextWeapons);

    const shouldDeduct =
      payload.id ? Boolean(payload.deductIllegal) : payload.deductIllegal !== false;
    const cost = addedUnits * cleanVal;

    if (shouldDeduct && cost > 0) {
      const currentIllegal = Math.max(0, Number(treasuryMoney.illegal) || 0);
      const updatedIllegal = Math.max(0, currentIllegal - cost);
      setTreasuryMoney((prev) => ({ ...prev, illegal: updatedIllegal }));
      void saveWeaponsWithTreasury(authUser.uid, nextWeapons, {
        illegal: updatedIllegal,
      }).catch((err) => setSyncError(err instanceof Error ? err : new Error(String(err))));

      if (currentIllegal < cost) {
        showToast(
          `${cleanName} (${addedUnits}x) ajoutée · Argent Sale à 0 $ (manquait ${formatMoney(cost - currentIllegal)})`,
          { variant: 'warning' }
        );
      } else {
        showToast(
          `${cleanName} (${addedUnits}x) ajoutée · -${formatMoney(cost)} Argent Sale`
        );
      }
      return;
    }

    void saveWeaponsStock(authUser.uid, nextWeapons).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
    showToast(payload.id ? 'Équipement mis à jour.' : 'Ajouté à l’arsenal.');
  };

  const handleUpdateWeaponQty = (
    id: string,
    delta: number,
    deductIllegal: boolean = true
  ) => {
    if (readonly || !authUser) return;
    const existing = weaponsStock[id];
    if (!existing) return;
    const prevQty = Math.max(1, Math.floor(Number(existing.qty) || 1));
    const nextQty = Math.max(1, prevQty + delta);
    const addedQty = Math.max(0, nextQty - prevQty);
    const nextWeapons: WeaponsStock = {
      ...weaponsStock,
      [id]: { ...existing, qty: nextQty },
    };
    setWeaponsStock(nextWeapons);

    const unitVal = Math.max(0, Number(existing.value) || 0);
    const cost = addedQty * unitVal;

    if (deductIllegal && addedQty > 0 && cost > 0) {
      const currentIllegal = Math.max(0, Number(treasuryMoney.illegal) || 0);
      const updatedIllegal = Math.max(0, currentIllegal - cost);
      setTreasuryMoney((prev) => ({ ...prev, illegal: updatedIllegal }));
      void saveWeaponsWithTreasury(authUser.uid, nextWeapons, {
        illegal: updatedIllegal,
      }).catch((err) => setSyncError(err instanceof Error ? err : new Error(String(err))));

      if (currentIllegal < cost) {
        showToast(
          `+${addedQty} ${existing.name} · Argent Sale à 0 $ (manquait ${formatMoney(cost - currentIllegal)})`,
          { variant: 'warning' }
        );
      } else {
        showToast(`+${addedQty} ${existing.name} · -${formatMoney(cost)} Argent Sale`);
      }
      return;
    }

    void saveWeaponsStock(authUser.uid, nextWeapons).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
  };

  const handleDeleteWeapon = (id: string) => {
    if (readonly || !authUser) return;
    const nextWeapons = { ...weaponsStock };
    delete nextWeapons[id];
    setWeaponsStock(nextWeapons);
    void saveWeaponsStock(authUser.uid, nextWeapons).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
    showToast('Arme retirée de l’arsenal.');
  };

  const handleLoseWeaponGlobal = (weaponId: string) => {
    if (readonly || !authUser) return;
    const weapon = weaponsStock[weaponId];
    if (!weapon || (Number(weapon.qty) || 0) <= 0) return;

    const weaponVal = Math.max(0, Number(weapon.value) || 0);
    const nextWeapons = { ...weaponsStock };
    if (weapon.qty <= 1) {
      delete nextWeapons[weaponId];
    } else {
      nextWeapons[weaponId] = { ...weapon, qty: weapon.qty - 1 };
    }
    const nextLossAmount = Math.max(0, (Number(weaponsLossAmount) || 0) + weaponVal);

    setWeaponsStock(nextWeapons);
    setWeaponsLossAmount(nextLossAmount);
    void saveWeaponLossGlobal(authUser.uid, nextWeapons, nextLossAmount).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
    showToast(
      `${weapon.name} déclarée perdue (-1 en stock, +${formatMoney(weaponVal)} en pertes globales).`
    );
  };

  const handleReceiveOrder = (
    orderMap: Record<string, number>,
    debitAccount: 'none' | 'legal' | 'illegal',
    debitAmount: number
  ) => {
    if (readonly || !authUser) return;
    const stockPatch: Record<string, number> = {};
    const nextStock = { ...inventoryStock };
    let totalAdded = 0;

    Object.entries(orderMap).forEach(([k, qty]) => {
      const addQty = Math.max(0, Math.floor(Number(qty) || 0));
      if (addQty <= 0) return;
      const updated = Math.max(0, Math.floor(Number(nextStock[k]) || 0)) + addQty;
      nextStock[k] = updated;
      stockPatch[k] = updated;
      totalAdded += addQty;
    });

    if (totalAdded <= 0) return;
    setInventoryStock(nextStock);

    let treasuryPatch: Partial<TreasuryMoney> | undefined;
    if (debitAccount !== 'none' && debitAmount > 0) {
      const current = Math.max(0, Number(treasuryMoney[debitAccount]) || 0);
      const updatedBal = Math.max(0, current - debitAmount);
      treasuryPatch = { [debitAccount]: updatedBal };
      setTreasuryMoney((prev) => ({ ...prev, [debitAccount]: updatedBal }));
    }

    void saveInventoryOrderReceipt(authUser.uid, stockPatch, treasuryPatch).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );

    const debitMsg =
      debitAccount !== 'none' && debitAmount > 0
        ? ` (-${formatMoney(debitAmount)} ${debitAccount === 'legal' ? 'Argent Légal' : 'Argent Sale'})`
        : '';
    showToast(`Commande réceptionnée : +${totalAdded} pièce${totalAdded > 1 ? 's' : ''} ajoutée${totalAdded > 1 ? 's' : ''} au stock${debitMsg} !`);
  };

  const handleSaveCatalogGroups = (nextGroups: CatalogGroupsMap) => {
    if (readonly || !authUser) return;

    const prevItemsByKey = new Map<string, CatalogGroup['items'][number]>();
    Object.entries(catalogGroups).forEach(([gId, grp]) => {
      grp.items.forEach((it) => prevItemsByKey.set(`${gId}:${it.id}`, it));
    });

    const changedSellStockPrices: Record<string, number> = {};
    const changedRewardBuybackPrices: Record<string, number> = {};

    Object.entries(nextGroups).forEach(([gId, grp]) => {
      grp.items.forEach((it) => {
        const prev = prevItemsByKey.get(`${gId}:${it.id}`);
        const cleanPrice = Math.max(0, Math.round(Number(it.price) || 0));
        const prevPrice = prev ? Math.max(0, Math.round(Number(prev.price) || 0)) : undefined;

        if (it.tradeType === 'sell') {
          const stockKey = resolveCatalogItemStockKey(it);
          const prevStockKey = prev ? resolveCatalogItemStockKey(prev) : null;
          if (
            stockKey &&
            ((prevPrice !== undefined && prevPrice !== cleanPrice) ||
              (!prev && cleanPrice > 0) ||
              prevStockKey !== stockKey)
          ) {
            changedSellStockPrices[stockKey] = cleanPrice;
          }
        } else if (it.tradeType === 'buyback') {
          const rewardKey = CATALOG_BUYBACK_ID_TO_REWARD_KEY[it.id];
          if (rewardKey && (prevPrice === undefined || prevPrice !== cleanPrice)) {
            changedRewardBuybackPrices[rewardKey] = cleanPrice;
          }
        }
      });
    });

    // Propagate any changed stockKey price to sibling catalog items sharing that stockKey
    let syncedGroups = nextGroups;
    if (Object.keys(changedSellStockPrices).length > 0) {
      const normalized: CatalogGroupsMap = {};
      Object.entries(nextGroups).forEach(([gId, grp]) => {
        let grpChanged = false;
        const nextItems = grp.items.map((it) => {
          if (it.tradeType !== 'sell') return it;
          const stockKey = resolveCatalogItemStockKey(it);
          if (stockKey && changedSellStockPrices[stockKey] !== undefined) {
            const targetPrice = changedSellStockPrices[stockKey];
            if (Math.round(Number(it.price) || 0) !== targetPrice) {
              grpChanged = true;
              return { ...it, price: targetPrice };
            }
          }
          return it;
        });
        normalized[gId] = grpChanged ? { ...grp, items: nextItems } : grp;
      });
      syncedGroups = normalized;

      setInventoryPrices((prev) => ({
        ...prev,
        ...changedSellStockPrices,
      }));
      void saveInventoryPricesBatch(authUser.uid, changedSellStockPrices).catch((err) =>
        setSyncError(err instanceof Error ? err : new Error(String(err)))
      );
    }

    if (Object.keys(changedRewardBuybackPrices).length > 0) {
      const rewardPatch: Record<string, RewardStockEntry> = {};
      Object.entries(changedRewardBuybackPrices).forEach(([rKey, newVal]) => {
        const itemRef = REWARD_ITEMS.find((i) => i.key === rKey);
        const existing = rewardStocks[rKey];
        rewardPatch[rKey] = {
          qty: Math.max(0, Number(existing?.qty) || 0),
          val: newVal !== undefined ? newVal : itemRef?.defaultVal || 0,
        };
      });
      setRewardStocks((prev) => ({
        ...prev,
        ...rewardPatch,
      }));
      void saveRewardPricesBatch(authUser.uid, rewardPatch).catch((err) =>
        setSyncError(err instanceof Error ? err : new Error(String(err)))
      );
    }

    setCatalogGroups(syncedGroups);
    void saveCatalogGroups(authUser.uid, syncedGroups).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
  };

  const handleAdjustGroupOrderItem = (groupId: string, itemId: string, delta: number) => {
    setGroupOrderCarts((prev) => {
      const grpCart = prev[groupId] || {};
      const nextQty = Math.max(0, (Number(grpCart[itemId]) || 0) + delta);
      const nextGrpCart = { ...grpCart };
      if (nextQty === 0) delete nextGrpCart[itemId];
      else nextGrpCart[itemId] = nextQty;
      return { ...prev, [groupId]: nextGrpCart };
    });
  };

  const handleSetGroupOrderItemQty = (groupId: string, itemId: string, qty: number) => {
    setGroupOrderCarts((prev) => {
      const grpCart = { ...(prev[groupId] || {}) };
      const cleanQty = Math.max(0, Math.floor(Number(qty) || 0));
      if (cleanQty === 0) delete grpCart[itemId];
      else grpCart[itemId] = cleanQty;
      return { ...prev, [groupId]: grpCart };
    });
  };

  const handleClearGroupOrder = (groupId: string) => {
    setGroupOrderCarts((prev) => {
      const copy = { ...prev };
      delete copy[groupId];
      return copy;
    });
  };

  const handleConfirmGroupOrder = (
    group: CatalogGroup,
    cartMap: Record<string, number>,
    debitAccount: 'none' | 'legal' | 'illegal'
  ) => {
    if (readonly || !authUser) return;

    let totalUnits = 0;
    let totalCost = 0;
    let totalLinkedAdded = 0;
    const stockPatch: Record<string, number> = {};
    const nextStock = { ...inventoryStock };

    group.items.forEach((item) => {
      if (item.tradeType !== 'sell') return;
      const qty = Math.max(0, Math.floor(Number(cartMap[item.id]) || 0));
      if (qty <= 0) return;

      totalUnits += qty;
      const unitPrice = resolveCatalogSellItemPrice(item, inventoryPrices);
      totalCost += qty * unitPrice;

      let targetStockKey: string | null = null;
      if (item.linkedGearKey && INVENTORY_ITEMS.some((inv) => inv.key === item.linkedGearKey)) {
        targetStockKey = item.linkedGearKey;
      } else if (item.category !== 'reparation' && item.category !== 'butin') {
        targetStockKey = getCatalogStockKey(item.id);
      }

      if (targetStockKey) {
        const updated =
          Math.max(0, Math.floor(Number(nextStock[targetStockKey]) || 0)) + qty;
        nextStock[targetStockKey] = updated;
        stockPatch[targetStockKey] = updated;
        totalLinkedAdded += qty;
      }
    });

    if (totalUnits <= 0) return;
    if (totalLinkedAdded > 0) {
      setInventoryStock(nextStock);
    }

    let treasuryPatch: Partial<TreasuryMoney> | undefined;
    let insufficientShortfall = 0;
    if (debitAccount !== 'none' && totalCost > 0) {
      const current = Math.max(0, Number(treasuryMoney[debitAccount]) || 0);
      if (current < totalCost) insufficientShortfall = totalCost - current;
      const updatedBal = Math.max(0, current - totalCost);
      treasuryPatch = { [debitAccount]: updatedBal };
      setTreasuryMoney((prev) => ({ ...prev, [debitAccount]: updatedBal }));
    }

    void saveInventoryOrderReceipt(authUser.uid, stockPatch, treasuryPatch).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );

    handleClearGroupOrder(group.id);

    const stockMsg =
      totalLinkedAdded > 0
        ? ` · +${totalLinkedAdded} au stock coffre`
        : '';
    const debitLabel = debitAccount === 'legal' ? 'Argent Légal' : 'Argent Sale';
    const debitMsg =
      debitAccount !== 'none' && totalCost > 0
        ? insufficientShortfall > 0
          ? ` · ${debitLabel} à 0 $ (manquait ${formatMoney(insufficientShortfall)})`
          : ` · -${formatMoney(totalCost)} ${debitLabel}`
        : '';

    showToast(
      `Commande ${group.name} validée (${totalUnits} article${totalUnits > 1 ? 's' : ''}${stockMsg}${debitMsg})`,
      insufficientShortfall > 0 ? { variant: 'warning' } : undefined
    );
  };

  const handleGoToOrdersWithGroup = useCallback((groupId: string) => {
    setSelectedCatalogGroupId(groupId);
    setCurrentTab('orders');
    window.setTimeout(() => {
      const el = document.getElementById('order-catalog-panel');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }, []);

  const handleOpenCatalog = useCallback((groupId?: string) => {
    if (groupId) setSelectedCatalogGroupId(groupId);
    setCurrentTab('catalog');
  }, []);

  const handleConvertMissionPack = (
    missionCode: string,
    direction: 'assemble' | 'unpack'
  ) => {
    if (readonly || !authUser) return;
    const blueprint = EMINENCE_MISSIONS.find((m) => m.code === missionCode);
    if (!blueprint || !blueprint.packItemId) return;

    const catalogMap = getEminenceCatalogItemsMap(catalogGroups);
    const packCatItem = catalogMap.get(blueprint.packItemId);
    const packStockKey = resolveCatalogItemStockKey(packCatItem);
    if (!packStockKey) return;

    const reqAgg = new Map<string, { stockKey: string; qty: number; name: string }>();
    blueprint.requirements.forEach((req) => {
      const catItem = catalogMap.get(req.itemId);
      const sKey = resolveCatalogItemStockKey(catItem);
      if (!catItem || !sKey || sKey === packStockKey) return;
      const existing = reqAgg.get(sKey);
      const addQty = Math.max(1, req.qty);
      if (existing) existing.qty += addQty;
      else reqAgg.set(sKey, { stockKey: sKey, qty: addQty, name: catItem.name });
    });

    const distinctReqs = Array.from(reqAgg.values());
    if (distinctReqs.length === 0) return;

    const nextStock = { ...inventoryStock };
    const stockPatch: Record<string, number> = {};
    const packQty = Math.max(0, Math.floor(Number(nextStock[packStockKey]) || 0));

    if (direction === 'assemble') {
      const canAssemble = distinctReqs.every(
        (r) => Math.max(0, Math.floor(Number(nextStock[r.stockKey]) || 0)) >= r.qty
      );
      if (!canAssemble) {
        showToast(`Items insuffisants pour assembler 1 pack ${blueprint.title}.`, {
          variant: 'warning',
        });
        return;
      }
      distinctReqs.forEach((r) => {
        const updated = Math.max(0, Math.floor(Number(nextStock[r.stockKey]) || 0) - r.qty);
        nextStock[r.stockKey] = updated;
        stockPatch[r.stockKey] = updated;
      });
      nextStock[packStockKey] = packQty + 1;
      stockPatch[packStockKey] = packQty + 1;
      setInventoryStock(nextStock);
      void saveInventoryOrderReceipt(authUser.uid, stockPatch).catch((err) =>
        setSyncError(err instanceof Error ? err : new Error(String(err)))
      );
      showToast(`📦 Pack ${blueprint.title} assemblé (+1 pack depuis les items en coffre).`);
      return;
    }

    if (packQty <= 0) {
      showToast(`Aucun pack ${blueprint.title} à dissocier.`, { variant: 'warning' });
      return;
    }

    nextStock[packStockKey] = packQty - 1;
    stockPatch[packStockKey] = packQty - 1;
    distinctReqs.forEach((r) => {
      const updated = Math.max(0, Math.floor(Number(nextStock[r.stockKey]) || 0) + r.qty);
      nextStock[r.stockKey] = updated;
      stockPatch[r.stockKey] = updated;
    });
    setInventoryStock(nextStock);
    void saveInventoryOrderReceipt(authUser.uid, stockPatch).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
    showToast(
      `🔓 Pack ${blueprint.title} dissocié en items seuls (${distinctReqs.map((r) => `${r.qty}× ${r.name}`).join(' + ')}).`
    );
  };

  const handleAssembleAllPossiblePacks = () => {
    if (readonly || !authUser) return;
    const catalogMap = getEminenceCatalogItemsMap(catalogGroups);
    const sim = simulateMissionSupplyPlan({
      inventoryStock,
      inventoryPrices,
      catalogGroups,
      missionStates,
      scheduleMeta,
    });

    const pool: Record<string, number> = {};
    Object.entries(inventoryStock).forEach(([k, v]) => {
      pool[k] = Math.max(0, Math.floor(Number(v) || 0));
    });
    const stockPatch: Record<string, number> = {};
    let totalAssembled = 0;
    const assembledLabels: string[] = [];

    // Prioritize missions with remaining weekly schedule needs first, then others
    const prioritized = [...EMINENCE_MISSIONS].sort((a, b) => {
      const aNeed = sim.overviewByCode[a.code]?.scheduledThisWeekCount || 0;
      const bNeed = sim.overviewByCode[b.code]?.scheduledThisWeekCount || 0;
      return bNeed - aNeed;
    });

    prioritized.forEach((blueprint) => {
      if (!blueprint.packItemId) return;
      const packCatItem = catalogMap.get(blueprint.packItemId);
      const packStockKey = resolveCatalogItemStockKey(packCatItem);
      if (!packStockKey) return;

      const reqAgg = new Map<string, number>();
      blueprint.requirements.forEach((req) => {
        const catItem = catalogMap.get(req.itemId);
        const sKey = resolveCatalogItemStockKey(catItem);
        if (!catItem || !sKey || sKey === packStockKey) return;
        reqAgg.set(sKey, (reqAgg.get(sKey) || 0) + Math.max(1, req.qty));
      });
      const distinctReqs = Array.from(reqAgg.entries());
      if (distinctReqs.length === 0) return;

      let assembledForMission = 0;
      while (
        distinctReqs.every(
          ([sKey, qty]) => Math.max(0, pool[sKey] || 0) >= qty
        )
      ) {
        distinctReqs.forEach(([sKey, qty]) => {
          const updated = Math.max(0, (pool[sKey] || 0) - qty);
          pool[sKey] = updated;
          stockPatch[sKey] = updated;
        });
        const nextPack = Math.max(0, pool[packStockKey] || 0) + 1;
        pool[packStockKey] = nextPack;
        stockPatch[packStockKey] = nextPack;
        assembledForMission++;
        totalAssembled++;
      }

      if (assembledForMission > 0) {
        assembledLabels.push(`${assembledForMission}× ${blueprint.title}`);
      }
    });

    if (totalAssembled <= 0) {
      showToast('Aucun kit complet d’items seuls disponible à assembler pour le moment.');
      return;
    }

    setInventoryStock(pool);
    void saveInventoryOrderReceipt(authUser.uid, stockPatch).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
    showToast(
      `📦 ${totalAssembled} pack${totalAssembled > 1 ? 's' : ''} assemblé${totalAssembled > 1 ? 's' : ''} : ${assembledLabels.join(', ')}.`
    );
  };

  const handleQuickBuyCatalogItems = (
    catalogItemsQty: Record<string, number>,
    debitAccount: 'none' | 'legal' | 'illegal' = 'illegal'
  ) => {
    if (readonly || !authUser) return;
    const catalogMap = getEminenceCatalogItemsMap(catalogGroups);
    const nextStock = { ...inventoryStock };
    const stockPatch: Record<string, number> = {};
    let totalUnits = 0;
    let totalCost = 0;

    Object.entries(catalogItemsQty).forEach(([itemId, rawQty]) => {
      const addQty = Math.max(0, Math.floor(Number(rawQty) || 0));
      if (addQty <= 0) return;
      const catItem = catalogMap.get(itemId);
      const stockKey = resolveCatalogItemStockKey(catItem);
      if (!catItem || !stockKey) return;

      const updated = Math.max(0, Math.floor(Number(nextStock[stockKey]) || 0)) + addQty;
      nextStock[stockKey] = updated;
      stockPatch[stockKey] = updated;
      totalUnits += addQty;

      const unitPrice = getInventoryItemPrice(stockKey, inventoryPrices, catItem.price);
      totalCost += addQty * unitPrice;
    });

    if (totalUnits <= 0) return;
    setInventoryStock(nextStock);

    let treasuryPatch: Partial<TreasuryMoney> | undefined;
    let insufficientShortfall = 0;
    if (debitAccount !== 'none' && totalCost > 0) {
      const current = Math.max(0, Number(treasuryMoney[debitAccount]) || 0);
      if (current < totalCost) insufficientShortfall = totalCost - current;
      const updatedBal = Math.max(0, current - totalCost);
      treasuryPatch = { [debitAccount]: updatedBal };
      setTreasuryMoney((prev) => ({ ...prev, [debitAccount]: updatedBal }));
    }

    void saveInventoryOrderReceipt(authUser.uid, stockPatch, treasuryPatch).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );

    const debitLabel = debitAccount === 'legal' ? 'Argent Légal' : 'Argent Sale';
    const debitMsg =
      debitAccount !== 'none' && totalCost > 0
        ? insufficientShortfall > 0
          ? ` · ${debitLabel} à 0 $ (manquait ${formatMoney(insufficientShortfall)})`
          : ` · -${formatMoney(totalCost)} ${debitLabel}`
        : '';

    showToast(
      `⚡ +${totalUnits} article${totalUnits > 1 ? 's' : ''} ajouté${totalUnits > 1 ? 's' : ''} au coffre${debitMsg}`,
      insufficientShortfall > 0 ? { variant: 'warning' } : undefined
    );
  };

  const handleSendToEminenceCart = useCallback(
    (
      catalogItemsQty: Record<string, number>,
      options?: { navigateToOrders?: boolean; replaceCart?: boolean }
    ) => {
      let totalAdded = 0;
      const cleanAdditions: Record<string, number> = {};
      Object.entries(catalogItemsQty).forEach(([itemId, rawQty]) => {
        const qty = Math.max(0, Math.floor(Number(rawQty) || 0));
        if (qty > 0) {
          cleanAdditions[itemId] = qty;
          totalAdded += qty;
        }
      });

      if (totalAdded <= 0) {
        showToast('Aucun article manquant à ajouter au panier Éminences.');
        return;
      }

      setGroupOrderCarts((prev) => {
        const baseCart = options?.replaceCart ? {} : { ...(prev.eminence || {}) };
        Object.entries(cleanAdditions).forEach(([itemId, qty]) => {
          baseCart[itemId] = (Number(baseCart[itemId]) || 0) + qty;
        });
        return { ...prev, eminence: baseCart };
      });

      setSelectedCatalogGroupId('eminence');
      if (options?.navigateToOrders !== false) {
        setCurrentTab('orders');
        window.setTimeout(() => {
          const el = document.getElementById('order-catalog-panel');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
      }

      showToast(
        `🛒 ${totalAdded} article${totalAdded > 1 ? 's' : ''} envoyé${totalAdded > 1 ? 's' : ''} dans le panier Éminences !`
      );
    },
    [showToast]
  );

  const handleUpdateTreasuryMoney = (type: keyof TreasuryMoney, val: number) => {
    if (readonly || !authUser) return;
    const cleanVal = Math.max(0, Number(val) || 0);
    setTreasuryMoney((prev) => ({
      ...prev,
      [type]: cleanVal,
    }));
    void saveTreasuryMoneyField(authUser.uid, type, cleanVal).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
  };

  const handleUpdateRewardQty = (key: string, delta: number) => {
    if (readonly || !authUser) return;
    const itemRef = REWARD_ITEMS.find((i) => i.key === key);
    const existing = rewardStocks[key] || { qty: 0, val: itemRef ? itemRef.defaultVal : 200 };
    const nextEntry = {
      ...existing,
      qty: Math.max(0, (Number(existing.qty) || 0) + delta),
    };
    setRewardStocks((prev) => ({
      ...prev,
      [key]: nextEntry,
    }));
    void saveRewardItem(authUser.uid, key, nextEntry).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
  };

  const handleUpdateRewardValue = (key: string, val: number) => {
    if (readonly || !authUser) return;
    const cleanVal = Math.max(0, Math.round(Number(val) || 0));
    const itemRef = REWARD_ITEMS.find((i) => i.key === key);
    const existing = rewardStocks[key] || { qty: 0, val: itemRef ? itemRef.defaultVal : 200 };
    const nextEntry = {
      ...existing,
      val: cleanVal,
    };
    setRewardStocks((prev) => ({
      ...prev,
      [key]: nextEntry,
    }));
    void saveRewardItem(authUser.uid, key, nextEntry).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );

    const buybackItemId = REWARD_KEY_TO_CATALOG_BUYBACK_ID[key];
    if (buybackItemId) {
      let catalogChanged = false;
      const nextGroups: CatalogGroupsMap = {};
      Object.entries(catalogGroups).forEach(([gId, grp]) => {
        let grpChanged = false;
        const nextItems = grp.items.map((it) => {
          if (it.id === buybackItemId && Math.round(Number(it.price) || 0) !== cleanVal) {
            grpChanged = true;
            catalogChanged = true;
            return { ...it, price: cleanVal };
          }
          return it;
        });
        nextGroups[gId] = grpChanged ? { ...grp, items: nextItems } : grp;
      });
      if (catalogChanged) {
        setCatalogGroups(nextGroups);
        void saveCatalogGroups(authUser.uid, nextGroups).catch((err) =>
          setSyncError(err instanceof Error ? err : new Error(String(err)))
        );
      }
    }
  };

  const handleSellRewards = (
    soldQuantities: Record<string, number>,
    channelLabel: string,
    customAmountOverride?: number
  ) => {
    if (readonly || !authUser) return;
    const rewardPatches: Record<string, RewardStockEntry> = {};
    const nextRewards = { ...rewardStocks };
    let totalSoldUnits = 0;
    let totalSaleAmount = 0;

    Object.entries(soldQuantities).forEach(([key, rawQty]) => {
      const itemRef = REWARD_ITEMS.find((i) => i.key === key);
      if (!itemRef) return;
      const existing = nextRewards[key] || { qty: 0, val: itemRef.defaultVal };
      const currentQty = Math.max(0, Math.floor(Number(existing.qty) || 0));
      const sellQty = Math.min(currentQty, Math.max(0, Math.floor(Number(rawQty) || 0)));
      if (sellQty <= 0) return;

      const unitVal =
        existing.val !== undefined ? Math.max(0, Number(existing.val) || 0) : itemRef.defaultVal;
      const updatedEntry: RewardStockEntry = {
        qty: currentQty - sellQty,
        val: unitVal,
      };
      nextRewards[key] = updatedEntry;
      rewardPatches[key] = updatedEntry;
      totalSoldUnits += sellQty;
      totalSaleAmount += sellQty * unitVal;
    });

    const cleanSaleGain =
      customAmountOverride !== undefined
        ? Math.max(0, Math.round(customAmountOverride))
        : Math.max(0, Math.round(totalSaleAmount));

    if (totalSoldUnits <= 0 && cleanSaleGain <= 0) return;

    const currentIllegal = Math.max(0, Number(treasuryMoney.illegal) || 0);
    const updatedIllegal = currentIllegal + cleanSaleGain;

    if (Object.keys(rewardPatches).length > 0) {
      setRewardStocks(nextRewards);
    }
    setTreasuryMoney((prev) => ({
      ...prev,
      illegal: updatedIllegal,
    }));

    void saveLootSale(authUser.uid, rewardPatches, updatedIllegal).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );

    if (totalSoldUnits > 0) {
      showToast(
        `Vente ${channelLabel} validée (${totalSoldUnits} objet${totalSoldUnits > 1 ? 's' : ''}) · +${formatMoney(cleanSaleGain)} ajouté à l'Argent Sale !`
      );
    } else {
      showToast(
        `Vente ${channelLabel} validée (montant ajusté) · +${formatMoney(cleanSaleGain)} ajouté à l'Argent Sale !`
      );
    }
  };

  const handleApplyOfficialRewardPrices = () => {
    if (readonly || !authUser) return;
    const patch: Record<string, RewardStockEntry> = {};
    const officialCatalogById = new Map<string, number>();
    REWARD_ITEMS.forEach((item) => {
      const existing = rewardStocks[item.key];
      patch[item.key] = {
        qty: Math.max(0, Number(existing?.qty) || 0),
        val: item.defaultVal,
      };
      const catId = REWARD_KEY_TO_CATALOG_BUYBACK_ID[item.key];
      if (catId) officialCatalogById.set(catId, item.defaultVal);
    });
    setRewardStocks((prev) => ({
      ...prev,
      ...patch,
    }));
    void saveRewardPricesBatch(authUser.uid, patch)
      .then(() => {
        showToast('Tarifs officiels du receleur mis à jour !');
      })
      .catch((err) =>
        setSyncError(err instanceof Error ? err : new Error(String(err)))
      );

    let catalogChanged = false;
    const nextGroups: CatalogGroupsMap = {};
    Object.entries(catalogGroups).forEach(([gId, grp]) => {
      let grpChanged = false;
      const nextItems = grp.items.map((it) => {
        const officialPrice = officialCatalogById.get(it.id);
        if (officialPrice !== undefined && Math.round(Number(it.price) || 0) !== officialPrice) {
          grpChanged = true;
          catalogChanged = true;
          return { ...it, price: officialPrice };
        }
        return it;
      });
      nextGroups[gId] = grpChanged ? { ...grp, items: nextItems } : grp;
    });
    if (catalogChanged) {
      setCatalogGroups(nextGroups);
      void saveCatalogGroups(authUser.uid, nextGroups).catch((err) =>
        setSyncError(err instanceof Error ? err : new Error(String(err)))
      );
    }
  };

  const handleUpdateWeaponsLoss = (val: number) => {
    if (readonly || !authUser) return;
    const cleanVal = Math.max(0, Number(val) || 0);
    setWeaponsLossAmount(cleanVal);
    void saveWeaponsLoss(authUser.uid, cleanVal).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
  };

  const handleSaveHierarchyMember = (payload: {
    id?: string;
    name: string;
    unit: HierarchyUnitKey;
    dossier: string;
  }) => {
    if (readonly || !authUser) return;
    const nextMembers = payload.id
      ? hierMembers.map((m) =>
          m.id === payload.id
            ? { ...m, name: payload.name, unit: payload.unit, dossier: payload.dossier }
            : m
        )
      : [
          ...hierMembers,
          {
            id: 'm' + Date.now().toString(36),
            name: payload.name,
            unit: payload.unit,
            order: Math.max(0, ...hierMembers.map((m) => m.order || 0)) + 1,
            dossier: payload.dossier,
          },
        ];
    setHierMembers(nextMembers);
    void saveHierarchyMembers(authUser.uid, nextMembers).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
    showToast(payload.id ? 'Membre modifié.' : 'Membre ajouté.');
  };

  const handleDeleteHierarchyMember = (id: string) => {
    if (readonly || !authUser) return;
    const nextMembers = hierMembers.filter((m) => m.id !== id);
    setHierMembers(nextMembers);
    void saveHierarchyMembers(authUser.uid, nextMembers).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
    showToast('Membre supprimé.');
  };

  const handleUpdateMemberRankings = (nextRankings: MemberRankingsMap) => {
    if (readonly || !authUser) return;
    setMemberRankings(nextRankings);
    void saveMemberRankings(authUser.uid, nextRankings).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
  };

  const handleAddAlbumPhoto = async (
    photo: AlbumPhotoRecord,
    media?: { imageUrl: string; mimeType: string }
  ) => {
    if (readonly || !authUser) return;
    const nextState: AlbumState = {
      photos: {
        ...albumState.photos,
        [photo.id]: photo,
      },
      favorites: albumState.favorites,
    };
    setAlbumState(nextState);
    try {
      await saveAlbumPhotoWithMedia(authUser.uid, photo, nextState, media);
      showToast(`Photo "${photo.title}" ajoutée à l'album !`);
    } catch (err) {
      setSyncError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  };

  const handleUpdateAlbumPhotoMeta = async (photo: AlbumPhotoRecord) => {
    if (readonly || !authUser) return;
    const nextState: AlbumState = {
      photos: {
        ...albumState.photos,
        [photo.id]: photo,
      },
      favorites: albumState.favorites,
    };
    setAlbumState(nextState);
    try {
      await saveAlbumState(authUser.uid, nextState);
      showToast('Informations de la photo mises à jour.');
    } catch (err) {
      setSyncError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleDeleteAlbumPhoto = async (photo: AlbumPhotoRecord) => {
    if (readonly || !authUser) return;
    const nextPhotos = { ...albumState.photos };
    delete nextPhotos[photo.id];
    const nextState: AlbumState = {
      photos: nextPhotos,
      favorites: albumState.favorites.filter((fid) => fid !== photo.id),
    };
    setAlbumState(nextState);
    try {
      await deleteAlbumPhotoWithMedia(authUser.uid, photo, nextState);
      showToast('Photo supprimée de l’album.');
    } catch (err) {
      setSyncError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleToggleAlbumFavorite = (photoId: string) => {
    if (readonly || !authUser) return;
    const exists = albumState.favorites.includes(photoId);
    const nextFavorites = exists
      ? albumState.favorites.filter((fid) => fid !== photoId)
      : [...albumState.favorites, photoId];
    const nextState: AlbumState = {
      photos: albumState.photos,
      favorites: nextFavorites,
    };
    setAlbumState(nextState);
    void saveAlbumState(authUser.uid, nextState).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
  };

  const handleVerifySecretCode = async (code: string): Promise<boolean> => {
    if (!authUser) return false;
    try {
      const ok = await unlockEditorWithCode(authUser, code);
      if (ok) {
        setMemberRole('editor');
        setAuthModalOpen(false);
        showToast('Mode Éditeur déverrouillé !');
        return true;
      }
      showToast('Code secret incorrect.');
      return false;
    } catch (err) {
      setSyncError(err instanceof Error ? err : new Error(String(err)));
      return false;
    }
  };

  const handleLockEditMode = async () => {
    if (!authUser) return;
    try {
      await lockEditorRole(authUser);
      setMemberRole('viewer');
      setAuthModalOpen(false);
      showToast('Session verrouillée en lecture seule.');
    } catch (err) {
      setSyncError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleUpdateSecretCode = async (newCode: string) => {
    if (readonly || !authUser) return;
    const trimmed = newCode.trim();
    if (trimmed.length < 4) {
      showToast('Le code doit contenir au moins 4 caractères.');
      return;
    }
    try {
      await updateCartelSecretCode(authUser.uid, trimmed);
      showToast('Nouveau code secret enregistré !');
    } catch (err) {
      setSyncError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleSaveDiscordConfig = async (nextConfig: DiscordGazetteConfig) => {
    if (readonly || !authUser) return;
    await saveDiscordConfig(authUser.uid, nextConfig);
    setDiscordConfig(nextConfig);
  };

  const handleSaveFleet = async (nextFleet: FleetState) => {
    if (readonly || !authUser) return;
    setFleetState(nextFleet);
    await saveFleetState(authUser.uid, nextFleet);
  };

  const handleShareFleetDiscord = async (summary: {
    title: string;
    description: string;
    fields: Array<{ name: string; value: string; inline?: boolean }>;
  }) => {
    if (readonly || !authUser) return;
    const [idToken, { sendInstantDiscordAlert }] = await Promise.all([
      authUser.getIdToken(),
      import('@/src/utils/discordGazette'),
    ]);
    await sendInstantDiscordAlert({
      idToken,
      webhookUrl: discordConfig.webhookUrl,
      severity: 'info',
      title: summary.title,
      description: summary.description,
      fields: summary.fields,
      footer: `Los Cerberos · État du Garage (${authUser.displayName || authUser.email?.split('@')[0] || 'Éditeur'})`,
    });
  };

  const handleUpdateCurrentPayroll = (nextPayroll: CurrentWeekPayrollState) => {
    if (readonly || !authUser) return;
    const nextHistory: HistoryState = {
      ...historyState,
      currentPayroll: nextPayroll,
    };
    setHistoryState(nextHistory);
    void saveHistoryState(authUser.uid, nextHistory).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
  };

  const handleSettleSundayPayroll = (debitAccount: 'none' | 'legal' | 'illegal') => {
    if (readonly || !authUser) return;
    const currentWeekKey = missionStates.__week || isoDate(currentWeekStart());
    const cp = historyState.currentPayroll;
    const isSameWeek = cp.week === currentWeekKey;
    const calc = computeSundayPayroll({
      members: hierMembers,
      missionStates,
      scheduleMeta,
      weaponsLossAmount,
      inventoryPrices,
      catalogGroups,
      cartelPercent: isSameWeek ? cp.cartelPercent : 70,
      basis: isSameWeek ? cp.basis : 'net_cartel',
      paidMemberIds: isSameWeek ? cp.paidMemberIds : [],
    });

    if (calc.payrollPoolAmount <= 0) {
      showToast('Aucune paie à distribuer pour cette semaine.', { variant: 'warning' });
      return;
    }

    const eligibleIds = calc.rows.filter((r) => r.payrollAmount > 0).map((r) => r.memberId);
    const mergedPaidIds = Array.from(
      new Set([...(isSameWeek ? cp.paidMemberIds : []), ...eligibleIds])
    );

    let actualDebited = 0;
    let shortfall = 0;
    let treasuryPatch: Partial<TreasuryMoney> | undefined;
    if (debitAccount !== 'none') {
      const curBal = Math.max(0, Number(treasuryMoney[debitAccount]) || 0);
      actualDebited = Math.min(curBal, calc.payrollPoolAmount);
      shortfall = Math.max(0, calc.payrollPoolAmount - curBal);
      const nextBal = Math.max(0, curBal - calc.payrollPoolAmount);
      treasuryPatch = { [debitAccount]: nextBal };
      setTreasuryMoney((prev) => ({ ...prev, [debitAccount]: nextBal }));
    }

    const actorName = authUser.displayName || authUser.email?.split('@')[0] || 'Éditeur';
    const nextHistory: HistoryState = {
      ...historyState,
      currentPayroll: {
        week: currentWeekKey,
        cartelPercent: calc.cartelPercent,
        membersPercent: calc.membersPercent,
        basis: calc.basis,
        paidMemberIds: mergedPaidIds,
        settled: true,
        settledAt: new Date().toISOString().slice(0, 40),
        settledBy: actorName.slice(0, 80),
        settledAmount: calc.payrollPoolAmount,
        debitAccount,
        debitAmount: actualDebited,
      },
    };
    setHistoryState(nextHistory);
    void savePayrollSettlementWithTreasury(authUser.uid, nextHistory, treasuryPatch).catch(
      (err) => setSyncError(err instanceof Error ? err : new Error(String(err)))
    );

    const debitLabel = debitAccount === 'legal' ? 'Argent Légal' : 'Argent Sale';
    if (debitAccount !== 'none' && shortfall > 0) {
      showToast(
        `Paye validée (${formatMoney(calc.payrollPoolAmount)}) · ${debitLabel} à 0 $ (manquait ${formatMoney(shortfall)})`,
        { variant: 'warning' }
      );
    } else if (debitAccount !== 'none' && actualDebited > 0) {
      showToast(
        `Paye du dimanche validée (${formatMoney(calc.payrollPoolAmount)}) · -${formatMoney(actualDebited)} ${debitLabel} !`
      );
    } else {
      showToast(`Paye du dimanche validée (${formatMoney(calc.payrollPoolAmount)}) !`);
    }
  };

  const handleCancelPayrollSettlement = () => {
    if (readonly || !authUser) return;
    const cp = historyState.currentPayroll;
    if (!cp.settled) return;

    let treasuryPatch: Partial<TreasuryMoney> | undefined;
    if (cp.debitAccount !== 'none' && cp.debitAmount > 0) {
      const curBal = Math.max(0, Number(treasuryMoney[cp.debitAccount]) || 0);
      const refundedBal = curBal + cp.debitAmount;
      treasuryPatch = { [cp.debitAccount]: refundedBal };
      setTreasuryMoney((prev) => ({ ...prev, [cp.debitAccount]: refundedBal }));
    }

    const nextHistory: HistoryState = {
      ...historyState,
      currentPayroll: {
        ...cp,
        settled: false,
        settledAt: '',
        settledBy: '',
        settledAmount: 0,
        debitAccount: 'none',
        debitAmount: 0,
      },
    };
    setHistoryState(nextHistory);
    void savePayrollSettlementWithTreasury(authUser.uid, nextHistory, treasuryPatch).catch(
      (err) => setSyncError(err instanceof Error ? err : new Error(String(err)))
    );

    showToast(
      cp.debitAccount !== 'none' && cp.debitAmount > 0
        ? `Validation annulée · +${formatMoney(cp.debitAmount)} remboursé en caisse.`
        : 'Validation de paye annulée.'
    );
  };

  const handleArchiveCurrentWeek = (notes?: string) => {
    if (readonly || !authUser) return;
    const currentWeekKey = missionStates.__week || isoDate(currentWeekStart());
    const archiveId = currentWeekKey.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'week';
    const actorName = authUser.displayName || authUser.email?.split('@')[0] || 'Éditeur';
    const existingNotes = historyState.archives[archiveId]?.notes || '';
    const record = buildArchiveRecordFromWeek({
      archiveId,
      archivedBy: actorName,
      missionStates,
      scheduleMeta,
      weaponsLossAmount,
      members: hierMembers,
      inventoryPrices,
      catalogGroups,
      currentPayroll: historyState.currentPayroll,
      treasuryMoney,
      rewardStocks,
      inventoryStock,
      weaponsStock,
      memberRankings,
      notes: notes !== undefined ? notes : existingNotes,
    });
    const nextHistory: HistoryState = {
      ...historyState,
      archives: {
        ...historyState.archives,
        [archiveId]: record,
      },
    };
    setHistoryState(nextHistory);
    void saveHistoryState(authUser.uid, nextHistory).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
    showToast(`Résumé global de la semaine ${record.label} enregistré dans les Archives !`);
  };

  const handleUpdateArchiveNotes = (archiveId: string, notes: string) => {
    if (readonly || !authUser) return;
    const rec = historyState.archives[archiveId];
    if (!rec) return;
    const cleanNotes = notes.trim().slice(0, 500);
    const updatedRec = { ...rec };
    if (cleanNotes) {
      updatedRec.notes = cleanNotes;
    } else {
      delete updatedRec.notes;
    }
    const nextHistory: HistoryState = {
      ...historyState,
      archives: {
        ...historyState.archives,
        [archiveId]: updatedRec,
      },
    };
    setHistoryState(nextHistory);
    void saveHistoryState(authUser.uid, nextHistory).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
    showToast('Note d’activité enregistrée dans l’archive !');
  };

  const handleToggleArchivedMemberPaid = (archiveId: string, memberId: string) => {
    if (readonly || !authUser) return;
    const rec = historyState.archives[archiveId];
    if (!rec) return;
    const nextRows = rec.payroll.rows.map((r) =>
      r.memberId === memberId ? { ...r, paid: !r.paid } : r
    );
    const nextHistory: HistoryState = {
      ...historyState,
      archives: {
        ...historyState.archives,
        [archiveId]: {
          ...rec,
          payroll: {
            ...rec.payroll,
            rows: nextRows,
          },
        },
      },
    };
    setHistoryState(nextHistory);
    void saveHistoryState(authUser.uid, nextHistory).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
  };

  const handleSettleArchivedPayroll = (
    archiveId: string,
    debitAccount: 'none' | 'legal' | 'illegal'
  ) => {
    if (readonly || !authUser) return;
    const rec = historyState.archives[archiveId];
    if (!rec || rec.payroll.settled || rec.payroll.payrollPoolAmount <= 0) return;

    const pool = rec.payroll.payrollPoolAmount;
    let actualDebited = 0;
    let shortfall = 0;
    let treasuryPatch: Partial<TreasuryMoney> | undefined;
    if (debitAccount !== 'none') {
      const curBal = Math.max(0, Number(treasuryMoney[debitAccount]) || 0);
      actualDebited = Math.min(curBal, pool);
      shortfall = Math.max(0, pool - curBal);
      const nextBal = Math.max(0, curBal - pool);
      treasuryPatch = { [debitAccount]: nextBal };
      setTreasuryMoney((prev) => ({ ...prev, [debitAccount]: nextBal }));
    }

    const actorName = authUser.displayName || authUser.email?.split('@')[0] || 'Éditeur';
    const nextHistory: HistoryState = {
      ...historyState,
      archives: {
        ...historyState.archives,
        [archiveId]: {
          ...rec,
          payroll: {
            ...rec.payroll,
            settled: true,
            settledAt: new Date().toISOString().slice(0, 40),
            settledBy: actorName.slice(0, 80),
            debitAccount,
            debitAmount: actualDebited,
            rows: rec.payroll.rows.map((r) =>
              r.payrollAmount > 0 ? { ...r, paid: true } : r
            ),
          },
        },
      },
    };
    setHistoryState(nextHistory);
    void savePayrollSettlementWithTreasury(authUser.uid, nextHistory, treasuryPatch).catch(
      (err) => setSyncError(err instanceof Error ? err : new Error(String(err)))
    );

    const debitLabel = debitAccount === 'legal' ? 'Argent Légal' : 'Argent Sale';
    if (debitAccount !== 'none' && shortfall > 0) {
      showToast(
        `Paye archivée validée (${formatMoney(pool)}) · ${debitLabel} à 0 $ (manquait ${formatMoney(shortfall)})`,
        { variant: 'warning' }
      );
    } else if (debitAccount !== 'none' && actualDebited > 0) {
      showToast(
        `Paye archivée validée (${formatMoney(pool)}) · -${formatMoney(actualDebited)} ${debitLabel}`
      );
    } else {
      showToast(`Paye archivée validée (${formatMoney(pool)}) !`);
    }
  };

  const handleCancelArchivedPayrollSettlement = (archiveId: string) => {
    if (readonly || !authUser) return;
    const rec = historyState.archives[archiveId];
    if (!rec || !rec.payroll.settled) return;

    let treasuryPatch: Partial<TreasuryMoney> | undefined;
    if (rec.payroll.debitAccount !== 'none' && rec.payroll.debitAmount > 0) {
      const curBal = Math.max(0, Number(treasuryMoney[rec.payroll.debitAccount]) || 0);
      const refundedBal = curBal + rec.payroll.debitAmount;
      treasuryPatch = { [rec.payroll.debitAccount]: refundedBal };
      setTreasuryMoney((prev) => ({
        ...prev,
        [rec.payroll.debitAccount]: refundedBal,
      }));
    }

    const nextHistory: HistoryState = {
      ...historyState,
      archives: {
        ...historyState.archives,
        [archiveId]: {
          ...rec,
          payroll: {
            ...rec.payroll,
            settled: false,
            settledAt: '',
            settledBy: '',
            debitAccount: 'none',
            debitAmount: 0,
          },
        },
      },
    };
    setHistoryState(nextHistory);
    void savePayrollSettlementWithTreasury(authUser.uid, nextHistory, treasuryPatch).catch(
      (err) => setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
    showToast(
      rec.payroll.debitAccount !== 'none' && rec.payroll.debitAmount > 0
        ? `Validation annulée · +${formatMoney(rec.payroll.debitAmount)} remboursé en caisse.`
        : 'Validation de paye archivée annulée.'
    );
  };

  const handleDeleteWeekArchive = (archiveId: string) => {
    if (readonly || !authUser) return;
    if (!historyState.archives[archiveId]) return;
    const nextArchives = { ...historyState.archives };
    delete nextArchives[archiveId];
    const nextHistory: HistoryState = {
      ...historyState,
      archives: nextArchives,
    };
    setHistoryState(nextHistory);
    void saveHistoryState(authUser.uid, nextHistory).catch((err) =>
      setSyncError(err instanceof Error ? err : new Error(String(err)))
    );
    showToast('Archive supprimée de l’historique.');
  };

  const handleCopyReport = async () => {
    const discordText = buildDiscordReport({
      missionStates,
      scheduleMeta,
      treasuryMoney,
      rewardStocks,
      inventoryStock,
      inventoryPrices,
      weaponsStock,
      weaponsLossAmount,
      hierMembers,
      catalogGroups,
    });
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(discordText);
        showToast('Bilan comptable copié dans le presse-papiers !');
        return;
      }
    } catch {
      // Fallback below
    }

    const textarea = document.createElement('textarea');
    textarea.value = discordText;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      showToast('Bilan comptable copié dans le presse-papiers !');
    } catch {
      showToast('Erreur de copie.');
    }
    document.body.removeChild(textarea);
  };

  const navigateToTab = useCallback((tab: TabKey) => {
    setCurrentTab(tab);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const mobileNavItems: Array<{
    key: TabKey;
    label: string;
    Icon: typeof LayoutDashboard;
  }> = [
    { key: 'home', label: 'Accueil', Icon: LayoutDashboard },
    { key: 'planning', label: 'Planning', Icon: Calendar },
    { key: 'inventory', label: 'Inventaire', Icon: Package },
    { key: 'garage', label: 'Garage', Icon: Car },
    { key: 'orders', label: 'Commandes', Icon: ShoppingCart },
    { key: 'catalog', label: 'Catalogue', Icon: BookOpen },
    { key: 'treasury', label: 'Trésorerie', Icon: Wallet },
    { key: 'accounting', label: 'Comptabilité', Icon: BarChart3 },
    { key: 'history', label: 'Paye', Icon: Banknote },
    { key: 'archives', label: 'Archives', Icon: Archive },
    { key: 'ranking', label: 'Classement', Icon: Trophy },
    { key: 'hierarchy', label: 'Hiérarchie', Icon: Users },
    { key: 'album', label: 'Album', Icon: Camera },
  ];

  const isSecondaryMobileTab = !['home', 'planning', 'inventory', 'garage'].includes(
    currentTab
  );

  const tabBtnClass = (tab: TabKey) =>
    currentTab === tab
      ? 'px-3 py-2 rounded-lg text-xs font-bold bg-charcoal text-gold-light border-b-2 border-crimson border-t border-x border-t-gold/30 border-x-gold/30 transition flex items-center gap-1.5 shadow-md cursor-pointer whitespace-nowrap shrink-0'
      : 'px-3 py-2 rounded-lg text-xs font-semibold bg-charcoal/70 hover:bg-charcoal text-zinc-300 hover:text-white border border-bronze/40 hover:border-gold/50 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0';

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-charcoal/90 gold-border rounded-2xl px-8 py-6 text-center space-y-3 shadow-2xl">
          <div className="w-14 h-14 mx-auto rounded-xl bg-obsidian border-2 border-gold/80 overflow-hidden">
            <img
              src="/assets/emblem.webp"
              alt="Emblème Los Cerberos"
              className="w-full h-full object-cover"
            />
          </div>
          <p className="font-display text-sm font-bold tracking-wider text-gold">
            CONNEXION À LOS CERBEROS...
          </p>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-charcoal/95 gold-border rounded-2xl max-w-md w-full p-8 shadow-2xl text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-obsidian border-2 border-gold/80 overflow-hidden shadow-xl shadow-crimson/30">
            <img
              src="/assets/emblem.webp"
              alt="Emblème Los Cerberos"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="space-y-2">
            <span className="text-[10px] font-bold tracking-[0.3em] text-red-500 uppercase block">
              GTA RP • Cartel Paramilitaire
            </span>
            <h1 className="font-display text-2xl font-extrabold tracking-wider text-white">
              LOS CERBEROS
            </h1>
            <p className="text-gold text-xs font-bold tracking-widest">
              JURAMENTADOS POR LA SANGRE
            </p>
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed">
            Connectez-vous avec votre compte Google pour accéder au semainier, à l&apos;inventaire, à la trésorerie et à la comptabilité synchronisés en temps réel avec tout le cartel.
          </p>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full py-3 px-5 rounded-xl text-sm font-bold bg-gold hover:bg-gold-light text-obsidian transition flex items-center justify-center gap-2 shadow-lg cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            Se connecter avec Google
          </button>
          {authError && (
            <div className="rounded-xl bg-red-950/60 border border-red-500/40 px-3.5 py-2.5 text-left text-xs text-red-200 leading-relaxed">
              {authError}
            </div>
          )}
          <Toast message={toastState?.message ?? null} />
        </div>
      </div>
    );
  }

  if (cartelStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-charcoal/90 gold-border rounded-2xl px-8 py-6 text-center space-y-3 shadow-2xl">
          <div className="w-14 h-14 mx-auto rounded-xl bg-obsidian border-2 border-gold/80 overflow-hidden">
            <img
              src="/assets/emblem.webp"
              alt="Emblème Los Cerberos"
              className="w-full h-full object-cover"
            />
          </div>
          <p className="font-display text-sm font-bold tracking-wider text-gold">
            SYNCHRONISATION EN TEMPS RÉEL...
          </p>
        </div>
      </div>
    );
  }

  if (cartelStatus === 'uninitialized') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-charcoal/95 gold-border rounded-2xl max-w-md w-full p-8 shadow-2xl text-center space-y-5">
          <h2 className="font-display text-xl font-bold text-gold">
            Espace en attente d&apos;initialisation
          </h2>
          <p className="text-xs text-zinc-300 leading-relaxed">
            L&apos;espace partagé du cartel n&apos;a pas encore été initialisé par le responsable. Demandez-lui d&apos;ouvrir l&apos;application une première fois avec son compte, puis cliquez sur Réessayer.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setRetryCounter((c) => c + 1)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-gold hover:bg-gold-light text-obsidian transition cursor-pointer"
            >
              Réessayer
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 lg:pb-16">
      {/* EN-TÊTE COMPACT & RESPONSIVE */}
      <header className="sticky top-0 z-40 bg-obsidian/98 lg:bg-obsidian/95 lg:backdrop-blur-md border-b border-crimson/70 shadow-xl">
        <div className="hidden sm:block border-b border-bronze/35 bg-charcoal/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5 flex items-center justify-between gap-3 text-[10px] tracking-[0.26em] uppercase">
            <span className="text-gold-light/90 font-semibold truncate">
              Traicionados por el Estado · Juramentados por la Sangre
            </span>
            <span className="hidden md:inline text-zinc-400 font-semibold whitespace-nowrap">
              Discipline · Loyauté · Respect · Fraternité
            </span>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-2.5 sm:gap-3.5">
            {/* Logo & Titre Cartel GTA RP + Actions rapides mobile */}
            <div className="flex items-center justify-between gap-2.5 min-w-0">
              <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                <button
                  type="button"
                  onClick={() => navigateToTab('home')}
                  className="relative w-10 h-10 sm:w-14 sm:h-14 rounded-xl bg-charcoal border-2 border-gold/80 flex items-center justify-center shadow-xl shadow-crimson/35 shrink-0 overflow-hidden group cursor-pointer"
                  aria-label="Accueil Los Cerberos"
                >
                  <img
                    src="/assets/emblem.webp"
                    alt="Emblème Los Cerberos"
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="hidden sm:inline text-[10px] font-bold tracking-[0.28em] text-crimson-light uppercase">
                      Organisation Paramilitaire · GTA RP
                    </span>
                    <button
                      type="button"
                      onClick={() => setAuthModalOpen(true)}
                      className={
                        isUnlocked
                          ? 'text-[11px] font-bold text-gold-light hover:text-gold underline underline-offset-4 transition cursor-pointer whitespace-nowrap'
                          : 'text-[11px] font-semibold text-zinc-400 hover:text-gold-light underline underline-offset-4 transition cursor-pointer whitespace-nowrap'
                      }
                    >
                      {isUnlocked ? '👑 Éditeur' : '🔒 Lecture seule'}
                    </button>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      title={`Connecté en tant que ${authUser.displayName || authUser.email}`}
                      className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500 hover:text-white transition cursor-pointer whitespace-nowrap"
                    >
                      <LogOut className="w-3 h-3" />
                      Déconnexion
                    </button>
                  </div>
                  <h1 className="font-display text-base sm:text-2xl font-extrabold tracking-wider text-white mt-0.5 truncate">
                    LOS CERBEROS{' '}
                    <span className="hidden sm:inline text-crimson font-normal">—</span>{' '}
                    <span className="hidden sm:inline text-gold text-sm sm:text-base font-bold">
                      GESTION CARTEL
                    </span>
                  </h1>
                </div>
              </div>

              {/* Actions rapides mobile (< lg) */}
              <div className="flex lg:hidden items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setGazetteModalOpen(true)}
                  title="Gazette Discord"
                  className="px-2.5 py-2 rounded-lg text-xs font-bold bg-charcoal hover:bg-slateDark text-gold-light border border-gold/45 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Newspaper className="w-4 h-4 text-gold" />
                  <span className="hidden xs:inline">Gazette</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen((v) => !v)}
                  aria-label="Ouvrir le menu"
                  className="p-2 rounded-lg bg-charcoal hover:bg-slateDark text-zinc-100 border border-bronze/55 transition cursor-pointer"
                >
                  {mobileMenuOpen ? <X className="w-5 h-5 text-gold" /> : <Menu className="w-5 h-5 text-gold" />}
                </button>
              </div>
            </div>

            {/* Actions globales (Onglets Desktop >= lg) */}
            <div className="hidden lg:flex flex-wrap items-center gap-1.5">
              {mobileNavItems.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => navigateToTab(key)}
                  className={tabBtnClass(key)}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
              <a
                href="https://sunnycom.tech/feed"
                target="_blank"
                rel="noopener noreferrer"
                title="Ouvrir SunnyCom (Feed RP)"
                className="px-3 py-2 rounded-lg text-xs font-bold bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-200 hover:text-white border border-emerald-500/45 hover:border-emerald-400 transition flex items-center gap-1.5 shadow-sm whitespace-nowrap shrink-0"
              >
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                SunnyCom
                <ExternalLink className="w-3 h-3 opacity-80" />
              </a>
              <button
                type="button"
                onClick={handleCopyReport}
                className="px-3 py-2 rounded-lg text-xs font-bold bg-gold hover:bg-gold-light text-obsidian transition flex items-center gap-1.5 shadow-md shadow-gold/10 cursor-pointer whitespace-nowrap shrink-0"
              >
                <ClipboardCopy className="w-3.5 h-3.5" />
                Copier Bilan
              </button>
              <button
                type="button"
                onClick={() => setGazetteModalOpen(true)}
                title="Aperçu, PNG et envoi salon Discord de la Gazette quotidienne"
                className="px-3 py-2 rounded-lg text-xs font-bold bg-charcoal hover:bg-slateDark text-gold-light border border-gold/45 hover:border-gold transition flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap shrink-0"
              >
                <Newspaper className="w-3.5 h-3.5 text-gold" />
                Gazette Discord
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* KPIs / COMPTEURS EN TEMPS RÉEL (Défilement naturel pour libérer tout l'écran sur mobile) */}
      <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-3 sm:pt-4">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
          <div className="col-span-2 lg:col-span-1 lg:order-2 bg-charcoal/95 gold-border rounded-xl p-2.5 sm:p-3 flex flex-col justify-between">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
              Trésorerie &amp; Actifs Totaux
            </span>
            <div className="mt-1 sm:mt-1.5 flex items-baseline justify-between gap-2">
              <span className="font-display text-lg sm:text-xl font-extrabold text-gold tabular-nums">
                {formatMoney(kpis.totalWealth)}
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">Coffre Cartel</span>
            </div>
          </div>

          <div className="lg:order-1 bg-charcoal/95 bronze-border rounded-xl p-2.5 sm:p-3 flex flex-col justify-between">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
              Missions Réussies
            </span>
            <div className="mt-1 sm:mt-1.5 flex items-baseline justify-between gap-1.5 flex-wrap">
              <span className="font-display text-base sm:text-xl font-extrabold text-white tabular-nums">
                {kpis.successCount} / {TOTAL_WEEKLY_MISSIONS}
              </span>
              <span className="text-[10px] text-crimson-light font-mono tabular-nums">
                ❌ {kpis.failCount}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigateToTab('treasury')}
            title="Voir le détail des objets à vendre dans la Trésorerie"
            className="lg:order-3 bg-charcoal/95 border border-gold/45 hover:border-gold rounded-xl p-2.5 sm:p-3 flex flex-col justify-between text-left transition cursor-pointer"
          >
            <span className="text-[10px] uppercase tracking-wider text-gold-light font-semibold truncate">
              💎 Recel à Vendre
            </span>
            <div className="mt-1 sm:mt-1.5 flex items-baseline justify-between gap-1.5 flex-wrap">
              <span className="font-display text-base sm:text-xl font-extrabold text-gold tabular-nums">
                {formatMoney(kpis.rewardsValTotal)}
              </span>
              <span className="text-[10px] text-zinc-400 font-mono tabular-nums">
                {kpis.rewardsItemCount} obj.
              </span>
            </div>
          </button>

          <div className="lg:order-4 bg-charcoal/95 bronze-border rounded-xl p-2.5 sm:p-3 flex flex-col justify-between">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
              Gains Bruts
            </span>
            <div className="mt-1 sm:mt-1.5 flex items-baseline justify-between gap-1.5 flex-wrap">
              <span className="font-display text-base sm:text-xl font-extrabold text-emerald-400 tabular-nums">
                {formatMoney(kpis.grossGains)}
              </span>
              <span className="hidden sm:inline text-[10px] text-emerald-500/80 font-mono">
                Butin total
              </span>
            </div>
          </div>

          <div className="lg:order-5 bg-charcoal/95 bronze-border rounded-xl p-2.5 sm:p-3 flex flex-col justify-between">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
              Bénéfice Net
            </span>
            <div className="mt-1 sm:mt-1.5 flex items-baseline justify-between gap-1.5 flex-wrap">
              <span
                className={`font-display text-base sm:text-xl font-extrabold truncate tabular-nums ${
                  kpis.netProfit > 0
                    ? 'text-emerald-400'
                    : kpis.netProfit < 0
                      ? 'text-crimson-light'
                      : 'text-white'
                }`}
              >
                {formatMoney(kpis.netProfit)}
              </span>
              <span className="hidden sm:inline text-[10px] text-zinc-500 font-mono">
                Net semaine
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* CONTENU PRINCIPAL */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* BANNIÈRE SEMAINE */}
        {staleWeek ? (
          <div className="bg-gold/10 border border-gold/45 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-gold-light text-xs">
            <span>
              ⚠️ Les données affichées sont celles de la{' '}
              <strong>semaine {weekRangeText(missionStates)}</strong>. Une nouvelle semaine a commencé (aujourd&apos;hui : {todayText}). Pense à <strong>Copier Bilan</strong> avant de passer à la suite.
            </span>
            {readonly ? (
              <span className="italic text-gold-light/80">
                Un membre autorisé doit démarrer la nouvelle semaine.
              </span>
            ) : (
              <button
                type="button"
                onClick={handleStartNewWeek}
                className="px-3.5 py-2 rounded-lg text-xs font-bold bg-gold hover:bg-gold-light text-obsidian transition shrink-0 cursor-pointer"
              >
                Démarrer la nouvelle semaine
              </button>
            )}
          </div>
        ) : (
          <div className="bg-charcoal/95 gold-border rounded-xl px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
            <span className="text-zinc-300">
              📅 <strong className="text-gold">Semaine {weekRangeText(missionStates)}</strong>
            </span>
            <span className="text-zinc-400 capitalize">Aujourd&apos;hui : {todayText}</span>
          </div>
        )}

        {/* BANNIÈRE AVERTISSEMENT LECTURE SEULE */}
        {readonly && (
          <div className="bg-gold/10 border border-gold/40 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-gold-light text-xs">
            <div className="flex items-center gap-2.5">
              <Lock className="w-5 h-5 text-gold shrink-0" />
              <span>
                <strong>Accès Consultation (Lecture Seule) :</strong> Tout le cartel voit le planning et la comptabilité en temps réel. Seuls les membres autorisés avec le code secret peuvent modifier.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="px-3.5 py-1.5 bg-gold hover:bg-gold-light text-obsidian font-bold rounded-lg transition whitespace-nowrap shadow-sm cursor-pointer"
            >
              🔑 Déverrouiller l&apos;édition
            </button>
          </div>
        )}

        {currentTab === 'home' && (
          <DashboardHomeView
            missionStates={missionStates}
            scheduleMeta={scheduleMeta}
            inventoryStock={inventoryStock}
            inventoryPrices={inventoryPrices}
            weaponsStock={weaponsStock}
            rewardStocks={rewardStocks}
            treasuryMoney={treasuryMoney}
            catalogGroups={catalogGroups}
            members={hierMembers}
            memberRankings={memberRankings}
            kpis={kpis}
            readonly={readonly}
            onNavigateTab={setCurrentTab}
            onOpenMissionValidation={handleOpenMissionValidation}
            onOpenCatalog={handleOpenCatalog}
            onGoToOrdersWithGroup={handleGoToOrdersWithGroup}
            onOpenGazette={() => setGazetteModalOpen(true)}
          />
        )}

        <Suspense
          fallback={
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-zinc-400">
              <div className="w-7 h-7 rounded-full border-2 border-gold border-t-transparent animate-spin" />
              <span className="text-xs font-mono">Chargement...</span>
            </div>
          }
        >
        {currentTab === 'planning' && (
          <PlanningView
            missionStates={missionStates}
            scheduleMeta={scheduleMeta}
            inventoryStock={inventoryStock}
            inventoryPrices={inventoryPrices}
            catalogGroups={catalogGroups}
            members={hierMembers}
            readonly={readonly}
            onOpenMissionValidation={handleOpenMissionValidation}
            onResetMission={handleResetMissionFromModal}
            onToggleWholeDay={handleToggleWholeDay}
            onToggleAllWeek={handleToggleAllWeek}
            onRecalculateSchedule={handleRecalculateScheduleNow}
            onResetScheduleOverrides={handleResetScheduleOverrides}
            onMoveMissionDay={handleMoveMissionDay}
            onSwapMissions={handleSwapMissions}
            onSendToEminenceCart={handleSendToEminenceCart}
          />
        )}

        {currentTab === 'inventory' && (
          <InventoryView
            inventoryStock={inventoryStock}
            inventoryPrices={inventoryPrices}
            weaponsStock={weaponsStock}
            rewardStocks={rewardStocks}
            catalogGroups={catalogGroups}
            missionStates={missionStates}
            scheduleMeta={scheduleMeta}
            treasuryMoney={treasuryMoney}
            members={hierMembers}
            readonly={readonly}
            onUpdateStock={handleUpdateStock}
            onUpdateItemPrice={handleUpdateItemPrice}
            onResetStock={handleResetStock}
            onConvertMissionPack={handleConvertMissionPack}
            onAssembleAllPossiblePacks={handleAssembleAllPossiblePacks}
            onQuickBuyCatalogItems={handleQuickBuyCatalogItems}
            onSendToEminenceCart={handleSendToEminenceCart}
            onSaveWeapon={handleSaveWeapon}
            onUpdateWeaponQty={handleUpdateWeaponQty}
            onDeleteWeapon={handleDeleteWeapon}
            onLoseWeaponGlobal={handleLoseWeaponGlobal}
            onUpdateRewardQty={handleUpdateRewardQty}
            onSellRewards={handleSellRewards}
            onShowToast={showToast}
          />
        )}

        {currentTab === 'garage' && (
          <GarageView
            fleetState={fleetState}
            members={hierMembers}
            readonly={readonly}
            canSendDiscord={
              isValidDiscordWebhookUrl(discordConfig.webhookUrl) || hasDiscordEnvFallback
            }
            onSaveFleet={handleSaveFleet}
            onShareFleetDiscord={handleShareFleetDiscord}
            onShowToast={(msg) => showToast(msg)}
          />
        )}

        {currentTab === 'orders' && (
          <OrdersView
            missionStates={missionStates}
            scheduleMeta={scheduleMeta}
            inventoryStock={inventoryStock}
            inventoryPrices={inventoryPrices}
            treasuryMoney={treasuryMoney}
            catalogGroups={catalogGroups}
            selectedCatalogGroupId={selectedCatalogGroupId}
            onSelectCatalogGroupId={setSelectedCatalogGroupId}
            groupOrderCarts={groupOrderCarts}
            onAdjustGroupOrderItem={handleAdjustGroupOrderItem}
            onClearGroupOrder={handleClearGroupOrder}
            onConfirmGroupOrder={handleConfirmGroupOrder}
            onOpenCatalog={handleOpenCatalog}
            onSendToEminenceCart={handleSendToEminenceCart}
            readonly={readonly}
            onReceiveOrder={handleReceiveOrder}
            onUpdateItemPrice={handleUpdateItemPrice}
            onShowToast={showToast}
          />
        )}

        {currentTab === 'catalog' && (
          <CatalogView
            catalogGroups={catalogGroups}
            selectedGroupId={selectedCatalogGroupId}
            onSelectGroupId={setSelectedCatalogGroupId}
            groupOrderCarts={groupOrderCarts}
            onAdjustGroupOrderItem={handleAdjustGroupOrderItem}
            onSetGroupOrderItemQty={handleSetGroupOrderItemQty}
            onClearGroupOrder={handleClearGroupOrder}
            onConfirmGroupOrder={handleConfirmGroupOrder}
            onGoToOrdersWithGroup={handleGoToOrdersWithGroup}
            onSaveCatalogGroups={handleSaveCatalogGroups}
            inventoryStock={inventoryStock}
            inventoryPrices={inventoryPrices}
            rewardStocks={rewardStocks}
            treasuryMoney={treasuryMoney}
            readonly={readonly}
            onShowToast={showToast}
          />
        )}

        {currentTab === 'treasury' && (
          <TreasuryView
            treasuryMoney={treasuryMoney}
            rewardStocks={rewardStocks}
            inventoryStock={inventoryStock}
            inventoryPrices={inventoryPrices}
            weaponsStock={weaponsStock}
            missionStates={missionStates}
            weaponsLossAmount={weaponsLossAmount}
            members={hierMembers}
            catalogGroups={catalogGroups}
            readonly={readonly}
            onUpdateTreasuryMoney={handleUpdateTreasuryMoney}
            onUpdateRewardQty={handleUpdateRewardQty}
            onUpdateRewardValue={handleUpdateRewardValue}
            onApplyOfficialRewardPrices={handleApplyOfficialRewardPrices}
            onSellRewards={handleSellRewards}
          />
        )}

        {currentTab === 'accounting' && (
          <AccountingView
            missionStates={missionStates}
            scheduleMeta={scheduleMeta}
            members={hierMembers}
            weaponsStock={weaponsStock}
            weaponsLossAmount={weaponsLossAmount}
            inventoryPrices={inventoryPrices}
            catalogGroups={catalogGroups}
            readonly={readonly}
            onUpdateWeaponsLoss={handleUpdateWeaponsLoss}
            onLoseWeaponGlobal={handleLoseWeaponGlobal}
            onOpenPayrollHistory={() => setCurrentTab('history')}
            onOpenArchives={() => setCurrentTab('archives')}
          />
        )}

        {currentTab === 'history' && (
          <WeeklyHistoryPayrollView
            missionStates={missionStates}
            scheduleMeta={scheduleMeta}
            members={hierMembers}
            weaponsLossAmount={weaponsLossAmount}
            inventoryPrices={inventoryPrices}
            catalogGroups={catalogGroups}
            treasuryMoney={treasuryMoney}
            historyState={historyState}
            readonly={readonly}
            onUpdateCurrentPayroll={handleUpdateCurrentPayroll}
            onSettleSundayPayroll={handleSettleSundayPayroll}
            onCancelPayrollSettlement={handleCancelPayrollSettlement}
            onArchiveCurrentWeek={() => handleArchiveCurrentWeek()}
            onToggleArchivedMemberPaid={handleToggleArchivedMemberPaid}
            onSettleArchivedPayroll={handleSettleArchivedPayroll}
            onCancelArchivedPayrollSettlement={handleCancelArchivedPayrollSettlement}
            onDeleteWeekArchive={handleDeleteWeekArchive}
            onOpenArchivesPage={() => setCurrentTab('archives')}
            onShowToast={(msg) => showToast(msg)}
          />
        )}

        {currentTab === 'archives' && (
          <ArchivesView
            missionStates={missionStates}
            scheduleMeta={scheduleMeta}
            members={hierMembers}
            memberRankings={memberRankings}
            weaponsLossAmount={weaponsLossAmount}
            inventoryStock={inventoryStock}
            inventoryPrices={inventoryPrices}
            weaponsStock={weaponsStock}
            rewardStocks={rewardStocks}
            catalogGroups={catalogGroups}
            treasuryMoney={treasuryMoney}
            historyState={historyState}
            readonly={readonly}
            onArchiveCurrentWeek={handleArchiveCurrentWeek}
            onUpdateArchiveNotes={handleUpdateArchiveNotes}
            onToggleArchivedMemberPaid={handleToggleArchivedMemberPaid}
            onSettleArchivedPayroll={handleSettleArchivedPayroll}
            onCancelArchivedPayrollSettlement={handleCancelArchivedPayrollSettlement}
            onDeleteWeekArchive={handleDeleteWeekArchive}
            onOpenPayrollTab={() => setCurrentTab('history')}
            onShowToast={(msg) => showToast(msg)}
          />
        )}

        {currentTab === 'ranking' && (
          <RankingView
            members={hierMembers}
            missionStates={missionStates}
            weaponsStock={weaponsStock}
            memberRankings={memberRankings}
            inventoryPrices={inventoryPrices}
            catalogGroups={catalogGroups}
            readonly={readonly}
            onUpdateMemberRankings={handleUpdateMemberRankings}
            onShowToast={showToast}
          />
        )}

        {currentTab === 'hierarchy' && (
          <HierarchyView
            members={hierMembers}
            readonly={readonly}
            onSaveMember={handleSaveHierarchyMember}
            onDeleteMember={handleDeleteHierarchyMember}
            onShowToast={showToast}
          />
        )}

        {currentTab === 'album' && (
          <AlbumView
            albumState={albumState}
            defaultAuthorName={authUser.displayName || authUser.email?.split('@')[0] || 'Los Cerberos'}
            readonly={readonly}
            onAddPhoto={handleAddAlbumPhoto}
            onUpdatePhotoMeta={handleUpdateAlbumPhotoMeta}
            onDeletePhoto={handleDeleteAlbumPhoto}
            onToggleFavorite={handleToggleAlbumFavorite}
            onRequestUnlock={() => setAuthModalOpen(true)}
            onShowToast={showToast}
          />
        )}
        </Suspense>
      </main>

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8 border-t border-bronze/30 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] tracking-[0.24em] uppercase text-zinc-500 text-center sm:text-left">
        <span className="text-gold/80 font-semibold">
          TRAICIONADOS POR EL ESTADO, JURAMENTADOS POR LA SANGRE
        </span>
        <span>LOS CERBEROS · GTA RP</span>
      </footer>

      {/* BARRE DE NAVIGATION MOBILE FIXE EN BAS */}
      <nav
        aria-label="Navigation mobile"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-obsidian/98 border-t border-gold/30 pb-safe shadow-[0_-6px_18px_rgba(0,0,0,0.75)]"
      >
        <div className="grid grid-cols-5 items-stretch">
          {(
            [
              { key: 'home', label: 'Accueil', Icon: LayoutDashboard },
              { key: 'planning', label: 'Planning', Icon: Calendar },
              { key: 'inventory', label: 'Stock', Icon: Package },
              { key: 'garage', label: 'Garage', Icon: Car },
            ] as const
          ).map(({ key, label, Icon }) => {
            const active = currentTab === key && !mobileMenuOpen;
            return (
              <button
                key={key}
                type="button"
                onClick={() => navigateToTab(key)}
                className={`flex flex-col items-center justify-center gap-1 py-2.5 px-1 transition cursor-pointer ${
                  active ? 'text-gold-light' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'text-gold' : ''}`} />
                <span className="text-[10px] font-bold tracking-wide leading-none">
                  {label}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className={`flex flex-col items-center justify-center gap-1 py-2.5 px-1 transition cursor-pointer ${
              mobileMenuOpen || isSecondaryMobileTab
                ? 'text-gold-light'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <LayoutGrid
              className={`w-5 h-5 ${
                mobileMenuOpen || isSecondaryMobileTab ? 'text-gold' : ''
              }`}
            />
            <span className="text-[10px] font-bold tracking-wide leading-none">
              Plus
            </span>
          </button>
        </div>
      </nav>

      {/* MENU TIROIR MOBILE COMPLET */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/85 flex items-end"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-full max-h-[85vh] overflow-y-auto bg-charcoal border-t border-gold/45 rounded-t-2xl p-4 pb-safe shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-zinc-700 mx-auto" />
            <div className="flex items-center justify-between gap-3 border-b border-bronze/40 pb-3">
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-gold-light">
                  Navigation Cartel
                </div>
                <div className="text-xs text-zinc-400 truncate mt-0.5">
                  {authUser.displayName || authUser.email}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg bg-obsidian text-zinc-400 hover:text-white transition cursor-pointer"
                aria-label="Fermer le menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {mobileNavItems.map(({ key, label, Icon }) => {
                const active = currentTab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => navigateToTab(key)}
                    className={`flex flex-col items-center justify-center gap-1.5 rounded-xl p-3 text-center transition cursor-pointer ${
                      active
                        ? 'bg-gold/15 border border-gold text-gold-light shadow-md'
                        : 'bg-obsidian/80 border border-bronze/40 text-zinc-300 hover:text-white hover:border-gold/50'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${active ? 'text-gold' : 'text-zinc-400'}`} />
                    <span className="text-[11px] font-bold leading-tight">{label}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-bronze/35">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setGazetteModalOpen(true);
                }}
                className="px-3 py-2.5 rounded-xl text-xs font-bold bg-obsidian border border-gold/45 text-gold-light flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Newspaper className="w-4 h-4 text-gold" />
                Gazette Discord
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  void handleCopyReport();
                }}
                className="px-3 py-2.5 rounded-xl text-xs font-bold bg-gold text-obsidian flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ClipboardCopy className="w-4 h-4" />
                Copier Bilan
              </button>
              <a
                href="https://sunnycom.tech/feed"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2.5 rounded-xl text-xs font-bold bg-emerald-950/70 border border-emerald-500/45 text-emerald-200 flex items-center justify-center gap-1.5"
              >
                <Globe className="w-4 h-4 text-emerald-400" />
                SunnyCom
                <ExternalLink className="w-3 h-3" />
              </a>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setAuthModalOpen(true);
                }}
                className="px-3 py-2.5 rounded-xl text-xs font-bold bg-obsidian border border-bronze/50 text-zinc-200 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Lock className="w-4 h-4 text-gold" />
                {isUnlocked ? 'Mode Éditeur' : 'Déverrouiller'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                void handleSignOut();
              }}
              className="w-full py-2.5 rounded-xl text-xs font-semibold bg-obsidian/70 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Déconnexion
            </button>
          </div>
        </div>
      )}

      <AuthModal
        open={authModalOpen}
        isUnlocked={isUnlocked}
        onClose={() => setAuthModalOpen(false)}
        onVerifyCode={handleVerifySecretCode}
        onLock={handleLockEditMode}
        onUpdateSecretCode={handleUpdateSecretCode}
      />

      {gazetteModalOpen && (
        <Suspense fallback={null}>
          <DiscordGazetteModal
            open={gazetteModalOpen}
            readonly={readonly}
            senderName={authUser.displayName || authUser.email?.split('@')[0] || 'Éditeur'}
            getIdToken={() => authUser.getIdToken()}
            discordConfig={discordConfig}
            hasEnvFallback={hasDiscordEnvFallback}
            missionStates={missionStates}
            scheduleMeta={scheduleMeta}
            inventoryStock={inventoryStock}
            inventoryPrices={inventoryPrices}
            weaponsStock={weaponsStock}
            rewardStocks={rewardStocks}
            treasuryMoney={treasuryMoney}
            weaponsLossAmount={weaponsLossAmount}
            hierMembers={hierMembers}
            memberRankings={memberRankings}
            catalogGroups={catalogGroups}
            albumState={albumState}
            historyState={historyState}
            onClose={() => setGazetteModalOpen(false)}
            onSaveConfig={handleSaveDiscordConfig}
            onRequestUnlock={() => {
              setGazetteModalOpen(false);
              setAuthModalOpen(true);
            }}
            onShowToast={(msg) => showToast(msg)}
          />
        </Suspense>
      )}

      {Boolean(validatingMission) && (
        <Suspense fallback={null}>
          <MissionValidationModal
            open={Boolean(validatingMission)}
            mission={validatingMission?.mission || null}
            dayName={validatingMission?.dayName || ''}
            initialStatus={validatingMission?.initialStatus}
            entry={
              validatingMission
                ? getMissionEntry(missionStates, validatingMission.mission.id)
                : {}
            }
            inventoryStock={inventoryStock}
            inventoryPrices={inventoryPrices}
            catalogGroups={catalogGroups}
            weaponsStock={weaponsStock}
            rewardStocks={rewardStocks}
            treasuryMoney={treasuryMoney}
            members={hierMembers}
            onClose={() => setValidatingMission(null)}
            onConfirm={handleConfirmMissionValidation}
            onResetMission={handleResetMissionFromModal}
          />
        </Suspense>
      )}

      <OfflineIndicator />

      <Toast
        message={toastState?.message ?? null}
        variant={toastState?.variant}
        actionLabel={
          toastState?.actionType === 'stock'
            ? 'Voir stock'
            : toastState?.actionType === 'loot'
              ? 'Objets à vendre'
              : undefined
        }
        onAction={
          toastState?.actionType === 'stock'
            ? handleGoToOrderPrep
            : toastState?.actionType === 'loot'
              ? handleGoToLootSale
              : undefined
        }
        onDismiss={() => setToastState(null)}
      />
    </div>
  );
}
