export type ModeKey =
  | 'quick_practice'
  | 'infinite_practice'
  | 'timed_practice'
  | 'adaptive_practice'
  | 'weakest_topics'
  | 'review_mistakes'
  | 'bookmarked_questions'
  | 'exam_simulation'
  | 'question_bank'
  | 'challenge_mode';

export type SessionStatus = 'not_started' | 'active' | 'paused' | 'completed' | 'abandoned';
export type QuestionState = 'active' | 'answered' | 'reviewed' | 'skipped';
export type SourceType = 'stored_question' | 'procedural_question' | 'mixed';

export interface SessionConfig {
  modeKey: ModeKey;
  section: string;
  domain: string;
  skill: string;
  difficulty: string;
  questionCountTarget: number;
  timeLimitSeconds: number | null;
  shuffleQuestions: boolean;
  allowBacktracking: boolean;
  showTimer: boolean;
  adaptive: boolean;
  sourceType: SourceType;
}

export interface QuestionAnswerState {
  questionId: string;
  questionIndex: number;
  state: QuestionState;
  selectedAnswer: string | null;
  isCorrect: boolean | null;
  isBookmarked: boolean;
  markedForReview: boolean;
  eliminatedChoices: string[];
  timeSpentSeconds: number;
  attemptCount: number;
  explanationRevealed: boolean;
  answeredAt: string | null;
}

export interface ChallengeState {
  streak: number; // positive = correct streak, negative = miss streak
  difficulty: 'easy' | 'medium' | 'hard';
  domainMisses: Record<string, number>; // domain_id -> consecutive-ish miss count this session
  servedQuestionIds: string[];
}

