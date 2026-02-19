// ══════════════════════════════════════════════════════
//  speech.js – Speech Recognition & Synthesis
// ══════════════════════════════════════════════════════

const ZubiSpeech = (() => {
  // ── State ───────────────────────────────────────────
  let recognition = null;
  let isListening = false;
  let onResultCallback = null;
  let onStartCallback = null;
  let onEndCallback = null;
  let supported = false;

  // ── Init Speech Recognition ─────────────────────────
  function init() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("Speech Recognition not supported in this browser.");
      return false;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      isListening = true;
      if (onStartCallback) onStartCallback();
    };

    recognition.onresult = (event) => {
      let transcript = "";
      let isFinal = false;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
        if (event.results[i].isFinal) isFinal = true;
      }

      if (onResultCallback) onResultCallback(transcript, isFinal);
    };

    recognition.onerror = (event) => {
      console.warn("Speech recognition error:", event.error);
      isListening = false;
      if (onEndCallback) onEndCallback();
    };

    recognition.onend = () => {
      isListening = false;
      if (onEndCallback) onEndCallback();
    };

    supported = true;
    return true;
  }

  // ── Start listening ─────────────────────────────────
  function startListening() {
    if (!recognition) {
      if (!init()) return false;
    }
    try {
      recognition.start();
      return true;
    } catch (e) {
      console.warn("Could not start recognition:", e);
      return false;
    }
  }

  // ── Stop listening ──────────────────────────────────
  function stopListening() {
    if (recognition && isListening) {
      try {
        recognition.stop();
      } catch (e) {
        // ignore
      }
    }
  }

  // ── Speak text aloud ────────────────────────────────
  function speak(text, onDone) {
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9; // Slightly slower for kids
    utterance.pitch = 1.2; // Slightly higher pitch – friendly
    utterance.volume = 1;
    utterance.lang = "en-US";

    // Try to pick a friendly voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      (v) =>
        v.name.includes("Female") ||
        v.name.includes("Samantha") ||
        v.name.includes("Google US English") ||
        v.name.includes("Microsoft Zira") ||
        v.name.includes("Microsoft Aria"),
    );
    if (preferred) utterance.voice = preferred;

    utterance.onend = () => {
      if (onDone) onDone();
    };
    utterance.onerror = () => {
      if (onDone) onDone();
    };

    window.speechSynthesis.speak(utterance);
  }

  // ── Stop speaking ───────────────────────────────────
  function stopSpeaking() {
    window.speechSynthesis.cancel();
  }

  // ── Callbacks ───────────────────────────────────────
  function onResult(cb) {
    onResultCallback = cb;
  }
  function onStart(cb) {
    onStartCallback = cb;
  }
  function onEnd(cb) {
    onEndCallback = cb;
  }

  // ── Getters ─────────────────────────────────────────
  function getIsListening() {
    return isListening;
  }
  function isSupported() {
    return (
      supported ||
      !!(window.SpeechRecognition || window.webkitSpeechRecognition)
    );
  }

  return {
    init,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    onResult,
    onStart,
    onEnd,
    getIsListening,
    isSupported,
  };
})();

// Pre-load voices (required in some browsers)
if (window.speechSynthesis) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}
