-- CreateEnum
CREATE TYPE "FlexBookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

-- CreateTable
CREATE TABLE "property_flex" (
    "id" UUID NOT NULL,
    "company_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "type" "PropertyType" NOT NULL,
    "status" "PropertyStatus" NOT NULL DEFAULT 'DRAFT',
    "floor" SMALLINT,
    "bedrooms" SMALLINT NOT NULL DEFAULT 0,
    "bathrooms" SMALLINT NOT NULL DEFAULT 0,
    "max_occupancy" SMALLINT NOT NULL DEFAULT 1,
    "size_m2" DECIMAL(8,2),
    "monthly_rate" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ARS',
    "min_months" SMALLINT NOT NULL DEFAULT 1,
    "max_months" SMALLINT,
    "deposit_amount" DECIMAL(10,2),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "property_flex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_flex_addresses" (
    "id" UUID NOT NULL,
    "property_flex_id" UUID NOT NULL,
    "street" VARCHAR(255) NOT NULL,
    "number" VARCHAR(20),
    "apartment" VARCHAR(50),
    "neighborhood" VARCHAR(100),
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(100),
    "country" VARCHAR(100) NOT NULL,
    "postal_code" VARCHAR(20),
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "property_flex_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_flex_images" (
    "id" UUID NOT NULL,
    "property_flex_id" UUID NOT NULL,
    "media_file_id" UUID NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "caption" VARCHAR(255),
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_flex_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_flex_amenities" (
    "property_flex_id" UUID NOT NULL,
    "amenity_id" UUID NOT NULL,

    CONSTRAINT "property_flex_amenities_pkey" PRIMARY KEY ("property_flex_id","amenity_id")
);

-- CreateTable
CREATE TABLE "flex_bookings" (
    "id" UUID NOT NULL,
    "property_flex_id" UUID NOT NULL,
    "professional_profile_id" UUID,
    "client_name" VARCHAR(200) NOT NULL,
    "client_email" VARCHAR(255),
    "client_phone" VARCHAR(30),
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "total_months" SMALLINT NOT NULL,
    "monthly_amount" DECIMAL(10,2) NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "deposit_amount" DECIMAL(10,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ARS',
    "status" "FlexBookingStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "flex_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "property_flex_status_idx" ON "property_flex"("status");

-- CreateIndex
CREATE INDEX "property_flex_company_id_idx" ON "property_flex"("company_id");

-- CreateIndex
CREATE INDEX "property_flex_deleted_at_idx" ON "property_flex"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "property_flex_addresses_property_flex_id_key" ON "property_flex_addresses"("property_flex_id");

-- CreateIndex
CREATE INDEX "property_flex_images_property_flex_id_idx" ON "property_flex_images"("property_flex_id");

-- CreateIndex
CREATE INDEX "flex_bookings_property_flex_id_start_date_end_date_idx" ON "flex_bookings"("property_flex_id", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "flex_bookings_status_idx" ON "flex_bookings"("status");

-- CreateIndex
CREATE INDEX "flex_bookings_professional_profile_id_idx" ON "flex_bookings"("professional_profile_id");

-- CreateIndex
CREATE INDEX "flex_bookings_deleted_at_idx" ON "flex_bookings"("deleted_at");

-- AddForeignKey
ALTER TABLE "property_flex" ADD CONSTRAINT "property_flex_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_flex_addresses" ADD CONSTRAINT "property_flex_addresses_property_flex_id_fkey" FOREIGN KEY ("property_flex_id") REFERENCES "property_flex"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_flex_images" ADD CONSTRAINT "property_flex_images_property_flex_id_fkey" FOREIGN KEY ("property_flex_id") REFERENCES "property_flex"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_flex_images" ADD CONSTRAINT "property_flex_images_media_file_id_fkey" FOREIGN KEY ("media_file_id") REFERENCES "media_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_flex_amenities" ADD CONSTRAINT "property_flex_amenities_property_flex_id_fkey" FOREIGN KEY ("property_flex_id") REFERENCES "property_flex"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_flex_amenities" ADD CONSTRAINT "property_flex_amenities_amenity_id_fkey" FOREIGN KEY ("amenity_id") REFERENCES "amenities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flex_bookings" ADD CONSTRAINT "flex_bookings_property_flex_id_fkey" FOREIGN KEY ("property_flex_id") REFERENCES "property_flex"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flex_bookings" ADD CONSTRAINT "flex_bookings_professional_profile_id_fkey" FOREIGN KEY ("professional_profile_id") REFERENCES "professional_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
