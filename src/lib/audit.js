const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };


export async function logAudit(action, details, targetType, targetId) {
  try {
    const me = await db.auth.me();
    await db.entities.AuditLog.create({
      action,
      actor_id: me.id,
      actor_name: me.full_name,
      target_type: targetType,
      target_id: targetId,
      details,
    });
  } catch {}
}