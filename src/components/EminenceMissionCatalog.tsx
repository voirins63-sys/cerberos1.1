import React, { useMemo, useState } from 'react';
import {
  Check,
  Edit3,
  KeyRound,
  Package,
  Search,
  Sparkles,
  Trash2,
  Wine,
  Wrench,
} from 'lucide-react';
import {
  EMINENCE_KEY_ITEM_IDS,
  EMINENCE_MISSIONS,
  EMINENCE_UTILITY_ITEM_IDS,
  type EminenceMissionRequirement,
} from '@/src/data/eminenceMissions';
import { INVENTORY_ITEMS } from '@/src/data/cartelData';
import type {
  CatalogGroup,
  CatalogItem,
  InventoryPrices,
  InventoryStock,
  RewardStocks,
} from '@/src/types/cartel';
import {
  formatMoney,
  getCatalogStockKey,
  resolveCatalogSellItemPrice,
} from '@/src/utils/finance';

type MissionFilterMode = 'ALL' | 'major' | 'standard' | 'singles';

interface EminenceMissionCatalogProps {
  group: CatalogGroup;
  cart: Record<string, number>;
  inventoryStock: InventoryStock;
  inventoryPrices?: InventoryPrices;
  rewardStocks?: RewardStocks;
  onAdjustItem: (itemId: string, delta: number) => void;
  readonly: boolean;
  onEditItem?: (item: CatalogItem) => void;
  onDeleteItem?: (itemId: string) => void;
}

function getStockInfo(
  item: CatalogItem | undefined,
  inventoryStock: InventoryStock
): { stockQty: number; label: string | null } {
  if (!item || item.tradeType !== 'sell') return { stockQty: 0, label: null };
  if (item.linkedGearKey) {
    const invName =
      INVENTORY_ITEMS.find((inv) => inv.key === item.linkedGearKey)?.name || item.name;
    return {
      stockQty: Math.max(0, Number(inventoryStock[item.linkedGearKey]) || 0),
      label: invName,
    };
  }
  if (item.category !== 'reparation' && item.category !== 'butin') {
    const key = getCatalogStockKey(item.id);
    return {
      stockQty: Math.max(0, Number(inventoryStock[key]) || 0),
      label: item.name,
    };
  }
  return { stockQty: 0, label: null };
}

