// ─── The Coding Desk — AI Chat Frontend ──────────────────────────────────────
(function () {
  "use strict";

  // ── State ──────────────────────────────────────────────────────────────────
  let cdHistory = [];        // [{role, content}] sent to server
  let cdUsageCount = 0;
  const CD_TRIAL_LIMIT = 5;

  // ── DOM helpers ────────────────────────────────────────────────────────────
  function cdDom(id) { return document.getElementById(id); }

  function getCdIdentifier() {
    const email = (typeof state !== "undefined" && state.userEmail) || "";
    const sessionId = (typeof state !== "undefined" && state.session?.id) || "";
    return email || sessionId || "anonymous";
  }

  function getCdRole() {
    return (typeof state !== "undefined" && state.role) || "trial";
  }

  function getCdTrainerKey() {
    return (typeof dom !== "undefined" && dom.trainerKey?.value) ||
      document.getElementById("trainerKey")?.value || "";
  }

  // ── Usage / limit UI ───────────────────────────────────────────────────────
  function updateUsageBar() {
    const role = getCdRole();
    const limitBar = cdDom("cdLimitBar");
    const limitText = cdDom("cdLimitText");
    if (!limitBar || !limitText) return;
    if (role === "trainer" || role === "trainee") {
      limitBar.classList.add("hidden");
      return;
    }
    limitBar.classList.remove("hidden");
    const remaining = Math.max(0, CD_TRIAL_LIMIT - cdUsageCount);
    limitText.textContent = `${remaining} free question${remaining !== 1 ? "s" : ""} remaining`;
    const pct = Math.round((cdUsageCount / CD_TRIAL_LIMIT) * 100);
    const fill = cdDom("cdLimitFill");
    if (fill) {
      fill.style.width = `${pct}%`;
      fill.style.background = pct >= 100 ? "#ef4444" : pct >= 60 ? "#f59e0b" : "#10b981";
    }
  }

  async function fetchUsage() {
    try {
      const id = encodeURIComponent(getCdIdentifier());
      const res = await fetch(`/api/ai/usage?id=${id}`);
      const data = await res.json();
      cdUsageCount = data.count || 0;
      updateUsageBar();
    } catch {}
  }

  // ── Render a message bubble ────────────────────────────────────────────────
  function appendMessage(role, content, sources) {
    const feed = cdDom("cdFeed");
    if (!feed) return null;

    const wrap = document.createElement("div");
    wrap.className = `cd-msg cd-msg--${role}`;

    if (role === "assistant") {
      const avatar = document.createElement("div");
      avatar.className = "cd-avatar";
      avatar.textContent = "🖥️";
      wrap.appendChild(avatar);
    }

    const bubble = document.createElement("div");
    bubble.className = "cd-bubble";
    bubble.innerHTML = mdToHtml(content);
    wrap.appendChild(bubble);

    if (role === "user") {
      const avatar = document.createElement("div");
      avatar.className = "cd-avatar cd-avatar--user";
      avatar.textContent = "👤";
      wrap.appendChild(avatar);
    }

    if (sources && sources.length > 0) {
      const sourceRow = document.createElement("div");
      sourceRow.className = "cd-sources";
      sourceRow.innerHTML = "📚 Sources: " + sources
        .filter((s, i, a) => a.findIndex(x => x.source === s.source) === i)
        .map(s => `<span class="cd-source-chip">${escapeHtml(s.source)}</span>`)
        .join("");
      wrap.appendChild(sourceRow);
    }

    feed.appendChild(wrap);
    feed.scrollTop = feed.scrollHeight;
    return bubble;
  }

  function appendStreamingBubble() {
    const feed = cdDom("cdFeed");
    if (!feed) return null;

    const wrap = document.createElement("div");
    wrap.className = "cd-msg cd-msg--assistant cd-msg--streaming";
    wrap.id = "cdStreamingMsg";

    const avatar = document.createElement("div");
    avatar.className = "cd-avatar";
    avatar.textContent = "🖥️";
    wrap.appendChild(avatar);

    const bubble = document.createElement("div");
    bubble.className = "cd-bubble";
    bubble.innerHTML = '<span class="cd-cursor">▋</span>';
    wrap.appendChild(bubble);

    feed.appendChild(wrap);
    feed.scrollTop = feed.scrollHeight;
    return bubble;
  }

  function appendSourcesToStreamingMsg(sources) {
    const wrap = cdDom("cdStreamingMsg");
    if (!wrap || !sources || !sources.length) return;
    const unique = sources.filter((s, i, a) => a.findIndex(x => x.source === s.source) === i);
    const sourceRow = document.createElement("div");
    sourceRow.className = "cd-sources";
    sourceRow.innerHTML = "📚 Sources: " + unique.map(s => `<span class="cd-source-chip">${escapeHtml(s.source)}</span>`).join("");
    wrap.appendChild(sourceRow);
  }

  // Very lightweight markdown → HTML (bold, code, headings, bullets)
  function mdToHtml(text) {
    return escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/^### (.+)$/gm, "<h4>$1</h4>")
      .replace(/^## (.+)$/gm, "<h3>$1</h3>")
      .replace(/^# (.+)$/gm, "<h3>$1</h3>")
      .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
      .replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>")
      .replace(/\n/g, "<br>");
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function appendSystemNote(text) {
    const feed = cdDom("cdFeed");
    if (!feed) return;
    const note = document.createElement("div");
    note.className = "cd-system-note";
    note.textContent = text;
    feed.appendChild(note);
    feed.scrollTop = feed.scrollHeight;
  }

  // ── Send message ───────────────────────────────────────────────────────────
  async function cdSend() {
    const input = cdDom("cdInput");
    const sendBtn = cdDom("cdSendBtn");
    if (!input || !sendBtn) return;
    const message = input.value.trim();
    if (!message) return;

    const role = getCdRole();

    // Trial limit check (client-side fast fail)
    if (role === "trial" && cdUsageCount >= CD_TRIAL_LIMIT) {
      showUpgradeWall();
      return;
    }

    input.value = "";
    input.style.height = "auto";
    sendBtn.disabled = true;

    // Render user message
    appendMessage("user", message);

    // Add to history
    cdHistory.push({ role: "user", content: message });

    // Streaming assistant bubble
    const streamBubble = appendStreamingBubble();
    let fullText = "";
    let streamSources = [];

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-trainer-key": getCdTrainerKey() },
        body: JSON.stringify({ message, history: cdHistory.slice(0, -1), role, identifier: getCdIdentifier() })
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.error === "trial_limit_reached") { showUpgradeWall(); cdHistory.pop(); return; }
        throw new Error(data.error || "Request failed");
      }

      // Read streaming response
      const reader = res.body.getReader();
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
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.sources) {
              streamSources = evt.sources;
              appendSourcesToStreamingMsg(streamSources);
            } else if (evt.text) {
              fullText += evt.text;
              if (streamBubble) {
                streamBubble.innerHTML = mdToHtml(fullText) + '<span class="cd-cursor">▋</span>';
                cdDom("cdFeed").scrollTop = cdDom("cdFeed").scrollHeight;
              }
            } else if (evt.done) {
              if (streamBubble) streamBubble.innerHTML = mdToHtml(fullText);
            }
          } catch {}
        }
      }

      // Finalize
      if (streamBubble) streamBubble.innerHTML = mdToHtml(fullText);
      const streamWrap = cdDom("cdStreamingMsg");
      if (streamWrap) streamWrap.id = "";

      cdHistory.push({ role: "assistant", content: fullText });
      // Keep history trimmed to last 12 turns
      if (cdHistory.length > 24) cdHistory = cdHistory.slice(-24);

      // Update usage
      if (role === "trial") {
        cdUsageCount++;
        updateUsageBar();
        if (cdUsageCount >= CD_TRIAL_LIMIT) showUpgradeWall();
      }

    } catch (err) {
      if (streamBubble) streamBubble.innerHTML = `<span style="color:#ef4444">Error: ${escapeHtml(err.message)}</span>`;
      const streamWrap = cdDom("cdStreamingMsg");
      if (streamWrap) streamWrap.id = "";
      cdHistory.pop(); // remove failed user message from history
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  }

  function showUpgradeWall() {
    const feed = cdDom("cdFeed");
    if (!feed) return;
    // Remove existing wall if any
    const existing = cdDom("cdUpgradeWall");
    if (existing) return;
    const wall = document.createElement("div");
    wall.id = "cdUpgradeWall";
    wall.className = "cd-upgrade-wall";
    wall.innerHTML = `
      <div class="cd-upgrade-inner">
        <div style="font-size:2rem;margin-bottom:8px;">🔒</div>
        <h3>You've used your 5 free questions</h3>
        <p>Get full access to ask unlimited questions, access all study materials, and unlock every feature.</p>
        <a href="${typeof buildWhatsappLink === 'function' ? buildWhatsappLink('Hi, I would like to get full access to PracticeBuddy Lab to use The Coding Desk AI assistant.') : '#'}"
           class="primary-btn" target="_blank" rel="noopener" style="display:inline-block;margin-top:8px;">
          💬 Get Full Access via WhatsApp
        </a>
      </div>`;
    feed.appendChild(wall);
    feed.scrollTop = feed.scrollHeight;
    // Disable input
    const input = cdDom("cdInput");
    const btn = cdDom("cdSendBtn");
    if (input) input.disabled = true;
    if (btn) btn.disabled = true;
  }

  // ── Knowledge Base (Mentor HQ sub-tab) ────────────────────────────────────
  async function kbLoadDocuments() {
    const tbody = cdDom("kbDocTableBody");
    const status = cdDom("kbStatus");
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8">Loading…</td></tr>';
    try {
      const trainerKey = getCdTrainerKey();
      const res = await fetch("/api/knowledge/documents", { headers: { "x-trainer-key": trainerKey } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const docs = data.documents || [];
      if (!docs.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8">No documents indexed yet. Upload files or click "Index Built-in Files".</td></tr>';
        return;
      }
      tbody.innerHTML = docs.map(d => `
        <tr>
          <td><strong>${escapeHtml(d.original_name)}</strong></td>
          <td><span class="summary-badge">${escapeHtml(d.file_type.toUpperCase())}</span></td>
          <td>${d.chunk_count} chunks</td>
          <td>${new Date(d.uploaded_at).toLocaleDateString()}</td>
          <td><button class="ghost-btn ghost-btn--danger" style="padding:2px 10px;font-size:0.78rem" onclick="kbDeleteDocument('${d.id}','${escapeHtml(d.original_name).replace(/'/g, "\\'")}')">Remove</button></td>
        </tr>`).join("");
    } catch (err) {
      if (status) { status.textContent = `Error: ${err.message}`; status.className = "status error"; }
    }
  }

  window.kbDeleteDocument = async function (id, name) {
    if (!confirm(`Remove "${name}" from the knowledge base?`)) return;
    const status = cdDom("kbStatus");
    try {
      const trainerKey = getCdTrainerKey();
      const res = await fetch("/api/knowledge/document", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-trainer-key": trainerKey },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (status) { status.textContent = `"${name}" removed.`; status.className = "status success"; }
      kbLoadDocuments();
    } catch (err) {
      if (status) { status.textContent = `Error: ${err.message}`; status.className = "status error"; }
    }
  };

  async function kbIndexDiskFiles() {
    const btn = cdDom("kbIndexDiskBtn");
    const status = cdDom("kbStatus");
    if (btn) { btn.disabled = true; btn.textContent = "Indexing… (this may take 1–2 min)"; }
    if (status) { status.textContent = "Indexing built-in files…"; status.className = "status"; }
    try {
      const trainerKey = getCdTrainerKey();
      const res = await fetch("/api/knowledge/index-disk", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-trainer-key": trainerKey },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const results = data.results || [];
      const indexed = results.filter(r => r.status === "indexed").length;
      const skipped = results.filter(r => r.status === "already indexed").length;
      if (status) {
        status.textContent = `Done — ${indexed} file(s) indexed, ${skipped} already existed.`;
        status.className = "status success";
      }
      kbLoadDocuments();
    } catch (err) {
      if (status) { status.textContent = `Error: ${err.message}`; status.className = "status error"; }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "⚡ Index Built-in Files"; }
    }
  }

  async function kbUploadFile(file) {
    const status = cdDom("kbStatus");
    const uploadBtn = cdDom("kbUploadBtn");
    if (!file) return;
    if (status) { status.textContent = `Reading "${file.name}"…`; status.className = "status"; }
    if (uploadBtn) uploadBtn.disabled = true;

    try {
      // Read as base64 — avoids multipart parsing issues entirely
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      if (status) { status.textContent = `Indexing "${file.name}" — this may take a minute…`; status.className = "status"; }

      const trainerKey = getCdTrainerKey();
      const res = await fetch("/api/knowledge/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-trainer-key": trainerKey },
        body: JSON.stringify({ fileName: file.name, fileData: base64, fileSize: file.size })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (status) { status.textContent = `✓ "${data.name}" indexed — ${data.chunkCount} chunks created.`; status.className = "status success"; }
      kbLoadDocuments();
    } catch (err) {
      if (status) { status.textContent = `Upload failed: ${err.message}`; status.className = "status error"; }
    } finally {
      if (uploadBtn) uploadBtn.disabled = false;
      const fileInput = cdDom("kbFileInput");
      if (fileInput) fileInput.value = "";
    }
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  function initCodingDesk() {
    // Chat send button & enter key
    const sendBtn = cdDom("cdSendBtn");
    const input = cdDom("cdInput");
    if (sendBtn) sendBtn.addEventListener("click", cdSend);
    if (input) {
      input.addEventListener("keydown", e => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); cdSend(); }
      });
      input.addEventListener("input", () => {
        input.style.height = "auto";
        input.style.height = Math.min(input.scrollHeight, 160) + "px";
      });
    }

    // Clear conversation
    const clearBtn = cdDom("cdClearBtn");
    if (clearBtn) clearBtn.addEventListener("click", () => {
      cdHistory = [];
      const feed = cdDom("cdFeed");
      if (feed) feed.innerHTML = "";
      const wall = cdDom("cdUpgradeWall");
      if (wall) wall.remove();
      const inp = cdDom("cdInput");
      const btn = cdDom("cdSendBtn");
      if (inp) inp.disabled = getCdRole() === "trial" && cdUsageCount >= CD_TRIAL_LIMIT;
      if (btn) btn.disabled = getCdRole() === "trial" && cdUsageCount >= CD_TRIAL_LIMIT;
      appendSystemNote("New conversation started. Ask me anything about medical coding.");
    });

    // Knowledge Base tab bindings
    const kbIndexBtn = cdDom("kbIndexDiskBtn");
    if (kbIndexBtn) kbIndexBtn.addEventListener("click", kbIndexDiskFiles);

    const kbUploadBtn = cdDom("kbUploadBtn");
    const kbFileInput = cdDom("kbFileInput");
    if (kbUploadBtn && kbFileInput) {
      kbUploadBtn.addEventListener("click", () => kbFileInput.click());
      kbFileInput.addEventListener("change", () => {
        if (kbFileInput.files[0]) kbUploadFile(kbFileInput.files[0]);
      });
    }

    // Fetch usage if session is active
    if (typeof state !== "undefined" && state.session?.isActive) {
      fetchUsage();
    }

    appendSystemNote("Welcome to The Coding Desk — your medical coding expert. Ask anything, from basic ICD-10 lookups to complex inpatient sequencing.");
  }

  // Expose for app.init.js to call after session starts
  window.initCodingDesk = initCodingDesk;
  window.kbLoadDocuments = kbLoadDocuments;
  window.fetchCdUsage = fetchUsage;

})();
