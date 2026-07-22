const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { generateQuestions } from "@/lib/questionGenerator";
import QuestionCard from "@/components/practice/QuestionCard";
import SessionSummary from "@/components/practice/SessionSummary";
import StrugglePrompt from "@/components/practice/StrugglePrompt";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Loader2, Trophy, Flame } from "lucide-react";

const DIFFICULTIES = ["Easy", "Medium", "Hard", "Expert"];
const STRUGGLE_THRESHOLD = 3;

export default function ChallengePractice({ config = {} }) {
  const navigate = useNavigate();
  const [allQuestions, setAllQuestions] = useState([]);
  const [current, setCurrent] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [struggle, setStruggle] = useState(null);
  const [view, setView] = useState({ answered: 0, correct: 0, streak: 0, difficulty: "Medium" });

  const filterSubject = config.subject;
  const totalTarget = config.count || 15;
  const topicMisses = useRef({});

  const session = useRef({
    streak: 0,
    difficulty: "Medium",
    domainMisses: {},
    answered: 0,
    correct: 0,
    usedIds: new Set(),
  });

  useEffect(() => {
    (async () => {
      const filterObj = { review_status: "published" };
      if (filterSubject) filterObj.subject = filterSubject;
      let bank = await db.entities.BankQuestion.filter(filterObj, "-created_date", 150);
      let withOptions = bank.filter((q) => q.options?.length > 0 && q.correct_index != null);

      // Supplement with AI questions if bank is thin
      if (withOptions.length < 10) {
        try {
          const extra = await generateQuestions({
            subject: filterSubject || "Math",
            difficulty: "Medium",
            count: 10 - withOptions.length,
          });
          withOptions = [...withOptions, ...extra];
        } catch { /* silent */ }
      }

      setAllQuestions(withOptions);
      const first = pickNext(withOptions, "Medium", new Set(), {});
      setCurrent(first);
      setLoading(false);
    })();
  }, []);

  function pickNext(pool, targetDifficulty, usedIds, misses) {
    if (pool.length === 0) return null;
    let candidates = pool.filter((q) => !usedIds.has(q.id));
    if (candidates.length === 0) { usedIds.clear(); candidates = pool; }

    // Priority 1: weak domain (2+ misses) at easier difficulty
    const weakDomain = Object.entries(misses).find(([, c]) => c >= 2)?.[0];
    if (weakDomain) {
      const curIdx = DIFFICULTIES.indexOf(targetDifficulty);
      const easierDiff = DIFFICULTIES[Math.max(curIdx - 1, 0)];
      const match = candidates.filter((q) => q.topic === weakDomain && q.difficulty === easierDiff);
      if (match.length > 0) return match[Math.floor(Math.random() * match.length)];
    }

    // Priority 2: target difficulty
    let match = candidates.filter((q) => q.difficulty === targetDifficulty);
    if (match.length > 0) return match[Math.floor(Math.random() * match.length)];

    // Priority 3: adjacent difficulties
    const curIdx = DIFFICULTIES.indexOf(targetDifficulty);
    for (const off of [1, -1, 2, -2]) {
      const adj = curIdx + off;
      if (adj >= 0 && adj < DIFFICULTIES.length) {
        match = candidates.filter((q) => q.difficulty === DIFFICULTIES[adj]);
        if (match.length > 0) return match[Math.floor(Math.random() * match.length)];
      }
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  const handleSelect = (i) => {
    if (selected != null || !current) return;
    setSelected(i);
    const isCorrect = i === current.correct_index;
    const s = session.current;

    if (isCorrect) {
      s.streak = s.streak >= 0 ? s.streak + 1 : 1;
      s.correct++;
      if (current.topic) topicMisses.current[current.topic] = 0;
    } else {
      s.streak = s.streak <= 0 ? s.streak - 1 : -1;
      if (current.topic) {
        s.domainMisses[current.topic] = (s.domainMisses[current.topic] || 0) + 1;
        topicMisses.current[current.topic] = (topicMisses.current[current.topic] || 0) + 1;
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

    setView({ answered: s.answered, correct: s.correct, streak: s.streak, difficulty: s.difficulty });
  };

  const handleNext = () => {
    const s = session.current;
    s.answered++;
    if (current.id) s.usedIds.add(current.id);

    if (s.streak >= 2) {
      s.difficulty = DIFFICULTIES[Math.min(DIFFICULTIES.indexOf(s.difficulty) + 1, DIFFICULTIES.length - 1)];
      s.streak = 0;
    } else if (s.streak <= -2) {
      s.difficulty = DIFFICULTIES[Math.max(DIFFICULTIES.indexOf(s.difficulty) - 1, 0)];
      s.streak = 0;
    }

    if (s.answered >= totalTarget) {
      setDone(true);
      db.entities.PracticeSession.create({
        session_type: "Challenge Mode",
        total_questions: totalTarget,
        correct_answers: s.correct,
        completed: true,
      }).catch(() => {});
      return;
    }

    const next = pickNext(allQuestions, s.difficulty, s.usedIds, s.domainMisses);
    setCurrent(next);
    setSelected(null);
    setView({ answered: s.answered, correct: s.correct, streak: s.streak, difficulty: s.difficulty });
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;

  if (done)
    return (
      <SessionSummary
        correct={view.correct}
        total={totalTarget}
        mode="Challenge Mode"
        onExit={() => navigate("/study")}
        onRetry={() => window.location.reload()}
      />
    );

  if (!current)
    return (
      <div className="max-w-2xl mx-auto text-center py-24">
        <p className="text-muted-foreground mb-4">No questions available. Try different filters.</p>
        <Button onClick={() => navigate("/study")}>Back to Study Hub</Button>
      </div>
    );

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate("/study")}>
          <ArrowLeft className="w-4 h-4" /> Exit
        </Button>
        <div className="flex items-center gap-2">
          {filterSubject && <Badge variant="outline">{filterSubject}</Badge>}
          <Badge variant="secondary" className="gap-1.5">
            <Trophy className="w-3.5 h-3.5" /> Challenge Mode
          </Badge>
        </div>
      </div>

      <Progress value={(view.answered / totalTarget) * 100} className="mb-2" />
      <div className="flex items-center justify-between mb-4 text-sm">
        <span className="text-muted-foreground">{view.answered} / {totalTarget} answered</span>
        <div className="flex items-center gap-3">
          {view.streak >= 2 && (
            <span className="flex items-center gap-1 text-emerald-500 font-medium">
              <Flame className="w-3.5 h-3.5" /> {view.streak} streak
            </span>
          )}
          {view.streak <= -2 && <span className="text-red-500 font-medium">Difficulty easing…</span>}
          <Badge variant="outline" className="capitalize">{view.difficulty}</Badge>
        </div>
      </div>

      <QuestionCard
        question={current}
        selected={selected}
        onSelect={handleSelect}
        onNext={handleNext}
        nextLabel={view.answered + 1 >= totalTarget ? "See results" : "Next question →"}
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