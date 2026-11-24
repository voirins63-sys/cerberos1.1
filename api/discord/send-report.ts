import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

interface VercelLikeRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  [Symbol.asyncIterator]?: () => AsyncIterator<Buffer | string>;
}

interface VercelLikeResponse {
  status: (code: number) => VercelLikeResponse;
  json: (payload: unknown) => void;
}

const DEFAULT_FIREBASE_PROJECT_ID = 'rugged-habitat-x91ww';
const DISCORD_WEBHOOK_PATH_REGEX = /^\/api\/webhooks\/(\d+)\/([A-Za-z0-9._-]+)$/;
const MAX_PNG_BYTES = 3 * 1024 * 1024;
const PNG_MAGIC_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
};

function getAdminAuth() {
  const projectId =
    process.env.FIREBASE_PROJECT_ID?.trim() || DEFAULT_FIREBASE_PROJECT_ID;
  const app = getApps().length > 0 ? getApp() : initializeApp({ projectId });
  return getAuth(app);
}

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

function decodeValidatedPngBase64(rawDataUrl: string): Buffer | null {
  const trimmed = rawDataUrl.trim();
  const base64Part = trimmed.startsWith('data:image/png;base64,')
    ? trimmed.slice('data:image/png;base64,'.length)
    : '';

  if (!base64Part || base64Part.length > 4_400_000) {
    return null;
  }

  const buffer = Buffer.from(base64Part, 'base64');
  if (buffer.length < 16 || buffer.length > MAX_PNG_BYTES) {
    return null;
  }

  for (let i = 0; i < PNG_MAGIC_BYTES.length; i++) {
    if (buffer[i] !== PNG_MAGIC_BYTES[i]) {
      return null;
    }
  }

  return buffer;
}

interface SanitizedEmbedField {
  name: string;
  value: string;
  inline: boolean;
}

interface SanitizedEmbedPayload {
  title: string;
  description: string;
  color: number;
  fields: SanitizedEmbedField[];
  footer?: { text: string };
}

function sanitizeEmbed(raw: unknown): SanitizedEmbedPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const title = typeof obj.title === 'string' ? obj.title.trim().slice(0, 200) : '';
  const description =
    typeof obj.description === 'string' ? obj.description.trim().slice(0, 1500) : '';
  const color =
    typeof obj.color === 'number' && Number.isFinite(obj.color)
      ? Math.max(0, Math.min(0xffffff, Math.trunc(obj.color)))
      : 0xc5a15a;

  const rawFields = Array.isArray(obj.fields) ? obj.fields : [];
  const fields: SanitizedEmbedField[] = rawFields
    .slice(0, 10)
    .filter((f): f is Record<string, unknown> => Boolean(f) && typeof f === 'object')
    .map((f) => ({
      name: typeof f.name === 'string' ? f.name.trim().slice(0, 120) : '-',
      value: typeof f.value === 'string' ? f.value.trim().slice(0, 950) : '-',
      inline: Boolean(f.inline),
    }))
    .filter((f) => f.name.length > 0 && f.value.length > 0);

  const footerText =
    obj.footer &&
    typeof obj.footer === 'object' &&
    typeof (obj.footer as { text?: unknown }).text === 'string'
      ? (obj.footer as { text: string }).text.trim().slice(0, 150)
      : '';

  if (!title && !description && fields.length === 0) return null;

  return {
    title,
    description,
    color,
    fields,
    ...(footerText ? { footer: { text: footerText } } : {}),
  };
}

async function readJsonBody(req: VercelLikeRequest): Promise<Record<string, unknown>> {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      return JSON.parse(req.body) as Record<string, unknown>;
    }
    if (Buffer.isBuffer(req.body)) {
      return JSON.parse(req.body.toString('utf8')) as Record<string, unknown>;
    }
    if (typeof req.body === 'object') {
      return req.body as Record<string, unknown>;
    }
  }

  if (typeof req[Symbol.asyncIterator] === 'function') {
    const chunks: Buffer[] = [];
    for await (const chunk of req as AsyncIterable<Buffer | string>) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk);
    }
    const raw = Buffer.concat(chunks).toString('utf8').trim();
    if (raw) {
      return JSON.parse(raw) as Record<string, unknown>;
    }
  }

  return {};
}

