document.addEventListener("DOMContentLoaded", function () {
    const form = document.querySelector(".login-form");
    const feedback = document.getElementById("loginFeedback");
    const submitButton = form.querySelector('[type="submit"]');
    const passwordToggle = form.querySelector(".password-toggle");
    const passwordInput = document.getElementById("password");
    const params = new URLSearchParams(window.location.search);

    function showMessage(message, isError) {
        feedback.textContent = message;
        feedback.className = isError ? "login-feedback error" : "login-feedback success";
    }

    if (params.get("registered") === "1") {
        showMessage("Signup successful! Please log in.", false);
    }
    if (params.get("deleted") === "1") {
        showMessage("Your account was deleted successfully. You can create a new account or log in again.", false);
    }
    if (params.get("authError") === "unavailable") {
        showMessage("We couldn't verify your session. Please try logging in again.", true);
    }

    passwordToggle.addEventListener("click", function () {
        const isPassword = passwordInput.type === "password";
        passwordInput.type = isPassword ? "text" : "password";
        passwordToggle.setAttribute("aria-pressed", String(isPassword));
        passwordToggle.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
        passwordToggle.innerHTML = isPassword
            ? '<i class="fa-regular fa-eye-slash"></i>'
            : '<i class="fa-regular fa-eye"></i>';
    });

    form.addEventListener("submit", async function (event) {
        event.preventDefault();
        feedback.textContent = "";
        if (!form.reportValidity()) {
            return;
        }
        if (!form.elements.identifier.value.trim()) {
            showMessage("Enter your PRN or email address.", true);
            form.elements.identifier.focus();
            return;
        }
        submitButton.disabled = true;

        try {
            await window.ViniyogAPI.request("/login", {
                method: "POST",
                body: JSON.stringify({
                    identifier: form.elements.identifier.value.trim(),
                    password: passwordInput.value,
                    remember: form.elements.remember.checked
                })
            });
            showMessage("Login successful. Redirecting...", false);
            window.location.href = "students.html";
        } catch (error) {
            showMessage(error.message, true);
        } finally {
            submitButton.disabled = false;
        }
    });
});
