/**
 * 生成 sources 表的种子 SQL（基于 SOURCE_TEMPLATES + RSSHUB_BASE）。
 * 用法（已编译后）：
 *   node ./dist/scripts/seed_sources.js --sql > dist/scripts/seed_sources.sql
 *   npx wrangler d1 execute zimmerwald-db --file=./dist/scripts/seed_sources.sql --remote
 */

import { buildRssSources } from '../src/config/rss-sources';

function getArgValue(flag: string): string | undefined {
  const match = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  if (match) return match.slice(flag.length + 1);
  return undefined;
}

function escapeSql(value: string) {
  return value.replace(/'/g, "''");
}

function generateSql(rssHubBase?: string): string[] {
  const sources = buildRssSources(rssHubBase);
  const createdAt = Date.now();
  return sources.map((src) => {
    return [
      `INSERT OR IGNORE INTO sources (slug, name, url, platform, is_rsshub, enabled, error_count, created_at) VALUES (`,
      `'${escapeSql(src.id)}',`,
      `'${escapeSql(src.name)}',`,
      `'${escapeSql(src.url)}',`,
      `'${src.platform}',`,
      `${src.isRssHub ? 1 : 0},`,
      `${src.enabled !== false ? 1 : 0},`,
      `0,`,
      `${createdAt}`,
      `);`,
    ].join(' ');
  });
}

// CLI 输出 SQL
if (typeof process !== 'undefined' && process.argv.includes('--sql')) {
  const cliBase = getArgValue('--rsshub-base');
  const sqlLines = generateSql(cliBase || process.env.RSSHUB_BASE || '');
  console.log('-- Seed sources generated from SOURCE_TEMPLATES');
  sqlLines.forEach((line) => console.log(line));
}

