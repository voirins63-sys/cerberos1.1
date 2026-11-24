import { DEFAULT_CATALOG_GROUPS, INVENTORY_ITEMS } from '@/src/data/cartelData';
import type { CatalogGroupsMap, CatalogItem, GearKey, InventoryStock } from '@/src/types/cartel';
import { getCatalogStockKey } from '@/src/utils/finance';

export interface EminenceMissionRequirement {
  itemId: string;
  qty: number;
  note?: string;
}

export interface EminenceMissionBlueprint {
  code: string;
  title: string;
  major: boolean;
  planningGearKey?: GearKey | 'amu';
  packItemId: string | null;
  summary: string;
  requirements: EminenceMissionRequirement[];
}

export const EMINENCE_MISSIONS: EminenceMissionBlueprint[] = [
  {
    code: '01',
    title: 'ATM',
    major: false,
    planningGearKey: 'atm',
    packItemId: 'em_pack_01_atm',
    summary: 'Corde lourde',
    requirements: [{ itemId: 'em_corde_lourde', qty: 1 }],
  },
  {
    code: '02',
    title: 'Vol de maison',
    major: false,
    planningGearKey: 'mai',
    packItemId: 'em_pack_02_maison',
    summary: 'Outil de hacking',
    requirements: [{ itemId: 'em_outils_hacking', qty: 1 }],
  },
  {
    code: '03',
    title: 'Vol de véhicule',
    major: false,
    planningGearKey: 'veh',
    packItemId: 'em_pack_03_vehicule',
    summary: 'Items utilitaires (2× Carte de K)',
    requirements: [{ itemId: 'em_carte_k', qty: 2 }],
  },
  {
    code: '04',
    title: 'Fourgon blindé',
    major: false,
    planningGearKey: 'frg',
    packItemId: 'em_pack_04_fourgon',
    summary: 'Clé fourgon blindé uniquement',
    requirements: [{ itemId: 'em_cle_fourgon', qty: 1 }],
  },
  {
    code: '05',
    title: 'Supérettes',
    major: false,
    planningGearKey: 'sup',
    packItemId: 'em_pack_05_superettes',
    summary: 'Outils de supérettes (en pack)',
    requirements: [],
  },
  {
    code: '06',
    title: 'Fleeca',
    major: true,
    planningGearKey: 'fle',
    packItemId: 'em_pack_06_fleeca',
    summary: 'Clé banque Fleeca + Perceuse',
    requirements: [
      { itemId: 'em_cle_fleeca', qty: 1 },
      { itemId: 'em_perceuse', qty: 1 },
    ],
  },
  {
    code: '07',
    title: 'Yacht',
    major: true,
    planningGearKey: 'yac',
    packItemId: 'em_pack_07_yacht',
    summary: 'Clé Yacht + utilitaires',
    requirements: [{ itemId: 'em_cle_yacht', qty: 1 }],
  },
  {
    code: '09',
    title: 'Train',
    major: true,
    planningGearKey: 'trn',
    packItemId: 'em_pack_09_train',
    summary: 'Clé braquage train + Meuleuse',
    requirements: [
      { itemId: 'em_cle_train', qty: 1 },
      { itemId: 'em_meuleuse', qty: 1 },
    ],
  },
  {
    code: '10',
    title: 'Bobcat',
    major: true,
    planningGearKey: 'bob',
    packItemId: 'em_pack_10_bobcat',
    summary: 'Clé dépôt Bobcat + 2× Bombe',
    requirements: [
      { itemId: 'em_cle_bobcat', qty: 1 },
      { itemId: 'em_bombe', qty: 2 },
    ],
  },
  {
    code: '11',
    title: 'Bijouterie (Vengelico)',
    major: true,
    planningGearKey: 'bij',
    packItemId: 'em_pack_11_bijouterie',
    summary: 'Détonateur Vengelico, Bombe, Drone, Perceuse, Masque à Gaz',
    requirements: [
      { itemId: 'em_deto_vengelico', qty: 1 },
      { itemId: 'em_bombe', qty: 1 },
      { itemId: 'em_drone', qty: 1 },
      { itemId: 'em_perceuse', qty: 1 },
      { itemId: 'em_masque_gaz', qty: 1 },
    ],
  },
  {
    code: '12',
    title: 'Banque de Paleto',
    major: true,
    planningGearKey: 'pal',
    packItemId: 'em_pack_12_paleto',
    summary: 'Clé banque Paleto + Bombe + Perceuse',
    requirements: [
      { itemId: 'em_cle_paleto', qty: 1 },
      { itemId: 'em_bombe', qty: 1 },
      { itemId: 'em_perceuse', qty: 1 },
    ],
  },
  {
    code: '13',
    title: 'Pacific Bank',
    major: true,
    planningGearKey: 'pac',
    packItemId: 'em_pack_13_pacific',
    summary: 'Clé Pacific Bank + Drone + 2× Bombe + Outils Hacking',
    requirements: [
      { itemId: 'em_cle_pacific', qty: 1 },
      { itemId: 'em_drone', qty: 1 },
      { itemId: 'em_bombe', qty: 2 },
      { itemId: 'em_outils_hacking', qty: 1 },
    ],
  },
  {
    code: 'USB',
    title: 'Clef de Drogues',
    major: false,
    planningGearKey: 'drg',
    packItemId: null,
    summary: 'Clef Usb à l’unité',
    requirements: [{ itemId: 'em_clef_usb', qty: 1 }],
  },
  {
    code: 'AMU',
    title: 'Ammunation (Gros Coup)',
    major: true,
    planningGearKey: 'amu',
    packItemId: null,
    summary: 'Clé / Accès Ammunation à l’unité',
    requirements: [{ itemId: 'em_cle_ammunation', qty: 1 }],
  },
];

