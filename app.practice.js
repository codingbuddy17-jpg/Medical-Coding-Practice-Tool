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

function matchesSelectedTag(card) {
  if (state.selectedTag === "ALL") return true;
  const raw = String(card.tag || "").toUpperCase();
  const target = state.selectedTag.toUpperCase().replace(/[^A-Z0-9]/g, "");

  // Return true if any keyword match represents the selected category
  const cleaned = raw.replace(/[^A-Z0-9]/g, "");
  return cleaned.includes(target);
}

function filteredDeck() {
  return state.deck.filter(matchesSelectedTag);
}

function getCardsForTag(tagKey) {
  if (tagKey === "ALL") return [...state.deck];
  const target = tagKey.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return state.deck.filter((card) => {
    const cleaned = String(card.tag || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    return cleaned.includes(target);
  });
}

function resetStudyOrder(tagKey = null) {
  if (tagKey) {
    delete state.studyOrder.queues[tagKey];
    delete state.studyOrder.cursors[tagKey];
    delete state.studyOrder.seeds[tagKey];
    return;
  }
  state.studyOrder.queues = {};
  state.studyOrder.cursors = {};
  state.studyOrder.seeds = {};
}

function buildStudyQueueForTag(tagKey) {
  const ids = getCardsForTag(tagKey).map((card) => card.id);
  const seed =
    state.studyOrder.seeds[tagKey] ||
    (state.session.shuffleSeed ? `${state.session.shuffleSeed}|practice|${tagKey || "ALL"}` : "");
  const rng = seed ? createSeededRng(seed) : null;
  state.studyOrder.queues[tagKey] = shuffledCopy(ids, rng);
  state.studyOrder.cursors[tagKey] = 0;
}

function ensureStudyQueue(tagKey) {
  const cards = getCardsForTag(tagKey);
  const ids = cards.map((card) => card.id);
  const existing = state.studyOrder.queues[tagKey];
  const isValid =
    Array.isArray(existing) &&
    existing.length === ids.length &&
    existing.every((id) => ids.includes(id));

  if (!isValid) {
    buildStudyQueueForTag(tagKey);
  }

  const queue = state.studyOrder.queues[tagKey] || [];
  if (!queue.length) return queue;

  if (typeof state.studyOrder.cursors[tagKey] !== "number") {
    state.studyOrder.cursors[tagKey] = 0;
  }
  if (state.studyOrder.cursors[tagKey] >= queue.length) {
    state.studyOrder.cursors[tagKey] = 0;
  }
  return queue;
}

function getExamCard() {
  const cardId = state.exam.queueIds[state.exam.cursor];
  if (!cardId) return null;
  return state.deck.find((card) => card.id === cardId) || null;
}

function currentCard() {
  if (state.exam.inProgress) {
    return getExamCard();
  }

  const queue = ensureStudyQueue(state.selectedTag);
  if (!queue.length) return null;
  const cursor = state.studyOrder.cursors[state.selectedTag] || 0;
  const cardId = queue[cursor];
  return state.deck.find((card) => card.id === cardId) || null;
}

function renderCategoryButtons() {
  dom.categoryButtons.innerHTML = CATEGORY_OPTIONS.map((item) => {
    const activeClass = item.key === state.selectedTag ? "active" : "";
    return `<button type="button" class="tag-btn ${activeClass}" data-tag="${escapeHtml(item.key)}">${escapeHtml(item.label)}</button>`;
  }).join("");
}

function renderResources() {
  const isTrainer = state.role === "trainer";
  if (!state.resources.length) {
    dom.resourceList.innerHTML = '<li class="resource-item">No resources added.</li>';
    return;
  }

  dom.resourceList.innerHTML = state.resources
    .map((item, idx) => {
      const removeBtn = isTrainer
        ? `<button type="button" class="ghost-btn" data-remove-resource="${idx}">Delete</button>`
        : "";
      const href = safeResourceHref(item.url);
      return `
        <li class="resource-item">
          <a class="resource-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a>
          ${removeBtn}
        </li>
      `;
    })
    .join("");
}

function formatPercent(correct, attempted) {
  return attempted ? `${Math.round((correct / attempted) * 100)}%` : "0%";
}

function renderCategoryScorecards() {
  const stats = state.session.categoryStats || createEmptyCategoryStats();
  const rows = [];

  TRACKED_CATEGORY_KEYS.forEach((key) => {
    const s = stats[key] || { attempted: 0, correct: 0, wrong: 0 };
    if (s.attempted > 0) {
      rows.push(`<tr><td>${key}</td><td>${s.attempted}</td><td>${s.correct}</td><td>${s.wrong}</td><td>${formatPercent(s.correct, s.attempted)}</td></tr>`);
    }
  });

  const other = stats.OTHER || { attempted: 0, correct: 0, wrong: 0 };
  if (other.attempted > 0) {
    rows.push(`<tr><td>OTHER</td><td>${other.attempted}</td><td>${other.correct}</td><td>${other.wrong}</td><td>${formatPercent(other.correct, other.attempted)}</td></tr>`);
  }

  if (!rows.length) {
    dom.categoryScoreBody.innerHTML = '<tr><td colspan="5">Scorecards will appear as you attempt questions.</td></tr>';
    return;
  }

  dom.categoryScoreBody.innerHTML = rows.join("");
}

function updateRoleUI() {
  const isTrainer = state.role === "trainer";
  const trainerKeyVerified = isTrainer && state.trainerKeyVerified;
  console.log("updateRoleUI called. Role:", state.role);
  const canUseExam = isTrainer || state.role === "trainee";
  dom.trainerZone.classList.toggle("hidden", !trainerKeyVerified);
  dom.resourceManager.classList.toggle("hidden", !trainerKeyVerified);

  // Force visibility via inline style to prevent CSS conflicts
  if (dom.traineeCodeWrap) {
    dom.traineeCodeWrap.classList.add("hidden");
    dom.traineeCodeWrap.style.display = "none";
  }
  if (dom.trainerKeyWrap) {
    dom.trainerKeyWrap.classList.toggle("hidden", !isTrainer);
    dom.trainerKeyWrap.style.display = isTrainer ? "block" : "none";
  }

  if (!canUseExam) dom.examPanel.classList.add("hidden");
  dom.importStatus.textContent = "";
  dom.sessionLoadStatus.textContent = "";
  if (!trainerKeyVerified) clearImportPreview();
  if (!isTrainer) {
    state.trainerKeyVerified = false;
    state.adminPanel.verified = false;
    dom.adminTools.classList.add("hidden");
    if (dom.adminActiveIndicator) dom.adminActiveIndicator.classList.add("hidden");
    setStatus(dom.adminStatus, "");
  }
  dom.examTrialContactWrap.classList.add("hidden");
  if (dom.examRemainingNotice) {
    dom.examRemainingNotice.classList.toggle("hidden", isTrainer);
  }
  dom.flagQuestionBtn.classList.toggle("hidden", isTrainer);
  syncExamControlLock();
  renderResources();
  if (trainerKeyVerified) {
    loadImportReviewQueue();
    loadImportBatches();
  } else {
    state.importAdmin.reviewItems = [];
    state.importAdmin.batches = [];
    renderImportReviewQueue();
    renderImportBatches();
  }
  updateTrialLockUI();
  updateTrialInfoBannerUI();
  updateUpgradeWallUI();
  updatePreSessionLandingUI();
  updateGoogleAuthUI();
}

function updateSessionIdentityLock() {
  const locked = Boolean(state.session.isActive);
  dom.userName.disabled = locked;
  dom.userEmail.disabled = locked;
  dom.userPhone.disabled = locked;
  dom.roleSelect.disabled = locked;
  dom.traineeCode.disabled = locked;
  dom.trainerKey.disabled = locked;
  dom.startBtn.disabled = locked;

  if (dom.topbarSessionSummary && dom.topbarSessionActions) {
    if (state.session.isActive) {
      const name = state.userName || "Session";
      const attempted = state.session.attempted || 0;
      const score = attempted ? Math.round((state.session.correct / attempted) * 100) : 0;
      const avgSeconds = attempted ? state.session.totalAnswerTimeMs / attempted / 1000 : 0;
      const avgLabel = attempted ? formatSeconds(avgSeconds) : "--";
      dom.topbarSessionSummary.textContent = `${name} · ${score}% · Avg/Q ${avgLabel}`;
      dom.topbarSessionSummary.classList.remove("hidden");
      dom.topbarSessionActions.classList.remove("hidden");
      if (dom.exportReportBtn) dom.exportReportBtn.classList.remove("hidden");
      if (dom.endSessionBtn) dom.endSessionBtn.classList.remove("hidden");
      if (dom.googleSignOutBtn) dom.googleSignOutBtn.classList.toggle("hidden", !state.auth.googleUser?.email);

      // Show Practice View
      const practiceTab = document.getElementById("view-practice");
      if (practiceTab) {
        practiceTab.classList.remove("hidden");
        practiceTab.classList.add("active");
      }
    } else {
      dom.topbarSessionSummary.textContent = "";
      dom.topbarSessionSummary.classList.add("hidden");
      if (state.auth.googleUser?.email) {
        dom.topbarSessionActions.classList.remove("hidden");
        if (dom.exportReportBtn) dom.exportReportBtn.classList.add("hidden");
        if (dom.endSessionBtn) dom.endSessionBtn.classList.add("hidden");
        if (dom.googleSignOutBtn) dom.googleSignOutBtn.classList.remove("hidden");
      } else {
        dom.topbarSessionActions.classList.add("hidden");
      }

      // Hide Practice View
      const practiceTab = document.getElementById("view-practice");
      if (practiceTab) {
        practiceTab.classList.add("hidden");
        practiceTab.classList.remove("active");
      }
    }
  }
}

function updateMetrics() {
  const { correct, wrong, attempted } = state.session;
  const gradedAttempted = Math.max(0, attempted - (state.session.skipped || 0));
  const score = gradedAttempted === 0 ? 0 : Math.round((correct / gradedAttempted) * 100);

  dom.correctCount.textContent = String(correct);
  dom.wrongCount.textContent = String(wrong);
  dom.attemptedCount.textContent = String(attempted);
  dom.sessionScore.textContent = `${score}%`;

  if (dom.metricScoreCard) {
    dom.metricScoreCard.classList.remove("score-high", "score-mid", "score-low");
    if (attempted > 0) {
      if (score >= 80) dom.metricScoreCard.classList.add("score-high");
      else if (score >= 50) dom.metricScoreCard.classList.add("score-mid");
      else dom.metricScoreCard.classList.add("score-low");
    }
  }

  if (dom.topbarSessionSummary && state.session.isActive) {
    const name = state.userName || "Session";
    const avgSeconds = attempted ? state.session.totalAnswerTimeMs / attempted / 1000 : 0;
    const avgLabel = attempted ? formatSeconds(avgSeconds) : "--";
    dom.topbarSessionSummary.textContent = `${name} · ${score}% · Avg/Q ${avgLabel}`;
  }

  if (dom.examRemainingNotice && state.role !== "trainer") {
    dom.examRemainingNotice.textContent = `Remaining session questions: ${remainingSessionLimit()}`;
  }

  updateTrialInfoBannerUI();
}

function updateExamStatusUI() {
  if (!state.exam.inProgress) {
    dom.examTimer.textContent = "Time left: --:--";
    if (dom.examRemainingNotice && state.role !== "trainer") {
      dom.examRemainingNotice.textContent = `Remaining session questions: ${remainingSessionLimit()}`;
    }
    return;
  }

  const total = state.exam.queueIds.length;
  const answered = state.exam.answered;
  const threshold = Math.min(100, Math.max(1, Number(state.exam.passThreshold || state.examConfig.passThreshold || 80)));
  const name = state.exam.blueprintName ? ` [${state.exam.blueprintName}]` : "";
  const reviewNote = state.exam.reviewingSkipped ? " Review of skipped questions in progress." : "";
  setStatus(dom.examStatus, `Exam running${name}: ${answered}/${total} answered. Pass ${threshold}%.${reviewNote}`);
  if (dom.examRemainingNotice && state.role !== "trainer") {
    dom.examRemainingNotice.textContent = `Remaining session questions: ${remainingSessionLimit()}`;
  }
  if (!state.exam.strictTiming) {
    dom.examTimer.textContent = "Time left: Untimed";
    return;
  }
  const mm = String(Math.floor(state.exam.remainingSeconds / 60)).padStart(2, "0");
  const ss = String(state.exam.remainingSeconds % 60).padStart(2, "0");
  dom.examTimer.textContent = `Time left: ${mm}:${ss}`;
}

function setAwaitingNext(value) {
  state.awaitingNext = value;
  dom.checkBtn.disabled = value || hasSessionLimitReached();
  dom.nextBtn.disabled = !value;
}

function renderCard() {
  const cards = filteredDeck();
  const card = currentCard();

  if (!card) {
    dom.cardTag.textContent = state.selectedTag === "ALL" ? "General" : state.selectedTag;
    dom.cardPrompt.textContent =
      state.selectedTag === "ALL"
        ? "No cards available. Trainer can import a deck."
        : `No cards found for ${state.selectedTag}. Select another category.`;
    dom.userAnswer.value = "";
    state.selectedMcqOption = "";
    dom.mcqOptions.innerHTML = "";
    dom.mcqOptions.classList.add("hidden");
    dom.userAnswer.classList.remove("hidden");
    setStatus(dom.feedback, "");
    setPracticeFeedbackState("neutral");
    setStatus(dom.rationalePlaceholder, DEFAULT_RATIONALE_TEXT);
    if (dom.rationaleDetails) {
      dom.rationaleDetails.classList.add("hidden");
      dom.rationaleDetails.open = false;
    }
    setAwaitingNext(false);
    dom.flagQuestionBtn.disabled = true;
    updateTrialLockUI();
    updateTrialInfoBannerUI();
    updateUpgradeWallUI();
    dom.categoryStatus.textContent = state.role === "trainer" ? `Showing 0 cards for ${state.selectedTag}.` : "";

    // Hide rationale when no card
    dom.rationalePlaceholder.classList.add("hidden");
    state.session.questionStartAt = null;
    return;
  }

  if (hasSessionLimitReached()) {
    dom.cardTag.textContent = "Trial Complete";
    dom.cardPrompt.textContent =
      `You have completed your current limit of ${activeSessionLimit()} questions. ${trialUpgradeMessage()}`;
    dom.userAnswer.value = "";
    state.selectedMcqOption = "";
    dom.mcqOptions.innerHTML = "";
    dom.mcqOptions.classList.add("hidden");
    dom.userAnswer.classList.remove("hidden");
    setStatus(dom.feedback, "");
    setPracticeFeedbackState("neutral");

    // Show upgrade message in rationale box
    dom.rationalePlaceholder.classList.remove("hidden");
    setStatus(dom.rationalePlaceholder, "Unlock full access to continue practicing all questions.");
    if (dom.rationaleDetails) {
      dom.rationaleDetails.classList.remove("hidden");
      dom.rationaleDetails.open = true;
    }

    setAwaitingNext(false);
    dom.flagQuestionBtn.disabled = true;
    updateTrialLockUI();
    updateTrialInfoBannerUI();
    updateUpgradeWallUI();
    dom.categoryStatus.textContent = state.role === "trainer" ? "Question limit reached for current access." : "";
    state.session.questionStartAt = null;
    return;
  }

  dom.cardTag.textContent = card.tag;
  dom.cardPrompt.textContent = card.question;
  dom.userAnswer.value = "";
  state.selectedMcqOption = "";
  dom.mcqOptions.innerHTML = "";
  dom.mcqOptions.classList.add("hidden");
  dom.userAnswer.classList.remove("hidden");

  if (card.type === "mcq") {
    dom.userAnswer.classList.add("hidden");
    dom.mcqOptions.classList.remove("hidden");
    const labels = ["A", "B", "C", "D"];
    dom.mcqOptions.innerHTML = (card.options || [])
      .map((opt, idx) => {
        const key = labels[idx];
        const isSelected = state.selectedMcqOption === key;
        return `
          <label class="mcq-radio-option ${isSelected ? "selected" : ""}" data-option-key="${key}">
            <input type="radio" name="mcqAnswer" value="${key}" ${isSelected ? "checked" : ""} ${hasSessionLimitReached() ? "disabled" : ""}>
            <span>${key}) ${escapeHtml(opt)}</span>
          </label>
        `;
      })
      .join("");
    dom.checkBtn.disabled = hasSessionLimitReached();
    dom.nextBtn.disabled = true;
  }

  setStatus(dom.feedback, "");
  setPracticeFeedbackState("neutral");

  // Hide rationale initially for new card
  dom.rationalePlaceholder.classList.add("hidden");
  setStatus(dom.rationalePlaceholder, "");
  if (dom.rationaleDetails) {
    dom.rationaleDetails.classList.add("hidden");
    dom.rationaleDetails.open = false;
  }

  setAwaitingNext(false);
  updateTrialLockUI();
  updateTrialInfoBannerUI();

  if (state.exam.inProgress) {
    dom.categoryStatus.textContent = `Exam mode: ${state.exam.answered}/${state.exam.queueIds.length} answered.`;
  } else {
    dom.categoryStatus.textContent = state.role === "trainer" ? `Showing ${cards.length} cards for ${state.selectedTag}.` : "";
  }

  if (card.type !== "mcq") dom.userAnswer.focus();
  dom.flagQuestionBtn.disabled = !state.session.isActive || hasSessionLimitReached();
  updateUpgradeWallUI();

  if (state.session.isActive) {
    state.session.questionStartAt = Date.now();
  }
}

function setSelectedTag(tag) {
  if (state.exam.inProgress) {
    setStatus(dom.categoryStatus, "Cannot change category during exam mode.", "error");
    return;
  }
  state.selectedTag = tag;
  const queue = ensureStudyQueue(tag);
  state.studyOrder.cursors[tag] = 0;
  renderCategoryButtons();
  renderCard();
  saveLocal();
}
