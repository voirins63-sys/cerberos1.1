import React, { useMemo, useState } from 'react';
import { Award, ClipboardCopy, Crown, Medal, Shield, SlidersHorizontal, Star, Trophy } from 'lucide-react';
import { DISTINCTION_DEFS, HIER_UNITS, RANK_LEVELS } from '@/src/data/cartelData';
import type {
  CatalogGroupsMap,
  DistinctionKey,
  HierarchyMember,
  HierarchyUnitKey,
  InventoryPrices,
  MemberRankingsMap,
  MissionStates,
  WeaponsStock,
} from '@/src/types/cartel';
import {
  computeMemberLeaderboard,
  formatMoney,
  formatSigned,
  netClass,
  type RankedMemberEntry,
} from '@/src/utils/finance';

interface RankingViewProps {
  members: HierarchyMember[];
  missionStates: MissionStates;
  weaponsStock: WeaponsStock;
  memberRankings: MemberRankingsMap;
  inventoryPrices?: InventoryPrices;
  catalogGroups?: CatalogGroupsMap;
  readonly: boolean;
  onUpdateMemberRankings: (next: MemberRankingsMap) => void;
  onShowToast: (msg: string) => void;
}

type SortKey = 'points' | 'missions' | 'heists' | 'revenue' | 'weapons';

const DISTINCTION_LABEL_MAP = new Map(DISTINCTION_DEFS.map((d) => [d.key, d]));

