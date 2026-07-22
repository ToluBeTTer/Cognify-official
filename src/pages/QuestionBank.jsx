const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useEffect, useState } from "react";

import PageHeader from "@/components/ui-bits/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Library, CheckCircle2 } from "lucide-react";

const SUBJECTS = ["All", "Math", "Reading", "Writing", "Grammar", "Algebra", "Geometry", "Statistics", "Advanced Math", "Problem Solving"];
const DIFFICULTIES = ["All", "Easy", "Medium", "Hard", "Expert", "Challenge"];

export default function QuestionBank() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("All");
  const [difficulty, setDifficulty] = useState("All");
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    db.entities.BankQuestion.filter({ review_status: "published" }, "-created_date", 200).then(setItems);
  }, []);

  const filtered = items.filter((q) =>
    (subject === "All" || q.subject === subject) &&
    (difficulty === "All" || q.difficulty === difficulty) &&
    (!search || q.prompt?.toLowerCase().includes(search.toLowerCase()) || q.topic?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      <PageHeader title="Question Bank" subtitle={`${items.length} curated SAT questions, filterable by subject and difficulty.`} />

      <Card className="p-4 mb-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search questions or topics..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={subject} onValueChange={setSubject}>
          <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>{SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={difficulty} onValueChange={setDifficulty}>
          <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>{DIFFICULTIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </Card>

      {filtered.length === 0 && (
        <Card className="p-12 text-center text-muted-foreground">
          <Library className="w-10 h-10 mx-auto mb-3 opacity-40" /><p>No questions match your filters.</p>
        </Card>
      )}

      <div className="space-y-3">
        {filtered.map((q) => (
          <Card key={q.id} className="p-5">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant="secondary">{q.subject}</Badge>
              <Badge variant="outline">{q.difficulty}</Badge>
              {q.topic && <span className="text-xs text-muted-foreground">{q.topic}</span>}
            </div>
            {q.passage && <p className="text-sm text-muted-foreground italic mb-2 line-clamp-2">{q.passage}</p>}
            <p className="font-medium">{q.prompt}</p>
            {q.options?.length > 0 && (
              <div className="grid sm:grid-cols-2 gap-2 mt-3">
                {q.options.map((opt, i) => (
                  <div key={i} className={`text-sm px-3 py-2 rounded-lg border flex items-center gap-2 ${expanded === q.id && i === q.correct_index ? "border-emerald-400 bg-emerald-50 text-emerald-800" : ""}`}>
                    <span className="font-semibold">{String.fromCharCode(65 + i)}.</span> {opt}
                    {expanded === q.id && i === q.correct_index && <CheckCircle2 className="w-4 h-4 ml-auto text-emerald-600" />}
                  </div>
                ))}
              </div>
            )}
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => setExpanded(expanded === q.id ? null : q.id)}>
              {expanded === q.id ? "Hide answer" : "Reveal answer & explanation"}
            </Button>
            {expanded === q.id && q.explanation && (
              <p className="text-sm text-muted-foreground mt-2 border-t pt-3">{q.explanation}</p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}