(function () {
    const pageName = window.location.pathname.split("/").pop().toLowerCase();
    const protectedPage = pageName === "students.html" || pageName === "profile.html";
    const authenticationPage = pageName === "login.html" || pageName === "signup.html";

    if (protectedPage || authenticationPage) {
        document.documentElement.style.visibility = "hidden";
    }

    let currentStudent = null;
    let authenticationReady = false;
    let resolveAuthentication;
    window.ViniyogAuthentication = new Promise((resolve) => {
        resolveAuthentication = resolve;
    });

    window.ViniyogAuthState = {
        currentStudent: null,
        setCurrentStudent(student) {
            currentStudent = student || null;
            this.currentStudent = currentStudent;
            renderNavigation();
        },
        async refreshCurrentStudent() {
            try {
                const student = await window.ViniyogAPI.request("/auth/me");
                this.setCurrentStudent(student);
                return student;
            } catch (error) {
                if (error.status === 401) {
                    this.setCurrentStudent(null);
                    return null;
                }
                throw error;
            }
        }
    };

    function routeName(anchor) {
        const value = anchor.getAttribute("href") || "";
        if (!value || value.startsWith("#") || /^(mailto:|tel:|javascript:)/i.test(value)) {
            return "";
        }
        try {
            const url = new URL(anchor.href, window.location.href);
            if (url.origin !== window.location.origin ||
                url.pathname === window.location.pathname) {
                return "";
            }
            return url.pathname.split("/").pop().toLowerCase();
        } catch {
            return "";
        }
    }

    function redirectForLink(anchor) {
        const route = routeName(anchor);
        if (route === "students.html") {
            return currentStudent ? "students.html" : "login.html";
        }
        if (route === "profile.html") {
            return currentStudent ? anchor.href : "login.html";
        }
        if (route === "login.html" || route === "signup.html") {
            return currentStudent ? "students.html" : anchor.href;
        }
        return "";
    }

    function updateLinks() {
        document.querySelectorAll("a[href]").forEach((anchor) => {
            const target = redirectForLink(anchor);
            if (target) {
                anchor.href = target;
            }
        });
    }

    function renderNavigation() {
        const navButtons = document.querySelector(".nav-buttons");
        if (!navButtons) {
            return;
        }

        if (!currentStudent) {
            if (navButtons.dataset.loginState === "logged-in") {
                navButtons.innerHTML = '<a href="login.html" class="nav-login">Login</a><a href="signup.html" class="nav-signup">Sign Up</a>';
                navButtons.dataset.loginState = "logged-out";
            }
            return;
        }

        navButtons.dataset.loginState = "logged-in";
        navButtons.replaceChildren();
        const profileLink = document.createElement("a");
        profileLink.className = "nav-profile";
        profileLink.href = `profile.html?id=${encodeURIComponent(currentStudent.id)}`;
        profileLink.setAttribute(
            "aria-label",
            `${currentStudent.student_name || "Student"}'s profile`
        );
        profileLink.title = "My Profile";

        const avatar = document.createElement("img");
        const photoSource = currentStudent.profile_photo || "assets/profile photos/Default.jpg";
        avatar.src = photoSource;
        avatar.alt = `${currentStudent.student_name || "Student"}'s profile photo`;
        avatar.className = "nav-profile-image";
        avatar.onerror = function () {
            this.onerror = null;
            this.src = "assets/profile photos/Default.jpg";
        };
        profileLink.appendChild(avatar);

        const logoutButton = document.createElement("button");
        logoutButton.className = "nav-signup nav-logout";
        logoutButton.type = "button";
        logoutButton.textContent = "Log Out";
        logoutButton.addEventListener("click", async function () {
            logoutButton.disabled = true;
            try {
                await window.ViniyogAPI.request("/logout", { method: "POST" });
                window.ViniyogAuthState.setCurrentStudent(null);
                window.location.replace("index.html");
            } catch (error) {
                logoutButton.disabled = false;
                window.alert(error.message);
            }
        });

        navButtons.append(profileLink, logoutButton);
    }

    document.addEventListener("click", function (event) {
        const anchor = event.target.closest("a[href]");
        if (!anchor) {
            return;
        }

        const target = redirectForLink(anchor);
        if (target) {
            event.preventDefault();
            window.location.assign(target);
        }
    }, true);

    document.addEventListener("DOMContentLoaded", async function () {
        const menuButton = document.querySelector(".menu-toggle");
        const navLinks = document.querySelector(".nav-links");
        const navButtons = document.querySelector(".nav-buttons");

        if (menuButton && navLinks && navButtons) {
            menuButton.addEventListener("click", function () {
                const isOpen = navLinks.classList.toggle("nav-open");
                navButtons.classList.toggle("nav-open", isOpen);
                menuButton.setAttribute("aria-expanded", String(isOpen));
                menuButton.setAttribute(
                    "aria-label",
                    isOpen ? "Close navigation menu" : "Open navigation menu"
                );
            });
        }

        try {
            currentStudent = await window.ViniyogAPI.request("/auth/me");
            window.ViniyogAuthState.currentStudent = currentStudent;
            authenticationReady = true;
        } catch (error) {
            if (error.status === 401) {
                authenticationReady = true;
            } else {
                console.error("Unable to verify the current session:", error.message);
            }
        }

        resolveAuthentication({
            student: currentStudent,
            verified: authenticationReady
        });

        if (!authenticationReady) {
            if (protectedPage) {
                window.location.replace("login.html?authError=unavailable");
                return;
            }
            document.documentElement.style.visibility = "";
            return;
        }

        if (protectedPage && !currentStudent) {
            window.location.replace("login.html");
            return;
        }
        if (authenticationPage && currentStudent) {
            window.location.replace("students.html");
            return;
        }

        updateLinks();
        renderNavigation();
        document.documentElement.style.visibility = "";
    });
})();
