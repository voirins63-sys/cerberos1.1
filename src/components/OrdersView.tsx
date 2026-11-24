import React, { useMemo, useState } from 'react';
import { BookOpen, Phone } from 'lucide-react';
import { EminenceMissionCatalog } from '@/src/components/EminenceMissionCatalog';
import { CATALOG_ITEM_CATEGORY_LABELS, INVENTORY_ITEMS } from '@/src/data/cartelData';
import { OrderPreparationPanel } from '@/src/components/OrderPreparationPanel';
import type {
  CatalogGroup,
  CatalogGroupsMap,
  InventoryPrices,
  InventoryStock,
  MissionScheduleMeta,
  MissionStates,
  TreasuryMoney,
} from '@/src/types/cartel';
import {
  formatMoney,
  getInventoryItemPrice,
  resolveCatalogSellItemPrice,
} from '@/src/utils/finance';

interface OrdersViewProps {
  missionStates: MissionStates;
  scheduleMeta?: MissionScheduleMeta;
  inventoryStock: InventoryStock;
  inventoryPrices: InventoryPrices;
  treasuryMoney: TreasuryMoney;
  catalogGroups: CatalogGroupsMap;
  selectedCatalogGroupId: string;
  onSelectCatalogGroupId: (groupId: string) => void;
  groupOrderCarts: Record<string, Record<string, number>>;
  onAdjustGroupOrderItem: (groupId: string, itemId: string, delta: number) => void;
  onClearGroupOrder: (groupId: string) => void;
  onConfirmGroupOrder: (
    group: CatalogGroup,
    cartMap: Record<string, number>,
    debitAccount: 'none' | 'legal' | 'illegal'
  ) => void;
  onOpenCatalog: (groupId?: string) => void;
  onSendToEminenceCart?: (
    catalogItemsQty: Record<string, number>,
    options?: { navigateToOrders?: boolean; replaceCart?: boolean }
  ) => void;
  readonly: boolean;
  onReceiveOrder: (
    orderMap: Record<string, number>,
    debitAccount: 'none' | 'legal' | 'illegal',
    debitAmount: number
  ) => void;
  onUpdateItemPrice: (key: string, price: number) => void;
  onShowToast: (msg: string) => void;
}

type OrderSectionFilter = 'ALL' | 'heist' | 'ammo' | 'catalog';

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

