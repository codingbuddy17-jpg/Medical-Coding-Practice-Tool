window.PBL_IMPORT = (() => {
  let lastImportMeta = { detectedHeader: false, mappings: [], defaults: {} };

  function removeInvalidSurrogates(text) {
    const value = String(text || "");
    let out = "";
    for (let i = 0; i < value.length; i += 1) {
      const code = value.charCodeAt(i);
      const isHigh = code >= 0xd800 && code <= 0xdbff;
      const isLow = code >= 0xdc00 && code <= 0xdfff;

      if (isHigh) {
        const next = value.charCodeAt(i + 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          out += value[i] + value[i + 1];
          i += 1;
        }
        continue;
      }
      if (isLow) continue;
      out += value[i];
    }
    return out;
  }

  function cleanImportText(text) {
    return removeInvalidSurrogates(String(text || "").replace(/\u0000/g, "")).trim();
  }

  function normalizeQuestionType(value, fallback = "short") {
    const raw = cleanImportText(value || fallback).toLowerCase();
    if (["mcq", "multiple_choice", "multiplechoice", "multiple choice"].includes(raw)) return "mcq";
    if (["short", "short_answer", "shortanswer", "short answer"].includes(raw)) return "short";
    return fallback === "mcq" ? "mcq" : "short";
  }

  function normalizeDifficulty(value) {
    const raw = cleanImportText(value || "").toLowerCase();
    if (!raw) return "";
    if (["low", "beginner", "easy", "foundation", "basic"].includes(raw)) return "low";
    if (["medium", "mid", "core", "standard", "moderate", "intermediate"].includes(raw)) return "medium";
    if (["advanced", "hard", "challenge", "expert", "complex"].includes(raw)) return "advanced";
    return "";
  }

  function inferDifficulty(card) {
    const question = cleanImportText(card.question || "").toLowerCase();
    const rationale = cleanImportText(card.rationale || "").toLowerCase();
    const options = [
      card.option_a || card.optionA || "",
      card.option_b || card.optionB || "",
      card.option_c || card.optionC || "",
      card.option_d || card.optionD || ""
    ].map(cleanImportText).filter(Boolean);
    const combined = `${question} ${rationale}`.trim();
    const questionLength = question.length;
    const optionLength = options.join(" ").length;
    const scenarioSignals = /(patient|presents|ed\b|emergency|encounter|start time|stop time|end time|administered|infusion|iv push|same drug|sequential|concurrent|hydration|fracture|dislocation|debridement|foreign body)/.test(combined);
    const advancedSignals = /(most appropriate|which code|what should be reported|code selection|initial service|additional hour|separate access|same substance|hierarchy|best coding|what is reported|how should this be coded)/.test(combined);
    const recallSignals = /(what is|which of the following defines|true about|refers to|means|is used for|threshold)/.test(combined);

    if ((scenarioSignals && advancedSignals) || questionLength > 260 || optionLength > 220) return "advanced";
    if (scenarioSignals || questionLength > 130 || options.length >= 4) return "medium";
    if (recallSignals || questionLength <= 95) return "low";
    return "medium";
  }

  function sanitizeQuestionCard(card, defaults = {}) {
    const type = normalizeQuestionType(card.type || defaults.type || "short", defaults.type || "short");
    const cleanOption = (v) => cleanImportText(v || "");
    const difficulty = normalizeDifficulty(card.difficulty || defaults.difficulty) || inferDifficulty(card);
    return {
      tag: cleanImportText(card.tag || defaults.tag || "General"),
      type,
      difficulty,
      question: cleanImportText(card.question || ""),
      answer: cleanImportText(card.answer || ""),
      rationale: cleanImportText(card.rationale || ""),
      option_a: cleanOption(card.option_a || card.optionA || ""),
      option_b: cleanOption(card.option_b || card.optionB || ""),
      option_c: cleanOption(card.option_c || card.optionC || ""),
      option_d: cleanOption(card.option_d || card.optionD || ""),
      correct_option: cleanImportText(card.correct_option || card.correctOption || "").toUpperCase()
    };
  }

  function detectDelimiter(sampleLine) {
    const line = sampleLine || "";
    const comma = (line.match(/,/g) || []).length;
    const semicolon = (line.match(/;/g) || []).length;
    const tab = (line.match(/\t/g) || []).length;
    if (tab >= semicolon && tab >= comma) return "\t";
    if (semicolon > comma) return ";";
    return ",";
  }

  function parseDelimitedLine(line, delimiter) {
    const cells = [];
    let current = "";
    let quoted = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      const next = line[i + 1];
      if (char === '"' && quoted && next === '"') {
        current += '"';
        i += 1;
        continue;
      }
      if (char === '"') {
        quoted = !quoted;
        continue;
      }
      if (char === delimiter && !quoted) {
        cells.push(current.trim());
        current = "";
        continue;
      }
      current += char;
    }
    cells.push(current.trim());
    return cells;
  }

  function parseRowsMatrix(rows, defaults = {}) {
    if (!Array.isArray(rows) || !rows.length) return [];
    const normalizeHeaderName = (value) => cleanImportText(value)
      .toLowerCase()
      .replace(/[\s\-\/]+/g, "_")
      .replace(/[()]/g, "")
      .replace(/__+/g, "_")
      .replace(/^_+|_+$/g, "");

    const HEADER_ALIASES = {
      tag: ["tag", "tags", "category", "topic", "topics", "subject", "module", "domain"],
      type: ["type", "question_type", "format"],
      difficulty: ["difficulty", "level", "complexity"],
      question: ["question", "questions", "question_text", "questiontext", "stem", "prompt"],
      answer: ["answer", "answers", "short_answer", "shortanswer", "answer_key", "answerkey"],
      rationale: ["rationale", "explanation", "reason", "notes", "description"],
      option_a: ["option_a", "optiona", "option_1", "option1", "choice_a", "choicea", "choice_1", "choice1", "a"],
      option_b: ["option_b", "optionb", "option_2", "option2", "choice_b", "choiceb", "choice_2", "choice2", "b"],
      option_c: ["option_c", "optionc", "option_3", "option3", "choice_c", "choicec", "choice_3", "choice3", "c"],
      option_d: ["option_d", "optiond", "option_4", "option4", "choice_d", "choiced", "choice_4", "choice4", "d"],
      correct_option: [
        "correct_option",
        "correctoption",
        "correct_answer",
        "correctanswer",
        "right_answer",
        "rightanswer",
        "correct",
        "answer_letter",
        "correct_choice"
      ]
    };

    const header = rows[0].map((x) => normalizeHeaderName(x));
    const headerMap = {};
    header.forEach((name, idx) => {
      headerMap[name] = idx;
    });

    const resolveHeaderIndex = (canonicalName) => {
      const aliases = HEADER_ALIASES[canonicalName] || [canonicalName];
      for (const alias of aliases) {
        if (Object.prototype.hasOwnProperty.call(headerMap, alias)) {
          return { idx: headerMap[alias], alias };
        }
      }
      return { idx: -1, alias: "" };
    };

    const resolvedHeaders = {};
    Object.keys(HEADER_ALIASES).forEach((canonicalName) => {
      resolvedHeaders[canonicalName] = resolveHeaderIndex(canonicalName);
    });

    const hasNamedHeader =
      resolvedHeaders.question.idx >= 0 &&
      (resolvedHeaders.answer.idx >= 0 || resolvedHeaders.option_a.idx >= 0);

    lastImportMeta = {
      detectedHeader: hasNamedHeader,
      mappings: Object.entries(resolvedHeaders)
        .filter(([canonicalName, info]) => info.idx >= 0 && info.alias && info.alias !== canonicalName)
        .map(([canonicalName, info]) => ({ canonicalName, matchedHeader: info.alias })),
      defaults: {
        tag: cleanImportText(defaults.tag || ""),
        type: normalizeQuestionType(defaults.type || "short", "short"),
        difficulty: normalizeDifficulty(defaults.difficulty || "")
      }
    };

    const startAt = hasNamedHeader ? 1 : 0;

    const getCell = (row, idx) => cleanImportText(idx >= 0 ? row[idx] : "");
    const getByName = (row, names, fallbackIdx = -1) => {
      for (const name of names) {
        if (Object.prototype.hasOwnProperty.call(headerMap, name)) {
          return getCell(row, headerMap[name]);
        }
      }
      return getCell(row, fallbackIdx);
    };

    return rows.slice(startAt).map((row) => {
      const tag = getByName(row, HEADER_ALIASES.tag, 0) || cleanImportText(defaults.tag || "") || "General";
      const type = normalizeQuestionType(getByName(row, HEADER_ALIASES.type, 1) || defaults.type || (hasNamedHeader ? "short" : ""), defaults.type || "short");
      const difficulty = normalizeDifficulty(getByName(row, HEADER_ALIASES.difficulty, -1) || defaults.difficulty || "");
      const question = getByName(row, HEADER_ALIASES.question, hasNamedHeader ? -1 : 1);
      const answer = getByName(row, HEADER_ALIASES.answer, hasNamedHeader ? -1 : 2);
      const rationale = getByName(row, HEADER_ALIASES.rationale, -1);
      const optionA = getByName(row, HEADER_ALIASES.option_a, -1);
      const optionB = getByName(row, HEADER_ALIASES.option_b, -1);
      const optionC = getByName(row, HEADER_ALIASES.option_c, -1);
      const optionD = getByName(row, HEADER_ALIASES.option_d, -1);
      const correctOption = getByName(row, HEADER_ALIASES.correct_option, -1).toUpperCase();

      return {
        tag,
        type,
        difficulty,
        question,
        answer,
        rationale,
        option_a: optionA,
        option_b: optionB,
        option_c: optionC,
        option_d: optionD,
        correct_option: correctOption
      };
    });
  }

  function parseCsv(text, defaults = {}) {
    const clean = cleanImportText(text);
    const lines = clean
      .split(/\r?\n/)
      .map((line) => cleanImportText(line))
      .filter(Boolean);

    if (!lines.length) return [];

    const delimiter = detectDelimiter(lines[0]);
    const rows = lines.map((line) => parseDelimitedLine(line, delimiter));
    return parseRowsMatrix(rows, defaults);
  }

  function parseExcelArrayBuffer(buffer, defaults = {}) {
    if (!window.XLSX) throw new Error("Excel parser unavailable");
    const workbook = window.XLSX.read(buffer, { type: "array" });
    const sheetNames = Array.isArray(workbook.SheetNames) ? workbook.SheetNames : [];
    if (!sheetNames.length) return [];
    const allCards = [];
    sheetNames.forEach((name) => {
      const sheet = workbook.Sheets[name];
      if (!sheet) return;
      const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
      const cards = parseRowsMatrix(rows, defaults);
      if (cards.length) allCards.push(...cards);
    });
    return allCards;
  }

  function formatCardsForTextarea(cards) {
    const header = "tag,type,difficulty,question,answer,rationale,option_a,option_b,option_c,option_d,correct_option";
    const rows = cards.map((r) => {
      const type = String(r.type || "short").toLowerCase() === "mcq" ? "mcq" : "short";
      const cols = [
        r.tag || "General",
        type,
        r.difficulty || "",
        r.question || "",
        type === "mcq" ? "" : r.answer || "",
        r.rationale || "",
        r.option_a || "",
        r.option_b || "",
        r.option_c || "",
        r.option_d || "",
        r.correct_option || ""
      ];
      return cols.map((v) => String(v).replaceAll("\n", " ").trim()).join(",");
    });
    return [header, ...rows].join("\n");
  }

  function importSeverity(status) {
    if (status === "fail") return 4;
    if (status === "skip") return 3;
    if (status === "warn") return 2;
    return 1;
  }

  function mergeImportStatus(a, b) {
    return importSeverity(b) > importSeverity(a) ? b : a;
  }

  return {
    cleanImportText,
    sanitizeQuestionCard,
    parseCsv,
    parseExcelArrayBuffer,
    formatCardsForTextarea,
    getLastImportMeta: () => ({ ...lastImportMeta, mappings: [...(lastImportMeta.mappings || [])] }),
    importSeverity,
    mergeImportStatus
  };
})();
