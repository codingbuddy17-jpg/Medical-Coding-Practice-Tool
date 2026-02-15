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
const SYLLABUS_URL = "";

const CATEGORY_OPTIONS = [
  { key: "ALL", label: "All Topics" },
  { key: "ICD-10-CM", label: "ICD 10 CM" },
  { key: "ICD-10-PCS", label: "ICD 10 PCS" },
  { key: "CPT", label: "CPT" },
  { key: "MODIFIERS", label: "Modifiers" },
  { key: "GUIDELINES", label: "Guidelines" },
  { key: "CCS", label: "CCS" },
  { key: "CPC", label: "CPC" },
  { key: "CDIP", label: "CDIP" },
  { key: "SURGERY-CODING", label: "Surgery Coding" },
  { key: "IP-DRG-CODING", label: "IP-DRG Coding" },
  { key: "MEDICINE", label: "Medicine" }
];

const TRACKED_CATEGORY_KEYS = CATEGORY_OPTIONS.filter((item) => item.key !== "ALL").map((item) => item.key);

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

function createEmptyCategoryStats() {
  const stats = {};
  TRACKED_CATEGORY_KEYS.forEach((key) => {
    stats[key] = { attempted: 0, correct: 0, wrong: 0 };
  });
  stats.OTHER = { attempted: 0, correct: 0, wrong: 0 };
  return stats;
}

const state = {
  role: "trial",
  userName: "",
  userEmail: "",
  userPhone: "",
  trainerKey: "",
  trainerKeyVerified: false,
  adminKey: "",
  selectedTag: "ALL",
  weakDrillEnabled: false,
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
    passThreshold: 80,
    strictTiming: true,
    blueprintName: ""
  },
  awaitingNext: false,
  selectedMcqOption: "",
  studyOrder: {
    queues: {},
    cursors: {}
  },
  accessConfig: {
    trialQuestionLimit: 20,
    contactMessage: "For full access, contact PracticeBuddy Lab by CodingBuddy360 on WhatsApp at +91 8309661352."
  },
  adminPanel: {
    verified: false,
    cohorts: []
  },
  analytics: {
    lastScope: "",
    lastEmail: "",
    lastCohortName: "",
    lastDays: 30,
    lastData: null,
    lastRecommendations: []
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
  importPreview: {
    active: false,
    rows: [],
    summary: null,
    importCards: []
  }
};

// DOM Cache (populated on init)
let dom = {};

function cacheDOM() {
  dom = {
    userName: document.getElementById("userName"),
    userEmail: document.getElementById("userEmail"),
    userPhone: document.getElementById("userPhone"),
    roleSelect: document.getElementById("roleSelect"),
    traineeCodeWrap: document.getElementById("traineeCodeWrap"),
    traineeCode: document.getElementById("traineeCode"),
    trainerKeyWrap: document.getElementById("trainerKeyWrap"),
    trainerKey: document.getElementById("trainerKey"),
    startBtn: document.getElementById("startBtn"),
    endSessionBtn: document.getElementById("endSessionBtn"),
    sessionStatus: document.getElementById("sessionStatus"),

    topbarSessionSummary: document.getElementById("topbarSessionSummary"),
    topbarSessionActions: document.getElementById("topbarSessionActions"),
    metricScoreCard: document.getElementById("metricScoreCard"),
    correctCount: document.getElementById("correctCount"),
    wrongCount: document.getElementById("wrongCount"),
    attemptedCount: document.getElementById("attemptedCount"),
    sessionScore: document.getElementById("sessionScore"),

    categoryButtons: document.getElementById("categoryButtons"),
    categoryStatus: document.getElementById("categoryStatus"),
    weakDrillToggle: document.getElementById("weakDrillToggle"),
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
    checkBtn: document.getElementById("checkBtn"),
    nextBtn: document.getElementById("nextBtn"),
    flagQuestionBtn: document.getElementById("flagQuestionBtn"),
    feedback: document.getElementById("feedback"),
    rationalePlaceholder: document.getElementById("rationalePlaceholder"),
    trialLockNotice: document.getElementById("trialLockNotice"),
    trialInfoBanner: document.getElementById("trialInfoBanner"),
    preSessionLanding: document.getElementById("preSessionLanding"),
    landingStartTrialBtn: document.getElementById("landingStartTrialBtn"),
    landingFullAccessBtn: document.getElementById("landingFullAccessBtn"),
    upgradeWall: document.getElementById("upgradeWall"),
    upgradeStatus: document.getElementById("upgradeStatus"),
    unlockAccessBtn: document.getElementById("unlockAccessBtn"),
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
    importFileBtn: document.getElementById("importFileBtn"),
    importBtn: document.getElementById("importBtn"),
    loadStarterBtn: document.getElementById("loadStarterBtn"),
    exportBtn: document.getElementById("exportBtn"),
    importStatus: document.getElementById("importStatus"),
    importPreviewPanel: document.getElementById("importPreviewPanel"),
    importPreviewSummary: document.getElementById("importPreviewSummary"),
    importPreviewBody: document.getElementById("importPreviewBody"),
    confirmImportBtn: document.getElementById("confirmImportBtn"),
    cancelImportPreviewBtn: document.getElementById("cancelImportPreviewBtn"),
    importReviewStatusFilter: document.getElementById("importReviewStatusFilter"),
    refreshImportReviewBtn: document.getElementById("refreshImportReviewBtn"),
    resolveAllImportReviewBtn: document.getElementById("resolveAllImportReviewBtn"),
    exportImportReviewBtn: document.getElementById("exportImportReviewBtn"),
    importReviewBody: document.getElementById("importReviewBody"),
    importReviewStatus: document.getElementById("importReviewStatus"),
    refreshImportBatchesBtn: document.getElementById("refreshImportBatchesBtn"),
    rollbackBatchIdInput: document.getElementById("rollbackBatchIdInput"),
    rollbackBatchBtn: document.getElementById("rollbackBatchBtn"),
    importBatchBody: document.getElementById("importBatchBody"),
    importBatchBody: document.getElementById("importBatchBody"),
    importBatchStatus: document.getElementById("importBatchStatus"), // Ensure this ID exists in HTML

    refreshSessionsBtn: document.getElementById("refreshSessionsBtn"),
    exportSessionsBtn: document.getElementById("exportSessionsBtn"),
    sessionSearchInput: document.getElementById("sessionSearchInput"),
    sessionRoleFilter: document.getElementById("sessionRoleFilter"),
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
    adminTools: document.getElementById("adminTools"),
    adminTraineeCode: document.getElementById("adminTraineeCode"),
    adminTrainerKey: document.getElementById("adminTrainerKey"),
    adminTrialLimit: document.getElementById("adminTrialLimit"),
    adminTraineeActive: document.getElementById("adminTraineeActive"),
    adminTraineeExpiry: document.getElementById("adminTraineeExpiry"),
    saveAccessConfigBtn: document.getElementById("saveAccessConfigBtn"),
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
    analyticsRecommendedTags: document.getElementById("analyticsRecommendedTags"),
    analyticsTagBody: document.getElementById("analyticsTagBody"),
    analyticsTrendBody: document.getElementById("analyticsTrendBody"),
    adminActiveIndicator: document.getElementById("adminActiveIndicator"),
    importReviewOpenCount: document.getElementById("importReviewOpenCount"),
    flagQueueOpenCount: document.getElementById("flagQueueOpenCount"),
    sessionConsoleSummary: document.getElementById("sessionConsoleSummary")
  };
}

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
  el.classList.remove("success", "error");
  if (mode) el.classList.add(mode);
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

