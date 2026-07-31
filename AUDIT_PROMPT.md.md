You are acting as a senior full-stack engineer, security auditor, database architect, QA engineer, and DevOps reviewer.

Deeply audit my entire project, including

 My complete website codebase
 Every frontend and backend file
 My Supabase configuration, database schema, migrations, authentication, storage, policies, functions, and Edge Functions
 My local Git repository
 My connected GitHub repository, branches, commits, workflows, deployment configuration, and repository hygiene
 All configuration files, environment-variable usage, dependencies, assets, scripts, and documentation

## Main objective

Read and inspect the entire project carefully, file by file and line by line. Identify anything that

 Is currently broken
 Is partially implemented
 Could cause errors later
 Creates security or privacy risks
 Could break authentication or user sessions
 Could expose private data or API keys
 Could cause database corruption or inconsistent data
 Could make deployment fail
 Could create performance problems
 Makes the project difficult to maintain or scale
 Produces an inconsistent user experience
 Is duplicated, outdated, unused, misleading, or unnecessarily complex

Do not give me a shallow overview. Trace how the complete system works from the landing page through authentication, dashboard, lessons, progress tracking, AI Coach, Supabase, and deployment.

## Important working rules

1. Start in audit-only mode. Do not modify, delete, rename, move, format, or generate files until the audit is complete.
2. Do not assume a feature works because a file exists. Trace the real execution path.
3. Do not ignore large, old, duplicated, generated, or strangely named files.
4. Inspect the contents of relevant files instead of relying only on filenames.
5. Ignore dependency build folders such as `node_modules`, `.git`, build output, cache folders, and binary files, but inspect the files that control them.
6. Never display complete secrets, private keys, access tokens, passwords, service-role keys, or sensitive user information. Report the location and type of exposure safely.
7. Clearly separate confirmed bugs from possible risks and optional improvements.
8. Do not recommend major rewrites unless they are genuinely necessary.
9. Preserve the current AmplifyHub design direction and product scope unless there is a strong technical reason to change something.
10. When a problem appears in multiple files, identify the root cause instead of listing the same symptom repeatedly.
11. Verify findings with searches, dependency tracing, configuration inspection, and available tests whenever possible.
12. If access to Supabase, GitHub, deployment logs, or remote configuration is unavailable, clearly state what was and was not verified.

## Phase 1 — Understand and map the project

Before reviewing individual problems

 Print the meaningful project directory structure.
 Identify the framework, languages, package manager, build system, database approach, hosting platform, and external services.
 Identify all application entry points.
 Identify active files versus abandoned, legacy, duplicate, backup, copied, or experimental files.
 Find similarly named files such as numbered copies, old versions, downloaded copies, and conflicting implementations.
 Determine whether the actual project is plain HTMLCSSJavaScript, React, Next.js, or a mixture.
 Find all package manifests, lockfiles, configuration files, `.env` references, Supabase folders, SQL files, workflows, and deployment files.
 Explain the architecture in plain English.
 Create a page and feature map showing which files implement each feature.
 Create a dependency and data-flow map showing how the frontend, authentication, Supabase, AI services, and deployment connect.

Map these AmplifyHub areas specifically

 Landing page
 Sign-up
 Login
 Logout
 Password reset
 Email verification
 Protected-page access
 Dashboard
 Journey and lesson system
 Lesson completion
 Progress tracking
 AI Coach chat
 AI Coach voice features
 Document uploads
 Settings or profile
 Resources
 Navigation and footer links
 Responsivemobile behavior
 Error, loading, and empty states

## Phase 2 — Review every relevant file

For every meaningful source or configuration file, determine

 What the file is responsible for
 Whether it is actively used
 Which files import, reference, load, or depend on it
 Whether its imports and references are correct
 Whether it contains broken, incomplete, dead, duplicated, outdated, unreachable, or conflicting code
 Whether filenames and relative paths match exactly, including capitalization
 Whether browser scripts load in the correct order
 Whether asynchronous operations are awaited and safely handled
 Whether errors are caught and communicated properly
 Whether functions can run multiple times accidentally
 Whether event listeners are duplicated
 Whether DOM selectors can return `null`
 Whether code runs before the required elements exist
 Whether state can become stale or inconsistent
 Whether comments, TODOs, placeholders, mock data, temporary code, console logs, or debugging code remain
 Whether user-generated data is validated, escaped, and handled safely
 Whether any visual component claims functionality that does not actually exist

