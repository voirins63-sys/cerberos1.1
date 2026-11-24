import { BUILT_IN_ALBUM_PHOTOS } from '@/src/data/albumData';
import {
  DAY_NAMES,
  INVENTORY_ITEMS,
  REWARD_ITEMS,
  TOTAL_WEEKLY_MISSIONS,
  WEEKLY_SCHEDULE,
} from '@/src/data/cartelData';
import { checkMissionStockAvailability } from '@/src/data/eminenceMissions';
import { fetchAlbumMediaUrl } from '@/src/services/cartelFirestore';
import type {
  AlbumPhotoRecord,
  AlbumState,
  CatalogGroupsMap,
  DiscordGazetteConfig,
  HierarchyMember,
  HistoryState,
  InventoryPrices,
  InventoryStock,
  MemberRankingsMap,
  MissionScheduleMeta,
  MissionStates,
  RewardStocks,
  TreasuryMoney,
  WeaponsStock,
} from '@/src/types/cartel';
import {
  calcRewardsTotalValue,
  calcTotalWealth,
  computeMemberLeaderboard,
  computeSundayPayroll,
  dayDate,
  fmtShort,
  formatMoney,
  formatSigned,
  getMissionEntry,
  getStatus,
  isoDate,
  isWeekStale,
  missionFin,
  weekRangeText,
} from '@/src/utils/finance';
import { simulateMissionSupplyPlan } from '@/src/utils/missionSupply';
import { getCurrentWeekTodayName, getEffectiveSchedule } from '@/src/utils/schedule';

export type GazetteVisualMood =
  | 'auto'
  | 'noir-gold'
  | 'crimson-alert'
  | 'emerald-vault'
  | 'midnight-blue';

export interface GazetteVisualScene {
  id: string;
  title: string;
  caption: string;
  location: string;
  authorName: string;
  src: string;
  isAiScene: boolean;
}

export const GAZETTE_VISUAL_MOODS: Array<{
  id: GazetteVisualMood;
  label: string;
  accent: string;
  tint: string;
}> = [
  { id: 'auto', label: 'Rotation auto du jour', accent: '#c5a15a', tint: 'rgba(197, 161, 90, 0.10)' },
  { id: 'noir-gold', label: 'Noir & Or Cartel', accent: '#c5a15a', tint: 'rgba(197, 161, 90, 0.14)' },
  { id: 'crimson-alert', label: 'Alerte Pourpre', accent: '#c83e43', tint: 'rgba(142, 32, 36, 0.24)' },
  { id: 'emerald-vault', label: 'Coffre Émeraude', accent: '#34d399', tint: 'rgba(16, 185, 129, 0.16)' },
  { id: 'midnight-blue', label: 'Nocturne Los Santos', accent: '#60a5fa', tint: 'rgba(37, 99, 235, 0.16)' },
];

export const DAILY_AI_SCENES: GazetteVisualScene[] = [
  {
    id: 'ai_convoy_heist',
    title: 'Embuscade Convoi Blindé',
    caption: 'Interception nocturne sur l’autoroute de Los Santos — escouade en formation serrée.',
    location: 'Autoroute Nord · Nuit',
    authorName: 'Studio Visuel IA',
    src: '/src/assets/images/gazette_convoy_heist_1795493988458.jpg',
    isAiScene: true,
  },
  {
    id: 'ai_harbor_smuggling',
    title: 'Opération Port & Conteneurs',
    caption: 'Livraison discrète sur les docks sous la brume portuaire avant l’aube.',
    location: 'Terminal Maritime',
    authorName: 'Studio Visuel IA',
    src: '/src/assets/images/gazette_harbor_smuggling_1795493988846.jpg',
    isAiScene: true,
  },
  {
    id: 'ai_hacienda_warroom',
    title: 'Conseil Stratégique — Hacienda',
    caption: 'Revue des plans tactiques et préparation des opérations majeures de la journée.',
    location: 'Salle de Commandement',
    authorName: 'Studio Visuel IA',
    src: '/src/assets/images/gazette_hacienda_warroom_1795493989179.jpg',
    isAiScene: true,
  },
  {
    id: 'ai_rooftop_recon',
    title: 'Reconnaissance Aérienne Nocturne',
    caption: 'Surveillance des axes clés et extraction rapide depuis l’héliport du cartel.',
    location: 'Héliport Centre-Ville',
    authorName: 'Studio Visuel IA',
    src: '/src/assets/images/gazette_rooftop_recon_1795493989686.jpg',
    isAiScene: true,
  },
  {
    id: 'ai_vault_payout',
    title: 'Coffre-Fort & Réserves d’Or',
    caption: 'Contrôle des liquidités, lingots et butins sécurisés dans la chambre forte.',
    location: 'Chambre Forte Los Cerberos',
    authorName: 'Studio Visuel IA',
    src: '/src/assets/images/gazette_vault_payout_1795493988622.jpg',
    isAiScene: true,
  },
  {
    id: 'ai_hq_hero',
    title: 'Quartier Général — Los Cerberos',
    caption: 'Veille permanente au QG et coordination des escouades sur l’ensemble du territoire.',
    location: 'Hacienda Los Cerberos',
    authorName: 'Studio Visuel IA',
    src: '/src/assets/images/dashboard_hq_hero_1795298255836.jpg',
    isAiScene: true,
  },
  {
    id: 'ai_heist_ops',
    title: 'Cellule d’Intervention — Gros Coups',
    caption: 'Préparation des équipements lourds pour les braquages prioritaires du planning.',
    location: 'Zone Tactique',
    authorName: 'Studio Visuel IA',
    src: '/src/assets/images/dashboard_heist_ops_1795298255634.jpg',
    isAiScene: true,
  },
  {
    id: 'ai_armory_arsenal',
    title: 'Armurerie Tactique du Cartel',
    caption: 'Vérification de l’arsenal, des gilets balistiques et des munitions avant départ.',
    location: 'Armurerie QG',
    authorName: 'Studio Visuel IA',
    src: '/src/assets/images/dashboard_armory_arsenal_1795298255791.jpg',
    isAiScene: true,
  },
  {
    id: 'ai_vault_coffre',
    title: 'Comptabilité & Trésorerie',
    caption: 'Suivi strict des entrées, des dépenses opérationnelles et de la réserve du cartel.',
    location: 'Coffre Cartel',
    authorName: 'Studio Visuel IA',
    src: '/src/assets/images/dashboard_vault_coffre_1795298255079.jpg',
    isAiScene: true,
  },
];

export interface DailyGazetteMissionLine {
  id: string;
  name: string;
  major: boolean;
  status: '' | 'success' | 'fail';
  gearAvailable: boolean;
  missingLabel: string;
  rescheduled: boolean;
}

export interface DailyGazetteData {
  todayIso: string;
  todayDateLabel: string;
  todayName: string;
  weekRangeLabel: string;
  isSunday: boolean;
  visualMood: Exclude<GazetteVisualMood, 'auto'>;
  yesterday: {
    dayName: string;
    dateLabel: string;
    hasData: boolean;
    note: string;
    ok: number;
    ko: number;
    total: number;
    gains: number;
    costs: number;
    extra: number;
    weaponLosses: number;
    totalLosses: number;
    net: number;
    highlights: Array<{
      name: string;
      status: 'success' | 'fail';
      gain: number;
      loss: number;
      net: number;
    }>;
  };
  weekly: {
    successCount: number;
    failCount: number;
    totalMissions: number;
    grossGains: number;
    totalCosts: number;
    weaponsLossAmount: number;
    totalLosses: number;
    netProfit: number;
    totalWealth: number;
    legalCash: number;
    illegalCash: number;
    cashTotal: number;
    rewardsValTotal: number;
    rewardsItemCount: number;
  };
  topOperators: Array<{
    rank: number;
    name: string;
    levelTitle: string;
    points: number;
    missionsOk: number;
  }>;
  todayProgram: {
    total: number;
    majorCount: number;
    ok: number;
    ko: number;
    pending: number;
    missions: DailyGazetteMissionLine[];
  };
  stockSummary: {
    readyMissionsCount: number;
    totalMissionsCount: number;
    minDaysCovered: number;
    allOver30Days: boolean;
    limitingTitles: string[];
  };
  dailyBriefing: string;
  photo: {
    id: string;
    title: string;
    caption: string;
    location: string;
    authorName: string;
    src: string;
    isAiScene?: boolean;
  };
  customMessage: string;
}

export function getAllGazettePhotoChoices(albumState: AlbumState): AlbumPhotoRecord[] {
  const aiRecords: AlbumPhotoRecord[] = DAILY_AI_SCENES.map((scene) => ({
    id: scene.id,
    title: `✦ ${scene.title}`,
    category: 'hq',
    caption: scene.caption,
    location: scene.location,
    dateLabel: 'Visuel IA',
    authorName: scene.authorName,
    createdAtIso: '2026-11-23T00:00:00.000Z',
    externalUrl: scene.src,
  }));

  const custom = Object.values(albumState.photos || {}).sort((a, b) =>
    (b.createdAtIso || '').localeCompare(a.createdAtIso || '')
  );
  const builtInScenes = BUILT_IN_ALBUM_PHOTOS.filter(
    (p) => p.id !== 'builtin_embleme_cerberos'
  );
  return [...aiRecords, ...custom, ...builtInScenes].filter(Boolean);
}

function hashDailySeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

function resolveDailyVisualMood(
  requestedMood: GazetteVisualMood | undefined,
  todayIso: string,
  hasAlert: boolean
): Exclude<GazetteVisualMood, 'auto'> {
  if (requestedMood && requestedMood !== 'auto') {
    return requestedMood;
  }
  if (hasAlert) {
    return 'crimson-alert';
  }
  const palette: Array<Exclude<GazetteVisualMood, 'auto'>> = [
    'noir-gold',
    'midnight-blue',
    'emerald-vault',
    'noir-gold',
    'crimson-alert',
  ];
  return palette[hashDailySeed(`${todayIso}-mood`) % palette.length];
}

function pickDailyPhotoRecord(
  albumState: AlbumState,
  todayIso: string,
  preferredPhotoId?: string
): AlbumPhotoRecord {
  const choices = getAllGazettePhotoChoices(albumState);
  if (preferredPhotoId) {
    const exact = choices.find((p) => p.id === preferredPhotoId);
    if (exact) return exact;
  }

  // Rotate cleanly across the AI scenes + custom member photos every single day
  const dailyPool = choices.filter((p) => p.id !== 'builtin_embleme_cerberos');
  const pool = dailyPool.length > 0 ? dailyPool : choices;

  // Use calendar day number so consecutive days NEVER pick the same visual
  const parsed = Date.parse(`${todayIso}T12:00:00Z`);
  const dayNumber = Number.isFinite(parsed)
    ? Math.floor(parsed / 86_400_000)
    : hashDailySeed(todayIso);
  const idx = ((dayNumber % pool.length) + pool.length) % pool.length;
  return pool[idx] || choices[0] || BUILT_IN_ALBUM_PHOTOS[0];
}

