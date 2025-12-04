-- Zimmerwald 数据库 Schema
-- 用于存储国际共运新闻聚合平台的文章数据

CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    url TEXT UNIQUE NOT NULL,
    source_name TEXT NOT NULL,
    summary TEXT,
    category TEXT CHECK(category IN ('Labor', 'Politics', 'Conflict', 'Theory')),
    score INTEGER CHECK(score >= 0 AND score <= 100),
    published_at INTEGER,
    created_at INTEGER NOT NULL
);

-- 创建索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_url ON articles(url);
CREATE INDEX IF NOT EXISTS idx_published_at ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_score ON articles(score DESC);
CREATE INDEX IF NOT EXISTS idx_category ON articles(category);