Create a file-by-file audit table with

 File path
 Purpose
 Active, legacy, duplicate, generated, or unknown status
 Main dependencies
 Problems found
 Severity
 Recommended action

Do not paste every line of code into the report. Reference exact file paths, functions, selectors, SQL objects, and line ranges where possible.

## Phase 3 — Frontend and user-flow audit

Test and trace every important user journey

1. Visitor opens the landing page.
2. Visitor clicks every navigation link, CTA, footer link, resource link, and demo button.
3. Visitor signs up.
4. Existing user logs in.
5. Unauthenticated user attempts to open a protected page directly.
6. Authenticated user refreshes a protected page.
7. User logs out.
8. User resets a password.
9. User completes a lesson.
10. Progress appears in the Journey, Dashboard, and Progress views.
11. User opens the AI Coach.
12. User sends a message.
13. User attempts voice interaction.
14. User uploads a document.
15. User edits profile or settings.
16. User opens the project on mobile and desktop.
17. User encounters slow internet, failed requests, missing records, expired sessions, and invalid input.

Check specifically for

 Broken links and incorrect relative paths
 Missing pages and assets
 Links that work only inside an AI preview but not after downloading or deploying
 Protected pages without real authentication checks
 Authentication checks that run too late and expose protected UI briefly
 Redirect loops
 Session persistence problems
 Inconsistent navigation and sidebars
 Duplicate IDs
 Invalid HTML
 Accessibility issues
 Keyboard-navigation failures
 Missing labels and alt text
 Poor focus states
 Insufficient contrast
 Layout overflow
 Mobile responsiveness problems
 Hardcoded content that should come from Supabase
 Fake progress, placeholder values, or data that resets unexpectedly
 Multiple sources of truth for the same user or progress state
 Local-storage and Supabase data conflicts
 Missing loading, success, empty, offline, and error states
 Repeated submissions caused by buttons not being disabled
 Forms that can submit invalid or dangerous content
 Missing confirmation for destructive actions

## Phase 4 — Authentication and authorization audit

Deeply inspect the complete authentication system

 Supabase client initialization
 Sign-up
 Login
 Logout
 Session restoration
 Session refresh
 Authentication listeners
 Password reset
 Email verification
 Redirect URLs
 OAuth configuration, if present
 Protected-route logic
 Role-based access, if present
 User-profile creation
 Account deletion, if present

Look for

 Protected pages that rely only on frontend hiding
 Trusting a user ID supplied by the browser
 Users being able to read or update another user’s records
 Service-role keys exposed to the browser
 Anonymous keys being used incorrectly
 Missing authorization checks
 Incorrect redirect URLs between localhost, preview, and production
 Duplicate profile creation
 Auth race conditions
 Stale sessions
 Missing handling for expired or revoked sessions
 Authentication code duplicated differently across pages
 Unverified email states being treated incorrectly
 Unsafe account-recovery behavior
 Missing rate limiting or abuse protection
 User metadata being trusted without database validation

Explain the exact auth flow and identify the weakest point.

## Phase 5 — Supabase database audit

Inspect all Supabase-related files and remote metadata available to you

 Tables
 Columns
 Types
 Defaults
 Primary keys
 Foreign keys
 Unique constraints
 Check constraints
 Indexes
 Views
 Functions
 Triggers
 Extensions
 Enums
 Migrations
 Seed data
 Row Level Security
 Policies
 Storage buckets
 Storage policies
 Realtime configuration
 Edge Functions
 Secrets and environment references

For every user-owned table, verify

 RLS is enabled.
 SELECT, INSERT, UPDATE, and DELETE are intentionally controlled.
 Policies use authenticated identity safely.
 A user cannot change ownership fields to another user.
 Admin-only actions cannot be performed by normal users.
 Public access is intentional.
 Foreign keys prevent orphaned records.
 Unique constraints prevent duplicate progress, profiles, subscriptions, or lesson-completion records.
 Indexes support frequently filtered and joined columns.
 Timestamps and update triggers behave correctly.
 Cascading deletion behavior is deliberate.
 Nullability matches actual application behavior.
 Data types match frontend expectations.
 Migrations reproduce the current database reliably.

