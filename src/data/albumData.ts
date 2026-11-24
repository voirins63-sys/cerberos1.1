import type { AlbumPhotoCategory, AlbumPhotoRecord } from '@/src/types/cartel';

export interface BuiltInAlbumPhoto extends AlbumPhotoRecord {
  src: string;
  builtIn: true;
}

export const ALBUM_CATEGORY_LABELS: Record<AlbumPhotoCategory, string> = {
  heists: 'Braquages & Assauts',
  police: 'Police & Négociations',
  hq: 'QG & Terrain',
  identity: 'Identité & Emblèmes',
  members: 'Ajouts Membres',
};

export const BUILT_IN_ALBUM_PHOTOS: BuiltInAlbumPhoto[] = [
  {
    id: 'builtin_affiche_cerberos',
    title: 'Affiche Officielle — Los Cerberos',
    category: 'identity',
    caption:
      'La direction paramilitaire devant l’hacienda, le Cerbère à trois têtes et le Canis Kamacho blindé.',
    location: 'Hacienda Los Cerberos',
    dateLabel: 'Archives Cartel',
    authorName: 'Commandement',
    createdAtIso: '2026-11-20T22:00:00.000Z',
    src: '/assets/aistudio/image_d68a7777.png',
    builtIn: true,
  },
  {
    id: 'builtin_embleme_cerberos',
    title: 'Emblème — Juramentados por la Sangre',
    category: 'identity',
    caption:
      'Sceau officiel du cartel : « Traicionados por el Estado, Juramentados por la Sangre ».',
    location: 'Sceau Officiel',
    dateLabel: 'Archives Cartel',
    authorName: 'Commandement',
    createdAtIso: '2026-11-20T21:55:00.000Z',
    src: '/assets/aistudio/image_bba68987.png',
    builtIn: true,
  },
  {
    id: 'builtin_rassemblement_manoir',
    title: 'Rassemblement dans la Cour du Manoir',
    category: 'hq',
    caption:
      'Briefing nocturne de toute l’organisation dans la cour pavée avant le départ en convoi.',
    location: 'Cour du QG — Nuit',
    dateLabel: 'Soirée Opérations',
    authorName: 'Los Cerberos',
    createdAtIso: '2026-11-20T21:40:00.000Z',
    src: '/assets/aistudio/image_df344d8d.png',
    builtIn: true,
  },
  {
    id: 'builtin_fleeca_kamacho',
    title: 'Dispositif Kamacho devant Fleeca',
    category: 'heists',
    caption:
      'Deux Canis Kamacho camouflés encadrent l’entrée de la banque Fleeca en pleine nuit.',
    location: 'Banque Fleeca',
    dateLabel: 'Gros Coup',
    authorName: 'Escouade Assaut',
    createdAtIso: '2026-11-20T21:30:00.000Z',
    src: '/assets/aistudio/image_97df8fb8.png',
    builtIn: true,
  },
  {
    id: 'builtin_fleeca_duo',
    title: 'Binôme en Garde — Fleeca Bank',
    category: 'heists',
    caption:
      'Protection du périmètre extérieur pendant l’ouverture du coffre par l’équipe technique.',
    location: 'Banque Fleeca',
    dateLabel: 'Gros Coup',
    authorName: 'Escouade Assaut',
    createdAtIso: '2026-11-20T21:25:00.000Z',
    src: '/assets/aistudio/image_b466728e.png',
    builtIn: true,
  },
  {
    id: 'builtin_fleeca_avantposte',
    title: 'Avant-Poste & Surveillance Rue',
    category: 'heists',
    caption:
      'Garde avancée sur la chaussée face à la banque, prêts à couvrir la sortie des véhicules.',
    location: 'Avenue Fleeca',
    dateLabel: 'Gros Coup',
    authorName: 'Escouade Assaut',
    createdAtIso: '2026-11-20T21:20:00.000Z',
    src: '/assets/aistudio/image_bd3c4ab4.png',
    builtIn: true,
  },
  {
    id: 'builtin_bolingbroke_nuit',
    title: 'Opération Pénitencier de Bolingbroke',
    category: 'hq',
    caption:
      'Intervention nocturne sous les projecteurs orange devant l’entrée principale de la prison.',
    location: 'Bolingbroke Penitentiary',
    dateLabel: 'Opération Spéciale',
    authorName: 'Escouade Terrain',
    createdAtIso: '2026-11-20T21:10:00.000Z',
    src: '/assets/aistudio/image_d9e18224.png',
    builtIn: true,
  },
  {
    id: 'builtin_barrage_highway',
    title: 'Barrage Nocturne — State Police',
    category: 'police',
    caption:
      'Négociation tendue sur l’autoroute face aux unités d’interception et sacs de butin au dos.',
    location: 'Autoroute Côtière',
    dateLabel: 'Confrontation',
    authorName: 'Escouade Terrain',
    createdAtIso: '2026-11-20T21:00:00.000Z',
    src: '/assets/aistudio/image_a08daa0b.png',
    builtIn: true,
  },
  {
    id: 'builtin_negociation_cote',
    title: 'Pourparlers sous Gyrophare',
    category: 'police',
    caption:
      'Face-à-face sur le bitume de la route côtière avant le repli tactique de l’équipe.',
    location: 'Route Côtière — Nuit',
    dateLabel: 'Confrontation',
    authorName: 'Escouade Terrain',
    createdAtIso: '2026-11-20T20:50:00.000Z',
    src: '/assets/aistudio/image_e4b58fd2.png',
    builtIn: true,
  },
  {
    id: 'builtin_crepuscule_police',
    title: 'Crépuscule face à la State Police',
    category: 'police',
    caption:
      'Négociations sous un ciel orangé au bord de l’océan avec la cargaison sécurisée.',
    location: 'Great Ocean Highway',
    dateLabel: 'Fin de Journée',
    authorName: 'Escouade Terrain',
    createdAtIso: '2026-11-20T20:40:00.000Z',
    src: '/assets/aistudio/image_efdad715.png',
    builtIn: true,
  },
  {
    id: 'builtin_complexe_police',
    title: 'Discussion au Complexe Urbain',
    category: 'police',
    caption:
      'Échange avec les forces de l’ordre en plein jour au pied des arches blanches.',
    location: 'Centre-Ville',
    dateLabel: 'Intervention Jour',
    authorName: 'Escouade Terrain',
    createdAtIso: '2026-11-20T20:30:00.000Z',
    src: '/assets/aistudio/image_146297f5.png',
    builtIn: true,
  },
  {
    id: 'builtin_falaise_pacifique',
    title: 'Panorama sur les Falaises',
    category: 'hq',
    caption:
      'Halte au sommet de la côte rocheuse dominant la baie et les plages du nord.',
    location: 'Falaises Pacifiques',
    dateLabel: 'Reconnaissance',
    authorName: 'Los Cerberos',
    createdAtIso: '2026-11-20T20:20:00.000Z',
    src: '/assets/aistudio/image_57321496.png',
    builtIn: true,
  },
];
