-- Historial persistente del asistente (WeSpeak): sesión por usuario + mensajes.

-- CreateTable
CREATE TABLE "assistant_chat_sessions" (
    "user_id" UUID NOT NULL,
    "thread_id" UUID NOT NULL,
    "wespeak_token" TEXT,
    "conversation_id" VARCHAR(100),
    "cursor" VARCHAR(255),
    "assistant_name" VARCHAR(100) NOT NULL DEFAULT 'Asistente',
    "last_polled_at" TIMESTAMPTZ,
    "blocked_until" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "assistant_chat_sessions_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "assistant_chat_messages" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "thread_id" UUID NOT NULL,
    "external_id" VARCHAR(100),
    "client_msg_id" UUID,
    "conversation_id" VARCHAR(100),
    "role" VARCHAR(20) NOT NULL,
    "kind" VARCHAR(20) NOT NULL DEFAULT 'reply',
    "text" TEXT NOT NULL DEFAULT '',
    "attachments" JSONB,
    "status" VARCHAR(20) NOT NULL DEFAULT 'sent',
    "error" VARCHAR(300),
    "sent_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "assistant_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assistant_chat_messages_user_id_thread_id_sent_at_idx" ON "assistant_chat_messages"("user_id", "thread_id", "sent_at");

-- CreateIndex
CREATE UNIQUE INDEX "assistant_chat_messages_user_id_external_id_key" ON "assistant_chat_messages"("user_id", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "assistant_chat_messages_user_id_client_msg_id_key" ON "assistant_chat_messages"("user_id", "client_msg_id");

-- AddForeignKey
ALTER TABLE "assistant_chat_sessions" ADD CONSTRAINT "assistant_chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_chat_messages" ADD CONSTRAINT "assistant_chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

