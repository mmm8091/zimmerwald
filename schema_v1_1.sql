-- Zimmerwald v1.1 数据库 Schema（Cloudflare D1 / SQLite）
-- 版本代号: "International"
-- 说明：
-- 1. 采用“宽表”设计，将双语内容与标签 JSON 直接存入 articles 主表
-- 2. 不保留 v1.0 旧数据，如需升级请先备份旧库

-- ===============================
-- 安全清理：删除旧表（如存在）
-- ===============================

DROP TABLE IF EXISTS feedback;
DROP TABLE IF EXISTS articles;

-- ===============================
-- 核心表：articles（情报核心）
-- ===============================
-- 存储经过 RSS 抓取 + LLM 分析后的高价值新闻情报
-- 双语字段 + JSON 标签 + 严格评分 + AI 评分理由

CREATE TABLE IF NOT EXISTS articles (
  -- 主键
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- 去重与来源信息
  url TEXT NOT NULL,                -- 原始文章链接（用于唯一去重）
  source_id TEXT NOT NULL,          -- 来源标识（如：wsws, red_herald）

  -- 时间信息
  published_at INTEGER,             -- 原文发布时间（Unix 时间戳，允许为空）
  created_at INTEGER NOT NULL,      -- 抓取入库时间（Unix 时间戳）

  -- 双语标题与摘要（由 LLM 生成或翻译）
  title_en TEXT,                    -- 英文标题（通常为原文标题）
  title_zh TEXT,                    -- 中文标题（翻译）
  summary_en TEXT,                  -- 英文摘要（约 50 词）
  summary_zh TEXT,                  -- 中文摘要（约 100 字）

  -- 分类与标签
  category TEXT,                    -- 枚举：Labor, Politics, Conflict, Theory
  tags TEXT,                        -- JSON 字符串：例如 [{"en":"Strike","zh":"罢工"}, ...]

  -- 评分与 AI 解释
  score INTEGER,                    -- 0-100，唯物主义重要性评分
  ai_reasoning TEXT                 -- AI 给出该评分的理由（用于调试与防止幻觉）
);

-- ===============================
-- articles 索引策略
-- ===============================

-- URL 唯一索引：保证同一文章只入库一次
CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_url
  ON articles (url);

-- 时间轴索引：按发布时间排序 / 范围查询
CREATE INDEX IF NOT EXISTS idx_articles_published_at
  ON articles (published_at DESC);

-- 默认视图索引：按 score DESC, published_at DESC 排序
-- 说明：SQLite 不支持多列带方向的复合索引语法中显式 DESC，
-- 但在查询中使用相同排序组合时仍可受益于该复合索引。
CREATE INDEX IF NOT EXISTS idx_articles_score_published
  ON articles (score, published_at);

-- 分类筛选索引：category + published_at 组合
CREATE INDEX IF NOT EXISTS idx_articles_category_published
  ON articles (category, published_at);

-- 可选：只对 score 建单独索引，用于高分筛选
CREATE INDEX IF NOT EXISTS idx_articles_score
  ON articles (score);

-- ===============================
-- 群众审计表：feedback
-- ===============================
-- 存储用户对 AI 评分的主观反馈，为后续 RLHF / 统计分析提供基础数据

-- 约束说明：article_id 逻辑外键（D1/SQLite 不强制 FK，可由应用层保证）
-- FOREIGN KEY (article_id) REFERENCES articles(id)
-- （如需严格外键，可在迁移到其他环境时启用）
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL,      -- 关联到 articles.id
  vote_type TEXT NOT NULL,          -- 枚举：too_high, accurate, too_low
  user_hash TEXT NOT NULL,          -- 用户指纹（基于 IP + UA 的 Hash，用于防刷）
  created_at INTEGER NOT NULL       -- 投票时间（Unix 时间戳）
);

-- feedback 索引：按文章 + 用户快速去重/统计
CREATE INDEX IF NOT EXISTS idx_feedback_article
  ON feedback (article_id);

CREATE INDEX IF NOT EXISTS idx_feedback_article_user
  ON feedback (article_id, user_hash);

CREATE INDEX IF NOT EXISTS idx_feedback_created_at
  ON feedback (created_at DESC);


