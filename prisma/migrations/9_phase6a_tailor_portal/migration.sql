-- Phase 6A: Tailor Portal.
--
-- Additive only. Two changes:
--   1. A dedicated TailorNotification table. A tailor is not a User, so the
--      existing StaffNotification (userId FK -> User) cannot represent them
--      without a type lie. eventKey mirrors NotificationRule.eventKey.
--   2. A unique expense link on TailorSettlement so paying a settlement can
--      raise exactly one TAILOR_DUE expense, idempotently.

-- AlterTable: unique link from a settlement to the expense it raised on payout.
ALTER TABLE `TailorSettlement` ADD COLUMN `expenseId` VARCHAR(191) NULL;
CREATE UNIQUE INDEX `TailorSettlement_expenseId_key` ON `TailorSettlement`(`expenseId`);

-- CreateTable: tailor notifications.
CREATE TABLE `TailorNotification` (
    `id` VARCHAR(191) NOT NULL,
    `tailorId` VARCHAR(191) NOT NULL,
    `eventKey` VARCHAR(191) NULL,
    `titleEn` VARCHAR(191) NOT NULL,
    `titleAr` VARCHAR(191) NOT NULL,
    `bodyEn` TEXT NULL,
    `bodyAr` TEXT NULL,
    `href` VARCHAR(191) NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TailorNotification_tailorId_readAt_idx`(`tailorId`, `readAt`),
    INDEX `TailorNotification_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TailorNotification` ADD CONSTRAINT `TailorNotification_tailorId_fkey` FOREIGN KEY (`tailorId`) REFERENCES `Tailor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
