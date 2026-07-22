import React, { useState } from "react";
import StandardPractice from "@/components/practice/StandardPractice";
import InfinitePractice from "@/components/practice/InfinitePractice";
import ChallengePractice from "@/components/practice/ChallengePractice";
import PracticeConfig from "@/components/practice/PracticeConfig";

// Modes that need a target question count (non-infinite)
const FINITE_MODES = ["Quick Practice", "Timed Practice", "Adaptive Practice", "Weakness Mode", "Mixed Mode", "Streak Mode", "Review Mode", "Daily Challenge"];

export default function Practice() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode") || "Quick Practice";

  const [config, setConfig] = useState(null);

  if (!config) {
    return <PracticeConfig mode={mode} onStart={setConfig} />;
  }

  if (mode === "Endless Practice") return <InfinitePractice config={config} />;
  if (mode === "Challenge Mode") return <ChallengePractice config={config} />;
  return <StandardPractice mode={mode} config={config} />;
}