function normalizeTagKey(tag) {
  const cleaned = String(tag || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  if (cleaned.includes("ICD10CM")) return "ICD-10-CM";
  if (cleaned.includes("ICD10PCS")) return "ICD-10-PCS";
  if (cleaned.includes("CPT")) return "CPT";
  if (cleaned.includes("MODIFIER")) return "MODIFIERS";
  if (cleaned.includes("GUIDELINE")) return "GUIDELINES";
  if (cleaned.includes("CCS")) return "CCS";
  if (cleaned.includes("CPC")) return "CPC";
  if (cleaned.includes("CDIP")) return "CDIP";
  if (cleaned.includes("SURGERYCODING")) return "SURGERY-CODING";
  if (cleaned.includes("IPDRGCODING")) return "IP-DRG-CODING";
  if (cleaned.includes("IPDRG")) return "IP-DRG-CODING";
  return "OTHER";
}

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
  if (limit > 0 && Number.isFinite(limit)) return limit;
  return isTrialUser() ? Number(state.accessConfig.trialQuestionLimit || 20) : 1000000;
}

function hasSessionLimitReached() {
  return state.session.attempted >= activeSessionLimit();
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
}

function updatePreSessionLandingUI() {
  const isActive = state.session.isActive;

  if (!isActive) {
    // Show Landing & Auth
    dom.preSessionLanding.classList.remove("hidden", "landing-hidden");
    if (dom.authPanel) dom.authPanel.classList.remove("hidden");
    if (dom.brandIntro) dom.brandIntro.classList.remove("hidden");
    if (dom.trialInfoBanner) dom.trialInfoBanner.classList.add("hidden");

    // Hide Navigation & Views
    if (navDom.mainNav) navDom.mainNav.classList.add("hidden");
    if (navDom.viewPractice) navDom.viewPractice.classList.remove("active");
    if (navDom.viewMentor) navDom.viewMentor.classList.remove("active");
    if (navDom.topbarSessionActions) navDom.topbarSessionActions.classList.add("hidden");
    if (navDom.topbarSessionSummary) navDom.topbarSessionSummary.classList.add("hidden");
  } else {
    // Hide Landing & Auth
    dom.preSessionLanding.classList.add("landing-hidden");
    if (dom.authPanel) dom.authPanel.classList.add("hidden");
    if (dom.brandIntro) dom.brandIntro.classList.add("hidden");

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
      rationale: String(parsed.rationale || "").trim()
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
      rationale: String(parsed.rationale || "").trim()
    };
  } catch {
    return null;
  }
}

