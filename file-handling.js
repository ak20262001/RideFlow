/* =============================================
   RideFlow — File Handling
   Image upload, validation, base64 conversion
============================================= */

'use strict';

const FileHandler = (() => {
  const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
  const ALLOWED_TYPES  = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  /**
   * Validate and convert an image File to a base64 data URL.
   * @param {File} file
   * @returns {Promise<{dataUrl: string, fileName: string}>}
   */
  function processFile(file) {
    return new Promise((resolve, reject) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        reject(new Error('Only JPG, PNG, GIF, and WebP images are supported.'));
        return;
      }
      if (file.size > MAX_SIZE_BYTES) {
        reject(new Error('Image must be smaller than 5 MB.'));
        return;
      }

      const reader = new FileReader();
      reader.onload  = (e) => resolve({ dataUrl: e.target.result, fileName: file.name });
      reader.onerror = () => reject(new Error('Failed to read file.'));
      reader.readAsDataURL(file);
    });
  }

  // Escape all HTML special characters
  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Build an <img> element for use inside a chat bubble.
   * Returns a string of HTML.
   */
  function renderImageBubble(dataUrl, fileName) {
    const safeName = _esc(fileName || 'image');
    // Only accept data: URLs starting with data:image/ to prevent protocol injection
    const safeSrc  = (typeof dataUrl === 'string' && /^data:image\//.test(dataUrl))
      ? dataUrl : '';
    return `<div class="img-msg-wrap">
      <img class="chat-img" src="${safeSrc}" alt="${safeName}"
           onclick="ChatImageViewer.open(this.src)" />
      <div class="img-msg-name">${safeName}</div>
    </div>`;
  }

  /**
   * Attach drag-and-drop listeners to a drop zone element.
   * @param {HTMLElement} dropZone   Element that receives drag events
   * @param {Function}    onFile     Called with the dropped File
   */
  function attachDropZone(dropZone, onFile) {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    });
  }

  return { processFile, renderImageBubble, attachDropZone };
})();

/* =============================================
   Full-screen image viewer (singleton)
============================================= */
const ChatImageViewer = (() => {
  let _overlay = null;

  function _ensureOverlay() {
    if (_overlay) return;
    _overlay = document.createElement('div');
    _overlay.id = 'chatImgViewerOverlay';
    _overlay.style.cssText = [
      'position:fixed;inset:0;z-index:9999;',
      'background:rgba(0,0,0,0.92);',
      'display:none;align-items:center;justify-content:center;',
      'cursor:zoom-out;',
    ].join('');

    const img = document.createElement('img');
    img.style.cssText = 'max-width:94vw;max-height:90vh;border-radius:10px;object-fit:contain;';
    _overlay.appendChild(img);

    _overlay.addEventListener('click', close);
    document.body.appendChild(_overlay);
  }

  function open(src) {
    _ensureOverlay();
    _overlay.querySelector('img').src = src;
    _overlay.style.display = 'flex';
  }

  function close() {
    if (_overlay) _overlay.style.display = 'none';
  }

  return { open, close };
})();
