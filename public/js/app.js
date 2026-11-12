
const API_URL = 'http://localhost:5000/api';

const UNIVERSITY_EMAIL_PATTERN = /^[^\s@]+@[a-z]{1,4}\.saiuniversity\.edu\.in$/i;

// =====================================
// USER AUTHENTICATION HELPERS
// =====================================

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('lost2foundUser'));
  } catch {
    return null;
  }
}

function saveUser(user) {
  localStorage.setItem('lost2foundUser', JSON.stringify(user));
}

function logout() {
  localStorage.removeItem('lost2foundUser');
  localStorage.removeItem('token');
  location.href = 'login.html';
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('token');

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || data.message || 'Something went wrong.');
  }

  return data;
}

function showMessage(element, message, type = 'error') {
  if (!element) return;

  element.textContent = message;
  element.className = `message ${type}`;
}

function formatDate(value) {
  if (!value) return 'Date not provided';

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? 'Date not provided'
    : date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
}

function updateNavigation() {
  const nav = document.getElementById('authNavButtons');
  if (!nav) return;

  const user = getStoredUser();

  if (!user) {
    nav.innerHTML = `
      <a href="login.html">Sign in</a>
      <a class="nav-cta" href="register.html">Create account</a>
    `;
  } else {
    nav.innerHTML = `
      <a href="${user.role === 'admin' ? 'admin.html' : 'dashboard.html'}">
        Dashboard
      </a>
      <button class="link-button" onclick="logout()">Sign out</button>
    `;
  }
}

// =====================================
// LISTING CARDS
// =====================================

function buildItemCard(item, index) {
  const status = item.isSample
    ? 'Sample listing'
    : (item.status || 'Open');

  const recovered =
    String(item.status || '').toLowerCase() === 'recovered';

  const image = item.imageUrl
    ? `<img class="item-image"
        src="${escapeHtml(item.imageUrl)}"
        alt="${escapeHtml(item.title)}"
        loading="lazy"
        onerror="this.closest('.item-image-wrap')?.classList.add('image-failed'); this.remove()">`
    : '';

  return `
    <article class="item-card listing-clickable"
      data-item-index="${index}"
      tabindex="0"
      role="button"
      aria-label="View details for ${escapeHtml(item.title)}">

      <div class="item-image-wrap ${image ? '' : 'image-failed'}">
        ${image}
        <span class="image-placeholder" aria-hidden="true">✳</span>
      </div>

      <div class="item-card-top">
        <span class="tag ${item.listingType === 'Lost' ? 'tag-lost' : 'tag-found'}">
          ${escapeHtml(item.listingType)}
        </span>

        <span class="status ${recovered ? 'status-recovered' : ''}">
          ${escapeHtml(status)}
        </span>
      </div>

      <h3>${escapeHtml(item.title)}</h3>

      <p class="item-description">
        ${escapeHtml(item.description || 'No additional description provided.')}
      </p>

      <div class="item-meta">
        <span>${escapeHtml(item.category || 'Other')}</span>
        <span>${escapeHtml(item.location || 'Location not provided')}</span>
        <span>${formatDate(item.date)}</span>
      </div>

      <button class="claim-button view-details-button" type="button">
        View details <span aria-hidden="true">→</span>
      </button>
    </article>
  `;
}

// =====================================
// LISTING DETAILS POPUP STYLING
// =====================================

