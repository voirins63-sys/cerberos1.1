import React, { useMemo, useState } from 'react';
import {
  Anchor,
  Car,
  CheckCircle2,
  Edit3,
  KeyRound,
  MapPin,
  Plus,
  Search,
  Send,
  Shield,
  Trash2,
  Wrench,
  X,
  AlertTriangle,
} from 'lucide-react';
import type {
  CartelVehicle,
  FleetState,
  HierarchyMember,
  VehicleCategory,
  VehicleStatus,
} from '@/src/types/cartel';
import { formatMoney } from '@/src/utils/finance';

interface GarageViewProps {
  fleetState: FleetState;
  members: HierarchyMember[];
  readonly: boolean;
  canSendDiscord: boolean;
  onSaveFleet: (nextFleet: FleetState) => Promise<void>;
  onShareFleetDiscord: (summary: {
    title: string;
    description: string;
    fields: Array<{ name: string; value: string; inline?: boolean }>;
  }) => Promise<void>;
  onShowToast: (msg: string) => void;
}

const GARAGE_HERO_SRC = '/src/assets/images/garage_fleet_hero_1795494829145.jpg';

const CATEGORY_META: Record<
  VehicleCategory,
  { label: string; shortLabel: string; accent: string }
> = {
  blinde: { label: 'Blindé', shortLabel: 'Blindé', accent: 'text-gold-light' },
  sportive: { label: 'Sportive / Fuite', shortLabel: 'Sportive', accent: 'text-crimson-light' },
  suv: { label: 'SUV / 4x4', shortLabel: 'SUV', accent: 'text-amber-300' },
  moto: { label: 'Moto', shortLabel: 'Moto', accent: 'text-sky-300' },
  helico: { label: 'Hélicoptère', shortLabel: 'Hélico', accent: 'text-violet-300' },
  bateau: { label: 'Bateau / Jet', shortLabel: 'Bateau', accent: 'text-cyan-300' },
  utilitaire: { label: 'Utilitaire / Camion', shortLabel: 'Utilitaire', accent: 'text-zinc-300' },
};

const STATUS_META: Record<
  VehicleStatus,
  { label: string; textClass: string; borderClass: string }
> = {
  disponible: {
    label: 'Disponible',
    textClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/35',
  },
  en_mission: {
    label: 'En sortie',
    textClass: 'text-gold-light',
    borderClass: 'border-gold/50',
  },
  fourriere: {
    label: 'Fourrière',
    textClass: 'text-crimson-light',
    borderClass: 'border-crimson-light/50',
  },
  reparation: {
    label: 'En réparation',
    textClass: 'text-amber-400',
    borderClass: 'border-amber-500/45',
  },
};

const STARTER_VEHICLES: Array<Omit<CartelVehicle, 'id' | 'updatedAtIso'>> = [
  {
    name: 'Kuruma Blindée',
    plate: 'CERB-01',
    category: 'blinde',
    status: 'disponible',
    location: 'Garage Hacienda',
    assignedToId: '',
    assignedToName: '',
    armorLevel: 'Blindage Max (100%)',
    value: 525000,
    notes: 'Véhicule principal d’assaut pour Fleeca, Bijouterie et convois.',
  },
  {
    name: 'Schafter V12 Blindée',
    plate: 'CERB-02',
    category: 'blinde',
    status: 'disponible',
    location: 'Garage Hacienda',
    assignedToId: '',
    assignedToName: '',
    armorLevel: 'Vitres pare-balles',
    value: 325000,
    notes: 'Escorte rapide VIP et extraction urbaine 4 places.',
  },
  {
    name: 'Jugular / RS6 Fuite',
    plate: 'CERB-03',
    category: 'sportive',
    status: 'disponible',
    location: 'Garage Centre-Ville',
    assignedToId: '',
    assignedToName: '',
    armorLevel: 'Turbo + Pneus pare-balles',
    value: 410000,
    notes: 'Véhicule d’évasion rapide pour braquages majeurs.',
  },
  {
    name: 'Kamacho 4x4 Tactique',
    plate: 'CERB-04',
    category: 'suv',
    status: 'disponible',
    location: 'Hangar Nord',
    assignedToId: '',
    assignedToName: '',
    armorLevel: 'Renforcé Tout-Terrain',
    value: 280000,
    notes: 'Idéal montagnes, Paleto et convois hors-piste.',
  },
  {
    name: 'Buzzard / Frogger Tactique',
    plate: 'CERB-AIR',
    category: 'helico',
    status: 'disponible',
    location: 'Héliport Hacienda',
    assignedToId: '',
    assignedToName: '',
    armorLevel: 'Cellule renforcée',
    value: 1450000,
    notes: 'Reconnaissance aérienne et extraction Yacht / Pacific.',
  },
];

