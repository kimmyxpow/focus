import { getConfig } from "modelence/server";

const ZAI_API_ENDPOINT = "https://api.z.ai/api/paas/v4/chat/completions";
const ZAI_MODEL = "glm-4.7-flashx";

export interface ZAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ZAIGenerateOptions {
  messages: ZAIMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface ZAIResponse {
  text: string;
}

function getZAIApiKey(): string {
  const apiKey = getConfig("ai.apiKey") as string;
  if (!apiKey) {
    throw new Error(
      "Z.AI API key not configured. Set ai.apiKey in Modelence Cloud.",
    );
  }
  return apiKey;
}

export async function generateText(
  options: ZAIGenerateOptions,
): Promise<ZAIResponse> {
  const { messages, temperature = 0.7, maxTokens = 1024 } = options;

  const response = await fetch(ZAI_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getZAIApiKey()}`,
      "Accept-Language": "en-US,en",
    },
    body: JSON.stringify({
      model: ZAI_MODEL,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Z.AI API error:", response.status, errorText);
    throw new Error(`AI service error: ${response.status}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  if (!data.choices?.[0]?.message?.content) {
    throw new Error("AI returned empty response");
  }

  return { text: data.choices[0].message.content };
}
