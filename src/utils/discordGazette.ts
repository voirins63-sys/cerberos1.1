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
    net: number;
    highlights: Array<{ name: string; status: 'success' | 'fail'; net: number }>;
  };
  weekly: {
    successCount: number;
    failCount: number;
    totalMissions: number;
    grossGains: number;
    netProfit: number;
    totalWealth: number;
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
  photo: {
    id: string;
    title: string;
    caption: string;
    location: string;
    authorName: string;
    src: string;
  };
  customMessage: string;
}

export function getAllGazettePhotoChoices(albumState: AlbumState): AlbumPhotoRecord[] {
  const custom = Object.values(albumState.photos || {}).sort((a, b) =>
    (b.createdAtIso || '').localeCompare(a.createdAtIso || '')
  );
  const builtInScenes = BUILT_IN_ALBUM_PHOTOS.filter(
    (p) => p.id !== 'builtin_embleme_cerberos'
  );
  return [...custom, ...builtInScenes, BUILT_IN_ALBUM_PHOTOS[1]].filter(Boolean);
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

  const scenePool = choices.filter((p) => p.id !== 'builtin_embleme_cerberos');
  const pool = scenePool.length > 0 ? scenePool : choices;

  let hash = 0;
  for (let i = 0; i < todayIso.length; i++) {
    hash = (hash * 31 + todayIso.charCodeAt(i)) >>> 0;
  }
  return pool[hash % pool.length] || BUILT_IN_ALBUM_PHOTOS[0];
}

