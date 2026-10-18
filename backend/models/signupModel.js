const db = require("../config/db");

function tagSignupError(error, operation) {
  if (!error) {
    return error;
  }

  error.signupOperation = operation;
  if (error.code === "ER_DUP_ENTRY" && typeof error.sqlMessage === "string") {
    const keyMatch = error.sqlMessage.match(/for key ['"`]([^'"`]+)['"`]/i);
    if (keyMatch) {
      error.signupConstraint = keyMatch[1].split(".").pop();
    }
  }
  return error;
}

const registerStudent = (
  student,
  profile,
  passwordHash,
  teachSkills,
  learnSkills,
  callback,
) => {
  db.getConnection((connectionError, connection) => {
    if (connectionError) {
      return callback(tagSignupError(connectionError, "acquire connection"));
    }

    connection.beginTransaction((transactionError) => {
      if (transactionError) {
        connection.release();
        return callback(tagSignupError(transactionError, "begin transaction"));
      }

      const studentSql = `
                INSERT INTO students
                (PRN, student_name, department, academic_year, college_name, profile_photo)
                VALUES (?, ?, ?, ?, ?, ?)
            `;

      connection.query(
        studentSql,
        [
          student.prn,
          student.studentName,
          student.department,
          student.academicYear,
          student.collegeName,
          student.profilePhoto,
        ],
        (studentError, studentResult) => {
          if (studentError) {
            return rollback(tagSignupError(studentError, "insert student"));
          }

          const studentId = studentResult.insertId;

          const profileSql = `
                        INSERT INTO student_profiles
                        (student_id, bio, linkedin_url, github_url,
                         mobile_number, whatsapp_number, email, other_contact)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `;

          connection.query(
            profileSql,
            [
              studentId,
              profile.bio,
              profile.linkedin,
              profile.github,
              profile.mobileNumber,
              profile.whatsappNumber,
              profile.email,
              profile.otherContact,
            ],
            (profileError) => {
              if (profileError) {
                return rollback(tagSignupError(profileError, "insert profile"));
              }

              const authSql = `
                                INSERT INTO student_auth (student_id, password_hash)
                                VALUES (?, ?)
                            `;

              connection.query(
                authSql,
                [studentId, passwordHash],
                (authError) => {
                  if (authError) {
                    return rollback(tagSignupError(authError, "insert authentication"));
                  }

                  insertSkills(
                    "student_teach_skills",
                    teachSkills,
                    studentId,
                    (teachError) => {
                      if (teachError) {
                        return rollback(tagSignupError(teachError, "insert teaching skill links"));
                      }

                      insertSkills(
                        "student_learn_skills",
                        learnSkills,
                        studentId,
                        (learnError) => {
                          if (learnError) {
                            return rollback(tagSignupError(learnError, "insert learning skill links"));
                          }

                          connection.commit((commitError) => {
                            if (commitError) {
                              return rollback(tagSignupError(commitError, "commit transaction"));
                            }

                            connection.release();
                            callback(null, studentId);
                          });
                        },
                      );
                    },
                  );
                },
              );
            },
          );
        },
      );

      function insertSkills(tableName, skillNames, studentId, done) {
        if (!skillNames.length) {
          return done(null);
        }

        // Normalize skill names and remove duplicates.
        const uniqueSkills = [
          ...new Map(
            skillNames
              .map((name) => name.trim())
              .filter(Boolean)
              .map((name) => [name.toLowerCase(), name]),
          ).values(),
        ];

        if (!uniqueSkills.length) {
          return done(null);
        }

        // Find existing skills first.
        const placeholders = uniqueSkills.map(() => "?").join(", ");

        const findSql = `
        SELECT id, skill_name
        FROM skills
        WHERE LOWER(skill_name) IN (${placeholders})
    `;

        connection.query(
          findSql,
          uniqueSkills.map((name) => name.toLowerCase()),
          (findError, results) => {
            if (findError) {
              return done(tagSignupError(findError, "find existing skills"));
            }

            const skillMap = new Map(
              results.map((row) => [row.skill_name.toLowerCase(), row.id]),
            );

            const missingSkills = uniqueSkills.filter(
              (name) => !skillMap.has(name.toLowerCase()),
            );

            // Add any new skills to the master skills table.
            function insertNewSkills() {
              if (!missingSkills.length) {
                return linkSkills();
              }

              const values = missingSkills.map((name) => [name]);

              const insertNewSql = `
                    INSERT IGNORE INTO skills (skill_name)
                    VALUES ?
                `;

              connection.query(insertNewSql, [values], (insertError) => {
                if (insertError) {
                  return done(tagSignupError(insertError, "insert shared skills"));
                }

                // Fetch the IDs of the newly added skills.
                connection.query(
                  findSql,
                  uniqueSkills.map((name) => name.toLowerCase()),
                  (refreshError, updatedResults) => {
                    if (refreshError) {
                      return done(tagSignupError(refreshError, "reload skill definitions"));
                    }

                    skillMap.clear();

                    updatedResults.forEach((row) => {
                      skillMap.set(row.skill_name.toLowerCase(), row.id);
                    });

                    linkSkills();
                  },
                );
              });
            }

            // Link each skill to the student.
            function linkSkills() {
              const values = uniqueSkills.map((name) => {
                const skillId = skillMap.get(name.toLowerCase());
                return [studentId, skillId];
              });

              if (values.some((row) => !row[1])) {
                return done(
                  new Error("Unable to find or create all requested skills."),
                );
              }

              const linkSql = `
                    INSERT INTO ${tableName} (student_id, skill_id)
                    VALUES ?
                `;

              connection.query(linkSql, [values], (linkError, result) => {
                done(tagSignupError(linkError, `insert ${tableName} links`), result);
              });
            }

            insertNewSkills();
          },
        );
      }

      function rollback(error) {
        connection.rollback((rollbackError) => {
          if (rollbackError) {
            error.signupRollbackFailed = true;
          }
          connection.release();
          callback(error);
        });
      }
    });
  });
};

module.exports = { registerStudent };
