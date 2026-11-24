import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  BookOpen,
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  Crosshair,
  ExternalLink,
  Gem,
  Globe,
  Image as ImageIcon,
  KeyRound,
  Newspaper,
  Package,
  Shield,
  ShoppingCart,
  Trophy,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import bradHeroImg from '@/src/assets/images/catalog_brad_purple_hero_1795290573562.jpg';
import eminenceHeroImg from '@/src/assets/images/catalog_eminence_hero_1795290844928.jpg';
import marabuntaHeroImg from '@/src/assets/images/catalog_marabunta_hero_1795290323047.jpg';
import armoryImg from '@/src/assets/images/dashboard_armory_arsenal_1795298255791.jpg';
import heistOpsImg from '@/src/assets/images/dashboard_heist_ops_1795298255634.jpg';
import hqHeroImg from '@/src/assets/images/dashboard_hq_hero_1795298255836.jpg';
import vaultCoffreImg from '@/src/assets/images/dashboard_vault_coffre_1795298255079.jpg';
import { BUILT_IN_ALBUM_PHOTOS } from '@/src/data/albumData';
import {
  HIER_UNITS,
  INVENTORY_ITEMS,
  REWARD_ITEMS,
  TOTAL_WEEKLY_MISSIONS,
} from '@/src/data/cartelData';
import { checkMissionStockAvailability } from '@/src/data/eminenceMissions';
import type {
  CatalogGroupsMap,
  HierarchyMember,
  InventoryPrices,
  InventoryStock,
  MemberRankingsMap,
  Mission,
  MissionScheduleMeta,
  MissionStates,
  RewardStocks,
  TabKey,
  TreasuryMoney,
  WeaponsStock,
} from '@/src/types/cartel';
import {
  calcInventoryTotalValue,
  calcRewardsTotalValue,
  calcTotalWealth,
  calcWeaponsTotalValue,
  computeMemberLeaderboard,
  formatMoney,
  formatSigned,
  getInventoryItemPrice,
  getMissionEntry,
  getStatus,
  weekRangeText,
} from '@/src/utils/finance';
import {
  getCurrentWeekTodayName,
  getEffectiveSchedule,
  type EffectiveMission,
} from '@/src/utils/schedule';
import { simulateMissionSupplyPlan } from '@/src/utils/missionSupply';

interface DashboardHomeViewProps {
  missionStates: MissionStates;
  scheduleMeta: MissionScheduleMeta;
  inventoryStock: InventoryStock;
  inventoryPrices: InventoryPrices;
  weaponsStock: WeaponsStock;
  rewardStocks: RewardStocks;
  treasuryMoney: TreasuryMoney;
  catalogGroups: CatalogGroupsMap;
  members: HierarchyMember[];
  memberRankings: MemberRankingsMap;
  kpis: {
    successCount: number;
    failCount: number;
    grossGains: number;
    netProfit: number;
    totalWealth: number;
    rewardsValTotal: number;
    rewardsItemCount: number;
  };
  readonly: boolean;
  onNavigateTab: (tab: TabKey) => void;
  onOpenMissionValidation: (
    mission: Mission,
    dayName: string,
    initialStatus: 'success' | 'fail'
  ) => void;
  onOpenCatalog: (groupId?: string) => void;
  onGoToOrdersWithGroup: (groupId: string) => void;
  onOpenGazette: () => void;
}

interface DashboardPhotoProps {
  src: string;
  alt: string;
  fallbackTitle: string;
  className?: string;
}

const DashboardPhoto: React.FC<DashboardPhotoProps> = ({
  src,
  alt,
  fallbackTitle,
  className = '',
}) => {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div
        className={`w-full h-full flex flex-col items-center justify-center gap-2 bg-charcoal text-zinc-400 p-4 text-center ${className}`}
      >
        <ImageIcon className="w-7 h-7 text-gold/60" />
        <span className="text-xs font-semibold text-zinc-300">{fallbackTitle}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={`w-full h-full object-cover ${className}`}
    />
  );
};

const PARTNER_VISUALS: Record<string, { img: string; label: string }> = {
  marabunta: {
    img: marabuntaHeroImg,
    label: 'Marabunta Grande — Munitions, Accessoires & Gilets',
  },
  eminence: {
    img: eminenceHeroImg,
    label: 'Éminences — Clés, Packs de Braquage & Whiskey',
  },
  brad_recel: {
    img: bradHeroImg,
    label: 'Brad — Rachat Marché Noir & Objets Volés',
  },
};

