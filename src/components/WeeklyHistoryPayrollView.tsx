import React, { useMemo, useState } from 'react';
import {
  Archive,
  Banknote,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  History,
  Info,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Wallet,
} from 'lucide-react';
import { HIER_UNITS } from '@/src/data/cartelData';
import type {
  CatalogGroupsMap,
  CurrentWeekPayrollState,
  HierarchyMember,
  HistoryState,
  InventoryPrices,
  MissionScheduleMeta,
  MissionStates,
  PayrollBasis,
  TreasuryMoney,
  WeeklyArchiveRecord,
} from '@/src/types/cartel';
import {
  buildArchivedWeekDiscordReport,
  buildDiscordPayrollReport,
  computeSundayPayroll,
  formatMoney,
  formatSigned,
  netClass,
} from '@/src/utils/finance';

interface WeeklyHistoryPayrollViewProps {
  missionStates: MissionStates;
  scheduleMeta: MissionScheduleMeta;
  members: HierarchyMember[];
  weaponsLossAmount: number;
  inventoryPrices: InventoryPrices;
  catalogGroups: CatalogGroupsMap;
  treasuryMoney: TreasuryMoney;
  historyState: HistoryState;
  readonly: boolean;
  onUpdateCurrentPayroll: (nextPayroll: CurrentWeekPayrollState) => void;
  onSettleSundayPayroll: (debitAccount: 'none' | 'legal' | 'illegal') => void;
  onCancelPayrollSettlement: () => void;
  onArchiveCurrentWeek: () => void;
  onToggleArchivedMemberPaid: (archiveId: string, memberId: string) => void;
  onSettleArchivedPayroll: (
    archiveId: string,
    debitAccount: 'none' | 'legal' | 'illegal'
  ) => void;
  onCancelArchivedPayrollSettlement: (archiveId: string) => void;
  onDeleteWeekArchive: (archiveId: string) => void;
  onOpenArchivesPage?: () => void;
  onShowToast: (msg: string) => void;
}

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

