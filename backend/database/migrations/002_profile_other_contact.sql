USE viniyog_db;

SET @viniyog_other_contact_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'student_profiles'
      AND column_name = 'other_contact'
);
SET @viniyog_other_contact_sql = IF(
    @viniyog_other_contact_exists = 0,
    'ALTER TABLE student_profiles ADD COLUMN other_contact VARCHAR(255) NULL',
    'SELECT 1'
);
PREPARE viniyog_other_contact_statement FROM @viniyog_other_contact_sql;
EXECUTE viniyog_other_contact_statement;
DEALLOCATE PREPARE viniyog_other_contact_statement;
