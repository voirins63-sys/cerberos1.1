import {
  type VercelLikeRequest,
  type VercelLikeResponse,
  validateDiscordWebhookUrl,
  verifyFirebaseBearerToken,
} from '../_lib/discordServer';

export default async function handler(
  req: VercelLikeRequest,
  res: VercelLikeResponse
): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Méthode non autorisée.' });
    return;
  }

  const uid = await verifyFirebaseBearerToken(req, res);
  if (!uid) return;

  const envFallback = Boolean(
    validateDiscordWebhookUrl(process.env.DISCORD_WEBHOOK_URL || '')
  );
  res.status(200).json({ ok: true, hasEnvFallback: envFallback });
}
