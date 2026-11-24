import type {
  CatalogGroupsMap,
  CatalogItemCategory,
  DaySchedule,
  DistinctionKey,
  HierarchyMember,
  HierarchyTier,
  HierarchyUnitKey,
  InventoryItem,
  MissionRegulationRule,
  MissionTypeKey,
  RewardItem,
} from '@/src/types/cartel';

export const DEFAULT_SECRET_CODE = 'CERBEROS2026';

export const WEEKLY_SCHEDULE: DaySchedule[] = [
  {
    day: 'Lundi',
    missions: [
      { id: 'lun_sup_1', name: 'Supérette #1', crims: '2 à 4', wait: '5 min', gearKey: 'sup', gearName: 'Outils de supérettes (1 000 $)', cost: 1000, major: false },
      { id: 'lun_sup_2', name: 'Supérette #2', crims: '2 à 4', wait: '5 min', gearKey: 'sup', gearName: 'Outils de supérettes (1 000 $)', cost: 1000, major: false },
      { id: 'lun_atm_1', name: 'Distributeur ATM #1', crims: '2 à 4', wait: '5 min', gearKey: 'atm', gearName: 'Corde lourde (500 $)', cost: 500, major: false },
      { id: 'lun_atm_2', name: 'Distributeur ATM #2', crims: '2 à 4', wait: '5 min', gearKey: 'atm', gearName: 'Corde lourde (500 $)', cost: 500, major: false },
      { id: 'lun_mai_1', name: 'Maison #1', crims: '1 à 4', wait: '5 min', gearKey: 'mai', gearName: 'Outil de hacking (1 500 $)', cost: 1500, major: false },
      { id: 'lun_mai_2', name: 'Maison #2', crims: '1 à 4', wait: '5 min', gearKey: 'mai', gearName: 'Outil de hacking (1 500 $)', cost: 1500, major: false },
      { id: 'lun_frg_1', name: 'Fourgon Blindé', crims: '2 à 4', wait: '5 min', gearKey: 'frg', gearName: 'Clé fourgon blindé (1 050 $)', cost: 1050, major: false },
      { id: 'lun_drg_1', name: 'Clef de Drogues #1', crims: '3 à 6', wait: '5 min', gearKey: 'drg', gearName: 'Clé USB 3.1 (750 $)', cost: 750, major: false },
      { id: 'lun_drg_2', name: 'Clef de Drogues #2', crims: '3 à 6', wait: '5 min', gearKey: 'drg', gearName: 'Clé USB 3.1 (750 $)', cost: 750, major: false },
      { id: 'lun_drg_3', name: 'Clef de Drogues #3', crims: '3 à 6', wait: '5 min', gearKey: 'drg', gearName: 'Clé USB 3.1 (750 $)', cost: 750, major: false },
      { id: 'lun_ket_1', name: 'Carte de Kétamine', crims: 'Libre (-)', wait: '5 min', gearKey: 'none', gearName: 'Sans pack spécifique', cost: 0, major: false },
      { id: 'lun_fle_1', name: 'Banque Fleeca (Gros Coup)', crims: '4 à 10', wait: '5 min', gearKey: 'fle', gearName: 'Clé banque Fleeca + Perceuse / Pack (3 300 $)', cost: 3300, major: true },
    ],
  },
  {
    day: 'Mardi',
    missions: [
      { id: 'mar_sup_1', name: 'Supérette #1', crims: '2 à 4', wait: '5 min', gearKey: 'sup', gearName: 'Outils de supérettes (1 000 $)', cost: 1000, major: false },
      { id: 'mar_sup_2', name: 'Supérette #2', crims: '2 à 4', wait: '5 min', gearKey: 'sup', gearName: 'Outils de supérettes (1 000 $)', cost: 1000, major: false },
      { id: 'mar_atm_1', name: 'Distributeur ATM #1', crims: '2 à 4', wait: '5 min', gearKey: 'atm', gearName: 'Corde lourde (500 $)', cost: 500, major: false },
      { id: 'mar_atm_2', name: 'Distributeur ATM #2', crims: '2 à 4', wait: '5 min', gearKey: 'atm', gearName: 'Corde lourde (500 $)', cost: 500, major: false },
      { id: 'mar_mai_1', name: 'Maison #1', crims: '1 à 4', wait: '5 min', gearKey: 'mai', gearName: 'Outil de hacking (1 500 $)', cost: 1500, major: false },
      { id: 'mar_mai_2', name: 'Maison #2', crims: '1 à 4', wait: '5 min', gearKey: 'mai', gearName: 'Outil de hacking (1 500 $)', cost: 1500, major: false },
      { id: 'mar_frg_1', name: 'Fourgon Blindé', crims: '2 à 4', wait: '5 min', gearKey: 'frg', gearName: 'Clé fourgon blindé (1 050 $)', cost: 1050, major: false },
      { id: 'mar_drg_1', name: 'Clef de Drogues #1', crims: '3 à 6', wait: '5 min', gearKey: 'drg', gearName: 'Clé USB 3.1 (750 $)', cost: 750, major: false },
      { id: 'mar_drg_2', name: 'Clef de Drogues #2', crims: '3 à 6', wait: '5 min', gearKey: 'drg', gearName: 'Clé USB 3.1 (750 $)', cost: 750, major: false },
      { id: 'mar_drg_3', name: 'Clef de Drogues #3', crims: '3 à 6', wait: '5 min', gearKey: 'drg', gearName: 'Clé USB 3.1 (750 $)', cost: 750, major: false },
      { id: 'mar_ket_1', name: 'Carte de Kétamine', crims: 'Libre (-)', wait: '5 min', gearKey: 'none', gearName: 'Sans pack spécifique', cost: 0, major: false },
      { id: 'mar_bij_1', name: 'Bijouterie (Gros Coup)', crims: '6 à 15', wait: '10 min', gearKey: 'bij', gearName: 'Détonateur Vengelico, Bombe, Drone, Perceuse, Masque / Pack (5 600 $)', cost: 5600, major: true },
    ],
  },
  {
    day: 'Mercredi',
    missions: [
      { id: 'mer_sup_1', name: 'Supérette #1', crims: '2 à 4', wait: '5 min', gearKey: 'sup', gearName: 'Outils de supérettes (1 000 $)', cost: 1000, major: false },
      { id: 'mer_sup_2', name: 'Supérette #2', crims: '2 à 4', wait: '5 min', gearKey: 'sup', gearName: 'Outils de supérettes (1 000 $)', cost: 1000, major: false },
      { id: 'mer_atm_1', name: 'Distributeur ATM #1', crims: '2 à 4', wait: '5 min', gearKey: 'atm', gearName: 'Corde lourde (500 $)', cost: 500, major: false },
      { id: 'mer_atm_2', name: 'Distributeur ATM #2', crims: '2 à 4', wait: '5 min', gearKey: 'atm', gearName: 'Corde lourde (500 $)', cost: 500, major: false },
      { id: 'mer_mai_1', name: 'Maison #1', crims: '1 à 4', wait: '5 min', gearKey: 'mai', gearName: 'Outil de hacking (1 500 $)', cost: 1500, major: false },
      { id: 'mer_mai_2', name: 'Maison #2', crims: '1 à 4', wait: '5 min', gearKey: 'mai', gearName: 'Outil de hacking (1 500 $)', cost: 1500, major: false },
      { id: 'mer_frg_1', name: 'Fourgon Blindé', crims: '2 à 4', wait: '5 min', gearKey: 'frg', gearName: 'Clé fourgon blindé (1 050 $)', cost: 1050, major: false },
      { id: 'mer_drg_1', name: 'Clef de Drogues #1', crims: '3 à 6', wait: '5 min', gearKey: 'drg', gearName: 'Clé USB 3.1 (750 $)', cost: 750, major: false },
      { id: 'mer_drg_2', name: 'Clef de Drogues #2', crims: '3 à 6', wait: '5 min', gearKey: 'drg', gearName: 'Clé USB 3.1 (750 $)', cost: 750, major: false },
      { id: 'mer_drg_3', name: 'Clef de Drogues #3', crims: '3 à 6', wait: '5 min', gearKey: 'drg', gearName: 'Clé USB 3.1 (750 $)', cost: 750, major: false },
      { id: 'mer_ket_1', name: 'Carte de Kétamine', crims: 'Libre (-)', wait: '5 min', gearKey: 'none', gearName: 'Sans pack spécifique', cost: 0, major: false },
      { id: 'mer_pal_1', name: 'Banque de Paleto (Gros Coup)', crims: '5 à 9', wait: '5 min', gearKey: 'pal', gearName: 'Clé Paleto, Bombe, Perceuse / Pack (4 800 $)', cost: 4800, major: true },
    ],
  },
  {
    day: 'Jeudi',
    missions: [
      { id: 'jeu_sup_1', name: 'Supérette #1', crims: '2 à 4', wait: '5 min', gearKey: 'sup', gearName: 'Outils de supérettes (1 000 $)', cost: 1000, major: false },
      { id: 'jeu_sup_2', name: 'Supérette #2', crims: '2 à 4', wait: '5 min', gearKey: 'sup', gearName: 'Outils de supérettes (1 000 $)', cost: 1000, major: false },
      { id: 'jeu_atm_1', name: 'Distributeur ATM #1', crims: '2 à 4', wait: '5 min', gearKey: 'atm', gearName: 'Corde lourde (500 $)', cost: 500, major: false },
      { id: 'jeu_atm_2', name: 'Distributeur ATM #2', crims: '2 à 4', wait: '5 min', gearKey: 'atm', gearName: 'Corde lourde (500 $)', cost: 500, major: false },
      { id: 'jeu_mai_1', name: 'Maison #1', crims: '1 à 4', wait: '5 min', gearKey: 'mai', gearName: 'Outil de hacking (1 500 $)', cost: 1500, major: false },
      { id: 'jeu_mai_2', name: 'Maison #2', crims: '1 à 4', wait: '5 min', gearKey: 'mai', gearName: 'Outil de hacking (1 500 $)', cost: 1500, major: false },
      { id: 'jeu_frg_1', name: 'Fourgon Blindé', crims: '2 à 4', wait: '5 min', gearKey: 'frg', gearName: 'Clé fourgon blindé (1 050 $)', cost: 1050, major: false },
      { id: 'jeu_drg_1', name: 'Clef de Drogues #1', crims: '3 à 6', wait: '5 min', gearKey: 'drg', gearName: 'Clé USB 3.1 (750 $)', cost: 750, major: false },
      { id: 'jeu_drg_2', name: 'Clef de Drogues #2', crims: '3 à 6', wait: '5 min', gearKey: 'drg', gearName: 'Clé USB 3.1 (750 $)', cost: 750, major: false },
      { id: 'jeu_drg_3', name: 'Clef de Drogues #3', crims: '3 à 6', wait: '5 min', gearKey: 'drg', gearName: 'Clé USB 3.1 (750 $)', cost: 750, major: false },
      { id: 'jeu_ket_1', name: 'Carte de Kétamine', crims: 'Libre (-)', wait: '5 min', gearKey: 'none', gearName: 'Sans pack spécifique', cost: 0, major: false },
      { id: 'jeu_pac_1', name: 'Pacific Bank (Gros Coup)', crims: '6 à 15', wait: '10 min', gearKey: 'pac', gearName: 'Clé Pacific, Drone, 2× Bombe, Hacking / Pack (7 800 $)', cost: 7800, major: true },
    ],
  },
  {
    day: 'Vendredi',
    missions: [
      { id: 'ven_sup_1', name: 'Supérette #1 (Fin quota)', crims: '2 à 4', wait: '5 min', gearKey: 'sup', gearName: 'Outils de supérettes (1 000 $)', cost: 1000, major: false },
      { id: 'ven_sup_2', name: 'Supérette #2 (Fin quota)', crims: '2 à 4', wait: '5 min', gearKey: 'sup', gearName: 'Outils de supérettes (1 000 $)', cost: 1000, major: false },
      { id: 'ven_atm_1', name: 'Distributeur ATM #1 (Fin quota)', crims: '2 à 4', wait: '5 min', gearKey: 'atm', gearName: 'Corde lourde (500 $)', cost: 500, major: false },
      { id: 'ven_atm_2', name: 'Distributeur ATM #2 (Fin quota)', crims: '2 à 4', wait: '5 min', gearKey: 'atm', gearName: 'Corde lourde (500 $)', cost: 500, major: false },
      { id: 'ven_mai_1', name: 'Maison #1 (Fin quota)', crims: '1 à 4', wait: '5 min', gearKey: 'mai', gearName: 'Outil de hacking (1 500 $)', cost: 1500, major: false },
      { id: 'ven_mai_2', name: 'Maison #2 (Fin quota)', crims: '1 à 4', wait: '5 min', gearKey: 'mai', gearName: 'Outil de hacking (1 500 $)', cost: 1500, major: false },
      { id: 'ven_frg_1', name: 'Fourgon Blindé', crims: '2 à 4', wait: '5 min', gearKey: 'frg', gearName: 'Clé fourgon blindé (1 050 $)', cost: 1050, major: false },
      { id: 'ven_drg_1', name: 'Clef de Drogues #1', crims: '3 à 6', wait: '5 min', gearKey: 'drg', gearName: 'Clé USB 3.1 (750 $)', cost: 750, major: false },
      { id: 'ven_drg_2', name: 'Clef de Drogues #2', crims: '3 à 6', wait: '5 min', gearKey: 'drg', gearName: 'Clé USB 3.1 (750 $)', cost: 750, major: false },
      { id: 'ven_drg_3', name: 'Clef de Drogues #3', crims: '3 à 6', wait: '5 min', gearKey: 'drg', gearName: 'Clé USB 3.1 (750 $)', cost: 750, major: false },
      { id: 'ven_ket_1', name: 'Carte de Kétamine', crims: 'Libre (-)', wait: '5 min', gearKey: 'none', gearName: 'Sans pack spécifique', cost: 0, major: false },
      { id: 'ven_amu_1', name: 'Amunation (Gros Coup)', crims: '6 à 10', wait: '10 min', gearKey: 'amu', gearName: 'Clé Ammunation (4 000 $)', cost: 4000, major: true },
      { id: 'ven_trn_1', name: 'Train #1 (Gros Coup)', crims: '3 à 8', wait: '5 min', gearKey: 'trn', gearName: 'Clé train + Meuleuse / Pack Train (3 800 $)', cost: 3800, major: true },
      { id: 'ven_bob_1', name: 'Bobcat #1 (Gros Coup)', crims: '3 à 10', wait: '5 min', gearKey: 'bob', gearName: 'Clé dépôt Bobcat + 2× Bombe / Pack (4 500 $)', cost: 4500, major: true },
    ],
  },
  {
    day: 'Samedi',
    missions: [
      { id: 'sam_frg_1', name: 'Fourgon Blindé', crims: '2 à 4', wait: '5 min', gearKey: 'frg', gearName: 'Clé fourgon blindé (1 050 $)', cost: 1050, major: false },
      { id: 'sam_drg_1', name: 'Clef de Drogues #1', crims: '3 à 6', wait: '5 min', gearKey: 'drg', gearName: 'Clé USB 3.1 (750 $)', cost: 750, major: false },
      { id: 'sam_drg_2', name: 'Clef de Drogues #2', crims: '3 à 6', wait: '5 min', gearKey: 'drg', gearName: 'Clé USB 3.1 (750 $)', cost: 750, major: false },
      { id: 'sam_drg_3', name: 'Clef de Drogues #3', crims: '3 à 6', wait: '5 min', gearKey: 'drg', gearName: 'Clé USB 3.1 (750 $)', cost: 750, major: false },
      { id: 'sam_ket_1', name: 'Carte de Kétamine', crims: 'Libre (-)', wait: '5 min', gearKey: 'none', gearName: 'Sans pack spécifique', cost: 0, major: false },
      { id: 'sam_fbi_1', name: 'FBI (Gros Coup)', crims: '8 à 15', wait: '10 min', gearKey: 'fbi', gearName: 'Sans pack tarifé', cost: 0, major: true },
      { id: 'sam_yac_1', name: 'Yacht #1 (Gros Coup)', crims: '3 à 8', wait: '5 min', gearKey: 'yac', gearName: 'Clé Yacht / Pack Yacht (4 000 $)', cost: 4000, major: true },
      { id: 'sam_trn_2', name: 'Train #2 (Fin quota Gros Coup)', crims: '3 à 8', wait: '5 min', gearKey: 'trn', gearName: 'Clé train + Meuleuse / Pack Train (3 800 $)', cost: 3800, major: true },
    ],
  },
  {
    day: 'Dimanche',
    missions: [
      { id: 'dim_frg_1', name: 'Fourgon Blindé (Fin quota)', crims: '2 à 4', wait: '5 min', gearKey: 'frg', gearName: 'Clé fourgon blindé (1 050 $)', cost: 1050, major: false },
      { id: 'dim_drg_1', name: 'Clef de Drogues #1 (Fin quota)', crims: '3 à 6', wait: '5 min', gearKey: 'drg', gearName: 'Clé USB 3.1 (750 $)', cost: 750, major: false },
      { id: 'dim_drg_2', name: 'Clef de Drogues #2 (Fin quota)', crims: '3 à 6', wait: '5 min', gearKey: 'drg', gearName: 'Clé USB 3.1 (750 $)', cost: 750, major: false },
      { id: 'dim_drg_3', name: 'Clef de Drogues #3 (Fin quota)', crims: '3 à 6', wait: '5 min', gearKey: 'drg', gearName: 'Clé USB 3.1 (750 $)', cost: 750, major: false },
      { id: 'dim_ket_1', name: 'Carte de Kétamine (Fin quota)', crims: 'Libre (-)', wait: '5 min', gearKey: 'none', gearName: 'Sans pack spécifique', cost: 0, major: false },
      { id: 'dim_uni_1', name: 'Union Depository (Gros Coup)', crims: '8 à 15', wait: '10 min', gearKey: 'uni', gearName: 'Sans pack tarifé', cost: 0, major: true },
      { id: 'dim_yac_2', name: 'Yacht #2 (Fin quota Gros Coup)', crims: '3 à 8', wait: '5 min', gearKey: 'yac', gearName: 'Clé Yacht / Pack Yacht (4 000 $)', cost: 4000, major: true },
      { id: 'dim_bob_2', name: 'Bobcat #2 (Fin quota Gros Coup)', crims: '3 à 10', wait: '5 min', gearKey: 'bob', gearName: 'Clé dépôt Bobcat + 2× Bombe / Pack (4 500 $)', cost: 4500, major: true },
    ],
  },
];