export interface PracticeSessionRow {
  id: string;
  user_id: string;
  mode_key: ModeKey | null;
  status: SessionStatus;
  source_type: SourceType;
  section_filter: string | null;
  difficulty_filter: string | null;
  domain_filter: string | null;
  question_count_target: number;
  shuffle_questions: boolean;
  allow_backtracking: boolean;
  show_timer: boolean;
  adaptive: boolean;
  resume_allowed: boolean;
  session_seed: string | null;
  generated_question_ids: string[];
  last_question_index: number;
  challenge_state: ChallengeState | null;
  time_limit_seconds: number | null;
  correct_answers: number | null;
  total_questions: number | null;
  score_percentage: number | null;
  time_taken_seconds: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ModeDefinition {
  key: ModeKey;
  label: string;
  description: string;
  icon: string;
  color: string;
  defaultConfig: Partial<SessionConfig>;
  allowsSectionFilter: boolean;
  allowsDifficultyFilter: boolean;
  allowsCountPicker: boolean;
  allowsTimerToggle: boolean;
  requiresHistory: boolean;
  isInfinite: boolean;
  isTimed: boolean;
  isExam: boolean;
  fixedCount?: number;
}

export const MODE_DEFINITIONS: ModeDefinition[] = [
  {
    key: 'quick_practice',
    label: 'Quick Practice',
    description: 'Short, configurable session — pick section, skill, and count.',
    icon: 'Zap',
    color: 'text-warning',
    defaultConfig: { questionCountTarget: 10, shuffleQuestions: true, showTimer: false },
    allowsSectionFilter: true,
    allowsDifficultyFilter: true,
    allowsCountPicker: true,
    allowsTimerToggle: false,
    requiresHistory: false,
    isInfinite: false,
    isTimed: false,
    isExam: false,
  },
  {
    key: 'infinite_practice',
    label: 'Infinite Practice',
    description: 'Keep answering until you decide to stop — no fixed count.',
    icon: 'Infinity',
    color: 'text-info',
    defaultConfig: { shuffleQuestions: true, showTimer: false },
    allowsSectionFilter: true,
    allowsDifficultyFilter: true,
    allowsCountPicker: false,
    allowsTimerToggle: false,
    requiresHistory: false,
    isInfinite: true,
    isTimed: false,
    isExam: false,
  },
  {
    key: 'timed_practice',
    label: 'Timed Practice',
    description: 'Fixed count with a strict countdown — pressure training.',
    icon: 'Timer',
    color: 'text-warning',
    defaultConfig: { questionCountTarget: 10, shuffleQuestions: true, showTimer: true, timeLimitSeconds: 700 },
    allowsSectionFilter: true,
    allowsDifficultyFilter: true,
    allowsCountPicker: true,
    allowsTimerToggle: false,
    requiresHistory: false,
    isInfinite: false,
    isTimed: true,
    isExam: false,
  },
  {
    key: 'adaptive_practice',
    label: 'Adaptive Practice',
    description: 'Difficulty is weighted by your historical accuracy from the start.',
    icon: 'TrendingUp',
    color: 'text-milo',
    defaultConfig: { questionCountTarget: 20, adaptive: true, shuffleQuestions: true },
    allowsSectionFilter: true,
    allowsDifficultyFilter: false,
    allowsCountPicker: true,
    allowsTimerToggle: false,
    requiresHistory: false,
    isInfinite: false,
    isTimed: false,
    isExam: false,
  },
  {
    key: 'weakest_topics',
    label: 'Weakest Topics',
    description: 'Questions pulled from your lowest-scoring skill areas.',
    icon: 'AlertTriangle',
    color: 'text-destructive',
    defaultConfig: { questionCountTarget: 15, shuffleQuestions: true },
    allowsSectionFilter: false,
    allowsDifficultyFilter: false,
    allowsCountPicker: true,
    allowsTimerToggle: false,
    requiresHistory: true,
    isInfinite: false,
    isTimed: false,
    isExam: false,
  },
  {
    key: 'challenge_mode',
    label: 'Challenge Mode',
    description: 'Live difficulty that escalates on a streak and re-targets the moment you miss one.',
    icon: 'Flame',
    color: 'text-warning',
    defaultConfig: { questionCountTarget: 20, adaptive: true, shuffleQuestions: true },
    allowsSectionFilter: true,
    allowsDifficultyFilter: false,
    allowsCountPicker: false,
    allowsTimerToggle: false,
    requiresHistory: false,
    isInfinite: true,
    isTimed: false,
    isExam: false,
  },
  {
    key: 'review_mistakes',
    label: 'Review Mistakes',
    description: 'Only questions you previously got wrong — retry and learn.',
    icon: 'RefreshCw',
    color: 'text-warning',
    defaultConfig: { shuffleQuestions: true, allowBacktracking: true },
    allowsSectionFilter: false,
    allowsDifficultyFilter: false,
    allowsCountPicker: false,
    allowsTimerToggle: false,
    requiresHistory: true,
    isInfinite: false,
    isTimed: false,
    isExam: false,
  },
  {
    key: 'bookmarked_questions',
    label: 'Bookmarked Questions',
    description: 'Your saved questions — sorted however you like.',
    icon: 'Bookmark',
    color: 'text-info',
    defaultConfig: { shuffleQuestions: false, allowBacktracking: true },
    allowsSectionFilter: false,
    allowsDifficultyFilter: false,
    allowsCountPicker: false,
    allowsTimerToggle: false,
    requiresHistory: false,
    isInfinite: false,
    isTimed: false,
    isExam: false,
  },
  {
    key: 'exam_simulation',
    label: 'Exam Simulation',
    description: 'Full Bluebook-style test — fixed structure, real timing, no reveals mid-test.',
    icon: 'GraduationCap',
    color: 'text-success',
    defaultConfig: {
      questionCountTarget: 98,
      showTimer: true,
      shuffleQuestions: false,
      allowBacktracking: true,
      timeLimitSeconds: 3840,
    },
    allowsSectionFilter: false,
    allowsDifficultyFilter: false,
    allowsCountPicker: false,
    allowsTimerToggle: false,
    requiresHistory: false,
    isInfinite: false,
    isTimed: true,
    isExam: true,
    fixedCount: 98,
  },
  {
    key: 'question_bank',
    label: 'Question Bank',
    description: 'Browse, filter, and search all questions — launch a session from any view.',
    icon: 'Database',
    color: 'text-muted-foreground',
    defaultConfig: {},
    allowsSectionFilter: true,
    allowsDifficultyFilter: true,
    allowsCountPicker: false,
    allowsTimerToggle: false,
    requiresHistory: false,
    isInfinite: false,
    isTimed: false,
    isExam: false,
  },
];

export function getModeDefinition(key: ModeKey): ModeDefinition {
  return MODE_DEFINITIONS.find((m) => m.key === key)!;
}

export function buildTimeLimitFromCount(count: number, secondsPerQuestion = 70): number {
  return count * secondsPerQuestion;
}
