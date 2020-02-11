begin;

insert into migrations (id) values (20200206125756);

-- Do not modify anything above this comment.
-----------------------------------------------------------------------

-- Forum tree
CREATE TABLE IF NOT EXISTS forums(
    id bigserial primary key,
    parent_forum bigint references forums(id),
    name text not null,
    slug text unique not null,
    description text,
    created_at timestamp without time zone default now(),
    updated_at timestamp without time zone default now()
);

-- Forum -> thread
CREATE TABLE IF NOT EXISTS threads(
    id bigserial primary key,
    parent_forum bigint references forums(id) not null,
    name text not null,
    slug text unique not null,
    description text,
    is_closed boolean default false,
    created_by bigint references users(id) not null,
    created_at timestamp without time zone default now(),
    updated_at timestamp without time zone default now()
);
-- Thread -> post
CREATE TABLE IF NOT EXISTS posts(
    id bigserial primary key,
    parent_thread bigint references threads(id),
    name text,
    description text,
    content text not null,
    created_by bigint references users(id),
    created_at timestamp without time zone default now(),
    updated_at timestamp without time zone default now()
);


-----------------------------------------------------------------------
-- Do not modify anything below this comment.

commit;
