function escapeHtml(str) {
  const s = String(str ?? "");
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeResourceHref(url) {
  const trimmed = String(url || "").trim();
  if (!trimmed) return "#";
  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  if (/^\s*javascript:/i.test(normalized) || /^\s*data:/i.test(normalized)) return "#";
  return normalized;
}

function sanitizeUrl(url) {
  const trimmed = String(url || "").trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function buildWhatsappLink(message) {
  const fullMessage = `${String(message || "").trim()}\n\n- ${BRAND_PRODUCT}`;
  const text = encodeURIComponent(fullMessage);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
}

function toEpochFromDateInput(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const ts = Date.parse(`${text}T23:59:59`);
  return Number.isFinite(ts) ? ts : null;
}

function toDateInputValue(epochMs) {
  const ts = Number(epochMs || 0);
  if (!ts || !Number.isFinite(ts)) return "";
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function trackCtaEvent(type, metadata = {}) {
  try {
    await apiRequest("/api/cta/event", "POST", {
      type,
      sessionId: state.session.id || "",
      role: state.role || "",
      userName: state.userName || "",
      userEmail: state.userEmail || "",
      userPhone: state.userPhone || "",
      metadata
    });
  } catch {
    // silently ignore tracking failures
  }
}

function isTrialUser() {
  return state.role === "trial";
}

function activeSessionLimit() {
  const limit = Number(state.session.questionLimit || 0);
  const base = limit > 0 && Number.isFinite(limit)
    ? limit
    : (isTrialUser() ? Number(state.accessConfig.trialQuestionLimit || 20) : 1000000);
  const cap = Number(state.accessConfig.maxSessionQuestions || 0);
  if (cap > 0 && Number.isFinite(cap) && state.role !== "trainer") return Math.min(base, cap);
  return base;
}

function hasSessionLimitReached() {
  return state.session.attempted >= activeSessionLimit();
}

function remainingSessionLimit() {
  return Math.max(0, activeSessionLimit() - Number(state.session.attempted || 0));
}

function trialUpgradeMessage() {
  return state.accessConfig.contactMessage || `For full access, contact ${BRAND_NAME}.`;
}

function updateTrialLockUI() {
  if (hasSessionLimitReached()) {
    dom.userAnswer.disabled = true;
    dom.checkBtn.disabled = true;
    dom.nextBtn.disabled = true;
    dom.mcqOptions.querySelectorAll("button").forEach((btn) => {
      btn.disabled = true;
    });
    dom.trialLockNotice.classList.remove("hidden");
    dom.trialLockNotice.textContent = `Practice limit reached (${activeSessionLimit()} questions). ${trialUpgradeMessage()}`;
    return;
  }

  dom.userAnswer.disabled = false;
  dom.mcqOptions.querySelectorAll("button").forEach((btn) => {
    btn.disabled = false;
  });
  dom.trialLockNotice.classList.add("hidden");
  dom.trialLockNotice.textContent = "";
}

function updateUpgradeWallUI() {
  const show = state.role !== "trainer" && hasSessionLimitReached();
  dom.upgradeWall.classList.toggle("hidden", !show);
  if (!show) return;

  const defaultName = state.userName || "";
  const defaultEmail = state.userEmail || "";
  const defaultPhone = state.userPhone || "";
  if (!dom.counselName.value) dom.counselName.value = defaultName;
  if (!dom.counselEmail.value) dom.counselEmail.value = defaultEmail;
  if (!dom.counselPhone.value) dom.counselPhone.value = defaultPhone;
}

function updateTrialInfoBannerUI() {
  const show = state.role === "trial" && state.session.isActive && !hasSessionLimitReached();
  dom.trialInfoBanner.classList.toggle("hidden", !show);
  if (!show) return;

  const used = Number(state.session.attempted || 0);
  const limit = activeSessionLimit();
  const remaining = Math.max(0, limit - used);
  const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));

  if (dom.trialProgressFill) {
    dom.trialProgressFill.style.width = `${pct}%`;
    dom.trialProgressFill.classList.toggle("trial-progress-warn", pct >= 75 && pct < 90);
    dom.trialProgressFill.classList.toggle("trial-progress-urgent", pct >= 90);
  }
  if (dom.trialProgressText) {
    dom.trialProgressText.textContent = `${used} of ${limit} used`;
  }
  if (dom.trialProgressRemaining) {
    if (pct >= 90) {
      dom.trialProgressRemaining.textContent = `Only ${remaining} question${remaining === 1 ? "" : "s"} left — unlock full access to keep going!`;
      dom.trialProgressRemaining.classList.add("trial-progress-urgent-text");
    } else if (pct >= 75) {
      dom.trialProgressRemaining.textContent = `${remaining} questions remaining — you're almost through the trial!`;
      dom.trialProgressRemaining.classList.remove("trial-progress-urgent-text");
    } else {
      dom.trialProgressRemaining.textContent = `${remaining} question${remaining === 1 ? "" : "s"} remaining in your trial`;
      dom.trialProgressRemaining.classList.remove("trial-progress-urgent-text");
    }
  }
}

function updatePreSessionLandingUI() {
  const isActive = state.session.isActive;

  if (!isActive) {
    // Show Landing & Auth — but only if NOT in institute mode
    const isInstituteMode = new URLSearchParams(window.location.search).get("mode") === "institute";
    if (!isInstituteMode) {
      dom.preSessionLanding.classList.remove("hidden", "landing-hidden");
      if (dom.authPanel) dom.authPanel.classList.remove("hidden");
      if (dom.loginGuide) dom.loginGuide.classList.remove("hidden");
      if (dom.brandIntro) dom.brandIntro.classList.remove("hidden");
    }
    // Institute panel stays hidden in normal mode; only shown by ?mode=institute
    if (dom.instituteLoginPanel && !isInstituteMode) dom.instituteLoginPanel.classList.add("hidden");
    if (dom.trialInfoBanner) dom.trialInfoBanner.classList.add("hidden");

    // Hide Navigation & Views
    if (navDom.mainNav) navDom.mainNav.classList.add("hidden");
    if (navDom.viewPractice) navDom.viewPractice.classList.remove("active");
    if (navDom.viewMentor) navDom.viewMentor.classList.remove("active");
    if (navDom.viewInterview) navDom.viewInterview.classList.remove("active");
    if (dom.topbarSessionRow) dom.topbarSessionRow.classList.add("hidden");
  } else {
    // Hide Landing & Auth
    dom.preSessionLanding.classList.add("landing-hidden");
    if (dom.authPanel) dom.authPanel.classList.add("hidden");
    if (dom.loginGuide) dom.loginGuide.classList.add("hidden");
    if (dom.brandIntro) dom.brandIntro.classList.add("hidden");
    // Always hide institute panel once a normal session is active
    if (dom.instituteLoginPanel) dom.instituteLoginPanel.classList.add("hidden");

    // Show Navigation & Views
    showNavigation();
  }
  dom.preSessionLanding.setAttribute("aria-hidden", !isActive ? "false" : "true");
}

function toMcqOptionKey(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (["A", "B", "C", "D"].includes(raw)) return raw;

  // Handle "A)", "A.", "(A)", "Option A"
  const match = raw.match(/^(\(?[A-D])(?=[\)\.\s]|$)/);
  if (match) {
    return match[1].replace(/[\(\)]/g, "");
  }

  // Handle "Option A"
  if (raw.startsWith("OPTION ")) {
    const char = raw.split(" ")[1];
    if (["A", "B", "C", "D"].includes(char)) return char;
  }

  return "";
}

function decodeEmbeddedCard(rawAnswer) {
  const value = String(rawAnswer || "");
  if (!value.startsWith(MCQ_PREFIX)) return null;
  try {
    const parsed = JSON.parse(value.slice(MCQ_PREFIX.length));
    // Check for explicit options array OR flat properties in parsing
    let options = Array.isArray(parsed.options) ? parsed.options : [];
    if (!options.length) {
      // Try fallback if JSON has them
      options = [parsed.optionA, parsed.optionB, parsed.optionC, parsed.optionD].filter(Boolean);
    }
    options = options.map((x) => String(x || "").trim());

    if (options.length < 2) return null;
    const correctOption = toMcqOptionKey(parsed.correctOption);
    // Relaxed check: Return MCQ even if correctOption is missing to preserve UI
    return {
      type: "mcq",
      options: options.slice(0, 4),
      correctOption: correctOption || "",
      rationale: String(parsed.rationale || "").trim(),
      difficulty: normalizeDifficultyKey(parsed.difficulty || "", "")
    };
  } catch {
    return null;
  }
}

function decodePackedShortCard(rawAnswer) {
  const value = String(rawAnswer || "");
  if (!value.startsWith(CARD_PREFIX)) return null;
  try {
    const parsed = JSON.parse(value.slice(CARD_PREFIX.length));
    const type = String(parsed.type || "short").toLowerCase();
    if (type !== "short") return null;
    return {
      type: "short",
      answer: String(parsed.answer || "").trim(),
      rationale: String(parsed.rationale || "").trim(),
      difficulty: normalizeDifficultyKey(parsed.difficulty || "", "")
    };
  } catch {
    return null;
  }
}

function inferDifficultyFromCard(card) {
  const question = String(card.question || "").trim().toLowerCase();
  const rationale = String(card.rationale || "").trim().toLowerCase();
  const options = Array.isArray(card.options) ? card.options.filter(Boolean).map((item) => String(item).trim()) : [];
  const combined = `${question} ${rationale}`.trim();
  const scenarioSignals = /(patient|presents|encounter|emergency|ed\b|admitted|start time|stop time|end time|administered|reports?|what should be reported|which code|best coding|hierarchy|separate access|same drug|concurrent|sequential|hydration|critical care|fracture|debridement|foreign body)/.test(combined);
  const advancedSignals = /(most appropriate|code selection|initial service|additional hour|multi-step|documentation supports|coding professional|apply the hierarchy)/.test(combined);
  if ((scenarioSignals && advancedSignals) || question.length > 260 || options.join(" ").length > 220) return "advanced";
  if (scenarioSignals || question.length > 130 || options.length >= 4) return "medium";
  return "low";
}

function encodeCardForCloud(card) {
  const type = String(card.type || "").toLowerCase();
  const rationale = String(card.rationale || "").trim();
  const difficulty = normalizeDifficultyKey(card.difficulty || "", "");
  if (type !== "mcq") {
    const answer = String(card.answer || "").trim();
    if (rationale || difficulty) {
      return {
        tag: String(card.tag || "General").trim(),
        question: String(card.question || "").trim(),
        answer: `${CARD_PREFIX}${JSON.stringify({ type: "short", answer, rationale, difficulty })}`
      };
    }
    return {
      tag: String(card.tag || "General").trim(),
      question: String(card.question || "").trim(),
      answer
    };
  }

  let options = [];
  if (Array.isArray(card.options) && card.options.length > 0) {
    options = card.options.map((x) => String(x || "").trim()).slice(0, 4);
  } else {
    // Fallback for flat import structure
    const optA = String(card.option_a || card.optionA || "").trim();
    const optB = String(card.option_b || card.optionB || "").trim();
    const optC = String(card.option_c || card.optionC || "").trim();
    const optD = String(card.option_d || card.optionD || "").trim();
    options = [optA, optB, optC, optD].filter(Boolean);
  }

  // FIX: Check both snake_case (from CSV parser) and camelCase
  const correctOption = toMcqOptionKey(card.correctOption || card.correct_option);
  const payload = {
    options,
    correctOption,
    rationale,
    difficulty
  };
  return {
    tag: String(card.tag || "General").trim(),
    question: String(card.question || "").trim(),
    answer: `${MCQ_PREFIX}${JSON.stringify(payload)}`
  };
}

function hydrateCards(cards) {
  return cards.map((card, index) => {
    const packedShort = decodePackedShortCard(card.answer);
    const embedded = decodeEmbeddedCard(card.answer);
    const explicitType = String(card.type || "").toLowerCase();
    const isMcq = explicitType === "mcq" || Boolean(embedded);
    const optionA = String(card.option_a || card.optionA || "").trim();
    const optionB = String(card.option_b || card.optionB || "").trim();
    const optionC = String(card.option_c || card.optionC || "").trim();
    const optionD = String(card.option_d || card.optionD || "").trim();
    const explicitOptions = [optionA, optionB, optionC, optionD].filter(Boolean);
    const options = embedded?.options || explicitOptions;
    const correctOption = embedded?.correctOption || toMcqOptionKey(card.correct_option || card.correctOption);
    const explicitRationale = String(card.rationale || "").trim();
    const rationale = explicitRationale || embedded?.rationale || packedShort?.rationale || DEFAULT_RATIONALE_TEXT;
    const shortAnswer = packedShort?.answer || String(card.answer || "").trim();
    const explicitDifficulty = normalizeDifficultyKey(card.difficulty || "", "");
    const detectedDifficulty = explicitDifficulty || embedded?.difficulty || packedShort?.difficulty || inferDifficultyFromCard({
      question: card.question,
      rationale,
      options: isMcq ? options : []
    });

    return {
      id: card.id || `${normalizeTagKey(card.tag)}_${index}_${uid("card")}`,
      tag: (card.tag || "General").trim(),
      question: String(card.question || "").trim(),
      type: isMcq ? "mcq" : "short",
      difficulty: detectedDifficulty,
      answer: isMcq ? "" : shortAnswer,
      options: isMcq ? options.slice(0, 4) : [],
      correctOption: isMcq ? correctOption : "",
      rationale
    };
  });
}

const SESSION_SNAP_KEY = "pb_session_snap";

function saveSessionState() {
  try {
    sessionStorage.setItem(SESSION_SNAP_KEY, JSON.stringify({
      userName: state.userName,
      userEmail: state.userEmail,
      userPhone: state.userPhone,
      role: state.role,
      trainerKey: state.trainerKey || "",
      adminKey: state.adminKey || "",
      trainerKeyVerified: state.trainerKeyVerified,
      sessionId: state.session.id,
      sessionStartedAt: state.session.startedAt,
      questionLimit: state.session.questionLimit,
      cohortId: state.session.cohortId || "",
      cohortName: state.session.cohortName || "",
      shuffleSeed: state.session.shuffleSeed || ""
    }));
  } catch {}
}

function clearSessionState() {
  try { sessionStorage.removeItem(SESSION_SNAP_KEY); } catch {}
}

function loadSessionState() {
  try {
    const raw = sessionStorage.getItem(SESSION_SNAP_KEY);
    if (!raw) return false;
    const snap = JSON.parse(raw);
    if (!snap.sessionId || !snap.role) return false;
    state.userName = snap.userName || "";
    state.userEmail = snap.userEmail || "";
    state.userPhone = snap.userPhone || "";
    state.role = snap.role;
    state.trainerKey = snap.trainerKey || "";
    state.adminKey = snap.adminKey || "";
    state.trainerKeyVerified = Boolean(snap.trainerKeyVerified);
    state.session.id = snap.sessionId;
    state.session.startedAt = snap.sessionStartedAt || Date.now();
    state.session.isActive = true;
    state.session.questionLimit = snap.questionLimit || 1000000;
    state.session.cohortId = snap.cohortId || "";
    state.session.cohortName = snap.cohortName || "";
    state.session.shuffleSeed = snap.shuffleSeed || snap.sessionId;
    return true;
  } catch { return false; }
}

function saveLocal() {
  const payload = {
    role: state.role,
    deck: state.deck,
    resources: state.resources,
    selectedTag: state.selectedTag,
    selectedDifficulty: state.selectedDifficulty,
    weakDrillEnabled: state.weakDrillEnabled,
    adaptiveEnabled: state.adaptiveEnabled,
    examConfig: state.examConfig,
    gamification: state.gamification
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadLocal() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    state.deck = hydrateCards(STARTER_DECK);
    state.resources = [...DEFAULT_RESOURCES];
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    state.role = parsed.role || "trial";
    state.userName = "";
    state.userEmail = "";
    state.userPhone = "";
    state.deck = Array.isArray(parsed.deck) && parsed.deck.length > 0 ? hydrateCards(parsed.deck) : hydrateCards(STARTER_DECK);
    state.resources = Array.isArray(parsed.resources) && parsed.resources.length > 0 ? parsed.resources : [...DEFAULT_RESOURCES];
    state.selectedTag = CATEGORY_OPTIONS.some((item) => item.key === parsed.selectedTag) ? parsed.selectedTag : "ALL";
    state.selectedDifficulty = normalizeDifficultyKey(parsed.selectedDifficulty || "all", "all");
    state.weakDrillEnabled = Boolean(parsed.weakDrillEnabled);
    state.adaptiveEnabled = Boolean(parsed.adaptiveEnabled);
    state.examConfig.questionCount = Number(parsed.examConfig?.questionCount) || 30;
    state.examConfig.durationMinutes = Number(parsed.examConfig?.durationMinutes) || 30;
    state.examConfig.passThreshold = Math.min(100, Math.max(1, Number(parsed.examConfig?.passThreshold) || 80));
    state.examConfig.strictTiming = parsed.examConfig?.strictTiming !== false;
    state.examConfig.blueprintId = String(parsed.examConfig?.blueprintId || "");
    state.gamification.weeklyTarget = Math.max(1, Number(parsed.gamification?.weeklyTarget || DEFAULT_WEEKLY_TARGET));
    state.gamification.totalAnswered = Math.max(0, Number(parsed.gamification?.totalAnswered || 0));
    state.gamification.totalCorrect = Math.max(0, Number(parsed.gamification?.totalCorrect || 0));
    state.gamification.streakDays = Math.max(0, Number(parsed.gamification?.streakDays || 0));
    state.gamification.lastActiveDay = String(parsed.gamification?.lastActiveDay || "");
    state.gamification.dailyAttempts = parsed.gamification?.dailyAttempts && typeof parsed.gamification.dailyAttempts === "object"
      ? parsed.gamification.dailyAttempts
      : {};
    state.gamification.weeklyAttempts = parsed.gamification?.weeklyAttempts && typeof parsed.gamification.weeklyAttempts === "object"
      ? parsed.gamification.weeklyAttempts
      : {};
    state.gamification.unlockedBadges = parsed.gamification?.unlockedBadges && typeof parsed.gamification.unlockedBadges === "object"
      ? parsed.gamification.unlockedBadges
      : {};
  } catch {
    state.deck = hydrateCards(STARTER_DECK);
    state.resources = [...DEFAULT_RESOURCES];
  }
}

function splitAnswers(raw) {
  return String(raw)
    .split("|")
    .map((x) => x.trim())
    .filter(Boolean);
}

function normalizePlainText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCodeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\bmodifier\b/g, "")
    .replace(/\bcode\b/g, "")
    .replace(/[^a-z0-9]/g, "");
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

  // Allow containment for longer phrases.
  const minLen = Math.min(user.length, ans.length);
  if (minLen >= 7 && (user.includes(ans) || ans.includes(user))) return true;

  // Typo tolerance for textual answers only.
  const distance = levenshteinDistance(user, ans);
  const maxLen = Math.max(user.length, ans.length);
  if (maxLen <= 8) return distance <= 1;
  if (maxLen <= 16) return distance <= 2;
  return distance / maxLen <= 0.12;
}
