// Zimmerwald v1.1 源标识工具函数
// 在内部统一处理 source_id <-> 显示名称 的映射逻辑

import { SOURCE_NAME_MAP } from '../config/rss-sources';

/**
 * 根据 RSS 源名称生成 source_id（小写 + 下划线）
 * 例如：'Peoples Dispatch' -> 'peoples_dispatch'
 */
export function getSourceIdFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/'/g, '') // 去掉单引号
    .replace(/\s+/g, '_') // 空格转下划线
    .replace(/[^a-z0-9_]/g, ''); // 移除其他符号
}

/**
 * 根据 source_id 查找展示用名称
 */
export function getSourceNameFromId(sourceId: string): string {
  return SOURCE_NAME_MAP[sourceId] || sourceId;
}


