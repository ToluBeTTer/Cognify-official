const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useEffect, useState } from "react";

import PageHeader from "@/components/ui-bits/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Link } from "react-router-dom";
import { GraduationCap } from "lucide-react";

export default function Settings() {
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  useEffect(() => { db.auth.me().then(setUser).catch(() => {}); }, []);

  const upgrade = async () => {
    await db.auth.updateMe({ tier: user.tier === "plus" ? "free" : "plus" });
    const u = await db.auth.me();
    setUser(u);
    toast({ title: `Now on ${u.tier === "plus" ? "Plus" : "Free"} tier` });
  };

  if (!user) return null;

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your account and plan." />
      <div className="space-y-6 max-w-xl">
        <Card className="p-6">
          <h3 className="font-display text-lg font-semibold mb-4">Account</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span className="font-medium">{user.full_name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="font-medium">{user.email}</span></div>
            <div className="flex justify-between items-center"><span className="text-muted-foreground">Role</span><Badge variant="outline" className="capitalize">{user.role}</Badge></div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-display text-lg font-semibold">Plan</h3>
            <Badge className="capitalize">{user.tier}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            {user.tier === "plus" ? "Unlimited AI help, advanced analytics and priority tutor response." : "Free tier includes daily AI help, basic practice and analytics."}
          </p>
          <Button variant={user.tier === "plus" ? "outline" : "default"} onClick={upgrade}>
            {user.tier === "plus" ? "Switch to Free" : "Upgrade to Plus"}
          </Button>
        </Card>

        {user.role === "student" && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-1">
              <GraduationCap className="w-5 h-5 text-accent" />
              <h3 className="font-display text-lg font-semibold">Become a Tutor</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Apply to join Cognify as a verified content creator and help students with their SAT questions.</p>
            <Link to="/become-creator"><Button variant="outline">Apply now</Button></Link>
          </Card>
        )}
      </div>
    </div>
  );
}