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

  // auth-config.js declares `const supabaseClient` (a global lexical binding,
  // NOT window.supabaseClient), so detect it with a bare typeof check.
  var client = null;
  try {
    if (typeof supabaseClient !== 'undefined' && supabaseClient && supabaseClient.auth) client = supabaseClient;
  } catch (e) {}

  if (client) {
    client.auth.getUser()
      .then(function (res) { apply((res && res.data && res.data.user) || null); })
      .catch(function () { apply(userFromStorage()); });
  } else {
    apply(userFromStorage());
  }
})();
