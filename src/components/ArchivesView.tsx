import React, { useMemo, useState } from 'react';
import {
  Archive,
  ArrowLeftRight,
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  Download,
  FileText,
  GitCompareArrows,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type {
  CatalogGroupsMap,
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
  WeeklyArchiveRecord,
} from '@/src/types/cartel';
import {
  buildArchiveComparisonDiscordReport,
  buildArchiveCsvContent,
  buildArchivedWeekDiscordReport,
  buildComparisonCsvContent,
  buildLiveWeekAsArchivePreview,
  compareWeeklyArchives,
  formatMoney,
  formatSigned,
  getArchiveActiveMembersCount,
  getArchiveHeistsStats,
  getArchiveSuccessRate,
  netClass,
} from '@/src/utils/finance';

interface ArchivesViewProps {
  missionStates: MissionStates;
  scheduleMeta: MissionScheduleMeta;
  members: HierarchyMember[];
  memberRankings: MemberRankingsMap;
  weaponsLossAmount: number;
  inventoryStock: InventoryStock;
  inventoryPrices: InventoryPrices;
  weaponsStock: WeaponsStock;
  rewardStocks: RewardStocks;
  catalogGroups: CatalogGroupsMap;
  treasuryMoney: TreasuryMoney;
  historyState: HistoryState;
  readonly: boolean;
  onArchiveCurrentWeek: (notes?: string) => void;
  onUpdateArchiveNotes: (archiveId: string, notes: string) => void;
  onToggleArchivedMemberPaid: (archiveId: string, memberId: string) => void;
  onSettleArchivedPayroll: (
    archiveId: string,
    debitAccount: 'none' | 'legal' | 'illegal'
  ) => void;
  onCancelArchivedPayrollSettlement: (archiveId: string) => void;
  onDeleteWeekArchive: (archiveId: string) => void;
  onOpenPayrollTab: () => void;
  onShowToast: (msg: string) => void;
}

type ArchiveViewMode = 'manager' | 'comparator';
type ArchiveFilterKey = 'all' | 'settled' | 'pending' | 'positive' | 'negative';
type ArchiveSortKey = 'recent' | 'profit_desc' | 'missions_desc';

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
}

