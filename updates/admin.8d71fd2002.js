(() => {
  'use strict';

  const firebaseConfig = {
    apiKey: 'AIzaSyBgW94s3aYLnz8_6g9bli42Ev_kNbOAyIM',
    authDomain: 'motvin-prod.firebaseapp.com',
    projectId: 'motvin-prod',
    appId: '1:177361046673:web:7c69a0e2d1755b89558330',
    messagingSenderId: '177361046673',
    storageBucket: 'motvin-prod.firebasestorage.app',
  };

  const app = firebase.apps && firebase.apps.length
    ? firebase.apps[0]
    : firebase.initializeApp(firebaseConfig);

  const auth = firebase.auth(app);
  const db = firebase.firestore(app);
  const storage = firebase.storage ? firebase.storage(app) : null;
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  const COLLECTION_NAME = 'updates-feed';
  const ADMIN_COLLECTION_NAME = 'releaseNotesAdmins';
  const OWNER_ADMIN_EMAILS = ['surendarv638@gmail.com'];
  const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;
  const updatesIndexPath = new URL('./', window.location.href).toString();
  const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const html = document.documentElement;
  const navMenu = document.getElementById('navMenu');
  const navMenuToggle = document.getElementById('navMenuToggle');
  const signInButton = document.getElementById('signInButton');
  const signOutButton = document.getElementById('signOutButton');
  const publishButton = document.getElementById('publishButton');
  const releaseForm = document.getElementById('releaseForm');
  const resetButton = document.getElementById('resetButton');
  const cancelEditButton = document.getElementById('cancelEditButton');
  const deleteButton = document.getElementById('deleteButton');
  const addAdminButton = document.getElementById('addAdminButton');
  const authPill = document.getElementById('authPill');
  const statusBanner = document.getElementById('statusBanner');
  const entriesList = document.getElementById('entriesList');
  const publisherCopy = document.getElementById('publisherCopy');
  const adminAccessSection = document.getElementById('adminAccessSection');
  const adminAccessForm = document.getElementById('adminAccessForm');
  const adminEmailInput = document.getElementById('adminEmail');
  const adminAccessList = document.getElementById('adminAccessList');
  const imagePreviewCard = document.getElementById('imagePreviewCard');
  const imagePreview = document.getElementById('imagePreview');
  const imagePreviewMeta = document.getElementById('imagePreviewMeta');
  const clearImageButton = document.getElementById('clearImageButton');

  let currentEditingId = null;
  let releaseNotes = [];
  let allowedAdminEmails = [];
  let currentUser = null;
  let currentUserIsOwner = false;
  let currentUserIsAdmin = false;
  let activeImagePreviewUrl = '';

  const fields = {
    title: document.getElementById('title'),
    date: document.getElementById('date'),
    description: document.getElementById('description'),
    image: document.getElementById('image'),
    imageUpload: document.getElementById('imageUpload'),
    shareSlug: document.getElementById('shareSlug'),
    shareSummary: document.getElementById('shareSummary'),
    features: document.getElementById('features'),
    improvements: document.getElementById('improvements'),
    fixes: document.getElementById('fixes'),
  };

  function getSystemTheme() {
    return systemThemeQuery.matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    html.setAttribute('data-theme', theme);
  }

  function initTheme() {
    applyTheme(getSystemTheme());
  }

  const handleThemeQueryChange = () => {
    initTheme();
  };

  const handleThemeResync = () => {
    initTheme();
  };

  if (typeof systemThemeQuery.addEventListener === 'function') {
    systemThemeQuery.addEventListener('change', handleThemeQueryChange);
  } else if (typeof systemThemeQuery.addListener === 'function') {
    systemThemeQuery.addListener(handleThemeQueryChange);
  }

  window.addEventListener('focus', handleThemeResync);
  window.addEventListener('pageshow', handleThemeResync);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      handleThemeResync();
    }
  });

  function initMobileNav() {
    if (!navMenu || !navMenuToggle) {
      return;
    }

    const mobileQuery = window.matchMedia('(max-width: 680px)');
    const handleViewportChange = (event) => {
      if (!event.matches) {
        closeMenu();
      }
    };

    function closeMenu() {
      navMenu.classList.remove('is-open');
      navMenuToggle.setAttribute('aria-expanded', 'false');
      navMenuToggle.setAttribute('aria-label', 'Open navigation menu');
    }

    function openMenu() {
      navMenu.classList.add('is-open');
      navMenuToggle.setAttribute('aria-expanded', 'true');
      navMenuToggle.setAttribute('aria-label', 'Close navigation menu');
    }

    navMenuToggle.addEventListener('click', () => {
      const isOpen = navMenu.classList.contains('is-open');
      if (isOpen) {
        closeMenu();
        return;
      }
      openMenu();
    });

    document.addEventListener('click', (event) => {
      if (!mobileQuery.matches) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (navMenu.contains(target) || navMenuToggle.contains(target)) {
        return;
      }

      closeMenu();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    });

    navMenu.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (target.closest('a, button')) {
        closeMenu();
      }
    });

    if (typeof mobileQuery.addEventListener === 'function') {
      mobileQuery.addEventListener('change', handleViewportChange);
    } else if (typeof mobileQuery.addListener === 'function') {
      mobileQuery.addListener(handleViewportChange);
    }

    closeMenu();
  }

  function parseLines(value) {
    return value
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function slugify(value) {
    return String(value || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
  }

  function sanitizeFileName(value) {
    return String(value || 'image')
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      || 'image';
  }

  function formatFileSize(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) {
      return '0 B';
    }

    if (bytes < 1024) {
      return `${bytes} B`;
    }

    const units = ['KB', 'MB', 'GB'];
    let value = bytes / 1024;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }

    return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
  }

  function isOwnerEmail(email) {
    return OWNER_ADMIN_EMAILS.includes(normalizeEmail(email));
  }

  function getCurrentEditingNote() {
    return releaseNotes.find((entry) => entry.id === currentEditingId) || null;
  }

  function revokeImagePreviewUrl() {
    if (activeImagePreviewUrl) {
      URL.revokeObjectURL(activeImagePreviewUrl);
      activeImagePreviewUrl = '';
    }
  }

  function setImagePreviewState(src = '', meta = '', clearLabel = 'Clear') {
    if (!imagePreviewCard || !imagePreview || !imagePreviewMeta || !clearImageButton) {
      return;
    }

    if (!src) {
      imagePreviewCard.hidden = true;
      imagePreview.removeAttribute('src');
      imagePreviewMeta.textContent = '';
      clearImageButton.textContent = clearLabel;
      return;
    }

    imagePreviewCard.hidden = false;
    imagePreview.src = src;
    imagePreviewMeta.textContent = meta;
    clearImageButton.textContent = clearLabel;
  }

  function syncImagePreview() {
    revokeImagePreviewUrl();

    const selectedFile = fields.imageUpload?.files?.[0] || null;
    const imageUrl = fields.image.value.trim();

    if (selectedFile) {
      activeImagePreviewUrl = URL.createObjectURL(selectedFile);
      setImagePreviewState(
        activeImagePreviewUrl,
        `${selectedFile.name} · ${formatFileSize(selectedFile.size)} · Will upload to Firebase Storage when you publish.`,
        'Remove upload',
      );
      return;
    }

    if (imageUrl) {
      const note = getCurrentEditingNote();
      const isStoredInFirebase = Boolean(note?.data?.imageStoragePath && note.data.image === imageUrl);
      setImagePreviewState(
        imageUrl,
        isStoredInFirebase ? 'Using image stored in Firebase Storage.' : 'Using hosted image URL.',
        'Clear URL',
      );
      return;
    }

    setImagePreviewState();
  }

  function clearSelectedImage() {
    if (fields.imageUpload?.files?.length) {
      fields.imageUpload.value = '';
    } else {
      fields.image.value = '';
    }

    syncImagePreview();
  }

  function isManagedStoragePath(path) {
    return typeof path === 'string' && path.startsWith('release-notes/');
  }

  async function uploadImageFile(file, slug) {
    if (!storage) {
      throw new Error('Firebase Storage is not available.');
    }

    const storagePath = `release-notes/${slug || 'update'}-${Date.now()}/${sanitizeFileName(file.name)}`;
    const ref = storage.ref().child(storagePath);
    const metadata = {
      contentType: file.type || 'application/octet-stream',
      cacheControl: 'public,max-age=31536000',
    };

    await ref.put(file, metadata);
    const url = await ref.getDownloadURL();

    return {
      storagePath,
      url,
    };
  }

  async function deleteUploadedImage(path) {
    if (!storage || !isManagedStoragePath(path)) {
      return;
    }

    try {
      await storage.ref().child(path).delete();
    } catch (error) {
      if (String(error?.code || '') === 'storage/object-not-found') {
        return;
      }

      console.error('Failed to delete uploaded image:', error);
    }
  }

  function canManageReleaseNotes() {
    return currentUserIsAdmin;
  }

  function toFirestoreTimestamp(dateValue) {
    const date = new Date(`${dateValue}T12:00:00`);
    return firebase.firestore.Timestamp.fromDate(date);
  }

  function formatDate(timestamp) {
    if (!timestamp) {
      return '';
    }

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function toDateInputValue(timestamp) {
    if (!timestamp) {
      return new Date().toISOString().slice(0, 10);
    }

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Date(date.getTime() - (date.getTimezoneOffset() * 60000))
      .toISOString()
      .slice(0, 10);
  }

  function setBanner(message, tone = 'neutral') {
    statusBanner.hidden = false;
    statusBanner.textContent = message;
    statusBanner.dataset.tone = tone;
  }

  function clearBanner() {
    statusBanner.hidden = true;
    statusBanner.textContent = '';
    delete statusBanner.dataset.tone;
  }

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value || '');
    return div.innerHTML;
  }

  function setFormMode() {
    const isEditing = Boolean(currentEditingId);
    publishButton.textContent = isEditing ? 'Save changes' : 'Publish update';
    cancelEditButton.hidden = !isEditing;
    deleteButton.hidden = !isEditing;
    publishButton.disabled = !canManageReleaseNotes();
    deleteButton.disabled = !canManageReleaseNotes();
    publisherCopy.textContent = isEditing
      ? 'Editing an existing release note. Save changes or delete the selected entry.'
      : 'Sign in, fill in the fields, and publish a new update entry.';
  }

  function setAuthUI(rawUser) {
    // Guest sessions (Firebase Anonymous Auth, used elsewhere for
    // per-account notification read-state) share this same origin's auth
    // persistence, so `rawUser` can be a truthy anonymous object here even
    // for someone who never actually signed in.
    const user = rawUser && !rawUser.isAnonymous ? rawUser : null;
    currentUser = user || null;
    const isSignedIn = Boolean(user);
    signInButton.hidden = isSignedIn;
    signOutButton.hidden = !isSignedIn;
    authPill.textContent = isSignedIn
      ? `Signed in as ${user.displayName || user.email || 'user'}`
      : 'Not signed in';
    authPill.dataset.state = isSignedIn ? 'active' : 'idle';
    adminAccessSection.hidden = !currentUserIsOwner;
    setFormMode();
  }

  function setUnauthorizedState(message) {
    resetFormToCreateMode({ preserveBanner: true });
    entriesList.innerHTML = `<div class="error-state empty-state-compact">${escapeHtml(message)}</div>`;
    adminAccessList.innerHTML = '';
    adminAccessSection.hidden = true;
  }

  async function signIn() {
    clearBanner();
    try {
      // Sign in through the single shared Google auth service (also used by
      // the root site and the MOTVIN app) so login state stays consistent
      // everywhere instead of running an independent sign-in here. This
      // page's own compat `auth.onAuthStateChanged` listener (below) picks
      // up the resulting session automatically once it syncs.
      if (window.FirebaseAuthService) {
        await window.FirebaseAuthService.loginWithGoogle({ method: 'popup' });
      } else {
        await auth.signInWithPopup(provider);
      }
    } catch (error) {
      console.error('Sign-in failed:', error);
      setBanner('Google sign-in failed. Please try again.', 'error');
    }
  }

  async function signOut() {
    clearBanner();
    try {
      if (window.FirebaseAuthService) {
        await window.FirebaseAuthService.logout();
      }
      await auth.signOut();
      window.location.href = updatesIndexPath;
    } catch (error) {
      console.error('Sign-out failed:', error);
      setBanner('Unable to sign out right now.', 'error');
    }
  }

  function buildPayload() {
    return {
      title: fields.title.value.trim(),
      date: toFirestoreTimestamp(fields.date.value),
      description: fields.description.value.trim(),
      image: fields.image.value.trim(),
      imageStoragePath: '',
      changes: {
        features: parseLines(fields.features.value),
        improvements: parseLines(fields.improvements.value),
        fixes: parseLines(fields.fixes.value),
      },
      publishedBy: auth.currentUser?.email || '',
      publishedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: auth.currentUser?.email || '',
    };
  }

  function validateForm() {
    if (!fields.title.value.trim()) {
      return 'Add a feature title.';
    }

    if (!fields.date.value) {
      return 'Choose a publish date.';
    }

    if (!fields.description.value.trim()) {
      return 'Add a short description.';
    }

    const selectedFile = fields.imageUpload?.files?.[0] || null;
    if (selectedFile) {
      if (!storage) {
        return 'Firebase Storage is not available for image uploads.';
      }

      if (!selectedFile.type.startsWith('image/')) {
        return 'Choose an image file to upload.';
      }

      if (selectedFile.size > MAX_IMAGE_SIZE_BYTES) {
        return 'Upload an image smaller than 8 MB.';
      }
    }

    return '';
  }

  function populateForm(note) {
    fields.title.value = note.title || '';
    fields.date.value = toDateInputValue(note.date);
    fields.description.value = note.description || '';
    fields.image.value = note.image || '';
    if (fields.imageUpload) {
      fields.imageUpload.value = '';
    }
    fields.shareSlug.value = note.share?.slug || '';
    fields.shareSummary.value = note.share?.summary || '';
    fields.features.value = (note.changes?.features || []).join('\n');
    fields.improvements.value = (note.changes?.improvements || []).join('\n');
    fields.fixes.value = (note.changes?.fixes || []).join('\n');
    syncImagePreview();
  }

  function resetFormToCreateMode(options = {}) {
    const { preserveBanner = false } = options;
    currentEditingId = null;
    releaseForm.reset();
    initDefaults();
    syncImagePreview();
    setFormMode();
    if (!preserveBanner) {
      clearBanner();
    }
  }

  function beginEdit(noteId) {
    const note = releaseNotes.find((entry) => entry.id === noteId);
    if (!note) {
      return;
    }

    currentEditingId = noteId;
    populateForm(note.data);
    setFormMode();
    setBanner(`Editing “${note.data.title || 'Untitled Update'}”.`, 'neutral');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderEntries() {
    if (!releaseNotes.length) {
      entriesList.innerHTML = '<div class="empty-state empty-state-compact">No release notes published yet.</div>';
      return;
    }

    entriesList.innerHTML = releaseNotes
      .map((note) => {
        const isActive = note.id === currentEditingId;
        const shareSlug = note.data.share?.slug || slugify(note.data.title);
        return `
          <article class="entry-card${isActive ? ' is-active' : ''}" data-note-id="${escapeHtml(note.id)}">
            <div class="entry-card-head">
              <div>
                <h3 class="entry-card-title">${escapeHtml(note.data.title || 'Untitled Update')}</h3>
                <p class="entry-card-meta">${escapeHtml(formatDate(note.data.date))}${shareSlug ? ` · ${escapeHtml(shareSlug)}` : ''}</p>
              </div>
              <button class="nav-link nav-link-button entry-card-action" type="button" data-action="edit" data-note-id="${escapeHtml(note.id)}">Edit</button>
            </div>
            <p class="entry-card-copy">${escapeHtml(note.data.description || 'No description provided.')}</p>
          </article>`;
      })
      .join('');
  }

  function renderAdminAccessList() {
    const ownerItems = OWNER_ADMIN_EMAILS.map((email) => `
      <article class="entry-card is-active">
        <div class="entry-card-head">
          <div>
            <h3 class="entry-card-title">${escapeHtml(email)}</h3>
            <p class="entry-card-meta">Owner access</p>
          </div>
        </div>
      </article>`);

    const invitedItems = allowedAdminEmails.map((email) => `
      <article class="entry-card">
        <div class="entry-card-head">
          <div>
            <h3 class="entry-card-title">${escapeHtml(email)}</h3>
            <p class="entry-card-meta">Allowed admin</p>
          </div>
          <button class="nav-link nav-link-button nav-link-danger entry-card-action" type="button" data-action="remove-admin" data-admin-email="${escapeHtml(email)}">Remove</button>
        </div>
      </article>`);

    adminAccessList.innerHTML = [...ownerItems, ...invitedItems].join('');
  }

  async function loadAdminAccessList() {
    if (!currentUserIsOwner) {
      adminAccessList.innerHTML = '';
      return;
    }

    try {
      const snapshot = await db.collection(ADMIN_COLLECTION_NAME).get();
      allowedAdminEmails = snapshot.docs
        .map((doc) => normalizeEmail(doc.id))
        .filter((email) => email && !isOwnerEmail(email));
      renderAdminAccessList();
    } catch (error) {
      console.error('Failed to load admin access list:', error);
      adminAccessList.innerHTML = '<div class="error-state empty-state-compact">Unable to load admin access list.</div>';
    }
  }

  async function refreshAccessState(user) {
    currentUserIsOwner = false;
    currentUserIsAdmin = false;
    allowedAdminEmails = [];

    if (!user?.email) {
      setAuthUI(user);
      return;
    }

    const email = normalizeEmail(user.email);
    currentUserIsOwner = isOwnerEmail(email);

    if (currentUserIsOwner) {
      currentUserIsAdmin = true;
      setAuthUI(user);
      await loadAdminAccessList();
      return;
    }

    try {
      const doc = await db.collection(ADMIN_COLLECTION_NAME).doc(email).get();
      currentUserIsAdmin = doc.exists;
      setAuthUI(user);
      if (!currentUserIsAdmin) {
        setUnauthorizedState('This account does not have release-notes admin access.');
      }
    } catch (error) {
      console.error('Failed to verify admin access:', error);
      setAuthUI(user);
      setUnauthorizedState('Unable to verify admin access right now.');
    }
  }

  async function loadReleaseNotes() {
    if (!canManageReleaseNotes()) {
      entriesList.innerHTML = '<div class="error-state empty-state-compact">Sign in with an allowed admin account to manage release notes.</div>';
      return;
    }

    entriesList.innerHTML = '<div class="loading-state loading-state-compact"><div class="loading-spinner"></div>Loading existing notes...</div>';

    try {
      const snapshot = await db
        .collection(COLLECTION_NAME)
        .orderBy('date', 'desc')
        .get();

      releaseNotes = snapshot.docs.map((doc) => ({
        id: doc.id,
        data: doc.data(),
      }));

      if (currentEditingId && !releaseNotes.some((note) => note.id === currentEditingId)) {
        resetFormToCreateMode({ preserveBanner: true });
      }

      renderEntries();
    } catch (error) {
      console.error('Failed to load release notes:', error);
      entriesList.innerHTML = '<div class="error-state empty-state-compact">Unable to load release notes.</div>';
    }
  }

  async function getUniqueShareSlug() {
    const baseSlug = slugify(fields.shareSlug.value) || slugify(fields.title.value) || `release-${Date.now()}`;
    let candidate = baseSlug;
    let suffix = 1;

    while (true) {
      const snapshot = await db
        .collection(COLLECTION_NAME)
        .where('share.slug', '==', candidate)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return candidate;
      }

      const duplicateFromAnotherDoc = snapshot.docs.some((doc) => doc.id !== currentEditingId);
      if (!duplicateFromAnotherDoc) {
        return candidate;
      }

      suffix += 1;
      candidate = `${baseSlug}-${suffix}`;
    }
  }

  async function publishUpdate(event) {
    event.preventDefault();
    clearBanner();

    if (!canManageReleaseNotes()) {
      setBanner('This signed-in account cannot publish release notes.', 'error');
      return;
    }

    const validationMessage = validateForm();
    if (validationMessage) {
      setBanner(validationMessage, 'error');
      return;
    }

    const payload = buildPayload();
    const existingNote = getCurrentEditingNote();
    const shareSlug = await getUniqueShareSlug();
    const shareSummary = fields.shareSummary.value.trim() || payload.description;
    const selectedImageFile = fields.imageUpload?.files?.[0] || null;
    let uploadedImageAsset = null;
    let oldImagePathToDelete = '';

    payload.share = {
      slug: shareSlug,
      summary: shareSummary,
      title: payload.title,
    };

    publishButton.disabled = true;
    publishButton.textContent = currentEditingId ? 'Saving...' : 'Publishing...';

    try {
      if (selectedImageFile) {
        uploadedImageAsset = await uploadImageFile(selectedImageFile, shareSlug);
        payload.image = uploadedImageAsset.url;
        payload.imageStoragePath = uploadedImageAsset.storagePath;

        if (existingNote?.data?.imageStoragePath && existingNote.data.imageStoragePath !== uploadedImageAsset.storagePath) {
          oldImagePathToDelete = existingNote.data.imageStoragePath;
        }
      } else if (payload.image) {
        if (existingNote?.data?.imageStoragePath) {
          if (payload.image === existingNote.data.image) {
            payload.imageStoragePath = existingNote.data.imageStoragePath;
          } else {
            oldImagePathToDelete = existingNote.data.imageStoragePath;
            delete payload.imageStoragePath;
          }
        } else {
          delete payload.imageStoragePath;
        }
      } else {
        if (existingNote?.data?.imageStoragePath) {
          oldImagePathToDelete = existingNote.data.imageStoragePath;
        }

        delete payload.image;
        delete payload.imageStoragePath;
      }

      if (currentEditingId) {
        if (existingNote?.data?.publishedAt) {
          payload.publishedAt = existingNote.data.publishedAt;
        }
        await db.collection(COLLECTION_NAME).doc(currentEditingId).set(payload, { merge: true });
        if (oldImagePathToDelete) {
          await deleteUploadedImage(oldImagePathToDelete);
        }
        setBanner(`Release note updated. Share link: ${window.location.origin}${window.location.pathname.replace('admin.html', 'files.html')}?release=${shareSlug}`, 'success');
      } else {
        await db.collection(COLLECTION_NAME).add(payload);
        setBanner(`Release note published. Share link: ${window.location.origin}${window.location.pathname.replace('admin.html', 'files.html')}?release=${shareSlug}`, 'success');
      }

      resetFormToCreateMode({ preserveBanner: true });
      await loadReleaseNotes();
    } catch (error) {
      console.error('Publish failed:', error);
      if (uploadedImageAsset?.storagePath) {
        await deleteUploadedImage(uploadedImageAsset.storagePath);
      }
      const code = String(error?.code || '');
      if (code === 'permission-denied') {
        setBanner('Firestore rules blocked this action. Deploy the updated rules first.', 'error');
      } else if (code.startsWith('storage/')) {
        setBanner('Unable to upload the selected image right now. Check Firebase Storage rules and try again.', 'error');
      } else {
        setBanner('Unable to save the release note right now.', 'error');
      }
    } finally {
      setFormMode();
    }
  }

  async function deleteCurrentRelease() {
    if (!currentEditingId) {
      return;
    }

    if (!canManageReleaseNotes()) {
      setBanner('This signed-in account cannot delete release notes.', 'error');
      return;
    }

    const existingNote = releaseNotes.find((note) => note.id === currentEditingId);
    const title = existingNote?.data?.title || 'this release note';
    const confirmed = window.confirm(`Delete ${title}? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    deleteButton.disabled = true;

    try {
      await db.collection(COLLECTION_NAME).doc(currentEditingId).delete();
      await deleteUploadedImage(existingNote?.data?.imageStoragePath || '');
      resetFormToCreateMode({ preserveBanner: true });
      setBanner('Release note deleted.', 'success');
      await loadReleaseNotes();
    } catch (error) {
      console.error('Delete failed:', error);
      setBanner('Unable to delete the release note right now.', 'error');
    } finally {
      deleteButton.disabled = !canManageReleaseNotes();
    }
  }

  async function addAdminEmail(event) {
    event.preventDefault();

    if (!currentUserIsOwner) {
      setBanner('Only the owner can add another admin.', 'error');
      return;
    }

    const email = normalizeEmail(adminEmailInput.value);
    if (!email) {
      setBanner('Enter an email address to add an admin.', 'error');
      return;
    }

    if (isOwnerEmail(email)) {
      setBanner('That email already has owner access.', 'neutral');
      return;
    }

    addAdminButton.disabled = true;

    try {
      await db.collection(ADMIN_COLLECTION_NAME).doc(email).set({
        email,
        addedAt: firebase.firestore.FieldValue.serverTimestamp(),
        addedBy: currentUser?.email || '',
      }, { merge: true });
      adminEmailInput.value = '';
      setBanner(`Added ${email} as an allowed admin.`, 'success');
      await loadAdminAccessList();
    } catch (error) {
      console.error('Failed to add admin:', error);
      setBanner('Unable to add that admin right now.', 'error');
    } finally {
      addAdminButton.disabled = false;
    }
  }

  async function removeAdminEmail(email) {
    if (!currentUserIsOwner) {
      setBanner('Only the owner can remove admins.', 'error');
      return;
    }

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || isOwnerEmail(normalizedEmail)) {
      return;
    }

    const confirmed = window.confirm(`Remove ${normalizedEmail} from allowed admins?`);
    if (!confirmed) {
      return;
    }

    try {
      await db.collection(ADMIN_COLLECTION_NAME).doc(normalizedEmail).delete();
      setBanner(`Removed ${normalizedEmail} from allowed admins.`, 'success');
      await loadAdminAccessList();
    } catch (error) {
      console.error('Failed to remove admin:', error);
      setBanner('Unable to remove that admin right now.', 'error');
    }
  }

  function initDefaults() {
    fields.date.value = new Date().toISOString().slice(0, 10);
  }

  initMobileNav();
  signInButton.addEventListener('click', signIn);
  signOutButton.addEventListener('click', signOut);
  releaseForm.addEventListener('submit', publishUpdate);
  adminAccessForm.addEventListener('submit', addAdminEmail);
  fields.image.addEventListener('input', syncImagePreview);
  fields.imageUpload?.addEventListener('change', syncImagePreview);
  clearImageButton?.addEventListener('click', clearSelectedImage);
  resetButton.addEventListener('click', () => {
    releaseForm.reset();
    initDefaults();
    syncImagePreview();
    clearBanner();
  });
  cancelEditButton.addEventListener('click', () => {
    resetFormToCreateMode();
  });
  deleteButton.addEventListener('click', deleteCurrentRelease);
  entriesList.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const actionButton = target.closest('[data-action="edit"]');
    if (!(actionButton instanceof HTMLElement)) {
      return;
    }

    const noteId = actionButton.dataset.noteId;
    if (!noteId) {
      return;
    }

    beginEdit(noteId);
    renderEntries();
  });
  adminAccessList.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const removeButton = target.closest('[data-action="remove-admin"]');
    if (!(removeButton instanceof HTMLElement)) {
      return;
    }

    const email = removeButton.dataset.adminEmail;
    if (!email) {
      return;
    }

    removeAdminEmail(email);
  });

  auth.onAuthStateChanged(async (user) => {
    setAuthUI(user);

    if (!user) {
      currentUserIsAdmin = false;
      currentUserIsOwner = false;
      allowedAdminEmails = [];
      setUnauthorizedState('Sign in with an allowed admin account to manage release notes.');
      return;
    }

    await refreshAccessState(user);

    if (currentUserIsAdmin) {
      await loadReleaseNotes();
      if (currentUserIsOwner) {
        setBanner('Signed in as owner. You can manage release notes and allowed admins.', 'success');
      } else {
        setBanner('Signed in as an allowed admin. You can manage release notes.', 'success');
      }
    }
  });

  initTheme();
  initDefaults();
  setUnauthorizedState('Sign in with an allowed admin account to manage release notes.');
  // Paint an optimistic best-guess auth state synchronously from the shared,
  // same-origin auth snapshot: `auth.currentUser` is still null here on a
  // fresh page load since this compat SDK's own async restore (below, via
  // onAuthStateChanged) hasn't resolved yet. Admin access is re-verified
  // once that resolves.
  const cachedAuthUser = window.FirebaseAuthService && typeof window.FirebaseAuthService.getCachedUser === 'function'
    ? window.FirebaseAuthService.getCachedUser()
    : null;
  setAuthUI(auth.currentUser || cachedAuthUser);
  setFormMode();
  syncImagePreview();
})();
