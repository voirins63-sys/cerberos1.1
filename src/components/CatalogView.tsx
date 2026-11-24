import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  Copy,
  Edit3,
  Image as ImageIcon,
  Package,
  PackagePlus,
  Phone,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import ammoBoxesImg from '@/src/assets/images/catalog_ammo_boxes_1795290321247.jpg';
import bradHeroImg from '@/src/assets/images/catalog_brad_purple_hero_1795290573562.jpg';
import eminenceHeroImg from '@/src/assets/images/catalog_eminence_hero_1795290844928.jpg';
import lootRecelImg from '@/src/assets/images/catalog_loot_recel_1795290320785.jpg';
import marabuntaHeroImg from '@/src/assets/images/catalog_marabunta_hero_1795290323047.jpg';
import whiskeyHeroImg from '@/src/assets/images/catalog_whiskey_hero_1795290320077.jpg';
import bradFashionShadesImg from '@/src/assets/images/item_brad_fashion_shades_1795290572827.jpg';
import bradGoldPaintingImg from '@/src/assets/images/item_brad_gold_painting_1795290573802.jpg';
import bradJewelryWatchImg from '@/src/assets/images/item_brad_jewelry_watch_1795290573438.jpg';
import bradTechHardwareImg from '@/src/assets/images/item_brad_tech_hardware_1795290572785.jpg';
import bulletproofVestImg from '@/src/assets/images/item_bulletproof_vest_1795290574021.jpg';
import eminenceKeysImg from '@/src/assets/images/item_eminence_keys_1795290843394.jpg';
import eminencePacksImg from '@/src/assets/images/item_eminence_packs_1795290844943.jpg';
import eminenceUtilitiesImg from '@/src/assets/images/item_eminence_utilities_1795290843513.jpg';
import eminenceWhiskeyImg from '@/src/assets/images/item_eminence_whiskey_1795290843408.jpg';
import gunRepairBenchImg from '@/src/assets/images/item_gun_repair_bench_1795290574100.jpg';
import magazinesGripImg from '@/src/assets/images/item_magazines_grip_1795290574443.jpg';
import opticsScopesImg from '@/src/assets/images/item_optics_scopes_1795290573936.jpg';
import shotgunRifleAmmoImg from '@/src/assets/images/item_shotgun_rifle_ammo_1795290573109.jpg';
import { EminenceMissionCatalog } from '@/src/components/EminenceMissionCatalog';
import { CATALOG_ITEM_CATEGORY_LABELS, INVENTORY_ITEMS, REWARD_ITEMS } from '@/src/data/cartelData';
import type {
  CatalogContact,
  CatalogGroup,
  CatalogGroupColor,
  CatalogGroupsMap,
  CatalogItem,
  CatalogItemCategory,
  CatalogTradeType,
  GearKey,
  InventoryPrices,
  InventoryStock,
  RewardStocks,
  TreasuryMoney,
} from '@/src/types/cartel';
import {
  CATALOG_BUYBACK_ID_TO_REWARD_KEY,
  formatMoney,
  getCatalogStockKey,
  resolveCatalogSellItemPrice,
} from '@/src/utils/finance';

const GROUP_FLYERS: Record<
  'marabunta' | 'brad' | 'eminence',
  Array<{ src: string; title: string }>
> = {
  marabunta: [
    {
      src: '/assets/aistudio/image_83d981ed.png',
      title: 'Marabunta Grande — Réparation & Gilets',
    },
    {
      src: '/assets/aistudio/image_a6b3bf7e.png',
      title: 'Marabunta Supply Co. — Munitions & Accessoires',
    },
  ],
  brad: [
    {
      src: '/assets/aistudio/Capture_d__cran_2026-11-19_201726_39da0692.png',
      title: 'Brad — Marché Noir (Tarifs de rachat)',
    },
  ],
  eminence: [
    {
      src: '/assets/aistudio/image_8fe1a6c8.png',
      title: 'Éminences — Clés & Accès',
    },
    {
      src: '/assets/aistudio/image_2c321c23.png',
      title: 'Éminences — Items utilitaires',
    },
    {
      src: '/assets/aistudio/image_a57bad7d.png',
      title: 'Éminences — Packs de Braquage',
    },
    {
      src: '/assets/aistudio/image_e6c8f047.png',
      title: 'Éminence — Whiskey de Luxe (15 $)',
    },
  ],
};

function getFlyerGroupKey(group: CatalogGroup): 'marabunta' | 'brad' | 'eminence' | null {
  const id = group.id.toLowerCase();
  const name = group.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (id === 'marabunta' || name.includes('marabunta')) return 'marabunta';
  if (id === 'brad_recel' || name.includes('brad')) return 'brad';
  if (id === 'eminence' || name.includes('eminence')) return 'eminence';
  return null;
}

function getGroupHeroImage(group: CatalogGroup): { src: string; alt: string } {
  const id = group.id.toLowerCase();
  const name = group.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (id === 'eminence' || name.includes('eminence')) {
    return { src: eminenceHeroImg, alt: `Coffre & Salon privé — ${group.name}` };
  }
  if (id === 'whiskey_acheteur' || name.includes('whiskey')) {
    return { src: whiskeyHeroImg, alt: `Cave privée — ${group.name}` };
  }
  if (id === 'brad_recel' || name.includes('brad') || name.includes('recel')) {
    return { src: bradHeroImg, alt: `Coffre marché noir — ${group.name}` };
  }
  if (id === 'marabunta' || name.includes('marabunta') || group.color === 'blue') {
    return { src: marabuntaHeroImg, alt: `Armurerie tactique — ${group.name}` };
  }
  return { src: marabuntaHeroImg, alt: `Catalogue — ${group.name}` };
}

