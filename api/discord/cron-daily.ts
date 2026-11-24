import crypto from 'crypto';

interface VercelLikeRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
}

interface VercelLikeResponse {
  status: (code: number) => VercelLikeResponse;
  json: (payload: unknown) => void;
}

const DISCORD_WEBHOOK_PATH_REGEX = /^\/api\/webhooks\/(\d+)\/([A-Za-z0-9._-]+)$/;

const DAILY_SCENES = [
  {
    title: 'Embuscade Convoi Blindé',
    path: '/src/assets/images/gazette_convoy_heist_1795493988458.jpg',
  },
  {
    title: 'Opération Port & Conteneurs',
    path: '/src/assets/images/gazette_harbor_smuggling_1795493988846.jpg',
  },
  {
    title: 'Conseil Stratégique — Hacienda',
    path: '/src/assets/images/gazette_hacienda_warroom_1795493989179.jpg',
  },
  {
    title: 'Reconnaissance Aérienne Nocturne',
    path: '/src/assets/images/gazette_rooftop_recon_1795493989686.jpg',
  },
  {
    title: 'Coffre-Fort & Réserves d’Or',
    path: '/src/assets/images/gazette_vault_payout_1795493988622.jpg',
  },
];

const OFFICIAL_DAY_MISSIONS: Record<string, Array<{ name: string; major: boolean }>> = {
  Lundi: [
    { name: 'Supérette ×2 · ATM ×2 · Maison ×2', major: false },
    { name: 'Fourgon Blindé · Clef de Drogues ×3 · Kétamine', major: false },
    { name: 'Banque Fleeca (Gros Coup)', major: true },
  ],
  Mardi: [
    { name: 'Supérette ×2 · ATM ×2 · Maison ×2', major: false },
    { name: 'Fourgon Blindé · Clef de Drogues ×3 · Kétamine', major: false },
    { name: 'Bijouterie (Gros Coup)', major: true },
  ],
  Mercredi: [
    { name: 'Supérette ×2 · ATM ×2 · Maison ×2', major: false },
    { name: 'Fourgon Blindé · Clef de Drogues ×3 · Kétamine', major: false },
    { name: 'Banque de Paleto (Gros Coup)', major: true },
  ],
  Jeudi: [
    { name: 'Supérette ×2 · ATM ×2 · Maison ×2', major: false },
    { name: 'Fourgon Blindé · Clef de Drogues ×3 · Kétamine', major: false },
    { name: 'Pacific Bank (Gros Coup)', major: true },
  ],
  Vendredi: [
    { name: 'Supérette ×2 · ATM ×2 · Maison ×2 (Fin quota)', major: false },
    { name: 'Fourgon Blindé · Clef de Drogues ×3 · Kétamine', major: false },
    { name: 'Amunation (Gros Coup)', major: true },
    { name: 'Train #1 (Gros Coup)', major: true },
    { name: 'Bobcat #1 (Gros Coup)', major: true },
  ],
  Samedi: [
    { name: 'Fourgon Blindé · Clef de Drogues ×3 · Kétamine', major: false },
    { name: 'FBI (Gros Coup)', major: true },
    { name: 'Yacht #1 (Gros Coup)', major: true },
    { name: 'Train #2 (Gros Coup)', major: true },
  ],
  Dimanche: [
    { name: 'Fourgon Blindé · Clef de Drogues ×3 · Kétamine (Fin quota)', major: false },
    { name: 'Union Depository (Gros Coup)', major: true },
    { name: 'Yacht #2 (Gros Coup)', major: true },
    { name: 'Bobcat #2 (Gros Coup)', major: true },
    { name: 'Revente des Butins & Clôture des Paies', major: true },
  ],
};

function validateDiscordWebhookUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 300) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:') return null;
  if (parsed.hostname !== 'discord.com' && parsed.hostname !== 'discordapp.com') {
    return null;
  }
  if (parsed.port !== '' || parsed.username !== '' || parsed.password !== '') {
    return null;
  }
  if (!DISCORD_WEBHOOK_PATH_REGEX.test(parsed.pathname)) {
    return null;
  }

  return `https://${parsed.hostname}${parsed.pathname}?wait=true`;
}

