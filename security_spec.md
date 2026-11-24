# Security Specification — Los Cerberos Firestore

## 1. Data Invariants
1. **Master Gate & Membership**: All reads and writes to `/cartels/{cartelId}/state/{stateId}` (`missions`, `inventory`, `treasury`, `hierarchy`, `catalog`, `album`, `history`) and `/cartels/{cartelId}/albumMedia/{photoId}` require a verified authenticated user (`request.auth.token.email_verified == true`) who is either a bootstrapped admin (`s.voirin63@gmail.com` / `/admins/{uid}`) or has an existing membership record at `/cartels/{cartelId}/members/{uid}`.
2. **Editor Authorization**: All writes to `/cartels/{cartelId}/state/{stateId}` and create/delete on `/cartels/{cartelId}/albumMedia/{photoId}` require either `isAdmin()` or a member document with `role == 'editor'`.
3. **Secret Code & Discord Webhook Protection**: `/cartels/{cartelId}/private/auth` holds the `secretCode` and `/cartels/{cartelId}/private/discord` holds the Discord `webhookUrl` & auto-dispatch settings. Neither document can ever be read by `viewer` users or listed (`allow list: if false`). Discord webhook URLs are strictly validated against `https://discord.com/api/webhooks/...` or `https://discordapp.com/api/webhooks/...`. Upgrading a member's `role` from `'viewer'` to `'editor'` is rejected unless `incoming().accessCode == get(.../private/auth).data.secretCode` (or `isAdmin()`).
4. **No Blanket List Queries**: All `allow list` rules are explicitly `false` — clients subscribe only to known singleton document paths via `onSnapshot(doc(...))` and fetch `albumMedia/{photoId}` documents directly by ID.
5. **PII Isolation**: Member documents store only `uid`, `displayName`, `role`, `accessCode`, `joinedAt`, `updatedAt` (no emails, phones, or addresses) and can only be read by `request.auth.uid == memberId || isAdmin()`.
6. **Temporal & Identity Integrity**: Every write enforces `updatedAt == request.time`, `updatedBy == request.auth.uid` (or `createdBy == request.auth.uid` / `uid == request.auth.uid`), and `createdAt`/`joinedAt` immutability on updates.

## 2. "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. Unauthenticated read of `/cartels/los_cerberos/state/missions` or `/cartels/los_cerberos/state/album`.
2. Unverified email user attempting to create `/cartels/los_cerberos/members/{uid}`.
3. Viewer user attempting to directly update `/cartels/los_cerberos/state/album` or upload/delete `/cartels/los_cerberos/albumMedia/{photoId}`.
4. Viewer user attempting to self-escalate to `role: 'editor'` with an invalid `accessCode: 'WRONG'`.
5. Viewer user attempting to read `/cartels/los_cerberos/private/auth` to steal `secretCode` or `/cartels/los_cerberos/private/discord` to steal the Discord webhook URL.
6. User attempting a `list` query on `/cartels/los_cerberos/members`, `/cartels/los_cerberos/state`, `/cartels/los_cerberos/private`, or `/cartels/los_cerberos/albumMedia`.
7. Editor attempting to inject a shadow field (`isAdmin: true`) into `/cartels/los_cerberos/state/treasury`, `/cartels/los_cerberos/private/discord`, or `/cartels/los_cerberos/albumMedia/{photoId}`.
8. Editor attempting to spoof `updatedBy: 'another_uid'` on `/cartels/los_cerberos/state/album` or `createdBy: 'another_uid'` on `/cartels/los_cerberos/albumMedia/{photoId}`.
9. Editor attempting to inject a fake client timestamp (`updatedAt: '2020-01-01'`) instead of `request.time`.
10. Member attempting to overwrite another user's `/cartels/los_cerberos/members/{otherUid}` document.
11. User attempting to inject a non-Discord URL (`http://169.254.169.254/latest` or `https://evil.com/hook`) into `/cartels/los_cerberos/private/discord.webhookUrl` or a 1MB junk string into `cartelId`, `displayName`, or `albumMedia.imageUrl` (> 700,000 chars).
12. Editor attempting to set out-of-range `sendHour: 99`, negative `legal: -500` or `weaponsLossAmount: -100` in `/cartels/los_cerberos/state/treasury`, >100 photos in `/cartels/los_cerberos/state/album`, or >150 entries in `favorites`.
