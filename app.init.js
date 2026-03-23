function bindEvents() {
  if (bindEvents.done) return;
  bindEvents.done = true;
  document.querySelectorAll(".sub-nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      handleMentorSubTab(btn.dataset.subtab);
    });
  });
  if (dom.roleSelect) dom.roleSelect.addEventListener("change", () => {
    state.role = dom.roleSelect.value;
    if (state.role !== "trainer") state.trainerKeyVerified = false;
    updateRoleUI();
    saveLocal();
  });

  if (dom.startBtn) dom.startBtn.addEventListener("click", startSession);
  if (dom.googleAuthBtn) dom.googleAuthBtn.addEventListener("click", startGoogleAuth);
  if (dom.googleSignOutBtn) dom.googleSignOutBtn.addEventListener("click", signOutGoogleAuth);
  if (dom.endSessionBtn) dom.endSessionBtn.addEventListener("click", endSession);
  if (dom.checkBtn) dom.checkBtn.addEventListener("click", validateCurrentAnswer);
  if (dom.skipBtn) dom.skipBtn.addEventListener("click", skipQuestion);
  if (dom.nextBtn) dom.nextBtn.addEventListener("click", nextQuestion);
  if (dom.flagQuestionBtn) dom.flagQuestionBtn.addEventListener("click", flagCurrentQuestion);

  if (dom.categoryButtons) dom.categoryButtons.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-tag]");
    if (!btn) return;
    setSelectedTag(btn.dataset.tag);
  });

  if (dom.mcqOptions) dom.mcqOptions.addEventListener("change", (event) => {
    if (event.target.name !== "mcqAnswer") return;
    if (state.awaitingNext || hasSessionLimitReached()) {
      event.target.checked = false;
      return;
    }
    const selectedKey = event.target.value;
    state.selectedMcqOption = selectedKey;
    dom.mcqOptions.querySelectorAll(".mcq-radio-option").forEach((label) => {
      label.classList.toggle("selected", label.dataset.optionKey === selectedKey);
    });
  });

  if (dom.weakDrillToggle) dom.weakDrillToggle.addEventListener("change", (event) => {
    state.weakDrillEnabled = event.target.checked;
    saveLocal();
  });
  if (dom.adaptiveToggle) dom.adaptiveToggle.addEventListener("change", (event) => {
    state.adaptiveEnabled = event.target.checked;
    saveLocal();
  });

  if (dom.examQuestionCount) dom.examQuestionCount.addEventListener("change", () => {
    state.examConfig.questionCount = Number(dom.examQuestionCount.value) || 30;
    saveLocal();
  });

  if (dom.examBlueprintSelect) dom.examBlueprintSelect.addEventListener("change", onExamBlueprintSelectionChange);

  if (dom.examDuration) dom.examDuration.addEventListener("change", () => {
    state.examConfig.durationMinutes = Number(dom.examDuration.value) || 30;
    saveLocal();
  });

  if (dom.examPassThreshold) dom.examPassThreshold.addEventListener("change", () => {
    state.examConfig.passThreshold = Math.min(100, Math.max(1, Number(dom.examPassThreshold.value) || 80));
    saveLocal();
  });

  if (dom.examStrictTiming) dom.examStrictTiming.addEventListener("change", () => {
    state.examConfig.strictTiming = dom.examStrictTiming.checked;
    saveLocal();
  });

  if (dom.toggleExamPanelBtn) dom.toggleExamPanelBtn.addEventListener("click", () => {
    if (isTrialUser()) {
      setStatus(dom.examStatus, "Mock Exam Practice Mode is available for trainees only. Please contact us to upgrade your access.", "error");
      dom.examTrialContactWrap.classList.remove("hidden");
      dom.examPanel.classList.add("hidden");
      return;
    }
    dom.examTrialContactWrap.classList.add("hidden");
    dom.examPanel.classList.toggle("hidden");
  });

  if (dom.startExamBtn) dom.startExamBtn.addEventListener("click", startExam);
  if (dom.stopExamBtn) dom.stopExamBtn.addEventListener("click", stopExam);
  if (dom.pauseExamBtn) dom.pauseExamBtn.addEventListener("click", togglePauseExam);

  // Dynamic Exam Mode UI
  if (dom.examModeSelect) dom.examModeSelect.addEventListener("change", () => {
    const mode = dom.examModeSelect.value;
    if (mode === "topic") {
      dom.examTopicSelectLabel.classList.remove("hidden");
      dom.examBlueprintSelectLabel.classList.add("hidden");
    } else if (mode === "blueprint") {
      dom.examTopicSelectLabel.classList.add("hidden");
      dom.examBlueprintSelectLabel.classList.remove("hidden");
    } else {
      dom.examTopicSelectLabel.classList.add("hidden");
      dom.examBlueprintSelectLabel.classList.add("hidden");
    }
  });

  if (dom.addResourceBtn) dom.addResourceBtn.addEventListener("click", addResource);
  if (dom.resourceList) dom.resourceList.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-remove-resource]");
    if (!btn) return;
    removeResource(Number(btn.dataset.removeResource));
  });

  if (dom.importFileBtn) dom.importFileBtn.addEventListener("click", importCsvFile);
  if (dom.importBtn) dom.importBtn.addEventListener("click", importCsv);
  if (dom.confirmImportBtn) dom.confirmImportBtn.addEventListener("click", confirmImportFromPreview);
  if (dom.cancelImportPreviewBtn) dom.cancelImportPreviewBtn.addEventListener("click", () => {
    clearImportPreview();
    setStatus(dom.importStatus, "Import preview cleared.");
  });
  if (dom.importPreviewPrevBtn) {
    dom.importPreviewPrevBtn.addEventListener("click", () => {
      if (state.importPreview.page > 1) {
        state.importPreview.page -= 1;
        renderImportPreview();
      }
    });
  }
  if (dom.importPreviewNextBtn) {
    dom.importPreviewNextBtn.addEventListener("click", () => {
      const totalPages = Math.max(1, Math.ceil(state.importPreview.rows.length / Number(state.importPreview.pageSize || 120)));
      if (state.importPreview.page < totalPages) {
        state.importPreview.page += 1;
        renderImportPreview();
      }
    });
  }
  if (dom.importPreviewPageInput) {
    dom.importPreviewPageInput.addEventListener("change", () => {
      const totalPages = Math.max(1, Math.ceil(state.importPreview.rows.length / Number(state.importPreview.pageSize || 120)));
      const next = Math.max(1, Math.min(totalPages, Number(dom.importPreviewPageInput.value || 1)));
      state.importPreview.page = next;
      renderImportPreview();
    });
  }

  if (dom.refreshImportReviewBtn) dom.refreshImportReviewBtn.addEventListener("click", loadImportReviewQueue);
  if (dom.resolveAllImportReviewBtn) dom.resolveAllImportReviewBtn.addEventListener("click", resolveAllImportReviewItems);
  if (dom.exportImportReviewBtn) {
    dom.exportImportReviewBtn.addEventListener("click", exportImportReviewQueueCsv);
  }

  // Question Bank
  if (dom.refreshQuestionBankBtn) {
    dom.refreshQuestionBankBtn.addEventListener("click", loadQuestionBank);
  }
  if (dom.exportQuestionBankBtn) {
    dom.exportQuestionBankBtn.addEventListener("click", exportQuestionBankCsv);
  }
  if (dom.questionBankSearchInput) {
    dom.questionBankSearchInput.addEventListener("input", renderQuestionBankTable);
  }
  if (dom.questionBankTagFilter) {
    dom.questionBankTagFilter.addEventListener("change", loadQuestionBank);
  }
  if (dom.questionBankSelectAll) {
    dom.questionBankSelectAll.addEventListener("change", () => {
      const questions = filteredQuestionsForBank().slice(0, 100);
      const selected = state.questionBank.selectedIds || new Set();
      if (dom.questionBankSelectAll.checked) {
        questions.forEach((q) => selected.add(q.id));
      } else {
        questions.forEach((q) => selected.delete(q.id));
      }
      state.questionBank.selectedIds = selected;
      renderQuestionBankTable();
    });
  }
  if (dom.questionBankBulkApplyBtn) {
    dom.questionBankBulkApplyBtn.addEventListener("click", bulkUpdateQuestionTags);
  }
  if (dom.questionBankBody) {
    dom.questionBankBody.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-bank-action]");
      if (!btn) return;
      const action = btn.dataset.bankAction;
      const id = btn.dataset.bankId;
      if (action === "delete") deleteQuestion(id);
    });
    dom.questionBankBody.addEventListener("change", (e) => {
      const checkbox = e.target.closest("input[data-bank-select]");
      if (!checkbox) return;
      const id = checkbox.dataset.bankSelect;
      if (!id) return;
      const selected = state.questionBank.selectedIds || new Set();
      if (checkbox.checked) selected.add(id);
      else selected.delete(id);
      state.questionBank.selectedIds = selected;
      updateQuestionBankSelectionUI(filteredQuestionsForBank().slice(0, 100).map((q) => q.id));
    });
  }

  if (dom.importReviewStatusFilter) dom.importReviewStatusFilter.addEventListener("change", loadImportReviewQueue);
  if (dom.importReviewBody) dom.importReviewBody.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-import-review-action][data-import-review-id]");
    if (!button) return;
    handleImportReviewAction(button.dataset.importReviewAction, button.dataset.importReviewId);
  });

  if (dom.refreshImportBatchesBtn) dom.refreshImportBatchesBtn.addEventListener("click", loadImportBatches);
  if (dom.rollbackBatchBtn) dom.rollbackBatchBtn.addEventListener("click", rollbackImportBatch);
  if (dom.loadStarterBtn) dom.loadStarterBtn.addEventListener("click", loadStarterDeck);
  if (dom.exportBtn) dom.exportBtn.addEventListener("click", exportCsv);
  if (dom.refreshSessionsBtn) dom.refreshSessionsBtn.addEventListener("click", loadSessions);
  if (dom.exportSessionsBtn) dom.exportSessionsBtn.addEventListener("click", exportSessionsCsv);
  if (dom.sessionSearchInput) dom.sessionSearchInput.addEventListener("input", renderSessionConsoleTable);
  if (dom.sessionRoleFilter) dom.sessionRoleFilter.addEventListener("change", renderSessionConsoleTable);
  if (dom.sessionWindowFilter) dom.sessionWindowFilter.addEventListener("change", renderSessionConsoleTable);
  if (dom.excludeTrialToggle) dom.excludeTrialToggle.addEventListener("change", renderSessionConsoleTable);
  if (dom.refreshFlagsBtn) dom.refreshFlagsBtn.addEventListener("click", loadFlagQueue);
  if (dom.flagStatusFilter) dom.flagStatusFilter.addEventListener("change", loadFlagQueue);
  if (dom.flagQueueBody) dom.flagQueueBody.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-flag-action][data-flag-id]");
    if (!button) return;
    const action = button.dataset.flagAction;
    const flagId = button.dataset.flagId;
    handleFlagQueueAction(action, flagId);
  });

  if (dom.verifyAdminBtn) dom.verifyAdminBtn.addEventListener("click", verifyAdmin);
  if (dom.loadAdminDataBtn) dom.loadAdminDataBtn.addEventListener("click", loadAdminData);
  if (dom.clearCacheBtn) dom.clearCacheBtn.addEventListener("click", hardReset);
  const auditRefreshBtn = document.getElementById("auditLogRefreshBtn");
  if (auditRefreshBtn) auditRefreshBtn.addEventListener("click", () => {
    const actionFilter = String((document.getElementById("auditActionFilter") || {}).value || "");
    loadAuditLog({ limit: 200, actionFilter });
  });
  const loadTenantsBtn = document.getElementById("loadTenantsBtn");
  if (loadTenantsBtn) loadTenantsBtn.addEventListener("click", loadTenants);
  const saveTenantBtn = document.getElementById("saveTenantBtn");
  if (saveTenantBtn) saveTenantBtn.addEventListener("click", saveTenant);
  const clearTenantFormBtn = document.getElementById("clearTenantFormBtn");
  if (clearTenantFormBtn) clearTenantFormBtn.addEventListener("click", clearTenantForm);
  if (dom.saveAccessConfigBtn) dom.saveAccessConfigBtn.addEventListener("click", saveAccessConfig);
  if (dom.saveLearnerBtn) dom.saveLearnerBtn.addEventListener("click", saveLearnerAccess);
  if (dom.refreshLearnersBtn) dom.refreshLearnersBtn.addEventListener("click", loadLearnerAccessList);
  if (dom.learnerAccessBody) dom.learnerAccessBody.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-learner-action][data-learner-email]");
    if (!button) return;
    handleLearnerAccessAction(button.dataset.learnerAction, button.dataset.learnerEmail);
  });
  if (dom.createCohortBtn) dom.createCohortBtn.addEventListener("click", createCohortFromForm);
  if (dom.updateCohortBtn) dom.updateCohortBtn.addEventListener("click", updateSelectedCohortFromForm);
  if (dom.refreshCohortsBtn) dom.refreshCohortsBtn.addEventListener("click", loadAdminData);
  if (dom.enrollMemberBtn) dom.enrollMemberBtn.addEventListener("click", enrollSelectedCohortMember);
  if (dom.cohortSelect) dom.cohortSelect.addEventListener("change", syncCohortFormFromSelection);
  if (dom.blueprintTemplateSelect) dom.blueprintTemplateSelect.addEventListener("change", onBlueprintTemplateSelectionChange);
  if (dom.refreshBlueprintsBtn) dom.refreshBlueprintsBtn.addEventListener("click", loadBlueprintTemplates);
  if (dom.assignBlueprintBtn) dom.assignBlueprintBtn.addEventListener("click", assignBlueprintToCohort);
  if (dom.loadUserAnalyticsBtn) dom.loadUserAnalyticsBtn.addEventListener("click", loadUserAnalytics);
  if (dom.loadBatchAnalyticsBtn) dom.loadBatchAnalyticsBtn.addEventListener("click", loadBatchAnalytics);
  if (dom.loadDrillRecommendationsBtn) dom.loadDrillRecommendationsBtn.addEventListener("click", loadDrillRecommendations);
  if (dom.shareTrendEmailBtn) dom.shareTrendEmailBtn.addEventListener("click", shareTrendByEmail);
  if (dom.analyticsWeakDrillCta) dom.analyticsWeakDrillCta.addEventListener("click", startWeakTopicDrillFromAnalytics);
  if (dom.exportReportBtn) dom.exportReportBtn.addEventListener("click", exportPdfReport);

  if (dom.unlockAccessBtn) dom.unlockAccessBtn.addEventListener("click", () => {
    openWhatsAppCta(
      "Hello, I have completed the trial and would like to request full access to the complete training program.",
      "cta_unlock_full_access_click"
    );
  });
  if (dom.unlockAccessAdminBtn) dom.unlockAccessAdminBtn.addEventListener("click", () => {
    openWhatsAppCta(
      "Hello, I would like to upgrade a learner to full access. Please share next steps.",
      "cta_admin_upgrade_request_click"
    );
  });
  if (dom.whatsappUpgradeBtn) dom.whatsappUpgradeBtn.addEventListener("click", () => {
    openWhatsAppCta(
      "Hello, I have completed the trial and would like to request full access to the complete training program.",
      "cta_whatsapp_click"
    );
  });
  if (dom.callUpgradeBtn) dom.callUpgradeBtn.addEventListener("click", openPhoneCta);
  if (dom.demoClassBtn) dom.demoClassBtn.addEventListener("click", () => {
    openWhatsAppCta(
      "Hello, I would like to attend the free live demo class. Please share available slots and registration details.",
      "cta_demo_class_click"
    );
  });
  if (dom.brochureBtn) dom.brochureBtn.addEventListener("click", openBrochureCta);
  if (dom.syllabusBtn) dom.syllabusBtn.addEventListener("click", openSyllabusCta);
  if (dom.counselingForm) dom.counselingForm.addEventListener("submit", submitCounselingForm);
  if (dom.trialInfoWhatsappBtn) dom.trialInfoWhatsappBtn.addEventListener("click", () => {
    openWhatsAppCta(
      "Hello, I am using the trial version and would like to upgrade to full access.",
      "cta_trial_banner_whatsapp_click"
    );
  });
  if (dom.landingStartTrialBtn) dom.landingStartTrialBtn.addEventListener("click", () => {
    dom.roleSelect.value = "trial";
    state.role = "trial";
    updateRoleUI();
    saveLocal();
    trackCtaEvent("landing_start_trial_click");
    dom.userName.focus();
  });
  if (dom.landingFullAccessBtn) dom.landingFullAccessBtn.addEventListener("click", () => {
    openWhatsAppCta(
      "Hello, I would like to unlock full access to PracticeBuddy Lab for complete training and assessments.",
      "cta_landing_full_access_click"
    );
  });
  if (dom.examTrialContactBtn) dom.examTrialContactBtn.addEventListener("click", () => {
    openWhatsAppCta(
      "Hello, I am on trial mode and would like trainee access to enable Mock Exam Practice Mode.",
      "cta_timed_exam_trial_click"
    );
  });
  if (dom.floatingWhatsappBtn) dom.floatingWhatsappBtn.addEventListener("click", (event) => {
    event.preventDefault();
    openWhatsAppCta(
      "Hello, I have completed the trial and would like to request full access to the complete training program.",
      "cta_floating_whatsapp_click"
    );
  });

  if (dom.csvFileInput) dom.csvFileInput.addEventListener("change", async () => {
    const file = dom.csvFileInput.files?.[0];
    if (!file) return;
    try {
      const parsed = await readFileAsImportCards(file);
      if (dom.csvInput) dom.csvInput.value = formatCardsForTextarea(parsed);
      setStatus(dom.importStatus, `Loaded ${parsed.length} cards from file. Click Import to finish.`);
    } catch (err) {
      console.error(err);
      setStatus(dom.importStatus, `Error reading file: ${err.message}`, "error");
    }
  });

  if (dom.userAnswer) dom.userAnswer.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      validateCurrentAnswer();
    }
  });

  window.addEventListener("beforeunload", () => {
    clearExamTimer();
    if (!state.session.isActive) return;

    const payload = JSON.stringify({
      sessionId: state.session.id,
      summary: {
        correct: state.session.correct,
        wrong: state.session.wrong,
        attempted: state.session.attempted,
        score: state.session.attempted ? Math.round((state.session.correct / state.session.attempted) * 100) : 0
      }
    });

    navigator.sendBeacon("/api/session/end", payload);
  });

  // Swipe gesture support for card navigation (mobile)
  (function initSwipeGestures() {
    const flashcard = document.getElementById("flashcard");
    if (!flashcard) return;

    let touchStartX = 0;
    let touchStartY = 0;
    const SWIPE_THRESHOLD = 60; // px
    const AXIS_LOCK = 30; // px — vertical movement this large cancels swipe

    flashcard.addEventListener("touchstart", (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    flashcard.addEventListener("touchend", (e) => {
      if (!state.session.isActive) return;

      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;

      // Ignore if mostly vertical scroll
      if (Math.abs(dy) > AXIS_LOCK) return;
      if (Math.abs(dx) < SWIPE_THRESHOLD) return;

      if (dx < 0) {
        // Swipe left → Next / advance
        if (state.awaitingNext) {
          nextQuestion();
        }
      } else {
        // Swipe right → Skip (only when not awaiting next)
        if (!state.awaitingNext && !state.exam.inProgress) {
          skipQuestion();
        }
      }
    }, { passive: true });
  })();
}

async function loadTenantInfo() {
  try {
    const data = await apiRequest("/api/tenant/info");
    state.tenantName = String(data.name || "");
    const settings = data.settings || {};
    state.tenantAllowedTags = Array.isArray(settings.allowedTags) ? settings.allowedTags : [];
    const tenantDisplay = document.getElementById("tenantNameDisplay");
    if (tenantDisplay && state.tenantName && state.tenantSlug !== "default") {
      tenantDisplay.textContent = state.tenantName;
      tenantDisplay.style.display = "";
    }
    // Re-render category buttons now that we know allowed tags
    if (typeof renderCategoryButtons === "function") renderCategoryButtons();
  } catch {
    // silently ignore — tenant info is non-critical
  }
}

async function init() {
  // Read tenant slug from URL: ?tenant=acme-school
  const urlParams = new URLSearchParams(window.location.search);
  const tenantParam = String(urlParams.get("tenant") || "").trim().toLowerCase();
  if (tenantParam && tenantParam !== "default") {
    state.tenantSlug = tenantParam;
  }

  loadLocal();
  bindEvents(); // Bind listeners immediately so buttons work even if data loads slowly

  state.session.isActive = false;
  state.session.isActive = false;
  state.trainerKeyVerified = false;
  await loadTenantInfo();
  await loadPublicAccessConfig();
  dom.userName.value = state.userName;
  dom.userEmail.value = state.userEmail;
  dom.userPhone.value = state.userPhone;
  dom.roleSelect.value = state.role;
  dom.traineeCode.value = "";
  dom.trainerKey.value = "";
  dom.adminKeyInput.value = "";
  dom.adminTraineeActive.value = "true";
  dom.adminTraineeExpiry.value = "";
  dom.learnerActiveInput.value = "true";
  dom.learnerExpiryInput.value = "";
  dom.adminMaxSessionLimit.value = String(state.accessConfig.maxSessionQuestions || 250);
  dom.cohortActiveInput.value = "true";
  dom.cohortExpiryInput.value = "";
  dom.memberActiveInput.value = "true";
  dom.memberExpiryInput.value = "";
  dom.weakDrillToggle.checked = state.weakDrillEnabled;
  dom.adaptiveToggle.checked = state.adaptiveEnabled;
  dom.examQuestionCount.value = String(state.examConfig.questionCount);
  dom.examDuration.value = String(state.examConfig.durationMinutes);
  dom.examPassThreshold.value = String(state.examConfig.passThreshold || 80);
  dom.examStrictTiming.checked = state.examConfig.strictTiming !== false;
  dom.floatingWhatsappBtn.href = buildWhatsappLink(
    "Hello, I have completed the trial and would like to request full access to the complete training program."
  );
  await initGoogleAuthClient();
  if (state.auth.googleUser?.email && roleNeedsGoogleAuth()) {
    dom.userEmail.value = state.auth.googleUser.email;
  }
  setStatus(dom.upgradeStatus, "");
  clearImportPreview();

  renderCategoryButtons();
  renderResources();
  renderAnalyticsCohorts([]);
  setRecommendedTags([]);
  renderBlueprintSelectors();
  updateRoleUI();
  updateSessionIdentityLock();
  updateMetrics();
  renderCategoryScorecards();
  renderGamificationPanel();
  setStatus(dom.examStatus, "Exam mode inactive.");
  updateExamStatusUI();
  updateTrialInfoBannerUI();
  updatePreSessionLandingUI();
  await loadAnalyticsCohorts();
  await loadBlueprintTemplates();
  await loadAssignedBlueprintForSession();
  await loadDeckFromCloud();
  renderCard();
  setAwaitingNext(false);
  renderCard();
  setAwaitingNext(false);
  renderCard();
  setAwaitingNext(false);
  // bindEvents(); // Moved to top
}

// Ensure DOM is ready before init
document.addEventListener("DOMContentLoaded", () => {
  cacheDOM(); // Populate DOM cache
  init();
});

/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* NAVIGATION SYSTEM (Phase 2 & Fixes) */
/* -------------------------------------------------------------------------- */

const navDom = {
  mainNav: document.getElementById("mainNav"),
  navItems: document.querySelectorAll(".nav-item"),
  viewPractice: document.getElementById("view-practice"),
  viewMentor: document.getElementById("view-mentor"),
  navMentorItem: document.getElementById("navMentorItem")
};

// Add Listeners
if (navDom.navItems) {
  navDom.navItems.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault(); // Safety check
      handleTabSwitch(btn.dataset.tab);
    });
  });
}