function addListingDetailsStyles() {
  if (document.getElementById('listingDetailsStyles')) return;

  const style = document.createElement('style');
  style.id = 'listingDetailsStyles';

  style.textContent = `

    .claim-request-section {
      margin-top: 24px;
      padding: 20px;
      background: #f0eee4;
      border-radius: 12px;
    }

    .claim-request-section h3 {
      margin: 0 0 8px;
    }

    .claim-request-section p {
      color: #526257;
      line-height: 1.6;
    }

    .claim-request-section textarea {
      width: 100%;
      box-sizing: border-box;
      padding: 12px;
      margin: 10px 0;
      border: 1px solid #c9cbbd;
      border-radius: 8px;
      font: inherit;
      resize: vertical;
    }

    .claim-request-section button {
      padding: 12px 18px;
      border: 0;
      border-radius: 8px;
      background: #294b38;
      color: white;
      cursor: pointer;
    }

    .claim-request-section button:disabled {
      opacity: .6;
      cursor: not-allowed;
    }

    .listing-clickable {
      cursor: pointer;
      transition: transform .18s ease, box-shadow .18s ease;
    }

    .listing-clickable:hover {
      transform: translateY(-3px);
    }

    .listing-clickable:focus-visible {
      outline: 3px solid #b58a43;
      outline-offset: 3px;
    }

    .view-details-button {
      cursor: pointer;
    }

    .listing-detail-backdrop {
      position: fixed;
      inset: 0;
      z-index: 9999;
      background: rgba(15,28,22,.68);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      overflow-y: auto;
    }

    .listing-detail-panel {
      position: relative;
      background: #fbf8ef;
      color: #20372c;
      width: min(720px,100%);
      max-height: 90vh;
      overflow-y: auto;
      border-radius: 18px;
      padding: clamp(22px,4vw,38px);
      box-shadow: 0 24px 80px rgba(0,0,0,.28);
    }

    .listing-detail-close {
      position: absolute;
      right: 18px;
      top: 14px;
      border: 0;
      background: transparent;
      font-size: 28px;
      cursor: pointer;
      color: #20372c;
    }

    .listing-detail-kicker {
      font-size: 12px;
      letter-spacing: .12em;
      text-transform: uppercase;
      color: #718174;
      margin: 0 36px 10px 0;
    }

    .listing-detail-panel h2 {
      font-size: clamp(26px,4vw,36px);
      line-height: 1.12;
      margin: 0 35px 14px 0;
    }

    .listing-detail-description {
      line-height: 1.7;
      color: #526257;
    }

    .listing-detail-facts {
      display: grid;
      grid-template-columns: repeat(2,minmax(0,1fr));
      gap: 12px;
      margin: 22px 0;
    }

    .listing-detail-fact {
      padding: 13px 15px;
      background: #f0eee4;
      border-radius: 10px;
      min-width: 0;
    }

    .listing-detail-fact small {
      display: block;
      color: #718174;
      margin-bottom: 5px;
    }

    .listing-detail-fact strong {
      overflow-wrap: anywhere;
    }

    .related-listings {
      border-top: 1px solid #deded2;
      margin-top: 25px;
      padding-top: 20px;
    }

    .related-listings h3 {
      margin: 0 0 12px;
    }

    .related-listing {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid #e4e1d7;
      cursor: pointer;
    }

    .related-listing span:last-child {
      color: #718174;
      font-size: 13px;
      white-space: nowrap;
    }

    .related-empty {
      color: #718174;
      font-size: 14px;
    }

    @media(max-width:520px) {
      .listing-detail-facts {
        grid-template-columns: 1fr;
      }

      .listing-detail-backdrop {
        padding: 10px;
      }

      .listing-detail-panel {
        max-height: 94vh;
      }
    }
  `;

  document.head.appendChild(style);
}

// =====================================
// SHOW LISTING DETAILS
// =====================================

