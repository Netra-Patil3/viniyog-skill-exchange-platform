CREATE DATABASE viniyog_db;
USE viniyog_db;
CREATE TABLE students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    PRN VARCHAR(15) NOT NULL,
    student_name VARCHAR(100) NOT NULL,
    department VARCHAR(100) NOT NULL,
    academic_year VARCHAR(20) NOT NULL,
    college_name VARCHAR(150) NOT NULL,
    profile_photo VARCHAR(255)
);