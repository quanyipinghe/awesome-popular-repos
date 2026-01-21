/**
 * 后台管理系统入口
 * 处理登录、项目管理、批量导入等功能
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
  set
} from './utils/storage.js';
import { getRepoInfoFromUrl, batchGetRepoInfo, formatStars } from './utils/github-api.js';

// 导入默认数据
import defaultData from './data/projects.json';

// 默认管理密码
const DEFAULT_PASSWORD = 'admin123';
const PASSWORD_KEY = 'awesome_repos_admin_password';

// ===== 登录相关 =====

/**
 * 检查是否已登录
 */
function checkAuth() {
  const isLoggedIn = sessionStorage.getItem('admin_logged_in');
  return isLoggedIn === 'true';
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
function handleLogin(e) {
  e.preventDefault();
  const password = document.getElementById('password').value;
  const storedPassword = localStorage.getItem(PASSWORD_KEY) || DEFAULT_PASSWORD;

  if (password === storedPassword) {
    sessionStorage.setItem('admin_logged_in', 'true');
    showAdminPage();
  } else {
    document.getElementById('loginError').classList.add('show');
    setTimeout(() => {
      document.getElementById('loginError').classList.remove('show');
    }, 3000);
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
  loadDashboardStats();

  // 加载最近项目
  loadRecentProjects();

  // 加载项目表格
  loadProjectsTable();

  // 加载分类表格
  loadCategoriesTable();

  // 绑定事件
  bindNavigationEvents();
  bindProjectEvents();
  bindImportEvents();
  bindSettingsEvents();
}

/**
 * 加载仪表盘统计数据
 */
function loadDashboardStats() {
  const projects = getProjects();
  const categories = getCategories();

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
function loadRecentProjects() {
  const projects = getProjects()
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
function loadProjectsTable() {
  const projects = getProjects();
  const categories = getCategories();

  const tbody = document.getElementById('projectsTable');
  tbody.innerHTML = projects.map(p => {
    const category = categories.find(c => c.id === p.category);
    return `
      <tr data-id="${p.id}">
        <td><strong>${escapeHtml(p.name)}</strong></td>
        <td>${escapeHtml(p.owner)}</td>
        <td>${escapeHtml(p.language || '-')}</td>
        <td>${escapeHtml(category?.name || '-')}</td>
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
function loadCategoriesTable() {
  const categories = getCategories();
  const projects = getProjects();

  const tbody = document.getElementById('categoriesTable');
  tbody.innerHTML = categories.map(c => {
    const count = projects.filter(p => p.category === c.id).length;
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

  // 加载分类下拉选项
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
  saveBtn.addEventListener('click', () => {
    const editId = document.getElementById('editProjectId').value;
    const projectData = {
      name: document.getElementById('projectName').value,
      owner: document.getElementById('projectOwner').value,
      description: document.getElementById('projectDescription').value,
      github_url: document.getElementById('projectUrl').value ||
        `https://github.com/${document.getElementById('projectOwner').value}/${document.getElementById('projectName').value}`,
      language: document.getElementById('projectLanguage').value,
      stars: parseInt(document.getElementById('projectStars').value) || 0,
      category: document.getElementById('projectCategory').value,
      tags: document.getElementById('projectTags').value.split(',').map(t => t.trim()).filter(Boolean)
    };

    if (!projectData.name || !projectData.owner) {
      return showToast('项目名称和所有者为必填项', 'error');
    }

    if (editId) {
      updateProject(editId, projectData);
      showToast('项目已更新', 'success');
    } else {
      addProject(projectData);
      showToast('项目已添加', 'success');
    }

    modal.classList.remove('active');
    loadProjectsTable();
    loadDashboardStats();
    loadRecentProjects();
  });
}

/**
 * 处理项目表格操作
 */
function handleProjectAction(e) {
  const action = e.target.closest('[data-action]').dataset.action;
  const row = e.target.closest('tr');
  const projectId = row.dataset.id;

  if (action === 'edit') {
    editProject(projectId);
  } else if (action === 'delete') {
    if (confirm('确定要删除这个项目吗？')) {
      deleteProject(projectId);
      showToast('项目已删除', 'success');
      loadProjectsTable();
      loadDashboardStats();
    }
  }
}

/**
 * 编辑项目
 */
function editProject(projectId) {
  const projects = getProjects();
  const project = projects.find(p => p.id === projectId);
  if (!project) return;

  document.getElementById('editProjectId').value = projectId;
  document.getElementById('projectUrl').value = project.github_url || '';
  document.getElementById('projectName').value = project.name;
  document.getElementById('projectOwner').value = project.owner;
  document.getElementById('projectDescription').value = project.description || '';
  document.getElementById('projectLanguage').value = project.language || '';
  document.getElementById('projectStars').value = project.stars || 0;
  document.getElementById('projectCategory').value = project.category || '';
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
  document.getElementById('projectCategory').value = '';
  document.getElementById('projectTags').value = '';
}

/**
 * 加载分类下拉选项
 */
function loadCategoryOptions() {
  const categories = getCategories();
  const select = document.getElementById('projectCategory');
  select.innerHTML = `
    <option value="">选择分类</option>
    ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
  `;
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

    const { results, successCount } = await batchGetRepoInfo(urls, (current, total, result) => {
      const item = document.createElement('div');
      item.className = `import-item ${result.success ? 'success' : 'error'}`;
      item.textContent = result.success
        ? `✓ ${result.data.name} (${result.data.owner})`
        : `✗ ${result.url}: ${result.error}`;
      progressEl.appendChild(item);
      progressEl.scrollTop = progressEl.scrollHeight;
    });

    // 添加成功的项目
    results.filter(r => r.success).forEach(r => {
      addProject({
        ...r.data,
        github_url: r.url,
        tags: r.data.topics || []
      });
    });

    loadProjectsTable();
    loadDashboardStats();

    showToast(`导入完成：成功 ${successCount}，失败 ${results.length - successCount}`,
      successCount > 0 ? 'success' : 'error');

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
  // 修改密码
  document.getElementById('changePasswordBtn').addEventListener('click', () => {
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (!newPassword) {
      return showToast('请输入新密码', 'error');
    }
    if (newPassword !== confirmPassword) {
      return showToast('两次密码不一致', 'error');
    }

    localStorage.setItem(PASSWORD_KEY, newPassword);
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
    showToast('密码已修改', 'success');
  });

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

  importFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (confirm('确定要导入数据吗？这将覆盖现有数据。')) {
          importData(data);
          loadProjectsTable();
          loadCategoriesTable();
          loadDashboardStats();
          showToast('数据已导入', 'success');
        }
      } catch (error) {
        showToast('文件格式错误', 'error');
      }
    };
    reader.readAsText(file);
    importFileInput.value = '';
  });

  // 重置数据
  document.getElementById('resetDataBtn').addEventListener('click', () => {
    if (confirm('确定要重置所有数据吗？此操作不可撤销！')) {
      setProjects(defaultData.projects);
      setCategories(defaultData.categories);
      loadProjectsTable();
      loadCategoriesTable();
      loadDashboardStats();
      loadRecentProjects();
      showToast('数据已重置', 'success');
    }
  });
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

// ===== 初始化 =====

document.addEventListener('DOMContentLoaded', () => {
  // 绑定登录表单
  document.getElementById('loginForm').addEventListener('submit', handleLogin);

  // 检查登录状态
  if (checkAuth()) {
    showAdminPage();
  } else {
    showLoginPage();
  }
});
