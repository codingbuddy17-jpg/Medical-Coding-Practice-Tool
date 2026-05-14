function parseCsvLine(line) {
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
    if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

async function readFileAsImportCards(file) {
  const defaults = {
    tag: String(dom.importDefaultTag?.value || "").trim(),
    type: String(dom.importDefaultType?.value || "short").trim() || "short"
  };
  const name = String(file?.name || "").toLowerCase();
  const isExcel = name.endsWith(".xlsx") || name.endsWith(".xls");

  if (isExcel) {
    const buffer = await file.arrayBuffer();
    return parseExcelArrayBuffer(buffer, defaults);
  }

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let text;
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    text = new TextDecoder("utf-16le").decode(bytes);
  } else if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    text = new TextDecoder("utf-16be").decode(bytes);
  } else {
    text = new TextDecoder("utf-8").decode(bytes);
  }
  return parseCsv(text, defaults);
}

function getImportDefaults() {
  return {
    tag: String(dom.importDefaultTag?.value || "").trim(),
    type: String(dom.importDefaultType?.value || "short").trim() || "short"
  };
}


function renderImportPreview() {
  const active = Boolean(state.importPreview.active);
  if (dom.importPreviewPanel) {
    dom.importPreviewPanel.classList.toggle("hidden", !active);
    dom.importPreviewPanel.style.display = active ? "block" : "none"; // Force visible
  }
  if (!active) {
    if (dom.importPreviewSummary) dom.importPreviewSummary.textContent = "";
    if (dom.importPreviewMappings) {
      dom.importPreviewMappings.classList.add("hidden");
      dom.importPreviewMappings.innerHTML = "";
    }
    dom.importPreviewBody.innerHTML = '<tr><td colspan="8">No preview yet.</td></tr>';
    dom.confirmImportBtn.disabled = true;
    if (dom.importPreviewPageInfo) dom.importPreviewPageInfo.textContent = "Page 1 of 1";
    if (dom.importPreviewPageInput) dom.importPreviewPageInput.value = "";
    if (dom.importPreviewPrevBtn) dom.importPreviewPrevBtn.disabled = true;
    if (dom.importPreviewNextBtn) dom.importPreviewNextBtn.disabled = true;
    return;
  }

  const importMeta = typeof getLastImportMeta === "function" ? getLastImportMeta() : null;
  const summary = state.importPreview.summary || { total: 0, pass: 0, warn: 0, skip: 0, fail: 0 };
  const defaults = importMeta?.defaults || {};
  const defaultNotes = [];
  if (defaults.tag) defaultNotes.push(`tag: ${defaults.tag}`);
  if (defaults.type) defaultNotes.push(`type: ${defaults.type === "mcq" ? "MCQ" : "Short Answer"}`);
  dom.importPreviewSummary.textContent = `Total ${summary.total} rows: ${summary.pass} pass, ${summary.warn} warn, ${summary.skip} skip, ${summary.fail} fail.${defaultNotes.length ? ` Defaults applied — ${defaultNotes.join(", ")}.` : ""}`;
  if (dom.importPreviewMappings) {
    if (importMeta?.mappings?.length) {
      const mappingText = importMeta.mappings
        .map((item) => `<code>${escapeHtml(item.matchedHeader)}</code> -> <code>${escapeHtml(item.canonicalName)}</code>`)
        .join(", ");
      dom.importPreviewMappings.innerHTML = `<strong>Column mappings used</strong>${mappingText}`;
      dom.importPreviewMappings.classList.remove("hidden");
    } else {
      dom.importPreviewMappings.classList.add("hidden");
      dom.importPreviewMappings.innerHTML = "";
    }
  }
  dom.confirmImportBtn.disabled = !state.importPreview.importCards.length;

  const rows = Array.isArray(state.importPreview.rows) ? state.importPreview.rows : [];
  const pageSize = Math.max(1, Number(state.importPreview.pageSize || 120));
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(Math.max(1, Number(state.importPreview.page || 1)), totalPages);
  state.importPreview.page = currentPage;
  const start = (currentPage - 1) * pageSize;
  const topRows = rows.slice(start, start + pageSize);
  if (!topRows.length) {
    dom.importPreviewBody.innerHTML = '<tr><td colspan="8">No rows available.</td></tr>';
    if (dom.importPreviewPageInfo) dom.importPreviewPageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    if (dom.importPreviewPageInput) dom.importPreviewPageInput.value = String(currentPage);
    if (dom.importPreviewPrevBtn) dom.importPreviewPrevBtn.disabled = currentPage <= 1;
    if (dom.importPreviewNextBtn) dom.importPreviewNextBtn.disabled = currentPage >= totalPages;
    return;
  }

  dom.importPreviewBody.innerHTML = topRows
    .map((row) => {
      const status = String(row.status || "pass");
      const reason = Array.isArray(row.reasons) && row.reasons.length ? row.reasons.join("; ") : "-";
      const question = String(row.question || "").slice(0, 140);
      return `<tr>
        <td>${row.rowNumber}</td>
        <td><span class="import-status-pill import-status-${escapeHtml(status)}">${escapeHtml(status)}</span></td>
        <td>${escapeHtml(row.tag || "")}</td>
        <td>${escapeHtml(row.type === "mcq" ? "MCQ" : "Short")}</td>
        <td>${escapeHtml(getDifficultyLabel(row.difficulty || "medium"))}</td>
        <td>${escapeHtml(question)}</td>
        <td>${escapeHtml(reason)}</td>
        <td><button class="ghost-btn danger-btn" onclick="discardPreviewRow(${row.rowNumber})">Discard</button></td>
      </tr>`;
    })
    .join("");

  if (dom.importPreviewPageInfo) dom.importPreviewPageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
  if (dom.importPreviewPageInput) dom.importPreviewPageInput.value = String(currentPage);
  if (dom.importPreviewPrevBtn) dom.importPreviewPrevBtn.disabled = currentPage <= 1;
  if (dom.importPreviewNextBtn) dom.importPreviewNextBtn.disabled = currentPage >= totalPages;
}

function discardPreviewRow(rowId) {
  const rowIdx = state.importPreview.rows.findIndex(r => r.rowNumber === rowId);
  if (rowIdx > -1) {
    // Remove from rows
    state.importPreview.rows.splice(rowIdx, 1);

    // Update summary
    const summary = state.importPreview.summary;
    if (summary) {
      summary.total--;
      // We don't track per-status counts in rows easily without re-calc, so just re-calc summary
    }

    // Re-calc summary based on remaining rows
    const newSummary = { total: 0, pass: 0, warn: 0, skip: 0, fail: 0 };
    state.importPreview.rows.forEach(r => {
      newSummary.total++;
      if (r.status === 'pass') newSummary.pass++;
      else if (r.status === 'warn') newSummary.warn++;
      else if (r.status === 'skip') newSummary.skip++;
      else if (r.status === 'fail') newSummary.fail++;
    });
    state.importPreview.summary = newSummary;

    // Filter cards to remove this one if it was valid/warn
    // The cards array doesn't have rowNumber directly usually, need to correlate
    // For now, simpler to just rely on rows being the source of truth for confirmation
    // Re-generating importCards from rows:
    state.importPreview.importCards = state.importPreview.rows
      .filter(r => (r.status === 'pass' || r.status === 'warn') && r.sanitized)
      .map(r => r.sanitized);

    const totalPages = Math.max(1, Math.ceil(state.importPreview.rows.length / Number(state.importPreview.pageSize || 120)));
    if (state.importPreview.page > totalPages) state.importPreview.page = totalPages;

    renderImportPreview();
  }
}

function clearImportPreview() {
  state.importPreview.active = false;
  state.importPreview.rows = [];
  state.importPreview.summary = null;
  state.importPreview.importCards = [];
  state.importPreview.page = 1;
  renderImportPreview();
}

