-- CreateTable
CREATE TABLE "TelegramSubscriber" (
    "chatId" TEXT NOT NULL,
    "firstName" TEXT,
    "username" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramSubscriber_pkey" PRIMARY KEY ("chatId")
);

-- CreateTable
CREATE TABLE "AppState" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "AppState_pkey" PRIMARY KEY ("key")
);

-- Keep the original user subscribed.
INSERT INTO "TelegramSubscriber" ("chatId", "firstName", "active")
VALUES ('8741920653', 'Thief', true)
ON CONFLICT ("chatId") DO NOTHING;