function showListingDetails(item, allItems) {
  addListingDetailsStyles();

  document.getElementById('listingDetailBackdrop')?.remove();

  const user = getStoredUser();

  const isOwner =
    user &&
    item.postedBy &&
    String(item.postedBy._id || item.postedBy) === String(user.id);

  const canClaim =
  Boolean(
    user &&
    user.role !== 'admin' &&
    item._id &&
    String(item.listingType || '').toLowerCase() === 'found' &&
    String(item.status || 'Open').toLowerCase() === 'open' &&
    !isOwner
  );

console.log('RECOVERY FORM DEBUG:', {
  loggedInUser: user,
  itemId: item._id,
  listingType: item.listingType,
  status: item.status,
  isOwner,
  canClaim
});

  const related = allItems
    .filter(other =>
      other !== item &&
      String(other.category || '').toLowerCase() ===
      String(item.category || '').toLowerCase()
    )
    .slice(0, 3);

  const backdrop = document.createElement('div');
  backdrop.className = 'listing-detail-backdrop';
  backdrop.id = 'listingDetailBackdrop';

  backdrop.innerHTML = `
    <section class="listing-detail-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="listingDetailTitle">

      <button class="listing-detail-close"
        type="button"
        aria-label="Close details">&times;</button>

      <p class="listing-detail-kicker">
        ${escapeHtml(item.listingType || 'Item')} ·
        ${escapeHtml(item.category || 'Other')}
      </p>

      <h2 id="listingDetailTitle">
        ${escapeHtml(item.title || 'Untitled item')}
      </h2>

      <p class="listing-detail-description">
        ${escapeHtml(item.description || 'No additional description was provided for this listing.')}
      </p>

      <div class="listing-detail-facts">
        <div class="listing-detail-fact">
          <small>Last seen / found at</small>
          <strong>${escapeHtml(item.location || 'Not specified')}</strong>
        </div>

        <div class="listing-detail-fact">
          <small>Date</small>
          <strong>${formatDate(item.date)}</strong>
        </div>

        <div class="listing-detail-fact">
          <small>Listing type</small>
          <strong>${escapeHtml(item.listingType || 'Not specified')}</strong>
        </div>

        <div class="listing-detail-fact">
          <small>Current status</small>
          <strong>${escapeHtml(item.status || 'Open')}</strong>
        </div>
      </div>

      ${
        canClaim
          ? `
            <div class="claim-request-section">
              <h3>Is this your lost item?</h3>
              <p>Submit a recovery request and describe how you can prove ownership.</p>

              <form id="recoveryRequestForm">
                <textarea
                  id="recoveryProof"
                  rows="4"
                  required
                  minlength="5"
                  maxlength="1000"
                  placeholder="Describe identifying details, such as the item's colour, contents, brand or unique marks..."
                ></textarea>

                <button type="submit" class="claim-button">
                  Submit Recovery Request
                </button>

                <p id="recoveryRequestMessage" aria-live="polite"></p>
              </form>
            </div>
          `
          : ''
      }

      <div class="related-listings">
        <h3>Related listings</h3>

        ${
          related.length
            ? related.map(other => `
                <div class="related-listing"
                  role="button"
                  tabindex="0"
                  data-related-index="${allItems.indexOf(other)}">

                  <strong>${escapeHtml(other.title)}</strong>

                  <span>
                    ${escapeHtml(other.listingType || '')} ·
                    ${formatDate(other.date)}
                  </span>
                </div>
              `).join('')
            : '<p class="related-empty">No other listings in this category yet.</p>'
        }
      </div>
    </section>
  `;

  document.body.appendChild(backdrop);

  const close = () => {
    backdrop.remove();
    document.removeEventListener('keydown', escapeHandler);
  };

  backdrop.querySelector('.listing-detail-close')
    .addEventListener('click', close);

  backdrop.addEventListener('click', event => {
    if (event.target === backdrop) close();
  });

  // SUBMIT RECOVERY REQUEST
  const recoveryForm = document.getElementById('recoveryRequestForm');

  recoveryForm?.addEventListener('submit', async event => {
    event.preventDefault();

    const proof = document.getElementById('recoveryProof').value.trim();
    const message = document.getElementById('recoveryRequestMessage');
    const button = recoveryForm.querySelector('button[type="submit"]');

    if (proof.length < 5) {
      showMessage(message, 'Please provide at least 5 characters of proof.');
      return;
    }

    button.disabled = true;
    button.textContent = 'Submitting...';

    try {
      await apiRequest('/claims', {
        method: 'POST',
        body: JSON.stringify({
          itemId: item._id,
          proofDescription: proof
        })
      });

      showMessage(
        message,
        'Recovery request submitted successfully!',
        'success'
      );

      button.textContent = 'Request Submitted';

      document.getElementById('recoveryProof').disabled = true;

    } catch (error) {
      showMessage(message, error.message);
      button.disabled = false;
      button.textContent = 'Submit Recovery Request';
    }
  });

  backdrop.querySelectorAll('[data-related-index]').forEach(element => {
    const openRelated = () => {
      const relatedItem = allItems[Number(element.dataset.relatedIndex)];

      if (relatedItem) {
        showListingDetails(relatedItem, allItems);
      }
    };

    element.addEventListener('click', openRelated);

    element.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openRelated();
      }
    });
  });

  const escapeHandler = event => {
    if (event.key === 'Escape') close();
  };

  document.addEventListener('keydown', escapeHandler);
}


