document.addEventListener("DOMContentLoaded", async function () {
    const status = document.getElementById("profileStatus");
    const profile = document.getElementById("profileContent");
    const params = new URLSearchParams(window.location.search);
    const profileId = Number(params.get("id"));
    const ownerActions = document.getElementById("profileOwnerActions");
    const profileUpdateStatus = document.getElementById("profileUpdateStatus");
    const editSection = document.getElementById("editProfileSection");
    const editForm = document.getElementById("editProfileForm");
    const editStatus = document.getElementById("editProfileStatus");
    const noteForm = document.getElementById("profileNoteForm");
    const noteStatus = document.getElementById("profileNotesStatus");
    const noteUploadStatus = document.getElementById("profileNoteUploadStatus");
    const noteList = document.getElementById("profileNotesList");
    const photoInput = document.getElementById("editProfilePhoto");
    const photoPreview = document.getElementById("editProfilePhotoPreview");
    const photoRemovalInput = document.getElementById("removeProfilePhoto");
    const removePhotoButton = document.getElementById("removeProfilePhotoButton");
    const photoEditStatus = document.getElementById("profilePhotoEditStatus");
    const skillState = { teachSkills: [], learnSkills: [] };
    let previewUrl = null;
    let photoRemovalPending = false;
    let student;

    function skillList(value) {
        return String(value || "")
            .split(",")
            .map((skill) => skill.trim())
            .filter(Boolean);
    }

    function fillList(element, items, emptyMessage) {
        element.replaceChildren();
        (items.length ? items : [emptyMessage]).forEach((value) => {
            const item = document.createElement("li");
            item.textContent = value;
            element.appendChild(item);
        });
    }

    function setSkillState(field, skills) {
        const isTeach = field === "teachSkills";
        const list = document.getElementById(isTeach ? "editTeachSkillsList" : "editLearnSkillsList");
        const hidden = document.getElementById(isTeach ? "editTeachSkills" : "editLearnSkills");
        skillState[field] = skills.slice();
        list.replaceChildren();

        skillState[field].forEach((skill, index) => {
            const item = document.createElement("li");
            const input = document.createElement("input");
            input.type = "text";
            input.maxLength = 100;
            input.value = skill;
            input.setAttribute("aria-label", `Edit ${isTeach ? "teaching" : "learning"} skill ${index + 1}`);
            input.addEventListener("input", () => {
                skillState[field][index] = input.value;
                hidden.value = skillState[field].join(",");
            });

            const remove = document.createElement("button");
            remove.type = "button";
            remove.textContent = "Remove";
            remove.setAttribute("aria-label", `Remove skill ${skill || index + 1}`);
            remove.addEventListener("click", () => {
                skillState[field] = [...list.querySelectorAll("input")].map((entry) => entry.value);
                skillState[field].splice(index, 1);
                setSkillState(field, skillState[field]);
            });

            item.append(input, remove);
            list.appendChild(item);
        });
        hidden.value = skillState[field].join(",");
    }

    function addSkill(field) {
        const isTeach = field === "teachSkills";
        const input = document.getElementById(isTeach ? "newTeachSkill" : "newLearnSkill");
        const list = document.getElementById(isTeach ? "editTeachSkillsList" : "editLearnSkillsList");
        const skill = input.value.trim();
        if (!skill || skill.length > 100 || skill.includes(",") || /[\u0000-\u001f\u007f]/.test(skill)) {
            editStatus.textContent = "Enter a skill of 1 to 100 characters without commas.";
            return;
        }

        const current = [...list.querySelectorAll("input")].map((entry) => entry.value);
        if (current.length >= 20) {
            editStatus.textContent = "You can add up to 20 skills in each category.";
            return;
        }
        if (current.some((entry) => entry.trim().toLowerCase() === skill.toLowerCase())) {
            editStatus.textContent = "That skill is already in this list.";
            return;
        }

        editStatus.textContent = "";
        setSkillState(field, [...current, skill]);
        input.value = "";
        input.focus();
    }

    function setEditorValues() {
        document.getElementById("editBio").value = student.bio || "";
        document.getElementById("editMobileNumber").value = student.mobile_number || "";
        document.getElementById("editEmail").value = student.email || "";
        setSkillState("teachSkills", skillList(student.skills_to_teach));
        setSkillState("learnSkills", skillList(student.skills_to_learn));
        photoInput.value = "";
        photoRemovalPending = false;
        photoRemovalInput.value = "false";
        photoEditStatus.textContent = "";
        removePhotoButton.textContent = "Remove photo";
        removePhotoButton.disabled = !student.profile_photo;
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            previewUrl = null;
        }
        photoPreview.src = student.profile_photo || "assets/profile photos/Default.jpg";
        photoPreview.hidden = false;
    }

    function addContactLink(container, label, value, type = "url") {
        if (!value || !String(value).trim()) {
            return;
        }

        const contact = String(value).trim();
        const link = document.createElement("a");

        if (type === "phone") {
            const phone = contact.replace(/[^\d+]/g, "");
            if (!phone) return;
            link.href = `tel:${phone}`;
            link.innerHTML = '<i class="fa-solid fa-phone" aria-hidden="true"></i> ';
            link.append(document.createTextNode(contact));
        } else if (type === "email") {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) return;
            link.href = `mailto:${contact}`;
            link.innerHTML = '<i class="fa-regular fa-envelope" aria-hidden="true"></i> ';
            link.append(document.createTextNode(contact));
        } else if (type === "url") {
            try {
                const url = new URL(/^https?:\/\//i.test(contact) ? contact : `https://${contact}`);
                if (!["http:", "https:"].includes(url.protocol)) return;
                link.href = url.href;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                if (label === "LinkedIn") {
                    link.innerHTML = '<i class="fa-brands fa-linkedin" aria-hidden="true"></i> ';
                } else if (label === "GitHub") {
                    link.innerHTML = '<i class="fa-brands fa-github" aria-hidden="true"></i> ';
                }
                link.append(document.createTextNode(label));
            } catch {
                return;
            }
        } else {
            const item = document.createElement("span");
            item.className = "contact-text";
            item.textContent = `${label}: ${contact}`;
            container.appendChild(item);
            return;
        }
        container.appendChild(link);
    }

    function renderProfile() {
        document.title = `${student.student_name || "Student"} | Viniyog`;
        document.getElementById("profileName").textContent = student.student_name || "Student";
        document.getElementById("profileDepartment").textContent = student.department || "Department not specified";
        document.getElementById("profileAcademic").textContent = student.academic_year || "Academic year not specified";
        document.getElementById("profileCollege").textContent = student.college_name || "College not specified";
        document.getElementById("profileBio").textContent = student.bio || "No introduction added yet.";

        const photo = document.getElementById("profilePhoto");
        photo.alt = `${student.student_name || "Student"}'s profile photo`;
        photo.onerror = function () {
            this.onerror = null;
            this.src = "assets/profile photos/Default.jpg";
        };
        photo.src = student.profile_photo || "assets/profile photos/Default.jpg";

        const links = document.getElementById("profileLinks");
        links.replaceChildren();
        addContactLink(links, "LinkedIn", student.linkedin_url);
        addContactLink(links, "GitHub", student.github_url);
        addContactLink(links, "Mobile", student.phone || student.mobile_number, "phone");
        addContactLink(links, "Email", student.email, "email");
        if (student.other_contact) {
            addContactLink(links, "Other contact", student.other_contact, "text");
        }
        const emptyContact = document.getElementById("profileContactEmpty");
        emptyContact.hidden = links.children.length > 0;

        fillList(
            document.getElementById("teachSkills"),
            skillList(student.skills_to_teach),
            "No teaching skills listed yet."
        );
        fillList(
            document.getElementById("learnSkills"),
            skillList(student.skills_to_learn),
            "No learning goals listed yet."
        );
    }

    async function loadProfileNotes() {
        noteStatus.textContent = "Loading notes...";
        noteList.replaceChildren();
        try {
            const notes = await window.ViniyogAPI.request(`/students/${profileId}/notes`);
            if (!notes.length) {
                noteStatus.textContent = "This student has not uploaded any notes yet.";
                return;
            }

            noteStatus.textContent = "";
            notes.forEach((note) => {
                const item = document.createElement("li");
                item.className = "profile-note-item";
                const title = document.createElement("strong");
                title.textContent = note.title;
                const metadata = document.createElement("span");
                metadata.className = "profile-note-meta";
                const date = new Date(note.uploaded_at);
                const displayDate = Number.isNaN(date.getTime())
                    ? "Date unavailable"
                    : date.toLocaleDateString();
                metadata.textContent = `${note.file_name} · Uploaded ${displayDate}`;

                const downloadButton = document.createElement("button");
                downloadButton.type = "button";
                downloadButton.textContent = "Download";
                downloadButton.addEventListener("click", async function () {
                    downloadButton.disabled = true;
                    try {
                        const blob = await window.ViniyogAPI.download(
                            `/notes/${encodeURIComponent(note.id)}/download`
                        );
                        const objectUrl = URL.createObjectURL(blob);
                        const link = document.createElement("a");
                        link.href = objectUrl;
                        link.download = note.file_name;
                        document.body.appendChild(link);
                        link.click();
                        link.remove();
                        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
                    } catch (error) {
                        noteStatus.textContent = error.message;
                    } finally {
                        downloadButton.disabled = false;
                    }
                });
                item.append(title, metadata, downloadButton);
                noteList.appendChild(item);
            });
        } catch (error) {
            noteStatus.textContent = error.status === 401
                ? "Log in to view and download this student's notes."
                : error.message;
        }
    }

    async function refreshProfile() {
        student = await window.ViniyogAPI.request(`/students/${profileId}`);
        renderProfile();
    }

    function validateNoteFile(file) {
        if (!file) return "Select a PDF or plain-text note.";
        if (file.size > 10 * 1024 * 1024) return "The selected file exceeds the 10 MB limit.";
        const extension = file.name.split(".").pop().toLowerCase();
        if (!(
            (extension === "pdf" && file.type === "application/pdf") ||
            (extension === "txt" && file.type === "text/plain")
        )) {
            return "Only PDF and plain-text files are supported.";
        }
        return "";
    }

    function validateSkillInput(value) {
        const skills = value.split(",").map((skill) => skill.trim()).filter(Boolean);
        const uniqueSkills = new Set(skills.map((skill) => skill.toLowerCase()));
        return uniqueSkills.size === skills.length && uniqueSkills.size <= 20 &&
            skills.every((skill) => skill.length <= 100 && !skill.includes(","));
    }

    if (!Number.isSafeInteger(profileId) || profileId <= 0) {
        status.textContent = "Invalid profile link. Please browse students and try again.";
        return;
    }

    const authentication = await window.ViniyogAuthentication;
    const currentStudent = authentication.student;
    if (!currentStudent) {
        return;
    }

    try {
        await refreshProfile();
        const isOwner = currentStudent && Number(currentStudent.id) === profileId;
        if (isOwner) {
            ownerActions.hidden = false;
            noteForm.hidden = false;
            setEditorValues();
        }
        profile.hidden = false;
        status.hidden = true;
        await loadProfileNotes();
    } catch (error) {
        status.textContent = error.message || "Unable to load this student profile.";
    }

    const deleteAccountButton = document.getElementById("deleteAccountButton");
    const deleteAccountConfirmModal = document.getElementById("deleteAccountConfirmModal");
    const deleteAccountPasswordModal = document.getElementById("deleteAccountPasswordModal");
    const deleteAccountForm = document.getElementById("deleteAccountForm");
    const deleteAccountStatus = document.getElementById("deleteAccountStatus");
    const deleteAccountPassword = document.getElementById("deleteAccountPassword");

    function closeDeleteAccountModals() {
        deleteAccountConfirmModal.hidden = true;
        deleteAccountPasswordModal.hidden = true;
        deleteAccountForm.reset();
        deleteAccountStatus.textContent = "";
    }

    deleteAccountButton.addEventListener("click", function () {
        deleteAccountConfirmModal.hidden = false;
        deleteAccountStatus.textContent = "";
    });
    document.getElementById("cancelDeleteConfirm").addEventListener("click", closeDeleteAccountModals);
    document.getElementById("confirmDeleteAccount").addEventListener("click", function () {
        deleteAccountConfirmModal.hidden = true;
        deleteAccountPasswordModal.hidden = false;
        deleteAccountPassword.focus();
    });
    document.getElementById("cancelDeletePassword").addEventListener("click", closeDeleteAccountModals);
    deleteAccountConfirmModal.addEventListener("click", function (event) {
        if (event.target === deleteAccountConfirmModal) {
            closeDeleteAccountModals();
        }
    });
    deleteAccountPasswordModal.addEventListener("click", function (event) {
        if (event.target === deleteAccountPasswordModal) {
            closeDeleteAccountModals();
        }
    });
    deleteAccountForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const password = deleteAccountPassword.value;
        const submitButton = document.getElementById("submitDeleteAccount");
        if (!password) {
            deleteAccountStatus.textContent = "Enter your current password to continue.";
            return;
        }

        submitButton.disabled = true;
        deleteAccountStatus.textContent = "Verifying your password...";
        try {
            const result = await window.ViniyogAPI.request("/students/me/delete-account", {
                method: "POST",
                body: JSON.stringify({ password })
            });
            deleteAccountStatus.textContent = result.message;
            closeDeleteAccountModals();
            if (window.ViniyogAuthState && typeof window.ViniyogAuthState.setCurrentStudent === "function") {
                window.ViniyogAuthState.setCurrentStudent(null);
            }
            window.location.replace("login.html?deleted=1");
        } catch (error) {
            deleteAccountStatus.textContent = error.message;
        } finally {
            submitButton.disabled = false;
        }
    });

    document.getElementById("editProfileButton").addEventListener("click", function () {
        editSection.hidden = !editSection.hidden;
        if (!editSection.hidden) {
            setEditorValues();
            editStatus.textContent = "";
            profileUpdateStatus.hidden = true;
            profileUpdateStatus.textContent = "";
            editSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    });

    document.getElementById("cancelProfileEdit").addEventListener("click", function () {
        editForm.reset();
        setEditorValues();
        editStatus.textContent = "";
        editSection.hidden = true;
    });

    document.getElementById("addTeachSkill").addEventListener("click", () => addSkill("teachSkills"));
    document.getElementById("addLearnSkill").addEventListener("click", () => addSkill("learnSkills"));
    document.getElementById("newTeachSkill").addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            addSkill("teachSkills");
        }
    });
    document.getElementById("newLearnSkill").addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            addSkill("learnSkills");
        }
    });

    removePhotoButton.addEventListener("click", () => {
        if (photoRemovalPending) {
            photoRemovalPending = false;
            photoRemovalInput.value = "false";
            photoPreview.src = student.profile_photo || "assets/profile photos/Default.jpg";
            photoEditStatus.textContent = "Photo removal canceled.";
            removePhotoButton.textContent = "Remove photo";
            removePhotoButton.disabled = !student.profile_photo;
            return;
        }

        if (!student.profile_photo) {
            photoInput.value = "";
            photoPreview.src = "assets/profile photos/Default.jpg";
            photoPreview.hidden = false;
            photoEditStatus.textContent = "Selected photo removed from the preview.";
            removePhotoButton.disabled = true;
            return;
        }

        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            previewUrl = null;
        }
        photoInput.value = "";
        photoRemovalPending = true;
        photoRemovalInput.value = "true";
        photoPreview.src = "assets/profile photos/Default.jpg";
        photoEditStatus.textContent = "The current photo will be removed when you save.";
        removePhotoButton.textContent = "Undo photo removal";
        removePhotoButton.disabled = false;
    });

    photoInput.addEventListener("change", () => {
        const file = photoInput.files[0];
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            previewUrl = null;
        }
        if (!file) {
            if (!photoRemovalPending) {
                photoPreview.src = student.profile_photo || "assets/profile photos/Default.jpg";
            }
            removePhotoButton.disabled = !student.profile_photo && !photoRemovalPending;
            return;
        }
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
            file.size > 5 * 1024 * 1024) {
            editStatus.textContent = "Choose a JPG, PNG, or WebP image no larger than 5 MB.";
            photoInput.value = "";
            if (!photoRemovalPending) {
                photoPreview.src = student.profile_photo || "assets/profile photos/Default.jpg";
            }
            return;
        }
        editStatus.textContent = "";
        photoEditStatus.textContent = "Preview the selected photo before saving.";
        photoRemovalPending = false;
        photoRemovalInput.value = "false";
        removePhotoButton.textContent = "Remove photo";
        removePhotoButton.disabled = false;
        previewUrl = URL.createObjectURL(file);
        photoPreview.src = previewUrl;
    });

    editForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const button = document.getElementById("saveProfileButton");
        const photo = editForm.elements.profilePhoto.files[0];
        if (!editForm.reportValidity()) return;
        if (!validateSkillInput(editForm.elements.teachSkills.value) ||
            !validateSkillInput(editForm.elements.learnSkills.value)) {
            editStatus.textContent = "Remove duplicate skills and keep each list at 20 skills or fewer; each skill must be 100 characters or fewer.";
            return;
        }
        if (photo && (!["image/jpeg", "image/png", "image/webp"].includes(photo.type) ||
            photo.size > 5 * 1024 * 1024)) {
            editStatus.textContent = "Choose a JPG, PNG, or WebP image smaller than 5 MB.";
            return;
        }

        button.disabled = true;
        editStatus.textContent = "Saving profile...";
        try {
            const result = await window.ViniyogAPI.request("/students/me/profile", {
                method: "PUT",
                body: new FormData(editForm)
            });
            await refreshProfile();
            if (window.ViniyogAuthState && typeof window.ViniyogAuthState.refreshCurrentStudent === "function") {
                await window.ViniyogAuthState.refreshCurrentStudent();
            }
            profileUpdateStatus.textContent = result.message;
            profileUpdateStatus.hidden = false;
            editSection.hidden = true;
            editForm.reset();
            setEditorValues();
        } catch (error) {
            editStatus.textContent = error.message;
        } finally {
            button.disabled = false;
        }
    });

    noteForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const button = document.getElementById("profileNoteSubmit");
        const validationError = validateNoteFile(noteForm.elements.noteFile.files[0]);
        if (!noteForm.reportValidity()) return;
        if (validationError) {
            noteUploadStatus.textContent = validationError;
            return;
        }

        button.disabled = true;
        noteUploadStatus.textContent = "Uploading note...";
        try {
            const result = await window.ViniyogAPI.request("/notes", {
                method: "POST",
                body: new FormData(noteForm)
            });
            noteUploadStatus.textContent = result.message;
            noteForm.reset();
            await loadProfileNotes();
        } catch (error) {
            noteUploadStatus.textContent = error.message;
        } finally {
            button.disabled = false;
        }
    });
});
