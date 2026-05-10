ALTER TABLE users
  ALTER COLUMN id_verified SET DEFAULT 'unverified';

UPDATE users
SET id_verified = 'unverified'
WHERE (id_verified IS NULL OR id_verified = '' OR id_verified = 'pending')
  AND (id_card_no IS NULL OR id_card_no = '');
