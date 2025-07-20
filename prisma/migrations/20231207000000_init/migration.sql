-- CreateTable
CREATE TABLE "contacts" (
    "id" SERIAL NOT NULL,
    "phone_number" TEXT,
    "email" TEXT,
    "linked_id" INTEGER,
    "link_precedence" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contacts_email_idx" ON "contacts"("email");

-- CreateIndex
CREATE INDEX "contacts_phone_number_idx" ON "contacts"("phone_number");

-- CreateIndex
CREATE INDEX "contacts_linked_id_idx" ON "contacts"("linked_id");

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_linked_id_fkey" FOREIGN KEY ("linked_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
