import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

interface FirebaseAppletConfig {
  projectId: string;
}

function loadFirebaseConfig(): FirebaseAppletConfig {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const raw = fs.readFileSync(configPath, 'utf8');
  return JSON.parse(raw) as FirebaseAppletConfig;
}

const firebaseConfig = loadFirebaseConfig();
const adminApp =
  getApps().length > 0
    ? getApp()
    : initializeApp({ projectId: firebaseConfig.projectId });
const adminAuth = getAuth(adminApp);

const DISCORD_WEBHOOK_PATH_REGEX = /^\/api\/webhooks\/(\d+)\/([A-Za-z0-9._-]+)$/;
const MAX_PNG_BYTES = 3 * 1024 * 1024;
const PNG_MAGIC_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

interface AuthenticatedRequest extends Request {
  authUid?: string;
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

async function requireVerifiedFirebaseUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
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
    const decoded = await adminAuth.verifyIdToken(idToken);
    if (decoded.email_verified !== true) {
      res.status(403).json({ error: 'Adresse e-mail non vérifiée.' });
      return;
    }
    req.authUid = decoded.uid;
    next();
  } catch {
    res.status(401).json({ error: 'Session expirée ou invalide.' });
  }
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
      value: typeof f.value === 'string' ? f.value.trim().slice(0, 500) : '-',
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

async function createApp(): Promise<express.Express> {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '4mb' }));

  app.get(
    '/api/discord/status',
    requireVerifiedFirebaseUser,
    (_req: AuthenticatedRequest, res: Response) => {
      const envFallback = Boolean(
        validateDiscordWebhookUrl(process.env.DISCORD_WEBHOOK_URL || '')
      );
      res.json({ ok: true, hasEnvFallback: envFallback });
    }
  );

  app.post(
    '/api/discord/send-report',
    requireVerifiedFirebaseUser,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const body = (req.body || {}) as Record<string, unknown>;
        const requestedWebhook =
          typeof body.webhookUrl === 'string' ? body.webhookUrl : '';
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
          typeof body.imageBase64 === 'string' ? body.imageBase64 : '';
        const pngBuffer = decodeValidatedPngBase64(rawImage);
        if (!pngBuffer) {
          res.status(400).json({
            error: 'Image PNG invalide ou trop volumineuse (max 3 Mo).',
          });
          return;
        }

        const content =
          typeof body.content === 'string'
            ? body.content.trim().slice(0, 1800)
            : '';

        const rawFilename =
          typeof body.filename === 'string' ? body.filename.trim() : '';
        const safeFilename =
          rawFilename
            .replace(/[^a-zA-Z0-9._-]/g, '')
            .replace(/\.{2,}/g, '.')
            .slice(0, 80) || 'gazette-los-cerberos.png';
        const finalFilename = safeFilename.endsWith('.png')
          ? safeFilename
          : `${safeFilename}.png`;

        const embed = sanitizeEmbed(body.embed);
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

        res.json({ ok: true, messageId });
      } catch {
        res.status(500).json({
          error: 'Erreur serveur lors de la transmission vers Discord.',
        });
      }
    }
  );

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  return app;
}

const PORT = Number(process.env.PORT) || 3000;

void createApp().then((app) => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Los Cerberos server listening on http://0.0.0.0:${PORT}`);
  });
});
