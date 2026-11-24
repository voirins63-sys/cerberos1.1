import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

interface VercelLikeRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
}

interface VercelLikeResponse {
  status: (code: number) => VercelLikeResponse;
  json: (payload: unknown) => void;
}

const DEFAULT_FIREBASE_PROJECT_ID = 'rugged-habitat-x91ww';
const DISCORD_WEBHOOK_PATH_REGEX = /^\/api\/webhooks\/(\d+)\/([A-Za-z0-9._-]+)$/;

function getAdminAuth() {
  const projectId =
    process.env.FIREBASE_PROJECT_ID?.trim() || DEFAULT_FIREBASE_PROJECT_ID;
  const app = getApps().length > 0 ? getApp() : initializeApp({ projectId });
  return getAuth(app);
}

function isValidDiscordWebhookUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 300) return false;
  try {
    const parsed = new URL(trimmed);
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname === 'discord.com' || parsed.hostname === 'discordapp.com') &&
      parsed.port === '' &&
      parsed.username === '' &&
      parsed.password === '' &&
      DISCORD_WEBHOOK_PATH_REGEX.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}

export default async function handler(
  req: VercelLikeRequest,
  res: VercelLikeResponse
): Promise<void> {
  if (req.method !== 'GET') {
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

  const envFallback = isValidDiscordWebhookUrl(process.env.DISCORD_WEBHOOK_URL || '');
  res.status(200).json({ ok: true, hasEnvFallback: envFallback });
}
