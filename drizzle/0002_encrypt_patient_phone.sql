-- Patient contact number: the one PII column still stored in the clear.
-- Renamed rather than recreated so existing rows must be re-encrypted by
-- hand; no ciphertext can be mistaken for a plaintext number afterwards.
ALTER TABLE "reports_rs" RENAME COLUMN "phone_number" TO "phone_number_encrypted";