export default async function handler(
  req: VercelLikeRequest,
  res: VercelLikeResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée.' });
    return;
  }

  const rawAuth = req.headers.authorization || req.headers.Authorization;
  const authHeader = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentification requise.' });
    return;
  }

  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken) {
    res.status(401).json({ error: 'Jeton d’authentification manquant.' });
    return;
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    if (decoded.email_verified !== true) {
      res.status(403).json({ error: 'Adresse e-mail non vérifiée.' });
      return;
    }
  } catch {
    res.status(401).json({ error: 'Session expirée ou invalide.' });
    return;
  }

  try {
    const rawBody = await readJsonBody(req);

    const requestedWebhook =
      typeof rawBody.webhookUrl === 'string' ? rawBody.webhookUrl : '';
    const envWebhook = process.env.DISCORD_WEBHOOK_URL || '';
    const candidateUrl = requestedWebhook.trim() || envWebhook.trim();

    const canonicalWebhookUrl = validateDiscordWebhookUrl(candidateUrl);
    if (!canonicalWebhookUrl) {
      res.status(400).json({
        error:
          'URL de Webhook Discord invalide. Format attendu : https://discord.com/api/webhooks/...',
      });
      return;
    }

    const rawImage =
      typeof rawBody.imageBase64 === 'string' ? rawBody.imageBase64 : '';
    const pngBuffer = decodeValidatedPngBase64(rawImage);
    if (!pngBuffer) {
      res.status(400).json({
        error: 'Image PNG invalide ou trop volumineuse (max 3 Mo).',
      });
      return;
    }

    const content =
      typeof rawBody.content === 'string'
        ? rawBody.content.trim().slice(0, 1800)
        : '';

    const rawFilename =
      typeof rawBody.filename === 'string' ? rawBody.filename.trim() : '';
    const safeFilename =
      rawFilename
        .replace(/[^a-zA-Z0-9._-]/g, '')
        .replace(/\.{2,}/g, '.')
        .slice(0, 80) || 'gazette-los-cerberos.png';
    const finalFilename = safeFilename.endsWith('.png')
      ? safeFilename
      : `${safeFilename}.png`;

    const embed = sanitizeEmbed(rawBody.embed);
    const embeds = embed
      ? [
          {
            ...embed,
            image: { url: `attachment://${finalFilename}` },
          },
        ]
      : [];

    const discordPayload: Record<string, unknown> = {
      username: 'Los Cerberos · Gazette',
      allowed_mentions: { parse: [] },
    };
    if (content) {
      discordPayload.content = content;
    }
    if (embeds.length > 0) {
      discordPayload.embeds = embeds;
    }

    const formData = new FormData();
    formData.append('payload_json', JSON.stringify(discordPayload));
    formData.append(
      'files[0]',
      new Blob([new Uint8Array(pngBuffer)], { type: 'image/png' }),
      finalFilename
    );

    const discordRes = await fetch(canonicalWebhookUrl, {
      method: 'POST',
      body: formData,
      redirect: 'error',
    });

    if (!discordRes.ok) {
      const status = discordRes.status;
      let detail = `Discord a refusé l'envoi (HTTP ${status}).`;
      if (status === 401 || status === 404) {
        detail =
          'Webhook Discord introuvable ou révoqué. Vérifiez le lien du webhook dans votre salon Discord.';
      } else if (status === 429) {
        detail = 'Limite de débit Discord atteinte. Réessayez dans quelques secondes.';
      }
      res.status(502).json({ error: detail });
      return;
    }

    let messageId: string | null = null;
    try {
      const json = (await discordRes.json()) as { id?: unknown };
      if (typeof json.id === 'string') {
        messageId = json.id;
      }
    } catch {
      // Discord 204 returns empty body
    }

    res.status(200).json({ ok: true, messageId });
  } catch (err) {
    console.error('Discord send-report error:', err);
    res.status(500).json({
      error: 'Erreur serveur lors de la transmission vers Discord.',
    });
  }
}
