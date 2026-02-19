 
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware  
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Disable caching for development
app.use((req, res, next) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, private",
  );
  res.setHeader("Expires", "0");
  res.setHeader("Pragma", "no-cache");
  next();
});

app.use(express.static(path.join(__dirname, "public")));

// ── Multer for image uploads 
const uploadDir = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `image_${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ok = allowed.test(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new Error("Only image files allowed"), ok);
  },
});

 
let geminiModel = null;
if (
  process.env.GEMINI_API_KEY &&
  process.env.GEMINI_API_KEY !== "your-gemini-key-here"
) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
}

// ── System Prompt  
const SYSTEM_PROMPT = `You are "Buddy", a friendly real-time voice AI made for children aged 5–9.

You are shown an image on screen. Your job is to start and sustain a fun, safe, and engaging conversation with the child based ONLY on what can be seen in the image.

GOALS:
- Make the child feel happy, curious, and confident.
- Keep the conversation going for about 60 seconds (6-8 exchanges).
- Ask questions and react naturally to the child's answers.
- Encourage observation of colors, shapes, animals, emotions, actions, and storytelling.
- Use simple vocabulary and short sentences.

STRICT RULES:
1) Always be kid-friendly, cheerful, and supportive.
2) Speak in short sentences (max 10–12 words each).
3) Ask only ONE question at a time.
4) Avoid scary topics, violence, romance, politics, religion, medical advice, or anything unsafe.
5) Never mention "LLM", "system prompt", "tool call", "API", "backend", or technical details.
6) If the child is silent or confused, gently guide them with hints.
7) If the child says something unrelated, bring them back kindly to the image.
8) End naturally at around 1 minute with a friendly goodbye.

CONVERSATION FLOW (follow this pattern):
A) Excited opening: "Wow! Look at this picture!"
B) Describe 1–2 visible things.
C) Ask a simple question about the image.
D) React positively to the child's reply.
E) Ask a second question (color / object / action / emotion).
F) Give a small reward and encouragement.
G) Ask one final fun question (imagination/story).
H) Wrap up with praise and goodbye.

TOOL USAGE:
You MUST call at least ONE tool during the conversation.
Use the tool call naturally as part of the interaction.

Available tools:
1) highlightObject({ label: string }) – highlight an object the child mentions.
2) addRewardStar({ reason: string }) – reward the child for a great answer.
3) showEmojiReaction({ emoji: string }) – show a fun emoji on screen.

Tool rules:
- Call at least one tool by the middle of the conversation.
- Prefer addRewardStar for motivation.
- Tool calls must match what the child said.

OUTPUT FORMAT:
Return ONLY valid JSON (no markdown, no backticks):
{
  "say": "text Buddy will speak aloud",
  "tool": null or { "name": "toolName", "arguments": { ... } },
  "endConversation": false
}

