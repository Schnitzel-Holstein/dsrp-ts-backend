begin;

insert into migrations (id) values (20200221164820);

-- Do not modify anything above this comment.
-----------------------------------------------------------------------


ALTER TABLE forums
    ADD COLUMN image text;

ALTER TABLE threads
    ADD COLUMN is_pinned boolean default false,
    ADD COLUMN global_pin boolean default false;


-----------------------------------------------------------------------
-- Do not modify anything below this comment.

commit;