export const DAY_NAMES = WEEKLY_SCHEDULE.map((d) => d.day);

export const TOTAL_WEEKLY_MISSIONS = WEEKLY_SCHEDULE.reduce(
  (sum, day) => sum + day.missions.length,
  0
);

export const DAILY_RECALC_HOUR = 9;
export const DAILY_RECALC_MINUTE = 30;

export const MISSION_REGULATION: Record<MissionTypeKey, MissionRegulationRule> = {
  sup: { typeKey: 'sup', label: 'Supérettes', criminals: '2 à 4', dailyLimit: 2, weeklyLimit: 10, waitMinutes: 5, major: false },
  atm: { typeKey: 'atm', label: 'Distributeur (ATM)', criminals: '2 à 4', dailyLimit: 2, weeklyLimit: 10, waitMinutes: 5, major: false },
  mai: { typeKey: 'mai', label: 'Maison', criminals: '1 à 4', dailyLimit: 2, weeklyLimit: 10, waitMinutes: 5, major: false },
  frg: { typeKey: 'frg', label: 'Fourgon Blindé', criminals: '2 à 4', dailyLimit: 1, weeklyLimit: 7, waitMinutes: 5, major: false },
  trn: { typeKey: 'trn', label: 'Train', criminals: '3 à 8', dailyLimit: 1, weeklyLimit: 2, waitMinutes: 5, major: true },
  yac: { typeKey: 'yac', label: 'Yacht', criminals: '3 à 8', dailyLimit: 1, weeklyLimit: 2, waitMinutes: 5, major: true },
  bob: { typeKey: 'bob', label: 'Bobcat', criminals: '3 à 10', dailyLimit: 1, weeklyLimit: 2, waitMinutes: 5, major: true },
  fle: { typeKey: 'fle', label: 'Fleeca', criminals: '4 à 10', dailyLimit: null, weeklyLimit: 1, waitMinutes: 5, major: true },
  pal: { typeKey: 'pal', label: 'Paleto', criminals: '5 à 9', dailyLimit: null, weeklyLimit: 1, waitMinutes: 5, major: true },
  pac: { typeKey: 'pac', label: 'Pacific', criminals: '6 à 15', dailyLimit: null, weeklyLimit: 1, waitMinutes: 10, major: true },
  bij: { typeKey: 'bij', label: 'Bijouterie', criminals: '6 à 15', dailyLimit: null, weeklyLimit: 1, waitMinutes: 10, major: true },
  drg: { typeKey: 'drg', label: 'Clef de Drogues', criminals: '3 à 6', dailyLimit: 3, weeklyLimit: 21, waitMinutes: 5, major: false },
  fbi: { typeKey: 'fbi', label: 'FBI', criminals: '8 à 15', dailyLimit: null, weeklyLimit: 1, waitMinutes: 10, major: true },
  amu: { typeKey: 'amu', label: 'Amunation', criminals: '6 à 10', dailyLimit: null, weeklyLimit: 1, waitMinutes: 10, major: true },
  uni: { typeKey: 'uni', label: 'Union Depository', criminals: '8 à 15', dailyLimit: null, weeklyLimit: 1, waitMinutes: 10, major: true },
  ket: { typeKey: 'ket', label: 'Carte de Kétamine', criminals: '-', dailyLimit: 1, weeklyLimit: 7, waitMinutes: 5, major: false },
};