export async function resolvePhotoSrcForCanvas(photo: AlbumPhotoRecord): Promise<string> {
  const aiScene = DAILY_AI_SCENES.find((s) => s.id === photo.id);
  if (aiScene) return aiScene.src;

  const builtIn = BUILT_IN_ALBUM_PHOTOS.find((b) => b.id === photo.id);
  if (builtIn) return builtIn.src;

  if (photo.mediaId) {
    try {
      const url = await fetchAlbumMediaUrl(photo.mediaId);
      if (url) return url;
    } catch {
      // Fallback below
    }
  }

  if (photo.externalUrl) {
    return photo.externalUrl;
  }

  return DAILY_AI_SCENES[0].src;
}

function buildAutoDailyBriefing(params: {
  todayName: string;
  isSunday: boolean;
  yesterday: DailyGazetteData['yesterday'];
  todayMissions: DailyGazetteMissionLine[];
  rewardsItemCount: number;
  rewardsValTotal: number;
  minDaysCovered: number;
  allOver30Days: boolean;
}): string {
  const {
    todayName,
    isSunday,
    yesterday,
    todayMissions,
    rewardsItemCount,
    rewardsValTotal,
    minDaysCovered,
    allOver30Days,
  } = params;

  const parts: string[] = [];
  const pendingMissions = todayMissions.filter((m) => !m.status);
  const majorPending = pendingMissions.filter((m) => m.major);
  const missingMissions = pendingMissions.filter((m) => !m.gearAvailable);

  if (yesterday.hasData && yesterday.ko > 0) {
    parts.push(
      `Hier : ${yesterday.ko} échec${yesterday.ko > 1 ? 's' : ''} (${formatMoney(yesterday.totalLosses)} de pertes/coûts) — rigueur maximale demandée aujourd’hui.`
    );
  } else if (yesterday.hasData && yesterday.ok > 0 && yesterday.net > 0) {
    parts.push(
      `Belle dynamique hier (${yesterday.ok} validée${yesterday.ok > 1 ? 's' : ''}, ${formatSigned(yesterday.net)}) — on maintient la cadence.`
    );
  }

  if (pendingMissions.length === 0) {
    parts.push(`Objectifs de ${todayName} déjà bouclés — profitez-en pour sécuriser les stocks.`);
  } else if (majorPending.length > 0) {
    parts.push(
      `Cap sur ${pendingMissions.length} mission(s) aujourd’hui dont ${majorPending.length} gros coup(s) (${majorPending
        .map((m) => m.name)
        .slice(0, 2)
        .join(', ')}).`
    );
  } else {
    parts.push(`${pendingMissions.length} mission(s) au programme de ${todayName}.`);
  }

  if (missingMissions.length > 0) {
    const missingNames = missingMissions
      .map((m) => m.missingLabel || m.name)
      .filter(Boolean)
      .slice(0, 2)
      .join(', ');
    parts.push(`Priorité coffre : réapprovisionner avant départ (${missingNames}).`);
  } else if (!allOver30Days && minDaysCovered <= 2) {
    parts.push(`Attention autonomie stock (${minDaysCovered} j) : anticipez les commandes.`);
  }

  if (isSunday && rewardsItemCount > 0) {
    parts.push(
      `Dimanche : pensez à la revente du recel (${rewardsItemCount} obj. · ${formatMoney(rewardsValTotal)}) et au règlement des paies.`
    );
  }

  return parts.join(' ');
}

export async function buildDailyGazetteData(params: {
  missionStates: MissionStates;
  scheduleMeta: MissionScheduleMeta;
  inventoryStock: InventoryStock;
  inventoryPrices: InventoryPrices;
  weaponsStock: WeaponsStock;
  rewardStocks: RewardStocks;
  treasuryMoney: TreasuryMoney;
  weaponsLossAmount: number;
  hierMembers: HierarchyMember[];
  memberRankings: MemberRankingsMap;
  catalogGroups: CatalogGroupsMap;
  albumState: AlbumState;
  customMessage?: string;
  selectedPhotoId?: string;
  customUploadedPhotoSrc?: string;
  visualMood?: GazetteVisualMood;
  now?: Date;
}): Promise<DailyGazetteData> {
  const {
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
    customMessage = '',
    selectedPhotoId,
    customUploadedPhotoSrc,
    visualMood = 'auto',
    now = new Date(),
  } = params;

  const todayIso = isoDate(now);
  const todayDateLabel = now.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const weekdayIdx = (now.getDay() + 6) % 7;
  const detectedToday = getCurrentWeekTodayName(missionStates, now);
  const todayName = detectedToday || DAY_NAMES[weekdayIdx] || 'Lundi';
  const isSunday = now.getDay() === 0;
  const staleWeek = isWeekStale(missionStates);

  const effectiveSchedule = getEffectiveSchedule(missionStates, scheduleMeta);
  const supplyPlan = simulateMissionSupplyPlan({
    inventoryStock,
    inventoryPrices,
    catalogGroups,
    missionStates,
    scheduleMeta,
  });

  // Yesterday analysis
  let yesterdayDayName = 'Dimanche';
  let yesterdayDateLabel = '';
  let yesterdayHasData = true;
  let yesterdayNote = '';

  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(now.getDate() - 1);
  yesterdayDateLabel = fmtShort(yesterdayDate);

  if (weekdayIdx === 0 && !staleWeek) {
    yesterdayDayName = 'Dimanche';
    yesterdayHasData = false;
    yesterdayNote = 'Nouvelle semaine initialisée aujourd’hui — bilan précédent archivé.';
  } else if (weekdayIdx === 0 && staleWeek) {
    yesterdayDayName = 'Dimanche';
  } else {
    yesterdayDayName = DAY_NAMES[Math.max(0, weekdayIdx - 1)];
  }

  let yOk = 0;
  let yKo = 0;
  let yTotal = 0;
  let yGains = 0;
  let yCosts = 0;
  let yExtra = 0;
  let yWeaponLosses = 0;
  const yHighlights: Array<{
    name: string;
    status: 'success' | 'fail';
    gain: number;
    loss: number;
    net: number;
  }> = [];

  if (yesterdayHasData) {
    const yDayObj = effectiveSchedule.days.find((d) => d.day === yesterdayDayName);
    if (yDayObj) {
      yTotal = yDayObj.missions.length;
      if (staleWeek) {
        yesterdayDateLabel = fmtShort(dayDate(yesterdayDayName, missionStates));
      }
      yDayObj.missions.forEach((m) => {
        const entry = getMissionEntry(missionStates, m.id);
        const fin = missionFin(m, missionStates, inventoryPrices, catalogGroups);
        const missionWeaponLoss = Array.isArray(entry.lostWeapons)
          ? entry.lostWeapons.reduce((s, lw) => s + Math.max(0, Number(lw.value) || 0), 0)
          : 0;
        const missionLossTotal = fin.cost + fin.extra + missionWeaponLoss;

        if (fin.success) {
          yOk++;
          yHighlights.push({
            name: m.name,
            status: 'success',
            gain: fin.gain,
            loss: missionLossTotal,
            net: fin.gain - missionLossTotal,
          });
        } else if (fin.fail) {
          yKo++;
          yHighlights.push({
            name: m.name,
            status: 'fail',
            gain: fin.gain,
            loss: missionLossTotal,
            net: fin.gain - missionLossTotal,
          });
        }
        yGains += fin.gain;
        yCosts += fin.cost;
        yExtra += fin.extra;
        yWeaponLosses += missionWeaponLoss;
      });
    }
  }

  const yTotalLosses = yCosts + yExtra + yWeaponLosses;
  const yNet = yGains - yTotalLosses;

  // Weekly KPIs
  let wCost = 0;
  let wExtra = 0;
  let wGains = 0;
  let wSuccess = 0;
  let wFail = 0;

  WEEKLY_SCHEDULE.forEach((day) => {
    day.missions.forEach((mission) => {
      const f = missionFin(mission, missionStates, inventoryPrices, catalogGroups);
      if (f.success) wSuccess++;
      if (f.fail) wFail++;
      wCost += f.cost;
      wExtra += f.extra;
      wGains += f.gain;
    });
  });

  const weeklyTotalLosses = wCost + wExtra + weaponsLossAmount;
  const weeklyNet = wGains - weeklyTotalLosses;
  const rewardsValTotal = calcRewardsTotalValue(rewardStocks);
  const rewardsItemCount = REWARD_ITEMS.reduce(
    (sum, item) => sum + Math.max(0, Number(rewardStocks[item.key]?.qty) || 0),
    0
  );
  const legalCash = Math.max(0, Number(treasuryMoney.legal) || 0);
  const illegalCash = Math.max(0, Number(treasuryMoney.illegal) || 0);
  const cashTotal = legalCash + illegalCash;
  const totalWealth = calcTotalWealth({
    treasuryMoney,
    rewardStocks,
    inventoryStock,
    inventoryPrices,
    weaponsStock,
    catalogGroups,
  });

  // Top 5 Operators
  const leaderboard = computeMemberLeaderboard({
    members: hierMembers,
    missionStates,
    weaponsStock,
    memberRankings,
    inventoryPrices,
    catalogGroups,
  });

  const topOperators = leaderboard.slice(0, 5).map((entry) => ({
    rank: entry.rank,
    name: entry.member.name,
    levelTitle: entry.levelTitle,
    points: entry.totalPoints,
    missionsOk: entry.missionsOk,
  }));

  // Today's program
  const todayBucket =
    effectiveSchedule.days.find((d) => d.day === todayName) || effectiveSchedule.days[0];
  let tOk = 0;
  let tKo = 0;
  let tPending = 0;
  const todayMissions: DailyGazetteMissionLine[] = (todayBucket?.missions || []).map((m) => {
    const st = getStatus(getMissionEntry(missionStates, m.id));
    if (st === 'success') tOk++;
    else if (st === 'fail') tKo++;
    else tPending++;

    const alloc = supplyPlan.allocationsByMissionId[m.id];
    const fallbackAvail = alloc
      ? alloc.available
      : checkMissionStockAvailability(m.gearKey, inventoryStock, catalogGroups).available;
    const missingLabel =
      !fallbackAvail && alloc && alloc.missingItems.length > 0
        ? alloc.missingItems
            .map((mi) => (mi.missingQty > 1 ? `${mi.missingQty}× ${mi.name}` : mi.name))
            .join(', ')
        : m.gearKey !== 'none' && !fallbackAvail
          ? INVENTORY_ITEMS.find((it) => it.key === m.gearKey)?.name || 'Matériel manquant'
          : '';

    return {
      id: m.id,
      name: m.name,
      major: m.major,
      status: st,
      gearAvailable: fallbackAvail,
      missingLabel,
      rescheduled: m.isRescheduled,
    };
  });

  const majorCount = todayMissions.filter((m) => m.major).length;

  const yesterdayBlock: DailyGazetteData['yesterday'] = {
    dayName: yesterdayDayName,
    dateLabel: yesterdayDateLabel,
    hasData: yesterdayHasData,
    note: yesterdayNote,
    ok: yOk,
    ko: yKo,
    total: yTotal,
    gains: yGains,
    costs: yCosts,
    extra: yExtra,
    weaponLosses: yWeaponLosses,
    totalLosses: yTotalLosses,
    net: yNet,
    highlights: yHighlights,
  };

  const dailyBriefing =
    customMessage.trim().slice(0, 300) ||
    buildAutoDailyBriefing({
      todayName,
      isSunday,
      yesterday: yesterdayBlock,
      todayMissions,
      rewardsItemCount,
      rewardsValTotal,
      minDaysCovered: supplyPlan.minDaysCovered,
      allOver30Days: supplyPlan.allOver30Days,
    });

  // Photo / Daily AI Visual
  const chosenPhoto = pickDailyPhotoRecord(albumState, todayIso, selectedPhotoId);
  const isAiScene = DAILY_AI_SCENES.some((s) => s.id === chosenPhoto.id);
  const resolvedSrc = customUploadedPhotoSrc
    ? customUploadedPhotoSrc
    : await resolvePhotoSrcForCanvas(chosenPhoto);

  const hasAlert =
    (yesterdayHasData && yKo > 0 && yNet < 0) ||
    (!supplyPlan.allOver30Days && supplyPlan.minDaysCovered <= 1);
  const resolvedMood = resolveDailyVisualMood(visualMood, todayIso, hasAlert);

  return {
    todayIso,
    todayDateLabel,
    todayName,
    weekRangeLabel: weekRangeText(missionStates),
    isSunday,
    visualMood: resolvedMood,
    yesterday: yesterdayBlock,
    weekly: {
      successCount: wSuccess,
      failCount: wFail,
      totalMissions: TOTAL_WEEKLY_MISSIONS,
      grossGains: wGains,
      totalCosts: wCost + wExtra,
      weaponsLossAmount,
      totalLosses: weeklyTotalLosses,
      netProfit: weeklyNet,
      totalWealth,
      legalCash,
      illegalCash,
      cashTotal,
      rewardsValTotal,
      rewardsItemCount,
    },
    topOperators,
    todayProgram: {
      total: todayMissions.length,
      majorCount,
      ok: tOk,
      ko: tKo,
      pending: tPending,
      missions: todayMissions,
    },
    stockSummary: {
      readyMissionsCount: supplyPlan.readyMissionsCount,
      totalMissionsCount: supplyPlan.totalMissionsCount,
      minDaysCovered: supplyPlan.minDaysCovered,
      allOver30Days: supplyPlan.allOver30Days,
      limitingTitles: supplyPlan.limitingMissions.slice(0, 3).map((l) => l.title),
    },
    dailyBriefing,
    photo: {
      id: customUploadedPhotoSrc ? 'custom_upload' : chosenPhoto.id,
      title: customUploadedPhotoSrc
        ? `Édition Spéciale — ${todayName}`
        : chosenPhoto.title.replace(/^✦\s*/, ''),
      caption: customUploadedPhotoSrc
        ? 'Visuel personnalisé importé pour le briefing quotidien Los Cerberos.'
        : chosenPhoto.caption,
      location: customUploadedPhotoSrc ? 'Los Santos' : chosenPhoto.location,
      authorName: customUploadedPhotoSrc ? 'Commandement' : chosenPhoto.authorName,
      src: resolvedSrc,
      isAiScene: customUploadedPhotoSrc ? false : isAiScene,
    },
    customMessage: customMessage.trim().slice(0, 300),
  };
}

