const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";

import { generateQuestions } from "@/lib/questionGenerator";
import QuestionCard from "@/components/practice/QuestionCard";
import StrugglePrompt from "@/components/practice/StrugglePrompt";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Infinity as InfinityIcon } from "lucide-react";

const SUBJECTS = ["Math", "Reading", "Writing"];
const STRUGGLE_THRESHOLD = 4; // consecutive wrong on same topic

export default function InfinitePractice({ config = {} }) {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [correct, setCorrect] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [struggle, setStruggle] = useState(null);
  const subjectCycle = useRef(0);
  const topicMisses = useRef({});

  const filterSubject = config.subject;
  const filterDifficulty = config.difficulty;

  const generateMore = useCallback(async () => {
    setGenerating(true);
    try {
      // Cycle through subjects unless one is fixed
      const subject = filterSubject || SUBJECTS[subjectCycle.current % SUBJECTS.length];
      if (!filterSubject) subjectCycle.current++;
      const newQs = await generateQuestions({
        subject,
        difficulty: filterDifficulty || "Medium",
        count: 3,
      });
      if (newQs.length > 0) setQuestions((prev) => [...prev, ...newQs]);
    } catch { /* silent */ }
    finally { setGenerating(false); }
  }, [filterSubject, filterDifficulty]);

  useEffect(() => {
    (async () => {
      const filterObj = { review_status: "published" };
      if (filterSubject) filterObj.subject = filterSubject;
      if (filterDifficulty) filterObj.difficulty = filterDifficulty;
      const bank = await db.entities.BankQuestion.filter(filterObj, "-created_date", 50);
      const withOptions = bank
        .filter((q) => q.options?.length > 0 && q.correct_index != null)
        .sort(() => Math.random() - 0.5)
        .slice(0, 5);
      setQuestions(withOptions);
      setLoading(false);
      generateMore();
    })();
  }, []);

  // Auto-generate when buffer runs low
  useEffect(() => {
    if (!loading && !generating && questions.length - idx <= 3) generateMore();
  }, [idx, questions.length, loading, generating, generateMore]);

  const current = questions[idx];

  const handleSelect = (i) => {
    if (selected != null) return;
    setSelected(i);
    const isCorrect = i === current.correct_index;
    if (isCorrect) {
      setCorrect((c) => c + 1);
      if (current.topic) topicMisses.current[current.topic] = 0;
    } else {
      if (current.topic) {
        const prev = topicMisses.current[current.topic] || 0;
        topicMisses.current[current.topic] = prev + 1;
        if (topicMisses.current[current.topic] >= STRUGGLE_THRESHOLD && !struggle) {
          setStruggle({ topic: current.topic, subject: current.subject, sampleQuestion: current.prompt });
        }
      }
    }
    if (current.id && !current._procedural) {
      db.entities.PracticeAttempt.create({
        bank_question_id: current.id,
        correct: isCorrect,
        selected_index: i,
      }).catch(() => {});
    }
  };

  const handleNext = () => { setIdx((i) => i + 1); setSelected(null); };

  const handleExit = async () => {
    const answered = idx + (selected != null ? 1 : 0);
    if (answered > 0) {
      await db.entities.PracticeSession.create({
        session_type: "Endless Practice",
        total_questions: answered,
        correct_answers: correct,
        completed: true,
      }).catch(() => {});
    }
    navigate("/study");
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;

  if (!current)
    return (
      <div className="max-w-2xl mx-auto text-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto mb-4" />
        <p className="text-muted-foreground">Generating fresh questions…</p>
      </div>
    );

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" className="gap-2" onClick={handleExit}>
          <ArrowLeft className="w-4 h-4" /> Exit
        </Button>
        <div className="flex items-center gap-2">
          {filterSubject && <Badge variant="outline">{filterSubject}</Badge>}
          {filterDifficulty && <Badge variant="outline">{filterDifficulty}</Badge>}
          <Badge variant="secondary" className="gap-1.5">
            <InfinityIcon className="w-3.5 h-3.5" /> Endless Practice
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4 text-sm text-muted-foreground">
        <span>Question {idx + 1}</span>
        <span>·</span>
        <span>{correct} correct</span>
        {generating && (
          <span className="flex items-center gap-1 text-accent">
            <Loader2 className="w-3 h-3 animate-spin" /> generating more…
          </span>
        )}
      </div>

      <QuestionCard
        question={current}
        selected={selected}
        onSelect={handleSelect}
        onNext={handleNext}
        nextLabel="Next question →"
      />

      {struggle && (
        <StrugglePrompt
          topic={struggle.topic}
          subject={struggle.subject}
          sampleQuestion={struggle.sampleQuestion}
          onDismiss={() => setStruggle(null)}
        />
      )}
    </div>
  );
}