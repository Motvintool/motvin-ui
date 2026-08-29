(function initAdminPage() {
  const SUPER_ADMIN_EMAIL = 'surendarv638@gmail.com';
  const SITE_ADMINS_COLLECTION = 'siteAdmins';

  const form = document.getElementById('product-form');
  const productList = document.getElementById('product-list');
  const searchInput = document.getElementById('search-input');
  const refreshBtn = document.getElementById('refresh-btn');
  const newBtn = document.getElementById('new-btn');
  const duplicateBtn = document.getElementById('duplicate-btn');
  const deleteBtn = document.getElementById('delete-btn');
  const resetBtn = document.getElementById('reset-btn');
  const statusChip = document.getElementById('status-chip');
  const successBanner = document.getElementById('success-banner');
  const successBannerText = document.getElementById('success-banner-text');
  const adminMessage = document.getElementById('admin-message');
  const editorMode = document.getElementById('editor-mode');
  const collectionName = document.getElementById('collection-name');
  const imagePreview = document.getElementById('image-preview');
  const singleImageFields = form ? form.querySelector('[data-single-image-fields]') : null;
  const designPostGalleryFields = form ? form.querySelector('[data-design-post-gallery-fields]') : null;

  const accessGate = document.getElementById('access-gate');
  const accessGateTitle = document.getElementById('access-gate-title');
  const accessGateCopy = document.getElementById('access-gate-copy');
  const adminContent = document.getElementById('admin-content');
  const authPill = document.getElementById('auth-pill');
  const signInButton = document.getElementById('sign-in-button');
  const signOutButton = document.getElementById('sign-out-button');

  const usersManagementSection = document.getElementById('users-management-section');
  const addAdminForm = document.getElementById('add-admin-form');
  const addAdminEmailInput = document.getElementById('add-admin-email');
  const usersList = document.getElementById('users-list');

  const state = {
    products: [],
    selectedSlug: '',
  };

  const access = {
    user: null,
    hasToken: false,
    isOwner: false,
    isAdmin: false,
    admins: [],
  };

  let successBannerTimer = null;

  const config = window.FIREBASE_CONFIG || {};
  const firestoreCollection = String(config.productsCollection || 'products').trim() || 'products';

  if (collectionName) {
    collectionName.textContent = firestoreCollection;
  }

  function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
  }

  function normalizeProductType(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === 'design-post' ? 'design-post' : 'template';
  }

  function getGalleryInputs() {
    if (!form) return [];
    return ['galleryImage1', 'galleryImage2', 'galleryImage3']
      .map((name) => form.elements[name])
      .filter(Boolean);
  }

  function getGalleryValuesFromForm() {
    return getGalleryInputs()
      .map((input) => String(input.value || '').trim())
      .filter(Boolean)
      .slice(0, 3);
  }

  function setGalleryValues(values) {
    const nextValues = Array.isArray(values)
      ? values.map((value) => String(value || '').trim()).filter(Boolean).slice(0, 3)
      : [];

    getGalleryInputs().forEach((input, index) => {
      input.value = nextValues[index] || '';
    });
  }

  function getPreviewSourceForType(productType) {
    const normalizedType = normalizeProductType(productType);
    if (normalizedType === 'design-post') {
      const gallery = getGalleryValuesFromForm();
      if (gallery.length) return gallery[0];
    }

    return String(form && form.elements.image ? form.elements.image.value || '' : '').trim();
  }

  function syncProductTypeImageFields(value) {
    if (!form) return;

    const normalizedType = normalizeProductType(value || (form.elements.productType && form.elements.productType.value));
    const isDesignPost = normalizedType === 'design-post';

    if (singleImageFields) {
      singleImageFields.hidden = isDesignPost;
    }

    if (designPostGalleryFields) {
      designPostGalleryFields.hidden = !isDesignPost;
    }

    if (form.elements.image) {
      form.elements.image.required = !isDesignPost;
    }

    getGalleryInputs().forEach((input, index) => {
      input.required = isDesignPost && index === 0;
    });

    updateImagePreview(getPreviewSourceForType(normalizedType));
  }

  function wait(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  async function getSessionToken(forceRefresh) {
    const authService = window.FirebaseAuthService;
    if (!authService || typeof authService.getIdToken !== 'function') return null;

    if (typeof authService.init === 'function') {
      await authService.init();
    }

    let token = await authService.getIdToken(Boolean(forceRefresh));
    if (!token && !forceRefresh) {
      await wait(280);
      token = await authService.getIdToken(true);
    }

    return token;
  }

  async function requireSessionToken() {
    const token = await getSessionToken(false);
    if (token) return token;

    throw new Error('Session is still restoring. Please wait a moment and try again.');
  }

  async function getAuthHeaders(forceRefresh) {
    const headers = { 'Content-Type': 'application/json' };
    const token = await getSessionToken(forceRefresh);
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  async function getAuthOnlyHeaders(forceRefresh) {
    const headers = {};
    const token = await getSessionToken(forceRefresh);
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  // Wraps fetch() with one retry using a force-refreshed ID token on 401/403.
  // 401 usually means an expired token. 403 is typically real authorization
  // denial, but can happen transiently right after account/session switches
  // before the latest token is observed by this page.
  async function fetchWithAuth(url, options, headerBuilder) {
    const headers = await headerBuilder(false);
    let response = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });

    if (response.status === 401 || response.status === 403) {
      const refreshedHeaders = await headerBuilder(true);
      response = await fetch(url, { ...options, headers: { ...refreshedHeaders, ...(options.headers || {}) } });
    }

    return response;
  }

  function getCollectionUrl(collection) {
    return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/databases/(default)/documents/${encodeURIComponent(collection)}?key=${encodeURIComponent(config.apiKey)}`;
  }

  function getDocumentUrl(collection, docId) {
    return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/databases/(default)/documents/${encodeURIComponent(collection)}/${encodeURIComponent(docId)}?key=${encodeURIComponent(config.apiKey)}`;
  }

  function setStatus(text, mode) {
    if (!statusChip) return;
    const statusText = statusChip.querySelector('.status-text');
    if (statusText) statusText.textContent = text;
    statusChip.setAttribute('data-state', mode === 'error' ? '' : 'active');
  }

  function setMessage(text, mode) {
    if (!adminMessage) return;

    if (!text) {
      adminMessage.hidden = true;
      adminMessage.textContent = '';
      return;
    }

    adminMessage.hidden = false;
    adminMessage.setAttribute('data-tone', mode === 'error' ? 'error' : 'success');
    adminMessage.textContent = text;
  }

  function hideSuccessBanner() {
    if (!successBanner) return;
    successBanner.hidden = true;
    if (successBannerTimer) {
      window.clearTimeout(successBannerTimer);
      successBannerTimer = null;
    }
  }

  function showSuccessBanner(text) {
    if (!successBanner) return;

    if (successBannerText) {
      successBannerText.textContent = String(text || 'Product added successfully.');
    }

    successBanner.hidden = false;

    if (successBannerTimer) window.clearTimeout(successBannerTimer);
    successBannerTimer = window.setTimeout(() => {
      successBanner.hidden = true;
      successBannerTimer = null;
    }, 4200);
  }

  function parseFirestoreValue(value) {
    if (!value || typeof value !== 'object') return null;

    if (Object.prototype.hasOwnProperty.call(value, 'stringValue')) return value.stringValue;
    if (Object.prototype.hasOwnProperty.call(value, 'integerValue')) return Number(value.integerValue);
    if (Object.prototype.hasOwnProperty.call(value, 'doubleValue')) return Number(value.doubleValue);
    if (Object.prototype.hasOwnProperty.call(value, 'booleanValue')) return Boolean(value.booleanValue);
    if (Object.prototype.hasOwnProperty.call(value, 'nullValue')) return null;
    if (Object.prototype.hasOwnProperty.call(value, 'timestampValue')) return value.timestampValue;

    if (Object.prototype.hasOwnProperty.call(value, 'arrayValue')) {
      const values = value.arrayValue && Array.isArray(value.arrayValue.values)
        ? value.arrayValue.values
        : [];
      return values.map((item) => parseFirestoreValue(item));
    }

    if (Object.prototype.hasOwnProperty.call(value, 'mapValue')) {
      const fields = value.mapValue && value.mapValue.fields ? value.mapValue.fields : {};
      const parsed = {};
      Object.keys(fields).forEach((key) => {
        parsed[key] = parseFirestoreValue(fields[key]);
      });
      return parsed;
    }

    return null;
  }

  function parseFirestoreDocument(doc) {
    if (!doc || !doc.fields) return null;

    const parsed = {};
    Object.keys(doc.fields).forEach((key) => {
      parsed[key] = parseFirestoreValue(doc.fields[key]);
    });

    if (!parsed.slug && typeof doc.name === 'string') {
      const chunks = doc.name.split('/');
      parsed.slug = chunks[chunks.length - 1] || '';
    }

    return normalizeProduct(parsed);
  }

  function normalizeArray(value) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || '').trim()).filter(Boolean);
    }

    if (typeof value === 'string' && value.trim()) {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return [];
  }

  function normalizeSlashArray(value) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || '').trim()).filter(Boolean);
    }

    if (typeof value === 'string' && value.trim()) {
      return value
        .split('/')
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return [];
  }

  function normalizeProduct(raw) {
    const product = raw || {};
    const gallery = normalizeArray(product.gallery).slice(0, 3);

    return {
      slug: String(product.slug || '').trim(),
      title: String(product.title || '').trim(),
      author: String(product.author || '').trim(),
      category: String(product.category || '').trim(),
      price: String(product.price || '').trim(),
      image: String(product.image || '').trim(),
      summary: String(product.summary || '').trim(),
      description: String(product.description || '').trim(),
      tags: normalizeArray(product.tags),
      detailTags: normalizeArray(product.detailTags),
      gallery,
      productType: String(product.productType || 'template').trim() || 'template',
      updatedAt: String(product.updatedAt || '').trim(),
    };
  }

  function toFirestoreValue(value) {
    if (value == null) return { nullValue: null };

    if (Array.isArray(value)) {
      return {
        arrayValue: {
          values: value.map((item) => toFirestoreValue(item)),
        },
      };
    }

    if (typeof value === 'boolean') return { booleanValue: value };

    if (typeof value === 'number') {
      if (Number.isInteger(value)) return { integerValue: String(value) };
      return { doubleValue: value };
    }

    if (typeof value === 'object') {
      const fields = {};
      Object.keys(value).forEach((key) => {
        fields[key] = toFirestoreValue(value[key]);
      });
      return {
        mapValue: { fields },
      };
    }

    return { stringValue: String(value) };
  }

  function toFirestoreFields(product) {
    const fields = {};
    Object.keys(product).forEach((key) => {
      fields[key] = toFirestoreValue(product[key]);
    });
    return fields;
  }

  function formatTags(value) {
    if (!Array.isArray(value) || !value.length) return '';
    return value.join(', ');
  }

  function formatSlashList(value) {
    if (!Array.isArray(value) || !value.length) return '';
    return value.join(' / ');
  }

  function safeIsoString(value) {
    const source = String(value || '').trim();
    if (!source) return '';
    const parsed = Date.parse(source);
    if (!Number.isFinite(parsed)) return '';
    return new Date(parsed).toISOString();
  }

  function getSortScore(product) {
    const parsed = Date.parse(product.updatedAt || '');
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function renderList() {
    if (!productList) return;

    const query = String(searchInput && searchInput.value ? searchInput.value : '')
      .trim()
      .toLowerCase();

    const products = state.products
      .filter((product) => {
        if (!query) return true;
        const haystack = [product.title, product.slug, product.category, product.author, product.productType]
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => getSortScore(b) - getSortScore(a));

    if (!products.length) {
      productList.innerHTML = '<div class="empty-state">No products found.</div>';
      return;
    }

    productList.innerHTML = products
      .map((product) => {
        const isActive = product.slug === state.selectedSlug;
        const updated = product.updatedAt ? new Date(product.updatedAt).toLocaleString() : 'Not set';

        return `
          <div class="entry-card ${isActive ? 'is-active' : ''}" data-slug="${product.slug}">
            <div class="entry-card-head">
              <span class="entry-card-title">${product.title || '(Untitled)'}</span>
            </div>
            <p class="entry-card-meta">${product.slug} · ${product.productType} · ${product.category || 'No category'}</p>
            <p class="entry-card-meta">Updated: ${updated}</p>
          </div>
        `;
      })
      .join('');
  }

  function setFormMode(mode) {
    if (!editorMode) return;
    editorMode.textContent = mode === 'Create' ? 'Create mode' : 'Edit mode';
  }

  function updateImagePreview(url) {
    if (!imagePreview) return;

    const imageUrl = String(url || '').trim();
    if (!imageUrl) {
      imagePreview.src = '';
      imagePreview.alt = 'No preview image';
      return;
    }

    imagePreview.src = imageUrl;
    imagePreview.alt = 'Product image preview';
  }

  function populateForm(product) {
    if (!form) return;

    const normalizedType = normalizeProductType(product.productType || 'template');
    const gallery = normalizeArray(product.gallery).slice(0, 3);
    if (!gallery.length && product.image) {
      gallery.push(String(product.image).trim());
    }

    form.elements.slug.value = product.slug || '';
    form.elements.title.value = product.title || '';
    form.elements.author.value = product.author || '';
    form.elements.category.value = product.category || '';
    form.elements.price.value = product.price || '';
    form.elements.image.value = product.image || '';
    setGalleryValues(gallery);
    form.elements.summary.value = product.summary || '';
    form.elements.description.value = product.description || '';
    form.elements.tags.value = formatTags(product.tags);
    form.elements.detailTags.value = formatSlashList(product.detailTags);
    form.elements.productType.value = normalizedType;
    form.elements.updatedAt.value = product.updatedAt || '';

    syncProductTypeImageFields(normalizedType);
  }

  function clearForm() {
    if (!form) return;

    form.reset();
    form.elements.productType.value = 'template';
    setGalleryValues([]);
    form.elements.updatedAt.value = new Date().toISOString();
    state.selectedSlug = '';
    setFormMode('Create');
    syncProductTypeImageFields('template');
    hideSuccessBanner();
    renderList();
  }

  function buildDuplicateSlug(slug) {
    const base = String(slug || '').trim() || 'product';
    const source = base.endsWith('-copy') ? base : `${base}-copy`;
    let candidate = source;
    let counter = 2;

    while (state.products.some((item) => item.slug === candidate)) {
      candidate = `${source}-${counter}`;
      counter += 1;
    }

    return candidate;
  }

  function duplicateSelectedProduct() {
    if (!state.selectedSlug) {
      setMessage('Select a product first to duplicate.', 'error');
      return;
    }

    const source = state.products.find((item) => item.slug === state.selectedSlug);
    if (!source) {
      setMessage('Selected product was not found.', 'error');
      return;
    }

    const duplicate = normalizeProduct({
      ...source,
      slug: buildDuplicateSlug(source.slug),
      title: source.title ? `${source.title} (Copy)` : 'Untitled (Copy)',
      updatedAt: new Date().toISOString(),
    });

    state.selectedSlug = '';
    populateForm(duplicate);
    setFormMode('Create');
    updateImagePreview(duplicate.image);
    renderList();
    hideSuccessBanner();
    setMessage('Duplicate draft ready. Review and click Save to create it.', 'ok');
    form.elements.slug.focus();
    form.elements.slug.select();
  }

  function collectFormProduct() {
    const productType = normalizeProductType(form.elements.productType.value || 'template');
    const singleImage = String(form.elements.image.value || '').trim();
    const gallery = getGalleryValuesFromForm();
    const primaryImage = productType === 'design-post'
      ? (gallery[0] || singleImage)
      : singleImage;

    const base = {
      slug: String(form.elements.slug.value || '').trim(),
      title: String(form.elements.title.value || '').trim(),
      author: String(form.elements.author.value || '').trim(),
      category: String(form.elements.category.value || '').trim(),
      price: String(form.elements.price.value || '').trim(),
      image: primaryImage,
      summary: String(form.elements.summary.value || '').trim(),
      description: String(form.elements.description.value || '').trim(),
      tags: normalizeArray(form.elements.tags.value),
      detailTags: normalizeSlashArray(form.elements.detailTags.value),
      productType,
      updatedAt: new Date().toISOString(),
    };

    if (productType === 'design-post') {
      base.gallery = gallery.length ? gallery : (primaryImage ? [primaryImage] : []);
    }

    return normalizeProduct(base);
  }

  async function readErrorBody(response) {
    try {
      const text = await response.text();
      return text || `HTTP ${response.status}`;
    } catch (error) {
      return `HTTP ${response.status}`;
    }
  }

  async function loadProducts() {
    if (!config.apiKey || !config.projectId) {
      setStatus('Missing firebase config', 'error');
      setMessage('Missing apiKey/projectId in JS/firebase-config.js', 'error');
      return;
    }

    setStatus('Loading products...', 'idle');

    try {
      const response = await fetchWithAuth(getCollectionUrl(firestoreCollection), { credentials: 'omit' }, getAuthHeaders);

      if (!response.ok) {
        const body = await readErrorBody(response);
        throw new Error(`Load failed (${response.status}): ${body}`);
      }

      const payload = await response.json();
      const docs = Array.isArray(payload.documents) ? payload.documents : [];

      state.products = docs
        .map((doc) => parseFirestoreDocument(doc))
        .filter(Boolean)
        .sort((a, b) => getSortScore(b) - getSortScore(a));

      if (!state.selectedSlug && state.products.length) {
        state.selectedSlug = state.products[0].slug;
        populateForm(state.products[0]);
        setFormMode('Edit');
      }

      if (state.selectedSlug) {
        const active = state.products.find((product) => product.slug === state.selectedSlug);
        if (active) {
          populateForm(active);
          setFormMode('Edit');
        }
      }

      renderList();
      setStatus(`Loaded ${state.products.length} products`, 'ok');
      setMessage('', 'ok');
    } catch (error) {
      setStatus('Load failed', 'error');
      setMessage(error.message || 'Could not load products.', 'error');
    }
  }

  async function saveProduct(event) {
    event.preventDefault();

    if (!config.apiKey || !config.projectId) {
      setMessage('Missing apiKey/projectId in JS/firebase-config.js', 'error');
      return;
    }

    const product = collectFormProduct();
    const existingIndex = state.products.findIndex((item) => item.slug === product.slug);
    const isCreate = existingIndex < 0;

    if (!product.slug) {
      setMessage('Slug is required.', 'error');
      form.elements.slug.focus();
      return;
    }

    setStatus('Saving product...', 'idle');

    try {
      await requireSessionToken();

      const response = await fetchWithAuth(
        getDocumentUrl(firestoreCollection, product.slug),
        { method: 'PATCH', body: JSON.stringify({ fields: toFirestoreFields(product) }) },
        getAuthHeaders,
      );

      if (!response.ok) {
        const body = await readErrorBody(response);

        if (response.status === 403) {
          const signedInEmail = access.user && access.user.email ? access.user.email : 'unknown';
          const rulesHint = access.isOwner
            ? ' Owner account detected. Firestore rules may currently be read-only (for example, dev rules with products write disabled). Publish Firebase/firestore.rules.active.txt to re-enable admin writes.'
            : '';
          throw new Error(`Permission denied (403). Signed in as ${signedInEmail}. This account is not an authorized Admin for this site.${rulesHint}`);
        }

        throw new Error(`Save failed (${response.status}): ${body}`);
      }

      if (existingIndex >= 0) {
        state.products.splice(existingIndex, 1, product);
      } else {
        state.products.unshift(product);
      }

      state.selectedSlug = product.slug;
      populateForm(product);
      setFormMode('Edit');
      renderList();
      setStatus(`Saved ${product.slug}`, 'ok');
      // Update cached version of this product and broadcast to other tabs
      if (window.ProductCache && typeof window.ProductCache.putOne === 'function') {
        window.ProductCache.putOne(product).catch(function () {});
      } else if (window.ProductCache && typeof window.ProductCache.invalidate === 'function') {
        window.ProductCache.invalidate(product.slug).catch(function () {});
      }
      if (isCreate) {
        showSuccessBanner(`Product ${product.slug} added successfully.`);
        setMessage('New product added and saved to Firebase.', 'ok');
      } else {
        hideSuccessBanner();
        setMessage('Product saved to Firebase successfully.', 'ok');
      }
    } catch (error) {
      hideSuccessBanner();
      setStatus('Save failed', 'error');
      setMessage(error.message || 'Could not save product.', 'error');
    }
  }

  async function deleteSelectedProduct() {
    if (!state.selectedSlug) {
      setMessage('Select a product first to delete.', 'error');
      return;
    }

    const slugToDelete = state.selectedSlug;
    const confirmDelete = window.confirm(`Delete ${slugToDelete}? This cannot be undone.`);
    if (!confirmDelete) {
      return;
    }

    setStatus('Deleting product...', 'idle');

    try {
      await requireSessionToken();

      const response = await fetchWithAuth(
        getDocumentUrl(firestoreCollection, slugToDelete),
        { method: 'DELETE' },
        getAuthOnlyHeaders,
      );

      if (!response.ok) {
        const body = await readErrorBody(response);

        if (response.status === 403) {
          const signedInEmail = access.user && access.user.email ? access.user.email : 'unknown';
          const rulesHint = access.isOwner
            ? ' Owner account detected. Firestore rules may currently be read-only (for example, dev rules with products write disabled). Publish Firebase/firestore.rules.active.txt to re-enable admin writes.'
            : '';
          throw new Error(`Permission denied (403). Signed in as ${signedInEmail}. This account is not an authorized Admin for this site.${rulesHint}`);
        }

        throw new Error(`Delete failed (${response.status}): ${body}`);
      }

      state.products = state.products.filter((item) => item.slug !== slugToDelete);

      if (state.products.length) {
        state.selectedSlug = state.products[0].slug;
        populateForm(state.products[0]);
        setFormMode('Edit');
      } else {
        clearForm();
      }

      renderList();
      setStatus(`Deleted ${slugToDelete}`, 'ok');
      setMessage(`Product ${slugToDelete} deleted from Firebase.`, 'ok');
      // Remove cached version of this product and broadcast to other tabs
      if (window.ProductCache && typeof window.ProductCache.removeOne === 'function') {
        window.ProductCache.removeOne(slugToDelete).catch(function () {});
      } else if (window.ProductCache && typeof window.ProductCache.invalidate === 'function') {
        window.ProductCache.invalidate(slugToDelete).catch(function () {});
      }
    } catch (error) {
      setStatus('Delete failed', 'error');
      setMessage(error.message || 'Could not delete product.', 'error');
    }
  }

  function handleListClick(event) {
    const node = event.target.closest('.entry-card[data-slug]');
    if (!node) return;

    const slug = node.getAttribute('data-slug');
    const product = state.products.find((item) => item.slug === slug);
    if (!product) return;

    state.selectedSlug = slug;
    populateForm(product);
    setFormMode('Edit');
    renderList();
    setMessage('', 'ok');
  }

  // ---------------------------------------------------------------------
  // Access gating: Super Admin is the single hardcoded owner email; Admins
  // are explicitly granted via the siteAdmins collection (mirrors the
  // releaseNotesAdmins pattern used on MOTVIN/updates/admin.html).
  // ---------------------------------------------------------------------

  function setAuthUI() {
    const isSignedIn = Boolean(access.user);
    signInButton.hidden = isSignedIn;
    signOutButton.hidden = !isSignedIn;

    if (!isSignedIn) {
      authPill.textContent = 'Not signed in';
      authPill.removeAttribute('data-state');
      return;
    }

    authPill.textContent = access.isOwner
      ? `Super Admin · ${access.user.email || ''}`
      : access.isAdmin
        ? `Admin · ${access.user.email || ''}`
        : `Signed in · ${access.user.email || ''}`;
    authPill.setAttribute('data-state', access.isAdmin ? 'active' : '');
  }

  function setAccessGate() {
    const isSignedIn = Boolean(access.user);

    if (access.isAdmin) {
      accessGate.hidden = true;
      adminContent.hidden = false;
      usersManagementSection.hidden = !access.isOwner;
      return;
    }

    adminContent.hidden = true;
    accessGate.hidden = false;

    if (!isSignedIn) {
      accessGateTitle.textContent = 'Sign in required';
      accessGateCopy.textContent = 'Sign in with an authorized Google account to manage products.';
    } else if (!access.hasToken) {
      accessGateTitle.textContent = 'Restoring session';
      accessGateCopy.textContent = 'Please wait while your authenticated session is being restored.';
    } else {
      accessGateTitle.textContent = 'Access restricted';
      accessGateCopy.textContent = `${access.user.email || 'This account'} is not an authorized admin for this page. Ask the Super Admin to grant access.`;
    }
  }

  async function checkIsGrantedAdmin(email) {
    if (!email) return false;

    try {
      const response = await fetchWithAuth(
        getDocumentUrl(SITE_ADMINS_COLLECTION, normalizeEmail(email)),
        { method: 'GET' },
        getAuthHeaders,
      );
      if (!response.ok) return false;
      const doc = await response.json();
      const parsed = parseFirestoreValue({ mapValue: { fields: doc.fields || {} } });
      return Boolean(parsed && parsed.active === true);
    } catch {
      return false;
    }
  }

  async function refreshAccessState(user) {
    access.user = user || null;
    const token = user ? await getSessionToken(false) : null;
    access.hasToken = Boolean(token);
    access.isOwner = Boolean(access.hasToken && user && normalizeEmail(user.email) === SUPER_ADMIN_EMAIL);
    access.isAdmin = access.isOwner || (access.hasToken && user ? await checkIsGrantedAdmin(user.email) : false);

    setAuthUI();
    setAccessGate();

    if (access.isAdmin) {
      loadProducts();
      if (access.isOwner) {
        loadSiteAdmins();
      }
    }
  }

  // ---------------------------------------------------------------------
  // Users Management (Super Admin only): grant/suspend/revoke Admin access.
  // ---------------------------------------------------------------------

  function renderSiteAdminsList() {
    if (!usersList) return;

    if (!access.admins.length) {
      usersList.innerHTML = '<div class="empty-state">No admins granted yet.</div>';
      return;
    }

    usersList.innerHTML = access.admins
      .map((admin) => {
        const suspendedClass = admin.active ? '' : 'is-suspended';
        const stateLabel = admin.active ? 'Active' : 'Suspended';
        const toggleLabel = admin.active ? 'Suspend' : 'Reinstate';

        return `
          <div class="entry-card ${suspendedClass}" data-email="${admin.email}">
            <div class="entry-card-head">
              <span class="entry-card-title">${admin.email}</span>
              <span class="entry-card-action">
                <button type="button" class="nav-link nav-link-button" data-action="toggle-admin" data-email="${admin.email}">${toggleLabel}</button>
                <button type="button" class="nav-link nav-link-button nav-link-danger" data-action="remove-admin" data-email="${admin.email}">Remove</button>
              </span>
            </div>
            <p class="entry-card-meta">${stateLabel} · added by ${admin.addedBy || 'unknown'}</p>
          </div>
        `;
      })
      .join('');
  }

  async function loadSiteAdmins() {
    if (!access.isOwner) return;

    try {
      const response = await fetchWithAuth(getCollectionUrl(SITE_ADMINS_COLLECTION), {}, getAuthHeaders);
      if (!response.ok) throw new Error(await readErrorBody(response));

      const payload = await response.json();
      const docs = Array.isArray(payload.documents) ? payload.documents : [];

      access.admins = docs.map((doc) => {
        const fields = doc.fields || {};
        return {
          email: parseFirestoreValue(fields.email) || '',
          role: parseFirestoreValue(fields.role) || 'admin',
          active: parseFirestoreValue(fields.active) === true,
          addedBy: parseFirestoreValue(fields.addedBy) || '',
          addedAt: parseFirestoreValue(fields.addedAt) || '',
        };
      });

      renderSiteAdminsList();
    } catch (error) {
      usersList.innerHTML = `<div class="empty-state">Could not load admins: ${error.message || error}</div>`;
    }
  }

  async function addSiteAdmin(event) {
    event.preventDefault();
    if (!access.isOwner) return;

    const email = normalizeEmail(addAdminEmailInput.value);
    if (!email || !email.includes('@')) {
      setMessage('Enter a valid email to add as an admin.', 'error');
      return;
    }

    try {
      await requireSessionToken();

      const response = await fetchWithAuth(
        getDocumentUrl(SITE_ADMINS_COLLECTION, email),
        {
          method: 'PATCH',
          body: JSON.stringify({
            fields: {
              email: { stringValue: email },
              role: { stringValue: 'admin' },
              active: { booleanValue: true },
              addedBy: { stringValue: access.user ? normalizeEmail(access.user.email) : '' },
              addedAt: { timestampValue: new Date().toISOString() },
            },
          }),
        },
        getAuthHeaders,
      );

      if (!response.ok) throw new Error(await readErrorBody(response));

      addAdminEmailInput.value = '';
      setMessage(`${email} added as an admin.`, 'ok');
      await loadSiteAdmins();
    } catch (error) {
      setMessage(`Could not add admin: ${error.message || error}`, 'error');
    }
  }

  async function toggleSiteAdminActive(email) {
    if (!access.isOwner) return;
    const admin = access.admins.find((item) => item.email === email);
    if (!admin) return;

    try {
      await requireSessionToken();

      const response = await fetchWithAuth(
        getDocumentUrl(SITE_ADMINS_COLLECTION, email),
        {
          method: 'PATCH',
          body: JSON.stringify({
            fields: {
              email: { stringValue: admin.email },
              role: { stringValue: 'admin' },
              active: { booleanValue: !admin.active },
              addedBy: { stringValue: admin.addedBy || '' },
              addedAt: { timestampValue: admin.addedAt || new Date().toISOString() },
            },
          }),
        },
        getAuthHeaders,
      );

      if (!response.ok) throw new Error(await readErrorBody(response));

      setMessage(`${email} ${admin.active ? 'suspended' : 'reinstated'}.`, 'ok');
      await loadSiteAdmins();
    } catch (error) {
      setMessage(`Could not update admin: ${error.message || error}`, 'error');
    }
  }

  async function removeSiteAdmin(email) {
    if (!access.isOwner) return;
    if (!window.confirm(`Remove admin access for ${email}?`)) return;

    try {
      await requireSessionToken();

      const response = await fetchWithAuth(
        getDocumentUrl(SITE_ADMINS_COLLECTION, email),
        { method: 'DELETE' },
        getAuthOnlyHeaders,
      );

      if (!response.ok) throw new Error(await readErrorBody(response));

      setMessage(`${email} removed.`, 'ok');
      await loadSiteAdmins();
    } catch (error) {
      setMessage(`Could not remove admin: ${error.message || error}`, 'error');
    }
  }

  function handleUsersListClick(event) {
    const toggleBtn = event.target.closest('[data-action="toggle-admin"]');
    if (toggleBtn) {
      toggleSiteAdminActive(toggleBtn.getAttribute('data-email'));
      return;
    }

    const removeBtn = event.target.closest('[data-action="remove-admin"]');
    if (removeBtn) {
      removeSiteAdmin(removeBtn.getAttribute('data-email'));
    }
  }

  function initEvents() {
    if (form) form.addEventListener('submit', saveProduct);
    if (productList) productList.addEventListener('click', handleListClick);

    if (searchInput) searchInput.addEventListener('input', renderList);
    if (refreshBtn) refreshBtn.addEventListener('click', loadProducts);

    if (newBtn) {
      newBtn.addEventListener('click', () => {
        clearForm();
        setMessage('Create mode enabled. Fill the form and click Save.', 'ok');
      });
    }

    if (duplicateBtn) duplicateBtn.addEventListener('click', duplicateSelectedProduct);
    if (deleteBtn) deleteBtn.addEventListener('click', deleteSelectedProduct);

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (state.selectedSlug) {
          const product = state.products.find((item) => item.slug === state.selectedSlug);
          if (product) {
            populateForm(product);
            setMessage('Form reset to current selected product.', 'ok');
            return;
          }
        }

        clearForm();
        setMessage('Form reset.', 'ok');
      });
    }

    if (form) {
      form.elements.image.addEventListener('input', () => {
        if (normalizeProductType(form.elements.productType.value) !== 'design-post') {
          updateImagePreview(form.elements.image.value);
        }
      });

      if (form.elements.productType) {
        form.elements.productType.addEventListener('change', () => {
          syncProductTypeImageFields(form.elements.productType.value);
        });
      }

      getGalleryInputs().forEach((input, index) => {
        input.addEventListener('input', () => {
          if (normalizeProductType(form.elements.productType.value) === 'design-post' && index === 0) {
            updateImagePreview(input.value);
          }
        });
      });
    }

    if (signInButton) {
      signInButton.addEventListener('click', async () => {
        if (!window.FirebaseAuthService) return;
        try {
          await window.FirebaseAuthService.loginWithGoogle({ method: 'popup' });
        } catch (error) {
          setMessage(error.message || 'Sign-in failed.', 'error');
        }
      });
    }

    if (signOutButton) {
      signOutButton.addEventListener('click', async () => {
        if (!window.FirebaseAuthService) return;
        await window.FirebaseAuthService.logout();
      });
    }

    if (addAdminForm) addAdminForm.addEventListener('submit', addSiteAdmin);
    if (usersList) usersList.addEventListener('click', handleUsersListClick);
  }

  initEvents();
  clearForm();
  setAuthUI();
  setAccessGate();

  if (window.FirebaseAuthService && typeof window.FirebaseAuthService.onChange === 'function') {
    window.FirebaseAuthService.onChange((user) => {
      refreshAccessState(user);
    });
  }
})();
