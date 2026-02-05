import { getConfig } from "modelence/server";
import mammoth from "mammoth";

const ZAI_API_ENDPOINT = "https://api.z.ai/api/paas/v4/tools/glm-ocr";

interface GLMOCResponse {
  id: string;
  model: string;
  md_results: string;
  data_info?: {
    num_pages: number;
  };
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

function bufferToDataURL(buffer: Buffer, mimeType: string): string {
  const base64 = buffer.toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

async function parseWithGLMOCR(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<string> {
  try {
    const dataUrl = bufferToDataURL(buffer, mimeType);

    let fileType: "pdf" | "image";
    if (mimeType === "application/pdf") {
      fileType = "pdf";
    } else if (mimeType.startsWith("image/")) {
      fileType = "image";
    } else {
      throw new Error(
        `File type ${mimeType} not directly supported by GLM-OCR. Please convert to PDF or image format.`,
      );
    }

    const response = await fetch(ZAI_API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getZAIApiKey()}`,
      },
      body: JSON.stringify({
        file_type: fileType,
        image: dataUrl,
        pdf_file: dataUrl,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GLM-OCR API error:", response.status, errorText);
      throw new Error(
        `OCR service error: ${response.status}. Please try again or use a different file format.`,
      );
    }

    const data = (await response.json()) as GLMOCResponse;

    if (!data.md_results) {
      throw new Error("OCR returned empty results. The file may be corrupted or contain no extractable text.");
    }

    console.log(`[OCR] Successfully parsed ${fileName}: ${data.data_info?.num_pages || 1} page(s)`);

    return data.md_results.trim();
  } catch (error) {
    console.error("GLM-OCR parsing error:", error);
    throw new Error(
      `Failed to parse file with OCR: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

export async function parsePdf(buffer: Buffer, fileName = "document.pdf"): Promise<string> {
  return parseWithGLMOCR(buffer, "application/pdf", fileName);
}

export async function parseDocx(buffer: Buffer, fileName = "document.docx"): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value.trim();

    console.log(`[DOCX] Successfully parsed ${fileName}: ${text.length} characters`);

    return text;
  } catch (error) {
    console.error("DOCX parsing error:", error);
    throw new Error(
      `Failed to parse DOCX file: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

export async function parseTxt(buffer: Buffer): Promise<string> {
  return buffer.toString("utf-8").trim();
}

export async function parseMd(buffer: Buffer): Promise<string> {
  return buffer.toString("utf-8").trim();
}

export async function parseFile(
  buffer: Buffer,
  fileType: "pdf" | "docx" | "txt" | "md",
  fileName?: string,
): Promise<string> {
  switch (fileType) {
    case "pdf":
      return parsePdf(buffer, fileName || "document.pdf");
    case "docx":
      return parseDocx(buffer, fileName || "document.docx");
    case "txt":
      return parseTxt(buffer);
    case "md":
      return parseMd(buffer);
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}
