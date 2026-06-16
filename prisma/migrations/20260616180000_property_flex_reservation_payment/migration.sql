-- AlterTable
ALTER TABLE "property_flex" ADD COLUMN "reservation_payment_amount" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "flex_bookings" ADD COLUMN "reservation_payment_amount" DECIMAL(10,2);
