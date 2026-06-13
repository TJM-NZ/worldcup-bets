CREATE TABLE exact_score_bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  match_id int NOT NULL REFERENCES matches(id),
  predicted_home int NOT NULL CHECK (predicted_home >= 0),
  predicted_away int NOT NULL CHECK (predicted_away >= 0),
  gems_wagered int NOT NULL CHECK (gems_wagered >= 10),
  gems_won int NOT NULL DEFAULT 0,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(member_id, match_id)
);

ALTER TABLE exact_score_bets ENABLE ROW LEVEL SECURITY;

-- Workspace members can read bets from their shared workspace
CREATE POLICY "workspace members can read exact score bets"
  ON exact_score_bets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM members m1
      JOIN members m2 ON m1.workspace_id = m2.workspace_id
      WHERE m1.id = exact_score_bets.member_id
        AND m2.user_id = auth.uid()
    )
  );

-- Members can only insert their own bets
CREATE POLICY "members can insert own exact score bets"
  ON exact_score_bets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM members
      WHERE id = exact_score_bets.member_id
        AND user_id = auth.uid()
    )
  );
