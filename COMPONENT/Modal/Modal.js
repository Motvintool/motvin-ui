// Modal.js: Reusable modal component for preset renaming and prompts.
(function initModalComponent() {
  let modalInstance = null;
  let activeOnSave = null;
  let activeOnCancel = null;

  function ensureModalElement() {
    let backdrop = document.getElementById('recents-rename-modal');
    if (backdrop) {
      bindModalEvents(backdrop);
      return backdrop;
    }

    backdrop = document.createElement('div');
    backdrop.className = 'recents-modal-backdrop';
    backdrop.id = 'recents-rename-modal';
    backdrop.hidden = true;

    backdrop.innerHTML = `
      <div class="recents-modal-panel">
        <div class="recents-modal-header">
          <h3 class="recents-modal-title" id="recents-rename-modal-heading">Rename Preset</h3>
          <button class="recents-modal-close" id="recents-rename-close" type="button" aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 1l12 12M13 1L1 13"/></svg>
          </button>
        </div>
        <div class="recents-modal-body">
          <label class="recents-modal-label" for="recents-rename-input">Title</label>
          <input type="text" class="recents-modal-input" id="recents-rename-input" placeholder="Enter title..." autocomplete="off" />
        </div>
        <div class="recents-modal-footer">
          <button class="recents-modal-btn recents-modal-btn--secondary" id="recents-rename-cancel" type="button">Cancel</button>
          <button class="recents-modal-btn recents-modal-btn--primary" id="recents-rename-save" type="button">Save Changes</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);
    bindModalEvents(backdrop);
    return backdrop;
  }

  function bindModalEvents(backdrop) {
    if (backdrop.dataset.bound === 'true') return;
    backdrop.dataset.bound = 'true';

    const closeBtn = backdrop.querySelector('#recents-rename-close');
    const cancelBtn = backdrop.querySelector('#recents-rename-cancel');
    const saveBtn = backdrop.querySelector('#recents-rename-save');
    const input = backdrop.querySelector('#recents-rename-input');

    const handleClose = () => {
      const cb = activeOnCancel;
      closeModal();
      if (typeof cb === 'function') {
        cb();
      }
    };

    const handleSave = () => {
      const val = input ? input.value.trim() : '';
      if (!val) return;
      const cb = activeOnSave;
      closeModal();
      if (typeof cb === 'function') {
        cb(val);
      }
    };

    if (closeBtn) closeBtn.addEventListener('click', handleClose);
    if (cancelBtn) cancelBtn.addEventListener('click', handleClose);
    if (saveBtn) saveBtn.addEventListener('click', handleSave);

    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') handleClose();
      });
    }

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) handleClose();
    });
  }

  function closeModal() {
    if (modalInstance) {
      if (modalInstance.contains(document.activeElement) && document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
      modalInstance.hidden = true;
    }
    activeOnSave = null;
    activeOnCancel = null;
  }

  function openModal(options) {
    const opts = options || {};
    modalInstance = ensureModalElement();

    const heading = modalInstance.querySelector('#recents-rename-modal-heading');
    const input = modalInstance.querySelector('#recents-rename-input');

    if (heading && opts.heading) {
      heading.textContent = opts.heading;
    }
    if (input) {
      input.value = opts.value || '';
    }

    activeOnSave = opts.onSave || null;
    activeOnCancel = opts.onCancel || null;

    modalInstance.removeAttribute('hidden');

    window.requestAnimationFrame(() => {
      if (input) {
        input.focus();
        input.select();
      }
    });
  }

  window.ModalComponent = {
    open: openModal,
    close: closeModal,
    ensureModalElement,
  };
})();
