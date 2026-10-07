-- Durable provider-callback identity. A unique `eventKey` (hash of the raw,
-- signature-verified body) makes replaying the exact same callback a no-op, so
-- repeated non-PAID callbacks cannot append duplicate order events, while
-- genuinely distinct transitions still apply.
CREATE TABLE `PaymentWebhookEvent` (
  `id` VARCHAR(191) NOT NULL,
  `provider` VARCHAR(191) NOT NULL,
  `eventKey` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NULL,
  `status` VARCHAR(191) NOT NULL,
  `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `PaymentWebhookEvent_eventKey_key`(`eventKey`),
  INDEX `PaymentWebhookEvent_orderId_idx`(`orderId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
