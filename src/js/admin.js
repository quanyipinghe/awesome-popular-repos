/**
 * 后台管理系统入口
 * 处理登录、项目管理、批量导入等功能
 * 支持 Cloudflare D1 数据库存储
 */

import {
  initStorage,
  getProjects,
  setProjects,
  addProject,
  updateProject,
  deleteProject,
  getCategories,
  setCategories,
  getTags,
  exportAllData,
  importData,
  KEYS,
  get,
  set,
  getSettings,
  setSettings
} from './utils/storage.js';
import { getRepoInfoFromUrl, batchGetRepoInfo, formatStars } from './utils/github-api.js';

// 导入默认数据
import defaultData from './data/projects.json';

// API 基础路径
const API_BASE = '/api';

// 认证 Token 存储键
const AUTH_TOKEN_KEY = 'awesome_repos_auth_token';

// 项目分类多选状态
const projectCategoryMultiSelect = {
  initialized: false,
  categories: [],
  selectedIds: []
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
 * 获取项目的分类 ID 列表
 * @param {Object} project
 * @returns {string[]}
 */
function getProjectCategoryIds(project) {
  if (!project) return [];
  if (Array.isArray(project.categories)) {
    return normalizeCategoryIds(project.categories);
  }
  return normalizeCategoryIds(project.category);
}

/**
 * 规范化项目分类字段，统一供前端消费
 * @param {Object} project
 * @returns {Object}
 */
function normalizeProjectForClient(project) {
  const categories = getProjectCategoryIds(project);
  return {
    ...project,
    category: categories,
    categories
  };
}

// ===== API 辅助函数 =====

/**
 * 获取认证 Token
 */
function getAuthToken() {
  return sessionStorage.getItem(AUTH_TOKEN_KEY);
}

/**
 * 设置认证 Token
 */
function setAuthToken(token) {
  sessionStorage.setItem(AUTH_TOKEN_KEY, token);
}

/**
 * 清除认证 Token
 */
function clearAuthToken() {
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
}

/**
 * 发起 API 请求
 */
async function apiRequest(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Basic ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  return response.json();
}

/**
 * 从 API 获取项目列表
 */
async function fetchProjectsFromApi() {
  try {
    const result = await apiRequest('/projects');
    if (result.projects) {
      const normalizedProjects = result.projects.map(normalizeProjectForClient);
      // 更新本地缓存
      setProjects(normalizedProjects);
      return normalizedProjects;
    }
  } catch (error) {
    console.warn('[Admin] API 请求失败，使用本地数据:', error);
  }
  return getProjects().map(normalizeProjectForClient);
}

/**
 * 从 API 获取分类列表
 */
async function fetchCategoriesFromApi() {
  try {
    const result = await apiRequest('/categories');
    if (result.categories) {
      // 更新本地缓存
      setCategories(result.categories);
      return result.categories;
    }
  } catch (error) {
    console.warn('[Admin] API 请求失败，使用本地数据:', error);
  }
  return getCategories();
}

/**
 * 添加项目到 API
 */
async function addProjectToApi(projectData) {
  try {
    const result = await apiRequest('/projects', {
      method: 'POST',
      body: JSON.stringify(projectData),
    });
    if (result.success) {
      // 同步到本地
      addProject(normalizeProjectForClient(result.project || projectData));
      return result;
    }
    return result;
  } catch (error) {
    console.warn('[Admin] API 请求失败，使用本地存储:', error);
    addProject(normalizeProjectForClient(projectData));
    return { success: true, local: true };
  }
}

/**
 * 更新项目到 API
 */
async function updateProjectToApi(id, updates) {
  const normalizedUpdates = normalizeProjectForClient(updates);

  try {
    const result = await apiRequest('/projects', {
      method: 'PUT',
      body: JSON.stringify({ id, ...updates }),
    });
    if (result.success) {
      updateProject(id, normalizedUpdates);
      return result;
    }
    return result;
  } catch (error) {
    console.warn('[Admin] API 请求失败，使用本地存储:', error);
    updateProject(id, normalizedUpdates);
    return { success: true, local: true };
  }
}

/**
 * 从 API 删除项目
 */
async function deleteProjectFromApi(id) {
  try {
    const result = await apiRequest(`/projects?id=${id}`, {
      method: 'DELETE',
    });
    if (result.success) {
      deleteProject(id);
      return result;
    }
    return result;
  } catch (error) {
    console.warn('[Admin] API 请求失败，使用本地存储:', error);
    deleteProject(id);
    return { success: true, local: true };
  }
}

/**
 * 同步数据到 D1
 */
async function syncDataToD1() {
  try {
    const data = exportAllData();
    const result = await apiRequest('/sync', {
      method: 'POST',
      body: JSON.stringify({
        projects: data.projects,
        categories: data.categories,
      }),
    });
    return result;
  } catch (error) {
    console.error('[Admin] 同步数据失败:', error);
    return { success: false, error: error.message };
  }
}

// ===== 登录相关 =====

/**
 * 检查是否已登录
 */
function checkAuth() {
  const token = getAuthToken();
  return !!token;
}

/**
 * 显示登录页面
 */
function showLoginPage() {
  document.getElementById('loginPage').style.display = 'flex';
  document.getElementById('adminPage').style.display = 'none';
}

/**
 * 显示管理页面
 */
function showAdminPage() {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('adminPage').style.display = 'flex';
  initAdminPage();
}

/**
 * 处理登录
 */
async function handleLogin(e) {
  e.preventDefault();

  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const loginBtn = e.target.querySelector('button[type="submit"]');
  const errorEl = document.getElementById('loginError');

  // 禁用按钮，显示加载状态
  loginBtn.disabled = true;
  loginBtn.textContent = '登录中...';

  try {
    // 调用认证 API
    const result = await apiRequest('/auth', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    if (result.success && result.token) {
      setAuthToken(result.token);
      showAdminPage();
    } else {
      errorEl.classList.add('show');
      setTimeout(() => {
        errorEl.classList.remove('show');
      }, 3000);
    }
  } catch (error) {
    console.error('[Admin] 登录请求失败:', error);
    // 如果 API 不可用（本地开发），尝试本地验证
    const localCredentials = btoa(`${username}:${password}`);
    // 默认本地密码验证（仅开发用）
    if (username === 'admin' && password === 'admin123') {
      setAuthToken(localCredentials);
      showAdminPage();
    } else {
      errorEl.classList.add('show');
      setTimeout(() => {
        errorEl.classList.remove('show');
      }, 3000);
    }
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = '登录';
  }
}

// ===== 管理页面初始化 =====

/**
 * 初始化管理页面
 */
async function initAdminPage() {
  // 初始化存储
  await initStorage(defaultData);

  // 加载统计数据
  await loadDashboardStats();

  // 加载最近项目
  await loadRecentProjects();

  // 加载项目表格
  await loadProjectsTable();

  // 加载分类表格
  await loadCategoriesTable();

  // 绑定事件
  bindNavigationEvents();
  bindProjectEvents();
  bindImportEvents();
  bindSettingsEvents();
  bindCategoryEvents();
}

/**
 * 加载仪表盘统计数据
 */
async function loadDashboardStats() {
  const projects = await fetchProjectsFromApi();
  const categories = await fetchCategoriesFromApi();

  // 项目总数
  document.getElementById('statProjects').textContent = projects.length;

  // 总星标数
  const totalStars = projects.reduce((sum, p) => sum + (p.stars || 0), 0);
  document.getElementById('statStars').textContent = formatStars(totalStars);

  // 语言数量
  const languages = new Set(projects.map(p => p.language).filter(Boolean));
  document.getElementById('statLanguages').textContent = languages.size;

  // 分类数量
  document.getElementById('statCategories').textContent = categories.length;
}

/**
 * 加载最近项目
 */
async function loadRecentProjects() {
  const projects = (await fetchProjectsFromApi())
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, 5);

  const tbody = document.getElementById('recentProjectsTable');
  tbody.innerHTML = projects.map(p => `
    <tr>
      <td><strong>${escapeHtml(p.name)}</strong></td>
      <td>${escapeHtml(p.owner)}</td>
      <td>${escapeHtml(p.language || '-')}</td>
      <td>⭐ ${formatStars(p.stars || 0)}</td>
      <td>${p.updated_at || '-'}</td>
    </tr>
  `).join('');
}

/**
 * 加载项目表格
 */
async function loadProjectsTable() {
  const projects = await fetchProjectsFromApi();
  const categories = await fetchCategoriesFromApi();
  const categoryMap = new Map(categories.map(c => [c.id, c.name]));

  const tbody = document.getElementById('projectsTable');
  tbody.innerHTML = projects.map(p => {
    const categoryIds = getProjectCategoryIds(p);
    const categoryNames = categoryIds.map(id => categoryMap.get(id) || id);
    const categoryHtml = categoryNames.length > 0
      ? `<div class="table-category-tags">${categoryNames.map(name => `
          <span class="table-category-tag">${escapeHtml(name)}</span>
        `).join('')}</div>`
      : '-';

    return `
      <tr data-id="${p.id}">
        <td><strong>${escapeHtml(p.name)}</strong></td>
        <td>${escapeHtml(p.owner)}</td>
        <td>${escapeHtml(p.language || '-')}</td>
        <td>${categoryHtml}</td>
        <td>⭐ ${formatStars(p.stars || 0)}</td>
        <td>
          <div class="table-actions">
            <button class="action-btn edit" title="编辑" data-action="edit">✏️</button>
            <button class="action-btn delete" title="删除" data-action="delete">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // 绑定行操作事件
  tbody.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', handleProjectAction);
  });
}

/**
 * 加载分类表格
 */
async function loadCategoriesTable() {
  const categories = await fetchCategoriesFromApi();
  const projects = await fetchProjectsFromApi();

  const tbody = document.getElementById('categoriesTable');
  tbody.innerHTML = categories.map(c => {
    const count = projects.filter(p => getProjectCategoryIds(p).includes(c.id)).length;
    return `
      <tr data-id="${c.id}">
        <td><strong>${escapeHtml(c.name)}</strong></td>
        <td><code>${escapeHtml(c.slug || c.id)}</code></td>
        <td>${escapeHtml(c.description || '-')}</td>
        <td>${count}</td>
        <td>
          <div class="table-actions">
            <button class="action-btn edit" title="编辑" data-action="editCategory">✏️</button>
            <button class="action-btn delete" title="删除" data-action="deleteCategory">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // 绑定分类行操作事件
  tbody.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', handleCategoryAction);
  });
}

// ===== 分类管理 =====

/**
 * 绑定分类管理事件
 */
function bindCategoryEvents() {
  const modal = document.getElementById('categoryModal');
  const addBtn = document.getElementById('addCategoryBtn');
  const closeBtn = document.getElementById('categoryModalClose');
  const cancelBtn = document.getElementById('categoryModalCancel');
  const saveBtn = document.getElementById('categoryModalSave');

  // 打开添加模态框
  addBtn.addEventListener('click', () => {
    resetCategoryForm();
    document.getElementById('categoryModalTitle').textContent = '添加分类';
    modal.classList.add('active');
  });

  // 关闭模态框
  closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  cancelBtn.addEventListener('click', () => modal.classList.remove('active'));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
  });

  // 自动生成 slug
  document.getElementById('categoryName').addEventListener('input', (e) => {
    const editId = document.getElementById('editCategoryId').value;
    // 只在新增时自动生成 slug
    if (!editId) {
      const slug = generateSlug(e.target.value);
      document.getElementById('categorySlug').value = slug;
    }
  });

  // 保存分类
  saveBtn.addEventListener('click', async () => {
    const editId = document.getElementById('editCategoryId').value;
    const categoryData = {
      name: document.getElementById('categoryName').value.trim(),
      slug: document.getElementById('categorySlug').value.trim().toLowerCase(),
      description: document.getElementById('categoryDescription').value.trim()
    };

    if (!categoryData.name || !categoryData.slug) {
      return showToast('分类名称和 Slug 为必填项', 'error');
    }

    // 验证 slug 格式
    if (!/^[a-z0-9-]+$/.test(categoryData.slug)) {
      return showToast('Slug 只能包含小写字母、数字和连字符', 'error');
    }

    // 检查分类是否已存在（仅在新增时检查）
    if (!editId) {
      const existingCategories = await fetchCategoriesFromApi();
      const isDuplicate = existingCategories.some(c =>
        c.slug === categoryData.slug || c.id === categoryData.slug
      );
      if (isDuplicate) {
        return showToast(`分类 Slug "${categoryData.slug}" 已存在`, 'error');
      }
    }

    saveBtn.disabled = true;
    saveBtn.textContent = '保存中...';

    try {
      if (editId) {
        await updateCategoryToApi(editId, categoryData);
        showToast('分类已更新', 'success');
      } else {
        // 新增分类时使用 slug 作为 id
        categoryData.id = categoryData.slug;
        await addCategoryToApi(categoryData);
        showToast('分类已添加', 'success');
      }

      modal.classList.remove('active');
      await loadCategoriesTable();
      await loadCategoryOptions();
      await loadDashboardStats();
    } catch (error) {
      showToast('保存失败: ' + error.message, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '保存';
    }
  });
}

