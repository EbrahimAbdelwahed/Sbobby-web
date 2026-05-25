export type DeepSeekChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type DeepSeekChatResult = {
  model: string;
  content: string;
};

export async function callDeepSeekChat(messages: DeepSeekChatMessage[]): Promise<DeepSeekChatResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not configured");
  }

  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";
  const endpoint = process.env.DEEPSEEK_API_BASE_URL ?? "https://api.deepseek.com/chat/completions";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek request failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return {
    model,
    content: payload.choices?.[0]?.message?.content?.trim() || "Il materiale non contiene abbastanza evidenza per rispondere.",
  };
}