export const REGULATION_TABLE_ROWS: Array<{
  label: string;
  criminals: string;
  daily: string;
  weekly: number;
  inPlanning: boolean;
}> = [
  { label: 'Supérettes', criminals: '2 à 4', daily: '2', weekly: 10, inPlanning: true },
  { label: 'Distributeur (ATM)', criminals: '2 à 4', daily: '2', weekly: 10, inPlanning: true },
  { label: 'Maison', criminals: '1 à 4', daily: '2', weekly: 10, inPlanning: true },
  { label: 'Fourgon Blindé', criminals: '2 à 4', daily: '1', weekly: 7, inPlanning: true },
  { label: 'Train', criminals: '3 à 8', daily: '1', weekly: 2, inPlanning: true },
  { label: 'Yacht', criminals: '3 à 8', daily: '1', weekly: 2, inPlanning: true },
  { label: 'Bobcat', criminals: '3 à 10', daily: '1', weekly: 2, inPlanning: true },
  { label: 'Fleeca', criminals: '4 à 10', daily: '-', weekly: 1, inPlanning: true },
  { label: 'Paleto', criminals: '5 à 9', daily: '-', weekly: 1, inPlanning: true },
  { label: 'Pacific', criminals: '6 à 15', daily: '-', weekly: 1, inPlanning: true },
  { label: 'Bijouterie', criminals: '6 à 15', daily: '-', weekly: 1, inPlanning: true },
  { label: 'Clef de Drogues', criminals: '3 à 6', daily: '3', weekly: 21, inPlanning: true },
  { label: 'FBI', criminals: '8 à 15', daily: '-', weekly: 1, inPlanning: true },
  { label: 'Amunation', criminals: '6 à 10', daily: '-', weekly: 1, inPlanning: true },
  { label: 'Union Depository', criminals: '8 à 15', daily: '-', weekly: 1, inPlanning: true },
  { label: 'Carte de Kétamine', criminals: '-', daily: '1', weekly: 7, inPlanning: true },
];

