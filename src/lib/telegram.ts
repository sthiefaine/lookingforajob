import { prisma } from "@/lib/prisma";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OFFSET_KEY = "telegram_offset";

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Send one HTML message to a chat. Returns true on success. */
export async function tgSend(chatId: string, text: string): Promise<boolean> {
  if (!TOKEN) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      // 403 = user blocked the bot → stop notifying them.
      if (res.status === 403) {
        await prisma.telegramSubscriber
          .updateMany({ where: { chatId }, data: { active: false } })
          .catch(() => {});
      }
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Chats that should receive new-offer alerts (DB subscribers + env admin). */
export async function getActiveChatIds(): Promise<string[]> {
  const subs = await prisma.telegramSubscriber.findMany({
    where: { active: true },
    select: { chatId: true },
  });
  const ids = new Set(subs.map((s) => s.chatId));
  if (process.env.TELEGRAM_CHAT_ID) ids.add(process.env.TELEGRAM_CHAT_ID);
  return [...ids];
}

const WELCOME = [
  "✅ <b>Inscription confirmée</b>",
  "",
  "Tu recevras ici chaque nouvelle offre d'emploi détectée (Éducation nationale, Université Montpellier 3, Maison de Heidelberg) — vérifiée toutes les 2 minutes.",
  "",
  '🎯 <a href="http://z048ok8ossowkcssocc0400w.91.98.29.236.sslip.io">Ouvrir le tableau de bord</a>',
  "",
  "Commandes : /stop pour te désinscrire, /help pour l'aide.",
].join("\n");

const HELP = [
  "🤖 <b>Bot offres d'emploi</b>",
  "",
  "Je t'envoie chaque nouvelle offre dès qu'elle est publiée.",
  "",
  "/start — recevoir les alertes",
  "/stop — ne plus rien recevoir",
  "/help — afficher cette aide",
  "",
  '🎯 <a href="http://z048ok8ossowkcssocc0400w.91.98.29.236.sslip.io">Tableau de bord</a>',
].join("\n");

const STOPPED =
  "🔕 Désinscrit. Tu ne recevras plus d'alertes. Renvoie /start quand tu veux les réactiver.";

interface TgUpdate {
  update_id: number;
  message?: {
    text?: string;
    chat?: {
      id: number;
      type?: string;
      first_name?: string;
      username?: string;
    };
  };
}

/**
 * Poll Telegram for new messages, handling /start, /stop and /help so anyone
 * can subscribe themselves. Uses a stored offset so each update is processed
 * once. Safe to call repeatedly (it is the cron's onboarding step).
 */
export async function syncTelegramSubscribers(): Promise<{
  added: number;
  removed: number;
}> {
  if (!TOKEN) return { added: 0, removed: 0 };

  const state = await prisma.appState.findUnique({ where: { key: OFFSET_KEY } });
  const offset = state ? Number(state.value) : undefined;

  const url = new URL(`https://api.telegram.org/bot${TOKEN}/getUpdates`);
  if (offset !== undefined) url.searchParams.set("offset", String(offset));
  url.searchParams.set("timeout", "0");
  url.searchParams.set("allowed_updates", JSON.stringify(["message"]));

  let data: { ok?: boolean; result?: TgUpdate[] };
  try {
    const res = await fetch(url);
    if (!res.ok) return { added: 0, removed: 0 };
    data = await res.json();
  } catch {
    return { added: 0, removed: 0 };
  }

  const updates = data.result ?? [];
  if (updates.length === 0) return { added: 0, removed: 0 };

  let added = 0;
  let removed = 0;
  let maxId = updates[0].update_id;

  for (const u of updates) {
    if (u.update_id > maxId) maxId = u.update_id;
    const chat = u.message?.chat;
    if (!chat || chat.type !== "private") continue;

    const chatId = String(chat.id);
    const text = (u.message?.text ?? "").trim().toLowerCase();

    if (text.startsWith("/start")) {
      await prisma.telegramSubscriber.upsert({
        where: { chatId },
        create: {
          chatId,
          firstName: chat.first_name,
          username: chat.username,
          active: true,
        },
        update: {
          active: true,
          firstName: chat.first_name,
          username: chat.username,
        },
      });
      added++;
      await tgSend(chatId, WELCOME);
    } else if (text.startsWith("/stop")) {
      await prisma.telegramSubscriber.updateMany({
        where: { chatId },
        data: { active: false },
      });
      removed++;
      await tgSend(chatId, STOPPED);
    } else if (text.startsWith("/help") || text.startsWith("/status")) {
      await tgSend(chatId, HELP);
    }
  }

  await prisma.appState.upsert({
    where: { key: OFFSET_KEY },
    create: { key: OFFSET_KEY, value: String(maxId + 1) },
    update: { value: String(maxId + 1) },
  });

  return { added, removed };
}

/** Register the command menu shown in Telegram clients. Idempotent. */
export async function setTelegramCommands(): Promise<void> {
  if (!TOKEN) return;
  await fetch(`https://api.telegram.org/bot${TOKEN}/setMyCommands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      commands: [
        { command: "start", description: "Recevoir les nouvelles offres" },
        { command: "stop", description: "Ne plus recevoir d'alertes" },
        { command: "help", description: "Aide" },
      ],
    }),
  }).catch(() => {});
}
