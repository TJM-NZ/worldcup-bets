CREATE TABLE notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id uuid REFERENCES members(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('bet_won', 'bet_lost', 'score_bet_won', 'score_bet_lost')),
  title text NOT NULL,
  body text NOT NULL,
  read boolean DEFAULT false NOT NULL,
  match_id integer REFERENCES matches(id),
  points_delta integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can read own notifications" ON notifications
  FOR SELECT USING (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  );

CREATE POLICY "members can update own notifications" ON notifications
  FOR UPDATE USING (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  );

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
