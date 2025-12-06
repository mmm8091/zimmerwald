-- Zimmerwald v1.2 数据库迁移 SQL
-- 基于 Drizzle Schema 生成

-- 删除旧表（如果需要重建）
DROP TABLE IF EXISTS feedback;
DROP TABLE IF EXISTS articles;

-- 创建 articles 表
CREATE TABLE articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT UNIQUE NOT NULL,
  source_id TEXT NOT NULL,
  title_en TEXT NOT NULL,
  title_zh TEXT NOT NULL,
  summary_en TEXT,
  summary_zh TEXT,
  category TEXT,
  tags TEXT,
  score INTEGER,
  ai_reasoning TEXT,
  published_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- 创建 articles 索引
CREATE INDEX idx_articles_url ON articles (url);
CREATE INDEX idx_articles_score ON articles (score);
CREATE INDEX idx_articles_published_at ON articles (published_at);
CREATE INDEX idx_articles_score_published ON articles (score, published_at);
CREATE INDEX idx_articles_category_published ON articles (category, published_at);

-- 创建 feedback 表
CREATE TABLE feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL,
  vote_type TEXT NOT NULL,
  user_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- 创建 feedback 索引
CREATE INDEX idx_feedback_article ON feedback (article_id);
CREATE INDEX idx_feedback_article_user ON feedback (article_id, user_hash);
CREATE INDEX idx_feedback_created_at ON feedback (created_at);

