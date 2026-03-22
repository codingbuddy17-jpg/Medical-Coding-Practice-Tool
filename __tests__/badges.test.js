/**
 * Tests for gamification badge evaluation logic.
 */

// ---- Badge definitions extracted from app.core.js ----

const DEFAULT_WEEKLY_TARGET = 150;

const BADGE_DEFINITIONS = [
  { id: "questions_50",  title: "Starter Sprint",    icon: "🚀", theme: "volume",   rule: "Answer 50 questions",                         check: (g) => Number(g.totalAnswered || 0) >= 50 },
  { id: "questions_100", title: "Century Club",      icon: "💯", theme: "volume",   rule: "Answer 100 questions",                        check: (g) => Number(g.totalAnswered || 0) >= 100 },
  { id: "accuracy_80",   title: "Precision Pro",     icon: "🎯", theme: "accuracy", rule: "Maintain 80% accuracy (min 30 attempts)",     check: (g) => Number(g.totalAnswered || 0) >= 30 && (Number(g.totalCorrect || 0) / Math.max(1, Number(g.totalAnswered || 0))) >= 0.8 },
  { id: "streak_3",      title: "Rhythm Builder",    icon: "🔥", theme: "streak",   rule: "3-day streak",                                check: (g) => Number(g.streakDays || 0) >= 3 },
  { id: "streak_7",      title: "Consistency Star",  icon: "🌟", theme: "streak",   rule: "7-day streak",                                check: (g) => Number(g.streakDays || 0) >= 7 },
  { id: "questions_250", title: "Vault Master",      icon: "🏆", theme: "mastery",  rule: "Answer 250 questions",                        check: (g) => Number(g.totalAnswered || 0) >= 250 }
];

function evaluateBadges(gamification) {
  const newlyUnlocked = [];
  const unlocked = { ...(gamification.unlockedBadges || {}) };
  BADGE_DEFINITIONS.forEach((badge) => {
    if (unlocked[badge.id]) return;
    if (badge.check(gamification)) {
      unlocked[badge.id] = Date.now();
      newlyUnlocked.push(badge);
    }
  });
  return { newlyUnlocked, unlockedBadges: unlocked };
}

function makeGamification(overrides = {}) {
  return {
    totalAnswered: 0,
    totalCorrect: 0,
    streakDays: 0,
    lastActiveDay: "",
    dailyAttempts: {},
    weeklyAttempts: {},
    weeklyTarget: DEFAULT_WEEKLY_TARGET,
    unlockedBadges: {},
    ...overrides
  };
}

// ---- Tests ----

describe("Badge: Starter Sprint (50 questions)", () => {
  test("not unlocked below threshold", () => {
    const g = makeGamification({ totalAnswered: 49 });
    const { newlyUnlocked } = evaluateBadges(g);
    expect(newlyUnlocked.map((b) => b.id)).not.toContain("questions_50");
  });

  test("unlocked at exactly 50", () => {
    const g = makeGamification({ totalAnswered: 50 });
    const { newlyUnlocked } = evaluateBadges(g);
    expect(newlyUnlocked.map((b) => b.id)).toContain("questions_50");
  });

  test("unlocked above threshold", () => {
    const g = makeGamification({ totalAnswered: 75 });
    const { newlyUnlocked } = evaluateBadges(g);
    expect(newlyUnlocked.map((b) => b.id)).toContain("questions_50");
  });

  test("not re-unlocked if already in unlockedBadges", () => {
    const g = makeGamification({ totalAnswered: 75, unlockedBadges: { questions_50: Date.now() } });
    const { newlyUnlocked } = evaluateBadges(g);
    expect(newlyUnlocked.map((b) => b.id)).not.toContain("questions_50");
  });
});

describe("Badge: Century Club (100 questions)", () => {
  test("not unlocked at 99", () => {
    const g = makeGamification({ totalAnswered: 99 });
    const { newlyUnlocked } = evaluateBadges(g);
    expect(newlyUnlocked.map((b) => b.id)).not.toContain("questions_100");
  });

  test("unlocked at exactly 100", () => {
    const g = makeGamification({ totalAnswered: 100 });
    const { newlyUnlocked } = evaluateBadges(g);
    expect(newlyUnlocked.map((b) => b.id)).toContain("questions_100");
  });
});

