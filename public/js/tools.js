// ══════════════════════════════════════════════════════
//  tools.js – Visual tool implementations
// ══════════════════════════════════════════════════════

const ZubiTools = (() => {
  let starCount = 0;

  // ── highlightObject ─────────────────────────────────
  function highlightObject({ label }) {
    const overlay = document.getElementById("highlight-overlay");
    if (!overlay) return;

    // Remove old highlights
    overlay.innerHTML = "";

    const el = document.createElement("div");
    el.className = "highlight-label";
    el.textContent = `👉 ${label}`;

    // Random-ish position
    const top = 20 + Math.random() * 40;
    const left = 15 + Math.random() * 50;
    el.style.top = `${top}%`;
    el.style.left = `${left}%`;

    overlay.appendChild(el);

    // Remove after 3 seconds
    setTimeout(() => {
      el.style.transition = "opacity 0.5s";
      el.style.opacity = "0";
      setTimeout(() => el.remove(), 500);
    }, 3000);
  }

  // ── addRewardStar ───────────────────────────────────
  function addRewardStar({ reason }) {
    starCount++;
    const countEl = document.getElementById("star-count");
    if (countEl) countEl.textContent = starCount;

    // Show reward overlay
    const overlay = document.getElementById("reward-overlay");
    const text = document.getElementById("reward-text");
    if (overlay && text) {
      text.textContent = reason || "Great job!";
      overlay.classList.remove("hidden");

      // Also trigger star confetti
      spawnStarParticles();

      setTimeout(() => {
        overlay.classList.add("hidden");
      }, 2200);
    }

    // Play a subtle sound (if available)
    playRewardSound();
  }

  // ── showEmojiReaction ───────────────────────────────
  function showEmojiReaction({ emoji }) {
    const container = document.getElementById("emoji-float");
    if (!container) return;

    // Spawn multiple emojis
    const count = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const el = document.createElement("div");
        el.className = "floating-emoji";
        el.textContent = emoji;
        el.style.left = `${10 + Math.random() * 80}%`;
        el.style.bottom = "0";
        el.style.animationDuration = `${1.5 + Math.random() * 1}s`;
        container.appendChild(el);
        setTimeout(() => el.remove(), 3000);
      }, i * 150);
    }
  }

  // ── Helper: star particles ──────────────────────────
  function spawnStarParticles() {
    const container = document.getElementById("emoji-float");
    if (!container) return;
    const emojis = ["⭐", "🌟", "✨", "💫"];
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        const el = document.createElement("div");
        el.className = "floating-emoji";
        el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        el.style.left = `${Math.random() * 90}%`;
        el.style.bottom = `${Math.random() * 30}%`;
        el.style.animationDuration = `${1.2 + Math.random() * 1}s`;
        container.appendChild(el);
        setTimeout(() => el.remove(), 3000);
      }, i * 100);
    }
  }

  // ── Helper: simple reward sound via AudioContext ────
  function playRewardSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          ctx.currentTime + i * 0.15 + 0.4,
        );
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.15);
        osc.stop(ctx.currentTime + i * 0.15 + 0.5);
      });
    } catch (e) {
      // Audio not available – ignore
    }
  }

  // ── Execute a tool call from server response ────────
  function execute(toolCall) {
    if (!toolCall || !toolCall.name) return;

    const fn = {
      highlightObject,
      addRewardStar,
      showEmojiReaction,
    }[toolCall.name];

    if (fn) {
      fn(toolCall.arguments || {});
    }
  }

  // ── Reset stars ─────────────────────────────────────
  function reset() {
    starCount = 0;
    const countEl = document.getElementById("star-count");
    if (countEl) countEl.textContent = "0";
  }

  return { highlightObject, addRewardStar, showEmojiReaction, execute, reset };
})();
