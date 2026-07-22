const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useEffect, useState } from "react";

import PageHeader from "@/components/ui-bits/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import moment from "moment";

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  useEffect(() => { db.entities.AuditLog.list("-created_date", 200).then(setLogs); }, []);

  return (
    <div>
      <PageHeader title="Audit Log" subtitle="Platform activity and sensitive actions." />
      <Card className="divide-y">
        {logs.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No activity logged yet.</p>}
        {logs.map((log) => (
          <div key={log.id} className="p-4 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="capitalize">{log.action?.replace(/_/g, " ")}</Badge>
                <span className="text-xs text-muted-foreground">{moment(log.created_date).fromNow()}</span>
              </div>
              <p className="text-sm mt-1">{log.details}</p>
              {log.actor_name && <p className="text-xs text-muted-foreground mt-0.5">by {log.actor_name}</p>}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}