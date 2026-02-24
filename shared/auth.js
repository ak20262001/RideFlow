/* =============================================
   RideFlow — Authentication Module
   localStorage-based auth with email domain validation
============================================= */

'use strict';

const Auth = (() => {
  const CURRENT_USER_KEY   = 'rideflow-current-user';
  const CUSTOMER_DOMAIN    = '@customer.mail';
  const DRIVER_DOMAIN      = '@driver.mail';
  const CUSTOMER_DASHBOARD = '/pages/customer.html';
  const DRIVER_DASHBOARD   = '/pages/driver.html';
  const LOGIN_PAGE         = '/pages/login.html';

  // ── Internal helpers ──────────────────────

  function _save(user) {
    try {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    } catch (e) {
      console.warn('[Auth] Could not save user session:', e);
    }
  }

  function _getDashboardForType(type) {
    return type === 'driver' ? DRIVER_DASHBOARD : CUSTOMER_DASHBOARD;
  }

  // ── Public API ────────────────────────────

  /**
   * Extract a display name from an email address.
   * "budi@customer.mail" -> "Budi"
   * @param {string} email
   * @returns {string}
   */
  function extractName(email) {
    if (!email || typeof email !== 'string') return 'Guest';
    const local = email.split('@')[0] || 'guest';
    // Replace underscores/dots with spaces, capitalize each word
    return local
      .replace(/[_\.]/g, ' ')
      .split(' ')
      .filter(w => w.length > 0)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ') || 'Guest';
  }

  /**
   * Validate an email address for RideFlow domains.
   * @param {string} email
   * @returns {{ valid: boolean, type?: 'customer'|'driver', error?: string }}
   */
  function validateEmail(email) {
    if (!email || typeof email !== 'string') {
      return { valid: false, error: 'Please enter an email address.' };
    }
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes('@')) {
      return { valid: false, error: 'Please enter a valid email address.' };
    }
    if (trimmed.endsWith(CUSTOMER_DOMAIN)) {
      return { valid: true, type: 'customer' };
    }
    if (trimmed.endsWith(DRIVER_DOMAIN)) {
      return { valid: true, type: 'driver' };
    }
    return {
      valid: false,
      error: 'Email must end with @customer.mail or @driver.mail.',
    };
  }

  /**
   * Log in with an email address (must match a RideFlow domain).
   * Stores the session in localStorage.
   * @param {string} email
   * @returns {Object} user session object
   */
  function login(email) {
    const result = validateEmail(email);
    if (!result.valid) {
      throw new Error(result.error);
    }
    const user = {
      type:      result.type,
      email:     email.trim().toLowerCase(),
      name:      extractName(email),
      isGuest:   false,
      loginTime: new Date().toISOString(),
    };
    _save(user);
    return user;
  }

  /**
   * Log in as a guest for the specified user type.
   * @param {'customer'|'driver'} type
   * @returns {Object} user session object
   */
  function loginAsGuest(type) {
    const resolvedType = (type === 'driver') ? 'driver' : 'customer';
    const user = {
      type:      resolvedType,
      email:     '',
      name:      'Guest',
      isGuest:   true,
      loginTime: new Date().toISOString(),
    };
    _save(user);
    return user;
  }

  /**
   * Log out the current user. Clears session and redirects to the login page.
   */
  function logout() {
    try {
      localStorage.removeItem(CURRENT_USER_KEY);
    } catch (e) {
      console.warn('[Auth] Could not remove user session:', e);
    }
    window.location.href = LOGIN_PAGE;
  }

  /**
   * Return the current user session object, or null if not logged in.
   * @returns {Object|null}
   */
  function getCurrentUser() {
    try {
      const raw = localStorage.getItem(CURRENT_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  /**
   * Require authentication. Redirects to login if not logged in.
   * If expectedType is provided and doesn't match, redirects to the correct dashboard.
   * @param {'customer'|'driver'|null} [expectedType]
   * @returns {Object|null} user object, or null if redirecting
   */
  function requireAuth(expectedType) {
    const user = getCurrentUser();
    if (!user) {
      window.location.href = LOGIN_PAGE;
      return null;
    }
    if (expectedType && user.type !== expectedType) {
      window.location.href = _getDashboardForType(user.type);
      return null;
    }
    return user;
  }

  return {
    extractName,
    validateEmail,
    login,
    loginAsGuest,
    logout,
    getCurrentUser,
    requireAuth,
  };
})();
