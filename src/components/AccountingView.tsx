import React, { useMemo, useState } from 'react';
import { Archive, Banknote } from 'lucide-react';
import { HIER_UNITS, WEEKLY_SCHEDULE } from '@/src/data/cartelData';
import type {
  CatalogGroupsMap,
  HierarchyMember,
  InventoryPrices,
  MissionScheduleMeta,
  MissionStates,
  WeaponsStock,
} from '@/src/types/cartel';
import {
  dayDate,
  fmtLong,
  formatMoney,
  formatSigned,
  getMissionEntry,
  getWeaponHolderName,
  isTodayName,
  missionFin,
  netClass,
} from '@/src/utils/finance';
import { getEffectiveSchedule } from '@/src/utils/schedule';

interface AccountingViewProps {
  missionStates: MissionStates;
  scheduleMeta?: MissionScheduleMeta;
  members: HierarchyMember[];
  weaponsStock: WeaponsStock;
  weaponsLossAmount: number;
  inventoryPrices?: InventoryPrices;
  catalogGroups?: CatalogGroupsMap;
  readonly: boolean;
  onUpdateWeaponsLoss: (val: number) => void;
  onLoseWeaponGlobal: (weaponId: string) => void;
  onOpenPayrollHistory?: () => void;
  onOpenArchives?: () => void;
}

