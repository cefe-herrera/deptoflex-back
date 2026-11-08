-- Canal de tiempo real (Scaledrone) de la conversación con el asistente.

-- AlterTable
ALTER TABLE "assistant_chat_sessions" ADD COLUMN     "realtime_channel_id" VARCHAR(100),
ADD COLUMN     "realtime_room" VARCHAR(255);