function loadImageForCanvas(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    if (/^https?:\/\//i.test(src)) {
      img.crossOrigin = 'anonymous';
    }
    const timeout = window.setTimeout(() => resolve(null), 6500);
    img.onload = () => {
      window.clearTimeout(timeout);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(timeout);
      resolve(null);
    };
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  const imgRatio = img.width / Math.max(1, img.height);
  const boxRatio = w / Math.max(1, h);
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;

  if (imgRatio > boxRatio) {
    sw = img.height * boxRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / boxRatio;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 3 && ctx.measureText(`${out}…`).width > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) {
        lines.push(current);
        if (lines.length >= maxLines) {
          lines[maxLines - 1] = fitText(ctx, `${lines[maxLines - 1]} ${word}`, maxWidth);
          return lines;
        }
      }
      current = word;
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(fitText(ctx, current, maxWidth));
  }
  return lines;
}

export async function renderGazetteCanvasDataUrl(
  data: DailyGazetteData,
  options?: { includePhoto?: boolean }
): Promise<string> {
  const includePhoto = options?.includePhoto ?? true;
  const width = 1200;
  const height = 760;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Impossible d’initialiser le générateur d’image.');
  }

  const moodMeta =
    GAZETTE_VISUAL_MOODS.find((m) => m.id === data.visualMood) || GAZETTE_VISUAL_MOODS[1];

  // Preload assets (with local fallback if external URL fails CORS)
  const [emblemImg, rawPhotoImg] = await Promise.all([
    loadImageForCanvas('/assets/aistudio/image_bba68987.png').then(
      (img) => img || loadImageForCanvas('/assets/emblem.webp')
    ),
    includePhoto ? loadImageForCanvas(data.photo.src) : Promise.resolve(null),
  ]);

  const photoImg =
    includePhoto && !rawPhotoImg
      ? await loadImageForCanvas(DAILY_AI_SCENES[0].src).then(
          (img) => img || loadImageForCanvas(BUILT_IN_ALBUM_PHOTOS[0].src)
        )
      : rawPhotoImg;

  // 1. Deep Obsidian & Dynamic Mood Ambient Backdrop
  ctx.fillStyle = '#080808';
  ctx.fillRect(0, 0, width, height);

  const radialPrimary = ctx.createRadialGradient(180, 120, 40, 200, 150, 640);
  radialPrimary.addColorStop(
    0,
    data.visualMood === 'emerald-vault'
      ? 'rgba(16, 185, 129, 0.22)'
      : data.visualMood === 'midnight-blue'
        ? 'rgba(37, 99, 235, 0.22)'
        : 'rgba(142, 32, 36, 0.26)'
  );
  radialPrimary.addColorStop(1, 'rgba(8, 8, 8, 0)');
  ctx.fillStyle = radialPrimary;
  ctx.fillRect(0, 0, width, height);

  const radialGold = ctx.createRadialGradient(1020, 620, 40, 1000, 620, 560);
  radialGold.addColorStop(0, moodMeta.tint);
  radialGold.addColorStop(1, 'rgba(8, 8, 8, 0)');
  ctx.fillStyle = radialGold;
  ctx.fillRect(0, 0, width, height);

  // Outer Luxury Frame
  drawRoundedRect(ctx, 16, 16, width - 32, height - 32, 18);
  ctx.strokeStyle = 'rgba(197, 161, 90, 0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();

  drawRoundedRect(ctx, 22, 22, width - 44, height - 44, 14);
  ctx.strokeStyle = moodMeta.accent;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // 2. HEADER BAND
  if (emblemImg) {
    ctx.save();
    drawRoundedRect(ctx, 38, 36, 76, 76, 14);
    ctx.clip();
    drawCoverImage(ctx, emblemImg, 38, 36, 76, 76);
    ctx.restore();
    drawRoundedRect(ctx, 38, 36, 76, 76, 14);
    ctx.strokeStyle = '#c5a15a';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.fillStyle = moodMeta.accent;
  ctx.font = '700 11px "JetBrains Mono", monospace';
  ctx.fillText('EDITION QUOTIDIENNE · RAPPORT VEILLE & BRIEFING', 130, 52);

  ctx.fillStyle = '#f5e6c4';
  ctx.font = '800 30px "Playfair Display", Georgia, serif';
  ctx.fillText('LA GAZETTE LOS CERBEROS', 130, 84);

  ctx.fillStyle = '#a1a1aa';
  ctx.font = '600 13px "Montserrat", sans-serif';
  const dateCap =
    data.todayDateLabel.charAt(0).toUpperCase() + data.todayDateLabel.slice(1);
  ctx.fillText(`${dateCap}  ·  Semaine ${data.weekRangeLabel}`, 130, 107);

  // Header Right KPI Pill
  drawRoundedRect(ctx, 886, 38, 276, 72, 12);
  ctx.fillStyle = '#141210';
  ctx.fill();
  ctx.strokeStyle = 'rgba(197, 161, 90, 0.45)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#c5a15a';
  ctx.font = '700 10px "JetBrains Mono", monospace';
  ctx.fillText('PATRIMOINE GLOBAL CARTEL', 904, 58);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 22px "Montserrat", sans-serif';
  ctx.fillText(formatMoney(data.weekly.totalWealth), 904, 84);

  ctx.fillStyle = '#a1a1aa';
  ctx.font = '600 10px "JetBrains Mono", monospace';
  ctx.fillText(
    fitText(
      ctx,
      `Propre ${formatMoney(data.weekly.legalCash)} · Sale ${formatMoney(data.weekly.illegalCash)}`,
      244
    ),
    904,
    102
  );

  // Divider line
  ctx.beginPath();
  ctx.moveTo(38, 124);
  ctx.lineTo(width - 38, 124);
  ctx.strokeStyle = 'rgba(197, 161, 90, 0.28)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 3. LEFT COLUMN: YESTERDAY + TREASURY/TOP3 + TODAY PROGRAM
  const colX = 38;
  const colW = 696;

  // --- CARD A: BILAN DE LA VEILLE (y: 138..290) ---
  drawRoundedRect(ctx, colX, 138, colW, 152, 14);
  ctx.fillStyle = 'rgba(20, 18, 16, 0.94)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(107, 81, 64, 0.65)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#e3c98f';
  ctx.font = '700 12px "JetBrains Mono", monospace';
  ctx.fillText(
    `01 · BILAN DE LA VEILLE — ${data.yesterday.dayName.toUpperCase()} (${data.yesterday.dateLabel})`,
    colX + 18,
    162
  );

  if (!data.yesterday.hasData) {
    ctx.fillStyle = '#d4d4d8';
    ctx.font = '500 14px "Montserrat", sans-serif';
    ctx.fillText(data.yesterday.note, colX + 18, 212);
    ctx.fillStyle = '#a1a1aa';
    ctx.font = '500 12px "Montserrat", sans-serif';
    ctx.fillText(
      'Nouveau cycle hebdomadaire ouvert — préparez les objectifs du jour.',
      colX + 18,
      238
    );
  } else {
    const statW = 158;
    const statGap = 10;
    const statsY = 176;
    const stats = [
      {
        label: 'RÉUSSIES / ÉCHECS',
        val: `${data.yesterday.ok} OK · ${data.yesterday.ko} KO`,
        sub: `sur ${data.yesterday.total} prévues`,
        color: data.yesterday.ko > 0 ? '#fbbf24' : '#ffffff',
      },
      {
        label: 'GAINS BRUTS',
        val: `+${formatMoney(data.yesterday.gains)}`,
        sub: 'Butin & cash',
        color: '#34d399',
      },
      {
        label: 'PERTES & COÛTS',
        val: `-${formatMoney(data.yesterday.totalLosses)}`,
        sub:
          data.yesterday.weaponLosses > 0
            ? `Dont armes ${formatMoney(data.yesterday.weaponLosses)}`
            : `Mat. ${formatMoney(data.yesterday.costs)}`,
        color: '#f87171',
      },
      {
        label: 'NET VEILLE',
        val: formatSigned(data.yesterday.net),
        sub: data.yesterday.net >= 0 ? 'Journée positive' : 'Journée en perte',
        color: data.yesterday.net >= 0 ? '#e3c98f' : '#c83e43',
      },
    ];

    stats.forEach((st, idx) => {
      const sx = colX + 18 + idx * (statW + statGap);
      drawRoundedRect(ctx, sx, statsY, statW, 68, 10);
      ctx.fillStyle = '#0c0b0a';
      ctx.fill();
      ctx.strokeStyle = 'rgba(197, 161, 90, 0.25)';
      ctx.stroke();

      ctx.fillStyle = '#a1a1aa';
      ctx.font = '700 9px "JetBrains Mono", monospace';
      ctx.fillText(st.label, sx + 10, statsY + 18);

      ctx.fillStyle = st.color;
      ctx.font = '800 15px "Montserrat", sans-serif';
      ctx.fillText(fitText(ctx, st.val, statW - 20), sx + 10, statsY + 41);

      ctx.fillStyle = '#71717a';
      ctx.font = '500 10px "Montserrat", sans-serif';
      ctx.fillText(fitText(ctx, st.sub, statW - 20), sx + 10, statsY + 58);
    });

    const summaryLine =
      data.yesterday.highlights.length > 0
        ? data.yesterday.highlights
            .slice(0, 4)
            .map(
              (h) =>
                `${h.status === 'success' ? '✓' : '✕'} ${h.name} (${formatSigned(h.net)})`
            )
            .join('  ·  ')
        : 'Aucune opération enregistrée sur la journée précédente.';

    ctx.fillStyle = '#d4d4d8';
    ctx.font = '500 11px "Montserrat", sans-serif';
    ctx.fillText(fitText(ctx, summaryLine, colW - 36), colX + 18, 272);
  }

  // --- ROW B: TRÉSORERIE & SEMAINE (left) + PODIUM CLASSEMENT (right) (y: 304..488) ---
  const halfW = 340;
  const rowBY = 304;
  const rowBH = 184;

  // B1: Trésorerie & Semaine
  drawRoundedRect(ctx, colX, rowBY, halfW, rowBH, 14);
  ctx.fillStyle = 'rgba(20, 18, 16, 0.94)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(107, 81, 64, 0.65)';
  ctx.stroke();

  ctx.fillStyle = '#e3c98f';
  ctx.font = '700 12px "JetBrains Mono", monospace';
  ctx.fillText('02 · TRÉSORERIE & SEMAINE', colX + 16, rowBY + 24);

  const pct =
    data.weekly.totalMissions > 0
      ? Math.min(
          1,
          (data.weekly.successCount + data.weekly.failCount) / data.weekly.totalMissions
        )
      : 0;

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 13px "Montserrat", sans-serif';
  ctx.fillText(
    `${data.weekly.successCount}/${data.weekly.totalMissions} OK · ${data.weekly.failCount} KO`,
    colX + 16,
    rowBY + 50
  );
  ctx.fillStyle = '#a1a1aa';
  ctx.font = '600 11px "JetBrains Mono", monospace';
  ctx.fillText(`${Math.round(pct * 100)}%`, colX + halfW - 46, rowBY + 50);

  // Progress Bar
  drawRoundedRect(ctx, colX + 16, rowBY + 58, halfW - 32, 8, 4);
  ctx.fillStyle = '#080808';
  ctx.fill();
  if (pct > 0) {
    drawRoundedRect(ctx, colX + 16, rowBY + 58, Math.max(12, (halfW - 32) * pct), 8, 4);
    const grad = ctx.createLinearGradient(colX + 16, 0, colX + halfW - 16, 0);
    grad.addColorStop(0, '#8e2024');
    grad.addColorStop(0.55, '#c5a15a');
    grad.addColorStop(1, '#34d399');
    ctx.fillStyle = grad;
    ctx.fill();
  }

  const hebdoLines = [
    {
      label: 'Gains / Pertes Sem.',
      val: `+${formatMoney(data.weekly.grossGains)} / -${formatMoney(data.weekly.totalLosses)}`,
      color: '#e4e4e7',
    },
    {
      label: 'Bénéfice Net Hebdo',
      val: formatSigned(data.weekly.netProfit),
      color: data.weekly.netProfit >= 0 ? '#34d399' : '#c83e43',
    },
    {
      label: 'Coffre (Propre + Sale)',
      val: formatMoney(data.weekly.cashTotal),
      color: '#ffffff',
    },
    {
      label: `Recel en Stock (${data.weekly.rewardsItemCount})`,
      val: formatMoney(data.weekly.rewardsValTotal),
      color: '#e3c98f',
    },
  ];
  hebdoLines.forEach((line, i) => {
    const ly = rowBY + 90 + i * 24;
    ctx.fillStyle = '#a1a1aa';
    ctx.font = '500 11px "Montserrat", sans-serif';
    ctx.fillText(line.label, colX + 16, ly);

    ctx.fillStyle = line.color;
    ctx.font = '700 11px "JetBrains Mono", monospace';
    const clippedVal = fitText(ctx, line.val, 165);
    const wVal = ctx.measureText(clippedVal).width;
    ctx.fillText(clippedVal, colX + halfW - 16 - wVal, ly);
  });

  // B2: Classement Opérateurs (Top 3 on Canvas, Top 5 in Embed)
  const topX = colX + halfW + 16;
  drawRoundedRect(ctx, topX, rowBY, halfW, rowBH, 14);
  ctx.fillStyle = 'rgba(20, 18, 16, 0.94)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(107, 81, 64, 0.65)';
  ctx.stroke();

  ctx.fillStyle = '#e3c98f';
  ctx.font = '700 12px "JetBrains Mono", monospace';
  ctx.fillText('03 · CLASSEMENT OPÉRATEURS', topX + 16, rowBY + 24);

  if (data.topOperators.length === 0) {
    ctx.fillStyle = '#a1a1aa';
    ctx.font = '500 12px "Montserrat", sans-serif';
    ctx.fillText('Aucun classement disponible.', topX + 16, rowBY + 72);
  } else {
    const medalColors = ['#c5a15a', '#e4e4e7', '#d97706'];
    data.topOperators.slice(0, 3).forEach((op, idx) => {
      const oy = rowBY + 40 + idx * 44;
      drawRoundedRect(ctx, topX + 14, oy, halfW - 28, 36, 9);
      ctx.fillStyle = '#0c0b0a';
      ctx.fill();
      ctx.strokeStyle =
        idx === 0 ? 'rgba(197, 161, 90, 0.45)' : 'rgba(63, 63, 70, 0.55)';
      ctx.stroke();

      ctx.fillStyle = medalColors[idx] || '#a1a1aa';
      ctx.font = '800 13px "JetBrains Mono", monospace';
      ctx.fillText(`#${op.rank}`, topX + 24, oy + 23);

      ctx.fillStyle = '#ffffff';
      ctx.font = '700 13px "Montserrat", sans-serif';
      ctx.fillText(fitText(ctx, op.name, 145), topX + 54, oy + 23);

      ctx.fillStyle = '#e3c98f';
      ctx.font = '700 11px "JetBrains Mono", monospace';
      const rightTxt = `${op.points} pts · ${op.missionsOk}m`;
      const rw = ctx.measureText(rightTxt).width;
      ctx.fillText(rightTxt, topX + halfW - 24 - rw, oy + 22);
    });
  }

  // --- ROW C: PROGRAMME DU JOUR & STOCK (y: 500..696) ---
  const progY = 500;
  const progH = 196;
  drawRoundedRect(ctx, colX, progY, colW, progH, 14);
  ctx.fillStyle = 'rgba(20, 18, 16, 0.94)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(197, 161, 90, 0.35)';
  ctx.stroke();

  ctx.fillStyle = '#e3c98f';
  ctx.font = '700 12px "JetBrains Mono", monospace';
  ctx.fillText(
    `04 · PROGRAMME DU JOUR — ${data.todayName.toUpperCase()} (${data.todayProgram.ok} OK · ${data.todayProgram.pending} À FAIRE)`,
    colX + 18,
    progY + 25
  );

  const autoTxt = data.stockSummary.allOver30Days
    ? 'Stock > 30 j'
    : `Autonomie ${data.stockSummary.minDaysCovered} j`;
  ctx.fillStyle =
    data.stockSummary.minDaysCovered <= 1 && !data.stockSummary.allOver30Days
      ? '#f87171'
      : '#34d399';
  ctx.font = '700 11px "JetBrains Mono", monospace';
  const autoW = ctx.measureText(autoTxt).width;
  ctx.fillText(autoTxt, colX + colW - 18 - autoW, progY + 25);

  const displayMissions = data.todayProgram.missions.slice(0, 5);
  if (displayMissions.length === 0) {
    ctx.fillStyle = '#a1a1aa';
    ctx.font = '500 13px "Montserrat", sans-serif';
    ctx.fillText('Aucune mission planifiée pour aujourd’hui.', colX + 18, progY + 72);
  } else {
    displayMissions.forEach((m, idx) => {
      const my = progY + 42 + idx * 28;
      const statusBadge =
        m.status === 'success' ? '✓' : m.status === 'fail' ? '✕' : '●';
      const statusColor =
        m.status === 'success'
          ? '#34d399'
          : m.status === 'fail'
            ? '#f87171'
            : '#c5a15a';

      ctx.fillStyle = statusColor;
      ctx.font = '700 12px "Montserrat", sans-serif';
      ctx.fillText(statusBadge, colX + 18, my + 14);

      ctx.fillStyle = m.major ? '#e3c98f' : '#f4f4f5';
      ctx.font = m.major
        ? '700 12px "Montserrat", sans-serif'
        : '600 12px "Montserrat", sans-serif';
      const prefix = m.major ? '[GROS COUP] ' : m.rescheduled ? '[REPORT] ' : '';
      ctx.fillText(fitText(ctx, `${prefix}${m.name}`, 335), colX + 36, my + 14);

      let rightLabel = 'À faire · Matériel OK';
      let rightColor = '#34d399';
      if (m.status === 'success') {
        rightLabel = 'Validée';
        rightColor = '#34d399';
      } else if (m.status === 'fail') {
        rightLabel = 'Échec';
        rightColor = '#f87171';
      } else if (!m.gearAvailable) {
        rightLabel = m.missingLabel ? `Manque : ${m.missingLabel}` : 'Stock insuffisant';
        rightColor = '#f87171';
      }

      ctx.fillStyle = rightColor;
      ctx.font = '600 11px "JetBrains Mono", monospace';
      const clippedRight = fitText(ctx, rightLabel, 285);
      const rw = ctx.measureText(clippedRight).width;
      ctx.fillText(clippedRight, colX + colW - 18 - rw, my + 14);
    });
  }

  if (data.isSunday && data.weekly.rewardsItemCount > 0) {
    drawRoundedRect(ctx, colX + 16, progY + progH - 28, colW - 32, 20, 6);
    ctx.fillStyle = 'rgba(197, 161, 90, 0.2)';
    ctx.fill();
    ctx.fillStyle = '#f5e6c4';
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.fillText(
      `DIMANCHE REVENTE & PAIES : ${data.weekly.rewardsItemCount} objets en coffre (${formatMoney(data.weekly.rewardsValTotal)})`,
      colX + 26,
      progY + progH - 14
    );
  } else if (data.todayProgram.missions.length > 5) {
    ctx.fillStyle = '#a1a1aa';
    ctx.font = '500 11px "Montserrat", sans-serif';
    ctx.fillText(
      `+ ${data.todayProgram.missions.length - 5} autre(s) mission(s) dans le planning`,
      colX + 18,
      progY + progH - 12
    );
  }

  // 4. RIGHT COLUMN: VISUEL DU JOUR + BRIEFING DU JOUR (x: 750..1162)
  const rightX = 750;
  const rightW = 412;

  if (includePhoto && photoImg) {
    const photoCardH = 408;
    drawRoundedRect(ctx, rightX, 138, rightW, photoCardH, 14);
    ctx.fillStyle = '#11100f';
    ctx.fill();

    ctx.save();
    drawRoundedRect(ctx, rightX, 138, rightW, photoCardH, 14);
    ctx.clip();
    drawCoverImage(ctx, photoImg, rightX, 138, rightW, photoCardH);

    // Subtle mood color grading glaze
    ctx.fillStyle = moodMeta.tint;
    ctx.fillRect(rightX, 138, rightW, photoCardH);

    // Bottom dark gradient overlay for readability
    const imgGrad = ctx.createLinearGradient(0, 138 + 170, 0, 138 + photoCardH);
    imgGrad.addColorStop(0, 'rgba(8, 8, 8, 0)');
    imgGrad.addColorStop(0.55, 'rgba(8, 8, 8, 0.72)');
    imgGrad.addColorStop(1, 'rgba(8, 8, 8, 0.96)');
    ctx.fillStyle = imgGrad;
    ctx.fillRect(rightX, 138, rightW, photoCardH);
    ctx.restore();

    drawRoundedRect(ctx, rightX, 138, rightW, photoCardH, 14);
    ctx.strokeStyle = 'rgba(197, 161, 90, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Top badge
    const badgeLabel = data.photo.isAiScene
      ? 'VISUEL DU JOUR · STUDIO IA'
      : 'PHOTO DU JOUR · ALBUM';
    drawRoundedRect(ctx, rightX + 14, 152, 186, 24, 6);
    ctx.fillStyle = 'rgba(8, 8, 8, 0.82)';
    ctx.fill();
    ctx.strokeStyle = moodMeta.accent;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#e3c98f';
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.fillText(badgeLabel, rightX + 24, 168);

    // Caption bottom
    ctx.fillStyle = '#c5a15a';
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.fillText(
      fitText(
        ctx,
        `${data.photo.location || 'Los Santos'} · ${data.photo.authorName || 'Los Cerberos'}`,
        rightW - 32
      ),
      rightX + 16,
      138 + photoCardH - 72
    );

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 17px "Playfair Display", Georgia, serif';
    ctx.fillText(fitText(ctx, data.photo.title, rightW - 32), rightX + 16, 138 + photoCardH - 48);

    ctx.fillStyle = '#d4d4d8';
    ctx.font = '500 11px "Montserrat", sans-serif';
    const capLines = wrapLines(ctx, data.photo.caption || '', rightW - 32, 2);
    capLines.forEach((line, i) => {
      ctx.fillText(line, rightX + 16, 138 + photoCardH - 28 + i * 14);
    });
  } else {
    // Emblem Showcase when photo is disabled
    drawRoundedRect(ctx, rightX, 138, rightW, 408, 14);
    ctx.fillStyle = '#11100f';
    ctx.fill();
    ctx.strokeStyle = 'rgba(197, 161, 90, 0.45)';
    ctx.stroke();
    if (emblemImg) {
      ctx.save();
      drawRoundedRect(ctx, rightX + 96, 194, 220, 220, 24);
      ctx.clip();
      drawCoverImage(ctx, emblemImg, rightX + 96, 194, 220, 220);
      ctx.restore();
    }
    ctx.fillStyle = '#e3c98f';
    ctx.font = '700 14px "Playfair Display", Georgia, serif';
    ctx.fillText('SCEAU OFFICIEL · LOS CERBEROS', rightX + 82, 456);
  }

  // Bottom Right Box: BRIEFING DU JOUR
  const noteY = 560;
  const noteH = 136;
  drawRoundedRect(ctx, rightX, noteY, rightW, noteH, 14);
  ctx.fillStyle = 'rgba(20, 18, 16, 0.94)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(142, 32, 36, 0.65)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#c83e43';
  ctx.font = '700 11px "JetBrains Mono", monospace';
  ctx.fillText('05 · BRIEFING DU JOUR', rightX + 16, noteY + 24);

  ctx.fillStyle = '#e4e4e7';
  ctx.font = '500 11.5px "Montserrat", sans-serif';
  const noteLines = wrapLines(ctx, data.dailyBriefing, rightW - 32, 4);
  noteLines.forEach((line, i) => {
    ctx.fillText(line, rightX + 16, noteY + 46 + i * 17);
  });

  if (data.stockSummary.limitingTitles.length > 0 && !data.stockSummary.allOver30Days) {
    ctx.fillStyle = '#fbbf24';
    ctx.font = '600 10px "JetBrains Mono", monospace';
    ctx.fillText(
      fitText(
        ctx,
        `Stock limitant : ${data.stockSummary.limitingTitles.join(', ')}`,
        rightW - 32
      ),
      rightX + 16,
      noteY + noteH - 12
    );
  }

  // 5. FOOTER
  ctx.fillStyle = '#71717a';
  ctx.font = '600 10px "JetBrains Mono", monospace';
  ctx.fillText('TRAICIONADOS POR EL ESTADO, JURAMENTADOS POR LA SANGRE', 38, height - 32);

  const rightFooter = `Généré le ${new Date().toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })} · LOS CERBEROS`;
  const rfw = ctx.measureText(rightFooter).width;
  ctx.fillText(rightFooter, width - 38 - rfw, height - 32);

  return canvas.toDataURL('image/png');
}

