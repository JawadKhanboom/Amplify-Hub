// Shared auth helpers for AmplifyHub.
// Load order on every page that uses this:
// 1. <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
// 2. <script src="auth-config.js"></script>
// 3. <script src="auth.js"></script>

let authContextVersion = 0;

async function signUpUser(name, email, password) {
  const requestVersion = authContextVersion;
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } }
  });
  if (!error && data && data.session && data.user && requestVersion === authContextVersion) {
    authContextVersion += 1;
    setProgressOwner(data.user.id);
  }
  return { data, error };
}

async function signInUser(email, password) {
  const requestVersion = authContextVersion;
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (!error && data && data.user && requestVersion === authContextVersion) {
    authContextVersion += 1;
    setProgressOwner(data.user.id);
  }
  return { data, error };
}

async function signOutUser() {
  const previousOwner = getProgressOwner();
  const requestVersion = authContextVersion + 1;
  authContextVersion = requestVersion;
  clearProgressOwner();
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    if (previousOwner && requestVersion === authContextVersion) {
      try {
        const { data } = await supabaseClient.auth.getUser();
        if (data && data.user && data.user.id === previousOwner && requestVersion === authContextVersion) {
          authContextVersion += 1;
          setProgressOwner(previousOwner);
        }
      } catch (verificationError) { /* Keep progress hidden when sign-out state is uncertain. */ }
    }
    throw error;
  }
  window.location.href = 'signin.html';
}

function getProgressOwner() {
  return window.AmplifyJourneyProgress && typeof window.AmplifyJourneyProgress.getOwner === 'function'
    ? window.AmplifyJourneyProgress.getOwner()
    : null;
}

function setProgressOwner(userId) {
  if (window.AmplifyJourneyProgress && typeof window.AmplifyJourneyProgress.setOwner === 'function') {
    window.AmplifyJourneyProgress.setOwner(userId || null, !!userId);
  }
}

function clearProgressOwner() {
  if (window.AmplifyJourneyProgress && typeof window.AmplifyJourneyProgress.clearOwner === 'function') {
    window.AmplifyJourneyProgress.clearOwner();
    return;
  }
  setProgressOwner(null);
}

async function getSession() {
  const { data } = await supabaseClient.auth.getSession();
  return data.session;
}

async function getCurrentUser(expectedUserId, expectedVersion) {
  const requestVersion = expectedVersion === undefined ? authContextVersion : expectedVersion;
  if (requestVersion !== authContextVersion) return null;
  const { data } = await supabaseClient.auth.getUser();
  if (requestVersion !== authContextVersion) return null;
  if (expectedUserId && (!data.user || data.user.id !== expectedUserId)) return null;
  if (data.user) {
    setProgressOwner(data.user.id);
    if (window.AmplifyJourneyProgress && typeof window.AmplifyJourneyProgress.syncWithCloud === 'function') {
      setTimeout(() => { window.AmplifyJourneyProgress.syncWithCloud(); }, 0);
    }
  } else clearProgressOwner();
  return data.user;
}

// Call this at the top of any page that should be locked to logged-in users.
// If there's no session, it bounces to signin.html and remembers where to
// send the person back to after they log in.
async function requireAuth() {
  const session = await getSession();
  if (!session) {
    const currentPage = window.location.pathname.split('/').pop();
    window.location.href = `signin.html?redirect=${currentPage}`;
    return null;
  }
  // getUser() verifies the owner before any browser cache is selected.
  // If the network is unavailable, protected content can still use the
  // existing session while progress remains anonymous for this tab.
  try { await getCurrentUser(); } catch (error) { /* offline */ }
  return session;
}

if (typeof supabaseClient !== 'undefined' && supabaseClient.auth && supabaseClient.auth.onAuthStateChange) {
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
      authContextVersion += 1;
      clearProgressOwner();
      return;
    }
    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session && session.user) {
      const userId = session.user.id;
      if (getProgressOwner() !== userId) {
        authContextVersion += 1;
        clearProgressOwner();
      }
      const requestVersion = authContextVersion;
      setTimeout(() => { getCurrentUser(userId, requestVersion).catch(() => {}); }, 0);
    }
  });
}
