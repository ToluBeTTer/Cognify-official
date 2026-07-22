const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useEffect, useState } from "react";

import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Users, Inbox, Library, TrendingUp, CheckCircle2, XCircle, ArrowUpRight, Star, UploadCloud } from "lucide-react";
import { Link } from "react-router-dom";

export default function AdminDashboard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [bank, setBank] = useState([]);
  const [applications, setApplications] = useState([]);
  const [reviewNotes, setReviewNotes] = useState({});

  const load = async () => {
    const [u, r, b, a] = await Promise.all([
      db.entities.User.list("-created_date", 100),
      db.entities.HelpRequest.list("-created_date", 200),
      db.entities.BankQuestion.list("-created_date", 200),
      db.entities.TutorApplication.list("-created_date", 50),
    ]);
    setUsers(u); setRequests(r); setBank(b); setApplications(a);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const reviewQueue = bank.filter((q) => q.status === "in review" || q.status === "draft");
  const answeredRequests = requests.filter((r) => r.status === "Answered" && !bank.some((b) => b.source_request_id === r.id));
  const pendingApps = applications.filter((a) => a.status === "pending");

  const aiResolved = requests.filter((r) => r.status === "Answered").length;
  const aiEscalated = requests.length;

  const approveQuestion = async (q) => {
    await db.entities.BankQuestion.update(q.id, { status: "published", review_notes: reviewNotes[q.id] || "" });
    toast({ title: "Question published" });
    load();
  };

  const archiveQuestion = async (q) => {
    await db.entities.BankQuestion.update(q.id, { status: "archived", review_notes: reviewNotes[q.id] || "" });
    toast({ title: "Question archived" });
    load();
  };

  const promote = async (req) => {
    const prompt = req.question_text;
    const ai = req.ai_context || "";
    await db.entities.BankQuestion.create({
      prompt,
      correct_answer: "See explanation",
      explanation: (req.tutor_response || ai).slice(0, 2000),
      subject: req.subject === "Math" ? "Math" : req.subject === "Reading" ? "Reading" : "Writing",
      difficulty: req.difficulty,
      question_type: "Word Problem",
      source: "promoted",
      status: "published",
      source_request_id: req.id,
    });
    toast({ title: "Promoted to Question Bank" });
    load();
  };

  const approveApp = async (app) => {
    await db.entities.TutorApplication.update(app.id, { status: "approved" });
    if (app.user_id) {
      await db.entities.User.update(app.user_id, { role: "tutor", subjects: app.subjects, onboarding_status: "onboarded" });
    }
    await db.entities.Notification.create({
      title: "Tutor application approved",
      body: "You're now a Cognify tutor! Visit your Tutor Dashboard to start helping students.",
      type: "application_update",
      link: "/tutor",
    });
    toast({ title: "Application approved — role updated" });
    load();
  };

  const denyApp = async (app) => {
    await db.entities.TutorApplication.update(app.id, { status: "denied" });
    toast({ title: "Application denied" });
    load();
  };

  const changeRole = async (uid, role) => {
    await db.entities.User.update(uid, { role });
    toast({ title: `Role updated to ${role}` });
    load();
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div>
      <PageHeader
        title="Admin Dashboard"
        subtitle="Platform health, content moderation, and team management."
        action={
          <Link to="/import">
            <Button variant="outline"><UploadCloud className="w-4 h-4 mr-1.5" />Bulk Import</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat icon={Users} label="Total Users" value={users.length} />
        <Stat icon={Inbox} label="Total Requests" value={requests.length} />
        <Stat icon={TrendingUp} label="AI Resolution" value={`${aiEscalated ? Math.round((1 - aiResolved / aiEscalated) * 100) : 0}%`} />
        <Stat icon={Library} label="Published Qs" value={bank.filter((b) => b.status === "published").length} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="mb-4 flex flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="moderation">Moderation ({reviewQueue.length})</TabsTrigger>
          <TabsTrigger value="promote">Promote ({answeredRequests.length})</TabsTrigger>
          <TabsTrigger value="applications">Applications ({pendingApps.length})</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-5">
              <h3 className="font-semibold text-slate-900 mb-3">Requests by status</h3>
              {["New", "In Progress", "Waiting", "Answered", "Rejected", "Disputed"].map((s) => (
                <div key={s} className="flex justify-between text-sm py-1.5 border-b border-slate-50 last:border-0">
                  <span className="text-slate-600">{s}</span>
                  <span className="font-medium text-slate-900">{requests.filter((r) => r.status === s).length}</span>
                </div>
              ))}
            </Card>
            <Card className="p-5">
              <h3 className="font-semibold text-slate-900 mb-3">User roles</h3>
              {["admin", "tutor", "user"].map((s) => (
                <div key={s} className="flex justify-between text-sm py-1.5 border-b border-slate-50 last:border-0">
                  <span className="text-slate-600 capitalize">{s}s</span>
                  <span className="font-medium text-slate-900">{users.filter((u) => u.role === s).length}</span>
                </div>
              ))}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="moderation">
          {reviewQueue.length === 0 ? (
            <Card className="p-12 text-center text-slate-400">Nothing in the review queue.</Card>
          ) : (
            <div className="space-y-3">
              {reviewQueue.map((q) => (
                <Card key={q.id} className="p-5">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-xs rounded-full px-2.5 py-0.5 bg-slate-100 text-slate-600">{q.subject}</span>
                    <span className="text-xs rounded-full px-2.5 py-0.5 bg-slate-100 text-slate-600">{q.difficulty}</span>
                    <span className="text-xs rounded-full px-2.5 py-0.5 bg-slate-100 text-slate-600">{q.source}</span>
                    <span className="text-xs rounded-full px-2.5 py-0.5 bg-amber-100 text-amber-700">{q.status}</span>
                  </div>
                  <p className="text-sm text-slate-800 mb-2">{q.prompt}</p>
                  {q.choices?.length > 0 && (
                    <div className="text-xs text-slate-500 mb-2">Answer: {q.correct_answer}</div>
                  )}
                  <Textarea
                    value={reviewNotes[q.id] || ""}
                    onChange={(e) => setReviewNotes((p) => ({ ...p, [q.id]: e.target.value }))}
                    placeholder="Moderator notes…"
                    className="min-h-16 mb-3 text-sm"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => approveQuestion(q)}><CheckCircle2 className="w-4 h-4 mr-1.5" />Approve & publish</Button>
                    <Button size="sm" variant="outline" onClick={() => archiveQuestion(q)}><XCircle className="w-4 h-4 mr-1.5" />Archive</Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="promote">
          <Card className="p-5 mb-3 bg-primary/5 border-primary/20">
            <p className="text-sm text-slate-600">Answered student requests can be promoted into the public Question Bank so future students benefit.</p>
          </Card>
          {answeredRequests.length === 0 ? (
            <Card className="p-12 text-center text-slate-400">No answered requests eligible for promotion.</Card>
          ) : (
            <div className="space-y-3">
              {answeredRequests.map((r) => (
                <Card key={r.id} className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs rounded-full px-2.5 py-0.5 bg-slate-100 text-slate-600">{r.subject}</span>
                        <span className="text-xs rounded-full px-2.5 py-0.5 bg-slate-100 text-slate-600">{r.difficulty}</span>
                      </div>
                      <p className="text-sm text-slate-800">{r.question_text}</p>
                      {r.tutor_response && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{r.tutor_response}</p>}
                      {r.rating && <div className="text-xs text-amber-500 mt-1">{r.rating}★ rated</div>}
                    </div>
                    <Button size="sm" onClick={() => promote(r)} className="shrink-0"><ArrowUpRight className="w-4 h-4 mr-1.5" />Promote</Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="applications">
          {pendingApps.length === 0 ? (
            <Card className="p-12 text-center text-slate-400">No pending applications.</Card>
          ) : (
            <div className="space-y-3">
              {pendingApps.map((a) => (
                <Card key={a.id} className="p-5">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {a.subjects?.map((s) => <span key={s} className="text-xs rounded-full px-2.5 py-0.5 bg-slate-100 text-slate-600">{s}</span>)}
                  </div>
                  <h3 className="font-semibold text-slate-900">{a.applicant_name}</h3>
                  <p className="text-sm text-slate-500">{a.email}</p>
                  {a.experience && <p className="text-sm text-slate-600 mt-2"><span className="font-medium">Experience: </span>{a.experience}</p>}
                  {a.sample_response && <p className="text-sm text-slate-600 mt-1"><span className="font-medium">Sample: </span>{a.sample_response}</p>}
                  <div className="flex gap-2 mt-4">
                    <Button size="sm" onClick={() => approveApp(a)}><CheckCircle2 className="w-4 h-4 mr-1.5" />Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => denyApp(a)}><XCircle className="w-4 h-4 mr-1.5" />Deny</Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="users">
          <Card className="overflow-hidden">
            <div className="divide-y divide-slate-100">
              {users.map((u) => (
                <div key={u.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{u.full_name || u.email}</p>
                    <p className="text-xs text-slate-400 truncate">{u.email}</p>
                  </div>
                  <Select value={u.role} onValueChange={(v) => changeRole(u.id, v)}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Student</SelectItem>
                      <SelectItem value="tutor">Tutor</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <Card className="p-5">
      <Icon className="w-5 h-5 text-primary mb-3" />
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </Card>
  );
}