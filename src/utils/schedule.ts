import {
  DAILY_RECALC_HOUR,
  DAILY_RECALC_MINUTE,
  DAY_NAMES,
  MISSION_REGULATION,
  WEEKLY_SCHEDULE,
} from '@/src/data/cartelData';
import type {
  Mission,
  MissionScheduleMeta,
  MissionStateEntry,
  MissionStates,
  MissionStatus,
  MissionTypeKey,
} from '@/src/types/cartel';

export const EMPTY_SCHEDULE_META: MissionScheduleMeta = {
  scheduleOverrides: {},
  unplacedMissionIds: [],
  lastRecalcDate: '',
  lastRecalcAt: '',
};

const VALID_TYPE_KEYS = new Set<MissionTypeKey>(
  Object.keys(MISSION_REGULATION) as MissionTypeKey[]
);

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function localIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function localWeekStart(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function readMissionStatus(missionStates: MissionStates, id: string): MissionStatus {
  const raw = missionStates[id];
  if (!raw || typeof raw !== 'object') return '';
  const entry = raw as MissionStateEntry;
  if (entry.status) return entry.status;
  return entry.completed ? 'success' : '';
}

export function getMissionTypeKey(mission: Mission): MissionTypeKey {
  const parts = mission.id.split('_');
  const candidate = parts[1] as MissionTypeKey | undefined;
  if (candidate && VALID_TYPE_KEYS.has(candidate)) {
    return candidate;
  }
  if (mission.gearKey !== 'none' && VALID_TYPE_KEYS.has(mission.gearKey as MissionTypeKey)) {
    return mission.gearKey as MissionTypeKey;
  }
  return 'ket';
}

export function isPastDailyRecalcTime(now: Date = new Date()): boolean {
  const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
  return minutesSinceMidnight >= DAILY_RECALC_HOUR * 60 + DAILY_RECALC_MINUTE;
}

export function getMsUntilNextDailyRecalc(now: Date = new Date()): number {
  const target = new Date(now);
  target.setHours(DAILY_RECALC_HOUR, DAILY_RECALC_MINUTE, 1, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return Math.max(1000, target.getTime() - now.getTime());
}

export function getCurrentWeekTodayName(
  missionStates: MissionStates,
  now: Date = new Date()
): string | null {
  const weekStart = localWeekStart(now);
  const weekIso = localIsoDate(weekStart);
  if (missionStates.__week && missionStates.__week !== weekIso) return null;
  const todayStr = localIsoDate(now);
  for (let i = 0; i < DAY_NAMES.length; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    if (localIsoDate(d) === todayStr) return DAY_NAMES[i];
  }
  return null;
}

export interface EffectiveMission extends Mission {
  originalDay: string;
  isRescheduled: boolean;
}

export interface EffectiveDaySchedule {
  day: string;
  missions: EffectiveMission[];
  originalCount: number;
  carriedOutCount: number;
}

export interface UnplacedMissionInfo {
  mission: Mission;
  originalDay: string;
  typeKey: MissionTypeKey;
  reason: string;
}

export interface EffectiveScheduleResult {
  days: EffectiveDaySchedule[];
  unplacedMissions: UnplacedMissionInfo[];
  movedCount: number;
  effectiveDayByMissionId: Record<string, string>;
}

export function getEffectiveSchedule(
  missionStates: MissionStates,
  scheduleMeta?: MissionScheduleMeta
): EffectiveScheduleResult {
  const overrides = scheduleMeta?.scheduleOverrides || {};
  const unplacedSet = new Set(scheduleMeta?.unplacedMissionIds || []);

  const dayBuckets = new Map<string, EffectiveMission[]>();
  const originalCountByDay = new Map<string, number>();
  const carriedOutByDay = new Map<string, number>();
  DAY_NAMES.forEach((d) => {
    dayBuckets.set(d, []);
    originalCountByDay.set(d, 0);
    carriedOutByDay.set(d, 0);
  });

  const unplacedMissions: UnplacedMissionInfo[] = [];
  const effectiveDayByMissionId: Record<string, string> = {};
  let movedCount = 0;

  WEEKLY_SCHEDULE.forEach((dayObj) => {
    originalCountByDay.set(dayObj.day, dayObj.missions.length);
    dayObj.missions.forEach((m) => {
      const status = readMissionStatus(missionStates, m.id);
      const isUndone = status === '';

      if (isUndone && unplacedSet.has(m.id)) {
        const typeKey = getMissionTypeKey(m);
        const rule = MISSION_REGULATION[typeKey];
        const reason =
          rule.dailyLimit !== null
            ? `Plafond journalier atteint (${rule.dailyLimit}/jour max jusqu'à Dimanche)`
            : `Plafond hebdomadaire atteint (${rule.weeklyLimit}/semaine max)`;
        unplacedMissions.push({
          mission: m,
          originalDay: dayObj.day,
          typeKey,
          reason,
        });
        carriedOutByDay.set(dayObj.day, (carriedOutByDay.get(dayObj.day) || 0) + 1);
        return;
      }

      const candidateDay = overrides[m.id];
      const assignedDay =
        candidateDay && DAY_NAMES.includes(candidateDay) ? candidateDay : dayObj.day;
      const isRescheduled = assignedDay !== dayObj.day;

      if (isRescheduled) {
        movedCount++;
        carriedOutByDay.set(dayObj.day, (carriedOutByDay.get(dayObj.day) || 0) + 1);
      }

      effectiveDayByMissionId[m.id] = assignedDay;
      dayBuckets.get(assignedDay)?.push({
        ...m,
        originalDay: dayObj.day,
        isRescheduled,
      });
    });
  });

  const days: EffectiveDaySchedule[] = DAY_NAMES.map((day) => ({
    day,
    missions: dayBuckets.get(day) || [],
    originalCount: originalCountByDay.get(day) || 0,
    carriedOutCount: carriedOutByDay.get(day) || 0,
  }));

  return {
    days,
    unplacedMissions,
    movedCount,
    effectiveDayByMissionId,
  };
}

function mapsEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k) => a[k] === b[k]);
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, idx) => v === b[idx]);
}

