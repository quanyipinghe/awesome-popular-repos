/**
 * 存储工具模块 - localStorage 封装
 * 提供统一的数据持久化接口
 */

// 存储键名前缀
const STORAGE_PREFIX = 'awesome_repos_';

// 存储键名
export const KEYS = {
  PROJECTS: `${STORAGE_PREFIX}projects`,
  CATEGORIES: `${STORAGE_PREFIX}categories`,
  TAGS: `${STORAGE_PREFIX}tags`,
  FAVORITES: `${STORAGE_PREFIX}favorites`,
  SETTINGS: `${STORAGE_PREFIX}settings`,
  ADMIN_AUTH: `${STORAGE_PREFIX}admin_auth`,
  DATA_VERSION: `${STORAGE_PREFIX}data_version`
};

// 当前数据版本
const CURRENT_VERSION = '1.0.0';

/**
 * 获取存储的数据
 * @param {string} key - 存储键名
 * @param {*} defaultValue - 默认值
 * @returns {*} 存储的数据或默认值
 */
export function get(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key);
    if (item === null) return defaultValue;
    return JSON.parse(item);
  } catch (error) {
    console.error(`[Storage] 读取失败: ${key}`, error);
    return defaultValue;
  }
}

/**
 * 存储数据
 * @param {string} key - 存储键名
 * @param {*} value - 要存储的数据
 * @returns {boolean} 是否成功
 */
export function set(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`[Storage] 写入失败: ${key}`, error);
    return false;
  }
}

/**
 * 删除存储的数据
 * @param {string} key - 存储键名
 */
export function remove(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`[Storage] 删除失败: ${key}`, error);
  }
}

/**
 * 清空所有应用数据
 */
export function clear() {
  Object.values(KEYS).forEach(key => remove(key));
}

// ===== 项目数据操作 =====

/**
 * 获取所有项目
 * @returns {Array} 项目列表
 */
export function getProjects() {
  return get(KEYS.PROJECTS, []);
}

/**
 * 保存项目列表
 * @param {Array} projects - 项目列表
 */
export function setProjects(projects) {
  set(KEYS.PROJECTS, projects);
}

/**
 * 添加单个项目
 * @param {Object} project - 项目对象
 */
export function addProject(project) {
  const projects = getProjects();
  // 生成唯一 ID
  project.id = project.id || Date.now().toString();
  project.created_at = project.created_at || new Date().toISOString().split('T')[0];
  project.updated_at = new Date().toISOString().split('T')[0];
  projects.push(project);
  setProjects(projects);
  return project;
}

/**
 * 更新项目
 * @param {string} id - 项目 ID
 * @param {Object} updates - 更新内容
 */
export function updateProject(id, updates) {
  const projects = getProjects();
  const index = projects.findIndex(p => p.id === id);
  if (index !== -1) {
    projects[index] = {
      ...projects[index],
      ...updates,
      updated_at: new Date().toISOString().split('T')[0]
    };
    setProjects(projects);
    return projects[index];
  }
  return null;
}

/**
 * 删除项目
 * @param {string} id - 项目 ID
 */
export function deleteProject(id) {
  const projects = getProjects().filter(p => p.id !== id);
  setProjects(projects);
}

// ===== 分类数据操作 =====

/**
 * 获取所有分类
 * @returns {Array} 分类列表
 */
export function getCategories() {
  return get(KEYS.CATEGORIES, []);
}

/**
 * 保存分类列表
 * @param {Array} categories - 分类列表
 */
export function setCategories(categories) {
  set(KEYS.CATEGORIES, categories);
}

// ===== 标签数据操作 =====

/**
 * 获取所有标签
 * @returns {Array} 标签列表
 */
export function getTags() {
  return get(KEYS.TAGS, []);
}

/**
 * 保存标签列表
 * @param {Array} tags - 标签列表
 */
export function setTags(tags) {
  set(KEYS.TAGS, tags);
}

// ===== 收藏操作 =====

/**
 * 获取收藏的项目 ID 列表
 * @returns {Array} 收藏 ID 列表
 */
export function getFavorites() {
  return get(KEYS.FAVORITES, []);
}

/**
 * 切换收藏状态
 * @param {string} projectId - 项目 ID
 * @returns {boolean} 切换后的收藏状态
 */
export function toggleFavorite(projectId) {
  const favorites = getFavorites();
  const index = favorites.indexOf(projectId);
  if (index === -1) {
    favorites.push(projectId);
  } else {
    favorites.splice(index, 1);
  }
  set(KEYS.FAVORITES, favorites);
  return index === -1;
}

/**
 * 检查是否已收藏
 * @param {string} projectId - 项目 ID
 * @returns {boolean} 是否已收藏
 */
export function isFavorite(projectId) {
  return getFavorites().includes(projectId);
}

// ===== 设置操作 =====

/**
 * 获取设置
 * @returns {Object} 设置对象
 */
export function getSettings() {
  return get(KEYS.SETTINGS, {
    theme: 'dark',
    sortBy: 'stars',
    sortOrder: 'desc'
  });
}

/**
 * 保存设置
 * @param {Object} settings - 设置对象
 */
export function setSettings(settings) {
  set(KEYS.SETTINGS, { ...getSettings(), ...settings });
}

// ===== 初始化 =====

/**
 * 初始化存储，加载默认数据
 * @param {Object} defaultData - 默认数据
 */
export async function initStorage(defaultData = null) {
  const version = get(KEYS.DATA_VERSION);

  // 如果是首次使用或版本更新，加载默认数据
  if (!version || version !== CURRENT_VERSION) {
    if (defaultData) {
      if (defaultData.projects) setProjects(defaultData.projects);
      if (defaultData.categories) setCategories(defaultData.categories);
      if (defaultData.tags) setTags(defaultData.tags);
    }
    set(KEYS.DATA_VERSION, CURRENT_VERSION);
    console.log('[Storage] 数据初始化完成');
  }
}

/**
 * 导出所有数据
 * @returns {Object} 所有数据
 */
export function exportAllData() {
  return {
    projects: getProjects(),
    categories: getCategories(),
    tags: getTags(),
    favorites: getFavorites(),
    settings: getSettings(),
    exportedAt: new Date().toISOString()
  };
}

/**
 * 导入数据
 * @param {Object} data - 要导入的数据
 */
export function importData(data) {
  if (data.projects) setProjects(data.projects);
  if (data.categories) setCategories(data.categories);
  if (data.tags) setTags(data.tags);
  if (data.favorites) set(KEYS.FAVORITES, data.favorites);
  if (data.settings) setSettings(data.settings);
}