/**
 * 处理分类表格操作
 */
async function handleCategoryAction(e) {
  const action = e.target.closest('[data-action]').dataset.action;
  const row = e.target.closest('tr');
  const categoryId = row.dataset.id;

  if (action === 'editCategory') {
    editCategory(categoryId);
  } else if (action === 'deleteCategory') {
    // 检查分类下是否有项目
    const projects = await fetchProjectsFromApi();
    const projectsInCategory = projects.filter(p => getProjectCategoryIds(p).includes(categoryId));

    if (projectsInCategory.length > 0) {
      return showToast(`该分类下有 ${projectsInCategory.length} 个项目，无法删除`, 'error');
    }

    const confirmed = await showConfirm({
      title: '删除分类',
      message: '确定要删除这个分类吗？此操作不可撤销。',
      icon: '🗑️',
      confirmText: '删除',
      cancelText: '取消'
    });

    if (confirmed) {
      await deleteCategoryFromApi(categoryId);
      showToast('分类已删除', 'success');
      await loadCategoriesTable();
      await loadCategoryOptions();
      await loadDashboardStats();
    }
  }
}

/**
 * 编辑分类
 */
async function editCategory(categoryId) {
  const categories = await fetchCategoriesFromApi();
  const category = categories.find(c => c.id === categoryId);
  if (!category) return;

  document.getElementById('editCategoryId').value = categoryId;
  document.getElementById('categoryName').value = category.name || '';
  document.getElementById('categorySlug').value = category.slug || category.id;
  document.getElementById('categoryDescription').value = category.description || '';

  document.getElementById('categoryModalTitle').textContent = '编辑分类';
  document.getElementById('categoryModal').classList.add('active');
}