export const EMINENCE_KEY_ITEM_IDS_LIST = [
  'em_cle_fleeca',
  'em_cle_paleto',
  'em_cle_pacific',
  'em_cle_bobcat',
  'em_cle_fourgon',
  'em_cle_train',
  'em_deto_vengelico',
  'em_cle_yacht',
  'em_cle_ammunation',
] as const;

export const EMINENCE_UTILITY_ITEM_IDS_LIST = [
  'em_masque_gaz',
  'em_corde_lourde',
  'em_perceuse',
  'em_drone',
  'em_meuleuse',
  'em_outils_hacking',
  'em_bombe',
  'em_carte_k',
  'em_clef_usb',
] as const;

export const EMINENCE_KEY_ITEM_IDS = new Set<string>(EMINENCE_KEY_ITEM_IDS_LIST);
export const EMINENCE_UTILITY_ITEM_IDS = new Set<string>(EMINENCE_UTILITY_ITEM_IDS_LIST);

export const EMINENCE_MISSION_ITEM_IDS: Set<string> = (() => {
  const set = new Set<string>();
  EMINENCE_MISSIONS.forEach((m) => {
    if (m.packItemId) set.add(m.packItemId);
    m.requirements.forEach((r) => set.add(r.itemId));
  });
  EMINENCE_KEY_ITEM_IDS_LIST.forEach((id) => set.add(id));
  EMINENCE_UTILITY_ITEM_IDS_LIST.forEach((id) => set.add(id));
  return set;
})();

export function getEminenceCatalogItemsMap(
  catalogGroups?: CatalogGroupsMap
): Map<string, CatalogItem> {
  const map = new Map<string, CatalogItem>();
  DEFAULT_CATALOG_GROUPS.eminence?.items.forEach((item) => {
    map.set(item.id, item);
  });
  catalogGroups?.eminence?.items.forEach((item) => {
    map.set(item.id, item);
  });
  return map;
}

export function resolveCatalogItemStockKey(item: CatalogItem | undefined): string | null {
  if (!item || item.tradeType !== 'sell') return null;
  if (item.linkedGearKey && INVENTORY_ITEMS.some((inv) => inv.key === item.linkedGearKey)) {
    return item.linkedGearKey;
  }
  if (item.category !== 'reparation' && item.category !== 'butin') {
    return getCatalogStockKey(item.id);
  }
  return null;
}

