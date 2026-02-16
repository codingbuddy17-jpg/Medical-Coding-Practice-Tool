const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { createClient } = require("@supabase/supabase-js");

const PORT = process.env.PORT || 4173;
const HOST = process.env.HOST || "0.0.0.0";
const TRAINER_KEY = process.env.TRAINER_KEY || "";
const TRAINEE_ACCESS_CODE = process.env.TRAINEE_ACCESS_CODE || "";
const ADMIN_KEY = process.env.ADMIN_KEY || "";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

const supabase = USE_SUPABASE
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  })
  : null;

const ROOT = __dirname;
const MAX_BODY_SIZE = Number(process.env.MAX_BODY_SIZE || 10 * 1024 * 1024); // 10MB default
const DATA_DIR = path.join(ROOT, "data");
const SESSION_FILE = path.join(DATA_DIR, "sessions.json");
const QUESTIONS_FILE = path.join(DATA_DIR, "questions.json");
const ACCESS_FILE = path.join(DATA_DIR, "access-config.json");
const COHORTS_FILE = path.join(DATA_DIR, "cohorts.json");
const EXAMS_FILE = path.join(DATA_DIR, "exam-blueprints.json");
const FLAGS_FILE = path.join(DATA_DIR, "question-flags.json");
const CTA_FILE = path.join(DATA_DIR, "cta-events.json");
const IMPORT_REVIEWS_FILE = path.join(DATA_DIR, "import-reviews.json");
const IMPORT_BATCHES_FILE = path.join(DATA_DIR, "import-batches.json");

const DEFAULT_EXAM_TEMPLATES = [
  {
    id: "icd-heavy",
    name: "ICD-Heavy Mock",
    tags: ["ICD-10-CM", "ICD-10-PCS", "GUIDELINES"],
    questionCount: 50,
    durationMinutes: 45,
    passThreshold: 80,
    strictTiming: true
  },
  {
    id: "cpt-heavy",
    name: "CPT-Heavy Mock",
    tags: ["CPT", "MODIFIERS", "GUIDELINES"],
    questionCount: 50,
    durationMinutes: 45,
    passThreshold: 80,
    strictTiming: true
  },
  {
    id: "mixed-final",
    name: "Mixed Final Mock",
    tags: ["ICD-10-CM", "ICD-10-PCS", "CPT", "MODIFIERS", "GUIDELINES", "CCS", "CPC", "CDIP", "SURGERY-CODING", "IP-DRG-CODING"],
    questionCount: 100,
    durationMinutes: 60,
    passThreshold: 85,
    strictTiming: true
  }
];

function ensureDataStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SESSION_FILE)) fs.writeFileSync(SESSION_FILE, JSON.stringify({ sessions: [] }, null, 2));
  if (!fs.existsSync(QUESTIONS_FILE)) fs.writeFileSync(QUESTIONS_FILE, JSON.stringify({ questions: [] }, null, 2));
  if (!fs.existsSync(ACCESS_FILE)) {
    fs.writeFileSync(
      ACCESS_FILE,
      JSON.stringify(
        {
          trainerKey: TRAINER_KEY,
          traineeAccessCode: TRAINEE_ACCESS_CODE,
          trialQuestionLimit: 20,
          updatedAt: Date.now()
        },
        null,
        2
      )
    );
  }
  if (!fs.existsSync(COHORTS_FILE)) fs.writeFileSync(COHORTS_FILE, JSON.stringify({ cohorts: [] }, null, 2));
  if (!fs.existsSync(EXAMS_FILE)) {
    fs.writeFileSync(
      EXAMS_FILE,
      JSON.stringify({ templates: DEFAULT_EXAM_TEMPLATES, assignments: [] }, null, 2)
    );
  }
  if (!fs.existsSync(FLAGS_FILE)) fs.writeFileSync(FLAGS_FILE, JSON.stringify({ flags: [] }, null, 2));
  if (!fs.existsSync(CTA_FILE)) fs.writeFileSync(CTA_FILE, JSON.stringify({ events: [] }, null, 2));
  if (!fs.existsSync(IMPORT_REVIEWS_FILE)) fs.writeFileSync(IMPORT_REVIEWS_FILE, JSON.stringify({ items: [] }, null, 2));
  if (!fs.existsSync(IMPORT_BATCHES_FILE)) fs.writeFileSync(IMPORT_BATCHES_FILE, JSON.stringify({ batches: [] }, null, 2));
}

function readSessions() {
  ensureDataStore();
  const raw = fs.readFileSync(SESSION_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.sessions) ? parsed.sessions : [];
  } catch {
    return [];
  }
}

function writeSessions(sessions) {
  ensureDataStore();
  fs.writeFileSync(SESSION_FILE, JSON.stringify({ sessions }, null, 2));
}

function readQuestions() {
  ensureDataStore();
  const raw = fs.readFileSync(QUESTIONS_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.questions) ? parsed.questions : [];
  } catch {
    return [];
  }
}

function writeQuestions(questions) {
  ensureDataStore();
  fs.writeFileSync(QUESTIONS_FILE, JSON.stringify({ questions }, null, 2));
}

function readAccessConfig() {
  ensureDataStore();
  const raw = fs.readFileSync(ACCESS_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return {
      trainerKey: String(parsed.trainerKey || TRAINER_KEY || ""),
      traineeAccessCode: String(parsed.traineeAccessCode || TRAINEE_ACCESS_CODE || ""),
      traineeAccessActive: parsed.traineeAccessActive !== false,
      traineeAccessExpiresAt: parsed.traineeAccessExpiresAt ? Number(parsed.traineeAccessExpiresAt) : null,
      trialQuestionLimit: Number(parsed.trialQuestionLimit || 20),
      maxSessionQuestions: Number(parsed.maxSessionQuestions || 250),
      updatedAt: Number(parsed.updatedAt || Date.now())
    };
  } catch {
    return {
      trainerKey: TRAINER_KEY,
      traineeAccessCode: TRAINEE_ACCESS_CODE,
      traineeAccessActive: true,
      traineeAccessExpiresAt: null,
      trialQuestionLimit: 20,
      maxSessionQuestions: 250,
      updatedAt: Date.now()
    };
  }
}

function writeAccessConfig(config) {
  ensureDataStore();
  const payload = {
    trainerKey: String(config.trainerKey || ""),
    traineeAccessCode: String(config.traineeAccessCode || ""),
    traineeAccessActive: config.traineeAccessActive !== false,
    traineeAccessExpiresAt: config.traineeAccessExpiresAt ? Number(config.traineeAccessExpiresAt) : null,
    trialQuestionLimit: Math.max(1, Number(config.trialQuestionLimit || 20)),
    maxSessionQuestions: Math.max(1, Number(config.maxSessionQuestions || 250)),
    updatedAt: Date.now()
  };
  fs.writeFileSync(ACCESS_FILE, JSON.stringify(payload, null, 2));
  return payload;
}

function readCohorts() {
  ensureDataStore();
  const raw = fs.readFileSync(COHORTS_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.cohorts) ? parsed.cohorts : [];
  } catch {
    return [];
  }
}

function writeCohorts(cohorts) {
  ensureDataStore();
  fs.writeFileSync(COHORTS_FILE, JSON.stringify({ cohorts }, null, 2));
}

function readExamStore() {
  ensureDataStore();
  const raw = fs.readFileSync(EXAMS_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw);
    const templates = Array.isArray(parsed.templates) && parsed.templates.length ? parsed.templates : DEFAULT_EXAM_TEMPLATES;
    const assignments = Array.isArray(parsed.assignments) ? parsed.assignments : [];
    return { templates, assignments };
  } catch {
    return { templates: DEFAULT_EXAM_TEMPLATES, assignments: [] };
  }
}

function writeExamStore(store) {
  ensureDataStore();
  const payload = {
    templates: Array.isArray(store.templates) ? store.templates : DEFAULT_EXAM_TEMPLATES,
    assignments: Array.isArray(store.assignments) ? store.assignments : []
  };
  fs.writeFileSync(EXAMS_FILE, JSON.stringify(payload, null, 2));
  return payload;
}

function readFlags() {
  ensureDataStore();
  const raw = fs.readFileSync(FLAGS_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.flags) ? parsed.flags : [];
  } catch {
    return [];
  }
}

function writeFlags(flags) {
  ensureDataStore();
  fs.writeFileSync(FLAGS_FILE, JSON.stringify({ flags }, null, 2));
}

function readCtaEvents() {
  ensureDataStore();
  const raw = fs.readFileSync(CTA_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.events) ? parsed.events : [];
  } catch {
    return [];
  }
}

function writeCtaEvents(events) {
  ensureDataStore();
  fs.writeFileSync(CTA_FILE, JSON.stringify({ events }, null, 2));
}

function readImportReviews() {
  ensureDataStore();
  const raw = fs.readFileSync(IMPORT_REVIEWS_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

function writeImportReviews(items) {
  ensureDataStore();
  fs.writeFileSync(IMPORT_REVIEWS_FILE, JSON.stringify({ items }, null, 2));
}

function readImportBatches() {
  ensureDataStore();
  const raw = fs.readFileSync(IMPORT_BATCHES_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.batches) ? parsed.batches : [];
  } catch {
    return [];
  }
}

function writeImportBatches(batches) {
  ensureDataStore();
  fs.writeFileSync(IMPORT_BATCHES_FILE, JSON.stringify({ batches }, null, 2));
}

function sanitizeTemplate(input) {
  const id = String(input.id || "").trim();
  const name = String(input.name || "").trim();
  const tags = Array.isArray(input.tags)
    ? input.tags.map((t) => String(t || "").trim()).filter(Boolean)
    : [];
  const questionCount = Math.max(1, Number(input.questionCount || 30));
  const durationMinutes = Math.max(1, Number(input.durationMinutes || 30));
  const passThreshold = Math.min(100, Math.max(1, Number(input.passThreshold || 80)));
  const strictTiming = input.strictTiming !== false;
  if (!id) throw new Error("Template id is required");
  if (!name) throw new Error("Template name is required");
  if (!tags.length) throw new Error("At least one tag is required");
  return { id, name, tags, questionCount, durationMinutes, passThreshold, strictTiming };
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store, no-cache, must-revalidate"
  });
  res.end(body);
}

