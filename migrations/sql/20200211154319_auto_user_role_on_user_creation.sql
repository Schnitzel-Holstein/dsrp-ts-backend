begin;

insert into migrations (id) values (20200211154319);

-- Do not modify anything above this comment.
-----------------------------------------------------------------------


CREATE OR REPLACE FUNCTION user_auto_role()
RETURNS trigger AS $$
DECLARE
    role_id BIGINT;
BEGIN
    SELECT id INTO role_id FROM user_roles WHERE name='user' LIMIT 1;
    if role_id IS NOT NULL AND NEW.id IS NOT NULL THEN
      INSERT INTO user_roles_inventory(user_id, role_id) VALUES(NEW.id, role_id);
    END IF;
    return NEW;
END;
$$
LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_user_role ON users;
CREATE TRIGGER trg_auto_user_role AFTER INSERT on users
FOR EACH ROW EXECUTE PROCEDURE user_auto_role();


-----------------------------------------------------------------------
-- Do not modify anything below this comment.

commit;
