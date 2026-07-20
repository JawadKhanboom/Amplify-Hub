# AmplifyHub — Release Checklist

A repeatable checklist for shipping changes to production. Production is the
Vercel deployment (`https://amplify-hub-six.vercel.app`, deployed from `main`)
plus the hosted Supabase project (`dsuahpcqrrlbudomjrye`).

## 1. Before merging

- [ ] CI is green on the PR (`.github/workflows/qa.yml` runs the build and every QA suite automatically).
- [ ] To reproduce locally from `sales-mindset-app/`:
  - `npm run build` — typecheck + Vite build
  - `npm run qa:account-trust` — static security/trust checks (no browser needed)
  - `npm run qa` / `qa:booking` / `qa:progress` / `qa:coach-security` / `qa:challenges` / `qa:profile-progress` — browser suites (need Chrome or `CHROME_PATH`)
- [ ] No secrets in the diff: `git diff main --stat` and scan for keys. Only the **publishable** anon key may appear in the repo (`auth-config.js`). The service-role key must never be committed, logged, or hardcoded.

## 2. Backend deploy (only when `supabase/` changed)

- [ ] New migrations: `supabase db push --linked` (all migrations must be idempotent — safe to re-run).
- [ ] Changed Edge Functions: `supabase functions deploy <name> --project-ref dsuahpcqrrlbudomjrye`.
- [ ] If allowed origins change (new domain), update the `ALLOWED_ORIGINS` env var for the functions (Dashboard → Edge Functions → Secrets); the in-code default list covers localhost:8742 and the Vercel domain.

## 3. One-time / occasionally-drifting configuration

Verify these in the Supabase Dashboard when auth flows change:

- [ ] **Auth → URL Configuration → Site URL** must be
      `https://amplify-hub-six.vercel.app` — email templates build their links
      from it. (Set via the Management API on 2026-07-20; it previously pointed
      at `http://localhost:8000/signin.html`.)
- [ ] **Auth → URL Configuration → Redirect URLs** must include
      `https://amplify-hub-six.vercel.app/reset-password.html`
      (plus `http://localhost:8000/*` and `http://localhost:8742/*` for local
      dev — also set 2026-07-20). Without this, password-reset emails link to
      an unauthorized redirect and fail.
- [ ] **Email confirmations are ON** for the hosted project, and the built-in
      SMTP sender is limited to roughly 2 emails/hour. That quota covers signup
      confirmations AND password resets. Before any real launch, configure
      custom SMTP (Dashboard → Auth → SMTP) or users will hit
      `over_email_send_rate_limit`.
- [ ] TOTP 2FA (settings page) requires **Auth → MFA → TOTP** enabled on the
      hosted project.

## 4. Frontend deploy

- [ ] Merge the PR into `main`. Vercel deploys automatically.
- [ ] Wait for the Vercel deployment to finish before running post-deploy checks.

## 5. Post-deploy verification

- [ ] Run the production smoke test (creates and then deletes ONE disposable
      account; never touches real users). It refuses to run without
      `SMOKE_EMAIL_BASE` — an inbox YOU own; the disposable account is
      plus-addressed on it and no email is ever sent to it:

      # from sales-mindset-app/ — both env vars live in this shell only
      $keys = supabase projects api-keys --project-ref dsuahpcqrrlbudomjrye -o json | ConvertFrom-Json
      $env:SUPABASE_SERVICE_ROLE_KEY = ($keys | Where-Object { $_.name -eq 'service_role' }).api_key
      $env:SMOKE_EMAIL_BASE = 'you@yourdomain.com'
      npm run smoke:production

      All checks must pass, including "deployed signin page links to forgot-password flow".
- [ ] Run `npm run monitor:health` — all checks green.
- [ ] Manual spot-check in a browser: sign in, open Settings (connected accounts
      render), export data (file downloads), sign out.

## 6. Monitoring

- Hourly: `.github/workflows/monitor.yml` runs read-only health checks against
  production (site, auth, REST, RLS, both Edge Functions). A failed scheduled
  run emails the repo owner — treat it as an incident.
- Coach/Gemini failures and per-user quota exhaustion are only visible on real
  traffic: check Supabase Dashboard → Edge Functions → `coach-chat` → Logs for
  5xx and rate-limit responses. Auth incidents: Dashboard → Auth → Logs.
- The delete-account function logs nothing by design (no tokens/emails/errors
  may be logged); its health is covered by the hourly 401-gate check.

## 7. Rollback

- Frontend: Vercel Dashboard → Deployments → promote the previous deployment.
- Edge Functions: `git checkout <previous-tag> -- supabase/functions/<name>` and redeploy.
- Migrations are additive/idempotent; never roll back with destructive SQL against
  production — write a forward migration instead.
