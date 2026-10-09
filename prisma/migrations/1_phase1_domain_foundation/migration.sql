-- AlterTable
ALTER TABLE `Role` MODIFY `name` ENUM('ADMIN', 'MANAGER', 'SUPPORT', 'CUSTOMER', 'TAILOR') NOT NULL;

-- AlterTable
ALTER TABLE `Customer` ADD COLUMN `membershipTierId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Measurement` ADD COLUMN `cutId` VARCHAR(191) NULL,
    ADD COLUMN `values` JSON NULL;

-- AlterTable
ALTER TABLE `Product` ADD COLUMN `cutId` VARCHAR(191) NULL,
    ADD COLUMN `tailorFeeBhd` DECIMAL(10, 3) NULL;

-- AlterTable
ALTER TABLE `Order` ADD COLUMN `expectedDeliveryAt` DATETIME(3) NULL,
    ADD COLUMN `shippingCompanyId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `OrderItem` ADD COLUMN `assignedAt` DATETIME(3) NULL,
    ADD COLUMN `assignedTailorId` VARCHAR(191) NULL,
    ADD COLUMN `cutId` VARCHAR(191) NULL,
    ADD COLUMN `measurementKind` ENUM('READY', 'CUSTOM') NULL,
    ADD COLUMN `measurementSnapshot` JSON NULL,
    ADD COLUMN `sizeCode` VARCHAR(191) NULL,
    ADD COLUMN `sizeSnapshot` JSON NULL,
    ADD COLUMN `tailorFeeBhd` DECIMAL(10, 3) NULL;

-- AlterTable
ALTER TABLE `Refund` ADD COLUMN `paymentId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `ProductionTask` ADD COLUMN `acceptedAt` DATETIME(3) NULL,
    ADD COLUMN `feeBhd` DECIMAL(10, 3) NULL,
    ADD COLUMN `submittedForQcAt` DATETIME(3) NULL,
    MODIFY `status` ENUM('PENDING', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'SUBMITTED_FOR_QC', 'COMPLETED', 'REWORK', 'CANCELLED') NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `QcRecord` ADD COLUMN `attempt` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `orderItemId` VARCHAR(191) NULL,
    ADD COLUMN `rejectionReason` TEXT NULL,
    ADD COLUMN `tailorId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `TailorSettlement` ADD COLUMN `confirmedByTailorAt` DATETIME(3) NULL,
    ADD COLUMN `transferProofUrl` TEXT NULL,
    ADD COLUMN `transferReference` VARCHAR(191) NULL,
    ADD COLUMN `transferredAt` DATETIME(3) NULL,
    MODIFY `status` ENUM('PENDING', 'APPROVED', 'TRANSFERRED', 'PAID', 'CONFIRMED', 'CANCELLED') NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `ExpenseCategory` ADD COLUMN `isSystem` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `sortOrder` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `type` ENUM('GENERAL', 'DELIVERY', 'MATERIAL', 'TAILOR_DUE') NOT NULL DEFAULT 'GENERAL';

-- AlterTable
ALTER TABLE `Expense` ADD COLUMN `orderId` VARCHAR(191) NULL,
    ADD COLUMN `productId` VARCHAR(191) NULL,
    ADD COLUMN `settlementId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `ProductCut` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `nameEn` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NOT NULL,
    `descriptionEn` TEXT NULL,
    `descriptionAr` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProductCut_code_key`(`code`),
    INDEX `ProductCut_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SizeChart` (
    `id` VARCHAR(191) NOT NULL,
    `cutId` VARCHAR(191) NOT NULL,
    `unit` VARCHAR(191) NOT NULL DEFAULT 'inch',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SizeChart_cutId_idx`(`cutId`),
    UNIQUE INDEX `SizeChart_cutId_key`(`cutId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MeasurementField` (
    `id` VARCHAR(191) NOT NULL,
    `cutId` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `labelEn` VARCHAR(191) NOT NULL,
    `labelAr` VARCHAR(191) NOT NULL,
    `unit` VARCHAR(191) NOT NULL DEFAULT 'inch',
    `minValue` DECIMAL(6, 2) NULL,
    `maxValue` DECIMAL(6, 2) NULL,
    `helperEn` TEXT NULL,
    `helperAr` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MeasurementField_cutId_idx`(`cutId`),
    UNIQUE INDEX `MeasurementField_cutId_key_key`(`cutId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SizeChartValue` (
    `id` VARCHAR(191) NOT NULL,
    `chartId` VARCHAR(191) NOT NULL,
    `fieldId` VARCHAR(191) NOT NULL,
    `sizeCode` VARCHAR(191) NOT NULL,
    `value` DECIMAL(6, 2) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SizeChartValue_chartId_idx`(`chartId`),
    INDEX `SizeChartValue_fieldId_idx`(`fieldId`),
    UNIQUE INDEX `SizeChartValue_chartId_fieldId_sizeCode_key`(`chartId`, `fieldId`, `sizeCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TailorCredential` (
    `id` VARCHAR(191) NOT NULL,
    `tailorId` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `mustChangePassword` BOOLEAN NOT NULL DEFAULT true,
    `credentialsSentAt` DATETIME(3) NULL,
    `lastPasswordChangeAt` DATETIME(3) NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TailorCredential_tailorId_key`(`tailorId`),
    UNIQUE INDEX `TailorCredential_username_key`(`username`),
    INDEX `TailorCredential_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TailorSettlementItem` (
    `id` VARCHAR(191) NOT NULL,
    `settlementId` VARCHAR(191) NOT NULL,
    `orderItemId` VARCHAR(191) NOT NULL,
    `tailorFeeBhd` DECIMAL(10, 3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `TailorSettlementItem_orderItemId_key`(`orderItemId`),
    INDEX `TailorSettlementItem_settlementId_idx`(`settlementId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShippingCompany` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `nameEn` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ShippingCompany_code_key`(`code`),
    INDEX `ShippingCompany_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuickOrderLink` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `source` ENUM('WHATSAPP', 'INSTAGRAM') NOT NULL DEFAULT 'WHATSAPP',
    `createdById` VARCHAR(191) NULL,
    `customerPhone` VARCHAR(191) NULL,
    `sentAt` DATETIME(3) NULL,
    `openedAt` DATETIME(3) NULL,
    `orderId` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `QuickOrderLink_code_key`(`code`),
    UNIQUE INDEX `QuickOrderLink_token_key`(`token`),
    INDEX `QuickOrderLink_productId_idx`(`productId`),
    INDEX `QuickOrderLink_orderId_idx`(`orderId`),
    INDEX `QuickOrderLink_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MembershipTier` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `nameEn` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NOT NULL,
    `minQualifying` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MembershipTier_code_key`(`code`),
    INDEX `MembershipTier_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NotificationRule` (
    `id` VARCHAR(191) NOT NULL,
    `eventKey` VARCHAR(191) NOT NULL,
    `nameEn` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NOT NULL,
    `targetType` ENUM('STAFF', 'TAILOR') NOT NULL DEFAULT 'STAFF',
    `requiredPermission` VARCHAR(191) NULL,
    `priority` ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT') NOT NULL DEFAULT 'NORMAL',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `NotificationRule_isActive_idx`(`isActive`),
    UNIQUE INDEX `NotificationRule_eventKey_targetType_key`(`eventKey`, `targetType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SequenceCounter` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `prefix` VARCHAR(191) NOT NULL,
    `scope` VARCHAR(191) NULL,
    `value` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SequenceCounter_key_key`(`key`),
    INDEX `SequenceCounter_key_idx`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Customer_membershipTierId_idx` ON `Customer`(`membershipTierId`);

-- CreateIndex
CREATE INDEX `Measurement_cutId_idx` ON `Measurement`(`cutId`);

-- CreateIndex
CREATE INDEX `Order_shippingCompanyId_idx` ON `Order`(`shippingCompanyId`);

-- CreateIndex
CREATE INDEX `OrderItem_assignedTailorId_idx` ON `OrderItem`(`assignedTailorId`);

-- CreateIndex
CREATE INDEX `OrderItem_cutId_idx` ON `OrderItem`(`cutId`);

-- CreateIndex
CREATE INDEX `Refund_paymentId_idx` ON `Refund`(`paymentId`);

-- CreateIndex
CREATE INDEX `ProductionTask_orderItemId_idx` ON `ProductionTask`(`orderItemId`);

-- CreateIndex
CREATE INDEX `QcRecord_orderItemId_idx` ON `QcRecord`(`orderItemId`);

-- CreateIndex
CREATE INDEX `ExpenseCategory_type_idx` ON `ExpenseCategory`(`type`);

-- CreateIndex
CREATE INDEX `Expense_orderId_idx` ON `Expense`(`orderId`);

-- CreateIndex
CREATE INDEX `Expense_settlementId_idx` ON `Expense`(`settlementId`);

-- AddForeignKey
ALTER TABLE `Customer` ADD CONSTRAINT `Customer_membershipTierId_fkey` FOREIGN KEY (`membershipTierId`) REFERENCES `MembershipTier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Measurement` ADD CONSTRAINT `Measurement_cutId_fkey` FOREIGN KEY (`cutId`) REFERENCES `ProductCut`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_cutId_fkey` FOREIGN KEY (`cutId`) REFERENCES `ProductCut`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SizeChart` ADD CONSTRAINT `SizeChart_cutId_fkey` FOREIGN KEY (`cutId`) REFERENCES `ProductCut`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MeasurementField` ADD CONSTRAINT `MeasurementField_cutId_fkey` FOREIGN KEY (`cutId`) REFERENCES `ProductCut`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SizeChartValue` ADD CONSTRAINT `SizeChartValue_chartId_fkey` FOREIGN KEY (`chartId`) REFERENCES `SizeChart`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SizeChartValue` ADD CONSTRAINT `SizeChartValue_fieldId_fkey` FOREIGN KEY (`fieldId`) REFERENCES `MeasurementField`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_shippingCompanyId_fkey` FOREIGN KEY (`shippingCompanyId`) REFERENCES `ShippingCompany`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_cutId_fkey` FOREIGN KEY (`cutId`) REFERENCES `ProductCut`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_assignedTailorId_fkey` FOREIGN KEY (`assignedTailorId`) REFERENCES `Tailor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Refund` ADD CONSTRAINT `Refund_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `Payment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TailorCredential` ADD CONSTRAINT `TailorCredential_tailorId_fkey` FOREIGN KEY (`tailorId`) REFERENCES `Tailor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductionTask` ADD CONSTRAINT `ProductionTask_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `OrderItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QcRecord` ADD CONSTRAINT `QcRecord_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `OrderItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QcRecord` ADD CONSTRAINT `QcRecord_tailorId_fkey` FOREIGN KEY (`tailorId`) REFERENCES `Tailor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TailorSettlementItem` ADD CONSTRAINT `TailorSettlementItem_settlementId_fkey` FOREIGN KEY (`settlementId`) REFERENCES `TailorSettlement`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TailorSettlementItem` ADD CONSTRAINT `TailorSettlementItem_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `OrderItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuickOrderLink` ADD CONSTRAINT `QuickOrderLink_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuickOrderLink` ADD CONSTRAINT `QuickOrderLink_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

