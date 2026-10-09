-- AlterTable
ALTER TABLE `Coupon` ADD COLUMN `minQualifyingPieces` INTEGER NULL;

-- AlterTable
ALTER TABLE `Payment` ADD COLUMN `linkSentAt` DATETIME(3) NULL,
    ADD COLUMN `linkSentById` VARCHAR(191) NULL,
    ADD COLUMN `paymentUrl` TEXT NULL;

-- CreateTable
CREATE TABLE `CouponRedemption` (
    `id` VARCHAR(191) NOT NULL,
    `couponId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NULL,
    `orderId` VARCHAR(191) NULL,
    `guestEmailHash` VARCHAR(191) NULL,
    `amountBhd` DECIMAL(12, 3) NOT NULL DEFAULT 0,
    `revertedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CouponRedemption_couponId_idx`(`couponId`),
    INDEX `CouponRedemption_customerId_idx`(`customerId`),
    INDEX `CouponRedemption_orderId_idx`(`orderId`),
    INDEX `CouponRedemption_guestEmailHash_idx`(`guestEmailHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Payment_linkSentById_idx` ON `Payment`(`linkSentById`);

-- AddForeignKey
ALTER TABLE `CouponRedemption` ADD CONSTRAINT `CouponRedemption_couponId_fkey` FOREIGN KEY (`couponId`) REFERENCES `Coupon`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CouponRedemption` ADD CONSTRAINT `CouponRedemption_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CouponRedemption` ADD CONSTRAINT `CouponRedemption_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_linkSentById_fkey` FOREIGN KEY (`linkSentById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