export const OrdersView: React.FC<OrdersViewProps> = ({
  missionStates,
  scheduleMeta,
  inventoryStock,
  inventoryPrices,
  treasuryMoney,
  catalogGroups,
  selectedCatalogGroupId,
  onSelectCatalogGroupId,
  groupOrderCarts,
  onAdjustGroupOrderItem,
  onClearGroupOrder,
  onConfirmGroupOrder,
  onOpenCatalog,
  onSendToEminenceCart,
  readonly,
  onReceiveOrder,
  onUpdateItemPrice,
  onShowToast,
}) => {
  const [sectionFilter, setSectionFilter] = useState<OrderSectionFilter>('ALL');

  // --- COMMANDE MUNITIONS (ÉTAT ISOLÉ) ---
  const [ammoOrderCart, setAmmoOrderCart] = useState<Record<string, number>>({});
  const [ammoDebitAccount, setAmmoDebitAccount] = useState<'none' | 'legal' | 'illegal'>('illegal');

  // --- COMMANDE FOURNISSEURS / GROUPES (ÉTAT PARTAGÉ AVEC LE CATALOGUE) ---
  const [groupDebitAccount, setGroupDebitAccount] = useState<'none' | 'legal' | 'illegal'>('illegal');
  const [eminenceOrderMode, setEminenceOrderMode] = useState<'missions' | 'table'>('missions');

  const ammoItems = useMemo(
    () => INVENTORY_ITEMS.filter((i) => i.category === 'protection' && i.key !== 'gilet'),
    []
  );

  const supplierGroups = useMemo(
    () =>
      Object.values(catalogGroups)
        .filter((g) => g.items.some((it) => it.tradeType === 'sell'))
        .sort((a, b) => a.name.localeCompare(b.name, 'fr-FR')),
    [catalogGroups]
  );

  const activeSupplierGroup =
    supplierGroups.find((g) => g.id === selectedCatalogGroupId) || supplierGroups[0] || null;

  const activeGroupCart = useMemo(
    () => (activeSupplierGroup ? groupOrderCarts[activeSupplierGroup.id] || {} : {}),
    [activeSupplierGroup, groupOrderCarts]
  );

  const activeGroupSellItems = useMemo(
    () => (activeSupplierGroup ? activeSupplierGroup.items.filter((i) => i.tradeType === 'sell') : []),
    [activeSupplierGroup]
  );

  const activeGroupSummary = useMemo(() => {
    let totalUnits = 0;
    let totalCost = 0;
    const lines: Array<{ name: string; qty: number; price: number; lineCost: number }> = [];
    activeGroupSellItems.forEach((it) => {
      const qty = Math.max(0, Math.floor(Number(activeGroupCart[it.id]) || 0));
      if (qty > 0) {
        const unitPrice = resolveCatalogSellItemPrice(it, inventoryPrices);
        const lineCost = qty * unitPrice;
        totalUnits += qty;
        totalCost += lineCost;
        lines.push({ name: it.name, qty, price: unitPrice, lineCost });
      }
    });
    return { totalUnits, totalCost, lines };
  }, [activeGroupSellItems, activeGroupCart, inventoryPrices]);

  const totalCatalogCartUnits = useMemo(
    () =>
      Object.values(groupOrderCarts).reduce(
        (sum, cart) =>
          sum +
          Object.values(cart || {}).reduce(
            (s, q) => s + Math.max(0, Number(q) || 0),
            0
          ),
        0
      ),
    [groupOrderCarts]
  );

  const ammoSuppliers = useMemo(
    () =>
      supplierGroups.flatMap((g) =>
        g.items
          .filter((it) => it.tradeType === 'sell' && it.category === 'munitions')
          .map((it) => ({ groupId: g.id, groupName: g.name, item: it }))
      ),
    [supplierGroups]
  );

  const ammoRows = useMemo(() => {
    return ammoItems.map((item) => {
      const inStock = Math.max(0, Math.floor(Number(inventoryStock[item.key]) || 0));
      const unitPrice = getInventoryItemPrice(item.key, inventoryPrices);
      const orderQty = Math.max(0, Math.floor(Number(ammoOrderCart[item.key]) || 0));
      const lineCost = orderQty * unitPrice;
      return {
        item,
        inStock,
        unitPrice,
        orderQty,
        lineCost,
      };
    });
  }, [ammoItems, inventoryStock, inventoryPrices, ammoOrderCart]);

  const ammoSummary = useMemo(() => {
    let totalUnits = 0;
    let totalCost = 0;
    const orderMap: Record<string, number> = {};
    ammoRows.forEach((r) => {
      if (r.orderQty > 0) {
        totalUnits += r.orderQty;
        totalCost += r.lineCost;
        orderMap[r.item.key] = r.orderQty;
      }
    });
    return { totalUnits, totalCost, orderMap };
  }, [ammoRows]);

  const adjustAmmoQty = (key: string, delta: number) => {
    setAmmoOrderCart((prev) => {
      const next = Math.max(0, (Number(prev[key]) || 0) + delta);
      const copy = { ...prev };
      if (next === 0) delete copy[key];
      else copy[key] = next;
      return copy;
    });
  };

  const handleCopyAmmoOrder = async () => {
    let text = '```asciidoc\n';
    text += '= COMMANDE MUNITIONS =\n';
    if (ammoSummary.totalUnits === 0) {
      text += 'Aucune munition sélectionnée dans cette commande.\n';
    } else {
      ammoRows
        .filter((r) => r.orderQty > 0)
        .forEach((r) => {
          text += `- ${r.orderQty}x ${r.item.name} (${formatMoney(r.unitPrice)}/u) = ${formatMoney(r.lineCost)}\n`;
        });
      text += `\nTotal lots/boîtes : ${ammoSummary.totalUnits}\n`;
      text += `COÛT TOTAL MUNITIONS : ${formatMoney(ammoSummary.totalCost)}\n`;
    }
    text += '```';

    const ok = await copyTextToClipboard(text);
    onShowToast(
      ok ? 'Commande munitions copiée dans le presse-papiers !' : 'Erreur de copie.'
    );
  };

  const handleConfirmAmmoReceipt = () => {
    if (readonly || ammoSummary.totalUnits <= 0) return;
    onReceiveOrder(ammoSummary.orderMap, ammoDebitAccount, ammoSummary.totalCost);
    setAmmoOrderCart({});
    setAmmoDebitAccount('illegal');
  };

  const handleCopySupplierOrder = async () => {
    if (!activeSupplierGroup) return;
    let text = '```asciidoc\n';
    text += `= COMMANDE ${activeSupplierGroup.name.toUpperCase()} =\n`;
    if (activeSupplierGroup.contacts.length > 0) {
      const contactLine = activeSupplierGroup.contacts
        .map((c) => `${c.name}${c.phone ? ` (${c.phone})` : ''}`)
        .join(' / ');
      text += `Contact(s) : ${contactLine}\n`;
    }
    text += '\n';
    if (activeGroupSummary.totalUnits === 0) {
      text += 'Aucun article sélectionné dans cette commande.\n';
    } else {
      activeGroupSummary.lines.forEach((l) => {
        text += `- ${l.qty}x ${l.name} (${formatMoney(l.price)}/u) = ${formatMoney(l.lineCost)}\n`;
      });
      text += `\nTotal articles : ${activeGroupSummary.totalUnits}\n`;
      text += `TOTAL COMMANDE : ${formatMoney(activeGroupSummary.totalCost)}\n`;
    }
    text += '```';

    const ok = await copyTextToClipboard(text);
    onShowToast(
      ok ? 'Bon de commande fournisseur copié !' : 'Erreur de copie.'
    );
  };

  return (
    <div className="space-y-6">
      {/* EN-TÊTE & NAVIGATION ENTRE LES 4 PÔLES DE COMMANDE */}
      <div className="bg-charcoal/95 gold-border rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
              <span className="text-gold">🛒</span> Centre des Commandes Cartel
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Circuits séparés : matériel de braquage, munitions et commandes directes aux groupes du Catalogue (gilets, boîtes de munitions, accessoires, réparations...).
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono tabular-nums bg-obsidian/80 border border-bronze/45 rounded-xl px-4 py-2.5 shrink-0">
            <div>
              <span className="text-[10px] uppercase text-zinc-500 block">Argent Sale</span>
              <strong className="text-red-300 font-bold">
                {formatMoney(treasuryMoney.illegal || 0)}
              </strong>
            </div>
            <div className="h-7 w-px bg-bronze/40" />
            <div>
              <span className="text-[10px] uppercase text-zinc-500 block">Argent Légal</span>
              <strong className="text-emerald-300 font-bold">
                {formatMoney(treasuryMoney.legal || 0)}
              </strong>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-bronze/35">
          <button
            type="button"
            onClick={() => setSectionFilter('ALL')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
              sectionFilter === 'ALL'
                ? 'bg-gold text-obsidian border-gold'
                : 'bg-obsidian/80 text-zinc-300 border-bronze/50 hover:border-gold/50'
            }`}
          >
            Tout afficher (3 pôles)
          </button>
          <button
            type="button"
            onClick={() => setSectionFilter('heist')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
              sectionFilter === 'heist'
                ? 'bg-gold/20 text-gold-light border-gold'
                : 'bg-obsidian/80 text-zinc-300 border-bronze/40 hover:border-bronze'
            }`}
          >
            💣 Matériel de Braquage
          </button>
          <button
            type="button"
            onClick={() => setSectionFilter('ammo')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer tabular-nums ${
              sectionFilter === 'ammo'
                ? 'bg-amber-500/20 text-amber-200 border-amber-400'
                : 'bg-obsidian/80 text-zinc-300 border-bronze/40 hover:border-bronze'
            }`}
          >
            🔫 Munitions
            {ammoSummary.totalUnits > 0
              ? ` (${ammoSummary.totalUnits} · ${formatMoney(ammoSummary.totalCost)})`
              : ''}
          </button>
          <button
            type="button"
            onClick={() => setSectionFilter('catalog')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer tabular-nums ${
              sectionFilter === 'catalog'
                ? 'bg-purple-500/20 text-purple-200 border-purple-400'
                : 'bg-obsidian/80 text-zinc-300 border-bronze/40 hover:border-bronze'
            }`}
          >
            📖 Fournisseurs / Catalogue
            {totalCatalogCartUnits > 0 ? ` (${totalCatalogCartUnits})` : ''}
          </button>
        </div>
      </div>

      {/* 1. COMMANDE MATÉRIEL DE BRAQUAGE (ANTICIPATION) */}
      {(sectionFilter === 'ALL' || sectionFilter === 'heist') && (
        <OrderPreparationPanel
          missionStates={missionStates}
          scheduleMeta={scheduleMeta}
          inventoryStock={inventoryStock}
          inventoryPrices={inventoryPrices}
          catalogGroups={catalogGroups}
          treasuryMoney={treasuryMoney}
          readonly={readonly}
          onReceiveOrder={onReceiveOrder}
          onSendToEminenceCart={onSendToEminenceCart}
          onShowToast={onShowToast}
        />
      )}

      {/* 2. COMMANDE MUNITIONS (SECTION SÉPARÉE) */}
      {(sectionFilter === 'ALL' || sectionFilter === 'ammo') && (
        <div
          id="order-ammo-panel"
          className="bg-charcoal/95 border border-amber-500/45 rounded-2xl p-6 shadow-xl space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-bronze/40">
            <div>
              <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
                <span className="text-amber-300">🔫</span> Commande de Munitions (Par Calibre)
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Bon de commande distinct réservé aux calibres de munitions — prix unitaires élevés ajustables à la commande.
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] uppercase font-bold text-zinc-500 block">
                Total Commande Munitions ({ammoSummary.totalUnits} lot{ammoSummary.totalUnits > 1 ? 's' : ''})
              </span>
              <span className="font-display text-lg font-extrabold text-amber-300 tabular-nums">
                {formatMoney(ammoSummary.totalCost)}
              </span>
            </div>
          </div>

          {ammoSuppliers.length > 0 && (
            <div className="bg-obsidian/65 border border-amber-500/25 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2 flex-wrap text-xs">
              <div className="text-zinc-300 flex items-center gap-1.5 flex-wrap">
                <span className="text-amber-300 font-semibold">📖 Prix Catalogue :</span>
                {ammoSuppliers.slice(0, 6).map((as) => (
                  <span
                    key={`${as.groupId}-${as.item.id}`}
                    className="px-2 py-0.5 rounded bg-charcoal border border-bronze/40 text-[11px] tabular-nums"
                  >
                    {as.item.name} ({formatMoney(resolveCatalogSellItemPrice(as.item, inventoryPrices))})
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={() => onOpenCatalog(ammoSuppliers[0]?.groupId)}
                className="text-[11px] font-semibold text-amber-300 hover:underline cursor-pointer shrink-0"
              >
                Commander par boîte / contact →
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-bronze/45 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  <th className="py-2.5 px-3">Calibre</th>
                  <th className="py-2.5 px-3 text-center">En coffre</th>
                  <th className="py-2.5 px-3 text-right">Prix unitaire ($)</th>
                  <th className="py-2.5 px-3 text-center">Quantité à commander</th>
                  <th className="py-2.5 px-3 text-right">Sous-total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bronze/25 text-xs tabular-nums">
                {ammoRows.map((r) => (
                  <tr
                    key={r.item.key}
                    className={`transition ${
                      r.orderQty > 0
                        ? 'bg-amber-500/10 hover:bg-amber-500/15'
                        : 'hover:bg-slateDark/60'
                    }`}
                  >
                    <td className="py-3 px-3">
                      <div className="font-semibold text-white">{r.item.name}</div>
                      <span className="text-[10px] text-amber-300/90 font-medium">
                        {r.unitPrice === 0 ? 'Prix élevé à définir' : 'Prix modifiable'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-mono">
                      <span
                        className={
                          r.inStock > 0 ? 'text-emerald-300 font-bold' : 'text-crimson-light font-bold'
                        }
                      >
                        {r.inStock}
                      </span>
                      {r.orderQty > 0 && (
                        <span className="text-[10px] text-amber-200 block">
                          → {r.inStock + r.orderQty}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="inline-flex items-center justify-end relative w-28">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={r.unitPrice}
                          disabled={readonly}
                          onChange={(e) =>
                            onUpdateItemPrice(
                              r.item.key,
                              Math.max(0, Number(e.target.value) || 0)
                            )
                          }
                          className="w-full bg-charcoal border border-bronze/60 focus:border-amber-400 rounded-lg pl-2 pr-6 py-1 text-right font-mono tabular-nums text-xs font-bold text-gold-light focus:outline-none disabled:opacity-60"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[11px] text-zinc-500 pointer-events-none">
                          $
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          disabled={r.orderQty <= 0}
                          onClick={() => adjustAmmoQty(r.item.key, -1)}
                          className="w-7 h-7 rounded bg-gunmetal hover:bg-bronze disabled:opacity-35 text-white font-bold flex items-center justify-center cursor-pointer"
                        >
                          -
                        </button>
                        <span
                          className={`font-mono font-extrabold w-8 text-center ${
                            r.orderQty > 0 ? 'text-amber-300' : 'text-zinc-500'
                          }`}
                        >
                          {r.orderQty}
                        </span>
                        <button
                          type="button"
                          onClick={() => adjustAmmoQty(r.item.key, 1)}
                          className="w-7 h-7 rounded bg-gunmetal hover:bg-amber-400 hover:text-obsidian text-white font-bold flex items-center justify-center cursor-pointer"
                        >
                          +1
                        </button>
                        <button
                          type="button"
                          onClick={() => adjustAmmoQty(r.item.key, 5)}
                          className="px-2 h-7 rounded bg-charcoal hover:bg-amber-500/25 border border-bronze/50 text-[11px] font-mono font-bold text-amber-200 cursor-pointer"
                        >
                          +5
                        </button>
                        <button
                          type="button"
                          onClick={() => adjustAmmoQty(r.item.key, 10)}
                          className="px-2 h-7 rounded bg-charcoal hover:bg-amber-500/25 border border-bronze/50 text-[11px] font-mono font-bold text-amber-200 cursor-pointer"
                        >
                          +10
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-amber-300">
                      {r.lineCost > 0 ? formatMoney(r.lineCost) : '0 $'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-obsidian/85 border border-amber-500/35 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="text-xs tabular-nums space-y-0.5">
              {ammoSummary.totalUnits === 0 ? (
                <span className="text-zinc-400">
                  Ajoutez les quantités de munitions souhaitées par calibre ci-dessus.
                </span>
              ) : (
                <>
                  <div className="text-zinc-200">
                    Commande munitions prête :{' '}
                    <strong className="text-amber-300">
                      {ammoSummary.totalUnits} lot{ammoSummary.totalUnits > 1 ? 's' : ''}
                    </strong>
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    Coût total estimé :{' '}
                    <strong className="font-mono text-gold-light">
                      {formatMoney(ammoSummary.totalCost)}
                    </strong>
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 justify-end">
              {ammoSummary.totalUnits > 0 && (
                <button
                  type="button"
                  onClick={() => setAmmoOrderCart({})}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-charcoal hover:bg-red-950/40 text-zinc-400 hover:text-red-300 border border-bronze/40 transition cursor-pointer"
                >
                  Vider
                </button>
              )}
              <button
                type="button"
                onClick={handleCopyAmmoOrder}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-charcoal hover:bg-gunmetal text-amber-200 border border-amber-500/40 transition cursor-pointer"
              >
                📋 Copier commande munitions
              </button>

              {!readonly && ammoSummary.totalUnits > 0 && (
                <>
                  <select
                    value={ammoDebitAccount}
                    onChange={(e) =>
                      setAmmoDebitAccount(e.target.value as 'none' | 'legal' | 'illegal')
                    }
                    className="bg-charcoal border border-bronze/60 focus:border-amber-400 rounded-xl px-2.5 py-2 text-xs text-zinc-200 focus:outline-none"
                  >
                    <option value="illegal">
                      Débiter Argent Sale ({formatMoney(treasuryMoney.illegal || 0)})
                    </option>
                    <option value="legal">
                      Débiter Argent Légal ({formatMoney(treasuryMoney.legal || 0)})
                    </option>
                    <option value="none">Stock seul (ne pas débiter la caisse)</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleConfirmAmmoReceipt}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-obsidian transition shadow-lg cursor-pointer"
                  >
                    ✅ Réceptionner Munitions (+Stock)
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. COMMANDE FOURNISSEUR / GROUPE (SYNCHRONISÉ AVEC LE CATALOGUE) */}
      {(sectionFilter === 'ALL' || sectionFilter === 'catalog') && (
        <div
          id="order-catalog-panel"
          className="bg-charcoal/95 border border-purple-500/40 rounded-2xl p-6 shadow-xl space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-bronze/40">
            <div>
              <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-purple-300" />
                Commande Fournisseur / Groupe (Catalogue)
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Commandez directement auprès d&apos;un groupe du Catalogue (munitions au détail, accessoires, réparations, gilets...) — panier synchronisé avec l&apos;onglet Catalogue.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => onOpenCatalog(activeSupplierGroup?.id)}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-obsidian hover:bg-gunmetal text-gold-light border border-gold/40 transition cursor-pointer"
              >
                📖 Éditer Catalogue &amp; Contacts
              </button>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-zinc-500 block">
                  Total Groupe ({activeGroupSummary.totalUnits})
                </span>
                <span className="font-display text-lg font-extrabold text-purple-200 tabular-nums">
                  {formatMoney(activeGroupSummary.totalCost)}
                </span>
              </div>
            </div>
          </div>

          {supplierGroups.length === 0 ? (
            <div className="bg-obsidian/60 border border-bronze/40 rounded-xl p-5 text-center text-xs text-zinc-400">
              Aucun groupe fournisseur avec des articles en vente dans le Catalogue.
            </div>
          ) : (
            <>
              {/* SÉLECTEUR DE GROUPE + CONTACTS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 bg-obsidian/80 border border-bronze/45 rounded-xl p-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-gold-light block">
                    Groupe fournisseur
                  </label>
                  <select
                    value={activeSupplierGroup?.id || ''}
                    onChange={(e) => onSelectCatalogGroupId(e.target.value)}
                    className="w-full bg-charcoal border border-bronze/60 focus:border-purple-400 rounded-lg px-3 py-2 text-sm font-semibold text-white outline-none"
                  >
                    {supplierGroups.map((g) => {
                      const count = Object.values(groupOrderCarts[g.id] || {}).reduce(
                        (s, q) => s + Math.max(0, Number(q) || 0),
                        0
                      );
                      return (
                        <option key={g.id} value={g.id}>
                          {g.name} ({g.items.filter((i) => i.tradeType === 'sell').length} articles
                          {count > 0 ? ` · ${count} dans le panier` : ''})
                        </option>
                      );
                    })}
                  </select>
                  {activeSupplierGroup?.notes && (
                    <p className="text-[11px] text-amber-200/85 italic">
                      {activeSupplierGroup.notes}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                    Contact(s) à appeler
                  </span>
                  {activeSupplierGroup && activeSupplierGroup.contacts.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {activeSupplierGroup.contacts.map((c) => (
                        <div
                          key={c.id}
                          className="bg-charcoal border border-bronze/50 rounded-lg px-3 py-1.5 text-xs flex items-center gap-2"
                        >
                          <span className="font-bold text-white">{c.name}</span>
                          {c.role && <span className="text-zinc-400">({c.role})</span>}
                          {c.phone && (
                            <span className="font-mono font-bold text-emerald-300 flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {c.phone}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-zinc-400 flex items-center gap-2">
                      <span>Aucun contact renseigné pour ce groupe.</span>
                      <button
                        type="button"
                        onClick={() => onOpenCatalog(activeSupplierGroup?.id)}
                        className="text-gold-light hover:underline font-semibold cursor-pointer"
                      >
                        + Ajouter un contact
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* SÉLECTEUR DE MODE POUR ÉMINENCES + TABLEAU OU VUE MISSIONS */}
              {activeSupplierGroup &&
                (activeSupplierGroup.id === 'eminence' ||
                  activeSupplierGroup.name.toLowerCase().includes('eminence') ||
                  activeSupplierGroup.name.toLowerCase().includes('éminence')) && (
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <span className="text-xs text-zinc-300">
                      Mode de commande <strong className="text-gold">{activeSupplierGroup.name}</strong> : achetez par mission (pack ou seul) ou via le tableau complet.
                    </span>
                    <div className="inline-flex items-center bg-obsidian border border-gold/40 rounded-xl p-0.5">
                      <button
                        type="button"
                        onClick={() => setEminenceOrderMode('missions')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          eminenceOrderMode === 'missions'
                            ? 'bg-gold text-obsidian'
                            : 'text-zinc-300 hover:text-white'
                        }`}
                      >
                        Par Mission (Pack / Seul)
                      </button>
                      <button
                        type="button"
                        onClick={() => setEminenceOrderMode('table')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                          eminenceOrderMode === 'table'
                            ? 'bg-gold text-obsidian font-bold'
                            : 'text-zinc-300 hover:text-white'
                        }`}
                      >
                        Tableau complet
                      </button>
                    </div>
                  </div>
                )}

              {activeSupplierGroup &&
                (activeSupplierGroup.id === 'eminence' ||
                  activeSupplierGroup.name.toLowerCase().includes('eminence') ||
                  activeSupplierGroup.name.toLowerCase().includes('éminence')) &&
                eminenceOrderMode === 'missions' ? (
                <EminenceMissionCatalog
                  group={activeSupplierGroup}
                  cart={activeGroupCart}
                  inventoryStock={inventoryStock}
                  inventoryPrices={inventoryPrices}
                  onAdjustItem={(itemId, delta) =>
                    onAdjustGroupOrderItem(activeSupplierGroup.id, itemId, delta)
                  }
                  readonly={readonly}
                />
              ) : (
                activeSupplierGroup && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-bronze/45 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                        <th className="py-2.5 px-3">Article / Service</th>
                        <th className="py-2.5 px-3 text-center">Catégorie</th>
                        <th className="py-2.5 px-3 text-right">Prix unitaire</th>
                        <th className="py-2.5 px-3 text-center">Quantité</th>
                        <th className="py-2.5 px-3 text-right">Sous-total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-bronze/25 text-xs tabular-nums">
                      {activeGroupSellItems.map((it) => {
                        const qty = Math.max(
                          0,
                          Math.floor(Number(activeGroupCart[it.id]) || 0)
                        );
                        const unitPrice = resolveCatalogSellItemPrice(it, inventoryPrices);
                        const lineCost = qty * unitPrice;
                        return (
                          <tr
                            key={it.id}
                            className={`transition ${
                              qty > 0
                                ? 'bg-purple-500/10 hover:bg-purple-500/15'
                                : 'hover:bg-slateDark/60'
                            }`}
                          >
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-white">{it.name}</div>
                              {it.notes && (
                                <span className="text-[10px] text-zinc-400">{it.notes}</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center text-[11px] text-zinc-300">
                              {CATALOG_ITEM_CATEGORY_LABELS[it.category]}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-gold">
                              {unitPrice > 0 ? formatMoney(unitPrice) : 'À fixer'}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={qty <= 0}
                                  onClick={() =>
                                    onAdjustGroupOrderItem(activeSupplierGroup.id, it.id, -1)
                                  }
                                  className="w-7 h-7 rounded bg-gunmetal hover:bg-bronze disabled:opacity-35 text-white font-bold flex items-center justify-center cursor-pointer"
                                >
                                  -
                                </button>
                                <span
                                  className={`font-mono font-extrabold w-8 text-center ${
                                    qty > 0 ? 'text-purple-200' : 'text-zinc-500'
                                  }`}
                                >
                                  {qty}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onAdjustGroupOrderItem(activeSupplierGroup.id, it.id, 1)
                                  }
                                  className="w-7 h-7 rounded bg-gunmetal hover:bg-purple-400 hover:text-obsidian text-white font-bold flex items-center justify-center cursor-pointer"
                                >
                                  +1
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onAdjustGroupOrderItem(activeSupplierGroup.id, it.id, 5)
                                  }
                                  className="px-2 h-7 rounded bg-charcoal hover:bg-purple-500/25 border border-bronze/50 text-[11px] font-mono font-bold text-purple-200 cursor-pointer"
                                >
                                  +5
                                </button>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-gold">
                              {lineCost > 0 ? formatMoney(lineCost) : '0 $'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                )
              )}

              {/* ACTIONS COMMANDE GROUPE */}
              {activeSupplierGroup && (
                <div className="bg-obsidian/85 border border-purple-500/30 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="text-xs tabular-nums space-y-0.5">
                    {activeGroupSummary.totalUnits === 0 ? (
                      <span className="text-zinc-400">
                        Sélectionnez les articles à commander auprès de {activeSupplierGroup.name}.
                      </span>
                    ) : (
                      <>
                        <div className="text-zinc-200">
                          Commande prête ({activeSupplierGroup.name}) :{' '}
                          <strong className="text-purple-200">
                            {activeGroupSummary.totalUnits} article
                            {activeGroupSummary.totalUnits > 1 ? 's' : ''}
                          </strong>
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          Total estimé :{' '}
                          <strong className="font-mono text-gold-light">
                            {formatMoney(activeGroupSummary.totalCost)}
                          </strong>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 justify-end">
                    {activeGroupSummary.totalUnits > 0 && (
                      <button
                        type="button"
                        onClick={() => onClearGroupOrder(activeSupplierGroup.id)}
                        className="px-3 py-2 rounded-xl text-xs font-bold bg-charcoal hover:bg-red-950/40 text-zinc-400 hover:text-red-300 border border-bronze/40 transition cursor-pointer"
                      >
                        Vider
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleCopySupplierOrder}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-charcoal hover:bg-gunmetal text-purple-200 border border-purple-500/40 transition cursor-pointer"
                    >
                      📋 Copier commande groupe
                    </button>

                    {!readonly && activeGroupSummary.totalUnits > 0 && (
                      <>
                        <select
                          value={groupDebitAccount}
                          onChange={(e) =>
                            setGroupDebitAccount(
                              e.target.value as 'none' | 'legal' | 'illegal'
                            )
                          }
                          className="bg-charcoal border border-bronze/60 focus:border-purple-400 rounded-xl px-2.5 py-2 text-xs text-zinc-200 outline-none"
                        >
                          <option value="illegal">
                            Débiter Argent Sale ({formatMoney(treasuryMoney.illegal || 0)})
                          </option>
                          <option value="legal">
                            Débiter Argent Légal ({formatMoney(treasuryMoney.legal || 0)})
                          </option>
                          <option value="none">Sans débiter la caisse</option>
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            onConfirmGroupOrder(
                              activeSupplierGroup,
                              activeGroupCart,
                              groupDebitAccount
                            )
                          }
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-400 hover:bg-purple-300 text-obsidian transition shadow-lg cursor-pointer"
                        >
                          ✅ Valider &amp; Réceptionner
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