// =====================================
// DEFAULT SAMPLE LISTINGS
// =====================================

const DEFAULT_SAMPLE_ITEMS = [
  {
    listingType: 'Lost',
    title: 'Black wireless earbuds',
    category: 'Electronics',
    description: 'A compact black earbuds case, possibly left behind after a lecture. The case has a small scratch near the charging port.',
    location: 'Academic Block · Lecture Hall',
    date: '2026-11-10',
    status: 'Open',
    imageUrl: 'https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?w=900'
  },
  {
    listingType: 'Found',
    title: 'Blue stainless-steel bottle',
    category: 'Accessories',
    description: 'A blue reusable water bottle found after an afternoon class. It was left near the library seating area.',
    location: 'Central Library',
    date: '2026-11-09',
    status: 'Open',
    imageUrl: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=900'
  },
  {
    listingType: 'Lost',
    title: 'Engineering mathematics textbook',
    category: 'Books',
    description: 'An engineering mathematics textbook with handwritten notes inside the front cover. Please contact if found.',
    location: 'Library Study Area',
    date: '2026-11-08',
    status: 'Open',
    imageUrl: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=900'
  },
  {
    listingType: 'Found',
    title: 'Student ID card',
    category: 'ID Cards',
    description: 'A university ID card was found near the common seating area. The card has been kept safely.',
    location: 'Student Commons',
    date: '2026-11-07',
    status: 'Open',
    imageUrl: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=900'
  },
  {
    listingType: 'Lost',
    title: 'Black laptop sleeve',
    category: 'Accessories',
    description: 'A black laptop sleeve suitable for a 14-inch laptop, with a small zip pocket on the front.',
    location: 'Computer Lab',
    date: '2026-11-06',
    status: 'Open',
    imageUrl: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=900'
  },
  {
    listingType: 'Found',
    title: 'Grey backpack',
    category: 'Bags',
    description: 'A grey backpack was found after a club meeting. It has multiple compartments and was left near the auditorium.',
    location: 'Main Auditorium',
    date: '2026-11-05',
    status: 'Open',
    imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=900'
  }
];

// =====================================
// LOAD LISTINGS
// =====================================

