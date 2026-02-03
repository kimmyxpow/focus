/**
 * File Parser Module
 *
 * Parses PDF files using GLM-OCR from Z.AI for accurate text extraction.
 * DOCX files are parsed using mammoth library.
 * TXT and MD files are processed directly without OCR.
 */

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

/**
 * Get Z.AI API key from Modelence Cloud configuration
 */
function getZAIApiKey(): string {
  const apiKey = getConfig("ai.apiKey") as string;
  if (!apiKey) {
    throw new Error(
      "Z.AI API key not configured. Set ai.apiKey in Modelence Cloud.",
    );
  }
  return apiKey;
}

/**
 * Convert buffer to base64 data URL based on file type
 */
function bufferToDataURL(buffer: Buffer, mimeType: string): string {
  const base64 = buffer.toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Parse file using GLM-OCR API from Z.AI
 * Supports PDF, DOCX, and image formats
 */
async function parseWithGLMOCR(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<string> {
  try {
    // Convert buffer to data URL
    const dataUrl = bufferToDataURL(buffer, mimeType);

    // Determine file type for the API
    let fileType: "pdf" | "image";
    if (mimeType === "application/pdf") {
      fileType = "pdf";
    } else if (mimeType.startsWith("image/")) {
      fileType = "image";
    } else {
      // For DOCX, convert to base64 image representation or handle as generic
      // GLM-OCR primarily supports PDF and images
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

    // Return markdown results as plain text
    return data.md_results.trim();
  } catch (error) {
    console.error("GLM-OCR parsing error:", error);
    throw new Error(
      `Failed to parse file with OCR: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Parse PDF file buffer to text using GLM-OCR
 */
export async function parsePdf(buffer: Buffer, fileName = "document.pdf"): Promise<string> {
  return parseWithGLMOCR(buffer, "application/pdf", fileName);
}

/**
 * Parse DOCX file buffer to text using mammoth library
 * Extracts formatted text including tables and headings
 */
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

/**
 * Parse TXT file buffer to text (direct, no OCR needed)
 */
export async function parseTxt(buffer: Buffer): Promise<string> {
  return buffer.toString("utf-8").trim();
}

/**
 * Parse MD file buffer to text (direct, no OCR needed)
 */
export async function parseMd(buffer: Buffer): Promise<string> {
  return buffer.toString("utf-8").trim();
}

/**
 * Parse file based on type
 * - PDF: Uses GLM-OCR for accurate text extraction
 * - DOCX: Attempts GLM-OCR, falls back to raw text
 * - TXT/MD: Direct text extraction (no OCR)
 */
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