export const REGULATION_FAIRPLAY_NOTE =
  'Fair-play : attendre 5 minutes sur place après le braquage. Pour Pacific, Bijouterie, FBI, Amunation et Union Depository : attendre 10 minutes.';

export const INVENTORY_ITEMS: InventoryItem[] = [
  { key: 'sup', name: 'Outils de supérettes', price: 1000, category: 'tool' },
  { key: 'atm', name: 'Corde lourde (ATM)', price: 500, category: 'tool' },
  { key: 'mai', name: 'Outil de hacking (Vol de Maison)', price: 1500, category: 'tool' },
  { key: 'drg', name: 'Clé USB 3.1 (Clef de Drogues)', price: 750, category: 'tool' },
  { key: 'veh', name: 'Items utilitaires (Vol de Véhicule)', price: 1500, category: 'tool' },
  { key: 'frg', name: 'Clé fourgon blindé (Fourgon)', price: 1050, category: 'tool' },
  { key: 'fle', name: 'Pack Banque Fleeca', price: 3300, category: 'heist_pack' },
  { key: 'bij', name: 'Pack Bijouterie', price: 5600, category: 'heist_pack' },
  { key: 'pal', name: 'Pack Banque de Paleto', price: 4800, category: 'heist_pack' },
  { key: 'pac', name: 'Pack Pacific Bank', price: 7800, category: 'heist_pack' },
  { key: 'trn', name: 'Pack Train', price: 3800, category: 'heist_pack' },
  { key: 'yac', name: 'Pack Yacht', price: 4000, category: 'heist_pack' },
  { key: 'bob', name: 'Pack Bobcat', price: 4500, category: 'heist_pack' },
  { key: 'gilet', name: 'Gilet pare-balles', price: 500, category: 'protection' },
  { key: 'mun_9mm', name: 'Boîte 9 mm', price: 73, category: 'protection' },
  { key: 'mun_45acp', name: 'Boîte .45 ACP', price: 53, category: 'protection' },
  { key: 'mun_44mag', name: 'Boîte .44 Magnum', price: 66, category: 'protection' },
  { key: 'mun_50ae', name: 'Boîte .50 AE', price: 75, category: 'protection' },
  { key: 'mun_pompe', name: 'Boîte Calibre 12 (Pompe)', price: 99, category: 'protection' },
  { key: 'mun_fusil', name: "Boîte 5.56 (Fusil d'Assaut)", price: 132, category: 'protection' },
  { key: 'mun_pistolet', name: 'Munitions Pistolet (Autre)', price: 0, category: 'protection' },
  { key: 'mun_pm', name: 'Munitions Mitraillette (SMG)', price: 0, category: 'protection' },
  { key: 'mun_sniper', name: 'Munitions Sniper / Lourd', price: 0, category: 'protection' },
  { key: 'acc_chg_fusil', name: 'Chargeur Grande Capacité Fusil', price: 1440, category: 'accessory' },
  { key: 'acc_chg_pompe', name: 'Chargeur Pompe', price: 1224, category: 'accessory' },
  { key: 'acc_lunette_macro', name: 'Lunette Macro', price: 864, category: 'accessory' },
  { key: 'acc_poignee', name: 'Poignée', price: 720, category: 'accessory' },
  { key: 'acc_petite_lunette', name: 'Petite Lunette', price: 1080, category: 'accessory' },
];

