import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  Heart,
  Image as ImageIcon,
  LayoutGrid,
  Link2,
  MapPin,
  Maximize2,
  Pause,
  Play,
  Plus,
  Search,
  Shuffle,
  Sparkles,
  Trash2,
  Upload,
  User as UserIcon,
  X,
} from 'lucide-react';
import { ALBUM_CATEGORY_LABELS, BUILT_IN_ALBUM_PHOTOS } from '@/src/data/albumData';
import { fetchAlbumMediaUrl } from '@/src/services/cartelFirestore';
import type {
  AlbumPhotoCategory,
  AlbumPhotoRecord,
  AlbumState,
} from '@/src/types/cartel';

interface AlbumViewProps {
  albumState: AlbumState;
  defaultAuthorName: string;
  readonly: boolean;
  onAddPhoto: (
    photo: AlbumPhotoRecord,
    media?: { imageUrl: string; mimeType: string }
  ) => Promise<void>;
  onUpdatePhotoMeta: (photo: AlbumPhotoRecord) => Promise<void>;
  onDeletePhoto: (photo: AlbumPhotoRecord) => Promise<void>;
  onToggleFavorite: (photoId: string) => void;
  onRequestUnlock: () => void;
  onShowToast: (msg: string) => void;
}

type CategoryFilter = 'all' | 'favorites' | AlbumPhotoCategory;
type ViewLayoutMode = 'mosaic' | 'grid' | 'cinematic';

interface ResolvedAlbumPhoto extends AlbumPhotoRecord {
  resolvedSrc: string | null;
  isLoadingMedia: boolean;
}

const SLIDESHOW_INTERVAL_MS = 5500;
const MAX_MEDIA_DATA_URL_LEN = 650_000;

