const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Flame, CheckCircle2, Inbox, ArrowRight, Library, Dumbbell, LineChart, Zap } from "lucide-react";

function StatCard({ icon: Icon, label, value, hint, glowColor = "accent" }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5 group hover:border-accent/30 transition-all duration-200">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-accent/10 border border-accent/20`}>
          <Icon className="w-5 h-5 text-accent" />
        </div>
      </div>
      <div className="text-3xl font-bold font-display text-foreground">{value}</div>
      <div className="text-xs font-medium text-muted-foreground mt-1">{label}</div>
      {hint && <div className="text-[11px] text-muted-foreground/60 mt-0.5">{hint}</div>}
    </div>
  );
}

function QuickLink({ to, icon: Icon, label, description, accent }) {
  return (
    <Link to={to}>
      <div className="group flex items-center gap-4 p-4 rounded-xl border border-border/60 bg-card hover:border-accent/40 hover:bg-accent/5 transition-all duration-200 cursor-pointer">
        <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [greeting, setGreeting] = useState("Welcome back");

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");

    db.auth.me().then(setUser).catch(() => {});
    db.entities.Question.list("-created_date", 50).then(setQuestions).catch(() => {});
    db.entities.PracticeSession.list("-created_date", 50).then(setSessions).catch(() => {});
  }, []);

  const answered = sessions.reduce((a, s) => a + (s.correct_answers || 0), 0);
  const total = sessions.reduce((a, s) => a + (s.total_questions || 0), 0);
  const accuracy = total ? Math.round((answered / total) * 100) : 0;
  const openReqs = questions.filter((q) => ["new", "in_progress", "waiting"].includes(q.status)).length;

  return (
    <div className="space-y-8">
      {/* Hero greeting */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl lg:text-4xl font-semibold text-foreground">
            {greeting}{user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""} 👋
          </h1>
          <p className="text-muted-foreground mt-1.5">Stuck on a question? Milo's ready when you are.</p>
        </div>
        <Link to="/ask">
          <Button size="lg" className="gap-2 bg-accent hover:bg-accent/90 text-white shadow-lg shadow-accent/25 rounded-xl px-6">
            <Sparkles className="w-4 h-4" />
            Ask Milo
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Flame} label="Day streak" value={user?.current_streak ?? 0} hint={`Best: ${user?.best_streak ?? 0} days`} />
        <StatCard icon={CheckCircle2} label="Accuracy" value={`${accuracy}%`} hint={`${total} questions`} />
        <StatCard icon={Inbox} label="Open requests" value={openReqs} hint="Awaiting tutor" />
        <StatCard icon={Library} label="Questions asked" value={questions.length} hint="All time" />
      </div>

      {/* Content grid */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Recent questions */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Recent questions</h2>
            <Link to="/requests" className="text-xs text-accent hover:text-accent/80 flex items-center gap-1 transition-colors">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {questions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-card p-10 text-center">
              <Sparkles className="w-8 h-8 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No questions yet — ask Milo your first one.</p>
              <Link to="/ask"><Button variant="outline" size="sm" className="mt-4 rounded-xl">Ask now</Button></Link>
            </div>
          ) : (
            <div className="space-y-2">
              {questions.slice(0, 5).map((q) => (
                <Link to="/requests" key={q.id}>
                  <div className="flex items-center gap-3 p-4 rounded-xl border border-border/60 bg-card hover:border-accent/30 hover:bg-accent/5 transition-all duration-150 group">
                    <div className="w-2 h-2 rounded-full bg-accent/60 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground line-clamp-1">{q.text || "Image question"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {q.subject} · <span className="capitalize">{q.status?.replace(/_/g, " ")}</span>
                      </p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-accent transition-colors shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="font-semibold text-foreground">Quick actions</h2>
          <div className="space-y-2">
            <QuickLink to="/study" icon={Dumbbell} label="Study Hub" description="Timed, adaptive & streak modes" />
            <QuickLink to="/bank" icon={Library} label="Question Bank" description="Browse SAT practice questions" />
            <QuickLink to="/progress" icon={LineChart} label="Progress" description="Track your improvement" />
            <QuickLink to="/ask" icon={Zap} label="Ask Milo AI" description="Instant explanations, any question" />
          </div>
        </div>
      </div>
    </div>
  );
}