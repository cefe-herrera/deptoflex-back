-- CreateTable
CREATE TABLE "agenda_contacts" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100),
    "phone" VARCHAR(30),
    "email" VARCHAR(255),
    "company" VARCHAR(150),
    "avatar_color" VARCHAR(20),
    "last_contacted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "agenda_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agenda_notes" (
    "id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agenda_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agenda_contacts_owner_id_first_name_idx" ON "agenda_contacts"("owner_id", "first_name");

-- CreateIndex
CREATE INDEX "agenda_contacts_owner_id_last_contacted_at_idx" ON "agenda_contacts"("owner_id", "last_contacted_at");

-- CreateIndex
CREATE INDEX "agenda_contacts_deleted_at_idx" ON "agenda_contacts"("deleted_at");

-- CreateIndex
CREATE INDEX "agenda_notes_contact_id_created_at_idx" ON "agenda_notes"("contact_id", "created_at");

-- AddForeignKey
ALTER TABLE "agenda_contacts" ADD CONSTRAINT "agenda_contacts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_notes" ADD CONSTRAINT "agenda_notes_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "agenda_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_notes" ADD CONSTRAINT "agenda_notes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