async function compressImageFile(
  file: File
): Promise<{ dataUrl: string; mimeType: string; width: number; height: number }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Impossible de lire ce fichier image.'));
      el.src = objectUrl;
    });

    const maxDim = 1440;
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const targetW = Math.max(1, Math.round((img.naturalWidth || 1280) * scale));
    const targetH = Math.max(1, Math.round((img.naturalHeight || 720) * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Contexte graphique indisponible.');
    }
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const qualities = [0.86, 0.76, 0.66, 0.55];
    for (const q of qualities) {
      const dataUrl = canvas.toDataURL('image/jpeg', q);
      if (dataUrl.length <= MAX_MEDIA_DATA_URL_LEN) {
        return { dataUrl, mimeType: 'image/jpeg', width: targetW, height: targetH };
      }
    }

    // Fallback smaller resolution if still over limit
    const smallScale = 0.7;
    canvas.width = Math.max(1, Math.round(targetW * smallScale));
    canvas.height = Math.max(1, Math.round(targetH * smallScale));
    const smallCtx = canvas.getContext('2d');
    if (smallCtx) {
      smallCtx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }
    const finalUrl = canvas.toDataURL('image/jpeg', 0.62);
    if (finalUrl.length > MAX_MEDIA_DATA_URL_LEN) {
      throw new Error("L'image reste trop volumineuse après compression. Choisissez un fichier plus léger.");
    }
    return {
      dataUrl: finalUrl,
      mimeType: 'image/jpeg',
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

interface AlbumImageFrameProps {
  src: string | null;
  alt: string;
  fallbackTitle: string;
  isLoading?: boolean;
  className?: string;
}

const AlbumImageFrame: React.FC<AlbumImageFrameProps> = ({
  src,
  alt,
  fallbackTitle,
  isLoading = false,
  className = '',
}) => {
  const [erroredSrc, setErroredSrc] = useState<string | null>(null);
  const hasError = Boolean(src && erroredSrc === src);

  if (isLoading || !src || hasError) {
    return (
      <div
        className={`w-full h-full flex flex-col items-center justify-center gap-2 bg-charcoal text-zinc-400 p-4 text-center ${className}`}
      >
        <ImageIcon className="w-7 h-7 text-gold/55" />
        <span className="text-xs font-medium text-zinc-300 line-clamp-2">
          {isLoading ? 'Chargement de la photo...' : fallbackTitle}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setErroredSrc(src)}
      className={`w-full h-full object-cover ${className}`}
    />
  );
};

export const AlbumView: React.FC<AlbumViewProps> = ({
  albumState,
  defaultAuthorName,
  readonly,
  onAddPhoto,
  onUpdatePhotoMeta,
  onDeletePhoto,
  onToggleFavorite,
  onRequestUnlock,
  onShowToast,
}) => {
  const [mediaCache, setMediaCache] = useState<Record<string, string>>({});
  const [loadingMediaIds, setLoadingMediaIds] = useState<Record<string, boolean>>({});
  const requestedMediaRef = useRef<Set<string>>(new Set());

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [layoutMode, setLayoutMode] = useState<ViewLayoutMode>('mosaic');

  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [lightboxPhotoId, setLightboxPhotoId] = useState<string | null>(null);

  // Add photo modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftCategory, setDraftCategory] = useState<AlbumPhotoCategory>('members');
  const [draftLocation, setDraftLocation] = useState('');
  const [draftCaption, setDraftCaption] = useState('');
  const [draftAuthor, setDraftAuthor] = useState(defaultAuthorName || 'Los Cerberos');
  const [draftExternalUrl, setDraftExternalUrl] = useState('');
  const [draftFileData, setDraftFileData] = useState<{
    dataUrl: string;
    mimeType: string;
    sizeKb: number;
    dimensions: string;
  } | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Lightbox edit / delete state
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editCaption, setEditCaption] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editCategory, setEditCategory] = useState<AlbumPhotoCategory>('members');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Fetch any custom photo media payloads missing from local cache
  useEffect(() => {
    const customList = Object.values(albumState.photos || {});
    customList.forEach((photo) => {
      const mId = photo.mediaId;
      if (!mId || mediaCache[mId] || requestedMediaRef.current.has(mId)) return;
      requestedMediaRef.current.add(mId);
      setLoadingMediaIds((prev) => ({ ...prev, [mId]: true }));
      void fetchAlbumMediaUrl(mId)
        .then((url) => {
          if (url) {
            setMediaCache((prev) => ({ ...prev, [mId]: url }));
          }
        })
        .catch(() => {
          requestedMediaRef.current.delete(mId);
        })
        .finally(() => {
          setLoadingMediaIds((prev) => {
            const next = { ...prev };
            delete next[mId];
            return next;
          });
        });
    });
  }, [albumState.photos, mediaCache]);

  const favoriteSet = useMemo(
    () => new Set(albumState.favorites || []),
    [albumState.favorites]
  );

  const allPhotos: ResolvedAlbumPhoto[] = useMemo(() => {
    const customSorted = Object.values(albumState.photos || {})
      .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso))
      .map((p): ResolvedAlbumPhoto => ({
        ...p,
        resolvedSrc: p.mediaId
          ? mediaCache[p.mediaId] || null
          : p.externalUrl || null,
        isLoadingMedia: Boolean(p.mediaId && loadingMediaIds[p.mediaId]),
      }));

    const builtIns: ResolvedAlbumPhoto[] = BUILT_IN_ALBUM_PHOTOS.map((p) => ({
      ...p,
      resolvedSrc: p.src,
      isLoadingMedia: false,
    }));

    return [...customSorted, ...builtIns];
  }, [albumState.photos, mediaCache, loadingMediaIds]);

  const categoryCounts = useMemo(() => {
    const counts: Record<CategoryFilter, number> = {
      all: allPhotos.length,
      favorites: 0,
      heists: 0,
      police: 0,
      hq: 0,
      identity: 0,
      members: 0,
    };
    allPhotos.forEach((p) => {
      if (favoriteSet.has(p.id)) counts.favorites++;
      counts[p.category] = (counts[p.category] || 0) + 1;
    });
    return counts;
  }, [allPhotos, favoriteSet]);

  const filteredPhotos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allPhotos.filter((p) => {
      if (categoryFilter === 'favorites' && !favoriteSet.has(p.id)) return false;
      if (
        categoryFilter !== 'all' &&
        categoryFilter !== 'favorites' &&
        p.category !== categoryFilter
      ) {
        return false;
      }
      if (!q) return true;
      const haystack = `${p.title} ${p.caption} ${p.location} ${p.authorName} ${ALBUM_CATEGORY_LABELS[p.category]}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [allPhotos, categoryFilter, favoriteSet, searchQuery]);

  const safeSpotlightIndex =
    filteredPhotos.length > 0 ? spotlightIndex % filteredPhotos.length : 0;
  const activeSpotlightPhoto = filteredPhotos[safeSpotlightIndex] || allPhotos[0] || null;

  // Dynamic slideshow timer
  useEffect(() => {
    if (!isPlaying || filteredPhotos.length <= 1 || addModalOpen) return;
    const timer = window.setInterval(() => {
      if (lightboxPhotoId) {
        setLightboxPhotoId((curId) => {
          const idx = filteredPhotos.findIndex((p) => p.id === curId);
          if (idx === -1) return curId;
          return filteredPhotos[(idx + 1) % filteredPhotos.length]?.id || curId;
        });
      } else {
        setSpotlightIndex((prev) => (prev + 1) % filteredPhotos.length);
      }
    }, SLIDESHOW_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [isPlaying, filteredPhotos, lightboxPhotoId, addModalOpen]);

  const lightboxPhoto = useMemo(
    () => allPhotos.find((p) => p.id === lightboxPhotoId) || null,
    [allPhotos, lightboxPhotoId]
  );

  const stepLightbox = useCallback(
    (delta: number) => {
      if (!lightboxPhotoId || filteredPhotos.length === 0) return;
      const list = filteredPhotos.some((p) => p.id === lightboxPhotoId)
        ? filteredPhotos
        : allPhotos;
      const idx = list.findIndex((p) => p.id === lightboxPhotoId);
      if (idx === -1) return;
      const next = list[(idx + delta + list.length) % list.length];
      if (next) {
        setLightboxPhotoId(next.id);
        setIsEditingMeta(false);
        setConfirmDeleteId(null);
      }
    },
    [lightboxPhotoId, filteredPhotos, allPhotos]
  );

  // Keyboard navigation in lightbox
  useEffect(() => {
    if (!lightboxPhotoId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }
      if (e.key === 'Escape') {
        setLightboxPhotoId(null);
        setIsEditingMeta(false);
        setConfirmDeleteId(null);
      } else if (e.key === 'ArrowRight') {
        stepLightbox(1);
      } else if (e.key === 'ArrowLeft') {
        stepLightbox(-1);
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxPhotoId, stepLightbox]);

  const handleOpenAddModal = () => {
    if (readonly) {
      onRequestUnlock();
      onShowToast("Déverrouillez l'édition avec le code secret pour ajouter une photo.");
      return;
    }
    setDraftTitle('');
    setDraftCategory('members');
    setDraftLocation('');
    setDraftCaption('');
    setDraftAuthor(defaultAuthorName || 'Los Cerberos');
    setDraftExternalUrl('');
    setDraftFileData(null);
    setFormError(null);
    setUploadMode('file');
    setAddModalOpen(true);
  };

  const handleSelectFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFormError('Veuillez sélectionner un fichier image (PNG, JPG, WEBP...).');
      return;
    }
    setFormError(null);
    setIsCompressing(true);
    try {
      const res = await compressImageFile(file);
      setDraftFileData({
        dataUrl: res.dataUrl,
        mimeType: res.mimeType,
        sizeKb: Math.round((res.dataUrl.length * 0.75) / 1024),
        dimensions: `${res.width}×${res.height}`,
      });
      if (!draftTitle.trim()) {
        const cleanedName = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
        if (cleanedName) {
          setDraftTitle(cleanedName.slice(0, 90));
        }
      }
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Erreur lors de la préparation de l'image."
      );
    } finally {
      setIsCompressing(false);
    }
  };

  const handleSubmitNewPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readonly || isSubmitting) return;

    const title = draftTitle.trim().slice(0, 90);
    if (!title) {
      setFormError('Ajoutez un titre pour identifier la photo.');
      return;
    }

    if (uploadMode === 'file' && !draftFileData) {
      setFormError('Sélectionnez une image depuis votre appareil.');
      return;
    }

    const extUrl = draftExternalUrl.trim();
    if (uploadMode === 'url') {
      if (!/^https?:\/\/\S+/i.test(extUrl)) {
        setFormError('Entrez une URL valide commençant par https:// ou http://.');
        return;
      }
    }

    setIsSubmitting(true);
    setFormError(null);
    const now = new Date();
    const id = `alb_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const dateLabel = now.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const newRecord: AlbumPhotoRecord = {
      id,
      title,
      category: draftCategory,
      caption: draftCaption.trim().slice(0, 260),
      location: draftLocation.trim().slice(0, 80) || 'Los Santos',
      dateLabel,
      authorName: draftAuthor.trim().slice(0, 60) || defaultAuthorName || 'Los Cerberos',
      createdAtIso: now.toISOString(),
      ...(uploadMode === 'file'
        ? { mediaId: id }
        : { externalUrl: extUrl.slice(0, 500) }),
    };

    try {
      if (uploadMode === 'file' && draftFileData) {
        setMediaCache((prev) => ({ ...prev, [id]: draftFileData.dataUrl }));
        await onAddPhoto(newRecord, {
          imageUrl: draftFileData.dataUrl,
          mimeType: draftFileData.mimeType,
        });
      } else {
        await onAddPhoto(newRecord);
      }
      setAddModalOpen(false);
      setCategoryFilter('all');
      setSpotlightIndex(0);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Impossible d'enregistrer la photo."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShuffleSpotlight = () => {
    if (filteredPhotos.length <= 1) return;
    let next = safeSpotlightIndex;
    while (next === safeSpotlightIndex) {
      next = Math.floor(Math.random() * filteredPhotos.length);
    }
    setSpotlightIndex(next);
  };

  const openLightbox = (photo: ResolvedAlbumPhoto) => {
    setLightboxPhotoId(photo.id);
    setIsEditingMeta(false);
    setConfirmDeleteId(null);
    setEditTitle(photo.title);
    setEditCaption(photo.caption);
    setEditLocation(photo.location);
    setEditCategory(photo.category);
  };

  const handleSaveEditedMeta = async (photo: ResolvedAlbumPhoto) => {
    if (readonly || photo.builtIn) return;
    const cleanTitle = editTitle.trim().slice(0, 90);
    if (!cleanTitle) {
      onShowToast('Le titre ne peut pas être vide.');
      return;
    }
    const updated: AlbumPhotoRecord = {
      id: photo.id,
      title: cleanTitle,
      category: editCategory,
      caption: editCaption.trim().slice(0, 260),
      location: editLocation.trim().slice(0, 80),
      dateLabel: photo.dateLabel,
      authorName: photo.authorName,
      createdAtIso: photo.createdAtIso,
      ...(photo.mediaId ? { mediaId: photo.mediaId } : {}),
      ...(photo.externalUrl ? { externalUrl: photo.externalUrl } : {}),
    };
    await onUpdatePhotoMeta(updated);
    setIsEditingMeta(false);
  };

  const handleConfirmDelete = async (photo: ResolvedAlbumPhoto) => {
    if (readonly || photo.builtIn) return;
    await onDeletePhoto(photo);
    setConfirmDeleteId(null);
    setLightboxPhotoId(null);
  };

  const handleFavoriteClick = (photoId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (readonly) {
      onRequestUnlock();
      onShowToast("Déverrouillez l'édition pour gérer les favoris partagés.");
      return;
    }
    onToggleFavorite(photoId);
  };

  const customPhotosCount = Object.keys(albumState.photos || {}).length;

  return (
    <div className="space-y-6">
      {/* EN-TÊTE ALBUM + BOUTON AJOUTER */}
      <section className="bg-charcoal/95 gold-border rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-gold-light flex items-center gap-2">
            <Camera className="w-3.5 h-3.5 text-gold" />
            Mémoires du Cartel · {allPhotos.length} photo{allPhotos.length > 1 ? 's' : ''}
            {customPhotosCount > 0 && (
              <span className="text-zinc-400">
                ({customPhotosCount} ajoutée{customPhotosCount > 1 ? 's' : ''})
              </span>
            )}
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-extrabold text-white">
            Album Photo <span className="text-gold">Los Cerberos</span>
          </h2>
          <p className="text-xs text-zinc-400 max-w-2xl">
            Archives des opérations, confrontations, rassemblements au manoir et souvenirs ajoutés par les membres du cartel.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsPlaying((p) => !p)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-obsidian hover:bg-slateDark text-zinc-200 border border-bronze/50 transition inline-flex items-center gap-1.5 cursor-pointer"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 text-gold" />
                Pause diapo
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-gold" />
                Lancer diapo
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleShuffleSpotlight}
            disabled={filteredPhotos.length <= 1}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-obsidian hover:bg-slateDark text-zinc-200 border border-bronze/50 transition inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            <Shuffle className="w-3.5 h-3.5 text-gold-light" />
            Aléatoire
          </button>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-gold hover:bg-gold-light text-obsidian transition inline-flex items-center gap-2 shadow-lg shadow-gold/15 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Ajouter une photo
          </button>
        </div>
      </section>

      {/* DIAPORAMA DYNAMIQUE EN VEDETTE */}
      {activeSpotlightPhoto && (
        <section className="bg-charcoal/95 bronze-border rounded-2xl overflow-hidden shadow-2xl">
          <div className="relative h-[320px] sm:h-[420px] lg:h-[480px] bg-obsidian group overflow-hidden">
            <AlbumImageFrame
              src={activeSpotlightPhoto.resolvedSrc}
              alt={activeSpotlightPhoto.title}
              fallbackTitle={activeSpotlightPhoto.title}
              isLoading={activeSpotlightPhoto.isLoadingMedia}
              className="transition-transform duration-700 group-hover:scale-[1.02] cursor-pointer"
            />

            {/* Gradient scrim */}
            <div
              onClick={() => openLightbox(activeSpotlightPhoto)}
              className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/35 to-obsidian/20 cursor-pointer"
            />

            {/* Top controls */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2 pointer-events-none">
              <div className="pointer-events-auto px-3 py-1 rounded-lg bg-obsidian/80 backdrop-blur-sm border border-gold/40 text-[11px] font-mono text-gold-light">
                {ALBUM_CATEGORY_LABELS[activeSpotlightPhoto.category]} ·{' '}
                <span className="tabular-nums">
                  {safeSpotlightIndex + 1} / {Math.max(1, filteredPhotos.length)}
                </span>
              </div>

              <div className="pointer-events-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => handleFavoriteClick(activeSpotlightPhoto.id, e)}
                  title={
                    favoriteSet.has(activeSpotlightPhoto.id)
                      ? 'Retirer des favoris'
                      : 'Ajouter aux favoris'
                  }
                  className={`p-2 rounded-xl border backdrop-blur-sm transition cursor-pointer ${
                    favoriteSet.has(activeSpotlightPhoto.id)
                      ? 'bg-crimson/85 border-crimson-light text-white'
                      : 'bg-obsidian/80 border-bronze/50 text-zinc-300 hover:text-white hover:border-gold/60'
                  }`}
                >
                  <Heart
                    className={`w-4 h-4 ${
                      favoriteSet.has(activeSpotlightPhoto.id) ? 'fill-current' : ''
                    }`}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => openLightbox(activeSpotlightPhoto)}
                  title="Afficher en plein écran"
                  className="p-2 rounded-xl bg-obsidian/80 backdrop-blur-sm border border-bronze/50 text-zinc-200 hover:text-gold-light hover:border-gold/60 transition cursor-pointer"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Prev / Next arrows */}
            {filteredPhotos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setSpotlightIndex(
                      (safeSpotlightIndex - 1 + filteredPhotos.length) %
                        filteredPhotos.length
                    )
                  }
                  aria-label="Photo précédente"
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-obsidian/75 hover:bg-obsidian text-white border border-gold/40 hover:border-gold transition opacity-85 sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSpotlightIndex((safeSpotlightIndex + 1) % filteredPhotos.length)
                  }
                  aria-label="Photo suivante"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-obsidian/75 hover:bg-obsidian text-white border border-gold/40 hover:border-gold transition opacity-85 sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}

            {/* Caption overlay */}
            <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3 pointer-events-none">
              <div className="space-y-1.5 max-w-2xl">
                <h3 className="font-display text-lg sm:text-2xl font-extrabold text-white">
                  {activeSpotlightPhoto.title}
                </h3>
                {activeSpotlightPhoto.caption && (
                  <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed line-clamp-2">
                    {activeSpotlightPhoto.caption}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-zinc-300 pt-0.5">
                  <span className="inline-flex items-center gap-1 text-gold-light">
                    <MapPin className="w-3 h-3" />
                    {activeSpotlightPhoto.location || 'Los Santos'}
                  </span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <UserIcon className="w-3 h-3 text-zinc-400" />
                    {activeSpotlightPhoto.authorName}
                  </span>
                  <span>·</span>
                  <span className="text-zinc-400">{activeSpotlightPhoto.dateLabel}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => openLightbox(activeSpotlightPhoto)}
                className="pointer-events-auto px-3.5 py-2 rounded-xl text-xs font-bold bg-obsidian/85 hover:bg-gold hover:text-obsidian text-gold-light border border-gold/50 transition shrink-0 self-start sm:self-end cursor-pointer"
              >
                Ouvrir en grand
              </button>
            </div>
          </div>

          {/* Filmstrip thumbnails */}
          {filteredPhotos.length > 1 && (
            <div className="bg-obsidian/90 border-t border-bronze/35 px-3 py-2.5 flex items-center gap-2 overflow-x-auto">
              {filteredPhotos.map((photo, idx) => {
                const isActive = idx === safeSpotlightIndex;
                return (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setSpotlightIndex(idx)}
                    className={`relative w-20 h-14 sm:w-24 sm:h-16 rounded-lg overflow-hidden shrink-0 border-2 transition cursor-pointer ${
                      isActive
                        ? 'border-gold scale-[1.03] shadow-md shadow-gold/25'
                        : 'border-transparent opacity-60 hover:opacity-100 hover:border-bronze/70'
                    }`}
                  >
                    <AlbumImageFrame
                      src={photo.resolvedSrc}
                      alt={photo.title}
                      fallbackTitle={photo.title}
                      isLoading={photo.isLoadingMedia}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* BARRE DE FILTRES, RECHERCHE & AFFICHAGE */}
      <section className="bg-charcoal/95 bronze-border rounded-2xl p-4 space-y-3.5 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Catégories */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { key: 'all', label: 'Toutes' },
                { key: 'favorites', label: 'Favoris' },
                { key: 'heists', label: 'Braquages' },
                { key: 'police', label: 'Police & Négos' },
                { key: 'hq', label: 'QG & Terrain' },
                { key: 'identity', label: 'Identité' },
                { key: 'members', label: 'Ajouts Membres' },
              ] as Array<{ key: CategoryFilter; label: string }>
            ).map((tab) => {
              const active = categoryFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setCategoryFilter(tab.key);
                    setSpotlightIndex(0);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1.5 cursor-pointer ${
                    active
                      ? 'bg-gold text-obsidian font-bold shadow-sm'
                      : 'bg-obsidian/80 hover:bg-slateDark text-zinc-300 border border-bronze/40'
                  }`}
                >
                  {tab.key === 'favorites' && (
                    <Heart className={`w-3 h-3 ${active ? 'fill-current' : 'text-crimson-light'}`} />
                  )}
                  <span>{tab.label}</span>
                  <span
                    className={`font-mono text-[10px] tabular-nums ${
                      active ? 'text-obsidian/80' : 'text-zinc-500'
                    }`}
                  >
                    {categoryCounts[tab.key]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Recherche + Mode d'affichage */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSpotlightIndex(0);
                }}
                placeholder="Rechercher lieu, titre, auteur..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-obsidian border border-bronze/50 focus:border-gold outline-none text-white placeholder:text-zinc-500"
              />
            </div>

            <div className="flex items-center rounded-lg bg-obsidian border border-bronze/45 p-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setLayoutMode('mosaic')}
                title="Vue Mosaïque dynamique"
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition inline-flex items-center gap-1 cursor-pointer ${
                  layoutMode === 'mosaic'
                    ? 'bg-charcoal text-gold-light border border-gold/30'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Mosaïque</span>
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('grid')}
                title="Grille régulière"
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition inline-flex items-center gap-1 cursor-pointer ${
                  layoutMode === 'grid'
                    ? 'bg-charcoal text-gold-light border border-gold/30'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Grille</span>
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('cinematic')}
                title="Bandes grand format"
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition inline-flex items-center gap-1 cursor-pointer ${
                  layoutMode === 'cinematic'
                    ? 'bg-charcoal text-gold-light border border-gold/30'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cinéma</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* GALERIE DYNAMIQUE */}
      {filteredPhotos.length === 0 ? (
        <div className="bg-charcoal/90 bronze-border rounded-2xl p-10 text-center space-y-3">
          <ImageIcon className="w-10 h-10 text-gold/50 mx-auto" />
          <h3 className="font-display text-lg font-bold text-white">
            Aucune photo dans cette sélection
          </h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            Modifiez vos filtres ou ajoutez une nouvelle capture du cartel pour enrichir l&apos;album.
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setCategoryFilter('all');
                setSearchQuery('');
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-obsidian hover:bg-slateDark text-zinc-200 border border-bronze/50 cursor-pointer"
            >
              Afficher toutes les photos
            </button>
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-gold hover:bg-gold-light text-obsidian cursor-pointer"
            >
              + Ajouter une photo
            </button>
          </div>
        </div>
      ) : (
        <section
          className={
            layoutMode === 'cinematic'
              ? 'grid grid-cols-1 md:grid-cols-2 gap-5'
              : layoutMode === 'grid'
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
                : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 auto-rows-[220px] gap-4'
          }
        >
          {filteredPhotos.map((photo, idx) => {
            const isFav = favoriteSet.has(photo.id);
            const isHeroTile =
              layoutMode === 'mosaic' && (idx === 0 || (isFav && idx % 5 === 1));
            const isWideTile =
              layoutMode === 'mosaic' && !isHeroTile && idx % 4 === 2;

            const spanClass =
              layoutMode === 'mosaic'
                ? isHeroTile
                  ? 'sm:col-span-2 sm:row-span-2'
                  : isWideTile
                    ? 'sm:col-span-2'
                    : ''
                : layoutMode === 'cinematic'
                  ? 'aspect-[16/9]'
                  : 'aspect-[4/3]';

            return (
              <article
                key={photo.id}
                onClick={() => openLightbox(photo)}
                className={`group relative rounded-2xl overflow-hidden bg-charcoal border border-bronze/45 hover:border-gold/75 transition shadow-xl cursor-pointer ${spanClass}`}
              >
                <AlbumImageFrame
                  src={photo.resolvedSrc}
                  alt={photo.title}
                  fallbackTitle={photo.title}
                  isLoading={photo.isLoadingMedia}
                  className="group-hover:scale-105 transition-transform duration-500"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/30 to-transparent opacity-90 group-hover:opacity-100 transition" />

                {/* Top bar */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-obsidian/80 backdrop-blur-sm border border-bronze/40 text-[10px] font-mono text-gold-light truncate">
                    {ALBUM_CATEGORY_LABELS[photo.category]}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => handleFavoriteClick(photo.id, e)}
                    title={isFav ? 'Retirer des favoris' : 'Mettre en favori'}
                    className={`p-1.5 rounded-lg backdrop-blur-sm border transition cursor-pointer ${
                      isFav
                        ? 'bg-crimson/85 border-crimson-light text-white'
                        : 'bg-obsidian/70 border-bronze/40 text-zinc-300 opacity-85 sm:opacity-0 sm:group-hover:opacity-100 hover:text-white'
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
                  </button>
                </div>

                {/* Bottom metadata */}
                <div className="absolute bottom-3 left-3.5 right-3.5 space-y-1">
                  <h4
                    className={`font-display font-extrabold text-white leading-snug line-clamp-1 ${
                      isHeroTile ? 'text-lg sm:text-xl' : 'text-sm'
                    }`}
                  >
                    {photo.title}
                  </h4>
                  {(isHeroTile || layoutMode === 'cinematic') && photo.caption && (
                    <p className="text-xs text-zinc-300 line-clamp-2">{photo.caption}</p>
                  )}
                  <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-zinc-400">
                    <span className="truncate text-gold-light/90">
                      {photo.location || 'Los Santos'}
                    </span>
                    <span className="shrink-0 truncate">
                      {photo.builtIn ? photo.dateLabel : `Par ${photo.authorName}`}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* MODAL AJOUTER UNE PHOTO */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 bg-obsidian/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-charcoal gold-border rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between gap-3 border-b border-bronze/35 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-gold-light block">
                  Album Los Cerberos
                </span>
                <h3 className="font-display text-lg font-extrabold text-white">
                  Ajouter une photo au mur du cartel
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="p-1.5 rounded-lg bg-obsidian hover:bg-slateDark text-zinc-400 hover:text-white border border-bronze/40 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitNewPhoto} className="space-y-4">
              {/* Source selector */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-obsidian border border-bronze/40">
                <button
                  type="button"
                  onClick={() => {
                    setUploadMode('file');
                    setFormError(null);
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition inline-flex items-center justify-center gap-2 cursor-pointer ${
                    uploadMode === 'file'
                      ? 'bg-gold text-obsidian'
                      : 'text-zinc-300 hover:text-white'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  Importer un fichier
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUploadMode('url');
                    setFormError(null);
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition inline-flex items-center justify-center gap-2 cursor-pointer ${
                    uploadMode === 'url'
                      ? 'bg-gold text-obsidian'
                      : 'text-zinc-300 hover:text-white'
                  }`}
                >
                  <Link2 className="w-3.5 h-3.5" />
                  Lien URL image
                </button>
              </div>

              {uploadMode === 'file' ? (
                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => void handleSelectFile(e.target.files?.[0])}
                    className="hidden"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      void handleSelectFile(e.dataTransfer.files?.[0]);
                    }}
                    className="rounded-xl border-2 border-dashed border-bronze/60 hover:border-gold/80 bg-obsidian/70 p-4 text-center cursor-pointer transition space-y-2"
                  >
                    {draftFileData ? (
                      <div className="space-y-2">
                        <div className="h-44 rounded-lg overflow-hidden bg-charcoal border border-bronze/40">
                          <img
                            src={draftFileData.dataUrl}
                            alt="Aperçu"
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="text-[11px] font-mono text-gold-light">
                          Prêt ({draftFileData.dimensions} · {draftFileData.sizeKb} Ko optimisés) — Cliquez pour changer
                        </div>
                      </div>
                    ) : (
                      <div className="py-4 space-y-1.5">
                        <Upload className="w-7 h-7 text-gold mx-auto" />
                        <div className="text-xs font-semibold text-white">
                          {isCompressing
                            ? 'Optimisation de la photo en cours...'
                            : 'Cliquez ou déposez une image ici (PNG, JPG, WEBP)'}
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          Redimensionnement automatique haute qualité pour tous les membres
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-300 block">
                    URL directe de l&apos;image (https://...)
                  </label>
                  <input
                    type="url"
                    value={draftExternalUrl}
                    onChange={(e) => setDraftExternalUrl(e.target.value)}
                    placeholder="https://exemple.com/capture-cerberos.png"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-obsidian border border-bronze/50 focus:border-gold outline-none text-white"
                  />
                  {/^https?:\/\/\S+/i.test(draftExternalUrl.trim()) && (
                    <div className="h-36 rounded-lg overflow-hidden bg-obsidian border border-bronze/40">
                      <AlbumImageFrame
                        src={draftExternalUrl.trim()}
                        alt="Aperçu URL"
                        fallbackTitle="Aperçu indisponible"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-zinc-300 block">
                    Titre de la photo *
                  </label>
                  <input
                    type="text"
                    maxLength={90}
                    required
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    placeholder="Ex: Sortie Pacific Bank"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-obsidian border border-bronze/50 focus:border-gold outline-none text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-zinc-300 block">
                    Catégorie
                  </label>
                  <select
                    value={draftCategory}
                    onChange={(e) => setDraftCategory(e.target.value as AlbumPhotoCategory)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-obsidian border border-bronze/50 focus:border-gold outline-none text-white"
                  >
                    {Object.entries(ALBUM_CATEGORY_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-zinc-300 block">
                    Lieu / Mission
                  </label>
                  <input
                    type="text"
                    maxLength={80}
                    value={draftLocation}
                    onChange={(e) => setDraftLocation(e.target.value)}
                    placeholder="Ex: Paleto Bay, Hacienda..."
                    className="w-full px-3 py-2 rounded-xl text-xs bg-obsidian border border-bronze/50 focus:border-gold outline-none text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-zinc-300 block">
                    Photographe / Membre
                  </label>
                  <input
                    type="text"
                    maxLength={60}
                    value={draftAuthor}
                    onChange={(e) => setDraftAuthor(e.target.value)}
                    placeholder="Votre nom"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-obsidian border border-bronze/50 focus:border-gold outline-none text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-zinc-300 block">
                  Légende / Histoire
                </label>
                <textarea
                  rows={2}
                  maxLength={260}
                  value={draftCaption}
                  onChange={(e) => setDraftCaption(e.target.value)}
                  placeholder="Contexte de l'opération, membres présents..."
                  className="w-full px-3 py-2 rounded-xl text-xs bg-obsidian border border-bronze/50 focus:border-gold outline-none text-white resize-none"
                />
              </div>

              {formError && (
                <div className="rounded-xl bg-red-950/60 border border-crimson-light/50 px-3 py-2 text-xs text-red-200">
                  {formError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-bronze/30">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-obsidian hover:bg-slateDark text-zinc-300 border border-bronze/45 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || isCompressing}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-gold hover:bg-gold-light text-obsidian transition inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  {isSubmitting ? 'Enregistrement...' : 'Publier dans l’album'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VISIONNEUSE PLEIN ÉCRAN (LIGHTBOX) */}
      {lightboxPhoto && (
        <div
          onClick={() => {
            setLightboxPhotoId(null);
            setIsEditingMeta(false);
            setConfirmDeleteId(null);
          }}
          className="fixed inset-0 z-50 bg-obsidian/95 backdrop-blur-md flex flex-col justify-between p-3 sm:p-6"
        >
          {/* Top toolbar */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex flex-wrap items-center justify-between gap-2 max-w-6xl w-full mx-auto"
          >
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-charcoal border border-gold/40 text-[11px] font-mono text-gold-light">
                {ALBUM_CATEGORY_LABELS[lightboxPhoto.category]}
              </span>
              <span className="text-xs text-zinc-400 font-mono">
                {lightboxPhoto.dateLabel} · {lightboxPhoto.authorName}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPlaying((p) => !p)}
                className="px-2.5 py-1.5 rounded-lg bg-charcoal hover:bg-slateDark text-zinc-200 border border-bronze/45 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5 text-gold" /> : <Play className="w-3.5 h-3.5 text-gold" />}
                {isPlaying ? 'Pause' : 'Diapo'}
              </button>

              <button
                type="button"
                onClick={(e) => handleFavoriteClick(lightboxPhoto.id, e)}
                className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                  favoriteSet.has(lightboxPhoto.id)
                    ? 'bg-crimson text-white border-crimson-light'
                    : 'bg-charcoal text-zinc-200 border-bronze/45 hover:border-gold'
                }`}
              >
                <Heart
                  className={`w-3.5 h-3.5 ${
                    favoriteSet.has(lightboxPhoto.id) ? 'fill-current' : ''
                  }`}
                />
                Favori
              </button>

              {lightboxPhoto.resolvedSrc && (
                <a
                  href={lightboxPhoto.resolvedSrc}
                  download={`${lightboxPhoto.title.replace(/[^a-zA-Z0-9_-]+/g, '_')}.jpg`}
                  className="p-2 rounded-lg bg-charcoal hover:bg-slateDark text-zinc-200 border border-bronze/45 hover:border-gold transition"
                  title="Télécharger l'image"
                >
                  <Download className="w-4 h-4" />
                </a>
              )}

              {!lightboxPhoto.builtIn && !readonly && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsEditingMeta((v) => !v)}
                    className="p-2 rounded-lg bg-charcoal hover:bg-slateDark text-gold-light border border-bronze/45 hover:border-gold transition cursor-pointer"
                    title="Modifier les infos"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  {confirmDeleteId === lightboxPhoto.id ? (
                    <button
                      type="button"
                      onClick={() => void handleConfirmDelete(lightboxPhoto)}
                      className="px-2.5 py-1.5 rounded-lg bg-crimson hover:bg-crimson-light text-white text-xs font-bold cursor-pointer"
                    >
                      Confirmer suppression
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(lightboxPhoto.id)}
                      className="p-2 rounded-lg bg-charcoal hover:bg-crimson-dark text-crimson-light border border-crimson/50 transition cursor-pointer"
                      title="Supprimer cette photo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </>
              )}

              <button
                type="button"
                onClick={() => {
                  setLightboxPhotoId(null);
                  setIsEditingMeta(false);
                  setConfirmDeleteId(null);
                }}
                className="p-2 rounded-lg bg-charcoal hover:bg-slateDark text-white border border-bronze/50 cursor-pointer"
                title="Fermer (Échap)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Image display */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex-1 flex items-center justify-center my-3 min-h-0 max-w-6xl w-full mx-auto"
          >
            {lightboxPhoto.resolvedSrc ? (
              <img
                src={lightboxPhoto.resolvedSrc}
                alt={lightboxPhoto.title}
                referrerPolicy="no-referrer"
                className="max-h-full max-w-full object-contain rounded-xl border border-bronze/40 shadow-2xl"
              />
            ) : (
              <div className="px-8 py-12 rounded-2xl bg-charcoal border border-bronze/40 text-xs text-zinc-400">
                {lightboxPhoto.isLoadingMedia
                  ? 'Chargement de l’image haute résolution...'
                  : 'Image indisponible'}
              </div>
            )}

            <button
              type="button"
              onClick={() => stepLightbox(-1)}
              className="absolute left-1 sm:left-3 top-1/2 -translate-y-1/2 p-3 rounded-full bg-obsidian/80 hover:bg-obsidian text-white border border-gold/45 hover:border-gold transition cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => stepLightbox(1)}
              className="absolute right-1 sm:right-3 top-1/2 -translate-y-1/2 p-3 rounded-full bg-obsidian/80 hover:bg-obsidian text-white border border-gold/45 hover:border-gold transition cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Bottom info / inline editor */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-4xl w-full mx-auto bg-charcoal/95 border border-bronze/45 rounded-2xl p-4"
          >
            {isEditingMeta && !lightboxPhoto.builtIn && !readonly ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <input
                    type="text"
                    value={editTitle}
                    maxLength={90}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Titre"
                    className="px-3 py-1.5 rounded-lg text-xs bg-obsidian border border-bronze/50 text-white"
                  />
                  <input
                    type="text"
                    value={editLocation}
                    maxLength={80}
                    onChange={(e) => setEditLocation(e.target.value)}
                    placeholder="Lieu"
                    className="px-3 py-1.5 rounded-lg text-xs bg-obsidian border border-bronze/50 text-white"
                  />
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as AlbumPhotoCategory)}
                    className="px-3 py-1.5 rounded-lg text-xs bg-obsidian border border-bronze/50 text-white"
                  >
                    {Object.entries(ALBUM_CATEGORY_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={editCaption}
                    maxLength={260}
                    onChange={(e) => setEditCaption(e.target.value)}
                    placeholder="Légende..."
                    className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-obsidian border border-bronze/50 text-white"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingMeta(false)}
                      className="px-3 py-1.5 rounded-lg text-xs bg-obsidian text-zinc-300 border border-bronze/45 cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSaveEditedMeta(lightboxPhoto)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gold text-obsidian cursor-pointer"
                    >
                      Enregistrer
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-display text-base sm:text-lg font-extrabold text-white">
                    {lightboxPhoto.title}
                  </h4>
                  {lightboxPhoto.caption && (
                    <p className="text-xs text-zinc-300 mt-0.5">{lightboxPhoto.caption}</p>
                  )}
                </div>
                <span className="text-xs font-mono text-gold-light shrink-0 inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {lightboxPhoto.location || 'Los Santos'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
