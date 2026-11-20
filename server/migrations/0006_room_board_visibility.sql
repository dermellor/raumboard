ALTER TABLE rooms
ADD COLUMN board_visibility TEXT NOT NULL DEFAULT 'always'
CHECK (board_visibility IN ('always', 'open-only'));
