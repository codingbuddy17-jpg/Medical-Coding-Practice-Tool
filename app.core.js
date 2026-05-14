const STORAGE_KEY = "medcode_flashcards_role_v4";
const MCQ_PREFIX = "__MCQ__:";
const CARD_PREFIX = "__CARD__:";
const DEFAULT_RATIONALE_TEXT = "Rationale not available.";
const BRAND_NAME = "PracticeBuddy Lab by CodingBuddy360";
const BRAND_PRODUCT = "PracticeBuddy Lab";
const BRAND_PARENT = "CodingBuddy360";
const BRAND_PARENT_TAGLINE = "360° From Learning to Leadership in Medical Coding";
const BRAND_TAGLINE = "The Coding Competency, Practice & Certification Engine";
const CONTACT_PHONE_RAW = "+91 8309661352";
const CONTACT_PHONE_DIAL = "918309661352";
const WHATSAPP_NUMBER = "918309661352";
const BROCHURE_URL = "";
const SYLLABUS_URL = "/assets/curriculum.pdf";
const APP_CONFIG = window.APP_CONFIG || {};
const REQUIRE_GOOGLE_FOR_TRIAL_TRAINEE = APP_CONFIG.REQUIRE_GOOGLE_FOR_TRIAL_TRAINEE !== false;

const DEFAULT_TAG_DEFINITIONS = [
  { key: "ICD-10-CM", label: "ICD 10 CM", aliases: ["ICD10CM", "ICD 10 CM"], isActive: true },
  { key: "ICD-10-PCS", label: "ICD 10 PCS", aliases: ["ICD10PCS", "ICD 10 PCS"], isActive: true },
  { key: "CPT", label: "CPT", aliases: [], isActive: true },
  { key: "MODIFIERS", label: "Modifiers", aliases: ["MODIFIER"], isActive: true },
  { key: "GUIDELINES", label: "Guidelines", aliases: ["GUIDELINE"], isActive: true },
  { key: "CCS", label: "CCS", aliases: [], isActive: true },
  { key: "CPC", label: "CPC", aliases: [], isActive: true },
  { key: "CDIP", label: "CDIP", aliases: [], isActive: true },
  { key: "SURGERY-CODING", label: "Surgery Coding", aliases: ["SURGERY CODING"], isActive: true },
  { key: "IP-DRG-CODING", label: "IP-DRG Coding", aliases: ["IP DRG", "IP DRG CODING"], isActive: true },
  { key: "MEDICINE", label: "Medicine", aliases: [], isActive: true },
  { key: "PRACTICE-CASES", label: "Practice Cases", aliases: ["PRACTICE CASES"], isActive: true }
];

let CATEGORY_OPTIONS = [{ key: "ALL", label: "All Topics" }].concat(
  DEFAULT_TAG_DEFINITIONS.filter((item) => item.isActive !== false).map((item) => ({ key: item.key, label: item.label }))
);
const DEFAULT_WEEKLY_TARGET = 150;
const DIFFICULTY_OPTIONS = [
  { key: "all", label: "All Levels" },
  { key: "low", label: "Beginner" },
  { key: "medium", label: "Core" },
  { key: "advanced", label: "Advanced" }
];
const BADGE_DEFINITIONS = [
  { id: "questions_50", title: "Starter Sprint", icon: "🚀", theme: "volume", rule: "Answer 50 questions", check: (g) => Number(g.totalAnswered || 0) >= 50 },
  { id: "questions_100", title: "Century Club", icon: "💯", theme: "volume", rule: "Answer 100 questions", check: (g) => Number(g.totalAnswered || 0) >= 100 },
  { id: "accuracy_80", title: "Precision Pro", icon: "🎯", theme: "accuracy", rule: "Maintain 80% accuracy (min 30 attempts)", check: (g) => Number(g.totalAnswered || 0) >= 30 && (Number(g.totalCorrect || 0) / Math.max(1, Number(g.totalAnswered || 0))) >= 0.8 },
  { id: "streak_3", title: "Rhythm Builder", icon: "🔥", theme: "streak", rule: "3-day streak", check: (g) => Number(g.streakDays || 0) >= 3 },
  { id: "streak_7", title: "Consistency Star", icon: "🌟", theme: "streak", rule: "7-day streak", check: (g) => Number(g.streakDays || 0) >= 7 },
  { id: "questions_250", title: "Vault Master", icon: "🏆", theme: "mastery", rule: "Answer 250 questions", check: (g) => Number(g.totalAnswered || 0) >= 250 }
];

const DEFAULT_RESOURCES = [
  { title: "Online ICD Access", url: "https://www.icd10data.com" },
  {
    title: "Download Official ICD Code Files",
    url: "https://www.cms.gov/files/zip/april-1-2026-code-tables-tabular-index.zip"
  },
  { title: "CPT and Info", url: "https://www.ama.com" },
  { title: "AAPC Blog", url: "https://www.aapc.com/blog" },
  { title: "AHIMA", url: "https://www.ahima.com" }
];

const STARTER_DECK = [];

function getTrackedCategoryKeys() {
  return CATEGORY_OPTIONS.filter((item) => item.key !== "ALL").map((item) => item.key);
}

function createEmptyCategoryStats() {
  const stats = {};
  getTrackedCategoryKeys().forEach((key) => {
    stats[key] = { attempted: 0, correct: 0, wrong: 0, skipped: 0, totalTimeMs: 0, timedCount: 0 };
  });
  stats.OTHER = { attempted: 0, correct: 0, wrong: 0, skipped: 0, totalTimeMs: 0, timedCount: 0 };
  return stats;
}

