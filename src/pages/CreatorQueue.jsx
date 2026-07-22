const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useEffect, useState } from "react";

import PageHeader from "@/components/ui-bits/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardList, Loader2, Upload, Video, ChevronDown, ChevronUp, Sparkles, Wand2, Library } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { logAudit } from "@/lib/audit";
import CleanText from "@/components/CleanText";
import PromoteQuestion from "@/components/PromoteQuestion";
import { assistTutorResponse } from "@/lib/adminAI";

export default function CreatorQueue() {
  const { toast } = useToast();
  const [me, setMe] = useState(null);
  const [requests, setRequests] = useState([]);
  const [tab, setTab] = useState("available");
  const [drafts, setDrafts] = useState({});
  const [videos, setVideos] = useState({});
  const [busy, setBusy] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [promoting, setPromoting] = useState(null);
  const [assisting, setAssisting] = useState(null);

  const load = async () => {
    const all = await db.entities.Question.filter({ escalated: true }, "-created_date", 100);
    setRequests(all);
  };

  useEffect(() => { db.auth.me().then(setMe); load(); }, []);

  const toggleExpand = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const aiAssist = async (q) => {
    setAssisting(q.id);
    try {
      const [attempts] = await Promise.all([
        db.entities.PracticeAttempt.list("-created_date", 100).then(r => r.filter(a => a.created_by_id === q.created_by_id)),
      ]);
      const result = await assistTutorResponse(q, { practiceAttempts: attempts });
      if (result.suggested_response) {
        setDrafts((d) => ({ ...d, [q.id]: result.suggested_response }));
        toast({ title: "AI draft ready — review and edit before sending" });
      }
    } catch {
      toast({ title: "AI assist failed", variant: "destructive" });
    } finally {
      setAssisting(null);
    }
  };

  const claim = async (q) => {
    setBusy(q.id);
    await db.entities.Question.update(q.id, { status: "in_progress", tutor_id: me.id });
    await db.entities.Notification.create({ user_id: q.created_by_id, title: "A tutor claimed your request", message: "A tutor is now reviewing your question.", type: "request_claimed" });
    await logAudit("question_claimed", `Claimed question: ${(q.text || "image question").slice(0, 50)}`, "Question", q.id);
    setBusy(null); load();
  };

  const uploadVideo = async (q, file) => {
    if (!file) return;
    setBusy(q.id);
    const { file_url } = await db.integrations.Core.UploadFile({ file });
    setVideos((v) => ({ ...v, [q.id]: file_url }));
    setBusy(null);
    toast({ title: "Video attached" });
  };

  const respond = async (q) => {
    const text = drafts[q.id];
    if (!text?.trim() && !videos[q.id]) { toast({ title: "Write a response or attach a video first." }); return; }
    setBusy(q.id);
    await db.entities.Question.update(q.id, { tutor_response: text || "", tutor_response_video: videos[q.id] || "", status: "answered" });
    await db.entities.Notification.create({ user_id: q.created_by_id, title: "Your tutor responded!", message: "Open My Requests to read the full explanation.", type: "response_received" });
    await logAudit("question_answered", `Answered question: ${(q.text || "image question").slice(0, 50)}`, "Question", q.id);
    setBusy(null); load();
    toast({ title: "Response sent to student!" });
  };

  const reject = async (q, reason) => {
    setBusy(q.id);
    await db.entities.Question.update(q.id, { status: "rejected", rejection_reason: reason });
    await db.entities.Notification.create({ user_id: q.created_by_id, title: "Request rejected", message: `Your request was rejected: ${reason}`, type: "system" });
    setBusy(null); load();
    toast({ title: "Request rejected" });
  };

  const isAdmin = me?.role === "admin";
  const available = requests.filter((q) => q.status === "new");
  const inProgress = requests.filter((q) => isAdmin ? q.status === "in_progress" : q.tutor_id === me?.id && q.status === "in_progress");
  const answered = requests.filter((q) => isAdmin ? q.status === "answered" : q.tutor_id === me?.id && q.status === "answered");

  const tabs = [
    { key: "available", label: `New (${available.length})` },
    { key: "inprogress", label: `In Progress (${inProgress.length})` },
    { key: "answered", label: `Answered (${answered.length})` },
  ];

  const list = tab === "available" ? available : tab === "inprogress" ? inProgress : answered;

  return (
    <div>
      <PageHeader
        title={isAdmin ? "Request Inbox" : "Tutor Queue"}
        subtitle={isAdmin ? "All escalated student requests — manage, respond, or reject." : "Claim student questions and respond with a clear explanation."}
      />

      <Tabs value={tab} onValueChange={setTab} className="mb-6">
        <TabsList>
          {tabs.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {list.length === 0 && (
        <Card className="p-12 text-center text-muted-foreground">
          <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>Nothing here right now.</p>
        </Card>
      )}

      {promoting && (
        <PromoteQuestion
          question={promoting}
          onClose={() => setPromoting(null)}
          onSaved={() => { setPromoting(null); toast({ title: "Question added to the bank — it'll appear in practice modes!" }); }}
        />
      )}

      <div className="space-y-4">
        {list.map((q) => (
          <Card key={q.id} className="overflow-hidden">
            {/* Header row */}
            <div className="p-5 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap gap-2 mb-2">
                  <Badge variant="secondary">{q.subject}</Badge>
                  {q.topic && <Badge variant="outline">{q.topic}</Badge>}
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${
                    q.status === "new" ? "bg-blue-500/10 text-blue-400" :
                    q.status === "in_progress" ? "bg-amber-500/10 text-amber-400" :
                    q.status === "answered" ? "bg-emerald-500/10 text-emerald-400" :
                    "bg-muted text-muted-foreground"
                  }`}>{q.status?.replace("_", " ")}</span>
                </div>
                <p className="font-medium leading-snug line-clamp-2">{q.text || "Image/video question"}</p>
                <p className="text-xs text-muted-foreground mt-1">{new Date(q.created_date).toLocaleDateString()}</p>
              </div>
              <button onClick={() => toggleExpand(q.id)} className="p-2 rounded-lg hover:bg-secondary transition-colors shrink-0">
                {expanded[q.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {/* Expanded detail */}
            {expanded[q.id] && (
              <div className="border-t border-border/60 px-5 pb-5 pt-4 space-y-4">
                {/* Student's image */}
                {q.image_url && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Student's image</p>
                    <img src={q.image_url} alt="Question" className="rounded-xl border border-border max-h-64 object-contain" />
                  </div>
                )}

                {/* Student's video */}
                {q.tutor_response_video && q.status === "new" && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Student's video</p>
                    <video src={q.tutor_response_video} controls className="rounded-xl border border-border w-full max-h-48" />
                  </div>
                )}

                {/* Milo's draft */}
                {q.milo_response && (
                  <details className="group">
                    <summary className="cursor-pointer text-sm text-accent font-medium flex items-center gap-2 select-none">
                      <span>Milo's AI draft</span>
                      <span className="text-muted-foreground font-normal">(for reference)</span>
                    </summary>
                    <div className="mt-2 p-3 bg-accent/5 border border-accent/15 rounded-xl text-sm">
                      <CleanText text={q.milo_response} />
                    </div>
                  </details>
                )}

                {/* Actions */}
                {tab === "available" && (
                  <div className="flex gap-2 flex-wrap">
                    <Button disabled={busy === q.id} onClick={() => claim(q)} className="gap-2">
                      {busy === q.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Claim & respond
                    </Button>
                    <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => reject(q, "out of scope")} disabled={busy === q.id}>
                      Reject
                    </Button>
                  </div>
                )}

                {tab === "inprogress" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Your response</p>
                      <Button size="sm" variant="outline" disabled={assisting === q.id} onClick={() => aiAssist(q)} className="gap-1.5">
                        {assisting === q.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5 text-accent" />}
                        AI Assist
                      </Button>
                    </div>
                    <Textarea
                      rows={5}
                      placeholder="Write a clear explanation for the student. You can use plain text — no special formatting needed."
                      value={drafts[q.id] || ""}
                      onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
                      className="resize-none rounded-xl"
                    />
                    <label className={`flex items-center gap-3 p-3 border border-dashed rounded-xl cursor-pointer transition-all ${
                      videos[q.id] ? "border-purple-500/40 bg-purple-500/5" : "border-border hover:border-purple-500/30"
                    }`}>
                      {busy === q.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4 text-muted-foreground" />}
                      <span className="text-sm text-muted-foreground flex-1">{videos[q.id] ? "Video attached" : "Attach a video explanation (optional)"}</span>
                      <input type="file" accept="video/*" className="hidden"
                        onChange={(e) => uploadVideo(q, e.target.files[0])} />
                    </label>
                    {videos[q.id] && <video src={videos[q.id]} controls className="rounded-xl border border-border w-full max-h-48" />}
                    <Button disabled={busy === q.id} onClick={() => respond(q)} className="gap-2">
                      {busy === q.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Send response to student
                    </Button>
                  </div>
                )}

                {tab === "answered" && (
                  <div className="space-y-3">
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 space-y-2">
                      <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">Your response</p>
                      <CleanText text={q.tutor_response} />
                      {q.tutor_response_video && (
                        <video src={q.tutor_response_video} controls className="rounded-xl border border-border w-full max-h-48 mt-2" />
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => setPromoting(q)} className="gap-1.5">
                        <Library className="w-3.5 h-3.5 text-accent" /> Promote to Question Bank
                      </Button>
                      {q.tutor_response_video && (
                        <Button size="sm" variant="outline" onClick={async () => {
                          const m = await db.auth.me();
                          await db.entities.Video.create({
                            title: `${q.subject} — ${q.topic || "SAT Question"} Explanation`,
                            description: q.text?.slice(0, 200) || "Tutor video explanation",
                            tags: [q.subject, q.topic, q.difficulty].filter(Boolean),
                            video_url: q.tutor_response_video,
                            subject: q.subject,
                            topic: q.topic || "",
                            difficulty: q.difficulty || "Medium",
                            creator_id: m.id,
                            creator_name: m.full_name || "Cognify Tutor",
                            source_question_id: q.id,
                            status: "published",
                            views: 0,
                          });
                          toast({ title: "Video published to library!" });
                        }} className="gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-accent" /> Publish Video to Library
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}