function buildClientImportPreview(parsed) {
  const rows = [];
  const exactSeen = new Set();
  const nearSeen = new Set();
  const allowedTags = new Set(CATEGORY_OPTIONS.filter((item) => item.key !== "ALL").map((item) => item.key));

  parsed.forEach((raw, idx) => {
    const row = sanitizeQuestionCard(raw);
    const reasons = [];
    let status = "pass";
    const rowNumber = idx + 1;

    if (!row.question) {
      status = "fail";
      reasons.push("Missing question");
    }

    if (row.type === "mcq") {
      const correct = toMcqOptionKey(row.correct_option);
      if (!(row.option_a && row.option_b && row.option_c && row.option_d)) {
        status = "fail";
        reasons.push("MCQ requires options A-D");
      }
      if (!correct) {
        status = "fail";
        reasons.push("MCQ correct_option must be A/B/C/D");
      }
      const options = [row.option_a, row.option_b, row.option_c, row.option_d].map((x) => normalize(x));
      if (new Set(options).size < options.length) {
        status = mergeImportStatus(status, "warn");
        reasons.push("MCQ options look duplicated");
      }
    } else if (!row.answer) {
      status = "fail";
      reasons.push("Short answer missing");
    }

    const tagKeys = getCanonicalTags(row.tag);
    if (!tagKeys.length) {
      status = mergeImportStatus(status, "warn");
      reasons.push("Tag not in configured category list");
    } else if (tagKeys.some((tagKey) => !allowedTags.has(tagKey))) {
      status = mergeImportStatus(status, "warn");
      reasons.push("One or more tags are not currently enabled");
    }

    if (String(row.question || "").length < 15) {
      status = mergeImportStatus(status, "warn");
      reasons.push("Question text is very short");
    }

    const exactKey = questionCompositeKey(row.tag, row.question, row.type === "mcq" ? JSON.stringify([row.option_a, row.option_b, row.option_c, row.option_d, row.correct_option]) : row.answer);
    const nearKey = String(row.question || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    if (exactSeen.has(exactKey)) {
      status = mergeImportStatus(status, "skip");
      reasons.push("Exact duplicate in file");
    } else {
      exactSeen.add(exactKey);
    }

    if (nearSeen.has(nearKey) && nearKey) {
      status = mergeImportStatus(status, "warn");
      reasons.push("Near duplicate in file");
    } else if (nearKey) {
      nearSeen.add(nearKey);
    }

    rows.push({
      rowNumber,
      status,
      reasons,
      tag: row.tag,
      type: row.type,
      difficulty: row.difficulty,
      question: row.question,
      sanitized: row
    });
  });

  return rows;
}

async function prepareImportPreview(parsed) {
  const clientRows = buildClientImportPreview(parsed);
  if (!clientRows.length) {
    setStatus(dom.importStatus, "No valid rows found in input.", "error");
    clearImportPreview();
    return;
  }

  const trainerKey = state.trainerKey || dom.trainerKey.value.trim();
  if (!trainerKey) {
    setStatus(dom.importStatus, "Trainer key required for import preview.", "error");
    clearImportPreview();
    return;
  }

  let serverRows = [];
  try {
    const preview = await apiRequest("/api/questions/import/preview", "POST", {
      trainerKey,
      cards: clientRows.map((row) => encodeCardForCloud(row.sanitized))
    });
    serverRows = Array.isArray(preview.rows) ? preview.rows : [];
  } catch (err) {
    setStatus(dom.importStatus, `Import preview failed: ${err.message}`, "error");
    clearImportPreview();
    return;
  }

  const mergedRows = clientRows.map((row, idx) => {
    const dbRow = serverRows[idx];
    const reasons = [...row.reasons];
    let status = row.status;
    if (dbRow) {
      status = mergeImportStatus(status, dbRow.status || "pass");
      if (Array.isArray(dbRow.reasons)) reasons.push(...dbRow.reasons);
    }
    return {
      rowNumber: row.rowNumber,
      status,
      reasons: Array.from(new Set(reasons.filter(Boolean))),
      tag: row.tag,
      type: row.sanitized?.type || "",
      difficulty: row.sanitized?.difficulty || "",
      question: row.question,
      sanitized: row.sanitized
    };
  });

  const importCards = mergedRows
    .filter((row) => row.status === "pass" || row.status === "warn")
    .map((row) => row.sanitized);
  const summary = mergedRows.reduce(
    (acc, row) => {
      acc.total += 1;
      if (row.status === "pass") acc.pass += 1;
      else if (row.status === "warn") acc.warn += 1;
      else if (row.status === "skip") acc.skip += 1;
      else acc.fail += 1;
      return acc;
    },
    { total: 0, pass: 0, warn: 0, skip: 0, fail: 0 }
  );

  state.importPreview.active = true;
  state.importPreview.rows = mergedRows;
  state.importPreview.summary = summary;
  state.importPreview.importCards = importCards;
  state.importPreview.page = 1;
  renderImportPreview();

  if (!importCards.length) {
    setStatus(dom.importStatus, "Import preview ready. No importable rows (all skipped or failed).", "error");
    return;
  }
  setStatus(dom.importStatus, "Import preview ready. Review and click Confirm Import.", "success");
}

async function confirmImportFromPreview() {
  if (!state.importPreview.active || !state.importPreview.importCards.length) {
    setStatus(dom.importStatus, "No prepared import batch. Generate preview first.", "error");
    return;
  }

  const cards = state.importPreview.importCards;

  if (state.role === "trainer") {
    const trainerKey = state.trainerKey || dom.trainerKey.value.trim();
    if (!trainerKey) {
      setStatus(dom.importStatus, "Trainer key required for cloud import.", "error");
      return;
    }

    try {
      const reviewRows = (state.importPreview.rows || [])
        .filter((row) => row.status === "warn")
        .map((row) => ({
          rowNumber: row.rowNumber,
          tag: row.sanitized?.tag || row.tag,
          question: row.sanitized?.question || row.question,
          answer:
            row.sanitized?.type === "mcq"
              ? JSON.stringify([
                row.sanitized?.option_a || "",
                row.sanitized?.option_b || "",
                row.sanitized?.option_c || "",
                row.sanitized?.option_d || "",
                row.sanitized?.correct_option || ""
              ])
              : row.sanitized?.answer || "",
          reasons: Array.isArray(row.reasons) ? row.reasons : []
        }));
      const result = await apiRequest("/api/questions/import", "POST", {
        trainerKey,
        cards: cards.map(encodeCardForCloud),
        uploadedBy: state.userEmail || state.userName || "trainer",
        reviewRows,
        batchSummary: state.importPreview.summary || null,
        sourceName: "Mentor Deck Manager"
      });
      state.trainerKey = trainerKey;
      await loadDeckFromCloud();
      setStatus(
        dom.importStatus,
        `Cloud import complete: ${result.inserted} inserted, ${result.skipped} skipped. Batch: ${result.batchId || "-"}. Review queued: ${Number(result.reviewQueued || 0)}.`,
        "success"
      );
      clearImportPreview();
      await loadImportReviewQueue();
      await loadImportBatches();
      renderCard();
      saveLocal();
      return;
    } catch (err) {
      setStatus(dom.importStatus, `Cloud import failed: ${err.message}`, "error");
      return;
    }
  }

  state.deck = hydrateCards(cards);
  resetStudyOrder();
  setStatus(dom.importStatus, `Imported ${cards.length} cards locally.`, "success");
  clearImportPreview();
  renderCard();
  saveLocal();
}

function renderImportReviewQueue() {
  const items = Array.isArray(state.importAdmin.reviewItems) ? state.importAdmin.reviewItems : [];
  if (!items.length) {
    dom.importReviewBody.innerHTML = '<tr><td colspan="5">No import review items.</td></tr>';
    return;
  }
  dom.importReviewBody.innerHTML = items
    .map((item) => {
      const status = String(item.status || "");
      const question = String(item.question || "").slice(0, 120);
      const reasons = Array.isArray(item.reasons) && item.reasons.length ? item.reasons.join("; ") : "-";
      const actions =
        status === "open"
          ? `<button class="ghost-btn" data-import-review-action="resolve" data-import-review-id="${escapeHtml(item.id)}">Resolve</button>
             <button class="ghost-btn danger-btn" data-import-review-action="discard" data-import-review-id="${escapeHtml(item.id)}">Discard</button>`
          : `<button class="ghost-btn" data-import-review-action="reopen" data-import-review-id="${escapeHtml(item.id)}">Reopen</button>`;

      return `<tr><td><span class="import-status-pill import-status-${escapeHtml(status)}">${escapeHtml(status)}</span></td><td>${escapeHtml(item.tag || "")}</td><td title="${escapeHtml(item.question)}">${escapeHtml(question)}</td><td>${escapeHtml(reasons)}</td><td>${actions}</td></tr>`;
    })
    .join("");
}

async function loadImportReviewQueue() {
  if (state.role !== "trainer") return;
  const trainerKey = state.trainerKey || dom.trainerKey.value.trim();
  if (!trainerKey) return;
  const status = String(dom.importReviewStatusFilter.value || "");
  const qs = new URLSearchParams();
  if (status) qs.set("status", status);
  try {
    const data = await apiRequest(`/api/import/review?${qs.toString()}`, "GET", null, trainerKey);
    state.importAdmin.reviewItems = Array.isArray(data.items) ? data.items : [];
    renderImportReviewQueue();
    setStatus(dom.importReviewStatus, `Loaded ${state.importAdmin.reviewItems.length} review items.`, "success");
    const openCount = state.importAdmin.reviewItems.filter((i) => String(i.status || "").toLowerCase() === "open").length;
    if (dom.importReviewOpenCount) {
      dom.importReviewOpenCount.textContent = openCount > 0 ? String(openCount) : "";
    }
    updateDashboardWidgets();
  } catch (err) {
    setStatus(dom.importReviewStatus, `Could not load import review queue: ${err.message}`, "error");
    if (dom.importReviewOpenCount) dom.importReviewOpenCount.textContent = "";
  }
}

async function handleImportReviewAction(action, reviewId) {
  if (state.role !== "trainer") return;
  const trainerKey = state.trainerKey || dom.trainerKey.value.trim();
  if (!trainerKey) return;
  try {
    await apiRequest("/api/import/review/action", "POST", {
      trainerKey,
      action,
      reviewId
    });
    await loadImportReviewQueue();
  } catch (err) {
    setStatus(dom.importReviewStatus, `Could not update import review item: ${err.message}`, "error");
  }
}

function exportImportReviewQueueCsv() {
  const items = Array.isArray(state.importAdmin.reviewItems) ? state.importAdmin.reviewItems : [];
  if (!items.length) {
    setStatus(dom.importReviewStatus, "No review rows to export.", "error");
    return;
  }
  const header = "id,status,batch_id,tag,question,answer,reasons,source_row,created_at";
  const rows = items.map((item) => {
    const reasons = Array.isArray(item.reasons) ? item.reasons.join(" | ") : "";
    const createdAt = item.createdAt ? new Date(item.createdAt).toISOString() : "";
    const cols = [
      item.id || "",
      item.status || "",
      item.batchId || "",
      item.tag || "",
      item.question || "",
      item.answer || "",
      reasons,
      item.sourceRowNumber || "",
      createdAt
    ];
    return cols.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",");
  });
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "import-review-queue.csv";
  a.click();
  URL.revokeObjectURL(url);
  setStatus(dom.importReviewStatus, "Import review queue exported.", "success");
}

async function resolveAllImportReviewItems() {
  if (state.role !== "trainer") return;
  const trainerKey = state.trainerKey || dom.trainerKey.value.trim();
  if (!trainerKey) {
    setStatus(dom.importReviewStatus, "Trainer key required.", "error");
    return;
  }
  try {
    const result = await apiRequest("/api/import/review/resolve-all", "POST", {
      trainerKey,
      note: "Bulk resolved from trainer queue."
    });
    await loadImportReviewQueue();
    setStatus(dom.importReviewStatus, `Resolved ${Number(result.updated || 0)} open items.`, "success");
  } catch (err) {
    setStatus(dom.importReviewStatus, `Could not resolve all open items: ${err.message}`, "error");
  }
}

function renderImportBatches() {
  const items = Array.isArray(state.importAdmin.batches) ? state.importAdmin.batches : [];
  if (!items.length) {
    dom.importBatchBody.innerHTML = '<tr><td colspan="7">No import batches loaded.</td></tr>';
    return;
  }
  dom.importBatchBody.innerHTML = items
    .map((item) => {
      const createdAt = item.createdAt ? new Date(item.createdAt).toLocaleString() : "-";
      const status = item.rolledBackAt ? `<span class="import-status-pill import-status-fail">Rolled Back</span>` : `<span class="import-status-pill import-status-pass">Active</span>`;
      return `<tr>
        <td>${escapeHtml(item.id)}</td>
        <td>${Number(item.insertedCount || 0)}</td>
        <td>${Number(item.warnCount || 0)}</td>
        <td>${Number(item.failCount || 0)}</td>
        <td>${Number(item.skippedCount || 0)}</td>
        <td>${escapeHtml(createdAt)}</td>
        <td>${status}</td>
      </tr>`;
    })
    .join("");
}

async function loadImportBatches() {
  if (state.role !== "trainer") return;
  const trainerKey = state.trainerKey || dom.trainerKey.value.trim();
  if (!trainerKey) return;
  try {
    const data = await apiRequest(`/api/import/batches?limit=100`, "GET", null, trainerKey);
    state.importAdmin.batches = Array.isArray(data.batches) ? data.batches : [];
    renderImportBatches();
    setStatus(dom.importBatchStatus, `Loaded ${state.importAdmin.batches.length} batches.`, "success");
  } catch (err) {
    setStatus(dom.importBatchStatus, `Could not load import batches: ${err.message}`, "error");
  }
}

async function rollbackImportBatch() {
  if (state.role !== "trainer") return;
  const trainerKey = state.trainerKey || dom.trainerKey.value.trim();
  const batchId = String(dom.rollbackBatchIdInput.value || "").trim();
  if (!trainerKey || !batchId) {
    setStatus(dom.importBatchStatus, "Trainer key and batch ID are required for rollback.", "error");
    return;
  }
  try {
    const result = await apiRequest("/api/import/batches/rollback", "POST", {
      trainerKey,
      batchId
    });
    setStatus(dom.importBatchStatus, `Rollback complete for ${result.batchId}. Questions disabled: ${result.affected}.`, "success");
    await loadDeckFromCloud();
    renderCard();
    await loadImportBatches();
  } catch (err) {
    setStatus(dom.importBatchStatus, `Rollback failed: ${err.message}`, "error");
  }
}

