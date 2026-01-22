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

// 图标
const ARROW_DOWN = `<svg class="select-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
const CHECK_ICON = `<svg class="option-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

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

  // 生成 HTML 结构
  panel.innerHTML = `
    <div class="filter-row filter-languages">
      <button class="filter-tag active" data-language="all">全部</button>
      ${LANGUAGES.map(lang =>
    `<button class="filter-tag" data-language="${lang}">${lang}</button>`
  ).join('')}
    </div>
    <div class="filter-row filter-actions">
      <!-- 自定义分类下拉 -->
      <div class="custom-select" id="categorySelect">
        <div class="select-trigger">
          <span class="select-value">全部分类</span>
          ${ARROW_DOWN}
        </div>
        <div class="select-options">
          <div class="option selected" data-value="all">
            <span>全部分类</span>
            ${CHECK_ICON}
          </div>
          ${categories.map(cat => `
            <div class="option" data-value="${cat.id}">
              <span>${escapeHtml(cat.name)}</span>
              ${CHECK_ICON}
            </div>
          `).join('')}
        </div>
      </div>

      <!-- 自定义排序下拉 -->
      <div class="custom-select" id="sortSelect">
        <div class="select-trigger">
          <span class="select-value">星标最多</span>
          ${ARROW_DOWN}
        </div>
        <div class="select-options">
          ${SORT_OPTIONS.map(opt => `
            <div class="option ${opt.value === state.sort ? 'selected' : ''}" data-value="${opt.value}">
              <span>${opt.label}</span>
              ${CHECK_ICON}
            </div>
          `).join('')}
        </div>
      </div>

      <button class="filter-tag filter-favorites" data-favorites="false">
        ❤️ 收藏
      </button>
    </div>
  `;

  // 绑定事件
  bindFilterEvents(panel, state, onFilterChange);

  // 全局点击关闭下拉菜单
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-select')) {
      panel.querySelectorAll('.custom-select').forEach(el => el.classList.remove('active'));
    }
  });

  return panel;
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

  // 设置自定义下拉菜单逻辑
  setupCustomSelect(panel.querySelector('#categorySelect'), (value) => {
    state.category = value;
    onFilterChange({ ...state });
  });

  setupCustomSelect(panel.querySelector('#sortSelect'), (value) => {
    state.sort = value;
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
 * 设置自定义下拉菜单逻辑
 * @param {HTMLElement} element - 下拉菜单容器元素
 * @param {Function} onChange - 变更回调
 */
function setupCustomSelect(element, onChange) {
  const trigger = element.querySelector('.select-trigger');
  const valueSpan = element.querySelector('.select-value');
  const optionsContainer = element.querySelector('.select-options');
  const options = element.querySelectorAll('.option');

  // 切换显示
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    // 关闭其他打开的下拉
    document.querySelectorAll('.custom-select.active').forEach(el => {
      if (el !== element) el.classList.remove('active');
    });
    element.classList.toggle('active');
  });

  // 选项点击
  options.forEach(option => {
    option.addEventListener('click', (e) => {
      e.stopPropagation();
      const value = option.dataset.value;
      const text = option.querySelector('span').textContent;

      // 更新选中状态
      options.forEach(opt => opt.classList.remove('selected'));
      option.classList.add('selected');

      // 更新显示值
      valueSpan.textContent = text;

      // 关闭下拉
      element.classList.remove('active');

      // 触发回调
      onChange(value);
    });
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
 * HTML 转义
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}