const MAX_SKILLS = 20;
const MAX_SKILL_LENGTH = 100;
const DEPARTMENTS = new Set([
    "AI & Data Science",
    "AI & Machine Learning",
    "Computer Science",
    "Information Technology",
    "Electronics & Telecommunication Engineering",
    "Mechanical Engineering",
    "Civil Engineering",
    "Electrical Engineering",
    "Textile Technology",
    "Manmade Textile Technology",
    "Textile Plant Engineering",
    "Textile Chemistry",
    "Fashion Technology",
    "Technical Textiles",
    "Other"
]);
const ACADEMIC_YEARS = new Set(["1st Year", "2nd Year", "3rd Year", "4th Year"]);

function stringValue(value) {
    return typeof value === "string" ? value.trim() : "";
}

function parseSkills(value) {
    if (typeof value !== "string") {
        return null;
    }

    const uniqueSkills = new Map();
    value.split(",")
        .map((skill) => skill.trim())
        .filter(Boolean)
        .forEach((skill) => {
            const key = skill.toLowerCase();
            if (!uniqueSkills.has(key)) {
                uniqueSkills.set(key, skill);
            }
        });
    const skills = [...uniqueSkills.values()];

    if (!skills.length || skills.length > MAX_SKILLS ||
        skills.some((skill) => skill.length > MAX_SKILL_LENGTH)) {
        return null;
    }

    return skills;
}

function parseProfileSkills(value) {
    if (typeof value !== "string") {
        return null;
    }

    const parts = value.split(",").map((skill) => skill.trim()).filter(Boolean);
    const uniqueSkills = new Map();
    for (const skill of parts) {
        if (skill.length > MAX_SKILL_LENGTH || /[\u0000-\u001f\u007f]/.test(skill)) {
            return null;
        }
        const key = skill.toLowerCase();
        if (!uniqueSkills.has(key)) {
            uniqueSkills.set(key, skill);
        }
    }

    const skills = [...uniqueSkills.values()];
    return skills.length <= MAX_SKILLS ? skills : null;
}

function validMobileNumber(value) {
    if (!value) {
        return true;
    }
    if (!/^\+?[0-9][0-9()\s.-]*$/.test(value)) {
        return false;
    }
    const digits = value.replace(/\D/g, "");
    return digits.length >= 7 && digits.length <= 15;
}

function validOptionalUrl(value) {
    if (!value) {
        return true;
    }

    try {
        const url = new URL(value);
        return url.protocol === "https:" || url.protocol === "http:";
    } catch {
        return false;
    }
}

function validateSignup(body) {
    body = body || {};
    const values = {
        fullName: stringValue(body.fullName),
        prn: stringValue(body.prn),
        department: stringValue(body.department),
        academicYear: stringValue(body.academicYear),
        college: stringValue(body.college),
        email: stringValue(body.email).toLowerCase(),
        password: typeof body.password === "string" ? body.password : "",
        confirmPassword: typeof body.confirmPassword === "string" ? body.confirmPassword : "",
        phone: stringValue(body.phone),
        whatsapp: stringValue(body.whatsapp),
        linkedin: stringValue(body.linkedin),
        github: stringValue(body.github),
        portfolio: stringValue(body.portfolio),
        otherContact: stringValue(body.otherContact),
        bio: stringValue(body.bio)
    };

    const requiredFields = [
        values.fullName,
        values.prn,
        values.department,
        values.academicYear,
        values.college,
        values.email,
        values.password,
        values.confirmPassword,
        body.terms
    ];

    if (requiredFields.some((value) => !value)) {
        return { error: "Please fill in all required fields and accept the terms." };
    }
    if (values.fullName.length > 100 || values.prn.length > 15 ||
        !/^[A-Za-z0-9./_-]{2,15}$/.test(values.prn) ||
        values.department.length > 100 || values.academicYear.length > 20 ||
        !DEPARTMENTS.has(values.department) || !ACADEMIC_YEARS.has(values.academicYear) ||
        values.college.length > 150 || values.email.length > 255 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
        return { error: "Please check your name, PRN, academic details, and email." };
    }
    if (values.password.length < 8 ||
        Buffer.byteLength(values.password, "utf8") > 72) {
        return { error: "Password must contain 8 to 72 bytes." };
    }
    if (values.password !== values.confirmPassword) {
        return { error: "Passwords do not match." };
    }
    if (values.bio.length > 300 || values.phone.length > 20 ||
        values.whatsapp.length > 20 || values.linkedin.length > 255 ||
        values.github.length > 255 || values.portfolio.length > 255 ||
        values.otherContact.length > 255) {
        return { error: "One or more profile fields are too long." };
    }
    if (![values.linkedin, values.github, values.portfolio, values.otherContact]
        .every(validOptionalUrl)) {
        return { error: "Contact links must use a valid HTTP or HTTPS URL." };
    }
    if (!/^[+\d()\-\s.]*$/.test(values.phone) ||
        !/^[+\d()\-\s.]*$/.test(values.whatsapp)) {
        return { error: "Phone numbers contain unsupported characters." };
    }
    if (![values.phone, values.whatsapp, values.linkedin, values.github,
        values.portfolio, values.otherContact].some(Boolean)) {
        return { error: "Provide at least one contact method." };
    }

    const teachSkills = parseSkills(body.teachSkills);
    const learnSkills = parseSkills(body.learnSkills);
    if (!teachSkills || !learnSkills) {
        return { error: "Add 1 to 20 skills in each list; each skill must be 100 characters or fewer." };
    }

    return {
        values,
        teachSkills,
        learnSkills
    };
}

function validateProfileUpdate(body) {
    body = body || {};
    const updates = {};
    if (Object.hasOwn(body, "teachSkills")) {
        updates.teachSkills = parseProfileSkills(body.teachSkills);
        if (!updates.teachSkills) {
            return { error: "Add no more than 20 teaching skills; each skill must be 100 characters or fewer." };
        }
    }
    if (Object.hasOwn(body, "learnSkills")) {
        updates.learnSkills = parseProfileSkills(body.learnSkills);
        if (!updates.learnSkills) {
            return { error: "Add no more than 20 learning skills; each skill must be 100 characters or fewer." };
        }
    }

    if (Object.hasOwn(body, "bio")) {
        if (typeof body.bio !== "string" || body.bio.trim().length > 300) {
            return { error: "About Me must be 300 characters or fewer." };
        }
        updates.bio = body.bio.trim();
    }
    if (Object.hasOwn(body, "email")) {
        if (typeof body.email !== "string") {
            return { error: "Enter a valid email address." };
        }
        const email = body.email.trim().toLowerCase();
        if (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return { error: "Enter a valid email address." };
        }
        updates.email = email;
    }
    if (Object.hasOwn(body, "mobileNumber")) {
        if (typeof body.mobileNumber !== "string") {
            return { error: "Enter a valid mobile number." };
        }
        const mobileNumber = body.mobileNumber.trim();
        if (mobileNumber.length > 20 || !validMobileNumber(mobileNumber)) {
            return { error: "Enter a valid mobile number with 7 to 15 digits." };
        }
        updates.mobileNumber = mobileNumber;
    }

    return { updates };
}

module.exports = {
    parseSkills,
    validOptionalUrl,
    validateSignup,
    validateProfileUpdate,
    parseProfileSkills,
    validMobileNumber
};
