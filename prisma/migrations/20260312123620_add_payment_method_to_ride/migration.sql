/*
  Warnings:

  - Added the required column `payment_method` to the `rides` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "rides" ADD COLUMN     "payment_method" "PaymentMethod" NOT NULL;
