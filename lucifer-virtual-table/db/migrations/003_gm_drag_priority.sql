CREATE TABLE cancelled_drags(
 world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
 gesture_id TEXT NOT NULL,
 user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 expires_at BIGINT NOT NULL,
 PRIMARY KEY(world_id,gesture_id)
);
CREATE INDEX cancelled_drags_expiry ON cancelled_drags(expires_at);
