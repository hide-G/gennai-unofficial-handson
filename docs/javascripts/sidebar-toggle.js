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

  // Text-only labels split across two lines for a compact header button.
  var LABEL_TOP = '目次を';
  var LABEL_ACTION_COLLAPSED = '表示';
  var LABEL_ACTION_EXPANDED = '隠す';

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
    var action = collapsed ? LABEL_ACTION_COLLAPSED : LABEL_ACTION_EXPANDED;
    button.innerHTML =
      '<span class="sidebar-toggle__label">' + LABEL_TOP + '<br>' + action + '</span>';
    button.setAttribute('aria-pressed', collapsed ? 'true' : 'false');
    var label = LABEL_TOP + action;
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