export const AccountingView: React.FC<AccountingViewProps> = ({
  missionStates,
  scheduleMeta,
  members,
  weaponsStock,
  weaponsLossAmount,
  inventoryPrices,
  catalogGroups,
  readonly,
  onUpdateWeaponsLoss,
  onLoseWeaponGlobal,
  onOpenPayrollHistory,
  onOpenArchives,
}) => {
  const [selectedWeaponId, setSelectedWeaponId] = useState('');
  const stockedWeapons = useMemo(
    () =>
      Object.values(weaponsStock)
        .filter((w) => w && (Number(w.qty) || 0) > 0)
        .sort((a, b) => a.name.localeCompare(b.name, 'fr-FR')),
    [weaponsStock]
  );
  const chosenWeaponId =
    selectedWeaponId && stockedWeapons.some((w) => w.id === selectedWeaponId)
      ? selectedWeaponId
      : stockedWeapons[0]?.id || '';
  let totOk = 0;
  let totKo = 0;
  let totCost = 0;
  let totExtra = 0;
  let totGains = 0;

  const effectiveDays = useMemo(
    () => getEffectiveSchedule(missionStates, scheduleMeta).days,
    [missionStates, scheduleMeta]
  );

  const dayRows = effectiveDays.map((dayObj) => {
    let ok = 0;
    let ko = 0;
    let cost = 0;
    let extra = 0;
    let gains = 0;

    dayObj.missions.forEach((m) => {
      const f = missionFin(m, missionStates, inventoryPrices, catalogGroups);
      if (f.success) ok++;
      if (f.fail) ko++;
      cost += f.cost;
      extra += f.extra;
      gains += f.gain;
    });

    totOk += ok;
    totKo += ko;
    totCost += cost;
    totExtra += extra;
    totGains += gains;

    const dayNet = gains - cost - extra;
    return {
      dayObj,
      ok,
      ko,
      cost,
      extra,
      gains,
      dayNet,
    };
  });

  const totalLoss = totExtra + weaponsLossAmount;
  const totalWeekNet = totGains - totCost - totalLoss;

  const playerStats = new Map<string, { ok: number; ko: number }>();
  WEEKLY_SCHEDULE.forEach((dayObj) => {
    dayObj.missions.forEach((m) => {
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

  const sortedMembers = [...members].sort(
    (a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name)
  );
  const hasAnyPlayerStats = sortedMembers.some((m) => {
    const s = playerStats.get(m.id);
    return s && s.ok + s.ko > 0;
  });

  const netTextClass =
    totalWeekNet > 0
      ? 'text-emerald-400'
      : totalWeekNet < 0
        ? 'text-crimson-light'
        : 'text-gold';

  return (
    <div className="space-y-6">
      <div className="bg-charcoal/90 gold-border rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-zinc-800">
          <div>
            <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
              <span className="text-gold">📊</span> Bilan Comptable des Entrées &amp; Sorties (Par Jour)
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Calcul automatique : matériel utilisé par chaque mission (réussie ou échouée) + pertes ajoutées, moins les gains des missions réussies.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {onOpenPayrollHistory && (
              <button
                type="button"
                onClick={onOpenPayrollHistory}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-gold/15 hover:bg-gold hover:text-obsidian text-gold-light border border-gold/45 transition inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Banknote className="w-3.5 h-3.5" />
                Paye du Dimanche
              </button>
            )}
            {onOpenArchives && (
              <button
                type="button"
                onClick={onOpenArchives}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-obsidian hover:bg-slateDark text-zinc-200 border border-zinc-700 hover:border-gold/50 transition inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Archive className="w-3.5 h-3.5 text-gold" />
                Archives &amp; Comparateur
              </button>
            )}
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-zinc-500 block">
                Bénéfice Net Global
              </span>
              <span className={`font-display text-base font-extrabold tabular-nums ${netTextClass}`}>
                {formatSigned(totalWeekNet)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-obsidian/80 border border-zinc-800 rounded-xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                <span className="text-crimson-light">⚠️</span> Pertes Globales (Armes, Équipements, Autres)
              </h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                Pertes hors missions (fusillades, amendes...). Pour une mission précise, utilise le sélecteur d&apos;arme perdue directement sur la mission dans le Planning.
              </p>
            </div>
            <div className="relative w-full sm:w-48 shrink-0">
              <input
                type="number"
                min="0"
                step="100"
                value={weaponsLossAmount || 0}
                disabled={readonly}
                onChange={(e) =>
                  onUpdateWeaponsLoss(Math.max(0, Number(e.target.value) || 0))
                }
                placeholder="0"
                className="w-full bg-zinc-950 border border-zinc-700 focus:border-crimson-light rounded-xl pl-3 pr-7 py-2 text-right font-mono tabular-nums text-sm font-bold text-red-300 focus:outline-none disabled:opacity-60"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-sm text-zinc-500 pointer-events-none">
                $
              </span>
            </div>
          </div>

          {!readonly && stockedWeapons.length > 0 && (
            <div className="pt-3 border-t border-zinc-800/80 flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="text-[11px] font-semibold text-zinc-400 shrink-0">
                🔫 Déclarer une arme perdue hors mission :
              </span>
              <select
                value={chosenWeaponId}
                onChange={(e) => setSelectedWeaponId(e.target.value)}
                className="flex-1 min-w-0 bg-zinc-950 border border-zinc-700 focus:border-crimson-light rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none"
              >
                {stockedWeapons.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} — {getWeaponHolderName(w.holderId, members)} ({formatMoney(w.value)}) [x{w.qty}]
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!chosenWeaponId}
                onClick={() => chosenWeaponId && onLoseWeaponGlobal(chosenWeaponId)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-crimson/30 hover:bg-crimson/50 text-red-200 border border-crimson-light/40 transition whitespace-nowrap cursor-pointer"
              >
                Déclarer perdue (-1)
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                <th className="py-3 px-4">Jour de la Semaine</th>
                <th className="py-3 px-4 text-center">Missions (Réussies / Échouées)</th>
                <th className="py-3 px-4 text-right">Matériel Utilisé</th>
                <th className="py-3 px-4 text-right">Pertes (Armes / Autres)</th>
                <th className="py-3 px-4 text-right">Entrées (Gains)</th>
                <th className="py-3 px-4 text-right">Résultat Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-xs font-mono tabular-nums">
              {dayRows.map(({ dayObj, ok, ko, cost, extra, gains, dayNet }) => (
                <tr key={dayObj.day} className="hover:bg-zinc-800/30 transition">
                  <td className="py-3 px-4 font-sans font-bold text-white">
                    {dayObj.day}{' '}
                    <span className="text-[10px] font-normal text-zinc-500 block">
                      {fmtLong(dayDate(dayObj.day, missionStates))}
                      {isTodayName(dayObj.day, missionStates) ? " · aujourd'hui" : ''}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center font-bold">
                    <span className="text-emerald-400">✅ {ok}</span>{' '}
                    <span className="text-zinc-600">/</span>{' '}
                    <span className="text-red-400">❌ {ko}</span>{' '}
                    <span className="text-zinc-500 font-normal">sur {dayObj.missions.length}</span>
                  </td>
                  <td className="py-3 px-4 text-right text-amber-300">{formatMoney(cost)}</td>
                  <td className="py-3 px-4 text-right text-red-400">{formatMoney(extra)}</td>
                  <td className="py-3 px-4 text-right text-emerald-400">{formatMoney(gains)}</td>
                  <td className={`py-3 px-4 text-right font-bold ${netClass(dayNet)}`}>
                    {formatSigned(dayNet)}
                  </td>
                </tr>
              ))}
              {weaponsLossAmount > 0 && (
                <tr className="bg-red-950/10">
                  <td className="py-3 px-4 font-sans font-bold text-red-300">
                    Pertes globales (armes / autres)
                  </td>
                  <td className="py-3 px-4 text-center text-zinc-600">—</td>
                  <td className="py-3 px-4 text-right text-zinc-600">—</td>
                  <td className="py-3 px-4 text-right text-red-400">
                    {formatMoney(weaponsLossAmount)}
                  </td>
                  <td className="py-3 px-4 text-right text-zinc-600">—</td>
                  <td className="py-3 px-4 text-right font-bold text-crimson-light">
                    {formatSigned(-weaponsLossAmount)}
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-obsidian/60 border-t-2 border-gold/40 text-xs font-bold text-white tabular-nums">
                <td className="py-3.5 px-4 font-display uppercase">TOTAL SEMAINE</td>
                <td className="py-3.5 px-4 text-center font-mono">
                  <span className="text-emerald-400">✅ {totOk}</span>{' '}
                  <span className="text-zinc-600">/</span>{' '}
                  <span className="text-red-400">❌ {totKo}</span>
                </td>
                <td className="py-3.5 px-4 text-right font-mono text-amber-300">
                  {formatMoney(totCost)}
                </td>
                <td className="py-3.5 px-4 text-right font-mono text-red-400">
                  {formatMoney(totalLoss)}
                </td>
                <td className="py-3.5 px-4 text-right font-mono text-emerald-400">
                  {formatMoney(totGains)}
                </td>
                <td
                  className={`py-3.5 px-4 text-right font-display text-base font-extrabold ${netTextClass}`}
                >
                  {formatSigned(totalWeekNet)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {hasAnyPlayerStats && (
        <div className="bg-charcoal/90 gold-border rounded-2xl p-6 shadow-xl space-y-4">
          <div className="pb-3 border-b border-zinc-800">
            <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
              <span className="text-gold">👥</span> Participations aux Missions (Par Joueur)
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Nombre de missions réussies et échouées auxquelles chaque membre du cartel a participé cette semaine.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sortedMembers.map((member) => {
              const s = playerStats.get(member.id) || { ok: 0, ko: 0 };
              const total = s.ok + s.ko;
              return (
                <div
                  key={member.id}
                  className={`rounded-xl border px-4 py-3 flex items-center justify-between gap-3 ${
                    total > 0
                      ? 'bg-obsidian/80 border-gold/30'
                      : 'bg-obsidian/40 border-zinc-800/70 opacity-60'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-white truncate">{member.name}</div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                      {HIER_UNITS[member.unit]}
                    </div>
                  </div>
                  <div className="text-right font-mono tabular-nums text-xs shrink-0">
                    <span className="text-emerald-400 font-bold">✅ {s.ok}</span>{' '}
                    <span className="text-zinc-600">/</span>{' '}
                    <span className="text-red-400 font-bold">❌ {s.ko}</span>
                    <div className="text-[10px] text-zinc-400 mt-0.5">
                      {total} mission{total > 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
