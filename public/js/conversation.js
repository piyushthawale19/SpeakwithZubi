// ══════════════════════════════════════════════════════
//  conversation.js – Manages the chat flow with the server
// ══════════════════════════════════════════════════════

const ZubiConversation = (() => {
  let messages = []; // { role: "user"|"assistant", content: string }
  let imageUrl = null;
  let turnCount = 0;
  let startTime = null;
  let timerInterval = null;
  let conversationEnded = false;

  // ── Set the image URL ───────────────────────────────
  function setImage(url) {
    imageUrl = url;
  }

  // ── Start timer ─────────────────────────────────────
  function startTimer() {
    startTime = Date.now();
    const timerEl = document.getElementById("timer-display");

    timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const min = Math.floor(elapsed / 60);
      const sec = String(elapsed % 60).padStart(2, "0");
      if (timerEl) timerEl.textContent = `⏱️ ${min}:${sec}`;
    }, 1000);
  }

  // ── Stop timer ──────────────────────────────────────
  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  // ── Send a message to the server & get response ────
  async function sendMessage(userText) {
    if (conversationEnded) return null;

    if (userText) {
      messages.push({ role: "user", content: userText });
      turnCount++;
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, imageUrl }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const data = await res.json();

      // Store assistant message
      if (data.say) {
        messages.push({ role: "assistant", content: data.say });
      }

      if (data.endConversation) {
        conversationEnded = true;
        stopTimer();
      }

      return data;
    } catch (err) {
      console.error("Conversation error:", err);
      return {
        say: "Oops! My brain got a little tangled. Can you say that again?",
        tool: null,
        endConversation: false,
      };
    }
  }

  // ── Start the conversation (Zubi speaks first) ─────
  async function begin() {
    messages = [];
    turnCount = 0;
    conversationEnded = false;
    startTimer();
    return sendMessage(null);
  }

  // ── Getters ─────────────────────────────────────────
  function isEnded() {
    return conversationEnded;
  }
  function getTurnCount() {
    return turnCount;
  }
  function getElapsedSeconds() {
    return startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
  }

  // ── Reset ───────────────────────────────────────────
  function reset() {
    messages = [];
    imageUrl = null;
    turnCount = 0;
    conversationEnded = false;
    stopTimer();
    startTime = null;
    const timerEl = document.getElementById("timer-display");
    if (timerEl) timerEl.textContent = "⏱️ 0:00";
  }

  return {
    setImage,
    sendMessage,
    begin,
    isEnded,
    getTurnCount,
    getElapsedSeconds,
    reset,
    startTimer,
    stopTimer,
  };
})();
