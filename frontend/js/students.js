
const studentCardsContainer = document.getElementById("studentCardsContainer");
const searchInput = document.getElementById("studentSearch");
const departmentFilter = document.getElementById("departmentFilter");
const yearFilter = document.getElementById("yearFilter");
const collegeFilter = document.getElementById("collegeFilter");
const teachSkillFilter = document.getElementById("teachSkillFilter");
const learnSkillFilter = document.getElementById("learnSkillFilter");
const clearFiltersButton = document.getElementById("clearFilters");
const studentCount = document.getElementById("studentCount");

const DEFAULT_PHOTO = "assets/profile photos/Default.jpg";
let allStudents = [];
let filterOptions = {
    departments: [],
    academic_years: [],
    colleges: [],
    skills: []
};

let activeSuggestionIndex = -1;
let currentSuggestions = [];

// Safely normalize text for case-insensitive comparisons.
function normalize(value) {
    return String(value || "").trim().toLowerCase();
}

// Escape text before inserting database values into HTML.
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function splitSkills(skills) {
    if (Array.isArray(skills)) {
        return skills.map(skill => String(skill).trim()).filter(Boolean);
    }

    if (!skills) {
        return [];
    }

    return String(skills)
        .split(",")
        .map(skill => skill.trim())
        .filter(Boolean);
}

function createSkillTags(skills) {
    const skillList = splitSkills(skills);

    if (skillList.length === 0) {
        return '<span class="no-skills">Not added yet</span>';
    }

    return skillList
        .map(skill => `<span>${escapeHTML(skill)}</span>`)
        .join("");
}

function getPhotoPath(profilePhoto) {
    if (!profilePhoto || !String(profilePhoto).trim()) {
        return DEFAULT_PHOTO;
    }

    const photo = String(profilePhoto).trim();

    if (photo.startsWith("assets/")) {
        return photo;
    }

    return `assets/profile photos/${photo}`;
}

// Convert comma-separated skills into arrays for searching.
function getStudentSkills(student, type) {
    return splitSkills(
        type === "teach"
            ? student.skills_to_teach
            : student.skills_to_learn
    );
}

// Add options returned by the backend without hardcoding database values.
function populateDropdown(selectElement, values, defaultLabel) {
    selectElement.replaceChildren();

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = defaultLabel;
    selectElement.appendChild(defaultOption);

    [...new Set((values || []).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b))
        .forEach(value => {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = value;
            selectElement.appendChild(option);
        });
}

function populateFilters() {
    populateDropdown(
        departmentFilter,
        filterOptions.departments,
        "All Departments"
    );

    populateDropdown(
        yearFilter,
        filterOptions.academic_years,
        "All Academic Years"
    );

    populateDropdown(
        collegeFilter,
        filterOptions.colleges,
        "All Colleges"
    );

    populateDropdown(
        teachSkillFilter,
        filterOptions.skills,
        "All Teaching Skills"
    );

    populateDropdown(
        learnSkillFilter,
        filterOptions.skills,
        "All Learning Skills"
    );
}

// Create one student card while preserving the existing layout.
function createStudentCard(student) {
    const card = document.createElement("div");
    card.className = "student-card";

    card.innerHTML = `
        <div class="student-info">
            <div class="student-photo">
                <img class="student-profile-image" alt="">
                <span class="online-status"></span>
            </div>

            <div class="student-details">
                <h2>${escapeHTML(student.student_name)}</h2>
                <p class="department">${escapeHTML(student.department)}</p>
                <p class="year">🎓 ${escapeHTML(student.academic_year)}</p>
                <p class="college">📍 ${escapeHTML(student.college_name)}</p>
            </div>
        </div>

        <div class="student-skills">
            <div class="skill-group">
                <div class="skill-title">
                    <span class="skill-icon">🎓</span>
                    <h3>Can Teach</h3>
                </div>
                <div class="skill-list">
                    ${createSkillTags(student.skills_to_teach)}
                </div>
            </div>

            <div class="skill-group">
                <div class="skill-title">
                    <span class="skill-icon">🎯</span>
                    <h3>Want to Learn</h3>
                </div>
                <div class="skill-list">
                    ${createSkillTags(student.skills_to_learn)}
                </div>
            </div>
        </div>

        <div class="student-action">
            <a href="profile.html?id=${encodeURIComponent(student.id)}"
               class="profile-button">
                <span>View Profile</span>
                <span class="arrow">→</span>
            </a>
        </div>
    `;

    const photo = card.querySelector(".student-profile-image");

    photo.alt = student.student_name
        ? `${student.student_name}'s profile photo`
        : "Student profile photo";

    photo.onerror = function () {
        this.onerror = null;
        this.src = DEFAULT_PHOTO;
    };

    photo.src = getPhotoPath(student.profile_photo);

    return card;
}

// Apply the search text and all selected filters together.
function getFilteredStudents() {
    const query = normalize(searchInput.value);
    const department = normalize(departmentFilter.value);
    const year = normalize(yearFilter.value);
    const college = normalize(collegeFilter.value);
    const teachSkill = normalize(teachSkillFilter.value);
    const learnSkill = normalize(learnSkillFilter.value);

    return allStudents.filter(student => {
        const searchableText = [
            student.student_name,
            student.department,
            student.academic_year,
            student.college_name,
            ...getStudentSkills(student, "teach"),
            ...getStudentSkills(student, "learn")
        ].map(normalize).join(" ");

        const matchesSearch =
            !query || searchableText.includes(query);

        const matchesDepartment =
            !department || normalize(student.department) === department;

        const matchesYear =
            !year || normalize(student.academic_year) === year;

        const matchesCollege =
            !college || normalize(student.college_name) === college;

        const matchesTeachSkill =
            !teachSkill ||
            getStudentSkills(student, "teach")
                .some(skill => normalize(skill) === teachSkill);

        const matchesLearnSkill =
            !learnSkill ||
            getStudentSkills(student, "learn")
                .some(skill => normalize(skill) === learnSkill);

        return matchesSearch &&
            matchesDepartment &&
            matchesYear &&
            matchesCollege &&
            matchesTeachSkill &&
            matchesLearnSkill;
    });
}