function normalizeDifficultyKey(value, fallback = "medium") {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === "all") return "all";
  if (["low", "beginner", "easy", "foundation", "basic"].includes(raw)) return "low";
  if (["medium", "core", "mid", "moderate", "standard", "intermediate"].includes(raw)) return "medium";
  if (["advanced", "hard", "challenge", "expert", "complex"].includes(raw)) return "advanced";
  return fallback;
}

function getDifficultyLabel(value) {
  const key = normalizeDifficultyKey(value, "medium");
  const found = DIFFICULTY_OPTIONS.find((item) => item.key === key);
  return found ? found.label : "Core";
}

const state = {
  role: "trial",
  userName: "",
  userEmail: "",
  userPhone: "",
  trainerKey: "",
  trainerKeyVerified: false,
  adminKey: "",
  tenantSlug: "default",
  tenantName: "",
  tenantAllowedTags: [],
  tagRegistry: DEFAULT_TAG_DEFINITIONS.map((item) => ({ ...item })),
  selectedTag: "ALL",
  selectedDifficulty: "all",
  weakDrillEnabled: false,
  adaptiveEnabled: false,
  examConfig: {
    questionCount: 30,
    durationMinutes: 30,
    passThreshold: 80,
    strictTiming: true,
    blueprintId: ""
  },
  currentCardIndex: 0,
  deck: [],
  resources: [],
  session: {
    id: null,
    startedAt: null,
    questionLimit: 20,
    cohortId: null,
    cohortName: "",
    correct: 0,
    wrong: 0,
    attempted: 0,
    questionStartAt: null,
    totalAnswerTimeMs: 0,
    recentResults: [],
    isActive: false,
    categoryStats: createEmptyCategoryStats(),
    cardStats: {}
  },
  exam: {
    inProgress: false,
    queueIds: [],
    cursor: 0,
    remainingSeconds: 0,
    timerId: null,
    answered: 0,
    correct: 0,
    wrong: 0,
    attemptedTotal: 0,
    totalAnswerTimeMs: 0,
    passThreshold: 80,
    strictTiming: true,
    blueprintName: "",
    skippedIds: [],
    reviewingSkipped: false,
    shuffleSeed: ""
  },
  awaitingNext: false,
  selectedMcqOption: "",
  studyOrder: {
    queues: {},
    cursors: {},
    seeds: {},
    cycles: {}
  },
  currentCardRender: null,
  accessConfig: {
    trialQuestionLimit: 20,
    maxSessionQuestions: 250,
    contactMessage: "For full access, contact PracticeBuddy Lab by CodingBuddy360 on WhatsApp at +91 8309661352."
  },
  adminPanel: {
    verified: false,
    cohorts: [],
    learners: []
  },
  analytics: {
    lastScope: "",
    lastEmail: "",
    lastCohortName: "",
    lastDays: 30,
    lastData: null,
    lastRecommendations: []
  },
  gamification: {
    weeklyTarget: DEFAULT_WEEKLY_TARGET,
    totalAnswered: 0,
    totalCorrect: 0,
    streakDays: 0,
    lastActiveDay: "",
    dailyAttempts: {},
    weeklyAttempts: {},
    unlockedBadges: {}
  },
  blueprints: {
    templates: [],
    assigned: null
  },
  reviewQueue: {
    items: []
  },
  sessionConsole: {
    all: []
  },
  importAdmin: {
    reviewItems: [],
    batches: []
  },
  questionBank: {
    all: [],
    selectedIds: new Set()
  },
  reviewQueue: {
    items: []
  },
  importPreview: {
    active: false,
    rows: [],
    summary: null,
    importCards: [],
    page: 1,
    pageSize: 120
  },
  auth: {
    googleUser: null,
    accessToken: "",
    ready: false
  }
};

// DOM Cache (populated on init)
let dom = {};
let supabaseAuthClient = null;

