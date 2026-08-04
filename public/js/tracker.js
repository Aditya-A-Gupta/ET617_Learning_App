// LearnStream clickstream tracker.
// Sends events to POST /api/track. Fails silently (never blocks the UI).
const Tracker = (() => {
  function send(event_name, payload = {}) {
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ event_name, origin: 'web', ...payload }),
    }).catch(() => {});
  }

  function trackPageView(pageLabel) {
    send('page_viewed', {
      event_context: 'System',
      description: `The user viewed the '${pageLabel}' page.`,
    });
  }

  // Delegated click tracking: any element with [data-track] gets logged with
  // its data-track value as a human readable label.
  function initClickDelegation() {
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-track]');
      if (!el) return;
      const label = el.getAttribute('data-track');
      send('ui_click', {
        event_context: 'System',
        description: `The user clicked '${label}'.`,
      });
    }, true);
  }

  document.addEventListener('DOMContentLoaded', initClickDelegation);

  return { send, trackPageView };
})();