/**
 * 重置分类表单
 */
function resetCategoryForm() {
  document.getElementById('editCategoryId').value = '';
  document.getElementById('categoryName').value = '';
  document.getElementById('categorySlug').value = '';
  document.getElementById('categoryDescription').value = '';
}

/**
 * 生成 URL 友好的 slug
 */
function generateSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')  // 移除特殊字符
    .replace(/\s+/g, '-')       // 空格替换为连字符
    .replace(/-+/g, '-')        // 多个连字符合并为一个
    .trim();
}

/**
 * 添加分类到 API
 */
async function addCategoryToApi(categoryData) {
  try {
    const result = await apiRequest('/categories', {
      method: 'POST',
      body: JSON.stringify(categoryData),
    });
    if (result.success) {
      // 同步到本地
      const categories = getCategories();
      categories.push(result.category || categoryData);
      setCategories(categories);
      return result;
    }
    return result;
  } catch (error) {
    console.warn('[Admin] API 请求失败，使用本地存储:', error);
    const categories = getCategories();
    categories.push(categoryData);
    setCategories(categories);
    return { success: true, local: true };
  }
}

/**
 * 更新分类到 API
 */
async function updateCategoryToApi(id, updates) {
  try {
    const result = await apiRequest('/categories', {
      method: 'PUT',
      body: JSON.stringify({ id, ...updates }),
    });
    if (result.success) {
      // 同步到本地
      const categories = getCategories();
      const index = categories.findIndex(c => c.id === id);
      if (index !== -1) {
        categories[index] = { ...categories[index], ...updates };
        setCategories(categories);
      }
      return result;
    }
    return result;
  } catch (error) {
    console.warn('[Admin] API 请求失败，使用本地存储:', error);
    const categories = getCategories();
    const index = categories.findIndex(c => c.id === id);
    if (index !== -1) {
      categories[index] = { ...categories[index], ...updates };
      setCategories(categories);
    }
    return { success: true, local: true };
  }
}

