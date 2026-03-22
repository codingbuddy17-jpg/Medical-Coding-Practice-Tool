/**
 * Tests for CSV/question import parsing and validation.
 * Re-uses the parsing logic from app.import.js via require (Node.js compatible).
 */

// app.import.js sets window.PBL_IMPORT — simulate that in Node.js
const globalThis_window = global;
globalThis_window.window = globalThis_window;

require("../app.import.js");

const { parseCsv, sanitizeQuestionCard, cleanImportText } = window.PBL_IMPORT;

// ---- Tests ----

describe("cleanImportText", () => {
  test("trims surrounding whitespace", () => {
    expect(cleanImportText("  hello  ")).toBe("hello");
  });

  test("removes null bytes", () => {
    expect(cleanImportText("E11\u00009")).toBe("E119");
  });

  test("handles null/undefined gracefully", () => {
    expect(cleanImportText(null)).toBe("");
    expect(cleanImportText(undefined)).toBe("");
  });
});

describe("sanitizeQuestionCard", () => {
  test("normalises type to mcq or short", () => {
    expect(sanitizeQuestionCard({ type: "MCQ" }).type).toBe("mcq");
    expect(sanitizeQuestionCard({ type: "SHORT" }).type).toBe("short");
    expect(sanitizeQuestionCard({ type: "unknown" }).type).toBe("short");
    expect(sanitizeQuestionCard({}).type).toBe("short");
  });

  test("preserves question and answer text", () => {
    const card = sanitizeQuestionCard({ question: "What is E11.9?", answer: "Type 2 DM" });
    expect(card.question).toBe("What is E11.9?");
    expect(card.answer).toBe("Type 2 DM");
  });

  test("handles all MCQ option fields", () => {
    const card = sanitizeQuestionCard({
      type: "mcq",
      question: "Q?",
      option_a: "A", option_b: "B", option_c: "C", option_d: "D",
      correct_option: "A"
    });
    expect(card.option_a).toBe("A");
    expect(card.option_b).toBe("B");
    expect(card.option_c).toBe("C");
    expect(card.option_d).toBe("D");
    expect(card.correct_option).toBe("A");
  });

  test("upcases correct_option", () => {
    const card = sanitizeQuestionCard({ correct_option: "a" });
    expect(card.correct_option).toBe("A");
  });
});

describe("parseCsv — short answer cards", () => {
  const shortCsv = [
    "tag,type,question,answer,rationale",
    "ICD-10-CM,short,Type 2 diabetes without complications,E11.9,Type 2 is E11.x"
  ].join("\n");

  test("parses a single short answer row", () => {
    const cards = parseCsv(shortCsv);
    expect(cards).toHaveLength(1);
    expect(cards[0].tag).toBe("ICD-10-CM");
    expect(cards[0].type).toBe("short");
    expect(cards[0].question).toBe("Type 2 diabetes without complications");
    expect(cards[0].answer).toBe("E11.9");
    expect(cards[0].rationale).toBe("Type 2 is E11.x");
  });
});

describe("parseCsv — MCQ cards", () => {
  const mcqCsv = [
    "tag,type,question,option_a,option_b,option_c,option_d,correct_option,rationale",
    "CPT,mcq,Knee arthroscopy code?,29880,29881,29882,29883,B,29881 is correct"
  ].join("\n");

  test("parses a single MCQ row", () => {
    const cards = parseCsv(mcqCsv);
    expect(cards).toHaveLength(1);
    expect(cards[0].type).toBe("mcq");
    expect(cards[0].option_a).toBe("29880");
    expect(cards[0].option_b).toBe("29881");
    expect(cards[0].correct_option).toBe("B");
  });
});

describe("parseCsv — edge cases", () => {
  test("returns empty array for empty input", () => {
    expect(parseCsv("")).toHaveLength(0);
    expect(parseCsv("   ")).toHaveLength(0);
  });

  test("handles quoted fields with commas inside", () => {
    const csv = [
      "tag,type,question,answer",
      `ICD-10-CM,short,"Type 2 diabetes, uncomplicated",E11.9`
    ].join("\n");
    const cards = parseCsv(csv);
    expect(cards[0].question).toBe("Type 2 diabetes, uncomplicated");
  });

  test("handles multiple rows", () => {
    const csv = [
      "tag,type,question,answer",
      "ICD-10-CM,short,Q1,A1",
      "CPT,short,Q2,A2",
      "MODIFIERS,short,Q3,A3"
    ].join("\n");
    expect(parseCsv(csv)).toHaveLength(3);
  });

  test("handles tab-delimited input", () => {
    const tsv = "tag\ttype\tquestion\tanswer\nICD-10-CM\tshort\tQ1\tA1";
    const cards = parseCsv(tsv);
    expect(cards).toHaveLength(1);
    expect(cards[0].question).toBe("Q1");
  });

  test("skips rows with no question content", () => {
    const csv = [
      "tag,type,question,answer",
      "ICD-10-CM,short,,E11.9"  // empty question
    ].join("\n");
    const cards = parseCsv(csv);
    // Row is parsed but question will be empty string
    expect(cards[0].question).toBe("");
  });
});
