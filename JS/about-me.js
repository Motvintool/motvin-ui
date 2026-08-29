// about-me.js: Scripts only for about-me.html.
(function registerAboutMePageModule() {
  const PAGE_NAME = 'about-me.html';

  const FACTS = [
    { label: 'Based in', value: 'Chennai, India' },
    { label: 'Follow Me', value: '<a href="https://www.instagram.com/siren.uix/" target="_blank" rel="noopener">Instagram</a>, <a href="https://www.behance.net/surendarv" target="_blank" rel="noopener">Behance</a>' },
    { label: 'Working On', value: '<a href="https://www.instagram.com/zoho/" target="_blank" rel="noopener">Zoho, Chennai</a>' },
    { label: 'Designation', value: 'Product Designer' },
    { label: 'Our Community', value: '<a href="https://chat.whatsapp.com/JxLUrQpNpaXJ4ido6muIW6" target="_blank" rel="noopener">8k+ Designer</a>' },
  ];

  const TOOLS = [
    { name: 'Figma Site', description: 'Low Code Interface Design Tool', usage: 'For Live Website', score: '100' },
    { name: 'Figma', description: 'User Interface Design Tool', usage: 'For Mobile, Website etc.,', score: '100' },
    { name: 'Framer', description: 'Low Code Interface Design Tool', usage: 'For Live Website', score: '95' },
    { name: 'Adobe XD', description: 'User Interface Design Tool', usage: 'For Mobile, Website etc.,', score: '100' },
    { name: 'Webflow', description: 'Low Code Interface Design Tool', usage: 'For Live Website', score: '95' },
    { name: 'Illustrator', description: 'User Interface Design Tool', usage: 'For Mobile, Website etc.,', score: '100' },
  ];

  function getCurrentPageName() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (!parts.length) return 'files.html';
    let name = parts[parts.length - 1] || 'files.html';
    if (!name.endsWith('.html')) name += '.html';
    return name;
  }

  function renderFacts() {
    const root = document.getElementById('about-fact-list');
    if (!root) return;

    root.innerHTML = FACTS.map((item) => `
      <div class="about-fact-row">
        <span>${item.label}</span>
        <span class="about-fact-value">${item.value}</span>
      </div>`).join('');
  }

  function renderToolCard(tool) {
    return `
      <article class="about-tool-card">
        <div class="about-tool-copy">
          <h4 class="about-tool-title">${tool.name}</h4>
          <p class="about-tool-desc">${tool.description}</p>
          <span class="about-tool-usage">
            <img src="ASSET/Icons/filter-all-templates-icon.svg" alt="" />
            ${tool.usage}
          </span>
        </div>
        <div class="about-tool-score">
          <span class="about-tool-divider"></span>
          <span class="about-tool-percent">
            <span class="about-tool-percent-value">${tool.score}</span>
            <span class="about-tool-percent-symbol">%</span>
          </span>
        </div>
      </article>`;
  }

  function renderTools() {
    const root = document.getElementById('about-tools-grid');
    if (!root) return;

    root.innerHTML = TOOLS.map(renderToolCard).join('');
  }

  function bindBackLink(signal) {
    const backLink = document.querySelector('.about-back-link');
    if (!backLink) return;

    backLink.addEventListener('click', (event) => {
      event.preventDefault();

      const referrer = document.referrer || '';
      const isSameOriginReferrer = referrer && new URL(referrer).origin === window.location.origin;

      if (isSameOriginReferrer && window.history.length > 1) {
        window.history.back();
        return;
      }

      window.location.href = '/files';
    }, { signal });
  }

  function initAboutMePage() {
    if (getCurrentPageName() !== PAGE_NAME) return;

    if (typeof window.__pageCleanup === 'function') {
      window.__pageCleanup();
    }

    const controller = new AbortController();
    const { signal } = controller;

    renderFacts();
    renderTools();
    bindBackLink(signal);

    const hasCache = Boolean(window.ProductCache && typeof window.ProductCache.hasCacheSync === 'function' && window.ProductCache.hasCacheSync());
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent('app:layoutReady'));
    }, hasCache ? 0 : 260);

    if (window.ProductTopPaneTabs) {
      window.ProductTopPaneTabs.init({
        containerId: 'shell-top-pane-product-tabs',
        forceHomeActive: true,
        enableDefaultProductActive: false,
      });
    }

    const cleanupPage = () => {
      controller.abort();
      if (window.__pageCleanup === cleanupPage) {
        window.__pageCleanup = null;
      }
    };
    window.__pageCleanup = cleanupPage;
  }

  window.PageModules = window.PageModules || {};
  window.PageModules[PAGE_NAME] = initAboutMePage;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAboutMePage, { once: true });
  } else {
    initAboutMePage();
  }
})();
