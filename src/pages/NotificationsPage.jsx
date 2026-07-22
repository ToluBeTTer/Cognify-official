const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Bell, CheckCheck } from "lucide-react";
import moment from "moment";

const typeIcon = {
  request_claimed: { emoji: "✋", color: "bg-blue-100 text-blue-700" },
  request_answered: { emoji: "✅", color: "bg-emerald-100 text-emerald-700" },
  request_rejected: { emoji: "⚠️", color: "bg-amber-100 text-amber-700" },
  dispute_update: { emoji: "⚖️", color: "bg-orange-100 text-orange-700" },
  application_update: { emoji: "🎓", color: "bg-purple-100 text-purple-700" },
  content_promoted: { emoji: "📚", color: "bg-indigo-100 text-indigo-700" },
  general: { emoji: "🔔", color: "bg-slate-100 text-slate-700" },
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => db.entities.Notification.list("-created_date", 50).then(setNotifs).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const markAllRead = async () => {
    const unread = notifs.filter((n) => !n.read_at);
    await db.entities.Notification.bulkUpdate(unread.map((n) => ({ id: n.id, read_at: new Date().toISOString() })));
    load();
  };

  const open = async (n) => {
    if (!n.read_at) await db.entities.Notification.update(n.id, { read_at: new Date().toISOString() });
    if (n.link) navigate(n.link);
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const unreadCount = notifs.filter((n) => !n.read_at).length;

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up."}
        action={unreadCount > 0 ? (
          <Button variant="outline" size="sm" onClick={markAllRead}><CheckCheck className="w-4 h-4 mr-1.5" />Mark all read</Button>
        ) : null}
      />

      {notifs.length === 0 ? (
        <Card className="p-12 text-center">
          <Bell className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No notifications yet.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifs.map((n) => {
            const ic = typeIcon[n.type] || typeIcon.general;
            return (
              <Card
                key={n.id}
                className={`p-4 flex items-start gap-3 cursor-pointer transition-all hover:shadow-sm ${!n.read_at ? "border-primary/30 bg-primary/5" : ""}`}
                onClick={() => open(n)}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm shrink-0 ${ic.color}`}>{ic.emoji}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">{n.title}</p>
                  <p className="text-sm text-slate-500">{n.body}</p>
                  <p className="text-xs text-slate-400 mt-1">{moment(n.created_date).fromNow()}</p>
                </div>
                {!n.read_at && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}