export const REWARD_ITEMS: RewardItem[] = [
  { key: 'boite_bijoux', name: 'Boîte à Bijoux', defaultVal: 220, buyerGroup: 'receleur' },
  { key: 'montre_or', name: 'Montre en Or', defaultVal: 40, buyerGroup: 'receleur' },
  { key: 'collier_or', name: 'Collier en Or', defaultVal: 30, buyerGroup: 'receleur' },
  { key: 'vetement_luxe', name: 'Vêtement de Luxe', defaultVal: 30, buyerGroup: 'receleur' },
  { key: 'whiskey_luxe', name: 'Whiskey de Luxe', defaultVal: 15, buyerGroup: 'whiskey' },
  { key: 'processeur', name: 'Processeur', defaultVal: 110, buyerGroup: 'receleur' },
  { key: 'lunette_luxe', name: 'Lunette de Luxe', defaultVal: 30, buyerGroup: 'receleur' },
  { key: 'carte_graphique', name: 'Carte Graphique', defaultVal: 110, buyerGroup: 'receleur' },
  { key: 'lingot_or', name: "Lingot d'Or", defaultVal: 180, buyerGroup: 'receleur' },
  { key: 'peinture_volee', name: 'Peinture Volée', defaultVal: 450, buyerGroup: 'receleur' },
];

export const PREVIOUS_REWARD_DEFAULTS: Record<string, number> = {
  boite_bijoux: 250,
  montre_or: 50,
  collier_or: 35,
  vetement_luxe: 35,
  processeur: 125,
  lunette_luxe: 35,
  carte_graphique: 125,
  lingot_or: 200,
  peinture_volee: 600,
};

export const HIER_UNITS: Record<HierarchyUnitKey, string> = {
  mando: 'EL MANDO',
  ojos: 'LOS OJOS',
  bocas: 'LAS BOCAS',
  brazos: 'LOS BRAZOS',
  cerebros: 'LOS CEREBROS',
  cerberos: 'LOS CERBEROS',
};

export const HIER_TIERS: HierarchyTier[] = [
  { grade: 'Grade 1 • Lead du groupe', title: 'EL MANDO', units: ['mando'], top: true },
  { grade: 'Grade 2', title: 'LOS ESPÍAS', units: ['ojos', 'bocas'] },
  { grade: 'Grade 3', title: 'LOS TENIENTES', units: ['brazos', 'cerebros'] },
  { grade: 'Grade 4', title: 'LOS CERBEROS', units: ['cerberos'], flat: true },
];