describe("Badge: Precision Pro (80% accuracy, min 30 attempts)", () => {
  test("not unlocked below 30 attempts even if accuracy is high", () => {
    const g = makeGamification({ totalAnswered: 25, totalCorrect: 25 });
    const { newlyUnlocked } = evaluateBadges(g);
    expect(newlyUnlocked.map((b) => b.id)).not.toContain("accuracy_80");
  });

  test("not unlocked at 30+ attempts with accuracy below 80%", () => {
    const g = makeGamification({ totalAnswered: 30, totalCorrect: 23 }); // 76.7%
    const { newlyUnlocked } = evaluateBadges(g);
    expect(newlyUnlocked.map((b) => b.id)).not.toContain("accuracy_80");
  });

  test("unlocked at exactly 80% accuracy with 30+ attempts", () => {
    const g = makeGamification({ totalAnswered: 30, totalCorrect: 24 }); // exactly 80%
    const { newlyUnlocked } = evaluateBadges(g);
    expect(newlyUnlocked.map((b) => b.id)).toContain("accuracy_80");
  });

  test("unlocked at 100% accuracy with 30+ attempts", () => {
    const g = makeGamification({ totalAnswered: 50, totalCorrect: 50 });
    const { newlyUnlocked } = evaluateBadges(g);
    expect(newlyUnlocked.map((b) => b.id)).toContain("accuracy_80");
  });
});

describe("Badge: Rhythm Builder (3-day streak)", () => {
  test("not unlocked at 2-day streak", () => {
    const g = makeGamification({ streakDays: 2 });
    const { newlyUnlocked } = evaluateBadges(g);
    expect(newlyUnlocked.map((b) => b.id)).not.toContain("streak_3");
  });

  test("unlocked at 3-day streak", () => {
    const g = makeGamification({ streakDays: 3 });
    const { newlyUnlocked } = evaluateBadges(g);
    expect(newlyUnlocked.map((b) => b.id)).toContain("streak_3");
  });
});

describe("Badge: Consistency Star (7-day streak)", () => {
  test("not unlocked at 6-day streak", () => {
    const g = makeGamification({ streakDays: 6 });
    const { newlyUnlocked } = evaluateBadges(g);
    expect(newlyUnlocked.map((b) => b.id)).not.toContain("streak_7");
  });

  test("unlocked at 7-day streak", () => {
    const g = makeGamification({ streakDays: 7 });
    const { newlyUnlocked } = evaluateBadges(g);
    expect(newlyUnlocked.map((b) => b.id)).toContain("streak_7");
  });
});

describe("Badge: Vault Master (250 questions)", () => {
  test("not unlocked at 249", () => {
    const g = makeGamification({ totalAnswered: 249 });
    const { newlyUnlocked } = evaluateBadges(g);
    expect(newlyUnlocked.map((b) => b.id)).not.toContain("questions_250");
  });

  test("unlocked at 250", () => {
    const g = makeGamification({ totalAnswered: 250 });
    const { newlyUnlocked } = evaluateBadges(g);
    expect(newlyUnlocked.map((b) => b.id)).toContain("questions_250");
  });
});

describe("Multiple badges unlock simultaneously", () => {
  test("volume milestones chain correctly at 100 questions", () => {
    const g = makeGamification({ totalAnswered: 100 });
    const { newlyUnlocked } = evaluateBadges(g);
    const ids = newlyUnlocked.map((b) => b.id);
    expect(ids).toContain("questions_50");
    expect(ids).toContain("questions_100");
  });

  test("already unlocked badges are not duplicated", () => {
    const g = makeGamification({
      totalAnswered: 100,
      unlockedBadges: { questions_50: Date.now() }
    });
    const { newlyUnlocked } = evaluateBadges(g);
    const ids = newlyUnlocked.map((b) => b.id);
    expect(ids).not.toContain("questions_50");
    expect(ids).toContain("questions_100");
  });
});
