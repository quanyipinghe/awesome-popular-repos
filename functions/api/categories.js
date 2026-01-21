/**
 * 分类管理 API
 * GET  /api/categories - 获取所有分类
 * POST /api/categories - 添加分类（需认证）
 */

import { verifyAuth, unauthorizedResponse, jsonResponse } from '../_middleware.js';

/**
 * GET - 获取所有分类
 */
export async function onRequestGet(context) {
  const { env } = context;

  try {
    const { results } = await env.DB.prepare(
      'SELECT * FROM categories ORDER BY name'
    ).all();

    return jsonResponse({ categories: results });
  } catch (error) {
    console.error('获取分类失败:', error);
    return jsonResponse({ error: '获取分类失败', details: error.message }, 500);
  }
}

/**
 * POST - 添加分类
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  // 验证认证
  if (!verifyAuth(request, env)) {
    return unauthorizedResponse();
  }

  try {
    const category = await request.json();

    const id = category.id || category.slug || Date.now().toString();

    await env.DB.prepare(`
      INSERT INTO categories (id, name, slug, description)
      VALUES (?, ?, ?, ?)
    `).bind(
      id,
      category.name,
      category.slug || id,
      category.description || ''
    ).run();

    return jsonResponse({
      success: true,
      message: '分类添加成功',
      category: { ...category, id }
    });
  } catch (error) {
    console.error('添加分类失败:', error);
    return jsonResponse({ error: '添加分类失败', details: error.message }, 500);
  }
}