function cacheDOM() {
  dom = {
    userName: document.getElementById("userName"),
    userEmail: document.getElementById("userEmail"),
    userEmailWrap: document.getElementById("userEmailWrap"),
    userPhone: document.getElementById("userPhone"),
    userPhoneWrap: document.getElementById("userPhoneWrap"),
    roleSelect: document.getElementById("roleSelect"),
    traineeCodeWrap: document.getElementById("traineeCodeWrap"),
    traineeCode: document.getElementById("traineeCode"),
    trainerKeyWrap: document.getElementById("trainerKeyWrap"),
    trainerKey: document.getElementById("trainerKey"),
    googleAuthWrap: document.getElementById("googleAuthWrap"),
    googleAuthBtn: document.getElementById("googleAuthBtn"),
    googleAuthBtnLabel: document.getElementById("googleAuthBtnLabel"),
    googleAuthStatus: document.getElementById("googleAuthStatus"),
    startBtn: document.getElementById("startBtn"),
    endSessionBtn: document.getElementById("endSessionBtn"),
    sessionStatus: document.getElementById("sessionStatus"),

    topbarSessionSummary: document.getElementById("topbarSessionSummary"),
    topbarSessionActions: document.getElementById("topbarSessionActions"),
    topbarSessionRow: document.getElementById("topbarSessionRow"),
    googleSignOutBtn: document.getElementById("googleSignOutBtn"),
    googleSignedInBar: document.getElementById("googleSignedInBar"),
    googleSignedInEmail: document.getElementById("googleSignedInEmail"),
    metricScoreCard: document.getElementById("metricScoreCard"),
    correctCount: document.getElementById("correctCount"),
    wrongCount: document.getElementById("wrongCount"),
    attemptedCount: document.getElementById("attemptedCount"),
    sessionScore: document.getElementById("sessionScore"),
    streakValue: document.getElementById("streakValue"),
    weeklyProgressText: document.getElementById("weeklyProgressText"),
    weeklyProgressBar: document.getElementById("weeklyProgressBar"),
    nextBadgeHint: document.getElementById("nextBadgeHint"),
    badgeVault: document.getElementById("badgeVault"),
    badgeToast: document.getElementById("badgeToast"),

    categoryButtons: document.getElementById("categoryButtons"),
    categoryStatus: document.getElementById("categoryStatus"),
    practiceDifficultySelect: document.getElementById("practiceDifficultySelect"),
    weakDrillToggle: document.getElementById("weakDrillToggle"),
    adaptiveToggle: document.getElementById("adaptiveToggle"),
    examQuestionCount: document.getElementById("examQuestionCount"),
    examModeSelect: document.getElementById("examModeSelect"),
    examTopicSelect: document.getElementById("examTopicSelect"),
    examBlueprintSelect: document.getElementById("examBlueprintSelect"),
    examDuration: document.getElementById("examDuration"),
    examPassThreshold: document.getElementById("examPassThreshold"),
    examStrictTiming: document.getElementById("examStrictTiming"),
    toggleExamPanelBtn: document.getElementById("toggleExamPanelBtn"),
    examPanel: document.getElementById("examPanel"),
    examTrialContactWrap: document.getElementById("examTrialContactWrap"),
    examTrialContactBtn: document.getElementById("examTrialContactBtn"),
    startExamBtn: document.getElementById("startExamBtn"),
    stopExamBtn: document.getElementById("stopExamBtn"),
    pauseExamBtn: document.getElementById("pauseExamBtn"),
    examStatus: document.getElementById("examStatus"),
    examTimer: document.getElementById("examTimer"),
    examRemainingNotice: document.getElementById("examRemainingNotice"),

    examTopicSelectLabel: document.getElementById("examTopicSelectLabel"),
    examBlueprintSelectLabel: document.getElementById("examBlueprintSelectLabel"),

    resourceList: document.getElementById("resourceList"),
    resourceManager: document.getElementById("resourceManager"),
    resourceTitle: document.getElementById("resourceTitle"),
    resourceUrl: document.getElementById("resourceUrl"),
    addResourceBtn: document.getElementById("addResourceBtn"),
    resourceStatus: document.getElementById("resourceStatus"),
    trialInfoWhatsappBtn: document.getElementById("trialInfoWhatsappBtn"),

    cardTag: document.getElementById("cardTag"),
    cardPrompt: document.getElementById("cardPrompt"),
    flashcard: document.getElementById("flashcard"),
    shortAnswerRow: document.getElementById("shortAnswerRow"),
    mcqOptions: document.getElementById("mcqOptions"),
    userAnswer: document.getElementById("userAnswer"),
    answerPanel: document.getElementById("answerPanel"),
    checkBtn: document.getElementById("checkBtn"),
    skipBtn: document.getElementById("skipBtn"),
    nextBtn: document.getElementById("nextBtn"),
    flagQuestionBtn: document.getElementById("flagQuestionBtn"),
    feedback: document.getElementById("feedback"),
    rationaleDetails: document.getElementById("rationaleDetails"),
    rationalePlaceholder: document.getElementById("rationalePlaceholder"),
    trialLockNotice: document.getElementById("trialLockNotice"),
    trialInfoBanner: document.getElementById("trialInfoBanner"),
    trialProgressFill: document.getElementById("trialProgressFill"),
    trialProgressText: document.getElementById("trialProgressText"),
    trialProgressRemaining: document.getElementById("trialProgressRemaining"),
    preSessionLanding: document.getElementById("preSessionLanding"),
    authPanel: document.getElementById("authPanel"),
    loginGuide: document.getElementById("loginGuide"),
    instituteLoginPanel: document.getElementById("instituteLoginPanel"),
    landingStartTrialBtn: document.getElementById("landingStartTrialBtn"),
    landingFullAccessBtn: document.getElementById("landingFullAccessBtn"),
    upgradeWall: document.getElementById("upgradeWall"),
    upgradeStatus: document.getElementById("upgradeStatus"),
    unlockAccessBtn: document.getElementById("unlockAccessBtn"),
    unlockAccessAdminBtn: document.getElementById("unlockAccessAdminBtn"),
    whatsappUpgradeBtn: document.getElementById("whatsappUpgradeBtn"),
    callUpgradeBtn: document.getElementById("callUpgradeBtn"),
    demoClassBtn: document.getElementById("demoClassBtn"),
    brochureBtn: document.getElementById("brochureBtn"),
    syllabusBtn: document.getElementById("syllabusBtn"),
    counselingForm: document.getElementById("counselingForm"),
    counselName: document.getElementById("counselName"),
    counselEmail: document.getElementById("counselEmail"),
    counselPhone: document.getElementById("counselPhone"),
    counselMessage: document.getElementById("counselMessage"),
    floatingWhatsappBtn: document.getElementById("floatingWhatsappBtn"),

    categoryScoreBody: document.getElementById("categoryScoreBody"),

    adminTools: document.getElementById("adminTools"),
    adminStatus: document.getElementById("adminStatus"),
    adminActiveIndicator: document.getElementById("adminActiveIndicator"),
    trainerZone: document.getElementById("trainerZone"),
    importStatus: document.getElementById("importStatus"),
    csvFileInput: document.getElementById("csvFileInput"),
    csvInput: document.getElementById("csvInput"), // Textarea for raw CSV
    importDefaultTag: document.getElementById("importDefaultTag"),
    importDefaultType: document.getElementById("importDefaultType"),
    importFileBtn: document.getElementById("importFileBtn"),
    importBtn: document.getElementById("importBtn"),
    loadStarterBtn: document.getElementById("loadStarterBtn"),
    exportBtn: document.getElementById("exportBtn"),
    importStatus: document.getElementById("importStatus"),
    // importStatus: document.getElementById("importStatus"), // Duplicate, removed
    importPreviewPanel: document.getElementById("importPreviewPanel"),
    importPreviewSummary: document.getElementById("importPreviewSummary"),
    importPreviewMappings: document.getElementById("importPreviewMappings"),
    importPreviewBody: document.getElementById("importPreviewBody"),
    importPreviewPrevBtn: document.getElementById("importPreviewPrevBtn"),
    importPreviewNextBtn: document.getElementById("importPreviewNextBtn"),
    importPreviewPageInfo: document.getElementById("importPreviewPageInfo"),
    importPreviewPageInput: document.getElementById("importPreviewPageInput"),
    confirmImportBtn: document.getElementById("confirmImportBtn"),
    cancelImportPreviewBtn: document.getElementById("cancelImportPreviewBtn"),
    importReviewStatusFilter: document.getElementById("importReviewStatusFilter"),
    refreshImportReviewBtn: document.getElementById("refreshImportReviewBtn"),
    resolveAllImportReviewBtn: document.getElementById("resolveAllImportReviewBtn"),
    exportImportReviewBtn: document.getElementById("exportImportReviewBtn"),

    // Question Bank
    questionBankSearchInput: document.getElementById("questionBankSearchInput"),
    questionBankTagFilter: document.getElementById("questionBankTagFilter"),
    questionBankSelectAll: document.getElementById("questionBankSelectAll"),
    questionBankBulkTag: document.getElementById("questionBankBulkTag"),
    questionBankBulkApplyBtn: document.getElementById("questionBankBulkApplyBtn"),
    backfillDifficultyBtn: document.getElementById("backfillDifficultyBtn"),
    questionBankSelectedCount: document.getElementById("questionBankSelectedCount"),
    refreshQuestionBankBtn: document.getElementById("refreshQuestionBankBtn"),
    exportQuestionBankBtn: document.getElementById("exportQuestionBankBtn"),
    questionBankBody: document.getElementById("questionBankBody"),
    questionBankStatus: document.getElementById("questionBankStatus"),
    tagRegistryBody: document.getElementById("tagRegistryBody"),
    tagRegistryStatus: document.getElementById("tagRegistryStatus"),
    refreshTagsBtn: document.getElementById("refreshTagsBtn"),
    saveTagBtn: document.getElementById("saveTagBtn"),
    clearTagFormBtn: document.getElementById("clearTagFormBtn"),
    tagFormKey: document.getElementById("tagFormKey"),
    tagFormLabel: document.getElementById("tagFormLabel"),
    tagFormAliases: document.getElementById("tagFormAliases"),
    tagFormActive: document.getElementById("tagFormActive"),
    tagFormMode: document.getElementById("tagFormMode"),
    tenantTagCheckboxes: document.getElementById("tenantTagCheckboxes"),

    // Import Batches
    refreshImportBatchesBtn: document.getElementById("refreshImportBatchesBtn"),
    importReviewBody: document.getElementById("importReviewBody"),
    importReviewStatus: document.getElementById("importReviewStatus"),
    // refreshImportBatchesBtn: document.getElementById("refreshImportBatchesBtn"), // Duplicate, removed
    rollbackBatchIdInput: document.getElementById("rollbackBatchIdInput"),
    rollbackBatchBtn: document.getElementById("rollbackBatchBtn"),
    importBatchBody: document.getElementById("importBatchBody"),
    importBatchBody: document.getElementById("importBatchBody"),
    importBatchStatus: document.getElementById("importBatchStatus"), // Ensure this ID exists in HTML

    refreshSessionsBtn: document.getElementById("refreshSessionsBtn"),
    exportSessionsBtn: document.getElementById("exportSessionsBtn"),
    sessionSearchInput: document.getElementById("sessionSearchInput"),
    sessionRoleFilter: document.getElementById("sessionRoleFilter"),
    sessionWindowFilter: document.getElementById("sessionWindowFilter"),
    excludeTrialToggle: document.getElementById("excludeTrialToggle"),
    sessionTableBody: document.getElementById("sessionTableBody"),
    sessionLoadStatus: document.getElementById("sessionLoadStatus"),
    flagStatusFilter: document.getElementById("flagStatusFilter"),
    refreshFlagsBtn: document.getElementById("refreshFlagsBtn"),
    flagQueueBody: document.getElementById("flagQueueBody"),
    flagQueueStatus: document.getElementById("flagQueueStatus"),

    adminKeyInput: document.getElementById("adminKeyInput"),
    verifyAdminBtn: document.getElementById("verifyAdminBtn"),
    loadAdminDataBtn: document.getElementById("loadAdminDataBtn"),
    adminStatus: document.getElementById("adminStatus"),
    adminSummaryLearner: document.getElementById("adminSummaryLearner"),
    adminSummaryTrialLimit: document.getElementById("adminSummaryTrialLimit"),
    adminSummarySessionLimit: document.getElementById("adminSummarySessionLimit"),
    adminSummaryCohorts: document.getElementById("adminSummaryCohorts"),
    adminSummaryExpiring: document.getElementById("adminSummaryExpiring"),
    adminSummaryUpdated: document.getElementById("adminSummaryUpdated"),
    adminTools: document.getElementById("adminTools"),
    adminTraineeCode: document.getElementById("adminTraineeCode"),
    adminTrainerKey: document.getElementById("adminTrainerKey"),
    adminTrialLimit: document.getElementById("adminTrialLimit"),
    adminMaxSessionLimit: document.getElementById("adminMaxSessionLimit"),
    adminTraineeActive: document.getElementById("adminTraineeActive"),
    adminTraineeExpiry: document.getElementById("adminTraineeExpiry"),
    saveAccessConfigBtn: document.getElementById("saveAccessConfigBtn"),
    learnerEmailInput: document.getElementById("learnerEmailInput"),
    learnerActiveInput: document.getElementById("learnerActiveInput"),
    learnerExpiryInput: document.getElementById("learnerExpiryInput"),
    saveLearnerBtn: document.getElementById("saveLearnerBtn"),
    refreshLearnersBtn: document.getElementById("refreshLearnersBtn"),
    learnerAccessStatus: document.getElementById("learnerAccessStatus"),
    learnerAccessBody: document.getElementById("learnerAccessBody"),
    clearCacheBtn: document.getElementById("clearCacheBtn"),
    accessConfigStatus: document.getElementById("accessConfigStatus"),
    cohortNameInput: document.getElementById("cohortNameInput"),
    cohortCodeInput: document.getElementById("cohortCodeInput"),
    cohortLimitInput: document.getElementById("cohortLimitInput"),
    cohortActiveInput: document.getElementById("cohortActiveInput"),
    cohortExpiryInput: document.getElementById("cohortExpiryInput"),
    createCohortBtn: document.getElementById("createCohortBtn"),
    updateCohortBtn: document.getElementById("updateCohortBtn"),
    refreshCohortsBtn: document.getElementById("refreshCohortsBtn"),
    cohortStatus: document.getElementById("cohortStatus"),
    cohortSelect: document.getElementById("cohortSelect"),
    memberNameInput: document.getElementById("memberNameInput"),
    memberEmailInput: document.getElementById("memberEmailInput"),
    memberPhoneInput: document.getElementById("memberPhoneInput"),
    memberActiveInput: document.getElementById("memberActiveInput"),
    memberExpiryInput: document.getElementById("memberExpiryInput"),
    enrollMemberBtn: document.getElementById("enrollMemberBtn"),
    enrollStatus: document.getElementById("enrollStatus"),
    cohortTableBody: document.getElementById("cohortTableBody"),
    blueprintTemplateSelect: document.getElementById("blueprintTemplateSelect"),
    blueprintQuestionCount: document.getElementById("blueprintQuestionCount"),
    blueprintDuration: document.getElementById("blueprintDuration"),
    blueprintPassThreshold: document.getElementById("blueprintPassThreshold"),
    blueprintStrictTiming: document.getElementById("blueprintStrictTiming"),
    refreshBlueprintsBtn: document.getElementById("refreshBlueprintsBtn"),
    assignBlueprintBtn: document.getElementById("assignBlueprintBtn"),
    blueprintStatus: document.getElementById("blueprintStatus"),

    exportReportBtn: document.getElementById("exportReportBtn"),
    analyticsUserEmail: document.getElementById("analyticsUserEmail"),
    analyticsCohortSelect: document.getElementById("analyticsCohortSelect"),
    analyticsDays: document.getElementById("analyticsDays"),
    loadUserAnalyticsBtn: document.getElementById("loadUserAnalyticsBtn"),
    loadBatchAnalyticsBtn: document.getElementById("loadBatchAnalyticsBtn"),
    loadDrillRecommendationsBtn: document.getElementById("loadDrillRecommendationsBtn"),
    shareTrendEmailBtn: document.getElementById("shareTrendEmailBtn"),
    analyticsStatus: document.getElementById("analyticsStatus"),
    analyticsAttempted: document.getElementById("analyticsAttempted"),
    analyticsCorrect: document.getElementById("analyticsCorrect"),
    analyticsWrong: document.getElementById("analyticsWrong"),
    analyticsScore: document.getElementById("analyticsScore"),
    analyticsAvgTime: document.getElementById("analyticsAvgTime"),
    analyticsMastery: document.getElementById("analyticsMastery"),
    analyticsSpeedScore: document.getElementById("analyticsSpeedScore"),
    analyticsConsistency: document.getElementById("analyticsConsistency"),
    analyticsRecommendedTags: document.getElementById("analyticsRecommendedTags"),
    analyticsTopWeakTopics: document.getElementById("analyticsTopWeakTopics"),
    analyticsWeakDrillCta: document.getElementById("analyticsWeakDrillCta"),
    analyticsHeatmapBody: document.getElementById("analyticsHeatmapBody"),
    analyticsTagBody: document.getElementById("analyticsTagBody"),
    analyticsTrendBody: document.getElementById("analyticsTrendBody"),
    adminActiveIndicator: document.getElementById("adminActiveIndicator"),
    importReviewOpenCount: document.getElementById("importReviewOpenCount"),
    flagQueueOpenCount: document.getElementById("flagQueueOpenCount"),
    sessionConsoleSummary: document.getElementById("sessionConsoleSummary")
  };
}

