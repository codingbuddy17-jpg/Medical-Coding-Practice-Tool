const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { createClient } = require("@supabase/supabase-js");
const pdfParse = require("pdf-parse"); // v1.1.1 — exports function directly

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
const MAX_BODY_SIZE = Number(process.env.MAX_BODY_SIZE || 50 * 1024 * 1024); // 50MB — supports large PDF/DOCX uploads
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
const ALLOWED_LEARNERS_FILE = path.join(DATA_DIR, "allowed-learners.json");
const AUDIT_LOG_FILE = path.join(DATA_DIR, "audit-log.json");
const TENANTS_FILE = path.join(DATA_DIR, "tenants.json");
const TAGS_FILE = path.join(DATA_DIR, "tags.json");
const MCQ_PREFIX = "__MCQ__:";
const CARD_PREFIX = "__CARD__:";
const SUPER_ADMIN_KEY = process.env.SUPER_ADMIN_KEY || "";
let attemptsSupportsDurationMs = true;
const VERIFY_RATE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const VERIFY_RATE_LIMIT = 12; // attempts per window per endpoint+IP
const verifyRateLimitStore = new Map();

const DEFAULT_TAGS = [
  { key: "ICD-10-CM", label: "ICD 10 CM", aliases: ["ICD10CM", "ICD 10 CM"], isActive: true, sortOrder: 10 },
  { key: "ICD-10-PCS", label: "ICD 10 PCS", aliases: ["ICD10PCS", "ICD 10 PCS"], isActive: true, sortOrder: 20 },
  { key: "CPT", label: "CPT", aliases: [], isActive: true, sortOrder: 30 },
  { key: "MODIFIERS", label: "Modifiers", aliases: ["MODIFIER"], isActive: true, sortOrder: 40 },
  { key: "GUIDELINES", label: "Guidelines", aliases: ["GUIDELINE"], isActive: true, sortOrder: 50 },
  { key: "CCS", label: "CCS", aliases: [], isActive: true, sortOrder: 60 },
  { key: "CPC", label: "CPC", aliases: [], isActive: true, sortOrder: 70 },
  { key: "CDIP", label: "CDIP", aliases: [], isActive: true, sortOrder: 80 },
  { key: "SURGERY-CODING", label: "Surgery Coding", aliases: ["SURGERY CODING"], isActive: true, sortOrder: 90 },
  { key: "IP-DRG-CODING", label: "IP-DRG Coding", aliases: ["IP DRG", "IP DRG CODING"], isActive: true, sortOrder: 100 },
  { key: "MEDICINE", label: "Medicine", aliases: [], isActive: true, sortOrder: 110 },
  { key: "PRACTICE-CASES", label: "Practice Cases", aliases: ["PRACTICE CASES"], isActive: true, sortOrder: 120 }
];

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
  if (!fs.existsSync(ALLOWED_LEARNERS_FILE)) fs.writeFileSync(ALLOWED_LEARNERS_FILE, JSON.stringify({ learners: [] }, null, 2));
  if (!fs.existsSync(AUDIT_LOG_FILE)) fs.writeFileSync(AUDIT_LOG_FILE, JSON.stringify({ events: [] }, null, 2));
  if (!fs.existsSync(TENANTS_FILE)) fs.writeFileSync(TENANTS_FILE, JSON.stringify({ tenants: [] }, null, 2));
  if (!fs.existsSync(TAGS_FILE)) fs.writeFileSync(TAGS_FILE, JSON.stringify({ tags: DEFAULT_TAGS }, null, 2));
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

function readAllowedLearners() {
  ensureDataStore();
  const raw = fs.readFileSync(ALLOWED_LEARNERS_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.learners) ? parsed.learners : [];
  } catch {
    return [];
  }
}

function writeAllowedLearners(learners) {
  ensureDataStore();
  fs.writeFileSync(ALLOWED_LEARNERS_FILE, JSON.stringify({ learners }, null, 2));
}

const AUDIT_LOG_CAP = 5000;

function readAuditLog() {
  ensureDataStore();
  const raw = fs.readFileSync(AUDIT_LOG_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.events) ? parsed.events : [];
  } catch {
    return [];
  }
}

async function appendAuditEvent({ action, actor, actorRole, ip, meta }) {
  const event = {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    action: String(action || "unknown"),
    actor: String(actor || ""),
    actorRole: String(actorRole || ""),
    ip: String(ip || ""),
    meta: meta && typeof meta === "object" ? meta : {}
  };

  if (USE_SUPABASE) {
    try {
      await supabase.from("audit_log").insert({
        event_id: event.id,
        ts: event.ts,
        action: event.action,
        actor: event.actor,
        actor_role: event.actorRole,
        ip: event.ip,
        meta: event.meta
      });
      return event;
    } catch {
      // Table may not exist yet — fall through to file
    }
  }

  ensureDataStore();
  const events = readAuditLog();
  events.unshift(event);
  if (events.length > AUDIT_LOG_CAP) events.length = AUDIT_LOG_CAP;
  fs.writeFileSync(AUDIT_LOG_FILE, JSON.stringify({ events }, null, 2));
  return event;
}

// ── Multi-tenant ─────────────────────────────────────────────────────────────

function readTenants() {
  ensureDataStore();
  const raw = fs.readFileSync(TENANTS_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.tenants) ? parsed.tenants : [];
  } catch {
    return [];
  }
}

function writeTenants(tenants) {
  ensureDataStore();
  fs.writeFileSync(TENANTS_FILE, JSON.stringify({ tenants }, null, 2));
}

function normalizeTagLabel(label) {
  return String(label || "").trim().slice(0, 120);
}