export async function resolvePhotoSrcForCanvas(photo: AlbumPhotoRecord): Promise<string> {
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

  return BUILT_IN_ALBUM_PHOTOS[0].src;
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
  const yHighlights: Array<{ name: string; status: 'success' | 'fail'; net: number }> = [];

  if (yesterdayHasData) {
    const yDayObj = effectiveSchedule.days.find((d) => d.day === yesterdayDayName);
    if (yDayObj) {
      yTotal = yDayObj.missions.length;
      if (staleWeek) {
        yesterdayDateLabel = fmtShort(dayDate(yesterdayDayName, missionStates));
      }
      yDayObj.missions.forEach((m) => {
        const fin = missionFin(m, missionStates, inventoryPrices, catalogGroups);
        if (fin.success) {
          yOk++;
          yHighlights.push({ name: m.name, status: 'success', net: fin.net });
        } else if (fin.fail) {
          yKo++;
          yHighlights.push({ name: m.name, status: 'fail', net: fin.net });
        }
        yGains += fin.gain;
        yCosts += fin.cost;
        yExtra += fin.extra;
      });
    }
  }

  const yNet = yGains - yCosts - yExtra;

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

  const weeklyNet = wGains - (wCost + wExtra + weaponsLossAmount);
  const rewardsValTotal = calcRewardsTotalValue(rewardStocks);
  const rewardsItemCount = REWARD_ITEMS.reduce(
    (sum, item) => sum + Math.max(0, Number(rewardStocks[item.key]?.qty) || 0),
    0
  );
  const cashTotal =
    Math.max(0, Number(treasuryMoney.legal) || 0) +
    Math.max(0, Number(treasuryMoney.illegal) || 0);
  const totalWealth = calcTotalWealth({
    treasuryMoney,
    rewardStocks,
    inventoryStock,
    inventoryPrices,
    weaponsStock,
    catalogGroups,
  });

  // Top 3 Operators
  const leaderboard = computeMemberLeaderboard({
    members: hierMembers,
    missionStates,
    weaponsStock,
    memberRankings,
    inventoryPrices,
    catalogGroups,
  });

  const topOperators = leaderboard.slice(0, 3).map((entry) => ({
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

  // Photo du jour
  const chosenPhoto = pickDailyPhotoRecord(albumState, todayIso, selectedPhotoId);
  const resolvedSrc = await resolvePhotoSrcForCanvas(chosenPhoto);

  return {
    todayIso,
    todayDateLabel,
    todayName,
    weekRangeLabel: weekRangeText(missionStates),
    isSunday,
    yesterday: {
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
      net: yNet,
      highlights: yHighlights,
    },
    weekly: {
      successCount: wSuccess,
      failCount: wFail,
      totalMissions: TOTAL_WEEKLY_MISSIONS,
      grossGains: wGains,
      netProfit: weeklyNet,
      totalWealth,
      cashTotal,
      rewardsValTotal,
      rewardsItemCount,
    },
    topOperators,
    todayProgram: {
      total: todayMissions.length,
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
    photo: {
      id: chosenPhoto.id,
      title: chosenPhoto.title,
      caption: chosenPhoto.caption,
      location: chosenPhoto.location,
      authorName: chosenPhoto.authorName,
      src: resolvedSrc,
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

  // Preload assets (with local fallback if external URL fails CORS)
  const [emblemImg, rawPhotoImg] = await Promise.all([
    loadImageForCanvas('/assets/aistudio/image_bba68987.png').then(
      (img) => img || loadImageForCanvas('/assets/emblem.webp')
    ),
    includePhoto ? loadImageForCanvas(data.photo.src) : Promise.resolve(null),
  ]);

  const photoImg =
    includePhoto && !rawPhotoImg
      ? await loadImageForCanvas(BUILT_IN_ALBUM_PHOTOS[0].src)
      : rawPhotoImg;

  // 1. Deep Obsidian & Crimson Ambient Backdrop
  ctx.fillStyle = '#080808';
  ctx.fillRect(0, 0, width, height);

  const radialCrimson = ctx.createRadialGradient(180, 120, 40, 200, 150, 620);
  radialCrimson.addColorStop(0, 'rgba(142, 32, 36, 0.24)');
  radialCrimson.addColorStop(1, 'rgba(8, 8, 8, 0)');
  ctx.fillStyle = radialCrimson;
  ctx.fillRect(0, 0, width, height);

  const radialGold = ctx.createRadialGradient(1020, 620, 40, 1000, 620, 540);
  radialGold.addColorStop(0, 'rgba(197, 161, 90, 0.14)');
  radialGold.addColorStop(1, 'rgba(8, 8, 8, 0)');
  ctx.fillStyle = radialGold;
  ctx.fillRect(0, 0, width, height);

  // Outer Luxury Frame
  drawRoundedRect(ctx, 16, 16, width - 32, height - 32, 18);
  ctx.strokeStyle = 'rgba(197, 161, 90, 0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();

  drawRoundedRect(ctx, 22, 22, width - 44, height - 44, 14);
  ctx.strokeStyle = 'rgba(142, 32, 36, 0.55)';
  ctx.lineWidth = 1;
  ctx.stroke();

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

  ctx.fillStyle = '#c83e43';
  ctx.font = '700 11px "JetBrains Mono", monospace';
  ctx.fillText('EDITION QUOTIDIENNE · ORGANISATION PARAMILITAIRE', 130, 52);

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
  ctx.fillText('PATRIMOINE GLOBAL CARTEL', 904, 60);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 24px "Montserrat", sans-serif';
  ctx.fillText(formatMoney(data.weekly.totalWealth), 904, 92);

  // Divider line
  ctx.beginPath();
  ctx.moveTo(38, 124);
  ctx.lineTo(width - 38, 124);
  ctx.strokeStyle = 'rgba(197, 161, 90, 0.28)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 3. LEFT COLUMN: YESTERDAY + WEEKLY/TOP3 + TODAY PROGRAM
  const colX = 38;
  const colW = 696;

  // --- CARD A: BILAN DE LA VEILLE (y: 138..292) ---
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
        label: 'OPÉRATIONS',
        val: `${data.yesterday.ok} OK / ${data.yesterday.ko} KO`,
        sub: `sur ${data.yesterday.total} prévues`,
        color: '#ffffff',
      },
      {
        label: 'GAINS BRUTS',
        val: formatMoney(data.yesterday.gains),
        sub: 'Butin & cash',
        color: '#34d399',
      },
      {
        label: 'COÛTS & PERTES',
        val: formatMoney(data.yesterday.costs + data.yesterday.extra),
        sub: `Mat. ${formatMoney(data.yesterday.costs)}`,
        color: '#f87171',
      },
      {
        label: 'NET VEILLE',
        val: formatSigned(data.yesterday.net),
        sub: data.yesterday.net >= 0 ? 'Journée positive' : 'Sous le coût',
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
      ctx.font = '700 10px "JetBrains Mono", monospace';
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

  // --- ROW B: POINT HEBDO (left) + TOP 3 OPÉRATEURS (right) (y: 304..488) ---
  const halfW = 340;
  const rowBY = 304;
  const rowBH = 184;

  // B1: Point Hebdo
  drawRoundedRect(ctx, colX, rowBY, halfW, rowBH, 14);
  ctx.fillStyle = 'rgba(20, 18, 16, 0.94)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(107, 81, 64, 0.65)';
  ctx.stroke();

  ctx.fillStyle = '#e3c98f';
  ctx.font = '700 12px "JetBrains Mono", monospace';
  ctx.fillText('02 · POINT HEBDOMADAIRE', colX + 16, rowBY + 24);

  const pct =
    data.weekly.totalMissions > 0
      ? Math.min(
          1,
          (data.weekly.successCount + data.weekly.failCount) / data.weekly.totalMissions
        )
      : 0;

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 14px "Montserrat", sans-serif';
  ctx.fillText(
    `${data.weekly.successCount} / ${data.weekly.totalMissions} réussies`,
    colX + 16,
    rowBY + 52
  );
  ctx.fillStyle = '#a1a1aa';
  ctx.font = '600 11px "JetBrains Mono", monospace';
  ctx.fillText(`${Math.round(pct * 100)}%`, colX + halfW - 46, rowBY + 52);

  // Progress Bar
  drawRoundedRect(ctx, colX + 16, rowBY + 62, halfW - 32, 9, 5);
  ctx.fillStyle = '#080808';
  ctx.fill();
  if (pct > 0) {
    drawRoundedRect(ctx, colX + 16, rowBY + 62, Math.max(12, (halfW - 32) * pct), 9, 5);
    const grad = ctx.createLinearGradient(colX + 16, 0, colX + halfW - 16, 0);
    grad.addColorStop(0, '#8e2024');
    grad.addColorStop(0.55, '#c5a15a');
    grad.addColorStop(1, '#34d399');
    ctx.fillStyle = grad;
    ctx.fill();
  }

  const hebdoLines = [
    {
      label: 'Bénéfice Net Hebdo',
      val: formatSigned(data.weekly.netProfit),
      color: data.weekly.netProfit >= 0 ? '#34d399' : '#c83e43',
    },
    {
      label: 'Cash en Caisse',
      val: formatMoney(data.weekly.cashTotal),
      color: '#ffffff',
    },
    {
      label: `Recel à Vendre (${data.weekly.rewardsItemCount})`,
      val: formatMoney(data.weekly.rewardsValTotal),
      color: '#e3c98f',
    },
  ];
  hebdoLines.forEach((line, i) => {
    const ly = rowBY + 98 + i * 28;
    ctx.fillStyle = '#a1a1aa';
    ctx.font = '500 12px "Montserrat", sans-serif';
    ctx.fillText(line.label, colX + 16, ly);

    ctx.fillStyle = line.color;
    ctx.font = '700 13px "JetBrains Mono", monospace';
    const wVal = ctx.measureText(line.val).width;
    ctx.fillText(line.val, colX + halfW - 16 - wVal, ly);
  });

  // B2: Top 3 Opérateurs
  const topX = colX + halfW + 16;
  drawRoundedRect(ctx, topX, rowBY, halfW, rowBH, 14);
  ctx.fillStyle = 'rgba(20, 18, 16, 0.94)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(107, 81, 64, 0.65)';
  ctx.stroke();

  ctx.fillStyle = '#e3c98f';
  ctx.font = '700 12px "JetBrains Mono", monospace';
  ctx.fillText('03 · PODIUM OPÉRATEURS', topX + 16, rowBY + 24);

  if (data.topOperators.length === 0) {
    ctx.fillStyle = '#a1a1aa';
    ctx.font = '500 12px "Montserrat", sans-serif';
    ctx.fillText('Aucun classement disponible.', topX + 16, rowBY + 72);
  } else {
    const medalColors = ['#c5a15a', '#e4e4e7', '#d97706'];
    data.topOperators.forEach((op, idx) => {
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
  ctx.fillStyle = data.stockSummary.minDaysCovered <= 1 && !data.stockSummary.allOver30Days
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
      ctx.font = m.major ? '700 12px "Montserrat", sans-serif' : '600 12px "Montserrat", sans-serif';
      const prefix = m.major ? '[GROS COUP] ' : '';
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
      `DIMANCHE REVENTE : ${data.weekly.rewardsItemCount} objets en coffre (${formatMoney(data.weekly.rewardsValTotal)})`,
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

  // 4. RIGHT COLUMN: PHOTO DU JOUR + MOT DU COMMANDEMENT (x: 750..1162)
  const rightX = 750;
  const rightW = 412;

  if (includePhoto && photoImg) {
    const photoCardH = 420;
    drawRoundedRect(ctx, rightX, 138, rightW, photoCardH, 14);
    ctx.fillStyle = '#11100f';
    ctx.fill();

    ctx.save();
    drawRoundedRect(ctx, rightX, 138, rightW, photoCardH, 14);
    ctx.clip();
    drawCoverImage(ctx, photoImg, rightX, 138, rightW, photoCardH);

    // Bottom dark gradient overlay for readability
    const imgGrad = ctx.createLinearGradient(0, 138 + 180, 0, 138 + photoCardH);
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
    drawRoundedRect(ctx, rightX + 14, 152, 166, 24, 6);
    ctx.fillStyle = 'rgba(8, 8, 8, 0.8)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(197, 161, 90, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#e3c98f';
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.fillText('PHOTO DU JOUR · ALBUM', rightX + 24, 168);

    // Caption bottom
    ctx.fillStyle = '#c5a15a';
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.fillText(
      fitText(
        ctx,
        `${data.photo.location || 'Los Santos'} · Par ${data.photo.authorName || 'Los Cerberos'}`,
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
    drawRoundedRect(ctx, rightX, 138, rightW, 420, 14);
    ctx.fillStyle = '#11100f';
    ctx.fill();
    ctx.strokeStyle = 'rgba(197, 161, 90, 0.45)';
    ctx.stroke();
    if (emblemImg) {
      ctx.save();
      drawRoundedRect(ctx, rightX + 96, 198, 220, 220, 24);
      ctx.clip();
      drawCoverImage(ctx, emblemImg, rightX + 96, 198, 220, 220);
      ctx.restore();
    }
    ctx.fillStyle = '#e3c98f';
    ctx.font = '700 14px "Playfair Display", Georgia, serif';
    ctx.fillText('SCEAU OFFICIEL · LOS CERBEROS', rightX + 82, 464);
  }

  // Bottom Right Box: Note du Commandement + Missions prêtes
  const noteY = 572;
  const noteH = 124;
  drawRoundedRect(ctx, rightX, noteY, rightW, noteH, 14);
  ctx.fillStyle = 'rgba(20, 18, 16, 0.94)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(142, 32, 36, 0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#c83e43';
  ctx.font = '700 11px "JetBrains Mono", monospace';
  ctx.fillText('05 · CONSIGNE & PRÉPARATION', rightX + 16, noteY + 24);

  const noteText =
    data.customMessage ||
    `Missions prêtes en coffre : ${data.stockSummary.readyMissionsCount} / ${data.stockSummary.totalMissionsCount}. Discipline, loyauté et coordination sur chaque opération.`;
  ctx.fillStyle = '#e4e4e7';
  ctx.font = '500 12px "Montserrat", sans-serif';
  const noteLines = wrapLines(ctx, noteText, rightW - 32, 3);
  noteLines.forEach((line, i) => {
    ctx.fillText(line, rightX + 16, noteY + 50 + i * 18);
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
      noteY + noteH - 14
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
  const topLine =
    data.topOperators.length > 0
      ? data.topOperators
          .map((op) => `#${op.rank} **${op.name}** (${op.points} pts)`)
          .join(' · ')
      : 'Aucun point enregistré';

  const yesterdayLine = data.yesterday.hasData
    ? `${data.yesterday.ok} OK / ${data.yesterday.ko} KO · Net ${formatSigned(data.yesterday.net)}`
    : data.yesterday.note;

  const missingToday = data.todayProgram.missions
    .filter((m) => !m.status && !m.gearAvailable && m.missingLabel)
    .map((m) => `• ${m.name} (${m.missingLabel})`)
    .slice(0, 4);

  const fields = [
    {
      name: `📊 Veille (${data.yesterday.dayName})`,
      value: yesterdayLine,
      inline: true,
    },
    {
      name: '📈 Semaine & Coffre',
      value: `${data.weekly.successCount}/${data.weekly.totalMissions} réussies · Net ${formatSigned(data.weekly.netProfit)} · Patrimoine ${formatMoney(data.weekly.totalWealth)}`,
      inline: true,
    },
    {
      name: `📅 Programme — ${data.todayName}`,
      value: `${data.todayProgram.pending} à faire · ${data.todayProgram.ok} validée(s) · Autonomie ${data.stockSummary.allOver30Days ? '> 30j' : `${data.stockSummary.minDaysCovered}j`}`,
      inline: false,
    },
    {
      name: '🏆 Top 3 Opérateurs',
      value: topLine,
      inline: false,
    },
  ];

  if (missingToday.length > 0) {
    fields.push({
      name: '⚠️ Matériel manquant aujourd’hui',
      value: missingToday.join('\n'),
      inline: false,
    });
  }

  if (data.isSunday && data.weekly.rewardsItemCount > 0) {
    fields.push({
      name: '💎 Revente Dimanche',
      value: `${data.weekly.rewardsItemCount} objet(s) à revendre (${formatMoney(data.weekly.rewardsValTotal)})`,
      inline: false,
    });
  }

  return {
    content: `📰 **Gazette Los Cerberos — ${data.todayDateLabel}**`,
    embed: {
      title: `Briefing Quotidien — ${data.todayName}`,
      description: data.customMessage || `Semaine ${data.weekRangeLabel}`,
      color: 0xc5a15a,
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