if (!window.PBL_IMPORT) {
  throw new Error("Missing app.import.js");
}
const {
  cleanImportText,
  sanitizeQuestionCard,
  parseCsv,
  parseExcelArrayBuffer,
  formatCardsForTextarea,
  importSeverity,
  mergeImportStatus
} = window.PBL_IMPORT;

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function hardReset() {
  const choice = confirm("Do you want to clear the Server Database as well? (Click OK for Server & Local, Cancel for Local Only)");

  if (choice) {
    const key = prompt("Enter Admin Key to confirm Server Reset:");
    if (!key) return;

    try {
      await apiRequest("/api/admin/reset-data", {
        method: "POST",
        body: JSON.stringify({ adminKey: key })
      });
      alert("Server data cleared.");
    } catch (err) {
      console.warn("Server reset failed:", err);
      alert("Server reset failed (check console). Proceeding with local reset...");
      // Do NOT return here; continue to clear local storage
    }
  } else {
    if (!confirm("This will clear ALL local data and maximize storage. You will need to re-import questions. Continue?")) return;
  }

  localStorage.clear();
  sessionStorage.clear();
  window.location.reload();
  window.location.reload();
}

function setExamControlsLocked(locked) {
  if (dom.startExamBtn) dom.startExamBtn.disabled = locked;
  if (dom.examModeSelect) dom.examModeSelect.disabled = locked;
  if (dom.examTopicSelect) dom.examTopicSelect.disabled = locked;
  if (dom.examBlueprintSelect) dom.examBlueprintSelect.disabled = locked;
  if (dom.examQuestionCount) dom.examQuestionCount.disabled = locked;
  if (dom.examDuration) dom.examDuration.disabled = locked;
  if (dom.examPassThreshold) dom.examPassThreshold.disabled = locked;
  if (dom.examStrictTiming) dom.examStrictTiming.disabled = locked;
}

