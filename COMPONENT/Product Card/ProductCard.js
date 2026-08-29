(function initProductCardComponent() {
  const COMPONENT_BASE_PATH = 'COMPONENT/Product%20Card';

  const FALLBACK_TEMPLATE_CARD_HTML = `<a class="product-card product-card--template" data-product-slug="{{slug}}" href="{{href}}">
  <div class="product-img-wrap">
    <span class="product-category-chip">{{categoryChip}}</span>
    <img src="{{image}}" alt="{{title}}" />
  </div>
  <div class="product-info">
    <div class="product-meta">
      <span class="product-name">{{title}}</span>
      <div class="product-author">
        <span>By {{author}}</span>
        <span class="product-author-dot">•</span>
        <span class="product-stats">
          <span class="product-stat product-stat--like{{likeActiveClass}}" data-like-action="true" data-product-slug="{{slug}}" data-liked="{{likedValue}}" role="button" tabindex="0" aria-label="Like {{title}}" aria-pressed="{{likedValue}}"><img src="{{likeIcon}}" alt="" /><span data-stat-like>{{likeCount}}</span></span>
          <span class="product-stat"><img src="ASSET/Icons/product-card-stat-trend.svg" alt="" /><span data-stat-trend>{{trendCount}}</span></span>
        </span>
      </div>
    </div>
    {{priceBlock}}
  </div>
</a>`;

  const FALLBACK_DESIGN_POST_CARD_HTML = `<a class="product-card product-card--design-post" data-product-slug="{{slug}}"{{hiddenFilterAttr}} href="{{href}}">
  <div class="product-img-wrap">
    <span class="product-category-chip">{{categoryChip}}</span>
    <img src="{{image}}" alt="{{title}}" />
  </div>
  <div class="product-info">
    <div class="product-meta">
      <span class="product-name">{{title}}</span>
      <div class="product-author">
        <span>By {{author}}</span>
        <span class="product-author-dot">•</span>
        <span class="product-stats">
          <span class="product-stat product-stat--like{{likeActiveClass}}" data-like-action="true" data-product-slug="{{slug}}" data-liked="{{likedValue}}" role="button" tabindex="0" aria-label="Like {{title}}" aria-pressed="{{likedValue}}"><img src="{{likeIcon}}" alt="" /><span data-stat-like>{{likeCount}}</span></span>
          <span class="product-stat"><img src="ASSET/Icons/product-card-stat-trend.svg" alt="" /><span data-stat-trend>{{trendCount}}</span></span>
        </span>
      </div>
    </div>
  </div>
</a>`;

  function extractTemplateMarkup(fileText, templateId) {
    if (!fileText || !templateId) return '';

    const escapedId = templateId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matcher = new RegExp(
      `<template[^>]*id=["']${escapedId}["'][^>]*>([\\s\\S]*?)<\\/template>`,
      'i'
    );
    const match = String(fileText).match(matcher);
    return match && typeof match[1] === 'string' ? match[1].trim() : '';
  }

  async function loadTemplateFile(path, fallbackTemplate, templateId) {
    try {
      const response = await fetch(path, { credentials: 'same-origin' });
      if (!response.ok) {
        return fallbackTemplate;
      }

      const text = await response.text();
      if (!text || !text.trim()) {
        return fallbackTemplate;
      }

      if (!templateId) {
        return text;
      }

      const extracted = extractTemplateMarkup(text, templateId);
      return extracted || fallbackTemplate;
    } catch (error) {
      // Keep rendering resilient if template files cannot be fetched.
      return fallbackTemplate;
    }
  }

  function renderWithTokens(template, tokens) {
    let html = String(template || '');
    Object.keys(tokens).forEach((key) => {
      html = html.split(`{{${key}}}`).join(String(tokens[key] == null ? '' : tokens[key]));
    });
    return html;
  }

  function normalizeCount(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.floor(n);
  }

  function formatCount(value) {
    if (window.ProductStatsService && typeof window.ProductStatsService.formatCount === 'function') {
      return window.ProductStatsService.formatCount(value);
    }

    return String(normalizeCount(value));
  }

  function syncCardStatsInDom(slug, stats) {
    const key = String(slug || '').trim();
    if (!key) return;

    const likes = normalizeCount(stats && stats.likesCount);
    const views = normalizeCount(stats && stats.viewsCount);
    const likedByCurrentUser = Boolean(stats && stats.likedByCurrentUser);

    document.querySelectorAll(`.product-card[data-product-slug="${CSS.escape(key)}"]`).forEach((card) => {
      const likeNode = card.querySelector('[data-stat-like]');
      const trendNode = card.querySelector('[data-stat-trend]');
      const likeTrigger = card.querySelector('[data-like-action="true"]');

      if (likeNode) likeNode.textContent = formatCount(likes);
      if (trendNode) trendNode.textContent = formatCount(views);

      if (likeTrigger) {
        likeTrigger.setAttribute('data-liked', likedByCurrentUser ? 'true' : 'false');
        likeTrigger.setAttribute('aria-pressed', likedByCurrentUser ? 'true' : 'false');
        likeTrigger.classList.toggle('is-liked', likedByCurrentUser);

        const likeIcon = likeTrigger.querySelector('img');
        if (likeIcon) {
          likeIcon.src = likedByCurrentUser
            ? 'ASSET/Icons/product-card-stat-like-active.svg'
            : 'ASSET/Icons/product-card-stat-like.svg';
        }
      }
    });
  }

  function bindLikeActions() {
    if (window.__productCardLikeEventsBound) return;
    window.__productCardLikeEventsBound = true;

    const runToggleLike = async (trigger, event) => {
      if (!trigger) return;
      event.preventDefault();
      event.stopPropagation();

      if (trigger.dataset.likeBusy === 'true') return;
      trigger.dataset.likeBusy = 'true';

      try {
        const slug = String(trigger.getAttribute('data-product-slug') || '').trim();
        const statsService = window.ProductStatsService;
        if (!slug || !statsService || typeof statsService.toggleLike !== 'function') {
          throw new Error('Like service unavailable.');
        }

        const result = await statsService.toggleLike(slug);
        if (result && result.stats) {
          syncCardStatsInDom(slug, result.stats);
        }
      } catch (error) {
        if (error && error.code === 'auth-required-to-remove-guest-like') {
          try {
            const authService = window.FirebaseAuthService;
            if (!authService || typeof authService.loginWithGoogle !== 'function') {
              throw new Error('Google authentication is unavailable right now.');
            }

            await authService.loginWithGoogle();
            const slug = String(trigger.getAttribute('data-product-slug') || '').trim();
            const retry = await statsService.toggleLike(slug);
            if (retry && retry.stats) {
              syncCardStatsInDom(slug, retry.stats);
            }
            return;
          } catch (authError) {
            window.alert(authError && authError.message ? authError.message : 'Sign-in was cancelled.');
            return;
          }
        }

        window.alert(error && error.message ? error.message : 'Unable to update like right now.');
      } finally {
        trigger.dataset.likeBusy = 'false';
      }
    };

    document.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-like-action="true"]');
      if (!trigger) return;
      runToggleLike(trigger, event);
    }, true);

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const trigger = event.target.closest('[data-like-action="true"]');
      if (!trigger) return;
      runToggleLike(trigger, event);
    });

    document.addEventListener('product-stats:updated', (event) => {
      const detail = event && event.detail ? event.detail : {};
      if (!detail.slug || !detail.stats) return;
      syncCardStatsInDom(detail.slug, detail.stats);
    });
  }

  let templateCardTemplate = FALLBACK_TEMPLATE_CARD_HTML;
  let designPostCardTemplate = FALLBACK_DESIGN_POST_CARD_HTML;

  async function preloadTemplates() {
    const [templateMarkup, designPostMarkup] = await Promise.all([
      loadTemplateFile(
        `${COMPONENT_BASE_PATH}/TemplateCard.html`,
        FALLBACK_TEMPLATE_CARD_HTML,
        'template-card-markup'
      ),
      loadTemplateFile(
        `${COMPONENT_BASE_PATH}/DesignPostCard.html`,
        FALLBACK_DESIGN_POST_CARD_HTML,
        'design-post-card-markup'
      ),
    ]);

    templateCardTemplate = templateMarkup;
    designPostCardTemplate = designPostMarkup;

    document.dispatchEvent(new CustomEvent('product-card:templates-ready'));
  }

  preloadTemplates();
  bindLikeActions();

  function buildProductHref(slug, detailPath) {
    return `${detailPath}?product=${encodeURIComponent(String(slug || ''))}`;
  }

  function buildHiddenFilterGroupsAttr(groups) {
    const normalizedGroups = Array.isArray(groups) ? groups.filter(Boolean) : [];
    if (!normalizedGroups.length) return '';
    return ` data-hidden-filter-groups="${normalizedGroups.join(' ')}"`;
  }

  function renderTemplateCard(product, options = {}) {
    const href = options.href || buildProductHref(product.slug, options.detailPath || 'product-detail.html');
    const categoryLabel = String(options.categoryLabel || product.category || '').trim();
    const categoryChip = categoryLabel || 'Templates';
    const showPrice = options.showPrice !== false;

    const liked = options.likedByCurrentUser != null
      ? Boolean(options.likedByCurrentUser)
      : Boolean(product.likedByCurrentUser);
    const likeCount = String(options.likeCount || product.likeCount || formatCount(product.likes || 0)).trim();
    const trendCount = String(options.trendCount || product.trendCount || formatCount(product.views || 0)).trim();

    return renderWithTokens(templateCardTemplate, {
      slug: product.slug,
      href,
      image: product.image,
      title: product.title,
      author: product.author,
      categoryLabel,
      categoryChip,
      likeCount,
      trendCount,
      likedValue: liked ? 'true' : 'false',
      likeActiveClass: liked ? ' is-liked' : '',
      likeIcon: liked ? 'ASSET/Icons/product-card-stat-like-active.svg' : 'ASSET/Icons/product-card-stat-like.svg',
      priceBlock: showPrice ? `<span class="product-price">${product.price}</span>` : '',
    });
  }

  function renderDesignPostCard(product, options = {}) {
    const href = options.href || buildProductHref(product.slug, options.detailPath || 'my-post-detail.html');
    const categoryLabel = String(options.categoryLabel || product.category || '').trim();
    const categoryChip = categoryLabel || 'Design Post';
    const imageSrc = options.imageSrc || product.image || 'ASSET/Images/slide1.png';
    const hiddenFilterGroupsAttr = buildHiddenFilterGroupsAttr(options.hiddenFilterGroups);
    const liked = options.likedByCurrentUser != null
      ? Boolean(options.likedByCurrentUser)
      : Boolean(product.likedByCurrentUser);
    const likeCount = String(options.likeCount || product.likeCount || formatCount(product.likes || 0)).trim();
    const trendCount = String(options.trendCount || product.trendCount || formatCount(product.views || 0)).trim();

    return renderWithTokens(designPostCardTemplate, {
      slug: product.slug,
      hiddenFilterAttr: hiddenFilterGroupsAttr,
      href,
      image: imageSrc,
      title: product.title,
      author: product.author,
      categoryLabel,
      categoryChip,
      likeCount,
      trendCount,
      likedValue: liked ? 'true' : 'false',
      likeActiveClass: liked ? ' is-liked' : '',
      likeIcon: liked ? 'ASSET/Icons/product-card-stat-like-active.svg' : 'ASSET/Icons/product-card-stat-like.svg',
    });
  }

  window.ProductCard = window.ProductCard || {};
  window.ProductCard.template = renderTemplateCard;
  window.ProductCard.designPost = renderDesignPostCard;
})();