Set endConversation to true only when wrapping up (~1 min or after 6-8 exchanges).`;

// ── Chat endpoint 
app.post("/api/chat", async (req, res) => {
  try {
    const { messages, imageUrl } = req.body;

    // Validate messages array
    if (!Array.isArray(messages)) {
      console.error("Invalid messages:", messages);
      return res.status(400).json({
        say: "Oops! Something went wrong. Let's try again!",
        tool: null,
        endConversation: false,
      });
    }

    if (geminiModel) {
      // ── Real Gemini call 
      const parts = [];

      // Add system prompt as the first text part
      parts.push({ text: SYSTEM_PROMPT });

      // If there's an image and this is the first message, include it
      if (imageUrl && messages.length <= 1) {
        
        if (imageUrl.startsWith("data:")) {
          
          const matches = imageUrl.match(
            /^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/,
          );
          if (matches) {
            parts.push({
              inlineData: {
                mimeType: matches[1],
                data: matches[2],
              },
            });
          }
        } else if (imageUrl.startsWith("http")) {
           
          try {
            const response = await fetch(imageUrl);
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const base64 = buffer.toString("base64");
            const contentType =
              response.headers.get("content-type") || "image/jpeg";
            parts.push({
              inlineData: {
                mimeType: contentType,
                data: base64,
              },
            });
          } catch (imgErr) {
            console.warn("Could not fetch image URL:", imgErr.message);
          }
        } else if (imageUrl.startsWith("/uploads/")) {
          
          const filePath = path.join(__dirname, "public", imageUrl);
          if (fs.existsSync(filePath)) {
            const buffer = fs.readFileSync(filePath);
            const base64 = buffer.toString("base64");
            const ext = path.extname(imageUrl).toLowerCase().replace(".", "");
            const mimeMap = {
              jpg: "image/jpeg",
              jpeg: "image/jpeg",
              png: "image/png",
              gif: "image/gif",
              webp: "image/webp",
            };
            parts.push({
              inlineData: {
                mimeType: mimeMap[ext] || "image/jpeg",
                data: base64,
              },
            });
          }
        }

        // Add user text
        parts.push({
          text:
            messages.length > 0
              ? messages[messages.length - 1].content
              : "Please start the conversation about this image.",
        });
      } else {
        // Build conversation history as text
        let conversationText = "";
        for (const msg of messages) {
          const role = msg.role === "user" ? "Child" : "Buddy";
          conversationText += `${role}: ${msg.content}\n`;
        }
        parts.push({ text: conversationText });
        parts.push({
          text: "Continue the conversation as Buddy. Reply with valid JSON only.",
        });
      }

      const result = await geminiModel.generateContent({
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 300,
        },
      });

       
      if (!result || !result.response) {
        throw new Error("Invalid Gemini API response");
      }

      let raw = result.response.text().trim();

       
      console.log("Gemini response:", raw.substring(0, 200));

      // Strip markdown fences if present
      raw = raw
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();

      let parsed;
      try {
        parsed = JSON.parse(raw);

         
        if (!parsed.say || typeof parsed.say !== "string") {
          throw new Error("Invalid response format");
        }

        // Ensure all required fields exist
        if (!parsed.hasOwnProperty("tool")) parsed.tool = null;
        if (!parsed.hasOwnProperty("endConversation"))
          parsed.endConversation = false;
      } catch (parseErr) {
        console.error("JSON parse error:", parseErr);
        console.error("Raw response:", raw);
        parsed = { say: raw, tool: null, endConversation: false };
      }

      return res.json(parsed);
    } else {
      // ── Fallback offline engine  
      const response = offlineConversation(messages);
      return res.json(response);
    }
  } catch (err) {
    console.error("Chat error:", err);
    return res.status(500).json({
      say: "Oops, I got a little dizzy! Let's try again!",
      tool: null,
      endConversation: false,
    });
  }
});

// ── Image upload endpoint  
app.post("/api/upload", upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image uploaded" });
  const url = `/uploads/${req.file.filename}`;
  res.json({ url, filename: req.file.filename });
});

// ── Offline fallback conversation engine 
function offlineConversation(messages) {
  const turn = messages.filter((m) => m.role === "user").length;

  const flow = [
    {
      say: "Wow! Look at this picture! It's so colorful and fun! What is the first thing you see?",
      tool: { name: "showEmojiReaction", arguments: { emoji: "😍" } },
      endConversation: false,
    },
    {
      say: "Oh cool! Great eyes! I love that you noticed that! What color is it?",
      tool: {
        name: "addRewardStar",
        arguments: { reason: "Great observation!" },
      },
      endConversation: false,
    },
    {
      say: "Nice! That's a beautiful color! Can you find something round in the picture?",
      tool: { name: "showEmojiReaction", arguments: { emoji: "🎨" } },
      endConversation: false,
    },
    {
      say: "You're amazing at this! What do you think is happening in the picture?",
      tool: {
        name: "addRewardStar",
        arguments: { reason: "Super color spotter!" },
      },
      endConversation: false,
    },
    {
      say: "What a fun story! If you could jump into this picture, what would you do?",
      tool: { name: "showEmojiReaction", arguments: { emoji: "✨" } },
      endConversation: false,
    },
    {
      say: "Ha ha, that sounds like an adventure! You did an awesome job today! You're a real picture detective! Bye bye, superstar!",
      tool: {
        name: "addRewardStar",
        arguments: { reason: "Amazing picture detective!" },
      },
      endConversation: true,
    },
  ];

  const idx = Math.min(turn, flow.length - 1);
  return flow[idx];
}

// ── Serve index for all non-API routes ──────────────
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`\n🧒 Speak with Zubi is running at http://localhost:${PORT}`);
  if (!geminiModel) {
    console.log(
      "⚠️  No GEMINI_API_KEY found – using offline conversation mode.",
    );
    console.log("   Add your Gemini API key to .env for AI-powered chats.\n");
  } else {
    console.log("✅ Gemini connected – Gemini 2.0 Flash vision mode active.\n");
  }
});
