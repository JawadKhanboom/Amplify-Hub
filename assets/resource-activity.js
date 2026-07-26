/*!
 * AmplifyHub Resource Library activity data layer.
 *
 * Public pages may load this helper while signed out. Every read/write first
 * verifies the current Supabase user; anonymous visitors never write activity.
 */
(function (global) {
  'use strict';

  var TABLE = 'user_resource_activity';
  var SELECT_FIELDS = 'user_id,resource_id,bookmarked,helpful,last_viewed_at,download_count,created_at,updated_at';
  var identityVersion = 0;
  var observedUserId;
  var listeners = [];

  function getClient() {
    try {
      // auth-config.js exposes a top-level lexical binding, not a window field.
      if (typeof supabaseClient !== 'undefined' && supabaseClient && supabaseClient.auth) {
        return supabaseClient;
      }
    } catch (error) {}
    return null;
  }

  function unavailableError(message) {
    var error = new Error(message);
    error.code = 'RESOURCE_ACTIVITY_UNAVAILABLE';
    return error;
  }

  function normalizeResourceId(resourceId) {
    return typeof resourceId === 'string' ? resourceId.trim() : '';
  }

  function normalizeOne(data) {
    if (Array.isArray(data)) return data[0] || null;
    return data || null;
  }

  function isMissingSessionError(error) {
    return !!error && (
      error.name === 'AuthSessionMissingError' ||
      error.code === 'session_not_found'
    );
  }

  function notifyAuthChange(event, session) {
    var snapshot = listeners.slice();
    snapshot.forEach(function (listener) {
      try { listener(event, session || null); } catch (error) {
        console.error('Resource activity auth listener failed.', error);
      }
    });
  }

  async function getAuthState() {
    var client = getClient();
    if (!client) {
      return {
        status: 'unavailable',
        user: null,
        error: unavailableError('The saved-resource service is unavailable on this page.')
      };
    }

    // INITIAL_SESSION can land while getUser() is in flight. Retry once when
    // that changes the active identity rather than returning a stale result.
    for (var attempt = 0; attempt < 2; attempt += 1) {
      var capturedVersion = identityVersion;
      try {
        var result = await client.auth.getUser();
        if (capturedVersion !== identityVersion) continue;
        if (result && isMissingSessionError(result.error)) {
          return { status: 'signed_out', user: null, error: null };
        }
        if (result && result.error) {
          return { status: 'unavailable', user: null, error: result.error };
        }
        var user = result && result.data && result.data.user;
        if (!user) return { status: 'signed_out', user: null, error: null };
        return {
          status: 'authenticated',
          user: user,
          error: null,
          version: capturedVersion
        };
      } catch (error) {
        if (capturedVersion !== identityVersion) continue;
        if (isMissingSessionError(error)) {
          return { status: 'signed_out', user: null, error: null };
        }
        return { status: 'unavailable', user: null, error: error };
      }
    }

    return {
      status: 'stale',
      user: null,
      error: unavailableError('The signed-in account changed while loading saved resources.')
    };
  }

  async function withVerifiedUser(operation) {
    var auth = await getAuthState();
    if (auth.status !== 'authenticated') {
      return {
        status: auth.status,
        user: auth.user,
        data: null,
        error: auth.error || null
      };
    }

    var client = getClient();
    if (!client) {
      return {
        status: 'unavailable',
        user: auth.user,
        data: null,
        error: unavailableError('The saved-resource service is unavailable on this page.')
      };
    }

    try {
      var result = await operation(client, auth.user);
      if (auth.version !== identityVersion) {
        return {
          status: 'stale',
          user: null,
          data: null,
          error: unavailableError('The signed-in account changed before the request completed.')
        };
      }
      if (result && result.error) {
        return { status: 'error', user: auth.user, data: null, error: result.error };
      }
      return {
        status: 'authenticated',
        user: auth.user,
        data: result ? result.data : null,
        error: null
      };
    } catch (error) {
      return { status: 'error', user: auth.user, data: null, error: error };
    }
  }

  function invalidResourceResult() {
    return Promise.resolve({
      status: 'error',
      user: null,
      data: null,
      error: new TypeError('A non-empty resource id is required.')
    });
  }

  function getActivity(resourceId) {
    var id = normalizeResourceId(resourceId);
    if (!id) return invalidResourceResult();

    return withVerifiedUser(function (client, user) {
      return client
        .from(TABLE)
        .select(SELECT_FIELDS)
        .eq('user_id', user.id)
        .eq('resource_id', id)
        .maybeSingle();
    });
  }

  function listActivity() {
    return withVerifiedUser(function (client, user) {
      return client
        .from(TABLE)
        .select(SELECT_FIELDS)
        .eq('user_id', user.id)
        .order('last_viewed_at', { ascending: false, nullsFirst: false });
    });
  }

  function upsertPatch(resourceId, patch) {
    var id = normalizeResourceId(resourceId);
    if (!id) return invalidResourceResult();

    return withVerifiedUser(function (client, user) {
      var payload = Object.assign({
        user_id: user.id,
        resource_id: id,
        updated_at: new Date().toISOString()
      }, patch);

      return client
        .from(TABLE)
        .upsert(payload, {
          onConflict: 'user_id,resource_id',
          defaultToNull: false
        })
        .select(SELECT_FIELDS)
        .single();
    });
  }

  function recordView(resourceId) {
    return upsertPatch(resourceId, { last_viewed_at: new Date().toISOString() });
  }

  function setBookmarked(resourceId, bookmarked) {
    return upsertPatch(resourceId, { bookmarked: !!bookmarked });
  }

  function setHelpful(resourceId, helpful) {
    if (helpful !== null && typeof helpful !== 'boolean') {
      return Promise.resolve({
        status: 'error',
        user: null,
        data: null,
        error: new TypeError('Helpful must be true, false, or null.')
      });
    }
    return upsertPatch(resourceId, { helpful: helpful });
  }

  function recordDownload(resourceId) {
    var id = normalizeResourceId(resourceId);
    if (!id) return invalidResourceResult();

    return withVerifiedUser(async function (client) {
      var result = await client.rpc('record_resource_download', { p_resource_id: id });
      return { data: normalizeOne(result.data), error: result.error };
    });
  }

  function onAuthChange(listener) {
    if (typeof listener !== 'function') return function () {};
    listeners.push(listener);
    return function () {
      var index = listeners.indexOf(listener);
      if (index !== -1) listeners.splice(index, 1);
    };
  }

  var client = getClient();
  if (client && client.auth && typeof client.auth.onAuthStateChange === 'function') {
    client.auth.onAuthStateChange(function (event, session) {
      var nextUserId = session && session.user ? session.user.id : null;
      var identityEvent = event === 'SIGNED_IN' || event === 'SIGNED_OUT' ||
        event === 'USER_DELETED' || event === 'INITIAL_SESSION';

      if (identityEvent && nextUserId !== observedUserId) {
        observedUserId = nextUserId;
        identityVersion += 1;
      }
      if (identityEvent) notifyAuthChange(event, session);
    });
  }

  global.ResourceActivityStore = {
    getAuthState: getAuthState,
    getActivity: getActivity,
    listActivity: listActivity,
    recordView: recordView,
    setBookmarked: setBookmarked,
    setHelpful: setHelpful,
    recordDownload: recordDownload,
    onAuthChange: onAuthChange
  };
})(typeof window !== 'undefined' ? window : globalThis);