async function loadItems() {
  const container = document.getElementById('itemsContainer');
  if (!container) return;

  container.innerHTML = '<p class="muted">Loading listings…</p>';

  const params = new URLSearchParams();

  const search = document.getElementById('searchInput')?.value.trim();
  const category = document.getElementById('categoryFilter')?.value;
  const type = document.getElementById('typeFilter')?.value;
  const locationTerm = document.getElementById('locationFilter')?.value.trim().toLowerCase() || '';
  const sort = document.getElementById('sortBy')?.value || 'newest';

  if (search) params.set('search', search);
  if (category) params.set('category', category);
  if (type) params.set('listingType', type);

  params.set('sortBy', sort);

  try {
    const items = await apiRequest(`/items?${params.toString()}`);

    if (!items.length && (search || category || type)) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No matching listings</h3>
          <p>Try changing your search or filters.</p>
        </div>
      `;

      const resultsLabel = document.getElementById('resultsLabel');
      if (resultsLabel) resultsLabel.textContent = 'No matching listings';

      return;
    }

    const sourceListings = items.length ? items : DEFAULT_SAMPLE_ITEMS;

    const listings = locationTerm
      ? sourceListings.filter(item =>
          String(item.location || '').toLowerCase().includes(locationTerm)
        )
      : sourceListings;

    const hasFilters = Boolean(search || category || type || locationTerm);

    if (!listings.length && hasFilters) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No matching listings</h3>
          <p>Try changing your search or filters.</p>
        </div>
      `;
      return;
    }

    const resultsLabel = document.getElementById('resultsLabel');

    if (resultsLabel) {
      resultsLabel.textContent =
        `${listings.length} ${listings.length === 1 ? 'listing' : 'listings'} shown`;
    }

    container.innerHTML = listings
      .map((item, index) => buildItemCard(item, index))
      .join('');

    container.querySelectorAll('.listing-clickable').forEach(element => {
      const openDetails = () =>
        showListingDetails(listings[Number(element.dataset.itemIndex)], listings);

      element.addEventListener('click', openDetails);

      element.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openDetails();
        }
      });
    });

  } catch (error) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>Could not load listings</h3>
        <p>${escapeHtml(error.message)}</p>
      </div>
    `;
  }
}

// =====================================
// LOGIN
// =====================================

async function handleLogin(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const email = form.email.value.trim().toLowerCase();
  const password = form.password.value;
  const alertBox = document.getElementById('loginAlert');

  if (!UNIVERSITY_EMAIL_PATTERN.test(email)) {
    showMessage(
      alertBox,
      'Use your Sai University college email (for example, name@scds.saiuniversity.edu.in).'
    );
    return;
  }

  const button = document.getElementById('loginSubmit');

  button.disabled = true;
  button.textContent = 'Signing in…';

  try {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    saveUser(data.user);
    localStorage.setItem('token', data.token);

    location.href = data.user.role === 'admin'
      ? 'admin.html'
      : 'dashboard.html';

  } catch (error) {
    showMessage(alertBox, error.message);
    button.disabled = false;
    button.textContent = 'Sign in';
  }
}

// =====================================
// REGISTRATION
// =====================================

async function handleRegistration(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const name = form.name.value.trim();
  const email = form.email.value.trim().toLowerCase();
  const password = form.password.value;
  const confirm = form.confirmPassword.value;
  const alertBox = document.getElementById('registerAlert');

  if (!UNIVERSITY_EMAIL_PATTERN.test(email)) {
    showMessage(alertBox, 'Enter a valid Sai University college email.');
    return;
  }

  if (password.length < 8) {
    showMessage(alertBox, 'Password must contain at least 8 characters.');
    return;
  }

  if (password !== confirm) {
    showMessage(alertBox, 'Passwords do not match.');
    return;
  }

  const button = document.getElementById('registerSubmit');

  button.disabled = true;
  button.textContent = 'Creating account…';

  try {
    await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });

    showMessage(
      alertBox,
      'Account created successfully. Redirecting to sign in…',
      'success'
    );

    form.reset();

    setTimeout(() => {
      location.href = 'login.html';
    }, 1200);

  } catch (error) {
    showMessage(alertBox, error.message);
    button.disabled = false;
    button.textContent = 'Create account';
  }
}

// =====================================
// CLAIM ITEM
// =====================================

async function claimItem(itemId) {
  const user = getStoredUser();

  if (!user) {
    location.href = 'login.html';
    return;
  }

  const proofDescription = prompt(
    'Describe a detail that helps verify this item belongs to you:'
  );

  if (!proofDescription || !proofDescription.trim()) return;

  try {
    await apiRequest('/claims', {
      method: 'POST',
      body: JSON.stringify({
        itemId,
        userId: user.id,
        proofDescription: proofDescription.trim()
      })
    });

    alert('Your claim has been submitted.');
    loadItems();

  } catch (error) {
    alert(error.message);
  }
}

// =====================================
// STUDENT CLAIMS
// =====================================

async function loadUserClaims() {
  const user = getStoredUser();
  const container = document.getElementById('userClaimsContainer');

  if (!user || !container) return;

  container.innerHTML = '<p class="muted">Loading your claims…</p>';

  try {
    const claims = await apiRequest(
      `/claims?userId=${encodeURIComponent(user.id)}`
    );

    if (!claims.length) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No claims yet</h3>
          <p>When you submit a claim, its status will appear here.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Type</th>
            <th>Submitted</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          ${claims.map(c => `
            <tr>
              <td>${escapeHtml(c.itemId?.title || 'Item unavailable')}</td>
              <td>${escapeHtml(c.itemId?.listingType || '—')}</td>
              <td>${formatDate(c.dateSubmitted)}</td>
              <td>
                <span class="status-pill ${String(c.status).toLowerCase()}">
                  ${escapeHtml(c.status)}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

  } catch (error) {
    container.innerHTML = `
      <p class="message error">${escapeHtml(error.message)}</p>
    `;
  }
}