export function buildDiscordEmbedPayload(data: DailyGazetteData): {
  content: string;
  embed: {
    title: string;
    description: string;
    color: number;
    fields: Array<{ name: string; value: string; inline: boolean }>;
    footer: { text: string };
  };
} {
  // 1. Detailed Yesterday Report (success, failures, gains, losses, net)
  let yesterdayFieldVal = data.yesterday.note || 'Aucune donnée sur la veille.';
  if (data.yesterday.hasData) {
    const lines: string[] = [
      `✅ **${data.yesterday.ok} réussie(s)** · ❌ **${data.yesterday.ko} échouée(s)** *(sur ${data.yesterday.total} prévues)*`,
      `💰 Gains : **+${formatMoney(data.yesterday.gains)}** | 💸 Pertes & Coûts : **-${formatMoney(data.yesterday.totalLosses)}** | 📊 Net : **${formatSigned(data.yesterday.net)}**`,
    ];
    if (data.yesterday.weaponLosses > 0) {
      lines.push(`🔫 Pertes d’armes veille : **-${formatMoney(data.yesterday.weaponLosses)}**`);
    }
    const succeeded = data.yesterday.highlights.filter((h) => h.status === 'success');
    const failed = data.yesterday.highlights.filter((h) => h.status === 'fail');
    if (succeeded.length > 0) {
      lines.push(
        `• Réussies : ${succeeded
          .slice(0, 4)
          .map((h) => `${h.name} (${formatSigned(h.net)})`)
          .join(', ')}`
      );
    }
    if (failed.length > 0) {
      lines.push(
        `• Échouées : ${failed
          .slice(0, 4)
          .map((h) => `${h.name} (-${formatMoney(h.loss)})`)
          .join(', ')}`
      );
    }
    if (succeeded.length === 0 && failed.length === 0) {
      lines.push('• Aucune opération enregistrée hier.');
    }
    yesterdayFieldVal = lines.join('\n').slice(0, 900);
  }

  // 2. Treasury & Vault
  const treasuryFieldVal = [
    `💵 Propre : **${formatMoney(data.weekly.legalCash)}**`,
    `💸 Sale : **${formatMoney(data.weekly.illegalCash)}**`,
    `💎 Recel stock : **${formatMoney(data.weekly.rewardsValTotal)}** *(${data.weekly.rewardsItemCount} obj.)*`,
    `🏛️ Patrimoine : **${formatMoney(data.weekly.totalWealth)}**`,
  ].join('\n');

  // 3. Weekly Gains & Losses
  const weeklyFieldVal = [
    `🎯 Missions : **${data.weekly.successCount}/${data.weekly.totalMissions}** *(❌ ${data.weekly.failCount} échec${data.weekly.failCount > 1 ? 's' : ''})*`,
    `📈 Gains bruts : **+${formatMoney(data.weekly.grossGains)}**`,
    `📉 Pertes & Coûts : **-${formatMoney(data.weekly.totalLosses)}** *(armes : ${formatMoney(data.weekly.weaponsLossAmount)})*`,
    `⚖️ Bénéfice net : **${formatSigned(data.weekly.netProfit)}**`,
  ].join('\n');

  // 4. Top 5 Ranking
  const medals = ['🥇', '🥈', '🥉', '#4', '#5'];
  const rankingFieldVal =
    data.topOperators.length > 0
      ? data.topOperators
          .slice(0, 5)
          .map(
            (op, i) =>
              `${medals[i] || `#${op.rank}`} **${op.name}** — **${op.points} pts** · ${op.missionsOk} mission${op.missionsOk > 1 ? 's' : ''}`
          )
          .join('\n')
      : 'Aucun point enregistré cette semaine.';

  // 5. Daily Briefing & Today's Missions
  const todayListLines = data.todayProgram.missions.slice(0, 6).map((m) => {
    const icon = m.status === 'success' ? '✅' : m.status === 'fail' ? '❌' : m.major ? '⭐' : '🔸';
    const gearNote =
      m.status === 'success'
        ? 'Validée'
        : m.status === 'fail'
          ? 'Échec'
          : m.gearAvailable
            ? 'Matériel OK'
            : `⚠️ Manque : ${m.missingLabel || 'Stock'}`;
    const reportTag = m.rescheduled ? ' *(reportée)*' : '';
    return `${icon} **${m.name}**${reportTag} — ${gearNote}`;
  });
  if (data.todayProgram.missions.length > 6) {
    todayListLines.push(`… et ${data.todayProgram.missions.length - 6} autre(s) mission(s).`);
  }

  const briefingFieldVal = [
    `> ${data.dailyBriefing}`,
    '',
    ...(todayListLines.length > 0
      ? todayListLines
      : ['Aucune mission planifiée pour aujourd’hui.']),
  ]
    .join('\n')
    .slice(0, 900);

  const fields = [
    {
      name: `📊 Rapport de la Veille — ${data.yesterday.dayName} (${data.yesterday.dateLabel})`,
      value: yesterdayFieldVal,
      inline: false,
    },
    {
      name: '💰 Trésorerie & Coffre',
      value: treasuryFieldVal,
      inline: true,
    },
    {
      name: '📈 Semaine (Gains / Pertes)',
      value: weeklyFieldVal,
      inline: true,
    },
    {
      name: '🏆 Classement Opérateurs (Top 5)',
      value: rankingFieldVal,
      inline: false,
    },
    {
      name: `🎯 Briefing du Jour — ${data.todayName}`,
      value: briefingFieldVal,
      inline: false,
    },
  ];

  const missingToday = data.todayProgram.missions
    .filter((m) => !m.status && !m.gearAvailable && m.missingLabel)
    .map((m) => `• **${m.name}** : ${m.missingLabel}`)
    .slice(0, 5);

  if (missingToday.length > 0) {
    fields.push({
      name: '⚠️ Matériel à commander avant départ',
      value: missingToday.join('\n').slice(0, 900),
      inline: false,
    });
  }

  if (data.isSunday && data.weekly.rewardsItemCount > 0) {
    fields.push({
      name: '💎 Dimanche — Revente & Paies',
      value: `**${data.weekly.rewardsItemCount} objet(s)** en stock à revendre (**${formatMoney(data.weekly.rewardsValTotal)}**) + calcul des paies hebdomadaires.`,
      inline: false,
    });
  }

  const embedColor =
    data.visualMood === 'crimson-alert'
      ? 0xc83e43
      : data.visualMood === 'emerald-vault'
        ? 0x10b981
        : data.visualMood === 'midnight-blue'
          ? 0x3b82f6
          : 0xc5a15a;

  return {
    content: `📰 **GAZETTE LOS CERBEROS — ${data.todayDateLabel.toUpperCase()}**`,
    embed: {
      title: `Rapport de la Veille & Briefing — ${data.todayName}`,
      description: `Semaine **${data.weekRangeLabel}** · Autonomie stock : **${data.stockSummary.allOver30Days ? '> 30 jours' : `${data.stockSummary.minDaysCovered} jour(s)`}**`,
      color: embedColor,
      fields,
      footer: {
        text: `Los Cerberos · ${data.photo.title}`,
      },
    },
  };
}

