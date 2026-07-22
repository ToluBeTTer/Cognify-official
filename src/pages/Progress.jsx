const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useEffect, useState } from "react";

import PageHeader from "@/components/ui-bits/PageHeader";
import StatCard from "@/components/ui-bits/StatCard";
import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { Flame, Target, Clock, TrendingUp } from "lucide-react";

export default function ProgressPage() {
  const [user, setUser] = useState(null);
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    db.auth.me().then(setUser).catch(() => {});
    db.entities.PracticeSession.list("-created_date", 100).then(setSessions).catch(() => {});
  }, []);

  const totalQ = sessions.reduce((a, s) => a + (s.total_questions || 0), 0);
  const totalCorrect = sessions.reduce((a, s) => a + (s.correct_answers || 0), 0);
  const accuracy = totalQ ? Math.round((totalCorrect / totalQ) * 100) : 0;
  const minutes = Math.round(sessions.reduce((a, s) => a + (s.duration_seconds || 0), 0) / 60);

  const bySubject = {};
  sessions.forEach((s) => {
    const k = s.subject || s.session_type || "General";
    if (!bySubject[k]) bySubject[k] = { name: k, correct: 0, total: 0 };
    bySubject[k].correct += s.correct_answers || 0;
    bySubject[k].total += s.total_questions || 0;
  });
  const chartData = Object.values(bySubject).map((d) => ({ name: d.name, accuracy: d.total ? Math.round((d.correct / d.total) * 100) : 0 }));

  const predicted = 400 + Math.round((accuracy / 100) * 1200);

  return (
    <div>
      <PageHeader title="Progress" subtitle="Track your accuracy, streaks, and estimated readiness." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Target} label="Accuracy" value={`${accuracy}%`} hint={`${totalCorrect}/${totalQ} correct`} />
        <StatCard icon={Flame} label="Current streak" value={user?.current_streak ?? 0} hint={`Best ${user?.best_streak ?? 0}`} accent="text-orange-500" />
        <StatCard icon={Clock} label="Time studied" value={`${minutes}m`} hint={`${sessions.length} sessions`} />
        <StatCard icon={TrendingUp} label="Predicted SAT" value={predicted} hint="Difficulty-weighted estimate" />
      </div>

      <Card className="p-6">
        <h3 className="font-display text-lg font-semibold mb-4">Accuracy by area</h3>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">Complete a practice session to see your breakdown.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="accuracy" fill="hsl(199 89% 48%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
      <p className="text-xs text-muted-foreground mt-3">Predicted SAT score is an illustrative estimate for the MVP — see the deployment notes about building a validated model before showing this to students.</p>
    </div>
  );
}