/**
 * 从 API 删除分类
 */
async function deleteCategoryFromApi(id) {
  try {
    const result = await apiRequest(`/categories?id=${id}`, {
      method: 'DELETE',
    });
    if (result.success) {
      // 同步到本地
      const categories = getCategories();
      const index = categories.findIndex(c => c.id === id);
      if (index !== -1) {
        categories.splice(index, 1);
        setCategories(categories);
      }
      return result;
    }
    return result;
  } catch (error) {
    console.warn('[Admin] API 请求失败，使用本地存储:', error);
    const categories = getCategories();
    const index = categories.findIndex(c => c.id === id);
    if (index !== -1) {
      categories.splice(index, 1);
      setCategories(categories);
    }
    return { success: true, local: true };
  }
}

// ===== 导航 =====

/**
 * 绑定导航事件
 */
function bindNavigationEvents() {
  const navItems = document.querySelectorAll('.nav-item');
  const pages = document.querySelectorAll('.page-content');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const pageName = item.dataset.page;

      // 更新导航状态
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');

      // 切换页面
      pages.forEach(p => p.style.display = 'none');
      const targetPage = document.getElementById(`page${capitalize(pageName)}`);
      if (targetPage) {
        targetPage.style.display = 'block';
      }
    });
  });
}

// ===== 项目管理 =====

/**
 * 绑定项目管理事件
 */
