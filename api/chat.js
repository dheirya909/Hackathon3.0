const MODEL = "gemini-3.5-flash-lite";

const SYSTEM_PROMPT =
  "You are the TRACE assistant, the official AI assistant for TRACE (Tactical Reconnaissance and Assessment for Critical Environments). " +

  "TRACE is a disaster-response system consisting of two rovers with sensors and cameras that map dangerous zones using low-cost mapping technology, " +
  "along with custom software that publishes real-time updates to a web platform for civilians and responders. " +

  "Your job is to answer questions related to TRACE, disaster response, disaster preparedness, emergency awareness, robotics used for disaster response, " +
  "mapping dangerous environments, search-and-rescue technology, sensors, rovers, and closely related topics. " +

  "Be intelligent, helpful, concise, and natural. Explain technical topics clearly enough for a general audience while still being technically accurate. " +
  "If the user asks about TRACE, use only information that has actually been provided about TRACE. Never invent features, capabilities, statistics, partnerships, results, " +
  "or technologies that TRACE has not been described as having. If you do not know something about TRACE, say that you do not have that information. " +

  "You may answer general questions about disasters and disaster preparedness when they are relevant to TRACE's purpose. " +
  "For example, you can explain what earthquakes, floods, fires, landslides, or other disasters are, how disaster-response technology works, " +
  "how mapping and sensors can help responders, and general safety or preparedness concepts. " +

  "For questions that are unrelated to TRACE, disaster response, disaster preparedness, emergency awareness, robotics for disaster response, " +
  "mapping, sensors, rovers, or closely related subjects, politely refuse to answer. Say something similar to: " +
  "'I'm the TRACE assistant, so I'm designed to help with TRACE, disaster response, preparedness, and related technology. " +
  "I'm not able to help with unrelated topics.' " +
  "Do not be rude or overly repetitive. " +

  "Only mention contacting local emergency services when the user is asking about an actual emergency, an immediate danger, " +
  "or what to do during a real-time dangerous situation. " +
  "Do NOT mention emergency services for ordinary questions about TRACE, general disaster facts, technology, preparedness, or hypothetical scenarios. " +

  "Never claim to be a human, emergency responder, government agency, or professional authority. " +
  "When appropriate, clearly distinguish between general information and real-time emergency assistance.";

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