Actively look for dangerous policy patterns such as

 `USING (true)`
 `WITH CHECK (true)`
 Policies missing a user ownership condition
 Public buckets containing private documents
 INSERT policies that do not verify `user_id`
 UPDATE policies that protect reads but not written values
 Service-role logic accidentally moved into the frontend
 Security-definer functions with unsafe search paths
 Functions that allow privilege escalation
 Storage paths that allow one user to access another user’s files

Check for schema drift between

 Local migrations
 SQL files
 Generated types
 Frontend queries
 The current remote database, when accessible

Create a database table containing

 Database object
 Purpose
 Current protection
 Problem
 Exploitation or failure scenario
 Required fix
 Suggested migration

Do not execute destructive SQL.

## Phase 6 — Progress and lesson-system integrity

Deeply trace how lesson completion and progress work.

Determine

 Where lesson definitions come from
 How lesson IDs are generated and kept stable
 Where completion is stored
 Whether completion can be duplicated
 Whether progress is calculated or hardcoded
 Whether Dashboard, Journey, and Progress use the same source of truth
 Whether progress survives logout, refresh, and another device
 Whether one user can affect another user’s progress
 Whether a deleted or renamed lesson corrupts progress
 Whether module and overall percentages are calculated accurately
 Whether users can mark nonexistent lessons complete
 Whether completing the same lesson twice produces duplicate rows
 Whether concurrent requests create incorrect values
 Whether progress can exceed 100% or become negative
 Whether new lessons change existing users’ progress unexpectedly

Recommend a stable progress data model if the current one is unsafe, but do not rewrite it during the audit.

## Phase 7 — AI Coach, voice, and document-upload audit

Inspect

 Where prompts are constructed
 How messages are stored
 How API calls are made
 Whether an AI provider key is exposed in frontend code
 Whether the browser can bypass usage controls
 Whether requests are authenticated
 Whether user input is validated and size-limited
 Whether output is rendered safely
 Whether conversation history can leak between users
 Whether document content is handled securely
 Whether uploads are restricted by type, size, path, and ownership
 Whether malicious files can be uploaded
 Whether private documents use signed URLs or public URLs
 Whether deleted files leave database records or storage objects behind
 Whether voice permissions, recording states, timeouts, and failures are handled
 Whether microphone streams are stopped correctly
 Whether API costs can be abused
 Whether prompt injection from uploaded documents is considered
 Whether rate limits, quotas, token limits, and maximum file sizes exist
 Whether errors expose internal details

Identify what must run on a trusted server or Supabase Edge Function instead of in the browser.

## Phase 8 — Security audit

Search the full repository and Git history for

 API keys
 Supabase service-role keys
 Access tokens
 Passwords
 Database URLs
 Private URLs
 Hardcoded credentials
 JWT secrets
 Personal data
 Accidentally committed `.env` files
 Secrets that were removed from current files but still exist in Git history

Also inspect for

 Cross-site scripting
 SQL injection
 Command injection
 Path traversal
 Open redirects
 Cross-site request forgery where relevant
 Insecure direct-object references
 Broken access control
 Unsafe `innerHTML`
 Unsafe URL construction
 Missing content security controls
 Dependency vulnerabilities
 Unrestricted file uploads
 User enumeration
 Brute-force exposure
 Sensitive error messages
 Logging of private data
 Insecure CORS behavior
 Supply-chain risks
 Clickjacking
 Mixed content
 Missing security headers
 Public source maps exposing sensitive implementation details
 Trusting client-calculated prices, roles, progress, ownership, or permissions

For every security issue, explain

 What is vulnerable
 Where it occurs
 How it could be exploited
 What data or functionality is at risk
 The safest fix
 Whether any key or credential must be rotated immediately

Do not reveal any discovered secret in full.

## Phase 9 — Dependency and build audit

Inspect all package manifests and lockfiles.