function bindProjectEvents() {
  const modal = document.getElementById('projectModal');
  const addBtn = document.getElementById('addProjectBtn');
  const closeBtn = document.getElementById('modalClose');
  const cancelBtn = document.getElementById('modalCancel');
  const saveBtn = document.getElementById('modalSave');
  const fetchBtn = document.getElementById('fetchInfoBtn');

  // 初始化分类多选并加载选项
  initProjectCategoryMultiSelect();
  loadCategoryOptions();

  // 打开添加模态框
  addBtn.addEventListener('click', () => {
    resetProjectForm();
    document.getElementById('modalTitle').textContent = '添加项目';
    modal.classList.add('active');
  });

  // 关闭模态框
  closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  cancelBtn.addEventListener('click', () => modal.classList.remove('active'));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
  });

  // 获取 GitHub 信息
  fetchBtn.addEventListener('click', async () => {
    const url = document.getElementById('projectUrl').value;
    if (!url) return showToast('请输入 GitHub URL', 'error');

    fetchBtn.disabled = true;
    fetchBtn.textContent = '获取中...';

    try {
      const info = await getRepoInfoFromUrl(url);
      document.getElementById('projectName').value = info.name;
      document.getElementById('projectOwner').value = info.owner;
      document.getElementById('projectDescription').value = info.description || '';
      document.getElementById('projectLanguage').value = info.language || '';
      document.getElementById('projectStars').value = info.stars;
      document.getElementById('projectTags').value = (info.topics || []).join(', ');
      showToast('获取成功', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      fetchBtn.disabled = false;
      fetchBtn.textContent = '获取信息';
    }
  });

  // 保存项目
  saveBtn.addEventListener('click', async () => {
    const editId = document.getElementById('editProjectId').value;
    const projectData = {
      name: document.getElementById('projectName').value,
      owner: document.getElementById('projectOwner').value,
      description: document.getElementById('projectDescription').value,
      github_url: document.getElementById('projectUrl').value ||
        `https://github.com/${document.getElementById('projectOwner').value}/${document.getElementById('projectName').value}`,
      language: document.getElementById('projectLanguage').value,
      stars: parseInt(document.getElementById('projectStars').value) || 0,
      category: getSelectedProjectCategoryIds(),
      tags: document.getElementById('projectTags').value.split(',').map(t => t.trim()).filter(Boolean)
    };

    if (!projectData.name || !projectData.owner) {
      return showToast('项目名称和所有者为必填项', 'error');
    }

    // 检查项目是否已存在（仅在新增时检查）
    if (!editId) {
      const existingProjects = await fetchProjectsFromApi();
      const isDuplicate = existingProjects.some(p =>
        p.owner.toLowerCase() === projectData.owner.toLowerCase() &&
        p.name.toLowerCase() === projectData.name.toLowerCase()
      );
      if (isDuplicate) {
        return showToast(`项目 ${projectData.owner}/${projectData.name} 已存在，请勿重复添加`, 'error');
      }
    }

    saveBtn.disabled = true;
    saveBtn.textContent = '保存中...';

    try {
      if (editId) {
        await updateProjectToApi(editId, projectData);
        showToast('项目已更新', 'success');
      } else {
        await addProjectToApi(projectData);
        showToast('项目已添加', 'success');
      }

      modal.classList.remove('active');
      await loadProjectsTable();
      await loadDashboardStats();
      await loadRecentProjects();
    } catch (error) {
      showToast('保存失败: ' + error.message, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '保存';
    }
  });
}

/**
 * 处理项目表格操作
 */
async function handleProjectAction(e) {
  const action = e.target.closest('[data-action]').dataset.action;
  const row = e.target.closest('tr');
  const projectId = row.dataset.id;

  if (action === 'edit') {
    editProject(projectId);
  } else if (action === 'delete') {
    const confirmed = await showConfirm({
      title: '删除项目',
      message: '确定要删除这个项目吗？此操作不可撤销。',
      icon: '🗑️',
      confirmText: '删除',
      cancelText: '取消'
    });

    if (confirmed) {
      await deleteProjectFromApi(projectId);
      showToast('项目已删除', 'success');
      await loadProjectsTable();
      await loadDashboardStats();
    }
  }
}

/**
 * 编辑项目
 */
async function editProject(projectId) {
  const projects = await fetchProjectsFromApi();
  const project = projects.find(p => p.id === projectId);
  if (!project) return;
  await loadCategoryOptions();

  document.getElementById('editProjectId').value = projectId;
  document.getElementById('projectUrl').value = project.github_url || '';
  document.getElementById('projectName').value = project.name;
  document.getElementById('projectOwner').value = project.owner;
  document.getElementById('projectDescription').value = project.description || '';
  document.getElementById('projectLanguage').value = project.language || '';
  document.getElementById('projectStars').value = project.stars || 0;
  setProjectCategorySelection(getProjectCategoryIds(project));
  document.getElementById('projectTags').value = (project.tags || []).join(', ');

  document.getElementById('modalTitle').textContent = '编辑项目';
  document.getElementById('projectModal').classList.add('active');
}

/**
 * 重置项目表单
 */
function resetProjectForm() {
  document.getElementById('editProjectId').value = '';
  document.getElementById('projectUrl').value = '';
  document.getElementById('projectName').value = '';
  document.getElementById('projectOwner').value = '';
  document.getElementById('projectDescription').value = '';
  document.getElementById('projectLanguage').value = '';
  document.getElementById('projectStars').value = '';
  setProjectCategorySelection([]);
  document.getElementById('projectTags').value = '';
}

/**
 * 初始化项目分类多选组件
 */
function initProjectCategoryMultiSelect() {
  if (projectCategoryMultiSelect.initialized) return;

  const container = document.getElementById('projectCategorySelect');
  const trigger = document.getElementById('projectCategoryTrigger');
  const menu = document.getElementById('projectCategoryMenu');
  const chips = document.getElementById('projectCategoryChips');

  if (!container || !trigger || !menu || !chips) return;

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    container.classList.toggle('active');
  });

  menu.addEventListener('click', (e) => {
    e.stopPropagation();
    const option = e.target.closest('[data-category-id]');
    if (!option) return;

    const categoryId = option.dataset.categoryId;
    const selected = new Set(projectCategoryMultiSelect.selectedIds);
    if (selected.has(categoryId)) {
      selected.delete(categoryId);
    } else {
      selected.add(categoryId);
    }
    setProjectCategorySelection([...selected]);
  });

  chips.addEventListener('click', (e) => {
    e.stopPropagation();
    const removeBtn = e.target.closest('[data-remove-id]');
    if (!removeBtn) return;

    const removeId = removeBtn.dataset.removeId;
    setProjectCategorySelection(
      projectCategoryMultiSelect.selectedIds.filter(id => id !== removeId)
    );
  });

  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      container.classList.remove('active');
    }
  });

  projectCategoryMultiSelect.initialized = true;
  renderProjectCategoryMultiSelect();
}