export const RANK_LEVELS = [
  { minPoints: 5000, title: 'Légende du Cartel' },
  { minPoints: 2500, title: 'Homme de Confiance' },
  { minPoints: 1200, title: 'Vétéran' },
  { minPoints: 600, title: 'Sicario' },
  { minPoints: 250, title: 'Soldado' },
  { minPoints: 0, title: 'Recrue' },
] as const;

export const DISTINCTION_DEFS: Array<{
  key: DistinctionKey;
  title: string;
  subtitle: string;
  autoRule?: string;
}> = [
  {
    key: 'sang_fidele',
    title: 'Sang Fidèle',
    subtitle: 'Loyauté & discipline constante',
    autoRule: '10+ opérations validées',
  },
  {
    key: 'frere_armes',
    title: "Frère d'Armes",
    subtitle: 'Engagement collectif sur le terrain',
    autoRule: '5+ missions réussies',
  },
  {
    key: 'loup_solitaire',
    title: 'Loup Solitaire',
    subtitle: 'Efficacité sur opérations rapides',
    autoRule: '3+ opérations courantes réussies',
  },
  {
    key: 'stratege',
    title: 'Stratège',
    subtitle: 'Maîtrise des Gros Coups majeurs',
    autoRule: '2+ Gros Coups réussis',
  },
  {
    key: 'homme_confiance',
    title: 'Homme de Confiance',
    subtitle: 'Distinction de la direction',
    autoRule: '1 200+ points',
  },
  {
    key: 'legende',
    title: 'Légende',
    subtitle: 'Contribution exceptionnelle au cartel',
    autoRule: 'N°1 du classement ou 2 500+ points',
  },
];

const GD = 'https://docs.google.com/document/';

export const HIER_DEFAULTS: HierarchyMember[] = [
  { id: 'tito', name: 'Tito Flores', unit: 'mando', order: 1, dossier: GD + 'u/0/d/1-BYbICmzGfMGUncjqrsSJTzwE6Jv7O3uLnBwiYOPyPE/edit' },
  { id: 'juanito', name: 'Juanito Fernandez', unit: 'ojos', order: 2, dossier: GD + 'd/1K8481f9Ha41lsRdKGBrLXBD32dks3TaL6tjzpaXVZPA/edit?tab=t.0' },
  { id: 'nicolas', name: 'Nicolás Salcedo', unit: 'bocas', order: 3, dossier: GD + 'u/0/d/12KV57gybGqckGvfKKf7naqJGdy4QbdX0nMJOC_XjBWU/edit' },
  { id: 'santiago', name: 'Santiago Fuentes', unit: 'bocas', order: 4, dossier: GD + 'd/1kFPJMIOzDkCwDL5qTi0TRYlAgoz2NtC4EwiN9iTuF3k/edit?tab=t.0' },
  { id: 'catalina', name: 'Catalina Flores', unit: 'brazos', order: 5, dossier: GD + 'u/0/d/1qM9W8zsBJg_82y5RAhnwuQunBr89m1OKWyv8LJTZm3s/edit' },
  { id: 'gino', name: 'Gino Da Silva', unit: 'cerberos', order: 6, dossier: GD + 'u/0/d/13mZArzn0JO2E3oCRSbxs_1m2m5cxV5k8Dz7fryHZSGU/edit' },
  { id: 'jose', name: 'José Chavez', unit: 'cerberos', order: 7, dossier: GD + 'u/0/d/19ZxLCUTOn4zAGuJZPZmWn-XlXVrCWyqYmEvC_BHsPu0/edit' },
  { id: 'emilio', name: 'Emilio Rojas', unit: 'cerberos', order: 8, dossier: GD + 'd/1hzDaA3O36RkrgHGnyIDLn7M_M6nZ6y0IUviiEzkvSdA/edit?tab=t.0' },
  { id: 'joao', name: 'Joao Cristo', unit: 'cerberos', order: 9, dossier: '' },
];

export const CATALOG_ITEM_CATEGORY_LABELS: Record<CatalogItemCategory, string> = {
  munitions: 'Munitions',
  accessoires: 'Accessoires',
  gilets: 'Gilets pare-balles',
  armes: 'Armes',
  reparation: "Réparation d'armes",
  materiel: 'Matériel braquage',
  butin: 'Butin / Recel',
  autre: 'Autre',
};

