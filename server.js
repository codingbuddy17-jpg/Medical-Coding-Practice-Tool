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
const DATA_DIR = path.join(ROOT, "data");
const SESSION_FILE = path.join(DATA_DIR, "sessions.json");
const QUESTIONS_FILE = path.join(DATA_DIR, "questions.json");
const ACCESS_FILE = path.join(DATA_DIR, "access-config.json");
const COHORTS_FILE = path.join(DATA_DIR, "cohorts.json");

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
      trialQuestionLimit: Number(parsed.trialQuestionLimit || 20),
      updatedAt: Number(parsed.updatedAt || Date.now())
    };
  } catch {
    return {
      trainerKey: TRAINER_KEY,
      traineeAccessCode: TRAINEE_ACCESS_CODE,
      trialQuestionLimit: 20,
      updatedAt: Date.now()
    };
  }
}

function writeAccessConfig(config) {
  ensureDataStore();
  const payload = {
    trainerKey: String(config.trainerKey || ""),
    traineeAccessCode: String(config.traineeAccessCode || ""),
    trialQuestionLimit: Math.max(1, Number(config.trialQuestionLimit || 20)),
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

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
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
      if (body.length > 1e6) {
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
  return "text/plain; charset=utf-8";
}

function serveFile(reqPath, res) {
  const safePath = reqPath === "/" ? "/index.html" : reqPath;
  const filePath = path.join(ROOT, safePath);

  if (!filePath.startsWith(ROOT)) return notFound(res);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return notFound(res);

  const data = fs.readFileSync(filePath);
  res.writeHead(200, { "Content-Type": contentType(filePath) });
  res.end(data);
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
    contactMessage: "Contact Admin for full access. Contact or WhatsApp at +91 8309661352."
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

function listCohortsSummary() {
  return readCohorts().map((cohort) => ({
    id: cohort.id,
    name: cohort.name,
    accessCode: cohort.accessCode,
    isActive: Boolean(cohort.isActive),
    questionLimit: Number(cohort.questionLimit || 1000000),
    memberCount: Array.isArray(cohort.members) ? cohort.members.length : 0,
    createdAt: Number(cohort.createdAt || Date.now()),
    updatedAt: Number(cohort.updatedAt || Date.now())
  }));
}

function createCohort({ name, accessCode, questionLimit, isActive }) {
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
    members: [],
    createdAt: now,
    updatedAt: now
  };
  cohorts.unshift(newCohort);
  writeCohorts(cohorts);
  return newCohort;
}

function updateCohort({ cohortId, name, accessCode, questionLimit, isActive }) {
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
  cohorts[idx].updatedAt = Date.now();
  writeCohorts(cohorts);
  return cohorts[idx];
}

function enrollCohortMember({ cohortId, email, name, phone }) {
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

async function upsertUserAndEntitlement({ userName, userEmail, userPhone, role }) {
  if (!USE_SUPABASE || !userEmail) return;

  const roleValue = role === "trainer" ? "trainer" : role === "trainee" ? "trainee" : "trial";
  const access = readAccessConfig();
  const questionLimit = roleValue === "trial" ? Math.max(1, Number(access.trialQuestionLimit || 20)) : 1000000;

  const userPayload = {
    name: userName || "anonymous",
    email: userEmail,
    phone: userPhone || "",
    role: roleValue
  };

  const { error: userError } = await supabase.from("users").upsert(userPayload, { onConflict: "email" });
  if (userError) throw userError;

  const entPayload = {
    email: userEmail,
    access_type: roleValue,
    question_limit: questionLimit
  };

  const { error: entError } = await supabase.from("entitlements").upsert(entPayload, { onConflict: "email" });
  if (entError) throw entError;
}

async function storageStartSession({ sessionId, userName, userEmail, userPhone, role }) {
  if (!USE_SUPABASE) {
    const sessions = readSessions();
    if (findSessionIndex(sessions, sessionId) >= 0) return { id: sessionId, reused: true };

    sessions.unshift({
      id: sessionId,
      userName,
      userEmail,
      userPhone,
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
    user_email: userEmail,
    user_phone: userPhone,
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
      at: Number(at || Date.now())
    });

    const correct = sessions[idx].answers.filter((a) => a.isCorrect).length;
    const attempted = sessions[idx].answers.length;
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
    .eq("session_id", sessionId);
  if (attemptedRes.error) throw attemptedRes.error;

  const correctRes = await supabase
    .from("attempts")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("is_correct", true);
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

async function storageImportQuestions(cards) {
  const sanitized = cards.map(sanitizeQuestionCard).filter((c) => c.question && c.answer);
  const uniqueIncoming = [];
  const incomingSeen = new Set();
  for (const card of sanitized) {
    const key = questionCompositeKey(card.tag, card.question, card.answer);
    if (incomingSeen.has(key)) continue;
    incomingSeen.add(key);
    uniqueIncoming.push(card);
  }

  if (!uniqueIncoming.length) return { inserted: 0, skipped: cards.length };

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
    return { inserted: newRows.length, skipped: cards.length - newRows.length };
  }

  const { data: existingRows, error: existingErr } = await supabase
    .from("questions")
    .select("tag,question,answer")
    .eq("is_active", true);
  if (existingErr) throw existingErr;

  const existingSet = new Set((existingRows || []).map((q) => questionCompositeKey(q.tag, q.question, q.answer)));
  const toInsert = uniqueIncoming.filter((c) => !existingSet.has(questionCompositeKey(c.tag, c.question, c.answer)));

  if (!toInsert.length) return { inserted: 0, skipped: cards.length };

  const payload = toInsert.map((c) => ({
    tag: c.tag,
    question: c.question,
    answer: c.answer,
    is_active: true
  }));

  const { error: insertErr } = await supabase.from("questions").insert(payload);
  if (insertErr) throw insertErr;

  return { inserted: payload.length, skipped: cards.length - payload.length };
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
      const access = readAccessConfig();
      if (Boolean(access.traineeAccessCode) && code === access.traineeAccessCode) {
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

  if (url.pathname === "/api/admin/access-config" && req.method === "GET") {
    const key = url.searchParams.get("adminKey");
    if (!isAdminAuthorized(key)) return json(res, 403, { error: "Forbidden" });
    const config = readAccessConfig();
    return json(res, 200, {
      trainerKey: config.trainerKey || "",
      traineeAccessCode: config.traineeAccessCode || "",
      trialQuestionLimit: Math.max(1, Number(config.trialQuestionLimit || 20)),
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
        trialQuestionLimit:
          body.trialQuestionLimit !== undefined ? Math.max(1, Number(body.trialQuestionLimit || 20)) : existing.trialQuestionLimit
      });
      return json(res, 200, next);
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/admin/cohorts" && req.method === "GET") {
    const key = url.searchParams.get("adminKey");
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
          isActive: body.isActive
        });
        return json(res, 200, { cohort: updated });
      }

      const created = createCohort({
        name: body.name,
        accessCode: body.accessCode,
        questionLimit: body.questionLimit,
        isActive: body.isActive
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
        phone: body.phone
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

  if (url.pathname === "/api/questions" && req.method === "GET") {
    try {
      const tag = url.searchParams.get("tag");
      const questions = await storageListQuestions(tag || "");
      return json(res, 200, { questions });
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

      const result = await storageImportQuestions(cards);
      return json(res, 200, result);
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/session/start" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const result = await storageStartSession({
        sessionId: String(body.sessionId || `session_${Math.random().toString(36).slice(2, 10)}`),
        userName: String(body.userName || "anonymous"),
        userEmail: String(body.userEmail || ""),
        userPhone: String(body.userPhone || ""),
        role: String(body.role || "trainee")
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
    const key = url.searchParams.get("trainerKey");
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