function getItemShowcaseImage(
  item: CatalogItem,
  group: CatalogGroup
): { src: string; alt: string } {
  const norm = item.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const groupNorm = group.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const isEminence = group.id === 'eminence' || groupNorm.includes('eminence');

  if (norm.includes('whiskey') || group.id === 'whiskey_acheteur') {
    return { src: eminenceWhiskeyImg, alt: item.name };
  }
  if (isEminence) {
    if (norm.includes('pack')) {
      return { src: eminencePacksImg, alt: item.name };
    }
    if (
      norm.includes('cle ') ||
      norm.includes('detonateur') ||
      norm.includes('ammunation')
    ) {
      return { src: eminenceKeysImg, alt: item.name };
    }
    if (item.category === 'materiel') {
      return { src: eminenceUtilitiesImg, alt: item.name };
    }
  }
  switch (item.category) {
    case 'munitions':
      if (
        norm.includes('calibre 12') ||
        norm.includes('5.56') ||
        norm.includes('pompe') ||
        norm.includes('fusil')
      ) {
        return { src: shotgunRifleAmmoImg, alt: item.name };
      }
      return { src: ammoBoxesImg, alt: item.name };
    case 'accessoires':
      if (norm.includes('lunette')) {
        return { src: opticsScopesImg, alt: item.name };
      }
      return { src: magazinesGripImg, alt: item.name };
    case 'gilets':
      return { src: bulletproofVestImg, alt: item.name };
    case 'reparation':
      return { src: gunRepairBenchImg, alt: item.name };
    case 'butin':
      if (norm.includes('bijou') || norm.includes('montre') || norm.includes('collier')) {
        return { src: bradJewelryWatchImg, alt: item.name };
      }
      if (
        norm.includes('graphique') ||
        norm.includes('processeur') ||
        norm.includes('gpu') ||
        norm.includes('cpu')
      ) {
        return { src: bradTechHardwareImg, alt: item.name };
      }
      if (norm.includes('vetement') || norm.includes('lunette')) {
        return { src: bradFashionShadesImg, alt: item.name };
      }
      if (norm.includes('lingot') || norm.includes('peinture')) {
        return { src: bradGoldPaintingImg, alt: item.name };
      }
      return { src: lootRecelImg, alt: item.name };
    case 'materiel':
      return norm.includes('pack')
        ? { src: eminencePacksImg, alt: item.name }
        : { src: eminenceUtilitiesImg, alt: item.name };
    case 'armes':
      return { src: marabuntaHeroImg, alt: item.name };
    default:
      return item.tradeType === 'buyback'
        ? { src: lootRecelImg, alt: item.name }
        : { src: ammoBoxesImg, alt: item.name };
  }
}

interface CatalogViewProps {
  catalogGroups: CatalogGroupsMap;
  selectedGroupId: string;
  onSelectGroupId: (groupId: string) => void;
  groupOrderCarts: Record<string, Record<string, number>>;
  onAdjustGroupOrderItem: (groupId: string, itemId: string, delta: number) => void;
  onSetGroupOrderItemQty: (groupId: string, itemId: string, qty: number) => void;
  onClearGroupOrder: (groupId: string) => void;
  onConfirmGroupOrder: (
    group: CatalogGroup,
    cartMap: Record<string, number>,
    debitAccount: 'none' | 'legal' | 'illegal'
  ) => void;
  onGoToOrdersWithGroup: (groupId: string) => void;
  onSaveCatalogGroups: (nextGroups: CatalogGroupsMap) => void;
  inventoryStock: InventoryStock;
  inventoryPrices?: InventoryPrices;
  rewardStocks: RewardStocks;
  treasuryMoney: TreasuryMoney;
  readonly: boolean;
  onShowToast: (msg: string) => void;
}

const COLOR_STYLES: Record<
  CatalogGroupColor,
  { border: string; badge: string; accent: string; label: string }
> = {
  blue: {
    border: 'border-sky-500/50',
    badge: 'bg-sky-500/15 text-sky-200 border-sky-400/40',
    accent: 'text-sky-300',
    label: 'Bleu (Marabunta...)',
  },
  gold: {
    border: 'border-gold/50',
    badge: 'bg-gold/15 text-gold-light border-gold/45',
    accent: 'text-gold',
    label: 'Or (Cartel / Neutre)',
  },
  crimson: {
    border: 'border-crimson/55',
    badge: 'bg-crimson/20 text-red-200 border-crimson-light/45',
    accent: 'text-crimson-light',
    label: 'Rouge',
  },
  emerald: {
    border: 'border-emerald-500/45',
    badge: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/40',
    accent: 'text-emerald-300',
    label: 'Vert',
  },
  purple: {
    border: 'border-purple-500/45',
    badge: 'bg-purple-500/15 text-purple-200 border-purple-400/40',
    accent: 'text-purple-300',
    label: 'Violet (Marché Noir)',
  },
};

function makeSafeId(prefix: string, raw: string): string {
  const slug = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 28);
  return `${prefix}_${slug || 'item'}_${Date.now().toString(36)}`;
}

