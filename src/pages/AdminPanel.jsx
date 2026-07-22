const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import PageHeader from "@/components/ui-bits/PageHeader";
import StatCard from "@/components/ui-bits/StatCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, HelpCircle, Library, Inbox, ArrowRight, UserCheck, ScrollText } from "lucide-react";

export default function AdminPanel() {
  const [stats, setStats] = useState({ users: 0, questions: 0, bank: 0, open: 0 });

  useEffect(() => {
    (async () => {
      const [users, questions, bank] = await Promise.all([
        db.entities.User.list("-created_date", 500),
        db.entities.Question.list("-created_date", 500),
        db.entities.BankQuestion.list("-created_date", 500),
      ]);
      setStats({
        users: users.length,
        questions: questions.length,
        bank: bank.length,
        open: questions.filter((q) => ["new", "in_progress", "waiting"].includes(q.status)).length,
      });
    })();
  }, []);

  return (
    <div>
      <PageHeader title="Admin Panel" subtitle="Platform-wide overview and moderation." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Users} label="Users" value={stats.users} />
        <StatCard icon={HelpCircle} label="Questions asked" value={stats.questions} />
        <StatCard icon={Inbox} label="Open requests" value={stats.open} />
        <StatCard icon={Library} label="Bank questions" value={stats.bank} />
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-display text-lg font-semibold mb-2">User management</h3>
          <p className="text-sm text-muted-foreground mb-4">Promote students to tutors, manage roles and tiers.</p>
          <Link to="/admin/users"><Button variant="outline" className="gap-2">Manage users <ArrowRight className="w-4 h-4" /></Button></Link>
        </Card>
        <Card className="p-6">
          <h3 className="font-display text-lg font-semibold mb-2">Question bank</h3>
          <p className="text-sm text-muted-foreground mb-4">Review, moderate and publish curated content.</p>
          <Link to="/bank"><Button variant="outline" className="gap-2">Open bank <ArrowRight className="w-4 h-4" /></Button></Link>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <UserCheck className="w-5 h-5 text-accent" />
            <h3 className="font-display text-lg font-semibold">Creator applications</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Review pending tutor applications and approve or reject.</p>
          <Link to="/admin/applications"><Button variant="outline" className="gap-2">Review applications <ArrowRight className="w-4 h-4" /></Button></Link>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <ScrollText className="w-5 h-5 text-accent" />
            <h3 className="font-display text-lg font-semibold">Audit log</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Track sensitive actions across the platform.</p>
          <Link to="/admin/audit"><Button variant="outline" className="gap-2">View logs <ArrowRight className="w-4 h-4" /></Button></Link>
        </Card>
      </div>
    </div>
  );
}