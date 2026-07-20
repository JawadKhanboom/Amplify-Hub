/*!
 * AmplifyHub shared sidebar-user helper.
 * Fills STATIC sidebar avatar/name placeholders with the signed-in user.
 *
 * Elements that carry an id (profile.html's #sbName, settings.html's #sbAvatar,
 * ...) are managed by their own page scripts with richer data — this helper
 * deliberately leaves those alone and only touches id-less static markup.
 *
 * On pages that load the Supabase client it asks the client directly (which
 * refreshes stale sessions). On plain content pages it falls back to the cached
 * Supabase session in localStorage — scanning for the `sb-*-auth-token` key
 * rather than hardcoding a project ref, and ignoring sessions that are expired
 * with no refresh token.
 */
(function () {
  'use strict';

  function fill(selector, value) {
    var els = document.querySelectorAll(selector);
    for (var i = 0; i < els.length; i++) {
      if (!els[i].id) els[i].textContent = value;
    }
  }

  function apply(user) {
    var meta = (user && user.user_metadata) || {};
    var name = meta.full_name || meta.name || '';
    var initial = name ? name.charAt(0).toUpperCase() : '?';
    var display = name || 'Account';

    // Pattern 1: sb-av / sb-un (majority of pages); Pattern 2: sb-avatar / sb-uname
    fill('.sb-av', initial);
    fill('.sb-un', display);
    fill('.sb-avatar', initial);
    fill('.sb-uname', display);
  }

  function userFromStorage() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!/^sb-[a-z0-9]+-auth-token$/.test(key)) continue;
        var session = JSON.parse(localStorage.getItem(key));
        if (!session || !session.user) continue;
        // An expired session with no refresh token is dead — don't show its details.
        if (session.expires_at && session.expires_at * 1000 < Date.now() && !session.refresh_token) continue;
        return session.user;
      }
    } catch (e) {}
    return null;
  }

  // Mark the current page's sidebar/nav link for assistive tech. Runs on every
  // page that loads this script, regardless of which sidebar markup it uses.
  try {
    var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    var navLinks = document.querySelectorAll('nav a[href], aside a[href], .sb a[href], .sb-nav a[href], .snav a[href]');
    for (var j = 0; j < navLinks.length; j++) {
      var href = (navLinks[j].getAttribute('href') || '').split('#')[0].split('?')[0].toLowerCase();
      if (href && href === page) navLinks[j].setAttribute('aria-current', 'page');
    }
  } catch (e) {}

  // auth-config.js declares `const supabaseClient` (a global lexical binding,
  // NOT window.supabaseClient), so detect it with a bare typeof check.
  var client = null;
  var identityVersion = 0;
  try {
    if (typeof supabaseClient !== 'undefined' && supabaseClient && supabaseClient.auth) client = supabaseClient;
  } catch (e) {}

  if (client) {
    var initialIdentityVersion = ++identityVersion;
    client.auth.getUser()
      .then(function (res) {
        if (initialIdentityVersion !== identityVersion) return;
        apply((res && res.data && res.data.user) || null);
      })
      .catch(function () {
        if (initialIdentityVersion === identityVersion) apply(userFromStorage());
      });
    if (typeof client.auth.onAuthStateChange === 'function') {
      client.auth.onAuthStateChange(function (event, session) {
        var eventVersion = ++identityVersion;
        if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
          apply(null);
          return;
        }
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session && session.user) {
          var expectedUserId = session.user.id;
          setTimeout(function () {
            if (eventVersion !== identityVersion) return;
            client.auth.getUser().then(function (res) {
              var user = res && res.data && res.data.user;
              if (eventVersion === identityVersion && user && user.id === expectedUserId) apply(user);
            }).catch(function () {});
          }, 0);
        }
      });
    }
  } else {
    apply(userFromStorage());
  }

  // Standalone lesson pages render before the asynchronous owner/cloud check.
  // Keep their in-memory state and completion button aligned when that scoped
  // progress arrives or when the signed-in account changes in another tab.
  function refreshLessonProgress() {
    try {
      if (typeof AJP === 'undefined' || typeof thisLid === 'undefined' ||
          typeof completed === 'undefined' || typeof lessonMeta === 'undefined' ||
          typeof btn === 'undefined') return;
      var store = AJP.readProgress();
      completed.clear();
      (store.completedLessons || []).forEach(function (id) { completed.add(id); });
      Object.keys(lessonMeta).forEach(function (id) { delete lessonMeta[id]; });
      Object.assign(lessonMeta, store.lessonMeta || {});
      if (typeof lastQuizScore !== 'undefined') {
        lastQuizScore = (lessonMeta[thisLid] && lessonMeta[thisLid].quizScore) || null;
      }
      var isComplete = completed.has(thisLid);
      var readyForWrites = typeof AJP.isReadyForWrites !== 'function' || AJP.isReadyForWrites();
      btn.textContent = isComplete ? '✓ Completed' : 'Mark as Complete ✓';
      btn.classList.toggle('done', isComplete);
      btn.disabled = isComplete || !readyForWrites;
    } catch (e) {}
  }

  try {
    if (typeof AJP !== 'undefined' && AJP && typeof AJP.ready === 'function') {
      window.addEventListener('amplify-progress-changed', refreshLessonProgress);
      window.addEventListener('amplify-progress-synced', refreshLessonProgress);
      AJP.ready().then(refreshLessonProgress);
    }
  } catch (e) {}
})();
