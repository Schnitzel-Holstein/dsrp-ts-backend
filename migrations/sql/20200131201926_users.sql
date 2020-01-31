begin;

insert into migrations (id) values (20200131201926);

-- Do not modify anything above this comment.
-----------------------------------------------------------------------


CREATE TABLE IF NOT EXISTS users(
    id BIGSERIAL PRIMARY KEY,
    username text unique not null,
    email text unique not null,
    password text not null,
    avatar_url text,
    created_at timestamp without time zone not null default now(),
    updated_at timestamp without time zone not null default now()
);


-----------------------------------------------------------------------
-- Do not modify anything below this comment.

commit;