// =====================================
// ADMIN STATS
// =====================================

async function loadAdminStats() {
  const user = getStoredUser();

  if (!user || user.role !== 'admin') return;

  try {
    const stats = await apiRequest('/admin/stats');

    const values = {
      'total-items': stats.totalItems,
      'lost-items': stats.lostCount,
      'found-items': stats.foundCount,
      'total-claims': stats.totalClaims,
      'pending-claims': stats.pendingClaims,
      'approved-claims': stats.approvedClaims,
      'total-users': stats.totalUsers
    };

    Object.entries(values).forEach(([id, value]) => {
      const element = document.getElementById(id);

      if (element) {
        element.textContent = value ?? 0;
      }
    });

  } catch (error) {
    console.error('Admin statistics error:', error);

    [
      'total-items',
      'lost-items',
      'found-items',
      'total-claims',
      'pending-claims',
      'approved-claims',
      'total-users'
    ].forEach(id => {
      const element = document.getElementById(id);

      if (element) element.textContent = '—';
    });
  }
}

// =====================================
// ADMIN ITEM MANAGEMENT
// =====================================

async function loadAdminItems() {
  const user = getStoredUser();
  const container = document.getElementById('admin-items-container');

  if (!user || user.role !== 'admin' || !container) return;

  container.innerHTML = '<p class="muted">Loading campus items...</p>';

  try {
    const items = await apiRequest('/admin/items');

    if (!items.length) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No items reported yet</h3>
          <p>New lost and found reports will appear here.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Type</th>
            <th>Category</th>
            <th>Location</th>
            <th>Reported By</th>
            <th>Date</th>
            <th>Status</th>
            <th>Update</th>
          </tr>
        </thead>

        <tbody>
          ${items.map(item => `
            <tr>
              <td>${escapeHtml(item.title)}</td>
              <td>${escapeHtml(item.listingType)}</td>
              <td>${escapeHtml(item.category || 'Other')}</td>
              <td>${escapeHtml(item.location || '—')}</td>
              <td>${escapeHtml(item.postedBy?.name || 'Unknown')}</td>
              <td>${formatDate(item.date)}</td>
              <td>${escapeHtml(item.status || 'Open')}</td>

              <td>
                <select id="item-status-${escapeHtml(item._id)}">
                  <option value="Open" ${item.status === 'Open' ? 'selected' : ''}>Open</option>
                  <option value="Claimed" ${item.status === 'Claimed' ? 'selected' : ''}>Claimed</option>
                  <option value="Resolved" ${item.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                </select>

                <button
                  type="button"
                  class="small-action approve"
                  onclick="updateItemStatus('${escapeHtml(item._id)}')">
                  Save
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

  } catch (error) {
    container.innerHTML = `
      <p class="message error">${escapeHtml(error.message)}</p>
    `;
  }
}

// =====================================
// UPDATE ITEM STATUS
// =====================================

async function updateItemStatus(itemId) {
  const select = document.getElementById(`item-status-${itemId}`);

  if (!select) return;

  try {
    const result = await apiRequest(
      `/admin/items/${encodeURIComponent(itemId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          status: select.value
        })
      }
    );

    alert(result.message || 'Item status updated successfully!');

    await Promise.all([
      loadAdminItems(),
      loadAdminStats()
    ]);

  } catch (error) {
    alert(error.message);
  }
}

// =====================================
// ADMIN CLAIMS
// =====================================

