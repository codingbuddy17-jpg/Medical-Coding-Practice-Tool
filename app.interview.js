/* ==========================================================================
   app.interview.js — Interview Simulator Engine
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
  const timeLimit = q.timeLimit || question.timeLimit || (ivState.track === "fresher" ? 60 : ivState.track === "fresher_certified" ? 90 : 120);
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
  const totalTime = q?.timeLimit || question?.timeLimit || (ivState.track === "fresher" ? 60 : ivState.track === "fresher_certified" ? 90 : 120);

  if (timerEl) {
    timerEl.textContent = `${ivState.timeRemaining}s`;
    timerEl.className = "iv-timer";
    if (ivState.timeRemaining <= totalTime * 0.2) timerEl.classList.add("danger");
    else if (ivState.timeRemaining <= totalTime * 0.5) timerEl.classList.add("warning");
  }
  if (timerBar) {
    const pct = Math.max(0, (ivState.timeRemaining / totalTime) * 100);
    timerBar.style.width = `${pct}%`;
    timerBar.className = "iv-timer-bar-fill";
    if (ivState.timeRemaining <= totalTime * 0.2) timerBar.classList.add("danger");
    else if (ivState.timeRemaining <= totalTime * 0.5) timerBar.classList.add("warning");
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
  const overall = total ? Math.round((correct / total) * 100) : 0;

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

  return { overall, total, correct, wrong: total - correct, byType: typeScores, band };
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
  const trackLabel = { fresher: "Fresher", fresher_certified: "Fresher – Certified", experienced: "Experienced" }[ivState.track] || ivState.track;
  const specialtyLabel = { surgery: "Surgery", ed_coding: "ED Coding", inpatient: "Inpatient" }[ivState.specialty] || (ivState.specialty || "General");
  const dateStr = new Date(ivState.sessionStartedAt).toLocaleString();

  // Header
  doc.setFillColor(15, 118, 110);
  doc.rect(0, 0, 210, 30, "F");
  doc.setFillColor(0, 163, 217);
  doc.rect(0, 30, 210, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.text("PracticeBuddy Lab \u2014 Interview Simulator", 14, 13);
  doc.setFontSize(10);
  doc.text("CodingBuddy360 | Medical Coding Interview Assessment Report", 14, 20);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 27);

  let y = 44;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.text(`Candidate: ${userName}`, 14, y); y += 7;
  doc.text(`Track: ${trackLabel}${ivState.specialty ? " \u2014 " + specialtyLabel : ""}`, 14, y); y += 7;
  doc.text(`Session Date: ${dateStr}`, 14, y); y += 10;

  // Band box
  const bandColors = { HIRE: [220, 252, 231], MAYBE: [254, 243, 199], PASS: [254, 226, 226] };
  const bandStroke = { HIRE: [134, 239, 172], MAYBE: [252, 211, 77], PASS: [252, 165, 165] };
  const bandText = { HIRE: [22, 101, 52], MAYBE: [146, 64, 14], PASS: [153, 27, 27] };
  const bc = bandColors[score.band] || [240, 240, 240];
  const bs = bandStroke[score.band] || [200, 200, 200];
  const bt = bandText[score.band] || [50, 50, 50];
  doc.setFillColor(...bc);
  doc.setDrawColor(...bs);
  doc.roundedRect(14, y, 182, 22, 3, 3, "FD");
  doc.setFontSize(14);
  doc.setTextColor(...bt);
  doc.text(`Recommendation: ${score.band}`, 18, y + 9);
  doc.setFontSize(10);
  doc.text(`Overall Score: ${score.overall}%  (${score.correct} correct / ${score.total} total)`, 18, y + 16);
  y += 30;

  // Type breakdown
  doc.setFontSize(11);
  doc.setTextColor(0, 126, 167);
  doc.text("Performance by Question Type", 14, y); y += 7;
  Object.entries(score.byType).forEach(([type, data]) => {
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(`${formatQuestionType(type)}: ${data.pct}% (${data.correct}/${data.total})`, 14, y);
    const barColor = data.pct >= 75 ? [22, 101, 52] : data.pct >= 55 ? [146, 64, 14] : [153, 27, 27];
    doc.setFillColor(220, 220, 220);
    doc.roundedRect(95, y - 3.5, 100, 4, 1, 1, "F");
    doc.setFillColor(...barColor);
    const barW = Math.max(2, data.pct);
    doc.roundedRect(95, y - 3.5, barW, 4, 1, 1, "F");
    y += 7;
  });
  y += 5;

  // Per-question breakdown
  doc.setFontSize(11);
  doc.setTextColor(0, 126, 167);
  doc.text("Question-by-Question Review", 14, y); y += 7;
  ivState.answers.forEach((a, i) => {
    if (y > 265) { doc.addPage(); y = 18; }
    const resultStr = a.correct ? "\u2713" : a.timedOut ? "\u23f1" : "\u2717";
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    const qLine = `${resultStr} Q${i+1} [${formatQuestionType(a.questionType)}] \u2014 ${(a.question || "").slice(0, 80)}${(a.question || "").length > 80 ? "\u2026" : ""}`;
    doc.text(qLine, 14, y); y += 5;
    if (a.rationale) {
      doc.setTextColor(80, 80, 80);
      const wrapped = doc.splitTextToSize(`\u2192 ${a.rationale}`, 182);
      doc.text(wrapped, 16, y);
      y += wrapped.length * 4.5;
    }
    y += 2;
  });

  // Footer
  if (y > 275) { doc.addPage(); y = 18; }
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("PracticeBuddy Lab | CodingBuddy360 | Medical Coding Interview Assessment", 14, 290);

  const safeName = (userName).replace(/[^a-z0-9]+/gi, "_").toLowerCase();
  const fileName = `interview_report_${safeName}_${Date.now()}.pdf`;
  doc.save(fileName);
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

// Expose for app.init.js
window.initInterviewListeners = initInterviewListeners;
window.resetInterview = resetInterview;

})();