async function importCsv() {
  if (state.role !== "trainer") return;

  const parsed = parseCsv(dom.csvInput.value, getImportDefaults());
  if (!parsed.length) {
    setStatus(dom.importStatus, "No valid cards. Use tag,type,question,... format or legacy tag,question,answer.", "error");
    return;
  }

  const importMeta = typeof getLastImportMeta === "function" ? getLastImportMeta() : null;
  if (importMeta?.mappings?.length) {
    const mappingText = importMeta.mappings
      .slice(0, 4)
      .map((item) => `${item.matchedHeader} -> ${item.canonicalName}`)
      .join(", ");
    setStatus(dom.importStatus, `Recognized alternate headers: ${mappingText}.`, "success");
  }

  await prepareImportPreview(parsed);
}

async function importCsvFile() {
  if (state.role !== "trainer") return;
  const file = dom.csvFileInput.files?.[0];

  if (!file) {
    setStatus(dom.importStatus, "Choose a file first.", "error");
    return;
  }

  setStatus(dom.importStatus, "Reading file...", "neutral"); // Processing feedback

  try {
    const parsed = await readFileAsImportCards(file);
    if (!parsed.length) {
      setStatus(dom.importStatus, "File has no valid cards.", "error");
      return;
    }
    const importMeta = typeof getLastImportMeta === "function" ? getLastImportMeta() : null;
    if (importMeta?.mappings?.length) {
      const mappingText = importMeta.mappings
        .slice(0, 5)
        .map((item) => `${item.matchedHeader} -> ${item.canonicalName}`)
        .join(", ");
      setStatus(dom.importStatus, `Headers auto-mapped: ${mappingText}.`, "success");
    }
    dom.csvInput.value = formatCardsForTextarea(parsed);
    await prepareImportPreview(parsed);
    // Explicitly unhide via style if classList fails for some reason
    if (dom.importPreviewPanel) dom.importPreviewPanel.style.display = "block";
  } catch (err) {
    console.error("Import Error:", err);
    setStatus(dom.importStatus, `Error reading file: ${err.message || "Unknown error"}. Use .csv or .xlsx.`, "error");
  }
}

async function loadStarterDeck() {
  if (state.role !== "trainer") return;
  await prepareImportPreview(STARTER_DECK);
  setStatus(dom.importStatus, "Starter deck preview generated. Click Confirm Import.", "success");
}

function exportCsv() {
  if (state.role !== "trainer") return;
  if (!state.deck.length) {
    setStatus(dom.importStatus, "Deck is empty.", "error");
    return;
  }

  const header = "tag,type,difficulty,question,answer,rationale,option_a,option_b,option_c,option_d,correct_option";
  const rows = state.deck.map((card) =>
    [
      card.tag,
      card.type || "short",
      card.difficulty || "",
      card.question,
      card.type === "mcq" ? "" : card.answer,
      card.rationale || "",
      card.type === "mcq" ? card.options?.[0] || "" : "",
      card.type === "mcq" ? card.options?.[1] || "" : "",
      card.type === "mcq" ? card.options?.[2] || "" : "",
      card.type === "mcq" ? card.options?.[3] || "" : "",
      card.type === "mcq" ? card.correctOption || "" : ""
    ]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(",")
  );

  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "medical-coding-flashcards.csv";
  a.click();
  URL.revokeObjectURL(url);
  setStatus(dom.importStatus, "Deck exported.", "success");
}

function addResource() {
  if (state.role !== "trainer") return;

  const title = dom.resourceTitle.value.trim();
  const url = sanitizeUrl(dom.resourceUrl.value);

  if (!title || !url) {
    setStatus(dom.resourceStatus, "Enter both title and URL.", "error");
    return;
  }

  try {
    new URL(url);
  } catch {
    setStatus(dom.resourceStatus, "Invalid URL.", "error");
    return;
  }

  state.resources.push({ title, url });
  dom.resourceTitle.value = "";
  dom.resourceUrl.value = "";
  renderResources();
  saveLocal();
  setStatus(dom.resourceStatus, "Resource added.", "success");
}

function removeResource(index) {
  if (state.role !== "trainer") return;
  if (!Number.isInteger(index) || index < 0 || index >= state.resources.length) return;

  state.resources.splice(index, 1);
  renderResources();
  saveLocal();
  setStatus(dom.resourceStatus, "Resource removed.", "success");
}

let _sessionPollTimer = null;

function startSessionPoll() {
  if (_sessionPollTimer) return;
  _sessionPollTimer = setInterval(() => {
    if (state.role === "trainer" && state.trainerKey) loadSessions(true);
  }, 60000);
}

function stopSessionPoll() {
  if (_sessionPollTimer) { clearInterval(_sessionPollTimer); _sessionPollTimer = null; }
}

async function loadSessions(silent = false) {
  if (state.role !== "trainer") return;

  const trainerKey = state.trainerKey;
  if (!trainerKey) {
    if (!silent) setStatus(dom.sessionLoadStatus, "Enter trainer key.", "error");
    return;
  }
  try {
    const prevCount = state.sessionConsole.all.length;
    const data = await apiRequest(`/api/sessions`, "GET", null, trainerKey);
    state.sessionConsole.all = Array.isArray(data.sessions) ? data.sessions : [];
    renderSessionConsoleTable();
    const total = state.sessionConsole.all.length;
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const lastRefreshedEl = document.getElementById("sessionLastRefreshed");
    if (lastRefreshedEl) lastRefreshedEl.textContent = `Updated ${now}`;
    if (silent) {
      const diff = total - prevCount;
      if (diff > 0) setStatus(dom.sessionLoadStatus, `${diff} new session(s) detected — ${now}`, "success");
    } else {
      const totalLabel = data.total && data.total > total ? ` (showing ${total} of ${data.total})` : "";
      setStatus(dom.sessionLoadStatus, `Loaded ${total} sessions${totalLabel}.`, "success");
    }
    if (dom.sessionConsoleSummary) dom.sessionConsoleSummary.textContent = total > 0 ? String(total) : "";
  } catch (err) {
    if (!silent) setStatus(dom.sessionLoadStatus, `Could not load sessions: ${err.message}`, "error");
    if (dom.sessionConsoleSummary) dom.sessionConsoleSummary.textContent = "";
  }
}

async function loadQuestionBank() {
  if (state.role !== "trainer") return;
  const trainerKey = state.trainerKey || dom.trainerKey.value.trim();
  if (!trainerKey) {
    setStatus(dom.questionBankStatus, "Trainer key required.", "error");
    return;
  }

  const tag = dom.questionBankTagFilter.value || "";
  const qs = new URLSearchParams({ trainerKey });
  if (tag) qs.set("tag", tag);

  try {
    const data = await apiRequest(`/api/questions?${qs.toString()}`);
    state.questionBank.all = (Array.isArray(data.questions) ? data.questions : []).map((question) => {
      const embedded = decodeEmbeddedCard(question.answer || "");
      const packedShort = decodePackedShortCard(question.answer || "");
      const options = embedded?.options || [];
      return {
        ...question,
        type: embedded?.type || packedShort?.type || question.type || "short",
        difficulty: normalizeDifficultyKey(
          question.difficulty || embedded?.difficulty || packedShort?.difficulty || inferDifficultyFromCard({
            question: question.question,
            rationale: embedded?.rationale || packedShort?.rationale || "",
            options
          }),
          "medium"
        )
      };
    });
    state.questionBank.selectedIds = new Set();
    renderQuestionBankTable();
    setStatus(dom.questionBankStatus, `Loaded ${state.questionBank.all.length} questions.`, "success");
  } catch (err) {
    setStatus(dom.questionBankStatus, `Could not load question bank: ${err.message}`, "error");
  }
}

function filteredQuestionsForBank() {
  const search = String(dom.questionBankSearchInput.value || "").trim().toLowerCase();
  let questions = state.questionBank.all || [];

  if (search) {
    questions = questions.filter(q =>
      String(q.question || "").toLowerCase().includes(search) ||
      String(q.tag || "").toLowerCase().includes(search)
    );
  }
  return questions;
}

function updateQuestionBankSelectionUI(visibleIds = []) {
  const selected = state.questionBank.selectedIds || new Set();
  const selectedCount = selected.size;
  if (dom.questionBankSelectedCount) {
    dom.questionBankSelectedCount.textContent = `${selectedCount} selected`;
  }
  if (dom.questionBankSelectAll) {
    if (!visibleIds.length) {
      dom.questionBankSelectAll.checked = false;
      dom.questionBankSelectAll.indeterminate = false;
      return;
    }
    const selectedVisible = visibleIds.filter((id) => selected.has(id)).length;
    dom.questionBankSelectAll.checked = selectedVisible > 0 && selectedVisible === visibleIds.length;
    dom.questionBankSelectAll.indeterminate = selectedVisible > 0 && selectedVisible < visibleIds.length;
  }
}

function renderQuestionBankTable() {
  const questions = filteredQuestionsForBank();
  if (!questions.length) {
    dom.questionBankBody.innerHTML = '<tr><td colspan="6">No active questions found.</td></tr>';
    updateQuestionBankSelectionUI([]);
    return;
  }

  const visible = questions.slice(0, 100);
  const selected = state.questionBank.selectedIds || new Set();
  dom.questionBankBody.innerHTML = visible.map(q => {
    const shortQ = String(q.question || "").slice(0, 80);
    const embedded = decodeEmbeddedCard(q.answer || "");
    const packedShort = decodePackedShortCard(q.answer || "");
    const isMcq = embedded?.type === "mcq" || String(q.type || "").toLowerCase() === "mcq";
    const typeLabel = isMcq ? "mcq" : (packedShort?.type || q.type || "short");
    const answerLabel = isMcq
      ? `${embedded?.correctOption || ""}`.trim()
      : String(packedShort?.answer || q.answer || "");
    return `<tr>
      <td><input type="checkbox" data-bank-select="${escapeHtml(q.id)}" ${selected.has(q.id) ? "checked" : ""}></td>
      <td>${escapeHtml(formatTagLabels(q.tag || "General"))}</td>
      <td title="${escapeHtml(q.question)}">${escapeHtml(shortQ)}</td>
      <td>${escapeHtml(typeLabel)}</td>
      <td>${escapeHtml(answerLabel)}</td>
      <td>
        <button class="ghost-btn danger-btn" type="button" data-bank-action="delete" data-bank-id="${escapeHtml(q.id)}">Delete</button>
      </td>
    </tr>`;
  }).join("");

  updateQuestionBankSelectionUI(visible.map((q) => q.id));
}

