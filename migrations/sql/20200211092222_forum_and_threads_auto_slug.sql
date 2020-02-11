begin;

insert into migrations (id) values (20200211092222);

-- Do not modify anything above this comment.
-----------------------------------------------------------------------


CREATE EXTENSION IF NOT EXISTS "unaccent";

CREATE OR REPLACE FUNCTION slugify("value" TEXT)
RETURNS TEXT AS $$
    -- removes accents (diacritic signs) from a given string --
    WITH "unaccented" AS (
        SELECT unaccent("value") AS "value"
    ),
    -- lowercases the string
    "lowercase" AS (
        SELECT lower("value") AS "value"
        FROM "unaccented"
    ),
    -- replaces anything that's not a letter, number, hyphen('-'), or underscore('_') with a hyphen('-')
    "hyphenated" AS (
        SELECT regexp_replace("value", '[^a-z0-9\\-_]+', '-', 'gi') AS "value"
        FROM "lowercase"
    ),
    -- trims hyphens('-') if they exist on the head or tail of the string
    "trimmed" AS (
        SELECT regexp_replace(regexp_replace("value", '\\-+$', ''), '^\\-', '') AS "value"
        FROM "hyphenated"
    )
    SELECT "value" FROM "trimmed";
$$ LANGUAGE SQL STRICT IMMUTABLE;


CREATE OR REPLACE FUNCTION auto_slug()
RETURNS trigger AS $$
DECLARE
  slug_type text;
BEGIN
    slug_type := TG_ARGV[0];
    NEW.slug := slugify(NEW.name);
    IF slug_type IS NOT NULL AND slug_type != 'thread' THEN
        NEW.slug = 'f' || NEW.id::text || '-' || NEW.slug;
    ELSE
        NEW.slug = 't' || NEW.id::text || '-' || NEW.slug;
    END IF;
  
    RETURN NEW;
END;
$$
LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_slug ON threads;
CREATE TRIGGER trg_auto_slug BEFORE INSERT or UPDATE on threads
FOR EACH ROW EXECUTE PROCEDURE auto_slug('thread');

DROP TRIGGER IF EXISTS trg_auto_slug ON forums;
CREATE TRIGGER trg_auto_slug BEFORE INSERT or UPDATE on forums
FOR EACH ROW EXECUTE PROCEDURE auto_slug('forum');
-----------------------------------------------------------------------
-- Do not modify anything below this comment.

commit;
