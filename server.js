const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 4173;
const HOST = process.env.HOST || "0.0.0.0";
const TRAINER_KEY = process.env.TRAINER_KEY || "";
const TRAINEE_ACCESS_CODE = process.env.TRAINEE_ACCESS_CODE || "";

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const SESSION_FILE = path.join(DATA_DIR, "sessions.json");

function ensureDataStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SESSION_FILE)) fs.writeFileSync(SESSION_FILE, JSON.stringify({ sessions: [] }, null, 2));
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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/health" && req.method === "GET") {
    return json(res, 200, { ok: true, timestamp: Date.now() });
  }

  if (url.pathname === "/api/access/verify" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const code = String(body.code || "");
      return json(res, 200, { valid: Boolean(TRAINEE_ACCESS_CODE) && code === TRAINEE_ACCESS_CODE });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/trainer/verify" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const key = String(body.trainerKey || "");
      return json(res, 200, { valid: Boolean(TRAINER_KEY) && key === TRAINER_KEY });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/session/start" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const sessionId = String(body.sessionId || `session_${Math.random().toString(36).slice(2, 10)}`);
      const userName = String(body.userName || "anonymous");
      const userEmail = String(body.userEmail || "");
      const userPhone = String(body.userPhone || "");
      const role = String(body.role || "trainee");
      const sessions = readSessions();

      if (findSessionIndex(sessions, sessionId) >= 0) {
        return json(res, 200, { id: sessionId, reused: true });
      }

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
      return json(res, 201, { id: sessionId });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/session/answer" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const sessionId = String(body.sessionId || "");
      if (!sessionId) return json(res, 400, { error: "Missing sessionId" });

      const sessions = readSessions();
      const idx = findSessionIndex(sessions, sessionId);
      if (idx < 0) return json(res, 404, { error: "Session not found" });

      const answerLog = {
        cardTag: String(body.cardTag || "General"),
        question: String(body.question || ""),
        expectedAnswer: String(body.expectedAnswer || ""),
        acceptedAnswers: Array.isArray(body.acceptedAnswers) ? body.acceptedAnswers : [],
        userAnswer: String(body.userAnswer || ""),
        isCorrect: Boolean(body.isCorrect),
        at: Number(body.at || Date.now())
      };

      sessions[idx].answers.push(answerLog);
      const correct = sessions[idx].answers.filter((a) => a.isCorrect).length;
      const attempted = sessions[idx].answers.length;
      const wrong = attempted - correct;
      sessions[idx].summary = {
        correct,
        wrong,
        attempted,
        score: attempted ? Math.round((correct / attempted) * 100) : 0
      };

      writeSessions(sessions);
      return json(res, 201, { ok: true });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/session/end" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const sessionId = String(body.sessionId || "");
      if (!sessionId) return json(res, 400, { error: "Missing sessionId" });

      const sessions = readSessions();
      const idx = findSessionIndex(sessions, sessionId);
      if (idx < 0) return json(res, 404, { error: "Session not found" });

      sessions[idx].endedAt = Date.now();
      if (body.summary && typeof body.summary === "object") {
        sessions[idx].summary = {
          correct: Number(body.summary.correct || 0),
          wrong: Number(body.summary.wrong || 0),
          attempted: Number(body.summary.attempted || 0),
          score: Number(body.summary.score || 0)
        };
      }

      writeSessions(sessions);
      return json(res, 200, { ok: true });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (url.pathname === "/api/sessions" && req.method === "GET") {
    const key = url.searchParams.get("trainerKey");
    if (key !== TRAINER_KEY) return json(res, 403, { error: "Forbidden" });

    const sessions = readSessions();
    const slim = sessions.map((s) => ({
      id: s.id,
      userName: s.userName,
      role: s.role,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      summary: s.summary
    }));

    return json(res, 200, { sessions: slim });
  }

  return serveFile(url.pathname, res);
});

server.listen(PORT, HOST, () => {
  ensureDataStore();
  console.log(`MedCode app running at http://${HOST}:${PORT}`);
});
