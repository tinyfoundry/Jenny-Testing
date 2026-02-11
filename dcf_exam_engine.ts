export type Domain = "BOS25" | "CAAN" | "SNP" | "RNRF" | "SDGR" | "HSAN";
export type Difficulty = "easy" | "medium" | "hard";

export interface Question {
  id: string;
  domain: Domain;
  difficulty: Difficulty;
  question: string;
  choices: Record<"A" | "B" | "C" | "D", string>;
  correct_answer: "A" | "B" | "C" | "D";
  rationale: { short: string; deep: string };
  source: { zip: string; document: string; section: string };
  tags: string[];
}

export interface SessionHistory {
  recentExamQuestionIds: string[];
  recentPracticeQuestionIds: string[];
}

export interface PracticeConfig {
  domain: Domain;
  total: number;
}

export interface ExamConfig {
  total: number;
  domainWeights?: Partial<Record<Domain, number>>;
  difficultyMix?: { easy: number; medium: number; hard: number };
}

export interface AssembledQuestion extends Question {
  shuffledChoices: Array<{ key: "A" | "B" | "C" | "D"; text: string }>;
  remappedCorrectAnswer: number;
}

function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function withShuffledChoices(q: Question, rand: () => number): AssembledQuestion {
  const keys: Array<"A" | "B" | "C" | "D"> = ["A", "B", "C", "D"];
  const shuffled = shuffle(keys, rand).map((k) => ({ key: k, text: q.choices[k] }));
  const remappedCorrectAnswer = shuffled.findIndex((x) => x.key === q.correct_answer);
  return { ...q, shuffledChoices: shuffled, remappedCorrectAnswer };
}

function weightedPick<T>(items: T[], weights: number[], rand: () => number): T | null {
  if (!items.length) return null;
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return items[Math.floor(rand() * items.length)];
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

/**
 * Practice mode: single domain, avoids recent repeats when possible.
 */
export function assemblePracticeSession(
  bank: Question[],
  history: SessionHistory,
  config: PracticeConfig,
  seed = Date.now()
): AssembledQuestion[] {
  const rand = seededRandom(seed);
  const recent = new Set(history.recentPracticeQuestionIds);
  const domainPool = bank.filter((q) => q.domain === config.domain);

  let primary = domainPool.filter((q) => !recent.has(q.id));
  if (primary.length < config.total) {
    primary = [...primary, ...domainPool.filter((q) => recent.has(q.id))];
  }

  return shuffle(primary, rand)
    .slice(0, config.total)
    .map((q) => withShuffledChoices(q, rand));
}

/**
 * Exam mode: mixed domains, difficulty-balanced, no repeats inside exam,
 * and minimizes overlap with consecutive exams.
 */
export function assembleExamSession(
  bank: Question[],
  history: SessionHistory,
  config: ExamConfig,
  seed = Date.now()
): AssembledQuestion[] {
  const rand = seededRandom(seed);
  const recentExam = new Set(history.recentExamQuestionIds);

  const weights: Record<Domain, number> = {
    BOS25: config.domainWeights?.BOS25 ?? 1,
    CAAN: config.domainWeights?.CAAN ?? 1,
    SNP: config.domainWeights?.SNP ?? 1,
    RNRF: config.domainWeights?.RNRF ?? 1,
    SDGR: config.domainWeights?.SDGR ?? 1,
    HSAN: config.domainWeights?.HSAN ?? 1,
  };

  const mix = config.difficultyMix ?? { easy: 0.3, medium: 0.4, hard: 0.3 };
  const target = {
    easy: Math.round(config.total * mix.easy),
    medium: Math.round(config.total * mix.medium),
    hard: Math.max(0, config.total - Math.round(config.total * mix.easy) - Math.round(config.total * mix.medium)),
  };

  const picked: Question[] = [];
  const pickedIds = new Set<string>();

  const difficultyOrder: Difficulty[] = ["easy", "medium", "hard"];
  for (const diff of difficultyOrder) {
    for (let i = 0; i < target[diff]; i++) {
      const candidates = bank.filter((q) => q.difficulty === diff && !pickedIds.has(q.id));
      const penaltyAdjusted = candidates.map((q) => {
        const domainWeight = weights[q.domain];
        const repeatPenalty = recentExam.has(q.id) ? 0.1 : 1;
        return Math.max(0.0001, domainWeight * repeatPenalty);
      });
      const choice = weightedPick(candidates, penaltyAdjusted, rand);
      if (!choice) continue;
      picked.push(choice);
      pickedIds.add(choice.id);
    }
  }

  // Guarantee domain coverage (at least 1 per domain) when exam size allows.
  const domains: Domain[] = ["BOS25", "CAAN", "SNP", "RNRF", "SDGR", "HSAN"];
  const present = new Set(picked.map((q) => q.domain));
  for (const d of domains) {
    if (config.total < domains.length) break;
    if (present.has(d)) continue;
    const replacementIndex = picked.findIndex((q) => q.domain !== d);
    const candidate = bank.find((q) => q.domain === d && !pickedIds.has(q.id));
    if (replacementIndex >= 0 && candidate) {
      pickedIds.delete(picked[replacementIndex].id);
      picked[replacementIndex] = candidate;
      pickedIds.add(candidate.id);
      present.add(d);
    }
  }

  return shuffle(picked, rand).slice(0, config.total).map((q) => withShuffledChoices(q, rand));
}
