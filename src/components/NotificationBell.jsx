const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useEffect, useState } from "react";

import { Bell } from "lucide-react";
import { Link } from "react-router-dom";

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);

  const load = () => db.entities.Notification.list("-created_date", 20).then(setNotifications);
  useEffect(() => {
    load();
    const unsub = db.entities.Notification.subscribe(() => load());
    return unsub;
  }, []);

  const unread = notifications.filter((n) => !n.read_at);

  const markAllRead = async () => {
    for (const n of unread) {
      await db.entities.Notification.update(n.id, { read_at: new Date().toISOString() });
    }
    load();
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="relative p-2 rounded-lg hover:bg-secondary transition-colors">
        <Bell className="w-5 h-5 text-muted-foreground" />
        {unread.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-accent text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 bg-card border rounded-xl shadow-lg z-40 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between p-3 border-b sticky top-0 bg-card">
              <p className="font-medium text-sm">Notifications</p>
              {unread.length > 0 && (
                <button onClick={markAllRead} className="text-xs text-accent hover:underline">Mark all read</button>
              )}
            </div>
            {notifications.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">No notifications yet.</p>
            ) : (
              notifications.map((n) => (
                <Link to={n.link || "/requests"} key={n.id} onClick={() => setOpen(false)}
                  className={`block p-3 border-b last:border-0 hover:bg-secondary/50 transition-colors ${!n.read_at ? "bg-accent/5" : ""}`}>
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.message && <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>}
                </Link>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}