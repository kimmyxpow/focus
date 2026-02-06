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
  timeout?: number;
  maxRetries?: number;
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

async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout: number }
): Promise<Response> {
  const { timeout, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}

async function fetchWithRetry(
  url: string,
  options: RequestInit & { timeout: number },
  maxRetries: number
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetchWithTimeout(url, options);
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        console.warn(`Fetch attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

export async function generateText(
  options: ZAIGenerateOptions,
): Promise<ZAIResponse> {
  const { messages, temperature = 0.7, maxTokens = 1024, timeout = 120000, maxRetries = 3 } = options;

  const response = await fetchWithRetry(
    ZAI_API_ENDPOINT,
    {
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
      timeout,
    },
    maxRetries
  );

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