export interface RecalcScheduleResult {
  meta: MissionScheduleMeta;
  movedCount: number;
  unplacedCount: number;
  changed: boolean;
}

export function computeRecalculatedSchedule(params: {
  missionStates: MissionStates;
  currentMeta?: MissionScheduleMeta;
  targetStartDayName: string;
  now?: Date;
}): RecalcScheduleResult {
  const { missionStates, currentMeta, targetStartDayName, now = new Date() } = params;
  const rawStartIdx = DAY_NAMES.indexOf(targetStartDayName);
  const targetStartIdx = rawStartIdx >= 0 ? rawStartIdx : 0;
  const prevOverrides = currentMeta?.scheduleOverrides || {};

  const typeCountOnDay: Array<Record<string, number>> = DAY_NAMES.map(() => ({}));
  const weeklyTypeCount: Record<string, number> = {};
  const majorCountOnDay: number[] = DAY_NAMES.map(() => 0);
  const totalCountOnDay: number[] = DAY_NAMES.map(() => 0);

  const nextOverrides: Record<string, string> = {};
  const nextUnplacedIds: string[] = [];
  const toRedistribute: Array<{
    mission: Mission;
    originalDayIdx: number;
    originalOrder: number;
    typeKey: MissionTypeKey;
  }> = [];

  let orderCounter = 0;

  // 1. Partition baseline missions into Fixed (completed or today/future) vs Overdue Undone
  WEEKLY_SCHEDULE.forEach((dayObj, origIdx) => {
    dayObj.missions.forEach((m) => {
      const idxOrder = orderCounter++;
      const status = readMissionStatus(missionStates, m.id);
      const typeKey = getMissionTypeKey(m);

      if (status !== '') {
        // Already done (success or fail): keep on its currently assigned day
        const curDay =
          prevOverrides[m.id] && DAY_NAMES.includes(prevOverrides[m.id])
            ? prevOverrides[m.id]
            : dayObj.day;
        const curDayIdx = DAY_NAMES.indexOf(curDay);
        if (curDay !== dayObj.day) {
          nextOverrides[m.id] = curDay;
        }
        if (curDayIdx >= 0) {
          typeCountOnDay[curDayIdx][typeKey] = (typeCountOnDay[curDayIdx][typeKey] || 0) + 1;
          totalCountOnDay[curDayIdx]++;
          if (m.major) majorCountOnDay[curDayIdx]++;
        }
        weeklyTypeCount[typeKey] = (weeklyTypeCount[typeKey] || 0) + 1;
        return;
      }

      if (origIdx >= targetStartIdx) {
        // Undone mission scheduled for today or a future day: stays on its baseline day
        typeCountOnDay[origIdx][typeKey] = (typeCountOnDay[origIdx][typeKey] || 0) + 1;
        totalCountOnDay[origIdx]++;
        if (m.major) majorCountOnDay[origIdx]++;
        weeklyTypeCount[typeKey] = (weeklyTypeCount[typeKey] || 0) + 1;
        return;
      }

      // Overdue undone mission from an earlier day in the week
      toRedistribute.push({
        mission: m,
        originalDayIdx: origIdx,
        originalOrder: idxOrder,
        typeKey,
      });
    });
  });

  // 2. Prioritize tighter daily-capped missions first, then major heists, keeping chronological order
  toRedistribute.sort((a, b) => {
    const ruleA = MISSION_REGULATION[a.typeKey];
    const ruleB = MISSION_REGULATION[b.typeKey];
    const capA = ruleA.dailyLimit === null ? 999 : ruleA.dailyLimit;
    const capB = ruleB.dailyLimit === null ? 999 : ruleB.dailyLimit;
    if (capA !== capB) return capA - capB;
    if (a.mission.major !== b.mission.major) return a.mission.major ? -1 : 1;
    return a.originalOrder - b.originalOrder;
  });

  // 3. Assign each overdue mission across [targetStartIdx .. 6] following daily & weekly rules
  toRedistribute.forEach(({ mission, typeKey }) => {
    const rule = MISSION_REGULATION[typeKey];
    const usedWeekly = weeklyTypeCount[typeKey] || 0;
    if (usedWeekly >= rule.weeklyLimit) {
      nextUnplacedIds.push(mission.id);
      return;
    }

    const candidates: number[] = [];
    for (let dIdx = targetStartIdx; dIdx < DAY_NAMES.length; dIdx++) {
      const usedToday = typeCountOnDay[dIdx][typeKey] || 0;
      if (rule.dailyLimit === null || usedToday < rule.dailyLimit) {
        candidates.push(dIdx);
      }
    }

    if (candidates.length === 0) {
      nextUnplacedIds.push(mission.id);
      return;
    }

    candidates.sort((dA, dB) => {
      if (mission.major) {
        const majDiff = majorCountOnDay[dA] - majorCountOnDay[dB];
        if (majDiff !== 0) return majDiff;
        const typeDiff =
          (typeCountOnDay[dA][typeKey] || 0) - (typeCountOnDay[dB][typeKey] || 0);
        if (typeDiff !== 0) return typeDiff;
        const totalDiff = totalCountOnDay[dA] - totalCountOnDay[dB];
        if (totalDiff !== 0) return totalDiff;
        return dA - dB;
      }

      const typeDiff =
        (typeCountOnDay[dA][typeKey] || 0) - (typeCountOnDay[dB][typeKey] || 0);
      if (typeDiff !== 0) return typeDiff;
      const totalDiff = totalCountOnDay[dA] - totalCountOnDay[dB];
      if (totalDiff !== 0) return totalDiff;
      return dA - dB;
    });

    const bestIdx = candidates[0];
    const targetDayName = DAY_NAMES[bestIdx];
    nextOverrides[mission.id] = targetDayName;
    typeCountOnDay[bestIdx][typeKey] = (typeCountOnDay[bestIdx][typeKey] || 0) + 1;
    totalCountOnDay[bestIdx]++;
    if (mission.major) majorCountOnDay[bestIdx]++;
    weeklyTypeCount[typeKey] = usedWeekly + 1;
  });

  const nextDate = localIsoDate(now);
  const changed =
    !mapsEqual(nextOverrides, prevOverrides) ||
    !arraysEqual(nextUnplacedIds, currentMeta?.unplacedMissionIds || []);

  return {
    meta: {
      scheduleOverrides: nextOverrides,
      unplacedMissionIds: nextUnplacedIds,
      lastRecalcDate: nextDate,
      lastRecalcAt: now.toISOString(),
    },
    movedCount: Object.keys(nextOverrides).length,
    unplacedCount: nextUnplacedIds.length,
    changed,
  };
}