async function deleteQuestion(questionId) {
  if (state.role !== "trainer") return;
  const trainerKey = state.trainerKey || dom.trainerKey.value.trim();
  if (!trainerKey) {
    setStatus(dom.questionBankStatus, "Trainer key required.", "error");
    return;
  }

  if (!window.confirm("Are you sure you want to delete this question? This action cannot be undone easily.")) {
    return;
  }

  try {
    const qs = new URLSearchParams({ trainerKey, id: questionId });
    await apiRequest(`/api/questions?${qs.toString()}`, "DELETE");
    setStatus(dom.questionBankStatus, "Question deleted.", "success");
    if (state.questionBank.selectedIds) state.questionBank.selectedIds.delete(questionId);
    await loadQuestionBank(); // Refresh list
  } catch (err) {
    setStatus(dom.questionBankStatus, `Could not delete question: ${err.message}`, "error");
  }
}

async function bulkUpdateQuestionTags() {
  if (state.role !== "trainer") return;
  const trainerKey = state.trainerKey || dom.trainerKey.value.trim();
  if (!trainerKey) {
    setStatus(dom.questionBankStatus, "Trainer key required.", "error");
    return;
  }
  const ids = Array.from(state.questionBank.selectedIds || []);
  const nextTag = String(dom.questionBankBulkTag?.value || "").trim();
  if (!ids.length) {
    setStatus(dom.questionBankStatus, "Select at least one question.", "error");
    return;
  }
  if (!nextTag) {
    setStatus(dom.questionBankStatus, "Select a tag to apply.", "error");
    return;
  }
  if (!window.confirm(`Update tag to "${nextTag}" for ${ids.length} questions?`)) return;

  try {
    await apiRequest("/api/questions/tag/bulk", "POST", {
      trainerKey,
      ids,
      tag: nextTag
    });
    setStatus(dom.questionBankStatus, `Updated ${ids.length} questions to ${nextTag}.`, "success");
    state.questionBank.selectedIds = new Set();
    if (dom.questionBankSelectAll) dom.questionBankSelectAll.checked = false;
    await loadQuestionBank();
  } catch (err) {
    setStatus(dom.questionBankStatus, `Bulk update failed: ${err.message}`, "error");
  }
}

async function backfillQuestionDifficulties() {
  if (state.role !== "trainer") return;
  const trainerKey = state.trainerKey || dom.trainerKey.value.trim();
  if (!trainerKey) {
    setStatus(dom.questionBankStatus, "Trainer key required.", "error");
    return;
  }
  if (!window.confirm("Run a one-time difficulty backfill for existing active questions? This will label questions as Beginner, Core, or Advanced.")) {
    return;
  }

  try {
    const result = await apiRequest("/api/questions/difficulty/backfill", "POST", { trainerKey });
    setStatus(dom.questionBankStatus, `Difficulty backfill complete. Updated ${Number(result.updated || 0)} question(s).`, "success");
    await loadDeckFromCloud();
    await loadQuestionBank();
  } catch (err) {
    setStatus(dom.questionBankStatus, `Difficulty backfill failed: ${err.message}`, "error");
  }
}

function exportQuestionBankCsv() {
  if (state.role !== "trainer") return;
  const questions = filteredQuestionsForBank();
  if (!questions.length) {
    setStatus(dom.questionBankStatus, "No questions to export.", "error");
    return;
  }

  const header = "id,tag,type,difficulty,question,answer";
  const rows = questions.map(q => [
    q.id,
    q.tag || "",
    decodeEmbeddedCard(q.answer || "")?.type === "mcq" ? "mcq" : (decodePackedShortCard(q.answer || "")?.type || q.type || "short"),
    q.difficulty || "",
    q.question || "",
    decodeEmbeddedCard(q.answer || "")?.correctOption || decodePackedShortCard(q.answer || "")?.answer || q.answer || ""
  ].map(v => `"${String(v).replaceAll('"', '""')}"`).join(","));

  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "question-bank-export.csv";
  a.click();
  URL.revokeObjectURL(url);
  setStatus(dom.questionBankStatus, "Question bank exported.", "success");
}

function renderTagRegistryTable() {
  const items = Array.isArray(state.tagRegistry) ? state.tagRegistry : [];
  if (!dom.tagRegistryBody) return;
  if (!items.length) {
    dom.tagRegistryBody.innerHTML = '<tr><td colspan="6">No tags configured.</td></tr>';
    return;
  }
  dom.tagRegistryBody.innerHTML = items.map((item) => {
    const usage = item.usage || { total: 0, questionUsage: 0, tenantUsage: 0, templateUsage: 0 };
    const actions = `<button type="button" class="ghost-btn" data-tag-action="edit" data-tag-key="${escapeHtml(item.key)}">Edit</button>
      <button type="button" class="ghost-btn" data-tag-action="merge" data-tag-key="${escapeHtml(item.key)}">Merge</button>
      <button type="button" class="ghost-btn ${item.isActive === false ? '' : 'danger-btn'}" data-tag-action="toggle" data-tag-key="${escapeHtml(item.key)}">${item.isActive === false ? 'Activate' : 'Deactivate'}</button>
      <button type="button" class="ghost-btn danger-btn" data-tag-action="delete" data-tag-key="${escapeHtml(item.key)}">Delete</button>`;
    return `<tr>
      <td>${escapeHtml(item.label || item.key)}</td>
      <td><code>${escapeHtml(item.key)}</code></td>
      <td>${escapeHtml((item.aliases || []).join(', ') || '-')}</td>
      <td>${item.isActive === false ? 'Inactive' : 'Active'}</td>
      <td>${usage.total || 0}</td>
      <td>${actions}</td>
    </tr>`;
  }).join('');
}

function clearTagForm() {
  if (dom.tagFormMode) dom.tagFormMode.textContent = 'Create Tag';
  if (dom.tagFormKey) { dom.tagFormKey.value = ''; dom.tagFormKey.disabled = false; }
  if (dom.tagFormLabel) dom.tagFormLabel.value = '';
  if (dom.tagFormAliases) dom.tagFormAliases.value = '';
  if (dom.tagFormActive) dom.tagFormActive.value = 'true';
}

function populateTagForm(tagKey) {
  const item = (state.tagRegistry || []).find((tag) => tag.key === tagKey);
  if (!item) return;
  if (dom.tagFormMode) dom.tagFormMode.textContent = `Edit ${item.label || item.key}`;
  if (dom.tagFormKey) { dom.tagFormKey.value = item.key || ''; dom.tagFormKey.disabled = true; }
  if (dom.tagFormLabel) dom.tagFormLabel.value = item.label || '';
  if (dom.tagFormAliases) dom.tagFormAliases.value = Array.isArray(item.aliases) ? item.aliases.join(', ') : '';
  if (dom.tagFormActive) dom.tagFormActive.value = item.isActive === false ? 'false' : 'true';
}

async function loadTagRegistryManager(silent = false) {
  if (state.role !== 'trainer') return;
  const trainerKey = state.trainerKey || dom.trainerKey.value.trim();
  if (!trainerKey) {
    if (!silent) setStatus(dom.tagRegistryStatus, 'Trainer key required.', 'error');
    return;
  }
  try {
    const data = await apiRequest('/api/trainer/tags', 'GET', null, trainerKey);
    setTagRegistry(Array.isArray(data.tags) ? data.tags : []);
    renderTagRegistryTable();
    renderCategoryButtons();
    renderQuestionBankTable();
    if (!silent) setStatus(dom.tagRegistryStatus, `Loaded ${state.tagRegistry.length} tags.`, 'success');
  } catch (err) {
    if (!silent) setStatus(dom.tagRegistryStatus, `Could not load tags: ${err.message}`, 'error');
  }
}

async function saveTagDefinition() {
  if (state.role !== 'trainer') return;
  const trainerKey = state.trainerKey || dom.trainerKey.value.trim();
  if (!trainerKey) {
    setStatus(dom.tagRegistryStatus, 'Trainer key required.', 'error');
    return;
  }
  const key = String(dom.tagFormKey?.value || '').trim();
  const label = String(dom.tagFormLabel?.value || '').trim();
  if (!key || !label) {
    setStatus(dom.tagRegistryStatus, 'Tag key and label are required.', 'error');
    return;
  }
  try {
    const data = await apiRequest('/api/trainer/tags', 'POST', {
      trainerKey,
      key,
      label,
      aliases: String(dom.tagFormAliases?.value || '').split(',').map((item) => item.trim()).filter(Boolean),
      isActive: String(dom.tagFormActive?.value || 'true') !== 'false'
    });
    setTagRegistry(Array.isArray(data.tags) ? data.tags : []);
    renderTagRegistryTable();
    renderCategoryButtons();
    renderQuestionBankTable();
    clearTagForm();
    setStatus(dom.tagRegistryStatus, `Tag "${label}" saved.`, 'success');
  } catch (err) {
    setStatus(dom.tagRegistryStatus, `Could not save tag: ${err.message}`, 'error');
  }
}

async function handleTagRegistryAction(action, tagKey) {
  if (state.role !== 'trainer') return;
  const trainerKey = state.trainerKey || dom.trainerKey.value.trim();
  if (!trainerKey) {
    setStatus(dom.tagRegistryStatus, 'Trainer key required.', 'error');
    return;
  }
  const item = (state.tagRegistry || []).find((tag) => tag.key === tagKey);
  if (!item) {
    setStatus(dom.tagRegistryStatus, 'Tag not found.', 'error');
    return;
  }
  if (action === 'edit') {
    populateTagForm(tagKey);
    return;
  }
  if (action === 'merge') {
    const candidates = (state.tagRegistry || []).filter((tag) => tag.key !== item.key);
    if (!candidates.length) {
      setStatus(dom.tagRegistryStatus, 'No other tags available to merge into.', 'error');
      return;
    }
    const suggestion = candidates[0]?.key || "";
    const targetKey = String(window.prompt(`Merge "${item.label}" into which tag key?\n\nAvailable examples: ${candidates.slice(0, 8).map((tag) => tag.key).join(", ")}`, suggestion) || "").trim();
    if (!targetKey) return;
    if (!window.confirm(`Merge "${item.label}" into "${targetKey}"?\n\nThis will move question references, tenant allowed tags, and blueprint tags to the target tag.`)) return;
    try {
      const data = await apiRequest('/api/trainer/tags/merge', 'POST', {
        trainerKey,
        sourceKey: item.key,
        targetKey
      });
      await loadDeckFromCloud();
      await loadQuestionBank();
      setTagRegistry(Array.isArray(data.tags) ? data.tags : []);
      renderTagRegistryTable();
      renderCategoryButtons();
      renderQuestionBankTable();
      clearTagForm();
      const result = data.result || {};
      setStatus(dom.tagRegistryStatus, `Merged into ${result.targetKey || targetKey}. Updated ${Number(result.updatedQuestions || 0)} question(s).`, 'success');
    } catch (err) {
      setStatus(dom.tagRegistryStatus, `Could not merge tag: ${err.message}`, 'error');
    }
    return;
  }
  if (action === 'toggle') {
    const nextActive = item.isActive === false;
    try {
      const data = await apiRequest('/api/trainer/tags', 'POST', {
        trainerKey,
        key: item.key,
        label: item.label,
        aliases: item.aliases || [],
        isActive: nextActive
      });
      setTagRegistry(Array.isArray(data.tags) ? data.tags : []);
      renderTagRegistryTable();
      renderCategoryButtons();
      renderQuestionBankTable();
      setStatus(dom.tagRegistryStatus, `Tag ${nextActive ? 'activated' : 'deactivated'}.`, 'success');
    } catch (err) {
      setStatus(dom.tagRegistryStatus, `Could not update tag: ${err.message}`, 'error');
    }
    return;
  }
  if (action === 'delete') {
    if (!window.confirm(`Delete tag "${item.label}"? This only works when no questions or tenant settings use it.`)) return;
    try {
      const data = await apiRequest('/api/trainer/tags/delete', 'POST', { trainerKey, key: item.key });
      setTagRegistry(Array.isArray(data.tags) ? data.tags : []);
      renderTagRegistryTable();
      renderCategoryButtons();
      renderQuestionBankTable();
      clearTagForm();
      setStatus(dom.tagRegistryStatus, 'Tag deleted.', 'success');
    } catch (err) {
      setStatus(dom.tagRegistryStatus, `Could not delete tag: ${err.message}`, 'error');
    }
  }
}

