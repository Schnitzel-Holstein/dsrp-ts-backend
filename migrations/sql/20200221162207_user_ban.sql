begin;

insert into migrations (id) values (20200221162207);

-- Do not modify anything above this comment.
-----------------------------------------------------------------------


ALTER TABLE users
    ADD COLUMN banned_until TIMESTAMP WITHOUT TIME ZONE;


-----------------------------------------------------------------------
-- Do not modify anything below this comment.

commit;
