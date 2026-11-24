import {
  decodeValidatedPngBase64,
  sanitizeEmbed,
  type VercelLikeRequest,
  type VercelLikeResponse,
  validateDiscordWebhookUrl,
  verifyFirebaseBearerToken,
} from '../_lib/discordServer';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
};

export default async function handler(
  req: VercelLikeRequest,
  res: VercelLikeResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée.' });
    return;
  }

  const uid = await verifyFirebaseBearerToken(req, res);
  if (!uid) return;

  try {
    const rawBody =
      typeof req.body === 'string'
        ? (JSON.parse(req.body) as Record<string, unknown>)
        : ((req.body || {}) as Record<string, unknown>);

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
  } catch {
    res.status(500).json({
      error: 'Erreur serveur lors de la transmission vers Discord.',
    });
  }
}
