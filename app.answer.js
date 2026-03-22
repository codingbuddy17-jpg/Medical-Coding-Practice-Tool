async function logAnswer(payload) {
  try {
    await apiRequest("/api/session/answer", "POST", payload);
  } catch {
    // do not block classroom flow if backend unavailable
  }
}

async function validateCurrentAnswer() {
  if (state.processingAnswer) return; // Prevent double-submit
  state.processingAnswer = true;

  try {
    if (!state.session.isActive) {
      setStatus(dom.feedback, "Start a session first.", "error");
      return;
    }

    if (hasSessionLimitReached()) {
      updateTrialLockUI();
      setStatus(dom.feedback, `Question limit reached. ${trialUpgradeMessage()}`, "error");
      return;
    }

    if (state.awaitingNext) {
      setStatus(dom.feedback, "Click Next to move to the next question.");
      return;
    }

    const card = currentCard();
    if (!card) {
      setStatus(dom.feedback, "No card available in selected category.", "error");
      return;
    }

    let responseValue = "";
    if (card.type === "mcq") {
      responseValue = state.selectedMcqOption;
      if (!responseValue) {
        setStatus(dom.feedback, "Select an option before checking.", "error");
        return;
      }
    } else {
      responseValue = dom.userAnswer.value.trim();
      if (!responseValue) {
        setStatus(dom.feedback, "Enter an answer before checking.", "error");
        return;
      }
    }

    const result = checkAnswer(responseValue, card.answer, card);
    const durationMs = consumeQuestionTime();
    state.session.attempted += 1;

    if (state.exam.inProgress) {
      // EXAM MODE: Silent Check (No Feedback, Auto-advance)
      state.exam.attemptedTotal += 1;
      state.exam.answered += 1;
      if (result.isCorrect) {
        state.exam.correct += 1;
      } else {
        state.exam.wrong += 1;
      }
      // Update generic session stats too, but silently
      if (result.isCorrect) state.session.correct += 1;
      else state.session.wrong += 1;
      trackGamificationAttempt(result.isCorrect);

      recordCategoryAndCardStats(card, result.isCorrect, durationMs);
      updateMetrics(); // Sync top bar stats

      // Throttle to prevent double-clicks/execution
      await new Promise(r => setTimeout(r, 300));

      // Auto-advance immediately
      state.awaitingNext = true; // Required for nextQuestion() to proceed
      nextQuestion();
      return;
    }

    // PRACTICE MODE: Visual Feedback
    // Reveal Rationale
    const rationale = String(card.rationale || "").trim() || DEFAULT_RATIONALE_TEXT;
    dom.rationalePlaceholder.classList.remove("hidden");
    setStatus(dom.rationalePlaceholder, rationale, result.isCorrect ? "success" : "error");
    if (dom.rationaleDetails) {
      dom.rationaleDetails.classList.remove("hidden");
      dom.rationaleDetails.open = true;
    }

    if (result.isCorrect) {
      state.session.correct += 1;
      setStatus(dom.feedback, `Correct. Expected: ${result.primaryAnswer}`, "success");
      setPracticeFeedbackState("success");
    } else {
      state.session.wrong += 1;
      setStatus(dom.feedback, `Not correct. Expected: ${result.primaryAnswer}`, "error");
      setPracticeFeedbackState("error");
    }
    trackGamificationAttempt(result.isCorrect);

    trackRecentResult(result.isCorrect);
    recordCategoryAndCardStats(card, result.isCorrect, durationMs);
    updateMetrics();
    renderCategoryScorecards();

    await logAnswer({
      sessionId: state.session.id,
      cardTag: card.tag,
      question: card.question,
      expectedAnswer: result.primaryAnswer,
      acceptedAnswers: result.acceptedAnswers,
      userAnswer: responseValue,
      isCorrect: result.isCorrect,
      isSkipped: false,
      durationMs,
      at: Date.now()
    });
    setAwaitingNext(true);

  } finally {
    state.processingAnswer = false;
  }
}

function handleSkipInExam(card) {
  if (!card || !state.exam.inProgress) return;
  if (!state.exam.reviewingSkipped) {
    if (!state.exam.skippedIds.includes(card.id)) {
      state.exam.skippedIds.push(card.id);
    }
  }
  advanceCardAfterAttempt(card);
}

async function skipQuestion() {
  if (!state.session.isActive) {
    setStatus(dom.feedback, "Start a session first.", "error");
    return;
  }

  if (hasSessionLimitReached()) {
    updateTrialLockUI();
    setStatus(dom.feedback, `Question limit reached. ${trialUpgradeMessage()}`, "error");
    return;
  }

  const card = currentCard();
  if (!card) {
    setStatus(dom.feedback, "No card available in selected category.", "error");
    return;
  }

  if (state.exam.inProgress && state.exam.reviewingSkipped) {
    setStatus(dom.feedback, "Review pass: please answer skipped questions to finish the exam.", "error");
    return;
  }

  const durationMs = consumeQuestionTime();
  state.session.attempted += 1;
  state.session.skipped += 1;
  trackGamificationAttempt(false);
  recordSkipStats(card, durationMs);
  updateMetrics();
  renderCategoryScorecards();

  if (!state.exam.inProgress) {
    trackRecentResult(false);
  }

  await logAnswer({
    sessionId: state.session.id,
    cardTag: card.tag,
    question: card.question,
    expectedAnswer: "",
    acceptedAnswers: [],
    userAnswer: "[SKIPPED]",
    isCorrect: false,
    isSkipped: true,
    durationMs,
    at: Date.now()
  });

  if (state.exam.inProgress) {
    state.exam.attemptedTotal += 1;
    handleSkipInExam(card);
    setStatus(dom.feedback, "Skipped. This will reappear in the review pass.", "neutral");
    setPracticeFeedbackState("neutral");
    return;
  }

  setStatus(dom.feedback, "Skipped.", "neutral");
  setPracticeFeedbackState("neutral");
  advanceCardAfterAttempt(card);
}

function nextQuestion() {
  // Allow advance if awaiting next (Practice) OR Exam in progress (Auto/Manual)
  if (!state.awaitingNext && !state.exam.inProgress) {
    setStatus(dom.feedback, "Use Check first, then click Next.");
    return;
  }

  if (hasSessionLimitReached()) {
    setAwaitingNext(false);
    renderCard();
    return;
  }

  const card = currentCard();
  if (!card) return;

  setAwaitingNext(false);
  advanceCardAfterAttempt(card);
}