/**
 * 获取当前选中的项目分类 ID 列表
 * @returns {string[]}
 */
function getSelectedProjectCategoryIds() {
  return [...projectCategoryMultiSelect.selectedIds];
}

/**
 * 设置项目分类选中项
 * @param {string[]|string} categoryIds
 */
function setProjectCategorySelection(categoryIds) {
  const validCategoryIds = new Set(projectCategoryMultiSelect.categories.map(c => c.id));
  projectCategoryMultiSelect.selectedIds = normalizeCategoryIds(categoryIds)
    .filter(id => validCategoryIds.has(id));
  renderProjectCategoryMultiSelect();
}

/**
 * 渲染项目分类多选组件
 */
function renderProjectCategoryMultiSelect() {
  const menu = document.getElementById('projectCategoryMenu');
  const chips = document.getElementById('projectCategoryChips');
  const value = document.getElementById('projectCategoryValue');

  if (!menu || !chips || !value) return;

  const categoryMap = new Map(projectCategoryMultiSelect.categories.map(c => [c.id, c.name]));
  const selected = new Set(projectCategoryMultiSelect.selectedIds);

  menu.innerHTML = projectCategoryMultiSelect.categories.map(category => `
    <button
      type="button"
      class="custom-dropdown-item ${selected.has(category.id) ? 'selected' : ''}"
      data-category-id="${escapeHtml(category.id)}"
    >
      <span class="category-option">
        <span class="category-dot" data-category="${escapeHtml(category.id)}"></span>
        <span class="custom-dropdown-item-text">${escapeHtml(category.name)}</span>
      </span>
      <span class="custom-dropdown-item-check">✓</span>
    </button>
  `).join('');

  if (projectCategoryMultiSelect.selectedIds.length === 0) {
    value.textContent = '选择分类（可多选）';
    chips.innerHTML = '<span class="project-category-empty">未选择分类</span>';
    return;
  }

  if (projectCategoryMultiSelect.selectedIds.length === 1) {
    value.textContent = categoryMap.get(projectCategoryMultiSelect.selectedIds[0]) || '已选 1 个分类';
  } else {
    value.textContent = `已选 ${projectCategoryMultiSelect.selectedIds.length} 个分类`;
  }

  chips.innerHTML = projectCategoryMultiSelect.selectedIds.map(id => `
    <span class="project-category-chip">
      ${escapeHtml(categoryMap.get(id) || id)}
      <button type="button" class="project-category-chip-remove" data-remove-id="${escapeHtml(id)}" aria-label="移除分类">×</button>
    </span>
  `).join('');
}

/**
 * 加载分类选项（项目弹框）
 */
async function loadCategoryOptions() {
  const categories = await fetchCategoriesFromApi();
  projectCategoryMultiSelect.categories = categories;
  setProjectCategorySelection(projectCategoryMultiSelect.selectedIds);
}