function setStatus(el, message, mode = "") {
  el.textContent = message;
  el.classList.remove("success", "error", "neutral");
  if (mode) el.classList.add(mode);
}

function setPracticeFeedbackState(mode = "neutral") {
  if (!dom.answerPanel) return;
  dom.answerPanel.classList.remove("feedback-success", "feedback-error", "feedback-neutral");
  if (mode === "success") dom.answerPanel.classList.add("feedback-success");
  else if (mode === "error") dom.answerPanel.classList.add("feedback-error");
  else dom.answerPanel.classList.add("feedback-neutral");
}

function roleNeedsGoogleAuth() {
  return state.role === "trial" || state.role === "trainee";
}

function normalizePhoneDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function isValidMobile(value) {
  const digits = normalizePhoneDigits(value);
  return /^\d{10}$/.test(digits);
}

function updateGoogleAuthUI() {
  if (!dom.googleAuthWrap || !dom.googleAuthStatus || !dom.googleAuthBtn || !dom.googleAuthBtnLabel) return;
  const required = REQUIRE_GOOGLE_FOR_TRIAL_TRAINEE && roleNeedsGoogleAuth();
  if (dom.googleSignedInBar) {
    const signedIn = !!state.auth.googleUser?.email;
    dom.googleSignedInBar.classList.toggle("hidden", !signedIn);
    if (signedIn && dom.googleSignedInEmail) {
      dom.googleSignedInEmail.textContent = `Signed in as ${state.auth.googleUser.email}`;
    }
  }
  dom.googleAuthWrap.classList.toggle("hidden", !required);
  if (dom.userEmailWrap) dom.userEmailWrap.classList.add("hidden");
  if (dom.userPhoneWrap) dom.userPhoneWrap.classList.toggle("hidden", !(required && state.auth.googleUser?.email));
  if (!required) {
    dom.googleAuthStatus.textContent = "";
    dom.googleAuthBtnLabel.textContent = "Continue with Google";
    dom.googleAuthBtn.disabled = false;
    dom.userEmail.disabled = false;
    if (dom.userPhoneWrap) dom.userPhoneWrap.classList.add("hidden");
    return;
  }

  if (state.auth.googleUser?.email) {
    dom.googleAuthStatus.textContent = `Signed in as ${state.auth.googleUser.email}. Enter mobile number to continue.`;
    dom.googleAuthBtnLabel.textContent = "Google Connected";
    dom.googleAuthBtn.disabled = true;
    dom.userEmail.value = state.auth.googleUser.email;
    dom.userEmail.disabled = true;
  } else {
    dom.googleAuthStatus.textContent = "Google sign-in required for Trial/Member.";
    dom.googleAuthBtnLabel.textContent = "Continue with Google";
    dom.googleAuthBtn.disabled = false;
    dom.userEmail.disabled = false;
  }
}

