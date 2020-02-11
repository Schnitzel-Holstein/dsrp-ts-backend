begin;

insert into migrations (id) values (20200201204611);

-- Do not modify anything above this comment.
-----------------------------------------------------------------------


CREATE TABLE IF NOT EXISTS user_extra_fields(
    id bigserial primary key,
    name text unique not null,
    description text,
    default_value text,
    user_can_edit boolean default true,
    show_on_profile boolean default false,
    show_on_post boolean default false,
    created_at timestamp without time zone default now(),
    updated_at timestamp without time zone default now()
);

CREATE TABLE IF NOT EXISTS user_extra_field_values(
    user_id bigint references users(id) on delete cascade,
    extra_field_id bigint references user_extra_fields(id) on delete cascade,
    extra_field_value text,
    primary key(user_id, extra_field_id)
);

-----------------------------------------------------------------------
-- Do not modify anything below this comment.

commit;
