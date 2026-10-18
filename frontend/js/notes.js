document.addEventListener("DOMContentLoaded", async function () {
    const loginPrompt = document.getElementById("notesAuthPrompt");
    const uploadPanel = document.getElementById("noteUploadPanel");
    const notesStatus = document.getElementById("notesStatus");
    const notesList = document.getElementById("notesList");
    const form = document.getElementById("noteForm");

    async function loadNotes() {
        notesStatus.textContent = "Loading notes...";
        notesList.replaceChildren();

        try {
            const notes = await window.ViniyogAPI.request("/notes");
            if (!notes.length) {
                notesStatus.textContent = "No notes have been shared yet.";
                return;
            }

            notesStatus.textContent = "";
            notes.forEach((note) => {
                const item = document.createElement("li");
                const details = document.createElement("span");
                const date = new Date(note.uploaded_at);
                const displayDate = Number.isNaN(date.getTime())
                    ? "Date unavailable"
                    : date.toLocaleDateString();
                details.textContent = `${note.title} — ${note.file_name} — shared by ${note.uploader_name} on ${displayDate}`;

                const download = document.createElement("button");
                download.type = "button";
                download.textContent = `Download ${note.file_name}`;
                download.className = "note-download";
                download.addEventListener("click", async function () {
                    download.disabled = true;
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
                        notesStatus.textContent = error.message;
                    } finally {
                        download.disabled = false;
                    }
                });

                item.append(details, download);
                notesList.appendChild(item);
            });
        } catch (error) {
            notesStatus.textContent = error.message;
        }
    }

    try {
        await window.ViniyogAPI.request("/auth/me");
        uploadPanel.hidden = false;
        await loadNotes();
    } catch (error) {
        if (error.status === 401) {
            notesStatus.textContent = "";
            loginPrompt.hidden = false;
        } else {
            notesStatus.textContent = error.message;
        }
    }

    form.addEventListener("submit", async function (event) {
        event.preventDefault();
        const feedback = document.getElementById("noteUploadStatus");
        const submitButton = form.querySelector('[type="submit"]');
        const file = form.elements.noteFile.files[0];

        if (!file) {
            feedback.textContent = "Select a PDF or plain-text note.";
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            feedback.textContent = "The selected file exceeds the 10 MB limit.";
            return;
        }

        submitButton.disabled = true;
        feedback.textContent = "Uploading note...";
        try {
            const result = await window.ViniyogAPI.request("/notes", {
                method: "POST",
                body: new FormData(form)
            });
            feedback.textContent = result.message;
            form.reset();
            await loadNotes();
        } catch (error) {
            feedback.textContent = error.message;
        } finally {
            submitButton.disabled = false;
        }
    });
});