async function loadAdminClaims() {
  const user = getStoredUser();

  // Updated to match admin.html
  const container = document.getElementById('admin-claims-container');

  if (!user || user.role !== 'admin' || !container) return;

  container.innerHTML = '<p class="muted">Loading claims…</p>';

  try {
    const claims = await apiRequest('/claims?role=admin');

    if (!claims.length) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No claims submitted</h3>
          <p>New claims will appear here.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Claimed by</th>
            <th>Proof</th>
            <th>Date</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          ${claims.map(c => `
            <tr>
              <td>${escapeHtml(c.itemId?.title || 'Unavailable')}</td>

              <td>
                ${escapeHtml(c.userId?.name || 'Unknown')}
                <small>${escapeHtml(c.userId?.email || '')}</small>
              </td>

              <td>${escapeHtml(c.proofDescription)}</td>
              <td>${formatDate(c.dateSubmitted)}</td>

              <td>
                <span class="status-pill ${String(c.status).toLowerCase()}">
                  ${escapeHtml(c.status)}
                </span>
              </td>

              <td>
                ${c.status === 'Pending'
                  ? `<button class="small-action approve"
                       data-status="Approved"
                       data-id="${escapeHtml(c._id)}">Approve</button>

                     <button class="small-action reject"
                       data-status="Rejected"
                       data-id="${escapeHtml(c._id)}">Reject</button>`
                  : '—'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    container.querySelectorAll('[data-status]').forEach(button => {
      button.addEventListener('click', () =>
        updateClaimStatus(button.dataset.id, button.dataset.status)
      );
    });

  } catch (error) {
    container.innerHTML = `
      <p class="message error">${escapeHtml(error.message)}</p>
    `;
  }
}

// =====================================
// UPDATE CLAIM STATUS
// =====================================

async function updateClaimStatus(id, status) {
  if (!confirm(`${status} this claim?`)) return;

  try {
    await apiRequest(`/claims/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });

    await Promise.all([
      loadAdminClaims(),
      loadAdminStats()
    ]);

  } catch (error) {
    alert(error.message);
  }
}

// =====================================
// HOMEPAGE COMMUNITY STATISTICS
// =====================================

async function loadHomepageStats() {
  // Only run on pages that use the homepage statistics IDs.
  if (!document.getElementById('totalItems')) return;

  try {
    const items = await apiRequest('/items');

    const total = Array.isArray(items) ? items.length : 0;
    const lost = items.filter(item => item.listingType === 'Lost').length;
    const found = items.filter(item => item.listingType === 'Found').length;

    const recovered = items.filter(item =>
      String(item.status || '').toLowerCase() === 'recovered'
    ).length;

    const values = {
      totalItems: total,
      lostCount: lost,
      foundCount: found,
      recoveredCount: recovered
    };

    Object.entries(values).forEach(([id, value]) => {
      const element = document.getElementById(id);

      if (element) element.textContent = value;
    });

  } catch (error) {
    ['totalItems', 'lostCount', 'foundCount', 'recoveredCount'].forEach(id => {
      const element = document.getElementById(id);

      if (element) element.textContent = '—';
    });

    console.warn(
      'Homepage statistics could not be loaded:',
      error.message
    );
  }
}

// =====================================
// HOMEPAGE CONTROLS
// =====================================

function initializeHomepageControls() {
  const typeFilter = document.getElementById('typeFilter');

  document.querySelectorAll('[data-quick-filter]').forEach(button => {
    button.addEventListener('click', () => {
      if (!typeFilter) return;

      typeFilter.value = button.dataset.quickFilter || '';

      document.querySelectorAll('[data-quick-filter]').forEach(option => {
        option.classList.toggle('active', option === button);
      });

      loadItems();
    });
  });

  document.getElementById('clearFilters')?.addEventListener('click', () => {
    ['searchInput', 'categoryFilter', 'locationFilter'].forEach(id => {
      const field = document.getElementById(id);

      if (field) field.value = '';
    });

    if (typeFilter) typeFilter.value = '';

    const sort = document.getElementById('sortBy');

    if (sort) sort.value = 'newest';

    document.querySelectorAll('[data-quick-filter]').forEach(button => {
      button.classList.toggle('active', !button.dataset.quickFilter);
    });

    loadItems();
  });

  const menuToggle = document.getElementById('menuToggle');
  const nav = document.getElementById('primaryNav');

  menuToggle?.addEventListener('click', () => {
    const expanded =
      menuToggle.getAttribute('aria-expanded') === 'true';

    menuToggle.setAttribute('aria-expanded', String(!expanded));

    menuToggle.setAttribute(
      'aria-label',
      expanded ? 'Open navigation' : 'Close navigation'
    );

    nav?.classList.toggle('nav-open', !expanded);
  });
}

