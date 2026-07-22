const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useEffect, useState } from "react";

import PageHeader from "@/components/ui-bits/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const load = () => db.entities.User.list("-created_date", 500).then(setUsers);
  useEffect(() => { load(); }, []);

  const setRole = async (u, role) => { await db.entities.User.update(u.id, { role }); load(); };
  const setTier = async (u, tier) => { await db.entities.User.update(u.id, { tier }); load(); };

  return (
    <div>
      <PageHeader title="Users" subtitle="Manage roles and subscription tiers." />
      <Card className="divide-y">
        {users.map((u) => (
          <div key={u.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold shrink-0">
              {(u.full_name || u.email || "U").charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{u.full_name || "—"}</p>
              <p className="text-xs text-muted-foreground truncate">{u.email}</p>
            </div>
            <Badge variant="outline" className="capitalize w-fit">{u.role}</Badge>
            <Select value={u.role} onValueChange={(v) => setRole(u, v)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="creator">Creator</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Select value={u.tier || "free"} onValueChange={(v) => setTier(u, v)}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="plus">Plus</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ))}
      </Card>
    </div>
  );
}