function handleTabSwitch(tabName) {
  if (!tabName) return;

  // 1. Update Buttons
  navDom.navItems.forEach(btn => {
    if (btn.dataset.tab === tabName) btn.classList.add("active");
    else btn.classList.remove("active");
  });

  // 2. Hide All Views
  if (navDom.viewPractice) navDom.viewPractice.classList.remove("active");
  if (navDom.viewMentor) navDom.viewMentor.classList.remove("active");

  // 3. Auto-Close Mock Exam Panel if not on Exam tab
  // 3. Auto-Close Mock Exam Panel only if leaving Practice/Exam context
  if (tabName !== "exam" && tabName !== "practice") {
    const examPanel = document.getElementById("examPanel");
    if (examPanel) examPanel.classList.add("hidden");
  }

  // 4. Show Target View & Handle Logic
  if (tabName === "practice") {
    if (navDom.viewPractice) navDom.viewPractice.classList.add("active");
    // Explicit scroll to Flashcard area
    const flashcard = document.getElementById("flashcard");
    if (flashcard) flashcard.scrollIntoView({ behavior: "smooth", block: "start" });
    else window.scrollTo(0, 0);
    // Show onboarding tour on first visit to practice tab
    if (typeof maybeShowOnboardingForPractice === "function") {
      maybeShowOnboardingForPractice();
    }
  }
  else if (tabName === "mentor") {
    if (navDom.viewMentor) navDom.viewMentor.classList.add("active");
    // Scroll to top of panel row or trainer zone
    const trainerZone = document.getElementById("trainerZone");
    if (trainerZone) trainerZone.scrollIntoView({ behavior: "smooth", block: "start" });
    else window.scrollTo(0, 0);

    // Initialize Dashboard Default View
    handleMentorSubTab("users");
    // Update Stats
    updateDashboardWidgets();
  }
  else if (tabName === "exam") {
    // Exam is inside practice view
    if (navDom.viewPractice) navDom.viewPractice.classList.add("active");

    const examPanel = document.getElementById("examPanel");
    if (examPanel) {
      if (examPanel.classList.contains("hidden")) {
        examPanel.classList.remove("hidden");
      }
      examPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
  else if (tabName === "analytics") {
    if (state.role === "trainer") {
      if (navDom.viewMentor) navDom.viewMentor.classList.add("active");
      // Trainer: Scroll to top (Mentor Console acting as "score blocks")
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      if (navDom.viewPractice) navDom.viewPractice.classList.add("active");
      // Trainee: Scroll to Dashboard (Score Blocks)
      const dashboard = document.querySelector(".dashboard");
      if (dashboard) dashboard.scrollIntoView({ behavior: "smooth", block: "start" });
      else window.scrollTo(0, 0);
    }
  }
}

// Override show/hide logic (Helper to be called inside startSession)
function showNavigation() {
  if (navDom.mainNav) navDom.mainNav.classList.remove("hidden");

  if (state.role === "trainer") {
    if (navDom.navMentorItem) navDom.navMentorItem.classList.remove("hidden");
    // Ensure we start on practice or mentor?
    handleTabSwitch("mentor");
  } else {
    if (navDom.navMentorItem) navDom.navMentorItem.classList.add("hidden");
    handleTabSwitch("practice");
  }
}

// Mentor Dashboard Logic
function handleMentorSubTab(subTab) {
  // Update Buttons
  document.querySelectorAll(".sub-nav-item").forEach(btn => {
    if (btn.dataset.subtab === subTab) btn.classList.add("active");
    else btn.classList.remove("active");
  });

  // Hide all sub-views
  document.getElementById("subview-users").classList.add("hidden");
  document.getElementById("subview-kpi").classList.add("hidden");
  document.getElementById("subview-tools").classList.add("hidden");
  document.getElementById("subview-bank").classList.add("hidden");

  // Show target
  if (subTab === "users") {
    // Show users view
    document.getElementById("subview-users").classList.remove("hidden");
    document.getElementById("subview-kpi").classList.add("hidden");
    document.getElementById("subview-tools").classList.add("hidden");
    document.getElementById("subview-bank").classList.add("hidden");
    loadSessions();
  } else if (subTab === "kpi") {
    // Show KPI view
    document.getElementById("subview-users").classList.add("hidden");
    document.getElementById("subview-kpi").classList.remove("hidden");
    document.getElementById("subview-tools").classList.add("hidden");
    document.getElementById("subview-bank").classList.add("hidden");
    loadFlagQueue();
  } else if (subTab === "tools") {
    // Show Tools view
    document.getElementById("subview-users").classList.add("hidden");
    document.getElementById("subview-kpi").classList.add("hidden");
    document.getElementById("subview-tools").classList.remove("hidden");
    document.getElementById("subview-bank").classList.add("hidden");
    loadImportBatches();
    loadImportReviewQueue();
    loadAdminData();
  } else if (subTab === "bank") {
    // Show Bank view
    document.getElementById("subview-users").classList.add("hidden");
    document.getElementById("subview-kpi").classList.add("hidden");
    document.getElementById("subview-tools").classList.add("hidden");
    document.getElementById("subview-bank").classList.remove("hidden");
    loadQuestionBank();
  }
}

function updateDashboardWidgets() {
  // 1. Active Students: Based on filtered sessions (exclude trainer)
  const sessions = filteredSessionsForConsole();
  const studentCount = sessions.filter((s) => String(s.role || "") !== "trainer").length;
  const widgetStudents = document.getElementById("widgetActiveStudents");
  if (widgetStudents) widgetStudents.textContent = studentCount;

  // 2. Pending Flags: Count rows in flag queue
  const flagRows = document.querySelectorAll("#flagQueueBody tr");
  let flagCount = 0;
  if (flagRows.length > 0 && !flagRows[0].innerText.includes("No flagged")) {
    flagCount = flagRows.length;
  }
  const widgetFlags = document.getElementById("widgetPendingFlags");
  if (widgetFlags) widgetFlags.textContent = flagCount;

  // 3. Open Reviews: Count rows in import review
  const reviewRows = document.querySelectorAll("#importReviewBody tr");
  let reviewCount = 0;
  if (reviewRows.length > 0 && !reviewRows[0].innerText.includes("No import review")) {
    reviewCount = reviewRows.length;
  }
  const widgetReviews = document.getElementById("widgetOpenReviews");
  if (widgetReviews) widgetReviews.textContent = reviewCount;
}

// Sub-nav listeners are bound via bindEvents() after cacheDOM()