function notFound(res) {
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not found");
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY_SIZE) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".pdf") return "application/pdf";
  return "text/plain; charset=utf-8";
}

function serveFile(reqPath, res) {
  const safePath = reqPath === "/" ? "index.html" : reqPath.replace(/^\/+/, "");
  const filePath = path.resolve(ROOT, safePath);

  if (!filePath.startsWith(ROOT + path.sep)) return notFound(res);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return notFound(res);

  const data = fs.readFileSync(filePath);
  res.writeHead(200, { "Content-Type": contentType(filePath) });
  res.end(data);
}

function getAdminKey(req, url) {
  const auth = String(req.headers.authorization || "").trim();
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return String(url.searchParams.get("adminKey") || "");
}

function getTrainerKey(req, url) {
  const auth = String(req.headers.authorization || "").trim();
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return String(url.searchParams.get("trainerKey") || "");
}

function findSessionIndex(sessions, sessionId) {
  return sessions.findIndex((s) => s.id === sessionId);
}

function toIso(at) {
  return new Date(Number(at || Date.now())).toISOString();
}

function calcScore(correct, attempted) {
  return attempted ? Math.round((correct / attempted) * 100) : 0;
}

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

async function hasPriorTrialUsage({ email, phone }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);
  const rawPhone = String(phone || "").trim();
  if (!normalizedEmail && !normalizedPhone) return false;

  if (!USE_SUPABASE) {
    const sessions = readSessions();
    return sessions.some((session) => {
      if (String(session.role || "") !== "trial") return false;
      const sessionEmail = normalizeEmail(session.userEmail);
      const sessionPhone = normalizePhone(session.userPhone);
      if (normalizedEmail && sessionEmail && sessionEmail === normalizedEmail) return true;
      if (normalizedPhone && sessionPhone && sessionPhone === normalizedPhone) return true;
      return false;
    });
  }

  if (normalizedEmail) {
    const emailRes = await supabase
      .from("sessions")
      .select("session_id", { head: true, count: "exact" })
      .eq("role", "trial")
      .eq("user_email", normalizedEmail);
    if (emailRes.error) throw emailRes.error;
    if (Number(emailRes.count || 0) > 0) return true;
  }

  if (normalizedPhone) {
    const phoneRes = await supabase
      .from("sessions")
      .select("session_id", { head: true, count: "exact" })
      .eq("role", "trial")
      .eq("user_phone", normalizedPhone);
    if (phoneRes.error) throw phoneRes.error;
    if (Number(phoneRes.count || 0) > 0) return true;
  }

  if (rawPhone && rawPhone !== normalizedPhone) {
    const phoneRawRes = await supabase
      .from("sessions")
      .select("session_id", { head: true, count: "exact" })
      .eq("role", "trial")
      .eq("user_phone", rawPhone);
    if (phoneRawRes.error) throw phoneRawRes.error;
    if (Number(phoneRawRes.count || 0) > 0) return true;
  }

  return false;
}

function isAdminAuthorized(key) {
  const value = String(key || "");
  const config = readAccessConfig();
  const validAdmin = Boolean(ADMIN_KEY) && value === ADMIN_KEY;
  const validTrainer = Boolean(config.trainerKey) && value === config.trainerKey;
  return validAdmin || validTrainer;
}

function getPublicAccessConfig() {
  const config = readAccessConfig();
  return {
    trialQuestionLimit: Math.max(1, Number(config.trialQuestionLimit || 20)),
    maxSessionQuestions: Math.max(1, Number(config.maxSessionQuestions || 250)),
    contactMessage: "For full access, contact PracticeBuddy Lab by CodingBuddy360 on WhatsApp at +91 8309661352."
  };
}

function sanitizeCohortName(name) {
  return String(name || "").trim().slice(0, 120);
}

function sanitizeAccessCode(code) {
  return String(code || "")
    .trim()
    .slice(0, 120);
}

