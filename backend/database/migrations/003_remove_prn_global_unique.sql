USE viniyog_db;

SELECT PRN, COUNT(*) AS duplicate_count
FROM students
WHERE PRN IS NOT NULL AND PRN <> ''
GROUP BY PRN
HAVING COUNT(*) > 1;

SET @viniyog_prn_index_exists = (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'students'
      AND index_name = 'PRN'
);

SET @viniyog_prn_drop_sql = IF(
    @viniyog_prn_index_exists > 0,
    'ALTER TABLE students DROP INDEX PRN',
    'SELECT 1'
);

PREPARE viniyog_prn_drop_statement FROM @viniyog_prn_drop_sql;
EXECUTE viniyog_prn_drop_statement;
DEALLOCATE PREPARE viniyog_prn_drop_statement;

SELECT IF(
    @viniyog_prn_index_exists > 0,
    'Removed the global PRN uniqueness index from students. Review any duplicate PRN values manually before enforcing a business rule.',
    'No global PRN uniqueness index was present.'
) AS prn_index_status;
