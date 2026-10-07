const studentCardsContainer = document.getElementById("studentCardsContainer");

fetch("http://localhost:5000/api/students")
    .then(response => response.json())
    .then(students => {

        students.forEach(student => {

            const card = document.createElement("div");

            card.className = "student-card";

            card.innerHTML = `
                <div class="student-info">

                    <div class="student-photo">
                        <img src="${student.profile_photo || "assets/profile photos/Default.jpg"}"
                             alt="${student.student_name}">

                        <span class="online-status"></span>
                    </div>

                    <div class="student-details">
                        <h2>${student.student_name}</h2>

                        <p class="department">${student.department}</p>

                        <p class="year">🎓 ${student.academic_year}</p>

                        <p class="college">📍 ${student.college_name}</p>
                    </div>

                </div>

                <div class="student-skills">

                    <div class="skill-group">
                        <div class="skill-title">
                            <span class="skill-icon">🎓</span>
                            <h3>Can Teach</h3>
                        </div>

                        <div class="skill-list">
                            <span>C++</span>
                            <span>HTML/CSS</span>
                            <span>Python</span>
                        </div>
                    </div>

                    <div class="skill-group">
                        <div class="skill-title">
                            <span class="skill-icon">🎯</span>
                            <h3>Want to Learn</h3>
                        </div>

                        <div class="skill-list">
                            <span>Machine Learning</span>
                            <span>React</span>
                        </div>
                    </div>

                </div>

                <div class="student-action">
                    <a href="profile.html" class="profile-button">
                        <span>View Profile</span>
                        <span class="arrow">→</span>
                    </a>
                </div>
            `;

            studentCardsContainer.appendChild(card);
        });

    })
    .catch(error => {
        console.error("Error fetching students:", error);
    });