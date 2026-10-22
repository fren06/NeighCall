-- Starting data for a fresh NeighCall project. Run once in the SQL Editor,
-- after 0001_init.sql and 0002_hardening.sql.

insert into estates (name, area) values
  ('Taman Melati Residences', 'Setapak, Kuala Lumpur'),
  ('Danau Kota Suites',       'Setapak, Kuala Lumpur'),
  ('Seri Maya Condominium',   'Ampang, Kuala Lumpur');

-- ─── Making the first admin ───────────────────────────────────────────────
-- Admin and management accounts can't sign up as staff from the app.
-- 1. Sign up in the app like a normal resident, choosing your estate.
-- 2. Run this (with your email) to promote yourself:
--
--   update users set role = 'admin', status = 'approved'
--   where email = 'you@example.com';
--
-- Use role = 'management' instead for an estate manager account.
