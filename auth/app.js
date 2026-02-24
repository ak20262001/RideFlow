/* =============================================
   RideFlow — Auth / Login Page Logic
   Depends on: shared/storage.js, shared/auth.js
============================================= */

'use strict';

// ── On page load, redirect if already logged in ──

document.addEventListener('DOMContentLoaded', () => {
  const user = Auth.getCurrentUser();
  if (user) {
    _showAlreadyLoggedIn(user);
    return;
  }
  document.getElementById('loginForms').style.display = '';
  document.getElementById('alreadyNotice').style.display = 'none';
});

function _showAlreadyLoggedIn(user) {
  document.getElementById('loginForms').style.display = 'none';
  const notice = document.getElementById('alreadyNotice');
  notice.style.display = '';
  document.getElementById('alreadyName').textContent = user.name || 'Guest';
  document.getElementById('alreadyDashBtn').onclick = function () {
    window.location.href = user.type === 'driver' ? '/driver-dashboard/' : '/customer-dashboard/';
  };
}

// ── Error helpers ─────────────────────────────

function _showError(elId, msg) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
}

function _clearError(elId) {
  const el = document.getElementById(elId);
  if (el) { el.textContent = ''; el.classList.remove('show'); }
}

// ── Customer login ─────────────────────────────

function doCustomerLogin() {
  _clearError('customerError');
  const email = document.getElementById('customerEmailInput').value.trim();
  if (!email) { _showError('customerError', 'Please enter your email address.'); return; }

  const result = Auth.validateEmail(email);
  if (!result.valid) { _showError('customerError', result.error); return; }
  if (result.type !== 'customer') {
    _showError('customerError', 'Please use a @customer.mail email address.');
    return;
  }

  Auth.login(email);
  window.location.href = '/customer-dashboard/';
}

function doCustomerGuest() {
  Auth.loginAsGuest('customer');
  window.location.href = '/customer-dashboard/';
}

// ── Driver login ───────────────────────────────

function doDriverLogin() {
  _clearError('driverError');
  const email = document.getElementById('driverEmailInput').value.trim();
  if (!email) { _showError('driverError', 'Please enter your email address.'); return; }

  const result = Auth.validateEmail(email);
  if (!result.valid) { _showError('driverError', result.error); return; }
  if (result.type !== 'driver') {
    _showError('driverError', 'Please use a @driver.mail email address.');
    return;
  }

  Auth.login(email);
  window.location.href = '/driver-dashboard/';
}

function doDriverGuest() {
  Auth.loginAsGuest('driver');
  window.location.href = '/driver-dashboard/';
}

// ── Sign out (from "already logged in" notice) ─

function doSignOut() {
  Auth.logout();
}

// ── Enter-key support ──────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const customerInput = document.getElementById('customerEmailInput');
  if (customerInput) {
    customerInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doCustomerLogin();
    });
  }

  const driverInput = document.getElementById('driverEmailInput');
  if (driverInput) {
    driverInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doDriverLogin();
    });
  }
});
