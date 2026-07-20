/**
 * Sidebar toggle button for Material for MkDocs (desktop only).
 *
 * - Adds a button to the header (after the site logo) that hides / shows the
 *   primary left sidebar (the chapter navigation tree).
 * - Uses the standard HTML `hidden` attribute on `.md-sidebar--primary` so
 *   that Material's own layout rule
 *   (`.md-sidebar--primary:not([hidden])~.md-content ...`) picks it up and
 *   expands the main content into the freed space.
 * - The state is persisted in localStorage so the preference is kept across
 *   page navigations and visits.
 * - The button and its effect are limited to the desktop breakpoint used by
 *   Material (>= 76.25em, matching the width at which the sidebar becomes a
 *   sticky column). On mobile / tablet, Material's built-in drawer button
 *   handles sidebar visibility.
 */
(function () {
  var STORAGE_KEY = 'gennai-sidebar-collapsed';
  var BUTTON_CLASS = 'sidebar-toggle';
  var LABEL_TEXT = '目次';

  // Stroke-based double chevron. `«` — indicates "click to collapse the sidebar toward the left".
  var CHEVRON_LEFT_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"' +
    ' fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<polyline points="13 7 8 12 13 17"></polyline>' +
    '<polyline points="19 7 14 12 19 17"></polyline>' +
    '</svg>';

  // Stroke-based double chevron. `»` — indicates "click to expand the sidebar out to the right".
  var CHEVRON_RIGHT_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"' +
    ' fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<polyline points="11 7 16 12 11 17"></polyline>' +
    '<polyline points="5 7 10 12 5 17"></polyline>' +
    '</svg>';

  function safeGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }

  function safeSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* storage may be blocked */ }
  }

  function isDesktop() {
    return window.matchMedia('(min-width: 76.25em)').matches;
  }

  function setButtonState(button, collapsed) {
    button.innerHTML =
      (collapsed ? CHEVRON_RIGHT_SVG : CHEVRON_LEFT_SVG) +
      '<span class="sidebar-toggle__label">' + LABEL_TEXT + '</span>';
    button.setAttribute('aria-pressed', collapsed ? 'true' : 'false');
    var label = collapsed ? '目次を表示' : '目次を折りたたむ';
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
  }

  function applySidebarState(collapsed) {
    var sidebar = document.querySelector('.md-sidebar--primary');
    if (!sidebar) return;
    if (collapsed) {
      sidebar.setAttribute('hidden', '');
    } else {
      sidebar.removeAttribute('hidden');
    }
    document.body.classList.toggle('sidebar-collapsed', collapsed);
  }

  function initToggle() {
    var header = document.querySelector('.md-header__inner');
    if (!header) return;
    if (header.querySelector('.' + BUTTON_CLASS)) return;

    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'md-header__button ' + BUTTON_CLASS;

    // Insert immediately after the logo so the button sits on the left of the header title.
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

    // Only apply the persisted collapsed state on desktop; on mobile, Material's own drawer handles the sidebar.
    var savedCollapsed = safeGet(STORAGE_KEY) === 'true';
    var startCollapsed = isDesktop() && savedCollapsed;
    setButtonState(button, startCollapsed);
    if (startCollapsed) {
      applySidebarState(true);
    }

    button.addEventListener('click', function () {
      var isNowCollapsed = !document.body.classList.contains('sidebar-collapsed');
      applySidebarState(isNowCollapsed);
      setButtonState(button, isNowCollapsed);
      safeSet(STORAGE_KEY, isNowCollapsed ? 'true' : 'false');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initToggle);
  } else {
    initToggle();
  }
})();
