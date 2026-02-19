// ══════════════════════════════════════════════════════
//  app.js – Main application wiring
// ══════════════════════════════════════════════════════

document.addEventListener("DOMContentLoaded", () => {
  // ── Element refs ──────────────────────────────────
  const splashScreen = document.getElementById("splash-screen");
  const mainScreen = document.getElementById("main-screen");
  const uploadArea = document.getElementById("upload-area");
  const imageInput = document.getElementById("image-input");
  const displayImage = document.getElementById("display-image");
  const micBtn = document.getElementById("mic-btn");
  const micHint = document.getElementById("mic-hint");
  const bubbleText = document.getElementById("bubble-text");
  const speechBubble = document.getElementById("speech-bubble");
  const childText = document.getElementById("child-text");
  const backBtn = document.getElementById("back-btn");
  const sampleBtns = document.querySelectorAll(".sample-btn");

  let isBusy = false; // Prevent overlapping actions

  // ══════════════════════════════════════════════════
  //  1. Image selection
  // ══════════════════════════════════════════════════

  // Click to upload
  uploadArea.addEventListener("click", () => imageInput.click());

  // File input change
  imageInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) handleImageFile(file);
  });

  // Drag & drop
  uploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadArea.classList.add("drag-over");
  });
  uploadArea.addEventListener("dragleave", () => {
    uploadArea.classList.remove("drag-over");
  });
  uploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadArea.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleImageFile(file);
  });

  // Sample image buttons
  sampleBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const src = btn.getAttribute("data-src");
      if (src) startWithImage(src);
    });
  });

  // Handle uploaded file
  async function handleImageFile(file) {
    // Convert to data URL for display and send to server
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      startWithImage(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  // ══════════════════════════════════════════════════
  //  2. Start conversation with chosen image
  // ══════════════════════════════════════════════════
  async function startWithImage(imageSrc) {
    // Show main screen
    splashScreen.classList.remove("active");
    mainScreen.classList.add("active");

    // Display image
    displayImage.src = imageSrc;

    // Reset state
    ZubiTools.reset();
    ZubiConversation.reset();
    ZubiConversation.setImage(imageSrc);

    // Set bubble to "thinking"
    setBubbleThinking();

    // Zubi starts the conversation
    const response = await ZubiConversation.begin();
    if (response) {
      handleZubiResponse(response);
    }
  }

  // ══════════════════════════════════════════════════
  //  3. Handle Zubi's response
  // ══════════════════════════════════════════════════
  function handleZubiResponse(data) {
    if (!data || !data.say) return;

    // Execute tool call if present
    if (data.tool) {
      ZubiTools.execute(data.tool);
    }

    // Display text in bubble
    setBubbleText(data.say);

    // Speak aloud
    speechBubble.classList.add("speaking");
    isBusy = true;

    ZubiSpeech.speak(data.say, () => {
      speechBubble.classList.remove("speaking");
      isBusy = false;

      if (data.endConversation) {
        micHint.textContent = "All done! Great job! 🎉";
        micBtn.disabled = true;
        micBtn.style.opacity = "0.5";

        // Show final celebration
        ZubiTools.showEmojiReaction({ emoji: "🎉" });
        setTimeout(() => {
          ZubiTools.showEmojiReaction({ emoji: "⭐" });
        }, 600);
      } else {
        micHint.textContent = "Your turn! Tap to talk 🎤";
      }
    });
  }

  // ══════════════════════════════════════════════════
  //  4. Microphone button
  // ══════════════════════════════════════════════════

  // Initialize speech recognition
  ZubiSpeech.init();

  ZubiSpeech.onStart(() => {
    micBtn.classList.add("listening");
    micHint.textContent = "I'm listening... 👂";
    childText.classList.remove("visible");
  });

  ZubiSpeech.onResult((transcript, isFinal) => {
    childText.textContent = transcript;
    childText.classList.add("visible");

    if (isFinal) {
      // Child finished speaking
      ZubiSpeech.stopListening();
      processChildSpeech(transcript);
    }
  });

  ZubiSpeech.onEnd(() => {
    micBtn.classList.remove("listening");
  });

  micBtn.addEventListener("click", () => {
    if (isBusy || ZubiConversation.isEnded()) return;

    if (ZubiSpeech.getIsListening()) {
      ZubiSpeech.stopListening();
    } else {
      // Stop Zubi if still speaking
      ZubiSpeech.stopSpeaking();
      speechBubble.classList.remove("speaking");

      const started = ZubiSpeech.startListening();
      if (!started) {
        // Fallback: show a text input area
        showTextInput();
      }
    }
  });

  // Process what the child said
  async function processChildSpeech(text) {
    if (!text.trim()) return;

    isBusy = true;
    setBubbleThinking();
    micHint.textContent = "Zubi is thinking... 🤔";

    const response = await ZubiConversation.sendMessage(text.trim());
    if (response) {
      handleZubiResponse(response);
    } else {
      isBusy = false;
    }
  }

  // ══════════════════════════════════════════════════
  //  5. Text fallback (when speech recognition unavailable)
  // ══════════════════════════════════════════════════
  function showTextInput() {
    // Create a simple text input if speech not supported
    if (document.getElementById("text-fallback")) return;

    const container = document.createElement("div");
    container.id = "text-fallback";
    container.style.cssText =
      "display:flex;gap:8px;padding:8px 16px;width:100%;";

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Type what you want to say...";
    input.style.cssText =
      "flex:1;padding:10px 14px;border-radius:20px;border:2px solid #4ecdc4;font-size:1rem;font-family:Nunito,sans-serif;outline:none;";

    const sendBtn = document.createElement("button");
    sendBtn.textContent = "📨";
    sendBtn.style.cssText =
      "width:44px;height:44px;border:none;border-radius:50%;background:#ff6b9d;font-size:1.2rem;cursor:pointer;";

    const submit = () => {
      const val = input.value.trim();
      if (!val || isBusy || ZubiConversation.isEnded()) return;
      childText.textContent = val;
      childText.classList.add("visible");
      input.value = "";
      processChildSpeech(val);
    };

    sendBtn.addEventListener("click", submit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });

    container.appendChild(input);
    container.appendChild(sendBtn);

    // Insert before mic container
    const micContainer = document.querySelector(".mic-container");
    micContainer.parentNode.insertBefore(container, micContainer);

    micHint.textContent = "Type or tap the mic!";
  }

  // Check if speech recognition is available, show text fallback
  if (!ZubiSpeech.isSupported()) {
    showTextInput();
    micHint.textContent = "Type your answer below!";
  }

  // ══════════════════════════════════════════════════
  //  6. Back button
  // ══════════════════════════════════════════════════
  backBtn.addEventListener("click", () => {
    ZubiSpeech.stopSpeaking();
    ZubiSpeech.stopListening();
    ZubiConversation.reset();
    ZubiTools.reset();

    mainScreen.classList.remove("active");
    splashScreen.classList.add("active");

    // Reset UI
    setBubbleText("Tap the mic and let's talk!");
    childText.classList.remove("visible");
    micBtn.disabled = false;
    micBtn.style.opacity = "1";
    micHint.textContent = "Tap to start talking!";

    // Remove text fallback if exists
    const tf = document.getElementById("text-fallback");
    if (tf) tf.remove();

    // Re-add if needed
    if (!ZubiSpeech.isSupported()) {
      setTimeout(showTextInput, 100);
    }
  });

  // ══════════════════════════════════════════════════
  //  7. Helpers
  // ══════════════════════════════════════════════════
  function setBubbleText(text) {
    bubbleText.textContent = text;
    bubbleText.classList.remove("thinking-dots");
  }

  function setBubbleThinking() {
    bubbleText.textContent = "Hmm, let me think";
    bubbleText.classList.add("thinking-dots");
  }
});