const AUTH_DRAFT_KEY = "pb_auth_draft";

function saveAuthDraft() {
  try {
    sessionStorage.setItem(AUTH_DRAFT_KEY, JSON.stringify({
      role: String(dom.roleSelect?.value || state.role || "trial"),
      userName: String(dom.userName?.value || "").trim(),
      userPhone: String(dom.userPhone?.value || "").trim()
    }));
  } catch {
    // ignore draft persistence errors
  }
}

function restoreAuthDraft() {
  try {
    const raw = sessionStorage.getItem(AUTH_DRAFT_KEY);
    if (!raw) return;
    const draft = JSON.parse(raw);
    if (draft.role && dom.roleSelect && !state.session.isActive) {
      state.role = draft.role;
      dom.roleSelect.value = draft.role;
    }
    if (draft.userName && dom.userName && !dom.userName.value) {
      dom.userName.value = draft.userName;
    }
    if (draft.userPhone && dom.userPhone && !dom.userPhone.value) {
      dom.userPhone.value = draft.userPhone;
    }
  } catch {
    // ignore malformed draft state
  }
}

async function signOutGoogleAuth() {
  if (!supabaseAuthClient) return;
  try {
    await supabaseAuthClient.auth.signOut();
  } catch {
    // ignore and continue local cleanup
  }
  state.auth.googleUser = null;
  state.auth.accessToken = "";
  if (!state.session.isActive && roleNeedsGoogleAuth()) {
    dom.userEmail.value = "";
    dom.userPhone.value = "";
  }
  updateGoogleAuthUI();
  setStatus(dom.sessionStatus, "Logged out from Google.", "success");
}

async function initGoogleAuthClient() {
  try {
    if (!window.supabase?.createClient) return;
    const url = String(APP_CONFIG.SUPABASE_URL || "").trim();
    const anon = String(APP_CONFIG.SUPABASE_ANON_KEY || "").trim();
    if (!url || !anon) return;
    supabaseAuthClient = window.supabase.createClient(url, anon);
    state.auth.ready = true;
    const { data, error } = await supabaseAuthClient.auth.getSession();
    if (error) return;
    const session = data?.session;
    if (!session?.access_token) return;
    state.auth.accessToken = session.access_token;
    const { data: userData } = await supabaseAuthClient.auth.getUser();
    if (userData?.user) {
      state.auth.googleUser = userData.user;
      if (roleNeedsGoogleAuth()) {
        state.userEmail = userData.user.email || state.userEmail;
      }
    }
  } catch {
    // keep legacy flow if auth client init fails
  } finally {
    updateGoogleAuthUI();
  }
}