// ===== 批量导入 =====

/**
 * 绑定导入事件
 */
function bindImportEvents() {
  const startBtn = document.getElementById('startImportBtn');
  const progressEl = document.getElementById('importProgress');

  startBtn.addEventListener('click', async () => {
    const textarea = document.getElementById('importUrls');
    const urls = textarea.value.split('\n').map(u => u.trim()).filter(Boolean);

    if (urls.length === 0) {
      return showToast('请输入至少一个 GitHub URL', 'error');
    }

    startBtn.disabled = true;
    startBtn.textContent = '导入中...';
    progressEl.style.display = 'block';
    progressEl.innerHTML = '';

    // 获取现有项目列表用于重复检查
    const existingProjects = await fetchProjectsFromApi();

    const { results, successCount } = await batchGetRepoInfo(urls, (current, total, result) => {
      const item = document.createElement('div');
      item.className = `import-item ${result.success ? 'success' : 'error'}`;
      item.textContent = result.success
        ? `✓ ${result.data.name} (${result.data.owner})`
        : `✗ ${result.url}: ${result.error}`;
      progressEl.appendChild(item);
      progressEl.scrollTop = progressEl.scrollHeight;
    });

    // 添加成功的项目（跳过已存在的）
    let addedCount = 0;
    let skippedCount = 0;
    for (const r of results.filter(r => r.success)) {
      // 检查是否已存在
      const isDuplicate = existingProjects.some(p =>
        p.owner.toLowerCase() === r.data.owner.toLowerCase() &&
        p.name.toLowerCase() === r.data.name.toLowerCase()
      );

      if (isDuplicate) {
        skippedCount++;
        const skipItem = document.createElement('div');
        skipItem.className = 'import-item warning';
        skipItem.textContent = `⚠ ${r.data.owner}/${r.data.name} 已存在，跳过`;
        progressEl.appendChild(skipItem);
        progressEl.scrollTop = progressEl.scrollHeight;
        continue;
      }

      await addProjectToApi({
        ...r.data,
        github_url: r.url,
        tags: r.data.topics || []
      });
      addedCount++;
    }

    await loadProjectsTable();
    await loadDashboardStats();

    const failedCount = results.length - successCount;
    let message = `导入完成：成功 ${addedCount}`;
    if (skippedCount > 0) message += `，跳过 ${skippedCount} 个重复`;
    if (failedCount > 0) message += `，失败 ${failedCount}`;

    showToast(message, addedCount > 0 ? 'success' : (skippedCount > 0 ? 'info' : 'error'));

    startBtn.disabled = false;
    startBtn.textContent = '开始导入';
    textarea.value = '';
  });
}

// ===== 设置 =====

/**
 * 绑定设置事件
 */
