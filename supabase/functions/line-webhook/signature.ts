export async function validSignature(body: Uint8Array, signature: string, secret: string): Promise<boolean> {
  try {
    const decoded = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
    if (decoded.length !== 32) return false;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    return await crypto.subtle.verify('HMAC', key, decoded, body);
  } catch { return false; }
}

export function groupEvent(event: any): { groupId: string; action: string } | null {
  if (event?.source?.type !== 'group' || !/^C[0-9a-f]{32}$/i.test(event.source.groupId || '')) return null;
  if (event.type === 'join' || event.type === 'leave') return { groupId: event.source.groupId, action: event.type };
  if (event.type === 'message' && event.message?.type === 'text' && event.message.text?.trim() === 'เชื่อม ปภ.') return { groupId: event.source.groupId, action: 'connect' };
  return null;
}
