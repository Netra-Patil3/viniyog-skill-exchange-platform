
USE viniyog_db;

CREATE TABLE IF NOT EXISTS student_learn_skills (
    student_id INT NOT NULL,
    skill_id INT NOT NULL,

    PRIMARY KEY (student_id, skill_id),

    CONSTRAINT fk_learn_student
        FOREIGN KEY (student_id)
        REFERENCES students(id),

    CONSTRAINT fk_learn_skill
        FOREIGN KEY (skill_id)
        REFERENCES skills(id)
) ENGINE=InnoDB;