function toAccessTypeLabel(role) {
  if (role === "trial") return "Trial Access";
  if (role === "trainee") return "Member Access";
  if (role === "trainer") return "Mentor Console";
  return role || "-";
}

function filteredSessionsForConsole() {
  const search = String(dom.sessionSearchInput.value || "").trim().toLowerCase();
  const role = String(dom.sessionRoleFilter.value || "");
  const windowDays = String(dom.sessionWindowFilter?.value || "all");
  const excludeTrial = Boolean(dom.excludeTrialToggle?.checked);
  const engagedOnly = Boolean(document.getElementById("engagedOnlyToggle")?.checked);
  const now = Date.now();
  const windowMs = windowDays === "all" ? 0 : Number(windowDays) * 24 * 60 * 60 * 1000;
  return (state.sessionConsole.all || []).filter((s) => {
    if (role && String(s.role || "") !== role) return false;
    if (excludeTrial && String(s.role || "") === "trial") return false;
    if (engagedOnly && (Number(s.summary?.attempted || s.attempted || 0) === 0)) return false;
    if (windowMs > 0) {
      const startedAt = Number(new Date(s.startedAt || 0));
      if (!startedAt || now - startedAt > windowMs) return false;
    }
    if (search) {
      const name = String(s.userName || "").toLowerCase();
      if (!name.includes(search)) return false;
    }
    return true;
  });
}

function renderSessionConsoleTable() {
  const sessions = filteredSessionsForConsole();
  if (!sessions.length) {
    dom.sessionTableBody.innerHTML = '<tr><td colspan="8">No sessions found for current filter.</td></tr>';
    updateDashboardWidgets();
    return;
  }

  dom.sessionTableBody.innerHTML = sessions
    .map((s) => {
      const attempted = s.summary?.attempted || 0;
      const correct = s.summary?.correct || 0;
      const wrong = s.summary?.wrong || 0;
      const score = attempted ? Math.round((correct / attempted) * 100) : 0;
      const started = new Date(s.startedAt).toLocaleString();
      const engagedBadge = attempted > 0 ? "" : '<span class="session-zero-badge">No activity</span>';
      const emailPhone = s.userEmail ? escapeHtml(s.userEmail) : (s.userPhone ? escapeHtml(s.userPhone) : "—");
      return `<tr class="${attempted === 0 ? "session-row-inactive" : ""}">
  <td>${escapeHtml(s.userName)}</td>
  <td><span class="session-contact-info">${emailPhone}</span></td>
  <td>${escapeHtml(toAccessTypeLabel(s.role))}</td>
  <td>${attempted}${engagedBadge}</td>
  <td>${correct}</td>
  <td>${wrong}</td>
  <td>${score}%</td>
  <td>${escapeHtml(started)}</td>
</tr>`;
    })
    .join("");

  updateDashboardWidgets();
}

function renderAdminSummary(config, cohorts) {
  if (!dom.adminSummaryLearner) return;
  const accessActive = config?.traineeAccessActive === false ? "Inactive" : "Active";
  const expiry = config?.traineeAccessExpiresAt ? toDateInputValue(config.traineeAccessExpiresAt) : "None";
  dom.adminSummaryLearner.textContent = `${accessActive} · Exp: ${expiry}`;
  dom.adminSummaryTrialLimit.textContent = String(config?.trialQuestionLimit || 20);
  dom.adminSummarySessionLimit.textContent = String(config?.maxSessionQuestions || 250);

  const list = Array.isArray(cohorts) ? cohorts : [];
  const activeCount = list.filter((c) => c.isActive).length;
  dom.adminSummaryCohorts.textContent = `${activeCount}/${list.length}`;

  const soon = list.filter((c) => c.expiresAt && Number(c.expiresAt) < Date.now() + 14 * 24 * 60 * 60 * 1000).length;
  dom.adminSummaryExpiring.textContent = String(soon);
  if (dom.adminSummaryUpdated) {
    const updated = config?.updatedAt ? new Date(Number(config.updatedAt)).toLocaleDateString() : "—";
    dom.adminSummaryUpdated.textContent = updated;
  }
}

function exportSessionsCsv() {
  if (state.role !== "trainer") return;
  const sessions = filteredSessionsForConsole();
  if (!sessions.length) {
    setStatus(dom.sessionLoadStatus, "No session rows to export.", "error");
    return;
  }

  const header = "user,access_type,attempted,correct,wrong,score,started";
  const rows = sessions.map((s) => {
    const attempted = s.summary?.attempted || 0;
    const correct = s.summary?.correct || 0;
    const wrong = s.summary?.wrong || 0;
    const score = attempted ? Math.round((correct / attempted) * 100) : 0;
    const started = new Date(s.startedAt).toISOString();
    return [s.userName || "", toAccessTypeLabel(s.role), attempted, correct, wrong, `${score}%`, started]
      .map((v) => `"${String(v).replaceAll('"', '""')}"`)
      .join(",");
  });

  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mentor-session-console.csv";
  a.click();
  URL.revokeObjectURL(url);
  setStatus(dom.sessionLoadStatus, "Session CSV exported.", "success");
}

async function flagCurrentQuestion() {
  if (state.role === "trainer") return;
  if (!state.session.isActive) {
    setStatus(dom.feedback, "Start a session first.", "error");
    return;
  }
  const card = currentCard();
  if (!card) {
    setStatus(dom.feedback, "No current question to flag.", "error");
    return;
  }

  const reason = window.prompt("Briefly describe the issue with this question (optional):", "") || "";
  try {
    await apiRequest("/api/questions/flag", "POST", {
      sessionId: state.session.id,
      role: state.role,
      userName: state.userName,
      userEmail: state.userEmail,
      questionId: card.id,
      cardTag: card.tag,
      question: card.question,
      expectedAnswer: card.type === "mcq" ? card.correctOption : card.answer,
      reason
    });
    setStatus(dom.feedback, "Question flagged for trainer review.", "success");
  } catch (err) {
    setStatus(dom.feedback, `Could not flag question: ${err.message}`, "error");
  }
}

function renderFlagQueue(flags) {
  const items = Array.isArray(flags) ? flags : [];
  if (!items.length) {
    dom.flagQueueBody.innerHTML = '<tr><td colspan="6">No flagged questions for selected filter.</td></tr>';
    return;
  }

  dom.flagQueueBody.innerHTML = items
    .map((item) => {
      const by = item.raisedBy?.userName || item.raisedBy?.userEmail || "anonymous";
      const role = item.raisedBy?.role || "-";
      const question = String(item.question || "");
      const safeQuestion = question.length > 80 ? `${question.slice(0, 80)}...` : question;
      const reason = String(item.reason || "");
      const safeReason = reason.length > 60 ? `${reason.slice(0, 60)}...` : reason;
      const canAct = item.status === "open";
      const actions = canAct
        ? `<button type="button" class="ghost-btn" data-flag-action="resolve" data-flag-id="${escapeHtml(item.id)}">Resolve</button>
           <button type="button" class="ghost-btn" data-flag-action="replace" data-flag-id="${escapeHtml(item.id)}">Replace</button>
           <button type="button" class="ghost-btn danger-btn" data-flag-action="deactivate" data-flag-id="${escapeHtml(item.id)}">Deactivate</button>`
        : "-";
      return `<tr>
        <td>${escapeHtml(item.cardTag || "-")}</td>
        <td title="${escapeHtml(question)}">${escapeHtml(safeQuestion)}</td>
        <td>${escapeHtml(by)} (${escapeHtml(role)})</td>
        <td title="${escapeHtml(reason)}">${escapeHtml(safeReason || "-")}</td>
        <td>${escapeHtml(item.status || "-")}</td>
        <td>${actions}</td>
      </tr>`;
    })
    .join("");
}

async function loadFlagQueue() {
  if (state.role !== "trainer") return;
  const trainerKey = state.trainerKey;
  if (!trainerKey) {
    setStatus(dom.flagQueueStatus, "Trainer key missing.", "error");
    return;
  }
  const status = String(dom.flagStatusFilter.value || "");
  const qs = new URLSearchParams();
  if (status) qs.set("status", status);
  try {
    const data = await apiRequest(`/api/questions/flags?${qs.toString()}`, "GET", null, trainerKey);
    state.reviewQueue.items = Array.isArray(data.flags) ? data.flags : [];
    renderFlagQueue(state.reviewQueue.items);
    setStatus(dom.flagQueueStatus, `Loaded ${state.reviewQueue.items.length} flagged items.`, "success");
    const openCount = state.reviewQueue.items.filter((i) => String(i.status || "").toLowerCase() === "open").length;
    if (dom.flagQueueOpenCount) {
      dom.flagQueueOpenCount.textContent = openCount > 0 ? String(openCount) : "";
    }
    updateDashboardWidgets();
  } catch (err) {
    setStatus(dom.flagQueueStatus, `Could not load review queue: ${err.message}`, "error");
    if (dom.flagQueueOpenCount) dom.flagQueueOpenCount.textContent = "";
  }
}

function getFlagById(flagId) {
  return (state.reviewQueue.items || []).find((item) => item.id === flagId) || null;
}

