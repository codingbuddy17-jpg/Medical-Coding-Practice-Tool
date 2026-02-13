const STORAGE_KEY = "medcode_flashcards_role_v4";
const TRIAL_QUESTION_LIMIT = 20;

const CATEGORY_OPTIONS = [
  { key: "ALL", label: "All Tags" },
  { key: "ICD-10-CM", label: "ICD 10 CM" },
  { key: "ICD-10-PCS", label: "ICD 10 PCS" },
  { key: "CPT", label: "CPT" },
  { key: "MODIFIERS", label: "Modifiers" },
  { key: "GUIDELINES", label: "Guidelines" }
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

const STARTER_DECK = [
  { tag: "ICD-10-CM", question: "Type 2 diabetes mellitus without complications", answer: "E11.9" },
  { tag: "ICD-10-CM", question: "Essential (primary) hypertension", answer: "I10" },
  { tag: "ICD-10-PCS", question: "Resection of liver, open approach pattern starts with:", answer: "0F" },
  { tag: "CPT", question: "Office/outpatient E/M visit for established patient (moderate complexity)", answer: "99214" },
  { tag: "CPT", question: "Electrocardiogram routine ECG with interpretation and report", answer: "93000" },
  { tag: "Modifiers", question: "Significant, separately identifiable E/M service by same physician", answer: "Modifier -25|-25|25" },
  { tag: "Guidelines", question: "Multiple coding conventions and chapter-specific notes are part of:", answer: "ICD-10-CM guidelines|official coding guidelines" }
];

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
  selectedTag: "ALL",
  weakDrillEnabled: false,
  examConfig: {
    questionCount: 30,
    durationMinutes: 30
  },
  currentCardIndex: 0,
  deck: [],
  resources: [],
  session: {
    id: null,
    startedAt: null,
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
    wrong: 0
  },
  awaitingNext: false,
  studyOrder: {
    queues: {},
    cursors: {}
  }
};

const dom = {
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

  correctCount: document.getElementById("correctCount"),
  wrongCount: document.getElementById("wrongCount"),
  attemptedCount: document.getElementById("attemptedCount"),
  sessionScore: document.getElementById("sessionScore"),

  categoryButtons: document.getElementById("categoryButtons"),
  categoryStatus: document.getElementById("categoryStatus"),
  weakDrillToggle: document.getElementById("weakDrillToggle"),
  examQuestionCount: document.getElementById("examQuestionCount"),
  examDuration: document.getElementById("examDuration"),
  toggleExamPanelBtn: document.getElementById("toggleExamPanelBtn"),
  examPanel: document.getElementById("examPanel"),
  startExamBtn: document.getElementById("startExamBtn"),
  stopExamBtn: document.getElementById("stopExamBtn"),
  examStatus: document.getElementById("examStatus"),
  examTimer: document.getElementById("examTimer"),

  resourceList: document.getElementById("resourceList"),
  resourceManager: document.getElementById("resourceManager"),
  resourceTitle: document.getElementById("resourceTitle"),
  resourceUrl: document.getElementById("resourceUrl"),
  addResourceBtn: document.getElementById("addResourceBtn"),
  resourceStatus: document.getElementById("resourceStatus"),

  cardTag: document.getElementById("cardTag"),
  cardPrompt: document.getElementById("cardPrompt"),
  userAnswer: document.getElementById("userAnswer"),
  checkBtn: document.getElementById("checkBtn"),
  nextBtn: document.getElementById("nextBtn"),
  feedback: document.getElementById("feedback"),
  rationalePlaceholder: document.getElementById("rationalePlaceholder"),
  trialLockNotice: document.getElementById("trialLockNotice"),

  categoryScoreBody: document.getElementById("categoryScoreBody"),

  trainerZone: document.getElementById("trainerZone"),
  csvFileInput: document.getElementById("csvFileInput"),
  importFileBtn: document.getElementById("importFileBtn"),
  csvInput: document.getElementById("csvInput"),
  importBtn: document.getElementById("importBtn"),
  loadStarterBtn: document.getElementById("loadStarterBtn"),
  exportBtn: document.getElementById("exportBtn"),
  importStatus: document.getElementById("importStatus"),

  refreshSessionsBtn: document.getElementById("refreshSessionsBtn"),
  sessionTableBody: document.getElementById("sessionTableBody"),
  sessionLoadStatus: document.getElementById("sessionLoadStatus")
};

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
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

