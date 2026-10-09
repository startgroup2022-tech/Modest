-- Phase 5 — idempotency payload fingerprint.
--
-- Records a fingerprint of the commercial payload (lines, pieces, shipping,
-- discount, payment method) that produced an order. A retry that reuses an
-- idempotency key must present the same fingerprint; a materially different
-- payload under the same key is rejected instead of being silently applied to
-- the existing order. Nullable so legacy rows and keyless submissions are
-- unaffected.
ALTER TABLE `Order` ADD COLUMN `idempotencyFingerprint` TEXT NULL;
