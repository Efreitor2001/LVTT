#!/bin/sh
set -eu
LVT_APP_PASSWORD="$(cat /run/secrets/app_db_password)"
export LVT_APP_PASSWORD
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
\getenv app_password LVT_APP_PASSWORD
CREATE ROLE lvt_app LOGIN PASSWORD :'app_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;
ALTER DATABASE lucifer_vtt OWNER TO lvt_app;
ALTER SCHEMA public OWNER TO lvt_app;
SQL
unset LVT_APP_PASSWORD
