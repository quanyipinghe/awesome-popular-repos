/**
 * 筛选面板组件
 * 提供语言、分类和排序筛选功能
 */

// 预定义的语言列表
const LANGUAGES = [
  'JavaScript', 'TypeScript', 'Python', 'Go', 'Rust',
  'Java', 'C++', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Vue'
];

// 排序选项
const SORT_OPTIONS = [
  { value: 'stars-desc', label: '星标最多' },
  { value: 'stars-asc', label: '星标最少' },
  { value: 'name-asc', label: '名称 A-Z' },
  { value: 'name-desc', label: '名称 Z-A' },
  { value: 'updated-desc', label: '最近更新' },
  { value: 'updated-asc', label: '最早更新' }
];

/**
 * 创建筛选面板
 * @param {Object} options - 配置选项
 * @returns {HTMLElement} 筛选面板元素
 */
export function createFilterPanel(options = {}) {
  const {
    categories = [],
    onFilterChange = () => { },
    initialFilters = {}
  } = options;

  const panel = document.createElement('div');
  panel.className = 'filter-section';

  // 当前筛选状态
  const state = {
    language: initialFilters.language || 'all',
    category: initialFilters.category || 'all',
    sort: initialFilters.sort || 'stars-desc',
    showFavorites: initialFilters.showFavorites || false
  };

  panel.innerHTML = `
    <div class="filter-row filter-languages">
      <button class="filter-tag active" data-language="all">全部</button>
      ${LANGUAGES.map(lang =>
    `<button class="filter-tag" data-language="${lang}">${lang}</button>`
  ).join('')}
    </div>
    <div class="filter-row filter-actions" style="margin-top: var(--spacing-md);">
      <select class="filter-select input" aria-label="选择分类">
        <option value="all">全部分类</option>
        ${categories.map(cat =>
    `<option value="${cat.id}">${cat.name}</option>`
  ).join('')}
      </select>
      <select class="filter-sort input" aria-label="排序方式">
        ${SORT_OPTIONS.map(opt =>
    `<option value="${opt.value}" ${opt.value === state.sort ? 'selected' : ''}>${opt.label}</option>`
  ).join('')}
      </select>
      <button class="filter-tag filter-favorites" data-favorites="false">
        ❤️ 收藏
      </button>
    </div>
  `;

  // 添加额外样式
  addFilterStyles(panel);

  // 绑定事件
  bindFilterEvents(panel, state, onFilterChange);

  return panel;
}

/**
 * 添加筛选面板样式
 * @param {HTMLElement} panel - 面板元素
 */
function addFilterStyles(panel) {
  const selects = panel.querySelectorAll('select');
  selects.forEach(select => {
    Object.assign(select.style, {
      width: 'auto',
      minWidth: '140px',
      padding: 'var(--spacing-sm) var(--spacing-md)',
      fontSize: 'var(--font-size-sm)',
      cursor: 'pointer'
    });
  });

  const actionsRow = panel.querySelector('.filter-actions');
  if (actionsRow) {
    actionsRow.style.gap = 'var(--spacing-md)';
  }
}

/**
 * 绑定筛选事件
 * @param {HTMLElement} panel - 面板元素
 * @param {Object} state - 筛选状态
 * @param {Function} onFilterChange - 回调函数
 */
function bindFilterEvents(panel, state, onFilterChange) {
  // 语言筛选
  const languageTags = panel.querySelectorAll('[data-language]');
  languageTags.forEach(tag => {
    tag.addEventListener('click', () => {
      // 移除其他 active
      languageTags.forEach(t => t.classList.remove('active'));
      tag.classList.add('active');

      state.language = tag.dataset.language;
      onFilterChange({ ...state });
    });
  });

  // 分类筛选
  const categorySelect = panel.querySelector('.filter-select');
  categorySelect.addEventListener('change', (e) => {
    state.category = e.target.value;
    onFilterChange({ ...state });
  });

  // 排序
  const sortSelect = panel.querySelector('.filter-sort');
  sortSelect.addEventListener('change', (e) => {
    state.sort = e.target.value;
    onFilterChange({ ...state });
  });

  // 收藏筛选
  const favoritesBtn = panel.querySelector('.filter-favorites');
  favoritesBtn.addEventListener('click', () => {
    state.showFavorites = !state.showFavorites;
    favoritesBtn.classList.toggle('active', state.showFavorites);
    favoritesBtn.dataset.favorites = state.showFavorites;
    onFilterChange({ ...state });
  });
}

/**
 * 应用筛选和排序
 * @param {Object[]} projects - 项目列表
 * @param {Object} filters - 筛选条件
 * @param {string[]} favorites - 收藏的项目 ID 列表
 * @returns {Object[]} 筛选后的项目列表
 */
export function applyFilters(projects, filters, favorites = []) {
  let result = [...projects];

  // 语言筛选
  if (filters.language && filters.language !== 'all') {
    result = result.filter(p => p.language === filters.language);
  }

  // 分类筛选
  if (filters.category && filters.category !== 'all') {
    result = result.filter(p => p.category === filters.category);
  }

  // 收藏筛选
  if (filters.showFavorites) {
    result = result.filter(p => favorites.includes(p.id));
  }

  // 排序
  if (filters.sort) {
    const [field, order] = filters.sort.split('-');
    result.sort((a, b) => {
      let valueA, valueB;

      switch (field) {
        case 'stars':
          valueA = a.stars;
          valueB = b.stars;
          break;
        case 'name':
          valueA = a.name.toLowerCase();
          valueB = b.name.toLowerCase();
          break;
        case 'updated':
          valueA = new Date(a.updated_at).getTime();
          valueB = new Date(b.updated_at).getTime();
          break;
        default:
          return 0;
      }

      if (typeof valueA === 'string') {
        return order === 'asc'
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      }

      return order === 'asc' ? valueA - valueB : valueB - valueA;
    });
  }

  return result;
}

/**
 * 从项目列表中提取所有唯一语言
 * @param {Object[]} projects - 项目列表
 * @returns {string[]} 语言列表
 */
export function extractLanguages(projects) {
  const languages = new Set();
  projects.forEach(p => {
    if (p.language) languages.add(p.language);
  });
  return Array.from(languages).sort();
}