Check for

 Unused dependencies
 Missing dependencies
 Duplicate libraries serving the same purpose
 Vulnerable or abandoned packages
 Version conflicts
 Incorrect peer dependencies
 Packages installed globally but expected locally
 Multiple conflicting lockfiles
 Scripts that work only on one computer
 Windows versus Linux path issues
 Case-sensitive filename problems that could fail on Vercel
 Node-version incompatibility
 Environment variables missing during build
 Static files referenced outside deployment output
 Incorrect build, preview, start, or development commands
 Build warnings being ignored
 Generated files accidentally committed
 Lockfiles not matching the package manifest

Run only safe, non-destructive checks such as installation verification, type checking, linting, tests, and production builds when the environment allows it.

Record every command used and summarize its result. Do not automatically apply dependency upgrades.

## Phase 10 — Git and GitHub audit

Inspect

 Current branch
 Working-tree status
 Tracked and untracked files
 `.gitignore`
 Branch structure
 Remote configuration
 Recent commit history
 Merge conflicts
 Large files
 Duplicate files
 Generated files
 Sensitive files
 Commit quality
 Tags and releases
 Pull-request workflow, when visible
 GitHub Actions
 Branch-protection expectations
 Dependabot or security scanning configuration
 Repository visibility
 GitHub Pages or Vercel integration
 Differences between local files and the remote repository

Look for

 Local changes not pushed
 Remote changes not pulled
 Work being performed on the wrong branch
 Force-push risk
 Uncommitted critical work
 Secrets in current or previous commits
 Missing `.gitignore` rules
 Database dumps or uploaded documents accidentally tracked
 Build folders committed
 Multiple versions of the same page
 Case-only filename renames that may fail on Linux
 Workflow files with overly broad permissions
 Unpinned GitHub Actions
 Deployment running from the wrong branch
 Production code differing from the reviewed code

Do not push, pull, reset, rebase, merge, checkout another branch, alter history, or delete anything without explicit permission.

## Phase 11 — Deployment and environment audit

Review configuration for all relevant environments

 Local development
 GitHub
 Vercel or current hosting
 Supabase
 Preview deployments
 Production

Create an environment-variable matrix showing

 Variable name
 Where it is referenced
 Which environments require it
 Whether it is public or secret
 Whether the naming convention is correct
 Whether it is missing, duplicated, or dangerously exposed

Check

 Production URLs
 Authentication redirect URLs
 CORS settings
 Supabase allowed URLs
 Preview-domain behavior
 Environment separation
 Build output
 Custom-domain configuration
 HTTPS behavior
 Cache behavior
 Security headers
 Error pages
 SPA routing or rewrites
 Asset paths
 Serverless or Edge Function configuration
 Deployment logs, when accessible
 Database migrations during deployment
 Rollback readiness

## Phase 12 — Performance, accessibility, and UX audit

Evaluate

 Initial page load
 JavaScript size
 CSS duplication
 Image size and formats
 Font loading
 Render-blocking resources
 Repeated Supabase requests
 Unnecessary API calls
 Missing pagination
 Missing caching
 Memory leaks
 Repeated listeners
 Repeated authentication checks
 Large document uploads
 Slow database queries
 Missing indexes
 Layout shift
 Mobile performance
 Reduced-motion support
 Keyboard access
 Screen-reader structure
 Form labels
 Semantic HTML
 Heading hierarchy
 Focus management
 Color contrast
 Error-message clarity
 Loading-state quality
 Empty-state quality
 Consistency between pages

Separate important performance fixes from premature optimization.

## Phase 13 — Testing and reliability audit

Find all existing tests and determine what they actually cover.

Identify missing tests for

 Sign-up and login
 Protected routes
 Session restoration
 Password reset
 RLS policies
 Cross-user data isolation
 Lesson completion
 Duplicate completion
 Progress calculation
 AI Coach requests
 Document uploads
 Storage ownership
 Form validation
 Broken navigation
 Mobile layout
 Build and deployment

Recommend a practical test strategy divided into

 Unit tests
 Integration tests
 End-to-end tests
 SupabaseRLS tests
 Manual pre-launch checks

For each recommended test, state the failure it is designed to prevent.

## Phase 14 — Code quality and maintainability

