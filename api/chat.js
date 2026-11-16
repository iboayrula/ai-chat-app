// This is the BACKEND. It runs on Vercel's servers, never in the visitor's browser.
// That is why the secret API key is safe here: visitors can't see this code's secrets.
//
// Flow:  your web page  ->  /api/chat (this file)  ->  Google Gemini  ->  back to the page

export default async function handler(req, res) {
  // 1. Only accept POST requests (that's how the page sends a question)
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  // 2. Read the secret key from an ENVIRONMENT VARIABLE.
  //    You set this in Vercel's settings, never in the code itself.
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not set on the server" });
  }

  // Which model to use. You can change it in Vercel settings without touching code.
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  // 3. Get the question the page sent us, and check it
  const question = (req.body && req.body.question ? String(req.body.question) : "").trim();
  if (question === "") {
    return res.status(400).json({ error: "Please type a question" });
  }
  if (question.length > 2000) {
    return res.status(400).json({ error: "Question is too long (max 2000 characters)" });
  }

  try {
    // 4. Call Google's Gemini API
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey, // the secret travels server-to-server only
      },
      body: JSON.stringify({
        // A "system instruction" tells the AI how to behave
        systemInstruction: {
          parts: [{ text: "You are a friendly helper. Keep answers short and simple." }],
        },
        contents: [{ role: "user", parts: [{ text: question }] }],
      }),
    });

    const data = await response.json();

    // 5. If Google returned an error, pass a readable message back to the page
    if (!response.ok) {
      const message = (data.error && data.error.message) || "AI request failed";
      return res.status(response.status).json({ error: message });
    }

    // 6. Dig the answer text out of Google's reply
    const answer =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ||
      "(No answer came back)";

    return res.status(200).json({ answer });
  } catch (err) {
    // Shows up in Vercel's Logs tab, which is where you debug a live backend
    console.error(err);
    return res.status(500).json({ error: "Server error: " + err.message });
  }
}