function normalizeExpiryTs(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function isExpired(expiryTs) {
  const ts = Number(expiryTs || 0);
  return ts > 0 && Date.now() > ts;
}

function listCohortsSummary() {
  return readCohorts().map((cohort) => ({
    id: cohort.id,
    name: cohort.name,
    accessCode: cohort.accessCode,
    isActive: Boolean(cohort.isActive),
    expiresAt: cohort.expiresAt ? Number(cohort.expiresAt) : null,
    questionLimit: Number(cohort.questionLimit || 1000000),
    memberCount: Array.isArray(cohort.members) ? cohort.members.length : 0,
    createdAt: Number(cohort.createdAt || Date.now()),
    updatedAt: Number(cohort.updatedAt || Date.now())
  }));
}

function createCohort({ name, accessCode, questionLimit, isActive, expiresAt }) {
  const cleanName = sanitizeCohortName(name);
  const cleanCode = sanitizeAccessCode(accessCode);
  const limit = Math.max(1, Number(questionLimit || 1000000));
  if (!cleanName) throw new Error("Cohort name is required");
  if (!cleanCode) throw new Error("Cohort access code is required");

  const cohorts = readCohorts();
  const exists = cohorts.some((c) => String(c.accessCode || "").toLowerCase() === cleanCode.toLowerCase());
  if (exists) throw new Error("Cohort access code already exists");

  const now = Date.now();
  const newCohort = {
    id: `cohort_${now}_${Math.random().toString(36).slice(2, 8)}`,
    name: cleanName,
    accessCode: cleanCode,
    questionLimit: limit,
    isActive: isActive !== false,
    expiresAt: normalizeExpiryTs(expiresAt),
    members: [],
    createdAt: now,
    updatedAt: now
  };
  cohorts.unshift(newCohort);
  writeCohorts(cohorts);
  return newCohort;
}

function updateCohort({ cohortId, name, accessCode, questionLimit, isActive, expiresAt }) {
  const cohorts = readCohorts();
  const idx = cohorts.findIndex((c) => c.id === cohortId);
  if (idx < 0) throw new Error("Cohort not found");

  if (name !== undefined) {
    const cleanName = sanitizeCohortName(name);
    if (!cleanName) throw new Error("Cohort name cannot be empty");
    cohorts[idx].name = cleanName;
  }

  if (accessCode !== undefined) {
    const cleanCode = sanitizeAccessCode(accessCode);
    if (!cleanCode) throw new Error("Access code cannot be empty");
    const duplicate = cohorts.some((c, cidx) => cidx !== idx && String(c.accessCode || "").toLowerCase() === cleanCode.toLowerCase());
    if (duplicate) throw new Error("Cohort access code already exists");
    cohorts[idx].accessCode = cleanCode;
  }

  if (questionLimit !== undefined) cohorts[idx].questionLimit = Math.max(1, Number(questionLimit || 1000000));
  if (isActive !== undefined) cohorts[idx].isActive = Boolean(isActive);
  if (expiresAt !== undefined) {
    cohorts[idx].expiresAt = normalizeExpiryTs(expiresAt);
  }
  cohorts[idx].updatedAt = Date.now();
  writeCohorts(cohorts);
  return cohorts[idx];
}

function enrollCohortMember({ cohortId, email, name, phone, isActive, expiresAt }) {
  const cohorts = readCohorts();
  const idx = cohorts.findIndex((c) => c.id === cohortId);
  if (idx < 0) throw new Error("Cohort not found");
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  if (!normalizedEmail) throw new Error("Member email is required");

  const members = Array.isArray(cohorts[idx].members) ? cohorts[idx].members : [];
  const existingIdx = members.findIndex((m) => String(m.email || "").toLowerCase() === normalizedEmail);
  const payload = {
    email: normalizedEmail,
    name: String(name || "").trim(),
    phone: String(phone || "").trim(),
    isActive: isActive !== false,
    expiresAt: normalizeExpiryTs(expiresAt),
    updatedAt: Date.now()
  };

  if (existingIdx >= 0) {
    members[existingIdx] = { ...members[existingIdx], ...payload };
  } else {
    members.push({ ...payload, createdAt: Date.now() });
  }

  cohorts[idx].members = members;
  cohorts[idx].updatedAt = Date.now();
  writeCohorts(cohorts);
  return cohorts[idx];
}

function findCohortByAccessCode(code) {
  const normalized = String(code || "")
    .trim()
    .toLowerCase();
  if (!normalized) return null;
  return readCohorts().find((c) => Boolean(c.isActive) && String(c.accessCode || "").trim().toLowerCase() === normalized) || null;
}

function dayKeyFromTs(ts) {
  const d = new Date(Number(ts || Date.now()));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildAttemptAnalytics(attempts, days) {
  const since = Date.now() - Math.max(1, Number(days || 30)) * 24 * 60 * 60 * 1000;
  const filtered = attempts.filter((a) => Number(a.at || 0) >= since);

  const byTagMap = new Map();
  const trendMap = new Map();

  for (const attempt of filtered) {
    const tag = String(attempt.cardTag || "General").trim() || "General";
    const isCorrect = Boolean(attempt.isCorrect);
    const isSkipped = Boolean(attempt.isSkipped);
    const day = dayKeyFromTs(attempt.at);

    const tagAgg = byTagMap.get(tag) || { tag, attempted: 0, correct: 0, wrong: 0, accuracy: 0 };
    if (!isSkipped) {
      tagAgg.attempted += 1;
      if (isCorrect) tagAgg.correct += 1;
      else tagAgg.wrong += 1;
      tagAgg.accuracy = tagAgg.attempted ? Math.round((tagAgg.correct / tagAgg.attempted) * 100) : 0;
    }
    byTagMap.set(tag, tagAgg);

    const dayAgg = trendMap.get(day) || { day, attempted: 0, correct: 0, wrong: 0, accuracy: 0 };
    if (!isSkipped) {
      dayAgg.attempted += 1;
      if (isCorrect) dayAgg.correct += 1;
      else dayAgg.wrong += 1;
      dayAgg.accuracy = dayAgg.attempted ? Math.round((dayAgg.correct / dayAgg.attempted) * 100) : 0;
    }
    trendMap.set(day, dayAgg);
  }

  const byTag = Array.from(byTagMap.values()).sort((a, b) => {
    if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
    return b.attempted - a.attempted;
  });
  const trend = Array.from(trendMap.values()).sort((a, b) => a.day.localeCompare(b.day));
  const attempted = filtered.filter((a) => !a.isSkipped).length;
  const correct = filtered.filter((a) => a.isCorrect && !a.isSkipped).length;
  const wrong = attempted - correct;

  return {
    summary: {
      attempted,
      correct,
      wrong,
      score: attempted ? Math.round((correct / attempted) * 100) : 0,
      days: Math.max(1, Number(days || 30))
    },
    byTag,
    trend
  };
}

function makeRecommendationFromAnalytics(analytics, maxTags = 3) {
  const weakTags = (analytics.byTag || [])
    .filter((row) => row.attempted >= 2)
    .filter((row) => row.accuracy < 85)
    .sort((a, b) => {
      if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
      return b.attempted - a.attempted;
    })
    .slice(0, maxTags);

  if (weakTags.length) return weakTags.map((row) => row.tag);
  return (analytics.byTag || []).slice(0, maxTags).map((row) => row.tag);
}

function shuffled(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

async function listAttemptsForEmails(emails, sinceTs) {
  const normalizedEmails = Array.from(
    new Set(
      (emails || [])
        .map((email) => normalizeEmail(email))
        .filter(Boolean)
    )
  );
  if (!normalizedEmails.length) return [];
  const sinceIso = new Date(Number(sinceTs || Date.now() - 30 * 24 * 60 * 60 * 1000)).toISOString();

  if (!USE_SUPABASE) {
    const sessions = readSessions().filter((s) => normalizedEmails.includes(normalizeEmail(s.userEmail)));
    const attempts = [];
    for (const session of sessions) {
      const answers = Array.isArray(session.answers) ? session.answers : [];
      for (const answer of answers) {
        const at = Number(answer.at || 0);
        if (at < Number(sinceTs || 0)) continue;
        attempts.push({
          cardTag: String(answer.cardTag || "General"),
          isCorrect: Boolean(answer.isCorrect),
          isSkipped: Boolean(answer.isSkipped || String(answer.userAnswer || "") === "[SKIPPED]"),
          at
        });
      }
    }
    return attempts;
  }

  const sessionsRes = await supabase
    .from("sessions")
    .select("session_id,user_email")
    .in("user_email", normalizedEmails)
    .gte("started_at", sinceIso)
    .limit(5000);
  if (sessionsRes.error) throw sessionsRes.error;
  const rows = sessionsRes.data || [];
  const sessionIds = rows.map((r) => r.session_id).filter(Boolean);
  if (!sessionIds.length) return [];

  const attemptsRes = await supabase
    .from("attempts")
    .select("session_id,card_tag,is_correct,user_answer,answered_at")
    .in("session_id", sessionIds)
    .gte("answered_at", sinceIso)
    .limit(20000);
  if (attemptsRes.error) throw attemptsRes.error;

  return (attemptsRes.data || []).map((row) => ({
    cardTag: String(row.card_tag || "General"),
    isCorrect: Boolean(row.is_correct),
    isSkipped: String(row.user_answer || "") === "[SKIPPED]",
    at: Date.parse(row.answered_at)
  }));
}

async function upsertUserAndEntitlement({ userName, userEmail, userPhone, role }) {
  if (!USE_SUPABASE || !userEmail) return;

  const roleValue = role === "trainer" ? "trainer" : role === "trainee" ? "trainee" : "trial";
  const access = readAccessConfig();
  const questionLimit = roleValue === "trial" ? Math.max(1, Number(access.trialQuestionLimit || 20)) : 1000000;

  const userPayload = {
    name: userName || "anonymous",
    email: normalizeEmail(userEmail),
    phone: normalizePhone(userPhone),
    role: roleValue
  };

  const { error: userError } = await supabase.from("users").upsert(userPayload, { onConflict: "email" });
  if (userError) throw userError;

  const entPayload = {
    email: normalizeEmail(userEmail),
    access_type: roleValue,
    question_limit: questionLimit
  };

  const { error: entError } = await supabase.from("entitlements").upsert(entPayload, { onConflict: "email" });
  if (entError) throw entError;
}

async function storageStartSession({ sessionId, userName, userEmail, userPhone, role }) {
  const normalizedEmail = normalizeEmail(userEmail);
  const normalizedPhone = normalizePhone(userPhone);

  if (!USE_SUPABASE) {
    const sessions = readSessions();
    if (findSessionIndex(sessions, sessionId) >= 0) return { id: sessionId, reused: true };

    sessions.unshift({
      id: sessionId,
      userName,
      userEmail: normalizedEmail,
      userPhone: normalizedPhone,
      role,
      startedAt: Date.now(),
      endedAt: null,
      answers: [],
      summary: { correct: 0, wrong: 0, attempted: 0, score: 0 }
    });
    writeSessions(sessions);
    return { id: sessionId };
  }

  const { data: existing, error: existingError } = await supabase
    .from("sessions")
    .select("session_id")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return { id: sessionId, reused: true };

  await upsertUserAndEntitlement({ userName, userEmail, userPhone, role });

  const payload = {
    session_id: sessionId,
    user_name: userName,
    user_email: normalizedEmail,
    user_phone: normalizedPhone,
    role,
    started_at: toIso(Date.now()),
    correct: 0,
    wrong: 0,
    attempted: 0,
    score: 0
  };

  const { error: insertError } = await supabase.from("sessions").insert(payload);
  if (insertError) throw insertError;

  return { id: sessionId };
}

async function storageLogAnswer({
  sessionId,
  cardTag,
  question,
  expectedAnswer,
  acceptedAnswers,
  userAnswer,
  isCorrect,
  isSkipped,
  at
}) {
  if (!USE_SUPABASE) {
    const sessions = readSessions();
    const idx = findSessionIndex(sessions, sessionId);
    if (idx < 0) throw new Error("Session not found");

    sessions[idx].answers.push({
      cardTag,
      question,
      expectedAnswer,
      acceptedAnswers,
      userAnswer,
      isCorrect,
      isSkipped: Boolean(isSkipped || String(userAnswer || "") === "[SKIPPED]"),
      at: Number(at || Date.now())
    });

    const correct = sessions[idx].answers.filter((a) => a.isCorrect).length;
    const attempted = sessions[idx].answers.filter((a) => !a.isSkipped).length;
    const wrong = attempted - correct;
    sessions[idx].summary = { correct, wrong, attempted, score: calcScore(correct, attempted) };

    writeSessions(sessions);
    return;
  }

  const { data: sessionRow, error: sessionErr } = await supabase
    .from("sessions")
    .select("session_id")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (sessionErr) throw sessionErr;
  if (!sessionRow) throw new Error("Session not found");

  const attemptPayload = {
    session_id: sessionId,
    card_tag: cardTag,
    question,
    expected_answer: expectedAnswer,
    accepted_answers: Array.isArray(acceptedAnswers) ? acceptedAnswers : [],
    user_answer: userAnswer,
    is_correct: Boolean(isCorrect),
    answered_at: toIso(at)
  };

  const { error: insertAttemptErr } = await supabase.from("attempts").insert(attemptPayload);
  if (insertAttemptErr) throw insertAttemptErr;

  const attemptedRes = await supabase
    .from("attempts")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .neq("user_answer", "[SKIPPED]");
  if (attemptedRes.error) throw attemptedRes.error;

  const correctRes = await supabase
    .from("attempts")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("is_correct", true)
    .neq("user_answer", "[SKIPPED]");
  if (correctRes.error) throw correctRes.error;

  const attempted = Number(attemptedRes.count || 0);
  const correct = Number(correctRes.count || 0);
  const wrong = Math.max(0, attempted - correct);

  const { error: updateErr } = await supabase
    .from("sessions")
    .update({ correct, wrong, attempted, score: calcScore(correct, attempted) })
    .eq("session_id", sessionId);
  if (updateErr) throw updateErr;
}

async function storageEndSession({ sessionId, summary }) {
  if (!USE_SUPABASE) {
    const sessions = readSessions();
    const idx = findSessionIndex(sessions, sessionId);
    if (idx < 0) throw new Error("Session not found");

    sessions[idx].endedAt = Date.now();
    if (summary && typeof summary === "object") {
      sessions[idx].summary = {
        correct: Number(summary.correct || 0),
        wrong: Number(summary.wrong || 0),
        attempted: Number(summary.attempted || 0),
        score: Number(summary.score || 0)
      };
    }

    writeSessions(sessions);
    return;
  }

  const payload = {
    ended_at: toIso(Date.now())
  };

  if (summary && typeof summary === "object") {
    payload.correct = Number(summary.correct || 0);
    payload.wrong = Number(summary.wrong || 0);
    payload.attempted = Number(summary.attempted || 0);
    payload.score = Number(summary.score || 0);
  }

  const { data: existing, error: findErr } = await supabase
    .from("sessions")
    .select("session_id")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (findErr) throw findErr;
  if (!existing) throw new Error("Session not found");

  const { error: updateErr } = await supabase.from("sessions").update(payload).eq("session_id", sessionId);
  if (updateErr) throw updateErr;
}

async function storageListSessions() {
  if (!USE_SUPABASE) {
    const sessions = readSessions();
    return sessions.map((s) => ({
      id: s.id,
      userName: s.userName,
      role: s.role,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      summary: s.summary
    }));
  }

  const { data, error } = await supabase
    .from("sessions")
    .select("session_id,user_name,role,started_at,ended_at,correct,wrong,attempted,score")
    .order("started_at", { ascending: false })
    .limit(500);

  if (error) throw error;

  return (data || []).map((row) => ({
    id: row.session_id,
    userName: row.user_name,
    role: row.role,
    startedAt: Date.parse(row.started_at),
    endedAt: row.ended_at ? Date.parse(row.ended_at) : null,
    summary: {
      correct: Number(row.correct || 0),
      wrong: Number(row.wrong || 0),
      attempted: Number(row.attempted || 0),
      score: Number(row.score || 0)
    }
  }));
}

function normalizeKeyPart(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function questionCompositeKey(tag, question, answer) {
  return `${normalizeKeyPart(tag)}|${normalizeKeyPart(question)}|${normalizeKeyPart(answer)}`;
}

function nearQuestionKey(question) {
  return String(question || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function sanitizeQuestionCard(card) {
  const clean = (input) => {
    const raw = String(input || "").replace(/\u0000/g, "");
    let out = "";
    for (let i = 0; i < raw.length; i += 1) {
      const code = raw.charCodeAt(i);
      const isHigh = code >= 0xd800 && code <= 0xdbff;
      const isLow = code >= 0xdc00 && code <= 0xdfff;
      if (isHigh) {
        const next = raw.charCodeAt(i + 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          out += raw[i] + raw[i + 1];
          i += 1;
        }
        continue;
      }
      if (isLow) continue;
      out += raw[i];
    }
    return out.trim();
  };

  return {
    tag: clean(card.tag || "General"),
    question: clean(card.question || ""),
    answer: clean(card.answer || "")
  };
}

async function storageImportQuestions(cards, meta = {}) {
  const uploadedBy = String(meta.uploadedBy || "trainer");
  const reviewRows = Array.isArray(meta.reviewRows) ? meta.reviewRows : [];
  const batchSummary = meta.batchSummary && typeof meta.batchSummary === "object" ? meta.batchSummary : null;
  const sourceName = String(meta.sourceName || "").trim();
  const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const sanitized = cards.map(sanitizeQuestionCard).filter((c) => c.question && c.answer);
  const uniqueIncoming = [];
  const incomingSeen = new Set();
  for (const card of sanitized) {
    const key = questionCompositeKey(card.tag, card.question, card.answer);
    if (incomingSeen.has(key)) continue;
    incomingSeen.add(key);
    uniqueIncoming.push(card);
  }

  if (!uniqueIncoming.length) return { inserted: 0, skipped: cards.length, batchId, reviewQueued: 0 };

  if (!USE_SUPABASE) {
    const existing = readQuestions();
    const existingSet = new Set(existing.map((q) => questionCompositeKey(q.tag, q.question, q.answer)));
    const toInsert = uniqueIncoming.filter((c) => !existingSet.has(questionCompositeKey(c.tag, c.question, c.answer)));
    const now = Date.now();
    const newRows = toInsert.map((c, idx) => ({
      id: `q_${now}_${idx}_${Math.random().toString(36).slice(2, 8)}`,
      tag: c.tag,
      question: c.question,
      answer: c.answer,
      is_active: true,
      created_at: new Date(now).toISOString()
    }));
    writeQuestions([...existing, ...newRows]);

    const batches = readImportBatches();
    const summary = batchSummary || {};
    batches.unshift({
      id: batchId,
      uploadedBy,
      sourceName,
      totalRows: Number(summary.total || cards.length),
      insertedCount: newRows.length,
      skippedCount: Number(summary.skip || cards.length - newRows.length),
      warnCount: Number(summary.warn || 0),
      failCount: Number(summary.fail || 0),
      insertedQuestionIds: newRows.map((row) => row.id),
      createdAt: now,
      rolledBackAt: null,
      rollbackCount: 0
    });
    writeImportBatches(batches);
    const queued = await storageCreateImportReviewItems({ batchId, rows: reviewRows, createdBy: uploadedBy });
    return { inserted: newRows.length, skipped: cards.length - newRows.length, batchId, reviewQueued: queued.queued };
  }

  const { data: existingRows, error: existingErr } = await supabase
    .from("questions")
    .select("tag,question,answer")
    .eq("is_active", true);
  if (existingErr) throw existingErr;

  const existingSet = new Set((existingRows || []).map((q) => questionCompositeKey(q.tag, q.question, q.answer)));
  const toInsert = uniqueIncoming.filter((c) => !existingSet.has(questionCompositeKey(c.tag, c.question, c.answer)));

  if (!toInsert.length) {
    const summary = batchSummary || {};
    const { error: batchErr } = await supabase.from("import_batches").insert({
      batch_id: batchId,
      uploaded_by: uploadedBy,
      source_name: sourceName || null,
      total_rows: Number(summary.total || cards.length),
      inserted_count: 0,
      skipped_count: Number(summary.skip || cards.length),
      warn_count: Number(summary.warn || 0),
      fail_count: Number(summary.fail || 0),
      notes: String(meta.notes || "").trim() || null
    });
    if (batchErr) throw batchErr;
    const queued = await storageCreateImportReviewItems({ batchId, rows: reviewRows, createdBy: uploadedBy });
    return { inserted: 0, skipped: cards.length, batchId, reviewQueued: queued.queued };
  }

  const payload = toInsert.map((c) => ({
    tag: c.tag,
    question: c.question,
    answer: c.answer,
    is_active: true
  }));

  const { data: insertedRows, error: insertErr } = await supabase.from("questions").insert(payload).select("id");
  if (insertErr) throw insertErr;
  const insertedIds = (insertedRows || []).map((row) => row.id).filter(Boolean);

  const summary = batchSummary || {};
  const { error: batchErr } = await supabase.from("import_batches").insert({
    batch_id: batchId,
    uploaded_by: uploadedBy,
    source_name: sourceName || null,
    total_rows: Number(summary.total || cards.length),
    inserted_count: payload.length,
    skipped_count: Number(summary.skip || cards.length - payload.length),
    warn_count: Number(summary.warn || 0),
    fail_count: Number(summary.fail || 0),
    notes: String(meta.notes || "").trim() || null
  });
  if (batchErr) throw batchErr;

  if (insertedIds.length) {
    const batchItems = insertedIds.map((id) => ({
      batch_id: batchId,
      question_id: id,
      disposition: "inserted"
    }));
    const { error: itemsErr } = await supabase.from("import_batch_items").insert(batchItems);
    if (itemsErr) throw itemsErr;
  }

  const queued = await storageCreateImportReviewItems({ batchId, rows: reviewRows, createdBy: uploadedBy });
  return { inserted: payload.length, skipped: cards.length - payload.length, batchId, reviewQueued: queued.queued };
}

async function storagePreviewImportQuestions(cards) {
  const incoming = cards.map(sanitizeQuestionCard);
  const exactSeen = new Set();
  const nearSeen = new Set();

  const validIncoming = incoming.filter((c) => c.question && c.answer);
  if (!validIncoming.length) {
    return {
      summary: { total: incoming.length, pass: 0, warn: 0, fail: incoming.length, skip: 0 },
      rows: incoming.map((c, idx) => ({
        rowNumber: idx + 1,
        tag: c.tag || "",
        question: c.question || "",
        status: "fail",
        reasons: ["Missing question/answer"]
      }))
    };
  }

  let existingRows = [];
  if (!USE_SUPABASE) {
    existingRows = readQuestions().filter((q) => q.is_active !== false);
  } else {
    const { data, error } = await supabase.from("questions").select("tag,question,answer").eq("is_active", true);
    if (error) throw error;
    existingRows = data || [];
  }

  const existingExact = new Set(existingRows.map((q) => questionCompositeKey(q.tag, q.question, q.answer)));
  const existingNear = new Set(existingRows.map((q) => nearQuestionKey(q.question)));

  const rows = incoming.map((card, idx) => {
    const reasons = [];
    let status = "pass";
    if (!card.question || !card.answer) {
      status = "fail";
      reasons.push("Missing question/answer");
      return {
        rowNumber: idx + 1,
        tag: card.tag || "",
        question: card.question || "",
        status,
        reasons
      };
    }

    const exactKey = questionCompositeKey(card.tag, card.question, card.answer);
    const nearKey = nearQuestionKey(card.question);

    if (exactSeen.has(exactKey)) {
      status = "skip";
      reasons.push("Exact duplicate in this file");
    } else if (existingExact.has(exactKey)) {
      status = "skip";
      reasons.push("Exact duplicate already in database");
    } else {
      exactSeen.add(exactKey);
    }

    if (status !== "skip") {
      if (nearSeen.has(nearKey)) {
        status = "warn";
        reasons.push("Near duplicate question in this file");
      } else if (existingNear.has(nearKey)) {
        status = "warn";
        reasons.push("Near duplicate question already in database");
      }
    }

    nearSeen.add(nearKey);

    return {
      rowNumber: idx + 1,
      tag: card.tag || "",
      question: card.question || "",
      status,
      reasons
    };
  });

  const summary = rows.reduce(
    (acc, row) => {
      acc.total += 1;
      if (row.status === "pass") acc.pass += 1;
      else if (row.status === "warn") acc.warn += 1;
      else if (row.status === "skip") acc.skip += 1;
      else acc.fail += 1;
      return acc;
    },
    { total: 0, pass: 0, warn: 0, fail: 0, skip: 0 }
  );

  return { summary, rows };
}

function sanitizeImportReviewRow(row) {
  return {
    tag: String(row?.tag || "General").trim() || "General",
    question: String(row?.question || "").trim(),
    answer: String(row?.answer || "").trim(),
    reasons: Array.isArray(row?.reasons) ? row.reasons.map((x) => String(x || "").trim()).filter(Boolean) : [],
    sourceRowNumber: Number(row?.rowNumber || 0)
  };
}

async function storageCreateImportReviewItems({ batchId, rows, createdBy }) {
  const now = Date.now();
  const cleanRows = (Array.isArray(rows) ? rows : []).map(sanitizeImportReviewRow).filter((r) => r.question && r.answer);
  if (!cleanRows.length) return { queued: 0 };

  if (!USE_SUPABASE) {
    const items = readImportReviews();
    cleanRows.forEach((row) => {
      items.unshift({
        id: `ir_${now}_${Math.random().toString(36).slice(2, 8)}`,
        batchId: String(batchId || ""),
        status: "open",
        tag: row.tag,
        question: row.question,
        answer: row.answer,
        reasons: row.reasons,
        sourceRowNumber: row.sourceRowNumber || null,
        createdBy: String(createdBy || "trainer"),
        createdAt: now,
        updatedAt: now,
        resolution: null
      });
    });
    writeImportReviews(items);
    return { queued: cleanRows.length };
  }

  const payload = cleanRows.map((row) => ({
    batch_id: String(batchId || null),
    status: "open",
    tag: row.tag,
    question: row.question,
    answer: row.answer,
    reasons: row.reasons,
    source_row_number: row.sourceRowNumber || null,
    created_by: String(createdBy || "trainer")
  }));
  const { error } = await supabase.from("import_review_queue").insert(payload);
  if (error) throw error;
  return { queued: payload.length };
}

async function storageListImportReviewItems(status) {
  const wanted = String(status || "").trim().toLowerCase();
  if (!USE_SUPABASE) {
    let items = readImportReviews();
    if (wanted) items = items.filter((item) => String(item.status || "").toLowerCase() === wanted);
    return items.slice(0, 1000);
  }

  let query = supabase
    .from("import_review_queue")
    .select("id,batch_id,status,tag,question,answer,reasons,source_row_number,created_by,created_at,updated_at,resolution_note,resolution_action,resolved_at")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (wanted) query = query.eq("status", wanted);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => ({
    id: String(row.id || ""),
    batchId: String(row.batch_id || ""),
    status: String(row.status || "open"),
    tag: String(row.tag || ""),
    question: String(row.question || ""),
    answer: String(row.answer || ""),
    reasons: Array.isArray(row.reasons) ? row.reasons : [],
    sourceRowNumber: Number(row.source_row_number || 0) || null,
    createdBy: String(row.created_by || ""),
    createdAt: Date.parse(row.created_at),
    updatedAt: Date.parse(row.updated_at),
    resolution: row.resolution_action
      ? {
        action: String(row.resolution_action),
        note: String(row.resolution_note || ""),
        at: row.resolved_at ? Date.parse(row.resolved_at) : Date.parse(row.updated_at)
      }
      : null
  }));
}

async function storageResolveImportReviewItem({ reviewId, action, note }) {
  const cleanId = String(reviewId || "").trim();
  const cleanAction = String(action || "").trim().toLowerCase();
  const cleanNote = String(note || "").trim().slice(0, 300);
  if (!cleanId || !cleanAction) throw new Error("reviewId and action are required");

  if (cleanAction === "resolve" || cleanAction === "discard") {
    const status = cleanAction === "discard" ? "discarded" : "resolved";

    if (!USE_SUPABASE) {
      const items = readImportReviews();
      const idx = items.findIndex((i) => String(i.id) === cleanId);
      if (idx < 0) throw new Error("Review item not found");
      items[idx].status = status;
      items[idx].updatedAt = Date.now();
      items[idx].resolution = {
        action: cleanAction,
        note: cleanNote,
        at: Date.now()
      };
      writeImportReviews(items);
      return items[idx];
    }

    const { data, error } = await supabase
      .from("import_review_queue")
      .update({
        status: status,
        resolution_action: cleanAction,
        resolution_note: cleanNote,
        resolved_at: toIso(Date.now())
      })
      .eq("id", cleanId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // Handle "reopen"
  if (cleanAction === "reopen") {
    if (!USE_SUPABASE) {
      const items = readImportReviews();
      const idx = items.findIndex((i) => String(i.id) === cleanId);
      if (idx < 0) throw new Error("Review item not found");
      items[idx].status = "open";
      items[idx].updatedAt = Date.now();
      items[idx].resolution = null;
      writeImportReviews(items);
      return items[idx];
    }

    const { data, error } = await supabase
      .from("import_review_queue")
      .update({
        status: "open",
        resolution_action: null,
        resolution_note: null,
        resolved_at: null
      })
      .eq("id", cleanId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

async function storageResolveAllImportReviewItems(note = "") {
  const cleanNote = String(note || "").trim().slice(0, 300);
  if (!USE_SUPABASE) {
    const items = readImportReviews();
    let count = 0;
    const now = Date.now();
    items.forEach((item) => {
      if (String(item.status || "") === "open") {
        item.status = "resolved";
        item.updatedAt = now;
        item.resolution = {
          action: "resolve_all",
          note: cleanNote || "Bulk resolved from trainer queue.",
          at: now
        };
        count += 1;
      }
    });
    writeImportReviews(items);
    return { updated: count };
  }

  const { data, error } = await supabase
    .from("import_review_queue")
    .update({
      status: "resolved",
      resolution_action: "resolve_all",
      resolution_note: cleanNote || "Bulk resolved from trainer queue.",
      resolved_at: toIso(Date.now())
    })
    .eq("status", "open")
    .select("id");
  if (error) throw error;
  return { updated: Array.isArray(data) ? data.length : 0 };
}

async function storageListImportBatches(limit = 100) {
  const max = Math.max(1, Math.min(500, Number(limit || 100)));
  if (!USE_SUPABASE) return readImportBatches().slice(0, max);
  const { data, error } = await supabase
    .from("import_batches")
    .select("id,batch_id,uploaded_by,total_rows,inserted_count,skipped_count,warn_count,fail_count,created_at,notes")
    .order("created_at", { ascending: false })
    .limit(max);
  if (error) throw error;
  return (data || []).map((row) => ({
    id: String(row.batch_id || row.id || ""),
    uploadedBy: String(row.uploaded_by || ""),
    totalRows: Number(row.total_rows || 0),
    insertedCount: Number(row.inserted_count || 0),
    skippedCount: Number(row.skipped_count || 0),
    warnCount: Number(row.warn_count || 0),
    failCount: Number(row.fail_count || 0),
    notes: String(row.notes || ""),
    createdAt: Date.parse(row.created_at)
  }));
}

async function storageRollbackImportBatch(batchId) {
  const cleanBatchId = String(batchId || "").trim();
  if (!cleanBatchId) throw new Error("batchId is required");

  if (!USE_SUPABASE) {
    const batches = readImportBatches();
    const batch = batches.find((b) => String(b.id) === cleanBatchId);
    if (!batch) throw new Error("Batch not found");
    if (batch.rolledBackAt) throw new Error("Batch already rolled back");

    const questions = readQuestions();
    const idSet = new Set(Array.isArray(batch.insertedQuestionIds) ? batch.insertedQuestionIds.map((id) => String(id)) : []);
    let affected = 0;
    questions.forEach((q) => {
      if (idSet.has(String(q.id)) && q.is_active !== false) {
        q.is_active = false;
        affected += 1;
      }
    });
    writeQuestions(questions);

    batch.rolledBackAt = Date.now();
    batch.rollbackCount = affected;
    writeImportBatches(batches);
    return { batchId: cleanBatchId, affected };
  }

  const { data: batchRows, error: batchErr } = await supabase
    .from("import_batches")
    .select("id,batch_id,rolled_back_at")
    .eq("batch_id", cleanBatchId)
    .limit(1);
  if (batchErr) throw batchErr;
  const batch = (batchRows || [])[0];
  if (!batch) throw new Error("Batch not found");
  if (batch.rolled_back_at) throw new Error("Batch already rolled back");

  const { data: items, error: itemsErr } = await supabase
    .from("import_batch_items")
    .select("question_id")
    .eq("batch_id", cleanBatchId)
    .eq("disposition", "inserted");
  if (itemsErr) throw itemsErr;
  const ids = (items || []).map((row) => row.question_id).filter(Boolean);
  if (!ids.length) return { batchId: cleanBatchId, affected: 0 };

  const { error: updateErr } = await supabase.from("questions").update({ is_active: false }).in("id", ids);
  if (updateErr) throw updateErr;
  const { error: markErr } = await supabase
    .from("import_batches")
    .update({ rolled_back_at: toIso(Date.now()), rollback_count: ids.length })
    .eq("batch_id", cleanBatchId);
  if (markErr) throw markErr;
  return { batchId: cleanBatchId, affected: ids.length };
}

async function storageListQuestions(tag) {
  if (!USE_SUPABASE) {
    const questions = readQuestions().filter((q) => q.is_active !== false);
    return tag ? questions.filter((q) => q.tag === tag) : questions;
  }

  let query = supabase.from("questions").select("id,tag,question,answer").eq("is_active", true).order("created_at", { ascending: true });
  if (tag) query = query.eq("tag", tag);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function storageReplaceQuestion({ questionId, tag, question, answer, originalTag, originalQuestion, originalAnswer }) {
  const nextTag = String(tag || "General").trim();
  const nextQuestion = String(question || "").trim();
  const nextAnswer = String(answer || "").trim();
  if (!nextQuestion || !nextAnswer) throw new Error("Replacement question and answer are required");

  if (!USE_SUPABASE) {
    const questions = readQuestions();
    let idx = questions.findIndex((q) => String(q.id) === String(questionId));
    if (idx < 0) {
      idx = questions.findIndex(
        (q) =>
          normalizeKeyPart(q.tag) === normalizeKeyPart(originalTag) &&
          normalizeKeyPart(q.question) === normalizeKeyPart(originalQuestion) &&
          normalizeKeyPart(q.answer) === normalizeKeyPart(originalAnswer)
      );
    }
    if (idx < 0) throw new Error("Question not found");

    questions[idx].tag = nextTag || questions[idx].tag || "General";
    questions[idx].question = nextQuestion;
    questions[idx].answer = nextAnswer;
    writeQuestions(questions);
    return { id: questions[idx].id, tag: questions[idx].tag, question: questions[idx].question };
  }

  let existing = null;
  const byId = await supabase.from("questions").select("id,tag").eq("id", questionId).maybeSingle();
  if (byId.error && String(byId.error.code || "") !== "PGRST116") throw byId.error;
  if (byId.data) existing = byId.data;
  if (!existing) {
    const byMatch = await supabase
      .from("questions")
      .select("id,tag")
      .eq("tag", String(originalTag || ""))
      .eq("question", String(originalQuestion || ""))
      .eq("answer", String(originalAnswer || ""))
      .maybeSingle();
    if (byMatch.error && String(byMatch.error.code || "") !== "PGRST116") throw byMatch.error;
    existing = byMatch.data;
  }
  if (!existing) throw new Error("Question not found");

  const payload = { tag: nextTag || existing.tag, question: nextQuestion, answer: nextAnswer };
  const { error: updateErr } = await supabase.from("questions").update(payload).eq("id", questionId);
  if (updateErr) throw updateErr;
  return { id: questionId, tag: payload.tag, question: payload.question };
}

async function storageDeleteQuestion(questionId) {
  if (!USE_SUPABASE) {
    const questions = readQuestions();
    const idx = questions.findIndex((q) => String(q.id) === String(questionId));
    if (idx < 0) throw new Error("Question not found");
    questions[idx].is_active = false; // Soft delete
    writeQuestions(questions);
    return { id: questionId, status: "deleted" };
  }

  const { error } = await supabase.from("questions").update({ is_active: false }).eq("id", questionId);
  if (error) throw error;
  return { id: questionId, status: "deleted" };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/health" && req.method === "GET") {
    return json(res, 200, { ok: true, storage: USE_SUPABASE ? "supabase" : "file", timestamp: Date.now() });
  }

  if (url.pathname === "/api/access/config" && req.method === "GET") {
    return json(res, 200, getPublicAccessConfig());
  }

  if (url.pathname === "/api/access/verify" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const code = String(body.code || "");
      const email = normalizeEmail(body.email || "");
      const access = readAccessConfig();
      if (Boolean(access.traineeAccessCode) && code === access.traineeAccessCode) {
        if (access.traineeAccessActive === false || isExpired(access.traineeAccessExpiresAt)) {
          return json(res, 200, { valid: false, reason: "trainee_access_inactive_or_expired" });
        }
        return json(res, 200, {
          valid: true,
          accessType: "trainee",
          questionLimit: 1000000,
          cohortId: null,
          cohortName: null
        });
      }

      const cohort = findCohortByAccessCode(code);
      if (cohort) {
        if (cohort.isActive === false || isExpired(cohort.expiresAt)) {
          return json(res, 200, { valid: false, reason: "cohort_inactive_or_expired" });
        }
        if (!email) {
          return json(res, 200, { valid: false, reason: "email_required_for_cohort" });
        }

        const members = Array.isArray(cohort.members) ? cohort.members : [];
        const member = members.find((m) => normalizeEmail(m.email) === email);
        if (!member) return json(res, 200, { valid: false, reason: "not_enrolled_in_cohort" });
        if (member.isActive === false || isExpired(member.expiresAt)) {
          return json(res, 200, { valid: false, reason: "member_inactive_or_expired" });
        }

        return json(res, 200, {
          valid: true,
          accessType: "cohort",
          questionLimit: Math.max(1, Number(cohort.questionLimit || 1000000)),
          cohortId: cohort.id,
          cohortName: cohort.name
        });
      }

      return json(res, 200, { valid: false });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/trainer/verify" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const key = String(body.trainerKey || "");
      const access = readAccessConfig();
      return json(res, 200, { valid: Boolean(access.trainerKey) && key === access.trainerKey });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/admin/verify" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const key = String(body.adminKey || "");
      return json(res, 200, { valid: isAdminAuthorized(key) });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/admin/reset-data" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const key = String(body.adminKey || "");
      if (!isAdminAuthorized(key)) return json(res, 403, { error: "Forbidden" });

      if (!USE_SUPABASE) {
        // Reset file-based store
        writeQuestions([]);
        writeImportBatches([]);
        writeImportReviews([]);
        writeCtaEvents([]);
        // Optionally reset sessions/users too if desired, but user asked for "questions" mostly.
        // Let's reset everything to be safe as per "Hard Reset".
        writeSessions([]);
        writeCohorts([]);
        writeExamStore({ templates: DEFAULT_EXAM_TEMPLATES, assignments: [] });
        writeFlags([]);
        return json(res, 200, { success: true, mode: "file" });
      }

      // Supabase Reset: delete all rows from each table (order respects FK: attempts before sessions)
      const { error: attemptsErr } = await supabase.from("attempts").delete().gt("id", -1);
      if (attemptsErr) throw attemptsErr;
      const { error: sessionsErr } = await supabase.from("sessions").delete().neq("session_id", "");
      if (sessionsErr) throw sessionsErr;
      const { error: flagsErr } = await supabase.from("flags").delete().neq("id", "");
      if (flagsErr) throw flagsErr;
      const { error: ctaErr } = await supabase.from("cta_events").delete().neq("id", "");
      if (ctaErr) throw ctaErr;

      const { error: questionsErr } = await supabase.from("questions").delete().neq("id", "placeholder");
      if (questionsErr) throw questionsErr;
      const { error: batchesErr } = await supabase.from("import_batches").delete().gt("id", -1);
      if (batchesErr) throw batchesErr;
      const { error: batchItemsErr } = await supabase.from("import_batch_items").delete().gt("id", -1);
      if (batchItemsErr) throw batchItemsErr;
      const { error: reviewErr } = await supabase.from("import_review_queue").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (reviewErr) throw reviewErr;

      return json(res, 200, { success: true, mode: "supabase" });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/admin/access-config" && req.method === "GET") {
    const key = getAdminKey(req, url);
    if (!isAdminAuthorized(key)) return json(res, 403, { error: "Forbidden" });
    const config = readAccessConfig();
    return json(res, 200, {
      trainerKey: config.trainerKey || "",
      traineeAccessCode: config.traineeAccessCode || "",
      traineeAccessActive: config.traineeAccessActive !== false,
      traineeAccessExpiresAt: config.traineeAccessExpiresAt ? Number(config.traineeAccessExpiresAt) : null,
      trialQuestionLimit: Math.max(1, Number(config.trialQuestionLimit || 20)),
      maxSessionQuestions: Math.max(1, Number(config.maxSessionQuestions || 250)),
      updatedAt: config.updatedAt
    });
  }

  if (url.pathname === "/api/admin/access-config" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const key = String(body.adminKey || "");
      if (!isAdminAuthorized(key)) return json(res, 403, { error: "Forbidden" });

      const existing = readAccessConfig();
      const next = writeAccessConfig({
        trainerKey: body.trainerKey !== undefined ? String(body.trainerKey || "").trim() : existing.trainerKey,
        traineeAccessCode:
          body.traineeAccessCode !== undefined ? String(body.traineeAccessCode || "").trim() : existing.traineeAccessCode,
        traineeAccessActive:
          body.traineeAccessActive !== undefined ? Boolean(body.traineeAccessActive) : existing.traineeAccessActive,
        traineeAccessExpiresAt:
          body.traineeAccessExpiresAt !== undefined ? normalizeExpiryTs(body.traineeAccessExpiresAt) : existing.traineeAccessExpiresAt,
        trialQuestionLimit:
          body.trialQuestionLimit !== undefined ? Math.max(1, Number(body.trialQuestionLimit || 20)) : existing.trialQuestionLimit,
        maxSessionQuestions:
          body.maxSessionQuestions !== undefined ? Math.max(1, Number(body.maxSessionQuestions || 250)) : existing.maxSessionQuestions
      });
      return json(res, 200, next);
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/admin/cohorts" && req.method === "GET") {
    const key = getAdminKey(req, url);
    if (!isAdminAuthorized(key)) return json(res, 403, { error: "Forbidden" });
    return json(res, 200, { cohorts: listCohortsSummary() });
  }

  if (url.pathname === "/api/admin/cohorts" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const key = String(body.adminKey || "");
      if (!isAdminAuthorized(key)) return json(res, 403, { error: "Forbidden" });

      if (body.cohortId) {
        const updated = updateCohort({
          cohortId: String(body.cohortId),
          name: body.name,
          accessCode: body.accessCode,
          questionLimit: body.questionLimit,
          isActive: body.isActive,
          expiresAt: body.expiresAt
        });
        return json(res, 200, { cohort: updated });
      }

      const created = createCohort({
        name: body.name,
        accessCode: body.accessCode,
        questionLimit: body.questionLimit,
        isActive: body.isActive,
        expiresAt: body.expiresAt
      });
      return json(res, 201, { cohort: created });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/admin/cohorts/enroll" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const key = String(body.adminKey || "");
      if (!isAdminAuthorized(key)) return json(res, 403, { error: "Forbidden" });

      const updated = enrollCohortMember({
        cohortId: String(body.cohortId || ""),
        email: body.email,
        name: body.name,
        phone: body.phone,
        isActive: body.isActive,
        expiresAt: body.expiresAt
      });
      return json(res, 200, { cohort: updated });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/admin/cohorts/members" && req.method === "GET") {
    const key = url.searchParams.get("adminKey");
    if (!isAdminAuthorized(key)) return json(res, 403, { error: "Forbidden" });
    const cohortId = String(url.searchParams.get("cohortId") || "");
    const cohort = readCohorts().find((c) => c.id === cohortId);
    if (!cohort) return json(res, 404, { error: "Cohort not found" });
    return json(res, 200, { members: Array.isArray(cohort.members) ? cohort.members : [] });
  }

  if (url.pathname === "/api/cohorts" && req.method === "GET") {
    const trainerKey = getTrainerKey(req, url);
    const access = readAccessConfig();
    if (!access.trainerKey || trainerKey !== access.trainerKey) return json(res, 403, { error: "Forbidden" });
    const cohorts = readCohorts().map((cohort) => ({
      id: cohort.id,
      name: cohort.name,
      memberCount: Array.isArray(cohort.members) ? cohort.members.length : 0,
      isActive: Boolean(cohort.isActive)
    }));
    return json(res, 200, { cohorts });
  }

  if (url.pathname === "/api/analytics/user" && req.method === "GET") {
    try {
      const trainerKey = getTrainerKey(req, url);
      const access = readAccessConfig();
      if (!access.trainerKey || trainerKey !== access.trainerKey) return json(res, 403, { error: "Forbidden" });

      const email = normalizeEmail(url.searchParams.get("email"));
      const days = Math.max(1, Number(url.searchParams.get("days") || 30));
      if (!email) return json(res, 400, { error: "Missing email" });

      const since = Date.now() - days * 24 * 60 * 60 * 1000;
      const attempts = await listAttemptsForEmails([email], since);
      const analytics = buildAttemptAnalytics(attempts, days);
      const recommendedTags = makeRecommendationFromAnalytics(analytics);

      return json(res, 200, {
        scope: "user",
        email,
        analytics,
        recommendedTags
      });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/analytics/batch" && req.method === "GET") {
    try {
      const trainerKey = getTrainerKey(req, url);
      const access = readAccessConfig();
      if (!access.trainerKey || trainerKey !== access.trainerKey) return json(res, 403, { error: "Forbidden" });

      const cohortId = String(url.searchParams.get("cohortId") || "");
      const days = Math.max(1, Number(url.searchParams.get("days") || 30));
      if (!cohortId) return json(res, 400, { error: "Missing cohortId" });

      const cohort = readCohorts().find((item) => item.id === cohortId);
      if (!cohort) return json(res, 404, { error: "Cohort not found" });
      const emails = (Array.isArray(cohort.members) ? cohort.members : []).map((m) => m.email).filter(Boolean);
      if (!emails.length) {
        return json(res, 200, {
          scope: "batch",
          cohortId,
          cohortName: cohort.name,
          memberCount: 0,
          analytics: buildAttemptAnalytics([], days),
          recommendedTags: []
        });
      }

      const since = Date.now() - days * 24 * 60 * 60 * 1000;
      const attempts = await listAttemptsForEmails(emails, since);
      const analytics = buildAttemptAnalytics(attempts, days);
      const recommendedTags = makeRecommendationFromAnalytics(analytics);

      return json(res, 200, {
        scope: "batch",
        cohortId,
        cohortName: cohort.name,
        memberCount: emails.length,
        analytics,
        recommendedTags
      });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/analytics/recommendations" && req.method === "GET") {
    try {
      const trainerKey = getTrainerKey(req, url);
      const access = readAccessConfig();
      if (!access.trainerKey || trainerKey !== access.trainerKey) return json(res, 403, { error: "Forbidden" });

      const email = normalizeEmail(url.searchParams.get("email"));
      const days = Math.max(1, Number(url.searchParams.get("days") || 30));
      const cardLimit = Math.max(1, Math.min(50, Number(url.searchParams.get("limit") || 15)));
      if (!email) return json(res, 400, { error: "Missing email" });

      const since = Date.now() - days * 24 * 60 * 60 * 1000;
      const attempts = await listAttemptsForEmails([email], since);
      const analytics = buildAttemptAnalytics(attempts, days);
      const recommendedTags = makeRecommendationFromAnalytics(analytics);

      const allQuestions = await storageListQuestions("");
      const pool = allQuestions.filter((q) => recommendedTags.includes(String(q.tag || "")));
      const cards = shuffled(pool).slice(0, cardLimit).map((q) => ({
        id: q.id,
        tag: q.tag,
        question: q.question,
        answer: q.answer
      }));

      return json(res, 200, {
        email,
        days,
        recommendedTags,
        cards
      });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/exam/templates" && req.method === "GET") {
    const trainerKey = getTrainerKey(req, url);
    const access = readAccessConfig();
    if (!access.trainerKey || trainerKey !== access.trainerKey) return json(res, 403, { error: "Forbidden" });
    const store = readExamStore();
    return json(res, 200, { templates: store.templates });
  }

  if (url.pathname === "/api/exam/templates" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const trainerKey = String(body.trainerKey || "");
      const access = readAccessConfig();
      if (!access.trainerKey || trainerKey !== access.trainerKey) return json(res, 403, { error: "Forbidden" });

      const template = sanitizeTemplate(body.template || {});
      const store = readExamStore();
      const idx = store.templates.findIndex((t) => t.id === template.id);
      if (idx >= 0) store.templates[idx] = template;
      else store.templates.push(template);
      writeExamStore(store);
      return json(res, 200, { template });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/exam/assign" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const trainerKey = String(body.trainerKey || "");
      const access = readAccessConfig();
      if (!access.trainerKey || trainerKey !== access.trainerKey) return json(res, 403, { error: "Forbidden" });

      const cohortId = String(body.cohortId || "");
      const templateId = String(body.templateId || "");
      if (!cohortId || !templateId) return json(res, 400, { error: "cohortId and templateId are required" });

      const cohort = readCohorts().find((c) => c.id === cohortId);
      if (!cohort) return json(res, 404, { error: "Cohort not found" });

      const store = readExamStore();
      const template = store.templates.find((t) => t.id === templateId);
      if (!template) return json(res, 404, { error: "Template not found" });

      const assignment = {
        cohortId,
        templateId,
        questionCount: Math.max(1, Number(body.questionCount || template.questionCount || 30)),
        durationMinutes: Math.max(1, Number(body.durationMinutes || template.durationMinutes || 30)),
        passThreshold: Math.min(100, Math.max(1, Number(body.passThreshold || template.passThreshold || 80))),
        strictTiming: body.strictTiming !== false,
        updatedAt: Date.now()
      };

      const existingIdx = store.assignments.findIndex((a) => a.cohortId === cohortId);
      if (existingIdx >= 0) store.assignments[existingIdx] = assignment;
      else store.assignments.push(assignment);
      writeExamStore(store);

      return json(res, 200, { assignment });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/exam/assigned" && req.method === "GET") {
    try {
      const cohortId = String(url.searchParams.get("cohortId") || "");
      if (!cohortId) return json(res, 200, { assignment: null });

      const store = readExamStore();
      const assignment = store.assignments.find((a) => a.cohortId === cohortId);
      if (!assignment) return json(res, 200, { assignment: null });
      const template = store.templates.find((t) => t.id === assignment.templateId);
      if (!template) return json(res, 200, { assignment: null });

      return json(res, 200, {
        assignment: {
          ...assignment,
          template
        }
      });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/questions" && req.method === "GET") {
    try {
      const tag = url.searchParams.get("tag");
      const questions = await storageListQuestions(tag || "");
      return json(res, 200, { questions });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/questions" && req.method === "DELETE") {
    try {
      const qs = new URLSearchParams(url.search); // Parse query params for DELETE
      const trainerKey = qs.get("trainerKey");
      const questionId = qs.get("id");

      const access = readAccessConfig();
      if (!access.trainerKey || trainerKey !== access.trainerKey) return json(res, 403, { error: "Forbidden" });

      if (!questionId) return json(res, 400, { error: "Missing question ID" });

      const result = await storageDeleteQuestion(questionId);
      return json(res, 200, result);
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/questions/import" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const trainerKey = String(body.trainerKey || "");
      const access = readAccessConfig();
      if (!access.trainerKey || trainerKey !== access.trainerKey) {
        return json(res, 403, { error: "Forbidden" });
      }

      const cards = Array.isArray(body.cards) ? body.cards : [];
      if (!cards.length) return json(res, 400, { error: "No cards provided" });
      if (cards.length > 10000) return json(res, 400, { error: "Batch too large" });

      const result = await storageImportQuestions(cards, {
        uploadedBy: String(body.uploadedBy || "trainer"),
        reviewRows: Array.isArray(body.reviewRows) ? body.reviewRows : [],
        batchSummary: body.batchSummary && typeof body.batchSummary === "object" ? body.batchSummary : null,
        sourceName: String(body.sourceName || ""),
        notes: String(body.notes || "")
      });
      return json(res, 200, result);
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/import/review" && req.method === "GET") {
    const trainerKey = getTrainerKey(req, url);
    const access = readAccessConfig();
    if (!access.trainerKey || trainerKey !== access.trainerKey) return json(res, 403, { error: "Forbidden" });
    try {
      const status = String(url.searchParams.get("status") || "");
      const items = await storageListImportReviewItems(status);
      return json(res, 200, { items });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/import/review/action" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const trainerKey = String(body.trainerKey || "");
      const access = readAccessConfig();
      if (!access.trainerKey || trainerKey !== access.trainerKey) return json(res, 403, { error: "Forbidden" });
      const item = await storageResolveImportReviewItem({
        reviewId: body.reviewId,
        action: body.action,
        note: body.note
      });
      return json(res, 200, { item });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/import/review/resolve-all" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const trainerKey = String(body.trainerKey || "");
      const access = readAccessConfig();
      if (!access.trainerKey || trainerKey !== access.trainerKey) return json(res, 403, { error: "Forbidden" });
      const result = await storageResolveAllImportReviewItems(body.note);
      return json(res, 200, result);
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/import/batches" && req.method === "GET") {
    const trainerKey = getTrainerKey(req, url);
    const access = readAccessConfig();
    if (!access.trainerKey || trainerKey !== access.trainerKey) return json(res, 403, { error: "Forbidden" });
    try {
      const limit = Number(url.searchParams.get("limit") || 100);
      const batches = await storageListImportBatches(limit);
      return json(res, 200, { batches });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/import/batches/rollback" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const trainerKey = String(body.trainerKey || "");
      const access = readAccessConfig();
      if (!access.trainerKey || trainerKey !== access.trainerKey) return json(res, 403, { error: "Forbidden" });
      const result = await storageRollbackImportBatch(body.batchId);
      return json(res, 200, result);
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/questions/import/preview" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const trainerKey = String(body.trainerKey || "");
      const access = readAccessConfig();
      if (!access.trainerKey || trainerKey !== access.trainerKey) {
        return json(res, 403, { error: "Forbidden" });
      }

      const cards = Array.isArray(body.cards) ? body.cards : [];
      if (!cards.length) return json(res, 400, { error: "No cards provided" });
      if (cards.length > 10000) return json(res, 400, { error: "Batch too large" });

      const result = await storagePreviewImportQuestions(cards);
      return json(res, 200, result);
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/questions/flag" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const question = String(body.question || "").trim();
      const questionId = String(body.questionId || "").trim();
      if (!question || !questionId) return json(res, 400, { error: "Missing question details" });

      const flags = readFlags();
      const now = Date.now();
      const newFlag = {
        id: `flag_${now}_${Math.random().toString(36).slice(2, 8)}`,
        status: "open",
        questionId,
        cardTag: String(body.cardTag || "General").trim(),
        question,
        expectedAnswer: String(body.expectedAnswer || "").trim(),
        reason: String(body.reason || "").trim().slice(0, 500),
        raisedBy: {
          sessionId: String(body.sessionId || ""),
          role: String(body.role || "trainee"),
          userName: String(body.userName || "anonymous").trim(),
          userEmail: normalizeEmail(body.userEmail || "")
        },
        createdAt: now,
        updatedAt: now,
        resolution: null
      };

      flags.unshift(newFlag);
      writeFlags(flags);
      return json(res, 201, { flag: newFlag });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/questions/flags" && req.method === "GET") {
    const trainerKey = getTrainerKey(req, url);
    const access = readAccessConfig();
    if (!access.trainerKey || trainerKey !== access.trainerKey) return json(res, 403, { error: "Forbidden" });

    const status = String(url.searchParams.get("status") || "").trim().toLowerCase();
    const all = readFlags();
    const filtered = status ? all.filter((item) => String(item.status || "").toLowerCase() === status) : all;
    return json(res, 200, { flags: filtered.slice(0, 1000) });
  }

  if (url.pathname === "/api/questions/flags/action" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const trainerKey = String(body.trainerKey || "");
      const access = readAccessConfig();
      if (!access.trainerKey || trainerKey !== access.trainerKey) return json(res, 403, { error: "Forbidden" });

      const flagId = String(body.flagId || "").trim();
      const action = String(body.action || "").trim().toLowerCase();
      if (!flagId || !action) return json(res, 400, { error: "flagId and action are required" });

      const flags = readFlags();
      const idx = flags.findIndex((item) => item.id === flagId);
      if (idx < 0) return json(res, 404, { error: "Flag not found" });

      if (action === "resolve") {
        flags[idx].status = "resolved";
        flags[idx].updatedAt = Date.now();
        flags[idx].resolution = {
          action: "resolved",
          note: String(body.note || "").trim().slice(0, 300),
          by: "trainer",
          at: Date.now()
        };
        writeFlags(flags);
        return json(res, 200, { flag: flags[idx] });
      }

      if (action === "replace") {
        const updated = await storageReplaceQuestion({
          questionId: flags[idx].questionId,
          tag: body.newTag || flags[idx].cardTag,
          question: body.newQuestion,
          answer: body.newAnswer,
          originalTag: flags[idx].cardTag,
          originalQuestion: flags[idx].question,
          originalAnswer: flags[idx].expectedAnswer
        });

        flags[idx].status = "replaced";
        flags[idx].updatedAt = Date.now();
        flags[idx].resolution = {
          action: "replaced",
          by: "trainer",
          at: Date.now(),
          replacement: updated
        };
        writeFlags(flags);
        return json(res, 200, { flag: flags[idx], updatedQuestion: updated });
      }

      return json(res, 400, { error: "Unsupported action" });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/cta/event" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const type = String(body.type || "").trim();
      if (!type) return json(res, 400, { error: "Event type is required" });

      const events = readCtaEvents();
      const event = {
        id: `cta_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type,
        sessionId: String(body.sessionId || ""),
        role: String(body.role || ""),
        userName: String(body.userName || ""),
        userEmail: normalizeEmail(body.userEmail || ""),
        userPhone: normalizePhone(body.userPhone || ""),
        metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
        at: Date.now()
      };
      events.unshift(event);
      if (events.length > 50000) events.length = 50000;
      writeCtaEvents(events);
      return json(res, 201, { ok: true, id: event.id });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/cta/events" && req.method === "GET") {
    const trainerKey = getTrainerKey(req, url);
    const access = readAccessConfig();
    if (!access.trainerKey || trainerKey !== access.trainerKey) return json(res, 403, { error: "Forbidden" });
    const limit = Math.max(1, Math.min(5000, Number(url.searchParams.get("limit") || 500)));
    const events = readCtaEvents().slice(0, limit);
    return json(res, 200, { events });
  }

  if (url.pathname === "/api/session/start" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const role = String(body.role || "trainee");
      const userEmail = String(body.userEmail || "");
      const userPhone = String(body.userPhone || "");

      if (role === "trial") {
        const used = await hasPriorTrialUsage({ email: userEmail, phone: userPhone });
        if (used) {
          return json(res, 403, {
            error: "Trial already used with this email or phone. For full access, contact PracticeBuddy Lab by CodingBuddy360."
          });
        }
      }

      const result = await storageStartSession({
        sessionId: String(body.sessionId || `session_${Math.random().toString(36).slice(2, 10)}`),
        userName: String(body.userName || "anonymous"),
        userEmail,
        userPhone,
        role
      });

      return json(res, result.reused ? 200 : 201, result);
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/session/answer" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const sessionId = String(body.sessionId || "");
      if (!sessionId) return json(res, 400, { error: "Missing sessionId" });

      await storageLogAnswer({
        sessionId,
        cardTag: String(body.cardTag || "General"),
        question: String(body.question || ""),
        expectedAnswer: String(body.expectedAnswer || ""),
        acceptedAnswers: Array.isArray(body.acceptedAnswers) ? body.acceptedAnswers : [],
        userAnswer: String(body.userAnswer || ""),
        isCorrect: Boolean(body.isCorrect),
        isSkipped: Boolean(body.isSkipped),
        at: Number(body.at || Date.now())
      });

      return json(res, 201, { ok: true });
    } catch (err) {
      const message = err.message || "Unknown error";
      const status = message.includes("Session not found") ? 404 : 400;
      return json(res, status, { error: message });
    }
  }

  if (url.pathname === "/api/session/end" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const sessionId = String(body.sessionId || "");
      if (!sessionId) return json(res, 400, { error: "Missing sessionId" });

      await storageEndSession({
        sessionId,
        summary: body.summary && typeof body.summary === "object" ? body.summary : null
      });

      return json(res, 200, { ok: true });
    } catch (err) {
      const message = err.message || "Unknown error";
      const status = message.includes("Session not found") ? 404 : 400;
      return json(res, status, { error: message });
    }
  }

  if (url.pathname === "/api/sessions" && req.method === "GET") {
    const key = getTrainerKey(req, url);
    const access = readAccessConfig();
    if (!access.trainerKey || key !== access.trainerKey) return json(res, 403, { error: "Forbidden" });

    try {
      const sessions = await storageListSessions();
      return json(res, 200, { sessions });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  return serveFile(url.pathname, res);
});

server.listen(PORT, HOST, () => {
  if (!USE_SUPABASE) ensureDataStore();
  console.log(`MedCode app running at http://${HOST}:${PORT}`);
  console.log(`Storage mode: ${USE_SUPABASE ? "Supabase" : "File"}`);
});
