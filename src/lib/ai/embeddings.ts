export function isEmbeddingEnabled(): boolean {
  return !!process.env.GOOGLE_AI_API_KEY;
}

const MODEL = "gemini-embedding-001";
const DIMENSIONS = 768;

export async function embedText(text: string): Promise<number[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:embedContent?key=${process.env.GOOGLE_AI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${MODEL}`,
        content: { parts: [{ text }] },
        outputDimensionality: DIMENSIONS,
      }),
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!res.ok) throw new Error(`Embedding provider unavailable (${res.status})`);
  const data = await res.json();
  const values = data.embedding?.values;
  if (!Array.isArray(values)) throw new Error("Embedding provider returned no vector");
  return values;
}
