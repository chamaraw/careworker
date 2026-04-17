-- Reset all user passwords to: password123
-- Run after schema changes if login stops working: psql $DATABASE_URL -f prisma/reset-passwords.sql

-- Bcrypt hash for "password123" (10 rounds, bcryptjs)
UPDATE "User"
SET "passwordHash" = '$2b$10$2Xbe3ls5LfhdIaLCYWk0SuU.E0rUhR9adzKQxffjqPVO0jeia1PDe',
    "updatedAt" = NOW();