export const DEFAULT_CATALOG_GROUPS: CatalogGroupsMap = {
  marabunta: {
    id: 'marabunta',
    name: 'Marabunta Grande (MG 13)',
    specialty: "Munitions, Accessoires, Gilets & Réparation d'armes",
    color: 'blue',
    notes: "Les prix peuvent varier selon l'humeur du jefe. Stock régulier sur les gilets.",
    contacts: [],
    items: [
      {
        id: 'mg_9mm',
        name: 'Boîte 9 mm',
        tradeType: 'sell',
        category: 'munitions',
        price: 73,
        linkedGearKey: 'mun_9mm',
        notes: 'Munitions pistolet / SMG léger',
      },
      {
        id: 'mg_45acp',
        name: 'Boîte .45 ACP',
        tradeType: 'sell',
        category: 'munitions',
        price: 53,
        linkedGearKey: 'mun_45acp',
        notes: 'Munitions .45 ACP',
      },
      {
        id: 'mg_44mag',
        name: 'Boîte .44 Magnum',
        tradeType: 'sell',
        category: 'munitions',
        price: 66,
        linkedGearKey: 'mun_44mag',
        notes: 'Munitions revolver .44 Magnum',
      },
      {
        id: 'mg_cal12',
        name: 'Boîte Calibre 12',
        tradeType: 'sell',
        category: 'munitions',
        price: 99,
        linkedGearKey: 'mun_pompe',
        notes: 'Munitions fusil à pompe',
      },
      {
        id: 'mg_556',
        name: 'Boîte 5.56',
        tradeType: 'sell',
        category: 'munitions',
        price: 132,
        linkedGearKey: 'mun_fusil',
        notes: "Munitions fusil d'assaut 5.56",
      },
      {
        id: 'mg_50ae',
        name: 'Boîte .50 AE',
        tradeType: 'sell',
        category: 'munitions',
        price: 75,
        linkedGearKey: 'mun_50ae',
        notes: 'Munitions .50 AE',
      },
      {
        id: 'mg_chg_fusil',
        name: 'Chargeur Grande Capacité Fusil',
        tradeType: 'sell',
        category: 'accessoires',
        price: 1440,
        linkedGearKey: 'acc_chg_fusil',
        notes: 'Accessoire fusil',
      },
      {
        id: 'mg_chg_pompe',
        name: 'Chargeur Pompe',
        tradeType: 'sell',
        category: 'accessoires',
        price: 1224,
        linkedGearKey: 'acc_chg_pompe',
        notes: 'Accessoire fusil à pompe',
      },
      {
        id: 'mg_lunette_macro',
        name: 'Lunette Macro',
        tradeType: 'sell',
        category: 'accessoires',
        price: 864,
        linkedGearKey: 'acc_lunette_macro',
        notes: 'Optique longue distance',
      },
      {
        id: 'mg_poignee',
        name: 'Poignée',
        tradeType: 'sell',
        category: 'accessoires',
        price: 720,
        linkedGearKey: 'acc_poignee',
        notes: 'Accessoire stabilité arme',
      },
      {
        id: 'mg_petite_lunette',
        name: 'Petite Lunette',
        tradeType: 'sell',
        category: 'accessoires',
        price: 1080,
        linkedGearKey: 'acc_petite_lunette',
        notes: 'Optique compacte',
      },
      {
        id: 'mg_gilet',
        name: 'Gilet pare-balles',
        tradeType: 'sell',
        category: 'gilets',
        price: 500,
        linkedGearKey: 'gilet',
        notes: 'Protection renforcée · Tarif unitaire 500 $',
      },
      {
        id: 'mg_rep_pistolet',
        name: "Réparation d'arme — Pistolet",
        tradeType: 'sell',
        category: 'reparation',
        price: 750,
        linkedGearKey: '',
        notes: 'Réparation rapide pistolet',
      },
      {
        id: 'mg_rep_pompe',
        name: "Réparation d'arme — Fusil à Pompe",
        tradeType: 'sell',
        category: 'reparation',
        price: 1500,
        linkedGearKey: '',
        notes: 'Réparation rapide fusil à pompe',
      },
      {
        id: 'mg_rep_smg',
        name: "Réparation d'arme — SMG",
        tradeType: 'sell',
        category: 'reparation',
        price: 2250,
        linkedGearKey: '',
        notes: 'Réparation rapide mitraillette SMG',
      },
      {
        id: 'mg_rep_lourde',
        name: "Réparation d'arme — Armes Lourdes",
        tradeType: 'sell',
        category: 'reparation',
        price: 3000,
        linkedGearKey: '',
        notes: 'Réparation rapide armes lourdes / fusils',
      },
    ],
  },
  brad_recel: {
    id: 'brad_recel',
    name: 'Brad — Marché Noir',
    specialty: 'Rachat de butin & objets volés (Recel)',
    color: 'purple',
    notes: 'On ne pose pas de questions, on propose des solutions.',
    contacts: [],
    items: [
      { id: 'br_bijoux', name: 'Boîte à Bijoux', tradeType: 'buyback', category: 'butin', price: 220, linkedGearKey: '', notes: 'Rachat recel' },
      { id: 'br_peinture', name: 'Peinture Volée', tradeType: 'buyback', category: 'butin', price: 450, linkedGearKey: '', notes: 'Rachat recel' },
      { id: 'br_lingot', name: "Lingot d'Or", tradeType: 'buyback', category: 'butin', price: 180, linkedGearKey: '', notes: 'Rachat recel' },
      { id: 'br_gpu', name: 'Carte Graphique', tradeType: 'buyback', category: 'butin', price: 110, linkedGearKey: '', notes: 'Rachat recel' },
      { id: 'br_cpu', name: 'Processeur', tradeType: 'buyback', category: 'butin', price: 110, linkedGearKey: '', notes: 'Rachat recel' },
      { id: 'br_montre', name: 'Montre', tradeType: 'buyback', category: 'butin', price: 40, linkedGearKey: '', notes: 'Rachat recel' },
      { id: 'br_collier', name: 'Collier', tradeType: 'buyback', category: 'butin', price: 30, linkedGearKey: '', notes: 'Rachat recel' },
      { id: 'br_vetement', name: 'Vêtement', tradeType: 'buyback', category: 'butin', price: 30, linkedGearKey: '', notes: 'Rachat recel' },
      { id: 'br_lunette', name: 'Lunette', tradeType: 'buyback', category: 'butin', price: 30, linkedGearKey: '', notes: 'Rachat recel' },
    ],
  },
  eminence: {
    id: 'eminence',
    name: 'Éminences',
    specialty: 'Clés, Items utilitaires, Packs de braquage & Rachat Whiskey de Luxe',
    color: 'gold',
    notes: "La loi oubliée, nous on se souvient. L'élite ne demande pas, elle propose.",
    contacts: [],
    items: [
      // --- CLÉS & ACCÈS (Affiche 1) ---
      { id: 'em_cle_fleeca', name: 'Clé banque Fleeca', tradeType: 'sell', category: 'materiel', price: 3000, linkedGearKey: '', notes: 'Documents · Stock illimité' },
      { id: 'em_cle_paleto', name: 'Clé banque Paleto', tradeType: 'sell', category: 'materiel', price: 4000, linkedGearKey: '', notes: 'Documents · Stock illimité' },
      { id: 'em_cle_pacific', name: 'Clé Pacific Bank', tradeType: 'sell', category: 'materiel', price: 5000, linkedGearKey: '', notes: 'Documents · Stock illimité' },
      { id: 'em_cle_bobcat', name: 'Clé dépot Bobcat', tradeType: 'sell', category: 'materiel', price: 3500, linkedGearKey: '', notes: 'Documents · Stock illimité' },
      { id: 'em_cle_fourgon', name: 'Clé fourgon blindé', tradeType: 'sell', category: 'materiel', price: 1050, linkedGearKey: 'frg', notes: 'Documents · Stock unifié Fourgon' },
      { id: 'em_cle_train', name: 'Clé braquage train', tradeType: 'sell', category: 'materiel', price: 3500, linkedGearKey: '', notes: 'Documents · Stock illimité' },
      { id: 'em_deto_vengelico', name: 'Détonateur Vengelico', tradeType: 'sell', category: 'materiel', price: 4500, linkedGearKey: '', notes: 'Items utilitaires · Stock illimité' },
      { id: 'em_cle_yacht', name: 'Clé Yacht', tradeType: 'sell', category: 'materiel', price: 4000, linkedGearKey: '', notes: 'Documents · Stock illimité' },
      { id: 'em_cle_ammunation', name: 'Ammunation', tradeType: 'sell', category: 'materiel', price: 4000, linkedGearKey: '', notes: 'Documents · Stock illimité' },

      // --- ITEMS UTILITAIRES (Affiche 2) ---
      { id: 'em_masque_gaz', name: 'Masque à Gaz', tradeType: 'sell', category: 'materiel', price: 300, linkedGearKey: '', notes: 'Items utilitaires · Stock illimité' },
      { id: 'em_corde_lourde', name: 'Corde Lourde', tradeType: 'sell', category: 'materiel', price: 500, linkedGearKey: 'atm', notes: 'Items utilitaires · Stock illimité' },
      { id: 'em_perceuse', name: 'Perceuse', tradeType: 'sell', category: 'materiel', price: 300, linkedGearKey: '', notes: 'Items utilitaires · Stock illimité' },
      { id: 'em_drone', name: 'Drone', tradeType: 'sell', category: 'materiel', price: 300, linkedGearKey: '', notes: 'Items utilitaires · Stock illimité' },
      { id: 'em_meuleuse', name: 'Meuleuse', tradeType: 'sell', category: 'materiel', price: 300, linkedGearKey: '', notes: 'Items utilitaires · Stock illimité' },
      { id: 'em_outils_hacking', name: 'Outils Hacking', tradeType: 'sell', category: 'materiel', price: 1500, linkedGearKey: 'mai', notes: 'Items utilitaires · Stock illimité' },
      { id: 'em_bombe', name: 'Bombe', tradeType: 'sell', category: 'materiel', price: 500, linkedGearKey: '', notes: 'Items utilitaires · Stock illimité' },
      { id: 'em_carte_k', name: 'Carte de K', tradeType: 'sell', category: 'materiel', price: 750, linkedGearKey: '', notes: 'Items utilitaires · Stock illimité' },
      { id: 'em_clef_usb', name: 'Clef Usb', tradeType: 'sell', category: 'materiel', price: 750, linkedGearKey: 'drg', notes: 'Items utilitaires · Stock illimité' },

      // --- PACKS DE BRAQUAGE (Affiche 3) ---
      { id: 'em_pack_01_atm', name: 'Pack 01 — ATM', tradeType: 'sell', category: 'materiel', price: 500, linkedGearKey: 'atm', notes: 'Pack braquage · Corde lourde' },
      { id: 'em_pack_02_maison', name: 'Pack 02 — Vol de maison', tradeType: 'sell', category: 'materiel', price: 1500, linkedGearKey: 'mai', notes: 'Pack braquage · Outil de hacking' },
      { id: 'em_pack_03_vehicule', name: 'Pack 03 — Vol de véhicule', tradeType: 'sell', category: 'materiel', price: 1500, linkedGearKey: 'veh', notes: 'Pack braquage · Items utilitaires' },
      { id: 'em_pack_04_fourgon', name: 'Pack 04 — Fourgon blindé', tradeType: 'sell', category: 'materiel', price: 1050, linkedGearKey: 'frg', notes: 'Pack braquage · Clé fourgon blindé' },
      { id: 'em_pack_05_superettes', name: 'Pack 05 — Supérettes', tradeType: 'sell', category: 'materiel', price: 1000, linkedGearKey: 'sup', notes: 'Pack braquage · Outils de supérettes' },
      { id: 'em_pack_06_fleeca', name: 'Pack 06 — Fleeca', tradeType: 'sell', category: 'materiel', price: 3300, linkedGearKey: 'fle', notes: 'Pack braquage · Clé banque Fleeca + Perceuse' },
      { id: 'em_pack_07_yacht', name: 'Pack 07 — Yacht', tradeType: 'sell', category: 'materiel', price: 4000, linkedGearKey: 'yac', notes: 'Pack braquage · Items utilitaires' },
      { id: 'em_pack_09_train', name: 'Pack 09 — Train', tradeType: 'sell', category: 'materiel', price: 3800, linkedGearKey: 'trn', notes: 'Pack braquage · Clé braquage train + Meuleuse' },
      { id: 'em_pack_10_bobcat', name: 'Pack 10 — Bobcat', tradeType: 'sell', category: 'materiel', price: 4500, linkedGearKey: 'bob', notes: 'Pack braquage · Bombes adhésives' },
      { id: 'em_pack_11_bijouterie', name: 'Pack 11 — Bijouterie', tradeType: 'sell', category: 'materiel', price: 5600, linkedGearKey: 'bij', notes: 'Pack braquage · Bombe adhésive, drone, perceuse, masque à gaz' },
      { id: 'em_pack_12_paleto', name: 'Pack 12 — Banque de Paleto', tradeType: 'sell', category: 'materiel', price: 4800, linkedGearKey: 'pal', notes: 'Pack braquage · Bombe adhésive, perceuse' },
      { id: 'em_pack_13_pacific', name: 'Pack 13 — Pacific Bank', tradeType: 'sell', category: 'materiel', price: 7800, linkedGearKey: 'pac', notes: 'Pack braquage · Drone, bombes adhésives, outil de hacking' },

      // --- RACHAT WHISKEY DE LUXE (Affiche 4) ---
      { id: 'em_whiskey', name: 'Whiskey de Luxe', tradeType: 'buyback', category: 'butin', price: 15, linkedGearKey: '', notes: 'Rachat bouteilles de whiskey (Éminence)' },
    ],
  },
};