export async function sendGazetteToDiscord(params: {
  idToken: string;
  webhookUrl: string;
  imageBase64: string;
  data: DailyGazetteData;
  config?: DiscordGazetteConfig;
}): Promise<{ messageId: string | null }> {
  const { idToken, webhookUrl, imageBase64, data } = params;
  const payload = buildDiscordEmbedPayload(data);
  const filename = `gazette-los-cerberos-${data.todayIso}.png`;

  const response = await fetch('/api/discord/send-report', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      webhookUrl: webhookUrl.trim(),
      imageBase64,
      filename,
      content: payload.content,
      embed: payload.embed,
    }),
  });

  const json = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    messageId?: string | null;
  };

  if (!response.ok || !json.ok) {
    throw new Error(json.error || `Échec de l’envoi Discord (HTTP ${response.status}).`);
  }

  return { messageId: json.messageId ?? null };
}

export async function sendInstantDiscordAlert(params: {
  idToken: string;
  webhookUrl?: string;
  severity: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  description: string;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: string;
}): Promise<void> {
  const response = await fetch('/api/discord/send-alert', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.idToken}`,
    },
    body: JSON.stringify({
      webhookUrl: (params.webhookUrl || '').trim(),
      severity: params.severity,
      title: params.title,
      description: params.description,
      fields: params.fields || [],
      footer: params.footer || 'Los Cerberos · Alerte Instantanée',
    }),
  });

  const json = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
  };
  if (!response.ok || !json.ok) {
    throw new Error(json.error || `Échec de l’alerte Discord (HTTP ${response.status}).`);
  }
}

export interface SundayClosingGazetteData {
  todayIso: string;
  todayDateLabel: string;
  weekRangeLabel: string;
  summary: {
    successCount: number;
    failCount: number;
    totalMissions: number;
    grossGains: number;
    materialCost: number;
    missionLoss: number;
    weaponsLossAmount: number;
    totalLosses: number;
    netProfit: number;
  };
  previousWeek: {
    label: string;
    netProfit: number;
    deltaNet: number;
    deltaPercent: number | null;
  } | null;
  treasury: {
    legal: number;
    illegal: number;
    cashTotal: number;
    rewardsValTotal: number;
    rewardsItemCount: number;
    totalWealth: number;
  };
  payroll: {
    cartelPercent: number;
    membersPercent: number;
    cartelShareAmount: number;
    payrollPoolAmount: number;
    paidTotalAmount: number;
    unpaidTotalAmount: number;
    paidMembersCount: number;
    eligibleMembersCount: number;
    settled: boolean;
    topRows: Array<{
      name: string;
      missionsOk: number;
      amount: number;
      paid: boolean;
    }>;
  };
  podium: Array<{
    rank: number;
    name: string;
    points: number;
    missionsOk: number;
    heistsOk: number;
  }>;
  photo: {
    id: string;
    title: string;
    location: string;
    src: string;
  };
  customMessage: string;
}

function fmtCompactMoney(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(2).replace(/\.00$/, '')} M$`;
  }
  if (abs >= 10_000) {
    return `${sign}${Math.round(abs / 1_000)} k$`;
  }
  return formatMoney(value);
}

