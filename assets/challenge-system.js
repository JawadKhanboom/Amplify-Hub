/* AmplifyHub authenticated Practical Challenges client. */
(function (global) {
  'use strict';

  function client() {
    try {
      if (typeof supabaseClient !== 'undefined') return supabaseClient;
      return global.supabaseClient || null;
    } catch (e) { return null; }
  }

  function friendlyError(error) {
    var message = String(error && error.message || '');
    if (/30 to 1000/i.test(message)) return 'Write between 30 and 1,000 characters before completing this challenge.';
    if (/requirements are not complete/i.test(message)) return 'The required lesson or AI practice is not complete yet. Finish it, then check again.';
    if (/replacement already used/i.test(message)) return 'You have already replaced one challenge today.';
    if (/cannot be replaced/i.test(message)) return 'This challenge can no longer be replaced.';
    return 'Challenges could not be updated right now. Check your connection and try again.';
  }

  async function rpc(name, args) {
    var api = client();
    if (!api) throw new Error('Challenge service unavailable');
    var result = await api.rpc(name, args || {});
    if (result.error) {
      var safe = new Error(friendlyError(result.error));
      safe.code = result.error.code || 'CHALLENGE_ERROR';
      throw safe;
    }
    return result.data;
  }

  global.ChallengeSystem = {
    getDaily: function () { return rpc('get_or_assign_daily_challenges'); },
    start: function (id) { return rpc('start_challenge', { p_assignment_id: id }); },
    submit: function (id, evidence) { return rpc('submit_challenge', { p_assignment_id: id, p_evidence: evidence || {} }); },
    replace: function (id, reason) { return rpc('replace_challenge', { p_assignment_id: id, p_reason: reason }); },
    rate: function (id, helpful, reason) { return rpc('rate_challenge', { p_assignment_id: id, p_helpful: helpful, p_reason: reason || null }); },
    friendlyError: friendlyError
  };
})(typeof window !== 'undefined' ? window : globalThis);