async function handleFlagQueueAction(action, flagId) {
  if (state.role !== "trainer") return;
  const trainerKey = state.trainerKey;
  if (!trainerKey) {
    setStatus(dom.flagQueueStatus, "Trainer key missing.", "error");
    return;
  }
  const flag = getFlagById(flagId);
  if (!flag) {
    setStatus(dom.flagQueueStatus, "Flag not found in queue.", "error");
    return;
  }

  if (action === "resolve") {
    try {
      await apiRequest("/api/questions/flags/action", "POST", {
        trainerKey,
        flagId,
        action: "resolve"
      });
      await loadFlagQueue();
      setStatus(dom.flagQueueStatus, "Flag marked as resolved.", "success");
    } catch (err) {
      setStatus(dom.flagQueueStatus, `Resolve failed: ${err.message}`, "error");
    }
    return;
  }

  if (action === "replace") {
    const newQuestion = window.prompt("Enter replacement question:", flag.question || "");
    if (!newQuestion) return;
    const newAnswer = window.prompt("Enter replacement answer:", flag.expectedAnswer || "");
    if (!newAnswer) return;
    const newTag = window.prompt("Enter tag for replacement (optional):", flag.cardTag || "") || flag.cardTag || "General";
    try {
      await apiRequest("/api/questions/flags/action", "POST", {
        trainerKey,
        flagId,
        action: "replace",
        newTag,
        newQuestion,
        newAnswer
      });
      await loadFlagQueue();
      await loadDeckFromCloud();
      renderCard();
      setStatus(dom.flagQueueStatus, "Question replaced and flag closed.", "success");
    } catch (err) {
      setStatus(dom.flagQueueStatus, `Replace failed: ${err.message}`, "error");
    }
    return;
  }

  if (action === "deactivate") {
    const confirmed = window.confirm("Deactivate this question so it no longer appears in future sessions?");
    if (!confirmed) return;
    try {
      await apiRequest("/api/questions/flags/action", "POST", {
        trainerKey,
        flagId,
        action: "deactivate"
      });
      await loadFlagQueue();
      await loadDeckFromCloud();
      renderCard();
      setStatus(dom.flagQueueStatus, "Question deactivated and flag closed.", "success");
    } catch (err) {
      setStatus(dom.flagQueueStatus, `Deactivate failed: ${err.message}`, "error");
    }
  }
}

function renderAnalyticsTables(analytics) {
  const byTag = Array.isArray(analytics?.byTag) ? analytics.byTag : [];
  const trend = Array.isArray(analytics?.trend) ? analytics.trend : [];
  const heatmap = Array.isArray(analytics?.heatmap) ? analytics.heatmap : [];
  const mastery = analytics?.mastery || {};
  const summary = analytics?.summary || {};
  dom.analyticsAttempted.textContent = String(summary.attempted || 0);
  dom.analyticsCorrect.textContent = String(summary.correct || 0);
  dom.analyticsWrong.textContent = String(summary.wrong || 0);
  dom.analyticsScore.textContent = `${Number(summary.score || 0)}%`;
  if (dom.analyticsAvgTime) {
    dom.analyticsAvgTime.textContent =
      summary.avgSeconds && Number.isFinite(summary.avgSeconds) ? formatSeconds(summary.avgSeconds) : "--";
  }
  if (dom.analyticsMastery) dom.analyticsMastery.textContent = `${Number(summary.mastery || mastery.overall || 0)}%`;
  if (dom.analyticsSpeedScore) dom.analyticsSpeedScore.textContent = `${Number(summary.speedScore || mastery.speedScore || 0)}%`;
  if (dom.analyticsConsistency) dom.analyticsConsistency.textContent = `${Number(summary.consistencyScore || mastery.consistencyScore || 0)}%`;
  if (dom.analyticsTopWeakTopics) {
    const weak = Array.isArray(mastery.topWeakTags) ? mastery.topWeakTags : [];
    dom.analyticsTopWeakTopics.textContent = weak.length ? weak.join(", ") : "--";
  }

  if (!byTag.length) {
    dom.analyticsTagBody.innerHTML = '<tr><td colspan="7">No tag analytics for selected filter.</td></tr>';
  } else {
    dom.analyticsTagBody.innerHTML = byTag
      .map(
        (row) =>
          `<tr><td>${escapeHtml(row.tag)}</td><td>${row.attempted}</td><td>${row.correct}</td><td>${row.wrong}</td><td>${row.accuracy}%</td><td>${Number(row.mastery || 0)}%</td><td><span class="analytics-band analytics-band-${escapeHtml(String(row.band || "").toLowerCase().replace(/\s+/g, "-"))}">${escapeHtml(row.band || "--")}</span></td></tr>`
      )
      .join("");
  }

  if (!heatmap.length) {
    if (dom.analyticsHeatmapBody) dom.analyticsHeatmapBody.innerHTML = '<tr><td colspan="7">No mastery heatmap for selected filter.</td></tr>';
  } else if (dom.analyticsHeatmapBody) {
    dom.analyticsHeatmapBody.innerHTML = heatmap
      .map((row) => {
        const bandClass = `analytics-band-${escapeHtml(String(row.band || "").toLowerCase().replace(/\s+/g, "-"))}`;
        const avg = row.avgSeconds && Number.isFinite(row.avgSeconds) ? formatSeconds(row.avgSeconds) : "--";
        return `<tr>
          <td>${escapeHtml(row.tag || "General")}</td>
          <td>${Number(row.mastery || 0)}%</td>
          <td><span class="analytics-band ${bandClass}">${escapeHtml(row.band || "--")}</span></td>
          <td>${Number(row.accuracy || 0)}%</td>
          <td>${Number(row.speedScore || 0)}%</td>
          <td>${Number(row.consistencyScore || 0)}%</td>
          <td>${avg}</td>
        </tr>`;
      })
      .join("");
  }

  if (!trend.length) {
    dom.analyticsTrendBody.innerHTML = '<tr><td colspan="5">No trend data for selected filter.</td></tr>';
  } else {
    dom.analyticsTrendBody.innerHTML = trend
      .map(
        (row) =>
          `<tr><td>${escapeHtml(row.day)}</td><td>${row.attempted}</td><td>${row.correct}</td><td>${row.wrong}</td><td>${row.accuracy}%</td></tr>`
      )
      .join("");
  }
}

function startWeakTopicDrillFromAnalytics() {
  const analytics = state.analytics.lastData || {};
  const weak = Array.isArray(analytics?.mastery?.topWeakTags) ? analytics.mastery.topWeakTags : [];
  const fallback = Array.isArray(state.analytics.lastRecommendations) ? state.analytics.lastRecommendations : [];
  const nextTag = String((weak[0] || fallback[0] || "")).trim();
  if (!nextTag) {
    setStatus(dom.analyticsStatus, "No weak topic available yet. Load analytics with more attempts.", "error");
    return;
  }
  setSelectedTag(nextTag);
  state.weakDrillEnabled = true;
  if (dom.weakDrillToggle) dom.weakDrillToggle.checked = true;
  handleTabSwitch("practice");
  setStatus(dom.analyticsStatus, `Weak drill activated for ${nextTag}.`, "success");
}

function renderAnalyticsCohorts(cohorts) {
  const rows = Array.isArray(cohorts) ? cohorts : [];
  if (!rows.length) {
    dom.analyticsCohortSelect.innerHTML = '<option value="">No cohorts</option>';
    return;
  }

  const options = ['<option value="">Select cohort</option>'].concat(
    rows.map((cohort) => `<option value="${escapeHtml(cohort.id)}">${escapeHtml(cohort.name)}</option>`)
  );
  dom.analyticsCohortSelect.innerHTML = options.join("");
}

async function loadAnalyticsCohorts() {
  if (state.role !== "trainer" || !state.trainerKey) return;
  try {
    const data = await apiRequest(`/api/cohorts`, "GET", null, state.trainerKey);
    renderAnalyticsCohorts(data.cohorts || []);
  } catch {
    renderAnalyticsCohorts([]);
  }
}

async function loadBlueprintTemplates() {
  if (state.role !== "trainer" || !state.trainerKey) {
    state.blueprints.templates = [];
    renderBlueprintSelectors();
    return;
  }
  try {
    const data = await apiRequest(`/api/exam/templates`, "GET", null, state.trainerKey);
    state.blueprints.templates = Array.isArray(data.templates) ? data.templates : [];
    renderBlueprintSelectors();
  } catch {
    state.blueprints.templates = [];
    renderBlueprintSelectors();
  }
}

async function loadAssignedBlueprintForSession() {
  if (!state.session.cohortId) {
    state.blueprints.assigned = null;
    syncExamControlLock();
    return;
  }
  try {
    const data = await apiRequest(`/api/exam/assigned?cohortId=${encodeURIComponent(state.session.cohortId)}`);
    state.blueprints.assigned = data.assignment || null;
    if (state.blueprints.assigned?.template) {
      applyBlueprintConfig(state.blueprints.assigned.template, state.blueprints.assigned);
    }
    syncExamControlLock();
  } catch {
    state.blueprints.assigned = null;
    syncExamControlLock();
  }
}

function onBlueprintTemplateSelectionChange() {
  const templateId = dom.blueprintTemplateSelect.value;
  const template = (state.blueprints.templates || []).find((tpl) => tpl.id === templateId);
  if (!template) return;
  dom.blueprintQuestionCount.value = String(template.questionCount || 30);
  dom.blueprintDuration.value = String(template.durationMinutes || 30);
  dom.blueprintPassThreshold.value = String(template.passThreshold || 80);
  dom.blueprintStrictTiming.checked = template.strictTiming !== false;
}

function onExamBlueprintSelectionChange() {
  const templateId = dom.examBlueprintSelect.value;
  const template = (state.blueprints.templates || []).find((tpl) => tpl.id === templateId);
  if (!template) {
    state.examConfig.blueprintId = "";
    saveLocal();
    return;
  }
  applyBlueprintConfig(template);
  saveLocal();
}

async function assignBlueprintToCohort() {
  if (state.role !== "trainer") return;
  const cohortId = dom.cohortSelect.value;
  const templateId = dom.blueprintTemplateSelect.value;
  if (!cohortId || !templateId) {
    setStatus(dom.blueprintStatus, "Select cohort and blueprint template.", "error");
    return;
  }
  if (!state.trainerKey) {
    setStatus(dom.blueprintStatus, "Trainer key missing. Start trainer session again.", "error");
    return;
  }

  const questionCount = Math.max(1, Number(dom.blueprintQuestionCount.value || 30));
  const durationMinutes = Math.max(1, Number(dom.blueprintDuration.value || 30));
  const passThreshold = Math.min(100, Math.max(1, Number(dom.blueprintPassThreshold.value || 80)));
  const strictTiming = dom.blueprintStrictTiming.checked;

  try {
    await apiRequest("/api/exam/assign", "POST", {
      trainerKey: state.trainerKey,
      cohortId,
      templateId,
      questionCount,
      durationMinutes,
      passThreshold,
      strictTiming
    });
    setStatus(dom.blueprintStatus, "Blueprint assigned to cohort.", "success");
    if (state.session.cohortId && state.session.cohortId === cohortId) {
      await loadAssignedBlueprintForSession();
      renderCard();
      saveLocal();
    }
  } catch (err) {
    setStatus(dom.blueprintStatus, `Could not assign blueprint: ${err.message}`, "error");
  }
}

function setRecommendedTags(tags) {
  const values = Array.isArray(tags) ? tags : [];
  dom.analyticsRecommendedTags.textContent = values.length ? values.join(", ") : "--";
  state.analytics.lastRecommendations = values;
}