export async function buildSundayClosingGazetteData(params: {
  missionStates: MissionStates;
  scheduleMeta: MissionScheduleMeta;
  inventoryStock: InventoryStock;
  inventoryPrices: InventoryPrices;
  weaponsStock: WeaponsStock;
  rewardStocks: RewardStocks;
  treasuryMoney: TreasuryMoney;
  weaponsLossAmount: number;
  hierMembers: HierarchyMember[];
  memberRankings: MemberRankingsMap;
  catalogGroups: CatalogGroupsMap;
  albumState: AlbumState;
  historyState: HistoryState;
  customMessage?: string;
  selectedPhotoId?: string;
  customUploadedPhotoSrc?: string;
  now?: Date;
}): Promise<SundayClosingGazetteData> {
  const {
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
    historyState,
    customMessage = '',
    selectedPhotoId,
    customUploadedPhotoSrc,
    now = new Date(),
  } = params;

  const todayIso = isoDate(now);
  const todayDateLabel = now.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  let successCount = 0;
  let failCount = 0;
  let grossGains = 0;
  let materialCost = 0;
  let missionLoss = 0;

  WEEKLY_SCHEDULE.forEach((day) => {
    day.missions.forEach((m) => {
      const f = missionFin(m, missionStates, inventoryPrices, catalogGroups);
      if (f.success) successCount++;
      if (f.fail) failCount++;
      grossGains += f.gain;
      materialCost += f.cost;
      missionLoss += f.extra;
    });
  });

  const totalLosses = materialCost + missionLoss + weaponsLossAmount;
  const netProfit = grossGains - totalLosses;

  // Compare against most recent archived week (different from current week if possible)
  const currentWeekKey = missionStates.__week || '';
  const archivedList = Object.values(historyState?.archives || {}).sort((a, b) =>
    (b.week || '').localeCompare(a.week || '')
  );
  const prevArchive =
    archivedList.find((a) => a.week !== currentWeekKey) || archivedList[0] || null;
  const previousWeek = prevArchive
    ? (() => {
        const prevNet = Number(prevArchive.summary?.netProfit) || 0;
        const deltaNet = netProfit - prevNet;
        const deltaPercent =
          prevNet !== 0 ? Math.round((deltaNet / Math.abs(prevNet)) * 100) : null;
        return {
          label: prevArchive.label || prevArchive.week,
          netProfit: prevNet,
          deltaNet,
          deltaPercent,
        };
      })()
    : null;

  const curPayroll = historyState?.currentPayroll;
  const payrollResult = computeSundayPayroll({
    members: hierMembers,
    missionStates,
    scheduleMeta,
    weaponsLossAmount,
    inventoryPrices,
    catalogGroups,
    cartelPercent: curPayroll?.cartelPercent ?? 70,
    basis: curPayroll?.basis ?? 'net_cartel',
    paidMemberIds: curPayroll?.paidMemberIds ?? [],
  });

  const leaderboard = computeMemberLeaderboard({
    members: hierMembers,
    missionStates,
    weaponsStock,
    memberRankings,
    inventoryPrices,
    catalogGroups,
  });
  const podium = leaderboard
    .filter((r) => r.totalPoints > 0 || r.missionsOk > 0)
    .slice(0, 3)
    .map((r, idx) => ({
      rank: idx + 1,
      name: r.member.name,
      points: r.totalPoints,
      missionsOk: r.missionsOk,
      heistsOk: r.heistsOk,
    }));

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

  const pickedPhoto = pickDailyPhotoRecord(
    albumState,
    todayIso,
    selectedPhotoId || 'ai_vault_payout'
  );
  const resolvedSrc = customUploadedPhotoSrc
    ? customUploadedPhotoSrc
    : await resolvePhotoSrcForCanvas(pickedPhoto);

  return {
    todayIso,
    todayDateLabel: todayDateLabel.charAt(0).toUpperCase() + todayDateLabel.slice(1),
    weekRangeLabel: weekRangeText(missionStates),
    summary: {
      successCount,
      failCount,
      totalMissions: TOTAL_WEEKLY_MISSIONS,
      grossGains,
      materialCost,
      missionLoss,
      weaponsLossAmount,
      totalLosses,
      netProfit,
    },
    previousWeek,
    treasury: {
      legal: Math.max(0, Number(treasuryMoney.legal) || 0),
      illegal: Math.max(0, Number(treasuryMoney.illegal) || 0),
      cashTotal:
        Math.max(0, Number(treasuryMoney.legal) || 0) +
        Math.max(0, Number(treasuryMoney.illegal) || 0),
      rewardsValTotal,
      rewardsItemCount,
      totalWealth,
    },
    payroll: {
      cartelPercent: payrollResult.cartelPercent,
      membersPercent: payrollResult.membersPercent,
      cartelShareAmount: payrollResult.cartelShareAmount,
      payrollPoolAmount: payrollResult.payrollPoolAmount,
      paidTotalAmount: payrollResult.paidTotalAmount,
      unpaidTotalAmount: payrollResult.unpaidTotalAmount,
      paidMembersCount: payrollResult.paidMembersCount,
      eligibleMembersCount: payrollResult.eligibleMembersCount,
      settled: Boolean(curPayroll?.settled),
      topRows: payrollResult.rows
        .filter((r) => r.payrollAmount > 0 || r.missionsOk > 0)
        .slice(0, 6)
        .map((r) => ({
          name: r.memberName,
          missionsOk: r.missionsOk,
          amount: r.payrollAmount,
          paid: r.paid,
        })),
    },
    podium,
    photo: {
      id: pickedPhoto.id,
      title: pickedPhoto.title.replace(/^✦\s*/, ''),
      location: pickedPhoto.location || 'Chambre Forte Los Cerberos',
      src: resolvedSrc,
    },
    customMessage: customMessage.trim().slice(0, 300),
  };
}

