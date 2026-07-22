const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState } from "react";

import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, UploadCloud, CheckCircle2, AlertTriangle, FileSpreadsheet, Trash2 } from "lucide-react";

const SUBJECTS = ["Math", "Reading", "Writing", "Grammar", "Vocabulary", "Algebra", "Geometry", "Statistics", "Advanced Math", "Problem Solving"];
const DIFFS = ["Easy", "Medium", "Hard", "Expert", "Challenge"];

const diffColor = {
  Easy: "bg-emerald-100 text-emerald-700",
  Medium: "bg-blue-100 text-blue-700",
  Hard: "bg-amber-100 text-amber-700",
  Expert: "bg-rose-100 text-rose-700",
  Challenge: "bg-purple-100 text-purple-700",
};

export default function BulkImport() {
  const { toast } = useToast();
  const [file, setFile] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [staged, setStaged] = useState([]);
  const [publishing, setPublishing] = useState(false);
  const [done, setDone] = useState(0);

  const schema = {
    type: "object",
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            prompt: { type: "string" },
            choices: { type: "array", items: { type: "string" } },
            correct_answer: { type: "string" },
            explanation: { type: "string" },
            subject: { type: "string" },
            difficulty: { type: "string" },
          },
        },
      },
    },
  };

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setStaged([]);
    setDone(0);
  };

  const extract = async () => {
    if (!file) return;
    setExtracting(true);
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      const res = await db.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: schema,
      });
      if (res.status === "success" && res.output?.questions?.length) {
        const rows = res.output.questions.map((q) => ({
          prompt: q.prompt || "",
          choices: q.choices || [],
          correct_answer: q.correct_answer || "",
          explanation: q.explanation || "",
          subject: SUBJECTS.includes(q.subject) ? q.subject : "Math",
          difficulty: DIFFS.includes(q.difficulty) ? q.difficulty : "Medium",
          question_type: "Multiple Choice",
          source: "imported",
          status: "in review",
        }));
        setStaged(rows);
        toast({ title: `${rows.length} questions extracted` });
      } else {
        toast({ title: "Could not extract questions", description: res.details || "Check file format", variant: "destructive" });
      }
    } catch {
      toast({ title: "Extraction failed", variant: "destructive" });
    }
    setExtracting(false);
  };

  const updateRow = (idx, field, value) => {
    setStaged((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const removeRow = (idx) => setStaged((prev) => prev.filter((_, i) => i !== idx));

  const validCount = staged.filter((r) => r.prompt && r.correct_answer).length;

  const publish = async () => {
    const valid = staged.filter((r) => r.prompt && r.correct_answer);
    if (!valid.length) return;
    setPublishing(true);
    try {
      await db.entities.BankQuestion.bulkCreate(
        valid.map((r) => ({ ...r, status: "published" }))
      );
      setDone(valid.length);
      setStaged([]);
      setFile(null);
      toast({ title: `${valid.length} questions published to the bank` });
    } catch {
      toast({ title: "Publish failed", variant: "destructive" });
    }
    setPublishing(false);
  };

  return (
    <div>
      <PageHeader
        title="Bulk Import"
        subtitle="Upload a CSV or Excel file to stage SAT questions for review before publishing to the Question Bank."
      />

      {/* Upload zone */}
      <Card className="p-6 mb-6">
        {!staged.length && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
              <FileSpreadsheet className="w-7 h-7 text-slate-400" />
            </div>
            <label className="cursor-pointer">
              <div className="flex items-center gap-2 text-primary font-medium">
                <UploadCloud className="w-4 h-4" />
                {file ? file.name : "Choose CSV or Excel file"}
              </div>
              <input type="file" accept=".csv,.xlsx,.xls,.json" className="hidden" onChange={handleFile} />
            </label>
            {file && (
              <Button onClick={extract} disabled={extracting}>
                {extracting ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Extracting…</> : "Extract questions"}
              </Button>
            )}
            <p className="text-xs text-slate-400 text-center max-w-md">
              Expected columns: prompt, choices (comma-separated), correct_answer, explanation, subject, difficulty.
              Rows are staged for review and won't go live until you publish.
            </p>
          </div>
        )}

        {done > 0 && (
          <div className="flex items-center gap-2 text-emerald-600 mb-4">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium">{done} questions published to the Question Bank.</span>
          </div>
        )}
      </Card>

      {/* Staging preview */}
      {staged.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-3 text-sm">
              <span className="font-medium text-slate-700">{staged.length} questions staged</span>
              <span className="flex items-center gap-1 text-amber-600">
                <AlertTriangle className="w-3.5 h-3.5" />
                {staged.length - validCount} need prompt + correct answer
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setStaged([]); setFile(null); }}>Clear</Button>
              <Button onClick={publish} disabled={publishing || !validCount}>
                {publishing ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Publishing…</> : `Publish ${validCount} to Bank`}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {staged.map((q, idx) => {
              const valid = q.prompt && q.correct_answer;
              return (
                <Card key={idx} className={`p-4 ${valid ? "" : "border-amber-300 bg-amber-50/20"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <textarea
                        value={q.prompt}
                        onChange={(e) => updateRow(idx, "prompt", e.target.value)}
                        placeholder="Question prompt…"
                        className="w-full text-sm text-slate-800 border border-slate-200 rounded-md p-2 resize-none min-h-20 focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      {q.choices.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {q.choices.map((c, i) => (
                            <span key={i} className={`text-xs rounded px-2 py-0.5 ${c === q.correct_answer ? "bg-emerald-100 text-emerald-700 font-medium" : "bg-slate-100 text-slate-600"}`}>
                              {String.fromCharCode(65 + i)}. {c}
                            </span>
                          ))}
                        </div>
                      )}
                      <input
                        value={q.correct_answer}
                        onChange={(e) => updateRow(idx, "correct_answer", e.target.value)}
                        placeholder="Correct answer…"
                        className="mt-2 w-full text-xs border border-slate-200 rounded-md p-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      {q.explanation && (
                        <p className="mt-2 text-xs text-slate-500 line-clamp-2">{q.explanation}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="flex gap-1.5">
                        <Select value={q.subject} onValueChange={(v) => updateRow(idx, "subject", v)}>
                          <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={q.difficulty} onValueChange={(v) => updateRow(idx, "difficulty", v)}>
                          <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{DIFFS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <span className={`text-xs rounded-full px-2 py-0.5 ${diffColor[q.difficulty]}`}>{q.difficulty}</span>
                      <button onClick={() => removeRow(idx)} className="text-slate-300 hover:text-rose-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}