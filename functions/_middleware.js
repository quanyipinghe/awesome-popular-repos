/**
 * Cloudflare Pages 中间件
 * 处理 CORS 和通用请求逻辑
 */

// CORS 响应头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

/**
 * 处理 OPTIONS 预检请求
 */
function handleOptions(request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * 添加 CORS 头到响应
 */
function addCorsHeaders(response) {
  const newHeaders = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

/**
 * 验证管理员认证
 * @param {Request} request - 请求对象
 * @param {object} env - 环境变量
 * @returns {boolean} 是否认证通过
 */
export function verifyAuth(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false;
  }

  try {
    const base64Credentials = authHeader.slice(6);
    const credentials = atob(base64Credentials);
    const [username, password] = credentials.split(':');

    const adminUsername = env.ADMIN_USERNAME || 'admin';
    const adminPassword = env.ADMIN_PASSWORD || 'admin123';

    return username === adminUsername && password === adminPassword;
  } catch (e) {
    return false;
  }
}

/**
 * 返回未授权响应
 */
export function unauthorizedResponse() {
  return new Response(JSON.stringify({ error: '未授权访问' }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

/**
 * 返回 JSON 响应
 */
export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

/**
 * 中间件入口
 */
export async function onRequest(context) {
  const { request, next } = context;

  // 处理 OPTIONS 预检请求
  if (request.method === 'OPTIONS') {
    return handleOptions(request);
  }

  // 继续处理请求
  const response = await next();

  // 添加 CORS 头
  return addCorsHeaders(response);
}