export async function renderSundayClosingCanvasDataUrl(
  data: SundayClosingGazetteData,
  options?: { includePhoto?: boolean }
): Promise<string> {
  const includePhoto = options?.includePhoto ?? true;
  const W = 1200;
  const H = 760;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponible.');

  // Background luxury obsidian + warm gold radial glow
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#070709');
  bg.addColorStop(0.55, '#12100d');
  bg.addColorStop(1, '#09090b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W * 0.8, 120, 20, W * 0.8, 120, 520);
  glow.addColorStop(0, 'rgba(229, 200, 134, 0.16)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Outer ceremonial frame
  drawRoundedRect(ctx, 16, 16, W - 32, H - 32, 20);
  ctx.strokeStyle = 'rgba(229, 200, 134, 0.55)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Header band
  const headerH = 126;
  drawRoundedRect(ctx, 30, 30, W - 60, headerH, 14);
  ctx.fillStyle = '#141210';
  ctx.fill();
  ctx.strokeStyle = 'rgba(197, 161, 90, 0.45)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Optional right-side artwork inside header
  if (includePhoto) {
    const heroImg = await loadImageForCanvas(data.photo.src);
    if (heroImg) {
      ctx.save();
      drawRoundedRect(ctx, W - 360, 31, 329, headerH - 2, 13);
      ctx.clip();
      drawCoverImage(ctx, heroImg, W - 360, 31, 329, headerH - 2);
      const fade = ctx.createLinearGradient(W - 360, 0, W - 210, 0);
      fade.addColorStop(0, '#141210');
      fade.addColorStop(1, 'rgba(20, 18, 16, 0.15)');
      ctx.fillStyle = fade;
      ctx.fillRect(W - 360, 31, 329, headerH - 2);
      ctx.restore();
    }
  }

  // Emblem
  const emblem = await loadImageForCanvas('/assets/emblem.webp');
  if (emblem) {
    ctx.save();
    drawRoundedRect(ctx, 48, 48, 86, 86, 14);
    ctx.clip();
    drawCoverImage(ctx, emblem, 48, 48, 86, 86);
    ctx.restore();
    drawRoundedRect(ctx, 48, 48, 86, 86, 14);
    ctx.strokeStyle = '#e5c886';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.fillStyle = '#e5c886';
  ctx.font = '700 13px "JetBrains Mono", monospace';
  ctx.fillText('ÉDITION SPÉCIALE DIMANCHE · CLÔTURE DE SEMAINE & PAIES', 152, 68);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 34px "Playfair Display", Georgia, serif';
  ctx.fillText('LOS CERBEROS — BILAN HEBDOMADAIRE', 152, 108);

  ctx.fillStyle = '#a1a1aa';
  ctx.font = '600 14px "Montserrat", sans-serif';
  ctx.fillText(
    `Semaine ${data.weekRangeLabel}  ·  ${data.todayDateLabel}`,
    152,
    136
  );

  // Row 1: 4 KPI Cards
  const kpiY = 174;
  const kpiH = 104;
  const kpiGap = 16;
  const kpiW = (W - 60 - kpiGap * 3) / 4;

  const deltaLabel = data.previousWeek
    ? `${data.previousWeek.deltaNet >= 0 ? '+' : ''}${fmtCompactMoney(data.previousWeek.deltaNet)}${
        data.previousWeek.deltaPercent !== null
          ? ` (${data.previousWeek.deltaPercent >= 0 ? '+' : ''}${data.previousWeek.deltaPercent}%)`
          : ''
      } vs sem. préc.`
    : 'Première semaine archivée';

  const kpiCards = [
    {
      label: 'BÉNÉFICE NET SEMAINE',
      value: formatSigned(data.summary.netProfit),
      sub: deltaLabel,
      valColor: data.summary.netProfit >= 0 ? '#34d399' : '#f87171',
      border: 'rgba(229, 200, 134, 0.55)',
    },
    {
      label: 'MISSIONS VALIDÉES',
      value: `${data.summary.successCount} / ${data.summary.totalMissions}`,
      sub: `${data.summary.failCount} échec${data.summary.failCount > 1 ? 's' : ''} · Gains ${fmtCompactMoney(data.summary.grossGains)}`,
      valColor: '#ffffff',
      border: 'rgba(138, 106, 56, 0.45)',
    },
    {
      label: 'ENVELOPPE PAIES MEMBRES',
      value: formatMoney(data.payroll.payrollPoolAmount),
      sub: `${data.payroll.membersPercent}% membres · ${data.payroll.paidMembersCount}/${data.payroll.eligibleMembersCount} payés`,
      valColor: '#e5c886',
      border: 'rgba(229, 200, 134, 0.5)',
    },
    {
      label: 'PATRIMOINE TOTAL CARTEL',
      value: formatMoney(data.treasury.totalWealth),
      sub: `Cash ${fmtCompactMoney(data.treasury.cashTotal)} · Recel ${fmtCompactMoney(data.treasury.rewardsValTotal)}`,
      valColor: '#34d399',
      border: 'rgba(52, 211, 153, 0.4)',
    },
  ];

  kpiCards.forEach((card, i) => {
    const cx = 30 + i * (kpiW + kpiGap);
    drawRoundedRect(ctx, cx, kpiY, kpiW, kpiH, 12);
    ctx.fillStyle = '#141418';
    ctx.fill();
    ctx.strokeStyle = card.border;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = '#a1a1aa';
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.fillText(card.label, cx + 16, kpiY + 26);

    ctx.fillStyle = card.valColor;
    ctx.font = '800 25px "Montserrat", sans-serif';
    ctx.fillText(fitText(ctx, card.value, kpiW - 32), cx + 16, kpiY + 62);

    ctx.fillStyle = '#d4d4d8';
    ctx.font = '500 12px "Montserrat", sans-serif';
    ctx.fillText(fitText(ctx, card.sub, kpiW - 32), cx + 16, kpiY + 87);
  });

  // Row 2: Left (Podium MVP + Bilan Financier) | Right (Répartition des Paies)
  const bodyY = 296;
  const bodyH = 382;
  const leftW = 540;
  const rightX = 30 + leftW + 18;
  const rightW = W - 30 - rightX;

  // Left Top: Podium MVP
  const podiumH = 198;
  drawRoundedRect(ctx, 30, bodyY, leftW, podiumH, 14);
  ctx.fillStyle = '#141418';
  ctx.fill();
  ctx.strokeStyle = 'rgba(229, 200, 134, 0.45)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.fillStyle = '#e5c886';
  ctx.font = '700 12px "JetBrains Mono", monospace';
  ctx.fillText('01 · PODIUM MVP DE LA SEMAINE', 48, bodyY + 28);

  if (data.podium.length === 0) {
    ctx.fillStyle = '#71717a';
    ctx.font = '500 14px "Montserrat", sans-serif';
    ctx.fillText('Aucune participation enregistrée cette semaine.', 48, bodyY + 95);
  } else {
    const medals = ['🥇 #1 MVP', '🥈 #2', '🥉 #3'];
    const rowColors = ['#e5c886', '#e4e4e7', '#d97706'];
    data.podium.forEach((op, idx) => {
      const ry = bodyY + 46 + idx * 46;
      drawRoundedRect(ctx, 46, ry, leftW - 32, 38, 9);
      ctx.fillStyle = idx === 0 ? 'rgba(197, 161, 90, 0.14)' : 'rgba(255,255,255,0.03)';
      ctx.fill();

      ctx.fillStyle = rowColors[idx];
      ctx.font = '700 13px "JetBrains Mono", monospace';
      ctx.fillText(medals[idx], 58, ry + 24);

      ctx.fillStyle = '#ffffff';
      ctx.font = '700 15px "Montserrat", sans-serif';
      ctx.fillText(fitText(ctx, op.name, 220), 152, ry + 24);

      ctx.fillStyle = '#a1a1aa';
      ctx.font = '600 12px "JetBrains Mono", monospace';
      const rightStat = `${op.points} pts · ${op.missionsOk} ok${op.heistsOk > 0 ? ` (${op.heistsOk} brq)` : ''}`;
      const sw = ctx.measureText(rightStat).width;
      ctx.fillText(rightStat, 30 + leftW - 28 - sw, ry + 24);
    });
  }

  // Left Bottom: Détail Pertes / Gains / Coffre
  const finY = bodyY + podiumH + 14;
  const finH = bodyH - podiumH - 14;
  drawRoundedRect(ctx, 30, finY, leftW, finH, 14);
  ctx.fillStyle = '#141418';
  ctx.fill();
  ctx.strokeStyle = 'rgba(138, 106, 56, 0.45)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.fillStyle = '#e5c886';
  ctx.font = '700 12px "JetBrains Mono", monospace';
  ctx.fillText('02 · BILAN FINANCIER & TRÉSORERIE', 48, finY + 28);

  const finLines: Array<{ label: string; value: string; color: string }> = [
    { label: 'Gains bruts encaissés', value: formatMoney(data.summary.grossGains), color: '#34d399' },
    {
      label: 'Pertes totales (Matériel + Missions + Armes)',
      value: `-${formatMoney(data.summary.totalLosses)}`,
      color: '#f87171',
    },
    {
      label: `Part conservée par le Cartel (${data.payroll.cartelPercent}%)`,
      value: formatMoney(data.payroll.cartelShareAmount),
      color: '#e5c886',
    },
    {
      label: 'Trésorerie Coffre (Légal / Sale)',
      value: `${fmtCompactMoney(data.treasury.legal)} / ${fmtCompactMoney(data.treasury.illegal)}`,
      color: '#ffffff',
    },
  ];

  finLines.forEach((line, idx) => {
    const ly = finY + 56 + idx * 28;
    ctx.fillStyle = '#a1a1aa';
    ctx.font = '500 13px "Montserrat", sans-serif';
    ctx.fillText(line.label, 48, ly);

    ctx.fillStyle = line.color;
    ctx.font = '700 13px "JetBrains Mono", monospace';
    const vw = ctx.measureText(line.value).width;
    ctx.fillText(line.value, 30 + leftW - 22 - vw, ly);
  });

  // Right Panel: Répartition des Paies Dimanche
  drawRoundedRect(ctx, rightX, bodyY, rightW, bodyH, 14);
  ctx.fillStyle = '#141418';
  ctx.fill();
  ctx.strokeStyle = 'rgba(229, 200, 134, 0.45)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.fillStyle = '#e5c886';
  ctx.font = '700 12px "JetBrains Mono", monospace';
  ctx.fillText(
    `03 · RÉPARTITION DES PAIES (${data.payroll.settled ? 'SOLDÉ' : 'EN COURS'})`,
    rightX + 20,
    bodyY + 28
  );

  ctx.fillStyle = '#d4d4d8';
  ctx.font = '500 13px "Montserrat", sans-serif';
  ctx.fillText(
    `Pool membres : ${formatMoney(data.payroll.payrollPoolAmount)}  ·  Déjà versé : ${formatMoney(data.payroll.paidTotalAmount)}`,
    rightX + 20,
    bodyY + 54
  );

  if (data.payroll.topRows.length === 0) {
    ctx.fillStyle = '#71717a';
    ctx.font = '500 14px "Montserrat", sans-serif';
    ctx.fillText('Aucune paie calculée pour cette semaine.', rightX + 20, bodyY + 120);
  } else {
    data.payroll.topRows.forEach((row, idx) => {
      const ry = bodyY + 74 + idx * 42;
      drawRoundedRect(ctx, rightX + 18, ry, rightW - 36, 34, 8);
      ctx.fillStyle = row.paid ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255,255,255,0.03)';
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = '700 13px "Montserrat", sans-serif';
      ctx.fillText(fitText(ctx, `${idx + 1}. ${row.name}`, 230), rightX + 30, ry + 22);

      ctx.fillStyle = '#a1a1aa';
      ctx.font = '500 12px "JetBrains Mono", monospace';
      ctx.fillText(`${row.missionsOk} miss.`, rightX + 280, ry + 22);

      const amtText = `${formatMoney(row.amount)} ${row.paid ? '✓' : '⏳'}`;
      ctx.fillStyle = row.paid ? '#34d399' : '#e5c886';
      ctx.font = '700 13px "JetBrains Mono", monospace';
      const aw = ctx.measureText(amtText).width;
      ctx.fillText(amtText, rightX + rightW - 30 - aw, ry + 22);
    });
  }

  // Optional command note at bottom of right panel
  const noteY = bodyY + bodyH - 46;
  ctx.fillStyle = 'rgba(197, 161, 90, 0.12)';
  drawRoundedRect(ctx, rightX + 18, noteY, rightW - 36, 32, 8);
  ctx.fill();
  ctx.fillStyle = '#e5c886';
  ctx.font = '600 12px "Montserrat", sans-serif';
  const noteLine =
    data.customMessage ||
    (data.treasury.rewardsItemCount > 0
      ? `💎 ${data.treasury.rewardsItemCount} objet(s) à revendre (${formatMoney(data.treasury.rewardsValTotal)}) avant clôture.`
      : 'Archivez la semaine dans l’onglet Paye / Archives pour démarrer lundi proprement.');
  ctx.fillText(fitText(ctx, noteLine, rightW - 56), rightX + 28, noteY + 21);

  // Footer
  ctx.fillStyle = '#71717a';
  ctx.font = '600 11px "JetBrains Mono", monospace';
  ctx.fillText(
    'LOS CERBEROS · TRAICIONADOS POR EL ESTADO, JURAMENTADOS POR LA SANGRE',
    34,
    H - 36
  );
  const rightFooter = `CLÔTURE DIMANCHE · ${data.todayIso}`;
  const rfw = ctx.measureText(rightFooter).width;
  ctx.fillText(rightFooter, W - 34 - rfw, H - 36);

  return canvas.toDataURL('image/png');
}

export function buildSundayClosingEmbedPayload(data: SundayClosingGazetteData): {
  content: string;
  embed: {
    title: string;
    description: string;
    color: number;
    fields: Array<{ name: string; value: string; inline: boolean }>;
    footer: { text: string };
  };
} {
  const vsPrev = data.previousWeek
    ? `\n• Évolution vs ${data.previousWeek.label} : **${formatSigned(data.previousWeek.deltaNet)}**${
        data.previousWeek.deltaPercent !== null
          ? ` (${data.previousWeek.deltaPercent >= 0 ? '+' : ''}${data.previousWeek.deltaPercent}%)`
          : ''
      }`
    : '';

  const podiumVal =
    data.podium.length > 0
      ? data.podium
          .map((p, i) => {
            const medal = ['🥇', '🥈', '🥉'][i] || '•';
            return `${medal} **${p.name}** — ${p.points} pts (${p.missionsOk} miss.${p.heistsOk > 0 ? `, ${p.heistsOk} brq.` : ''})`;
          })
          .join('\n')
      : 'Aucun opérateur classé cette semaine.';

  const payrollLines =
    data.payroll.topRows.length > 0
      ? data.payroll.topRows
          .map((r) => `• **${r.name}** : ${formatMoney(r.amount)} ${r.paid ? '✅' : '⏳'}`)
          .join('\n')
      : 'Aucune distribution enregistrée.';

  const fields = [
    {
      name: '📊 Bilan Opérationnel & Financier',
      value: [
        `• Missions : **${data.summary.successCount} ✅** / **${data.summary.failCount} ❌** (sur ${data.summary.totalMissions})`,
        `• Gains bruts : **+${formatMoney(data.summary.grossGains)}**`,
        `• Pertes totales : **-${formatMoney(data.summary.totalLosses)}** (Mat. ${formatMoney(data.summary.materialCost)} · Miss. ${formatMoney(data.summary.missionLoss)} · Armes ${formatMoney(data.summary.weaponsLossAmount)})`,
        `• **Bénéfice Net : ${formatSigned(data.summary.netProfit)}**${vsPrev}`,
      ].join('\n'),
      inline: false,
    },
    {
      name: '🏆 Podium MVP de la Semaine',
      value: podiumVal,
      inline: true,
    },
    {
      name: '💰 Patrimoine Fin de Semaine',
      value: [
        `• Légal : **${formatMoney(data.treasury.legal)}**`,
        `• Sale : **${formatMoney(data.treasury.illegal)}**`,
        `• Recel : **${formatMoney(data.treasury.rewardsValTotal)}** (${data.treasury.rewardsItemCount} obj.)`,
        `• **Total : ${formatMoney(data.treasury.totalWealth)}**`,
      ].join('\n'),
      inline: true,
    },
    {
      name: `💵 Paies du Dimanche (${data.payroll.cartelPercent}% Cartel / ${data.payroll.membersPercent}% Membres)`,
      value: [
        `• Enveloppe membres : **${formatMoney(data.payroll.payrollPoolAmount)}** · Part cartel : **${formatMoney(data.payroll.cartelShareAmount)}**`,
        `• Statut : **${data.payroll.settled ? '✅ Soldé' : `⏳ ${data.payroll.paidMembersCount}/${data.payroll.eligibleMembersCount} membre(s) payé(s)`}**`,
        payrollLines,
      ]
        .join('\n')
        .slice(0, 920),
      inline: false,
    },
  ];

  if (data.customMessage) {
    fields.push({
      name: '📜 Mot du Commandement',
      value: data.customMessage,
      inline: false,
    });
  }

  return {
    content: `🏆 **ÉDITION SPÉCIALE DIMANCHE — CLÔTURE LOS CERBEROS (${data.weekRangeLabel})**`,
    embed: {
      title: `Bilan de Fin de Semaine & Paies — ${data.todayDateLabel}`,
      description: `Synthèse officielle de clôture de la semaine **${data.weekRangeLabel}**.`,
      color: 0xe5c886,
      fields,
      footer: {
        text: `Los Cerberos · Édition Spéciale Dimanche`,
      },
    },
  };
}

export async function sendSundayClosingToDiscord(params: {
  idToken: string;
  webhookUrl: string;
  imageBase64: string;
  data: SundayClosingGazetteData;
}): Promise<{ messageId: string | null }> {
  const { idToken, webhookUrl, imageBase64, data } = params;
  const payload = buildSundayClosingEmbedPayload(data);
  const filename = `bilan-dimanche-los-cerberos-${data.todayIso}.png`;

  const response = await fetch('/api/discord/send-report', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      webhookUrl: webhookUrl.trim(),
      imageBase64,
      filename,
      content: payload.content,
      embed: payload.embed,
    }),
  });

  const json = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    messageId?: string | null;
  };

  if (!response.ok || !json.ok) {
    throw new Error(json.error || `Échec de l’envoi Discord (HTTP ${response.status}).`);
  }

  return { messageId: json.messageId ?? null };
}

