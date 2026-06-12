import type { JobOffer } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const SOURCE_LABELS: Record<string, string> = {
  EDUCATION_GOUV: "Éducation nationale",
  UNIV_MONTP3: "Univ. Montpellier 3",
  HEIDELBERG: "Maison de Heidelberg",
};

/**
 * Telegram notification for newly discovered offers.
 * No-op until TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set.
 */
export async function notifyNewOffers(offers: JobOffer[]): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId || offers.length === 0) return;

  for (const offer of offers) {
    const lines = [
      `🆕 <b>${escapeHtml(offer.title)}</b>`,
      `📌 ${SOURCE_LABELS[offer.source] ?? offer.source}`,
      offer.location ? `📍 ${escapeHtml(offer.location)}` : null,
      offer.contractType ? `📄 ${escapeHtml(offer.contractType)}` : null,
      `<a href="${offer.url}">Voir l'offre</a>`,
    ].filter(Boolean);

    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: lines.join("\n"),
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      }
    );
    if (res.ok) {
      await prisma.jobOffer.update({
        where: { id: offer.id },
        data: { notifiedAt: new Date() },
      });
    }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
