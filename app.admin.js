
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

function renderLearnerAccessTable() {
  const items = Array.isArray(state.adminPanel.learners) ? state.adminPanel.learners : [];
  if (!items.length) {
    dom.learnerAccessBody.innerHTML = '<tr><td colspan="5">No learner emails loaded.</td></tr>';
    return;
  }

  dom.learnerAccessBody.innerHTML = items
    .map((item) => {
      const email = String(item.email || "");
      const active = item.isActive !== false;
      const expiry = item.expiresAt ? toDateInputValue(item.expiresAt) : "-";
      const updated = item.updatedAt ? new Date(Number(item.updatedAt)).toLocaleString() : "-";
      return `<tr>
        <td>${escapeHtml(email)}</td>
        <td>${active ? "Yes" : "No"}</td>
        <td>${escapeHtml(expiry)}</td>
        <td>${escapeHtml(updated)}</td>
        <td>
          <button class="ghost-btn" type="button" data-learner-action="${active ? "deactivate" : "activate"}" data-learner-email="${escapeHtml(email)}">${active ? "Deactivate" : "Activate"}</button>
          <button class="ghost-btn" type="button" data-learner-action="extend30" data-learner-email="${escapeHtml(email)}">+30d</button>
          <button class="ghost-btn danger-btn" type="button" data-learner-action="remove" data-learner-email="${escapeHtml(email)}">Remove</button>
        </td>
      </tr>`;
    })
    .join("");
}

async function loadLearnerAccessList() {
  if (!state.adminPanel.verified || !state.adminKey) return;
  try {
    const data = await apiRequest(`/api/admin/learners`, "GET", null, state.adminKey);
    state.adminPanel.learners = Array.isArray(data.learners) ? data.learners : [];
    renderLearnerAccessTable();
  } catch (err) {
    setStatus(dom.learnerAccessStatus, `Could not load learner access list: ${err.message}`, "error");
  }
}

async function saveLearnerAccess() {
  if (!state.adminPanel.verified || !state.adminKey) {
    setStatus(dom.learnerAccessStatus, "Verify admin key first.", "error");
    return;
  }
  const email = String(dom.learnerEmailInput.value || "").trim().toLowerCase();
  const isActive = dom.learnerActiveInput.value !== "false";
  const expiresAt = toEpochFromDateInput(dom.learnerExpiryInput.value);
  if (!email) {
    setStatus(dom.learnerAccessStatus, "Learner email is required.", "error");
    return;
  }

  try {
    await apiRequest("/api/admin/learners", "POST", {
      adminKey: state.adminKey,
      email,
      isActive,
      expiresAt
    });
    dom.learnerEmailInput.value = "";
    dom.learnerExpiryInput.value = "";
    dom.learnerActiveInput.value = "true";
    await loadLearnerAccessList();
    setStatus(dom.learnerAccessStatus, "Learner access saved.", "success");
  } catch (err) {
    setStatus(dom.learnerAccessStatus, `Could not save learner access: ${err.message}`, "error");
  }
}

