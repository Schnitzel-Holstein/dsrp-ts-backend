begin;

insert into migrations (id) values (20200211144947);

-- Do not modify anything above this comment.
-----------------------------------------------------------------------


DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS valid_role_types;
DROP TABLE IF EXISTS user_roles_inventory;

CREATE TABLE IF NOT EXISTS valid_role_types(
    name text unique
);

INSERT INTO valid_role_types(name) VALUES ('general'), ('faction'), ('rank');


CREATE TABLE IF NOT EXISTS user_roles(
    id bigserial primary key,
    name text unique not null,
    color text,
    image text,
    type text not null references valid_role_types(name) on delete cascade,
    created_at timestamp without time zone default now(),
    updated_at timestamp without time zone default now()
);


INSERT INTO user_roles(name, type) values ('user', 'general'), ('admin', 'general');


CREATE TABLE IF NOT EXISTS user_roles_inventory(
    id bigserial primary key,
    role_id bigint not null references user_roles(id) on delete cascade,
    user_id bigint not null references users(id) on delete cascade,
    is_active boolean not null default true,
    unique(user_id, role_id)
);

-----------------------------------------------------------------------
-- Do not modify anything below this comment.

commit;
