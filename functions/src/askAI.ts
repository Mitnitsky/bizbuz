import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { GoogleGenerativeAI } from "@google/generative-ai";

const geminiApiKey = defineSecret("GEMINI_API_KEY");

interface ChatMessage {
  role: "user" | "model";
  content: string;
}

interface AskAIRequest {
  question: string;
  context: string;
  history: ChatMessage[];
}

const SYSTEM_PROMPT = `You are a helpful Hebrew-speaking financial assistant for the BizBuz (ביזבוז) family expense tracker app.
You help users understand their spending patterns, answer questions about their finances, and provide insights.

Rules:
- Always respond in Hebrew unless the user writes in English
- Be concise and direct — users are on mobile
- Format currency amounts as ₪X,XXX (Israeli Shekels)
- When summarizing, use bullet points or short paragraphs
- If the data doesn't contain enough info to answer, say so honestly
- Don't make up numbers — only use data from the provided context
- You can do math on the provided data (sums, averages, comparisons)
- Round amounts to whole numbers unless asked for precision`;

export const askAI = onCall<AskAIRequest>(
  { secrets: [geminiApiKey], memory: "256MiB" },
  async (request) => {
    // Auth check
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Must be logged in to use AI assistant"
      );
    }

    const { question, context: txnContext, history } = request.data;

    if (!question || typeof question !== "string") {
      throw new HttpsError(
        "invalid-argument",
        "Question is required"
      );
    }

    const apiKey = geminiApiKey.value();
    if (!apiKey) {
      throw new HttpsError(
        "failed-precondition",
        "Gemini API key not configured. Run: firebase functions:secrets:set GEMINI_API_KEY"
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    // Build conversation history for multi-turn
    const chatHistory = (history || []).map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    }));

    const chat = model.startChat({
      history: chatHistory,
      systemInstruction: {
        role: "user",
        parts: [{ text: SYSTEM_PROMPT }],
      },
    });

    // Build the prompt with context
    const prompt = txnContext
      ? `Here is the user's financial data:\n\n${txnContext}\n\nUser question: ${question}`
      : question;

    try {
      const result = await chat.sendMessage(prompt);
      const response = result.response.text();
      return { response };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("Gemini API error:", message);
      throw new HttpsError(
        "internal",
        "Failed to get AI response"
      );
    }
  }
);
