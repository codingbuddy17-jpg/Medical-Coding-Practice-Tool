const ONBOARDING_STORAGE_KEY = "pbl_onboarding_v1";

const ONBOARDING_STEPS = [
  {
    icon: "🗂️",
    title: "Pick a Coding Stream",
    body: "After starting a session, choose a category — ICD-10-CM, CPT, HCPCS, E&M, or any stream loaded by your trainer. Each button focuses your drill to that topic only.",
    hint: "Look for the <strong>Select Category</strong> panel once your session is active."
  },
  {
    icon: "✏️",
    title: "Answer One Question at a Time",
    body: "Type your code or select an MCQ option, then hit <strong>Check</strong>. Use <strong>Skip</strong> sparingly — skips count against your session score.",
    hint: "After checking, the correct answer and rationale are revealed before you move on."
  },
  {
    icon: "📊",
    title: "Track Your Progress",
    body: "Your session score, daily streak, and badge milestones update in real time. Aim for <strong>80%+</strong> accuracy to hit the Accuracy badge.",
    hint: "The dashboard strip at the top of the practice screen shows live stats."
  }
];

function shouldShowOnboarding() {
  try {
    return !localStorage.getItem(ONBOARDING_STORAGE_KEY);
  } catch {
    return false;
  }
}

function markOnboardingDone() {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
  } catch {
    // storage unavailable — silently ignore
  }
}

function renderOnboardingStep(stepIndex) {
  const step = ONBOARDING_STEPS[stepIndex];
  const total = ONBOARDING_STEPS.length;

  const iconEl = document.getElementById("onboardingIcon");
  const titleEl = document.getElementById("onboardingTitle");
  const bodyEl = document.getElementById("onboardingBody");
  const hintEl = document.getElementById("onboardingHint");
  const counterEl = document.getElementById("onboardingCounter");
  const nextBtn = document.getElementById("onboardingNextBtn");
  const dots = document.querySelectorAll(".onboarding-dot");
  const progressFill = document.getElementById("onboardingProgressFill");

  if (iconEl) iconEl.textContent = step.icon;
  if (titleEl) titleEl.textContent = step.title;
  if (bodyEl) bodyEl.innerHTML = step.body;
  if (hintEl) hintEl.innerHTML = step.hint;
  if (counterEl) counterEl.textContent = `Step ${stepIndex + 1} of ${total}`;
  if (nextBtn) nextBtn.textContent = stepIndex === total - 1 ? "Let's go!" : "Next →";
  if (progressFill) progressFill.style.width = `${Math.round(((stepIndex + 1) / total) * 100)}%`;

  dots.forEach((dot, i) => dot.classList.toggle("active", i === stepIndex));

  const overlay = document.getElementById("onboardingOverlay");
  if (overlay) overlay.dataset.step = stepIndex;
}

function onboardingAdvance() {
  const overlay = document.getElementById("onboardingOverlay");
  if (!overlay) return;
  const current = Number(overlay.dataset.step || 0);
  if (current < ONBOARDING_STEPS.length - 1) {
    renderOnboardingStep(current + 1);
  } else {
    closeOnboarding();
  }
}

function closeOnboarding() {
  const overlay = document.getElementById("onboardingOverlay");
  if (overlay) {
    overlay.classList.add("onboarding-leaving");
    setTimeout(() => {
      overlay.classList.add("hidden");
      overlay.classList.remove("onboarding-leaving");
    }, 250);
  }
  markOnboardingDone();
}

function openOnboarding() {
  const overlay = document.getElementById("onboardingOverlay");
  if (!overlay) return;
  overlay.classList.remove("hidden");
  renderOnboardingStep(0);
}

// Called at end of file — DOM is already available (script at bottom of body)
// Called by the navigation system when the practice tab first becomes visible
function maybeShowOnboardingForPractice() {
  if (shouldShowOnboarding()) {
    setTimeout(openOnboarding, 600);
  }
}

function initOnboarding() {
  const nextBtn = document.getElementById("onboardingNextBtn");
  const skipBtn = document.getElementById("onboardingSkipBtn");
  const replayBtn = document.getElementById("onboardingReplayBtn");
  const backdrop = document.getElementById("onboardingOverlay");

  if (nextBtn) nextBtn.addEventListener("click", onboardingAdvance);
  if (skipBtn) skipBtn.addEventListener("click", closeOnboarding);
  if (replayBtn) replayBtn.addEventListener("click", openOnboarding);

  // Close on backdrop click (outside the card)
  if (backdrop) {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeOnboarding();
    });
  }

  // Close on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeOnboarding();
  });

  // Pulse the ? button on first visit to draw attention
  if (shouldShowOnboarding()) {
    const btn = document.getElementById("onboardingReplayBtn");
    if (btn) btn.classList.add("onboarding-help-pulse");
  }
}

initOnboarding();