async function loadUserAnalytics() {
  if (state.role !== "trainer") return;
  const trainerKey = state.trainerKey;
  const email = dom.analyticsUserEmail.value.trim();
  const days = Number(dom.analyticsDays.value || 30);
  if (!trainerKey) {
    setStatus(dom.analyticsStatus, "Trainer key missing. Start trainer session again.", "error");
    return;
  }
  if (!email) {
    setStatus(dom.analyticsStatus, "Enter user email for analytics.", "error");
    return;
  }
  try {
    const data = await apiRequest(
      `/api/analytics/user?email=${encodeURIComponent(email)}&days=${days}`,
      "GET",
      null,
      trainerKey
    );
    const analytics = data.analytics || {};
    renderAnalyticsTables(analytics);
    setRecommendedTags(data.recommendedTags || []);
    state.analytics.lastScope = "user";
    state.analytics.lastEmail = data.email || email;
    state.analytics.lastCohortName = "";
    state.analytics.lastDays = days;
    state.analytics.lastData = analytics;
    setStatus(dom.analyticsStatus, `Loaded user analytics for ${email}.`, "success");
  } catch (err) {
    setStatus(dom.analyticsStatus, `Could not load user analytics: ${err.message}`, "error");
  }
}

async function loadBatchAnalytics() {
  if (state.role !== "trainer") return;
  const trainerKey = state.trainerKey;
  const cohortId = dom.analyticsCohortSelect.value;
  const days = Number(dom.analyticsDays.value || 30);
  if (!trainerKey) {
    setStatus(dom.analyticsStatus, "Trainer key missing. Start trainer session again.", "error");
    return;
  }
  if (!cohortId) {
    setStatus(dom.analyticsStatus, "Select a cohort.", "error");
    return;
  }
  try {
    const data = await apiRequest(
      `/api/analytics/batch?cohortId=${encodeURIComponent(cohortId)}&days=${days}`,
      "GET",
      null,
      trainerKey
    );
    const analytics = data.analytics || {};
    renderAnalyticsTables(analytics);
    setRecommendedTags(data.recommendedTags || []);
    state.analytics.lastScope = "batch";
    state.analytics.lastEmail = "";
    state.analytics.lastCohortName = data.cohortName || "";
    state.analytics.lastDays = days;
    state.analytics.lastData = analytics;
    setStatus(dom.analyticsStatus, `Loaded batch analytics for ${data.cohortName || "selected cohort"}.`, "success");
  } catch (err) {
    setStatus(dom.analyticsStatus, `Could not load batch analytics: ${err.message}`, "error");
  }
}

async function loadDrillRecommendations() {
  if (state.role !== "trainer") return;
  const trainerKey = state.trainerKey;
  const email = dom.analyticsUserEmail.value.trim();
  const days = Number(dom.analyticsDays.value || 30);
  if (!trainerKey) {
    setStatus(dom.analyticsStatus, "Trainer key missing. Start trainer session again.", "error");
    return;
  }
  if (!email) {
    setStatus(dom.analyticsStatus, "Enter user email to recommend daily drills.", "error");
    return;
  }
  try {
    const data = await apiRequest(
      `/api/analytics/recommendations?email=${encodeURIComponent(email)}&days=${days}&limit=15`,
      "GET",
      null,
      trainerKey
    );
    const tags = data.recommendedTags || [];
    setRecommendedTags(tags);
    if (!tags.length) {
      setStatus(dom.analyticsStatus, "No weak-tag pattern found yet for this user.", "error");
      return;
    }
    setStatus(dom.analyticsStatus, `Daily drill recommendation ready (${tags.join(", ")}).`, "success");
  } catch (err) {
    setStatus(dom.analyticsStatus, `Could not load recommendations: ${err.message}`, "error");
  }
}

function shareTrendByEmail() {
  if (state.role !== "trainer") return;
  const analytics = state.analytics.lastData;
  if (!analytics) {
    setStatus(dom.analyticsStatus, "Load analytics first, then share.", "error");
    return;
  }
  const recipient = state.analytics.lastScope === "user" ? state.analytics.lastEmail : "";
  const scopeLabel =
    state.analytics.lastScope === "batch" ? `Batch: ${state.analytics.lastCohortName || "Cohort"}` : `User: ${recipient}`;
  const summary = analytics.summary || {};
  const topWeak = (state.analytics.lastRecommendations || []).join(", ") || "None";
  const trendLines = (analytics.trend || [])
    .slice(-10)
    .map((row) => `${row.day}: ${row.accuracy}% (${row.correct}/${row.attempted})`)
    .join("\n");

  const subject = `Coding Practice Trend Report (${state.analytics.lastDays}d)`;
  const body = [
    `Hello,`,
    ``,
    `Here is your coding practice trend summary.`,
    `Scope: ${scopeLabel}`,
    `Window: Last ${state.analytics.lastDays} days`,
    `Overall: ${summary.score || 0}% (${summary.correct || 0}/${summary.attempted || 0})`,
    `Recommended Daily Drill Tags: ${topWeak}`,
    ``,
    `Recent Trend:`,
    trendLines || "No trend data.",
    ``,
    `Regards,`,
    `${BRAND_PRODUCT} | ${BRAND_PARENT}`
  ].join("\n");

  const mailto = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = mailto;
}

function exportPdfReport() {
  if (!window.jspdf?.jsPDF) {
    setStatus(dom.sessionStatus, "PDF library not loaded. Refresh and try again.", "error");
    return;
  }
  if (!state.userName) {
    setStatus(dom.sessionStatus, "Start a session before exporting report.", "error");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const attempted = state.session.attempted || 0;
  const correct = state.session.correct || 0;
  const wrong = state.session.wrong || 0;
  const score = attempted ? Math.round((correct / attempted) * 100) : 0;
  const avgSeconds = attempted ? state.session.totalAnswerTimeMs / attempted / 1000 : 0;
  const avgLabel = attempted ? formatSeconds(avgSeconds) : "--";
  const started = state.session.startedAt ? new Date(state.session.startedAt).toLocaleString() : new Date().toLocaleString();
  const generated = new Date().toLocaleString();
  const threshold = Math.min(100, Math.max(1, Number(state.exam.passThreshold || state.examConfig.passThreshold || 80)));
  const examResult = score >= threshold ? "PASS" : "FAIL";
  const skipped = Number(state.session.skipped || 0);
  const answered = Math.max(0, attempted - skipped);
  const completionConsistency = attempted ? Math.round((answered / attempted) * 100) : 0;
  const speedScore = (() => {
    if (!attempted || !avgSeconds) return 50;
    const ratio = avgSeconds / 60;
    if (ratio <= 1) return 100;
    if (ratio >= 2) return 0;
    return Math.round((2 - ratio) * 100);
  })();
  const mastery = Math.round(score * 0.65 + speedScore * 0.25 + completionConsistency * 0.1);

  const drawMetricBar = (label, value, yPos, color = [14, 116, 144]) => {
    const safe = Math.max(0, Math.min(100, Number(value || 0)));
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(9);
    doc.text(`${label}: ${safe}%`, 14, yPos);
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(245, 248, 252);
    doc.roundedRect(68, yPos - 3.7, 124, 4.4, 1.2, 1.2, "FD");
    doc.setFillColor(color[0], color[1], color[2]);
    const width = Math.max(1.5, (124 * safe) / 100);
    doc.roundedRect(68, yPos - 3.7, width, 4.4, 1.2, 1.2, "F");
  };
  const masteryBandMeta = (value) => {
    const scoreVal = Number(value || 0);
    if (scoreVal >= 80) return { label: "Strong", fill: [220, 252, 231], stroke: [134, 239, 172], text: [22, 101, 52] };
    if (scoreVal >= 60) return { label: "Developing", fill: [254, 243, 199], stroke: [252, 211, 77], text: [146, 64, 14] };
    return { label: "At Risk", fill: [254, 226, 226], stroke: [252, 165, 165], text: [153, 27, 27] };
  };

  // Branded header ribbon
  doc.setFillColor(15, 118, 110);
  doc.rect(0, 0, 210, 30, "F");
  doc.setFillColor(0, 163, 217);
  doc.rect(0, 30, 210, 6, "F");

  let y = 13;
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.text(BRAND_PRODUCT, 14, y);
  y += 7;
  doc.setFontSize(10);
  doc.text(BRAND_TAGLINE, 14, y);
  y += 6;
  doc.setFontSize(9);
  doc.text(`${BRAND_PARENT} | ${BRAND_PARENT_TAGLINE}`, 14, y);

  y = 44;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.text("Completion Report", 14, y);
  y += 7;
  doc.setFontSize(10);
  doc.text(`Name: ${state.userName}`, 14, y);
  y += 6;
  doc.text(`Email: ${state.userEmail || "-"}`, 14, y);
  y += 6;
  const roleLabel = String(state.role || "")
    .trim()
    .toLowerCase()
    .replace(/^\w/, (ch) => ch.toUpperCase());
  doc.text(`Role: ${roleLabel || "-"}`, 14, y);
  y += 6;
  doc.text(`Session Started: ${started}`, 14, y);
  y += 6;
  doc.text(`Report Generated: ${generated}`, 14, y);
  y += 9;

  // Score summary box
  doc.setFillColor(237, 247, 245);
  doc.setDrawColor(160, 205, 194);
  const summaryTop = y - 2;
  const summaryHeight = 46;
  doc.roundedRect(14, summaryTop, 182, summaryHeight, 3, 3, "FD");
  const summaryTextX = 18;
  let summaryY = summaryTop + 8;
  doc.text(`Attempted: ${attempted}`, summaryTextX, summaryY);
  summaryY += 6;
  doc.text(`Correct: ${correct}`, summaryTextX, summaryY);
  summaryY += 6;
  doc.text(`Wrong: ${wrong}`, summaryTextX, summaryY);
  summaryY += 6;
  doc.text(`Skipped: ${skipped}`, summaryTextX, summaryY);
  summaryY += 6;
  doc.text(`Score: ${score}%`, summaryTextX, summaryY);
  summaryY += 6;
  doc.text(`Avg Time/Question: ${avgLabel}`, summaryTextX, summaryY);
  summaryY += 6;
  doc.text(`Exam Threshold: ${threshold}% | Result: ${examResult}`, summaryTextX, summaryY);
  y = summaryTop + summaryHeight + 8;

  // Professional performance insight block
  doc.setFontSize(11);
  doc.setTextColor(0, 126, 167);
  doc.text("Performance Insights", 14, y);
  y += 6;
  drawMetricBar("Mastery", mastery, y, [30, 136, 229]);
  y += 6;
  drawMetricBar("Speed Score", speedScore, y, [15, 118, 110]);
  y += 6;
  drawMetricBar("Consistency", completionConsistency, y, [245, 158, 11]);
  y += 7;

  doc.setFontSize(11);
  doc.setTextColor(0, 126, 167);
  doc.text("Topic Mastery Snapshot", 14, y);
  y += 6;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);

  const stats = state.session.categoryStats || {};
  const rows = Object.keys(stats)
    .filter((key) => stats[key]?.attempted > 0)
    .map((key) => {
      const row = stats[key];
      const tagAttempted = Number(row.attempted || 0);
      const tagSkipped = Number(row.skipped || 0);
      const tagAnswered = Math.max(0, tagAttempted - tagSkipped);
      const acc = tagAttempted ? Math.round((Number(row.correct || 0) / tagAttempted) * 100) : 0;
      const avgTagSeconds = Number(row.timedCount || 0) > 0 ? Number(row.totalTimeMs || 0) / Number(row.timedCount || 1) / 1000 : avgSeconds;
      const tagSpeed = (() => {
        if (!avgTagSeconds || !Number.isFinite(avgTagSeconds)) return 50;
        const ratio = avgTagSeconds / 60;
        if (ratio <= 1) return 100;
        if (ratio >= 2) return 0;
        return Math.round((2 - ratio) * 100);
      })();
      const tagConsistency = tagAttempted ? Math.round((tagAnswered / tagAttempted) * 100) : 0;
      const tagMastery = Math.round(acc * 0.65 + tagSpeed * 0.25 + tagConsistency * 0.1);
      return {
        tag: key,
        attempted: tagAttempted,
        correct: Number(row.correct || 0),
        wrong: Number(row.wrong || 0),
        acc,
        avgTagSeconds,
        mastery: tagMastery
      };
    });
  if (!rows.length) {
    rows.push({
      tag: "No attempts recorded yet.",
      attempted: 0,
      correct: 0,
      wrong: 0,
      acc: 0,
      avgTagSeconds: 0,
      mastery: 0
    });
  }

  const weakTopics = rows
    .filter((row) => row.attempted >= 2)
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, 3)
    .map((row) => row.tag);

  if (weakTopics.length) {
    doc.setTextColor(180, 83, 9);
    doc.text(`Top Focus Topics: ${weakTopics.join(", ")}`, 14, y);
    y += 6;
  }
  doc.setTextColor(15, 23, 42);

  // Compact color heatmap block (professional visual snapshot)
  const heatmapRows = rows.filter((row) => row.attempted > 0).sort((a, b) => b.mastery - a.mastery).slice(0, 12);
  if (heatmapRows.length) {
    if (y > 256) {
      doc.addPage();
      y = 18;
    }
    doc.setFontSize(10);
    doc.setTextColor(0, 126, 167);
    doc.text("Topic Heatmap", 14, y);
    y += 6;

    const startX = 14;
    const cellW = 58;
    const cellH = 12;
    const gapX = 4;
    const gapY = 4;
    heatmapRows.forEach((row, idx) => {
      const col = idx % 3;
      const line = Math.floor(idx / 3);
      const x = startX + col * (cellW + gapX);
      const yy = y + line * (cellH + gapY);
      const band = masteryBandMeta(row.mastery);
      const title = row.tag.length > 12 ? `${row.tag.slice(0, 11)}…` : row.tag;

      doc.setFillColor(band.fill[0], band.fill[1], band.fill[2]);
      doc.setDrawColor(band.stroke[0], band.stroke[1], band.stroke[2]);
      doc.roundedRect(x, yy, cellW, cellH, 2, 2, "FD");
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(title, x + 2, yy + 4.4);
      doc.setTextColor(band.text[0], band.text[1], band.text[2]);
      doc.text(`${row.mastery}%`, x + 2, yy + 9.2);
    });
    y += Math.ceil(heatmapRows.length / 3) * (cellH + gapY) + 2;
    doc.setTextColor(15, 23, 42);
  }

  rows.forEach((row) => {
    if (y > 280) {
      doc.addPage();
      y = 18;
    }
    const avgTag = row.attempted ? formatSeconds(row.avgTagSeconds || 0) : "--";
    const line = `${row.tag}: A ${row.attempted}, C ${row.correct}, W ${row.wrong}, Acc ${row.acc}%, Avg ${avgTag}, Mastery ${row.mastery}%`;
    doc.text(line, 14, y);
    y += 5;
  });
  y += 4;
  if (y > 280) {
    doc.addPage();
    y = 18;
  }
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`${BRAND_PRODUCT} | ${CONTACT_PHONE_RAW}`, 14, y);

  const fileName = `coding_report_${(state.userName || "user").replace(/[^a-z0-9]+/gi, "_").toLowerCase()}_${Date.now()}.pdf`;
  doc.save(fileName);
}