async function handleLearnerAccessAction(action, email) {
  if (!state.adminPanel.verified || !state.adminKey) return;
  const current = (state.adminPanel.learners || []).find((item) => String(item.email || "") === String(email || ""));
  if (!current) return;

  try {
    if (action === "remove") {
      await apiRequest("/api/admin/learners/remove", "POST", {
        adminKey: state.adminKey,
        email
      });
      await loadLearnerAccessList();
      setStatus(dom.learnerAccessStatus, "Learner removed.", "success");
      return;
    }

    let nextIsActive = current.isActive !== false;
    let nextExpiresAt = current.expiresAt ? Number(current.expiresAt) : null;
    if (action === "activate") nextIsActive = true;
    if (action === "deactivate") nextIsActive = false;
    if (action === "extend30") {
      const base = nextExpiresAt && nextExpiresAt > Date.now() ? nextExpiresAt : Date.now();
      nextExpiresAt = base + 30 * 24 * 60 * 60 * 1000;
    }

    await apiRequest("/api/admin/learners", "POST", {
      adminKey: state.adminKey,
      email,
      isActive: nextIsActive,
      expiresAt: nextExpiresAt
    });
    await loadLearnerAccessList();
    setStatus(dom.learnerAccessStatus, "Learner access updated.", "success");
  } catch (err) {
    setStatus(dom.learnerAccessStatus, `Could not update learner access: ${err.message}`, "error");
  }
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

async function loadAuditLog({ limit = 200, actionFilter = "", since = 0 } = {}) {
  if (!state.adminPanel.verified || !state.adminKey) return;
  const el = document.getElementById("auditLogBody");
  const statusEl = document.getElementById("auditLogStatus");
  if (!el) return;
  try {
    const params = new URLSearchParams({ limit: String(limit) });
    if (actionFilter) params.set("action", actionFilter);
    if (since) params.set("since", String(since));
    const data = await apiRequest(`/api/admin/audit-log?${params}`, "GET", null, state.adminKey);
    const events = Array.isArray(data.events) ? data.events : [];
    if (!events.length) {
      el.innerHTML = '<tr><td colspan="5" style="text-align:center;opacity:.6">No audit events recorded yet.</td></tr>';
      if (statusEl) setStatus(statusEl, "Loaded 0 events.", "");
      return;
    }
    el.innerHTML = events.map((e) => {
      const time = new Date(Number(e.ts || 0)).toLocaleString();
      const meta = e.meta && typeof e.meta === "object" ? JSON.stringify(e.meta).slice(0, 120) : "";
      const actionGroup = String(e.action || "").split(".")[0];
      return `<tr>
        <td style="white-space:nowrap;font-size:12px">${escapeHtml(time)}</td>
        <td><span class="audit-action-badge audit-action-${escapeHtml(actionGroup)}">${escapeHtml(e.action || "")}</span></td>
        <td>${escapeHtml(e.actor || "")}</td>
        <td>${escapeHtml(e.actorRole || "")}</td>
        <td style="font-family:monospace;font-size:11px;opacity:.75;word-break:break-all">${escapeHtml(meta)}</td>
      </tr>`;
    }).join("");
    if (statusEl) setStatus(statusEl, `Showing ${events.length} of ${data.total || events.length} events.`, "success");
  } catch (err) {
    el.innerHTML = `<tr><td colspan="5">Could not load audit log: ${escapeHtml(err.message)}</td></tr>`;
    if (statusEl) setStatus(statusEl, `Error: ${err.message}`, "error");
  }
}

async function loadAdminData() {
  if (!state.adminPanel.verified || !state.adminKey) {
    setStatus(dom.adminStatus, "Verify admin key first.", "error");
    return;
  }
  try {
    const [configRes, cohortRes, learnerRes] = await Promise.all([
      apiRequest(`/api/admin/access-config`, "GET", null, state.adminKey),
      apiRequest(`/api/admin/cohorts`, "GET", null, state.adminKey),
      apiRequest(`/api/admin/learners`, "GET", null, state.adminKey)
    ]);

    dom.adminTraineeCode.value = String(configRes.traineeAccessCode || "");
    dom.adminTrainerKey.value = String(configRes.trainerKey || "");
    dom.adminTrialLimit.value = String(configRes.trialQuestionLimit || state.accessConfig.trialQuestionLimit || 20);
    dom.adminMaxSessionLimit.value = String(configRes.maxSessionQuestions || state.accessConfig.maxSessionQuestions || 250);
    dom.adminTraineeActive.value = configRes.traineeAccessActive === false ? "false" : "true";
    dom.adminTraineeExpiry.value = toDateInputValue(configRes.traineeAccessExpiresAt);
    state.adminPanel.cohorts = Array.isArray(cohortRes.cohorts) ? cohortRes.cohorts : [];
    state.adminPanel.learners = Array.isArray(learnerRes.learners) ? learnerRes.learners : [];
    renderAdminSummary(configRes, state.adminPanel.cohorts);
    renderCohortUI();
    renderLearnerAccessTable();
    renderAnalyticsCohorts(state.adminPanel.cohorts);
    await loadBlueprintTemplates();
    await loadAuditLog();
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
  const maxSessionQuestions = Math.max(1, Number(dom.adminMaxSessionLimit.value || state.accessConfig.maxSessionQuestions || 250));
  const traineeAccessActive = dom.adminTraineeActive.value !== "false";
  const traineeAccessExpiresAt = toEpochFromDateInput(dom.adminTraineeExpiry.value);

  try {
    await apiRequest("/api/admin/access-config", "POST", {
      adminKey: state.adminKey,
      traineeAccessCode,
      trainerKey,
      traineeAccessActive,
      traineeAccessExpiresAt,
      trialQuestionLimit,
      maxSessionQuestions
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

// ── Tenant Management ────────────────────────────────────────────────────────

let _tenantList = [];

function renderTenantTable(tenants) {
  _tenantList = Array.isArray(tenants) ? tenants : [];
  const tbody = document.getElementById("tenantTableBody");
  if (!tbody) return;
  if (!_tenantList.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;opacity:.6">No tenants found.</td></tr>';
    return;
  }
  tbody.innerHTML = _tenantList.map((t) => {
    const tags = t.settings?.allowedTags;
    const tagStr = Array.isArray(tags) && tags.length ? tags.join(", ") : "All";
    const statusBadge = t.isActive !== false
      ? '<span style="color:#10b981;font-weight:600">Active</span>'
      : '<span style="color:#ef4444;font-weight:600">Inactive</span>';
    return `<tr>
      <td>${escapeHtml(t.name)}</td>
      <td><code>${escapeHtml(t.slug)}</code></td>
      <td>${statusBadge}</td>
      <td><code style="font-size:.78rem">${t.trainerKey ? escapeHtml(t.trainerKey.slice(0, 6) + "…") : "—"}</code></td>
      <td style="font-size:.78rem">${escapeHtml(tagStr)}</td>
      <td>
        <button class="ghost-btn" type="button" onclick="populateTenantForm(${escapeHtml(JSON.stringify(t.id))})">Edit</button>
      </td>
    </tr>`;
  }).join("");
}

function populateTenantForm(tenantId) {
  const t = _tenantList.find((x) => x.id === tenantId);
  if (!t) return;
  document.getElementById("tenantEditId").value = t.id;
  document.getElementById("tenantFormName").value = t.name || "";
  document.getElementById("tenantFormSlug").value = t.slug || "";
  document.getElementById("tenantFormTrainerKey").value = t.trainerKey || "";
  document.getElementById("tenantFormAdminKey").value = t.adminKey || "";
  document.getElementById("tenantFormTrialLimit").value = t.settings?.trialQuestionLimit || 20;
  document.getElementById("tenantFormSessionCap").value = t.settings?.maxSessionQuestions || 250;
  document.getElementById("tenantFormActive").value = t.isActive !== false ? "true" : "false";
  document.getElementById("tenantFormTitle").textContent = `Edit: ${t.name}`;
  const allowed = Array.isArray(t.settings?.allowedTags) ? t.settings.allowedTags : [];
  document.querySelectorAll("#tenantTagCheckboxes input[type=checkbox]").forEach((cb) => {
    cb.checked = allowed.includes(cb.value);
  });
  document.getElementById("tenantFormPanel").open = true;
  document.getElementById("tenantFormPanel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function clearTenantForm() {
  document.getElementById("tenantEditId").value = "";
  document.getElementById("tenantFormName").value = "";
  document.getElementById("tenantFormSlug").value = "";
  document.getElementById("tenantFormTrainerKey").value = "";
  document.getElementById("tenantFormAdminKey").value = "";
  document.getElementById("tenantFormTrialLimit").value = "20";
  document.getElementById("tenantFormSessionCap").value = "250";
  document.getElementById("tenantFormActive").value = "true";
  document.getElementById("tenantFormTitle").textContent = "Create New Tenant";
  document.querySelectorAll("#tenantTagCheckboxes input[type=checkbox]").forEach((cb) => { cb.checked = false; });
  setStatus(document.getElementById("tenantFormStatus"), "", "");
}

async function loadTenants() {
  const key = document.getElementById("superAdminKeyInput")?.value.trim();
  const statusEl = document.getElementById("tenantMgrStatus");
  const toolsEl = document.getElementById("tenantMgrTools");
  if (!key) { setStatus(statusEl, "Enter super admin key first.", "error"); return; }
  try {
    setStatus(statusEl, "Loading tenants…", "");
    const data = await apiRequest("/api/superadmin/tenants", "GET", null, null, { "X-Super-Admin-Key": key });
    renderTenantTable(data.tenants);
    toolsEl.classList.remove("hidden");
    setStatus(statusEl, `${(data.tenants || []).length} tenant(s) loaded.`, "success");
  } catch (err) {
    setStatus(statusEl, `Error: ${err.message}`, "error");
  }
}

async function saveTenant() {
  const key = document.getElementById("superAdminKeyInput")?.value.trim();
  const statusEl = document.getElementById("tenantFormStatus");
  if (!key) { setStatus(statusEl, "Enter super admin key first.", "error"); return; }
  const tenantId = document.getElementById("tenantEditId").value.trim() || undefined;
  const allowedTags = Array.from(
    document.querySelectorAll("#tenantTagCheckboxes input[type=checkbox]:checked")
  ).map((cb) => cb.value);
  const payload = {
    tenantId,
    name: document.getElementById("tenantFormName").value.trim(),
    slug: document.getElementById("tenantFormSlug").value.trim(),
    trainerKey: document.getElementById("tenantFormTrainerKey").value.trim() || undefined,
    adminKey: document.getElementById("tenantFormAdminKey").value.trim() || undefined,
    isActive: document.getElementById("tenantFormActive").value !== "false",
    settings: {
      trialQuestionLimit: Number(document.getElementById("tenantFormTrialLimit").value) || 20,
      maxSessionQuestions: Number(document.getElementById("tenantFormSessionCap").value) || 250,
      allowedTags
    }
  };
  try {
    setStatus(statusEl, "Saving…", "");
    const data = await apiRequest("/api/superadmin/tenants", "POST", payload, null, { "X-Super-Admin-Key": key });
    setStatus(statusEl, `Tenant "${data.tenant?.name}" saved.`, "success");
    clearTenantForm();
    await loadTenants();
  } catch (err) {
    setStatus(statusEl, `Error: ${err.message}`, "error");
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

