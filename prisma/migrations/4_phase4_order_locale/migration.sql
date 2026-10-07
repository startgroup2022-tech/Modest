-- AlterTable
-- Storefront locale the order was placed in, so resent payment links and
-- provider return URLs land the customer in their own language.
ALTER TABLE `Order` ADD COLUMN `locale` VARCHAR(191) NOT NULL DEFAULT 'en';
