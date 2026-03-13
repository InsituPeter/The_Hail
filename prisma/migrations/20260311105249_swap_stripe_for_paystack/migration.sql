/*
  Warnings:

  - You are about to drop the column `stripe_payment_intent_id` on the `payments` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "driver_profiles" ADD COLUMN     "paystack_subaccount_code" TEXT;

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "stripe_payment_intent_id",
ADD COLUMN     "paystack_reference" TEXT;

-- AlterTable
ALTER TABLE "rider_profiles" ADD COLUMN     "paystack_authorization_code" TEXT,
ADD COLUMN     "paystack_email" TEXT;
