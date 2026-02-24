/* =============================================
   RideFlow — Shared Utility Modules
   Reusable utilities for both customer & driver
============================================= */

'use strict';

// ── DOM Utilities ─────────────────────────────

const DOMUtils = {
  createElement(tag, className, innerHTML) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (innerHTML !== undefined) el.innerHTML = innerHTML;
    return el;
  },

  updateElement(selector, content) {
    const el = document.querySelector(selector);
    if (el) el.textContent = content;
  },

  bindEvent(selector, event, handler) {
    const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (el) el.addEventListener(event, handler);
  },

  bindAll(selector, event, handler) {
    document.querySelectorAll(selector).forEach(el => el.addEventListener(event, handler));
  },

  toggleClass(selector, className, force) {
    const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (el) el.classList.toggle(className, force);
  },

  show(id) { const el = document.getElementById(id); if (el) el.style.display = ''; },
  hide(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; },

  openModal(id)  { const el = document.getElementById(id); if (el) el.classList.add('show'); },
  closeModal(id) { const el = document.getElementById(id); if (el) el.classList.remove('show'); },
};

// ── Chat Utilities ────────────────────────────

const ChatUtils = {
  formatMessage(content, sender) {
    return {
      id:        'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      sender,
      type:      'text',
      content,
      timestamp: new Date().toISOString(),
      read:      false,
    };
  },

  displayMessage(msg, container, isDriver) {
    if (!container) return;
    const isOwnMsg = isDriver ? msg.sender === 'driver' : msg.sender === 'customer';
    const avatarChar = isDriver ? '👨‍✈️' : 'D';
    const el = document.createElement('div');
    el.className = 'msg ' + (isOwnMsg ? (isDriver ? 'driver-msg' : 'user') : '');
    el.innerHTML = `
      <div class="msg-avatar ${isOwnMsg ? (isDriver ? 'driver' : 'user') : (isDriver ? 'customer' : 'bot')}">${isOwnMsg ? (isDriver ? '👨‍✈️' : '👤') : avatarChar}</div>
      <div class="msg-content">
        <div class="msg-bubble">${ChatUtils.escapeHtml(msg.content || '')}</div>
        <div class="msg-time">${new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      </div>`;
    container.appendChild(el);
    ChatUtils.scrollToBottom(container);
  },

  scrollToBottom(container) {
    if (container) container.scrollTop = container.scrollHeight;
  },

  validateMessage(content) {
    return typeof content === 'string' && content.trim().length > 0 && content.length <= 2000;
  },

  escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },
};

// ── Form Utilities ────────────────────────────

const FormUtils = {
  getFormData(formSelector) {
    const form = document.querySelector(formSelector);
    if (!form) return {};
    const data = {};
    form.querySelectorAll('input, textarea, select').forEach(el => {
      if (el.name) data[el.name] = el.value;
    });
    return data;
  },

  validateEmail(email) {
    if (typeof Auth !== 'undefined') return Auth.validateEmail(email);
    return { valid: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), type: null };
  },

  sanitizeInput(input) {
    // Escape angle brackets to prevent any HTML/script injection
    return String(input).trim()
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  },

  showError(elId, msg) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
  },

  clearError(elId) {
    const el = document.getElementById(elId);
    if (el) { el.textContent = ''; el.classList.remove('show'); }
  },
};

// ── Shared Component Templates ────────────────

const Components = {
  Message(data) {
    const escaped = ChatUtils.escapeHtml(data.content || '');
    const time = new Date(data.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isCustomer = data.sender === 'customer';
    return `<div class="msg ${isCustomer ? '' : 'driver-msg'}">
      <div class="msg-avatar ${isCustomer ? 'customer' : 'driver'}">${isCustomer ? '👤' : '👨‍✈️'}</div>
      <div class="msg-content">
        <div class="msg-bubble">${escaped}</div>
        <div class="msg-time">${time}</div>
      </div>
    </div>`;
  },

  OrderCard(data) {
    return `<div class="card card--order">
      <div class="hist-top">
        <div class="hist-route">${ChatUtils.escapeHtml(data.pickup || '—')} <span>→</span> ${ChatUtils.escapeHtml(data.destination || '—')}</div>
        <span class="hist-status ${data.statusClass || ''}">${data.statusLabel || data.status || '—'}</span>
      </div>
      <div class="hist-bottom">
        <div class="hist-detail">${ChatUtils.escapeHtml(data.detail || '—')}</div>
        <div class="hist-price">${data.price || '—'}</div>
      </div>
    </div>`;
  },

  Button(text, type, id) {
    const cls = type ? `btn btn--${type}` : 'btn';
    const safeId = id ? id.replace(/[^a-zA-Z0-9_-]/g, '') : '';
    const idAttr = safeId ? ` id="${safeId}"` : '';
    return `<button class="${cls}"${idAttr}>${ChatUtils.escapeHtml(text)}</button>`;
  },
};
