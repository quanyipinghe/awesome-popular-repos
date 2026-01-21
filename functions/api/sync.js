/**
 * 数据同步 API
 * POST /api/sync - 批量导入数据（需认证）
 * 用于将本地数据同步到 D1 数据库
 */

import { verifyAuth, unauthorizedResponse, jsonResponse } from '../_middleware.js';

/**
 * POST - 批量同步数据
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  // 验证认证
  if (!verifyAuth(request, env)) {
    return unauthorizedResponse();
  }

  try {
    const { projects, categories } = await request.json();
    const results = { projects: 0, categories: 0 };

    // 同步分类
    if (categories && Array.isArray(categories)) {
      for (const category of categories) {
        try {
          await env.DB.prepare(`
            INSERT OR REPLACE INTO categories (id, name, slug, description)
            VALUES (?, ?, ?, ?)
          `).bind(
            category.id,
            category.name,
            category.slug || category.id,
            category.description || ''
          ).run();
          results.categories++;
        } catch (e) {
          console.error('同步分类失败:', category.id, e);
        }
      }
    }

    // 同步项目
    if (projects && Array.isArray(projects)) {
      for (const project of projects) {
        try {
          await env.DB.prepare(`
            INSERT OR REPLACE INTO projects 
            (id, name, owner, description, github_url, stars, language, category, tags, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            project.id,
            project.name,
            project.owner,
            project.description || '',
            project.github_url || '',
            project.stars || 0,
            project.language || '',
            project.category || '',
            JSON.stringify(project.tags || []),
            project.created_at || new Date().toISOString().split('T')[0],
            project.updated_at || new Date().toISOString().split('T')[0]
          ).run();
          results.projects++;
        } catch (e) {
          console.error('同步项目失败:', project.id, e);
        }
      }
    }

    return jsonResponse({
      success: true,
      message: '数据同步完成',
      results
    });
  } catch (error) {
    console.error('数据同步失败:', error);
    return jsonResponse({ error: '数据同步失败', details: error.message }, 500);
  }
}