export const EminenceMissionCatalog: React.FC<EminenceMissionCatalogProps> = ({
  group,
  cart,
  inventoryStock,
  inventoryPrices,
  rewardStocks,
  onAdjustItem,
  readonly,
  onEditItem,
  onDeleteItem,
}) => {
  const [filterMode, setFilterMode] = useState<MissionFilterMode>('ALL');
  const [search, setSearch] = useState('');

  const itemsById = useMemo(() => {
    const map = new Map<string, CatalogItem>();
    group.items.forEach((it) => map.set(it.id, it));
    return map;
  }, [group.items]);

  const curatedIds = useMemo(() => {
    const set = new Set<string>();
    EMINENCE_MISSIONS.forEach((m) => {
      if (m.packItemId) set.add(m.packItemId);
      m.requirements.forEach((r) => set.add(r.itemId));
    });
    EMINENCE_KEY_ITEM_IDS.forEach((id) => set.add(id));
    EMINENCE_UTILITY_ITEM_IDS.forEach((id) => set.add(id));
    set.add('em_whiskey');
    return set;
  }, []);

  const customExtraItems = useMemo(
    () => group.items.filter((it) => !curatedIds.has(it.id)),
    [group.items, curatedIds]
  );

  const normalizedQuery = search
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const visibleMissions = useMemo(() => {
    if (filterMode === 'singles') return [];
    return EMINENCE_MISSIONS.filter((m) => {
      if (filterMode === 'major' && !m.major) return false;
      if (filterMode === 'standard' && m.major) return false;
      if (normalizedQuery) {
        const reqNames = m.requirements
          .map((r) => itemsById.get(r.itemId)?.name || '')
          .join(' ');
        const packName = m.packItemId ? itemsById.get(m.packItemId)?.name || '' : '';
        const hay = `${m.code} ${m.title} ${m.summary} ${packName} ${reqNames}`
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        if (!hay.includes(normalizedQuery)) return false;
      }
      return true;
    });
  }, [filterMode, normalizedQuery, itemsById]);

  const keyItems = useMemo(
    () =>
      group.items.filter((it) => {
        if (!EMINENCE_KEY_ITEM_IDS.has(it.id)) return false;
        if (!normalizedQuery) return true;
        const hay = `${it.name} ${it.notes}`
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        return hay.includes(normalizedQuery);
      }),
    [group.items, normalizedQuery]
  );

  const utilityItems = useMemo(
    () =>
      group.items.filter((it) => {
        if (!EMINENCE_UTILITY_ITEM_IDS.has(it.id)) return false;
        if (!normalizedQuery) return true;
        const hay = `${it.name} ${it.notes}`
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        return hay.includes(normalizedQuery);
      }),
    [group.items, normalizedQuery]
  );

  const whiskeyItem = itemsById.get('em_whiskey');

  const handleAddMissingComponents = (reqs: EminenceMissionRequirement[]) => {
    reqs.forEach((req) => {
      const item = itemsById.get(req.itemId);
      if (!item) return;
      const { stockQty } = getStockInfo(item, inventoryStock);
      const inCart = Math.max(0, Math.floor(Number(cart[item.id]) || 0));
      const missing = Math.max(0, req.qty - stockQty - inCart);
      if (missing > 0) {
        onAdjustItem(item.id, missing);
      }
    });
  };

  return (
    <div className="space-y-5">
      {/* BARRE ERGONOMIQUE DE FILTRAGE */}
      <div className="bg-obsidian/80 border border-gold/30 rounded-xl p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setFilterMode('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
              filterMode === 'ALL'
                ? 'bg-gold text-obsidian border-gold'
                : 'bg-charcoal text-zinc-300 border-bronze/45 hover:border-gold/50'
            }`}
          >
            Toutes les missions ({EMINENCE_MISSIONS.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('major')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
              filterMode === 'major'
                ? 'bg-crimson/25 text-red-200 border-crimson-light'
                : 'bg-charcoal text-zinc-300 border-bronze/40 hover:border-bronze'
            }`}
          >
            Gros Coups
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('standard')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
              filterMode === 'standard'
                ? 'bg-amber-500/20 text-amber-200 border-amber-400'
                : 'bg-charcoal text-zinc-300 border-bronze/40 hover:border-bronze'
            }`}
          >
            Missions rapides
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('singles')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
              filterMode === 'singles'
                ? 'bg-sky-500/20 text-sky-200 border-sky-400'
                : 'bg-charcoal text-zinc-300 border-bronze/40 hover:border-bronze'
            }`}
          >
            Clés &amp; Items seuls ({keyItems.length + utilityItems.length})
          </button>
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Mission, clé, bombe, perceuse..."
            className="w-full bg-charcoal border border-bronze/50 focus:border-gold rounded-lg pl-8 pr-3 py-1.5 text-xs text-white outline-none"
          />
        </div>
      </div>

      {/* CARTES PAR MISSION (PACK COMPLET + DÉTAIL À L'UNITÉ EN DESSOUS) */}
      {filterMode !== 'singles' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-xs font-bold uppercase tracking-wider text-gold flex items-center gap-2">
              <Package className="w-4 h-4" />
              Missions — Achetez le Pack complet ou les items seuls en dessous
            </div>
            <span className="text-[11px] text-zinc-400">
              Le stock déjà présent au coffre est affiché en vert sur chaque besoin
            </span>
          </div>

          {visibleMissions.length === 0 ? (
            <div className="bg-obsidian/60 border border-bronze/35 rounded-xl p-6 text-center text-xs text-zinc-400">
              Aucune mission ne correspond à votre recherche.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {visibleMissions.map((mission) => {
                const packItem = mission.packItemId
                  ? itemsById.get(mission.packItemId)
                  : undefined;
                const packQty = packItem
                  ? Math.max(0, Math.floor(Number(cart[packItem.id]) || 0))
                  : 0;
                const packStock = getStockInfo(packItem, inventoryStock);

                // Compute individual sum & missing components
                let singleTotal = 0;
                let missingCount = 0;
                let missingCost = 0;
                let allReqInStock = mission.requirements.length > 0;
                const packPrice = packItem
                  ? resolveCatalogSellItemPrice(packItem, inventoryPrices)
                  : 0;

                const resolvedReqs = mission.requirements
                  .map((req) => {
                    const comp = itemsById.get(req.itemId);
                    if (!comp) return null;
                    const compPrice = resolveCatalogSellItemPrice(comp, inventoryPrices);
                    const compStock = getStockInfo(comp, inventoryStock);
                    const compCart = Math.max(0, Math.floor(Number(cart[comp.id]) || 0));
                    const stillNeeded = Math.max(0, req.qty - compStock.stockQty - compCart);
                    if (compStock.stockQty < req.qty) {
                      allReqInStock = false;
                    }
                    if (stillNeeded > 0) {
                      missingCount += stillNeeded;
                      missingCost += stillNeeded * compPrice;
                    }
                    singleTotal += req.qty * compPrice;
                    return { req, comp, compPrice, compStock, compCart };
                  })
                  .filter(
                    (
                      x
                    ): x is {
                      req: EminenceMissionRequirement;
                      comp: CatalogItem;
                      compPrice: number;
                      compStock: { stockQty: number; label: string | null };
                      compCart: number;
                    } => x !== null
                  );

                const hasCartForMission =
                  packQty > 0 || resolvedReqs.some((r) => r.compCart > 0);
                const packSavings =
                  packItem && singleTotal > packPrice
                    ? singleTotal - packPrice
                    : 0;

                return (
                  <div
                    key={mission.code}
                    className={`bg-obsidian/90 border rounded-xl overflow-hidden flex flex-col justify-between transition ${
                      hasCartForMission
                        ? 'border-gold/75 ring-1 ring-gold/30'
                        : mission.major
                          ? 'border-gold/35 hover:border-gold/55'
                          : 'border-bronze/40 hover:border-gold/45'
                    }`}
                  >
                    {/* EN-TÊTE MISSION + ACHAT EN PACK */}
                    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-charcoal/55 border-b border-bronze/30">
                      <div className="flex items-start gap-3 min-w-0">
                        <span
                          className={`font-mono text-xs font-extrabold px-2.5 py-1.5 rounded-lg border shrink-0 tabular-nums ${
                            mission.major
                              ? 'bg-gold/15 text-gold-light border-gold/45'
                              : 'bg-charcoal text-zinc-300 border-bronze/45'
                          }`}
                        >
                          {mission.code}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-display font-bold text-base text-white">
                              {mission.title}
                            </h4>
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider ${
                                mission.major ? 'text-gold' : 'text-zinc-400'
                              }`}
                            >
                              {mission.major ? '· Gros Coup' : '· Mission'}
                            </span>
                          </div>
                          <div className="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-2 flex-wrap tabular-nums">
                            <span>{mission.summary}</span>
                            {packItem && packStock.label && (
                              <span
                                className={`font-mono font-semibold ${
                                  packStock.stockQty > 0
                                    ? 'text-emerald-300'
                                    : 'text-zinc-500'
                                }`}
                              >
                                · Coffre pack : {packStock.stockQty}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {packItem ? (
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <div className="text-right mr-1 tabular-nums">
                            <div className="font-mono text-sm font-extrabold text-gold">
                              {formatMoney(packPrice)}
                            </div>
                            {packSavings > 0 && (
                              <div className="text-[10px] font-mono text-emerald-300">
                                -{formatMoney(packSavings)} en pack
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={packQty <= 0}
                              onClick={() => onAdjustItem(packItem.id, -1)}
                              className="w-7 h-7 rounded-lg bg-gunmetal hover:bg-bronze disabled:opacity-35 text-white font-bold flex items-center justify-center cursor-pointer"
                            >
                              -
                            </button>
                            <span
                              className={`font-mono text-xs font-extrabold w-6 text-center tabular-nums ${
                                packQty > 0 ? 'text-gold' : 'text-zinc-500'
                              }`}
                            >
                              {packQty}
                            </span>
                            <button
                              type="button"
                              onClick={() => onAdjustItem(packItem.id, 1)}
                              className="px-2.5 h-7 rounded-lg bg-gold hover:bg-gold-light text-obsidian text-xs font-bold flex items-center justify-center cursor-pointer whitespace-nowrap"
                              title="Ajouter 1 pack complet au panier"
                            >
                              + Pack
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span className="text-[11px] font-mono text-zinc-400 shrink-0">
                          Achat à l&apos;unité ci-dessous
                        </span>
                      )}
                    </div>

                    {/* DÉTAIL DES ITEMS NÉCESSAIRES EN DESSOUS (ACHAT SEUL À L'UNITÉ) */}
                    <div className="p-3.5 space-y-2">
                      {resolvedReqs.length === 0 ? (
                        <div className="text-[11px] text-zinc-400 flex items-center justify-between gap-2 px-1 py-1">
                          <span>Kit dédié complet fourni directement dans le Pack ci-dessus.</span>
                          <span className="font-mono text-gold-light font-semibold">
                            {packItem ? formatMoney(packPrice) : ''}
                          </span>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between gap-2 px-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                              Détail requis pour 1 mission (acheter seul)
                            </span>
                            {resolvedReqs.length > 1 && missingCount > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleAddMissingComponents(mission.requirements)
                                }
                                className="text-[11px] font-bold text-amber-300 hover:text-gold-light flex items-center gap-1 cursor-pointer tabular-nums"
                                title="Ajoute au panier uniquement les items manquants compte tenu de votre stock en coffre"
                              >
                                <Sparkles className="w-3 h-3" />
                                Compléter manquants ({formatMoney(missingCost)})
                              </button>
                            )}
                            {resolvedReqs.length > 0 && allReqInStock && (
                              <span className="text-[10px] font-bold text-emerald-300 flex items-center gap-1">
                                <Check className="w-3 h-3" /> Tout en coffre
                              </span>
                            )}
                          </div>

                          <div className="divide-y divide-bronze/20 border border-bronze/30 rounded-lg bg-charcoal/40">
                            {resolvedReqs.map(({ req, comp, compPrice, compStock, compCart }) => {
                              const enoughInVault = compStock.stockQty >= req.qty;
                              return (
                                <div
                                  key={`${mission.code}-${comp.id}`}
                                  className={`px-3 py-2 flex items-center justify-between gap-2 text-xs tabular-nums ${
                                    compCart > 0 ? 'bg-gold/10' : ''
                                  }`}
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-mono text-[11px] font-bold text-gold-light">
                                        {req.qty}&times;
                                      </span>
                                      <span className="font-semibold text-zinc-100 truncate">
                                        {comp.name}
                                      </span>
                                      <span className="font-mono text-[11px] text-zinc-400">
                                        ({formatMoney(compPrice)}/u)
                                      </span>
                                    </div>
                                    <div className="text-[10px] mt-0.5 flex items-center gap-2">
                                      <span
                                        className={`font-mono ${
                                          enoughInVault
                                            ? 'text-emerald-300 font-semibold'
                                            : compStock.stockQty > 0
                                              ? 'text-amber-300'
                                              : 'text-zinc-500'
                                        }`}
                                      >
                                        Coffre : {compStock.stockQty}
                                        {enoughInVault ? ' (OK)' : ` / ${req.qty} requis`}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      disabled={compCart <= 0}
                                      onClick={() => onAdjustItem(comp.id, -1)}
                                      className="w-6 h-6 rounded bg-gunmetal hover:bg-bronze disabled:opacity-35 text-white font-bold flex items-center justify-center cursor-pointer"
                                    >
                                      -
                                    </button>
                                    <span
                                      className={`font-mono text-xs font-extrabold w-6 text-center ${
                                        compCart > 0 ? 'text-gold' : 'text-zinc-500'
                                      }`}
                                    >
                                      {compCart}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => onAdjustItem(comp.id, 1)}
                                      className="px-2 h-6 rounded bg-gunmetal hover:bg-gold hover:text-obsidian text-zinc-100 text-[11px] font-bold flex items-center justify-center cursor-pointer"
                                      title={`Ajouter 1× ${comp.name} seul (${formatMoney(compPrice)})`}
                                    >
                                      +1
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CLÉS & ITEMS UTILITAIRES À L'UNITÉ (DIRECT) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* COLONNE 1 : CLÉS & ACCÈS */}
        <div className="bg-obsidian/85 border border-bronze/40 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-bronze/30">
            <h4 className="font-display text-sm font-bold text-gold-light flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-gold" />
              Clés &amp; Accès à l&apos;unité ({keyItems.length})
            </h4>
            <span className="text-[10px] font-mono text-zinc-400">Stock illimité</span>
          </div>

          <div className="divide-y divide-bronze/20">
            {keyItems.map((it) => {
              const qty = Math.max(0, Math.floor(Number(cart[it.id]) || 0));
              const stock = getStockInfo(it, inventoryStock);
              const unitPrice = resolveCatalogSellItemPrice(it, inventoryPrices);
              return (
                <div
                  key={it.id}
                  className={`py-2 px-2 rounded-lg flex items-center justify-between gap-2 text-xs tabular-nums ${
                    qty > 0 ? 'bg-gold/10' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-white truncate">{it.name}</div>
                    <div className="text-[10px] text-zinc-400 flex items-center gap-2">
                      <span className="font-mono text-gold font-bold">
                        {formatMoney(unitPrice)}
                      </span>
                      <span
                        className={`font-mono ${
                          stock.stockQty > 0 ? 'text-emerald-300' : 'text-zinc-500'
                        }`}
                      >
                        · Coffre : {stock.stockQty}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={qty <= 0}
                      onClick={() => onAdjustItem(it.id, -1)}
                      className="w-6 h-6 rounded bg-gunmetal hover:bg-bronze disabled:opacity-35 text-white font-bold flex items-center justify-center cursor-pointer"
                    >
                      -
                    </button>
                    <span
                      className={`font-mono text-xs font-extrabold w-6 text-center ${
                        qty > 0 ? 'text-gold' : 'text-zinc-500'
                      }`}
                    >
                      {qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => onAdjustItem(it.id, 1)}
                      className="w-6 h-6 rounded bg-gunmetal hover:bg-gold hover:text-obsidian text-white font-bold flex items-center justify-center cursor-pointer"
                    >
                      +
                    </button>
                    {!readonly && onEditItem && (
                      <button
                        type="button"
                        onClick={() => onEditItem(it)}
                        className="p-1 ml-1 rounded bg-charcoal border border-gunmetal text-zinc-400 hover:text-gold cursor-pointer"
                        title="Modifier le tarif"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* COLONNE 2 : ITEMS UTILITAIRES + WHISKEY */}
        <div className="space-y-4">
          <div className="bg-obsidian/85 border border-bronze/40 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-bronze/30">
              <h4 className="font-display text-sm font-bold text-gold-light flex items-center gap-2">
                <Wrench className="w-4 h-4 text-gold" />
                Items utilitaires à l&apos;unité ({utilityItems.length})
              </h4>
              <span className="text-[10px] font-mono text-zinc-400">Stock illimité</span>
            </div>

            <div className="divide-y divide-bronze/20">
              {utilityItems.map((it) => {
                const qty = Math.max(0, Math.floor(Number(cart[it.id]) || 0));
                const stock = getStockInfo(it, inventoryStock);
                const unitPrice = resolveCatalogSellItemPrice(it, inventoryPrices);
                return (
                  <div
                    key={it.id}
                    className={`py-2 px-2 rounded-lg flex items-center justify-between gap-2 text-xs tabular-nums ${
                      qty > 0 ? 'bg-gold/10' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-white truncate">{it.name}</div>
                      <div className="text-[10px] text-zinc-400 flex items-center gap-2">
                        <span className="font-mono text-gold font-bold">
                          {formatMoney(unitPrice)}
                        </span>
                        <span
                          className={`font-mono ${
                            stock.stockQty > 0 ? 'text-emerald-300' : 'text-zinc-500'
                          }`}
                        >
                          · Coffre : {stock.stockQty}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={qty <= 0}
                        onClick={() => onAdjustItem(it.id, -1)}
                        className="w-6 h-6 rounded bg-gunmetal hover:bg-bronze disabled:opacity-35 text-white font-bold flex items-center justify-center cursor-pointer"
                      >
                        -
                      </button>
                      <span
                        className={`font-mono text-xs font-extrabold w-6 text-center ${
                          qty > 0 ? 'text-gold' : 'text-zinc-500'
                        }`}
                      >
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => onAdjustItem(it.id, 1)}
                        className="w-6 h-6 rounded bg-gunmetal hover:bg-gold hover:text-obsidian text-white font-bold flex items-center justify-center cursor-pointer"
                      >
                        +
                      </button>
                      {!readonly && onEditItem && (
                        <button
                          type="button"
                          onClick={() => onEditItem(it)}
                          className="p-1 ml-1 rounded bg-charcoal border border-gunmetal text-zinc-400 hover:text-gold cursor-pointer"
                          title="Modifier le tarif"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {whiskeyItem && (
            <div className="bg-obsidian/85 border border-emerald-500/40 rounded-xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0">
                  <Wine className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                    Rachat par Éminences
                  </div>
                  <div className="font-bold text-sm text-white truncate">
                    {whiskeyItem.name}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono text-base font-extrabold text-emerald-300 tabular-nums">
                  {formatMoney(
                    rewardStocks?.whiskey_luxe?.val !== undefined
                      ? Math.max(0, Number(rewardStocks.whiskey_luxe.val) || 0)
                      : whiskeyItem.price
                  )}
                </div>
                <div className="text-[10px] text-zinc-400">par bouteille</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ARTICLES PERSONNALISÉS AJOUTÉS EN PLUS */}
      {customExtraItems.length > 0 && (
        <div className="bg-obsidian/85 border border-bronze/40 rounded-xl p-4 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-zinc-300">
            Autres articles ajoutés à Éminences ({customExtraItems.length})
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {customExtraItems.map((it) => {
              const isSell = it.tradeType === 'sell';
              const qty = isSell ? Math.max(0, Math.floor(Number(cart[it.id]) || 0)) : 0;
              const unitPrice = isSell
                ? resolveCatalogSellItemPrice(it, inventoryPrices)
                : Math.max(0, Number(it.price) || 0);
              return (
                <div
                  key={it.id}
                  className="bg-charcoal/80 border border-bronze/40 rounded-lg p-3 flex items-center justify-between gap-2 text-xs tabular-nums"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-white truncate">{it.name}</div>
                    <div className="text-[11px] text-zinc-400">
                      {isSell ? 'Vend' : 'Rachète'} ·{' '}
                      <span className="font-mono text-gold font-bold">
                        {formatMoney(unitPrice)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isSell && (
                      <>
                        <button
                          type="button"
                          disabled={qty <= 0}
                          onClick={() => onAdjustItem(it.id, -1)}
                          className="w-6 h-6 rounded bg-gunmetal hover:bg-bronze disabled:opacity-35 text-white font-bold flex items-center justify-center cursor-pointer"
                        >
                          -
                        </button>
                        <span className="font-mono text-xs font-bold w-5 text-center text-gold">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => onAdjustItem(it.id, 1)}
                          className="w-6 h-6 rounded bg-gunmetal hover:bg-gold hover:text-obsidian text-white font-bold flex items-center justify-center cursor-pointer"
                        >
                          +
                        </button>
                      </>
                    )}
                    {!readonly && onEditItem && (
                      <button
                        type="button"
                        onClick={() => onEditItem(it)}
                        className="p-1 rounded bg-obsidian border border-gunmetal text-zinc-400 hover:text-gold cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    )}
                    {!readonly && onDeleteItem && (
                      <button
                        type="button"
                        onClick={() => onDeleteItem(it.id)}
                        className="p-1 rounded bg-obsidian border border-gunmetal text-zinc-400 hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
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
