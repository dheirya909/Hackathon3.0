const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

const MODEL = "gemini-2.5-flash"; // verify the current model name in Google AI Studio
const SYSTEM_PROMPT =
  "You are the TRACE assistant. TRACE (Tactical Reconnaissance and Assessment for Critical Environments) " +
  "is a disaster-response system: two rovers with sensors and cameras map dangerous zones using low-cost " +
  "mapping tech, and custom software publishes real-time updates to a web platform for civilians and responders. " +
  "Answer concisely. For emergencies, tell the user to contact local emergency services. " +
  "Do not invent TRACE features that were not described.";

exports.chat = onRequest(
  {
    secrets: [GEMINI_API_KEY],
    cors: ["https://traceresponse.vercel.app"], // add localhost origins while testing
    region: "us-central1",
    maxInstances: 5, // caps cost if someone abuses the endpoint
  },
  async (req, res) => {
    if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

    const raw = Array.isArray(req.body?.messages) ? req.body.messages.slice(-20) : [];
    const contents = raw
      .filter((m) => m && typeof m.text === "string" && (m.role === "user" || m.role === "model"))
      .map((m) => ({ role: m.role, parts: [{ text: m.text.slice(0, 1000) }] }));

    if (!contents.length || contents[contents.length - 1].role !== "user") {
      return res.status(400).json({ error: "Invalid messages" });
    }

    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY.value() },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents,
            generationConfig: { maxOutputTokens: 800, temperature: 0.6 },
          }),
        }
      );
      if (!r.ok) return res.status(502).json({ error: "Upstream error" });
      const data = await r.json();
      const reply = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
      return res.json({ reply });
    } catch (e) {
      return res.status(500).json({ error: "Server error" });
    }
  }
);
