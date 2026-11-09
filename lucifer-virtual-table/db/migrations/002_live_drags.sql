CREATE TABLE token_drags(
 world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
 scene_id TEXT NOT NULL,
 token_id TEXT NOT NULL,
 user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 gesture_id TEXT NOT NULL,
 seq INTEGER NOT NULL,
 x DOUBLE PRECISION NOT NULL,
 y DOUBLE PRECISION NOT NULL,
 updated_at BIGINT NOT NULL,
 PRIMARY KEY(world_id,scene_id,token_id)
);
CREATE INDEX token_drags_expiry ON token_drags(updated_at);
