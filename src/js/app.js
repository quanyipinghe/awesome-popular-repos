/**
 * 前台主应用入口
 * 初始化页面、加载数据、绑定事件
 */

import {
  initStorage,
  getProjects,
  getCategories,
  setProjects,
  setCategories,
  getFavorites,
  getSettings,
  setSettings
} from './utils/storage.js';
import { formatStars } from './utils/github-api.js';
import { createProjectCard, renderProjectCards, createSkeletonCards } from './components/ProjectCard.js';
import { createSearchBar, searchProjects } from './components/SearchBar.js';
import { createFilterPanel, applyFilters } from './components/FilterPanel.js';

// 导入默认数据
import defaultData from './data/projects.json';

// API 基础路径
const API_BASE = '/api';

// 全局状态
const state = {
  projects: [],
  filteredProjects: [],
  categories: [],
  searchQuery: '',
  filters: {
    language: 'all',
    category: 'all',
    sort: 'stars-desc',
    showFavorites: false
  }
};

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
 * 规范化项目结构，确保分类字段兼容
 * @param {Object} project
 * @returns {Object}
 */
function normalizeProjectForClient(project) {
  const categories = normalizeCategoryIds(project?.categories ?? project?.category);
  return {
    ...project,
    category: categories,
    categories
  };
}

/**
 * 前台请求 API
 * @param {string} endpoint
 * @returns {Promise<any>}
 */
async function fetchApi(endpoint) {
  const response = await fetch(`${API_BASE}${endpoint}`);
  if (!response.ok) {
    throw new Error(`API ${endpoint} 请求失败: ${response.status}`);
  }
  return response.json();
}

/**
 * 尝试从云端拉取最新数据（失败静默回退本地）
 */
async function hydrateDataFromApi() {
  const [projectsRes, categoriesRes] = await Promise.allSettled([
    fetchApi('/projects'),
    fetchApi('/categories')
  ]);

  if (projectsRes.status === 'fulfilled' && Array.isArray(projectsRes.value.projects)) {
    const projects = projectsRes.value.projects.map(normalizeProjectForClient);
    state.projects = projects;
    setProjects(projects);
  } else if (projectsRes.status === 'rejected') {
    console.warn('[App] 获取云端项目失败，使用本地数据:', projectsRes.reason);
  }

  if (categoriesRes.status === 'fulfilled' && Array.isArray(categoriesRes.value.categories)) {
    state.categories = categoriesRes.value.categories;
    setCategories(state.categories);
  } else if (categoriesRes.status === 'rejected') {
    console.warn('[App] 获取云端分类失败，使用本地数据:', categoriesRes.reason);
  }
}

/**
 * 初始化应用
 */
async function initApp() {
  console.log('[App] 初始化应用...');

  // 初始化存储和加载数据
  await initStorage(defaultData);

  // 加载数据
  state.projects = getProjects().map(normalizeProjectForClient);
  state.categories = getCategories();

  // 如果没有项目数据，使用默认数据
  if (state.projects.length === 0) {
    state.projects = defaultData.projects.map(normalizeProjectForClient);
    state.categories = defaultData.categories;
  }

  // 尝试用云端最新数据覆盖本地缓存（失败静默回退）
  await hydrateDataFromApi();

  // 初始化主题
  initTheme();

  // 更新统计数据
  updateStats();

  // 初始化搜索组件
  initSearchBar();

  // 初始化筛选组件
  initFilterPanel();

  // 渲染项目列表
  refreshProjects();

  console.log(`[App] 加载完成，共 ${state.projects.length} 个项目`);
}

/**
 * 初始化主题
 */
function initTheme() {
  const settings = getSettings();
  const theme = settings.theme || 'dark';

  document.documentElement.dataset.theme = theme;
  updateThemeButton(theme);

  // 主题切换按钮
  const themeToggle = document.getElementById('themeToggle');
  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.dataset.theme;
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.dataset.theme = newTheme;
    setSettings({ theme: newTheme });
    updateThemeButton(newTheme);
  });
}

/**
 * 更新主题按钮图标
 * @param {string} theme - 当前主题
 */
function updateThemeButton(theme) {
  const themeToggle = document.getElementById('themeToggle');
  themeToggle.textContent = theme === 'dark' ? '🌙' : '☀️';
}

/**
 * 更新统计数据
 */
function updateStats() {
  const projectCount = document.getElementById('projectCount');
  const languageCount = document.getElementById('languageCount');
  const totalStars = document.getElementById('totalStars');

  // 项目总数
  projectCount.textContent = state.projects.length;

  // 语言数量
  const languages = new Set(state.projects.map(p => p.language).filter(Boolean));
  languageCount.textContent = languages.size;

  // 总星标数
  const stars = state.projects.reduce((sum, p) => sum + (p.stars || 0), 0);
  totalStars.textContent = formatStars(stars);

  // 添加数字动画效果
  animateNumber(projectCount, state.projects.length);
  animateNumber(languageCount, languages.size);
}

/**
 * 数字动画效果
 * @param {HTMLElement} element - 目标元素
 * @param {number} target - 目标数值
 */
function animateNumber(element, target) {
  const duration = 1000;
  const startTime = performance.now();
  const startValue = 0;

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // 缓动函数
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const currentValue = Math.round(startValue + (target - startValue) * easeOut);

    element.textContent = currentValue;

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

/**
 * 初始化搜索栏
 */
function initSearchBar() {
  const container = document.getElementById('searchContainer');
  const searchBar = createSearchBar({
    placeholder: '搜索项目名称、描述或标签... (按 / 快速聚焦)',
    onSearch: (query) => {
      state.searchQuery = query;
      refreshProjects();
    }
  });
  container.appendChild(searchBar);
}

/**
 * 初始化筛选面板
 */
function initFilterPanel() {
  const container = document.getElementById('filterContainer');
  const filterPanel = createFilterPanel({
    categories: state.categories,
    onFilterChange: (filters) => {
      state.filters = filters;
      refreshProjects();
    }
  });
  container.appendChild(filterPanel);
}

/**
 * 刷新项目列表
 */
function refreshProjects() {
  const grid = document.getElementById('projectsGrid');
  const favorites = getFavorites();

  // 先应用搜索
  let projects = searchProjects(state.projects, state.searchQuery);

  // 再应用筛选和排序
  projects = applyFilters(projects, state.filters, favorites);

  state.filteredProjects = projects;

  // 渲染卡片
  renderProjectCards(grid, projects);
}

/**
 * 显示 Toast 通知
 * @param {string} message - 消息内容
 * @param {string} type - 类型 (success/error/info)
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  // 3秒后移除
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// 监听收藏变化
document.addEventListener('favoriteChanged', (e) => {
  const { projectId, isFavorite } = e.detail;
  showToast(
    isFavorite ? '已添加到收藏' : '已从收藏移除',
    isFavorite ? 'success' : 'info'
  );

  // 如果当前处于"仅显示收藏"模式，刷新项目列表以反映收藏变化
  if (state.filters.showFavorites) {
    refreshProjects();
  }
});

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initApp);

// 导出供其他模块使用
export { showToast, refreshProjects };
