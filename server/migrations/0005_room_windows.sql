-- Rooms gain optional weekly time windows: a Lernort (e.g. an AG) that is
-- offered only on certain weekdays between certain times. Stored as JSON
-- ([{ days: [1,4], start: '14:30', end: '16:00' }], days = ISO weekday).
-- NULL or absent = always available, the state of every existing room.
ALTER TABLE rooms ADD COLUMN windows TEXT;
