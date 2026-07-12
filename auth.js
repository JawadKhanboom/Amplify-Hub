// Shared auth helpers for AmplifyHub.
// Load order on every page that uses this:
// 1. <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
// 2. <script src="auth-config.js"></script>
// 3. <script src="auth.js"></script>

async function signUpUser(name, email, password) {
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } }
  });
  return { data, error };
}

async function signInUser(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  return { data, error };
}

async function signOutUser() {
  await supabaseClient.auth.signOut();
  window.location.href = 'signin.html';
}

async function getSession() {
  const { data } = await supabaseClient.auth.getSession();
  return data.session;
}

async function getCurrentUser() {
  const { data } = await supabaseClient.auth.getUser();
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
  return session;
}
