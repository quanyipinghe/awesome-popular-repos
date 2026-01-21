/**
 * 项目卡片组件
 * 展示单个 GitHub 项目信息
 */

import { formatStars } from '../utils/github-api.js';
import { isFavorite, toggleFavorite } from '../utils/storage.js';

// 星标 SVG 图标
const STAR_ICON = `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z"/></svg>`;

// 收藏心形图标
const HEART_ICON = `<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;

// 外部链接图标
const LINK_ICON = `<svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M3.75 2A1.75 1.75 0 002 3.75v8.5c0 .966.784 1.75 1.75 1.75h8.5A1.75 1.75 0 0014 12.25v-3.5a.75.75 0 00-1.5 0v3.5a.25.25 0 01-.25.25h-8.5a.25.25 0 01-.25-.25v-8.5a.25.25 0 01.25-.25h3.5a.75.75 0 000-1.5h-3.5z"/><path d="M10 1a.75.75 0 000 1.5h2.44L7.22 7.72a.75.75 0 001.06 1.06l5.22-5.22V6a.75.75 0 001.5 0V1.75a.75.75 0 00-.75-.75H10z"/></svg>`;

/**
 * 创建项目卡片 HTML
 * @param {Object} project - 项目数据
 * @param {number} index - 索引，用于动画延迟
 * @returns {HTMLElement} 卡片元素
 */
export function createProjectCard(project, index = 0) {
  const card = document.createElement('article');
  card.className = 'project-card';
  card.dataset.projectId = project.id;
  // 添加动画延迟
  card.style.animationDelay = `${index * 0.08}s`;

  const favorited = isFavorite(project.id);

  card.innerHTML = `
    <button class="favorite-btn ${favorited ? 'active' : ''}" 
            title="${favorited ? '取消收藏' : '添加收藏'}"
            aria-label="${favorited ? '取消收藏' : '添加收藏'}">
      ${HEART_ICON}
    </button>
    
    <div class="card-header">
      <div class="card-title-wrapper">
        <span class="card-owner">${escapeHtml(project.owner)}</span>
        <h3 class="card-title">${escapeHtml(project.name)}</h3>
      </div>
      <div class="card-stars">
        ${STAR_ICON}
        <span class="stars-count">${formatStars(project.stars)}</span>
      </div>
    </div>
    
    <p class="card-description">${escapeHtml(project.description || '暂无描述')}</p>
    
    <div class="card-footer">
      <div class="card-language">
        <span class="language-dot" data-lang="${escapeHtml(project.language)}"></span>
        <span>${escapeHtml(project.language)}</span>
      </div>
      <div class="card-tags">
        ${(project.tags || []).slice(0, 3).map(tag =>
    `<span class="card-tag">${escapeHtml(tag)}</span>`
  ).join('')}
      </div>
    </div>
  `;

  // 绑定事件
  bindCardEvents(card, project);

  return card;
}

/**
 * 绑定卡片事件
 * @param {HTMLElement} card - 卡片元素
 * @param {Object} project - 项目数据
 */
function bindCardEvents(card, project) {
  // 收藏按钮点击
  const favoriteBtn = card.querySelector('.favorite-btn');
  favoriteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isNowFavorite = toggleFavorite(project.id);
    favoriteBtn.classList.toggle('active', isNowFavorite);
    favoriteBtn.title = isNowFavorite ? '取消收藏' : '添加收藏';

    // 触发自定义事件
    card.dispatchEvent(new CustomEvent('favoriteChanged', {
      bubbles: true,
      detail: { projectId: project.id, isFavorite: isNowFavorite }
    }));
  });

  // 卡片点击打开 GitHub 链接
  card.addEventListener('click', (e) => {
    // 如果点击的不是收藏按钮，则打开链接
    if (!e.target.closest('.favorite-btn')) {
      window.open(project.github_url, '_blank', 'noopener,noreferrer');
    }
  });

  // 键盘无障碍支持
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'article');
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      window.open(project.github_url, '_blank', 'noopener,noreferrer');
    }
  });
}

/**
 * 创建骨架屏卡片
 * @param {number} count - 数量
 * @returns {HTMLElement[]} 骨架屏元素数组
 */
export function createSkeletonCards(count = 6) {
  const skeletons = [];
  for (let i = 0; i < count; i++) {
    const skeleton = document.createElement('div');
    skeleton.className = 'project-card skeleton-card';
    skeleton.innerHTML = `
      <div class="skeleton" style="height: 20px; width: 30%; margin-bottom: 8px;"></div>
      <div class="skeleton" style="height: 24px; width: 60%; margin-bottom: 16px;"></div>
      <div class="skeleton" style="height: 60px; margin-bottom: 16px;"></div>
      <div class="skeleton" style="height: 20px; width: 40%;"></div>
    `;
    skeletons.push(skeleton);
  }
  return skeletons;
}

/**
 * 批量渲染项目卡片
 * @param {HTMLElement} container - 容器元素
 * @param {Object[]} projects - 项目列表
 * @param {boolean} append - 是否追加而非替换
 */
export function renderProjectCards(container, projects, append = false) {
  if (!append) {
    container.innerHTML = '';
  }

  if (projects.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <h3 class="empty-state-title">没有找到匹配的项目</h3>
        <p>尝试调整搜索条件或筛选器</p>
      </div>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();
  const startIndex = append ? container.children.length : 0;

  projects.forEach((project, index) => {
    const card = createProjectCard(project, startIndex + index);
    fragment.appendChild(card);
  });

  container.appendChild(fragment);
}

/**
 * HTML 转义
 * @param {string} text - 原始文本
 * @returns {string} 转义后的文本
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
