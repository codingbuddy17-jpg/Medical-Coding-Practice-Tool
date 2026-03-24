function consumeQuestionTime() {
  const start = Number(state.session.questionStartAt || 0);
  if (!start) return 0;
  const elapsed = Math.max(0, Date.now() - start);
  state.session.questionStartAt = null;
  state.session.totalAnswerTimeMs += elapsed;
  if (state.exam.inProgress) {
    state.exam.totalAnswerTimeMs += elapsed;
  }
  return elapsed;
}

function trackRecentResult(isCorrect) {
  const list = Array.isArray(state.session.recentResults) ? state.session.recentResults : [];
  list.push(Boolean(isCorrect));
  while (list.length > 5) list.shift();
  state.session.recentResults = list;
}

function computeAdaptiveTarget() {
  const recent = state.session.recentResults || [];
  if (!recent.length) return "medium";
  const correct = recent.filter(Boolean).length;
  const ratio = correct / recent.length;
  if (ratio >= 0.8) return "hard";
  if (ratio <= 0.4) return "easy";
  return "medium";
}

function cardDifficulty(card) {
  const stat = state.session.cardStats[card.id];
  if (!stat || !stat.attempted) return "medium";
  const acc = stat.correct / stat.attempted;
  if (acc >= 0.8) return "easy";
  if (acc <= 0.5) return "hard";
  return "medium";
}

function pickAdaptiveNextCard(cards, currentCardId) {
  const target = computeAdaptiveTarget();
  const candidates = cards.filter((c) => c.id !== currentCardId && cardDifficulty(c) === target);
  if (candidates.length) return candidates[Math.floor(Math.random() * candidates.length)];
  const fallback = cards.filter((c) => c.id !== currentCardId && cardDifficulty(c) === "medium");
  if (fallback.length) return fallback[Math.floor(Math.random() * fallback.length)];
  const any = cards.filter((c) => c.id !== currentCardId);
  return any[0] || cards[0] || null;
}

function reshufflePracticeQueue(tagKey, reason = "") {
  if (!tagKey) return;
  state.studyOrder.seeds[tagKey] = `${state.session.shuffleSeed}|practice|${tagKey}|${Date.now()}|${reason}`;
  buildStudyQueueForTag(tagKey);
}

function getWeaknessScore(card) {
  const tagKey = normalizeTagKey(card.tag);
  const category = state.session.categoryStats[tagKey] || state.session.categoryStats.OTHER;
  const cardStat = state.session.cardStats[card.id] || { attempted: 0, wrong: 0 };

  const categoryWeakness = category.attempted ? category.wrong / category.attempted : 0;
  const cardWeakness = cardStat.attempted ? cardStat.wrong / cardStat.attempted : 0;

  return categoryWeakness * 2 + cardWeakness * 3 + cardStat.wrong * 0.5 + Math.random() * 0.2;
}

function pickNextWeakCard(cards, currentCardId) {
  if (!cards.length) return null;

  const ranked = cards
    .map((card, idx) => ({ idx, card, score: getWeaknessScore(card) }))
    .sort((a, b) => b.score - a.score);

  const candidate = ranked.find((item) => item.card.id !== currentCardId) || ranked[0];
  return candidate ? candidate.idx : 0;
}

