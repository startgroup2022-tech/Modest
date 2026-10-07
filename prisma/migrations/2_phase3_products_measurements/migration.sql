-- Phase 3: products + size guide + storefront measurements.
-- Additive: new enum values, one new column, one new table.
-- Product.cutId / Product.tailorFeeBhd and the ProductCut / SizeChart /
-- MeasurementField / SizeChartValue tables already exist from phase 1.
-- No DROP; the legacy CartItem unique key is replaced after backfilling
-- configKey so existing carts keep working and stay de-duplicated.

-- 1. Product lifecycle states (published but unavailable / preorder).
ALTER TABLE `Product` MODIFY `status` ENUM('DRAFT', 'ACTIVE', 'PREORDER', 'UNAVAILABLE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE';

-- 2. New Product column: whether the storefront may show numeric remaining stock.
ALTER TABLE `Product` ADD COLUMN `showAvailability` BOOLEAN NOT NULL DEFAULT true;

-- 3. Cart lines gain a measurement-aware grouping key. Backfill existing rows to
--    product|variant so they remain unique, then swap the unique index.
ALTER TABLE `CartItem` ADD COLUMN `configKey` VARCHAR(191) NOT NULL DEFAULT '';
UPDATE `CartItem` SET `configKey` = CONCAT(`productId`, '|', COALESCE(`variantId`, '_'));
DROP INDEX `CartItem_cartId_productId_variantId_key` ON `CartItem`;
CREATE UNIQUE INDEX `CartItem_cartId_configKey_key` ON `CartItem`(`cartId`, `configKey`);

-- 4. Per-piece cart configuration.
CREATE TABLE `CartItemPiece` (
    `id` VARCHAR(191) NOT NULL,
    `cartItemId` VARCHAR(191) NOT NULL,
    `pieceIndex` INTEGER NOT NULL,
    `measurementKind` ENUM('READY', 'CUSTOM') NULL,
    `sizeCode` VARCHAR(191) NULL,
    `sizeSnapshot` JSON NULL,
    `measurementSnapshot` JSON NULL,
    `cutId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CartItemPiece_cartItemId_pieceIndex_key`(`cartItemId`, `pieceIndex`),
    INDEX `CartItemPiece_cartItemId_idx`(`cartItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 5. Foreign key for the new table. (Product_cutId_fkey already exists from
--    phase 1, where Product.cutId was introduced.)
ALTER TABLE `CartItemPiece` ADD CONSTRAINT `CartItemPiece_cartItemId_fkey` FOREIGN KEY (`cartItemId`) REFERENCES `CartItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
