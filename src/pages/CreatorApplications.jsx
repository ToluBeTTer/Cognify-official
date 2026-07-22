const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useEffect, useState } from "react";

import PageHeader from "@/components/ui-bits/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { logAudit } from "@/lib/audit";
import { Check, X, Loader2, Sparkles, Brain, TrendingUp, AlertTriangle } from "lucide-react";
import { analyzeCreatorApplication } from "@/lib/adminAI";

export default function CreatorApplications() {
  const [apps, setApps] = useState([]);
  const [busy, setBusy] = useState(null);
  const [analyzing, setAnalyzing] = useState(null);
  const [analysis, setAnalysis] = useState({});

  const load = () => db.entities.CreatorApplication.filter({ status: "pending" }, "-created_date", 100).then(setApps);
  useEffect(() => { load(); }, []);

  const runAIAnalysis = async (app) => {
    setAnalyzing(app.id);
    try {
      const [attempts, questions] = await Promise.all([
        db.entities.PracticeAttempt.list("-created_date", 100).then(r => r.filter(a => a.created_by_id === app.user_id)),
        db.entities.Question.list("-created_date", 100).then(r => r.filter(q => q.created_by_id === app.user_id)),
      ]);
      const result = await analyzeCreatorApplication(app, { practiceAttempts: attempts, questions });
      setAnalysis({ ...analysis, [app.id]: result });
    } catch {
      setAnalysis({ ...analysis, [app.id]: { recommendation: "review_manually", reasoning: "AI analysis failed. Please review manually." } });
    } finally {
      setAnalyzing(null);
    }
  };

  const decide = async (app, approve) => {
    setBusy(app.id);
    await db.entities.CreatorApplication.update(app.id, { status: approve ? "approved" : "rejected" });
    if (approve) {
      const users = await db.entities.User.filter({ id: app.user_id });
      if (users[0]) await db.entities.User.update(users[0].id, { role: "creator" });
      await db.entities.Notification.create({
        user_id: app.user_id, title: "Creator application approved!",
        message: "You can now access the Tutor Queue.", type: "system",
      });
    } else {
      await db.entities.Notification.create({
        user_id: app.user_id, title: "Creator application update",
        message: "Your application was not approved at this time.", type: "response_rejected",
      });
    }
    await logAudit(approve ? "creator_approved" : "creator_rejected", `Application from ${app.full_name}`, "CreatorApplication", app.id);
    setBusy(null); load();
  };

  return (
    <div>
      <PageHeader title="Creator Applications" subtitle="Review applications. Use AI to analyze applicant profiles and get recommendations." />
      {apps.length === 0 && (
        <Card className="p-12 text-center text-muted-foreground">No pending applications.</Card>
      )}
      <div className="space-y-4">
        {apps.map((app) => (
          <Card key={app.id} className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{app.full_name}</p>
                <p className="text-sm text-muted-foreground">{app.email}</p>
                <div className="mt-3 text-sm space-y-1">
                  <p><span className="text-muted-foreground">Subjects:</span> {app.subjects}</p>
                  {app.experience && <p><span className="text-muted-foreground">Experience:</span> {app.experience}</p>}
                </div>

                {/* AI Analysis */}
                {analysis[app.id] && (
                  <div className="mt-4 rounded-xl border p-4 bg-accent/5 border-accent/20 space-y-2">
                    <div className="flex items-center gap-2">
                      <Brain className="w-4 h-4 text-accent" />
                      <span className="text-xs font-semibold uppercase tracking-widest text-accent">AI Analysis</span>
                      <Badge className={`ml-auto ${
                        analysis[app.id].recommendation === "approve" ? "bg-emerald-500 text-white" :
                        analysis[app.id].recommendation === "reject" ? "bg-destructive text-white" :
                        "bg-amber-500 text-white"
                      }`}>
                        {analysis[app.id].recommendation === "approve" ? "Recommend: Approve" :
                         analysis[app.id].recommendation === "reject" ? "Recommend: Reject" :
                         "Review Manually"}
                      </Badge>
                    </div>
                    <p className="text-sm">{analysis[app.id].reasoning}</p>
                    {analysis[app.id].strengths && (
                      <div className="flex items-start gap-1.5 text-sm">
                        <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span><span className="font-medium">Strengths:</span> {analysis[app.id].strengths}</span>
                      </div>
                    )}
                    {analysis[app.id].concerns && (
                      <div className="flex items-start gap-1.5 text-sm">
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <span><span className="font-medium">Concerns:</span> {analysis[app.id].concerns}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <Button size="sm" variant="outline" disabled={analyzing === app.id || busy === app.id} onClick={() => runAIAnalysis(app)} className="gap-1.5">
                  {analyzing === app.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-accent" />}
                  {analysis[app.id] ? "Re-analyze" : "AI Analyze"}
                </Button>
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy === app.id} onClick={() => decide(app, true)} className="gap-1">
                    {busy === app.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Approve
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy === app.id} onClick={() => decide(app, false)} className="gap-1">
                    <X className="w-4 h-4" /> Reject
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}