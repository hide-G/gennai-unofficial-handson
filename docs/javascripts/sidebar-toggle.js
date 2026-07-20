/**
 * Sidebar toggle button for Material for MkDocs.
 * Adds a hamburger button to the header (left side) that toggles the primary
 * left sidebar on desktop. State is persisted in localStorage.
 * The button is hidden on mobile via CSS (Material has its own drawer there).
 */
(function () {
  var STORAGE_KEY = 'gennai-sidebar-collapsed';
  var COLLAPSED_CLASS = 'sidebar-collapsed';
  var BUTTON_CLASS = 'sidebar-toggle';

  var HAMBURGER_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">' +
    '<path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z"></path>' +
    '</svg>';

  function safeGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function safeSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      /* storage may be blocked; ignore */
    }
  }

  function applyStateFromStorage(button) {
    var collapsed = safeGet(STORAGE_KEY) === 'true';
    document.body.classList.toggle(COLLAPSED_CLASS, collapsed);
    if (button) {
      button.setAttribute('aria-pressed', collapsed ? 'true' : 'false');
    }
  }

  function initToggle() {
    var header = document.querySelector('.md-header__inner');
    if (!header) {
      return;
    }
    if (header.querySelector('.' + BUTTON_CLASS)) {
      return;
    }

    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'md-header__button md-icon ' + BUTTON_CLASS;
    button.setAttribute('aria-label', 'サイドバーの表示切替');
    button.setAttribute('title', 'サイドバーの表示切替');
    button.innerHTML = HAMBURGER_SVG;

    // Insert after the logo so the toggle sits on the left of the header title
    var logo = header.querySelector('.md-header__button.md-logo');
    if (logo && logo.parentNode === header) {
      if (logo.nextSibling) {
        header.insertBefore(button, logo.nextSibling);
      } else {
        header.appendChild(button);
      }
    } else {
      header.insertBefore(button, header.firstChild);
    }

    applyStateFromStorage(button);

    button.addEventListener('click', function () {
      var collapsed = document.body.classList.toggle(COLLAPSED_CLASS);
      button.setAttribute('aria-pressed', collapsed ? 'true' : 'false');
      safeSet(STORAGE_KEY, collapsed ? 'true' : 'false');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initToggle);
  } else {
    initToggle();
  }
})();
