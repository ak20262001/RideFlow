/* =============================================
   RideFlow — Map Integration
   Leaflet.js + OpenStreetMap + Geolocation API
============================================= */

'use strict';

const MapIntegration = (() => {
  const DRIVER_LOC_KEY   = 'rideflow-driver-location';
  const CUSTOMER_LOC_KEY = 'rideflow-customer-location';
  const UPDATE_INTERVAL  = 10000; // 10 seconds

  let _map            = null;
  let _driverMarker   = null;
  let _customerMarker = null;
  let _destMarker     = null;
  let _routeLine      = null;
  let _watchId        = null;
  let _updateTimer    = null;
  let _onStatusChange = null;

  // Default center (Jakarta)
  const DEFAULT_CENTER = [-6.2088, 106.8456];
  const DEFAULT_ZOOM   = 13;

  // ── Icon factories ────────────────────────

  function _makeIcon(color, emoji) {
    return L.divIcon({
      className: '',
      html: `<div style="
        width:34px;height:34px;border-radius:50%;
        background:${color};
        display:flex;align-items:center;justify-content:center;
        font-size:18px;box-shadow:0 2px 8px rgba(0,0,0,0.45);
        border:2px solid rgba(255,255,255,0.7);
      ">${emoji}</div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      popupAnchor: [0, -20],
    });
  }

  const ICONS = {
    driver:   () => _makeIcon('#3b82f6', '🏍️'),
    customer: () => _makeIcon('#ef4444', '📍'),
    dest:     () => _makeIcon('#22c55e', '🏁'),
  };

  // ── Core map init ─────────────────────────

  /**
   * Initialize the Leaflet map inside `containerId`.
   * @param {string}   containerId  ID of the map <div>
   * @param {Function} [onStatusChange]  Called with status strings
   */
  function init(containerId, onStatusChange) {
    _onStatusChange = onStatusChange || null;

    if (!window.L) {
      _status('⚠️ Map library not loaded');
      return;
    }

    const container = document.getElementById(containerId);
    if (!container) return;

    _map = L.map(containerId, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(_map);

    _status('Map ready · Requesting location…');
    _requestGeolocation();
  }

  // ── Geolocation ───────────────────────────

  function _requestGeolocation() {
    if (!navigator.geolocation) {
      _status('Geolocation not supported · Using default area');
      _setDriverMarker(DEFAULT_CENTER[0], DEFAULT_CENTER[1]);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy, heading } = pos.coords;
        _onLocationUpdate(latitude, longitude, accuracy, heading || 0);
        _startWatching();
        _status('📍 Live location active');
      },
      (err) => {
        _status('Location denied · Showing default area');
        _setDriverMarker(DEFAULT_CENTER[0], DEFAULT_CENTER[1]);
        // Still save a default location so other systems can read it
        _persistDriverLocation(DEFAULT_CENTER[0], DEFAULT_CENTER[1], 0, 0);
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  }

  function _startWatching() {
    if (_watchId !== null) navigator.geolocation.clearWatch(_watchId);

    _watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy, heading } = pos.coords;
        _onLocationUpdate(latitude, longitude, accuracy, heading || 0);
      },
      null,
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    // Backup timer (forces a re-fetch if watchPosition stalls)
    clearInterval(_updateTimer);
    _updateTimer = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, accuracy, heading } = pos.coords;
          _onLocationUpdate(latitude, longitude, accuracy, heading || 0);
        },
        null,
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }, UPDATE_INTERVAL);
  }

  function _onLocationUpdate(lat, lng, accuracy, heading) {
    _setDriverMarker(lat, lng);
    _persistDriverLocation(lat, lng, accuracy, heading);
    _tryDrawRoute();
  }

  function _persistDriverLocation(lat, lng, accuracy, heading) {
    const loc = {
      driverId:  'drv_001',
      latitude:  lat,
      longitude: lng,
      accuracy:  accuracy,
      heading:   heading,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(DRIVER_LOC_KEY, JSON.stringify(loc));
  }

  // ── Marker management ─────────────────────

  function _setDriverMarker(lat, lng) {
    if (!_map) return;
    if (_driverMarker) {
      _driverMarker.setLatLng([lat, lng]);
    } else {
      _driverMarker = L.marker([lat, lng], { icon: ICONS.driver() })
        .bindPopup('📍 You (Driver)')
        .addTo(_map);
    }
    _map.setView([lat, lng], _map.getZoom() || DEFAULT_ZOOM, { animate: true });
  }

  /**
   * Set/move the customer pin on the map.
   */
  function setCustomerLocation(lat, lng) {
    if (!_map) return;
    if (_customerMarker) {
      _customerMarker.setLatLng([lat, lng]);
    } else {
      _customerMarker = L.marker([lat, lng], { icon: ICONS.customer() })
        .bindPopup('🧑 Customer')
        .addTo(_map);
    }
    localStorage.setItem(CUSTOMER_LOC_KEY, JSON.stringify({ latitude: lat, longitude: lng, timestamp: new Date().toISOString() }));
    _tryDrawRoute();
  }

  /**
   * Set/move the destination pin on the map.
   */
  function setDestination(lat, lng, label) {
    if (!_map) return;
    if (_destMarker) {
      _destMarker.setLatLng([lat, lng]);
    } else {
      _destMarker = L.marker([lat, lng], { icon: ICONS.dest() })
        .bindPopup(`🏁 ${label || 'Destination'}`)
        .addTo(_map);
    }
    _tryDrawRoute();
  }

  /** Draw a polyline from driver → customer → destination if all markers exist */
  function _tryDrawRoute() {
    if (!_map || !_driverMarker || !_customerMarker) return;
    const points = [_driverMarker.getLatLng(), _customerMarker.getLatLng()];
    if (_destMarker) points.push(_destMarker.getLatLng());

    if (_routeLine) _map.removeLayer(_routeLine);
    _routeLine = L.polyline(points, {
      color: '#6ee7b7',
      weight: 3,
      opacity: 0.7,
      dashArray: '8 6',
    }).addTo(_map);
  }

  // ── Utilities ─────────────────────────────

  function _status(text) {
    if (_onStatusChange) _onStatusChange(text);
  }

  /** Force a map resize (needed when container becomes visible after being hidden) */
  function invalidate() {
    if (_map) _map.invalidateSize();
  }

  /** Read the last known driver location from localStorage */
  function getDriverLocation() {
    try {
      return JSON.parse(localStorage.getItem(DRIVER_LOC_KEY));
    } catch (_) {
      return null;
    }
  }

  return { init, setCustomerLocation, setDestination, invalidate, getDriverLocation };
})();