function openWhatsAppCta(message, type) {
  const url = buildWhatsappLink(message);
  trackCtaEvent(type, { channel: "whatsapp", message });
  window.open(url, "_blank", "noopener,noreferrer");
}

function openPhoneCta() {
  trackCtaEvent("cta_call_click", { phone: CONTACT_PHONE_RAW });
  window.location.href = `tel:+${CONTACT_PHONE_DIAL}`;
}

function openBrochureCta() {
  trackCtaEvent("cta_brochure_click", { brochureUrl: BROCHURE_URL || "whatsapp_request" });
  if (BROCHURE_URL) {
    window.open(BROCHURE_URL, "_blank", "noopener,noreferrer");
    return;
  }
  openWhatsAppCta("Hello, please share the latest program brochure and fee details.", "cta_brochure_whatsapp_request");
}

function openSyllabusCta() {
  trackCtaEvent("cta_syllabus_click", { syllabusUrl: SYLLABUS_URL || "whatsapp_request" });
  if (SYLLABUS_URL) {
    window.open(SYLLABUS_URL, "_blank", "noopener,noreferrer");
    return;
  }
  openWhatsAppCta("Hello, please share the detailed syllabus PDF for your training program.", "cta_syllabus_whatsapp_request");
}

async function submitCounselingForm(event) {
  event.preventDefault();
  const name = dom.counselName.value.trim();
  const email = dom.counselEmail.value.trim();
  const phone = dom.counselPhone.value.trim();
  const message = dom.counselMessage.value.trim();

  if (!name || !email || !phone) {
    setStatus(dom.upgradeStatus, "Please enter name, email, and phone.", "error");
    return;
  }

  await trackCtaEvent("cta_counseling_request", {
    name,
    email,
    phone,
    message,
    source: "upgrade_wall"
  });
  setStatus(dom.upgradeStatus, "Request submitted. Redirecting to WhatsApp for follow-up.", "success");
  openWhatsAppCta(
    `Hello, I would like a free counseling session. Name: ${name}, Email: ${email}, Phone: ${phone}, Requirement: ${message || "Please guide me with full access and next batch details."
    }`,
    "cta_counseling_whatsapp_followup"
  );
}

async function loadMonetizationInsights() {
  const trainerKey = state.trainerKey || dom.trainerKey?.value?.trim();
  if (!trainerKey) return;
  const el = document.getElementById("monetizationBody");
  const statusEl = document.getElementById("monetizationStatus");
  if (!el && !document.getElementById("monoHotLeadsBody")) return;
  if (statusEl) statusEl.textContent = "Loading...";
  try {
    const data = await apiRequest("/api/monetization/insights", "GET", null, trainerKey);
    const s = data.summary || {};

    // Update funnel widgets
    const setW = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    setW("monoTrialTotal", s.totalTrialUsers || 0);
    setW("monoEngaged", s.engaged || 0);
    setW("monoHotLeads", s.hotLeads || 0);
    setW("monoCTAClicks", s.ctaClicks || 0);
    setW("monoLearnerTotal", s.totalLearnerSessions || 0);

    // Hot leads table
    const hotEl = document.getElementById("monoHotLeadsBody");
    if (hotEl) {
      if ((data.hotLeads || []).length === 0) {
        hotEl.innerHTML = '<tr><td colspan="4">No hot leads yet.</td></tr>';
      } else {
        hotEl.innerHTML = (data.hotLeads || []).map(u => `
          <tr>
            <td>${escapeHtml(u.userName || "")}</td>
            <td>${escapeHtml(u.userEmail || u.userPhone || "—")}</td>
            <td><strong>${u.maxAttempted}</strong> / ${data.trialLimit}</td>
            <td>${u.sessions} session${u.sessions > 1 ? "s" : ""}</td>
          </tr>`).join("");
      }
    }

    // CTA events
    const ctaEl = document.getElementById("monoCTABody");
    if (ctaEl) {
      if ((data.ctaEvents || []).length === 0) {
        ctaEl.innerHTML = '<tr><td colspan="4">No CTA events yet.</td></tr>';
      } else {
        ctaEl.innerHTML = (data.ctaEvents || []).map(e => `
          <tr>
            <td>${escapeHtml(e.type || "")}</td>
            <td>${escapeHtml(e.userName || "")}</td>
            <td>${escapeHtml(e.userEmail || e.userPhone || "—")}</td>
            <td>${new Date(e.at).toLocaleDateString()}</td>
          </tr>`).join("");
      }
    }

    // Returning trial users
    const retEl = document.getElementById("monoReturningBody");
    if (retEl) {
      if ((data.returningTrialUsers || []).length === 0) {
        retEl.innerHTML = '<tr><td colspan="3">No returning trial users yet.</td></tr>';
      } else {
        retEl.innerHTML = (data.returningTrialUsers || []).map(u => `
          <tr>
            <td>${escapeHtml(u.userName || "")}</td>
            <td>${escapeHtml(u.userEmail || u.userPhone || "—")}</td>
            <td>${u.sessions} sessions · ${u.maxAttempted} questions max</td>
          </tr>`).join("");
      }
    }

    if (statusEl) statusEl.textContent = "";
  } catch (err) {
    if (statusEl) statusEl.textContent = `Could not load insights: ${err.message}`;
  }
}

window.loadMonetizationInsights = loadMonetizationInsights;
window.renderAdminSummary = renderAdminSummary;

async function downloadInterviewTemplate() {
  window.open("/assets/interview-questions-template.xlsx", "_blank");
}

async function importInterviewQuestions() {
  const fileInput = document.getElementById("interviewImportFile");
  const file = fileInput?.files?.[0];
  if (!file) {
    setStatus(document.getElementById("interviewImportStatus"), "Please select an Excel file first.", "error");
    return;
  }
  const trainerKey = state.trainerKey || dom.trainerKey?.value?.trim();
  if (!trainerKey) {
    setStatus(document.getElementById("interviewImportStatus"), "Trainer key required.", "error");
    return;
  }

  const statusEl = document.getElementById("interviewImportStatus");
  setStatus(statusEl, "Uploading...", "");

  try {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/interview/import", {
      method: "POST",
      headers: { "X-Trainer-Key": trainerKey },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed");

    let msg = `Imported ${data.imported} questions across ${data.chains} chains.`;
    if (data.skipped > 0) msg += ` ${data.skipped} rows skipped.`;
    setStatus(statusEl, msg, "success");

    if (Array.isArray(data.errors) && data.errors.length > 0) {
      const errEl = document.getElementById("interviewImportErrors");
      if (errEl) {
        errEl.innerHTML = data.errors.map(e => `<li>${escapeHtml(e)}</li>`).join("");
        errEl.closest(".interview-import-errors-wrap")?.classList.remove("hidden");
      }
    }

    fileInput.value = "";
  } catch (err) {
    setStatus(statusEl, `Import failed: ${err.message}`, "error");
  }
}

window.importInterviewQuestions = importInterviewQuestions;
window.downloadInterviewTemplate = downloadInterviewTemplate;