function encodeCardForCloud(card) {
  const type = String(card.type || "").toLowerCase();
  const rationale = String(card.rationale || "").trim();
  if (type !== "mcq") {
    const answer = String(card.answer || "").trim();
    if (rationale) {
      return {
        tag: String(card.tag || "General").trim(),
        question: String(card.question || "").trim(),
        answer: `${CARD_PREFIX}${JSON.stringify({ type: "short", answer, rationale })}`
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
    rationale
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

    return {
      id: card.id || `${normalizeTagKey(card.tag)}_${index}_${uid("card")}`,
      tag: (card.tag || "General").trim(),
      question: String(card.question || "").trim(),
      type: isMcq ? "mcq" : "short",
      answer: isMcq ? "" : shortAnswer,
      options: isMcq ? options.slice(0, 4) : [],
      correctOption: isMcq ? correctOption : "",
      rationale
    };
  });
}

function saveLocal() {
  const payload = {
    role: state.role,
    deck: state.deck,
    resources: state.resources,
    selectedTag: state.selectedTag,
    weakDrillEnabled: state.weakDrillEnabled,
    examConfig: state.examConfig
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
    state.weakDrillEnabled = Boolean(parsed.weakDrillEnabled);
    state.examConfig.questionCount = Number(parsed.examConfig?.questionCount) || 30;
    state.examConfig.durationMinutes = Number(parsed.examConfig?.durationMinutes) || 30;
    state.examConfig.passThreshold = Math.min(100, Math.max(1, Number(parsed.examConfig?.passThreshold) || 80));
    state.examConfig.strictTiming = parsed.examConfig?.strictTiming !== false;
    state.examConfig.blueprintId = String(parsed.examConfig?.blueprintId || "");
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
    return;
  }
  state.studyOrder.queues = {};
  state.studyOrder.cursors = {};
}

function buildStudyQueueForTag(tagKey) {
  const ids = getCardsForTag(tagKey).map((card) => card.id);
  state.studyOrder.queues[tagKey] = shuffledCopy(ids);
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
  const isTrainee = state.role === "trainee";
  console.log("updateRoleUI called. Role:", state.role);
  const canUseExam = isTrainer || isTrainee;
  dom.trainerZone.classList.toggle("hidden", !trainerKeyVerified);
  dom.resourceManager.classList.toggle("hidden", !trainerKeyVerified);

  // Force visibility via inline style to prevent CSS conflicts
  if (dom.traineeCodeWrap) {
    dom.traineeCodeWrap.classList.toggle("hidden", !isTrainee);
    dom.traineeCodeWrap.style.display = isTrainee ? "block" : "none";
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
      dom.topbarSessionSummary.textContent = `${name} · ${score}%`;
      dom.topbarSessionSummary.classList.remove("hidden");
      dom.topbarSessionActions.classList.remove("hidden");

      // Show Practice View
      const practiceTab = document.getElementById("view-practice");
      if (practiceTab) {
        practiceTab.classList.remove("hidden");
        practiceTab.classList.add("active");
      }
    } else {
      dom.topbarSessionSummary.textContent = "";
      dom.topbarSessionSummary.classList.add("hidden");
      dom.topbarSessionActions.classList.add("hidden");

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
  const score = attempted === 0 ? 0 : Math.round((correct / attempted) * 100);

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
    dom.topbarSessionSummary.textContent = `${name} · ${score}%`;
  }
}

function updateExamStatusUI() {
  if (!state.exam.inProgress) {
    dom.examTimer.textContent = "Time left: --:--";
    return;
  }

  const total = state.exam.queueIds.length;
  const answered = state.exam.answered;
  const threshold = Math.min(100, Math.max(1, Number(state.exam.passThreshold || state.examConfig.passThreshold || 80)));
  const name = state.exam.blueprintName ? ` [${state.exam.blueprintName}]` : "";
  setStatus(dom.examStatus, `Exam running${name}: ${answered}/${total} answered. Pass ${threshold}%.`);
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
    setStatus(dom.rationalePlaceholder, DEFAULT_RATIONALE_TEXT);
    setAwaitingNext(false);
    dom.flagQuestionBtn.disabled = true;
    updateTrialLockUI();
    updateTrialInfoBannerUI();
    updateUpgradeWallUI();
    dom.categoryStatus.textContent = state.role === "trainer" ? `Showing 0 cards for ${state.selectedTag}.` : "";
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
    setStatus(dom.rationalePlaceholder, "Unlock full access to continue practicing all questions.");
    setAwaitingNext(false);
    dom.flagQuestionBtn.disabled = true;
    updateTrialLockUI();
    updateTrialInfoBannerUI();
    updateUpgradeWallUI();
    dom.categoryStatus.textContent = state.role === "trainer" ? "Question limit reached for current access." : "";
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
  setStatus(dom.rationalePlaceholder, String(card.rationale || "").trim() || DEFAULT_RATIONALE_TEXT);
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

  // Show Modal
  const resultOverlay = document.createElement("div");
  resultOverlay.className = "exam-result-overlay";
  resultOverlay.innerHTML = `
    <div class="exam-result-card ${passed ? "pass" : "fail"}">
      <h2>Exam Completed</h2>
      <div class="result-score">${score}%</div>
      <p class="result-status">${passed ? "PASSED" : "FAILED"}</p>
      <p class="result-detail">Correct: ${state.exam.correct} | Wrong: ${state.exam.wrong} | Attempted: ${attempted}</p>
      <p class="result-note">Threshold: ${passThreshold}%</p>
      <div class="result-actions">
        <button class="primary-btn" onclick="window.location.reload()">Return to Dashboard</button>
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

function shuffledCopy(items) {
  const arr = [...items];

  const randomIndex = (max) => {
    if (max <= 0) return 0;
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

function shuffleCardsForExam(cards, limit) {
  return shuffledCopy(cards).slice(0, limit).map(c => c.id);
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
  const total = Math.min(requested, candidateCards.length);

  // For Blueprint/Standard, we might just use random or blueprint logic
  // But for Topic/Weakness we shouldn't use blueprint queue logic unless verified.
  // For now, simple random shuffle for Topic/Weakness/Standard
  const queue = shuffleCardsForExam(candidateCards, total);

  state.exam.inProgress = true;
  state.exam.queueIds = queue;
  state.exam.cursor = 0;
  state.exam.remainingSeconds = minutes * 60;
  state.exam.answered = 0;
  state.exam.correct = 0;
  state.exam.wrong = 0;
  state.exam.passThreshold = passThreshold;
  state.exam.strictTiming = strictTiming;
  state.exam.blueprintName = selectedTemplate?.name || "";

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
    state.exam.answered += 1;
    if (state.exam.cursor >= state.exam.queueIds.length) {
      finishExam("completed");
      return;
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

  if (state.weakDrillEnabled) {
    const nextIdxInCards = pickNextWeakCard(cards, current.id);
    const nextCard = cards[nextIdxInCards] || cards[0];
    const nextQueueIdx = queue.indexOf(nextCard.id);
    state.studyOrder.cursors[state.selectedTag] = nextQueueIdx >= 0 ? nextQueueIdx : 0;
  } else {
    const currentCursor = state.studyOrder.cursors[state.selectedTag] || 0;
    state.studyOrder.cursors[state.selectedTag] = (currentCursor + 1) % queue.length;
  }

  renderCard();
}

function recordCategoryAndCardStats(card, isCorrect) {
  const tagKey = normalizeTagKey(card.tag);
  if (!state.session.categoryStats[tagKey]) {
    state.session.categoryStats[tagKey] = { attempted: 0, correct: 0, wrong: 0 };
  }

  const cat = state.session.categoryStats[tagKey];
  cat.attempted += 1;
  if (isCorrect) cat.correct += 1;
  else cat.wrong += 1;

  if (!state.session.cardStats[card.id]) {
    state.session.cardStats[card.id] = { attempted: 0, correct: 0, wrong: 0 };
  }
  const cardStat = state.session.cardStats[card.id];
  cardStat.attempted += 1;
  if (isCorrect) cardStat.correct += 1;
  else cardStat.wrong += 1;
}

async function apiRequest(path, method = "GET", payload = null) {
  const options = { method, headers: {}, cache: "no-store" };
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
    state.accessConfig.contactMessage =
      String(data.contactMessage || "").trim() || `For full access, contact ${BRAND_NAME} on WhatsApp at +91 8309661352.`;
  } catch {
    state.accessConfig.trialQuestionLimit = 20;
  }
}

function resetSessionTracking() {
  state.session.correct = 0;
  state.session.wrong = 0;
  state.session.attempted = 0;
  state.session.categoryStats = createEmptyCategoryStats();
  state.session.cardStats = {};
  renderCategoryScorecards();
}

async function startSession() {
  const userName = dom.userName.value.trim();
  const userEmail = dom.userEmail.value.trim();
  const userPhone = dom.userPhone.value.trim();
  const role = dom.roleSelect.value;
  const traineeCode = dom.traineeCode.value.trim();
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

  if (role === "trainee") {
    try {
      const verification = await apiRequest("/api/access/verify", "POST", { code: traineeCode, email: userEmail });
      if (!verification.valid) {
        let msg = "Invalid trainee access code.";
        if (verification.reason === "trainee_access_inactive_or_expired") msg = "Learner access is inactive or expired. Contact admin.";
        if (verification.reason === "not_enrolled_in_cohort") msg = "This email is not enrolled in the selected cohort access.";
        else if (verification.reason === "member_inactive_or_expired") msg = "Your cohort access is inactive or expired. Contact trainer.";
        else if (verification.reason === "cohort_inactive_or_expired") msg = "This cohort access code is inactive or expired.";
        else if (verification.reason === "email_required_for_cohort") msg = "Email is required for cohort access verification.";
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
  resetStudyOrder();

  state.userName = userName;
  state.userEmail = userEmail;
  state.userPhone = userPhone;
  state.role = role;
  state.trainerKey = trainerKey;
  state.trainerKeyVerified = role === "trainer";
  state.currentCardIndex = 0;
  state.session.id = uid("session");
  state.session.startedAt = Date.now();
  state.session.isActive = true;
  state.session.questionLimit = Math.max(
    1,
    Number(role === "trial" ? state.accessConfig.trialQuestionLimit : verifiedAccess.questionLimit || 1000000)
  );
  state.session.cohortId = verifiedAccess.cohortId;
  state.session.cohortName = verifiedAccess.cohortName;
  state.awaitingNext = false;
  resetSessionTracking();
  updateSessionIdentityLock();

  try {
    const session = await apiRequest("/api/session/start", "POST", {
      sessionId: state.session.id,
      userName,
      userEmail,
      userPhone,
      role
    });
    state.session.id = session.id || state.session.id;
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

  const summary = {
    correct: state.session.correct,
    wrong: state.session.wrong,
    attempted: state.session.attempted,
    score: state.session.attempted ? Math.round((state.session.correct / state.session.attempted) * 100) : 0
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
  updateSessionIdentityLock();
  updatePreSessionLandingUI();
  setStatus(dom.sessionStatus, `Session ended. Score: ${summary.score}%`, "success");
}

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
    state.session.attempted += 1;

    if (state.exam.inProgress) {
      // EXAM MODE: Silent Check (No Feedback, Auto-advance)
      state.exam.answered += 1;
      if (result.isCorrect) {
        state.exam.correct += 1;
      } else {
        state.exam.wrong += 1;
      }
      // Update generic session stats too, but silently
      if (result.isCorrect) state.session.correct += 1;
      else state.session.wrong += 1;

      recordCategoryAndCardStats(card, result.isCorrect);
      updateMetrics(); // Sync top bar stats

      // Throttle to prevent double-clicks/execution
      await new Promise(r => setTimeout(r, 300));

      // Auto-advance immediately
      state.awaitingNext = true; // Required for nextQuestion() to proceed
      nextQuestion();
      return;
    }

    // PRACTICE MODE: Visual Feedback
    if (result.isCorrect) {
      state.session.correct += 1;
      setStatus(dom.feedback, `Correct. Expected: ${result.primaryAnswer}`, "success");
    } else {
      state.session.wrong += 1;
      setStatus(dom.feedback, `Not correct. Expected: ${result.primaryAnswer}`, "error");
    }

    recordCategoryAndCardStats(card, result.isCorrect);
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
      at: Date.now()
    });
    setAwaitingNext(true);

  } finally {
    state.processingAnswer = false;
  }
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

function removeInvalidSurrogates(text) {
  const value = String(text || "");
  let out = "";
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    const isHigh = code >= 0xd800 && code <= 0xdbff;
    const isLow = code >= 0xdc00 && code <= 0xdfff;

    if (isHigh) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        out += value[i] + value[i + 1];
        i += 1;
      }
      continue;
    }
    if (isLow) continue;
    out += value[i];
  }
  return out;
}

function cleanImportText(text) {
  return removeInvalidSurrogates(String(text || "").replace(/\u0000/g, "")).trim();
}

function sanitizeQuestionCard(card) {
  const typeRaw = cleanImportText(card.type || "short").toLowerCase();
  const type = typeRaw === "mcq" ? "mcq" : "short";
  const cleanOption = (v) => cleanImportText(v || "");
  return {
    tag: cleanImportText(card.tag || "General"),
    type,
    question: cleanImportText(card.question || ""),
    answer: cleanImportText(card.answer || ""),
    rationale: cleanImportText(card.rationale || ""),
    option_a: cleanOption(card.option_a || card.optionA || ""),
    option_b: cleanOption(card.option_b || card.optionB || ""),
    option_c: cleanOption(card.option_c || card.optionC || ""),
    option_d: cleanOption(card.option_d || card.optionD || ""),
    correct_option: cleanImportText(card.correct_option || card.correctOption || "").toUpperCase()
  };
}

function detectDelimiter(sampleLine) {
  const line = sampleLine || "";
  const comma = (line.match(/,/g) || []).length;
  const semicolon = (line.match(/;/g) || []).length;
  const tab = (line.match(/\t/g) || []).length;
  if (tab >= semicolon && tab >= comma) return "\t";
  if (semicolon > comma) return ";";
  return ",";
}

function parseDelimitedLine(line, delimiter) {
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
    if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function parseCsv(text) {
  const clean = cleanImportText(text);
  const lines = clean
    .split(/\r?\n/)
    .map((line) => cleanImportText(line))
    .filter(Boolean);

  if (!lines.length) return [];

  const delimiter = detectDelimiter(lines[0]);
  const rows = lines.map((line) => parseDelimitedLine(line, delimiter));
  return parseRowsMatrix(rows);
}

function parseExcelArrayBuffer(buffer) {
  if (!window.XLSX) throw new Error("Excel parser unavailable");
  const workbook = window.XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = workbook.Sheets[firstSheetName];
  const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
  return parseRowsMatrix(rows);
}

function parseRowsMatrix(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];
  const header = rows[0].map((x) => cleanImportText(x).toLowerCase());
  const headerMap = {};
  header.forEach((name, idx) => {
    headerMap[name] = idx;
  });

  const hasNamedHeader = header.includes("question") && (header.includes("answer") || header.includes("option_a"));
  const startAt = hasNamedHeader ? 1 : 0;

  const getCell = (row, idx) => cleanImportText(idx >= 0 ? row[idx] : "");
  const getByName = (row, names, fallbackIdx = -1) => {
    for (const name of names) {
      if (Object.prototype.hasOwnProperty.call(headerMap, name)) {
        return getCell(row, headerMap[name]);
      }
    }
    return getCell(row, fallbackIdx);
  };

  return rows.slice(startAt).map((row) => {
    const tag = getByName(row, ["tag", "tags", "category", "topic"], 0) || "General";
    const type = (getByName(row, ["type"], 1) || (hasNamedHeader ? "short" : "")).toLowerCase();
    const question = getByName(row, ["question"], hasNamedHeader ? -1 : 1);
    const answer = getByName(row, ["answer"], hasNamedHeader ? -1 : 2);
    const rationale = getByName(row, ["rationale", "explanation"], -1);
    const optionA = getByName(row, ["option_a", "optiona", "a"], -1);
    const optionB = getByName(row, ["option_b", "optionb", "b"], -1);
    const optionC = getByName(row, ["option_c", "optionc", "c"], -1);
    const optionD = getByName(row, ["option_d", "optiond", "d"], -1);
    const correctOption = getByName(row, ["correct_option", "correctoption", "correct"], -1).toUpperCase();

    return {
      tag,
      type: type === "mcq" ? "mcq" : "short",
      question,
      answer,
      rationale,
      option_a: optionA,
      option_b: optionB,
      option_c: optionC,
      option_d: optionD,
      correct_option: correctOption
    };
  });
}

function formatCardsForTextarea(cards) {
  const header = "tag,type,question,answer,rationale,option_a,option_b,option_c,option_d,correct_option";
  const rows = cards.map((r) => {
    const type = String(r.type || "short").toLowerCase() === "mcq" ? "mcq" : "short";
    const cols = [
      r.tag || "General",
      type,
      r.question || "",
      type === "mcq" ? "" : r.answer || "",
      r.rationale || "",
      r.option_a || "",
      r.option_b || "",
      r.option_c || "",
      r.option_d || "",
      r.correct_option || ""
    ];
    return cols.map((v) => String(v).replaceAll("\n", " ").trim()).join(",");
  });
  return [header, ...rows].join("\n");
}

async function readFileAsImportCards(file) {
  const name = String(file?.name || "").toLowerCase();
  const isExcel = name.endsWith(".xlsx") || name.endsWith(".xls");

  if (isExcel) {
    const buffer = await file.arrayBuffer();
    return parseExcelArrayBuffer(buffer);
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
  return parseCsv(text);
}

function importSeverity(status) {
  if (status === "fail") return 4;
  if (status === "skip") return 3;
  if (status === "warn") return 2;
  return 1;
}

function mergeImportStatus(a, b) {
  return importSeverity(b) > importSeverity(a) ? b : a;
}

function renderImportPreview() {
  const active = Boolean(state.importPreview.active);
  if (dom.importPreviewPanel) {
    dom.importPreviewPanel.classList.toggle("hidden", !active);
    dom.importPreviewPanel.style.display = active ? "block" : "none"; // Force visible
  }
  if (!active) {
    if (dom.importPreviewSummary) dom.importPreviewSummary.textContent = "";
    dom.importPreviewBody.innerHTML = '<tr><td colspan="5">No preview yet.</td></tr>';
    dom.confirmImportBtn.disabled = true;
    return;
  }

  const summary = state.importPreview.summary || { total: 0, pass: 0, warn: 0, skip: 0, fail: 0 };
  dom.importPreviewSummary.textContent = `Total ${summary.total} rows: ${summary.pass} pass, ${summary.warn} warn, ${summary.skip} skip, ${summary.fail} fail.`;
  dom.confirmImportBtn.disabled = !state.importPreview.importCards.length;

  const rows = Array.isArray(state.importPreview.rows) ? state.importPreview.rows : [];
  const topRows = rows.slice(0, 120);
  if (!topRows.length) {
    dom.importPreviewBody.innerHTML = '<tr><td colspan="5">No rows available.</td></tr>';
    return;
  }

  dom.importPreviewBody.innerHTML = topRows
    .map((row) => {
      const status = String(row.status || "pass");
      const reason = Array.isArray(row.reasons) && row.reasons.length ? row.reasons.join("; ") : "-";
      const question = String(row.question || "").slice(0, 140);
      return `<tr><td>${row.rowNumber}</td><td><span class="import-status-pill import-status-${escapeHtml(status)}">${escapeHtml(status)}</span></td><td>${escapeHtml(row.tag || "")}</td><td>${escapeHtml(question)}</td><td>${escapeHtml(reason)}</td></tr>`;
    })
    .join("");
}

function clearImportPreview() {
  state.importPreview.active = false;
  state.importPreview.rows = [];
  state.importPreview.summary = null;
  state.importPreview.importCards = [];
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

    const normalizedTag = normalizeTagKey(row.tag);
    if (normalizedTag === "OTHER") {
      status = mergeImportStatus(status, "warn");
      reasons.push("Tag not in configured category list");
    } else if (!allowedTags.has(normalizedTag)) {
      status = mergeImportStatus(status, "warn");
      reasons.push("Tag is not currently enabled");
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
      const reasons = Array.isArray(item.reasons) && item.reasons.length ? item.reasons.join("; ") : "-";
      const actionBtn =
        String(item.status || "") === "open"
          ? `<button class="ghost-btn" type="button" data-import-review-action="resolve" data-import-review-id="${escapeHtml(item.id)}">Resolve</button>`
          : `<button class="ghost-btn" type="button" data-import-review-action="reopen" data-import-review-id="${escapeHtml(item.id)}">Reopen</button>`;
      return `<tr><td>${escapeHtml(item.status)}</td><td>${escapeHtml(item.tag || "")}</td><td>${escapeHtml(String(item.question || "").slice(0, 120))}</td><td>${escapeHtml(reasons)}</td><td>${actionBtn}</td></tr>`;
    })
    .join("");
}

async function loadImportReviewQueue() {
  if (state.role !== "trainer") return;
  const trainerKey = state.trainerKey || dom.trainerKey.value.trim();
  if (!trainerKey) return;
  const status = String(dom.importReviewStatusFilter.value || "");
  const qs = new URLSearchParams({ trainerKey });
  if (status) qs.set("status", status);
  try {
    const data = await apiRequest(`/api/import/review?${qs.toString()}`);
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
    dom.importBatchBody.innerHTML = '<tr><td colspan="6">No import batches loaded.</td></tr>';
    return;
  }
  dom.importBatchBody.innerHTML = items
    .map((item) => {
      const createdAt = item.createdAt ? new Date(item.createdAt).toLocaleString() : "-";
      return `<tr><td>${escapeHtml(item.id)}</td><td>${Number(item.insertedCount || 0)}</td><td>${Number(item.warnCount || 0)}</td><td>${Number(item.failCount || 0)}</td><td>${Number(item.skippedCount || 0)}</td><td>${escapeHtml(createdAt)}</td></tr>`;
    })
    .join("");
}

async function loadImportBatches() {
  if (state.role !== "trainer") return;
  const trainerKey = state.trainerKey || dom.trainerKey.value.trim();
  if (!trainerKey) return;
  try {
    const data = await apiRequest(`/api/import/batches?trainerKey=${encodeURIComponent(trainerKey)}&limit=100`);
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

  const parsed = parseCsv(dom.csvInput.value);
  if (!parsed.length) {
    setStatus(dom.importStatus, "No valid cards. Use tag,type,question,... format or legacy tag,question,answer.", "error");
    return;
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

  const header = "tag,type,question,answer,rationale,option_a,option_b,option_c,option_d,correct_option";
  const rows = state.deck.map((card) =>
    [
      card.tag,
      card.type || "short",
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

async function loadSessions() {
  if (state.role !== "trainer") return;

  const trainerKey = state.trainerKey;
  if (!trainerKey) {
    setStatus(dom.sessionLoadStatus, "Enter trainer key.", "error");
    return;
  }
  try {
    const data = await apiRequest(`/api/sessions?trainerKey=${encodeURIComponent(trainerKey)}`);
    state.sessionConsole.all = Array.isArray(data.sessions) ? data.sessions : [];
    renderSessionConsoleTable();
    setStatus(dom.sessionLoadStatus, `Loaded ${state.sessionConsole.all.length} sessions.`, "success");
    if (dom.sessionConsoleSummary) dom.sessionConsoleSummary.textContent = state.sessionConsole.all.length > 0 ? String(state.sessionConsole.all.length) : "";
  } catch (err) {
    setStatus(dom.sessionLoadStatus, `Could not load sessions: ${err.message}`, "error");
    if (dom.sessionConsoleSummary) dom.sessionConsoleSummary.textContent = "";
  }
}

function toAccessTypeLabel(role) {
  if (role === "trial") return "Trial Access";
  if (role === "trainee") return "Learner Access";
  if (role === "trainer") return "Mentor Console";
  return role || "-";
}

function filteredSessionsForConsole() {
  const search = String(dom.sessionSearchInput.value || "").trim().toLowerCase();
  const role = String(dom.sessionRoleFilter.value || "");
  return (state.sessionConsole.all || []).filter((s) => {
    if (role && String(s.role || "") !== role) return false;
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
    dom.sessionTableBody.innerHTML = '<tr><td colspan="7">No sessions found for current filter.</td></tr>';
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
      return `<tr><td>${escapeHtml(s.userName)}</td><td>${escapeHtml(toAccessTypeLabel(s.role))}</td><td>${attempted}</td><td>${correct}</td><td>${wrong}</td><td>${score}%</td><td>${escapeHtml(started)}</td></tr>`;
    })
    .join("");

  updateDashboardWidgets();
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
           <button type="button" class="ghost-btn" data-flag-action="replace" data-flag-id="${escapeHtml(item.id)}">Replace</button>`
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
  const qs = new URLSearchParams({ trainerKey });
  if (status) qs.set("status", status);
  try {
    const data = await apiRequest(`/api/questions/flags?${qs.toString()}`);
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
  }
}

function renderAnalyticsTables(analytics) {
  const byTag = Array.isArray(analytics?.byTag) ? analytics.byTag : [];
  const trend = Array.isArray(analytics?.trend) ? analytics.trend : [];
  const summary = analytics?.summary || {};
  dom.analyticsAttempted.textContent = String(summary.attempted || 0);
  dom.analyticsCorrect.textContent = String(summary.correct || 0);
  dom.analyticsWrong.textContent = String(summary.wrong || 0);
  dom.analyticsScore.textContent = `${Number(summary.score || 0)}%`;

  if (!byTag.length) {
    dom.analyticsTagBody.innerHTML = '<tr><td colspan="5">No tag analytics for selected filter.</td></tr>';
  } else {
    dom.analyticsTagBody.innerHTML = byTag
      .map(
        (row) =>
          `<tr><td>${escapeHtml(row.tag)}</td><td>${row.attempted}</td><td>${row.correct}</td><td>${row.wrong}</td><td>${row.accuracy}%</td></tr>`
      )
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
    const data = await apiRequest(`/api/cohorts?trainerKey=${encodeURIComponent(state.trainerKey)}`);
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
    const data = await apiRequest(`/api/exam/templates?trainerKey=${encodeURIComponent(state.trainerKey)}`);
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
      `/api/analytics/user?trainerKey=${encodeURIComponent(trainerKey)}&email=${encodeURIComponent(email)}&days=${days}`
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
      `/api/analytics/batch?trainerKey=${encodeURIComponent(trainerKey)}&cohortId=${encodeURIComponent(cohortId)}&days=${days}`
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
      `/api/analytics/recommendations?trainerKey=${encodeURIComponent(trainerKey)}&email=${encodeURIComponent(email)}&days=${days}&limit=15`
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
  const started = state.session.startedAt ? new Date(state.session.startedAt).toLocaleString() : new Date().toLocaleString();
  const generated = new Date().toLocaleString();
  const threshold = Math.min(100, Math.max(1, Number(state.exam.passThreshold || state.examConfig.passThreshold || 80)));
  const examResult = score >= threshold ? "PASS" : "FAIL";

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
  doc.text(`Role: ${state.role}`, 14, y);
  y += 6;
  doc.text(`Session Started: ${started}`, 14, y);
  y += 6;
  doc.text(`Report Generated: ${generated}`, 14, y);
  y += 9;

  // Score summary box
  doc.setFillColor(237, 247, 245);
  doc.setDrawColor(160, 205, 194);
  doc.roundedRect(14, y - 2, 182, 34, 3, 3, "FD");
  doc.text(`Attempted: ${attempted}`, 14, y);
  y += 6;
  doc.text(`Correct: ${correct}`, 14, y);
  y += 6;
  doc.text(`Wrong: ${wrong}`, 14, y);
  y += 6;
  doc.text(`Score: ${score}%`, 14, y);
  y += 6;
  doc.text(`Exam Threshold: ${threshold}% | Result: ${examResult}`, 14, y);
  y += 10;

  doc.setFontSize(11);
  doc.setTextColor(0, 126, 167);
  doc.text("Category Breakdown", 14, y);
  y += 6;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);

  const stats = state.session.categoryStats || {};
  const rows = Object.keys(stats)
    .filter((key) => stats[key]?.attempted > 0)
    .map((key) => {
      const row = stats[key];
      const acc = row.attempted ? Math.round((row.correct / row.attempted) * 100) : 0;
      return `${key}: Attempted ${row.attempted}, Correct ${row.correct}, Wrong ${row.wrong}, Accuracy ${acc}%`;
    });
  if (!rows.length) rows.push("No attempts recorded yet.");

  rows.forEach((line) => {
    if (y > 280) {
      doc.addPage();
      y = 18;
    }
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

function renderCohortUI() {
  const cohorts = Array.isArray(state.adminPanel.cohorts) ? state.adminPanel.cohorts : [];
  if (!cohorts.length) {
    dom.cohortSelect.innerHTML = '<option value="">No cohorts available</option>';
    dom.cohortTableBody.innerHTML = '<tr><td colspan="5">No cohorts loaded.</td></tr>';
    return;
  }

  dom.cohortSelect.innerHTML = cohorts.map((cohort) => `<option value="${escapeHtml(cohort.id)}">${escapeHtml(cohort.name)}</option>`).join("");
  dom.cohortTableBody.innerHTML = cohorts
    .map(
      (cohort) =>
        `<tr><td>${escapeHtml(cohort.name)}</td><td>${escapeHtml(cohort.accessCode)}</td><td>${cohort.questionLimit}</td><td>${cohort.isActive ? "Yes" : "No"
        }</td><td>${cohort.memberCount}${cohort.expiresAt ? ` (Exp: ${escapeHtml(toDateInputValue(cohort.expiresAt))})` : ""}</td></tr>`
    )
    .join("");
  syncCohortFormFromSelection();
}

function syncCohortFormFromSelection() {
  const selectedId = dom.cohortSelect.value;
  const cohort = (state.adminPanel.cohorts || []).find((item) => item.id === selectedId);
  if (!cohort) return;
  dom.cohortNameInput.value = cohort.name || "";
  dom.cohortCodeInput.value = cohort.accessCode || "";
  dom.cohortLimitInput.value = String(cohort.questionLimit || 1000000);
  dom.cohortActiveInput.value = cohort.isActive ? "true" : "false";
  dom.cohortExpiryInput.value = toDateInputValue(cohort.expiresAt);
}

async function verifyAdmin() {
  if (state.role !== "trainer") return;
  const adminKey = dom.adminKeyInput.value.trim();
  if (!adminKey) {
    setStatus(dom.adminStatus, "Enter admin key.", "error");
    return;
  }
  try {
    const data = await apiRequest("/api/admin/verify", "POST", { adminKey });
    if (!data.valid) {
      state.adminPanel.verified = false;
      dom.adminTools.classList.add("hidden");
      if (dom.adminActiveIndicator) dom.adminActiveIndicator.classList.add("hidden");
      setStatus(dom.adminStatus, "Invalid admin key.", "error");
      return;
    }
    state.adminPanel.verified = true;
    state.adminKey = adminKey;
    dom.adminTools.classList.remove("hidden");
    if (dom.adminActiveIndicator) dom.adminActiveIndicator.classList.remove("hidden");
    setStatus(dom.adminStatus, "Admin verified.", "success");
  } catch (err) {
    setStatus(dom.adminStatus, `Admin verification failed: ${err.message}`, "error");
  }
}

async function loadAdminData() {
  if (!state.adminPanel.verified || !state.adminKey) {
    setStatus(dom.adminStatus, "Verify admin key first.", "error");
    return;
  }
  try {
    const [configRes, cohortRes] = await Promise.all([
      apiRequest(`/api/admin/access-config?adminKey=${encodeURIComponent(state.adminKey)}`),
      apiRequest(`/api/admin/cohorts?adminKey=${encodeURIComponent(state.adminKey)}`)
    ]);

    dom.adminTraineeCode.value = String(configRes.traineeAccessCode || "");
    dom.adminTrainerKey.value = String(configRes.trainerKey || "");
    dom.adminTrialLimit.value = String(configRes.trialQuestionLimit || state.accessConfig.trialQuestionLimit || 20);
    dom.adminTraineeActive.value = configRes.traineeAccessActive === false ? "false" : "true";
    dom.adminTraineeExpiry.value = toDateInputValue(configRes.traineeAccessExpiresAt);
    state.adminPanel.cohorts = Array.isArray(cohortRes.cohorts) ? cohortRes.cohorts : [];
    renderCohortUI();
    renderAnalyticsCohorts(state.adminPanel.cohorts);
    await loadBlueprintTemplates();
    setStatus(dom.adminStatus, "Admin data loaded.", "success");
  } catch (err) {
    setStatus(dom.adminStatus, `Could not load admin data: ${err.message}`, "error");
  }
}

async function saveAccessConfig() {
  if (!state.adminPanel.verified || !state.adminKey) {
    setStatus(dom.accessConfigStatus, "Verify admin key first.", "error");
    return;
  }

  const traineeAccessCode = dom.adminTraineeCode.value.trim();
  const trainerKey = dom.adminTrainerKey.value.trim();
  const trialQuestionLimit = Math.max(1, Number(dom.adminTrialLimit.value || state.accessConfig.trialQuestionLimit || 20));
  const traineeAccessActive = dom.adminTraineeActive.value !== "false";
  const traineeAccessExpiresAt = toEpochFromDateInput(dom.adminTraineeExpiry.value);

  try {
    await apiRequest("/api/admin/access-config", "POST", {
      adminKey: state.adminKey,
      traineeAccessCode,
      trainerKey,
      traineeAccessActive,
      traineeAccessExpiresAt,
      trialQuestionLimit
    });
    await loadPublicAccessConfig();
    setStatus(dom.accessConfigStatus, "Access settings saved.", "success");
  } catch (err) {
    setStatus(dom.accessConfigStatus, `Could not save settings: ${err.message}`, "error");
  }
}

async function createCohortFromForm() {
  if (!state.adminPanel.verified || !state.adminKey) {
    setStatus(dom.cohortStatus, "Verify admin key first.", "error");
    return;
  }

  const name = dom.cohortNameInput.value.trim();
  const accessCode = dom.cohortCodeInput.value.trim();
  const questionLimit = Math.max(1, Number(dom.cohortLimitInput.value || 1000000));
  const expiresAt = toEpochFromDateInput(dom.cohortExpiryInput.value);
  if (!name || !accessCode) {
    setStatus(dom.cohortStatus, "Cohort name and access code are required.", "error");
    return;
  }

  try {
    await apiRequest("/api/admin/cohorts", "POST", {
      adminKey: state.adminKey,
      name,
      accessCode,
      questionLimit,
      isActive: dom.cohortActiveInput.value !== "false",
      expiresAt
    });
    dom.cohortNameInput.value = "";
    dom.cohortCodeInput.value = "";
    dom.cohortLimitInput.value = "";
    dom.cohortExpiryInput.value = "";
    await loadAdminData();
    setStatus(dom.cohortStatus, "Cohort created.", "success");
  } catch (err) {
    setStatus(dom.cohortStatus, `Could not create cohort: ${err.message}`, "error");
  }
}

async function updateSelectedCohortFromForm() {
  if (!state.adminPanel.verified || !state.adminKey) {
    setStatus(dom.cohortStatus, "Verify admin key first.", "error");
    return;
  }
  const cohortId = dom.cohortSelect.value;
  if (!cohortId) {
    setStatus(dom.cohortStatus, "Select a cohort to update.", "error");
    return;
  }

  const name = dom.cohortNameInput.value.trim();
  const accessCode = dom.cohortCodeInput.value.trim();
  const questionLimit = Math.max(1, Number(dom.cohortLimitInput.value || 1000000));
  const isActive = dom.cohortActiveInput.value !== "false";
  const expiresAt = toEpochFromDateInput(dom.cohortExpiryInput.value);
  if (!name || !accessCode) {
    setStatus(dom.cohortStatus, "Cohort name and access code are required.", "error");
    return;
  }

  try {
    await apiRequest("/api/admin/cohorts", "POST", {
      adminKey: state.adminKey,
      cohortId,
      name,
      accessCode,
      questionLimit,
      isActive,
      expiresAt
    });
    await loadAdminData();
    setStatus(dom.cohortStatus, "Cohort updated.", "success");
  } catch (err) {
    setStatus(dom.cohortStatus, `Could not update cohort: ${err.message}`, "error");
  }
}

async function enrollSelectedCohortMember() {
  if (!state.adminPanel.verified || !state.adminKey) {
    setStatus(dom.enrollStatus, "Verify admin key first.", "error");
    return;
  }
  const cohortId = dom.cohortSelect.value;
  const email = dom.memberEmailInput.value.trim();
  const name = dom.memberNameInput.value.trim();
  const phone = dom.memberPhoneInput.value.trim();
  const isActive = dom.memberActiveInput.value !== "false";
  const expiresAt = toEpochFromDateInput(dom.memberExpiryInput.value);

  if (!cohortId || !email) {
    setStatus(dom.enrollStatus, "Select cohort and enter member email.", "error");
    return;
  }

  try {
    await apiRequest("/api/admin/cohorts/enroll", "POST", {
      adminKey: state.adminKey,
      cohortId,
      email,
      name,
      phone,
      isActive,
      expiresAt
    });
    dom.memberNameInput.value = "";
    dom.memberEmailInput.value = "";
    dom.memberPhoneInput.value = "";
    dom.memberExpiryInput.value = "";
    dom.memberActiveInput.value = "true";
    await loadAdminData();
    setStatus(dom.enrollStatus, "Member enrolled/updated.", "success");
  } catch (err) {
    setStatus(dom.enrollStatus, `Could not enroll member: ${err.message}`, "error");
  }
}

function bindEvents() {
  if (bindEvents.done) return;
  bindEvents.done = true;
  if (dom.roleSelect) dom.roleSelect.addEventListener("change", () => {
    state.role = dom.roleSelect.value;
    if (state.role !== "trainer") state.trainerKeyVerified = false;
    updateRoleUI();
    saveLocal();
  });

  if (dom.startBtn) dom.startBtn.addEventListener("click", startSession);
  if (dom.endSessionBtn) dom.endSessionBtn.addEventListener("click", endSession);
  if (dom.checkBtn) dom.checkBtn.addEventListener("click", validateCurrentAnswer);
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

  if (dom.refreshImportReviewBtn) dom.refreshImportReviewBtn.addEventListener("click", loadImportReviewQueue);
  if (dom.resolveAllImportReviewBtn) dom.resolveAllImportReviewBtn.addEventListener("click", resolveAllImportReviewItems);
  if (dom.exportImportReviewBtn) dom.exportImportReviewBtn.addEventListener("click", exportImportReviewQueueCsv);
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
  if (dom.saveAccessConfigBtn) dom.saveAccessConfigBtn.addEventListener("click", saveAccessConfig);
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
  if (dom.exportReportBtn) dom.exportReportBtn.addEventListener("click", exportPdfReport);

  if (dom.unlockAccessBtn) dom.unlockAccessBtn.addEventListener("click", () => {
    openWhatsAppCta(
      "Hello, I have completed the trial and would like to request full access to the complete training program.",
      "cta_unlock_full_access_click"
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
}

async function init() {
  loadLocal();
  bindEvents(); // Bind listeners immediately so buttons work even if data loads slowly

  state.session.isActive = false;
  state.session.isActive = false;
  state.trainerKeyVerified = false;
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
  dom.cohortActiveInput.value = "true";
  dom.cohortExpiryInput.value = "";
  dom.memberActiveInput.value = "true";
  dom.memberExpiryInput.value = "";
  dom.weakDrillToggle.checked = state.weakDrillEnabled;
  dom.examQuestionCount.value = String(state.examConfig.questionCount);
  dom.examDuration.value = String(state.examConfig.durationMinutes);
  dom.examPassThreshold.value = String(state.examConfig.passThreshold || 80);
  dom.examStrictTiming.checked = state.examConfig.strictTiming !== false;
  dom.floatingWhatsappBtn.href = buildWhatsappLink(
    "Hello, I have completed the trial and would like to request full access to the complete training program."
  );
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

  // Show target
  if (subTab === "users") document.getElementById("subview-users").classList.remove("hidden");
  else if (subTab === "kpi") document.getElementById("subview-kpi").classList.remove("hidden");
  else if (subTab === "tools") document.getElementById("subview-tools").classList.remove("hidden");
}

function updateDashboardWidgets() {
  // 1. Active Students: Count rows in session table (excluding "No sessions")
  const sessionRows = document.querySelectorAll("#sessionTableBody tr");
  let studentCount = 0;
  if (sessionRows.length > 0 && !sessionRows[0].innerText.includes("No sessions")) {
    studentCount = sessionRows.length;
  }
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

// Initialize Sub-Nav Listeners
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded, initializing app...");

  // Sub-nav for Mentor Dashboard
  document.querySelectorAll(".sub-nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      handleMentorSubTab(btn.dataset.subtab);
    });
  });

  // Start App
  if (typeof init === "function") {
    init().catch(err => {
      console.error("App init failed:", err);
      alert(`App initialization error: ${err.message}`);
    });
  }
});
