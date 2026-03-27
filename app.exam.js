
function clearExamTimer() {
  if (state.exam.timerId) {
    clearInterval(state.exam.timerId);
    state.exam.timerId = null;
  }
}

function finishExam(reason) {
  if (!state.exam.inProgress) return;

  clearExamTimer();
  const attempted = state.exam.answered;
  const score = attempted ? Math.round((state.exam.correct / attempted) * 100) : 0;
  const passThreshold = Math.min(100, Math.max(1, Number(state.exam.passThreshold || state.examConfig.passThreshold || 80)));
  const passed = score >= passThreshold;
  const blueprintNote = state.exam.blueprintName ? ` (${state.exam.blueprintName})` : "";
  const avgExamSeconds = state.exam.attemptedTotal
    ? state.exam.totalAnswerTimeMs / state.exam.attemptedTotal / 1000
    : 0;
  const avgExamLabel = state.exam.attemptedTotal ? formatSeconds(avgExamSeconds) : "--";

  if (reason === "time") {
    setStatus(
      dom.examStatus,
      `Time up. Exam finished${blueprintNote} with ${score}% (${passed ? "PASS" : "FAIL"}, threshold ${passThreshold}%).`,
      passed ? "success" : "error"
    );
  } else if (reason === "completed") {
    setStatus(
      dom.examStatus,
      `Exam completed${blueprintNote}. Final score: ${score}% (${passed ? "PASS" : "FAIL"}, threshold ${passThreshold}%).`,
      passed ? "success" : "error"
    );
  } else {
    setStatus(
      dom.examStatus,
      `Exam stopped${blueprintNote}. Current score: ${score}% (${passed ? "PASS" : "FAIL"}, threshold ${passThreshold}%).`
    );
  }

  state.exam.inProgress = false;
  state.exam.paused = false; // Reset pause state
  setExamControlsLocked(false); // Unlock controls
  clearExamTimer();
  state.exam.queueIds = [];
  state.exam.cursor = 0;
  state.exam.skippedIds = [];
  state.exam.reviewingSkipped = false;

  // Show Modal
  const resultOverlay = document.createElement("div");
  resultOverlay.className = "exam-result-overlay";
  // Build quick topic breakdown from session stats
  const catStats = state.session.categoryStats || {};
  const topicRows = Object.keys(catStats)
    .filter((k) => catStats[k]?.attempted > 0)
    .map((k) => ({
      tag: k,
      acc: Math.round((catStats[k].correct / catStats[k].attempted) * 100),
      attempted: catStats[k].attempted
    }))
    .sort((a, b) => a.acc - b.acc);
  const weakTopicsHtml = topicRows.length > 0
    ? `<div class="result-topics">
        <p class="result-detail" style="font-weight:600;margin-bottom:4px">Topic Breakdown:</p>
        ${topicRows.slice(0, 5).map((t) =>
          `<p class="result-topic-row" style="font-size:0.82rem;margin:2px 0">
            <span style="color:${t.acc >= 70 ? "#15803d" : t.acc >= 50 ? "#b45309" : "#dc2626"}">${t.acc}%</span>
            &nbsp;${escapeHtml(t.tag)} <span style="color:#888">(${t.attempted}q)</span>
          </p>`
        ).join("")}
      </div>`
    : "";

  resultOverlay.innerHTML = `
    <div class="exam-result-card ${passed ? "pass" : "fail"}">
      <h2>Exam Completed</h2>
      <div class="result-score">${score}%</div>
      <p class="result-status">${passed ? "PASSED" : "FAILED"}</p>
      <p class="result-detail">Correct: ${state.exam.correct} | Wrong: ${state.exam.wrong} | Attempted: ${attempted}</p>
      <p class="result-detail">Avg Time/Question: ${avgExamLabel}</p>
      <p class="result-note">Threshold: ${passThreshold}%</p>
      ${weakTopicsHtml}
      <div class="result-actions">
        <button class="primary-btn" onclick="window.location.reload()">Return to Dashboard</button>
        <button class="ghost-btn" onclick="exportPdfReport();this.textContent='Downloading...';this.disabled=true" style="margin-top:8px">Download Full Report</button>
      </div>
    </div>
  `;
  document.body.appendChild(resultOverlay);

  // Clean up UI behind modal
  dom.flashcard.classList.add("blurred");
  dom.examPanel.classList.add("hidden");
  state.exam.remainingSeconds = 0;
  state.exam.answered = 0;
  state.exam.correct = 0;
  state.exam.wrong = 0;
  state.exam.passThreshold = state.examConfig.passThreshold;
  state.exam.strictTiming = state.examConfig.strictTiming;
  state.exam.blueprintName = "";
  state.exam.shuffleSeed = "";
  state.currentCardIndex = 0;
  state.awaitingNext = false;

  updateExamStatusUI();
  dom.flashcard.classList.remove("paused-hidden"); // Ensure visibility
  const overlay = document.querySelector(".paused-overlay");
  if (overlay) overlay.remove();

  renderCard();
}

