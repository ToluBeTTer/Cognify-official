const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useEffect, useState } from "react";

import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Clock, Star, ImagePlus, X, Send, AlertTriangle, CheckCircle2, Inbox } from "lucide-react";

const statusColor = {
  New: "bg-blue-100 text-blue-700",
  "In Progress": "bg-amber-100 text-amber-700",
  Waiting: "bg-purple-100 text-purple-700",
  Answered: "bg-emerald-100 text-emerald-700",
  Rejected: "bg-rose-100 text-rose-700",
  Disputed: "bg-orange-100 text-orange-700",
};

function ageBadge(created) {
  const hours = Math.floor((Date.now() - new Date(created).getTime()) / 36e5);
  if (hours < 1) return { text: "just now", urgent: false };
  if (hours < 24) return { text: `${hours}h old`, urgent: hours > 24 };
  const days = Math.floor(hours / 24);
  return { text: `${days}d old`, urgent: days >= 2 };
}

export default function TutorDashboard() {
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [available, setAvailable] = useState([]);
  const [active, setActive] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(null);
  const [responseText, setResponseText] = useState("");
  const [responseImage, setResponseImage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);

  const load = async () => {
    const me = await db.auth.me();
    setUser(me);
    const all = await db.entities.HelpRequest.list("-created_date", 200);
    setAvailable(all.filter((r) => r.status === "New"));
    setActive(all.filter((r) => ["In Progress", "Waiting", "Disputed"].includes(r.status) && r.tutor_id === me.id));
    setCompleted(all.filter((r) => ["Answered", "Rejected"].includes(r.status) && r.tutor_id === me.id));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const claim = async (req) => {
    await db.entities.HelpRequest.update(req.id, {
      tutor_id: user.id,
      status: "In Progress",
      claimed_date: new Date().toISOString(),
    });
    await db.entities.Notification.create({
      title: "A tutor picked up your question",
      body: `${user.full_name || "A tutor"} is working on your ${req.subject} question.`,
      type: "request_claimed",
      link: "/requests",
    });
    toast({ title: "Request claimed" });
    load();
  };

  const uploadImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await db.integrations.Core.UploadFile({ file });
    setResponseImage(file_url);
    setUploading(false);
  };

  const sendResponse = async () => {
    if (!responseText.trim()) return;
    await db.entities.HelpRequest.update(responding.id, {
      tutor_response: responseText,
      tutor_response_image: responseImage || undefined,
      status: "Answered",
    });
    await db.entities.Notification.create({
      title: "Your question has been answered",
      body: "A tutor responded to your question. Tap to review and rate it.",
      type: "request_answered",
      link: "/requests",
    });
    toast({ title: "Response sent" });
    setResponding(null); setResponseText(""); setResponseImage("");
    load();
  };

  const setWaiting = async (req) => {
    await db.entities.HelpRequest.update(req.id, { status: "Waiting" });
    await db.entities.Notification.create({
      title: "Tutor needs more info",
      body: "Your tutor asked for clarification on your question.",
      type: "request_rejected",
      link: "/requests",
    });
    toast({ title: "Marked as waiting for student" });
    load();
  };

  const reject = async () => {
    await db.entities.HelpRequest.update(responding.id, {
      status: "Rejected",
      rejection_reason: rejectReason,
    });
    await db.entities.Notification.create({
      title: "Request could not be answered",
      body: `Reason: ${rejectReason}. You can refine and resubmit your question.`,
      type: "request_rejected",
      link: "/requests",
    });
    toast({ title: "Request rejected" });
    setShowReject(false); setRejectReason(""); setResponding(null);
    load();
  };

  const avgRating = completed.length
    ? (completed.filter((r) => r.rating).reduce((s, r) => s + r.rating, 0) / completed.filter((r) => r.rating).length).toFixed(1)
    : "—";

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div>
      <PageHeader title="Tutor Dashboard" subtitle="Claim student questions, respond, and track your impact." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Available" value={available.length} />
        <Stat label="Your Active" value={active.length} />
        <Stat label="Answered" value={completed.filter((r) => r.status === "Answered").length} />
        <Stat label="Avg Rating" value={`${avgRating}★`} />
      </div>

      <Tabs defaultValue="queue">
        <TabsList className="mb-4">
          <TabsTrigger value="queue">Available Queue</TabsTrigger>
          <TabsTrigger value="active">My Active ({active.length})</TabsTrigger>
          <TabsTrigger value="done">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="queue">
          {available.length === 0 ? (
            <Card className="p-12 text-center text-slate-400">
              <Inbox className="w-10 h-10 mx-auto mb-3 opacity-40" />
              No requests waiting. Nice work!
            </Card>
          ) : (
            <div className="space-y-3">
              {[...available].sort((a, b) => new Date(a.created_date) - new Date(b.created_date)).map((r) => {
                const age = ageBadge(r.created_date);
                return (
                  <Card key={r.id} className={`p-5 ${age.urgent ? "border-amber-300 bg-amber-50/30" : ""}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="text-xs rounded-full px-2.5 py-0.5 bg-slate-100 text-slate-600">{r.subject}</span>
                          <span className="text-xs rounded-full px-2.5 py-0.5 bg-slate-100 text-slate-600">{r.difficulty}</span>
                          <span className={`text-xs flex items-center gap-1 ${age.urgent ? "text-amber-600" : "text-slate-400"}`}>
                            <Clock className="w-3 h-3" />{age.text}
                          </span>
                        </div>
                        <p className="text-sm text-slate-800">{r.question_text}</p>
                        {r.image_url && <img src={r.image_url} alt="" className="mt-2 rounded-lg max-h-32 border border-slate-200" />}
                        {r.ai_context && (
                          <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
                            <span className="font-medium text-slate-600">Milo's context: </span>{r.ai_context.slice(0, 150)}…
                          </div>
                        )}
                      </div>
                      <Button size="sm" onClick={() => claim(r)} className="shrink-0">Claim</Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="active">
          <div className="space-y-4">
            {active.length === 0 && <Card className="p-12 text-center text-slate-400">No active requests.</Card>}
            {active.map((r) => (
              <Card key={r.id} className="p-5">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className={`text-xs rounded-full px-2.5 py-0.5 ${statusColor[r.status]}`}>{r.status}</span>
                  <span className="text-xs rounded-full px-2.5 py-0.5 bg-slate-100 text-slate-600">{r.subject}</span>
                  {r.dispute_status === "open" && (
                    <span className="text-xs rounded-full px-2.5 py-0.5 bg-orange-100 text-orange-700 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Disputed
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-800 mb-3">{r.question_text}</p>
                {r.image_url && <img src={r.image_url} alt="" className="mb-3 rounded-lg max-h-40 border border-slate-200" />}
                {r.ai_context && (
                  <div className="mb-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
                    <span className="font-medium text-slate-600">Milo's context: </span>{r.ai_context}
                  </div>
                )}
                {r.dispute_reason && (
                  <div className="mb-3 rounded-lg bg-orange-50 p-3 text-xs text-orange-700">
                    <span className="font-medium">Student dispute: </span>{r.dispute_reason}
                  </div>
                )}

                {responding?.id === r.id ? (
                  <div className="border-t border-slate-100 pt-4 mt-4">
                    <Textarea value={responseText} onChange={(e) => setResponseText(e.target.value)} placeholder="Write your explanation…" className="min-h-32 resize-none" />
                    {responseImage ? (
                      <div className="relative mt-3 inline-block">
                        <img src={responseImage} alt="" className="rounded-lg max-h-32 border border-slate-200" />
                        <button onClick={() => setResponseImage("")} className="absolute -top-2 -right-2 bg-slate-900 text-white rounded-full p-1"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <label className="mt-3 flex items-center gap-2 text-sm text-primary cursor-pointer w-fit">
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                        {uploading ? "Uploading…" : "Add annotated image"}
                        <input type="file" accept="image/*" className="hidden" onChange={uploadImage} />
                      </label>
                    )}

                    {showReject ? (
                      <div className="mt-4">
                        <Select value={rejectReason} onValueChange={setRejectReason}>
                          <SelectTrigger className="mb-2"><SelectValue placeholder="Reason…" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="out of scope">Out of scope</SelectItem>
                            <SelectItem value="insufficient info">Insufficient info</SelectItem>
                            <SelectItem value="duplicate">Duplicate</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex gap-2">
                          <Button size="sm" variant="destructive" onClick={reject} disabled={!rejectReason}>Confirm reject</Button>
                          <Button size="sm" variant="outline" onClick={() => setShowReject(false)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2 mt-4">
                        <Button size="sm" onClick={sendResponse} disabled={!responseText.trim()}><Send className="w-4 h-4 mr-1.5" />Send response</Button>
                        <Button size="sm" variant="outline" onClick={() => setWaiting(r)}>Ask student to clarify</Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowReject(true)}>Reject…</Button>
                        <Button size="sm" variant="ghost" onClick={() => setResponding(null)}>Cancel</Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <Button size="sm" onClick={() => { setResponding(r); setResponseText(r.tutor_response || ""); setResponseImage(r.tutor_response_image || ""); setShowReject(false); }}>
                    {r.status === "Disputed" ? "Revise response" : "Respond"}
                  </Button>
                )}
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="done">
          <div className="space-y-3">
            {completed.length === 0 && <Card className="p-12 text-center text-slate-400">No completed requests yet.</Card>}
            {completed.map((r) => (
              <Card key={r.id} className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs rounded-full px-2.5 py-0.5 ${statusColor[r.status]}`}>{r.status}</span>
                      <span className="text-xs text-slate-400">{r.subject}</span>
                    </div>
                    <p className="text-sm text-slate-700 truncate">{r.question_text}</p>
                  </div>
                  {r.rating && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`w-3.5 h-3.5 ${r.rating >= n ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />)}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <Card className="p-5">
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </Card>
  );
}