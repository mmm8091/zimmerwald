-- Zimmerwald v1.4 schema migration

-- 1) Drop obsolete feedback table if exists
DROP TABLE IF EXISTS feedback;

-- 2) Create sources table
CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  platform TEXT NOT NULL, -- 'News' | 'Twitter' | 'Telegram'
  is_rsshub INTEGER DEFAULT 0,
  enabled INTEGER DEFAULT 1,
  last_fetched_at INTEGER,
  last_status TEXT,
  error_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- 3) Create daily_briefings table
CREATE TABLE IF NOT EXISTS daily_briefings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE, -- e.g., '2025-12-12'
  content_zh TEXT NOT NULL,
  content_en TEXT,
  key_article_ids TEXT,
  defcon_level INTEGER,
  created_at INTEGER NOT NULL
);

-- 4) Keep existing articles table as-is (no change required here)