// =====================================
// PAGE INITIALIZATION
// =====================================

document.addEventListener('DOMContentLoaded', () => {
  updateNavigation();

  const currentUser = getStoredUser();

  // ADMIN DASHBOARD
  if (currentUser && currentUser.role === 'admin') {
    loadAdminStats();
    loadAdminClaims();
    loadAdminItems();
  }

  // STUDENT DASHBOARD
  if (currentUser && currentUser.role === 'user') {
    loadUserItems();
    loadUserClaims();
  }

  // HOMEPAGE LISTINGS
  if (document.getElementById('itemsContainer')) {
    loadItems();

    [
      'searchInput',
      'categoryFilter',
      'typeFilter',
      'sortBy',
      'locationFilter'
    ].forEach(id => {
      const element = document.getElementById(id);

      if (!element) return;

      element.addEventListener(
        ['searchInput', 'locationFilter'].includes(id)
          ? 'input'
          : 'change',
        loadItems
      );
    });
  }

  document.getElementById('loginForm')
    ?.addEventListener('submit', handleLogin);

  document.getElementById('registerForm')
    ?.addEventListener('submit', handleRegistration);

  document.getElementById('reportForm')
    ?.addEventListener('submit', handleReportSubmission);

  initializeHomepageControls();
  loadHomepageStats();
});

// =====================================
// REPORT ITEM
// =====================================

async function handleReportSubmission(event) {
  event.preventDefault();

  const user = getStoredUser();
  const form = event.currentTarget;
  const message = document.getElementById('reportMessage');

  if (!user) {
    location.href = 'login.html';
    return;
  }

  const payload = {
    listingType: form.listingType.value,
    title: form.title.value.trim(),
    category: form.category.value,
    description: form.description.value.trim(),
    location: form.location.value.trim(),
    date: form.date.value,
    imageUrl: form.imageUrl.value.trim(),
    postedBy: user.id
  };

  const button = document.getElementById('reportSubmit');

  button.disabled = true;
  button.textContent = 'Submitting…';

  try {
    await apiRequest('/items', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    showMessage(
      message,
      'Your item has been reported successfully.',
      'success'
    );

    form.reset();

  } catch (error) {
    showMessage(message, error.message);

    button.disabled = false;
    button.textContent = 'Submit report';
  }
}

// =====================================
// STUDENT REPORTED ITEMS
// =====================================

async function loadUserItems() {
  const container = document.getElementById('userItemsContainer');

  if (!container) return;

  container.innerHTML = '<p class="muted">Loading your items...</p>';

  try {
    const items = await apiRequest('/items/mine');

    if (!items.length) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No reported items yet</h3>
          <p>Your reported lost and found items will appear here.</p>
          <a class="text-link" href="report.html">Report an item →</a>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Type</th>
            <th>Category</th>
            <th>Location</th>
            <th>Date</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          ${items.map(item => `
            <tr>
              <td><strong>${escapeHtml(item.title)}</strong></td>
              <td>${escapeHtml(item.listingType)}</td>
              <td>${escapeHtml(item.category || 'Other')}</td>
              <td>${escapeHtml(item.location || '—')}</td>
              <td>${formatDate(item.date)}</td>

              <td>
                <span class="status-pill ${
                  String(item.status).toLowerCase() === 'recovered'
                    ? 'approved'
                    : 'pending'
                }">
                  ${escapeHtml(item.status || 'Open')}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

  } catch (error) {
    container.innerHTML = `
      <p class="message error">${escapeHtml(error.message)}</p>
    `;
  }
}
