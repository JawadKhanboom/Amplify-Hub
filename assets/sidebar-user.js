(function() {
  'use strict';
  var KEY = 'sb-dsuahpcqrrlbudomjrye-auth-token';
  var name = '';
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) {
      var session = JSON.parse(raw);
      var user = session && session.user;
      if (user) {
        var meta = user.user_metadata || {};
        name = meta.full_name || meta.name || '';
      }
    }
  } catch (e) {}
  var initial = name ? name.charAt(0).toUpperCase() : '?';
  var display = name || 'Account';

  // Pattern 1: sb-av / sb-un / sb-ur (majority of pages)
  var av = document.querySelector('.sb-av');
  var un = document.querySelector('.sb-un');
  if (av) av.textContent = initial;
  if (un) un.textContent = display;

  // Pattern 2: sb-avatar / sb-uname / sb-urole (about, faq, etc.)
  var av2 = document.querySelector('.sb-avatar');
  var un2 = document.querySelector('.sb-uname');
  if (av2) av2.textContent = initial;
  if (un2) un2.textContent = display;
})();
