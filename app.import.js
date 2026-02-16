window.PBL_IMPORT = (() => {
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

  function sanitizeQuestionCard(card) {
    const typeRaw = cleanImportText(card.type || "short").toLowerCase();
    const type = typeRaw === "mcq" ? "mcq" : "short";
    const cleanOption = (v) => cleanImportText(v || "");
    return {
      tag: cleanImportText(card.tag || "General"),
      type,
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

  function parseRowsMatrix(rows) {
    if (!Array.isArray(rows) || !rows.length) return [];
    const header = rows[0].map((x) => cleanImportText(x).toLowerCase());
    const headerMap = {};
    header.forEach((name, idx) => {
      headerMap[name] = idx;
    });

    const hasNamedHeader = header.includes("question") && (header.includes("answer") || header.includes("option_a"));
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
      const tag = getByName(row, ["tag", "tags", "category", "topic"], 0) || "General";
      const type = (getByName(row, ["type"], 1) || (hasNamedHeader ? "short" : "")).toLowerCase();
      const question = getByName(row, ["question"], hasNamedHeader ? -1 : 1);
      const answer = getByName(row, ["answer"], hasNamedHeader ? -1 : 2);
      const rationale = getByName(row, ["rationale", "explanation"], -1);
      const optionA = getByName(row, ["option_a", "optiona", "a"], -1);
      const optionB = getByName(row, ["option_b", "optionb", "b"], -1);
      const optionC = getByName(row, ["option_c", "optionc", "c"], -1);
      const optionD = getByName(row, ["option_d", "optiond", "d"], -1);
      const correctOption = getByName(row, ["correct_option", "correctoption", "correct"], -1).toUpperCase();

      return {
        tag,
        type: type === "mcq" ? "mcq" : "short",
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

  function parseCsv(text) {
    const clean = cleanImportText(text);
    const lines = clean
      .split(/\r?\n/)
      .map((line) => cleanImportText(line))
      .filter(Boolean);

    if (!lines.length) return [];

    const delimiter = detectDelimiter(lines[0]);
    const rows = lines.map((line) => parseDelimitedLine(line, delimiter));
    return parseRowsMatrix(rows);
  }

  function parseExcelArrayBuffer(buffer) {
    if (!window.XLSX) throw new Error("Excel parser unavailable");
    const workbook = window.XLSX.read(buffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return [];
    const sheet = workbook.Sheets[firstSheetName];
    const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
    return parseRowsMatrix(rows);
  }

  function formatCardsForTextarea(cards) {
    const header = "tag,type,question,answer,rationale,option_a,option_b,option_c,option_d,correct_option";
    const rows = cards.map((r) => {
      const type = String(r.type || "short").toLowerCase() === "mcq" ? "mcq" : "short";
      const cols = [
        r.tag || "General",
        type,
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
    importSeverity,
    mergeImportStatus
  };
})();