function advanceCardAfterAttempt(current) {
  if (state.exam.inProgress) {
    state.exam.cursor += 1;
    if (state.exam.cursor >= state.exam.queueIds.length) {
      if (state.exam.skippedIds && state.exam.skippedIds.length) {
        state.exam.queueIds = [...new Set(state.exam.skippedIds)];
        state.exam.skippedIds = [];
        state.exam.cursor = 0;
        state.exam.reviewingSkipped = true;
      } else {
        finishExam("completed");
        return;
      }
    }
    updateExamStatusUI();
    renderCard();
    return;
  }

  const cards = getCardsForTag(state.selectedTag);
  const queue = ensureStudyQueue(state.selectedTag);
  if (!cards.length || !queue.length) {
    renderCard();
    return;
  }

  if (state.session.attempted > 0 && state.session.attempted % 25 === 0) {
    reshufflePracticeQueue(state.selectedTag, "interval");
  }

  if (state.weakDrillEnabled) {
    const nextIdxInCards = pickNextWeakCard(cards, current.id);
    const nextCard = cards[nextIdxInCards] || cards[0];
    const nextQueueIdx = queue.indexOf(nextCard.id);
    state.studyOrder.cursors[state.selectedTag] = nextQueueIdx >= 0 ? nextQueueIdx : 0;
  } else if (state.adaptiveEnabled) {
    const nextCard = pickAdaptiveNextCard(cards, current.id);
    const nextQueueIdx = nextCard ? queue.indexOf(nextCard.id) : -1;
    state.studyOrder.cursors[state.selectedTag] = nextQueueIdx >= 0 ? nextQueueIdx : 0;
  } else {
    const currentCursor = state.studyOrder.cursors[state.selectedTag] || 0;
    const nextCursor = (currentCursor + 1) % queue.length;
    if (nextCursor === 0) {
      reshufflePracticeQueue(state.selectedTag, "wrap");
    } else {
      state.studyOrder.cursors[state.selectedTag] = nextCursor;
    }
  }

  renderCard();
}

function recordCategoryAndCardStats(card, isCorrect, durationMs = 0) {
  const tagKey = normalizeTagKey(card.tag);
  if (!state.session.categoryStats[tagKey]) {
    state.session.categoryStats[tagKey] = { attempted: 0, correct: 0, wrong: 0, skipped: 0, totalTimeMs: 0, timedCount: 0 };
  }

  const cat = state.session.categoryStats[tagKey];
  cat.attempted += 1;
  if (isCorrect) cat.correct += 1;
  else cat.wrong += 1;
  if (Number(durationMs || 0) > 0) {
    cat.totalTimeMs = Number(cat.totalTimeMs || 0) + Number(durationMs || 0);
    cat.timedCount = Number(cat.timedCount || 0) + 1;
  }

  if (!state.session.cardStats[card.id]) {
    state.session.cardStats[card.id] = { attempted: 0, correct: 0, wrong: 0 };
  }
  const cardStat = state.session.cardStats[card.id];
  cardStat.attempted += 1;
  if (isCorrect) cardStat.correct += 1;
  else cardStat.wrong += 1;
}

function recordSkipStats(card, durationMs = 0) {
  const tagKey = normalizeTagKey(card.tag);
  if (!state.session.categoryStats[tagKey]) {
    state.session.categoryStats[tagKey] = { attempted: 0, correct: 0, wrong: 0, skipped: 0, totalTimeMs: 0, timedCount: 0 };
  }
  const cat = state.session.categoryStats[tagKey];
  cat.attempted += 1;
  cat.skipped = (cat.skipped || 0) + 1;
  if (Number(durationMs || 0) > 0) {
    cat.totalTimeMs = Number(cat.totalTimeMs || 0) + Number(durationMs || 0);
    cat.timedCount = Number(cat.timedCount || 0) + 1;
  }

  if (!state.session.cardStats[card.id]) {
    state.session.cardStats[card.id] = { attempted: 0, correct: 0, wrong: 0, skipped: 0 };
  }
  const cardStat = state.session.cardStats[card.id];
  cardStat.attempted += 1;
  cardStat.skipped = (cardStat.skipped || 0) + 1;
}

async function apiRequest(path, method = "GET", payload = null, authKey = "", extraHeaders = {}) {
  const options = { method, headers: {}, cache: "no-store" };
  if (authKey) {
    options.headers.Authorization = `Bearer ${authKey}`;
  }
  if (state.tenantSlug && state.tenantSlug !== "default") {
    options.headers["X-Tenant-Slug"] = state.tenantSlug;
  }
  if (extraHeaders && typeof extraHeaders === "object") {
    Object.assign(options.headers, extraHeaders);
  }
  if (payload) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(payload);
  }

  const response = await fetch(path, options);
  if (!response.ok) {
    const text = await response.text();
    try {
      const parsed = JSON.parse(text);
      throw new Error(parsed.error || text || `HTTP ${response.status}`);
    } catch {
      throw new Error(text || `HTTP ${response.status}`);
    }
  }
  return response.json();
}