function timingSafeBearerMatch(authHeader: string | undefined, expectedSecret: string): boolean {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice('Bearer '.length).trim();
  const a = Buffer.from(token, 'utf8');
  const b = Buffer.from(expectedSecret, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function getParisDayInfo(now: Date): {
  dayName: string;
  dateLabel: string;
  dayNumber: number;
  isSunday: boolean;
} {
  const formatter = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const dateLabel = formatter.format(now);
  const weekdayRaw = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    weekday: 'long',
  })
    .format(now)
    .toLowerCase();

  const map: Record<string, string> = {
    lundi: 'Lundi',
    mardi: 'Mardi',
    mercredi: 'Mercredi',
    jeudi: 'Jeudi',
    vendredi: 'Vendredi',
    samedi: 'Samedi',
    dimanche: 'Dimanche',
  };
  const dayName = map[weekdayRaw] || 'Lundi';
  const dayNumber = Math.floor(now.getTime() / 86_400_000);

  return {
    dayName,
    dateLabel: dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1),
    dayNumber,
    isSunday: dayName === 'Dimanche',
  };
}

export default async function handler(
  req: VercelLikeRequest,
  res: VercelLikeResponse
): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée.' });
    return;
  }

  const cronSecret = process.env.CRON_SECRET?.trim() || '';
  const rawAuth = req.headers.authorization || req.headers.Authorization;
  const authHeader = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;
  const vercelCronHeader = req.headers['x-vercel-cron'];

  if (cronSecret) {
    if (!timingSafeBearerMatch(authHeader, cronSecret)) {
      res.status(401).json({ error: 'Accès cron non autorisé.' });
      return;
    }
  } else if (!vercelCronHeader) {
    res.status(401).json({ error: 'En-tête Vercel Cron ou CRON_SECRET requis.' });
    return;
  }

  const canonicalWebhookUrl = validateDiscordWebhookUrl(
    process.env.DISCORD_WEBHOOK_URL || ''
  );
  if (!canonicalWebhookUrl) {
    res.status(400).json({
      error: 'Variable serveur DISCORD_WEBHOOK_URL non configurée.',
    });
    return;
  }

  const baseUrl = (
    process.env.APP_PUBLIC_URL?.trim() || 'https://cerberos1-1-eight.vercel.app'
  ).replace(/\/+$/, '');

  const now = new Date();
  const { dayName, dateLabel, dayNumber, isSunday } = getParisDayInfo(now);
  const scene = DAILY_SCENES[dayNumber % DAILY_SCENES.length];
  const missions = OFFICIAL_DAY_MISSIONS[dayName] || OFFICIAL_DAY_MISSIONS.Lundi;
  const majorCount = missions.filter((m) => m.major).length;

  const programLines = missions
    .map((m) => `${m.major ? '🔥' : '•'} **${m.name}**`)
    .join('\n');

  const briefingText = isSunday
    ? 'Dimanche — Clôture de semaine : préparez la revente des objets du coffre, vérifiez le classement final et déclenchez l’Édition Spéciale Dimanche depuis le tableau de bord.'
    : `${missions.length} opérations au planning (${majorCount} braquage${majorCount > 1 ? 's' : ''} majeur${majorCount > 1 ? 's' : ''}). Vérifiez vos packs, gilets et véhicules blindés au Garage avant le lancement.`;

  const embed = {
    title: isSunday
      ? `🏆 LOS CERBEROS — Briefing Spécial Dimanche (${dateLabel})`
      : `📰 LOS CERBEROS — Briefing Automatique 09h30 (${dateLabel})`,
    description: `**Traicionados por el Estado · Juramentados por la Sangre**\nEnvoi automatique serveur (même site fermé) · [Ouvrir le Tableau de Bord](${baseUrl})`,
    color: isSunday ? 0xe5c886 : 0xc5a15a,
    fields: [
      {
        name: `📅 Programme du jour (${dayName})`,
        value: programLines,
        inline: false,
      },
      {
        name: '🎯 Consignes de l’état-major',
        value: briefingText,
        inline: false,
      },
      {
        name: '📊 Rapport complet & PNG',
        value: `Ouvrez **Gazette Discord** sur [Los Cerberos](${baseUrl}) pour générer la carte PNG détaillée (gains/pertes de la veille, trésorerie, Top 5 opérateurs et paies).`,
        inline: false,
      },
    ],
    image: {
      url: `${baseUrl}${scene.path}`,
    },
    footer: {
      text: `Los Cerberos · Cron 09h30 · Visuel : ${scene.title}`,
    },
    timestamp: now.toISOString(),
  };

  try {
    const discordRes = await fetch(canonicalWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Los Cerberos · Gazette 09h30',
        allowed_mentions: { parse: [] },
        embeds: [embed],
      }),
      redirect: 'error',
    });

    if (!discordRes.ok) {
      res.status(502).json({
        error: `Discord a refusé l’envoi cron (HTTP ${discordRes.status}).`,
      });
      return;
    }

    res.status(200).json({ ok: true, dayName, scene: scene.title });
  } catch (err) {
    console.error('Discord cron-daily error:', err);
    res.status(500).json({ error: 'Erreur lors du cron matinal Discord.' });
  }
}
