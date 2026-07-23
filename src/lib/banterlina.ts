import { newId, readDb, updateDb } from "@/lib/local/db";
import type { BanterlinaMessage } from "@/lib/local/types";

export const BANTERLINA_SYSTEM_PROMPT = `You are Banterlina, the research and learning assistant inside Banter — the Hult cohort communications app.

Your job:
- Help with quick research, clarifying concepts, brainstorming, and breaking down coursework or project questions
- Be concise, practical, and friendly — like a sharp classmate who always has a useful angle
- Prefer clear structure: short answer first, then bullets or steps when helpful
- When relevant, suggest how the user might follow up in Banter channels (e.g. #backend-help, #ai-discussions, #career)
- If you're unsure, say so and suggest what to check next
- Do not pretend to access private Banter messages or the PM tool unless the user pastes context

Tone: warm, capable, lightly witty. Sign personality as Banterlina without overdoing it.`;

export async function listBanterlinaMessages(userId: string) {
  const db = await readDb();
  return db.banterlina_messages
    .filter((m) => m.user_id === userId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function appendBanterlinaMessages(
  userId: string,
  entries: { role: "user" | "assistant"; content: string }[],
) {
  const now = new Date().toISOString();
  return updateDb((db) => {
    const created: BanterlinaMessage[] = entries.map((e) => ({
      id: newId(),
      user_id: userId,
      role: e.role,
      content: e.content,
      created_at: now,
    }));
    db.banterlina_messages.push(...created);
    return created;
  });
}

export async function clearBanterlinaMessages(userId: string) {
  await updateDb((db) => {
    db.banterlina_messages = db.banterlina_messages.filter(
      (m) => m.user_id !== userId,
    );
  });
}

type ChatTurn = { role: "user" | "assistant" | "system"; content: string };

export async function askBanterlina(
  history: { role: "user" | "assistant"; content: string }[],
  userMessage: string,
): Promise<string> {
  const apiKey =
    process.env.BANTERLINA_API_KEY || process.env.OPENAI_API_KEY || "";
  const baseUrl = (
    process.env.BANTERLINA_BASE_URL || "https://api.openai.com/v1"
  ).replace(/\/$/, "");
  const model = process.env.BANTERLINA_MODEL || "gpt-4o-mini";

  if (!apiKey) {
    return offlineBanterlina(userMessage);
  }

  const messages: ChatTurn[] = [
    { role: "system", content: BANTERLINA_SYSTEM_PROMPT },
    ...history.slice(-16),
    { role: "user", content: userMessage },
  ];

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.6,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(
      `Banterlina API error (${res.status}): ${detail.slice(0, 200)}`,
    );
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Banterlina returned an empty reply.");
  return content;
}

/** Helpful fallback when no API key is configured yet. */
function offlineBanterlina(userMessage: string): string {
  const q = userMessage.trim();
  return [
    `Hey — I'm **Banterlina**, your research buddy. I'm in offline mode right now (no AI API key configured), but here's a quick way to tackle that:`,
    ``,
    `**Your question**`,
    `> ${q}`,
    ``,
    `**Research checklist**`,
    `1. Restate the goal in one sentence — what decision or deliverable does this unlock?`,
    `2. List 3 sources to check (docs, course notes, a teammate in Banter, official docs).`,
    `3. Capture 3–5 bullets of findings, then a recommended next step.`,
    `4. If it's technical, note assumptions, constraints, and what you'd validate first.`,
    ``,
    `**In Banter**`,
    `- Ask in \`#backend-help\` or \`#ai-discussions\` if you want cohort eyes on it`,
    `- Or DM a teammate after you've drafted your own take`,
    ``,
    `To unlock full Banterlina answers, add \`OPENAI_API_KEY\` (or \`BANTERLINA_API_KEY\`) to \`.env.local\` and restart the server.`,
  ].join("\n");
}
