// ── Institute Dashboard ────────────────────────────────────────────────────

const instituteState = {
  key: "",
  tenantId: "",
  slug: "",
  name: "",
  settings: {},
  usedSeats: 0,
  students: [],
  cohorts: []
};

async function verifyInstitute() {
  const key = document.getElementById("instituteKeyInput")?.value.trim();
  const statusEl = document.getElementById("instituteAuthStatus");
  if (!key) { setStatus(statusEl, "Enter your institute key.", "error"); return; }
  try {
    setStatus(statusEl, "Verifying\u2026", "");
    const data = await apiRequest("/api/institute/auth", "POST", { key });
    instituteState.key = key;
    instituteState.tenantId = data.tenantId;
    instituteState.slug = data.slug;
    instituteState.name = data.name;
    instituteState.settings = data.settings || {};
    document.getElementById("instituteNameDisplay").textContent = data.name;
    document.getElementById("instituteDashboard").classList.remove("hidden");
    setStatus(statusEl, `Welcome, ${data.name}`, "success");
    await loadInstituteDashboard();
  } catch (err) {
    setStatus(statusEl, `Login failed: ${err.message}`, "error");
  }
}

function instApiRequest(path, method = "GET", payload = null) {
  return apiRequest(path, method, payload, null, { "X-Institute-Key": instituteState.key });
}

async function loadInstituteDashboard() {
  await Promise.all([loadInstituteInfo(), loadInstituteStudents(), loadInstituteCohorts()]);
}

async function loadInstituteInfo() {
  try {
    const data = await instApiRequest("/api/institute/info");
    instituteState.usedSeats = data.usedSeats || 0;
    const maxUsers = data.settings?.maxUsers || data.maxUsers || 50;
    document.getElementById("instituteSeatUsage").textContent = `${data.usedSeats} / ${maxUsers} seats`;
    const allowed = data.settings?.allowedTags;
    const modulesEl = document.getElementById("instituteModules");
    if (modulesEl) {
      modulesEl.textContent = allowed && allowed.length
        ? "Modules: " + allowed.join(", ")
        : "Modules: All";
    }
  } catch {}
}

async function loadInstituteStudents() {
  try {
    const data = await instApiRequest("/api/institute/students");
    instituteState.students = data.students || [];
    renderInstStudentTable();
  } catch (err) {
    setStatus(document.getElementById("instStudentStatus"), `Could not load students: ${err.message}`, "error");
  }
}

function renderInstStudentTable() {
  const tbody = document.getElementById("instStudentBody");
  if (!tbody) return;
  if (!instituteState.students.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;opacity:.6">No students yet.</td></tr>';
    return;
  }
  tbody.innerHTML = instituteState.students.map((s) => {
    const exp = s.expiresAt ? new Date(s.expiresAt).toLocaleDateString() : "\u2014";
    return `<tr>
      <td>${escapeHtml(s.email)}</td>
      <td>${escapeHtml(s.name || "\u2014")}</td>
      <td><code>${escapeHtml(s.accessCode || "\u2014")}</code></td>
      <td>${s.isActive !== false ? "Yes" : "No"}</td>
      <td>${escapeHtml(exp)}</td>
      <td>
        <button class="ghost-btn" type="button" onclick="populateInstStudent(${JSON.stringify(s.email)})">Edit</button>
        <button class="ghost-btn danger-btn" type="button" onclick="removeInstStudent(${JSON.stringify(s.email)})">Remove</button>
      </td>
    </tr>`;
  }).join("");
}

function populateInstStudent(email) {
  const s = instituteState.students.find((x) => x.email === email);
  if (!s) return;
  document.getElementById("instStudentEmail").value = s.email;
  document.getElementById("instStudentName").value = s.name || "";
  document.getElementById("instStudentCode").value = s.accessCode || "";
  document.getElementById("instStudentActive").value = s.isActive !== false ? "true" : "false";
  document.getElementById("instStudentExpiry").value = s.expiresAt ? new Date(s.expiresAt).toISOString().slice(0, 10) : "";
}

async function saveInstStudent() {
  const statusEl = document.getElementById("instStudentStatus");
  const email = document.getElementById("instStudentEmail")?.value.trim();
  if (!email) { setStatus(statusEl, "Email is required.", "error"); return; }
  try {
    const expiryVal = document.getElementById("instStudentExpiry")?.value;
    await instApiRequest("/api/institute/students", "POST", {
      email,
      name: document.getElementById("instStudentName")?.value.trim(),
      accessCode: document.getElementById("instStudentCode")?.value.trim(),
      isActive: document.getElementById("instStudentActive")?.value !== "false",
      expiresAt: expiryVal ? new Date(expiryVal).getTime() : null
    });
    clearInstStudentForm();
    await loadInstituteStudents();
    await loadInstituteInfo();
    setStatus(statusEl, "Student saved.", "success");
  } catch (err) {
    setStatus(statusEl, `Error: ${err.message}`, "error");
  }
}

async function removeInstStudent(email) {
  if (!confirm(`Remove ${email} from this institute?`)) return;
  const statusEl = document.getElementById("instStudentStatus");
  try {
    await instApiRequest("/api/institute/students", "DELETE", { email });
    await loadInstituteStudents();
    await loadInstituteInfo();
    setStatus(statusEl, "Student removed.", "success");
  } catch (err) {
    setStatus(statusEl, `Error: ${err.message}`, "error");
  }
}

