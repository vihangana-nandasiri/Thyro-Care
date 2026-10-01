export function isAssistantEnabled(): boolean {
  return !!process.env.DEEPSEEK_API_KEY;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// Classifier calls only need a word or a tiny JSON object; answers need room,
// especially in Sinhala/Tamil, which cost far more tokens per word.
export async function chatCompletion(messages: ChatMessage[], maxTokens = 400): Promise<string> {
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages,
      temperature: 0.2,
      max_tokens: maxTokens,
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    throw new Error(`Assistant provider unavailable (${res.status})`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}
