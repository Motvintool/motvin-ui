// Button.js: reusable button factory and optional showcase renderer.
(function initButtonComponent() {
  function svgIcon(size) {
    return `<svg viewBox="0 0 16 16" width="${size}" height="${size}" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="2.5" y="2.5" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1.2"/><path d="M5 8h6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`;
  }

  function createButton(options) {
    const opts = options || {};
    const variant = opts.variant || 'primary';
    const size = opts.size || 'xsm';
    const state = opts.state || 'default';
    const label = opts.label || 'Buy Now';
    const price = opts.price || '$29';
    const showIcon = opts.showIcon !== false;
    const pill = !!opts.pill;

    const tagName = opts.href ? 'a' : 'button';
    const el = document.createElement(tagName);
    if (opts.href) {
      el.href = opts.href;
    } else {
      el.type = 'button';
    }

    const classes = [
      'button',
      `button--${variant}`,
      `button--${size}`,
      `button--state-${state}`,
    ];
    if (pill) {
      classes.push('button--pill');
    }
    el.className = classes.join(' ');

    const iconSize = size === 'xsm' ? 14 : 16;
    el.innerHTML = `
      ${showIcon ? `<span class="button__icon">${svgIcon(iconSize)}</span>` : ''}
      <span class="button__content">
        <span class="button__label">${label}</span>
        <span class="button__price">${price}</span>
      </span>
    `;

    return el;
  }

  function mountShowcase() {
    const showcaseRoots = document.querySelectorAll('[data-button-showcase]');
    if (!showcaseRoots.length) return;

    const variants = ['primary', 'secondary'];
    const sizes = ['lg', 'md', 'sm', 'xsm'];
    const states = ['default', 'hover', 'pressed'];

    showcaseRoots.forEach((root) => {
      variants.forEach((variant) => {
        const section = document.createElement('section');
        section.className = 'button-showcase-group';
        section.innerHTML = `<h3>${variant === 'primary' ? 'Primary' : 'Secondary'}</h3>`;

        states.forEach((state) => {
          const row = document.createElement('div');
          row.className = 'button-showcase-row';

          sizes.forEach((size) => {
            row.appendChild(createButton({
              variant,
              size,
              state,
              label: 'Buy Now',
              price: '$29',
            }));
          });

          section.appendChild(row);
        });

        root.appendChild(section);
      });
    });
  }

  window.ButtonComponent = {
    createButton,
    mountShowcase,
  };

  document.addEventListener('DOMContentLoaded', mountShowcase);
})();
