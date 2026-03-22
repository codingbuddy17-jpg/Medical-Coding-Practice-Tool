/**
 * Tests for answer scoring logic.
 * Functions are re-declared here because app files are vanilla browser scripts
 * without CommonJS exports.
 */

// ---- Pure functions extracted from app.helpers.js / app.practice.js ----

const MCQ_PREFIX = "__MCQ__:";

function toMcqOptionKey(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (["A", "B", "C", "D"].includes(raw)) return raw;
  const match = raw.match(/^(\(?[A-D])(?=[\)\.\s]|$)/);
  if (match) return match[1].replace(/[\(\)]/g, "");
  if (raw.startsWith("OPTION ")) {
    const char = raw.split(" ")[1];
    if (["A", "B", "C", "D"].includes(char)) return char;
  }
  return "";
}

function splitAnswers(raw) {
  return String(raw).split("|").map((x) => x.trim()).filter(Boolean);
}

function normalizePlainText(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeCodeText(text) {
  return String(text || "").toLowerCase().replace(/\bmodifier\b/g, "").replace(/\bcode\b/g, "").replace(/[^a-z0-9]/g, "");
}

function looksLikeCode(text) {
  const raw = String(text || "").trim();
  if (!raw) return false;
  const compact = raw.replace(/\s+/g, "");
  const hasDigit = /\d/.test(compact);
  const shortish = compact.length <= 12;
  const codeCharsOnly = /^[a-zA-Z0-9.\-]+$/.test(compact);
  return hasDigit && shortish && codeCharsOnly;
}

function levenshteinDistance(a, b) {
  const left = String(a || "");
  const right = String(b || "");
  const m = left.length;
  const n = right.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i += 1) dp[i][0] = i;
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function isTextMatchFlexible(userInput, option) {
  const user = normalizePlainText(userInput);
  const ans = normalizePlainText(option);
  if (!user || !ans) return false;
  if (user === ans) return true;
  const minLen = Math.min(user.length, ans.length);
  if (minLen >= 7 && (user.includes(ans) || ans.includes(user))) return true;
  const distance = levenshteinDistance(user, ans);
  const maxLen = Math.max(user.length, ans.length);
  if (maxLen <= 8) return distance <= 1;
  if (maxLen <= 16) return distance <= 2;
  return distance / maxLen <= 0.12;
}

function checkAnswer(userInput, expectedAnswer, card = null) {
  const type = String(card?.type || "").toLowerCase();
  if (type === "mcq") {
    const options = Array.isArray(card?.options) ? card.options : [];
    const correctOption = toMcqOptionKey(card?.correctOption);
    const selected = toMcqOptionKey(userInput);
    const isCorrect = selected && correctOption && selected === correctOption;
    const correctIdx = correctOption ? correctOption.charCodeAt(0) - 65 : -1;
    const correctText = correctIdx >= 0 ? options[correctIdx] || "" : "";
    const primaryAnswer = correctOption ? `${correctOption}) ${correctText}`.trim() : "";
    return {
      isCorrect: Boolean(isCorrect),
      primaryAnswer,
      acceptedAnswers: correctOption ? [correctOption, correctText].filter(Boolean) : []
    };
  }
  const answers = splitAnswers(expectedAnswer);
  const matched = answers.some((option) => {
    if (looksLikeCode(userInput) || looksLikeCode(option)) {
      return normalizeCodeText(userInput) === normalizeCodeText(option);
    }
    return isTextMatchFlexible(userInput, option);
  });
  return {
    isCorrect: matched,
    primaryAnswer: answers[0] || expectedAnswer,
    acceptedAnswers: answers
  };
}

// ---- Tests ----

describe("toMcqOptionKey", () => {
  test("accepts plain uppercase letters A-D", () => {
    expect(toMcqOptionKey("A")).toBe("A");
    expect(toMcqOptionKey("B")).toBe("B");
    expect(toMcqOptionKey("C")).toBe("C");
    expect(toMcqOptionKey("D")).toBe("D");
  });

  test("accepts lowercase a-d and normalises to uppercase", () => {
    expect(toMcqOptionKey("a")).toBe("A");
    expect(toMcqOptionKey("b")).toBe("B");
  });

  test("accepts trailing punctuation formats", () => {
    expect(toMcqOptionKey("A)")).toBe("A");
    expect(toMcqOptionKey("A.")).toBe("A");
    expect(toMcqOptionKey("(A)")).toBe("A");
  });

  test("accepts 'Option A' prefix format", () => {
    expect(toMcqOptionKey("Option A")).toBe("A");
    expect(toMcqOptionKey("Option B")).toBe("B");
  });

  test("returns empty string for invalid values", () => {
    expect(toMcqOptionKey("E")).toBe("");
    expect(toMcqOptionKey("")).toBe("");
    expect(toMcqOptionKey("Z")).toBe("");
  });
});

describe("checkAnswer — MCQ mode", () => {
  const mcqCard = {
    type: "mcq",
    options: ["E11.9", "E10.9", "E13.9", "E12.9"],
    correctOption: "A"
  };

  test("correct MCQ answer returns isCorrect=true", () => {
    const result = checkAnswer("A", "", mcqCard);
    expect(result.isCorrect).toBe(true);
  });

  test("wrong MCQ answer returns isCorrect=false", () => {
    const result = checkAnswer("B", "", mcqCard);
    expect(result.isCorrect).toBe(false);
  });

  test("primaryAnswer includes letter and option text", () => {
    const result = checkAnswer("A", "", mcqCard);
    expect(result.primaryAnswer).toBe("A) E11.9");
  });

  test("empty selection returns isCorrect=false", () => {
    const result = checkAnswer("", "", mcqCard);
    expect(result.isCorrect).toBe(false);
  });
});

describe("checkAnswer — short answer / code mode", () => {
  test("exact ICD code match is correct", () => {
    const result = checkAnswer("E11.9", "E11.9");
    expect(result.isCorrect).toBe(true);
  });

  test("ICD code match is case-insensitive", () => {
    const result = checkAnswer("e11.9", "E11.9");
    expect(result.isCorrect).toBe(true);
  });

  test("wrong ICD code is incorrect", () => {
    const result = checkAnswer("E10.9", "E11.9");
    expect(result.isCorrect).toBe(false);
  });

  test("pipe-separated accepted answers — first answer matches", () => {
    const result = checkAnswer("E11.9", "E11.9|E11.65");
    expect(result.isCorrect).toBe(true);
  });

  test("pipe-separated accepted answers — second answer matches", () => {
    const result = checkAnswer("E11.65", "E11.9|E11.65");
    expect(result.isCorrect).toBe(true);
  });

  test("text answer with minor typo passes flexible matching", () => {
    const result = checkAnswer("diabtes mellitus", "diabetes mellitus");
    expect(result.isCorrect).toBe(true);
  });

  test("empty user answer is incorrect", () => {
    const result = checkAnswer("", "E11.9");
    expect(result.isCorrect).toBe(false);
  });
});

describe("looksLikeCode", () => {
  test("ICD codes are detected as codes", () => {
    expect(looksLikeCode("E11.9")).toBe(true);
    expect(looksLikeCode("Z87.01")).toBe(true);
    expect(looksLikeCode("99213")).toBe(true);
  });

  test("plain text phrases are not codes", () => {
    expect(looksLikeCode("diabetes mellitus")).toBe(false);
    expect(looksLikeCode("type 2 diabetes")).toBe(false);
  });

  test("empty string is not a code", () => {
    expect(looksLikeCode("")).toBe(false);
  });
});

describe("levenshteinDistance", () => {
  test("identical strings have distance 0", () => {
    expect(levenshteinDistance("abc", "abc")).toBe(0);
  });

  test("single character difference has distance 1", () => {
    expect(levenshteinDistance("abc", "abd")).toBe(1);
  });

  test("empty vs non-empty equals string length", () => {
    expect(levenshteinDistance("", "abc")).toBe(3);
    expect(levenshteinDistance("abc", "")).toBe(3);
  });
});
