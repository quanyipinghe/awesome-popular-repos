/**
 * GitHub API 工具模块
 * 用于获取仓库信息和解析 URL
 */

// GitHub API 基础 URL
const API_BASE = 'https://api.github.com';

// 速率限制信息
let rateLimitRemaining = 60;
let rateLimitReset = 0;

/**
 * 解析 GitHub 仓库 URL
 * @param {string} url - GitHub 仓库 URL
 * @returns {Object|null} 包含 owner 和 repo 的对象，解析失败返回 null
 */
export function parseGitHubUrl(url) {
  try {
    // 支持多种格式：
    // https://github.com/owner/repo
    // https://github.com/owner/repo.git
    // github.com/owner/repo
    // owner/repo

    let cleanUrl = url.trim();

    // 移除 .git 后缀
    cleanUrl = cleanUrl.replace(/\.git$/, '');

    // 移除协议和 www
    cleanUrl = cleanUrl.replace(/^(https?:\/\/)?(www\.)?/, '');

    // 移除 github.com/
    cleanUrl = cleanUrl.replace(/^github\.com\//, '');

    // 提取 owner 和 repo
    const parts = cleanUrl.split('/').filter(Boolean);

    if (parts.length >= 2) {
      return {
        owner: parts[0],
        repo: parts[1]
      };
    }

    return null;
  } catch (error) {
    console.error('[GitHub] URL 解析失败:', error);
    return null;
  }
}

/**
 * 构建完整的 GitHub 仓库 URL
 * @param {string} owner - 仓库所有者
 * @param {string} repo - 仓库名称
 * @returns {string} 完整 URL
 */
export function buildGitHubUrl(owner, repo) {
  return `https://github.com/${owner}/${repo}`;
}

/**
 * 获取仓库信息
 * @param {string} owner - 仓库所有者
 * @param {string} repo - 仓库名称
 * @returns {Promise<Object>} 仓库信息
 */
export async function getRepoInfo(owner, repo) {
  // 检查速率限制
  if (rateLimitRemaining <= 0 && Date.now() < rateLimitReset) {
    const waitTime = Math.ceil((rateLimitReset - Date.now()) / 1000);
    throw new Error(`API 速率限制，请等待 ${waitTime} 秒后重试`);
  }

  try {
    const response = await fetch(`${API_BASE}/repos/${owner}/${repo}`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    // 更新速率限制信息
    rateLimitRemaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '60');
    rateLimitReset = parseInt(response.headers.get('X-RateLimit-Reset') || '0') * 1000;

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('仓库不存在');
      }
      if (response.status === 403) {
        throw new Error('API 请求被拒绝（可能是速率限制）');
      }
      throw new Error(`API 请求失败: ${response.status}`);
    }

    const data = await response.json();

    return {
      name: data.name,
      owner: data.owner.login,
      description: data.description || '',
      github_url: data.html_url,
      stars: data.stargazers_count,
      language: data.language || 'Unknown',
      forks: data.forks_count,
      watchers: data.watchers_count,
      open_issues: data.open_issues_count,
      topics: data.topics || [],
      created_at: data.created_at.split('T')[0],
      updated_at: data.updated_at.split('T')[0],
      pushed_at: data.pushed_at.split('T')[0],
      homepage: data.homepage || '',
      license: data.license?.name || ''
    };
  } catch (error) {
    console.error('[GitHub] 获取仓库信息失败:', error);
    throw error;
  }
}

/**
 * 从 URL 获取仓库信息
 * @param {string} url - GitHub 仓库 URL
 * @returns {Promise<Object>} 仓库信息
 */
export async function getRepoInfoFromUrl(url) {
  const parsed = parseGitHubUrl(url);
  if (!parsed) {
    throw new Error('无效的 GitHub URL');
  }
  return getRepoInfo(parsed.owner, parsed.repo);
}

/**
 * 批量获取仓库信息
 * @param {string[]} urls - GitHub 仓库 URL 列表
 * @param {Function} onProgress - 进度回调 (current, total, result)
 * @returns {Promise<Object[]>} 仓库信息列表
 */
export async function batchGetRepoInfo(urls, onProgress = null) {
  const results = [];
  const errors = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      const info = await getRepoInfoFromUrl(url);
      results.push({ success: true, url, data: info });
      if (onProgress) onProgress(i + 1, urls.length, { success: true, url, data: info });
    } catch (error) {
      const errorResult = { success: false, url, error: error.message };
      results.push(errorResult);
      errors.push(errorResult);
      if (onProgress) onProgress(i + 1, urls.length, errorResult);
    }

    // 添加延迟避免触发速率限制
    if (i < urls.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return { results, errors, successCount: results.length - errors.length };
}

/**
 * 获取当前速率限制状态
 * @returns {Object} 速率限制信息
 */
export function getRateLimitStatus() {
  return {
    remaining: rateLimitRemaining,
    resetTime: rateLimitReset ? new Date(rateLimitReset).toLocaleTimeString() : null,
    isLimited: rateLimitRemaining <= 0 && Date.now() < rateLimitReset
  };
}

/**
 * 格式化星标数
 * @param {number} stars - 星标数
 * @returns {string} 格式化后的字符串
 */
export function formatStars(stars) {
  if (stars >= 1000000) {
    return (stars / 1000000).toFixed(1) + 'M';
  }
  if (stars >= 1000) {
    return (stars / 1000).toFixed(1) + 'K';
  }
  return stars.toString();
}
