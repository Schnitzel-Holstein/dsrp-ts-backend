begin;

insert into migrations (id) values (20200308145902);

-- Do not modify anything above this comment.
-----------------------------------------------------------------------


CREATE TABLE categories(
    id BIGSERIAL PRIMARY KEY,
    name text not null,
    description text,
    image text,
    color text,
    created_at timestamp without time zone not null default now(),
    updated_at timestamp without time zone not null default now()
);

ALTER TABLE forums
    ADD COLUMN category bigint references categories(id);


-----------------------------------------------------------------------
-- Do not modify anything below this comment.

commit;