function renderStudents() {
    const filteredStudents = getFilteredStudents();
    studentCardsContainer.replaceChildren();

    if (filteredStudents.length === 0) {
        studentCardsContainer.innerHTML =
            "<p class='no-students-message'>No students found. Try changing your search or filters.</p>";
    } else {
        const fragment = document.createDocumentFragment();

        filteredStudents.forEach(student => {
            fragment.appendChild(createStudentCard(student));
        });

        studentCardsContainer.appendChild(fragment);
    }

    studentCount.textContent =
        `Showing ${filteredStudents.length} of ${allStudents.length} students`;
}

// Autocomplete suggestions for student names, skills, departments, and colleges.
function getSuggestions(query) {
    if (!query) {
        return [];
    }

    const suggestions = new Map();

    function addSuggestion(value, category) {
        if (!value || !normalize(value).includes(query)) {
            return;
        }

        const key = `${category}:${normalize(value)}`;

        if (!suggestions.has(key)) {
            suggestions.set(key, { value, category });
        }
    }

    allStudents.forEach(student => {
        addSuggestion(student.student_name, "Student");
        addSuggestion(student.department, "Department");
        addSuggestion(student.college_name, "College");

        getStudentSkills(student, "teach")
            .forEach(skill => addSuggestion(skill, "Teaching skill"));

        getStudentSkills(student, "learn")
            .forEach(skill => addSuggestion(skill, "Learning skill"));
    });

    return [...suggestions.values()].slice(0, 8);
}

function closeSuggestions() {
    const list = document.getElementById("searchSuggestions");

    if (list) {
        list.remove();
    }

    currentSuggestions = [];
    activeSuggestionIndex = -1;
}

function showSuggestions() {
    closeSuggestions();

    const query = normalize(searchInput.value);

    if (!query) {
        return;
    }

    currentSuggestions = getSuggestions(query);

    if (currentSuggestions.length === 0) {
        return;
    }

    const list = document.createElement("div");
    list.id = "searchSuggestions";
    list.className = "search-suggestions";
    list.setAttribute("role", "listbox");

    currentSuggestions.forEach((suggestion, index) => {
        const item = document.createElement("button");

        item.type = "button";
        item.className = "search-suggestion";
        item.setAttribute("role", "option");
        item.innerHTML = `
            <span class="suggestion-value">${escapeHTML(suggestion.value)}</span>
            <span class="suggestion-category">${escapeHTML(suggestion.category)}</span>
        `;

        item.addEventListener("click", () => {
            searchInput.value = suggestion.value;
            closeSuggestions();
            renderStudents();
        });

        list.appendChild(item);
    });

    const searchBar = searchInput.closest(".search-bar");

    if (searchBar) {
        searchBar.appendChild(list);
    }
}

searchInput.addEventListener("input", () => {
    renderStudents();
    showSuggestions();
});

searchInput.addEventListener("keydown", event => {
    const list = document.getElementById("searchSuggestions");

    if (!list || currentSuggestions.length === 0) {
        return;
    }

    if (event.key === "ArrowDown") {
        event.preventDefault();
        activeSuggestionIndex =
            (activeSuggestionIndex + 1) % currentSuggestions.length;
    } else if (event.key === "ArrowUp") {
        event.preventDefault();
        activeSuggestionIndex =
            (activeSuggestionIndex - 1 + currentSuggestions.length) %
            currentSuggestions.length;
    } else if (event.key === "Escape") {
        closeSuggestions();
        return;
    } else if (event.key === "Enter" && activeSuggestionIndex >= 0) {
        event.preventDefault();

        const suggestion = currentSuggestions[activeSuggestionIndex];
        searchInput.value = suggestion.value;

        closeSuggestions();
        renderStudents();
        return;
    } else {
        return;
    }

    const items = list.querySelectorAll(".search-suggestion");

    items.forEach((item, index) => {
        item.classList.toggle("active", index === activeSuggestionIndex);
    });
});

document.addEventListener("click", event => {
    if (!event.target.closest(".search-bar")) {
        closeSuggestions();
    }
});

[
    departmentFilter,
    yearFilter,
    collegeFilter,
    teachSkillFilter,
    learnSkillFilter
].forEach(filter => {
    filter.addEventListener("change", renderStudents);
});

clearFiltersButton.addEventListener("click", () => {
    searchInput.value = "";
    departmentFilter.value = "";
    yearFilter.value = "";
    collegeFilter.value = "";
    teachSkillFilter.value = "";
    learnSkillFilter.value = "";

    closeSuggestions();
    renderStudents();
});

// Load students and filter options from the backend.
async function initializeStudentsPage() {
    const authentication = await window.ViniyogAuthentication;
    if (!authentication.student) {
        return;
    }

    try {
        studentCount.textContent = "Loading students...";

        const [students, options] = await Promise.all([
            window.ViniyogAPI.request("/students"),
            window.ViniyogAPI.request("/students/filter-options")
        ]);
        allStudents = students;
        filterOptions = options;

        populateFilters();
        renderStudents();
    } catch (error) {
        console.error("Error loading students:", error);

        studentCount.textContent = "Unable to load students.";

        studentCardsContainer.textContent =
            "Unable to load students. Please check that the backend is running and try again.";
    }
}

initializeStudentsPage();
