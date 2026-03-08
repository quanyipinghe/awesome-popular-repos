/**
 * 项目管理 API
 * GET    /api/projects     - 获取所有项目
 * POST   /api/projects     - 添加项目（需认证）
 * PUT    /api/projects     - 更新项目（需认证）
 * DELETE /api/projects     - 删除项目（需认证）
 */

import { verifyAuth, unauthorizedResponse, jsonResponse } from '../_middleware.js';

/**
 * 统一解析分类字段（兼容字符串、JSON 字符串、数组）
 * @param {string|string[]|null|undefined} value
 * @returns {string[]}
 */
function normalizeCategoryIds(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map(v => String(v).trim()).filter(Boolean))];
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        return normalizeCategoryIds(parsed);
      } catch {
        return [];
      }
    }

    return [trimmed];
  }

  return [];
}

/**
 * 安全解析 JSON 数组
 * @param {string|null|undefined} value
 * @returns {Array}
 */
function parseJsonArray(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * GET - 获取所有项目
 */
export async function onRequestGet(context) {
  const { env } = context;

  try {
    const { results } = await env.DB.prepare(
      'SELECT * FROM projects ORDER BY stars DESC'
    ).all();

    const projects = results.map(project => ({
      ...project,
      categories: normalizeCategoryIds(project.category),
      tags: parseJsonArray(project.tags),
    }));

    return jsonResponse({ projects });
  } catch (error) {
    console.error('获取项目失败:', error);
    return jsonResponse({ error: '获取项目失败', details: error.message }, 500);
  }
}

/**
 * POST - 添加项目
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  // 验证认证
  if (!verifyAuth(request, env)) {
    return unauthorizedResponse();
  }

  try {
    const project = await request.json();
    const categoryIds = normalizeCategoryIds(project.categories ?? project.category);
    const tags = Array.isArray(project.tags) ? project.tags : [];

    // 生成唯一 ID
    const id = project.id || Date.now().toString();
    const now = new Date().toISOString().split('T')[0];

    await env.DB.prepare(`
      INSERT INTO projects (id, name, owner, description, github_url, stars, language, category, tags, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      project.name,
      project.owner,
      project.description || '',
      project.github_url || '',
      project.stars || 0,
      project.language || '',
      JSON.stringify(categoryIds),
      JSON.stringify(tags),
      project.created_at || now,
      now
    ).run();

    return jsonResponse({
      success: true,
      message: '项目添加成功',
      project: { ...project, id, category: categoryIds, categories: categoryIds, tags }
    });
  } catch (error) {
    console.error('添加项目失败:', error);
    return jsonResponse({ error: '添加项目失败', details: error.message }, 500);
  }
}

/**
 * PUT - 更新项目
 */
export async function onRequestPut(context) {
  const { request, env } = context;

  // 验证认证
  if (!verifyAuth(request, env)) {
    return unauthorizedResponse();
  }

  try {
    const { id, ...updates } = await request.json();
    const categoryIds = normalizeCategoryIds(updates.categories ?? updates.category);
    const tags = Array.isArray(updates.tags) ? updates.tags : [];

    if (!id) {
      return jsonResponse({ error: '缺少项目 ID' }, 400);
    }

    const now = new Date().toISOString().split('T')[0];

    await env.DB.prepare(`
      UPDATE projects 
      SET name = ?, owner = ?, description = ?, github_url = ?, stars = ?, 
          language = ?, category = ?, tags = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      updates.name,
      updates.owner,
      updates.description || '',
      updates.github_url || '',
      updates.stars || 0,
      updates.language || '',
      JSON.stringify(categoryIds),
      JSON.stringify(tags),
      now,
      id
    ).run();

    return jsonResponse({
      success: true,
      message: '项目更新成功',
      project: { id, ...updates, category: categoryIds, categories: categoryIds, tags }
    });
  } catch (error) {
    console.error('更新项目失败:', error);
    return jsonResponse({ error: '更新项目失败', details: error.message }, 500);
  }
}

/**
 * DELETE - 删除项目
 */
export async function onRequestDelete(context) {
  const { request, env } = context;

  // 验证认证
  if (!verifyAuth(request, env)) {
    return unauthorizedResponse();
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      // 尝试从请求体获取
      const body = await request.json().catch(() => ({}));
      if (!body.id) {
        return jsonResponse({ error: '缺少项目 ID' }, 400);
      }
      await env.DB.prepare('DELETE FROM projects WHERE id = ?').bind(body.id).run();
    } else {
      await env.DB.prepare('DELETE FROM projects WHERE id = ?').bind(id).run();
    }

    return jsonResponse({
      success: true,
      message: '项目删除成功'
    });
  } catch (error) {
    console.error('删除项目失败:', error);
    return jsonResponse({ error: '删除项目失败', details: error.message }, 500);
  }
}
