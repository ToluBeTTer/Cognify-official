const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useEffect, useState } from "react";

import CleanText from "@/components/CleanText";
import PageHeader from "@/components/ui-bits/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Inbox, Star } from "lucide-react";

const STATUS_COLORS = {
  ai_answered: "bg-slate-100 text-slate-700",
  new: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  waiting: "bg-purple-100 text-purple-700",
  answered: "bg-emerald-100 text-emerald-700",
  resolved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  archived: "bg-slate-100 text-slate-500",
};

export default function MyRequests() {
  const [questions, setQuestions] = useState([]);
  const [open, setOpen] = useState(null);

  const load = () => db.entities.Question.list("-created_date", 100).then(setQuestions);
  useEffect(() => { load(); }, []);

  const rate = async (q, stars) => {
    await db.entities.Question.update(q.id, { rating: stars });
    load();
  };

  return (
    <div>
      <PageHeader title="My Requests" subtitle="Every question you've asked Milo and escalated to tutors." />
      {questions.length === 0 && (
        <Card className="p-12 text-center text-muted-foreground">
          <Inbox className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No questions yet.</p>
        </Card>
      )}
      <div className="space-y-3">
        {questions.map((q) => (
          <Card key={q.id} className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium line-clamp-2">{q.text || "Image question"}</p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <Badge variant="secondary">{q.subject}</Badge>
                  {q.topic && <Badge variant="outline">{q.topic}</Badge>}
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[q.status] || "bg-slate-100"}`}>{q.status?.replace("_", " ")}</span>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setOpen(open === q.id ? null : q.id)}>
                {open === q.id ? "Hide" : "View"}
              </Button>
            </div>

            {open === q.id && (
              <div className="mt-4 pt-4 border-t space-y-4">
                {q.image_url && <img src={q.image_url} alt="" className="rounded-lg border max-h-56" />}
                {q.milo_response && (
                  <div>
                    <p className="text-xs font-semibold text-accent uppercase tracking-wide mb-1">Milo · {q.milo_response_type}</p>
                    <CleanText text={q.milo_response} />
                  </div>
                )}
                {q.tutor_response && (
                  <div className="bg-secondary/60 rounded-lg p-4">
                    <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">Tutor response</p>
                    <CleanText text={q.tutor_response} />
                    {q.tutor_response_image && <img src={q.tutor_response_image} alt="" className="rounded border mt-2 max-h-56" />}
                    {q.tutor_response_video && (
                      <video src={q.tutor_response_video} controls className="rounded border mt-2 w-full max-h-64" />
                    )}
                    <div className="flex items-center gap-1 mt-3">
                      <span className="text-xs text-muted-foreground mr-1">Rate this:</span>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button key={s} onClick={() => rate(q, s)}>
                          <Star className={`w-4 h-4 ${q.rating >= s ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {q.rejection_reason && <p className="text-sm text-red-600">Rejected: {q.rejection_reason}</p>}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}