function togglePauseExam() {
  if (!state.exam.inProgress) return;
  state.exam.paused = !state.exam.paused;

  if (state.exam.paused) {
    clearExamTimer();
    dom.pauseExamBtn.textContent = "Resume";
    // Add overlay
    const overlay = document.createElement("div");
    overlay.className = "paused-overlay";
    overlay.innerHTML = `
      <h3>Exam Paused</h3>
      <p>Click Resume to continue.</p>
      <button class="primary-btn" onclick="document.dispatchEvent(new CustomEvent('resume-exam-trigger'))">Resume Exam</button>
    `;
    dom.flashcard.appendChild(overlay);

    // Quick helper to catch the resume click from overlay
    document.addEventListener('resume-exam-trigger', togglePauseExam, { once: true });
  } else {
    startExamTimer();
    dom.pauseExamBtn.textContent = "Pause";
    const overlay = document.querySelector(".paused-overlay");
    if (overlay) overlay.remove();
  }
}

function startExamTimer() {
  if (!state.exam.strictTiming || state.exam.paused) return; // Don't start if paused
  clearExamTimer();
  state.exam.timerId = setInterval(() => {
    state.exam.remainingSeconds -= 1;
    if (state.exam.remainingSeconds <= 0) {
      state.exam.remainingSeconds = 0;
      updateExamStatusUI();
      finishExam("time");
      return;
    }
    updateExamStatusUI();
  }, 1000);
}

// MCQ option shuffle helpers
const ANCHORED_OPTION_PATTERN = /\b(all|none|both)\b.*\babove\b|\b[a-d]\s+and\s+[a-d]\b/i;

function shouldShuffleMcqOptions(options) {
  return !options.some((opt) => ANCHORED_OPTION_PATTERN.test(String(opt || "")));
}

function getShuffledMcqRender(card) {
  const options = Array.isArray(card.options) ? [...card.options] : [];
  if (options.length < 2 || !shouldShuffleMcqOptions(options)) {
    return { options, correctOption: card.correctOption };
  }
  const seed = `${state.session.shuffleSeed || ""}|mcqrender|${card.id}`;
  const rng = createSeededRng(seed);
  const originalCorrectIdx = card.correctOption
    ? card.correctOption.toUpperCase().charCodeAt(0) - 65
    : -1;
  const indexed = options.map((opt, i) => ({ opt, i }));
  const shuffled = shuffledCopy(indexed, rng);
  const newOptions = shuffled.map((item) => item.opt);
  const newCorrectIdx = shuffled.findIndex((item) => item.i === originalCorrectIdx);
  const newCorrectOption = newCorrectIdx >= 0
    ? String.fromCharCode(65 + newCorrectIdx)
    : card.correctOption;
  return { options: newOptions, correctOption: newCorrectOption };
}

