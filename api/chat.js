const MODEL = "gemini-2.5-flash";

const SYSTEM_PROMPT =
  "You are the TRACE assistant. TRACE (Tactical Reconnaissance and Assessment for Critical Environments) " +
  "is a disaster-response system: two rovers with sensors and cameras map dangerous zones using low-cost " +
  "mapping tech, and custom software publishes real-time updates to a web platform for civilians and responders. " +
  "Answer concisely. For emergencies, tell the user to contact local emergency services. " +
  "Do not invent TRACE features that were not described.";

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const raw = Array.isArray(req.body?.messages)
    ? req.body.messages.slice(-20)
    : [];

  const contents = raw
    .filter(
      (m) =>
        m &&
        typeof m.text === "string" &&
        (m.role === "user" || m.role === "model")
    )
    .map((m) => ({
      role: m.role,
      parts: [{ text: m.text.slice(0, 1000) }],
    }));

  if (
    !contents.length ||
    contents[contents.length - 1].role !== "user"
  ) {
    return res.status(400).json({ error: "Invalid messages" });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }],
          },
          contents,
          generationConfig: {
            maxOutputTokens: 800,
            temperature: 0.6,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini error:", errorText);

      return res.status(502).json({
        error: "Upstream error",
      });
    }

    const data = await response.json();

    const reply =
      data.candidates?.[0]?.content?.parts
        ?.map((p) => p.text)
        .join("") || "";

    return res.status(200).json({ reply });
  } catch (error) {
    console.error("Server error:", error);

    return res.status(500).json({
      error: "Server error",
    });
  }
}