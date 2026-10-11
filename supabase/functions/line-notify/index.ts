import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { notificationText, acceptedResponse } from './message.ts';
const organization = '34d70ab5-3538-4497-8a7e-be35e3888e68';
Deno.serve(async req => {
  const reply = (data: unknown,status=200) => Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
  if (req.method!=='POST') return reply({error:'Method not allowed'},405);
  const workerKey = req.headers.get('x-line-worker-key');
  if (!workerKey || workerKey.length>200) return reply({error:'Unauthorized'},401);
  const db = createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:authorized,error:authError} = await db.rpc('authorize_line_worker',{p_key:workerKey});
  if (authError || authorized!==true) return reply({error:'Unauthorized'},401);
  const token = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')?.trim();
  if (!token || /\s/.test(token)) return reply({error:'LINE token not configured'},503);
  const {data:jobs,error} = await db.rpc('claim_line_notifications',{p_organization:organization,p_limit:10});
  if (error) return reply({error:'Queue unavailable'},503);
  let sent=0,failed=0;
  for (const job of jobs || []) {
    let success=false,reason='LINE_NETWORK_ERROR',requestId=null;
    try {
      // Recheck approval immediately before sending; leave events disable the connection.
      const {data:connection,error:lookupError} = await db.from('line_group_connections').select('id').eq('organization_id',organization).eq('group_id',job.group_id).eq('enabled',true).eq('available',true).is('deleted_at',null).maybeSingle();
      if (lookupError || !connection) reason='GROUP_DISABLED';
      else {
        const text = notificationText(job.kind,job.incident);
        const response = await fetch('https://api.line.me/v2/bot/message/push',{
          method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','X-Line-Retry-Key':job.retry_key},
          body:JSON.stringify({to:job.group_id,messages:[{type:'text',text}]}),signal:AbortSignal.timeout(8000)
        });
        success=acceptedResponse(response);
        reason=response.status===409&&!success?'RETRY_CONFLICT_UNCONFIRMED':'LINE_HTTP_'+response.status;
        requestId=response.headers.get('x-line-accepted-request-id')||response.headers.get('x-line-request-id');
        await response.body?.cancel();
      }
    } catch (err) { if(err instanceof Error && ['Invalid coordinates','Unsupported notification'].includes(err.message)) reason='LINE_HTTP_400'; }
    const {data:finished,error:finishError} = await db.rpc('finish_line_notification',{p_delivery:job.delivery_id,p_claim:job.claim_token,p_sent:success,p_error:reason,p_request:requestId});
    if(finishError || finished!==true) return reply({error:'Result storage unavailable',sent,failed},503);
    if(success)sent++;else failed++;
  }
  return reply({ok:true,sent,failed});
});
