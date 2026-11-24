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

const SEVERITY_COLOR: Record<string, number> = {
  critical: 0xdc2626,
  warning: 0xd97706,
  info: 0xc5a15a,
  success: 0x10b981,
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
    const body = await readJsonBody(req);
    const requestedWebhook =
      typeof body.webhookUrl === 'string' ? body.webhookUrl : '';
    const envWebhook = process.env.DISCORD_WEBHOOK_URL || '';
    const canonicalWebhookUrl = validateDiscordWebhookUrl(
      requestedWebhook.trim() || envWebhook.trim()
    );

    if (!canonicalWebhookUrl) {
      res.status(400).json({
        error:
          'URL de Webhook Discord invalide ou absente. Configurez-la dans Gazette Discord.',
      });
      return;
    }

    const title =
      typeof body.title === 'string' ? body.title.trim().slice(0, 180) : '';
    const description =
      typeof body.description === 'string'
        ? body.description.trim().slice(0, 1600)
        : '';
    if (!title && !description) {
      res.status(400).json({ error: 'Contenu d’alerte vide.' });
      return;
    }

    const severity =
      typeof body.severity === 'string' && body.severity in SEVERITY_COLOR
        ? body.severity
        : 'warning';

    const rawFields = Array.isArray(body.fields) ? body.fields : [];
    const fields = rawFields
      .slice(0, 8)
      .filter((f): f is Record<string, unknown> => Boolean(f) && typeof f === 'object')
      .map((f) => ({
        name: typeof f.name === 'string' ? f.name.trim().slice(0, 120) : '-',
        value: typeof f.value === 'string' ? f.value.trim().slice(0, 950) : '-',
        inline: Boolean(f.inline),
      }))
      .filter((f) => f.name.length > 0 && f.value.length > 0);

    const footerText =
      typeof body.footer === 'string' && body.footer.trim()
        ? body.footer.trim().slice(0, 140)
        : 'Los Cerberos · Alerte Instantanée';

    const payload = {
      username: 'Los Cerberos · Alertes',
      allowed_mentions: { parse: [] },
      embeds: [
        {
          title: title || 'Alerte Cartel — Los Cerberos',
          description,
          color: SEVERITY_COLOR[severity],
          fields,
          footer: { text: footerText },
          timestamp: new Date().toISOString(),
        },
      ],
    };

    const discordRes = await fetch(canonicalWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'error',
    });

    if (!discordRes.ok) {
      res.status(502).json({
        error: `Discord a refusé l’alerte (HTTP ${discordRes.status}).`,
      });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Discord send-alert error:', err);
    res.status(500).json({
      error: 'Erreur serveur lors de l’envoi de l’alerte Discord.',
    });
  }
}
