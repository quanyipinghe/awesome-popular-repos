-- Awesome Popular Repos - D1 数据库 Schema
-- 运行命令: wrangler d1 execute awesome-repos-db --file=./schema.sql

-- 项目表
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner TEXT NOT NULL,
  description TEXT,
  github_url TEXT,
  stars INTEGER DEFAULT 0,
  language TEXT,
  category TEXT,
  tags TEXT,  -- JSON 数组格式存储
  created_at TEXT,
  updated_at TEXT
);

-- 分类表
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT,
  description TEXT
);

-- 标签表
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL
);

-- 创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_projects_category ON projects(category);
CREATE INDEX IF NOT EXISTS idx_projects_language ON projects(language);
CREATE INDEX IF NOT EXISTS idx_projects_stars ON projects(stars DESC);

-- 插入默认分类数据
INSERT OR IGNORE INTO categories (id, name, slug, description) VALUES
  ('framework', '框架', 'framework', 'Web 和应用开发框架'),
  ('tool', '工具', 'tool', '开发工具和实用程序'),
  ('library', '库', 'library', '可复用的代码库'),
  ('language', '语言', 'language', '编程语言'),
  ('runtime', '运行时', 'runtime', '程序运行环境'),
  ('learning', '学习资源', 'learning', '教程和学习材料');