Check for

 Repeated Supabase initialization
 Repeated authentication logic
 Repeated navigation markup
 Repeated styles
 Large functions
 Global mutable state
 Unclear naming
 Hidden coupling
 Magic strings and numbers
 Missing constants
 Inconsistent data models
 Inconsistent error handling
 Incorrect separation of concerns
 Dead code
 Premature abstraction
 Missing documentation
 Misleading comments
 Components or utilities that should be shared
 Files that should remain separate
 Code that is too complicated for the project’s current stage

Recommend the smallest maintainable improvement, not unnecessary enterprise architecture.

## Severity system

Classify every finding using exactly these levels

 Critical Active security exposure, data-loss risk, secret leakage, complete auth bypass, or production-blocking failure.
 High Major feature failure, cross-user data risk, broken deployment, serious data-integrity problem, or likely production incident.
 Medium Reliability, performance, maintainability, accessibility, or UX issue that should be addressed before or soon after launch.
 Low Minor cleanup, consistency, naming, or polish issue.
 Informational Observation or optional future improvement.

Also label confidence as

 Confirmed
 Highly likely
 Possible
 Needs external verification

## Required final report

Produce the final report in this exact structure

### 1. Executive summary

Explain

 Overall project health
 Whether it is safe to launch
 The biggest technical weakness
 The biggest security weakness
 The biggest data-integrity weakness
 The biggest deployment risk
 The strongest parts of the project

### 2. What you inspected

List

 Directories
 Important files
 Supabase objects
 GitGitHub areas
 Commands and checks performed
 Areas that could not be accessed or verified

### 3. Architecture and data-flow map

Explain how the full application works and how information moves between components.

### 4. Feature-completeness matrix

Use these statuses

 Working
 Partially working
 Present but disconnected
 Placeholdermock
 Broken
 Missing
 Unable to verify

Include evidence for each feature.

### 5. Prioritized findings

Create a table with

 ID
 Severity
 Confidence
 Category
 File or database object
 Line, function, selector, policy, or configuration
 Problem
 User impact
 Technical impact
 Recommended fix
 Effort Small, Medium, or Large
 Dependency or prerequisite

Sort by severity and practical impact.

### 6. Security report

Include secrets, authentication, authorization, RLS, storage, AI API usage, upload safety, dependencies, Git history, and deployment security.

### 7. Supabase report

Include schema, policies, migrations, constraints, indexes, storage, functions, triggers, and schema drift.

### 8. Git and GitHub report

Include repository cleanliness, branches, remote synchronization, history, workflows, secrets, and deployment integration.

### 9. Broken and incomplete user flows

Describe each flow step by step and identify the exact point of failure.

### 10. Duplicate, legacy, and unused files

For each file, recommend

 Keep
 Merge
 Archive
 Rename
 Delete later after verification

Do not delete anything during the audit.

### 11. Data-integrity risks

Explain how user profiles, lessons, progress, messages, and uploads could become duplicated, lost, inconsistent, or associated with the wrong user.

### 12. Performance and accessibility report

Separate urgent issues from optional optimization.

### 13. Missing tests

Provide the smallest high-value testing plan.

### 14. Recommended repair order

Divide work into

 Immediate emergency actions
 Before the next deployment
 Before beta users
 Before public launch
 After launch
 Future scaling improvements

### 15. Exact action plan

Create numbered tasks. Each task must include

 Objective
 Files or database objects involved
 Why it matters
 Exact implementation approach
 Verification steps
 Risks
 Estimated complexity
 Dependencies

### 16. Top 10 actions

Finish with the ten highest-impact tasks in the exact order I should complete them.

## Additional output requirements

 Be direct and specific.
 Use exact file paths and object names.
 Include line numbers or function names where reliable.
 Do not use vague recommendations such as “improve security” or “clean the code.”
 Explain the exact change needed.
 Consolidate duplicate findings.
 Flag anything that requires key rotation, migration backup, or production downtime.
 Mark assumptions clearly.
 Do not claim that something was tested when it was only inspected.
 Do not confuse a missing feature with a broken feature.
 Do not begin fixing the project after the report.

After delivering the report, stop and ask me which numbered repair task I want you to implement first. Wait for explicit approval before changing any code, database object, Git history, GitHub configuration, or deployment setting.