export const RankingView: React.FC<RankingViewProps> = ({
  members,
  missionStates,
  weaponsStock,
  memberRankings,
  inventoryPrices,
  catalogGroups,
  readonly,
  onUpdateMemberRankings,
  onShowToast,
}) => {
  const [unitFilter, setUnitFilter] = useState<'ALL' | HierarchyUnitKey>('ALL');
  const [sortBy, setSortBy] = useState<SortKey>('points');
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [draftBonus, setDraftBonus] = useState<string>('0');
  const [draftNote, setDraftNote] = useState<string>('');
  const [draftManualBadges, setDraftManualBadges] = useState<DistinctionKey[]>([]);

  const leaderboard = useMemo(
    () =>
      computeMemberLeaderboard({
        members,
        missionStates,
        weaponsStock,
        memberRankings,
        inventoryPrices,
        catalogGroups,
      }),
    [members, missionStates, weaponsStock, memberRankings, inventoryPrices, catalogGroups]
  );

  const topThree = useMemo(() => leaderboard.slice(0, 3), [leaderboard]);

  const filteredAndSorted = useMemo(() => {
    const base =
      unitFilter === 'ALL'
        ? leaderboard
        : leaderboard.filter((e) => e.member.unit === unitFilter);

    if (sortBy === 'points') return base;

    return [...base].sort((a, b) => {
      if (sortBy === 'missions') {
        return b.missionsOk - a.missionsOk || b.totalPoints - a.totalPoints;
      }
      if (sortBy === 'heists') {
        return b.heistsOk - a.heistsOk || b.missionsOk - a.missionsOk || b.totalPoints - a.totalPoints;
      }
      if (sortBy === 'revenue') {
        return b.estimatedRevenue - a.estimatedRevenue || b.totalPoints - a.totalPoints;
      }
      return b.weaponsHeldValue - a.weaponsHeldValue || b.weaponsHeldCount - a.weaponsHeldCount;
    });
  }, [leaderboard, unitFilter, sortBy]);

  const openEditor = (entry: RankedMemberEntry) => {
    if (editingMemberId === entry.member.id) {
      setEditingMemberId(null);
      return;
    }
    setEditingMemberId(entry.member.id);
    setDraftBonus(String(entry.bonusPoints || 0));
    setDraftNote(entry.note || '');
    setDraftManualBadges([...entry.manualBadges]);
  };

  const toggleDraftBadge = (key: DistinctionKey) => {
    setDraftManualBadges((prev) =>
      prev.includes(key) ? prev.filter((b) => b !== key) : [...prev, key]
    );
  };

  const applyQuickBonus = (entry: RankedMemberEntry, delta: number) => {
    if (readonly) return;
    const current = memberRankings[entry.member.id];
    const nextBonus = (current?.bonusPoints || 0) + delta;
    const nextMap: MemberRankingsMap = { ...memberRankings };
    const note = current?.note || '';
    const manualBadges = current?.manualBadges || [];
    if (nextBonus === 0 && !note && manualBadges.length === 0) {
      delete nextMap[entry.member.id];
    } else {
      nextMap[entry.member.id] = {
        bonusPoints: nextBonus,
        note,
        manualBadges,
      };
    }
    onUpdateMemberRankings(nextMap);
    if (editingMemberId === entry.member.id) {
      setDraftBonus(String(nextBonus));
    }
  };

  const handleSaveEditor = (memberId: string) => {
    if (readonly) return;
    const parsedBonus = Math.trunc(Number(draftBonus) || 0);
    const trimmedNote = draftNote.trim().slice(0, 160);
    const nextMap: MemberRankingsMap = { ...memberRankings };
    if (parsedBonus === 0 && !trimmedNote && draftManualBadges.length === 0) {
      delete nextMap[memberId];
    } else {
      nextMap[memberId] = {
        bonusPoints: parsedBonus,
        note: trimmedNote,
        manualBadges: draftManualBadges,
      };
    }
    onUpdateMemberRankings(nextMap);
    setEditingMemberId(null);
    onShowToast('Évaluation du membre enregistrée.');
  };

  const handleCopyRanking = async () => {
    let text = '```asciidoc\n';
    text += '= CLASSEMENT OFFICIEL LOS CERBEROS =\n';
    text += 'DISCIPLINE · LOYAUTÉ · RESPECT · FRATERNITÉ\n\n';
    leaderboard.forEach((entry) => {
      const badges = entry.unlockedBadges
        .map((k) => DISTINCTION_LABEL_MAP.get(k)?.title || k)
        .join(', ');
      text += `#${entry.rank} ${entry.member.name} [${HIER_UNITS[entry.member.unit]}] — ${entry.levelTitle}\n`;
      const matDetail =
        entry.materialCostShare > 0
          ? ` (Brut: ${formatMoney(entry.grossRevenue)} · Mat.: -${formatMoney(entry.materialCostShare)}${entry.lossShare > 0 ? ` · Pertes: -${formatMoney(entry.lossShare)}` : ''})`
          : '';
      text += `   Points: ${entry.totalPoints} pts | Missions: ${entry.missionsOk}✓/${entry.missionsKo}✗ (Gros Coups: ${entry.heistsOk}) | Gains nets: ${formatSigned(entry.estimatedRevenue)}${matDetail}\n`;
      if (badges) {
        text += `   Médailles: ${badges}\n`;
      }
      if (entry.note) {
        text += `   Note: ${entry.note}\n`;
      }
    });
    text += '```';

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        onShowToast('Classement copié dans le presse-papiers !');
        return;
      }
    } catch {
      // Fallback below
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      onShowToast('Classement copié dans le presse-papiers !');
    } catch {
      onShowToast('Erreur de copie.');
    }
    document.body.removeChild(ta);
  };

  const podiumStyles = [
    {
      border: 'border-gold/70 bg-gradient-to-b from-gold/15 via-charcoal to-obsidian',
      rankColor: 'text-gold',
      badge: '1er · OR ANTIQUE',
      icon: Crown,
    },
    {
      border: 'border-bronze/80 bg-gradient-to-b from-bronze/20 via-charcoal to-obsidian',
      rankColor: 'text-gold-light',
      badge: '2e · BRONZE VIEILLI',
      icon: Medal,
    },
    {
      border: 'border-gunmetal bg-gradient-to-b from-gunmetal/40 via-charcoal to-obsidian',
      rankColor: 'text-zinc-300',
      badge: '3e · ACIER',
      icon: Award,
    },
  ];

  return (
    <div className="space-y-6">
      {/* EN-TÊTE CLASSEMENT */}
      <div className="bg-charcoal/95 gold-border rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-bronze/40">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-crimson-light">
              Discipline · Loyauté · Respect · Fraternité
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-extrabold tracking-wider text-gold mt-1 flex items-center gap-2.5">
              <Trophy className="w-6 h-6 text-gold shrink-0" />
              CLASSEMENT DES MEMBRES
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Score automatique issu des opérations du Planning + points de mérite et distinctions attribués par la direction.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopyRanking}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-gold hover:bg-gold-light text-obsidian transition flex items-center gap-2 shadow-md cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-center"
          >
            <ClipboardCopy className="w-4 h-4" />
            Copier Classement (Discord)
          </button>
        </div>

        {/* PODIUM TOP 3 */}
        {topThree.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {topThree.map((entry, idx) => {
              const style = podiumStyles[idx] || podiumStyles[2];
              const Icon = style.icon;
              return (
                <div
                  key={entry.member.id}
                  className={`rounded-2xl border p-5 flex flex-col justify-between gap-4 shadow-lg ${style.border}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className={`text-[10px] font-bold uppercase tracking-[0.22em] ${style.rankColor}`}>
                        {style.badge}
                      </div>
                      <h3 className="font-display text-lg font-extrabold text-white truncate mt-1">
                        {entry.member.name}
                      </h3>
                      <div className="text-[11px] text-zinc-400 mt-0.5">
                        {HIER_UNITS[entry.member.unit]} ·{' '}
                        <span className="text-gold-light font-semibold">{entry.levelTitle}</span>
                      </div>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-obsidian/90 border border-gold/40 flex items-center justify-center shrink-0">
                      <Icon className={`w-5 h-5 ${style.rankColor}`} />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-bronze/30 text-center">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-zinc-500 block">
                        Score
                      </span>
                      <span className="font-mono font-extrabold text-sm text-gold tabular-nums">
                        {entry.totalPoints}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-zinc-500 block">
                        Missions
                      </span>
                      <span className="font-mono font-bold text-sm text-emerald-300 tabular-nums">
                        {entry.missionsOk}
                        <span className="text-zinc-500 font-normal">/{entry.missionsTotal}</span>
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-zinc-500 block">
                        Gros Coups
                      </span>
                      <span className="font-mono font-bold text-sm text-crimson-light tabular-nums">
                        {entry.heistsOk}
                      </span>
                    </div>
                  </div>

                  {entry.unlockedBadges.length > 0 && (
                    <div className="text-[11px] text-gold-light/90 pt-2 border-t border-bronze/25 truncate">
                      ★{' '}
                      {entry.unlockedBadges
                        .map((k) => DISTINCTION_LABEL_MAP.get(k)?.title || k)
                        .join(' · ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* FILTRES & TRI */}
        <div className="bg-obsidian/75 border border-bronze/40 rounded-xl p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setUnitFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer whitespace-nowrap shrink-0 ${
                unitFilter === 'ALL'
                  ? 'bg-crimson text-white border-crimson-light'
                  : 'bg-charcoal text-zinc-300 border-gunmetal hover:border-bronze'
              }`}
            >
              Tous ({leaderboard.length})
            </button>
            {(Object.keys(HIER_UNITS) as HierarchyUnitKey[]).map((uKey) => (
              <button
                key={uKey}
                type="button"
                onClick={() => setUnitFilter(uKey)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition cursor-pointer whitespace-nowrap shrink-0 ${
                  unitFilter === uKey
                    ? 'bg-gold text-obsidian border-gold font-bold'
                    : 'bg-charcoal text-zinc-300 border-gunmetal hover:border-bronze'
                }`}
              >
                {HIER_UNITS[uKey]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <SlidersHorizontal className="w-3.5 h-3.5 text-gold shrink-0" />
            <span className="text-[11px] text-zinc-400 font-semibold whitespace-nowrap">
              Trier par :
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="bg-charcoal border border-bronze/60 focus:border-gold rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
            >
              <option value="points">Points totaux</option>
              <option value="missions">Missions réussies</option>
              <option value="heists">Gros Coups réussis</option>
              <option value="revenue">Gains nets (mat. déduit)</option>
              <option value="weapons">Arsenal détenu ($)</option>
            </select>
          </div>
        </div>

        {/* TABLEAU DE CLASSEMENT COMPLET */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-bronze/50 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                <th className="py-3 px-3 text-center w-14">Rang</th>
                <th className="py-3 px-3">Membre &amp; Grade</th>
                <th className="py-3 px-3 text-center">Missions</th>
                <th className="py-3 px-3 text-center">Gros Coups</th>
                <th
                  className="py-3 px-3 text-right"
                  title="Part par participant après déduction du matériel utilisé et des pertes"
                >
                  Gains nets
                </th>
                <th className="py-3 px-3 text-right">Arsenal détenu</th>
                <th className="py-3 px-3 text-right">Score Total</th>
                {!readonly && <th className="py-3 px-3 text-right">Direction</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-bronze/25 text-xs tabular-nums">
              {filteredAndSorted.map((entry) => {
                const isEditing = editingMemberId === entry.member.id;
                const badgeNames = entry.unlockedBadges
                  .map((k) => DISTINCTION_LABEL_MAP.get(k)?.title || k)
                  .join(' · ');

                return (
                  <React.Fragment key={entry.member.id}>
                    <tr
                      className={`transition ${
                        entry.rank === 1
                          ? 'bg-gold/5 hover:bg-gold/10'
                          : 'hover:bg-slateDark/60'
                      }`}
                    >
                      <td className="py-3 px-3 text-center font-display font-extrabold text-sm">
                        <span
                          className={
                            entry.rank === 1
                              ? 'text-gold'
                              : entry.rank === 2
                                ? 'text-gold-light'
                                : entry.rank === 3
                                  ? 'text-zinc-200'
                                  : 'text-zinc-500'
                          }
                        >
                          #{entry.rank}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-sm text-white flex items-center gap-2 flex-wrap">
                          <span>{entry.member.name}</span>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-gold-light">
                            {entry.levelTitle}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-0.5">
                          {HIER_UNITS[entry.member.unit]}
                          {badgeNames && (
                            <span className="text-gold/90"> · ★ {badgeNames}</span>
                          )}
                        </div>
                        {entry.note && (
                          <div className="text-[11px] text-zinc-300 italic mt-0.5">
                            &ldquo;{entry.note}&rdquo;
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center font-mono">
                        <span className="text-emerald-400 font-bold">{entry.missionsOk}</span>
                        <span className="text-zinc-600 mx-0.5">/</span>
                        <span className="text-crimson-light font-bold">{entry.missionsKo}</span>
                        <span className="text-[10px] text-zinc-500 block">
                          {entry.missionsTotal} op.
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-gold-light">
                        {entry.heistsOk}
                      </td>
                      <td className="py-3 px-3 text-right font-mono">
                        <span className={`font-semibold ${netClass(entry.estimatedRevenue)}`}>
                          {formatSigned(entry.estimatedRevenue)}
                        </span>
                        {(entry.materialCostShare > 0 || entry.lossShare > 0) && (
                          <span className="block text-[10px] text-zinc-500">
                            Brut {formatMoney(entry.grossRevenue)} · Mat. -{formatMoney(entry.materialCostShare)}
                            {entry.lossShare > 0 && ` · Pertes -${formatMoney(entry.lossShare)}`}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-zinc-300">
                        {entry.weaponsHeldCount > 0 ? (
                          <span>
                            {entry.weaponsHeldCount} arme{entry.weaponsHeldCount > 1 ? 's' : ''}{' '}
                            <span className="text-gold block text-[10px]">
                              {formatMoney(entry.weaponsHeldValue)}
                            </span>
                          </span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono">
                        <span className="text-sm font-extrabold text-gold">
                          {entry.totalPoints} pts
                        </span>
                        {entry.bonusPoints !== 0 && (
                          <span
                            className={`block text-[10px] ${
                              entry.bonusPoints > 0 ? 'text-emerald-400' : 'text-crimson-light'
                            }`}
                          >
                            {entry.autoPoints} auto{' '}
                            {entry.bonusPoints > 0 ? `+${entry.bonusPoints}` : entry.bonusPoints}
                          </span>
                        )}
                      </td>
                      {!readonly && (
                        <td className="py-3 px-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => applyQuickBonus(entry, 50)}
                              title="Ajouter +50 pts de mérite"
                              className="px-2 py-1 rounded text-[11px] font-mono font-bold bg-obsidian border border-bronze/50 hover:border-gold text-emerald-300 cursor-pointer"
                            >
                              +50
                            </button>
                            <button
                              type="button"
                              onClick={() => applyQuickBonus(entry, -50)}
                              title="Retirer -50 pts"
                              className="px-2 py-1 rounded text-[11px] font-mono font-bold bg-obsidian border border-bronze/50 hover:border-crimson-light text-red-300 cursor-pointer"
                            >
                              -50
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditor(entry)}
                              className={`px-2.5 py-1 rounded text-[11px] font-bold border transition cursor-pointer ${
                                isEditing
                                  ? 'bg-crimson text-white border-crimson-light'
                                  : 'bg-obsidian text-gold-light border-gold/40 hover:border-gold'
                              }`}
                            >
                              {isEditing ? 'Fermer' : 'Médailles'}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>

                    {!readonly && isEditing && (
                      <tr className="bg-obsidian/95">
                        <td colSpan={8} className="p-4 border-b border-gold/30">
                          <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <span className="font-display text-sm font-bold text-gold">
                                Évaluation &amp; Distinctions — {entry.member.name}
                              </span>
                              <span className="text-[11px] text-zinc-400 font-mono">
                                Points auto (missions) : {entry.autoPoints} pts
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                                  Bonus / Malus manuel (pts)
                                </label>
                                <input
                                  type="number"
                                  step="25"
                                  value={draftBonus}
                                  onChange={(e) => setDraftBonus(e.target.value)}
                                  className="w-full bg-charcoal border border-bronze/60 focus:border-gold rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none"
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                                  Note / Appréciation Direction
                                </label>
                                <input
                                  type="text"
                                  maxLength={160}
                                  value={draftNote}
                                  onChange={(e) => setDraftNote(e.target.value)}
                                  placeholder="Ex : Exemplaire sur le Pacific, très fiable..."
                                  className="w-full bg-charcoal border border-bronze/60 focus:border-gold rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                                Distinctions / Médailles officielles Los Cerberos
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {DISTINCTION_DEFS.map((def) => {
                                  const isAuto = entry.autoBadges.includes(def.key);
                                  const isManual = draftManualBadges.includes(def.key);
                                  const active = isAuto || isManual;
                                  return (
                                    <button
                                      key={def.key}
                                      type="button"
                                      disabled={isAuto}
                                      onClick={() => toggleDraftBadge(def.key)}
                                      className={`text-left rounded-xl border px-3 py-2 transition flex items-start gap-2.5 ${
                                        active
                                          ? 'bg-gold/15 border-gold text-gold-light'
                                          : 'bg-charcoal/80 border-gunmetal text-zinc-400 hover:border-bronze'
                                      } ${isAuto ? 'cursor-default' : 'cursor-pointer'}`}
                                    >
                                      <Star
                                        className={`w-4 h-4 mt-0.5 shrink-0 ${
                                          active ? 'text-gold fill-gold/40' : 'text-zinc-600'
                                        }`}
                                      />
                                      <div className="min-w-0">
                                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                          <span>{def.title}</span>
                                          {isAuto && (
                                            <span className="text-[9px] font-mono text-emerald-300">
                                              (Auto)
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-[10px] text-zinc-400 leading-snug">
                                          {def.subtitle}
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-bronze/30">
                              <button
                                type="button"
                                onClick={() => setEditingMemberId(null)}
                                className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-charcoal border border-gunmetal text-zinc-300 hover:text-white cursor-pointer"
                              >
                                Annuler
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEditor(entry.member.id)}
                                className="px-4 py-2 rounded-lg text-xs font-bold bg-gold hover:bg-gold-light text-obsidian transition cursor-pointer"
                              >
                                Enregistrer l&apos;évaluation
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* BARÈME & DISTINCTIONS DE RÉFÉRENCE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-charcoal/90 bronze-border rounded-2xl p-5 space-y-3">
          <h3 className="font-display text-sm font-bold uppercase tracking-wider text-gold flex items-center gap-2">
            <Shield className="w-4 h-4 text-crimson-light" />
            Barème des Points &amp; Grades d&apos;Ancienneté
          </h3>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums">
            <div className="bg-obsidian/80 border border-bronze/30 rounded-lg px-3 py-2 flex justify-between">
              <span className="font-sans text-zinc-300">Opération réussie</span>
              <span className="text-emerald-400 font-bold">+100 pts</span>
            </div>
            <div className="bg-obsidian/80 border border-bronze/30 rounded-lg px-3 py-2 flex justify-between">
              <span className="font-sans text-zinc-300">Gros Coup réussi</span>
              <span className="text-gold font-bold">+250 pts</span>
            </div>
            <div className="bg-obsidian/80 border border-bronze/30 rounded-lg px-3 py-2 flex justify-between">
              <span className="font-sans text-zinc-300">Présence / Échec</span>
              <span className="text-zinc-300 font-bold">+25 pts</span>
            </div>
            <div className="bg-obsidian/80 border border-bronze/30 rounded-lg px-3 py-2 flex justify-between">
              <span className="font-sans text-zinc-300">Bonus / Malus</span>
              <span className="text-gold-light font-bold">Direction</span>
            </div>
          </div>
          <div className="text-[11px] text-zinc-400 pt-1">
            Niveaux :{' '}
            {[...RANK_LEVELS]
              .reverse()
              .map((l) => `${l.title} (${l.minPoints}+)`)
              .join(' · ')}
          </div>
        </div>

        <div className="bg-charcoal/90 bronze-border rounded-2xl p-5 space-y-3">
          <h3 className="font-display text-sm font-bold uppercase tracking-wider text-gold flex items-center gap-2">
            <Award className="w-4 h-4 text-gold" />
            Distinctions &amp; Médailles Officielles
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {DISTINCTION_DEFS.map((def) => (
              <div
                key={def.key}
                className="bg-obsidian/80 border border-bronze/30 rounded-lg px-3 py-2"
              >
                <div className="font-bold text-gold-light">{def.title}</div>
                <div className="text-[11px] text-zinc-400">
                  {def.autoRule || def.subtitle}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
