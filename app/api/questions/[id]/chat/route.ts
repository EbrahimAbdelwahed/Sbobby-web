import type { NextRequest } from "next/server";

import { getAuthUser, isAdminUser } from "@/lib/auth";
import {
  createChatMessage,
  getChatMessages,
  getOrCreateChatThread,
  getQuestionById,
} from "@/lib/exam/repository";

export const dynamic = "force-dynamic";

async function callDeepSeek(messages: Array<{ role: "system" | "user" | "assistant"; content: string }>) {
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const admin = await isAdminUser(user);
  const thread = await getOrCreateChatThread(id, user.email, admin);
  if (!thread) {
    return Response.json({ error: "Question not found" }, { status: 404 });
  }
  const messages = await getChatMessages(thread.id, user.email, admin);
  return Response.json({ thread, messages: messages ?? [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const admin = await isAdminUser(user);
  const question = await getQuestionById(id, user.email, admin);
  if (!question?.explanation) {
    return Response.json({ error: "Question not found" }, { status: 404 });
  }
  const body = (await request.json().catch(() => ({}))) as { message?: string };
  const message = body.message?.trim();
  if (!message) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }
  const thread = await getOrCreateChatThread(id, user.email, admin);
  if (!thread) {
    return Response.json({ error: "Question not found" }, { status: 404 });
  }
  await createChatMessage({ threadId: thread.id, role: "user", content: message });
  const sourceText = question.sourceChunks
    .map((chunk, index) => `[${index + 1}] ${chunk.id} - ${chunk.sourceTitle}\n${chunk.textClean}`)
    .join("\n\n");
  const previous = (await getChatMessages(thread.id, user.email, admin)) ?? [];
  const llmMessages = [
    {
      role: "system" as const,
      content:
        "Sei il tutor di Sbobby Web. Usa solo i chunk forniti e la risposta approvata. Non usare conoscenza esterna. Se i chunk non bastano, dillo chiaramente. Cita sempre i chunk con [numero] o chunkId.",
    },
    {
      role: "user" as const,
      content: `Domanda: ${question.questionText}\nRisposta approvata: ${question.explanation.answer}\nSpiegazione approvata: ${question.explanation.explanationShort}\n\nChunk disponibili:\n${sourceText}`,
    },
    ...previous.slice(-8).map((item) => ({
      role: item.role === "assistant" ? "assistant" as const : "user" as const,
      content: item.content,
    })),
  ];
  try {
    const answer = await callDeepSeek(llmMessages);
    const citations = question.sourceChunks.map((chunk) => ({
      chunkId: chunk.id,
      sourceTitle: chunk.sourceTitle,
      sourcePath: chunk.sourcePath,
    }));
    const assistantMessage = await createChatMessage({
      threadId: thread.id,
      role: "assistant",
      content: answer.content,
      citations,
      model: answer.model,
    });
    return Response.json({ message: assistantMessage });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Chat failed" }, { status: 502 });
  }
}