function hashSeedToInt(seed) {
  let hash = 2166136261;
  const text = String(seed || "");
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRng(seed) {
  let t = hashSeedToInt(seed);
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffledCopy(items, rng = null) {
  const arr = [...items];
  const randomIndex = (max) => {
    if (max <= 0) return 0;
    if (typeof rng === "function") return Math.floor(rng() * max);
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      const buffer = new Uint32Array(1);
      crypto.getRandomValues(buffer);
      return buffer[0] % max;
    }
    return Math.floor(Math.random() * max);
  };

  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function canonicalTagForBlueprint(tag) {
  const key = normalizeTagKey(tag);
  if (key === "OTHER") return String(tag || "").trim();
  return key;
}

function renderBlueprintSelectors() {
  const templates = Array.isArray(state.blueprints.templates) ? state.blueprints.templates : [];
  const options = ['<option value="">Manual</option>'].concat(
    templates.map((tpl) => `<option value="${escapeHtml(tpl.id)}">${escapeHtml(tpl.name)}</option>`)
  );
  dom.examBlueprintSelect.innerHTML = options.join("");
  dom.blueprintTemplateSelect.innerHTML = ['<option value="">Select template</option>']
    .concat(templates.map((tpl) => `<option value="${escapeHtml(tpl.id)}">${escapeHtml(tpl.name)}</option>`))
    .join("");

  if (state.examConfig.blueprintId && templates.some((tpl) => tpl.id === state.examConfig.blueprintId)) {
    dom.examBlueprintSelect.value = state.examConfig.blueprintId;
  } else {
    dom.examBlueprintSelect.value = "";
  }

  // Render Topics
  const topics = [...new Set(state.deck.map(c => normalizeTagKey(c.tag)))].sort();
  dom.examTopicSelect.innerHTML = ['<option value="">Select Topic...</option>']
    .concat(topics.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`))
    .join("");
}

function applyBlueprintConfig(template, override = null) {
  if (!template) return;
  const source = override || template;
  state.examConfig.blueprintId = template.id || "";
  state.examConfig.questionCount = Math.max(1, Number(source.questionCount || template.questionCount || 30));
  state.examConfig.durationMinutes = Math.max(1, Number(source.durationMinutes || template.durationMinutes || 30));
  state.examConfig.passThreshold = Math.min(100, Math.max(1, Number(source.passThreshold || template.passThreshold || 80)));
  state.examConfig.strictTiming = source.strictTiming !== false;

  // Set values (ensure they match available options, or default to nearest)
  if (dom.examQuestionCount) dom.examQuestionCount.value = String(state.examConfig.questionCount);
  if (dom.examDuration) dom.examDuration.value = String(state.examConfig.durationMinutes);
  dom.examPassThreshold.value = String(state.examConfig.passThreshold);
  dom.examPassThreshold.value = String(state.examConfig.passThreshold);
  dom.examStrictTiming.checked = state.examConfig.strictTiming;
  dom.examBlueprintSelect.value = template.id || "";
}

function syncExamControlLock() {
  if (state.exam.inProgress) return; // Do not unlock if exam is running!

  const locked = state.role === "trainee" && Boolean(state.blueprints.assigned);
  dom.examBlueprintSelect.disabled = locked;
  dom.examQuestionCount.disabled = locked;
  dom.examDuration.disabled = locked;
  dom.examPassThreshold.disabled = locked;
  dom.examStrictTiming.disabled = locked;
}

function buildBlueprintQueue(source, template, total) {
  if (!template || !Array.isArray(template.tags) || !template.tags.length) {
    return shuffledCopy(source)
      .slice(0, total)
      .map((card) => card.id);
  }

  const tags = template.tags.map(canonicalTagForBlueprint).filter(Boolean);
  const perTag = Math.max(1, Math.floor(total / tags.length));
  const chosen = [];
  const used = new Set();

  tags.forEach((tag) => {
    const pool = shuffledCopy(source.filter((card) => canonicalTagForBlueprint(card.tag) === tag));
    for (let i = 0; i < pool.length && chosen.length < total && i < perTag; i += 1) {
      if (used.has(pool[i].id)) continue;
      used.add(pool[i].id);
      chosen.push(pool[i].id);
    }
  });

  if (chosen.length < total) {
    const remainder = shuffledCopy(source);
    for (let i = 0; i < remainder.length && chosen.length < total; i += 1) {
      if (used.has(remainder[i].id)) continue;
      used.add(remainder[i].id);
      chosen.push(remainder[i].id);
    }
  }

  return shuffledCopy(chosen.slice(0, total));
}

function shuffleCardsForExam(cards, limit, seed) {
  const rng = seed ? createSeededRng(seed) : null;
  return shuffledCopy(cards, rng).slice(0, limit).map(c => c.id);
}

function startExam() {
  if (isTrialUser()) {
    setStatus(dom.examStatus, trialUpgradeMessage(), "error");
    dom.examPanel.classList.add("hidden");
    return;
  }

  if (!state.session.isActive) {
    setStatus(dom.examStatus, "Start session before exam mode.", "error");
    return;
  }

  if (hasSessionLimitReached()) {
    setStatus(dom.examStatus, `Trial limit reached. ${trialUpgradeMessage()}`, "error");
    return;
  }

  const source = filteredDeck();
  let candidateCards = source; // Default to current filtered deck (e.g. from main category buttons)

  const mode = dom.examModeSelect.value;
  console.log(`[ExamDebug] Starting Exam. Mode: ${mode}`);

  if (mode === "topic") {
    const topic = dom.examTopicSelect.value;
    console.log(`[ExamDebug] Topic Selected: "${topic}"`);
    if (!topic) {
      console.warn("[ExamDebug] No topic selected!");
      setStatus(dom.examStatus, "Select a topic for Topic Master mode.", "error");
      return;
    }
    candidateCards = state.deck.filter(c => normalizeTagKey(c.tag) === normalizeTagKey(topic));
    console.log(`[ExamDebug] Filtered cards for topic: ${candidateCards.length}`);
  } else if (mode === "weakness") {
    // Filter for cards with accuracy < 50%
    candidateCards = state.deck.filter(c => {
      const s = state.session.cardStats[c.id];
      return s && (s.correct / s.attempted) < 0.5;
    });
    if (candidateCards.length < 5) {
      setStatus(dom.examStatus, "Not enough weak cards (min 5) for drill.", "error");
      return;
    }
  }

  if (!candidateCards.length) {
    setStatus(dom.examStatus, "No cards available for selected criteria.", "error");
    return;
  }

  const selectedBlueprintId = String(dom.examBlueprintSelect.value || "").trim();
  const selectedTemplate = state.blueprints.templates.find((tpl) => tpl.id === selectedBlueprintId) || null;

  const requested = Math.max(1, Number(dom.examQuestionCount.value) || state.examConfig.questionCount);
  const minutes = Math.max(1, Number(dom.examDuration.value) || state.examConfig.durationMinutes);
  const passThreshold = Math.min(100, Math.max(1, Number(dom.examPassThreshold.value) || state.examConfig.passThreshold || 80));
  const strictTiming = dom.examStrictTiming.checked;
  const remaining = remainingSessionLimit();
  if (remaining <= 0) {
    setStatus(dom.examStatus, `Session limit reached. ${trialUpgradeMessage()}`, "error");
    return;
  }
  const total = Math.min(requested, candidateCards.length, remaining);
  if (total < requested) {
    setStatus(dom.examStatus, `Exam length adjusted to ${total} due to session limit.`, "error");
  }

  // For Blueprint/Standard, we might just use random or blueprint logic
  // But for Topic/Weakness we shouldn't use blueprint queue logic unless verified.
  // For now, simple random shuffle for Topic/Weakness/Standard
  state.exam.shuffleSeed = `${state.session.shuffleSeed || ""}|exam|${Date.now()}`;
  const queue = shuffleCardsForExam(candidateCards, total, state.exam.shuffleSeed);

  state.exam.inProgress = true;
  state.exam.queueIds = queue;
  state.exam.cursor = 0;
  state.exam.remainingSeconds = minutes * 60;
  state.exam.answered = 0;
  state.exam.correct = 0;
  state.exam.wrong = 0;
  state.exam.attemptedTotal = 0;
  state.exam.totalAnswerTimeMs = 0;
  state.exam.passThreshold = passThreshold;
  state.exam.strictTiming = strictTiming;
  state.exam.blueprintName = selectedTemplate?.name || "";
  state.exam.skippedIds = [];
  state.exam.reviewingSkipped = false;

  state.examConfig.questionCount = requested;
  state.examConfig.durationMinutes = minutes;
  state.examConfig.passThreshold = passThreshold;
  state.examConfig.strictTiming = strictTiming;
  state.examConfig.blueprintId = selectedTemplate?.id || "";

  state.examConfig.strictTiming = strictTiming;
  state.examConfig.blueprintId = selectedTemplate?.id || "";
  state.exam.inProgress = true;
  state.exam.paused = false;

  setExamControlsLocked(true); // Lock controls

  dom.pauseExamBtn.classList.remove("hidden"); // Show pause button
  dom.pauseExamBtn.textContent = "Pause";

  startExamTimer();
  updateExamStatusUI();
  renderCard();
  saveLocal();
}

function stopExam() {
  finishExam("stopped");
}
