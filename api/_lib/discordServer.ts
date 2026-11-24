import fs from 'fs';
import path from 'path';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export interface VercelLikeRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

export interface VercelLikeResponse {
  status: (code: number) => VercelLikeResponse;
  json: (payload: unknown) => void;
  setHeader?: (name: string, value: string) => void;
}

interface FirebaseAppletConfig {
  projectId: string;
}

function loadFirebaseProjectId(): string {
  const envProjectId = process.env.FIREBASE_PROJECT_ID?.trim();
  if (envProjectId) return envProjectId;

  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const raw = fs.readFileSync(configPath, 'utf8');
  const parsed = JSON.parse(raw) as FirebaseAppletConfig;
  return parsed.projectId;
}

function getAdminAuth() {
  const projectId = loadFirebaseProjectId();
  const app = getApps().length > 0 ? getApp() : initializeApp({ projectId });
  return getAuth(app);
}

const DISCORD_WEBHOOK_PATH_REGEX = /^\/api\/webhooks\/(\d+)\/([A-Za-z0-9._-]+)$/;
const MAX_PNG_BYTES = 3 * 1024 * 1024;
const PNG_MAGIC_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function validateDiscordWebhookUrl(rawUrl: string): string | null {
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

export function decodeValidatedPngBase64(rawDataUrl: string): Buffer | null {
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

export interface SanitizedEmbedField {
  name: string;
  value: string;
  inline: boolean;
}

export interface SanitizedEmbedPayload {
  title: string;
  description: string;
  color: number;
  fields: SanitizedEmbedField[];
  footer?: { text: string };
}

export function sanitizeEmbed(raw: unknown): SanitizedEmbedPayload | null {
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

export async function verifyFirebaseBearerToken(
  req: VercelLikeRequest,
  res: VercelLikeResponse
): Promise<string | null> {
  const rawAuth = req.headers.authorization || req.headers.Authorization;
  const authHeader = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentification requise.' });
    return null;
  }

  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken) {
    res.status(401).json({ error: 'Jeton d’authentification manquant.' });
    return null;
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    if (decoded.email_verified !== true) {
      res.status(403).json({ error: 'Adresse e-mail non vérifiée.' });
      return null;
    }
    return decoded.uid;
  } catch {
    res.status(401).json({ error: 'Session expirée ou invalide.' });
    return null;
  }
}
