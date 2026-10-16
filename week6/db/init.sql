-- Runs once, the first time the pgdata volume is created.
CREATE TABLE IF NOT EXISTS notes (
    id         SERIAL PRIMARY KEY,
    content    TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO notes (content) VALUES
    ('Hello from PostgreSQL inside a Docker container!'),
    ('This row was created by db/init.sql on first start.');
