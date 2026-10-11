type Incident = { number: string; type: string; level: string; address: string; lat: number; lng: number; reported_at: string };
export function notificationText(kind: string, incident: Incident): string {
  if (kind === 'line_connection_test') return '✅ เชื่อมต่อระบบแจ้งเหตุ ปภ. ลำห้วยหลัว สำเร็จ\nกลุ่มนี้จะรับแจ้งเตือนเหตุใหม่จากระบบ\nข้อความทดสอบการเชื่อมต่อ ไม่ใช่เหตุจริง';
  if (!['new_incident', 'critical_incident'].includes(kind)) throw new Error('Unsupported notification');
  if (!incident || !Number.isFinite(incident.lat) || !Number.isFinite(incident.lng) || Math.abs(incident.lat)>90 || Math.abs(incident.lng)>180) throw new Error('Invalid coordinates');
  const clean = (value: string, max: number) => String(value || '').replace(/[\r\n\u0000-\u001f]/g, ' ').slice(0,max);
  const time = new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'short',timeStyle:'short'}).format(new Date(incident.reported_at));
  return `${incident.level==='วิกฤต'?'🚨 เหตุวิกฤต':'📣 รับแจ้งเหตุใหม่'} — ปภ. ลำห้วยหลัว\nเลขเหตุ: ${clean(incident.number,80)}\nประเภท: ${clean(incident.type,100)}\nระดับ: ${clean(incident.level,30)}\nสถานที่: ${clean(incident.address,600)}\nรับแจ้ง: ${time}\nแผนที่: https://www.openstreetmap.org/?mlat=${incident.lat}&mlon=${incident.lng}#map=17/${incident.lat}/${incident.lng}`;
}
export function acceptedResponse(response: Response): boolean {
  return response.ok || (response.status===409 && !!response.headers.get('x-line-accepted-request-id'));
}