function normalizeTagKeyInput(key) {
  return String(key || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function splitTagValuesInput(value) {
  return Array.from(
    new Set(
      String(value || "")
        .split(/[,\n;|]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function getCanonicalTagKeysInput(value) {
  return Array.from(new Set(splitTagValuesInput(value).map((item) => normalizeTagKeyInput(item)).filter(Boolean)));
}

function mergeTagValueString(value, sourceKeys, targetKey) {
  const sourceSet = new Set(
    (Array.isArray(sourceKeys) ? sourceKeys : [sourceKeys])
      .map((item) => normalizeTagKeyInput(item))
      .filter(Boolean)
  );
  const target = normalizeTagKeyInput(targetKey);
  const next = splitTagValuesInput(value).map((item) => {
    const normalized = normalizeTagKeyInput(item);
    return sourceSet.has(normalized) ? target : normalized;
  }).filter(Boolean);
  return Array.from(new Set(next)).join(", ");
}

function normalizeTagAliases(aliases) {
  const source = Array.isArray(aliases)
    ? aliases
    : String(aliases || "")
      .split(",")
      .map((item) => item.trim());
  return Array.from(new Set(source.map((item) => String(item || "").trim()).filter(Boolean))).slice(0, 50);
}

function humanizeTagKey(tagKey) {
  return String(tagKey || "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.length <= 4 ? part : `${part.slice(0, 1)}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

async function listQuestionTagKeys() {
  if (!USE_SUPABASE) {
    return readQuestions()
      .filter((q) => q.is_active !== false)
      .flatMap((q) => getCanonicalTagKeysInput(q.tag))
      .filter(Boolean);
  }

  const batchSize = 1000;
  let from = 0;
  const keys = [];
  while (true) {
    const { data, error } = await supabase
      .from("questions")
      .select("tag")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .range(from, from + batchSize - 1);
    if (error) throw error;
    const rows = data || [];
    keys.push(...rows.flatMap((row) => getCanonicalTagKeysInput(row.tag)).filter(Boolean));
    if (rows.length < batchSize) break;
    from += batchSize;
  }
  return keys;
}

async function mergeDiscoveredTags(tags) {
  const map = new Map();
  (Array.isArray(tags) ? tags : []).forEach((tag, idx) => {
    const key = normalizeTagKeyInput(tag.key);
    if (!key) return;
    map.set(key, {
      ...tag,
      key,
      label: normalizeTagLabel(tag.label || key) || humanizeTagKey(key),
      aliases: normalizeTagAliases(tag.aliases),
      isActive: tag.isActive !== false,
      sortOrder: Number(tag.sortOrder || ((idx + 1) * 10))
    });
  });

  const discovered = new Set();
  (await listQuestionTagKeys()).forEach((key) => discovered.add(key));
  readTenants().forEach((tenant) => {
    (tenant.settings?.allowedTags || []).forEach((tag) => discovered.add(normalizeTagKeyInput(tag)));
  });
  readExamStore().templates.forEach((tpl) => {
    (tpl.tags || []).forEach((tag) => discovered.add(normalizeTagKeyInput(tag)));
  });

  discovered.forEach((key) => {
    if (!key || map.has(key)) return;
    map.set(key, {
      key,
      label: humanizeTagKey(key),
      aliases: [],
      isActive: true,
      sortOrder: (map.size + 1) * 10,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  });

  return Array.from(map.values());
}

function mapTagRow(row) {
  return {
    key: normalizeTagKeyInput(row.key),
    label: normalizeTagLabel(row.label || row.key),
    aliases: normalizeTagAliases(row.aliases),
    isActive: row.is_active !== false,
    sortOrder: Number(row.sort_order || 0),
    createdAt: toEpochMs(row.created_at) || Date.now(),
    updatedAt: toEpochMs(row.updated_at) || Date.now()
  };
}

function isMissingTagsTable(error) {
  const msg = String(error?.message || "").toLowerCase();
  return error?.code === "42P01" || msg.includes("tags") && msg.includes("does not exist");
}

async function readTags() {
  if (USE_SUPABASE) {
    const { data, error } = await supabase
      .from("tags")
      .select("key,label,aliases,is_active,sort_order,created_at,updated_at")
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true });
    if (!error) {
      const rows = (data || []).map(mapTagRow);
      const existingKeys = new Set(rows.map((row) => normalizeTagKeyInput(row.key)));
      const missingDefaults = DEFAULT_TAGS.filter((item) => !existingKeys.has(normalizeTagKeyInput(item.key)));
      if (missingDefaults.length) {
        const seedPayload = missingDefaults.map((item, idx) => ({
          key: normalizeTagKeyInput(item.key),
          label: normalizeTagLabel(item.label || item.key),
          aliases: normalizeTagAliases(item.aliases),
          is_active: item.isActive !== false,
          sort_order: Number(item.sortOrder || ((idx + 1) * 10))
        }));
        const { error: seedError } = await supabase.from("tags").upsert(seedPayload, { onConflict: "key" });
        if (!seedError) {
          return mergeDiscoveredTags([...DEFAULT_TAGS, ...rows]);
        }
      }
      return mergeDiscoveredTags([...DEFAULT_TAGS, ...rows]);
    }
    if (!isMissingTagsTable(error)) {
      console.error("Tags read failed from Supabase, using file fallback:", error.message || error);
    }
  }
  ensureDataStore();
  const raw = fs.readFileSync(TAGS_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw);
    const tags = Array.isArray(parsed.tags) ? parsed.tags : [];
    return mergeDiscoveredTags(tags.length ? [...DEFAULT_TAGS, ...tags] : DEFAULT_TAGS);
  } catch {
    return mergeDiscoveredTags(DEFAULT_TAGS);
  }
}

function writeTags(tags) {
  ensureDataStore();
  fs.writeFileSync(TAGS_FILE, JSON.stringify({ tags }, null, 2));
}

async function listTags({ includeInactive = false } = {}) {
  const tags = (await readTags())
    .map((tag, idx) => ({
      key: normalizeTagKeyInput(tag.key),
      label: normalizeTagLabel(tag.label || tag.key),
      aliases: normalizeTagAliases(tag.aliases),
      isActive: tag.isActive !== false,
      sortOrder: Number(tag.sortOrder || ((idx + 1) * 10)),
      createdAt: Number(tag.createdAt || Date.now()),
      updatedAt: Number(tag.updatedAt || Date.now())
    }))
    .filter((tag) => tag.key);
  const filtered = includeInactive ? tags : tags.filter((tag) => tag.isActive !== false);
  return filtered.sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || String(a.label).localeCompare(String(b.label)));
}

async function createOrUpdateTag({ key, label, aliases, isActive }) {
  const tags = await readTags();
  const cleanKey = normalizeTagKeyInput(key || label);
  const cleanLabel = normalizeTagLabel(label || key);
  if (!cleanKey) throw new Error("Tag key is required");
  if (!cleanLabel) throw new Error("Tag label is required");
  const now = Date.now();
  const idx = tags.findIndex((item) => normalizeTagKeyInput(item.key) === cleanKey);
  const next = {
    key: cleanKey,
    label: cleanLabel,
    aliases: normalizeTagAliases(aliases),
    isActive: isActive !== false,
    sortOrder: idx >= 0 ? Number(tags[idx].sortOrder || ((idx + 1) * 10)) : ((tags.length + 1) * 10),
    updatedAt: now
  };
  if (idx >= 0) {
    tags[idx] = { ...tags[idx], ...next };
  } else {
    tags.push({ ...next, createdAt: now });
  }
  if (USE_SUPABASE) {
    const payload = {
      key: cleanKey,
      label: cleanLabel,
      aliases: normalizeTagAliases(aliases),
      is_active: isActive !== false,
      sort_order: next.sortOrder
    };
    const { data, error } = await supabase
      .from("tags")
      .upsert(payload, { onConflict: "key" })
      .select("key,label,aliases,is_active,sort_order,created_at,updated_at")
      .single();
    if (!error) return mapTagRow(data);
    if (!isMissingTagsTable(error)) {
      console.error("Tags write failed to Supabase, using file fallback:", error.message || error);
    }
  }
  writeTags(tags);
  return (await listTags({ includeInactive: true })).find((item) => item.key === cleanKey) || next;
}

async function countTagUsage(tagKey) {
  const key = normalizeTagKeyInput(tagKey);
  let questionUsage = 0;
  if (!USE_SUPABASE) {
    questionUsage = readQuestions().filter((q) => q.is_active !== false && getCanonicalTagKeysInput(q.tag).includes(key)).length;
  } else {
    const { data, error } = await supabase
      .from("questions")
      .select("tag")
      .eq("is_active", true);
    if (error) throw error;
    questionUsage = (data || []).filter((row) => getCanonicalTagKeysInput(row.tag).includes(key)).length;
  }
  const tenantUsage = readTenants().filter((t) => Array.isArray(t.settings?.allowedTags) && t.settings.allowedTags.some((tag) => normalizeTagKeyInput(tag) === key)).length;
  const templateUsage = readExamStore().templates.filter((tpl) => Array.isArray(tpl.tags) && tpl.tags.some((tag) => normalizeTagKeyInput(tag) === key)).length;
  return { questionUsage, tenantUsage, templateUsage, total: questionUsage + tenantUsage + templateUsage };
}

async function deleteTag(tagKey) {
  const key = normalizeTagKeyInput(tagKey);
  if (!key) throw new Error("Tag key is required");
  const usage = await countTagUsage(key);
  if (usage.total > 0) throw new Error(`Tag is still in use (${usage.total} references)`);
  if (USE_SUPABASE) {
    const { error } = await supabase.from("tags").delete().eq("key", key);
    if (!error) return { key, deleted: true };
    if (!isMissingTagsTable(error)) {
      console.error("Tags delete failed in Supabase, using file fallback:", error.message || error);
    }
  }
  const tags = await readTags();
  const next = tags.filter((item) => normalizeTagKeyInput(item.key) !== key);
  if (next.length === tags.length) throw new Error("Tag not found");
  writeTags(next);
  return { key, deleted: true };
}

async function getTagSummary() {
  const tags = await listTags({ includeInactive: true });
  return Promise.all(tags.map(async (tag) => ({ ...tag, usage: await countTagUsage(tag.key) })));
}

async function mergeTags({ sourceKey, targetKey }) {
  const source = normalizeTagKeyInput(sourceKey);
  const target = normalizeTagKeyInput(targetKey);
  if (!source || !target) throw new Error("Source and target tags are required");
  if (source === target) throw new Error("Source and target tags must be different");

  const tags = await readTags();
  const sourceTag = tags.find((item) => normalizeTagKeyInput(item.key) === source);
  const targetTag = tags.find((item) => normalizeTagKeyInput(item.key) === target);
  if (!sourceTag) throw new Error("Source tag not found");
  if (!targetTag) throw new Error("Target tag not found");
  const sourceMatchers = Array.from(new Set([sourceTag.key, sourceTag.label].concat(sourceTag.aliases || []).map((item) => normalizeTagKeyInput(item)).filter(Boolean)));

  let updatedQuestions = 0;
  let updatedTenants = 0;
  let updatedTemplates = 0;

  if (!USE_SUPABASE) {
    const questions = readQuestions();
    questions.forEach((question) => {
      const nextTag = mergeTagValueString(question.tag, sourceMatchers, target);
      if (nextTag && nextTag !== String(question.tag || "").trim()) {
        question.tag = nextTag;
        updatedQuestions += 1;
      }
    });
    writeQuestions(questions);
  } else {
    const batchSize = 1000;
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("questions")
        .select("id,tag")
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .range(from, from + batchSize - 1);
      if (error) throw error;
      const rows = data || [];
      for (const row of rows) {
        const nextTag = mergeTagValueString(row.tag, sourceMatchers, target);
        if (nextTag && nextTag !== String(row.tag || "").trim()) {
          const { error: updateErr } = await supabase.from("questions").update({ tag: nextTag }).eq("id", row.id);
          if (updateErr) throw updateErr;
          updatedQuestions += 1;
        }
      }
      if (rows.length < batchSize) break;
      from += batchSize;
    }
  }

  const tenants = readTenants();
  tenants.forEach((tenant) => {
    if (!Array.isArray(tenant.settings?.allowedTags)) return;
    const nextTags = Array.from(new Set(tenant.settings.allowedTags.map((tag) => {
      const normalized = normalizeTagKeyInput(tag);
      return sourceMatchers.includes(normalized) ? target : normalized;
    }).filter(Boolean)));
    if (JSON.stringify(nextTags) !== JSON.stringify(tenant.settings.allowedTags)) {
      tenant.settings.allowedTags = nextTags;
      updatedTenants += 1;
    }
  });
  writeTenants(tenants);

  const examStore = readExamStore();
  examStore.templates.forEach((tpl) => {
    if (!Array.isArray(tpl.tags)) return;
    const nextTags = Array.from(new Set(tpl.tags.map((tag) => {
      const normalized = normalizeTagKeyInput(tag);
      return sourceMatchers.includes(normalized) ? target : normalized;
    }).filter(Boolean)));
    if (JSON.stringify(nextTags) !== JSON.stringify(tpl.tags)) {
      tpl.tags = nextTags;
      updatedTemplates += 1;
    }
  });
  writeExamStore(examStore);

  const existingAliases = normalizeTagAliases(targetTag.aliases);
  const sourceAliases = [sourceTag.label, sourceTag.key].concat(sourceTag.aliases || []);
  const mergedTarget = await createOrUpdateTag({
    key: targetTag.key,
    label: targetTag.label,
    aliases: Array.from(new Set(existingAliases.concat(sourceAliases).filter(Boolean))),
    isActive: targetTag.isActive !== false
  });

  if (USE_SUPABASE) {
    const { error } = await supabase.from("tags").delete().eq("key", source);
    if (error && !isMissingTagsTable(error)) throw error;
  } else {
    writeTags(tags.filter((item) => normalizeTagKeyInput(item.key) !== source));
  }

  if (!USE_SUPABASE) {
    const remaining = await readTags();
    writeTags(remaining.filter((item) => normalizeTagKeyInput(item.key) !== source));
  }

  return {
    sourceKey: source,
    targetKey: target,
    updatedQuestions,
    updatedTenants,
    updatedTemplates,
    targetTag: mergedTarget
  };
}

function getDefaultTenant() {
  const config = readAccessConfig();
  return {
    id: "default",
    slug: "default",
    name: "PracticeBuddy Lab",
    trainerKey: config.trainerKey || TRAINER_KEY || "",
    adminKey: ADMIN_KEY || "",
    isActive: true,
    settings: {
      trialQuestionLimit: config.trialQuestionLimit || 20,
      maxSessionQuestions: config.maxSessionQuestions || 250
    }
  };
}

function resolveTenant(req) {
  const slug = String(req.headers["x-tenant-slug"] || "").trim().toLowerCase();
  if (!slug || slug === "default") return getDefaultTenant();
  const tenants = readTenants();
  const tenant = tenants.find((t) => t.slug === slug && t.isActive !== false);
  return tenant || getDefaultTenant();
}

function isSuperAdminAuthorized(key) {
  const k = String(key || "").trim();
  if (SUPER_ADMIN_KEY) return k === SUPER_ADMIN_KEY;
  return Boolean(ADMIN_KEY) && k === ADMIN_KEY;
}

function sanitizeTenantSlug(slug) {
  return String(slug || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
}

function createOrUpdateTenant({ tenantId, slug, name, contactEmail, adminKey, isActive, settings }) {
  const tenants = readTenants();
  const cleanSlug = sanitizeTenantSlug(slug);
  if (!cleanSlug || cleanSlug === "default") throw new Error("Invalid slug. 'default' is reserved.");
  if (!String(name || "").trim()) throw new Error("Tenant name is required.");
  const now = Date.now();

  if (tenantId) {
    const idx = tenants.findIndex((t) => t.id === tenantId);
    if (idx < 0) throw new Error("Tenant not found.");
    const existing = tenants[idx];
    if (cleanSlug !== existing.slug && tenants.some((t) => t.slug === cleanSlug)) {
      throw new Error(`Slug '${cleanSlug}' is already in use.`);
    }
    const mergedSettings = settings && typeof settings === "object"
      ? { ...existing.settings, ...settings }
      : existing.settings;
    if (Array.isArray(settings?.allowedTags)) {
      mergedSettings.allowedTags = settings.allowedTags.map((t) => String(t || "").trim().toUpperCase()).filter(Boolean);
    }
    if (settings?.maxUsers !== undefined) {
      mergedSettings.maxUsers = Math.max(1, Number(settings.maxUsers || 50));
    }
    tenants[idx] = {
      ...existing,
      slug: cleanSlug,
      name: String(name || existing.name).trim().slice(0, 120),
      contactEmail: contactEmail !== undefined ? String(contactEmail || "").trim().toLowerCase() : existing.contactEmail,
      adminKey: adminKey !== undefined ? String(adminKey || "").trim() : existing.adminKey,
      isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive,
      settings: mergedSettings,
      updatedAt: now
    };
    writeTenants(tenants);
    return tenants[idx];
  }

  if (tenants.some((t) => t.slug === cleanSlug)) throw new Error(`Slug '${cleanSlug}' is already in use.`);
  const newTenant = {
    id: `tenant_${now}_${Math.random().toString(36).slice(2, 8)}`,
    slug: cleanSlug,
    name: String(name).trim().slice(0, 120),
    contactEmail: String(contactEmail || "").trim().toLowerCase(),
    adminKey: String(adminKey || "").trim(),
    isActive: isActive !== false,
    settings: {
      trialQuestionLimit: Math.max(1, Number(settings?.trialQuestionLimit || 20)),
      maxSessionQuestions: Math.max(1, Number(settings?.maxSessionQuestions || 250)),
      allowedTags: Array.isArray(settings?.allowedTags)
        ? settings.allowedTags.map((t) => String(t || "").trim().toUpperCase()).filter(Boolean)
        : [],
      maxUsers: Math.max(1, Number(settings?.maxUsers || 50))
    },
    createdAt: now,
    updatedAt: now
  };
  tenants.push(newTenant);
  writeTenants(tenants);
  return newTenant;
}

function resolveInstituteFromKey(key) {
  if (!key) return null;
  const k = String(key).trim();
  return readTenants().find((t) => t.isActive !== false && Boolean(t.adminKey) && t.adminKey === k) || null;
}

// ─────────────────────────────────────────────────────────────────────────────

function toEpochMs(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Date.parse(String(value));
  if (Number.isFinite(parsed)) return parsed;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapLearnerRow(row) {
  return {
    email: normalizeEmail(row.email),
    name: String(row.name || "").trim(),
    accessCode: String(row.access_code || row.accessCode || "").trim(),
    phone: String(row.phone || "").trim(),
    isActive: row.is_active !== false,
    expiresAt: row.expires_at ? toEpochMs(row.expires_at) : null,
    tenantId: row.tenant_id || row.tenantId || null,
    createdAt: toEpochMs(row.created_at) || Date.now(),
    updatedAt: toEpochMs(row.updated_at) || Date.now()
  };
}

function isMissingLearnerTable(error) {
  const msg = String(error?.message || "").toLowerCase();
  return error?.code === "42P01" || msg.includes("learner_access") && msg.includes("does not exist");
}

function applyLearnerTenantFilter(query, tenantId) {
  if (tenantId === undefined || tenantId === null || tenantId === "") {
    return query;
  }
  if (tenantId && tenantId !== "default") {
    return query.eq("tenant_id", tenantId);
  }
  return query.or("tenant_id.is.null,tenant_id.eq.default");
}

async function readAllowedLearnersStore(tenantId) {
  if (USE_SUPABASE) {
    let query = supabase
      .from("learner_access")
      .select("email,name,access_code,phone,is_active,expires_at,tenant_id,created_at,updated_at")
      .order("updated_at", { ascending: false });
    query = applyLearnerTenantFilter(query, tenantId);
    const { data, error } = await query;
    if (!error) return (data || []).map(mapLearnerRow);
    if (!isMissingLearnerTable(error)) {
      console.error("Learner access read failed from Supabase, using file fallback:", error.message || error);
    }
  }
  const allLearners = readAllowedLearners();
  let filtered;
  if (tenantId === undefined || tenantId === null || tenantId === "") {
    filtered = allLearners;
  } else if (tenantId && tenantId !== "default") {
    filtered = allLearners.filter((item) => item.tenantId === tenantId);
  } else {
    filtered = allLearners.filter((item) => !item.tenantId || item.tenantId === "default");
  }
  return filtered
    .map((item) => ({
      email: normalizeEmail(item.email),
      name: item.name || "",
      accessCode: item.accessCode || "",
      phone: item.phone || "",
      isActive: item.isActive !== false,
      expiresAt: item.expiresAt ? Number(item.expiresAt) : null,
      tenantId: item.tenantId || null,
      createdAt: Number(item.createdAt || Date.now()),
      updatedAt: Number(item.updatedAt || Date.now())
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

async function upsertAllowedLearnerStore({ email, name, accessCode, phone, isActive, expiresAt, tenantId }) {
  const normalizedEmail = normalizeEmail(email);
  const now = Date.now();
  const normalizedExpiry = normalizeExpiryTs(expiresAt);

  if (USE_SUPABASE) {
    const payload = {
      email: normalizedEmail,
      name: name !== undefined ? String(name || "").trim() : "",
      access_code: accessCode !== undefined ? String(accessCode || "").trim() : "",
      phone: phone !== undefined ? String(phone || "").trim() : "",
      is_active: isActive !== false,
      expires_at: normalizedExpiry ? toIso(normalizedExpiry) : null,
      tenant_id: tenantId && tenantId !== "default" ? tenantId : null
    };
    const { data, error } = await supabase
      .from("learner_access")
      .upsert(payload, { onConflict: "email" })
      .select("email,name,access_code,phone,is_active,expires_at,tenant_id,created_at,updated_at")
      .single();
    if (!error) return mapLearnerRow(data);
    if (!isMissingLearnerTable(error)) {
      console.error("Learner access write failed to Supabase, using file fallback:", error.message || error);
    }
  }

  const learners = readAllowedLearners();
  const idx = learners.findIndex((item) => normalizeEmail(item.email) === normalizedEmail);
  const next = {
    email: normalizedEmail,
    isActive: isActive !== false,
    expiresAt: normalizedExpiry,
    updatedAt: now
  };
  if (name !== undefined) next.name = String(name || "").trim();
  if (accessCode !== undefined) next.accessCode = String(accessCode || "").trim();
  if (phone !== undefined) next.phone = String(phone || "").trim();
  if (tenantId !== undefined) next.tenantId = tenantId || null;
  if (idx >= 0) {
    learners[idx] = { ...learners[idx], ...next };
  } else {
    learners.unshift({ ...next, createdAt: now });
  }
  writeAllowedLearners(learners);
  return idx >= 0 ? learners[idx] : learners[0];
}

async function removeAllowedLearnerStore(email) {
  const normalizedEmail = normalizeEmail(email);
  if (USE_SUPABASE) {
    const { error, count } = await supabase
      .from("learner_access")
      .delete({ count: "exact" })
      .eq("email", normalizedEmail);
    if (!error) return Number(count || 0);
    if (!isMissingLearnerTable(error)) {
      console.error("Learner access delete failed in Supabase, using file fallback:", error.message || error);
    }
  }

  const learners = readAllowedLearners();
  const next = learners.filter((item) => normalizeEmail(item.email) !== normalizedEmail);
  writeAllowedLearners(next);
  return learners.length - next.length;
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

function getClientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").trim();
  if (forwarded) return forwarded.split(",")[0].trim();
  const remote = String(req.socket?.remoteAddress || "").trim();
  return remote || "unknown";
}

function isVerifyRateLimited(req, bucket) {
  const now = Date.now();
  const ip = getClientIp(req);
  const key = `${bucket}:${ip}`;
  const existing = verifyRateLimitStore.get(key);

  if (!existing || now > existing.resetAt) {
    verifyRateLimitStore.set(key, { count: 1, resetAt: now + VERIFY_RATE_WINDOW_MS });
    return { limited: false, retryAfterSec: 0 };
  }

  if (existing.count >= VERIFY_RATE_LIMIT) {
    const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return { limited: true, retryAfterSec };
  }

  existing.count += 1;
  verifyRateLimitStore.set(key, existing);
  return { limited: false, retryAfterSec: 0 };
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
  if (ext === ".xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (ext === ".xls") return "application/vnd.ms-excel";
  return "text/plain; charset=utf-8";
}

/**
 * Parse a multipart/form-data request and return the first file field as a Buffer.
 * Returns { fieldName, fileName, buffer } or throws.
 */
function parseMultipartFile(req) {
  return new Promise((resolve, reject) => {
    const contentTypeHeader = req.headers["content-type"] || "";
    const boundaryMatch = contentTypeHeader.match(/boundary=(?:"([^"]+)"|([^\s;]+))/i);
    if (!boundaryMatch) return reject(new Error("No multipart boundary found"));
    const boundary = boundaryMatch[1] || boundaryMatch[2];

    const chunks = [];
    let totalSize = 0;
    const MAX = 20 * 1024 * 1024; // 20 MB limit

    req.on("data", (chunk) => {
      totalSize += chunk.length;
      if (totalSize > MAX) {
        reject(new Error("File too large (max 20 MB)"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("error", reject);

    req.on("end", () => {
      try {
        const body = Buffer.concat(chunks);
        const boundaryBuf = Buffer.from("--" + boundary);
        const CRLF = Buffer.from("\r\n");
        const CRLFCRLF = Buffer.from("\r\n\r\n");

        // Find all parts
        let pos = 0;
        while (pos < body.length) {
          const partStart = indexOf(body, boundaryBuf, pos);
          if (partStart === -1) break;
          pos = partStart + boundaryBuf.length;
          // Skip CRLF after boundary
          if (body[pos] === 0x0d && body[pos + 1] === 0x0a) pos += 2;
          else if (body[pos] === 0x2d && body[pos + 1] === 0x2d) break; // final boundary --

          // Find header/body separator
          const headerEnd = indexOf(body, CRLFCRLF, pos);
          if (headerEnd === -1) break;

          const headerSection = body.slice(pos, headerEnd).toString("utf8");
          pos = headerEnd + 4; // skip \r\n\r\n

          // Find end of this part
          const partEnd = indexOf(body, Buffer.concat([CRLF, boundaryBuf]), pos);
          const partBody = partEnd === -1 ? body.slice(pos) : body.slice(pos, partEnd);

          // Parse Content-Disposition
          const dispMatch = headerSection.match(/Content-Disposition:[^\r\n]*name="([^"]+)"(?:[^\r\n]*filename="([^"]+)")?/i);
          if (!dispMatch) continue;
          const fieldName = dispMatch[1];
          const fileName = dispMatch[2] || "";

          if (fileName) {
            return resolve({ fieldName, fileName, buffer: partBody });
          }

          if (partEnd !== -1) pos = partEnd + CRLF.length + boundaryBuf.length;
        }
        reject(new Error("No file part found in multipart body"));
      } catch (err) {
        reject(err);
      }
    });
  });
}

function indexOf(buf, search, start) {
  start = start || 0;
  for (let i = start; i <= buf.length - search.length; i++) {
    let found = true;
    for (let j = 0; j < search.length; j++) {
      if (buf[i + j] !== search[j]) { found = false; break; }
    }
    if (found) return i;
  }
  return -1;
}

function serveFile(reqPath, res) {
  let safePath;
  if (reqPath === "/") {
    safePath = "landing.html";
  } else if (reqPath === "/app" || reqPath === "/app/") {
    safePath = "index.html";
  } else {
    safePath = reqPath.replace(/^\/+/, "");
  }
  const filePath = path.resolve(ROOT, safePath);

  if (!filePath.startsWith(ROOT + path.sep)) return notFound(res);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return notFound(res);

  const data = fs.readFileSync(filePath);
  res.writeHead(200, { "Content-Type": contentType(filePath) });
  res.end(data);
}

function getAdminKey(req) {
  const auth = String(req.headers.authorization || "").trim();
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return String(req.headers["x-admin-key"] || "").trim();
}

function getTrainerKey(req) {
  const auth = String(req.headers.authorization || "").trim();
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return String(req.headers["x-trainer-key"] || "").trim();
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

async function verifyGoogleIdentity(accessToken) {
  if (!USE_SUPABASE) throw new Error("Google auth verification is unavailable");
  const token = String(accessToken || "").trim();
  if (!token) throw new Error("Missing Google access token");
  const { data, error } = await supabase.auth.getUser(token);
  if (error) throw new Error("Google auth verification failed");
  if (!data?.user?.email) throw new Error("Google account email is unavailable");
  return {
    id: String(data.user.id || ""),
    email: normalizeEmail(data.user.email)
  };
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

function isTenantTrainerAuth(tenant, providedKey) {
  return Boolean(tenant.trainerKey) && String(providedKey || "") === tenant.trainerKey;
}

function isTenantAdminAuth(tenant, providedKey) {
  const value = String(providedKey || "");
  const superAdmin = isSuperAdminAuthorized(value);
  const globalAdmin = Boolean(ADMIN_KEY) && value === ADMIN_KEY;
  const tenantAdmin = Boolean(tenant.adminKey) && value === tenant.adminKey;
  const tenantTrainer = Boolean(tenant.trainerKey) && value === tenant.trainerKey;
  return superAdmin || globalAdmin || tenantAdmin || tenantTrainer;
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

async function getLearnerAccessRecord(email, tenantId) {
  const target = normalizeEmail(email);
  if (!target) return null;
  const learners = await readAllowedLearnersStore(tenantId);
  return learners.find((item) => normalizeEmail(item.email) === target) || null;
}

function listCohortsSummary(tenantId) {
  const allCohorts = readCohorts();
  let filtered;
  if (tenantId && tenantId !== "default") {
    filtered = allCohorts.filter((c) => c.tenantId === tenantId);
  } else {
    filtered = allCohorts.filter((c) => !c.tenantId || c.tenantId === "default");
  }
  return filtered.map((cohort) => ({
    id: cohort.id,
    name: cohort.name,
    accessCode: cohort.accessCode,
    isActive: Boolean(cohort.isActive),
    expiresAt: cohort.expiresAt ? Number(cohort.expiresAt) : null,
    questionLimit: Number(cohort.questionLimit || 1000000),
    memberCount: Array.isArray(cohort.members) ? cohort.members.length : 0,
    tenantId: cohort.tenantId || null,
    createdAt: Number(cohort.createdAt || Date.now()),
    updatedAt: Number(cohort.updatedAt || Date.now())
  }));
}

function createCohort({ name, accessCode, questionLimit, isActive, expiresAt, tenantId }) {
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
    tenantId: tenantId || null,
    members: [],
    createdAt: now,
    updatedAt: now
  };
  cohorts.unshift(newCohort);
  writeCohorts(cohorts);
  return newCohort;
}

function updateCohort({ cohortId, name, accessCode, questionLimit, isActive, expiresAt, tenantId }) {
  const cohorts = readCohorts();
  const idx = cohorts.findIndex((c) => c.id === cohortId);
  if (idx < 0) throw new Error("Cohort not found");
  if (tenantId !== undefined && (cohorts[idx].tenantId || null) !== (tenantId || null)) {
    throw new Error("Forbidden");
  }

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

function clampScore(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

function speedBandFromMastery(mastery) {
  const m = Number(mastery || 0);
  if (m >= 80) return "Strong";
  if (m >= 60) return "Developing";
  return "At Risk";
}

function computeSpeedScore(avgSeconds, targetSeconds) {
  const avg = Number(avgSeconds || 0);
  const target = Math.max(1, Number(targetSeconds || 60));
  if (!Number.isFinite(avg) || avg <= 0) return 50;
  const ratio = avg / target;
  if (ratio <= 1) return 100;
  if (ratio >= 2) return 0;
  return Math.round((2 - ratio) * 100);
}

function computeConsistencyScore(trend, windowDays) {
  const rows = Array.isArray(trend) ? trend : [];
  const activeRows = rows.filter((row) => Number(row.attempted || 0) > 0);
  const activeDays = activeRows.length;
  const window = Math.max(1, Number(windowDays || 30));
  const frequency = clampScore((activeDays / window) * 100);

  if (activeDays === 0) {
    return {
      score: 0,
      frequencyScore: 0,
      regularityScore: 0,
      stabilityScore: 0,
      activeDays
    };
  }

  let regularityScore = 50;
  let stabilityScore = 50;

  if (activeDays >= 2) {
    const sortedDays = activeRows.map((row) => row.day).sort();
    const dayNumbers = sortedDays.map((day) => Math.floor(Date.parse(`${day}T00:00:00Z`) / (24 * 60 * 60 * 1000)));
    const gaps = [];
    for (let i = 1; i < dayNumbers.length; i += 1) {
      gaps.push(Math.max(1, dayNumbers[i] - dayNumbers[i - 1]));
    }
    const avgGap = gaps.length ? gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length : window;
    regularityScore = clampScore(100 - ((avgGap - 1) / Math.max(1, window - 1)) * 100);

    const attemptsPerDay = activeRows.map((row) => Number(row.attempted || 0)).filter((x) => x > 0);
    const mean = attemptsPerDay.reduce((sum, val) => sum + val, 0) / Math.max(1, attemptsPerDay.length);
    const variance = attemptsPerDay.reduce((sum, val) => sum + (val - mean) ** 2, 0) / Math.max(1, attemptsPerDay.length);
    const stdev = Math.sqrt(Math.max(0, variance));
    const cv = mean > 0 ? stdev / mean : 1;
    stabilityScore = clampScore(100 - cv * 100);
  }

  const score = Math.round(frequency * 0.4 + regularityScore * 0.35 + stabilityScore * 0.25);
  return {
    score,
    frequencyScore: Math.round(frequency),
    regularityScore: Math.round(regularityScore),
    stabilityScore: Math.round(stabilityScore),
    activeDays
  };
}

async function getTagTargetSecondsMap() {
  const map = new Map();
  if (!USE_SUPABASE) {
    const questions = readQuestions().filter((q) => q.is_active !== false);
    const agg = new Map();
    questions.forEach((q) => {
      const tag = String(q.tag || "General").trim() || "General";
      const target = Number(q.target_time_sec || 0);
      if (!Number.isFinite(target) || target <= 0) return;
      const curr = agg.get(tag) || { total: 0, count: 0 };
      curr.total += target;
      curr.count += 1;
      agg.set(tag, curr);
    });
    agg.forEach((value, key) => {
      map.set(key, Math.max(30, Math.min(120, Math.round(value.total / value.count))));
    });
    return map;
  }

  const { data, error } = await supabase
    .from("questions")
    .select("tag,target_time_sec")
    .eq("is_active", true);
  if (error) {
    const msg = String(error.message || "").toLowerCase();
    if (error.code !== "42703" && !msg.includes("target_time_sec")) throw error;
    return map;
  }

  const agg = new Map();
  (data || []).forEach((row) => {
    const tag = String(row.tag || "General").trim() || "General";
    const target = Number(row.target_time_sec || 0);
    if (!Number.isFinite(target) || target <= 0) return;
    const curr = agg.get(tag) || { total: 0, count: 0 };
    curr.total += target;
    curr.count += 1;
    agg.set(tag, curr);
  });
  agg.forEach((value, key) => {
    map.set(key, Math.max(30, Math.min(120, Math.round(value.total / value.count))));
  });
  return map;
}

function buildAttemptAnalytics(attempts, days, tagTargetSecondsMap) {
  const since = Date.now() - Math.max(1, Number(days || 30)) * 24 * 60 * 60 * 1000;
  const filtered = attempts.filter((a) => Number(a.at || 0) >= since);

  const byTagMap = new Map();
  const trendMap = new Map();
  const tagDurationMap = new Map();
  let totalDurationMs = 0;
  let timedAttemptCount = 0;

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

    if (!isSkipped && Number(attempt.durationMs || 0) > 0) {
      const duration = Number(attempt.durationMs || 0);
      totalDurationMs += duration;
      timedAttemptCount += 1;
      const durAgg = tagDurationMap.get(tag) || { total: 0, count: 0 };
      durAgg.total += duration;
      durAgg.count += 1;
      tagDurationMap.set(tag, durAgg);
    }
  }

  const byTag = Array.from(byTagMap.values()).sort((a, b) => {
    if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
    return b.attempted - a.attempted;
  });
  const trend = Array.from(trendMap.values()).sort((a, b) => a.day.localeCompare(b.day));
  const attempted = filtered.filter((a) => !a.isSkipped).length;
  const correct = filtered.filter((a) => a.isCorrect && !a.isSkipped).length;
  const wrong = attempted - correct;

  const avgSeconds = timedAttemptCount ? totalDurationMs / timedAttemptCount / 1000 : null;
  const consistency = computeConsistencyScore(trend, Math.max(1, Number(days || 30)));
  const targetMap = tagTargetSecondsMap instanceof Map ? tagTargetSecondsMap : new Map();

  const byTagMastery = byTag.map((row) => {
    const targetSeconds = Number(targetMap.get(row.tag) || 60);
    const dur = tagDurationMap.get(row.tag);
    const tagAvgSeconds = dur && dur.count > 0 ? dur.total / dur.count / 1000 : null;
    const speedScore = computeSpeedScore(tagAvgSeconds, targetSeconds);
    const mastery = Math.round(row.accuracy * 0.65 + speedScore * 0.25 + consistency.score * 0.1);
    return {
      ...row,
      avgSeconds: tagAvgSeconds,
      targetSeconds,
      speedScore,
      consistencyScore: consistency.score,
      mastery,
      band: speedBandFromMastery(mastery)
    };
  });

  const weightedTarget =
    byTagMastery.reduce((sum, row) => sum + Number(row.targetSeconds || 60) * Number(row.attempted || 0), 0) /
    Math.max(1, byTagMastery.reduce((sum, row) => sum + Number(row.attempted || 0), 0));
  const overallSpeedScore = computeSpeedScore(avgSeconds, weightedTarget || 60);
  const overallMastery = Math.round((attempted ? (correct / attempted) * 100 : 0) * 0.65 + overallSpeedScore * 0.25 + consistency.score * 0.1);
  const weakTags = [...byTagMastery]
    .filter((row) => Number(row.attempted || 0) >= 3)
    .sort((a, b) => {
      if (a.mastery !== b.mastery) return a.mastery - b.mastery;
      if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
      return b.attempted - a.attempted;
    })
    .slice(0, 3)
    .map((row) => row.tag);

  return {
    summary: {
      attempted,
      correct,
      wrong,
      score: attempted ? Math.round((correct / attempted) * 100) : 0,
      avgSeconds,
      days: Math.max(1, Number(days || 30)),
      speedScore: overallSpeedScore,
      consistencyScore: consistency.score,
      mastery: overallMastery
    },
    byTag: byTagMastery,
    trend,
    consistency,
    mastery: {
      overall: overallMastery,
      speedScore: overallSpeedScore,
      consistencyScore: consistency.score,
      topWeakTags: weakTags
    },
    heatmap: byTagMastery.map((row) => ({
      tag: row.tag,
      mastery: row.mastery,
      band: row.band,
      accuracy: row.accuracy,
      speedScore: row.speedScore,
      consistencyScore: row.consistencyScore,
      attempted: row.attempted,
      avgSeconds: row.avgSeconds
    }))
  };
}

function makeRecommendationFromAnalytics(analytics, maxTags = 3) {
  if (analytics?.mastery?.topWeakTags?.length) {
    return analytics.mastery.topWeakTags.slice(0, maxTags);
  }
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

function isMissingColumnError(error, columnName) {
  const msg = String(error?.message || "").toLowerCase();
  const hint = String(columnName || "").toLowerCase();
  return String(error?.code || "") === "42703" || (hint && msg.includes(hint) && msg.includes("column"));
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
          durationMs: Number(answer.durationMs || 0),
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

  let attemptsRows = [];
  if (attemptsSupportsDurationMs) {
    const attemptsResWithDuration = await supabase
      .from("attempts")
      .select("session_id,card_tag,is_correct,user_answer,answered_at,duration_ms")
      .in("session_id", sessionIds)
      .gte("answered_at", sinceIso)
      .limit(20000);
    if (!attemptsResWithDuration.error) {
      attemptsRows = attemptsResWithDuration.data || [];
    } else if (isMissingColumnError(attemptsResWithDuration.error, "duration_ms")) {
      attemptsSupportsDurationMs = false;
    } else {
      throw attemptsResWithDuration.error;
    }
  }

  if (!attemptsRows.length) {
    const attemptsRes = await supabase
      .from("attempts")
      .select("session_id,card_tag,is_correct,user_answer,answered_at")
      .in("session_id", sessionIds)
      .gte("answered_at", sinceIso)
      .limit(20000);
    if (attemptsRes.error) throw attemptsRes.error;
    attemptsRows = attemptsRes.data || [];
  }

  return attemptsRows.map((row) => ({
    cardTag: String(row.card_tag || "General"),
    isCorrect: Boolean(row.is_correct),
    isSkipped: String(row.user_answer || "") === "[SKIPPED]",
    durationMs: Number(row.duration_ms || 0),
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

async function storageStartSession({ sessionId, userName, userEmail, userPhone, role, tenantId = "default" }) {
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
      tenantId,
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
    tenant_id: tenantId === "default" ? null : tenantId,
    started_at: toIso(Date.now()),
    correct: 0,
    wrong: 0,
    attempted: 0,
    score: 0
  };

  const { error: insertError } = await supabase.from("sessions").insert(payload);
  if (insertError) {
    // Gracefully handle missing tenant_id column — column not yet migrated
    const msg = String(insertError.message || "").toLowerCase();
    if (msg.includes("tenant_id") && msg.includes("schema cache")) {
      const { tenant_id: _drop, ...payloadWithoutTenant } = payload;
      const { error: retryError } = await supabase.from("sessions").insert(payloadWithoutTenant);
      if (retryError) throw retryError;
      return { id: sessionId };
    }
    throw insertError;
  }

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
  durationMs,
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
      durationMs: Number(durationMs || 0),
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
    duration_ms: Number(durationMs || 0),
    answered_at: toIso(at)
  };

  let insertAttemptErr = null;
  if (attemptsSupportsDurationMs) {
    const insertWithDuration = await supabase.from("attempts").insert(attemptPayload);
    insertAttemptErr = insertWithDuration.error || null;
    if (insertAttemptErr && isMissingColumnError(insertAttemptErr, "duration_ms")) {
      attemptsSupportsDurationMs = false;
      insertAttemptErr = null;
    } else if (!insertAttemptErr) {
      insertAttemptErr = null;
    }
  }

  if (!attemptsSupportsDurationMs) {
    const fallbackPayload = { ...attemptPayload };
    delete fallbackPayload.duration_ms;
    const insertFallback = await supabase.from("attempts").insert(fallbackPayload);
    insertAttemptErr = insertFallback.error || null;
  }

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

async function storageListSessions(tenantId = "default") {
  if (!USE_SUPABASE) {
    const sessions = readSessions().filter((s) => (s.tenantId || "default") === tenantId);
    return sessions.map((s) => ({
      id: s.id,
      userName: s.userName,
      userEmail: s.userEmail || "",
      userPhone: s.userPhone || "",
      role: s.role,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      summary: s.summary
    }));
  }

  let query = supabase
    .from("sessions")
    .select("session_id,user_name,user_email,user_phone,role,started_at,ended_at,correct,wrong,attempted,score")
    .order("started_at", { ascending: false })
    .limit(2000);

  if (tenantId === "default") {
    query = query.or("tenant_id.is.null,tenant_id.eq.default");
  } else {
    query = query.eq("tenant_id", tenantId);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map((row) => ({
    id: row.session_id,
    userName: row.user_name,
    userEmail: row.user_email || "",
    userPhone: row.user_phone || "",
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

function normalizeAnswerKeyPart(value) {
  const raw = String(value || "").trim();
  if (raw.startsWith(MCQ_PREFIX)) {
    try {
      const parsed = JSON.parse(raw.slice(MCQ_PREFIX.length));
      const options = Array.isArray(parsed.options) ? parsed.options : [parsed.optionA, parsed.optionB, parsed.optionC, parsed.optionD].filter(Boolean);
      return [
        "mcq",
        options.map((item) => String(item || "").trim().toLowerCase()).join("|"),
        String(parsed.correctOption || "").trim().toLowerCase(),
        String(parsed.rationale || "").trim().toLowerCase()
      ].join("|").replace(/\s+/g, " ");
    } catch {
      return raw.toLowerCase().replace(/\s+/g, " ");
    }
  }
  if (raw.startsWith(CARD_PREFIX)) {
    try {
      const parsed = JSON.parse(raw.slice(CARD_PREFIX.length));
      return [
        "short",
        String(parsed.answer || "").trim().toLowerCase(),
        String(parsed.rationale || "").trim().toLowerCase()
      ].join("|").replace(/\s+/g, " ");
    } catch {
      return raw.toLowerCase().replace(/\s+/g, " ");
    }
  }
  return ["short", raw.toLowerCase(), ""].join("|").replace(/\s+/g, " ");
}

function normalizeDifficultyInput(value, fallback = "medium") {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return fallback;
  if (["low", "beginner", "easy", "foundation", "basic"].includes(raw)) return "low";
  if (["medium", "core", "moderate", "mid", "standard", "intermediate"].includes(raw)) return "medium";
  if (["advanced", "hard", "challenge", "expert", "complex"].includes(raw)) return "advanced";
  return fallback;
}

function inferQuestionDifficulty({ question = "", rationale = "", options = [] } = {}) {
  const stem = String(question || "").trim().toLowerCase();
  const why = String(rationale || "").trim().toLowerCase();
  const optionText = Array.isArray(options) ? options.map((item) => String(item || "").trim()).join(" ").toLowerCase() : "";
  const combined = `${stem} ${why}`.trim();
  const scenarioSignals = /(patient|presents|encounter|emergency|ed\b|admitted|start time|stop time|end time|administered|which code|what should be reported|same drug|sequential|concurrent|hydration|fracture|debridement|foreign body|critical care|documentation supports)/.test(combined);
  const advancedSignals = /(most appropriate|code selection|initial service|additional hour|best coding|hierarchy|apply the hierarchy|multi-step|coding professional)/.test(combined);
  if ((scenarioSignals && advancedSignals) || stem.length > 260 || optionText.length > 220) return "advanced";
  if (scenarioSignals || stem.length > 130 || optionText.length > 120) return "medium";
  return "low";
}

function unpackQuestionAnswer(answer) {
  const raw = String(answer || "").trim();
  if (raw.startsWith(MCQ_PREFIX)) {
    try {
      const parsed = JSON.parse(raw.slice(MCQ_PREFIX.length));
      const options = Array.isArray(parsed.options) ? parsed.options : [parsed.optionA, parsed.optionB, parsed.optionC, parsed.optionD].filter(Boolean);
      return {
        type: "mcq",
        answer: raw,
        options: options.map((item) => String(item || "").trim()).filter(Boolean),
        correctOption: String(parsed.correctOption || "").trim().toUpperCase(),
        rationale: String(parsed.rationale || "").trim(),
        difficulty: normalizeDifficultyInput(parsed.difficulty || "", "")
      };
    } catch {
      return { type: "mcq", answer: raw, options: [], correctOption: "", rationale: "", difficulty: "" };
    }
  }
  if (raw.startsWith(CARD_PREFIX)) {
    try {
      const parsed = JSON.parse(raw.slice(CARD_PREFIX.length));
      return {
        type: "short",
        answer: String(parsed.answer || "").trim(),
        options: [],
        correctOption: "",
        rationale: String(parsed.rationale || "").trim(),
        difficulty: normalizeDifficultyInput(parsed.difficulty || "", "")
      };
    } catch {
      return { type: "short", answer: raw, options: [], correctOption: "", rationale: "", difficulty: "" };
    }
  }
  return { type: "short", answer: raw, options: [], correctOption: "", rationale: "", difficulty: "" };
}

function packQuestionAnswer(meta) {
  const type = String(meta?.type || "short").toLowerCase() === "mcq" ? "mcq" : "short";
  const difficulty = normalizeDifficultyInput(meta?.difficulty || "", "medium");
  if (type === "mcq") {
    return `${MCQ_PREFIX}${JSON.stringify({
      options: Array.isArray(meta?.options) ? meta.options.map((item) => String(item || "").trim()).slice(0, 4) : [],
      correctOption: String(meta?.correctOption || "").trim().toUpperCase(),
      rationale: String(meta?.rationale || "").trim(),
      difficulty
    })}`;
  }
  return `${CARD_PREFIX}${JSON.stringify({
    type: "short",
    answer: String(meta?.answer || "").trim(),
    rationale: String(meta?.rationale || "").trim(),
    difficulty
  })}`;
}

function questionCompositeKey(tag, question, answer) {
  return `${normalizeKeyPart(tag)}|${normalizeKeyPart(question)}|${normalizeAnswerKeyPart(answer)}`;
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

// Questions are shared across all tenants — central bank maintained by admin.
// Tenant isolation applies to sessions, cohorts, and analytics only.
async function storageListQuestions(tag) {
  if (!USE_SUPABASE) {
    const questions = readQuestions().filter((q) => q.is_active !== false);
    return tag ? questions.filter((q) => getCanonicalTagKeysInput(q.tag).includes(normalizeTagKeyInput(tag))) : questions;
  }

  const batchSize = 1000;
  let from = 0;
  const all = [];
  while (true) {
    let query = supabase
      .from("questions")
      .select("id,tag,question,answer")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .range(from, from + batchSize - 1);
    const { data, error } = await query;
    if (error) throw error;
    const rows = data || [];
    all.push(...rows);
    if (rows.length < batchSize) break;
    from += batchSize;
  }
  return tag ? all.filter((row) => getCanonicalTagKeysInput(row.tag).includes(normalizeTagKeyInput(tag))) : all;
}

async function storageBackfillQuestionDifficulties() {
  if (!USE_SUPABASE) {
    const questions = readQuestions();
    let updated = 0;
    questions.forEach((question) => {
      if (question.is_active === false) return;
      const unpacked = unpackQuestionAnswer(question.answer);
      if (unpacked.difficulty) return;
      const difficulty = inferQuestionDifficulty({
        question: question.question,
        rationale: unpacked.rationale,
        options: unpacked.options
      });
      question.answer = packQuestionAnswer({
        type: unpacked.type,
        answer: unpacked.answer,
        rationale: unpacked.rationale,
        options: unpacked.options,
        correctOption: unpacked.correctOption,
        difficulty
      });
      updated += 1;
    });
    if (updated) writeQuestions(questions);
    return { updated };
  }

  const batchSize = 500;
  let from = 0;
  let updated = 0;
  while (true) {
    const { data, error } = await supabase
      .from("questions")
      .select("id,question,answer,is_active")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .range(from, from + batchSize - 1);
    if (error) throw error;
    const rows = data || [];
    if (!rows.length) break;

    for (const row of rows) {
      const unpacked = unpackQuestionAnswer(row.answer);
      if (unpacked.difficulty) continue;
      const difficulty = inferQuestionDifficulty({
        question: row.question,
        rationale: unpacked.rationale,
        options: unpacked.options
      });
      const answer = packQuestionAnswer({
        type: unpacked.type,
        answer: unpacked.answer,
        rationale: unpacked.rationale,
        options: unpacked.options,
        correctOption: unpacked.correctOption,
        difficulty
      });
      const { error: updateErr } = await supabase.from("questions").update({ answer }).eq("id", row.id);
      if (updateErr) throw updateErr;
      updated += 1;
    }

    if (rows.length < batchSize) break;
    from += batchSize;
  }

  return { updated };
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

  if (url.pathname === "/api/tenant/info" && req.method === "GET") {
    const tenant = resolveTenant(req);
    return json(res, 200, {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      isActive: tenant.isActive !== false,
      settings: tenant.settings || {}
    });
  }

  if (url.pathname === "/api/access/config" && req.method === "GET") {
    const tenant = resolveTenant(req);
    const base = getPublicAccessConfig();
    return json(res, 200, {
      ...base,
      trialQuestionLimit: tenant.settings?.trialQuestionLimit || base.trialQuestionLimit,
      maxSessionQuestions: tenant.settings?.maxSessionQuestions || base.maxSessionQuestions
    });
  }

  if (url.pathname === "/api/access/verify" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const email = normalizeEmail(body.email || "");
      if (!email) return json(res, 200, { valid: false, reason: "email_required_for_learner_access" });
      const tenant = resolveTenant(req);
      const learner = await getLearnerAccessRecord(email, tenant.id);
      if (!learner) return json(res, 200, { valid: false, reason: "email_not_allowlisted" });
      if (learner.isActive === false) return json(res, 200, { valid: false, reason: "learner_inactive" });
      if (isExpired(learner.expiresAt)) return json(res, 200, { valid: false, reason: "learner_access_expired" });
      return json(res, 200, {
        valid: true,
        accessType: "trainee",
        questionLimit: 1000000,
        cohortId: null,
        cohortName: null,
        learnerEmail: email
      });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/trainer/verify" && req.method === "POST") {
    try {
      const throttle = isVerifyRateLimited(req, "trainer-verify");
      if (throttle.limited) {
        res.setHeader("Retry-After", String(throttle.retryAfterSec));
        return json(res, 429, { error: "Too many verification attempts. Please retry shortly." });
      }
      const body = await parseBody(req);
      const key = String(body.trainerKey || "").trim();
      const access = readAccessConfig();
      return json(res, 200, { valid: Boolean(access.trainerKey) && key === access.trainerKey });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/admin/verify" && req.method === "POST") {
    try {
      const throttle = isVerifyRateLimited(req, "admin-verify");
      if (throttle.limited) {
        res.setHeader("Retry-After", String(throttle.retryAfterSec));
        return json(res, 429, { error: "Too many verification attempts. Please retry shortly." });
      }
      const body = await parseBody(req);
      const key = String(body.adminKey || "").trim();
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
        appendAuditEvent({
          action: "data.reset",
          actor: "admin",
          actorRole: "admin",
          ip: getClientIp(req),
          meta: { mode: "file" }
        }).catch(() => {});
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

      appendAuditEvent({
        action: "data.reset",
        actor: "admin",
        actorRole: "admin",
        ip: getClientIp(req),
        meta: { mode: "supabase" }
      }).catch(() => {});

      return json(res, 200, { success: true, mode: "supabase" });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/admin/access-config" && req.method === "GET") {
    const key = getAdminKey(req);
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

      const changedFields = Object.keys(body).filter((k) => k !== "adminKey");
      appendAuditEvent({
        action: "access_config.update",
        actor: "admin",
        actorRole: "admin",
        ip: getClientIp(req),
        meta: { changedFields, trialQuestionLimit: next.trialQuestionLimit, maxSessionQuestions: next.maxSessionQuestions }
      }).catch(() => {});

      return json(res, 200, next);
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/admin/cohorts" && req.method === "GET") {
    const key = getAdminKey(req);
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
        appendAuditEvent({
          action: "cohort.update",
          actor: "admin",
          actorRole: "admin",
          ip: getClientIp(req),
          meta: { cohortId: String(body.cohortId), name: updated.name }
        }).catch(() => {});
        return json(res, 200, { cohort: updated });
      }

      const created = createCohort({
        name: body.name,
        accessCode: body.accessCode,
        questionLimit: body.questionLimit,
        isActive: body.isActive,
        expiresAt: body.expiresAt
      });
      appendAuditEvent({
        action: "cohort.create",
        actor: "admin",
        actorRole: "admin",
        ip: getClientIp(req),
        meta: { cohortId: created.id, name: created.name }
      }).catch(() => {});
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
    const key = getAdminKey(req);
    if (!isAdminAuthorized(key)) return json(res, 403, { error: "Forbidden" });
    const cohortId = String(url.searchParams.get("cohortId") || "");
    const cohort = readCohorts().find((c) => c.id === cohortId);
    if (!cohort) return json(res, 404, { error: "Cohort not found" });
    return json(res, 200, { members: Array.isArray(cohort.members) ? cohort.members : [] });
  }

  if (url.pathname === "/api/admin/learners" && req.method === "GET") {
    const key = getAdminKey(req);
    if (!isAdminAuthorized(key)) return json(res, 403, { error: "Forbidden" });
    const learners = await readAllowedLearnersStore();
    return json(res, 200, { learners });
  }

  if (url.pathname === "/api/admin/learners" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const key = String(body.adminKey || "");
      if (!isAdminAuthorized(key)) return json(res, 403, { error: "Forbidden" });
      const email = normalizeEmail(body.email || "");
      if (!email) return json(res, 400, { error: "Valid email is required" });
      const learner = await upsertAllowedLearnerStore({
        email,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
        expiresAt: body.expiresAt ? Number(body.expiresAt) : null
      });
      appendAuditEvent({
        action: "learner.upsert",
        actor: "admin",
        actorRole: "admin",
        ip: getClientIp(req),
        meta: { email, isActive: learner.isActive }
      }).catch(() => {});
      return json(res, 200, { learner });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/admin/learners/remove" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const key = String(body.adminKey || "");
      if (!isAdminAuthorized(key)) return json(res, 403, { error: "Forbidden" });
      const email = normalizeEmail(body.email || "");
      if (!email) return json(res, 400, { error: "Valid email is required" });
      const removed = await removeAllowedLearnerStore(email);
      appendAuditEvent({
        action: "learner.remove",
        actor: "admin",
        actorRole: "admin",
        ip: getClientIp(req),
        meta: { email, removed }
      }).catch(() => {});
      return json(res, 200, { removed });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/cohorts" && req.method === "GET") {
    const trainerKey = getTrainerKey(req);
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
      const trainerKey = getTrainerKey(req);
      const access = readAccessConfig();
      if (!access.trainerKey || trainerKey !== access.trainerKey) return json(res, 403, { error: "Forbidden" });

      const email = normalizeEmail(url.searchParams.get("email"));
      const days = Math.max(1, Number(url.searchParams.get("days") || 30));
      if (!email) return json(res, 400, { error: "Missing email" });

      const since = Date.now() - days * 24 * 60 * 60 * 1000;
      const [attempts, tagTargets] = await Promise.all([listAttemptsForEmails([email], since), getTagTargetSecondsMap()]);
      const analytics = buildAttemptAnalytics(attempts, days, tagTargets);
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
      const trainerKey = getTrainerKey(req);
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
          analytics: buildAttemptAnalytics([], days, new Map()),
          recommendedTags: []
        });
      }

      const since = Date.now() - days * 24 * 60 * 60 * 1000;
      const [attempts, tagTargets] = await Promise.all([listAttemptsForEmails(emails, since), getTagTargetSecondsMap()]);
      const analytics = buildAttemptAnalytics(attempts, days, tagTargets);
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
      const trainerKey = getTrainerKey(req);
      const access = readAccessConfig();
      if (!access.trainerKey || trainerKey !== access.trainerKey) return json(res, 403, { error: "Forbidden" });

      const email = normalizeEmail(url.searchParams.get("email"));
      const days = Math.max(1, Number(url.searchParams.get("days") || 30));
      const cardLimit = Math.max(1, Math.min(50, Number(url.searchParams.get("limit") || 15)));
      if (!email) return json(res, 400, { error: "Missing email" });

      const since = Date.now() - days * 24 * 60 * 60 * 1000;
      const [attempts, tagTargets] = await Promise.all([listAttemptsForEmails([email], since), getTagTargetSecondsMap()]);
      const analytics = buildAttemptAnalytics(attempts, days, tagTargets);
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
    const trainerKey = getTrainerKey(req);
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

  if (url.pathname === "/api/tags" && req.method === "GET") {
    try {
      return json(res, 200, { tags: await listTags() });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/trainer/tags" && req.method === "GET") {
    const trainerKey = getTrainerKey(req);
    const tenant = resolveTenant(req);
    if (!isTenantTrainerAuth(tenant, trainerKey)) return json(res, 403, { error: "Forbidden" });
    try {
      return json(res, 200, { tags: await getTagSummary() });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/trainer/tags" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const trainerKey = String(body.trainerKey || "");
      const tenant = resolveTenant(req);
      if (!isTenantTrainerAuth(tenant, trainerKey)) return json(res, 403, { error: "Forbidden" });
      const tag = await createOrUpdateTag({
        key: body.key,
        label: body.label,
        aliases: body.aliases,
        isActive: body.isActive
      });
      appendAuditEvent({
        action: "tag.upsert",
        actor: "trainer",
        actorRole: "trainer",
        ip: getClientIp(req),
        meta: { key: tag.key, label: tag.label, isActive: tag.isActive }
      }).catch(() => {});
      return json(res, 200, { tag, tags: await getTagSummary() });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/trainer/tags/delete" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const trainerKey = String(body.trainerKey || "");
      const tenant = resolveTenant(req);
      if (!isTenantTrainerAuth(tenant, trainerKey)) return json(res, 403, { error: "Forbidden" });
      const result = await deleteTag(body.key);
      appendAuditEvent({
        action: "tag.delete",
        actor: "trainer",
        actorRole: "trainer",
        ip: getClientIp(req),
        meta: { key: String(body.key || "") }
      }).catch(() => {});
      return json(res, 200, { result, tags: await getTagSummary() });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/trainer/tags/merge" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const trainerKey = String(body.trainerKey || "");
      const tenant = resolveTenant(req);
      if (!isTenantTrainerAuth(tenant, trainerKey)) return json(res, 403, { error: "Forbidden" });
      const result = await mergeTags({
        sourceKey: body.sourceKey,
        targetKey: body.targetKey
      });
      appendAuditEvent({
        action: "tag.merge",
        actor: "trainer",
        actorRole: "trainer",
        ip: getClientIp(req),
        meta: { sourceKey: String(body.sourceKey || ""), targetKey: String(body.targetKey || "") }
      }).catch(() => {});
      return json(res, 200, { result, tags: await getTagSummary() });
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

      const tenant = resolveTenant(req);
      if (!isTenantTrainerAuth(tenant, trainerKey)) return json(res, 403, { error: "Forbidden" });

      if (!questionId) return json(res, 400, { error: "Missing question ID" });

      const result = await storageDeleteQuestion(questionId);

      appendAuditEvent({
        action: "question.delete",
        actor: "trainer",
        actorRole: "trainer",
        ip: getClientIp(req),
        meta: { questionId }
      }).catch(() => {});

      return json(res, 200, result);
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/questions/tag/bulk" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const trainerKey = String(body.trainerKey || "");
      const access = readAccessConfig();
      if (!access.trainerKey || trainerKey !== access.trainerKey) {
        return json(res, 403, { error: "Forbidden" });
      }

      const ids = Array.isArray(body.ids) ? body.ids.map((id) => String(id || "").trim()).filter(Boolean) : [];
      const tag = String(body.tag || "").trim();
      if (!ids.length) return json(res, 400, { error: "No question ids provided" });
      if (!tag) return json(res, 400, { error: "Tag is required" });

      if (!USE_SUPABASE) {
        const questions = readQuestions();
        let updated = 0;
        questions.forEach((q) => {
          if (ids.includes(String(q.id))) {
            q.tag = tag;
            updated += 1;
          }
        });
        writeQuestions(questions);
        return json(res, 200, { updated });
      }

      const { error } = await supabase.from("questions").update({ tag }).in("id", ids);
      if (error) throw error;
      return json(res, 200, { updated: ids.length });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/questions/difficulty/backfill" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const trainerKey = String(body.trainerKey || "").trim();
      const tenant = resolveTenant(req);
      if (!isTenantTrainerAuth(tenant, trainerKey)) {
        return json(res, 403, { error: "Forbidden" });
      }
      const result = await storageBackfillQuestionDifficulties();
      return json(res, 200, result);
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/questions/import" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const trainerKey = String(body.trainerKey || "");
      const tenant = resolveTenant(req);
      if (!isTenantTrainerAuth(tenant, trainerKey)) {
        return json(res, 403, { error: "Forbidden" });
      }

      const cards = Array.isArray(body.cards) ? body.cards : [];
      if (!cards.length) return json(res, 400, { error: "No cards provided" });
      if (cards.length > 10000) return json(res, 400, { error: "Batch too large" });

      const uploadedBy = String(body.uploadedBy || "trainer");
      const result = await storageImportQuestions(cards, {
        uploadedBy,
        reviewRows: Array.isArray(body.reviewRows) ? body.reviewRows : [],
        batchSummary: body.batchSummary && typeof body.batchSummary === "object" ? body.batchSummary : null,
        sourceName: String(body.sourceName || ""),
        notes: String(body.notes || "")
      });

      appendAuditEvent({
        action: "questions.import",
        actor: uploadedBy,
        actorRole: "trainer",
        ip: getClientIp(req),
        meta: { batchId: result.batchId, inserted: result.inserted, total: cards.length, sourceName: String(body.sourceName || "") }
      }).catch(() => {});

      return json(res, 200, result);
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/import/review" && req.method === "GET") {
    const trainerKey = getTrainerKey(req);
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
    const trainerKey = getTrainerKey(req);
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
      appendAuditEvent({
        action: "import.rollback",
        actor: "trainer",
        actorRole: "trainer",
        ip: getClientIp(req),
        meta: { batchId: String(body.batchId || ""), rolledBack: result.rolledBack }
      }).catch(() => {});
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
    const trainerKey = getTrainerKey(req);
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

      if (action === "deactivate") {
        const result = await storageDeleteQuestion(flags[idx].questionId);
        flags[idx].status = "deactivated";
        flags[idx].updatedAt = Date.now();
        flags[idx].resolution = {
          action: "deactivated",
          by: "trainer",
          at: Date.now(),
          result
        };
        writeFlags(flags);
        return json(res, 200, { flag: flags[idx], result });
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
    const trainerKey = getTrainerKey(req);
    const access = readAccessConfig();
    if (!access.trainerKey || trainerKey !== access.trainerKey) return json(res, 403, { error: "Forbidden" });
    const limit = Math.max(1, Math.min(5000, Number(url.searchParams.get("limit") || 500)));
    const events = readCtaEvents().slice(0, limit);
    return json(res, 200, { events });
  }

  if (url.pathname === "/api/monetization/insights" && req.method === "GET") {
    const trainerKey = getTrainerKey(req);
    const access = readAccessConfig();
    if (!access.trainerKey || trainerKey !== access.trainerKey) return json(res, 403, { error: "Forbidden" });

    try {
      const trialLimit = Number(access.trialQuestionLimit || 20);
      let allSessions = [];

      if (!USE_SUPABASE) {
        const raw = readSessions();
        allSessions = raw.map(s => ({
          userName: s.userName,
          userEmail: s.userEmail || "",
          userPhone: s.userPhone || "",
          role: s.role,
          attempted: s.summary?.attempted || 0,
          startedAt: s.startedAt,
          endedAt: s.endedAt
        }));
      } else {
        const { data } = await supabase
          .from("sessions")
          .select("user_name,user_email,user_phone,role,attempted,started_at,ended_at")
          .order("started_at", { ascending: false })
          .limit(5000);
        allSessions = (data || []).map(r => ({
          userName: r.user_name,
          userEmail: r.user_email || "",
          userPhone: r.user_phone || "",
          role: r.role,
          attempted: Number(r.attempted || 0),
          startedAt: Date.parse(r.started_at),
          endedAt: r.ended_at ? Date.parse(r.ended_at) : null
        }));
      }

      const trialSessions = allSessions.filter(s => s.role === "trial");
      const learnSessions = allSessions.filter(s => s.role === "trainee");

      // Dedupe by email for unique users
      const trialByEmail = {};
      trialSessions.forEach(s => {
        const key = s.userEmail || s.userName;
        if (!trialByEmail[key]) trialByEmail[key] = { ...s, sessions: 0, maxAttempted: 0 };
        trialByEmail[key].sessions++;
        trialByEmail[key].maxAttempted = Math.max(trialByEmail[key].maxAttempted, s.attempted);
      });
      const trialUsers = Object.values(trialByEmail);

      // CTA events
      let ctaEvents = [];
      if (!USE_SUPABASE) {
        ctaEvents = readCtaEvents().slice(0, 200);
      } else {
        const { data: ctaData } = await supabase
          .from("cta_events")
          .select("type,user_name,user_email,user_phone,role,at")
          .order("at", { ascending: false })
          .limit(200);
        ctaEvents = (ctaData || []).map(r => ({
          type: r.type, userName: r.user_name, userEmail: r.user_email,
          userPhone: r.user_phone, role: r.role, at: Date.parse(r.at)
        }));
      }

      const hotLeads = trialUsers.filter(u => u.maxAttempted >= trialLimit - 5).sort((a,b) => b.maxAttempted - a.maxAttempted);
      const warmLeads = trialUsers.filter(u => u.maxAttempted >= 10 && u.maxAttempted < trialLimit - 5).sort((a,b) => b.maxAttempted - a.maxAttempted);
      const coldLeads = trialUsers.filter(u => u.maxAttempted < 10);
      const returningTrialUsers = trialUsers.filter(u => u.sessions > 1).sort((a,b) => b.sessions - a.sessions);

      return json(res, 200, {
        trialLimit,
        summary: {
          totalTrialSessions: trialSessions.length,
          totalTrialUsers: trialUsers.length,
          totalLearnerSessions: learnSessions.length,
          engaged: trialUsers.filter(u => u.maxAttempted >= 10).length,
          hotLeads: hotLeads.length,
          ctaClicks: ctaEvents.length
        },
        hotLeads: hotLeads.slice(0, 50),
        warmLeads: warmLeads.slice(0, 50),
        returningTrialUsers: returningTrialUsers.slice(0, 30),
        ctaEvents: ctaEvents.slice(0, 50)
      });
    } catch (err) {
      return json(res, 500, { error: err.message });
    }
  }

  if (url.pathname === "/api/session/start" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const sessionTenant = resolveTenant(req);
      const role = String(body.role || "trainee");
      const userEmail = String(body.userEmail || "");
      const userPhone = String(body.userPhone || "");
      const normalizedEmail = normalizeEmail(userEmail);

      if (role === "trial" || role === "trainee") {
        const provider = String(body.authProvider || "").trim().toLowerCase();
        if (provider !== "google") {
          return json(res, 403, { error: "Google sign-in is required for trial/learner access." });
        }
        const identity = await verifyGoogleIdentity(body.authAccessToken);
        if (identity.email !== normalizedEmail) {
          return json(res, 403, { error: "Signed-in Google email does not match session email." });
        }
      }

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
        role,
        tenantId: sessionTenant.id
      });

      appendAuditEvent({
        action: "session.start",
        actor: normalizeEmail(userEmail) || String(body.userName || "anonymous"),
        actorRole: role,
        ip: getClientIp(req),
        meta: { sessionId: result.id, userName: String(body.userName || ""), role }
      }).catch(() => {});

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

  if (url.pathname === "/api/session/progress" && req.method === "PATCH") {
    try {
      const body = await parseBody(req);
      const sessionId = String(body.sessionId || "").trim();
      const correct = Number(body.correct || 0);
      const wrong = Number(body.wrong || 0);
      const attempted = Number(body.attempted || 0);
      if (!sessionId) return json(res, 400, { error: "sessionId required" });

      if (!USE_SUPABASE) {
        const sessions = readSessions();
        const idx = findSessionIndex(sessions, sessionId);
        if (idx >= 0) {
          sessions[idx].summary = sessions[idx].summary || {};
          sessions[idx].summary.correct = correct;
          sessions[idx].summary.wrong = wrong;
          sessions[idx].summary.attempted = attempted;
          sessions[idx].summary.score = attempted ? Math.round((correct / attempted) * 100) : 0;
          writeSessions(sessions);
        }
        return json(res, 200, { ok: true });
      }

      const score = attempted ? Math.round((correct / attempted) * 100) : 0;
      const { error } = await supabase.from("sessions")
        .update({ correct, wrong, attempted, score })
        .eq("session_id", sessionId);
      if (error) throw error;
      return json(res, 200, { ok: true });
    } catch (err) {
      return json(res, 400, { error: err.message });
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

      appendAuditEvent({
        action: "session.end",
        actor: sessionId,
        actorRole: "user",
        ip: getClientIp(req),
        meta: { sessionId, summary: body.summary || {} }
      }).catch(() => {});

      return json(res, 200, { ok: true });
    } catch (err) {
      const message = err.message || "Unknown error";
      const status = message.includes("Session not found") ? 404 : 400;
      return json(res, status, { error: message });
    }
  }

  if (url.pathname === "/api/sessions" && req.method === "GET") {
    const tenant = resolveTenant(req);
    const key = getTrainerKey(req);
    if (!isTenantTrainerAuth(tenant, key)) return json(res, 403, { error: "Forbidden" });

    try {
      const sessions = await storageListSessions(tenant.id);
      return json(res, 200, { sessions, total: sessions.length });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/superadmin/tenants" && req.method === "GET") {
    const key = String(req.headers["x-super-admin-key"] || req.headers.authorization?.replace(/^Bearer\s+/i, "") || "").trim();
    if (!isSuperAdminAuthorized(key)) return json(res, 403, { error: "Forbidden" });
    const defaultTenant = getDefaultTenant();
    const tenants = [
      {
        id: defaultTenant.id,
        slug: defaultTenant.slug,
        name: defaultTenant.name,
        contactEmail: "",
        adminKey: ADMIN_KEY,
        isActive: true,
        isDefault: true,
        settings: defaultTenant.settings || {},
        createdAt: 0
      },
      ...readTenants()
    ];
    return json(res, 200, { tenants });
  }

  if (url.pathname === "/api/superadmin/tenants" && req.method === "POST") {
    try {
      const key = String(req.headers["x-super-admin-key"] || "").trim() ||
        String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
      if (!isSuperAdminAuthorized(key)) return json(res, 403, { error: "Forbidden" });
      const body = await parseBody(req);
      const tenant = createOrUpdateTenant({
        tenantId: body.tenantId ? String(body.tenantId) : undefined,
        slug: body.slug,
        name: body.name,
        contactEmail: body.contactEmail,
        adminKey: body.adminKey,
        isActive: body.isActive,
        settings: body.settings
      });
      appendAuditEvent({
        action: body.tenantId ? "tenant.update" : "tenant.create",
        actor: "superadmin",
        actorRole: "superadmin",
        ip: getClientIp(req),
        meta: { tenantId: tenant.id, slug: tenant.slug, name: tenant.name }
      }).catch(() => {});
      return json(res, body.tenantId ? 200 : 201, { tenant });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/admin/audit-log" && req.method === "GET") {
    const key = getAdminKey(req);
    if (!isAdminAuthorized(key)) return json(res, 403, { error: "Forbidden" });
    const limit = Math.max(1, Math.min(2000, Number(url.searchParams.get("limit") || 500)));
    const actionFilter = String(url.searchParams.get("action") || "").trim().toLowerCase();
    const since = Number(url.searchParams.get("since") || 0);

    let events = [];
    if (USE_SUPABASE) {
      try {
        let q = supabase
          .from("audit_log")
          .select("event_id,ts,action,actor,actor_role,ip,meta")
          .order("ts", { ascending: false })
          .limit(limit);
        if (since) q = q.gt("ts", since);
        if (actionFilter) q = q.eq("action", actionFilter);
        const { data, error } = await q;
        if (!error) {
          events = (data || []).map((r) => ({
            id: r.event_id,
            ts: Number(r.ts),
            action: r.action,
            actor: r.actor,
            actorRole: r.actor_role,
            ip: r.ip,
            meta: r.meta || {}
          }));
        } else {
          events = readAuditLog();
        }
      } catch {
        events = readAuditLog();
      }
    } else {
      events = readAuditLog();
    }

    if (actionFilter) events = events.filter((e) => e.action === actionFilter);
    if (since) events = events.filter((e) => e.ts > since);
    return json(res, 200, { events: events.slice(0, limit), total: events.length });
  }

  // ── Institute Dashboard API ───────────────────────────────────────────────

  function getInstituteKey(req) {
    const fromHeader = String(req.headers["x-institute-key"] || "").trim();
    if (fromHeader) return fromHeader;
    const auth = String(req.headers.authorization || "").trim();
    if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
    return "";
  }

  if (url.pathname === "/api/institute/auth" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const key = String(body.key || getInstituteKey(req) || "").trim();
      const tenant = resolveInstituteFromKey(key);
      if (!tenant) return json(res, 401, { error: "Invalid institute key" });
      return json(res, 200, {
        ok: true,
        tenantId: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        settings: tenant.settings || {}
      });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/institute/info" && req.method === "GET") {
    const key = getInstituteKey(req);
    const tenant = resolveInstituteFromKey(key);
    if (!tenant) return json(res, 401, { error: "Invalid institute key" });
    const allLearners = await readAllowedLearnersStore(tenant.id);
    const usedSeats = allLearners.length;
    return json(res, 200, {
      name: tenant.name,
      slug: tenant.slug,
      contactEmail: tenant.contactEmail || "",
      settings: tenant.settings || {},
      usedSeats,
      maxUsers: (tenant.settings || {}).maxUsers || 50
    });
  }

  if (url.pathname === "/api/institute/students" && req.method === "GET") {
    const key = getInstituteKey(req);
    const tenant = resolveInstituteFromKey(key);
    if (!tenant) return json(res, 401, { error: "Invalid institute key" });
    const students = await readAllowedLearnersStore(tenant.id);
    return json(res, 200, { students });
  }

  if (url.pathname === "/api/institute/students" && req.method === "POST") {
    const key = getInstituteKey(req);
    const tenant = resolveInstituteFromKey(key);
    if (!tenant) return json(res, 401, { error: "Invalid institute key" });
    try {
      const body = await parseBody(req);
      const email = normalizeEmail(body.email);
      if (!email) return json(res, 400, { error: "Email is required" });
      // Enforce maxUsers cap (only count if adding new)
      const allLearners = await readAllowedLearnersStore(tenant.id);
      const existing = allLearners.find((l) => normalizeEmail(l.email) === email);
      if (!existing) {
        const usedSeats = allLearners.length;
        const maxUsers = (tenant.settings || {}).maxUsers || 50;
        if (usedSeats >= maxUsers) return json(res, 400, { error: `Seat limit reached (${maxUsers} max)` });
      }
      const student = await upsertAllowedLearnerStore({
        email,
        name: body.name,
        accessCode: body.accessCode,
        phone: body.phone,
        isActive: body.isActive !== false,
        expiresAt: body.expiresAt,
        tenantId: tenant.id
      });
      return json(res, 200, { student });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/institute/students" && req.method === "DELETE") {
    const key = getInstituteKey(req);
    const tenant = resolveInstituteFromKey(key);
    if (!tenant) return json(res, 401, { error: "Invalid institute key" });
    try {
      const body = await parseBody(req);
      const email = normalizeEmail(body.email);
      if (!email) return json(res, 400, { error: "Email is required" });
      // Only allow removal of learners belonging to this tenant
      const learner = await getLearnerAccessRecord(email, tenant.id);
      if (!learner) return json(res, 403, { error: "Forbidden" });
      const removed = await removeAllowedLearnerStore(email);
      return json(res, 200, { removed });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/institute/cohorts" && req.method === "GET") {
    const key = getInstituteKey(req);
    const tenant = resolveInstituteFromKey(key);
    if (!tenant) return json(res, 401, { error: "Invalid institute key" });
    return json(res, 200, { cohorts: listCohortsSummary(tenant.id) });
  }

  if (url.pathname === "/api/institute/cohorts" && req.method === "POST") {
    const key = getInstituteKey(req);
    const tenant = resolveInstituteFromKey(key);
    if (!tenant) return json(res, 401, { error: "Invalid institute key" });
    try {
      const body = await parseBody(req);
      let cohort;
      if (body.cohortId) {
        cohort = updateCohort({
          cohortId: String(body.cohortId),
          name: body.name,
          accessCode: body.accessCode,
          questionLimit: body.questionLimit,
          isActive: body.isActive,
          expiresAt: body.expiresAt,
          tenantId: tenant.id
        });
      } else {
        cohort = createCohort({
          name: body.name,
          accessCode: body.accessCode,
          questionLimit: body.questionLimit,
          isActive: body.isActive,
          expiresAt: body.expiresAt,
          tenantId: tenant.id
        });
      }
      return json(res, 200, { cohort });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/interview/import" && req.method === "POST") {
    const trainerKey = getTrainerKey(req);
    const access = readAccessConfig();
    if (!access.trainerKey || trainerKey !== access.trainerKey) {
      return json(res, 403, { error: "Forbidden" });
    }
    try {
      const { buffer } = await parseMultipartFile(req);
      const XLSX = require("xlsx");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheet = workbook.Sheets["Questions"];
      if (!sheet) throw new Error("Sheet 'Questions' not found in uploaded file");
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      // Normalise column keys (trim + lowercase)
      const rows = rawRows.map(r => {
        const out = {};
        for (const [k, v] of Object.entries(r)) {
          out[k.trim().toLowerCase()] = typeof v === "string" ? v.trim() : String(v ?? "").trim();
        }
        return out;
      });

      const VALID_TRACKS = ["fresher", "fresher_certified", "experienced"];
      const VALID_SPECIALTIES = ["surgery", "ed_coding", "inpatient", ""];
      const VALID_TYPES = ["clinical_knowledge", "coding_accuracy", "reasoning"];
      const VALID_OPTIONS = ["A", "B", "C", "D"];

      const errors = [];
      const chainMap = {}; // chain_id -> { meta, questions[] }
      let skipped = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowLabel = `Row ${i + 2}`; // 1-indexed + header

        const chainId = row["chain_id"] || "";
        const chainTitle = row["chain_title"] || "";
        const scenario = row["scenario"] || "";
        const track = row["track"] || "";
        const specialty = (row["specialty"] || "").toLowerCase();
        const questionType = row["question_type"] || "";
        const question = row["question"] || "";
        const rationale = row["rationale"] || "";
        const optionA = row["option_a"] || "";
        const optionB = row["option_b"] || "";
        const optionC = row["option_c"] || "";
        const optionD = row["option_d"] || "";
        const correctOption = (row["correct_option"] || "").toUpperCase();
        const answer = row["answer"] || "";
        const position = Number(row["position"] || 0) || (chainMap[chainId] ? chainMap[chainId].questions.length + 1 : 1);

        // Validate required fields
        const missing = [];
        if (!chainId) missing.push("chain_id");
        if (!chainTitle) missing.push("chain_title");
        if (!scenario) missing.push("scenario");
        if (!track) missing.push("track");
        if (!question) missing.push("question");
        if (!rationale) missing.push("rationale");

        if (missing.length) {
          errors.push(`${rowLabel}: Missing required field(s): ${missing.join(", ")}`);
          skipped++;
          continue;
        }

        if (!VALID_TRACKS.includes(track)) {
          errors.push(`${rowLabel}: Invalid track "${track}". Must be one of: ${VALID_TRACKS.join(", ")}`);
          skipped++;
          continue;
        }

        if (!VALID_TYPES.includes(questionType)) {
          errors.push(`${rowLabel}: Invalid question_type "${questionType}". Must be one of: ${VALID_TYPES.join(", ")}`);
          skipped++;
          continue;
        }

        if (!optionA || !optionB || !optionC || !optionD) {
          errors.push(`${rowLabel}: Missing one or more MCQ options (option_a through option_d required)`);
          skipped++;
          continue;
        }

        if (!VALID_OPTIONS.includes(correctOption)) {
          errors.push(`${rowLabel}: Invalid correct_option "${correctOption}". Must be A, B, C, or D`);
          skipped++;
          continue;
        }

        if (track === "experienced" && specialty && !VALID_SPECIALTIES.includes(specialty)) {
          errors.push(`${rowLabel}: Invalid specialty "${specialty}" for experienced track. Must be one of: ${VALID_SPECIALTIES.filter(Boolean).join(", ")}`);
          skipped++;
          continue;
        }

        // Build remediation if present
        let remediation = null;
        const remQ = row["remediation_question"] || "";
        if (remQ) {
          const remA = row["remediation_option_a"] || "";
          const remB = row["remediation_option_b"] || "";
          const remC = row["remediation_option_c"] || "";
          const remD = row["remediation_option_d"] || "";
          const remCorrect = (row["remediation_correct_option"] || "").toUpperCase();
          const remAnswer = row["remediation_answer"] || "";
          const remRationale = row["remediation_rationale"] || "";
          remediation = {
            question: remQ,
            isMcq: true,
            options: [remA, remB, remC, remD],
            correctOption: remCorrect || "A",
            answer: remAnswer,
            rationale: remRationale
          };
        }

        // Build question object
        const safeChainId = chainId.replace(/[^a-zA-Z0-9_-]/g, "_");
        const questionObj = {
          id: `q_${safeChainId}_${position}`,
          position,
          questionType,
          question,
          isMcq: true,
          options: [optionA, optionB, optionC, optionD],
          correctOption,
          answer,
          rationale,
          timeLimit: 60
        };
        if (remediation) questionObj.remediation = remediation;

        if (!chainMap[chainId]) {
          chainMap[chainId] = {
            id: chainId,
            track,
            specialty: specialty || null,
            title: chainTitle,
            scenario,
            questions: []
          };
        }
        chainMap[chainId].questions.push(questionObj);
      }

      // Sort questions within each chain by position
      for (const chain of Object.values(chainMap)) {
        chain.questions.sort((a, b) => a.position - b.position);
      }

      const imported = Object.values(chainMap);

      if (USE_SUPABASE) {
        const upsertPayload = imported.map(c => ({
          id: c.id,
          track: c.track,
          specialty: c.specialty || null,
          title: c.title,
          scenario: c.scenario,
          questions: c.questions,
          updated_at: new Date().toISOString()
        }));
        const { error } = await supabase
          .from("interview_chains")
          .upsert(upsertPayload, { onConflict: "id" });
        if (error) throw new Error(error.message);
      } else {
        const iqPath = path.join(__dirname, "data/interview-questions.json");
        let existing = { chains: [] };
        try {
          existing = JSON.parse(fs.readFileSync(iqPath, "utf8"));
          if (!Array.isArray(existing.chains)) existing.chains = [];
        } catch {}
        const merged = existing.chains.filter(c => !chainMap[c.id]);
        merged.push(...imported);
        fs.writeFileSync(iqPath, JSON.stringify({ chains: merged }, null, 2), "utf8");
      }

      const importedQuestions = imported.reduce((acc, c) => acc + c.questions.length, 0);
      return json(res, 200, {
        imported: importedQuestions,
        chains: imported.length,
        skipped,
        errors
      });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/interview/questions" && req.method === "GET") {
    const track = url.searchParams.get("track") || "";
    const specialty = url.searchParams.get("specialty") || "";
    try {
      if (USE_SUPABASE) {
        let query = supabase.from("interview_chains").select("*");
        if (track) query = query.eq("track", track);
        if (specialty) query = query.eq("specialty", specialty);
        const { data, error } = await query;
        if (error) throw new Error(error.message);
        return json(res, 200, { chains: data || [] });
      } else {
        const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "data/interview-questions.json"), "utf8"));
        let chains = Array.isArray(raw.chains) ? raw.chains : [];
        if (track) chains = chains.filter(c => c.track === track);
        if (specialty) chains = chains.filter(c => c.specialty === specialty);
        return json(res, 200, { chains });
      }
    } catch (err) {
      return json(res, 500, { error: "Could not load interview questions" });
    }
  }

  if (url.pathname === "/api/interview/generate" && req.method === "POST") {
    const trainerKey = getTrainerKey(req);
    const access = readAccessConfig();
    if (!access.trainerKey || trainerKey !== access.trainerKey) {
      return json(res, 403, { error: "Forbidden" });
    }
    const apiKey = process.env.ANTHROPIC_API_KEY || "";
    if (!apiKey) return json(res, 503, { error: "AI generation is not configured. Add ANTHROPIC_API_KEY to environment variables." });

    try {
      const body = await parseBody(req);
      const track = String(body.track || "fresher");
      const specialty = String(body.specialty || "");
      const topic = String(body.topic || "general medical coding").slice(0, 200);
      const count = Math.min(5, Math.max(1, Number(body.count) || 1));
      const customInstructions = String(body.customInstructions || "").slice(0, 2000).trim();
      // Titles the client already generated this session (unsaved) — avoid repeating them too
      const recentTitles = Array.isArray(body.recentTitles)
        ? body.recentTitles.map(t => String(t)).slice(0, 50)
        : [];

      const VALID_TRACKS = ["fresher", "fresher_certified", "experienced"];
      if (!VALID_TRACKS.includes(track)) return json(res, 400, { error: "Invalid track" });

      // Fetch already-saved chain titles for this track+specialty so Claude avoids repeating them
      let existingTitles = [];
      if (USE_SUPABASE) {
        try {
          let q = supabase.from("interview_chains").select("title").eq("track", track);
          if (specialty) q = q.eq("specialty", specialty);
          const { data: rows } = await q.limit(200);
          if (Array.isArray(rows)) existingTitles = rows.map(r => r.title).filter(Boolean);
        } catch { /* non-fatal */ }
      } else {
        try {
          const stored = readInterviewQuestions();
          existingTitles = stored
            .filter(c => c.track === track && (!specialty || c.specialty === specialty))
            .map(c => c.title)
            .filter(Boolean)
            .slice(0, 200);
        } catch { /* non-fatal */ }
      }

      // Merge saved + unsaved session titles, deduplicate
      const allExistingTitles = [...new Set([...existingTitles, ...recentTitles])];

      const systemPrompt = `You are a medical coding interview question generator for AAPC CPC and AHIMA CCS certification. Generate interview question chains in strict JSON format. Return ONLY valid JSON with no explanation, markdown, or extra text.

Output format:
{
  "chains": [
    {
      "id": "unique_snake_case_id",
      "track": "${track}",
      "specialty": ${specialty ? `"${specialty}"` : "null"},
      "title": "Short descriptive title (max 60 chars)",
      "scenario": "A realistic 2-3 sentence clinical scenario with patient details and procedure context",
      "questions": [
        {
          "id": "q_{chain_id}_{position}",
          "position": 1,
          "questionType": "clinical_knowledge",
          "question": "Question text ending with ?",
          "isMcq": true,
          "options": ["A. Option text", "B. Option text", "C. Option text", "D. Option text"],
          "correctOption": "A",
          "answer": "Brief answer (1 sentence)",
          "rationale": "Detailed explanation referencing ICD-10-CM/CPT guidelines and coding rules (2-3 sentences)",
          "timeLimit": 60
        }
      ]
    }
  ]
}

Rules:
- Generate exactly ${count} chain(s)
- Each chain must have 3 to 5 questions
- questionType must be one of: clinical_knowledge, coding_accuracy, reasoning
- correctOption must be exactly one of: A, B, C, D
- Options must start with "A. ", "B. ", "C. ", "D. "
- Use accurate ICD-10-CM, ICD-10-PCS, CPT, and HCPCS codes
- chain id must be unique snake_case (e.g. icd10_fracture_01)
- question id format: q_{chain_id}_{position}
- specialty is "${specialty || "null"}" — set it correctly in every chain
- Make rationale specific and educational, referencing actual coding guidelines`;

      const avoidBlock = allExistingTitles.length
        ? `\n\nALREADY EXISTS — do NOT repeat or closely resemble any of these chain titles:\n${allExistingTitles.map((t, i) => `${i + 1}. ${t}`).join("\n")}`
        : "";

      const userPrompt = `Generate ${count} interview question chain(s).
Track: ${track}${specialty ? `\nSpecialty: ${specialty}` : ""}
Topic/Focus: ${topic}${customInstructions ? `\n\nCustom Instructions from the trainer:\n${customInstructions}` : ""}${avoidBlock}

Return only valid JSON.`;

      const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5",
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }]
        })
      });

      if (!aiRes.ok) {
        let errDetail = "";
        try { const e = await aiRes.json(); errDetail = e?.error?.message || JSON.stringify(e); } catch { errDetail = await aiRes.text().catch(() => ""); }
        return json(res, 502, { error: `AI service error: ${aiRes.status}${errDetail ? " — " + errDetail : ""}` });
      }

      const aiData = await aiRes.json();
      const rawText = aiData?.content?.[0]?.text || "";

      // Extract JSON — strip any accidental markdown fences
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return json(res, 502, { error: "AI returned invalid format. Try again." });

      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed.chains) || parsed.chains.length === 0) {
        return json(res, 502, { error: "AI returned no chains. Try again." });
      }

      return json(res, 200, { chains: parsed.chains });
    } catch (err) {
      return json(res, 500, { error: `Generation failed: ${err.message}` });
    }
  }

  if (url.pathname === "/api/interview/save-chains" && req.method === "POST") {
    const trainerKey = getTrainerKey(req);
    const access = readAccessConfig();
    if (!access.trainerKey || trainerKey !== access.trainerKey) {
      return json(res, 403, { error: "Forbidden" });
    }
    try {
      const body = await parseBody(req);
      const chains = Array.isArray(body.chains) ? body.chains : [];
      if (chains.length === 0) return json(res, 400, { error: "No chains to save" });

      if (USE_SUPABASE) {
        const payload = chains.map(c => ({
          id: c.id,
          track: c.track,
          specialty: c.specialty || null,
          title: c.title,
          scenario: c.scenario,
          questions: c.questions,
          updated_at: new Date().toISOString()
        }));
        const { error } = await supabase.from("interview_chains").upsert(payload, { onConflict: "id" });
        if (error) throw new Error(error.message);
      } else {
        const iqPath = path.join(__dirname, "data/interview-questions.json");
        let existing = { chains: [] };
        try {
          existing = JSON.parse(fs.readFileSync(iqPath, "utf8"));
          if (!Array.isArray(existing.chains)) existing.chains = [];
        } catch {}
        const chainIds = new Set(chains.map(c => c.id));
        const merged = existing.chains.filter(c => !chainIds.has(c.id));
        merged.push(...chains);
        fs.writeFileSync(iqPath, JSON.stringify({ chains: merged }, null, 2), "utf8");
      }

      return json(res, 200, { saved: chains.length });
    } catch (err) {
      return json(res, 500, { error: `Save failed: ${err.message}` });
    }
  }

  if (url.pathname === "/api/institute/analytics" && req.method === "GET") {
    const key = getInstituteKey(req);
    const tenant = resolveInstituteFromKey(key);
    if (!tenant) return json(res, 401, { error: "Invalid institute key" });
    try {
      const sessions = readSessions().filter((s) => s.tenantId === tenant.id);
      const allLearners = await readAllowedLearnersStore(tenant.id);
      const byEmail = {};
      for (const s of sessions) {
        const email = String(s.userEmail || "").toLowerCase();
        if (!email) continue;
        if (!byEmail[email]) {
          byEmail[email] = { email, sessionCount: 0, attempted: 0, correct: 0, lastActive: 0 };
        }
        byEmail[email].sessionCount += 1;
        byEmail[email].attempted += Number(s.totalAnswered || s.attempted || 0);
        byEmail[email].correct += Number(s.correctCount || s.correct || 0);
        const ts = Number(s.endedAt || s.startedAt || s.createdAt || 0);
        if (ts > byEmail[email].lastActive) byEmail[email].lastActive = ts;
      }
      const analytics = Object.values(byEmail).map((row) => {
        const learner = allLearners.find((l) => normalizeEmail(l.email) === row.email);
        return {
          ...row,
          name: learner ? (learner.name || "") : "",
          accuracy: row.attempted > 0 ? Math.round((row.correct / row.attempted) * 100) : 0
        };
      });
      return json(res, 200, { analytics });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  // ─── THE CODING DESK — KNOWLEDGE BASE & AI CHAT ──────────────────────────────

  // ── Helpers ──────────────────────────────────────────────────────────────────

  async function embedTexts(texts, inputType = "document") {
    const voyageKey = process.env.VOYAGE_API_KEY || "";
    if (!voyageKey) throw new Error("VOYAGE_API_KEY not configured");
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${voyageKey}` },
      body: JSON.stringify({ model: "voyage-3", input: texts, input_type: inputType })
    });
    if (!res.ok) {
      const e = await res.text();
      throw new Error(`Voyage AI error ${res.status}: ${e}`);
    }
    const data = await res.json();
    return data.data.map(d => d.embedding);
  }

  // ── PDF extraction via Claude (tables, images, scanned OCR) ─────────────────
  async function extractPdfWithClaude(buffer) {
    const anthropicKey = process.env.ANTHROPIC_API_KEY || "";
    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY not set");
    const base64 = buffer.toString("base64");
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "pdfs-2024-09-25"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 8192,
        messages: [{
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
            { type: "text", text: `Extract ALL content from this medical coding reference document for a RAG knowledge base.

Rules:
1. Preserve all text — headers, paragraphs, footnotes, appendices, sidebars
2. Convert ALL tables to markdown format:
   | Column 1 | Column 2 |
   |----------|----------|
   | value    | value    |
3. Section headers → use ## for main sections, ### for subsections
4. Code lists — preserve every code number and its full description exactly
5. Numbered and bulleted lists → preserve structure
6. Figures, diagrams, flowcharts → [FIGURE: detailed description of all content shown]
7. Scanned or image-based pages → transcribe all visible text faithfully
8. Do NOT summarize or omit — full extraction required

Output only the extracted content with no preamble or closing remarks.` }
          ]
        }]
      })
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Claude PDF extraction HTTP ${resp.status}: ${errText.slice(0, 300)}`);
    }
    const data = await resp.json();
    return data.content?.[0]?.text || "";
  }

  // ── Image extraction via Claude Vision ───────────────────────────────────────
  async function extractImageWithClaude(buffer, mimeType) {
    const anthropicKey = process.env.ANTHROPIC_API_KEY || "";
    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY not set");
    const base64 = buffer.toString("base64");
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 4096,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } },
            { type: "text", text: `Extract ALL content from this medical coding image for a RAG knowledge base.

1. Transcribe all visible text exactly as it appears
2. Convert tables to markdown: | col | col |\\n|---|---|\\n| val | val |
3. Describe diagrams, flowcharts, or figures as [FIGURE: detailed description]
4. Preserve all code numbers, descriptions, and reference lists

Output only the extracted content with no preamble.` }
          ]
        }]
      })
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Claude Vision extraction HTTP ${resp.status}: ${errText.slice(0, 300)}`);
    }
    const data = await resp.json();
    return data.content?.[0]?.text || "";
  }

  // ── DOCX extraction via mammoth → markdown tables + headers ──────────────────
  async function extractDocxText(buffer) {
    const mammoth = require("mammoth");
    const { value: html } = await mammoth.convertToHtml({ buffer });
    let text = html
      // Tables → markdown
      .replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_, inner) => {
        const rowMatches = inner.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
        const rows = rowMatches.map(rowHtml => {
          const cells = (rowHtml.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [])
            .map(c => c.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().replace(/\|/g, "\\|") || " ");
          return "| " + cells.join(" | ") + " |";
        });
        if (rows.length > 1) {
          const sepCount = (rows[0].match(/\|/g) || []).length - 1;
          const sep = "|" + " --- |".repeat(sepCount);
          rows.splice(1, 0, sep);
        }
        return "\n" + rows.join("\n") + "\n";
      })
      // Headings → markdown
      .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, t) =>
        "\n" + "#".repeat(Number(n)) + " " + t.replace(/<[^>]+>/g, "").trim() + "\n")
      // List items
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t) =>
        "- " + t.replace(/<[^>]+>/g, "").trim() + "\n")
      // Paragraphs and divs → newlines
      .replace(/<\/p>/gi, "\n").replace(/<\/div>/gi, "\n")
      // Strip remaining tags
      .replace(/<[^>]+>/g, " ")
      // Decode common HTML entities
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ").replace(/&#\d+;/g, " ").replace(/&[a-z]+;/gi, " ")
      // Normalise whitespace
      .replace(/ {2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    return text;
  }

  // ── Excel/CSV extraction as proper markdown tables ────────────────────────────
  function extractXlsxToMarkdown(buffer) {
    const XLSX = require("xlsx");
    const wb = XLSX.read(buffer, { type: "buffer" });
    let output = "";
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      const nonEmpty = rows.filter(r => r.some(c => String(c).trim()));
      if (!nonEmpty.length) continue;
      output += `\n## Sheet: ${sheetName}\n\n`;
      const headers = nonEmpty[0].map(h => String(h ?? "").trim().replace(/\|/g, "\\|") || " ");
      output += "| " + headers.join(" | ") + " |\n";
      output += "| " + headers.map(() => "---").join(" | ") + " |\n";
      for (let i = 1; i < nonEmpty.length; i++) {
        const row = nonEmpty[i].map(c => String(c ?? "").trim().replace(/\|/g, "\\|") || " ");
        while (row.length < headers.length) row.push(" ");
        output += "| " + row.slice(0, headers.length).join(" | ") + " |\n";
      }
      output += "\n";
    }
    return output;
  }

  // ── Table-aware chunker — never splits a markdown table mid-row ───────────────
  function chunkText(text, source = "") {
    const CHUNK_WORDS = 450;
    const OVERLAP_WORDS = 60;
    const clean = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    const lines = clean.split("\n");
    const chunks = [];

    let curLines = [];
    let curWords = 0;
    let tableLines = [];
    let inTable = false;

    function pushChunk(linesArr) {
      const content = linesArr.join("\n").trim();
      if (content.length > 50) chunks.push({ content, metadata: { source } });
    }

    function flushTable() {
      if (!tableLines.length) { inTable = false; return; }
      const tWords = tableLines.join(" ").split(/\s+/).filter(Boolean).length;
      // If adding the table would massively overflow, flush current first
      if (curWords + tWords > CHUNK_WORDS * 1.8 && curLines.length) {
        pushChunk(curLines);
        curLines = []; curWords = 0;
      }
      curLines.push(...tableLines);
      curWords += tWords;
      tableLines = []; inTable = false;
      // If chunk is now full, emit it
      if (curWords >= CHUNK_WORDS) {
        pushChunk(curLines);
        curLines = []; curWords = 0;
      }
    }

    function flushCurrent(withOverlap) {
      pushChunk(curLines);
      if (withOverlap && curLines.length) {
        const overlapLines = curLines.slice(-4);
        curLines = overlapLines;
        curWords = overlapLines.join(" ").split(/\s+/).filter(Boolean).length;
      } else {
        curLines = []; curWords = 0;
      }
    }

    for (const line of lines) {
      const isTableRow = /^\s*\|/.test(line);

      if (isTableRow) {
        if (!inTable) inTable = true;
        tableLines.push(line);
        continue;
      }

      // Non-table line: flush any accumulated table rows first
      if (inTable) flushTable();

      const lWords = line.split(/\s+/).filter(Boolean).length;
      const isHeader = /^#{1,4}\s/.test(line);

      // Section headers are ideal chunk break points
      if (isHeader && curWords >= OVERLAP_WORDS && curLines.length) {
        flushCurrent(false);
      } else if (curWords + lWords > CHUNK_WORDS && curLines.length) {
        flushCurrent(true);
      }

      curLines.push(line);
      curWords += lWords;
    }

    if (inTable) flushTable();
    if (curLines.length) flushCurrent(false);

    return chunks.filter(c => c.content.length > 50);
  }

  // ── Unified extractor — routes by file type ───────────────────────────────────
  async function extractTextFromBuffer(buffer, filename) {
    const ext = path.extname(filename).toLowerCase();

    if (ext === ".pdf") {
      // Claude extraction (tables + images + scanned OCR) for PDFs up to 28 MB
      const anthropicKey = process.env.ANTHROPIC_API_KEY || "";
      const MAX_CLAUDE_PDF = 28 * 1024 * 1024;
      if (anthropicKey && buffer.length <= MAX_CLAUDE_PDF) {
        try {
          console.log(`[extract] Claude PDF: ${filename} (${(buffer.length / 1024 / 1024).toFixed(1)} MB)`);
          const extracted = await extractPdfWithClaude(buffer);
          if (extracted && extracted.trim().length > 100) return extracted;
        } catch (e) {
          console.warn(`[extract] Claude PDF failed for "${filename}", using pdfParse fallback: ${e.message}`);
        }
      }
      // Fallback: pdf-parse text layer
      console.log(`[extract] pdfParse fallback: ${filename}`);
      const { text } = await pdfParse(buffer);
      return text || "";
    }

    if (ext === ".xlsx" || ext === ".xls") return extractXlsxToMarkdown(buffer);

    if (ext === ".docx" || ext === ".doc") return await extractDocxText(buffer);

    if ([".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
      const mimeMap = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
      return await extractImageWithClaude(buffer, mimeMap[ext]);
    }

    if ([".txt", ".md", ".csv"].includes(ext)) return buffer.toString("utf8");

    throw new Error(`Unsupported file type: ${ext}`);
  }

  function selectCodingDeskModel(message) {
    const COMPLEX = /sequence|sequencing|principal\s+diag|pdx|ms-drg|\bdrg\b|icd-10-pcs|\bpcs\b|or\s+procedure|cc\/mcc|\bmcc\b|\bcc\b|present\s+on\s+admission|\bpoa\b|audit|appeal|denial|walk\s+me\s+through|step\s+by\s+step|explain\s+in\s+detail|complex\s+case|hierarchy|combination\s+code|excludes\s*[12]|instructional\s+note|hac\b/i;
    return (message.length > 280 || COMPLEX.test(message))
      ? "claude-sonnet-4-6"
      : "claude-haiku-4-5";
  }

  const TRIAL_CHAT_LIMIT = 5;
  const MEMBER_CHAT_LIMIT = 0; // 0 = unlimited

  async function getChatUsage(identifier) {
    if (!USE_SUPABASE || !identifier) return 0;
    const { data } = await supabase
      .from("ai_chat_usage")
      .select("message_count")
      .eq("identifier", identifier)
      .single();
    return data?.message_count || 0;
  }

  async function incrementChatUsage(identifier) {
    if (!USE_SUPABASE || !identifier) return;
    await supabase.from("ai_chat_usage").upsert(
      { identifier, message_count: 1, last_used_at: new Date().toISOString() },
      { onConflict: "identifier", ignoreDuplicates: false }
    );
    // Use a raw increment via RPC if available, otherwise do read-modify-write
    const { data } = await supabase
      .from("ai_chat_usage")
      .select("message_count")
      .eq("identifier", identifier)
      .single();
    const current = data?.message_count || 1;
    await supabase.from("ai_chat_usage").update({ message_count: current + 1, last_used_at: new Date().toISOString() }).eq("identifier", identifier);
  }

  const CODING_DESK_SYSTEM = `You are The Coding Desk — an expert medical coding assistant built into PracticeBuddy Lab.

You are powered by a specialized knowledge base of real medical coding materials, guidelines, and training resources. Your role is to help coders at all levels — from freshers learning basics to experienced coders handling complex inpatient cases.

When answering:
1. ALWAYS check the provided context from the knowledge base first
2. When context is available, reference it: "According to [source]..." or "Based on the provided materials..."
3. If context doesn't fully cover the question, use your training knowledge and clearly state "Based on general coding guidelines:"
4. For complex questions, walk through each step methodically — show your reasoning

Your expertise covers:
- ICD-10-CM and ICD-10-PCS coding + Official Guidelines
- CPT and HCPCS Level II coding
- E/M leveling under 2021 AMA guidelines
- Sequencing rules: PDX selection, POA indicators, CC/MCC impact
- MS-DRG assignment and OR procedure definitions
- Modifier usage, NCCI edits, bundling/unbundling rules
- Facility vs professional fee coding differences
- Query processes, audit methodology, denial management
- AAPC CPC and AHIMA CCS exam preparation
- Infusion and injection coding hierarchies

Response style:
- Short questions → concise, direct answer
- Complex questions → structured with headers and bullet points
- Always explain the WHY behind coding decisions
- Cite guideline sections when relevant (e.g. "ICD-10-CM Guideline I.C.1.a")
- End complex answers with "Need me to break down any part further?" to encourage follow-up
- For production coding decisions, always add: "Verify with current official guidelines before production use."`;

  // ── Knowledge Base: Upload & Index ────────────────────────────────────────────
  if (url.pathname === "/api/knowledge/upload" && req.method === "POST") {
    const trainerKey = getTrainerKey(req);
    const access = readAccessConfig();
    if (!access.trainerKey || trainerKey !== access.trainerKey) return json(res, 403, { error: "Forbidden" });
    if (!USE_SUPABASE) return json(res, 503, { error: "Supabase required for knowledge base" });
    if (!process.env.VOYAGE_API_KEY) return json(res, 503, { error: "VOYAGE_API_KEY not configured" });
    try {
      const body = await parseBody(req);
      const originalName = String(body.fileName || "").trim();
      if (!originalName) return json(res, 400, { error: "fileName required" });
      if (!body.fileData) return json(res, 400, { error: "fileData required" });
      const buffer = Buffer.from(body.fileData, "base64");
      const fileType = path.extname(originalName).toLowerCase().replace(".", "");
      const rawText = await extractTextFromBuffer(buffer, originalName);
      if (!rawText.trim()) return json(res, 400, { error: "Could not extract text from file" });

      const chunks = chunkText(rawText, originalName);
      if (!chunks.length) return json(res, 400, { error: "No usable text found in file" });

      // Insert document record
      const { data: doc, error: docErr } = await supabase
        .from("knowledge_documents")
        .insert({ original_name: originalName, file_type: fileType, chunk_count: chunks.length, file_size_bytes: buffer.length })
        .select()
        .single();
      if (docErr) throw new Error(docErr.message);

      // Embed in batches of 20
      const BATCH = 20;
      for (let i = 0; i < chunks.length; i += BATCH) {
        const batch = chunks.slice(i, i + BATCH);
        const embeddings = await embedTexts(batch.map(c => c.content), "document");
        const rows = batch.map((c, j) => ({
          document_id: doc.id,
          chunk_index: i + j,
          content: c.content,
          embedding: embeddings[j],
          metadata: c.metadata
        }));
        const { error: chunkErr } = await supabase.from("knowledge_chunks").insert(rows);
        if (chunkErr) throw new Error(chunkErr.message);
      }
      return json(res, 200, { success: true, documentId: doc.id, chunkCount: chunks.length, name: originalName });
    } catch (err) {
      return json(res, 500, { error: `Upload failed: ${err.message}` });
    }
  }

  // ── Knowledge Base: Index existing disk files ──────────────────────────────
  if (url.pathname === "/api/knowledge/index-disk" && req.method === "POST") {
    const trainerKey = getTrainerKey(req);
    const access = readAccessConfig();
    if (!access.trainerKey || trainerKey !== access.trainerKey) return json(res, 403, { error: "Forbidden" });
    if (!USE_SUPABASE) return json(res, 503, { error: "Supabase required" });
    if (!process.env.VOYAGE_API_KEY) return json(res, 503, { error: "VOYAGE_API_KEY not configured" });

    const KB_DIR = path.join(__dirname, "knowledge-base");
    const DISK_FILES = fs.existsSync(KB_DIR)
      ? fs.readdirSync(KB_DIR).filter(f => /\.(pdf|xlsx|xls|txt|md|csv|docx|doc|jpg|jpeg|png|webp)$/i.test(f))
      : [];

    const results = [];
    for (const filename of DISK_FILES) {
      const filePath = path.join(KB_DIR, filename);
      if (!fs.existsSync(filePath)) { results.push({ name: filename, status: "not found" }); continue; }
      // Skip if already indexed
      const { data: existing } = await supabase.from("knowledge_documents").select("id").eq("original_name", filename).limit(1);
      if (existing && existing.length > 0) { results.push({ name: filename, status: "already indexed" }); continue; }
      try {
        const buffer = fs.readFileSync(filePath);
        const rawText = await extractTextFromBuffer(buffer, filename);
        if (!rawText.trim()) { results.push({ name: filename, status: "no text extracted" }); continue; }
        const chunks = chunkText(rawText, filename);
        const fileType = path.extname(filename).toLowerCase().replace(".", "");
        const { data: doc, error: docErr } = await supabase
          .from("knowledge_documents")
          .insert({ original_name: filename, file_type: fileType, chunk_count: chunks.length, file_size_bytes: buffer.length })
          .select().single();
        if (docErr) throw new Error(docErr.message);
        const BATCH = 20;
        for (let i = 0; i < chunks.length; i += BATCH) {
          const batch = chunks.slice(i, i + BATCH);
          const embeddings = await embedTexts(batch.map(c => c.content), "document");
          await supabase.from("knowledge_chunks").insert(
            batch.map((c, j) => ({ document_id: doc.id, chunk_index: i + j, content: c.content, embedding: embeddings[j], metadata: c.metadata }))
          );
        }
        results.push({ name: filename, status: "indexed", chunks: chunks.length });
      } catch (err) {
        results.push({ name: filename, status: `error: ${err.message}` });
      }
    }
    return json(res, 200, { results });
  }

  // ── Knowledge Base: List documents ────────────────────────────────────────
  if (url.pathname === "/api/knowledge/documents" && req.method === "GET") {
    const trainerKey = getTrainerKey(req);
    const access = readAccessConfig();
    if (!access.trainerKey || trainerKey !== access.trainerKey) return json(res, 403, { error: "Forbidden" });
    if (!USE_SUPABASE) return json(res, 200, { documents: [] });
    const { data, error } = await supabase
      .from("knowledge_documents")
      .select("id, original_name, file_type, chunk_count, file_size_bytes, uploaded_at")
      .order("uploaded_at", { ascending: false });
    if (error) return json(res, 500, { error: error.message });
    return json(res, 200, { documents: data || [] });
  }

  // ── Knowledge Base: Delete document ───────────────────────────────────────
  if (url.pathname === "/api/knowledge/document" && req.method === "DELETE") {
    const trainerKey = getTrainerKey(req);
    const access = readAccessConfig();
    if (!access.trainerKey || trainerKey !== access.trainerKey) return json(res, 403, { error: "Forbidden" });
    if (!USE_SUPABASE) return json(res, 503, { error: "Supabase required" });
    try {
      const body = await parseBody(req);
      const docId = String(body.id || "").trim();
      if (!docId) return json(res, 400, { error: "Document id required" });
      const { error } = await supabase.from("knowledge_documents").delete().eq("id", docId);
      if (error) throw new Error(error.message);
      return json(res, 200, { success: true });
    } catch (err) {
      return json(res, 500, { error: err.message });
    }
  }

  // ── AI Chat: Get usage count ───────────────────────────────────────────────
  if (url.pathname === "/api/ai/usage" && req.method === "GET") {
    const identifier = url.searchParams.get("id") || "";
    const count = await getChatUsage(identifier);
    return json(res, 200, { count, limit: TRIAL_CHAT_LIMIT });
  }

  // ── AI Chat: Streaming RAG chat ────────────────────────────────────────────
  if (url.pathname === "/api/ai/chat" && req.method === "POST") {
    const anthropicKey = process.env.ANTHROPIC_API_KEY || "";
    const voyageKey = process.env.VOYAGE_API_KEY || "";
    if (!anthropicKey) return json(res, 503, { error: "AI not configured" });

    try {
      const body = await parseBody(req);
      const message = String(body.message || "").trim().slice(0, 4000);
      const history = Array.isArray(body.history) ? body.history.slice(-12) : [];
      const role = String(body.role || "trial");
      const identifier = String(body.identifier || "").trim().slice(0, 200);

      if (!message) return json(res, 400, { error: "Message required" });

      // Trial limit check
      if (role === "trial" && identifier) {
        const usage = await getChatUsage(identifier);
        if (usage >= TRIAL_CHAT_LIMIT) {
          return json(res, 403, { error: "trial_limit_reached", count: usage, limit: TRIAL_CHAT_LIMIT });
        }
      }

      // RAG: embed query + search knowledge base
      let contextBlock = "";
      let sources = [];
      if (voyageKey && USE_SUPABASE) {
        try {
          const [queryEmbedding] = await embedTexts([message], "query");
          const { data: chunks } = await supabase.rpc("match_knowledge_chunks", {
            query_embedding: queryEmbedding,
            match_threshold: 0.45,
            match_count: 5
          });
          if (chunks && chunks.length > 0) {
            // Fetch document names for the matched chunks
            const docIds = [...new Set(chunks.map(c => c.document_id))];
            const { data: docs } = await supabase.from("knowledge_documents").select("id, original_name").in("id", docIds);
            const docMap = {};
            (docs || []).forEach(d => { docMap[d.id] = d.original_name; });
            sources = chunks.map(c => ({ source: docMap[c.document_id] || "Knowledge Base", similarity: Math.round(c.similarity * 100) }));
            contextBlock = "RELEVANT KNOWLEDGE BASE CONTEXT:\n" +
              chunks.map((c, i) => `[${i + 1}] Source: ${docMap[c.document_id] || "Knowledge Base"}\n${c.content}`).join("\n\n---\n\n");
          }
        } catch { /* RAG failure is non-fatal — Claude still answers from training */ }
      }

      // Build Claude messages
      const systemWithContext = contextBlock
        ? `${CODING_DESK_SYSTEM}\n\n${contextBlock}`
        : CODING_DESK_SYSTEM;

      const claudeMessages = [
        ...history.map(h => ({ role: h.role, content: h.content })),
        { role: "user", content: message }
      ];

      const selectedModel = selectCodingDeskModel(message);

      // Stream response
      const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: selectedModel, max_tokens: 2048, stream: true, system: systemWithContext, messages: claudeMessages })
      });

      if (!aiRes.ok) {
        const e = await aiRes.text();
        return json(res, 502, { error: `AI error: ${aiRes.status} — ${e}` });
      }

      // Set SSE headers
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" });

      // Send sources immediately before streaming starts
      if (sources.length > 0) {
        res.write(`data: ${JSON.stringify({ sources, model: selectedModel })}\n\n`);
      }

      // Stream Claude tokens
      const reader = aiRes.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const evt = JSON.parse(data);
            if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
              res.write(`data: ${JSON.stringify({ text: evt.delta.text })}\n\n`);
            } else if (evt.type === "message_stop") {
              res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            }
          } catch {}
        }
      }

      // Increment usage after successful response
      if (role === "trial" && identifier) await incrementChatUsage(identifier);

      res.end();
      return;
    } catch (err) {
      if (!res.headersSent) return json(res, 500, { error: `Chat failed: ${err.message}` });
      res.end();
      return;
    }
  }

  return serveFile(url.pathname, res);
});

server.listen(PORT, HOST, () => {
  if (!USE_SUPABASE) ensureDataStore();
  console.log(`MedCode app running at http://${HOST}:${PORT}`);
  console.log(`Storage mode: ${USE_SUPABASE ? "Supabase" : "File"}`);
});