async function loadDeckFromCloud() {
  try {
    const data = await apiRequest("/api/questions");
    const questions = Array.isArray(data.questions) ? data.questions : [];
    if (!questions.length) return false;
    state.deck = hydrateCards(questions);
    resetStudyOrder();
    if (state.selectedTag) reshufflePracticeQueue(state.selectedTag, "import");
    saveLocal();
    return true;
  } catch {
    return false;
  }
}

async function loadPublicAccessConfig() {
  try {
    const data = await apiRequest("/api/access/config");
    state.accessConfig.trialQuestionLimit = Math.max(1, Number(data.trialQuestionLimit || 20));
    state.accessConfig.maxSessionQuestions = Math.max(1, Number(data.maxSessionQuestions || 250));
    state.accessConfig.contactMessage =
      String(data.contactMessage || "").trim() || `For full access, contact ${BRAND_NAME} on WhatsApp at +91 8309661352.`;
  } catch {
    state.accessConfig.trialQuestionLimit = 20;
    state.accessConfig.maxSessionQuestions = 250;
  }
}

function resetSessionTracking() {
  state.session.correct = 0;
  state.session.wrong = 0;
  state.session.attempted = 0;
  state.session.skipped = 0;
  state.session.questionStartAt = null;
  state.session.totalAnswerTimeMs = 0;
  state.session.recentResults = [];
  state.session.categoryStats = createEmptyCategoryStats();
  state.session.cardStats = {};
  renderCategoryScorecards();
}

