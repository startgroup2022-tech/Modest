-- Phase 5 — Quick Order links: relate a link to the product it opens.
--
-- The link previously stored only `productId` with no referential integrity, so
-- a deleted product could leave a dangling link. This adds the foreign key;
-- deleting a product now removes its links rather than leaving them pointing at
-- nothing. The existing `QuickOrderLink_productId_idx` index backs the column.
ALTER TABLE `QuickOrderLink` ADD CONSTRAINT `QuickOrderLink_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
