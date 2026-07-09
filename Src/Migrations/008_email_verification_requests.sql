-- ============================================================
-- Module: Email Verification Requests
-- Purpose: Manual (no email-sending integration yet) email verification
--          workflow. Customer/Vendor requests verification; SuperAdmin
--          reviews and approves or rejects. Approval flips
--          user_management.users.is_email_verified to TRUE.
-- ============================================================

CREATE TYPE user_management.email_verification_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE user_management.email_verification_requests (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID    NOT NULL REFERENCES user_management.users (id) ON DELETE CASCADE,
  status        user_management.email_verification_status NOT NULL DEFAULT 'pending',
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by   UUID    REFERENCES user_management.users (id) ON DELETE SET NULL, -- SuperAdmin who reviewed
  reviewed_at   TIMESTAMPTZ,
  review_note   TEXT                                    -- optional reason, mainly for rejections
);

CREATE INDEX idx_email_verif_user   ON user_management.email_verification_requests (user_id);
CREATE INDEX idx_email_verif_status ON user_management.email_verification_requests (status);

-- Only one PENDING request per user at a time — prevents duplicate-request spam.
-- A rejected/approved request doesn't count, so the user can request again later.
CREATE UNIQUE INDEX uq_email_verif_one_pending_per_user
  ON user_management.email_verification_requests (user_id)
  WHERE status = 'pending';
