import type { JobOffer } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { escapeHtml, getActiveChatIds, tgSend } from "@/lib/telegram";

const SOURCE_LABELS: Record<string, string> = {
  EDUCATION_GOUV: "Éducation nationale",
  UNIV_MONTP3: "Univ. Montpellier 3",
  HEIDELBERG: "Maison de Heidelberg",
};

function formatOffer(offer: JobOffer): string {
  return [
    `🆕 <b>${escapeHtml(offer.title)}</b>`,
    `📌 ${SOURCE_LABELS[offer.source] ?? offer.source}`,
    offer.location ? `📍 ${escapeHtml(offer.location)}` : null,
    offer.contractType ? `📄 ${escapeHtml(offer.contractType)}` : null,
    `<a href="${offer.url}">Voir l'offre</a>`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Telegram notification for newly discovered offers — sent to every active
 * subscriber (anyone who did /start). No-op until TELEGRAM_BOT_TOKEN is set
 * or when there are no recipients.
 */
export async function notifyNewOffers(offers: JobOffer[]): Promise<void> {
  if (!process.env.TELEGRAM_BOT_TOKEN || offers.length === 0) return;

  const chatIds = await getActiveChatIds();
  if (chatIds.length === 0) return;

  for (const offer of offers) {
    const text = formatOffer(offer);
    const results = await Promise.all(
      chatIds.map((chatId) => tgSend(chatId, text))
    );
    if (results.some(Boolean)) {
      await prisma.jobOffer.update({
        where: { id: offer.id },
        data: { notifiedAt: new Date() },
      });
    }
  }
}
