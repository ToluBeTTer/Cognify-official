const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useEffect, useState } from "react";

import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { Loader2, Target, Flame, TrendingUp, GraduationCap } from "lucide-react";

export default function ProgressPage() {
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    db.entities.PracticeAttempt.list("-created_date", 500).then(setAttempts).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const total = attempts.length;
  const correct = attempts.filter((a) => a.correct).length;
  const accuracy = total ? Math.round((correct / total) * 100) : 0;

  // accuracy by subject
  const bySubject = {};
  attempts.forEach((a) => {
    const s = a.subject || "Other";
    bySubject[s] = bySubject[s] || { total: 0, correct: 0 };
    bySubject[s].total++;
    if (a.correct) bySubject[s].correct++;
  });
  const chartData = Object.keys(bySubject).map((s) => ({
    subject: s,
    accuracy: Math.round((bySubject[s].correct / bySubject[s].total) * 100),
  }));

  const weakest = [...chartData].sort((a, b) => a.accuracy - b.accuracy)[0];
  // Predicted score: 400-1600 scaled by difficulty-weighted accuracy (PRD §6.6)
  const diffWeight = { Easy: 0.7, Medium: 1.0, Hard: 1.3, Expert: 1.6, Challenge: 2.0 };
  const weightedCorrect = attempts.reduce((s, a) => s + (a.correct ? (diffWeight[a.difficulty] || 1) : 0), 0);
  const weightedTotal = attempts.reduce((s, a) => s + (diffWeight[a.difficulty] || 1), 0);
  const weightedAcc = weightedTotal ? weightedCorrect / weightedTotal : 0;
  const predicted = total ? Math.round(400 + weightedAcc * 1200) : "—";

  const bestStreak = (() => {
    const ordered = [...attempts].reverse();
    let best = 0, cur = 0;
    for (const a of ordered) { if (a.correct) { cur++; best = Math.max(best, cur); } else cur = 0; }
    return best;
  })();

  const stats = [
    { label: "Questions Answered", value: total, icon: Target },
    { label: "Overall Accuracy", value: `${accuracy}%`, icon: TrendingUp },
    { label: "Best Streak", value: bestStreak, icon: Flame },
    { label: "Predicted SAT", value: predicted, icon: GraduationCap },
  ];

  return (
    <div>
      <PageHeader title="Progress" subtitle="Track your accuracy, streaks, and where to focus next." />

      {total === 0 ? (
        <Card className="p-12 text-center text-slate-400">Complete a practice session to see your stats here.</Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {stats.map((s) => (
              <Card key={s.label} className="p-5">
                <s.icon className="w-5 h-5 text-primary mb-3" />
                <div className="text-2xl font-bold text-slate-900">{s.value}</div>
                <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
              </Card>
            ))}
          </div>

          <Card className="p-6 mb-6">
            <h3 className="font-semibold text-slate-900 mb-1">Accuracy by subject</h3>
            <p className="text-xs text-slate-400 mb-5">Where you're strong, and where to focus.</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData}>
                <XAxis dataKey="subject" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip cursor={{ fill: "#f1f5f9" }} formatter={(v) => [`${v}%`, "Accuracy"]} />
                <Bar dataKey="accuracy" radius={[6, 6, 0, 0]}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={d.accuracy < 60 ? "#f59e0b" : "#1e293b"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {weakest && weakest.accuracy < 80 && (
            <Card className="p-5 bg-amber-50 border-amber-200">
              <div className="flex items-center gap-2 text-amber-800">
                <Target className="w-5 h-5" />
                <span className="text-sm">
                  Your weakest area is <strong>{weakest.subject}</strong> ({weakest.accuracy}%).
                  Try <strong>Weakness Mode</strong> in the Study Hub to focus there.
                </span>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}