async function startSession() {
  const userName = dom.userName.value.trim();
  const role = dom.roleSelect.value;
  const userEmail = (role === "trial" || role === "trainee")
    ? String(state.auth.googleUser?.email || dom.userEmail.value || "").trim()
    : dom.userEmail.value.trim();
  const userPhone = dom.userPhone.value.trim();
  const trainerKey = dom.trainerKey.value.trim();
  let verifiedAccess = {
    accessType: role,
    questionLimit: role === "trial" ? Number(state.accessConfig.trialQuestionLimit || 20) : 1000000,
    cohortId: null,
    cohortName: ""
  };

  if (!userName) {
    setStatus(dom.sessionStatus, "Enter a user name to start.", "error");
    return;
  }

  if ((role === "trial" || role === "trainee") && (!userEmail || !userPhone)) {
    setStatus(dom.sessionStatus, "Email and phone are required to start trial/trainee mode.", "error");
    return;
  }

  if (role === "trial" || role === "trainee") {
    if (!isValidMobile(userPhone)) {
      setStatus(dom.sessionStatus, "Enter a valid 10-digit mobile number.", "error");
      return;
    }
    if (REQUIRE_GOOGLE_FOR_TRIAL_TRAINEE) {
      const googleEmail = String(state.auth.googleUser?.email || "").trim().toLowerCase();
      if (!googleEmail || !state.auth.accessToken) {
        setStatus(dom.sessionStatus, "Google sign-in is required for Trial/Learner access.", "error");
        return;
      }
      if (String(userEmail || "").trim().toLowerCase() !== googleEmail) {
        dom.userEmail.value = state.auth.googleUser.email || "";
        setStatus(dom.sessionStatus, "Use your Google-authenticated email to continue.", "error");
        return;
      }
    }
  }

  if (role === "trainee") {
    try {
      const verification = await apiRequest("/api/access/verify", "POST", { email: userEmail });
      if (!verification.valid) {
        let msg = "Learner access is not enabled for this email.";
        if (verification.reason === "email_required_for_learner_access") msg = "Google email is required for learner access.";
        if (verification.reason === "email_not_allowlisted") msg = "This email is not allowlisted. Contact mentor/admin.";
        else if (verification.reason === "learner_inactive") msg = "Learner access is inactive. Contact mentor/admin.";
        else if (verification.reason === "learner_access_expired") msg = "Learner access has expired. Contact mentor/admin.";
        setStatus(dom.sessionStatus, msg, "error");
        return;
      }
      verifiedAccess = {
        accessType: verification.accessType || "trainee",
        questionLimit: Math.max(1, Number(verification.questionLimit || 1000000)),
        cohortId: verification.cohortId || null,
        cohortName: verification.cohortName || ""
      };
    } catch {
      setStatus(dom.sessionStatus, "Could not verify trainee access code. Try again.", "error");
      return;
    }
  }

  if (role === "trainer" && !trainerKey) {
    setStatus(dom.sessionStatus, "Enter trainer key.", "error");
    return;
  }

  if (role === "trainer") {
    try {
      const verification = await apiRequest("/api/trainer/verify", "POST", { trainerKey });
      if (!verification.valid) {
        setStatus(dom.sessionStatus, "Invalid trainer key.", "error");
        return;
      }
    } catch {
      setStatus(dom.sessionStatus, "Could not verify trainer key. Try again.", "error");
      return;
    }
  }

  stopExam();

  state.userName = userName;
  state.userEmail = userEmail;
  state.userPhone = userPhone;
  state.role = role;
  state.trainerKey = trainerKey;
  state.trainerKeyVerified = role === "trainer";
  state.adaptiveEnabled = role === "trial" || role === "trainee";
  state.currentCardIndex = 0;
  state.session.id = uid("session");
  state.session.startedAt = Date.now();
  state.session.isActive = true;
  updatePreSessionLandingUI(); // hide auth/landing panels immediately on login
  const roleLimit = Math.max(
    1,
    Number(role === "trial" ? state.accessConfig.trialQuestionLimit : verifiedAccess.questionLimit || 1000000)
  );
  const sessionCap = Number(state.accessConfig.maxSessionQuestions || 0);
  const cappedLimit = sessionCap > 0 && Number.isFinite(sessionCap) && role !== "trainer"
    ? Math.min(roleLimit, sessionCap)
    : roleLimit;
  state.session.questionLimit = cappedLimit;
  state.session.cohortId = verifiedAccess.cohortId;
  state.session.cohortName = verifiedAccess.cohortName;
  state.session.shuffleSeed = `${state.session.id}|${state.userEmail || "user"}|${Date.now()}`;
  state.awaitingNext = false;
  resetStudyOrder();
  resetSessionTracking();
  updateSessionIdentityLock();

  try {
    const session = await apiRequest("/api/session/start", "POST", {
      sessionId: state.session.id,
      userName,
      userEmail,
      userPhone,
      role,
      authProvider: role === "trial" || role === "trainee" ? "google" : "",
      authAccessToken: role === "trial" || role === "trainee" ? state.auth.accessToken : "",
      authEmail: role === "trial" || role === "trainee" ? (state.auth.googleUser?.email || "") : ""
    });
    state.session.id = session.id || state.session.id;
    saveSessionState();
    const cohortInfo = state.session.cohortName ? ` Cohort: ${state.session.cohortName}.` : "";
    setStatus(dom.sessionStatus, `Session started for ${userName}.${cohortInfo}`, "success");
  } catch (err) {
    state.session.isActive = false;
    state.session.id = null;
    updateSessionIdentityLock();
    updatePreSessionLandingUI();
    setStatus(dom.sessionStatus, `Session start blocked: ${err.message}`, "error");
    return;
  }

  updateRoleUI();
  if (dom.adaptiveToggle) dom.adaptiveToggle.checked = state.adaptiveEnabled;
  updateMetrics();
  setStatus(dom.examStatus, "Exam mode inactive.");
  updateExamStatusUI();
  renderCohortUI();
  await loadAnalyticsCohorts();
  await loadBlueprintTemplates();
  await loadAssignedBlueprintForSession();
  if (state.role === "trainer") await loadFlagQueue();
  await loadDeckFromCloud();
  renderCard();
  saveLocal();
}

async function endSession() {
  if (!state.session.isActive) {
    setStatus(dom.sessionStatus, "No active session.");
    return;
  }

  finishExam("stopped");

  const gradedAttempted = Math.max(0, state.session.attempted - (state.session.skipped || 0));
  const summary = {
    correct: state.session.correct,
    wrong: state.session.wrong,
    attempted: gradedAttempted,
    score: gradedAttempted ? Math.round((state.session.correct / gradedAttempted) * 100) : 0
  };

  try {
    await apiRequest("/api/session/end", "POST", {
      sessionId: state.session.id,
      summary
    });
  } catch {
    // local fallback
  }

  state.session.isActive = false;
  clearSessionState();
  updateSessionIdentityLock();
  updatePreSessionLandingUI();
  setStatus(dom.sessionStatus, `Session ended. Score: ${summary.score}%`, "success");
}

