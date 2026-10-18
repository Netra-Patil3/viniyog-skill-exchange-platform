
USE viniyog_db;

CREATE TABLE IF NOT EXISTS student_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL UNIQUE,
    bio TEXT,
    linkedin_url VARCHAR(255),
    github_url VARCHAR(255),
    mobile_number VARCHAR(20),
    whatsapp_number VARCHAR(20),
    email VARCHAR(255),
    other_contact VARCHAR(255),
    CONSTRAINT fk_student_profiles_student
        FOREIGN KEY (student_id)
        REFERENCES students(id)
) ENGINE=InnoDB;