function downloadCsvFile(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatArchiveDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDeltaPct(pct: number | null): string {
  if (pct === null) return 'Nouveau';
  return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

function deltaPolarityClass(delta: number, invertPolarity = false): string {
  if (delta === 0) return 'text-zinc-400';
  const favorable = invertPolarity ? delta < 0 : delta > 0;
  return favorable ? 'text-emerald-400' : 'text-crimson-light';
}

export const ArchivesView: React.FC<ArchivesViewProps> = ({
  missionStates,
  scheduleMeta,
  members,
  memberRankings,
  weaponsLossAmount,
  inventoryStock,
  inventoryPrices,
  weaponsStock,
  rewardStocks,
  catalogGroups,
  treasuryMoney,
  historyState,
  readonly,
  onArchiveCurrentWeek,
  onUpdateArchiveNotes,
  onToggleArchivedMemberPaid,
  onSettleArchivedPayroll,
  onCancelArchivedPayrollSettlement,
  onDeleteWeekArchive,
  onOpenPayrollTab,
  onShowToast,
}) => {
  const [mode, setMode] = useState<ArchiveViewMode>('manager');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterKey, setFilterKey] = useState<ArchiveFilterKey>('all');
  const [sortKey, setSortKey] = useState<ArchiveSortKey>('recent');
  const [selectedArchiveId, setSelectedArchiveId] = useState<string>('');
  const [showArchiveMissions, setShowArchiveMissions] = useState(false);
  const [confirmDeleteArchiveId, setConfirmDeleteArchiveId] = useState<string | null>(null);
  const [archiveDebitAccount, setArchiveDebitAccount] = useState<'none' | 'legal' | 'illegal'>(
    'illegal'
  );
  const [noteDraftByArchive, setNoteDraftByArchive] = useState<Record<string, string>>({});

  // Comparator selections ('__live__' or archive id)
  const [compareIdA, setCompareIdA] = useState<string>('');
  const [compareIdB, setCompareIdB] = useState<string>('');

  const sortedArchives = useMemo<WeeklyArchiveRecord[]>(() => {
    return Object.values(historyState.archives || {}).sort(
      (a, b) =>
        b.week.localeCompare(a.week) ||
        b.archivedAt.localeCompare(a.archivedAt) ||
        b.id.localeCompare(a.id)
    );
  }, [historyState.archives]);

  const livePreviewArchive = useMemo(
    () =>
      buildLiveWeekAsArchivePreview({
        missionStates,
        scheduleMeta,
        weaponsLossAmount,
        members,
        inventoryPrices,
        catalogGroups,
        currentPayroll: historyState.currentPayroll,
        treasuryMoney,
        rewardStocks,
        inventoryStock,
        weaponsStock,
        memberRankings,
      }),
    [
      missionStates,
      scheduleMeta,
      weaponsLossAmount,
      members,
      inventoryPrices,
      catalogGroups,
      historyState.currentPayroll,
      treasuryMoney,
      rewardStocks,
      inventoryStock,
      weaponsStock,
      memberRankings,
    ]
  );

  const filteredArchives = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = sortedArchives.filter((rec) => {
      if (filterKey === 'settled' && !rec.payroll.settled) return false;
      if (filterKey === 'pending' && rec.payroll.settled) return false;
      if (filterKey === 'positive' && rec.summary.netProfit <= 0) return false;
      if (filterKey === 'negative' && rec.summary.netProfit >= 0) return false;

      if (!q) return true;
      const haystack = [
        rec.label,
        rec.week,
        rec.archivedBy,
        rec.notes || '',
        rec.globalSnapshot?.mvpName || '',
        ...rec.payroll.rows.map((r) => r.memberName),
        ...rec.missions.map((m) => m.name),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });

    if (sortKey === 'profit_desc') {
      return [...list].sort((a, b) => b.summary.netProfit - a.summary.netProfit);
    }
    if (sortKey === 'missions_desc') {
      return [...list].sort(
        (a, b) =>
          b.summary.successCount +
          b.summary.failCount -
          (a.summary.successCount + a.summary.failCount)
      );
    }
    return list;
  }, [sortedArchives, searchQuery, filterKey, sortKey]);

  const activeArchive: WeeklyArchiveRecord | null = useMemo(() => {
    if (filteredArchives.length === 0) return sortedArchives[0] || null;
    if (selectedArchiveId) {
      const found = filteredArchives.find((a) => a.id === selectedArchiveId);
      if (found) return found;
    }
    return filteredArchives[0];
  }, [filteredArchives, sortedArchives, selectedArchiveId]);

  const globalAggregates = useMemo(() => {
    let netProfit = 0;
    let grossGains = 0;
    let cartelShare = 0;
    let payrollPool = 0;
    let totalOk = 0;
    let totalKo = 0;
    let totalHeistsOk = 0;

    sortedArchives.forEach((rec) => {
      netProfit += rec.summary.netProfit;
      grossGains += rec.summary.grossGains;
      cartelShare += Math.max(0, rec.payroll.cartelShareAmount);
      payrollPool += rec.payroll.payrollPoolAmount;
      totalOk += rec.summary.successCount;
      totalKo += rec.summary.failCount;
      totalHeistsOk += getArchiveHeistsStats(rec).heistsOk;
    });

    const totalDone = totalOk + totalKo;
    const avgSuccessRate = totalDone > 0 ? Math.round((totalOk / totalDone) * 1000) / 10 : 0;
    const latestWithWealth = sortedArchives.find((a) => a.globalSnapshot);

    return {
      weeks: sortedArchives.length,
      netProfit,
      grossGains,
      cartelShare,
      payrollPool,
      totalOk,
      totalKo,
      totalHeistsOk,
      avgSuccessRate,
      latestWealth: latestWithWealth?.globalSnapshot?.totalWealth ?? null,
    };
  }, [sortedArchives]);

  // Chronological bar chart data (up to last 10 archived weeks)
  const trendBars = useMemo(() => {
    const recent10 = sortedArchives.slice(0, 10).reverse();
    const maxAbs = recent10.reduce(
      (max, rec) =>
        Math.max(max, Math.abs(rec.summary.grossGains), Math.abs(rec.summary.netProfit)),
      1
    );
    return recent10.map((rec) => ({
      rec,
      grossPct: Math.min(100, Math.round((rec.summary.grossGains / maxAbs) * 100)),
      netPct: Math.min(100, Math.round((Math.abs(rec.summary.netProfit) / maxAbs) * 100)),
    }));
  }, [sortedArchives]);

  // Comparator resolution
  const comparatorOptions = useMemo(() => {
    return [
      { id: '__live__', label: `${livePreviewArchive.label}`, record: livePreviewArchive },
      ...sortedArchives.map((rec) => ({
        id: rec.id,
        label: `${rec.label} (${formatSigned(rec.summary.netProfit)})`,
        record: rec,
      })),
    ];
  }, [livePreviewArchive, sortedArchives]);

  const resolvedIdA = useMemo(() => {
    if (compareIdA && comparatorOptions.some((o) => o.id === compareIdA)) {
      return compareIdA;
    }
    if (sortedArchives.length >= 2) return sortedArchives[1].id;
    if (sortedArchives.length === 1) return sortedArchives[0].id;
    return '__live__';
  }, [compareIdA, comparatorOptions, sortedArchives]);

  const resolvedIdB = useMemo(() => {
    if (compareIdB && comparatorOptions.some((o) => o.id === compareIdB)) {
      return compareIdB;
    }
    if (sortedArchives.length >= 1) return sortedArchives[0].id;
    return '__live__';
  }, [compareIdB, comparatorOptions, sortedArchives]);

  const weekA = useMemo(
    () =>
      comparatorOptions.find((o) => o.id === resolvedIdA)?.record || livePreviewArchive,
    [comparatorOptions, resolvedIdA, livePreviewArchive]
  );

  const weekB = useMemo(
    () =>
      comparatorOptions.find((o) => o.id === resolvedIdB)?.record || livePreviewArchive,
    [comparatorOptions, resolvedIdB, livePreviewArchive]
  );

  const comparison = useMemo(
    () => compareWeeklyArchives(weekA, weekB),
    [weekA, weekB]
  );

  const activeNoteValue = activeArchive
    ? noteDraftByArchive[activeArchive.id] ?? activeArchive.notes ?? ''
    : '';
  const isNoteDirty = activeArchive
    ? activeNoteValue.trim() !== (activeArchive.notes || '').trim()
    : false;

  const handleSaveNote = () => {
    if (readonly || !activeArchive) return;
    onUpdateArchiveNotes(activeArchive.id, activeNoteValue);
  };

  const handleLaunchCompareForArchive = (archiveId: string) => {
    setCompareIdA(archiveId);
    const otherArchive = sortedArchives.find((a) => a.id !== archiveId);
    setCompareIdB(otherArchive ? otherArchive.id : '__live__');
    setMode('comparator');
  };

  const handleApplyPreset = (preset: 'last_two' | 'live_vs_last' | 'best_vs_worst') => {
    if (preset === 'last_two' && sortedArchives.length >= 2) {
      setCompareIdA(sortedArchives[1].id);
      setCompareIdB(sortedArchives[0].id);
    } else if (preset === 'live_vs_last' && sortedArchives.length >= 1) {
      setCompareIdA(sortedArchives[0].id);
      setCompareIdB('__live__');
    } else if (preset === 'best_vs_worst' && sortedArchives.length >= 2) {
      const byProfit = [...sortedArchives].sort(
        (a, b) => b.summary.netProfit - a.summary.netProfit
      );
      setCompareIdA(byProfit[byProfit.length - 1].id);
      setCompareIdB(byProfit[0].id);
    }
  };

  const handleCopyArchiveReport = async (archive: WeeklyArchiveRecord) => {
    const ok = await copyTextToClipboard(buildArchivedWeekDiscordReport(archive));
    onShowToast(
      ok
        ? 'Résumé global archivé copié pour Discord !'
        : 'Impossible de copier le bilan archivé.'
    );
  };

  const handleCopyComparison = async () => {
    const text = buildArchiveComparisonDiscordReport(weekA, weekB, comparison);
    const ok = await copyTextToClipboard(text);
    onShowToast(
      ok
        ? 'Comparatif hebdomadaire copié pour Discord !'
        : 'Impossible de copier le comparatif.'
    );
  };

  const handleExportAllCsv = () => {
    if (sortedArchives.length === 0) return;
    const csv = buildArchiveCsvContent(sortedArchives);
    downloadCsvFile(`los_cerberos_archives_${new Date().toISOString().slice(0, 10)}.csv`, csv);
    onShowToast('Export CSV des archives téléchargé !');
  };

  const handleExportComparisonCsv = () => {
    const csv = buildComparisonCsvContent(weekA, weekB, comparison);
    downloadCsvFile(
      `los_cerberos_comparatif_${weekA.week}_vs_${weekB.week}.csv`,
      csv
    );
    onShowToast('Export CSV du comparatif téléchargé !');
  };

  const activeHeists = activeArchive ? getArchiveHeistsStats(activeArchive) : { heistsOk: 0, heistsTotal: 0 };
  const activeSuccessRate = activeArchive ? getArchiveSuccessRate(activeArchive) : 0;
  const activeMembers = activeArchive ? getArchiveActiveMembersCount(activeArchive) : 0;

  return (
    <div className="space-y-6">
      {/* EN-TÊTE SPÉCIAL ARCHIVES GLOBALES & COMPARATEUR */}
      <section className="bg-charcoal/95 gold-border rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-gold-light block">
              Mémoire Opérationnelle &amp; Analyse Multi-Semaines
            </span>
            <h2 className="font-display text-xl sm:text-2xl font-extrabold text-white mt-0.5 flex items-center gap-2.5 text-balance">
              <Archive className="w-6 h-6 text-gold shrink-0" />
              Archives Globales &amp; Comparateur de Semaines
            </h2>
            <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
              Chaque semaine archivée enregistre le bilan complet d&apos;activité du cartel (opérations, trésorerie, stock, arsenal, paye du dimanche et notes) afin de gérer et comparer vos performances dans le temps.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1 bg-obsidian/90 border border-bronze/45 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setMode('manager')}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                  mode === 'manager'
                    ? 'bg-gold text-obsidian shadow-md'
                    : 'text-zinc-300 hover:text-white hover:bg-charcoal/70'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Gestionnaire ({sortedArchives.length})
              </button>
              <button
                type="button"
                onClick={() => setMode('comparator')}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                  mode === 'comparator'
                    ? 'bg-gold text-obsidian shadow-md'
                    : 'text-zinc-300 hover:text-white hover:bg-charcoal/70'
                }`}
              >
                <GitCompareArrows className="w-3.5 h-3.5" />
                Comparateur
              </button>
            </div>

            {sortedArchives.length > 0 && (
              <button
                type="button"
                onClick={handleExportAllCsv}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-obsidian hover:bg-slateDark text-zinc-200 border border-zinc-700 hover:border-gold/50 transition inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5 text-gold" />
                Export CSV
              </button>
            )}

            {!readonly && (
              <button
                type="button"
                onClick={() => onArchiveCurrentWeek()}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition inline-flex items-center gap-1.5 shadow-md cursor-pointer whitespace-nowrap shrink-0"
              >
                <Archive className="w-3.5 h-3.5" />
                Archiver semaine actuelle
              </button>
            )}
          </div>
        </div>

        {/* SYNTHÈSE CUMULÉE MULTI-SEMAINES */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-4 border-t border-zinc-800">
          <div className="rounded-xl bg-obsidian/75 border border-zinc-800 p-3.5">
            <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
              Semaines Archivées
            </div>
            <div className="font-display text-lg font-extrabold text-white tabular-nums mt-1">
              {globalAggregates.weeks}
            </div>
            <div className="text-[10px] font-mono text-zinc-500 tabular-nums mt-0.5">
              {globalAggregates.totalHeistsOk} Gros Coup{globalAggregates.totalHeistsOk > 1 ? 's' : ''} OK
            </div>
          </div>

          <div className="rounded-xl bg-obsidian/75 border border-zinc-800 p-3.5">
            <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
              Bénéfice Net Cumulé
            </div>
            <div
              className={`font-display text-lg font-extrabold tabular-nums mt-1 ${netClass(
                globalAggregates.netProfit
              )}`}
            >
              {formatSigned(globalAggregates.netProfit)}
            </div>
            <div className="text-[10px] font-mono text-zinc-500 tabular-nums mt-0.5">
              Brut : {formatMoney(globalAggregates.grossGains)}
            </div>
          </div>

          <div className="rounded-xl bg-obsidian/75 border border-gold/40 p-3.5">
            <div className="text-[10px] uppercase tracking-wider text-gold-light font-semibold">
              Part Cartel Cumulée
            </div>
            <div className="font-display text-lg font-extrabold text-gold tabular-nums mt-1">
              {formatMoney(globalAggregates.cartelShare)}
            </div>
            <div className="text-[10px] font-mono text-zinc-500 mt-0.5">Trésorerie cartel</div>
          </div>

          <div className="rounded-xl bg-obsidian/75 border border-emerald-500/35 p-3.5">
            <div className="text-[10px] uppercase tracking-wider text-emerald-300 font-semibold">
              Payes Cumulées
            </div>
            <div className="font-display text-lg font-extrabold text-emerald-400 tabular-nums mt-1">
              {formatMoney(globalAggregates.payrollPool)}
            </div>
            <div className="text-[10px] font-mono text-zinc-500 mt-0.5">Distribué membres</div>
          </div>

          <div className="rounded-xl bg-obsidian/75 border border-zinc-800 p-3.5">
            <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
              Réussite Moyenne
            </div>
            <div className="font-display text-lg font-extrabold text-white tabular-nums mt-1">
              {globalAggregates.avgSuccessRate.toFixed(1)}%
            </div>
            <div className="text-[10px] font-mono text-zinc-500 tabular-nums mt-0.5">
              {globalAggregates.totalOk}✓ / {globalAggregates.totalKo}✗
            </div>
          </div>

          <div className="rounded-xl bg-obsidian/75 border border-zinc-800 p-3.5">
            <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
              Dernier Patrimoine
            </div>
            <div className="font-display text-lg font-extrabold text-gold tabular-nums mt-1">
              {globalAggregates.latestWealth !== null
                ? formatMoney(globalAggregates.latestWealth)
                : '—'}
            </div>
            <div className="text-[10px] font-mono text-zinc-500 mt-0.5">Snapshot global</div>
          </div>
        </div>

        {/* COURBE / BARRES D'ÉVOLUTION MULTI-SEMAINES */}
        {trendBars.length >= 2 && (
          <div className="pt-4 border-t border-zinc-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <BarChart3 className="w-4 h-4 text-gold" />
                Évolution des {trendBars.length} dernières semaines archivées
              </div>
              <div className="flex items-center gap-4 text-[11px] font-mono text-zinc-400">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-gold/80 inline-block" />
                  Gains Bruts
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" />
                  Bénéfice Net
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2 items-end">
              {trendBars.map(({ rec, grossPct, netPct }) => {
                const isSelected = activeArchive?.id === rec.id && mode === 'manager';
                return (
                  <button
                    key={rec.id}
                    type="button"
                    onClick={() => {
                      setSelectedArchiveId(rec.id);
                      setMode('manager');
                    }}
                    title={`${rec.label} · Net ${formatSigned(rec.summary.netProfit)}`}
                    className={`rounded-lg p-2 border text-left transition cursor-pointer ${
                      isSelected
                        ? 'bg-obsidian border-gold'
                        : 'bg-obsidian/60 border-zinc-800 hover:border-gold/45'
                    }`}
                  >
                    <div className="h-16 flex items-end justify-center gap-1.5 px-1">
                      <div
                        className="w-3 rounded-t bg-gold/75 transition-all"
                        style={{ height: `${Math.max(6, grossPct)}%` }}
                      />
                      <div
                        className={`w-3 rounded-t transition-all ${
                          rec.summary.netProfit >= 0 ? 'bg-emerald-400' : 'bg-crimson-light'
                        }`}
                        style={{ height: `${Math.max(6, netPct)}%` }}
                      />
                    </div>
                    <div className="mt-2 pt-1.5 border-t border-zinc-800/80 text-center">
                      <div className="text-[10px] font-mono text-zinc-400 truncate">
                        {rec.week.slice(5)}
                      </div>
                      <div
                        className={`text-[10px] font-mono font-bold tabular-nums truncate ${netClass(
                          rec.summary.netProfit
                        )}`}
                      >
                        {formatSigned(rec.summary.netProfit)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* MODE 1 : GESTIONNAIRE D'ARCHIVES GLOBALES */}
      {mode === 'manager' && (
        <div className="space-y-5">
          {sortedArchives.length === 0 ? (
            <div className="bg-charcoal/95 bronze-border rounded-2xl p-10 text-center space-y-4 shadow-xl">
              <Archive className="w-10 h-10 text-gold/75 mx-auto" />
              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="font-display text-lg font-bold text-white">
                  Aucune semaine archivée pour le moment
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Archivez la semaine en cours pour enregistrer un résumé global complet (missions, gains, pertes, trésorerie, arsenal, recel et paye) et commencer à comparer vos semaines.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                {!readonly && (
                  <button
                    type="button"
                    onClick={() => onArchiveCurrentWeek()}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold bg-gold hover:bg-gold-light text-obsidian transition inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Archive className="w-4 h-4" />
                    Archiver la semaine actuelle
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setMode('comparator')}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-obsidian hover:bg-slateDark text-zinc-200 border border-zinc-700 transition inline-flex items-center gap-2 cursor-pointer"
                >
                  <GitCompareArrows className="w-4 h-4 text-gold" />
                  Voir l&apos;aperçu de la semaine en cours
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* COLONNE GAUCHE : FILTRES & LISTE DES ARCHIVES */}
              <div className="lg:col-span-4 bg-charcoal/95 bronze-border rounded-2xl p-4 space-y-3 shadow-xl">
                <div className="flex items-center justify-between pb-2.5 border-b border-zinc-800">
                  <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gold" />
                    Gestionnaire des Semaines
                  </h3>
                  <span className="text-[11px] font-mono text-zinc-400 tabular-nums">
                    {filteredArchives.length} / {sortedArchives.length}
                  </span>
                </div>

                {/* Recherche + Filtre + Tri */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Filtrer (date, note, MVP, membre...)"
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-gold rounded-xl pl-8 pr-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={filterKey}
                      onChange={(e) => setFilterKey(e.target.value as ArchiveFilterKey)}
                      className="bg-zinc-950 border border-zinc-800 focus:border-gold rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-300 focus:outline-none"
                    >
                      <option value="all">Toutes les semaines</option>
                      <option value="settled">Paye validée</option>
                      <option value="pending">Paye en attente</option>
                      <option value="positive">Bénéfice positif</option>
                      <option value="negative">Déficitaire</option>
                    </select>
                    <select
                      value={sortKey}
                      onChange={(e) => setSortKey(e.target.value as ArchiveSortKey)}
                      className="bg-zinc-950 border border-zinc-800 focus:border-gold rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-300 focus:outline-none"
                    >
                      <option value="recent">Plus récentes</option>
                      <option value="profit_desc">Meilleur bénéfice</option>
                      <option value="missions_desc">Plus d&apos;opérations</option>
                    </select>
                  </div>
                </div>

                {/* Liste */}
                <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
                  {filteredArchives.length === 0 ? (
                    <div className="py-8 text-center text-xs text-zinc-500">
                      Aucune archive ne correspond à ce filtre.
                    </div>
                  ) : (
                    filteredArchives.map((rec) => {
                      const isSelected = activeArchive?.id === rec.id;
                      const eligibleCount = rec.payroll.rows.filter(
                        (r) => r.payrollAmount > 0
                      ).length;
                      const paidCount = rec.payroll.rows.filter(
                        (r) => r.payrollAmount > 0 && r.paid
                      ).length;
                      const rate = getArchiveSuccessRate(rec);

                      return (
                        <button
                          key={rec.id}
                          type="button"
                          onClick={() => {
                            setSelectedArchiveId(rec.id);
                            setConfirmDeleteArchiveId(null);
                            setShowArchiveMissions(false);
                          }}
                          className={`w-full text-left rounded-xl p-3 border transition cursor-pointer space-y-1.5 ${
                            isSelected
                              ? 'bg-obsidian border-gold shadow-md'
                              : 'bg-obsidian/60 border-zinc-800 hover:border-gold/45'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-display text-xs font-extrabold text-white truncate">
                              {rec.label}
                            </span>
                            <span
                              className={`font-mono text-xs font-bold tabular-nums shrink-0 ${netClass(
                                rec.summary.netProfit
                              )}`}
                            >
                              {formatSigned(rec.summary.netProfit)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-zinc-400">
                            <span>
                              {rec.summary.successCount}✓ / {rec.summary.failCount}✗ ({rate.toFixed(0)}%)
                            </span>
                            <span
                              className={
                                rec.payroll.settled
                                  ? 'text-emerald-400 font-semibold'
                                  : eligibleCount > 0
                                    ? 'text-amber-300'
                                    : 'text-zinc-500'
                              }
                            >
                              {rec.payroll.settled
                                ? `Payé (${paidCount}/${eligibleCount})`
                                : eligibleCount > 0
                                  ? `Paie ${formatMoney(rec.payroll.payrollPoolAmount)}`
                                  : 'Sans paie'}
                            </span>
                          </div>

                          {(rec.globalSnapshot || rec.notes) && (
                            <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-800/70 text-[10px] text-zinc-500">
                              <span className="truncate">
                                {rec.notes ? `Note : ${rec.notes}` : `MVP : ${rec.globalSnapshot?.mvpName || '—'}`}
                              </span>
                              {rec.globalSnapshot && (
                                <span className="font-mono text-gold/90 tabular-nums shrink-0">
                                  {formatMoney(rec.globalSnapshot.totalWealth)}
                                </span>
                              )}
                            </div>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* COLONNE DROITE : DOSSIER GLOBAL DE LA SEMAINE */}
              {activeArchive && (
                <div className="lg:col-span-8 bg-charcoal/95 gold-border rounded-2xl p-5 sm:p-6 space-y-6 shadow-xl">
                  {/* En-tête dossier */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-zinc-800">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-gold-light block">
                        Dossier Global · Semaine du {activeArchive.week}
                      </span>
                      <h3 className="font-display text-xl font-extrabold text-white mt-0.5">
                        Semaine {activeArchive.label}
                      </h3>
                      <p className="text-[11px] text-zinc-400 mt-1">
                        Archivée le {formatArchiveDate(activeArchive.archivedAt)}
                        {activeArchive.archivedBy ? ` par ${activeArchive.archivedBy}` : ''}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleLaunchCompareForArchive(activeArchive.id)}
                        className="px-3 py-2 rounded-xl text-xs font-bold bg-obsidian hover:bg-slateDark text-gold-light border border-gold/45 hover:border-gold transition inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <GitCompareArrows className="w-3.5 h-3.5" />
                        Comparer
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopyArchiveReport(activeArchive)}
                        className="px-3 py-2 rounded-xl text-xs font-bold bg-gold hover:bg-gold-light text-obsidian transition inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <ClipboardCopy className="w-3.5 h-3.5" />
                        Copier Bilan
                      </button>

                      {!readonly &&
                        (confirmDeleteArchiveId === activeArchive.id ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteWeekArchive(activeArchive.id);
                                setConfirmDeleteArchiveId(null);
                              }}
                              className="px-3 py-2 rounded-xl text-xs font-bold bg-crimson hover:bg-crimson-light text-white transition cursor-pointer"
                            >
                              Confirmer
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteArchiveId(null)}
                              className="px-2.5 py-2 rounded-xl text-xs font-semibold bg-zinc-800 text-zinc-300 hover:text-white transition cursor-pointer"
                            >
                              Annuler
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteArchiveId(activeArchive.id)}
                            className="px-3 py-2 rounded-xl text-xs font-semibold bg-obsidian hover:bg-crimson/30 text-zinc-400 hover:text-red-200 border border-zinc-800 hover:border-crimson-light/40 transition inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Supprimer
                          </button>
                        ))}
                    </div>
                  </div>

                  {/* Résumé Opérationnel & Financier */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl bg-obsidian/80 border border-zinc-800 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-zinc-400">
                        Opérations &amp; Taux
                      </div>
                      <div className="font-mono text-base font-extrabold text-white tabular-nums mt-0.5">
                        <span className="text-emerald-400">
                          {activeArchive.summary.successCount}✓
                        </span>{' '}
                        <span className="text-zinc-600">/</span>{' '}
                        <span className="text-red-400">{activeArchive.summary.failCount}✗</span>
                      </div>
                      <div className="text-[10px] font-mono text-zinc-500 tabular-nums mt-0.5">
                        {activeSuccessRate.toFixed(1)}% réussite · {activeHeists.heistsOk} Gros Coup{activeHeists.heistsOk > 1 ? 's' : ''}
                      </div>
                    </div>

                    <div className="rounded-xl bg-obsidian/80 border border-zinc-800 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-zinc-400">
                        Gains Bruts
                      </div>
                      <div className="font-mono text-base font-extrabold text-emerald-400 tabular-nums mt-0.5">
                        {formatMoney(activeArchive.summary.grossGains)}
                      </div>
                      <div className="text-[10px] font-mono text-zinc-500 tabular-nums mt-0.5">
                        {activeMembers} membre{activeMembers > 1 ? 's' : ''} actif{activeMembers > 1 ? 's' : ''}
                      </div>
                    </div>

                    <div className="rounded-xl bg-obsidian/80 border border-zinc-800 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-zinc-400">
                        Matériel &amp; Pertes
                      </div>
                      <div className="font-mono text-base font-extrabold text-amber-300 tabular-nums mt-0.5">
                        -
                        {formatMoney(
                          activeArchive.summary.materialCost +
                            activeArchive.summary.missionLoss +
                            activeArchive.summary.weaponsLossAmount
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-zinc-500 tabular-nums mt-0.5">
                        Mat. {formatMoney(activeArchive.summary.materialCost)} · Pertes {formatMoney(activeArchive.summary.missionLoss + activeArchive.summary.weaponsLossAmount)}
                      </div>
                    </div>

                    <div className="rounded-xl bg-obsidian/80 border border-gold/40 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-gold-light">
                        Bénéfice Net
                      </div>
                      <div
                        className={`font-mono text-base font-extrabold tabular-nums mt-0.5 ${netClass(
                          activeArchive.summary.netProfit
                        )}`}
                      >
                        {formatSigned(activeArchive.summary.netProfit)}
                      </div>
                      <div className="text-[10px] font-mono text-zinc-500 tabular-nums mt-0.5">
                        Cartel {formatMoney(Math.max(0, activeArchive.payroll.cartelShareAmount))}
                      </div>
                    </div>
                  </div>

                  {/* Snapshot Patrimoine & Activité Globale */}
                  <div className="border-t border-zinc-800 pt-5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="font-display text-sm font-bold text-white">
                        État Global du Cartel au moment de l&apos;archive
                      </h4>
                      {activeArchive.globalSnapshot &&
                        activeArchive.globalSnapshot.mvpName !== '—' && (
                          <span className="text-xs font-mono text-gold-light tabular-nums">
                            MVP Semaine : <strong>{activeArchive.globalSnapshot.mvpName}</strong> ({activeArchive.globalSnapshot.mvpPoints} pts)
                          </span>
                        )}
                    </div>

                    {activeArchive.globalSnapshot ? (
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                        <div className="rounded-lg bg-obsidian/65 border border-gold/35 px-3 py-2.5">
                          <div className="text-[10px] uppercase tracking-wider text-gold-light">
                            Patrimoine Total
                          </div>
                          <div className="font-mono font-extrabold text-gold text-sm tabular-nums mt-0.5">
                            {formatMoney(activeArchive.globalSnapshot.totalWealth)}
                          </div>
                        </div>
                        <div className="rounded-lg bg-obsidian/65 border border-zinc-800 px-3 py-2.5">
                          <div className="text-[10px] uppercase tracking-wider text-zinc-400">
                            Trésorerie Cash
                          </div>
                          <div className="font-mono font-bold text-white tabular-nums mt-0.5">
                            {formatMoney(activeArchive.globalSnapshot.treasuryTotal)}
                          </div>
                          <div className="text-[10px] font-mono text-zinc-500 tabular-nums">
                            Sale {formatMoney(activeArchive.globalSnapshot.treasuryIllegal)}
                          </div>
                        </div>
                        <div className="rounded-lg bg-obsidian/65 border border-zinc-800 px-3 py-2.5">
                          <div className="text-[10px] uppercase tracking-wider text-zinc-400">
                            Objets Recel
                          </div>
                          <div className="font-mono font-bold text-white tabular-nums mt-0.5">
                            {formatMoney(activeArchive.globalSnapshot.rewardsValue)}
                          </div>
                          <div className="text-[10px] font-mono text-zinc-500 tabular-nums">
                            {activeArchive.globalSnapshot.rewardsCount} objet{activeArchive.globalSnapshot.rewardsCount > 1 ? 's' : ''}
                          </div>
                        </div>
                        <div className="rounded-lg bg-obsidian/65 border border-zinc-800 px-3 py-2.5">
                          <div className="text-[10px] uppercase tracking-wider text-zinc-400">
                            Stock Inventaire
                          </div>
                          <div className="font-mono font-bold text-white tabular-nums mt-0.5">
                            {formatMoney(activeArchive.globalSnapshot.inventoryValue)}
                          </div>
                        </div>
                        <div className="rounded-lg bg-obsidian/65 border border-zinc-800 px-3 py-2.5">
                          <div className="text-[10px] uppercase tracking-wider text-zinc-400">
                            Arsenal
                          </div>
                          <div className="font-mono font-bold text-white tabular-nums mt-0.5">
                            {formatMoney(activeArchive.globalSnapshot.weaponsValue)}
                          </div>
                          <div className="text-[10px] font-mono text-zinc-500 tabular-nums">
                            {activeArchive.globalSnapshot.weaponsCount} arme{activeArchive.globalSnapshot.weaponsCount > 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500 italic">
                        Archive enregistrée avant l&apos;activation du snapshot global de patrimoine (données missions, journalières et paye complètes disponibles ci-dessous).
                      </p>
                    )}
                  </div>

                  {/* Note de synthèse éditable */}
                  <div className="border-t border-zinc-800 pt-5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="archive-activity-note"
                        className="font-display text-sm font-bold text-white"
                      >
                        Résumé &amp; Note d&apos;Activité de la Semaine
                      </label>
                      {!readonly && isNoteDirty && (
                        <button
                          type="button"
                          onClick={handleSaveNote}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-gold hover:bg-gold-light text-obsidian transition inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Save className="w-3 h-3" />
                          Enregistrer la note
                        </button>
                      )}
                    </div>
                    <textarea
                      id="archive-activity-note"
                      rows={2}
                      maxLength={500}
                      disabled={readonly}
                      value={activeNoteValue}
                      onChange={(e) =>
                        setNoteDraftByArchive((prev) => ({
                          ...prev,
                          [activeArchive.id]: e.target.value,
                        }))
                      }
                      placeholder={
                        readonly
                          ? 'Aucune note enregistrée pour cette semaine.'
                          : 'Ex : Semaine très active sur les Fleeca, stock de gilets reconstitué dimanche soir...'
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-gold rounded-xl px-3.5 py-2.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none disabled:opacity-70"
                    />
                  </div>

                  {/* Détail journalier */}
                  <div className="border-t border-zinc-800 pt-5 space-y-2.5">
                    <h4 className="font-display text-sm font-bold text-white">
                      Activité Jour par Jour
                    </h4>
                    <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-obsidian/60">
                      <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                        <thead>
                          <tr className="border-b border-zinc-800 text-[10px] font-sans font-bold uppercase tracking-wider text-zinc-400">
                            <th className="py-2.5 px-3">Jour</th>
                            <th className="py-2.5 px-3 text-center">Missions</th>
                            <th className="py-2.5 px-3 text-right">Matériel</th>
                            <th className="py-2.5 px-3 text-right">Pertes</th>
                            <th className="py-2.5 px-3 text-right">Gains</th>
                            <th className="py-2.5 px-3 text-right">Net</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/60">
                          {activeArchive.dailyRows.map((d) => (
                            <tr key={d.day} className="hover:bg-zinc-800/30">
                              <td className="py-2 px-3 font-sans font-semibold text-white">
                                {d.day}{' '}
                                <span className="text-[10px] font-normal text-zinc-500">
                                  {d.dateLabel}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-center">
                                <span className="text-emerald-400">{d.ok}</span> /{' '}
                                <span className="text-red-400">{d.ko}</span>
                              </td>
                              <td className="py-2 px-3 text-right text-amber-300">
                                {formatMoney(d.cost)}
                              </td>
                              <td className="py-2 px-3 text-right text-red-400">
                                {formatMoney(d.extra)}
                              </td>
                              <td className="py-2 px-3 text-right text-emerald-400">
                                {formatMoney(d.gains)}
                              </td>
                              <td
                                className={`py-2 px-3 text-right font-bold ${netClass(d.net)}`}
                              >
                                {formatSigned(d.net)}
                              </td>
                            </tr>
                          ))}
                          {activeArchive.summary.weaponsLossAmount > 0 && (
                            <tr className="bg-red-950/15">
                              <td className="py-2 px-3 font-sans font-semibold text-red-300">
                                Pertes globales armes
                              </td>
                              <td className="py-2 px-3 text-center text-zinc-600">—</td>
                              <td className="py-2 px-3 text-right text-zinc-600">—</td>
                              <td className="py-2 px-3 text-right text-red-400">
                                {formatMoney(activeArchive.summary.weaponsLossAmount)}
                              </td>
                              <td className="py-2 px-3 text-right text-zinc-600">—</td>
                              <td className="py-2 px-3 text-right font-bold text-crimson-light">
                                {formatSigned(-activeArchive.summary.weaponsLossAmount)}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Paye du Dimanche Archivée */}
                  <div className="border-t border-zinc-800 pt-5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="font-display text-sm font-bold text-white">
                          Répartition Paye du Dimanche
                        </h4>
                        <p className="text-[11px] text-zinc-400 tabular-nums">
                          Part Cartel :{' '}
                          <strong className="text-gold">
                            {formatSigned(activeArchive.payroll.cartelShareAmount)}
                          </strong>{' '}
                          · Enveloppe Paie :{' '}
                          <strong className="text-emerald-400">
                            {formatMoney(activeArchive.payroll.payrollPoolAmount)}
                          </strong>
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={onOpenPayrollTab}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-obsidian hover:bg-slateDark text-zinc-300 border border-zinc-700 transition cursor-pointer"
                        >
                          Paye en direct →
                        </button>
                        {!readonly &&
                          (activeArchive.payroll.settled ? (
                            <button
                              type="button"
                              onClick={() =>
                                onCancelArchivedPayrollSettlement(activeArchive.id)
                              }
                              className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-crimson/25 hover:bg-crimson/45 text-red-200 border border-crimson-light/40 transition inline-flex items-center gap-1 cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Annuler validation
                            </button>
                          ) : (
                            activeArchive.payroll.payrollPoolAmount > 0 && (
                              <>
                                <select
                                  value={archiveDebitAccount}
                                  onChange={(e) =>
                                    setArchiveDebitAccount(
                                      e.target.value as 'none' | 'legal' | 'illegal'
                                    )
                                  }
                                  className="bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1.5 text-[11px] text-zinc-200 focus:outline-none"
                                >
                                  <option value="illegal">Débiter Argent Sale</option>
                                  <option value="legal">Débiter Argent Légal</option>
                                  <option value="none">Sans débit caisse</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onSettleArchivedPayroll(
                                      activeArchive.id,
                                      archiveDebitAccount
                                    )
                                  }
                                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <ShieldCheck className="w-3 h-3" />
                                  Valider Paye
                                </button>
                              </>
                            )
                          ))}
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-obsidian/60">
                      <table className="w-full text-left border-collapse text-xs tabular-nums">
                        <thead>
                          <tr className="border-b border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            <th className="py-2.5 px-3">Membre</th>
                            <th className="py-2.5 px-3 text-center">Missions</th>
                            <th className="py-2.5 px-3 text-right">Net Rapporté</th>
                            <th className="py-2.5 px-3 text-right text-emerald-400">Paie</th>
                            <th className="py-2.5 px-3 text-right">Statut</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/60">
                          {activeArchive.payroll.rows.filter(
                            (r) => r.payrollAmount > 0 || r.missionsOk + r.missionsKo > 0
                          ).length === 0 ? (
                            <tr>
                              <td
                                colSpan={5}
                                className="py-4 px-3 text-center text-zinc-500 text-xs"
                              >
                                Aucune participation enregistrée sur cette semaine.
                              </td>
                            </tr>
                          ) : (
                            activeArchive.payroll.rows
                              .filter(
                                (r) =>
                                  r.payrollAmount > 0 || r.missionsOk + r.missionsKo > 0
                              )
                              .map((r) => (
                                <tr key={r.memberId} className="hover:bg-zinc-800/30">
                                  <td className="py-2.5 px-3 font-semibold text-white">
                                    {r.memberName}
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-mono">
                                    <span className="text-emerald-400">{r.missionsOk}</span> /{' '}
                                    <span className="text-red-400">{r.missionsKo}</span>
                                  </td>
                                  <td
                                    className={`py-2.5 px-3 text-right font-mono font-bold ${netClass(
                                      r.netContribution
                                    )}`}
                                  >
                                    {formatSigned(r.netContribution)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                                    {formatMoney(r.payrollAmount)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right">
                                    {r.payrollAmount > 0 ? (
                                      <button
                                        type="button"
                                        disabled={readonly}
                                        onClick={() =>
                                          onToggleArchivedMemberPaid(
                                            activeArchive.id,
                                            r.memberId
                                          )
                                        }
                                        className={`px-2 py-1 rounded-md text-[11px] font-bold transition cursor-pointer disabled:cursor-not-allowed ${
                                          r.paid
                                            ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40'
                                            : 'bg-zinc-900 text-zinc-300 border border-zinc-700 hover:border-gold/50'
                                        }`}
                                      >
                                        {r.paid ? 'Payé ✓' : 'À payer'}
                                      </button>
                                    ) : (
                                      <span className="text-zinc-600">—</span>
                                    )}
                                  </td>
                                </tr>
                              ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Journal des missions exécutées */}
                  {activeArchive.missions.length > 0 && (
                    <div className="border-t border-zinc-800 pt-4">
                      <button
                        type="button"
                        onClick={() => setShowArchiveMissions((prev) => !prev)}
                        className="w-full flex items-center justify-between text-xs font-bold text-zinc-300 hover:text-white transition cursor-pointer"
                      >
                        <span>
                          Journal des opérations exécutées ({activeArchive.missions.length})
                        </span>
                        {showArchiveMissions ? (
                          <ChevronUp className="w-4 h-4 text-gold" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gold" />
                        )}
                      </button>

                      {showArchiveMissions && (
                        <div className="mt-3 space-y-1.5 max-h-64 overflow-y-auto pr-1">
                          {activeArchive.missions.map((m, idx) => (
                            <div
                              key={`${m.id}_${idx}`}
                              className="rounded-lg bg-obsidian/70 border border-zinc-800/80 px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs"
                            >
                              <div className="min-w-0">
                                <span
                                  className={`font-semibold ${
                                    m.status === 'success'
                                      ? 'text-emerald-300'
                                      : 'text-red-300'
                                  }`}
                                >
                                  {m.status === 'success' ? '✓' : '✗'} [{m.day}] {m.name}
                                </span>
                                {m.players.length > 0 && (
                                  <span className="text-[11px] text-zinc-400 block truncate">
                                    Équipe : {m.players.join(', ')}
                                  </span>
                                )}
                              </div>
                              <div className="font-mono tabular-nums shrink-0 text-right">
                                <span className="text-zinc-400 mr-2">
                                  Gain {formatMoney(m.gain)}
                                </span>
                                <span className={`font-bold ${netClass(m.net)}`}>
                                  {formatSigned(m.net)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODE 2 : COMPARATEUR DE SEMAINES */}
      {mode === 'comparator' && (
        <div className="space-y-5">
          {/* Barre de sélection A vs B + Préréglages */}
          <div className="bg-charcoal/95 bronze-border rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-end gap-3">
              <div className="flex-1 min-w-0 space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block">
                  Semaine A (Référence)
                </label>
                <select
                  value={resolvedIdA}
                  onChange={(e) => setCompareIdA(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 focus:border-gold rounded-xl px-3 py-2.5 text-xs font-semibold text-white focus:outline-none"
                >
                  {comparatorOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => {
                  setCompareIdA(resolvedIdB);
                  setCompareIdB(resolvedIdA);
                }}
                title="Inverser Semaine A et Semaine B"
                className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-obsidian hover:bg-slateDark text-gold-light border border-gold/40 transition inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                Inverser
              </button>

              <div className="flex-1 min-w-0 space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-gold-light block">
                  Semaine B (Comparée)
                </label>
                <select
                  value={resolvedIdB}
                  onChange={(e) => setCompareIdB(e.target.value)}
                  className="w-full bg-zinc-950 border border-gold/50 focus:border-gold rounded-xl px-3 py-2.5 text-xs font-semibold text-white focus:outline-none"
                >
                  {comparatorOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-zinc-800">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="text-zinc-500 font-semibold">Raccourcis :</span>
                {sortedArchives.length >= 2 && (
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('last_two')}
                    className="px-2.5 py-1 rounded-lg bg-obsidian hover:bg-slateDark text-zinc-200 border border-zinc-800 hover:border-gold/45 transition cursor-pointer"
                  >
                    Dernière vs Avant-dernière
                  </button>
                )}
                {sortedArchives.length >= 1 && (
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('live_vs_last')}
                    className="px-2.5 py-1 rounded-lg bg-obsidian hover:bg-slateDark text-zinc-200 border border-zinc-800 hover:border-gold/45 transition cursor-pointer"
                  >
                    En cours vs Dernière archive
                  </button>
                )}
                {sortedArchives.length >= 2 && (
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('best_vs_worst')}
                    className="px-2.5 py-1 rounded-lg bg-obsidian hover:bg-slateDark text-zinc-200 border border-zinc-800 hover:border-gold/45 transition cursor-pointer"
                  >
                    Meilleure vs Pire semaine
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyComparison}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gold hover:bg-gold-light text-obsidian transition inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ClipboardCopy className="w-3.5 h-3.5" />
                  Copier Comparatif Discord
                </button>
                <button
                  type="button"
                  onClick={handleExportComparisonCsv}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-obsidian hover:bg-slateDark text-zinc-200 border border-zinc-700 transition inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-gold" />
                  CSV Comparatif
                </button>
              </div>
            </div>
          </div>

          {weekA.id === weekB.id && (
            <div className="rounded-xl bg-amber-950/30 border border-amber-500/40 px-4 py-2.5 text-xs text-amber-200">
              Vous comparez actuellement la même semaine des deux côtés. Sélectionnez une autre semaine archivée ou la semaine en cours pour visualiser les écarts.
            </div>
          )}

          {/* Matrice de comparaison globale */}
          <div className="bg-charcoal/95 gold-border rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-800">
              <div>
                <h3 className="font-display text-base font-extrabold text-white">
                  Comparaison Globale : Indicateurs Clés
                </h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  L&apos;écart affiche toujours l&apos;évolution de <strong>Semaine B</strong> par rapport à <strong>Semaine A</strong> (B − A).
                </p>
              </div>
              <span
                className={`text-xs font-mono font-bold tabular-nums inline-flex items-center gap-1.5 ${deltaPolarityClass(
                  comparison.netProfit.delta
                )}`}
              >
                {comparison.netProfit.delta >= 0 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                Écart Bénéfice Net : {formatSigned(comparison.netProfit.delta)} (
                {formatDeltaPct(comparison.netProfit.percentChange)})
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs tabular-nums">
                <thead>
                  <tr className="border-b border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    <th className="py-2.5 px-3">Indicateur Global</th>
                    <th className="py-2.5 px-3 text-right">
                      Semaine A · {weekA.week}
                    </th>
                    <th className="py-2.5 px-3 text-right text-gold-light">
                      Semaine B · {weekB.week}
                    </th>
                    <th className="py-2.5 px-3 text-right">Écart (B − A)</th>
                    <th className="py-2.5 px-3 text-right">Variation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-mono">
                  {[
                    {
                      label: 'Bénéfice Net du Cartel',
                      metric: comparison.netProfit,
                      format: (v: number) => formatSigned(v),
                      formatDelta: (v: number) => formatSigned(v),
                      invert: false,
                      emphasize: true,
                    },
                    {
                      label: 'Gains Bruts Encaissés',
                      metric: comparison.grossGains,
                      format: formatMoney,
                      formatDelta: (v: number) => formatSigned(v),
                      invert: false,
                    },
                    {
                      label: 'Matériel Utilisé',
                      metric: comparison.materialCost,
                      format: formatMoney,
                      formatDelta: (v: number) => formatSigned(v),
                      invert: true,
                    },
                    {
                      label: 'Pertes Totales (Missions + Armes)',
                      metric: comparison.totalLosses,
                      format: formatMoney,
                      formatDelta: (v: number) => formatSigned(v),
                      invert: true,
                    },
                    {
                      label: 'Missions Réussies',
                      metric: comparison.successCount,
                      format: (v: number) => `${v}`,
                      formatDelta: (v: number) => `${v > 0 ? '+' : ''}${v}`,
                      invert: false,
                    },
                    {
                      label: 'Missions Échouées',
                      metric: comparison.failCount,
                      format: (v: number) => `${v}`,
                      formatDelta: (v: number) => `${v > 0 ? '+' : ''}${v}`,
                      invert: true,
                    },
                    {
                      label: 'Taux de Réussite',
                      metric: comparison.successRate,
                      format: (v: number) => `${v.toFixed(1)}%`,
                      formatDelta: (v: number) =>
                        `${v > 0 ? '+' : ''}${v.toFixed(1)} pts`,
                      invert: false,
                    },
                    {
                      label: 'Gros Coups Réussis',
                      metric: comparison.heistsOk,
                      format: (v: number) => `${v}`,
                      formatDelta: (v: number) => `${v > 0 ? '+' : ''}${v}`,
                      invert: false,
                    },
                    {
                      label: 'Part Cartel',
                      metric: comparison.cartelShare,
                      format: (v: number) => formatSigned(v),
                      formatDelta: (v: number) => formatSigned(v),
                      invert: false,
                    },
                    {
                      label: 'Enveloppe Paie Membres',
                      metric: comparison.payrollPool,
                      format: formatMoney,
                      formatDelta: (v: number) => formatSigned(v),
                      invert: false,
                    },
                    {
                      label: 'Membres Actifs',
                      metric: comparison.activeMembers,
                      format: (v: number) => `${v}`,
                      formatDelta: (v: number) => `${v > 0 ? '+' : ''}${v}`,
                      invert: false,
                    },
                  ].map((row) => (
                    <tr
                      key={row.label}
                      className={`hover:bg-zinc-800/30 ${
                        row.emphasize ? 'bg-obsidian/55 font-bold' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 font-sans font-semibold text-white">
                        {row.label}
                      </td>
                      <td className="py-2.5 px-3 text-right text-zinc-300">
                        {row.format(row.metric.a)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-white font-bold">
                        {row.format(row.metric.b)}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-bold ${deltaPolarityClass(
                          row.metric.delta,
                          row.invert
                        )}`}
                      >
                        {row.formatDelta(row.metric.delta)}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right ${deltaPolarityClass(
                          row.metric.delta,
                          row.invert
                        )}`}
                      >
                        {formatDeltaPct(row.metric.percentChange)}
                      </td>
                    </tr>
                  ))}

                  {comparison.hasBothSnapshots ? (
                    <>
                      <tr className="hover:bg-zinc-800/30 border-t border-gold/25">
                        <td className="py-2.5 px-3 font-sans font-semibold text-gold-light">
                          Patrimoine Global (Snapshot)
                        </td>
                        <td className="py-2.5 px-3 text-right text-zinc-300">
                          {formatMoney(comparison.totalWealth.a)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-gold font-bold">
                          {formatMoney(comparison.totalWealth.b)}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-bold ${deltaPolarityClass(
                            comparison.totalWealth.delta
                          )}`}
                        >
                          {formatSigned(comparison.totalWealth.delta)}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right ${deltaPolarityClass(
                            comparison.totalWealth.delta
                          )}`}
                        >
                          {formatDeltaPct(comparison.totalWealth.percentChange)}
                        </td>
                      </tr>
                      <tr className="hover:bg-zinc-800/30">
                        <td className="py-2.5 px-3 font-sans font-semibold text-zinc-200">
                          Trésorerie Cash (Snapshot)
                        </td>
                        <td className="py-2.5 px-3 text-right text-zinc-300">
                          {formatMoney(comparison.treasuryTotal.a)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-white font-bold">
                          {formatMoney(comparison.treasuryTotal.b)}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-bold ${deltaPolarityClass(
                            comparison.treasuryTotal.delta
                          )}`}
                        >
                          {formatSigned(comparison.treasuryTotal.delta)}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right ${deltaPolarityClass(
                            comparison.treasuryTotal.delta
                          )}`}
                        >
                          {formatDeltaPct(comparison.treasuryTotal.percentChange)}
                        </td>
                      </tr>
                    </>
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-2.5 px-3 font-sans text-[11px] text-zinc-500 italic"
                      >
                        La comparaison de Patrimoine &amp; Trésorerie nécessite un snapshot global sur les deux semaines sélectionnées.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Comparatif Jour par Jour & Par Membre */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            {/* Comparatif Journalier */}
            <div className="xl:col-span-6 bg-charcoal/95 bronze-border rounded-2xl p-5 shadow-xl space-y-3">
              <div className="pb-2.5 border-b border-zinc-800">
                <h4 className="font-display text-sm font-bold text-white">
                  Comparatif Jour par Jour (Lundi → Dimanche)
                </h4>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Missions réussies et bénéfice net par journée entre A et B.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                  <thead>
                    <tr className="border-b border-zinc-800 text-[10px] font-sans font-bold uppercase tracking-wider text-zinc-400">
                      <th className="py-2 px-2.5">Jour</th>
                      <th className="py-2 px-2.5 text-center">OK (A → B)</th>
                      <th className="py-2 px-2.5 text-right">Net A</th>
                      <th className="py-2 px-2.5 text-right">Net B</th>
                      <th className="py-2 px-2.5 text-right">Écart</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {comparison.dayComparisons.map((d) => (
                      <tr key={d.day} className="hover:bg-zinc-800/30">
                        <td className="py-2 px-2.5 font-sans font-semibold text-white">
                          {d.day}
                        </td>
                        <td className="py-2 px-2.5 text-center text-zinc-300">
                          {d.okA} → <span className="text-white font-bold">{d.okB}</span>
                        </td>
                        <td className={`py-2 px-2.5 text-right ${netClass(d.netA)}`}>
                          {formatSigned(d.netA)}
                        </td>
                        <td className={`py-2 px-2.5 text-right font-bold ${netClass(d.netB)}`}>
                          {formatSigned(d.netB)}
                        </td>
                        <td
                          className={`py-2 px-2.5 text-right font-bold ${deltaPolarityClass(
                            d.netDelta
                          )}`}
                        >
                          {formatSigned(d.netDelta)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Comparatif par Membre */}
            <div className="xl:col-span-6 bg-charcoal/95 bronze-border rounded-2xl p-5 shadow-xl space-y-3">
              <div className="pb-2.5 border-b border-zinc-800">
                <h4 className="font-display text-sm font-bold text-white">
                  Comparatif par Membre ({comparison.memberComparisons.length})
                </h4>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Évolution du net rapporté et des missions validées par membre.
                </p>
              </div>

              {comparison.memberComparisons.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-500">
                  Aucune participation membre enregistrée sur les deux semaines comparées.
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                    <thead>
                      <tr className="border-b border-zinc-800 text-[10px] font-sans font-bold uppercase tracking-wider text-zinc-400">
                        <th className="py-2 px-2.5">Membre</th>
                        <th className="py-2 px-2.5 text-center">Missions</th>
                        <th className="py-2 px-2.5 text-right">Net A</th>
                        <th className="py-2 px-2.5 text-right">Net B</th>
                        <th className="py-2 px-2.5 text-right">Écart</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {comparison.memberComparisons.map((m) => (
                        <tr key={m.memberId} className="hover:bg-zinc-800/30">
                          <td className="py-2 px-2.5 font-sans font-semibold text-white">
                            {m.memberName}
                          </td>
                          <td className="py-2 px-2.5 text-center text-zinc-300">
                            {m.missionsOkA} →{' '}
                            <span className="text-white font-bold">{m.missionsOkB}</span>
                          </td>
                          <td className={`py-2 px-2.5 text-right ${netClass(m.netA)}`}>
                            {formatSigned(m.netA)}
                          </td>
                          <td className={`py-2 px-2.5 text-right font-bold ${netClass(m.netB)}`}>
                            {formatSigned(m.netB)}
                          </td>
                          <td
                            className={`py-2 px-2.5 text-right font-bold ${deltaPolarityClass(
                              m.netDelta
                            )}`}
                          >
                            {formatSigned(m.netDelta)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
