export type MissionStatus = '' | 'success' | 'fail';

export type GearKey =
  | 'none'
  | 'sup'
  | 'atm'
  | 'mai'
  | 'veh'
  | 'frg'
  | 'drg'
  | 'gilet'
  | 'mun_9mm'
  | 'mun_45acp'
  | 'mun_44mag'
  | 'mun_50ae'
  | 'mun_pistolet'
  | 'mun_pm'
  | 'mun_fusil'
  | 'mun_pompe'
  | 'mun_sniper'
  | 'acc_chg_fusil'
  | 'acc_chg_pompe'
  | 'acc_lunette_macro'
  | 'acc_poignee'
  | 'acc_petite_lunette'
  | 'fle'
  | 'bij'
  | 'pal'
  | 'pac'
  | 'amu'
  | 'trn'
  | 'fbi'
  | 'yac'
  | 'uni'
  | 'bob';

export interface Mission {
  id: string;
  name: string;
  crims: string;
  wait: string;
  gearKey: GearKey;
  gearName: string;
  cost: number;
  major: boolean;
}

export interface DaySchedule {
  day: string;
  missions: Mission[];
}

export interface LostWeaponRecord {
  id: string;
  name: string;
  value: number;
  holderId: string;
  holderName: string;
}

export interface MissionStateEntry {
  status?: MissionStatus;
  completed?: boolean;
  gain?: number;
  cashGain?: number;
  extra?: number;
  players?: string[];
  gearConsumed?: boolean;
  usedGear?: Record<string, number>;
  loot?: Record<string, number>;
  lostWeapons?: LostWeaponRecord[];
  cashLossDebitAccount?: 'none' | 'legal' | 'illegal';
  cashLossDebitAmount?: number;
}

export type MissionTypeKey =
  | 'sup'
  | 'atm'
  | 'mai'
  | 'frg'
  | 'drg'
  | 'ket'
  | 'trn'
  | 'yac'
  | 'bob'
  | 'fle'
  | 'pal'
  | 'pac'
  | 'bij'
  | 'fbi'
  | 'amu'
  | 'uni';

export interface MissionRegulationRule {
  typeKey: MissionTypeKey;
  label: string;
  criminals: string;
  dailyLimit: number | null;
  weeklyLimit: number;
  waitMinutes: number;
  major: boolean;
}

export interface MissionScheduleMeta {
  scheduleOverrides: Record<string, string>;
  unplacedMissionIds: string[];
  lastRecalcDate: string;
  lastRecalcAt: string;
}

export interface MissionStates {
  __week?: string;
  [missionId: string]: MissionStateEntry | string | undefined;
}

export interface MissionFinance {
  status: MissionStatus;
  done: boolean;
  success: boolean;
  fail: boolean;
  cost: number;
  gain: number;
  extra: number;
  net: number;
}

export interface InventoryItem {
  key: Exclude<GearKey, 'none' | 'amu' | 'fbi' | 'uni'>;
  name: string;
  price: number;
  category: 'tool' | 'heist_pack' | 'protection' | 'accessory';
}

export type InventoryStock = Record<string, number>;
export type InventoryPrices = Record<string, number>;

export interface WeaponEntry {
  id: string;
  name: string;
  value: number;
  qty: number;
  holderId: string;
  notes?: string;
}

export type WeaponsStock = Record<string, WeaponEntry>;

export interface TreasuryMoney {
  legal: number;
  illegal: number;
}

export interface RewardItem {
  key: string;
  name: string;
  defaultVal: number;
  buyerGroup?: 'receleur' | 'whiskey';
}

export interface RewardStockEntry {
  qty: number;
  val: number;
}

export type RewardStocks = Record<string, RewardStockEntry>;

export type HierarchyUnitKey =
  | 'mando'
  | 'ojos'
  | 'bocas'
  | 'brazos'
  | 'cerebros'
  | 'cerberos';

export interface HierarchyMember {
  id: string;
  name: string;
  unit: HierarchyUnitKey;
  order: number;
  dossier: string;
}

export interface HierarchyTier {
  grade: string;
  title: string;
  units: HierarchyUnitKey[];
  top?: boolean;
  flat?: boolean;
}

export type DistinctionKey =
  | 'sang_fidele'
  | 'frere_armes'
  | 'loup_solitaire'
  | 'stratege'
  | 'homme_confiance'
  | 'legende';

export interface MemberRankingAdjustment {
  bonusPoints: number;
  note?: string;
  manualBadges?: DistinctionKey[];
}

export type MemberRankingsMap = Record<string, MemberRankingAdjustment>;

export type CatalogTradeType = 'sell' | 'buyback';

export type CatalogItemCategory =
  | 'munitions'
  | 'accessoires'
  | 'gilets'
  | 'armes'
  | 'reparation'
  | 'materiel'
  | 'butin'
  | 'autre';

