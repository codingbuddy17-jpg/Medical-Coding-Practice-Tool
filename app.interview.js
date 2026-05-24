/* ==========================================================================
   app.interview.js — Interview Module Engine
   ========================================================================== */

(function() {

const HIRE_THRESHOLD = 75;
const MAYBE_THRESHOLD = 55;

// Interview state
const ivState = {
  active: false,
  track: null,
  specialty: null,
  chains: [],
  currentChainIdx: 0,
  currentQuestionIdx: 0,
  inRemediation: false,
  remediationForQuestion: null,
  answers: [],
  timerInterval: null,
  timeRemaining: 0,
  questionStartedAt: 0,
  sessionStartedAt: 0,
  endedAt: 0
};

let selectedTrack = null;
let selectedSpecialty = null;
let selectedMcqOption = null;

/* ── Setup ── */
function initInterviewListeners() {
  document.getElementById("interviewPanel")?.addEventListener("click", (e) => {
    const trackCard = e.target.closest(".iv-track-card");
    if (trackCard) {
      document.querySelectorAll(".iv-track-card").forEach(c => c.classList.remove("selected"));
      trackCard.classList.add("selected");
      selectedTrack = trackCard.dataset.track;

      // Show specialty section only for experienced
      const specSection = document.getElementById("ivSpecialtySection");
      if (selectedTrack === "experienced") {
        specSection?.classList.remove("hidden");
      } else {
        specSection?.classList.add("hidden");
        selectedSpecialty = null;
        document.querySelectorAll(".iv-specialty-card").forEach(c => c.classList.remove("selected"));
      }
      updateStartBtn();
      return;
    }

    const specCard = e.target.closest(".iv-specialty-card");
    if (specCard) {
      document.querySelectorAll(".iv-specialty-card").forEach(c => c.classList.remove("selected"));
      specCard.classList.add("selected");
      selectedSpecialty = specCard.dataset.specialty;
      updateStartBtn();
      return;
    }

    // MCQ option selection
    const optBtn = e.target.closest(".iv-mcq-option");
    if (optBtn && ivState.active) {
      document.querySelectorAll(".iv-mcq-option").forEach(b => b.classList.remove("selected"));
      optBtn.classList.add("selected");
      selectedMcqOption = optBtn.dataset.option;
      const submitBtn = document.getElementById("ivSubmitBtn");
      if (submitBtn) submitBtn.disabled = false;
      return;
    }

    // Start button
    if (e.target.id === "ivStartBtn" || e.target.closest("#ivStartBtn")) {
      startInterview();
      return;
    }

    // Submit button
    if (e.target.id === "ivSubmitBtn" || e.target.closest("#ivSubmitBtn")) {
      submitAnswer();
      return;
    }

    // Download report
    if (e.target.id === "ivDownloadReportBtn" || e.target.closest("#ivDownloadReportBtn")) {
      downloadInterviewReport();
      return;
    }

    // Retry
    if (e.target.id === "ivRetryBtn" || e.target.closest("#ivRetryBtn")) {
      resetInterview();
      return;
    }

    // Exit module
    if (
      e.target.id === "ivExitSetupBtn" ||
      e.target.id === "ivExitActiveBtn" ||
      e.target.id === "ivExitResultsBtn" ||
      e.target.closest("#ivExitSetupBtn") ||
      e.target.closest("#ivExitActiveBtn") ||
      e.target.closest("#ivExitResultsBtn")
    ) {
      exitInterviewModule();
      return;
    }
  });
}

function updateStartBtn() {
  const btn = document.getElementById("ivStartBtn");
  if (!btn) return;
  const ready = selectedTrack && (selectedTrack !== "experienced" || selectedSpecialty);
  btn.disabled = !ready;
}

/* ── Start Interview ── */
async function startInterview() {
  if (!selectedTrack) return;

  const statusEl = document.getElementById("ivStatusMsg");
  if (statusEl) statusEl.textContent = "Loading interview questions...";

  try {
    const params = new URLSearchParams({ track: selectedTrack });
    if (selectedSpecialty) params.set("specialty", selectedSpecialty);
    const data = await apiRequest(`/api/interview/questions?${params}`, "GET", null, null);
    const chains = Array.isArray(data.chains) ? data.chains : [];

    if (!chains.length) {
      if (statusEl) statusEl.textContent = "No interview questions found for this track. Please try another.";
      return;
    }

    // Reset state
    ivState.active = true;
    ivState.track = selectedTrack;
    ivState.specialty = selectedSpecialty;
    ivState.chains = shuffleArray([...chains]).slice(0, 3); // Use up to 3 chains
    ivState.currentChainIdx = 0;
    ivState.currentQuestionIdx = 0;
    ivState.inRemediation = false;
    ivState.answers = [];
    ivState.sessionStartedAt = Date.now();

    // Switch screens
    document.getElementById("ivSetupScreen")?.classList.add("hidden");
    document.getElementById("ivActiveScreen")?.classList.remove("hidden");
    document.getElementById("ivResultsScreen")?.classList.add("hidden");

    renderCurrentQuestion();
  } catch (err) {
    if (statusEl) statusEl.textContent = `Error loading questions: ${err.message}`;
  }
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ── Render Question ── */
function renderCurrentQuestion() {
  const chain = ivState.chains[ivState.currentChainIdx];
  if (!chain) { endInterview(); return; }

  const questions = chain.questions || [];
  const question = questions[ivState.currentQuestionIdx];
  if (!question) {
    // Advance to next chain
    ivState.currentChainIdx++;
    ivState.currentQuestionIdx = 0;
    ivState.inRemediation = false;
    renderCurrentQuestion();
    return;
  }

  const q = ivState.inRemediation ? question.remediation : question;
  if (!q) {
    advanceQuestion();
    return;
  }

  selectedMcqOption = null;

  // Update scenario
  const scenarioTitle = document.getElementById("ivScenarioTitle");
  const scenarioText = document.getElementById("ivScenarioText");
  const remBanner = document.getElementById("ivRemediationBanner");

  if (scenarioTitle) scenarioTitle.textContent = chain.title || "Interview Scenario";
  if (scenarioText) scenarioText.textContent = chain.scenario || "";
  if (remBanner) remBanner.classList.toggle("hidden", !ivState.inRemediation);

  // Progress
  const totalChains = ivState.chains.length;
  const totalQInChain = questions.length;
  const chainProgress = document.getElementById("ivChainProgress");
  const questionProgress = document.getElementById("ivQuestionProgress");
  if (chainProgress) chainProgress.textContent = `Scenario ${ivState.currentChainIdx + 1} of ${totalChains}`;
  if (questionProgress) questionProgress.textContent = `Question ${ivState.currentQuestionIdx + 1} of ${totalQInChain}${ivState.inRemediation ? " (Follow-up)" : ""}`;

  // Question type badge
  const qtEl = document.getElementById("ivQuestionType");
  if (qtEl) {
    const typeLabel = ivState.inRemediation ? "Follow-up" : formatQuestionType(question.questionType);
    qtEl.textContent = typeLabel;
    qtEl.className = `iv-type-badge iv-type-${ivState.inRemediation ? "followup" : (question.questionType || "general")}`;
  }

  // Question text
  const qtextEl = document.getElementById("ivQuestionText");
  if (qtextEl) qtextEl.textContent = q.question || "";

  // MCQ options
  const optionsEl = document.getElementById("ivMcqOptions");
  if (optionsEl) {
    if (q.isMcq && Array.isArray(q.options)) {
      optionsEl.classList.remove("hidden");
      optionsEl.innerHTML = q.options.map((opt, i) => {
        const letter = String.fromCharCode(65 + i);
        return `<button class="iv-mcq-option" data-option="${letter}" type="button">
          <span class="iv-option-letter">${letter}</span>
          <span class="iv-option-text">${opt}</span>
        </button>`;
      }).join("");
    } else {
      optionsEl.classList.add("hidden");
    }
  }

  // Submit button
  const submitBtn = document.getElementById("ivSubmitBtn");
  if (submitBtn) submitBtn.disabled = true;

  // Start timer
  const timeLimit = 60; // 60 seconds for all tracks
  startTimer(timeLimit);

  ivState.questionStartedAt = Date.now();
}

function formatQuestionType(type) {
  switch(type) {
    case "clinical_knowledge": return "Clinical Knowledge";
    case "coding_accuracy": return "Coding Accuracy";
    case "reasoning": return "Reasoning";
    default: return "General";
  }
}

/* ── Timer ── */
function startTimer(seconds) {
  clearTimer();
  ivState.timeRemaining = seconds;
  updateTimerUI();
  ivState.timerInterval = setInterval(() => {
    ivState.timeRemaining--;
    updateTimerUI();
    if (ivState.timeRemaining <= 0) {
      clearTimer();
      autoSubmitTimeout();
    }
  }, 1000);
}

function clearTimer() {
  if (ivState.timerInterval) { clearInterval(ivState.timerInterval); ivState.timerInterval = null; }
}

function updateTimerUI() {
  const timerEl = document.getElementById("ivTimer");
  const timerBar = document.getElementById("ivTimerBar");
  const chain = ivState.chains[ivState.currentChainIdx];
  const question = chain?.questions?.[ivState.currentQuestionIdx];
  const q = ivState.inRemediation ? question?.remediation : question;
  const totalTime = 60; // 60 seconds for all tracks

  if (timerEl) {
    timerEl.textContent = `${ivState.timeRemaining}s`;
    timerEl.className = "iv-timer";
    if (ivState.timeRemaining <= 30) timerEl.classList.add("danger"); // red at 30s remaining
  }
  if (timerBar) {
    const pct = Math.max(0, (ivState.timeRemaining / totalTime) * 100);
    timerBar.style.width = `${pct}%`;
    timerBar.className = "iv-timer-bar-fill";
    if (ivState.timeRemaining <= 30) timerBar.classList.add("danger"); // red at 30s remaining
  }
}

function autoSubmitTimeout() {
  // Auto-submit with no answer (wrong)
  recordAnswer(null, true);
}

/* ── Submit Answer ── */
function submitAnswer() {
  clearTimer();
  const timeSpent = Math.round((Date.now() - ivState.questionStartedAt) / 1000);
  const chain = ivState.chains[ivState.currentChainIdx];
  const question = chain?.questions?.[ivState.currentQuestionIdx];
  if (!question) return;

  const q = ivState.inRemediation ? question.remediation : question;
  if (!q) return;

  let correct = false;
  if (q.isMcq) {
    correct = selectedMcqOption === q.correctOption;
  } else {
    // Short answer: basic check (case insensitive contains)
    const answerInput = document.getElementById("ivAnswerInput");
    const userAnswer = (answerInput?.value || "").trim().toLowerCase();
    correct = userAnswer.length > 0 && q.answer && q.answer.toLowerCase().includes(userAnswer.substring(0, 10));
  }

  recordAnswer(timeSpent, false, correct, q);
}

function recordAnswer(timeSpent, timedOut, correct, q) {
  correct = correct || false;
  const chain = ivState.chains[ivState.currentChainIdx];
  const question = chain?.questions?.[ivState.currentQuestionIdx];
  if (!question) return;

  const actualQ = ivState.inRemediation ? question.remediation : question;

  // Record answer only for primary questions (not remediation)
  if (!ivState.inRemediation) {
    ivState.answers.push({
      chainId: chain.id,
      chainTitle: chain.title,
      questionId: question.id,
      questionType: question.questionType,
      question: question.question,
      userOption: selectedMcqOption,
      correctOption: actualQ?.correctOption,
      correct,
      timedOut,
      timeSpent: timeSpent || 0,
      rationale: actualQ?.rationale || ""
    });
  }

  if (!correct && !ivState.inRemediation && question.remediation) {
    // Branch to remediation
    ivState.inRemediation = true;
    renderCurrentQuestion();
  } else {
    advanceQuestion();
  }
}

function advanceQuestion() {
  ivState.inRemediation = false;
  ivState.currentQuestionIdx++;
  const chain = ivState.chains[ivState.currentChainIdx];
  if (!chain || ivState.currentQuestionIdx >= (chain.questions || []).length) {
    ivState.currentChainIdx++;
    ivState.currentQuestionIdx = 0;
  }
  if (ivState.currentChainIdx >= ivState.chains.length) {
    endInterview();
  } else {
    renderCurrentQuestion();
  }
}

/* ── End Interview ── */
function endInterview() {
  clearTimer();
  ivState.active = false;
  ivState.endedAt = Date.now();

  document.getElementById("ivActiveScreen")?.classList.add("hidden");
  document.getElementById("ivResultsScreen")?.classList.remove("hidden");

  renderResults();
}

function computeScore() {
  const answers = ivState.answers;
  const total = answers.length;
  const correct = answers.filter(a => a.correct).length;
  const timedOut = answers.filter(a => a.timedOut).length;
  const overall = total ? Math.round((correct / total) * 100) : 0;
  const avgTime = total
    ? Math.round(answers.reduce((sum, a) => sum + Number(a.timeSpent || 0), 0) / total)
    : 0;

  const byType = {};
  answers.forEach(a => {
    const t = a.questionType || "general";
    if (!byType[t]) byType[t] = { correct: 0, total: 0, timeSpent: 0 };
    byType[t].total++;
    if (a.correct) byType[t].correct++;
    byType[t].timeSpent += a.timeSpent || 0;
  });

  const typeScores = {};
  Object.entries(byType).forEach(([t, v]) => {
    typeScores[t] = { pct: v.total ? Math.round((v.correct / v.total) * 100) : 0, ...v };
  });

  let band = "PASS";
  const anyTypeBelowPass = Object.values(typeScores).some(v => v.total > 0 && v.pct < 40);
  if (overall >= HIRE_THRESHOLD && !anyTypeBelowPass) band = "HIRE";
  else if (overall >= MAYBE_THRESHOLD) band = "MAYBE";

  return { overall, total, correct, wrong: total - correct, timedOut, avgTime, byType: typeScores, band };
}

function interviewNarrative(score) {
  if (score.band === "HIRE") {
    return "Strong interview readiness with consistent performance across the evaluated competency areas.";
  }
  if (score.band === "MAYBE") {
    return "Promising baseline with some interview gaps. Focused practice on weaker areas should improve readiness.";
  }
  return "This attempt shows foundational gaps. More guided practice and review are recommended before a live interview setting.";
}

function renderResults() {
  const score = computeScore();

  // Band
  const bandEl = document.getElementById("ivBandLabel");
  if (bandEl) {
    bandEl.textContent = score.band;
    bandEl.className = `iv-band iv-band-${score.band.toLowerCase()}`;
  }

  // Overall score
  const scoreEl = document.getElementById("ivOverallScore");
  if (scoreEl) scoreEl.textContent = `${score.overall}% (${score.correct}/${score.total} correct)`;
  const narrativeEl = document.getElementById("ivScoreNarrative");
  if (narrativeEl) narrativeEl.textContent = interviewNarrative(score);
  const totalEl = document.getElementById("ivTotalQuestions");
  if (totalEl) totalEl.textContent = String(score.total);
  const correctEl = document.getElementById("ivCorrectResponses");
  if (correctEl) correctEl.textContent = String(score.correct);
  const timedOutEl = document.getElementById("ivTimedOutResponses");
  if (timedOutEl) timedOutEl.textContent = String(score.timedOut + Math.max(0, score.wrong - score.timedOut));
  const avgTimeEl = document.getElementById("ivAvgResponseTime");
  if (avgTimeEl) avgTimeEl.textContent = `${score.avgTime}s`;

  // Type breakdown
  const typeEl = document.getElementById("ivTypeBreakdown");
  if (typeEl) {
    const typeEntries = Object.entries(score.byType);
    if (typeEntries.length) {
      typeEl.innerHTML = typeEntries.map(([type, data]) => `
        <div class="iv-type-row">
          <span class="iv-type-label">${formatQuestionType(type)}</span>
          <div class="iv-type-bar-wrap">
            <div class="iv-type-bar-fill" style="width:${data.pct}%"></div>
          </div>
          <span class="iv-type-pct">${data.pct}%</span>
        </div>
      `).join("");
    } else {
      typeEl.innerHTML = "<p>No data available.</p>";
    }
  }

  // Rationale review
  const rationaleEl = document.getElementById("ivRationaleList");
  if (rationaleEl) {
    rationaleEl.innerHTML = ivState.answers.map((a, i) => `
        <div class="iv-rationale-item ${a.correct ? "correct" : "wrong"}">
        <div class="iv-rationale-header">
          <span class="iv-q-num">Q${i + 1}</span>
          <span class="iv-q-chain">${a.chainTitle || ""}</span>
          <span class="iv-q-result ${a.correct ? "correct" : "wrong"}">${a.correct ? "\u2713 Correct" : a.timedOut ? "\u23f1 Timed Out" : "\u2717 Wrong"}</span>
        </div>
        <p class="iv-q-text">${a.question}</p>
        <p class="iv-q-metric">Response time: ${a.timeSpent || 0}s</p>
        <p class="iv-rationale-text">${a.rationale || "No rationale available."}</p>
      </div>
    `).join("");
  }
}

/* ── PDF Report ── */
function downloadInterviewReport() {
  if (!window.jspdf?.jsPDF) {
    alert("PDF library not loaded. Please refresh and try again.");
    return;
  }

  const score = computeScore();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const userName = (typeof state !== "undefined" && state.userName) ? state.userName : "Candidate";
  const trackLabel = { fresher: "Fresher", fresher_certified: "Fresher \u2013 Certified", experienced: "Experienced" }[ivState.track] || ivState.track;
  const specialtyLabel = { surgery: "Surgery", ed_coding: "ED Coding", inpatient: "Inpatient" }[ivState.specialty] || (ivState.specialty || "");
  const trackFull = trackLabel + (specialtyLabel ? " \u2014 " + specialtyLabel : "");
  const dateStr = new Date(ivState.sessionStartedAt).toLocaleString();
  const durationMin = ivState.endedAt ? Math.round((ivState.endedAt - ivState.sessionStartedAt) / 60000) : 0;

  const bandColors = { HIRE: [220, 252, 231], MAYBE: [254, 243, 199], PASS: [254, 226, 226] };
  const bandStroke = { HIRE: [134, 239, 172], MAYBE: [252, 211, 77], PASS: [252, 165, 165] };
  const bandText =  { HIRE: [22, 101, 52],   MAYBE: [146, 64, 14],   PASS: [153, 27, 27] };
  const bc = bandColors[score.band] || [240,240,240];
  const bs = bandStroke[score.band] || [200,200,200];
  const bt = bandText[score.band]  || [50,50,50];

  const drawBar = (label, pct, yPos) => {
    const safe = Math.max(0, Math.min(100, Number(pct || 0)));
    const col = safe >= 75 ? [22,101,52] : safe >= 55 ? [146,64,14] : [153,27,27];
    doc.setFontSize(9); doc.setTextColor(15,23,42);
    doc.text(`${label}`, 14, yPos);
    doc.text(`${safe}%`, 88, yPos);
    doc.setFillColor(226,232,240); doc.roundedRect(96, yPos-3.5, 100, 4, 1,1,"F");
    doc.setFillColor(...col); doc.roundedRect(96, yPos-3.5, Math.max(2, safe), 4, 1,1,"F");
  };

  // ── HEADER ──
  doc.setFillColor(15,118,110); doc.rect(0,0,210,30,"F");
  doc.setFillColor(0,163,217);  doc.rect(0,30,210,6,"F");
  doc.setTextColor(255,255,255);
  doc.setFontSize(15); doc.text("PracticeBuddy Lab \u2014 Interview Mode", 14, 13);
  doc.setFontSize(10); doc.text("CodingBuddy360 | Medical Coding Interview Assessment", 14, 20);
  doc.setFontSize(9);  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 27);

  let y = 42;
  doc.setTextColor(15,23,42); doc.setFontSize(10);
  doc.text(`Candidate: ${userName}`, 14, y);        y += 6;
  doc.text(`Track: ${trackFull}`, 14, y);            y += 6;
  doc.text(`Session: ${dateStr}  |  Duration: ${durationMin} min`, 14, y); y += 10;

  // ── RECOMMENDATION BAND ──
  doc.setFillColor(...bc); doc.setDrawColor(...bs);
  doc.roundedRect(14, y, 182, 24, 3,3,"FD");
  doc.setFontSize(16); doc.setTextColor(...bt);
  doc.text(`Recommendation: ${score.band}`, 18, y+10);
  doc.setFontSize(9); doc.setTextColor(15,23,42);
  const bandDesc = {
    HIRE: "Strong overall performance. Candidate demonstrates solid coding knowledge and reasoning ability.",
    MAYBE: "Moderate performance. Candidate shows potential but has identifiable gaps to address before the interview.",
    PASS: "Performance below hiring threshold. Significant preparation needed across multiple competency areas."
  }[score.band] || "";
  const descLines = doc.splitTextToSize(bandDesc, 174);
  doc.text(descLines, 18, y+17);
  y += 32;

  // ── OVERALL SCORE SUMMARY ──
  doc.setFontSize(11); doc.setTextColor(0,126,167);
  doc.text("Overall Performance Summary", 14, y); y += 7;

  const timedOut = ivState.answers.filter(a => a.timedOut).length;
  const avgTime = ivState.answers.length
    ? Math.round(ivState.answers.reduce((s,a) => s + (a.timeSpent||0), 0) / ivState.answers.length)
    : 0;

  doc.setFontSize(9); doc.setTextColor(15,23,42);
  const summaryItems = [
    [`Total Questions`, `${score.total}`],
    [`Correct Answers`, `${score.correct}  (${score.overall}%)`],
    [`Incorrect Answers`, `${score.wrong}`],
    [`Timed Out`, `${timedOut}`],
    [`Avg Time per Question`, `${avgTime}s`],
    [`Duration`, `${durationMin} min`]
  ];
  const colW = 91;
  summaryItems.forEach(([label, val], i) => {
    const col = i % 2 === 0 ? 14 : 14 + colW;
    const row = Math.floor(i / 2);
    const yy = y + row * 7;
    doc.setTextColor(100,116,139); doc.text(label + ":", col, yy);
    doc.setTextColor(15,23,42);   doc.text(val, col + 46, yy);
  });
  y += Math.ceil(summaryItems.length / 2) * 7 + 6;

  // ── COMPETENCY BREAKDOWN ──
  doc.setFontSize(11); doc.setTextColor(0,126,167);
  doc.text("Competency Breakdown", 14, y); y += 8;
  Object.entries(score.byType).forEach(([type, data]) => {
    drawBar(formatQuestionType(type), data.pct, y);
    doc.setFontSize(8); doc.setTextColor(100,116,139);
    doc.text(`${data.correct}/${data.total} correct`, 170, y);
    y += 8;
  });
  y += 4;

  // ── SCENARIO PERFORMANCE ──
  doc.setFontSize(11); doc.setTextColor(0,126,167);
  doc.text("Scenario-by-Scenario Performance", 14, y); y += 7;

  const byChain = {};
  ivState.answers.forEach(a => {
    if (!byChain[a.chainTitle]) byChain[a.chainTitle] = { correct:0, total:0, types:[] };
    byChain[a.chainTitle].total++;
    if (a.correct) byChain[a.chainTitle].correct++;
    if (!byChain[a.chainTitle].types.includes(a.questionType)) byChain[a.chainTitle].types.push(a.questionType);
  });

  Object.entries(byChain).forEach(([title, data]) => {
    if (y > 265) { doc.addPage(); y = 18; }
    const pct = data.total ? Math.round((data.correct/data.total)*100) : 0;
    const band = pct >= 75 ? "Strong" : pct >= 55 ? "Developing" : "Needs Work";
    const bandCol = pct >= 75 ? [22,101,52] : pct >= 55 ? [146,64,14] : [153,27,27];
    doc.setFontSize(9); doc.setTextColor(15,23,42);
    doc.text(`\u25B6 ${title}`, 14, y);
    doc.setTextColor(...bandCol);
    doc.text(`${band} (${pct}%)`, 120, y);
    doc.setTextColor(100,116,139);
    doc.text(`${data.correct}/${data.total} correct`, 170, y);
    y += 5;
    doc.setFontSize(8);
    doc.text(`Competencies tested: ${data.types.map(formatQuestionType).join(", ")}`, 18, y);
    y += 7;
  });

  // ── STRENGTHS & GAPS ──
  if (y > 240) { doc.addPage(); y = 18; }
  doc.setFontSize(11); doc.setTextColor(0,126,167);
  doc.text("Strengths & Development Areas", 14, y); y += 7;

  const typeEntries = Object.entries(score.byType);
  const strengths = typeEntries.filter(([,d]) => d.pct >= 70).map(([t]) => formatQuestionType(t));
  const gaps      = typeEntries.filter(([,d]) => d.pct <  55).map(([t]) => formatQuestionType(t));
  const developing= typeEntries.filter(([,d]) => d.pct >= 55 && d.pct < 70).map(([t]) => formatQuestionType(t));

  doc.setFontSize(9);
  if (strengths.length) {
    doc.setTextColor(22,101,52);
    doc.text("\u2713 Strengths: " + strengths.join(", "), 14, y); y += 6;
  }
  if (developing.length) {
    doc.setTextColor(146,64,14);
    doc.text("\u25B2 Developing: " + developing.join(", "), 14, y); y += 6;
  }
  if (gaps.length) {
    doc.setTextColor(153,27,27);
    doc.text("\u2717 Needs Focus: " + gaps.join(", "), 14, y); y += 6;
  }
  y += 4;

  // ── RECOMMENDED NEXT STEPS ──
  if (y > 240) { doc.addPage(); y = 18; }
  doc.setFontSize(11); doc.setTextColor(0,126,167);
  doc.text("Recommended Next Steps", 14, y); y += 7;

  const nextSteps = [];
  if (score.band === "HIRE") {
    nextSteps.push("Continue reinforcing strengths with timed mock exams under exam conditions.");
    nextSteps.push("Focus on specialty-specific edge cases and audit/compliance scenarios.");
    nextSteps.push("Practice articulating coding rationale verbally — interviewers often ask 'why'.");
  } else if (score.band === "MAYBE") {
    if (gaps.length) nextSteps.push(`Prioritise study in: ${gaps.join(", ")} — these had the lowest scores.`);
    nextSteps.push("Attempt at least 50 questions daily in weak topic areas using Adaptive Drill mode.");
    nextSteps.push("Re-attempt this interview simulation after 1 week of focused practice.");
    nextSteps.push("Review ICD-10-CM/CPT official guidelines for any topic scoring below 55%.");
  } else {
    if (gaps.length) nextSteps.push(`Critical gaps identified in: ${gaps.join(", ")} — these require structured review.`);
    nextSteps.push("Start with foundational modules: Clinical Terminology, ICD-10-CM basics, CPT structure.");
    nextSteps.push("Complete a minimum of 100 daily practice questions before re-attempting.");
    nextSteps.push("Consider requesting a structured study plan from your trainer.");
    if (timedOut > 0) nextSteps.push(`${timedOut} question(s) timed out — work on answering within 60 seconds per question.`);
  }

  doc.setFontSize(9); doc.setTextColor(15,23,42);
  nextSteps.forEach((step, i) => {
    if (y > 270) { doc.addPage(); y = 18; }
    const lines = doc.splitTextToSize(`${i+1}. ${step}`, 180);
    doc.text(lines, 14, y);
    y += lines.length * 5 + 2;
  });

  // ── FOOTER ──
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(8); doc.setTextColor(100,116,139);
    doc.text(`PracticeBuddy Lab | CodingBuddy360 | Interview Mode Assessment  |  Page ${p} of ${pageCount}`, 14, 290);
  }

  const safeName = userName.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
  doc.save(`interview_mode_report_${safeName}_${Date.now()}.pdf`);
}

/* ── Reset ── */
function resetInterview() {
  clearTimer();
  ivState.active = false;
  selectedTrack = null;
  selectedSpecialty = null;
  selectedMcqOption = null;

  document.querySelectorAll(".iv-track-card").forEach(c => c.classList.remove("selected"));
  document.querySelectorAll(".iv-specialty-card").forEach(c => c.classList.remove("selected"));
  document.getElementById("ivSpecialtySection")?.classList.add("hidden");
  const startBtn = document.getElementById("ivStartBtn");
  if (startBtn) startBtn.disabled = true;
  const statusEl = document.getElementById("ivStatusMsg");
  if (statusEl) statusEl.textContent = "";

  document.getElementById("ivSetupScreen")?.classList.remove("hidden");
  document.getElementById("ivActiveScreen")?.classList.add("hidden");
  document.getElementById("ivResultsScreen")?.classList.add("hidden");
}

function exitInterviewModule() {
  resetInterview();
  if (typeof handleTabSwitch === "function") {
    handleTabSwitch(state?.role === "trainer" ? "mentor" : "practice");
  } else {
    document.getElementById("view-interview")?.classList.remove("active");
    document.getElementById("view-practice")?.classList.add("active");
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ── AI Question Generation ── */

let aiGenChains = null; // holds generated chains pending save

function initAIGenListeners() {
  const trackSel = document.getElementById("aiGenTrack");
  const specWrap = document.getElementById("aiGenSpecialtyWrap");
  if (trackSel) {
    trackSel.addEventListener("change", () => {
      specWrap?.classList.toggle("hidden", trackSel.value !== "experienced");
    });
  }

  document.getElementById("aiGenBtn")?.addEventListener("click", handleAIGenerate);
  document.getElementById("aiGenSaveBtn")?.addEventListener("click", handleAIGenSave);
  document.getElementById("aiGenDiscardBtn")?.addEventListener("click", handleAIGenDiscard);
}

async function handleAIGenerate() {
  const track = document.getElementById("aiGenTrack")?.value || "fresher";
  const specialty = track === "experienced" ? (document.getElementById("aiGenSpecialty")?.value || "") : "";
  const topic = (document.getElementById("aiGenTopic")?.value || "").trim();
  const count = Number(document.getElementById("aiGenCount")?.value || 1);
  const customInstructions = (document.getElementById("aiGenCustom")?.value || "").trim();
  const statusEl = document.getElementById("aiGenStatus");
  const previewEl = document.getElementById("aiGenPreview");
  const genBtn = document.getElementById("aiGenBtn");

  if (!topic) {
    if (statusEl) { statusEl.textContent = "Please enter a topic or focus area."; statusEl.className = "status error"; }
    return;
  }

  genBtn.disabled = true;
  genBtn.textContent = "Generating…";
  if (statusEl) { statusEl.textContent = "Calling AI — this takes 10–20 seconds…"; statusEl.className = "status"; }
  previewEl?.classList.add("hidden");
  aiGenChains = null;

  try {
    const trainerKey = (typeof dom !== "undefined" && dom.trainerKey?.value) ||
      document.getElementById("trainerKey")?.value || "";
    const res = await fetch("/api/interview/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-trainer-key": trainerKey },
      body: JSON.stringify({ track, specialty, topic, count, customInstructions })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Generation failed");

    aiGenChains = data.chains;
    if (statusEl) { statusEl.textContent = `✓ Generated ${data.chains.length} chain(s). Review below before saving.`; statusEl.className = "status success"; }
    renderAIGenPreview(data.chains);
    previewEl?.classList.remove("hidden");
  } catch (err) {
    if (statusEl) { statusEl.textContent = `Error: ${err.message}`; statusEl.className = "status error"; }
  } finally {
    genBtn.disabled = false;
    genBtn.textContent = "✨ Generate Questions";
  }
}

function renderAIGenPreview(chains) {
  const container = document.getElementById("aiGenPreviewContent");
  if (!container) return;
  container.innerHTML = chains.map((chain, ci) => {
    const qRows = chain.questions.map((q, qi) => `
      <div style="margin:8px 0;padding:8px 10px;background:#f8fafc;border-radius:6px;border-left:3px solid #94a3b8;">
        <div style="font-size:0.78rem;color:#64748b;margin-bottom:4px;">Q${qi + 1} · <em>${q.questionType}</em></div>
        <div style="font-size:0.85rem;font-weight:600;margin-bottom:6px;">${escapeHtml(q.question)}</div>
        ${q.options.map((opt, oi) => {
          const letter = ["A","B","C","D"][oi];
          const isCorrect = q.correctOption === letter;
          return `<div style="font-size:0.82rem;padding:2px 6px;border-radius:4px;${isCorrect ? "background:#d9f3ee;font-weight:600;color:#0f766e;" : "color:#475569;"}">${escapeHtml(opt)}</div>`;
        }).join("")}
        <div style="font-size:0.78rem;color:#475569;margin-top:6px;font-style:italic;">${escapeHtml(q.rationale)}</div>
      </div>`).join("");

    return `<div style="margin-bottom:16px;padding:12px;border:1px solid #c7d2fe;border-radius:10px;background:#f8f7ff;">
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;flex-wrap:wrap;">
        <strong style="font-size:0.9rem;">${escapeHtml(chain.title)}</strong>
        <span style="font-size:0.72rem;background:#ede9fe;color:#5b21b6;padding:2px 8px;border-radius:99px;">${chain.track}${chain.specialty ? " · " + chain.specialty : ""}</span>
      </div>
      <p style="font-size:0.82rem;color:#475569;margin-bottom:8px;">${escapeHtml(chain.scenario)}</p>
      ${qRows}
    </div>`;
  }).join("");
}

async function handleAIGenSave() {
  if (!aiGenChains || aiGenChains.length === 0) return;
  const statusEl = document.getElementById("aiGenStatus");
  const saveBtn = document.getElementById("aiGenSaveBtn");
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";

  try {
    const trainerKey = (typeof dom !== "undefined" && dom.trainerKey?.value) ||
      document.getElementById("trainerKey")?.value || "";
    const res = await fetch("/api/interview/save-chains", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-trainer-key": trainerKey },
      body: JSON.stringify({ chains: aiGenChains })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Save failed");

    if (statusEl) { statusEl.textContent = `✓ Saved ${data.saved} chain(s) to the question bank.`; statusEl.className = "status success"; }
    document.getElementById("aiGenPreview")?.classList.add("hidden");
    aiGenChains = null;
  } catch (err) {
    if (statusEl) { statusEl.textContent = `Save error: ${err.message}`; statusEl.className = "status error"; }
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "💾 Save to Question Bank";
  }
}

function handleAIGenDiscard() {
  aiGenChains = null;
  document.getElementById("aiGenPreview")?.classList.add("hidden");
  const statusEl = document.getElementById("aiGenStatus");
  if (statusEl) { statusEl.textContent = "Discarded."; statusEl.className = "status"; }
}

// Expose for app.init.js
window.initInterviewListeners = initInterviewListeners;
window.initAIGenListeners = initAIGenListeners;
window.resetInterview = resetInterview;
window.exitInterviewModule = exitInterviewModule;

})();