export const DashboardHomeView: React.FC<DashboardHomeViewProps> = ({
  missionStates,
  scheduleMeta,
  inventoryStock,
  inventoryPrices,
  weaponsStock,
  rewardStocks,
  treasuryMoney,
  catalogGroups,
  members,
  memberRankings,
  kpis,
  readonly,
  onNavigateTab,
  onOpenMissionValidation,
  onOpenCatalog,
  onGoToOrdersWithGroup,
  onOpenGazette,
}) => {
  const effectiveSchedule = useMemo(
    () => getEffectiveSchedule(missionStates, scheduleMeta),
    [missionStates, scheduleMeta]
  );

  const detectedTodayName = useMemo(
    () => getCurrentWeekTodayName(missionStates, new Date()),
    [missionStates]
  );

  const activeDaySchedule = useMemo(() => {
    if (detectedTodayName) {
      return (
        effectiveSchedule.days.find((d) => d.day === detectedTodayName) ||
        effectiveSchedule.days[0]
      );
    }
    return effectiveSchedule.days[0];
  }, [detectedTodayName, effectiveSchedule]);

  const activeDayName = activeDaySchedule?.day || 'Lundi';
  const isSundayToday = new Date().getDay() === 0;

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

  const missionReadiness = useMemo(() => {
    const readyMajorTitles = supplyPlan.missionsOverview
      .filter((ov) => ov.mission.major && ov.totalReadyRuns > 0)
      .map((ov) => ov.mission.title);

    return {
      readyCount: supplyPlan.readyMissionsCount,
      total: supplyPlan.totalMissionsCount,
      readyMajorTitles,
    };
  }, [supplyPlan]);

  const lootSummary = useMemo(() => {
    const whiskeyItem = REWARD_ITEMS.find((r) => r.key === 'whiskey_luxe');
    const whiskeyQty = Math.max(0, Number(rewardStocks.whiskey_luxe?.qty) || 0);
    const whiskeyUnitVal =
      rewardStocks.whiskey_luxe?.val !== undefined
        ? Math.max(0, Number(rewardStocks.whiskey_luxe.val) || 0)
        : whiskeyItem?.defaultVal || 15;
    const whiskeyValue = whiskeyQty * whiskeyUnitVal;

    const totalLootValue = calcRewardsTotalValue(rewardStocks);
    const recelValue = Math.max(0, totalLootValue - whiskeyValue);
    const recelCount = Math.max(0, kpis.rewardsItemCount - whiskeyQty);

    return {
      whiskeyQty,
      whiskeyValue,
      recelCount,
      recelValue,
      totalLootValue,
    };
  }, [rewardStocks, kpis.rewardsItemCount]);

  const armorySummary = useMemo(() => {
    let totalWeaponsCount = 0;
    Object.values(weaponsStock).forEach((w) => {
      if (!w || typeof w !== 'object') return;
      totalWeaponsCount += Math.max(0, Math.floor(Number(w.qty) || 0));
    });
    const weaponsValue = calcWeaponsTotalValue(weaponsStock);
    const vestsQty = Math.max(0, Math.floor(Number(inventoryStock.gilet) || 0));
    const vestsValue = vestsQty * getInventoryItemPrice('gilet', inventoryPrices);
    const fullInventoryValue = calcInventoryTotalValue(
      inventoryStock,
      inventoryPrices,
      catalogGroups
    );
    return {
      totalWeaponsCount,
      weaponsValue,
      vestsQty,
      vestsValue,
      fullInventoryValue,
    };
  }, [weaponsStock, inventoryStock, inventoryPrices, catalogGroups]);

  const topMembers = useMemo(
    () =>
      computeMemberLeaderboard({
        members,
        missionStates,
        weaponsStock,
        memberRankings,
        inventoryPrices,
        catalogGroups,
      }).slice(0, 4),
    [members, missionStates, weaponsStock, memberRankings, inventoryPrices, catalogGroups]
  );

  const weekProgressPct = useMemo(() => {
    const done = kpis.successCount + kpis.failCount;
    return TOTAL_WEEKLY_MISSIONS > 0
      ? Math.min(100, Math.round((done / TOTAL_WEEKLY_MISSIONS) * 100))
      : 0;
  }, [kpis.successCount, kpis.failCount]);

  const partnerCards = useMemo(() => {
    const orderedIds = ['marabunta', 'eminence', 'brad_recel'];
    return orderedIds
      .map((id) => catalogGroups[id])
      .filter((g): g is NonNullable<typeof g> => Boolean(g));
  }, [catalogGroups]);

  const todayStats = useMemo(() => {
    const list = activeDaySchedule?.missions || [];
    let ok = 0;
    let ko = 0;
    let pending = 0;
    list.forEach((m) => {
      const st = getStatus(getMissionEntry(missionStates, m.id));
      if (st === 'success') ok++;
      else if (st === 'fail') ko++;
      else pending++;
    });
    return { total: list.length, ok, ko, pending };
  }, [activeDaySchedule, missionStates]);

  const totalCashLiquid =
    Math.max(0, Number(treasuryMoney.legal) || 0) +
    Math.max(0, Number(treasuryMoney.illegal) || 0);

  const computedWealth = calcTotalWealth({
    treasuryMoney,
    rewardStocks,
    inventoryStock,
    inventoryPrices,
    weaponsStock,
    catalogGroups,
  });

  return (
    <div className="space-y-6">
      {/* 1. HERO WAR-ROOM + PROGRAMME DU JOUR */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* HERO IMAGE BANNER (8 COLS) */}
        <div className="lg:col-span-8 relative rounded-2xl overflow-hidden gold-border bg-charcoal min-h-[340px] sm:min-h-[380px] flex flex-col justify-end shadow-2xl group">
          <div className="absolute inset-0">
            <DashboardPhoto
              src={hqHeroImg}
              alt="Salle de commandement Los Cerberos"
              fallbackTitle="Quartier Général · Los Cerberos"
              className="group-hover:scale-[1.02] transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/80 to-obsidian/30" />
            <div className="absolute inset-0 bg-gradient-to-r from-obsidian/90 via-obsidian/45 to-transparent" />
          </div>

          <div className="relative z-10 p-5 sm:p-7 flex flex-col justify-between h-full gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-gold-light">
                Quartier Général · Semaine {weekRangeText(missionStates)}
              </div>
              <div className="text-[11px] font-mono text-zinc-300 tabular-nums">
                {supplyPlan.allOver30Days
                  ? 'Autonomie stock : > 30 jours'
                  : `Autonomie stock : ${supplyPlan.minDaysCovered} jour${supplyPlan.minDaysCovered > 1 ? 's' : ''}`}
              </div>
            </div>

            <div className="space-y-4 max-w-2xl">
              <h2 className="font-display text-2xl sm:text-4xl font-extrabold tracking-wide text-white text-balance leading-tight">
                Centre de Commandement{' '}
                <span className="text-gold">Los Cerberos</span>
              </h2>
              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed max-w-xl">
                Supervision en temps réel des opérations hebdomadaires, des packs Éminences, de l&apos;arsenal et de la trésorerie du cartel.
              </p>

              {/* Métriques clés intégrées sur fond lisible */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                <div className="rounded-xl bg-obsidian/80 backdrop-blur-sm border border-bronze/50 px-3.5 py-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-400">
                    Patrimoine Global
                  </div>
                  <div className="font-display text-base sm:text-lg font-extrabold text-gold tabular-nums mt-0.5">
                    {formatMoney(computedWealth)}
                  </div>
                </div>
                <div className="rounded-xl bg-obsidian/80 backdrop-blur-sm border border-bronze/50 px-3.5 py-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-400">
                    Missions Prêtes
                  </div>
                  <div className="font-display text-base sm:text-lg font-extrabold text-white tabular-nums mt-0.5">
                    {missionReadiness.readyCount} / {missionReadiness.total}
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-1 rounded-xl bg-obsidian/80 backdrop-blur-sm border border-bronze/50 px-3.5 py-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-400">
                    Bénéfice Net
                  </div>
                  <div
                    className={`font-display text-base sm:text-lg font-extrabold tabular-nums mt-0.5 ${
                      kpis.netProfit >= 0 ? 'text-emerald-400' : 'text-crimson-light'
                    }`}
                  >
                    {formatSigned(kpis.netProfit)}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => onNavigateTab('planning')}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-gold hover:bg-gold-light text-obsidian transition inline-flex items-center gap-2 shadow-lg shadow-gold/15 cursor-pointer"
                >
                  <Calendar className="w-4 h-4" />
                  Ouvrir le Planning
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab('inventory')}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-obsidian/85 hover:bg-charcoal text-zinc-100 border border-gold/45 hover:border-gold transition inline-flex items-center gap-2 cursor-pointer"
                >
                  <Package className="w-4 h-4 text-gold" />
                  Inventaire &amp; Packs
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab('orders')}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-obsidian/70 hover:bg-charcoal text-zinc-300 hover:text-white border border-bronze/50 transition inline-flex items-center gap-2 cursor-pointer"
                >
                  <ShoppingCart className="w-4 h-4 text-gold-light" />
                  Passer Commande
                </button>
                <a
                  href="https://sunnycom.tech/feed"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-950/75 hover:bg-emerald-900/80 text-emerald-200 hover:text-white border border-emerald-500/45 hover:border-emerald-400 transition inline-flex items-center gap-2 shadow-md"
                >
                  <Globe className="w-4 h-4 text-emerald-400" />
                  SunnyCom · Feed RP
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-300/80" />
                </a>
                <button
                  type="button"
                  onClick={onOpenGazette}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-crimson-dark/70 hover:bg-crimson text-gold-light hover:text-white border border-gold/45 hover:border-gold transition inline-flex items-center gap-2 shadow-md cursor-pointer"
                >
                  <Newspaper className="w-4 h-4 text-gold" />
                  Gazette Discord
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* PROGRAMME DU JOUR (4 COLS) */}
        <div className="lg:col-span-4 bg-charcoal/95 bronze-border rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-xl">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2 border-b border-bronze/35 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-gold-light block">
                  {detectedTodayName ? 'Aujourd’hui' : 'Aperçu Jour'}
                </span>
                <h3 className="font-display text-lg font-extrabold text-white mt-0.5">
                  Programme — {activeDayName}
                </h3>
              </div>
              <div className="text-right text-[11px] font-mono tabular-nums text-zinc-400">
                <span className="text-emerald-400 font-bold">{todayStats.ok} OK</span>
                {' · '}
                <span className="text-zinc-200">{todayStats.pending} à faire</span>
              </div>
            </div>

            {isSundayToday && kpis.rewardsItemCount > 0 && (
              <button
                type="button"
                onClick={() => onNavigateTab('treasury')}
                className="w-full text-left rounded-xl bg-gold/15 border border-gold/50 hover:border-gold px-3.5 py-2.5 transition cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2 text-xs font-bold text-gold-light">
                  <span>Jour de revente — Dimanche</span>
                  <span className="font-mono tabular-nums">{formatMoney(kpis.rewardsValTotal)}</span>
                </div>
                <p className="text-[11px] text-zinc-300 mt-0.5">
                  {kpis.rewardsItemCount} objet{kpis.rewardsItemCount > 1 ? 's' : ''} en attente dans la Trésorerie.
                </p>
              </button>
            )}

            {isSundayToday && (
              <button
                type="button"
                onClick={() => onNavigateTab('history')}
                className="w-full text-left rounded-xl bg-emerald-950/35 border border-emerald-500/45 hover:border-emerald-400 px-3.5 py-2.5 transition cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2 text-xs font-bold text-emerald-300">
                  <span className="inline-flex items-center gap-1.5">
                    <Banknote className="w-3.5 h-3.5" />
                    Jour de Paye — Dimanche
                  </span>
                  <span className="font-mono tabular-nums">Ouvrir →</span>
                </div>
                <p className="text-[11px] text-zinc-300 mt-0.5">
                  Calculer la paye des membres selon leurs gains et archiver la semaine.
                </p>
              </button>
            )}

            <div className="space-y-1.5 max-h-[250px] overflow-y-auto pr-1">
              {(activeDaySchedule?.missions || []).map((m: EffectiveMission) => {
                const st = getStatus(getMissionEntry(missionStates, m.id));
                const alloc = supplyPlan.allocationsByMissionId[m.id];
                const fallbackCheck = alloc
                  ? null
                  : checkMissionStockAvailability(m.gearKey, inventoryStock, catalogGroups);
                const gearAvail = alloc
                  ? alloc.available
                  : Boolean(fallbackCheck?.available);
                const viaSoloOnly = alloc
                  ? alloc.viaSoloOnly
                  : Boolean(fallbackCheck?.viaSoloOnly);
                const missingShortLabel =
                  !gearAvail && alloc && alloc.missingItems.length > 0
                    ? alloc.missingItems
                        .map((mi) =>
                          mi.missingQty > 1 ? `${mi.missingQty}× ${mi.name}` : mi.name
                        )
                        .join(', ')
                    : null;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      onOpenMissionValidation(
                        m,
                        activeDayName,
                        st === 'fail' ? 'fail' : 'success'
                      )
                    }
                    title={
                      readonly
                        ? 'Cliquez pour déverrouiller ou valider'
                        : 'Valider / Modifier cette mission'
                    }
                    className={`w-full text-left px-3 py-2 rounded-xl border transition flex items-center justify-between gap-2 cursor-pointer ${
                      st === 'success'
                        ? 'bg-emerald-950/25 border-emerald-500/35 hover:border-emerald-400/60'
                        : st === 'fail'
                          ? 'bg-red-950/25 border-crimson/40 hover:border-crimson-light/60'
                          : 'bg-obsidian/65 border-bronze/35 hover:border-gold/55'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {st === 'success' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : st === 'fail' ? (
                          <XCircle className="w-3.5 h-3.5 text-crimson-light shrink-0" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-gold shrink-0" />
                        )}
                        <span
                          className={`text-xs font-semibold truncate ${
                            m.major ? 'text-gold-light' : 'text-zinc-100'
                          }`}
                        >
                          {m.name}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-400 pl-5 truncate">
                        {m.major ? 'Gros Coup' : 'Opération'} · {m.crims} crims
                        {m.gearKey !== 'none' && !st && (
                          <span className={gearAvail ? ' text-emerald-400/90' : ' text-crimson-light'}>
                            {gearAvail
                              ? viaSoloOnly
                                ? ' · Matériel OK (items seuls)'
                                : ' · Matériel OK'
                              : missingShortLabel
                                ? ` · Manque ${missingShortLabel}`
                                : ' · Stock insuffisant'}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-400 shrink-0">
                      {st === 'success' ? 'Validée' : st === 'fail' ? 'Échec' : 'Lancer'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('planning')}
            className="w-full py-2.5 px-3.5 rounded-xl text-xs font-bold bg-obsidian hover:bg-slateDark text-gold-light border border-gold/40 hover:border-gold transition flex items-center justify-center gap-2 cursor-pointer"
          >
            Voir toute la semaine
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* 2. TROIS PÔLES OPÉRATIONNELS ILLUSTRÉS (4:3 PHOTO CARDS) */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* CARTE 1 — OPÉRATIONS & MISSIONS ÉMINENCES */}
        <article className="bg-charcoal/95 bronze-border rounded-2xl overflow-hidden flex flex-col justify-between shadow-xl group hover:border-gold/55 transition">
          <div>
            <div className="relative aspect-[4/3] overflow-hidden bg-obsidian">
              <DashboardPhoto
                src={heistOpsImg}
                alt="Matériel tactique d'opérations et de braquage"
                fallbackTitle="Opérations & Gros Coups"
                className="group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal via-charcoal/45 to-transparent" />
              <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-gold-light block">
                    01 · Préparation Terrain
                  </span>
                  <h3 className="font-display text-lg font-extrabold text-white">
                    Opérations &amp; Kits Missions
                  </h3>
                </div>
                <KeyRound className="w-5 h-5 text-gold shrink-0" />
              </div>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-baseline justify-between border-b border-bronze/30 pb-2.5">
                <span className="text-xs text-zinc-400">Missions prêtes en coffre</span>
                <span className="font-display text-lg font-extrabold text-gold tabular-nums">
                  {missionReadiness.readyCount} / {missionReadiness.total}
                </span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed min-h-[36px]">
                {missionReadiness.readyMajorTitles.length > 0 ? (
                  <>
                    Gros Coups prêts :{' '}
                    <span className="text-white font-semibold">
                      {missionReadiness.readyMajorTitles.slice(0, 3).join(', ')}
                      {missionReadiness.readyMajorTitles.length > 3
                        ? ` (+${missionReadiness.readyMajorTitles.length - 3})`
                        : ''}
                    </span>
                    .
                  </>
                ) : (
                  'Aucun Gros Coup complet en stock. Vérifiez les packs et clés Éminences.'
                )}
              </p>
            </div>
          </div>

          <div className="px-4 pb-4 pt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigateTab('inventory')}
              className="flex-1 py-2 px-3 rounded-xl text-xs font-bold bg-gold/15 hover:bg-gold hover:text-obsidian text-gold-light border border-gold/45 transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Package className="w-3.5 h-3.5" />
              Vérifier par Mission
            </button>
            <button
              type="button"
              onClick={() => onGoToOrdersWithGroup('eminence')}
              className="py-2 px-3 rounded-xl text-xs font-semibold bg-obsidian hover:bg-slateDark text-zinc-200 border border-bronze/45 transition cursor-pointer"
              title="Commander des packs ou clés Éminences"
            >
              Équiper
            </button>
          </div>
        </article>

        {/* CARTE 2 — COFFRE, LIQUIDITÉS & RECEL */}
        <article className="bg-charcoal/95 bronze-border rounded-2xl overflow-hidden flex flex-col justify-between shadow-xl group hover:border-gold/55 transition">
          <div>
            <div className="relative aspect-[4/3] overflow-hidden bg-obsidian">
              <DashboardPhoto
                src={vaultCoffreImg}
                alt="Coffre-fort de trésorerie et lingots d'or"
                fallbackTitle="Coffre & Trésorerie"
                className="group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal via-charcoal/45 to-transparent" />
              <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-gold-light block">
                    02 · Finances &amp; Recel
                  </span>
                  <h3 className="font-display text-lg font-extrabold text-white">
                    Coffre &amp; Butin à Vendre
                  </h3>
                </div>
                <Wallet className="w-5 h-5 text-gold shrink-0" />
              </div>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-baseline justify-between border-b border-bronze/30 pb-2.5">
                <span className="text-xs text-zinc-400">Cash total en caisse</span>
                <span className="font-display text-lg font-extrabold text-emerald-400 tabular-nums">
                  {formatMoney(totalCashLiquid)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-obsidian/70 border border-bronze/35 px-2.5 py-1.5">
                  <span className="text-[10px] text-zinc-400 block">Argent Sale / Légal</span>
                  <span className="font-mono font-bold text-white tabular-nums">
                    {formatMoney(treasuryMoney.illegal || 0)}
                  </span>
                </div>
                <div className="rounded-lg bg-obsidian/70 border border-bronze/35 px-2.5 py-1.5">
                  <span className="text-[10px] text-zinc-400 block">
                    Recel ({lootSummary.recelCount}) · Whiskey ({lootSummary.whiskeyQty})
                  </span>
                  <span className="font-mono font-bold text-gold tabular-nums">
                    {formatMoney(lootSummary.totalLootValue)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="px-4 pb-4 pt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigateTab('treasury')}
              className="flex-1 py-2 px-3 rounded-xl text-xs font-bold bg-gold/15 hover:bg-gold hover:text-obsidian text-gold-light border border-gold/45 transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Gem className="w-3.5 h-3.5" />
              Trésorerie
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('history')}
              className="py-2 px-3 rounded-xl text-xs font-semibold bg-obsidian hover:bg-slateDark text-emerald-300 border border-emerald-500/35 hover:border-emerald-400 transition cursor-pointer whitespace-nowrap"
            >
              Paye Dimanche
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('archives')}
              className="py-2 px-3 rounded-xl text-xs font-semibold bg-obsidian hover:bg-slateDark text-zinc-200 border border-bronze/45 hover:border-gold/50 transition cursor-pointer whitespace-nowrap"
            >
              Archives
            </button>
          </div>
        </article>

        {/* CARTE 3 — ARMURERIE, GILETS & ÉQUIPEMENT */}
        <article className="bg-charcoal/95 bronze-border rounded-2xl overflow-hidden flex flex-col justify-between shadow-xl group hover:border-gold/55 transition">
          <div>
            <div className="relative aspect-[4/3] overflow-hidden bg-obsidian">
              <DashboardPhoto
                src={armoryImg}
                alt="Armurerie tactique et gilets pare-balles du cartel"
                fallbackTitle="Armurerie & Équipement"
                className="group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal via-charcoal/45 to-transparent" />
              <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-gold-light block">
                    03 · Défense &amp; Puissance
                  </span>
                  <h3 className="font-display text-lg font-extrabold text-white">
                    Armurerie &amp; Stock Tactique
                  </h3>
                </div>
                <Crosshair className="w-5 h-5 text-gold shrink-0" />
              </div>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-baseline justify-between border-b border-bronze/30 pb-2.5">
                <span className="text-xs text-zinc-400">
                  Arsenal ({armorySummary.totalWeaponsCount} arme
                  {armorySummary.totalWeaponsCount > 1 ? 's' : ''})
                </span>
                <span className="font-display text-lg font-extrabold text-white tabular-nums">
                  {formatMoney(armorySummary.weaponsValue)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-obsidian/70 border border-bronze/35 px-2.5 py-1.5">
                  <span className="text-[10px] text-zinc-400 block">Gilets Pare-Balles</span>
                  <span className="font-mono font-bold text-white tabular-nums">
                    {armorySummary.vestsQty} ({formatMoney(armorySummary.vestsValue)})
                  </span>
                </div>
                <div className="rounded-lg bg-obsidian/70 border border-bronze/35 px-2.5 py-1.5">
                  <span className="text-[10px] text-zinc-400 block">Inventaire Total</span>
                  <span className="font-mono font-bold text-gold tabular-nums">
                    {formatMoney(armorySummary.fullInventoryValue)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="px-4 pb-4 pt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigateTab('inventory')}
              className="flex-1 py-2 px-3 rounded-xl text-xs font-bold bg-gold/15 hover:bg-gold hover:text-obsidian text-gold-light border border-gold/45 transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5" />
              Gérer l&apos;Arsenal
            </button>
            <button
              type="button"
              onClick={() => onGoToOrdersWithGroup('marabunta')}
              className="py-2 px-3 rounded-xl text-xs font-semibold bg-obsidian hover:bg-slateDark text-zinc-200 border border-bronze/45 transition cursor-pointer"
            >
              Munitions
            </button>
          </div>
        </article>
      </section>

      {/* 3. RENDEMENT & CLASSEMENT + PARTENAIRES ILLUSTRÉS */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* GAUCHE: PROGRESSION HEBDO & TOP MEMBRES (7 COLS) */}
        <div className="lg:col-span-7 bg-charcoal/95 bronze-border rounded-2xl p-5 space-y-5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bronze/35 pb-3.5">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-gold-light block">
                Effectifs &amp; Rendement
              </span>
              <h3 className="font-display text-lg font-extrabold text-white">
                Progression de la Semaine &amp; Top Membres
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigateTab('ranking')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-obsidian hover:bg-slateDark text-gold-light border border-gold/40 transition inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Trophy className="w-3.5 h-3.5" />
                Classement
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('hierarchy')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-obsidian hover:bg-slateDark text-zinc-300 hover:text-white border border-bronze/45 transition inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                Hiérarchie ({members.length})
              </button>
            </div>
          </div>

          {/* Barre de progression hebdomadaire */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-300 font-medium">
                Avancement des {TOTAL_WEEKLY_MISSIONS} opérations planifiées
              </span>
              <span className="font-mono font-bold text-gold tabular-nums">
                {kpis.successCount} réussies · {kpis.failCount} échec{kpis.failCount > 1 ? 's' : ''} ({weekProgressPct}%)
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-obsidian border border-bronze/40 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-crimson via-gold to-emerald-400 transition-all duration-500"
                style={{ width: `${weekProgressPct}%` }}
              />
            </div>
            {!supplyPlan.allOver30Days && supplyPlan.limitingMissions.length > 0 && (
              <div className="flex items-center gap-2 text-[11px] text-amber-300 pt-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>
                  Stock limitant ({supplyPlan.minDaysCovered} j) :{' '}
                  {supplyPlan.limitingMissions
                    .slice(0, 3)
                    .map((item) => item.title)
                    .join(', ')}
                  {supplyPlan.limitingMissions.length > 3
                    ? ` (+${supplyPlan.limitingMissions.length - 3})`
                    : ''}
                </span>
              </div>
            )}
          </div>

          {/* Top 4 membres du cartel */}
          <div className="space-y-2">
            <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
              Podium Opérationnel en Direct
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {topMembers.map((entry) => (
                <button
                  key={entry.member.id}
                  type="button"
                  onClick={() => onNavigateTab('ranking')}
                  className="text-left rounded-xl bg-obsidian/70 hover:bg-obsidian border border-bronze/35 hover:border-gold/55 px-3.5 py-2.5 transition flex items-center justify-between gap-3 cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono text-xs font-extrabold tabular-nums ${
                          entry.rank === 1
                            ? 'text-gold'
                            : entry.rank === 2
                              ? 'text-zinc-200'
                              : entry.rank === 3
                                ? 'text-amber-500'
                                : 'text-zinc-400'
                        }`}
                      >
                        #{entry.rank}
                      </span>
                      <span className="text-xs font-bold text-white truncate">
                        {entry.member.name}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                      {entry.levelTitle} · {HIER_UNITS[entry.member.unit] || entry.member.unit}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-xs font-bold text-gold tabular-nums">
                      {entry.totalPoints} pts
                    </div>
                    <div className="text-[10px] text-zinc-400 tabular-nums">
                      {entry.missionsOk} mission{entry.missionsOk > 1 ? 's' : ''}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Rappel rapide items standards critiques */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-bronze/30 text-[11px] text-zinc-400">
            <span>
              Équipement &amp; munitions en stock :{' '}
              <strong className="text-zinc-200 tabular-nums">
                {INVENTORY_ITEMS.reduce(
                  (sum, it) => sum + Math.max(0, Number(inventoryStock[it.key]) || 0),
                  0
                )}
              </strong>{' '}
              pièces
            </span>
            <button
              type="button"
              onClick={() => onNavigateTab('orders')}
              className="text-gold-light hover:text-gold font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              Calculer la prochaine commande
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* DROITE: RÉSEAU PARTENAIRES & CATALOGUES (5 COLS) */}
        <div className="lg:col-span-5 bg-charcoal/95 bronze-border rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between gap-2 border-b border-bronze/35 pb-3.5">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-gold-light block">
                Réseau &amp; Ravitaillement
              </span>
              <h3 className="font-display text-lg font-extrabold text-white">
                Partenaires du Cartel
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onOpenCatalog()}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-obsidian hover:bg-slateDark text-gold-light border border-gold/40 transition inline-flex items-center gap-1.5 cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Tout voir
            </button>
          </div>

          <div className="space-y-3">
            {partnerCards.map((group) => {
              const visual = PARTNER_VISUALS[group.id];
              return (
                <div
                  key={group.id}
                  className="relative rounded-xl overflow-hidden border border-bronze/45 hover:border-gold/65 transition bg-obsidian group"
                >
                  <div className="flex flex-col sm:flex-row items-stretch">
                    {visual && (
                      <div className="sm:w-36 h-28 sm:h-auto relative shrink-0 overflow-hidden bg-charcoal">
                        <DashboardPhoto
                          src={visual.img}
                          alt={visual.label}
                          fallbackTitle={group.name}
                          className="group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-obsidian/70 hidden sm:block" />
                        <div className="absolute inset-0 bg-gradient-to-t from-obsidian/80 to-transparent sm:hidden" />
                      </div>
                    )}
                    <div className="flex-1 p-3.5 flex flex-col justify-between gap-2.5 min-w-0">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-display text-sm font-extrabold text-white truncate">
                            {group.name}
                          </h4>
                          <span className="text-[10px] font-mono text-zinc-400 shrink-0 tabular-nums">
                            {group.items.length} réf · {group.contacts.length} contact
                            {group.contacts.length > 1 ? 's' : ''}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 line-clamp-2 mt-0.5">
                          {group.specialty}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenCatalog(group.id)}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-gold/15 hover:bg-gold hover:text-obsidian text-gold-light border border-gold/40 transition cursor-pointer"
                        >
                          Catalogue
                        </button>
                        {group.items.some((i) => i.tradeType === 'sell') && (
                          <button
                            type="button"
                            onClick={() => onGoToOrdersWithGroup(group.id)}
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-charcoal hover:bg-slateDark text-zinc-200 border border-bronze/45 transition cursor-pointer"
                          >
                            Commander
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. APERÇU ALBUM PHOTO DU CARTEL */}
      <section className="bg-charcoal/95 bronze-border rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-gold-light block">
              Archives &amp; Mémoires
            </span>
            <h3 className="font-display text-lg font-extrabold text-white">
              Album Photo Los Cerberos
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('album')}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-gold/15 hover:bg-gold hover:text-obsidian text-gold-light border border-gold/45 transition inline-flex items-center gap-2 cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5" />
            Ouvrir l&apos;Album Photo
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {BUILT_IN_ALBUM_PHOTOS.slice(0, 6).map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => onNavigateTab('album')}
              className="group relative aspect-[4/3] rounded-xl overflow-hidden bg-obsidian border border-bronze/45 hover:border-gold transition text-left cursor-pointer"
            >
              <DashboardPhoto
                src={photo.src}
                alt={photo.title}
                fallbackTitle={photo.title}
                className="group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/20 to-transparent" />
              <span className="absolute bottom-2 left-2.5 right-2.5 text-[10px] font-semibold text-white line-clamp-1">
                {photo.title}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