function normalizeTagKey(tag) {
  const cleaned = String(tag || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  if (cleaned.includes("ICD10CM")) return "ICD-10-CM";
  if (cleaned.includes("ICD10PCS")) return "ICD-10-PCS";
  if (cleaned.includes("CPT")) return "CPT";
  if (cleaned.includes("MODIFIER")) return "MODIFIERS";
  if (cleaned.includes("GUIDELINE")) return "GUIDELINES";
  return "OTHER";
}

function sanitizeUrl(url) {
  const trimmed = String(url || "").trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function isTrialUser() {
  return state.role === "trial";
}

function hasTrialLimitReached() {
  return isTrialUser() && state.session.attempted >= TRIAL_QUESTION_LIMIT;
}

function updateTrialLockUI() {
  if (hasTrialLimitReached()) {
    dom.userAnswer.disabled = true;
    dom.checkBtn.disabled = true;
    dom.nextBtn.disabled = true;
    dom.trialLockNotice.classList.remove("hidden");
    dom.trialLockNotice.textContent =
      "Trial complete (20 questions). Contact Admin for full access. Contact or WhatsApp at +91 8309661352.";
    return;
  }

  dom.userAnswer.disabled = false;
  dom.trialLockNotice.classList.add("hidden");
  dom.trialLockNotice.textContent = "";
}

function hydrateCards(cards) {
  return cards.map((card, index) => ({
    id: card.id || `${normalizeTagKey(card.tag)}_${index}_${uid("card")}`,
    tag: (card.tag || "General").trim(),
    question: String(card.question || "").trim(),
    answer: String(card.answer || "").trim()
  }));
}

function saveLocal() {
  const payload = {
    role: state.role,
    userName: state.userName,
    userEmail: state.userEmail,
    userPhone: state.userPhone,
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
    state.userName = parsed.userName || "";
    state.userEmail = parsed.userEmail || "";
    state.userPhone = parsed.userPhone || "";
    state.deck = Array.isArray(parsed.deck) && parsed.deck.length > 0 ? hydrateCards(parsed.deck) : hydrateCards(STARTER_DECK);
    state.resources = Array.isArray(parsed.resources) && parsed.resources.length > 0 ? parsed.resources : [...DEFAULT_RESOURCES];
    state.selectedTag = CATEGORY_OPTIONS.some((item) => item.key === parsed.selectedTag) ? parsed.selectedTag : "ALL";
    state.weakDrillEnabled = Boolean(parsed.weakDrillEnabled);
    state.examConfig.questionCount = Number(parsed.examConfig?.questionCount) || 30;
    state.examConfig.durationMinutes = Number(parsed.examConfig?.durationMinutes) || 30;
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

function checkAnswer(userInput, expectedAnswer) {
  const answers = splitAnswers(expectedAnswer);
  const userNorm = normalize(userInput);
  const matched = answers.some((option) => userNorm === normalize(option));

  return {
    isCorrect: matched,
    primaryAnswer: answers[0] || expectedAnswer,
    acceptedAnswers: answers
  };
}

function matchesSelectedTag(card) {
  if (state.selectedTag === "ALL") return true;
  return normalizeTagKey(card.tag) === state.selectedTag;
}

function filteredDeck() {
  return state.deck.filter(matchesSelectedTag);
}

function getCardsForTag(tagKey) {
  if (tagKey === "ALL") return [...state.deck];
  return state.deck.filter((card) => normalizeTagKey(card.tag) === tagKey);
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
    return `<button type="button" class="tag-btn ${activeClass}" data-tag="${item.key}">${item.label}</button>`;
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
      return `
        <li class="resource-item">
          <a class="resource-link" href="${item.url}" target="_blank" rel="noopener noreferrer">${item.title}</a>
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
    rows.push(`<tr><td>${key}</td><td>${s.attempted}</td><td>${s.correct}</td><td>${s.wrong}</td><td>${formatPercent(s.correct, s.attempted)}</td></tr>`);
  });

  const other = stats.OTHER || { attempted: 0, correct: 0, wrong: 0 };
  if (other.attempted > 0) {
    rows.push(`<tr><td>OTHER</td><td>${other.attempted}</td><td>${other.correct}</td><td>${other.wrong}</td><td>${formatPercent(other.correct, other.attempted)}</td></tr>`);
  }

  dom.categoryScoreBody.innerHTML = rows.join("");
}

function updateRoleUI() {
  const isTrainer = state.role === "trainer";
  const isTrainee = state.role === "trainee";
  dom.trainerZone.classList.toggle("hidden", !isTrainer);
  dom.resourceManager.classList.toggle("hidden", !isTrainer);
  dom.traineeCodeWrap.classList.toggle("hidden", !isTrainee);
  dom.trainerKeyWrap.classList.toggle("hidden", !isTrainer);
  dom.importStatus.textContent = "";
  dom.sessionLoadStatus.textContent = "";
  renderResources();
  updateTrialLockUI();
}

function updateMetrics() {
  const { correct, wrong, attempted } = state.session;
  const score = attempted === 0 ? 0 : Math.round((correct / attempted) * 100);

  dom.correctCount.textContent = String(correct);
  dom.wrongCount.textContent = String(wrong);
  dom.attemptedCount.textContent = String(attempted);
  dom.sessionScore.textContent = `${score}%`;
}

function updateExamStatusUI() {
  if (!state.exam.inProgress) {
    dom.examTimer.textContent = "Time left: --:--";
    return;
  }

  const total = state.exam.queueIds.length;
  const answered = state.exam.answered;
  setStatus(dom.examStatus, `Exam running: ${answered}/${total} answered.`);
  const mm = String(Math.floor(state.exam.remainingSeconds / 60)).padStart(2, "0");
  const ss = String(state.exam.remainingSeconds % 60).padStart(2, "0");
  dom.examTimer.textContent = `Time left: ${mm}:${ss}`;
}

function setAwaitingNext(value) {
  state.awaitingNext = value;
  dom.checkBtn.disabled = value || hasTrialLimitReached();
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
    setStatus(dom.feedback, "");
    setAwaitingNext(false);
    updateTrialLockUI();
    dom.categoryStatus.textContent = `Showing 0 cards for ${state.selectedTag}.`;
    return;
  }

  if (hasTrialLimitReached()) {
    dom.cardTag.textContent = "Trial Complete";
    dom.cardPrompt.textContent =
      "You have completed your 20-question trial. Contact Admin for full access. Contact or WhatsApp at +91 8309661352.";
    dom.userAnswer.value = "";
    setStatus(dom.feedback, "");
    setStatus(dom.rationalePlaceholder, "Unlock full access to continue practicing all questions.");
    setAwaitingNext(false);
    updateTrialLockUI();
    dom.categoryStatus.textContent = "Trial locked. Upgrade required for full question bank access.";
    return;
  }

  dom.cardTag.textContent = card.tag;
  dom.cardPrompt.textContent = card.question;
  dom.userAnswer.value = "";
  setStatus(dom.feedback, "");
  setStatus(dom.rationalePlaceholder, "Rationale section reserved for future explanation details.");
  setAwaitingNext(false);
  updateTrialLockUI();

  if (state.exam.inProgress) {
    dom.categoryStatus.textContent = `Exam mode: ${state.exam.answered}/${state.exam.queueIds.length} answered.`;
  } else {
    dom.categoryStatus.textContent = `Showing ${cards.length} cards for ${state.selectedTag}.`;
  }

  dom.userAnswer.focus();
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

  if (reason === "time") {
    setStatus(dom.examStatus, `Time up. Exam finished with ${score}% score.`, "error");
  } else if (reason === "completed") {
    setStatus(dom.examStatus, `Exam completed. Final score: ${score}%.`, "success");
  } else {
    setStatus(dom.examStatus, `Exam stopped. Current score: ${score}%.`);
  }

  state.exam.inProgress = false;
  state.exam.queueIds = [];
  state.exam.cursor = 0;
  state.exam.remainingSeconds = 0;
  state.exam.answered = 0;
  state.exam.correct = 0;
  state.exam.wrong = 0;
  state.currentCardIndex = 0;
  state.awaitingNext = false;

  updateExamStatusUI();
  renderCard();
}

function startExamTimer() {
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

function startExam() {
  if (!state.session.isActive) {
    setStatus(dom.examStatus, "Start session before exam mode.", "error");
    return;
  }

  if (hasTrialLimitReached()) {
    setStatus(dom.examStatus, "Trial limit reached. Contact Admin for full access.", "error");
    return;
  }

  const source = filteredDeck();
  if (!source.length) {
    setStatus(dom.examStatus, "No cards available for selected category.", "error");
    return;
  }

  const requested = Number(dom.examQuestionCount.value) || state.examConfig.questionCount;
  const minutes = Number(dom.examDuration.value) || state.examConfig.durationMinutes;
  const total = Math.min(requested, source.length);

  const queue = shuffledCopy(source)
    .slice(0, total)
    .map((card) => card.id);

  state.exam.inProgress = true;
  state.exam.queueIds = queue;
  state.exam.cursor = 0;
  state.exam.remainingSeconds = minutes * 60;
  state.exam.answered = 0;
  state.exam.correct = 0;
  state.exam.wrong = 0;

  state.examConfig.questionCount = requested;
  state.examConfig.durationMinutes = minutes;

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
  const options = { method, headers: {} };
  if (payload) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(payload);
  }

  const response = await fetch(path, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  return response.json();
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
      const verification = await apiRequest("/api/access/verify", "POST", { code: traineeCode });
      if (!verification.valid) {
        setStatus(dom.sessionStatus, "Invalid trainee access code.", "error");
        return;
      }
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
  state.currentCardIndex = 0;
  state.session.id = uid("session");
  state.session.startedAt = Date.now();
  state.session.isActive = true;
  state.awaitingNext = false;
  resetSessionTracking();

  try {
    const session = await apiRequest("/api/session/start", "POST", {
      sessionId: state.session.id,
      userName,
      userEmail,
      userPhone,
      role
    });
    state.session.id = session.id || state.session.id;
    setStatus(dom.sessionStatus, `Session started for ${userName}.`, "success");
  } catch {
    setStatus(dom.sessionStatus, "Session started locally (backend unavailable).", "error");
  }

  updateRoleUI();
  updateMetrics();
  setStatus(dom.examStatus, "Exam mode inactive.");
  updateExamStatusUI();
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
  if (!state.session.isActive) {
    setStatus(dom.feedback, "Start a session first.", "error");
    return;
  }

  if (hasTrialLimitReached()) {
    updateTrialLockUI();
    setStatus(dom.feedback, "Trial complete. Contact Admin for full access.", "error");
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

  const typed = dom.userAnswer.value.trim();
  if (!typed) {
    setStatus(dom.feedback, "Enter an answer before checking.", "error");
    return;
  }

  const result = checkAnswer(typed, card.answer);
  state.session.attempted += 1;

  if (result.isCorrect) {
    state.session.correct += 1;
    if (state.exam.inProgress) state.exam.correct += 1;
    setStatus(dom.feedback, `Correct. Expected: ${result.primaryAnswer}`, "success");
  } else {
    state.session.wrong += 1;
    if (state.exam.inProgress) state.exam.wrong += 1;
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
    userAnswer: typed,
    isCorrect: result.isCorrect,
    at: Date.now()
  });
  setAwaitingNext(true);
}

function nextQuestion() {
  if (!state.awaitingNext) {
    setStatus(dom.feedback, "Use Check first, then click Next.");
    return;
  }

  if (hasTrialLimitReached()) {
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

function parseCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const rows = lines.map(parseCsvLine);
  const startAt = rows[0][0]?.toLowerCase() === "tag" ? 1 : 0;

  return rows.slice(startAt).map((row) => ({
    tag: row[0] || "General",
    question: row[1] || "",
    answer: row[2] || ""
  }));
}

function importParsedCards(parsed) {
  state.deck = hydrateCards(parsed);
  resetStudyOrder();
  setStatus(dom.importStatus, `Imported ${parsed.length} cards.`, "success");
  renderCard();
  saveLocal();
}

function importCsv() {
  if (state.role !== "trainer") return;

  const parsed = parseCsv(dom.csvInput.value).filter((r) => r.question && r.answer);
  if (!parsed.length) {
    setStatus(dom.importStatus, "No valid cards. Use tag,question,answer format.", "error");
    return;
  }

  importParsedCards(parsed);
}

async function importCsvFile() {
  if (state.role !== "trainer") return;
  const file = dom.csvFileInput.files?.[0];

  if (!file) {
    setStatus(dom.importStatus, "Choose a CSV file first.", "error");
    return;
  }

  try {
    const text = await file.text();
    const parsed = parseCsv(text).filter((r) => r.question && r.answer);
    if (!parsed.length) {
      setStatus(dom.importStatus, "File has no valid cards.", "error");
      return;
    }
    dom.csvInput.value = text;
    importParsedCards(parsed);
  } catch {
    setStatus(dom.importStatus, "Could not read CSV file.", "error");
  }
}

function loadStarterDeck() {
  if (state.role !== "trainer") return;
  state.deck = hydrateCards(STARTER_DECK);
  resetStudyOrder();
  setStatus(dom.importStatus, "Starter deck loaded.", "success");
  renderCard();
  saveLocal();
}

function exportCsv() {
  if (state.role !== "trainer") return;
  if (!state.deck.length) {
    setStatus(dom.importStatus, "Deck is empty.", "error");
    return;
  }

  const header = "tag,question,answer";
  const rows = state.deck.map((card) =>
    [card.tag, card.question, card.answer]
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
    const sessions = data.sessions || [];

    if (!sessions.length) {
      dom.sessionTableBody.innerHTML = '<tr><td colspan="6">No sessions found.</td></tr>';
      setStatus(dom.sessionLoadStatus, "No sessions available.");
      return;
    }

    dom.sessionTableBody.innerHTML = sessions
      .map((s) => {
        const attempted = s.summary?.attempted || 0;
        const correct = s.summary?.correct || 0;
        const wrong = s.summary?.wrong || 0;
        const score = attempted ? Math.round((correct / attempted) * 100) : 0;
        const started = new Date(s.startedAt).toLocaleString();
        return `<tr><td>${s.userName}</td><td>${s.role}</td><td>${correct}</td><td>${wrong}</td><td>${score}%</td><td>${started}</td></tr>`;
      })
      .join("");

    setStatus(dom.sessionLoadStatus, `Loaded ${sessions.length} sessions.`, "success");
  } catch (err) {
    setStatus(dom.sessionLoadStatus, `Could not load sessions: ${err.message}`, "error");
  }
}

function bindEvents() {
  dom.roleSelect.addEventListener("change", () => {
    state.role = dom.roleSelect.value;
    updateRoleUI();
    saveLocal();
  });

  dom.startBtn.addEventListener("click", startSession);
  dom.endSessionBtn.addEventListener("click", endSession);
  dom.checkBtn.addEventListener("click", validateCurrentAnswer);
  dom.nextBtn.addEventListener("click", nextQuestion);

  dom.categoryButtons.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-tag]");
    if (!btn) return;
    setSelectedTag(btn.dataset.tag);
  });

  dom.weakDrillToggle.addEventListener("change", (event) => {
    state.weakDrillEnabled = event.target.checked;
    saveLocal();
  });

  dom.examQuestionCount.addEventListener("change", () => {
    state.examConfig.questionCount = Number(dom.examQuestionCount.value) || 30;
    saveLocal();
  });

  dom.examDuration.addEventListener("change", () => {
    state.examConfig.durationMinutes = Number(dom.examDuration.value) || 30;
    saveLocal();
  });

  dom.toggleExamPanelBtn.addEventListener("click", () => {
    dom.examPanel.classList.toggle("hidden");
  });

  dom.startExamBtn.addEventListener("click", startExam);
  dom.stopExamBtn.addEventListener("click", stopExam);

  dom.addResourceBtn.addEventListener("click", addResource);
  dom.resourceList.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-remove-resource]");
    if (!btn) return;
    removeResource(Number(btn.dataset.removeResource));
  });

  dom.importFileBtn.addEventListener("click", importCsvFile);
  dom.importBtn.addEventListener("click", importCsv);
  dom.loadStarterBtn.addEventListener("click", loadStarterDeck);
  dom.exportBtn.addEventListener("click", exportCsv);
  dom.refreshSessionsBtn.addEventListener("click", loadSessions);

  dom.csvFileInput.addEventListener("change", async () => {
    const file = dom.csvFileInput.files?.[0];
    if (!file) return;
    try {
      dom.csvInput.value = await file.text();
    } catch {
      // fallback: manual paste
    }
  });

  dom.userAnswer.addEventListener("keydown", (event) => {
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

function init() {
  loadLocal();
  dom.userName.value = state.userName;
  dom.userEmail.value = state.userEmail;
  dom.userPhone.value = state.userPhone;
  dom.roleSelect.value = state.role;
  dom.traineeCode.value = "";
  dom.trainerKey.value = "";
  dom.weakDrillToggle.checked = state.weakDrillEnabled;
  dom.examQuestionCount.value = String(state.examConfig.questionCount);
  dom.examDuration.value = String(state.examConfig.durationMinutes);

  renderCategoryButtons();
  renderResources();
  updateRoleUI();
  updateMetrics();
  renderCategoryScorecards();
  setStatus(dom.examStatus, "Exam mode inactive.");
  updateExamStatusUI();
  renderCard();
  setAwaitingNext(false);
  bindEvents();
}

init();