async function copyText(text: string): Promise<boolean> {
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

export const CatalogView: React.FC<CatalogViewProps> = ({
  catalogGroups,
  selectedGroupId,
  onSelectGroupId,
  groupOrderCarts,
  onAdjustGroupOrderItem,
  onSetGroupOrderItemQty,
  onClearGroupOrder,
  onConfirmGroupOrder,
  onGoToOrdersWithGroup,
  onSaveCatalogGroups,
  inventoryStock,
  inventoryPrices,
  rewardStocks,
  treasuryMoney,
  readonly,
  onShowToast,
}) => {
  const groupsList = useMemo(
    () =>
      Object.values(catalogGroups).sort((a, b) =>
        a.name.localeCompare(b.name, 'fr-FR')
      ),
    [catalogGroups]
  );

  const activeGroup =
    (selectedGroupId && catalogGroups[selectedGroupId]) || groupsList[0] || null;

  const [tradeFilter, setTradeFilter] = useState<'ALL' | CatalogTradeType>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | CatalogItemCategory>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [eminenceViewMode, setEminenceViewMode] = useState<'missions' | 'grid'>('missions');
  const [debitAccount, setDebitAccount] = useState<'none' | 'legal' | 'illegal'>('illegal');
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);
  const [showFlyersModal, setShowFlyersModal] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // Group create / edit form
  const [groupFormOpen, setGroupFormOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [gName, setGName] = useState('');
  const [gSpecialty, setGSpecialty] = useState('');
  const [gColor, setGColor] = useState<CatalogGroupColor>('gold');
  const [gNotes, setGNotes] = useState('');
  const [confirmDeleteGroupId, setConfirmDeleteGroupId] = useState<string | null>(null);

  // Contact form
  const [contactFormOpen, setContactFormOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [cName, setCName] = useState('');
  const [cRole, setCRole] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cNotes, setCNotes] = useState('');

  // Item form
  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itName, setItName] = useState('');
  const [itTradeType, setItTradeType] = useState<CatalogTradeType>('sell');
  const [itCategory, setItCategory] = useState<CatalogItemCategory>('munitions');
  const [itPrice, setItPrice] = useState('');
  const [itLinkedGearKey, setItLinkedGearKey] = useState<GearKey | ''>('');
  const [itNotes, setItNotes] = useState('');

  const resolveItemDisplayPrice = (item: CatalogItem): number => {
    if (item.tradeType === 'sell') {
      return resolveCatalogSellItemPrice(item, inventoryPrices);
    }
    const rewardKey = CATALOG_BUYBACK_ID_TO_REWARD_KEY[item.id];
    if (rewardKey && rewardStocks[rewardKey]?.val !== undefined) {
      return Math.max(0, Math.round(Number(rewardStocks[rewardKey].val) || 0));
    }
    return Math.max(0, Math.round(Number(item.price) || 0));
  };

  const activeCart = useMemo(
    () => (activeGroup ? groupOrderCarts[activeGroup.id] || {} : {}),
    [activeGroup, groupOrderCarts]
  );

  const activeCartSummary = useMemo(() => {
    if (!activeGroup) return { totalUnits: 0, totalCost: 0, lines: [] as Array<{ item: CatalogItem; qty: number; unitPrice: number; lineCost: number }> };
    let totalUnits = 0;
    let totalCost = 0;
    const lines: Array<{ item: CatalogItem; qty: number; unitPrice: number; lineCost: number }> = [];
    activeGroup.items.forEach((item) => {
      if (item.tradeType !== 'sell') return;
      const qty = Math.max(0, Math.floor(Number(activeCart[item.id]) || 0));
      if (qty > 0) {
        const unitPrice = resolveCatalogSellItemPrice(item, inventoryPrices);
        const lineCost = qty * unitPrice;
        totalUnits += qty;
        totalCost += lineCost;
        lines.push({ item, qty, unitPrice, lineCost });
      }
    });
    return { totalUnits, totalCost, lines };
  }, [activeGroup, activeCart, inventoryPrices]);

  const filteredItems = useMemo(() => {
    if (!activeGroup) return [];
    const q = searchTerm.trim().toLowerCase();
    return activeGroup.items.filter((item) => {
      if (tradeFilter !== 'ALL' && item.tradeType !== tradeFilter) return false;
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;
      if (q) {
        const hay = `${item.name} ${item.notes} ${CATALOG_ITEM_CATEGORY_LABELS[item.category] || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [activeGroup, tradeFilter, categoryFilter, searchTerm]);

  const availableCategories = useMemo(() => {
    if (!activeGroup) return [] as CatalogItemCategory[];
    const set = new Set<CatalogItemCategory>();
    activeGroup.items.forEach((it) => {
      if (tradeFilter === 'ALL' || it.tradeType === tradeFilter) {
        set.add(it.category);
      }
    });
    return Array.from(set);
  }, [activeGroup, tradeFilter]);

  const openNewGroupForm = () => {
    setEditingGroupId(null);
    setGName('');
    setGSpecialty('');
    setGColor('gold');
    setGNotes('');
    setGroupFormOpen(true);
  };

  const openEditGroupForm = (group: CatalogGroup) => {
    setEditingGroupId(group.id);
    setGName(group.name);
    setGSpecialty(group.specialty);
    setGColor(group.color);
    setGNotes(group.notes);
    setGroupFormOpen(true);
  };

  const handleSaveGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (readonly) return;
    const cleanName = gName.trim();
    if (!cleanName) {
      onShowToast('Indique le nom du groupe.');
      return;
    }
    const id = editingGroupId || makeSafeId('grp', cleanName);
    const existing = editingGroupId ? catalogGroups[editingGroupId] : undefined;
    const nextGroup: CatalogGroup = {
      id,
      name: cleanName,
      specialty: gSpecialty.trim(),
      color: gColor,
      notes: gNotes.trim(),
      contacts: existing ? existing.contacts : [],
      items: existing ? existing.items : [],
    };
    const nextGroups = { ...catalogGroups, [id]: nextGroup };
    onSaveCatalogGroups(nextGroups);
    onSelectGroupId(id);
    setGroupFormOpen(false);
    setEditingGroupId(null);
    onShowToast(editingGroupId ? `Groupe "${cleanName}" mis à jour.` : `Groupe "${cleanName}" ajouté au catalogue.`);
  };

  const handleDeleteGroup = (groupId: string) => {
    if (readonly) return;
    if (confirmDeleteGroupId !== groupId) {
      setConfirmDeleteGroupId(groupId);
      return;
    }
    const nextGroups = { ...catalogGroups };
    const deletedName = nextGroups[groupId]?.name || 'Groupe';
    delete nextGroups[groupId];
    onSaveCatalogGroups(nextGroups);
    setConfirmDeleteGroupId(null);
    const fallback = Object.keys(nextGroups)[0] || '';
    onSelectGroupId(fallback);
    onShowToast(`"${deletedName}" supprimé du catalogue.`);
  };

  const openNewContactForm = () => {
    setEditingContactId(null);
    setCName('');
    setCRole('');
    setCPhone('');
    setCNotes('');
    setContactFormOpen(true);
  };

  const openEditContactForm = (c: CatalogContact) => {
    setEditingContactId(c.id);
    setCName(c.name);
    setCRole(c.role);
    setCPhone(c.phone);
    setCNotes(c.notes);
    setContactFormOpen(true);
  };

  const handleSaveContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (readonly || !activeGroup) return;
    if (!cName.trim() && !cPhone.trim()) {
      onShowToast('Indique au moins un nom ou un numéro.');
      return;
    }
    const contact: CatalogContact = {
      id: editingContactId || makeSafeId('cnt', cName || cPhone),
      name: cName.trim() || 'Contact',
      role: cRole.trim(),
      phone: cPhone.trim(),
      notes: cNotes.trim(),
    };
    const nextContacts = editingContactId
      ? activeGroup.contacts.map((c) => (c.id === editingContactId ? contact : c))
      : [...activeGroup.contacts, contact];
    onSaveCatalogGroups({
      ...catalogGroups,
      [activeGroup.id]: { ...activeGroup, contacts: nextContacts },
    });
    setContactFormOpen(false);
    setEditingContactId(null);
    onShowToast(editingContactId ? 'Contact mis à jour.' : 'Contact ajouté.');
  };

  const handleDeleteContact = (contactId: string) => {
    if (readonly || !activeGroup) return;
    const nextContacts = activeGroup.contacts.filter((c) => c.id !== contactId);
    onSaveCatalogGroups({
      ...catalogGroups,
      [activeGroup.id]: { ...activeGroup, contacts: nextContacts },
    });
    onShowToast('Contact retiré.');
  };

  const openNewItemForm = (defaultTrade: CatalogTradeType = 'sell') => {
    setEditingItemId(null);
    setItName('');
    setItTradeType(defaultTrade);
    setItCategory(defaultTrade === 'buyback' ? 'butin' : 'munitions');
    setItPrice('');
    setItLinkedGearKey('');
    setItNotes('');
    setItemFormOpen(true);
  };

  const openEditItemForm = (it: CatalogItem) => {
    setEditingItemId(it.id);
    setItName(it.name);
    setItTradeType(it.tradeType);
    setItCategory(it.category);
    setItPrice(String(resolveItemDisplayPrice(it)));
    setItLinkedGearKey(it.linkedGearKey || '');
    setItNotes(it.notes || '');
    setItemFormOpen(true);
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (readonly || !activeGroup) return;
    const cleanName = itName.trim();
    if (!cleanName) {
      onShowToast("Indique le nom de l'article.");
      return;
    }
    const nextItem: CatalogItem = {
      id: editingItemId || makeSafeId('it', cleanName),
      name: cleanName,
      tradeType: itTradeType,
      category: itCategory,
      price: Math.max(0, Math.round(Number(itPrice) || 0)),
      linkedGearKey: itTradeType === 'sell' ? itLinkedGearKey : '',
      notes: itNotes.trim(),
    };
    const nextItems = editingItemId
      ? activeGroup.items.map((it) => (it.id === editingItemId ? nextItem : it))
      : [...activeGroup.items, nextItem];
    onSaveCatalogGroups({
      ...catalogGroups,
      [activeGroup.id]: { ...activeGroup, items: nextItems },
    });
    setItemFormOpen(false);
    setEditingItemId(null);
    onShowToast(editingItemId ? 'Article mis à jour.' : `"${cleanName}" ajouté au catalogue.`);
  };

  const handleDeleteItem = (itemId: string) => {
    if (readonly || !activeGroup) return;
    const nextItems = activeGroup.items.filter((it) => it.id !== itemId);
    onSaveCatalogGroups({
      ...catalogGroups,
      [activeGroup.id]: { ...activeGroup, items: nextItems },
    });
    onSetGroupOrderItemQty(activeGroup.id, itemId, 0);
    onShowToast('Article supprimé.');
  };

  const handleCopyGroupOrder = async () => {
    if (!activeGroup) return;
    let text = '```asciidoc\n';
    text += `= COMMANDE ${activeGroup.name.toUpperCase()} =\n`;
    if (activeGroup.contacts.length > 0) {
      const contactLine = activeGroup.contacts
        .map((c) => `${c.name}${c.phone ? ` (${c.phone})` : ''}`)
        .join(' / ');
      text += `Contact(s) : ${contactLine}\n`;
    }
    text += '\n';
    if (activeCartSummary.totalUnits === 0) {
      text += 'Aucun article sélectionné.\n';
    } else {
      activeCartSummary.lines.forEach((l) => {
        text += `- ${l.qty}x ${l.item.name} (${formatMoney(l.unitPrice)}/u) = ${formatMoney(l.lineCost)}\n`;
      });
      text += `\nTotal articles : ${activeCartSummary.totalUnits}\n`;
      text += `TOTAL À RÉGLER : ${formatMoney(activeCartSummary.totalCost)}\n`;
    }
    text += '```';

    const ok = await copyText(text);
    onShowToast(ok ? 'Commande copiée avec le contact !' : 'Erreur de copie.');
  };

  const handleCopyPhone = async (c: CatalogContact) => {
    if (!c.phone) return;
    const ok = await copyText(c.phone);
    if (ok) {
      setCopiedPhoneId(c.id);
      window.setTimeout(() => setCopiedPhoneId(null), 1500);
      onShowToast(`Numéro de ${c.name} copié : ${c.phone}`);
    }
  };

  const activeStyle = activeGroup
    ? COLOR_STYLES[activeGroup.color] || COLOR_STYLES.gold
    : COLOR_STYLES.gold;

  return (
    <div className="space-y-6">
      {/* EN-TÊTE CATALOGUE + SÉLECTEUR DE GROUPES */}
      <div className="bg-charcoal/95 gold-border rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-bronze/40">
          <div>
            <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-gold" />
              Catalogue des Groupes, Contacts &amp; Tarifs
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Répertoire complet de ce que chaque groupe vend ou rachète, leurs contacts RP et la prise de commande directe.
            </p>
          </div>
          {!readonly && (
            <button
              type="button"
              onClick={openNewGroupForm}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-gold hover:bg-gold-light text-obsidian transition flex items-center gap-1.5 shadow-md cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              Ajouter un groupe
            </button>
          )}
        </div>

        {groupFormOpen && !readonly && (
          <form
            onSubmit={handleSaveGroup}
            className="bg-obsidian/85 border border-gold/45 rounded-xl p-4 space-y-3"
          >
            <div className="text-xs font-bold uppercase tracking-wider text-gold">
              {editingGroupId ? 'Modifier le groupe' : 'Nouveau groupe / fournisseur'}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <input
                type="text"
                maxLength={80}
                value={gName}
                onChange={(e) => setGName(e.target.value)}
                placeholder="Nom du groupe (ex: Marabunta, Vagos...)"
                className="bg-charcoal border border-bronze/60 focus:border-gold rounded-lg px-3 py-2 text-sm text-white outline-none"
              />
              <input
                type="text"
                maxLength={120}
                value={gSpecialty}
                onChange={(e) => setGSpecialty(e.target.value)}
                placeholder="Spécialité (ex: Munitions, Armes, Recel...)"
                className="lg:col-span-2 bg-charcoal border border-bronze/60 focus:border-gold rounded-lg px-3 py-2 text-sm text-white outline-none"
              />
              <select
                value={gColor}
                onChange={(e) => setGColor(e.target.value as CatalogGroupColor)}
                className="bg-charcoal border border-bronze/60 focus:border-gold rounded-lg px-3 py-2 text-sm text-white outline-none"
              >
                {Object.entries(COLOR_STYLES).map(([k, val]) => (
                  <option key={k} value={k}>
                    {val.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                maxLength={300}
                value={gNotes}
                onChange={(e) => setGNotes(e.target.value)}
                placeholder="Notes (zone, conditions, variations de prix...)"
                className="flex-1 bg-charcoal border border-bronze/60 focus:border-gold rounded-lg px-3 py-2 text-xs text-zinc-200 outline-none"
              />
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-gold hover:bg-gold-light text-obsidian transition cursor-pointer"
                >
                  {editingGroupId ? 'Enregistrer' : 'Créer le groupe'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGroupFormOpen(false);
                    setEditingGroupId(null);
                  }}
                  className="px-3.5 py-2 rounded-lg text-xs font-bold bg-charcoal border border-gunmetal text-zinc-300 hover:bg-gunmetal transition cursor-pointer"
                >
                  Annuler
                </button>
              </div>
            </div>
          </form>
        )}

        {/* CARTES DE SÉLECTION DES GROUPES AVEC VISUELS */}
        {groupsList.length === 0 ? (
          <div className="bg-obsidian/60 border border-bronze/40 rounded-xl p-6 text-center text-xs text-zinc-400">
            Aucun groupe enregistré. Cliquez sur « Ajouter un groupe » pour créer votre premier contact.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {groupsList.map((grp) => {
              const isSelected = activeGroup?.id === grp.id;
              const style = COLOR_STYLES[grp.color] || COLOR_STYLES.gold;
              const sellCount = grp.items.filter((i) => i.tradeType === 'sell').length;
              const buyCount = grp.items.filter((i) => i.tradeType === 'buyback').length;
              const cartCount = Object.values(groupOrderCarts[grp.id] || {}).reduce(
                (s, q) => s + Math.max(0, Number(q) || 0),
                0
              );
              const heroMeta = getGroupHeroImage(grp);
              const heroKey = `grp_thumb_${grp.id}`;

              return (
                <button
                  key={grp.id}
                  type="button"
                  onClick={() => {
                    onSelectGroupId(grp.id);
                    setTradeFilter('ALL');
                    setCategoryFilter('ALL');
                    setSearchTerm('');
                    setConfirmDeleteGroupId(null);
                  }}
                  className={`group text-left rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer flex flex-col justify-between bg-obsidian ${
                    isSelected
                      ? `${style.border} ring-1 ring-gold/60 shadow-xl -translate-y-0.5`
                      : 'border-bronze/40 hover:border-gold/55 hover:-translate-y-0.5'
                  }`}
                >
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-charcoal">
                    {!failedImages[heroKey] ? (
                      <img
                        src={heroMeta.src}
                        alt={heroMeta.alt}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setFailedImages((prev) => ({ ...prev, [heroKey]: true }))
                        }
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-charcoal to-obsidian text-gold/60">
                        <BookOpen className="w-8 h-8" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/45 to-transparent" />
                    {cartCount > 0 && (
                      <span className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-gold text-obsidian shadow-md tabular-nums">
                        {cartCount} cmd
                      </span>
                    )}
                    <div className="absolute bottom-2.5 left-3.5 right-3.5">
                      <div className={`font-display text-base font-bold truncate ${isSelected ? style.accent : 'text-white'}`}>
                        {grp.name}
                      </div>
                      <div className="text-[11px] text-zinc-300 truncate">
                        {grp.specialty || 'Groupe partenaire / fournisseur'}
                      </div>
                    </div>
                  </div>
                  <div className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-[11px] text-zinc-400 border-t border-bronze/25 tabular-nums">
                    <span>
                      {sellCount} vente{sellCount > 1 ? 's' : ''} · {buyCount} rachat{buyCount > 1 ? 's' : ''}
                    </span>
                    <span className="font-mono text-zinc-300">
                      {grp.contacts.length} contact{grp.contacts.length > 1 ? 's' : ''}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* FICHE DÉTAILLÉE DU GROUPE SÉLECTIONNÉ */}
      {activeGroup && (
        <div className="space-y-6">
          {/* HERO VISUEL + CONTACTS + INFOS GROUPE */}
          <div className={`bg-charcoal/95 border ${activeStyle.border} rounded-2xl overflow-hidden shadow-xl`}>
            {(() => {
              const groupHero = getGroupHeroImage(activeGroup);
              const heroKey = `grp_hero_${activeGroup.id}`;
              const flyerKey = getFlyerGroupKey(activeGroup);
              const flyersList = flyerKey ? GROUP_FLYERS[flyerKey] : [];

              return (
                <div className="relative h-52 sm:h-64 w-full bg-obsidian overflow-hidden">
                  {!failedImages[heroKey] ? (
                    <img
                      src={groupHero.src}
                      alt={groupHero.alt}
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setFailedImages((prev) => ({ ...prev, [heroKey]: true }))
                      }
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-charcoal via-obsidian to-black" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-charcoal via-obsidian/70 to-black/25" />

                  <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                    <div className="space-y-1 max-w-2xl">
                      <div className="flex items-center gap-2 text-xs text-zinc-300">
                        <span className={`font-semibold ${activeStyle.accent}`}>
                          Répertoire Groupe
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {activeGroup.contacts.length} contact{activeGroup.contacts.length > 1 ? 's' : ''}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {activeGroup.items.length} tarif{activeGroup.items.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-wide">
                        {activeGroup.name}
                      </h3>
                      {activeGroup.specialty && (
                        <p className="text-xs sm:text-sm text-zinc-200">{activeGroup.specialty}</p>
                      )}
                      {activeGroup.notes && (
                        <p className="text-xs text-amber-200/90 italic">
                          {activeGroup.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      {flyersList.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowFlyersModal(true)}
                          className={`px-3.5 py-2 rounded-lg text-xs font-bold bg-obsidian/90 hover:bg-charcoal transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-md border ${
                            flyerKey === 'brad'
                              ? 'text-purple-200 border-purple-400/50'
                              : flyerKey === 'eminence'
                                ? 'text-gold-light border-gold/50'
                                : 'text-sky-200 border-sky-400/45'
                          }`}
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          {flyersList.length > 1
                            ? `Affiches officielles (${flyersList.length})`
                            : 'Affiche officielle'}
                        </button>
                      )}
                      {!readonly && (
                        <>
                          <button
                            type="button"
                            onClick={openNewContactForm}
                            className="px-3 py-2 rounded-lg text-xs font-bold bg-obsidian/90 hover:bg-gunmetal text-gold-light border border-gold/45 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            Ajouter contact
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditGroupForm(activeGroup)}
                            className="px-3 py-2 rounded-lg text-xs font-semibold bg-obsidian/90 hover:bg-gunmetal text-zinc-200 border border-bronze/50 transition flex items-center gap-1 cursor-pointer whitespace-nowrap"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Modifier
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteGroup(activeGroup.id)}
                            className={`px-3 py-2 rounded-lg text-xs font-semibold border transition cursor-pointer whitespace-nowrap ${
                              confirmDeleteGroupId === activeGroup.id
                                ? 'bg-red-600 text-white border-red-400 font-bold'
                                : 'bg-obsidian/90 text-zinc-300 border-gunmetal hover:text-red-300'
                            }`}
                          >
                            {confirmDeleteGroupId === activeGroup.id ? 'Confirmer ?' : 'Supprimer'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="p-6 space-y-4">

            {contactFormOpen && !readonly && (
              <form
                onSubmit={handleSaveContact}
                className="bg-obsidian/85 border border-gold/40 rounded-xl p-4 space-y-2.5"
              >
                <div className="text-[11px] font-bold uppercase tracking-wider text-gold">
                  {editingContactId ? 'Modifier le contact' : `Nouveau contact — ${activeGroup.name}`}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  <input
                    type="text"
                    maxLength={80}
                    value={cName}
                    onChange={(e) => setCName(e.target.value)}
                    placeholder="Nom / Surnom RP"
                    className="bg-charcoal border border-bronze/60 focus:border-gold rounded-lg px-3 py-2 text-xs text-white outline-none"
                  />
                  <input
                    type="text"
                    maxLength={60}
                    value={cRole}
                    onChange={(e) => setCRole(e.target.value)}
                    placeholder="Rôle (ex: Jefe, Armurier, Receleur...)"
                    className="bg-charcoal border border-bronze/60 focus:border-gold rounded-lg px-3 py-2 text-xs text-white outline-none"
                  />
                  <input
                    type="text"
                    maxLength={40}
                    value={cPhone}
                    onChange={(e) => setCPhone(e.target.value)}
                    placeholder="Téléphone / Radio / Discord"
                    className="bg-charcoal border border-bronze/60 focus:border-gold rounded-lg px-3 py-2 text-xs font-mono text-gold-light outline-none"
                  />
                  <input
                    type="text"
                    maxLength={160}
                    value={cNotes}
                    onChange={(e) => setCNotes(e.target.value)}
                    placeholder="Horaires / remarques"
                    className="bg-charcoal border border-bronze/60 focus:border-gold rounded-lg px-3 py-2 text-xs text-zinc-200 outline-none"
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setContactFormOpen(false);
                      setEditingContactId(null);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-charcoal border border-gunmetal text-zinc-300 cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg text-xs font-bold bg-gold hover:bg-gold-light text-obsidian cursor-pointer"
                  >
                    {editingContactId ? 'Enregistrer' : 'Ajouter contact'}
                  </button>
                </div>
              </form>
            )}

            {/* LISTE DES CONTACTS */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-gold" />
                Contacts du groupe
              </div>
              {activeGroup.contacts.length === 0 ? (
                <div className="bg-obsidian/60 border border-bronze/35 rounded-xl px-4 py-3 text-xs text-zinc-400 flex items-center justify-between gap-2 flex-wrap">
                  <span>Aucun numéro / contact enregistré pour ce groupe pour l&apos;instant.</span>
                  {!readonly && (
                    <button
                      type="button"
                      onClick={openNewContactForm}
                      className="text-gold-light hover:underline font-semibold cursor-pointer"
                    >
                      + Ajouter un contact maintenant
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {activeGroup.contacts.map((c) => (
                    <div
                      key={c.id}
                      className="bg-obsidian/80 border border-bronze/45 rounded-xl p-3.5 flex flex-col justify-between gap-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-white truncate">{c.name}</div>
                          {c.role && (
                            <div className="text-[11px] text-gold-light truncate">{c.role}</div>
                          )}
                        </div>
                        {!readonly && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => openEditContactForm(c)}
                              className="p-1 rounded bg-charcoal border border-gunmetal text-zinc-400 hover:text-gold cursor-pointer"
                              title="Modifier contact"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteContact(c.id)}
                              className="p-1 rounded bg-charcoal border border-gunmetal text-zinc-400 hover:text-red-400 cursor-pointer"
                              title="Supprimer contact"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      {c.phone && (
                        <div className="flex items-center justify-between gap-2 bg-charcoal/90 border border-bronze/35 rounded-lg px-2.5 py-1.5">
                          <span className="font-mono text-xs font-bold text-emerald-300 flex items-center gap-1.5 truncate">
                            <Phone className="w-3 h-3 shrink-0" />
                            {c.phone}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyPhone(c)}
                            className="text-[10px] font-semibold text-zinc-300 hover:text-gold flex items-center gap-1 shrink-0 cursor-pointer"
                          >
                            {copiedPhoneId === c.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" /> Copié
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" /> Copier
                              </>
                            )}
                          </button>
                        </div>
                      )}

                      {c.notes && (
                        <p className="text-[11px] text-zinc-400 leading-snug">{c.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            </div>
          </div>

          {/* PANIER DE COMMANDE DIRECT DU GROUPE */}
          {activeCartSummary.totalUnits > 0 && (
            <div className="bg-obsidian/95 border border-gold/55 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-gold flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4" />
                    Commande en cours chez {activeGroup.name}
                  </div>
                  <div className="text-xs text-zinc-300 mt-1 flex flex-wrap items-center gap-2">
                    <span>
                      <strong className="text-white">{activeCartSummary.totalUnits}</strong> article{activeCartSummary.totalUnits > 1 ? 's' : ''}
                    </span>
                    <span>·</span>
                    <span>
                      Total : <strong className="font-mono text-gold">{formatMoney(activeCartSummary.totalCost)}</strong>
                    </span>
                    {activeGroup.contacts[0] && (
                      <>
                        <span>·</span>
                        <span className="text-emerald-300 font-mono">
                          📞 {activeGroup.contacts[0].name}
                          {activeGroup.contacts[0].phone ? ` (${activeGroup.contacts[0].phone})` : ''}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => onClearGroupOrder(activeGroup.id)}
                    className="px-3 py-2 rounded-xl text-xs font-bold bg-charcoal hover:bg-red-950/40 text-zinc-400 hover:text-red-300 border border-bronze/40 transition cursor-pointer"
                  >
                    Vider
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyGroupOrder}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-charcoal hover:bg-gunmetal text-gold-light border border-gold/40 transition cursor-pointer"
                  >
                    📋 Copier commande
                  </button>
                  <button
                    type="button"
                    onClick={() => onGoToOrdersWithGroup(activeGroup.id)}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-charcoal hover:bg-gunmetal text-sky-200 border border-sky-500/40 transition cursor-pointer"
                  >
                    🛒 Ouvrir dans Commandes
                  </button>
                  {!readonly && (
                    <>
                      <select
                        value={debitAccount}
                        onChange={(e) =>
                          setDebitAccount(e.target.value as 'none' | 'legal' | 'illegal')
                        }
                        className="bg-charcoal border border-bronze/60 focus:border-gold rounded-xl px-2.5 py-2 text-xs text-zinc-200 outline-none"
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
                          onConfirmGroupOrder(activeGroup, activeCart, debitAccount)
                        }
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-gold hover:bg-gold-light text-obsidian transition shadow-lg cursor-pointer"
                      >
                        ✅ Valider &amp; Réceptionner
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ARTICLES VENDUS OU RACHETÉS PAR LE GROUPE */}
          <div className="bg-charcoal/95 gold-border rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-bronze/40">
              <div>
                <h3 className="font-display text-lg font-bold text-white">
                  Tarifs — Ce que vend ou rachète {activeGroup.name}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {getFlyerGroupKey(activeGroup) === 'eminence'
                    ? 'Choisissez une mission pour acheter le Pack complet ou seulement les items requis à l’unité.'
                    : 'Ajoutez directement les articles vendus au panier ou éditez les tarifs / rachats.'}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {getFlyerGroupKey(activeGroup) === 'eminence' && (
                  <div className="inline-flex items-center bg-obsidian border border-gold/40 rounded-xl p-0.5">
                    <button
                      type="button"
                      onClick={() => setEminenceViewMode('missions')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        eminenceViewMode === 'missions'
                          ? 'bg-gold text-obsidian'
                          : 'text-zinc-300 hover:text-white'
                      }`}
                    >
                      Par Mission (Pack / Seul)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEminenceViewMode('grid')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        eminenceViewMode === 'grid'
                          ? 'bg-gold text-obsidian font-bold'
                          : 'text-zinc-300 hover:text-white'
                      }`}
                    >
                      Grille ({activeGroup.items.length})
                    </button>
                  </div>
                )}
                {!readonly && (
                  <>
                    <button
                      type="button"
                      onClick={() => openNewItemForm('sell')}
                      className="px-3 py-2 rounded-xl text-xs font-bold bg-gold/15 hover:bg-gold hover:text-obsidian text-gold-light border border-gold/45 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <PackagePlus className="w-3.5 h-3.5" />
                      + Article vendu
                    </button>
                    <button
                      type="button"
                      onClick={() => openNewItemForm('buyback')}
                      className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-500/15 hover:bg-emerald-400 hover:text-obsidian text-emerald-200 border border-emerald-500/45 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      + Rachat (Recel)
                    </button>
                  </>
                )}
              </div>
            </div>

            {itemFormOpen && !readonly && (
              <form
                onSubmit={handleSaveItem}
                className="bg-obsidian/85 border border-gold/45 rounded-xl p-4 space-y-3"
              >
                <div className="text-[11px] font-bold uppercase tracking-wider text-gold">
                  {editingItemId ? `Modifier : ${itName}` : `Ajouter un article — ${activeGroup.name}`}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                  <input
                    type="text"
                    maxLength={80}
                    value={itName}
                    onChange={(e) => setItName(e.target.value)}
                    placeholder="Nom (ex: Boîte 9 mm, Chargeur, Lingot...)"
                    className="lg:col-span-2 bg-charcoal border border-bronze/60 focus:border-gold rounded-lg px-3 py-2 text-xs text-white outline-none"
                  />
                  <select
                    value={itTradeType}
                    onChange={(e) => setItTradeType(e.target.value as CatalogTradeType)}
                    className="bg-charcoal border border-bronze/60 focus:border-gold rounded-lg px-3 py-2 text-xs text-white outline-none"
                  >
                    <option value="sell">🛒 Le groupe VEND (on achète)</option>
                    <option value="buyback">💰 Le groupe RACHÈTE (on revend)</option>
                  </select>
                  <select
                    value={itCategory}
                    onChange={(e) => setItCategory(e.target.value as CatalogItemCategory)}
                    className="bg-charcoal border border-bronze/60 focus:border-gold rounded-lg px-3 py-2 text-xs text-white outline-none"
                  >
                    {Object.entries(CATALOG_ITEM_CATEGORY_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={itPrice}
                      onChange={(e) => setItPrice(e.target.value)}
                      placeholder="Prix ($)"
                      className="w-full bg-charcoal border border-bronze/60 focus:border-gold rounded-lg pl-3 pr-7 py-2 text-xs text-right font-mono tabular-nums text-gold-light outline-none"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-zinc-500 pointer-events-none">
                      $
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                  {itTradeType === 'sell' && (
                    <select
                      value={itLinkedGearKey}
                      onChange={(e) => setItLinkedGearKey(e.target.value as GearKey | '')}
                      className="bg-charcoal border border-bronze/60 focus:border-gold rounded-lg px-3 py-2 text-xs text-zinc-200 outline-none"
                      title="Si lié, la réception de commande ajoute automatiquement la quantité au stock du coffre"
                    >
                      <option value="">Stock coffre auto (article du catalogue)</option>
                      {INVENTORY_ITEMS.map((inv) => (
                        <option key={inv.key} value={inv.key}>
                          Lier au coffre : {inv.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <input
                    type="text"
                    maxLength={160}
                    value={itNotes}
                    onChange={(e) => setItNotes(e.target.value)}
                    placeholder="Précision optionnelle (calibre, condition, délai...)"
                    className={`${itTradeType === 'buyback' ? 'lg:col-span-2' : ''} bg-charcoal border border-bronze/60 focus:border-gold rounded-lg px-3 py-2 text-xs text-zinc-200 outline-none`}
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setItemFormOpen(false);
                      setEditingItemId(null);
                    }}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-charcoal border border-gunmetal text-zinc-300 cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg text-xs font-bold bg-gold hover:bg-gold-light text-obsidian cursor-pointer"
                  >
                    {editingItemId ? 'Enregistrer' : 'Ajouter'}
                  </button>
                </div>
              </form>
            )}

            {getFlyerGroupKey(activeGroup) === 'eminence' && eminenceViewMode === 'missions' ? (
              <EminenceMissionCatalog
                group={activeGroup}
                cart={activeCart}
                inventoryStock={inventoryStock}
                inventoryPrices={inventoryPrices}
                rewardStocks={rewardStocks}
                onAdjustItem={(itemId, delta) =>
                  onAdjustGroupOrderItem(activeGroup.id, itemId, delta)
                }
                readonly={readonly}
                onEditItem={openEditItemForm}
                onDeleteItem={handleDeleteItem}
              />
            ) : (
              <>
            {/* FILTRES + RECHERCHE */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setTradeFilter('ALL');
                    setCategoryFilter('ALL');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                    tradeFilter === 'ALL'
                      ? 'bg-gold text-obsidian border-gold'
                      : 'bg-obsidian/80 text-zinc-300 border-bronze/50'
                  }`}
                >
                  Tout ({activeGroup.items.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTradeFilter('sell');
                    setCategoryFilter('ALL');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                    tradeFilter === 'sell'
                      ? 'bg-amber-500/20 text-amber-200 border-amber-400'
                      : 'bg-obsidian/80 text-zinc-300 border-bronze/40'
                  }`}
                >
                  🛒 Ils vendent ({activeGroup.items.filter((i) => i.tradeType === 'sell').length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTradeFilter('buyback');
                    setCategoryFilter('ALL');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                    tradeFilter === 'buyback'
                      ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400'
                      : 'bg-obsidian/80 text-zinc-300 border-bronze/40'
                  }`}
                >
                  💰 Ils rachètent ({activeGroup.items.filter((i) => i.tradeType === 'buyback').length})
                </button>

                {availableCategories.length > 1 && (
                  <select
                    value={categoryFilter}
                    onChange={(e) =>
                      setCategoryFilter(e.target.value as 'ALL' | CatalogItemCategory)
                    }
                    className="bg-obsidian border border-bronze/50 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 outline-none"
                  >
                    <option value="ALL">Toutes catégories</option>
                    {availableCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {CATALOG_ITEM_CATEGORY_LABELS[cat]}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="relative w-full lg:w-64">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Rechercher un article..."
                  className="w-full bg-obsidian border border-bronze/50 focus:border-gold rounded-lg pl-8 pr-3 py-1.5 text-xs text-white outline-none"
                />
              </div>
            </div>

            {/* GRILLE DES ARTICLES */}
            {filteredItems.length === 0 ? (
              <div className="bg-obsidian/60 border border-bronze/35 rounded-xl p-6 text-center text-xs text-zinc-400">
                Aucun article ne correspond aux filtres sélectionnés.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredItems.map((item) => {
                  const isSell = item.tradeType === 'sell';
                  const qtyInCart = isSell
                    ? Math.max(0, Math.floor(Number(activeCart[item.id]) || 0))
                    : 0;
                  const isTrackableCatalogItem =
                    isSell &&
                    !item.linkedGearKey &&
                    item.category !== 'reparation' &&
                    item.category !== 'butin';
                  const effectiveStockKey = item.linkedGearKey
                    ? item.linkedGearKey
                    : isTrackableCatalogItem
                      ? getCatalogStockKey(item.id)
                      : null;
                  const linkedStockQty = effectiveStockKey
                    ? Math.max(0, Number(inventoryStock[effectiveStockKey]) || 0)
                    : null;
                  const linkedInvName = item.linkedGearKey
                    ? INVENTORY_ITEMS.find((inv) => inv.key === item.linkedGearKey)?.name || item.name
                    : isTrackableCatalogItem
                      ? item.name
                      : null;
                  const normalizeFr = (s: string) =>
                    s
                      .toLowerCase()
                      .normalize('NFD')
                      .replace(/[\u0300-\u036f]/g, '')
                      .trim();
                  const matchedReward = !isSell
                    ? REWARD_ITEMS.find((r) => {
                        const rNorm = normalizeFr(r.name);
                        const itNorm = normalizeFr(item.name);
                        return rNorm === itNorm || rNorm.startsWith(itNorm) || itNorm.includes(rNorm);
                      })
                    : undefined;
                  const matchingLootQty = matchedReward
                    ? Math.max(0, Number(rewardStocks[matchedReward.key]?.qty) || 0)
                    : undefined;

                  const itemVisual = getItemShowcaseImage(item, activeGroup);
                  const visualKey = `it_img_${item.id}`;
                  const effectivePrice = resolveItemDisplayPrice(item);

                  return (
                    <div
                      key={item.id}
                      className={`group bg-obsidian border rounded-xl overflow-hidden flex flex-col justify-between shadow-md transition-all duration-200 hover:-translate-y-0.5 ${
                        qtyInCart > 0
                          ? 'border-gold/75 ring-1 ring-gold/35'
                          : isSell
                            ? 'border-bronze/40 hover:border-gold/50'
                            : 'border-emerald-500/35 hover:border-emerald-400/60'
                      }`}
                    >
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-charcoal">
                        {!failedImages[visualKey] ? (
                          <img
                            src={itemVisual.src}
                            alt={itemVisual.alt}
                            referrerPolicy="no-referrer"
                            onError={() =>
                              setFailedImages((prev) => ({ ...prev, [visualKey]: true }))
                            }
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-charcoal to-obsidian text-gold/70 p-4">
                            <Package className="w-8 h-8" />
                            <span className="text-[11px] font-semibold text-center text-zinc-300">
                              {item.name}
                            </span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/20 to-transparent" />
                        {qtyInCart > 0 && (
                          <span className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-gold text-obsidian shadow-md tabular-nums">
                            &times;{qtyInCart} panier
                          </span>
                        )}
                      </div>

                      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                            <span
                              className={
                                isSell
                                  ? 'text-amber-300 font-semibold'
                                  : 'text-emerald-300 font-semibold'
                              }
                            >
                              {isSell ? 'Vend' : 'Rachète'}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{CATALOG_ITEM_CATEGORY_LABELS[item.category]}</span>
                          </div>

                          <div className="flex items-baseline justify-between gap-2">
                            <h4 className="font-semibold text-base text-white leading-snug">
                              {item.name}
                            </h4>
                            <span
                              className={`font-mono text-sm font-extrabold tabular-nums shrink-0 ${
                                effectivePrice > 0
                                  ? isSell
                                    ? 'text-gold'
                                    : 'text-emerald-300'
                                  : 'text-amber-300 text-xs'
                              }`}
                            >
                              {effectivePrice > 0 ? formatMoney(effectivePrice) : 'À fixer'}
                            </span>
                          </div>

                          {item.notes && (
                            <p className="text-[11px] text-zinc-400 leading-snug">{item.notes}</p>
                          )}

                          {linkedInvName && (
                            <div className="text-[11px] font-mono text-sky-300/90 tabular-nums pt-0.5">
                              Coffre ({linkedInvName}) : <strong>{linkedStockQty}</strong>
                            </div>
                          )}
                          {!isSell && matchingLootQty !== undefined && matchingLootQty > 0 && (
                            <div className="text-[11px] font-mono text-emerald-300 tabular-nums pt-0.5">
                              En coffre : <strong>{matchingLootQty}</strong> ({formatMoney(matchingLootQty * effectivePrice)})
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-3 border-t border-bronze/30">
                          {isSell ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={qtyInCart <= 0}
                                onClick={() => onAdjustGroupOrderItem(activeGroup.id, item.id, -1)}
                                className="w-8 h-8 bg-gunmetal hover:bg-bronze disabled:opacity-35 text-white rounded-lg font-bold flex items-center justify-center cursor-pointer"
                              >
                                -
                              </button>
                              <span
                                className={`font-mono tabular-nums text-xs font-extrabold w-7 text-center ${
                                  qtyInCart > 0 ? 'text-gold' : 'text-zinc-500'
                                }`}
                              >
                                {qtyInCart}
                              </span>
                              <button
                                type="button"
                                onClick={() => onAdjustGroupOrderItem(activeGroup.id, item.id, 1)}
                                className="w-8 h-8 bg-gunmetal hover:bg-gold hover:text-obsidian text-white rounded-lg font-bold flex items-center justify-center cursor-pointer"
                                title="Ajouter 1 à la commande"
                              >
                                +1
                              </button>
                              <button
                                type="button"
                                onClick={() => onAdjustGroupOrderItem(activeGroup.id, item.id, 5)}
                                className="px-2.5 h-8 bg-charcoal hover:bg-gold/25 border border-bronze/50 text-gold-light rounded-lg text-[11px] font-mono font-bold cursor-pointer"
                                title="Ajouter 5 à la commande"
                              >
                                +5
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] font-mono text-emerald-300/90">
                              Prix de rachat unitaire
                            </span>
                          )}

                          {!readonly && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => openEditItemForm(item)}
                                className="p-2 rounded bg-charcoal border border-gunmetal text-zinc-400 hover:text-gold cursor-pointer"
                                title="Modifier l'article"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-2 rounded bg-charcoal border border-gunmetal text-zinc-400 hover:text-red-400 cursor-pointer"
                                title="Supprimer l'article"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
              </>
            )}
          </div>
        </div>
      )}

      {/* GALERIE DES AFFICHES OFFICIELLES DU GROUPE */}
      {showFlyersModal &&
        activeGroup &&
        (() => {
          const flyerKey = getFlyerGroupKey(activeGroup);
          const flyers = flyerKey ? GROUP_FLYERS[flyerKey] : [];
          if (flyers.length === 0) return null;
          return (
            <div
              className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setShowFlyersModal(false)}
            >
              <div
                className={`bg-charcoal border rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-4 ${
                  flyerKey === 'brad'
                    ? 'border-purple-500/50'
                    : flyerKey === 'eminence'
                      ? 'border-gold/50'
                      : 'border-sky-500/50'
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-bronze/40">
                  <div>
                    <h3 className="font-display text-lg font-bold text-white">
                      {flyers.length > 1 ? 'Affiches officielles' : 'Affiche officielle'} —{' '}
                      {activeGroup.name}
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Tarifs et visuels officiels transmis pour ce groupe
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowFlyersModal(false)}
                    className="p-2 rounded-lg bg-obsidian border border-bronze/50 text-zinc-300 hover:text-white cursor-pointer"
                    aria-label="Fermer la galerie"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div
                  className={`grid grid-cols-1 ${
                    flyers.length > 1 ? 'md:grid-cols-2' : 'max-w-2xl mx-auto'
                  } gap-4 items-start`}
                >
                  {flyers.map((flyer) => (
                    <div
                      key={flyer.src}
                      className="bg-obsidian border border-bronze/40 rounded-xl overflow-hidden"
                    >
                      <img
                        src={flyer.src}
                        alt={flyer.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-auto object-contain bg-black"
                      />
                      <div className="px-3.5 py-2.5 text-xs font-semibold text-zinc-200 border-t border-bronze/30">
                        {flyer.title}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
};