function bindSettingsEvents() {
  // 导出数据
  document.getElementById('exportDataBtn').addEventListener('click', () => {
    const data = exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `awesome-repos-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('数据已导出', 'success');
  });

  // 导入数据
  const importFileInput = document.getElementById('importDataFile');
  document.getElementById('importDataBtn').addEventListener('click', () => {
    importFileInput.click();
  });

  importFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        const confirmed = await showConfirm({
          title: '导入数据',
          message: '确定要导入数据吗？这将覆盖现有数据。',
          icon: '📥',
          confirmText: '导入',
          cancelText: '取消'
        });

        if (confirmed) {
          importData(data);

          // 同步到 D1
          showToast('正在同步到云端...', 'info');
          const syncResult = await syncDataToD1();

          await loadProjectsTable();
          await loadCategoriesTable();
          await loadDashboardStats();

          if (syncResult.success) {
            showToast('数据已导入并同步到云端', 'success');
          } else {
            showToast('数据已导入（本地），云端同步失败', 'warning');
          }
        }
      } catch (error) {
        showToast('文件格式错误', 'error');
      }
    };
    reader.readAsText(file);
    importFileInput.value = '';
  });

  // 重置数据
  document.getElementById('resetDataBtn').addEventListener('click', async () => {
    const confirmed = await showConfirm({
      title: '重置数据',
      message: '确定要重置所有数据吗？此操作不可撤销！',
      icon: '⚠️',
      confirmText: '重置',
      cancelText: '取消'
    });

    if (confirmed) {
      setProjects(defaultData.projects);
      setCategories(defaultData.categories);

      // 同步到 D1
      await syncDataToD1();

      await loadProjectsTable();
      await loadCategoriesTable();
      await loadDashboardStats();
      await loadRecentProjects();
      showToast('数据已重置', 'success');
    }
  });

  // 同步到云端按钮（如果不存在则创建）
  const settingsPage = document.getElementById('pageSettings');
  const syncBtn = document.createElement('button');
  syncBtn.className = 'btn btn-primary';
  syncBtn.id = 'syncToCloudBtn';
  syncBtn.textContent = '☁️ 同步到云端';
  syncBtn.style.marginLeft = 'var(--spacing-md)';
  syncBtn.addEventListener('click', async () => {
    syncBtn.disabled = true;
    syncBtn.textContent = '同步中...';

    const result = await syncDataToD1();

    if (result.success) {
      showToast(`同步成功：${result.results?.projects || 0} 个项目，${result.results?.categories || 0} 个分类`, 'success');
    } else {
      showToast('同步失败: ' + (result.error || '未知错误'), 'error');
    }

    syncBtn.disabled = false;
    syncBtn.textContent = '☁️ 同步到云端';
  });

  // 添加到数据管理区域
  const dataManagementDiv = settingsPage.querySelector('div[style*="display: flex"]');
  if (dataManagementDiv && !document.getElementById('syncToCloudBtn')) {
    dataManagementDiv.appendChild(syncBtn);
  }
}

// ===== 工具函数 =====

/**
 * 显示 Toast 通知
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * 显示自定义确认弹框
 * @param {Object} options - 配置选项
 * @param {string} options.title - 标题
 * @param {string} options.message - 消息内容
 * @param {string} options.icon - 图标 (emoji)
 * @param {string} options.confirmText - 确认按钮文字
 * @param {string} options.cancelText - 取消按钮文字
 * @returns {Promise<boolean>} 用户是否确认
 */
function showConfirm(options = {}) {
  return new Promise((resolve) => {
    const {
      title = '确认操作',
      message = '确定要执行此操作吗？',
      icon = '⚠️',
      confirmText = '确认',
      cancelText = '取消'
    } = options;

    const modal = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmModalTitle');
    const messageEl = document.getElementById('confirmModalMessage');
    const iconEl = document.getElementById('confirmModalIcon');
    const confirmBtn = document.getElementById('confirmModalConfirm');
    const cancelBtn = document.getElementById('confirmModalCancel');
    const closeBtn = document.getElementById('confirmModalClose');

    // 设置内容
    titleEl.textContent = title;
    messageEl.textContent = message;
    iconEl.textContent = icon;
    confirmBtn.textContent = confirmText;
    cancelBtn.textContent = cancelText;

    // 重置图标动画
    iconEl.style.animation = 'none';
    iconEl.offsetHeight; // 触发 reflow
    iconEl.style.animation = 'shake 0.5s ease-in-out';

    // 清理之前的事件监听器
    const newConfirmBtn = confirmBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    const newCloseBtn = closeBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);

    // 关闭弹框的函数
    const closeModal = (result) => {
      modal.classList.remove('active');
      resolve(result);
    };

    // 绑定事件
    newConfirmBtn.addEventListener('click', () => closeModal(true));
    newCancelBtn.addEventListener('click', () => closeModal(false));
    newCloseBtn.addEventListener('click', () => closeModal(false));

    // 点击背景关闭
    const handleBackdropClick = (e) => {
      if (e.target === modal) {
        closeModal(false);
        modal.removeEventListener('click', handleBackdropClick);
      }
    };
    modal.addEventListener('click', handleBackdropClick);

    // ESC 键关闭
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        closeModal(false);
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);

    // 显示弹框
    modal.classList.add('active');
  });
}

/**
 * HTML 转义
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 首字母大写
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ===== 主题管理 =====

/**
 * 初始化主题
 */
function initTheme() {
  // 确保存储已初始化 (虽然 initAdminPage 会初始化，但 initTheme 可能在 checkAuth 之前调用)
  // 这里假设 getSettings 会处理未初始化的默认值
  const settings = getSettings();
  const savedTheme = settings.theme || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeButton(savedTheme);

  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) {
    // 移除旧的监听器以防重复绑定
    themeBtn.replaceWith(themeBtn.cloneNode(true));
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  }
}

/**
 * 切换主题
 */
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  document.documentElement.setAttribute('data-theme', newTheme);
  setSettings({ theme: newTheme });
  updateThemeButton(newTheme);
}

/**
 * 更新主题按钮文本/图标
 */
function updateThemeButton(theme) {
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) {
    themeBtn.textContent = theme === 'light' ? '🌙 切换深色' : '🌞 切换浅色';
  }
}

// ===== 初始化 =====

document.addEventListener('DOMContentLoaded', () => {
  // 初始化主题
  initTheme();

  // 绑定登录表单
  document.getElementById('loginForm').addEventListener('submit', handleLogin);

  // 检查登录状态
  if (checkAuth()) {
    showAdminPage();
  } else {
    showLoginPage();
  }
});
