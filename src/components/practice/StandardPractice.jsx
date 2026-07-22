const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { generateQuestions } from "@/lib/questionGenerator";
import QuestionCard from "@/components/practice/QuestionCard";
import SessionSummary from "@/components/practice/SessionSummary";
import StrugglePrompt from "@/components/practice/StrugglePrompt";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Loader2 } from "lucide-react";

const STRUGGLE_THRESHOLD = 3; // consecutive wrong on same topic triggers prompt

export default function StandardPractice({ mode, config = {} }) {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);
  const [struggle, setStruggle] = useState(null); // { topic, subject, sampleQuestion }
  const topicMisses = React.useRef({}); // topic -> consecutive miss count

  const totalTarget = config.count || 8;
  const filterSubject = config.subject;
  const filterDifficulty = config.difficulty;

  useEffect(() => {
    (async () => {
      const filterObj = { review_status: "published" };
      if (filterSubject) filterObj.subject = filterSubject;
      if (filterDifficulty) filterObj.difficulty = filterDifficulty;

      let all = await db.entities.BankQuestion.filter(filterObj, "-created_date", 200);
      let withOptions = all.filter((q) => q.options?.length > 0 && q.correct_index != null);

      // If bank is too sparse, supplement with AI-generated questions
      if (withOptions.length < totalTarget) {
        try {
          const extra = await generateQuestions({
            subject: filterSubject || "Math",
            difficulty: filterDifficulty || "Medium",
            count: totalTarget - withOptions.length,
          });
          withOptions = [...withOptions, ...extra];
        } catch { /* silent */ }
      }

      let pool;
      if (mode === "Review Mode") {
        const attempts = await db.entities.PracticeAttempt.list("-created_date", 100);
        const wrongIds = [...new Set(attempts.filter((a) => !a.correct).map((a) => a.bank_question_id))];
        const wrong = withOptions.filter((q) => wrongIds.includes(q.id));
        const rest = withOptions.filter((q) => !wrongIds.includes(q.id)).sort(() => Math.random() - 0.5);
        pool = [...wrong, ...rest];
      } else if (mode === "Daily Challenge") {
        pool = withOptions.filter((q) => q.difficulty === "Hard" || q.difficulty === "Expert").sort(() => Math.random() - 0.5);
        if (pool.length < 5) pool = withOptions.sort(() => Math.random() - 0.5);
      } else if (mode === "Weakness Mode") {
        const attempts = await db.entities.PracticeAttempt.list("-created_date", 50);
        const wrongTopics = [...new Set(
          attempts.filter((a) => !a.correct)
            .map((a) => withOptions.find((bq) => bq.id === a.bank_question_id)?.topic)
            .filter(Boolean)
        )];
        const weak = withOptions.filter((q) => wrongTopics.includes(q.topic));
        const rest = withOptions.filter((q) => !wrongTopics.includes(q.topic)).sort(() => Math.random() - 0.5);
        pool = [...weak, ...rest];
      } else {
        pool = withOptions.sort(() => Math.random() - 0.5);
      }

      setQuestions(pool.slice(0, totalTarget));
      setLoading(false);
    })();
  }, []);

  const current = questions[idx];

  const choose = (i) => {
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

  const next = async () => {
    if (idx + 1 >= questions.length) {
      setDone(true);
      await db.entities.PracticeSession.create({
        session_type: mode,
        total_questions: questions.length,
        correct_answers: correct,
        completed: true,
      }).catch(() => {});
      const me = await db.auth.me().catch(() => null);
      if (me && questions.length > 0 && correct / questions.length >= 0.8) {
        await db.auth.updateMe({
          current_streak: (me.current_streak || 0) + 1,
          best_streak: Math.max(me.best_streak || 0, (me.current_streak || 0) + 1),
        }).catch(() => {});
      }
    } else {
      setIdx((i) => i + 1);
      setSelected(null);
    }
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;

  if (questions.length === 0)
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground mb-4">No practice questions available for these filters.</p>
        <Button onClick={() => navigate("/study")}>Back to Study Hub</Button>
      </Card>
    );

  if (done)
    return (
      <SessionSummary
        correct={correct}
        total={questions.length}
        mode={mode}
        onExit={() => navigate("/study")}
        onRetry={() => window.location.reload()}
      />
    );

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate("/study")}>
          <ArrowLeft className="w-4 h-4" /> Exit
        </Button>
        <div className="flex items-center gap-2">
          {filterSubject && <Badge variant="outline">{filterSubject}</Badge>}
          {filterDifficulty && <Badge variant="outline">{filterDifficulty}</Badge>}
          <Badge variant="secondary">{mode}</Badge>
        </div>
      </div>
      <Progress value={(idx / questions.length) * 100} className="mb-6" />
      <p className="text-sm text-muted-foreground mb-2">
        Question {idx + 1} of {questions.length}
      </p>
      <QuestionCard
        question={current}
        selected={selected}
        onSelect={choose}
        onNext={next}
        nextLabel={idx + 1 >= questions.length ? "Finish" : "Next question →"}
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