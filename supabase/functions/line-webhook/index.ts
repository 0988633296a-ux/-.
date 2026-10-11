import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { validSignature, groupEvent } from './signature.ts';

// One LINE OA bound to this agency; never take the tenant from incoming messages.
const organization = '34d70ab5-3538-4497-8a7e-be35e3888e68';
Deno.serve(async req => {
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  const secret = Deno.env.get('LINE_CHANNEL_SECRET')?.trim();
  if (!secret) return reply({ error: 'Webhook not configured' }, 503);
  if (Number(req.headers.get('content-length')) > 1048576) return reply({ error: 'Body too large' }, 413);
  const body = new Uint8Array(await req.arrayBuffer());
  if (body.length > 1048576) return reply({ error: 'Body too large' }, 413);
  if (!await validSignature(body, req.headers.get('x-line-signature') || '', secret)) return reply({ error: 'Invalid signature' }, 401);
  let payload: any;
  try { payload = JSON.parse(new TextDecoder().decode(body)); } catch { return reply({ error: 'Invalid JSON' }, 400); }
  if (!Array.isArray(payload.events) || payload.events.length > 100) return reply({ error: 'Invalid events' }, 400);
  // LINE's Verify button sends an empty events array.
  if (!payload.events.length) return reply({ ok: true });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    for (const event of payload.events) {
      const candidate = groupEvent(event);
      if (!candidate) continue;
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(event)));
      const fallback = Array.from(new Uint8Array(digest), v => v.toString(16).padStart(2, '0')).join('');
      const id = typeof event.webhookEventId === 'string' && event.webhookEventId.length <= 200 ? event.webhookEventId : fallback;
      const { error } = await db.rpc('record_line_group_event', { p_event_id: id, p_organization: organization, p_group: candidate.groupId, p_event: candidate.action });
      if (error) return reply({ error: 'Event storage unavailable' }, 503);
    }
    return reply({ ok: true });
  } catch { return reply({ error: 'Event storage unavailable' }, 503); }
});
