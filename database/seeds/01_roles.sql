-- ============================================================================
-- KasirKu POS — Seed data (Phase 1: roles only)
-- No users/passwords are seeded here. Create users via Phase 2 auth flow
-- with hashed passwords. Never store plaintext passwords.
-- ============================================================================

USE `kasir_app`;

INSERT INTO `roles` (`name`)
VALUES ('admin'), ('kasir'), ('pemilik')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);
