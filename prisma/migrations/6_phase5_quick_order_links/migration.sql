-- Phase 5 — Quick Order links.
--
-- The public token is no longer stored in the clear. `tokenHash` holds its
-- SHA-256 digest (unique, used for lookup) and `tokenLast4` keeps a short,
-- non-secret suffix for staff display. Because the raw token was never issued
-- before this phase, existing rows cannot be migrated meaningfully; the table
-- is empty in every environment, so the old columns are dropped outright.
ALTER TABLE `QuickOrderLink` DROP INDEX `QuickOrderLink_token_key`;
ALTER TABLE `QuickOrderLink` DROP COLUMN `token`;
ALTER TABLE `QuickOrderLink` ADD COLUMN `tokenHash` VARCHAR(191) NOT NULL;
ALTER TABLE `QuickOrderLink` ADD COLUMN `tokenLast4` VARCHAR(191) NOT NULL;
ALTER TABLE `QuickOrderLink` ADD COLUMN `openCount` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `QuickOrderLink` ADD COLUMN `lastOpenedAt` DATETIME(3) NULL;
CREATE UNIQUE INDEX `QuickOrderLink_tokenHash_key` ON `QuickOrderLink`(`tokenHash`);
CREATE INDEX `QuickOrderLink_createdAt_idx` ON `QuickOrderLink`(`createdAt`);

-- Preserve the acquisition source on the order created from a Quick Order link.
ALTER TABLE `Order` ADD COLUMN `quickOrderSource` ENUM('WHATSAPP', 'INSTAGRAM') NULL;
