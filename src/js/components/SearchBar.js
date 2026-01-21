/**
 * 搜索栏组件
 * 提供实时搜索和搜索建议功能
 */

// 搜索图标
const SEARCH_ICON = `<svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;

// 清除图标
const CLEAR_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

/**
 * 创建搜索栏组件
 * @param {Object} options - 配置选项
 * @returns {HTMLElement} 搜索栏元素
 */
export function createSearchBar(options = {}) {
  const {
    placeholder = '搜索项目名称、描述或标签...',
    onSearch = () => { },
    debounceMs = 300
  } = options;

  const wrapper = document.createElement('div');
  wrapper.className = 'search-section';

  wrapper.innerHTML = `
    <div class="search-wrapper">
      ${SEARCH_ICON}
      <input 
        type="text" 
        class="search-input input" 
        placeholder="${placeholder}"
        aria-label="搜索项目"
      />
      <button class="search-clear-btn" style="display: none;" aria-label="清除搜索">
        ${CLEAR_ICON}
      </button>
    </div>
    <div class="search-suggestions" style="display: none;"></div>
  `;

  const input = wrapper.querySelector('.search-input');
  const clearBtn = wrapper.querySelector('.search-clear-btn');
  const suggestionsEl = wrapper.querySelector('.search-suggestions');

  // 添加清除按钮样式
  addClearButtonStyles(clearBtn);

  // 防抖搜索
  let debounceTimer = null;

  input.addEventListener('input', (e) => {
    const query = e.target.value.trim();

    // 显示/隐藏清除按钮
    clearBtn.style.display = query ? 'flex' : 'none';

    // 防抖处理
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      onSearch(query);
    }, debounceMs);
  });

  // 清除按钮
  clearBtn.addEventListener('click', () => {
    input.value = '';
    clearBtn.style.display = 'none';
    onSearch('');
    input.focus();
  });

  // 键盘快捷键
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.value = '';
      clearBtn.style.display = 'none';
      onSearch('');
      input.blur();
    }
  });

  // 添加全局快捷键 / 聚焦搜索框
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== input) {
      e.preventDefault();
      input.focus();
    }
  });

  return wrapper;
}

/**
 * 添加清除按钮样式
 * @param {HTMLElement} btn - 按钮元素
 */
function addClearButtonStyles(btn) {
  Object.assign(btn.style, {
    position: 'absolute',
    right: '16px',
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    padding: '0',
    background: 'var(--bg-tertiary)',
    border: 'none',
    borderRadius: 'var(--radius-full)',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)'
  });

  btn.addEventListener('mouseenter', () => {
    btn.style.color = 'var(--accent-pink)';
    btn.style.background = 'var(--bg-secondary)';
  });

  btn.addEventListener('mouseleave', () => {
    btn.style.color = 'var(--text-muted)';
    btn.style.background = 'var(--bg-tertiary)';
  });
}

/**
 * 高亮搜索匹配文本
 * @param {string} text - 原始文本
 * @param {string} query - 搜索词
 * @returns {string} 带高亮的 HTML
 */
export function highlightMatch(text, query) {
  if (!query || !text) return text;

  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
  return text.replace(regex, '<mark class="search-highlight">$1</mark>');
}

/**
 * 转义正则特殊字符
 * @param {string} str - 原始字符串
 * @returns {string} 转义后的字符串
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 搜索项目
 * @param {Object[]} projects - 项目列表
 * @param {string} query - 搜索词
 * @returns {Object[]} 匹配的项目列表
 */
export function searchProjects(projects, query) {
  if (!query) return projects;

  const lowerQuery = query.toLowerCase();

  return projects.filter(project => {
    // 搜索项目名称
    if (project.name.toLowerCase().includes(lowerQuery)) return true;

    // 搜索所有者
    if (project.owner.toLowerCase().includes(lowerQuery)) return true;

    // 搜索描述
    if (project.description && project.description.toLowerCase().includes(lowerQuery)) return true;

    // 搜索语言
    if (project.language && project.language.toLowerCase().includes(lowerQuery)) return true;

    // 搜索标签
    if (project.tags && project.tags.some(tag => tag.toLowerCase().includes(lowerQuery))) return true;

    return false;
  });
}