interface VehicleDraft {
  id: string | null;
  name: string;
  plate: string;
  category: VehicleCategory;
  status: VehicleStatus;
  location: string;
  assignedToId: string;
  armorLevel: string;
  value: string;
  notes: string;
}

const EMPTY_DRAFT: VehicleDraft = {
  id: null,
  name: '',
  plate: '',
  category: 'blinde',
  status: 'disponible',
  location: 'Garage Hacienda',
  assignedToId: '',
  armorLevel: 'Standard',
  value: '',
  notes: '',
};

export const GarageView: React.FC<GarageViewProps> = ({
  fleetState,
  members,
  readonly,
  canSendDiscord,
  onSaveFleet,
  onShareFleetDiscord,
  onShowToast,
}) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | VehicleCategory>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | VehicleStatus>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<VehicleDraft>(EMPTY_DRAFT);
  const [checkoutTargetId, setCheckoutTargetId] = useState<string | null>(null);
  const [checkoutMemberId, setCheckoutMemberId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [heroError, setHeroError] = useState(false);

  const vehicles = useMemo(() => {
    const statusOrder: Record<VehicleStatus, number> = {
      en_mission: 0,
      fourriere: 1,
      reparation: 2,
      disponible: 3,
    };
    return Object.values(fleetState.vehicles || {}).sort((a, b) => {
      const diff = statusOrder[a.status] - statusOrder[b.status];
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name, 'fr');
    });
  }, [fleetState.vehicles]);

  const stats = useMemo(() => {
    let available = 0;
    let out = 0;
    let issue = 0;
    let totalValue = 0;
    vehicles.forEach((v) => {
      totalValue += Math.max(0, Number(v.value) || 0);
      if (v.status === 'disponible') available++;
      else if (v.status === 'en_mission') out++;
      else issue++;
    });
    return { total: vehicles.length, available, out, issue, totalValue };
  }, [vehicles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (categoryFilter !== 'all' && v.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && v.status !== statusFilter) return false;
      if (!q) return true;
      return (
        v.name.toLowerCase().includes(q) ||
        v.plate.toLowerCase().includes(q) ||
        v.location.toLowerCase().includes(q) ||
        v.assignedToName.toLowerCase().includes(q) ||
        v.notes.toLowerCase().includes(q)
      );
    });
  }, [vehicles, search, categoryFilter, statusFilter]);

  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [members]
  );

  const openAddModal = () => {
    setDraft(EMPTY_DRAFT);
    setModalOpen(true);
  };

  const openEditModal = (v: CartelVehicle) => {
    setDraft({
      id: v.id,
      name: v.name,
      plate: v.plate,
      category: v.category,
      status: v.status,
      location: v.location,
      assignedToId: v.assignedToId,
      armorLevel: v.armorLevel,
      value: v.value > 0 ? String(v.value) : '',
      notes: v.notes,
    });
    setModalOpen(true);
  };

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readonly || isSaving) return;
    const cleanName = draft.name.trim();
    if (!cleanName) {
      onShowToast('Indiquez le nom ou modèle du véhicule.');
      return;
    }

    const id =
      draft.id ||
      `veh_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const memberObj = sortedMembers.find((m) => m.id === draft.assignedToId);
    const nextVehicle: CartelVehicle = {
      id,
      name: cleanName.slice(0, 80),
      plate: draft.plate.trim().toUpperCase().slice(0, 20),
      category: draft.category,
      status: draft.status,
      location: draft.location.trim().slice(0, 80) || 'Garage Hacienda',
      assignedToId: draft.status === 'disponible' ? '' : draft.assignedToId,
      assignedToName:
        draft.status === 'disponible' ? '' : memberObj?.name || '',
      armorLevel: draft.armorLevel.trim().slice(0, 40) || 'Standard',
      value: Math.max(0, Math.round(Number(draft.value) || 0)),
      notes: draft.notes.trim().slice(0, 220),
      updatedAtIso: new Date().toISOString().slice(0, 40),
    };

    setIsSaving(true);
    try {
      await onSaveFleet({
        vehicles: {
          ...fleetState.vehicles,
          [id]: nextVehicle,
        },
      });
      setModalOpen(false);
      onShowToast(
        draft.id ? `Véhicule « ${nextVehicle.name} » mis à jour.` : `Véhicule « ${nextVehicle.name} » ajouté au garage.`
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickStatus = async (
    v: CartelVehicle,
    nextStatus: VehicleStatus,
    assignedId = '',
    assignedName = ''
  ) => {
    if (readonly || isSaving) return;
    setIsSaving(true);
    try {
      await onSaveFleet({
        vehicles: {
          ...fleetState.vehicles,
          [v.id]: {
            ...v,
            status: nextStatus,
            assignedToId: nextStatus === 'disponible' ? '' : assignedId || v.assignedToId,
            assignedToName:
              nextStatus === 'disponible' ? '' : assignedName || v.assignedToName,
            updatedAtIso: new Date().toISOString().slice(0, 40),
          },
        },
      });
      setCheckoutTargetId(null);
      setCheckoutMemberId('');
      onShowToast(
        `${v.name} — ${STATUS_META[nextStatus].label}${assignedName ? ` (${assignedName})` : ''}.`
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteVehicle = async (v: CartelVehicle) => {
    if (readonly || isSaving) return;
    setIsSaving(true);
    try {
      const nextVehicles = { ...fleetState.vehicles };
      delete nextVehicles[v.id];
      await onSaveFleet({ vehicles: nextVehicles });
      onShowToast(`Véhicule « ${v.name} » supprimé de la flotte.`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSeedStarterFleet = async () => {
    if (readonly || isSaving) return;
    setIsSaving(true);
    try {
      const nextVehicles: Record<string, CartelVehicle> = { ...fleetState.vehicles };
      const nowIso = new Date().toISOString().slice(0, 40);
      STARTER_VEHICLES.forEach((tpl, idx) => {
        const id = `veh_seed_${idx + 1}`;
        if (!nextVehicles[id]) {
          nextVehicles[id] = {
            ...tpl,
            id,
            updatedAtIso: nowIso,
          };
        }
      });
      await onSaveFleet({ vehicles: nextVehicles });
      onShowToast('Flotte type Los Cerberos initialisée (5 véhicules).');
    } finally {
      setIsSaving(false);
    }
  };

  const handleShareDiscord = async () => {
    if (!canSendDiscord || isSharing || vehicles.length === 0) return;
    setIsSharing(true);
    try {
      const availLines = vehicles
        .filter((v) => v.status === 'disponible')
        .slice(0, 10)
        .map(
          (v) =>
            `• **${v.name}** (${CATEGORY_META[v.category].shortLabel})${v.plate ? ` · \`${v.plate}\`` : ''} — ${v.location}`
        );
      const outLines = vehicles
        .filter((v) => v.status === 'en_mission')
        .slice(0, 8)
        .map(
          (v) =>
            `• **${v.name}**${v.assignedToName ? ` → ${v.assignedToName}` : ''}${v.plate ? ` (\`${v.plate}\`)` : ''}`
        );
      const issueLines = vehicles
        .filter((v) => v.status === 'fourriere' || v.status === 'reparation')
        .slice(0, 8)
        .map(
          (v) =>
            `• **${v.name}** — ${STATUS_META[v.status].label}${v.location ? ` (${v.location})` : ''}`
        );

      const fields: Array<{ name: string; value: string; inline?: boolean }> = [
        {
          name: `✅ Disponibles (${stats.available})`,
          value: availLines.length > 0 ? availLines.join('\n') : 'Aucun véhicule disponible.',
          inline: false,
        },
      ];
      if (outLines.length > 0) {
        fields.push({
          name: `🔑 En sortie (${stats.out})`,
          value: outLines.join('\n'),
          inline: false,
        });
      }
      if (issueLines.length > 0) {
        fields.push({
          name: `🚨 Fourrière / Atelier (${stats.issue})`,
          value: issueLines.join('\n'),
          inline: false,
        });
      }

      await onShareFleetDiscord({
        title: '🚘 LOS CERBEROS — État du Garage & Flotte du Cartel',
        description: `**${stats.total} véhicules** recensés · Valeur estimée du parc : **${formatMoney(stats.totalValue)}**`,
        fields,
      });
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <section className="space-y-6">
      {/* Hero Banner */}
      <div className="relative rounded-2xl overflow-hidden gold-border bg-charcoal shadow-2xl">
        <div className="relative h-48 sm:h-56 w-full">
          {!heroError ? (
            <img
              src={GARAGE_HERO_SRC}
              alt="Garage souterrain et flotte blindée Los Cerberos"
              referrerPolicy="no-referrer"
              onError={() => setHeroError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-obsidian via-charcoal to-crimson/20 flex items-center justify-center">
              <Car className="w-12 h-12 text-gold/40" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/70 to-obsidian/20" />
          <div className="absolute inset-0 p-5 sm:p-7 flex flex-col justify-end">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <p className="text-xs font-mono text-gold-light tracking-wider">
                  LOGISTIQUE &amp; MOBILITÉ TACTIQUE
                </p>
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white mt-1 text-balance">
                  Garage &amp; Flotte Los Cerberos
                </h2>
                <p className="text-xs sm:text-sm text-zinc-300 mt-1 max-w-2xl">
                  Suivez en temps réel les véhicules blindés, rapides, hélicos et bateaux du cartel, leurs plaques, emplacements et sorties en mission.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {canSendDiscord && vehicles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void handleShareDiscord()}
                    disabled={isSharing}
                    className="px-3.5 py-2 rounded-lg text-xs font-bold bg-charcoal/90 hover:bg-slateDark text-gold-light border border-gold/45 transition inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5 text-gold" />
                    {isSharing ? 'Envoi...' : 'Partager sur Discord'}
                  </button>
                )}
                {!readonly && (
                  <button
                    type="button"
                    onClick={openAddModal}
                    className="px-4 py-2 rounded-lg text-xs font-bold bg-gold hover:bg-gold-light text-obsidian transition inline-flex items-center gap-1.5 shadow-lg shadow-gold/15 cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    Ajouter un véhicule
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-charcoal/95 bronze-border rounded-xl p-4">
          <div className="text-xs text-zinc-400 font-medium">Parc total</div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <span className="font-display text-2xl font-extrabold text-white tabular-nums">
              {stats.total}
            </span>
            <span className="text-xs font-mono text-gold tabular-nums">
              {formatMoney(stats.totalValue)}
            </span>
          </div>
        </div>

        <div className="bg-charcoal/95 bronze-border rounded-xl p-4">
          <div className="text-xs text-zinc-400 font-medium">Disponibles au garage</div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <span className="font-display text-2xl font-extrabold text-emerald-400 tabular-nums">
              {stats.available}
            </span>
            <span className="text-xs text-zinc-500">Prêts à rouler</span>
          </div>
        </div>

        <div className="bg-charcoal/95 bronze-border rounded-xl p-4">
          <div className="text-xs text-zinc-400 font-medium">Actuellement en sortie</div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <span className="font-display text-2xl font-extrabold text-gold-light tabular-nums">
              {stats.out}
            </span>
            <span className="text-xs text-zinc-500">Assignés</span>
          </div>
        </div>

        <div className="bg-charcoal/95 bronze-border rounded-xl p-4">
          <div className="text-xs text-zinc-400 font-medium">Fourrière / Atelier</div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <span
              className={`font-display text-2xl font-extrabold tabular-nums ${
                stats.issue > 0 ? 'text-crimson-light' : 'text-zinc-300'
              }`}
            >
              {stats.issue}
            </span>
            <span className="text-xs text-zinc-500">À récupérer / réparer</span>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-charcoal/95 bronze-border rounded-xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par modèle, plaque, emplacement ou conducteur..."
              className="w-full bg-obsidian border border-zinc-700 focus:border-gold rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1 bg-obsidian p-1 rounded-lg border border-zinc-800">
            {(['all', 'disponible', 'en_mission', 'fourriere', 'reparation'] as const).map(
              (st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                    statusFilter === st
                      ? 'bg-gold text-obsidian'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {st === 'all' ? 'Tous statuts' : STATUS_META[st].label}
                </button>
              )
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-bronze/25">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
              categoryFilter === 'all'
                ? 'bg-zinc-800 text-gold-light border border-gold/45'
                : 'text-zinc-400 hover:text-white border border-transparent'
            }`}
          >
            Toutes catégories ({vehicles.length})
          </button>
          {(Object.keys(CATEGORY_META) as VehicleCategory[]).map((cat) => {
            const count = vehicles.filter((v) => v.category === cat).length;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                  categoryFilter === cat
                    ? 'bg-zinc-800 text-gold-light border border-gold/45'
                    : 'text-zinc-400 hover:text-white border border-transparent'
                }`}
              >
                {CATEGORY_META[cat].shortLabel} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Empty State or Fleet Grid */}
      {vehicles.length === 0 ? (
        <div className="bg-charcoal/90 bronze-border rounded-2xl p-8 sm:p-10 text-center space-y-4">
          <Car className="w-10 h-10 text-gold/70 mx-auto" />
          <div className="space-y-1">
            <h3 className="font-display text-lg font-bold text-white">
              Aucun véhicule enregistré dans le garage
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto">
              Ajoutez vos véhicules blindés, sportives, hélicos et bateaux pour suivre qui utilise quoi et éviter les oublis en fourrière.
            </p>
          </div>
          {!readonly && (
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={openAddModal}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-gold hover:bg-gold-light text-obsidian transition inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Ajouter mon premier véhicule
              </button>
              <button
                type="button"
                onClick={() => void handleSeedStarterFleet()}
                disabled={isSaving}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-obsidian hover:bg-slateDark text-gold-light border border-gold/40 transition cursor-pointer disabled:opacity-50"
              >
                Charger une flotte type (5 véhicules)
              </button>
            </div>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-charcoal/90 bronze-border rounded-xl p-8 text-center text-xs text-zinc-400">
          Aucun véhicule ne correspond à vos filtres actuels.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((v) => {
            const cat = CATEGORY_META[v.category];
            const st = STATUS_META[v.status];
            const isPickingDriver = checkoutTargetId === v.id;

            return (
              <div
                key={v.id}
                className={`bg-charcoal/95 border ${st.borderClass} rounded-xl p-4 flex flex-col justify-between gap-3.5 transition`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs text-zinc-400">
                        <span className={`font-semibold ${cat.accent}`}>{cat.label}</span>
                        {v.plate && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono text-zinc-200 tracking-wider">
                              {v.plate}
                            </span>
                          </>
                        )}
                      </div>
                      <h3 className="font-display text-lg font-bold text-white truncate mt-0.5">
                        {v.name}
                      </h3>
                    </div>

                    <div className={`text-xs font-bold shrink-0 inline-flex items-center gap-1 ${st.textClass}`}>
                      {v.status === 'disponible' && <CheckCircle2 className="w-3.5 h-3.5" />}
                      {v.status === 'en_mission' && <KeyRound className="w-3.5 h-3.5" />}
                      {v.status === 'fourriere' && <AlertTriangle className="w-3.5 h-3.5" />}
                      {v.status === 'reparation' && <Wrench className="w-3.5 h-3.5" />}
                      {st.label}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-bronze/25">
                    <div className="text-zinc-400 flex items-center gap-1.5 truncate">
                      {v.category === 'bateau' ? (
                        <Anchor className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      ) : (
                        <MapPin className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      )}
                      <span className="truncate text-zinc-200">{v.location}</span>
                    </div>
                    <div className="text-zinc-400 flex items-center gap-1.5 truncate justify-end">
                      <Shield className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      <span className="truncate text-zinc-300">{v.armorLevel}</span>
                    </div>
                  </div>

                  {(v.assignedToName || v.value > 0) && (
                    <div className="flex items-center justify-between gap-2 text-xs text-zinc-400">
                      <span className="truncate">
                        {v.assignedToName ? (
                          <>
                            Conducteur :{' '}
                            <strong className="text-gold-light">{v.assignedToName}</strong>
                          </>
                        ) : (
                          'Au dépôt'
                        )}
                      </span>
                      {v.value > 0 && (
                        <span className="font-mono text-zinc-300 tabular-nums shrink-0">
                          {formatMoney(v.value)}
                        </span>
                      )}
                    </div>
                  )}

                  {v.notes && (
                    <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
                      {v.notes}
                    </p>
                  )}
                </div>

                {/* Editor quick controls */}
                {!readonly && (
                  <div className="pt-2.5 border-t border-bronze/25 space-y-2">
                    {isPickingDriver ? (
                      <div className="flex items-center gap-1.5">
                        <select
                          aria-label="Choisir le conducteur"
                          value={checkoutMemberId}
                          onChange={(e) => setCheckoutMemberId(e.target.value)}
                          className="flex-1 bg-obsidian border border-gold/50 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                        >
                          <option value="">— Conducteur (optionnel) —</option>
                          {sortedMembers.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            const mem = sortedMembers.find((m) => m.id === checkoutMemberId);
                            void handleQuickStatus(
                              v,
                              'en_mission',
                              mem?.id || '',
                              mem?.name || 'Équipe Cartel'
                            );
                          }}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-gold text-obsidian hover:bg-gold-light cursor-pointer"
                        >
                          OK
                        </button>
                        <button
                          type="button"
                          onClick={() => setCheckoutTargetId(null)}
                          className="p-1.5 rounded-lg bg-obsidian text-zinc-400 hover:text-white cursor-pointer"
                          aria-label="Annuler"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {v.status !== 'en_mission' ? (
                            <button
                              type="button"
                              onClick={() => {
                                setCheckoutTargetId(v.id);
                                setCheckoutMemberId(v.assignedToId || '');
                              }}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gold/15 hover:bg-gold hover:text-obsidian text-gold-light border border-gold/40 transition cursor-pointer whitespace-nowrap"
                            >
                              Sortir
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void handleQuickStatus(v, 'disponible')}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-950/70 hover:bg-emerald-600 text-emerald-200 hover:text-white border border-emerald-500/40 transition cursor-pointer whitespace-nowrap"
                            >
                              Rentrer
                            </button>
                          )}

                          {v.status !== 'fourriere' ? (
                            <button
                              type="button"
                              onClick={() => void handleQuickStatus(v, 'fourriere')}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-obsidian hover:bg-crimson/30 text-zinc-300 hover:text-red-200 border border-zinc-700 transition cursor-pointer whitespace-nowrap"
                            >
                              Fourrière
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void handleQuickStatus(v, 'disponible')}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-950/70 hover:bg-emerald-600 text-emerald-200 hover:text-white border border-emerald-500/40 transition cursor-pointer whitespace-nowrap"
                            >
                              Récupéré
                            </button>
                          )}

                          {v.status !== 'reparation' && (
                            <button
                              type="button"
                              onClick={() => void handleQuickStatus(v, 'reparation')}
                              className="px-2 py-1.5 rounded-lg text-xs font-semibold bg-obsidian hover:bg-amber-950/60 text-zinc-400 hover:text-amber-200 border border-zinc-700 transition cursor-pointer whitespace-nowrap"
                              title="Marquer en réparation"
                            >
                              Atelier
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => openEditModal(v)}
                            className="p-1.5 rounded-lg bg-obsidian hover:bg-zinc-800 text-zinc-400 hover:text-gold-light transition cursor-pointer"
                            aria-label={`Modifier ${v.name}`}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteVehicle(v)}
                            className="p-1.5 rounded-lg bg-obsidian hover:bg-crimson/30 text-zinc-500 hover:text-red-300 transition cursor-pointer"
                            aria-label={`Supprimer ${v.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Ajout / Edition */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setModalOpen(false)}
        >
          <form
            onSubmit={handleSaveDraft}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl bg-charcoal gold-border p-5 sm:p-6 shadow-2xl space-y-4 my-auto"
          >
            <div className="flex items-center justify-between gap-3 border-b border-bronze/35 pb-3">
              <h3 className="font-display text-lg font-bold text-white">
                {draft.id ? 'Modifier le véhicule' : 'Ajouter un véhicule au garage'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg bg-obsidian text-zinc-400 hover:text-white cursor-pointer"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-300">
                  Modèle / Nom *
                </label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="Ex : Kuruma Blindée"
                  className="w-full bg-obsidian border border-zinc-700 focus:border-gold rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-300">
                  Plaque d&apos;immatriculation
                </label>
                <input
                  type="text"
                  maxLength={20}
                  value={draft.plate}
                  onChange={(e) => setDraft((d) => ({ ...d, plate: e.target.value }))}
                  placeholder="Ex : CERB-01"
                  className="w-full bg-obsidian border border-zinc-700 focus:border-gold rounded-lg px-3 py-2 text-xs text-white font-mono uppercase focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-300">Catégorie</label>
                <select
                  value={draft.category}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, category: e.target.value as VehicleCategory }))
                  }
                  className="w-full bg-obsidian border border-zinc-700 focus:border-gold rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                >
                  {(Object.keys(CATEGORY_META) as VehicleCategory[]).map((cat) => (
                    <option key={cat} value={cat}>
                      {CATEGORY_META[cat].label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-300">Statut</label>
                <select
                  value={draft.status}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, status: e.target.value as VehicleStatus }))
                  }
                  className="w-full bg-obsidian border border-zinc-700 focus:border-gold rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                >
                  {(Object.keys(STATUS_META) as VehicleStatus[]).map((st) => (
                    <option key={st} value={st}>
                      {STATUS_META[st].label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-300">Emplacement</label>
                <input
                  type="text"
                  maxLength={80}
                  value={draft.location}
                  onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
                  placeholder="Garage Hacienda, Héliport, Port..."
                  className="w-full bg-obsidian border border-zinc-700 focus:border-gold rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-300">
                  Blindage / Prépa
                </label>
                <input
                  type="text"
                  maxLength={40}
                  value={draft.armorLevel}
                  onChange={(e) => setDraft((d) => ({ ...d, armorLevel: e.target.value }))}
                  placeholder="Blindage Max, Turbo, Standard..."
                  className="w-full bg-obsidian border border-zinc-700 focus:border-gold rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-300">
                  Valeur estimée ($)
                </label>
                <input
                  type="number"
                  min={0}
                  value={draft.value}
                  onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))}
                  placeholder="Ex : 450000"
                  className="w-full bg-obsidian border border-zinc-700 focus:border-gold rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-300">
                  Conducteur actuel
                </label>
                <select
                  value={draft.assignedToId}
                  onChange={(e) => setDraft((d) => ({ ...d, assignedToId: e.target.value }))}
                  disabled={draft.status === 'disponible'}
                  className="w-full bg-obsidian border border-zinc-700 focus:border-gold rounded-lg px-3 py-2 text-xs text-white focus:outline-none disabled:opacity-50"
                >
                  <option value="">— Aucun —</option>
                  {sortedMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-zinc-300">
                Notes / Usage tactique
              </label>
              <textarea
                rows={2}
                maxLength={220}
                value={draft.notes}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                placeholder="Ex : Clés dans le coffre du bureau, plein effectué..."
                className="w-full bg-obsidian border border-zinc-700 focus:border-gold rounded-lg px-3 py-2 text-xs text-white focus:outline-none resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-bronze/30">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-obsidian hover:bg-zinc-800 text-zinc-300 cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 rounded-lg text-xs font-bold bg-gold hover:bg-gold-light text-obsidian transition cursor-pointer disabled:opacity-50"
              >
                {isSaving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};
