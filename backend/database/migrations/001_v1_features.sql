USE viniyog_db;

CREATE TABLE IF NOT EXISTS student_auth (
    student_id INT NOT NULL PRIMARY KEY,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_student_auth_student
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS student_sessions (
    token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    student_id INT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_student_sessions_student
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    INDEX idx_student_sessions_expiry (expires_at)
) ENGINE=InnoDB;

SET @viniyog_email_index_exists = (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'student_profiles'
      AND index_name = 'uq_student_profiles_email'
);
SET @viniyog_duplicate_email_groups = (
    SELECT COUNT(*)
    FROM (
        SELECT email
        FROM student_profiles
        WHERE email IS NOT NULL
        GROUP BY email
        HAVING COUNT(*) > 1
    ) AS duplicate_emails
);
SET @viniyog_email_index_sql = IF(
    @viniyog_email_index_exists = 0 AND @viniyog_duplicate_email_groups = 0,
    'CREATE UNIQUE INDEX uq_student_profiles_email ON student_profiles (email)',
    'SELECT 1'
);
PREPARE viniyog_email_index_statement FROM @viniyog_email_index_sql;
EXECUTE viniyog_email_index_statement;
DEALLOCATE PREPARE viniyog_email_index_statement;
SELECT IF(
    @viniyog_duplicate_email_groups > 0,
    CONCAT('Skipped uq_student_profiles_email: ', @viniyog_duplicate_email_groups,
           ' duplicate email group(s) must be resolved without discarding account data.'),
    'Email uniqueness index is present or was created.'
) AS email_index_status;

CREATE TABLE IF NOT EXISTS skill_exchange_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    requester_student_id INT NOT NULL,
    recipient_student_id INT NOT NULL,
    offered_skill_id INT NOT NULL,
    requested_skill_id INT NOT NULL,
    message VARCHAR(500),
    status ENUM('pending', 'accepted', 'declined') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_exchange_different_students
        CHECK (requester_student_id <> recipient_student_id),
    CONSTRAINT fk_exchange_requester
        FOREIGN KEY (requester_student_id) REFERENCES students(id) ON DELETE CASCADE,
    CONSTRAINT fk_exchange_recipient
        FOREIGN KEY (recipient_student_id) REFERENCES students(id) ON DELETE CASCADE,
    CONSTRAINT fk_exchange_offered_skill
        FOREIGN KEY (offered_skill_id) REFERENCES skills(id),
    CONSTRAINT fk_exchange_requested_skill
        FOREIGN KEY (requested_skill_id) REFERENCES skills(id),
    INDEX idx_exchange_recipient_status (recipient_student_id, status, created_at),
    INDEX idx_exchange_requester (requester_student_id, created_at)
) ENGINE=InnoDB;