function clearInstStudentForm() {
  ["instStudentEmail", "instStudentName", "instStudentCode", "instStudentExpiry"].forEach((id) => {
    const el = document.getElementById(id); if (el) el.value = "";
  });
  const activeEl = document.getElementById("instStudentActive");
  if (activeEl) activeEl.value = "true";
  setStatus(document.getElementById("instStudentStatus"), "", "");
}

async function loadInstituteCohorts() {
  try {
    const data = await instApiRequest("/api/institute/cohorts");
    instituteState.cohorts = data.cohorts || [];
    renderInstCohortTable();
  } catch (err) {
    setStatus(document.getElementById("instCohortStatus"), `Could not load cohorts: ${err.message}`, "error");
  }
}

function renderInstCohortTable() {
  const tbody = document.getElementById("instCohortBody");
  if (!tbody) return;
  if (!instituteState.cohorts.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;opacity:.6">No cohorts yet.</td></tr>';
    return;
  }
  tbody.innerHTML = instituteState.cohorts.map((c) => {
    const limit = c.questionLimit >= 1000000 ? "Unlimited" : String(c.questionLimit);
    return `<tr>
      <td>${escapeHtml(c.name)}</td>
      <td><code>${escapeHtml(c.accessCode)}</code></td>
      <td>${escapeHtml(limit)}</td>
      <td>${c.isActive ? "Yes" : "No"}</td>
      <td><button class="ghost-btn" type="button" onclick="populateInstCohort(${JSON.stringify(c.id)})">Edit</button></td>
    </tr>`;
  }).join("");
}

function populateInstCohort(cohortId) {
  const c = instituteState.cohorts.find((x) => x.id === cohortId);
  if (!c) return;
  document.getElementById("instCohortId").value = c.id;
  document.getElementById("instCohortName").value = c.name;
  document.getElementById("instCohortCode").value = c.accessCode;
  document.getElementById("instCohortLimit").value = c.questionLimit >= 1000000 ? "" : String(c.questionLimit);
  document.getElementById("instCohortActive").value = c.isActive ? "true" : "false";
  document.getElementById("instCohortExpiry").value = c.expiresAt ? new Date(c.expiresAt).toISOString().slice(0, 10) : "";
  document.getElementById("instituteCohortsSection").open = true;
}

async function saveInstCohort() {
  const statusEl = document.getElementById("instCohortStatus");
  const name = document.getElementById("instCohortName")?.value.trim();
  const code = document.getElementById("instCohortCode")?.value.trim();
  if (!name || !code) { setStatus(statusEl, "Name and code are required.", "error"); return; }
  try {
    const cohortId = document.getElementById("instCohortId")?.value.trim() || undefined;
    const expiryVal = document.getElementById("instCohortExpiry")?.value;
    await instApiRequest("/api/institute/cohorts", "POST", {
      cohortId,
      name,
      accessCode: code,
      questionLimit: Number(document.getElementById("instCohortLimit")?.value) || 1000000,
      isActive: document.getElementById("instCohortActive")?.value !== "false",
      expiresAt: expiryVal ? new Date(expiryVal).getTime() : null
    });
    clearInstCohortForm();
    await loadInstituteCohorts();
    setStatus(statusEl, "Cohort saved.", "success");
  } catch (err) {
    setStatus(statusEl, `Error: ${err.message}`, "error");
  }
}

function clearInstCohortForm() {
  document.getElementById("instCohortId").value = "";
  ["instCohortName", "instCohortCode", "instCohortLimit", "instCohortExpiry"].forEach((id) => {
    const el = document.getElementById(id); if (el) el.value = "";
  });
  const activeEl = document.getElementById("instCohortActive");
  if (activeEl) activeEl.value = "true";
  setStatus(document.getElementById("instCohortStatus"), "", "");
}

async function loadInstAnalytics() {
  const statusEl = document.getElementById("instAnalyticsStatus");
  const tbody = document.getElementById("instAnalyticsBody");
  try {
    setStatus(statusEl, "Loading\u2026", "");
    const data = await instApiRequest("/api/institute/analytics");
    const rows = data.analytics || [];
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;opacity:.6">No session data yet.</td></tr>';
      setStatus(statusEl, "", "");
      return;
    }
    tbody.innerHTML = rows.map((r) => {
      const acc = r.attempted > 0 ? Math.round((r.correct / r.attempted) * 100) + "%" : "\u2014";
      const last = r.lastActive ? new Date(r.lastActive).toLocaleDateString() : "\u2014";
      return `<tr>
        <td>${escapeHtml(r.email)}</td>
        <td>${escapeHtml(r.name || "\u2014")}</td>
        <td>${r.sessionCount}</td>
        <td>${r.attempted}</td>
        <td>${acc}</td>
        <td>${escapeHtml(last)}</td>
      </tr>`;
    }).join("");
    setStatus(statusEl, `${rows.length} student(s) with activity.`, "success");
  } catch (err) {
    setStatus(statusEl, `Error: ${err.message}`, "error");
  }
}