export const WeeklyHistoryPayrollView: React.FC<WeeklyHistoryPayrollViewProps> = ({
  missionStates,
  scheduleMeta,
  members,
  weaponsLossAmount,
  inventoryPrices,
  catalogGroups,
  treasuryMoney,
  historyState,
  readonly,
  onUpdateCurrentPayroll,
  onSettleSundayPayroll,
  onCancelPayrollSettlement,
  onArchiveCurrentWeek,
  onToggleArchivedMemberPaid,
  onSettleArchivedPayroll,
  onCancelArchivedPayrollSettlement,
  onDeleteWeekArchive,
  onOpenArchivesPage,
  onShowToast,
}) => {
  const [subTab, setSubTab] = useState<'payroll' | 'archives'>('payroll');
  const [debitAccount, setDebitAccount] = useState<'none' | 'legal' | 'illegal'>('illegal');
  const [archiveDebitAccount, setArchiveDebitAccount] = useState<'none' | 'legal' | 'illegal'>(
    'illegal'
  );
  const [selectedArchiveId, setSelectedArchiveId] = useState<string>('');
  const [showArchiveMissions, setShowArchiveMissions] = useState(false);
  const [confirmDeleteArchiveId, setConfirmDeleteArchiveId] = useState<string | null>(null);
  const [showSplitSettings, setShowSplitSettings] = useState(false);

  const isSundayToday = new Date().getDay() === 0;
  const activePayrollState = historyState.currentPayroll;
  const currentWeekKey = missionStates.__week || activePayrollState.week;
  const isSameWeekPayroll = activePayrollState.week === currentWeekKey;
  const effectiveCartelPercent = isSameWeekPayroll ? activePayrollState.cartelPercent : 70;
  const effectiveBasis: PayrollBasis = isSameWeekPayroll
    ? activePayrollState.basis
    : 'net_cartel';
  const effectivePaidMemberIds = isSameWeekPayroll ? activePayrollState.paidMemberIds : [];
  const isPayrollSettled = isSameWeekPayroll && Boolean(activePayrollState.settled);

  const payroll = useMemo(
    () =>
      computeSundayPayroll({
        members,
        missionStates,
        scheduleMeta,
        weaponsLossAmount,
        inventoryPrices,
        catalogGroups,
        cartelPercent: effectiveCartelPercent,
        basis: effectiveBasis,
        paidMemberIds: effectivePaidMemberIds,
      }),
    [
      members,
      missionStates,
      scheduleMeta,
      weaponsLossAmount,
      inventoryPrices,
      catalogGroups,
      effectiveCartelPercent,
      effectiveBasis,
      effectivePaidMemberIds,
    ]
  );

  const sortedArchives = useMemo<WeeklyArchiveRecord[]>(() => {
    return Object.values(historyState.archives || {}).sort(
      (a, b) =>
        b.week.localeCompare(a.week) ||
        b.archivedAt.localeCompare(a.archivedAt) ||
        b.id.localeCompare(a.id)
    );
  }, [historyState.archives]);

  const activeArchive: WeeklyArchiveRecord | null = useMemo(() => {
    if (sortedArchives.length === 0) return null;
    if (selectedArchiveId) {
      const found = sortedArchives.find((a) => a.id === selectedArchiveId);
      if (found) return found;
    }
    return sortedArchives[0];
  }, [sortedArchives, selectedArchiveId]);

  const cumulativeStats = useMemo(() => {
    return sortedArchives.reduce(
      (acc, rec) => {
        acc.weeks += 1;
        acc.netProfit += rec.summary.netProfit;
        acc.cartelShare += Math.max(0, rec.payroll.cartelShareAmount);
        acc.payrollPool += rec.payroll.payrollPoolAmount;
        return acc;
      },
      { weeks: 0, netProfit: 0, cartelShare: 0, payrollPool: 0 }
    );
  }, [sortedArchives]);

  const patchCurrentPayroll = (patch: Partial<CurrentWeekPayrollState>) => {
    if (readonly) return;
    const base: CurrentWeekPayrollState = {
      ...activePayrollState,
      week: currentWeekKey,
      cartelPercent: effectiveCartelPercent,
      membersPercent: 100 - effectiveCartelPercent,
      basis: effectiveBasis,
      paidMemberIds: effectivePaidMemberIds,
      settled: isPayrollSettled,
    };
    const nextCartel =
      patch.cartelPercent !== undefined
        ? Math.max(0, Math.min(100, Math.round(patch.cartelPercent)))
        : base.cartelPercent;
    onUpdateCurrentPayroll({
      ...base,
      ...patch,
      cartelPercent: nextCartel,
      membersPercent: 100 - nextCartel,
    });
  };

  const handleToggleMemberPaid = (memberId: string) => {
    if (readonly) return;
    const exists = effectivePaidMemberIds.includes(memberId);
    const nextPaid = exists
      ? effectivePaidMemberIds.filter((id) => id !== memberId)
      : [...effectivePaidMemberIds, memberId];
    patchCurrentPayroll({ paidMemberIds: nextPaid });
  };

  const handleMarkAllPaid = () => {
    if (readonly) return;
    const eligibleIds = payroll.rows
      .filter((r) => r.payrollAmount > 0)
      .map((r) => r.memberId);
    const allAlreadyPaid =
      eligibleIds.length > 0 &&
      eligibleIds.every((id) => effectivePaidMemberIds.includes(id));
    patchCurrentPayroll({
      paidMemberIds: allAlreadyPaid ? [] : eligibleIds,
    });
  };

  const handleCopyCurrentPayroll = async () => {
    const text = buildDiscordPayrollReport({
      weekLabel: payroll.weekLabel,
      cartelPercent: payroll.cartelPercent,
      membersPercent: payroll.membersPercent,
      netWeekProfit: payroll.netWeekProfit,
      cartelShareAmount: payroll.cartelShareAmount,
      payrollPoolAmount: payroll.payrollPoolAmount,
      rows: payroll.rows,
      settled: isPayrollSettled,
    });
    const ok = await copyTextToClipboard(text);
    onShowToast(
      ok ? 'Fiche de paye copiée pour Discord !' : 'Impossible de copier la fiche de paye.'
    );
  };

  const handleCopyArchiveReport = async (archive: WeeklyArchiveRecord) => {
    const text = buildArchivedWeekDiscordReport(archive);
    const ok = await copyTextToClipboard(text);
    onShowToast(
      ok
        ? 'Bilan et paye archivés copiés pour Discord !'
        : 'Impossible de copier le bilan archivé.'
    );
  };

  const allEligiblePaid =
    payroll.eligibleMembersCount > 0 &&
    payroll.paidMembersCount === payroll.eligibleMembersCount;

  return (
    <div className="space-y-6">
      {/* EN-TÊTE ET COMMUTATEUR DE SECTION */}
      <div className="bg-charcoal/90 gold-border rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-gold-light block">
            Rémunération Hebdomadaire &amp; Historique
          </span>
          <h2 className="font-display text-xl sm:text-2xl font-extrabold text-white mt-0.5 flex items-center gap-2.5">
            <Banknote className="w-6 h-6 text-gold shrink-0" />
            Paye du Dimanche
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Calcul et versement hebdomadaire de la rémunération des membres selon les gains nets qu&apos;ils ont rapportés au cartel.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 bg-obsidian/80 border border-bronze/45 p-1 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setSubTab('payroll')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              subTab === 'payroll'
                ? 'bg-gold text-obsidian shadow-md'
                : 'text-zinc-300 hover:text-white hover:bg-charcoal/70'
            }`}
          >
            <Banknote className="w-3.5 h-3.5" />
            Paye du Dimanche
          </button>
          <button
            type="button"
            onClick={() => {
              if (onOpenArchivesPage) {
                onOpenArchivesPage();
              } else {
                setSubTab('archives');
              }
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              subTab === 'archives'
                ? 'bg-gold text-obsidian shadow-md'
                : 'text-zinc-300 hover:text-white hover:bg-charcoal/70'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Archives &amp; Comparateur ({sortedArchives.length}) →
          </button>
        </div>
      </div>

      {/* ONGLET 1: PAYE DU DIMANCHE */}
      {subTab === 'payroll' && (
        <div className="space-y-5">
          {/* Barre d'état & paramètres discrets */}
          <div className="bg-charcoal/95 bronze-border rounded-2xl p-5 shadow-xl space-y-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-zinc-800">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h3 className="font-display text-lg font-extrabold text-white">
                    Semaine {payroll.weekLabel}
                  </h3>
                  {isSundayToday && (
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-gold">
                      · Jour de Paye (Dimanche)
                    </span>
                  )}
                  {isPayrollSettled && (
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                      · Paye Validée
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  Apport net par membre = Gains bruts de ses missions moins sa part de matériel utilisé et de pertes.
                </p>
              </div>

              {/* Bouton paramètres discrets réservé aux éditeurs */}
              {!readonly && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSplitSettings((prev) => !prev)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition inline-flex items-center gap-1.5 cursor-pointer ${
                      showSplitSettings
                        ? 'bg-obsidian text-gold-light border-gold/50'
                        : 'bg-obsidian/80 hover:bg-obsidian text-zinc-300 border-zinc-800 hover:border-gold/40'
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-gold" />
                    Paramètres de calcul
                  </button>
                </div>
              )}
            </div>

            {!readonly && showSplitSettings && (
              <div className="rounded-xl bg-obsidian/85 border border-zinc-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 rounded-xl p-1">
                  <button
                    type="button"
                    disabled={isPayrollSettled}
                    onClick={() => patchCurrentPayroll({ basis: 'net_cartel' })}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer disabled:cursor-not-allowed ${
                      effectiveBasis === 'net_cartel'
                        ? 'bg-charcoal text-gold-light border border-gold/45'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Net Cartel (Recommandé)
                  </button>
                  <button
                    type="button"
                    disabled={isPayrollSettled}
                    onClick={() => patchCurrentPayroll({ basis: 'net_member' })}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer disabled:cursor-not-allowed ${
                      effectiveBasis === 'net_member'
                        ? 'bg-charcoal text-gold-light border border-gold/45'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Par Membre (Direct)
                  </button>
                </div>

                <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5">
                  <span className="text-zinc-400 font-semibold">Part Cartel</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={5}
                    disabled={isPayrollSettled}
                    value={effectiveCartelPercent}
                    onChange={(e) =>
                      patchCurrentPayroll({ cartelPercent: Number(e.target.value) })
                    }
                    className="w-12 bg-obsidian border border-zinc-700 focus:border-gold rounded-md px-1.5 py-0.5 text-center font-mono tabular-nums font-bold text-gold focus:outline-none disabled:opacity-60"
                  />
                  <span className="font-mono text-zinc-500">%</span>
                  <span className="text-zinc-600">/</span>
                  <span className="font-mono font-bold text-emerald-400 tabular-nums">
                    {100 - effectiveCartelPercent}% Paie
                  </span>
                  {!isPayrollSettled && effectiveCartelPercent !== 70 && (
                    <button
                      type="button"
                      onClick={() => patchCurrentPayroll({ cartelPercent: 70 })}
                      className="text-[11px] text-gold-light hover:text-gold underline ml-1 cursor-pointer"
                    >
                      Défaut
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 5 KPIs Synthèse Paye */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="rounded-xl bg-obsidian/80 border border-bronze/40 p-3.5">
                <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
                  Bénéfice Net Semaine
                </div>
                <div
                  className={`font-display text-lg font-extrabold tabular-nums mt-1 ${netClass(
                    payroll.netWeekProfit
                  )}`}
                >
                  {formatSigned(payroll.netWeekProfit)}
                </div>
              </div>

              <div className="rounded-xl bg-obsidian/80 border border-gold/40 p-3.5">
                <div className="text-[10px] uppercase tracking-wider text-gold-light font-semibold">
                  Part Cartel
                </div>
                <div
                  className={`font-display text-lg font-extrabold tabular-nums mt-1 ${
                    payroll.cartelShareAmount >= 0 ? 'text-gold' : 'text-crimson-light'
                  }`}
                >
                  {formatSigned(payroll.cartelShareAmount)}
                </div>
              </div>

              <div className="rounded-xl bg-obsidian/80 border border-emerald-500/35 p-3.5">
                <div className="text-[10px] uppercase tracking-wider text-emerald-300 font-semibold">
                  Enveloppe Paie
                </div>
                <div className="font-display text-lg font-extrabold text-emerald-400 tabular-nums mt-1">
                  {formatMoney(payroll.payrollPoolAmount)}
                </div>
              </div>

              <div className="rounded-xl bg-obsidian/80 border border-zinc-800 p-3.5">
                <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
                  Déjà Versé
                </div>
                <div className="font-display text-lg font-extrabold text-white tabular-nums mt-1">
                  {formatMoney(payroll.paidTotalAmount)}
                </div>
                <div className="text-[10px] font-mono text-zinc-500 tabular-nums mt-0.5">
                  {payroll.paidMembersCount} / {payroll.eligibleMembersCount} membre
                  {payroll.eligibleMembersCount > 1 ? 's' : ''}
                </div>
              </div>

              <div className="col-span-2 md:col-span-1 rounded-xl bg-obsidian/80 border border-zinc-800 p-3.5">
                <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
                  Reste à Payer
                </div>
                <div
                  className={`font-display text-lg font-extrabold tabular-nums mt-1 ${
                    payroll.unpaidTotalAmount > 0 ? 'text-amber-300' : 'text-zinc-400'
                  }`}
                >
                  {formatMoney(payroll.unpaidTotalAmount)}
                </div>
              </div>
            </div>

            {/* Alertes explicatives si gains non attribués ou pertes globales */}
            {(payroll.unattributedNet !== 0 || payroll.weaponsLossAmount > 0) && (
              <div className="rounded-xl bg-obsidian/70 border border-zinc-800 px-4 py-3 text-xs text-zinc-300 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-5">
                <div className="flex items-center gap-2 text-amber-300 font-semibold shrink-0">
                  <Info className="w-4 h-4 shrink-0" />
                  Détail du calcul :
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-zinc-400">
                  {payroll.weaponsLossAmount > 0 && (
                    <span>
                      Pertes globales déduites du net :{' '}
                      <strong className="text-red-300 tabular-nums">
                        -{formatMoney(payroll.weaponsLossAmount)}
                      </strong>
                    </span>
                  )}
                  {payroll.unattributedNet !== 0 && (
                    <span>
                      Missions sans joueur coché :{' '}
                      <strong className="text-zinc-200 tabular-nums">
                        {formatSigned(payroll.unattributedNet)}
                      </strong>{' '}
                      (conservé au coffre du cartel)
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Tableau individuel de Paye */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    <th className="py-3 px-3">Membre</th>
                    <th className="py-3 px-3 text-center">Missions</th>
                    <th className="py-3 px-3 text-right">Gains Bruts</th>
                    <th className="py-3 px-3 text-right">Matériel &amp; Pertes</th>
                    <th className="py-3 px-3 text-right">Net Rapporté</th>
                    <th className="py-3 px-3 text-right text-emerald-400">Paie</th>
                    <th className="py-3 px-3 text-right">Versement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70 text-xs tabular-nums">
                  {payroll.rows.map((row) => {
                    const hasActivity = row.missionsOk + row.missionsKo > 0;
                    const rowCostTotal = row.materialCostShare + row.lossShare;
                    return (
                      <tr
                        key={row.memberId}
                        className={`transition ${
                          row.payrollAmount > 0
                            ? 'hover:bg-zinc-800/35'
                            : hasActivity
                              ? 'hover:bg-zinc-800/20 opacity-85'
                              : 'opacity-45'
                        }`}
                      >
                        <td className="py-3 px-3">
                          <div className="font-bold text-white">{row.memberName}</div>
                          <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                            {HIER_UNITS[row.unit] || row.unit}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center font-mono">
                          <span className="text-emerald-400 font-bold">{row.missionsOk}</span>
                          <span className="text-zinc-600"> / </span>
                          <span className="text-red-400">{row.missionsKo}</span>
                          {row.heistsOk > 0 && (
                            <span className="text-[10px] text-gold block">
                              {row.heistsOk} Gros Coup{row.heistsOk > 1 ? 's' : ''}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-zinc-200">
                          {formatMoney(row.grossRevenue)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-amber-300/90">
                          {rowCostTotal > 0 ? `-${formatMoney(rowCostTotal)}` : '0 $'}
                        </td>
                        <td
                          className={`py-3 px-3 text-right font-mono font-bold ${netClass(
                            row.netContribution
                          )}`}
                        >
                          {formatSigned(row.netContribution)}
                        </td>
                        <td className="py-3 px-3 text-right font-display text-sm font-extrabold text-emerald-400">
                          {formatMoney(row.payrollAmount)}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {row.payrollAmount > 0 ? (
                            <button
                              type="button"
                              disabled={readonly}
                              onClick={() => handleToggleMemberPaid(row.memberId)}
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition inline-flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed ${
                                row.paid
                                  ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/45'
                                  : 'bg-obsidian hover:bg-charcoal text-zinc-300 border border-zinc-700 hover:border-gold/50'
                              }`}
                            >
                              {row.paid ? (
                                <>
                                  <Check className="w-3 h-3" />
                                  Payé
                                </>
                              ) : (
                                'Marquer payé'
                              )}
                            </button>
                          ) : (
                            <span className="text-[11px] text-zinc-600">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Barre d'actions de validation & clôture */}
            <div className="pt-4 border-t border-zinc-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleCopyCurrentPayroll}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-gold hover:bg-gold-light text-obsidian transition inline-flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <ClipboardCopy className="w-3.5 h-3.5" />
                  Copier Paye (Discord)
                </button>

                {!readonly && payroll.eligibleMembersCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllPaid}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-obsidian hover:bg-slateDark text-zinc-200 border border-zinc-700 transition inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    {allEligiblePaid ? 'Décocher tout' : 'Tout marquer payé'}
                  </button>
                )}

                {!readonly && (
                  <button
                    type="button"
                    onClick={onArchiveCurrentWeek}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-obsidian hover:bg-charcoal text-gold-light border border-gold/45 hover:border-gold transition inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    Archiver cette semaine
                  </button>
                )}
              </div>

              {/* Règlement trésorerie */}
              {!readonly && (
                <div className="flex flex-wrap items-center gap-2.5">
                  {isPayrollSettled ? (
                    <div className="flex flex-wrap items-center gap-2.5 text-xs">
                      <span className="text-emerald-300 font-semibold flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4" />
                        Validée ({formatMoney(activePayrollState.settledAmount)}
                        {activePayrollState.debitAccount !== 'none' &&
                        activePayrollState.debitAmount > 0
                          ? ` · débitée en ${
                              activePayrollState.debitAccount === 'legal'
                                ? 'Argent Légal'
                                : 'Argent Sale'
                            }`
                          : ''}
                        )
                      </span>
                      <button
                        type="button"
                        onClick={onCancelPayrollSettlement}
                        className="px-3 py-2 rounded-xl text-xs font-bold bg-crimson/25 hover:bg-crimson/45 text-red-200 border border-crimson-light/40 transition inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Annuler &amp; rembourser
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5 text-xs">
                        <Wallet className="w-3.5 h-3.5 text-gold shrink-0" />
                        <select
                          value={debitAccount}
                          onChange={(e) =>
                            setDebitAccount(e.target.value as 'none' | 'legal' | 'illegal')
                          }
                          className="bg-zinc-950 border border-zinc-700 focus:border-gold rounded-xl px-2.5 py-2 text-xs text-zinc-200 focus:outline-none"
                        >
                          <option value="illegal">
                            Débiter Argent Sale ({formatMoney(treasuryMoney.illegal || 0)})
                          </option>
                          <option value="legal">
                            Débiter Argent Légal ({formatMoney(treasuryMoney.legal || 0)})
                          </option>
                          <option value="none">Enregistrer sans débiter la caisse</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        disabled={payroll.payrollPoolAmount <= 0}
                        onClick={() => onSettleSundayPayroll(debitAccount)}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white transition inline-flex items-center gap-1.5 shadow-md cursor-pointer disabled:cursor-not-allowed"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Valider la Paye ({formatMoney(payroll.payrollPoolAmount)})
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ONGLET 2: SEMAINES PRÉCÉDENTES (ARCHIVES) */}
      {subTab === 'archives' && (
        <div className="space-y-5">
          {sortedArchives.length === 0 ? (
            <div className="bg-charcoal/90 bronze-border rounded-2xl p-10 text-center space-y-4 shadow-xl">
              <History className="w-10 h-10 text-gold/70 mx-auto" />
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="font-display text-lg font-bold text-white">
                  Aucune semaine archivée pour le moment
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Les bilans passés sont sauvegardés automatiquement lorsque vous démarrez une nouvelle semaine ou que vous cliquez sur « Archiver cette semaine ».
                </p>
              </div>
              {!readonly && (
                <button
                  type="button"
                  onClick={onArchiveCurrentWeek}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-gold hover:bg-gold-light text-obsidian transition inline-flex items-center gap-2 cursor-pointer"
                >
                  <Archive className="w-4 h-4" />
                  Archiver la semaine en cours
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Cumul multi-semaines */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-charcoal/95 bronze-border rounded-xl p-4">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
                    Semaines Archivées
                  </div>
                  <div className="font-display text-xl font-extrabold text-white tabular-nums mt-1">
                    {cumulativeStats.weeks}
                  </div>
                </div>
                <div className="bg-charcoal/95 bronze-border rounded-xl p-4">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
                    Bénéfice Net Cumulé
                  </div>
                  <div
                    className={`font-display text-xl font-extrabold tabular-nums mt-1 ${netClass(
                      cumulativeStats.netProfit
                    )}`}
                  >
                    {formatSigned(cumulativeStats.netProfit)}
                  </div>
                </div>
                <div className="bg-charcoal/95 gold-border rounded-xl p-4">
                  <div className="text-[10px] uppercase tracking-wider text-gold-light font-semibold">
                    Part Cartel Cumulée
                  </div>
                  <div className="font-display text-xl font-extrabold text-gold tabular-nums mt-1">
                    {formatMoney(cumulativeStats.cartelShare)}
                  </div>
                </div>
                <div className="bg-charcoal/95 bronze-border rounded-xl p-4">
                  <div className="text-[10px] uppercase tracking-wider text-emerald-300 font-semibold">
                    Payes Membres Cumulées
                  </div>
                  <div className="font-display text-xl font-extrabold text-emerald-400 tabular-nums mt-1">
                    {formatMoney(cumulativeStats.payrollPool)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Colonne gauche: liste des semaines */}
                <div className="lg:col-span-4 bg-charcoal/95 bronze-border rounded-2xl p-4 space-y-2.5 shadow-xl">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                    <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gold" />
                      Historique des Semaines
                    </h3>
                    {!readonly && (
                      <button
                        type="button"
                        onClick={onArchiveCurrentWeek}
                        className="text-[11px] font-bold text-gold-light hover:text-gold transition cursor-pointer"
                      >
                        + Archiver actuelle
                      </button>
                    )}
                  </div>

                  <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
                    {sortedArchives.map((rec) => {
                      const isSelected = activeArchive?.id === rec.id;
                      const paidCount = rec.payroll.rows.filter(
                        (r) => r.payrollAmount > 0 && r.paid
                      ).length;
                      const eligibleCount = rec.payroll.rows.filter(
                        (r) => r.payrollAmount > 0
                      ).length;

                      return (
                        <button
                          key={rec.id}
                          type="button"
                          onClick={() => {
                            setSelectedArchiveId(rec.id);
                            setConfirmDeleteArchiveId(null);
                            setShowArchiveMissions(false);
                          }}
                          className={`w-full text-left rounded-xl p-3 border transition cursor-pointer ${
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
                          <div className="flex items-center justify-between gap-2 mt-1.5 text-[11px] font-mono tabular-nums text-zinc-400">
                            <span>
                              {rec.summary.successCount}✓ / {rec.summary.failCount}✗
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
                                ? `Paye validée (${paidCount}/${eligibleCount})`
                                : eligibleCount > 0
                                  ? `Paie ${formatMoney(rec.payroll.payrollPoolAmount)}`
                                  : 'Aucune paie'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Colonne droite: détail de la semaine sélectionnée */}
                {activeArchive && (
                  <div className="lg:col-span-8 bg-charcoal/95 gold-border rounded-2xl p-5 sm:p-6 space-y-6 shadow-xl">
                    {/* Header dossier semaine */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-zinc-800">
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-gold-light block">
                          Archive Semaine · {activeArchive.week}
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
                          onClick={() => handleCopyArchiveReport(activeArchive)}
                          className="px-3 py-2 rounded-xl text-xs font-bold bg-gold hover:bg-gold-light text-obsidian transition inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <ClipboardCopy className="w-3.5 h-3.5" />
                          Copier Bilan &amp; Paye
                        </button>

                        {!readonly && (
                          confirmDeleteArchiveId === activeArchive.id ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteWeekArchive(activeArchive.id);
                                  setConfirmDeleteArchiveId(null);
                                }}
                                className="px-3 py-2 rounded-xl text-xs font-bold bg-crimson hover:bg-crimson-light text-white transition cursor-pointer"
                              >
                                Confirmer suppression
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
                          )
                        )}
                      </div>
                    </div>

                    {/* KPIs de la semaine archivée */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="rounded-xl bg-obsidian/80 border border-zinc-800 p-3">
                        <div className="text-[10px] uppercase tracking-wider text-zinc-400">
                          Missions
                        </div>
                        <div className="font-mono text-base font-extrabold text-white tabular-nums mt-0.5">
                          <span className="text-emerald-400">
                            {activeArchive.summary.successCount}✓
                          </span>{' '}
                          <span className="text-zinc-600">/</span>{' '}
                          <span className="text-red-400">{activeArchive.summary.failCount}✗</span>
                        </div>
                      </div>
                      <div className="rounded-xl bg-obsidian/80 border border-zinc-800 p-3">
                        <div className="text-[10px] uppercase tracking-wider text-zinc-400">
                          Gains Bruts
                        </div>
                        <div className="font-mono text-base font-extrabold text-emerald-400 tabular-nums mt-0.5">
                          {formatMoney(activeArchive.summary.grossGains)}
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
                      </div>
                    </div>

                    {/* Bilan journalier */}
                    <div className="space-y-2.5">
                      <h4 className="font-display text-sm font-bold text-white">
                        Détail Journalier de la Semaine
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

                    {/* Paye du dimanche archivée */}
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h4 className="font-display text-sm font-bold text-white">
                            Paye du Dimanche
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

                        {!readonly && (
                          <div className="flex flex-wrap items-center gap-2">
                            {activeArchive.payroll.settled ? (
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
                                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer"
                                  >
                                    Valider la Paye
                                  </button>
                                </>
                              )
                            )}
                          </div>
                        )}
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

                    {/* Liste dépliable des missions archivées */}
                    {activeArchive.missions.length > 0 && (
                      <div className="border-t border-zinc-800 pt-4">
                        <button
                          type="button"
                          onClick={() => setShowArchiveMissions((prev) => !prev)}
                          className="w-full flex items-center justify-between text-xs font-bold text-zinc-300 hover:text-white transition cursor-pointer"
                        >
                          <span>
                            Opérations exécutées ({activeArchive.missions.length})
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
            </>
          )}
        </div>
      )}
    </div>
  );
};
