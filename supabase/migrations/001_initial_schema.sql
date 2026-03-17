-- ============================================================================
-- Drapnr: Initial Schema Migration
-- ============================================================================

-- =========================
-- Utility: updated_at trigger
-- =========================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================
-- Table: users
-- =========================
CREATE TABLE users (
  id            uuid        PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email         text        NOT NULL,
  display_name  text,
  body_template text        NOT NULL DEFAULT 'female_avg'
                            CHECK (body_template IN ('male_slim', 'male_avg', 'female_slim', 'female_avg')),
  subscription  text        DEFAULT 'free'
                            CHECK (subscription IN ('free', 'plus', 'pro')),
  rc_customer_id    text,
  expo_push_token   text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================
-- Table: outfits
-- =========================
CREATE TABLE outfits (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES users ON DELETE CASCADE,
  name          text        NOT NULL,
  thumbnail_url text,
  status        text        DEFAULT 'processing'
                            CHECK (status IN ('processing', 'ready', 'failed')),
  captured_at   timestamptz DEFAULT now(),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX idx_outfits_user_id ON outfits (user_id);

CREATE TRIGGER trg_outfits_updated_at
  BEFORE UPDATE ON outfits
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================
-- Table: garments
-- =========================
CREATE TABLE garments (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  outfit_id      uuid        NOT NULL REFERENCES outfits ON DELETE CASCADE,
  user_id        uuid        NOT NULL REFERENCES users ON DELETE CASCADE,
  category       text        NOT NULL CHECK (category IN ('top', 'bottom', 'shoes')),
  texture_url    text,
  thumbnail_url  text,
  dominant_color text,
  metadata       jsonb       DEFAULT '{}',
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE INDEX idx_garments_user_id   ON garments (user_id);
CREATE INDEX idx_garments_outfit_id ON garments (outfit_id);
CREATE INDEX idx_garments_category  ON garments (category);

CREATE TRIGGER trg_garments_updated_at
  BEFORE UPDATE ON garments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================
-- Table: combinations
-- =========================
CREATE TABLE combinations (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES users ON DELETE CASCADE,
  name          text        NOT NULL,
  top_id        uuid        REFERENCES garments,
  bottom_id     uuid        REFERENCES garments,
  shoes_id      uuid        REFERENCES garments,
  thumbnail_url text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX idx_combinations_user_id ON combinations (user_id);

CREATE TRIGGER trg_combinations_updated_at
  BEFORE UPDATE ON combinations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================
-- Table: processing_jobs
-- =========================
CREATE TABLE processing_jobs (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  outfit_id      uuid        NOT NULL REFERENCES outfits ON DELETE CASCADE,
  user_id        uuid        NOT NULL REFERENCES users ON DELETE CASCADE,
  status         text        DEFAULT 'queued'
                             CHECK (status IN ('queued', 'extracting', 'segmenting', 'mapping', 'complete', 'failed')),
  progress       int         DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  tier_priority  int         DEFAULT 3 CHECK (tier_priority IN (1, 2, 3)),
  error_message  text,
  started_at     timestamptz,
  completed_at   timestamptz,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE INDEX idx_processing_jobs_user_id   ON processing_jobs (user_id);
CREATE INDEX idx_processing_jobs_outfit_id ON processing_jobs (outfit_id);

CREATE TRIGGER trg_processing_jobs_updated_at
  BEFORE UPDATE ON processing_jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================
-- Table: subscriptions
-- =========================
CREATE TABLE subscriptions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES users ON DELETE CASCADE,
  tier            text        NOT NULL CHECK (tier IN ('plus', 'pro')),
  rc_entitlement  text,
  expires_at      timestamptz,
  is_active       boolean     DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions (user_id);

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE outfits          ENABLE ROW LEVEL SECURITY;
ALTER TABLE garments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE combinations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_jobs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions    ENABLE ROW LEVEL SECURITY;

-- -------------------------
-- users policies
-- -------------------------
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- -------------------------
-- outfits policies
-- -------------------------
CREATE POLICY "outfits_select_own" ON outfits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "outfits_insert_own" ON outfits
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (
      -- pro: unlimited
      (SELECT subscription FROM users WHERE id = auth.uid()) = 'pro'
      OR
      -- plus: max 20
      (
        (SELECT subscription FROM users WHERE id = auth.uid()) = 'plus'
        AND (SELECT count(*) FROM outfits WHERE user_id = auth.uid()) < 20
      )
      OR
      -- free: max 2
      (
        (SELECT subscription FROM users WHERE id = auth.uid()) IN ('free')
        AND (SELECT count(*) FROM outfits WHERE user_id = auth.uid()) < 2
      )
    )
  );

CREATE POLICY "outfits_update_own" ON outfits
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "outfits_delete_own" ON outfits
  FOR DELETE USING (auth.uid() = user_id);

-- -------------------------
-- garments policies (read-only for users; inserts via service role)
-- -------------------------
CREATE POLICY "garments_select_own" ON garments
  FOR SELECT USING (auth.uid() = user_id);

-- -------------------------
-- combinations policies
-- -------------------------
CREATE POLICY "combinations_select_own" ON combinations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "combinations_insert_own" ON combinations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "combinations_update_own" ON combinations
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "combinations_delete_own" ON combinations
  FOR DELETE USING (auth.uid() = user_id);

-- -------------------------
-- processing_jobs policies (read-only for users; inserts via service role)
-- -------------------------
CREATE POLICY "processing_jobs_select_own" ON processing_jobs
  FOR SELECT USING (auth.uid() = user_id);

-- -------------------------
-- subscriptions policies (read-only for users)
-- -------------------------
CREATE POLICY "subscriptions_select_own" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);