export function getEminenceMissionByGearKey(
  gearKey: GearKey | string
): EminenceMissionBlueprint | undefined {
  if (!gearKey || gearKey === 'none') return undefined;
  return EMINENCE_MISSIONS.find((m) => m.planningGearKey === gearKey);
}

export function getStockKeyDisplayName(
  stockKey: string,
  catalogGroups?: CatalogGroupsMap
): string {
  const std = INVENTORY_ITEMS.find((i) => i.key === stockKey);
  if (std) return std.name;
  const groups = catalogGroups ? Object.values(catalogGroups) : [];
  for (const grp of groups) {
    for (const item of grp.items) {
      if (item.tradeType !== 'sell') continue;
      if (!item.linkedGearKey && getCatalogStockKey(item.id) === stockKey) {
        return item.name;
      }
    }
  }
  for (const item of DEFAULT_CATALOG_GROUPS.eminence?.items || []) {
    if (item.tradeType !== 'sell') continue;
    if (!item.linkedGearKey && getCatalogStockKey(item.id) === stockKey) {
      return item.name;
    }
  }
  return stockKey;
}

export const EMINENCE_ALL_MISSION_STOCK_KEYS: Set<string> = (() => {
  const set = new Set<string>();
  INVENTORY_ITEMS.filter((i) => i.category === 'tool' || i.category === 'heist_pack').forEach(
    (i) => set.add(i.key)
  );
  const map = getEminenceCatalogItemsMap();
  EMINENCE_MISSION_ITEM_IDS.forEach((itemId) => {
    const key = resolveCatalogItemStockKey(map.get(itemId));
    if (key) set.add(key);
  });
  return set;
})();

export interface MissionStockAvailability {
  available: boolean;
  count: number;
  packCount: number;
  soloCount: number;
  viaSoloOnly: boolean;
}

export function getSoloKitStockRequirements(
  gearKey: GearKey | string,
  catalogGroups?: CatalogGroupsMap
): Array<{ stockKey: string; qty: number }> {
  const blueprint = getEminenceMissionByGearKey(gearKey);
  if (!blueprint || blueprint.requirements.length === 0) return [];

  const catalogMap = getEminenceCatalogItemsMap(catalogGroups);
  const aggregated = new Map<string, number>();

  for (const req of blueprint.requirements) {
    const stockKey = resolveCatalogItemStockKey(catalogMap.get(req.itemId));
    if (!stockKey) {
      return [];
    }
    // Skip items that share the exact same stockKey as the pack/tool itself (e.g. ATM, Maison)
    if (stockKey === gearKey) continue;
    aggregated.set(stockKey, (aggregated.get(stockKey) || 0) + Math.max(1, req.qty));
  }

  return Array.from(aggregated.entries()).map(([stockKey, qty]) => ({ stockKey, qty }));
}

export function checkMissionStockAvailability(
  gearKey: GearKey | string,
  inventoryStock: InventoryStock,
  catalogGroups?: CatalogGroupsMap
): MissionStockAvailability {
  if (!gearKey || gearKey === 'none') {
    return {
      available: true,
      count: 999,
      packCount: 999,
      soloCount: 0,
      viaSoloOnly: false,
    };
  }

  const packCount = Math.max(0, Math.floor(Number(inventoryStock[gearKey]) || 0));
  const soloReqs = getSoloKitStockRequirements(gearKey, catalogGroups);

  let soloCount = 0;
  if (soloReqs.length > 0) {
    soloCount = Math.min(
      ...soloReqs.map(({ stockKey, qty }) =>
        Math.floor(Math.max(0, Math.floor(Number(inventoryStock[stockKey]) || 0)) / qty)
      )
    );
  }

  const totalCount = packCount + soloCount;
  return {
    available: totalCount > 0,
    count: totalCount,
    packCount,
    soloCount,
    viaSoloOnly: packCount === 0 && soloCount > 0,
  };
}