export type CatalogGroupColor = 'blue' | 'gold' | 'crimson' | 'emerald' | 'purple';

export interface CatalogContact {
  id: string;
  name: string;
  role: string;
  phone: string;
  notes: string;
}

export interface CatalogItem {
  id: string;
  name: string;
  tradeType: CatalogTradeType;
  category: CatalogItemCategory;
  price: number;
  linkedGearKey?: GearKey | '';
  notes: string;
}

export interface CatalogGroup {
  id: string;
  name: string;
  specialty: string;
  color: CatalogGroupColor;
  notes: string;
  contacts: CatalogContact[];
  items: CatalogItem[];
}

export type CatalogGroupsMap = Record<string, CatalogGroup>;

export type AlbumPhotoCategory =
  | 'heists'
  | 'police'
  | 'hq'
  | 'identity'
  | 'members';

export interface AlbumPhotoRecord {
  id: string;
  title: string;
  category: AlbumPhotoCategory;
  caption: string;
  location: string;
  dateLabel: string;
  authorName: string;
  createdAtIso: string;
  mediaId?: string;
  externalUrl?: string;
  builtIn?: boolean;
}

export interface AlbumState {
  photos: Record<string, AlbumPhotoRecord>;
  favorites: string[];
}

export interface DiscordGazetteConfig {
  webhookUrl: string;
  autoEnabled: boolean;
  sendHour: number;
  sendMinute: number;
  includePhoto: boolean;
  customMessage: string;
  lastSentDate: string;
  lastSentAt: string;
  lastSentBy: string;
}

export type PayrollBasis = 'net_cartel' | 'net_member';

export interface CurrentWeekPayrollState {
  week: string;
  cartelPercent: number;
  membersPercent: number;
  basis: PayrollBasis;
  paidMemberIds: string[];
  settled: boolean;
  settledAt: string;
  settledBy: string;
  settledAmount: number;
  debitAccount: 'none' | 'legal' | 'illegal';
  debitAmount: number;
}

export interface PayrollMemberRow {
  memberId: string;
  memberName: string;
  unit: HierarchyUnitKey;
  missionsOk: number;
  missionsKo: number;
  heistsOk: number;
  grossRevenue: number;
  materialCostShare: number;
  lossShare: number;
  netContribution: number;
  sharePercent: number;
  payrollAmount: number;
  paid: boolean;
}

export interface WeeklyArchiveDayRow {
  day: string;
  dateLabel: string;
  ok: number;
  ko: number;
  totalMissions: number;
  cost: number;
  extra: number;
  gains: number;
  net: number;
}

export interface WeeklyArchiveMissionRow {
  id: string;
  name: string;
  day: string;
  major: boolean;
  status: 'success' | 'fail';
  gain: number;
  cost: number;
  extra: number;
  net: number;
  players: string[];
}

export interface WeeklyArchivePayrollSnapshot {
  cartelPercent: number;
  membersPercent: number;
  basis: PayrollBasis;
  distributableBase: number;
  cartelShareAmount: number;
  payrollPoolAmount: number;
  unattributedNet: number;
  settled: boolean;
  settledAt: string;
  settledBy: string;
  debitAccount: 'none' | 'legal' | 'illegal';
  debitAmount: number;
  rows: PayrollMemberRow[];
}

export interface WeeklyArchiveGlobalSnapshot {
  treasuryLegal: number;
  treasuryIllegal: number;
  treasuryTotal: number;
  rewardsValue: number;
  rewardsCount: number;
  inventoryValue: number;
  weaponsValue: number;
  weaponsCount: number;
  totalWealth: number;
  heistsOk: number;
  heistsTotal: number;
  activeMembersCount: number;
  completionRate: number;
  mvpName: string;
  mvpPoints: number;
}

export interface WeeklyArchiveRecord {
  id: string;
  week: string;
  label: string;
  archivedAt: string;
  archivedBy: string;
  notes?: string;
  summary: {
    successCount: number;
    failCount: number;
    totalMissions: number;
    grossGains: number;
    materialCost: number;
    missionLoss: number;
    weaponsLossAmount: number;
    netProfit: number;
  };
  globalSnapshot?: WeeklyArchiveGlobalSnapshot;
  dailyRows: WeeklyArchiveDayRow[];
  missions: WeeklyArchiveMissionRow[];
  payroll: WeeklyArchivePayrollSnapshot;
}

export interface HistoryState {
  archives: Record<string, WeeklyArchiveRecord>;
  currentPayroll: CurrentWeekPayrollState;
}

export type TabKey =
  | 'home'
  | 'planning'
  | 'inventory'
  | 'orders'
  | 'catalog'
  | 'treasury'
  | 'accounting'
  | 'history'
  | 'archives'
  | 'ranking'
  | 'hierarchy'
  | 'album';
