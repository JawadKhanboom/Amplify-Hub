-- Ensure ON DELETE CASCADE on hand-created coach tables so that
-- auth.admin.deleteUser() automatically removes all user data.
--
-- coaching_sessions, coach_messages, and coach_documents were created
-- via the Supabase dashboard without tracked migrations. Their FKs to
-- auth.users may not have CASCADE. This migration drops the old FK
-- constraint (if it exists) and re-adds it with ON DELETE CASCADE.
--
-- Safe to run multiple times — every statement is idempotent.

-- ── coaching_sessions.user_id → auth.users(id) ───────────────────────────
DO $$
BEGIN
  -- Drop any existing FK on user_id
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'coaching_sessions'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'user_id'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE public.coaching_sessions DROP CONSTRAINT ' || quote_ident(tc.constraint_name)
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.table_name = 'coaching_sessions'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'user_id'
      LIMIT 1
    );
  END IF;
END $$;

ALTER TABLE public.coaching_sessions
  ADD CONSTRAINT coaching_sessions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── coach_messages.user_id → auth.users(id) ──────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'coach_messages'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'user_id'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE public.coach_messages DROP CONSTRAINT ' || quote_ident(tc.constraint_name)
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.table_name = 'coach_messages'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'user_id'
      LIMIT 1
    );
  END IF;
END $$;

ALTER TABLE public.coach_messages
  ADD CONSTRAINT coach_messages_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── coach_documents.user_id → auth.users(id) ─────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'coach_documents'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'user_id'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE public.coach_documents DROP CONSTRAINT ' || quote_ident(tc.constraint_name)
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.table_name = 'coach_documents'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'user_id'
      LIMIT 1
    );
  END IF;
END $$;

ALTER TABLE public.coach_documents
  ADD CONSTRAINT coach_documents_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
