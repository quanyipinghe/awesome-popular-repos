/**
 * 管理员认证 API
 * POST /api/auth - 验证用户名和密码
 */

import { jsonResponse } from '../_middleware.js';

/**
 * 处理认证请求
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { username, password } = await request.json();

    // 从环境变量获取管理员凭据
    const adminUsername = env.ADMIN_USERNAME || 'admin';
    const adminPassword = env.ADMIN_PASSWORD || 'admin123';

    // 验证凭据
    if (username === adminUsername && password === adminPassword) {
      // 生成 Base64 凭据用于后续 API 调用
      const credentials = btoa(`${username}:${password}`);

      return jsonResponse({
        success: true,
        message: '登录成功',
        token: credentials,
      });
    } else {
      return jsonResponse({
        success: false,
        error: '用户名或密码错误',
      }, 401);
    }
  } catch (error) {
    return jsonResponse({
      success: false,
      error: '请求格式错误',
    }, 400);
  }
}