async function startGoogleAuth() {
  if (!supabaseAuthClient) {
    setStatus(dom.sessionStatus, "Google auth is not configured yet.", "error");
    return;
  }
  try {
    saveAuthDraft();
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await supabaseAuthClient.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo }
    });
    if (error) throw error;
  } catch (err) {
    setStatus(dom.sessionStatus, `Google sign-in failed: ${err.message}`, "error");
  }
}

function formatSeconds(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const parts = [];

  if (hours > 0) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
  if (secs > 0 || !parts.length) parts.push(`${secs} second${secs === 1 ? "" : "s"}`);

  return parts.join(" ");
}

function dayKeyFromDate(value = Date.now()) {
  const d = new Date(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function weekKeyFromDate(value = Date.now()) {
  const d = new Date(value);
  const day = d.getDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return dayKeyFromDate(d.getTime());
}

function dayDiff(aKey, bKey) {
  if (!aKey || !bKey) return 0;
  const a = Date.parse(`${aKey}T00:00:00`);
  const b = Date.parse(`${bKey}T00:00:00`);
  return Math.round((a - b) / (24 * 60 * 60 * 1000));
}

function showBadgeToast(message) {
  if (!dom.badgeToast) return;
  dom.badgeToast.textContent = message;
  dom.badgeToast.classList.remove("hidden");
  setTimeout(() => {
    dom.badgeToast.classList.add("hidden");
  }, 2200);
}

function evaluateBadges() {
  const newlyUnlocked = [];
  const unlocked = state.gamification.unlockedBadges || {};
  BADGE_DEFINITIONS.forEach((badge) => {
    if (unlocked[badge.id]) return;
    if (badge.check(state.gamification)) {
      unlocked[badge.id] = Date.now();
      newlyUnlocked.push(badge);
    }
  });
  state.gamification.unlockedBadges = unlocked;
  return newlyUnlocked;
}

function getBadgeProgressLabel(badge) {
  const g = state.gamification || {};
  if (badge.id === "questions_50") return `${Math.min(50, g.totalAnswered || 0)}/50`;
  if (badge.id === "questions_100") return `${Math.min(100, g.totalAnswered || 0)}/100`;
  if (badge.id === "questions_250") return `${Math.min(250, g.totalAnswered || 0)}/250`;
  if (badge.id === "streak_3") return `${Math.min(3, g.streakDays || 0)}/3 days`;
  if (badge.id === "streak_7") return `${Math.min(7, g.streakDays || 0)}/7 days`;
  if (badge.id === "accuracy_80") {
    const acc = (g.totalCorrect || 0) / Math.max(1, g.totalAnswered || 0);
    return `${Math.round(acc * 100)}%`;
  }
  return "";
}

function renderGamificationPanel() {
  if (!dom.badgeVault || !dom.weeklyProgressText || !dom.weeklyProgressBar || !dom.streakValue || !dom.nextBadgeHint) return;
  const g = state.gamification;
  const weekKey = weekKeyFromDate();
  const weekly = Number(g.weeklyAttempts?.[weekKey] || 0);
  const target = Math.max(1, Number(g.weeklyTarget || DEFAULT_WEEKLY_TARGET));
  const pct = Math.max(0, Math.min(100, Math.round((weekly / target) * 100)));
  dom.weeklyProgressText.textContent = `${weekly} / ${target} questions`;
  dom.weeklyProgressBar.style.width = `${pct}%`;
  dom.streakValue.textContent = `${Number(g.streakDays || 0)} day${Number(g.streakDays || 0) === 1 ? "" : "s"}`;

  const unlocked = g.unlockedBadges || {};
  dom.badgeVault.innerHTML = BADGE_DEFINITIONS.map((badge) => {
    const isUnlocked = Boolean(unlocked[badge.id]);
    const progress = isUnlocked ? "Unlocked" : getBadgeProgressLabel(badge);
    return `<article class="badge-item badge-theme-${escapeHtml(badge.theme || "volume")} ${isUnlocked ? "unlocked" : "locked"}">
      <span class="badge-icon">${badge.icon}</span>
      <span class="badge-title">${badge.title}</span>
      <span class="badge-sub">${isUnlocked ? badge.rule : `${badge.rule} (${progress})`}</span>
    </article>`;
  }).join("");

  const nextBadge = BADGE_DEFINITIONS.find((badge) => !unlocked[badge.id]);
  dom.nextBadgeHint.textContent = nextBadge
    ? `Next badge: ${nextBadge.title} — ${nextBadge.rule}.`
    : "All current badges unlocked. New badge set coming soon.";
}

function trackGamificationAttempt(isCorrect, at = Date.now()) {
  const g = state.gamification;
  const dayKey = dayKeyFromDate(at);
  const weekKey = weekKeyFromDate(at);
  const previousDay = g.lastActiveDay || "";
  const hadAttemptsToday = Number(g.dailyAttempts?.[dayKey] || 0) > 0;

  g.totalAnswered = Number(g.totalAnswered || 0) + 1;
  if (isCorrect) g.totalCorrect = Number(g.totalCorrect || 0) + 1;
  g.dailyAttempts = g.dailyAttempts || {};
  g.weeklyAttempts = g.weeklyAttempts || {};
  g.dailyAttempts[dayKey] = Number(g.dailyAttempts[dayKey] || 0) + 1;
  g.weeklyAttempts[weekKey] = Number(g.weeklyAttempts[weekKey] || 0) + 1;

  if (!hadAttemptsToday) {
    if (!previousDay) {
      g.streakDays = 1;
    } else {
      const diff = dayDiff(dayKey, previousDay);
      g.streakDays = diff === 1 ? Number(g.streakDays || 0) + 1 : 1;
    }
    g.lastActiveDay = dayKey;
  }

  const unlockedNow = evaluateBadges();
  if (unlockedNow.length) {
    showBadgeToast(`Badge unlocked: ${unlockedNow[0].title}`);
  }

  renderGamificationPanel();
  saveLocal();
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "");
}

function questionCompositeKey(tag, question, answer) {
  return `${normalize(tag)}|${normalize(question)}|${normalize(answer)}`;
}

function sanitizeTagKey(tag) {
  return String(tag || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function syncCategoryOptionsFromTagRegistry() {
  const active = (state.tagRegistry || []).filter((item) => item && item.isActive !== false);
  CATEGORY_OPTIONS = [{ key: "ALL", label: "All Topics" }].concat(
    active.map((item) => ({ key: item.key, label: item.label || item.key }))
  );
}

function setTagRegistry(tags) {
  state.tagRegistry = Array.isArray(tags) && tags.length
    ? tags.map((item) => ({
      key: sanitizeTagKey(item.key),
      label: String(item.label || item.key || "").trim() || sanitizeTagKey(item.key),
      aliases: Array.isArray(item.aliases) ? item.aliases : [],
      isActive: item.isActive !== false,
      usage: item.usage || null
    })).filter((item) => item.key)
    : DEFAULT_TAG_DEFINITIONS.map((item) => ({ ...item }));
  syncCategoryOptionsFromTagRegistry();
  if (!CATEGORY_OPTIONS.some((item) => item.key === state.selectedTag)) {
    state.selectedTag = "ALL";
  }
  renderDynamicTagControls();
}

function getTagLabel(tagKey) {
  const normalized = sanitizeTagKey(tagKey);
  const found = (state.tagRegistry || []).find((item) => sanitizeTagKey(item.key) === normalized);
  return found ? (found.label || found.key) : String(tagKey || normalized || "OTHER");
}

function splitTagValues(tagValue) {
  return Array.from(
    new Set(
      String(tagValue || "")
        .split(/[,\n;|]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function getCanonicalTags(tagValue) {
  const parts = splitTagValues(tagValue);
  if (!parts.length) {
    const single = normalizeTagKey(tagValue);
    return single === "OTHER" ? [] : [single];
  }
  return Array.from(new Set(parts.map((part) => normalizeTagKey(part)).filter((key) => key && key !== "OTHER")));
}

function formatTagLabels(tagValue) {
  const tags = getCanonicalTags(tagValue);
  if (!tags.length) return String(tagValue || "General");
  return tags.map((tag) => getTagLabel(tag)).join(", ");
}

function normalizeTagKey(tag) {
  const cleaned = sanitizeTagKey(tag).replace(/-/g, "");
  const registry = Array.isArray(state.tagRegistry) ? state.tagRegistry : [];
  for (const item of registry) {
    const keyClean = sanitizeTagKey(item.key).replace(/-/g, "");
    if (cleaned === keyClean) return item.key;
    const aliases = Array.isArray(item.aliases) ? item.aliases : [];
    for (const alias of aliases) {
      const aliasClean = sanitizeTagKey(alias).replace(/-/g, "");
      if (aliasClean && cleaned === aliasClean) return item.key;
    }
  }

  if (cleaned.includes("IPDRG")) return "IP-DRG-CODING";
  if (cleaned.includes("SURGERY")) return "SURGERY-CODING";
  return "OTHER";
}

function renderDynamicTagControls() {
  if (dom.questionBankBulkTag) {
    dom.questionBankBulkTag.innerHTML = ['<option value="">Change tag to...</option>']
      .concat(CATEGORY_OPTIONS.filter((item) => item.key !== "ALL").map((item) => `<option value="${escapeHtml(item.key)}">${escapeHtml(item.label)}</option>`))
      .join("");
  }
  if (dom.questionBankTagFilter) {
    const currentValue = dom.questionBankTagFilter.value;
    dom.questionBankTagFilter.innerHTML = ['<option value="">All Tags</option>']
      .concat(CATEGORY_OPTIONS.filter((item) => item.key !== "ALL").map((item) => `<option value="${escapeHtml(item.key)}">${escapeHtml(item.label)}</option>`))
      .join("");
    if (currentValue && CATEGORY_OPTIONS.some((item) => item.key === currentValue)) {
      dom.questionBankTagFilter.value = currentValue;
    }
  }
  if (dom.importDefaultTag) {
    const currentValue = dom.importDefaultTag.value;
    dom.importDefaultTag.innerHTML = ['<option value="">Use file value or General</option>']
      .concat(CATEGORY_OPTIONS.filter((item) => item.key !== "ALL").map((item) => `<option value="${escapeHtml(item.key)}">${escapeHtml(item.label)}</option>`))
      .join("");
    if (currentValue && CATEGORY_OPTIONS.some((item) => item.key === currentValue)) {
      dom.importDefaultTag.value = currentValue;
    }
  }
  if (dom.tenantTagCheckboxes) {
    dom.tenantTagCheckboxes.innerHTML = CATEGORY_OPTIONS.filter((item) => item.key !== "ALL")
      .map((item) => `<label class="tag-checkbox-item"><input type="checkbox" value="${escapeHtml(item.key)}" /> ${escapeHtml(item.label)}</label>`)
      .join("");
  }
}
