document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("signupForm");
  const photoInput = document.getElementById("profilePhoto");
  const preview = document.getElementById("photoPreview");
  const cropEditor = document.getElementById("cropEditor");
  const cropImage = document.getElementById("cropImage");
  const photoStatus = document.getElementById("photoStatus");
  const contactError = document.getElementById("contactError");
  const feedback = document.getElementById("formFeedback");

  let cropper = null;
  let croppedPhoto = null;
  let temporaryUrl = null;
  let previewUrl = null;
  let signupInProgress = false;
  let signupSucceeded = false;

  // Show messages to the user.
  function showMessage(message, type) {
    feedback.textContent = message;
    feedback.className = "form-feedback " + type;
  }

  // 1. Select and crop profile photo.
  photoInput.addEventListener("change", function () {
    const file = this.files[0];

    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      alert("Please select a JPG, PNG or WebP image.");
      this.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Please select an image smaller than 5 MB.");
      this.value = "";
      return;
    }

    croppedPhoto = null;

    if (temporaryUrl) URL.revokeObjectURL(temporaryUrl);
    temporaryUrl = URL.createObjectURL(file);

    cropImage.src = temporaryUrl;
    cropEditor.hidden = false;
    photoStatus.textContent = "Adjust your image below.";

    cropImage.onload = function () {
      if (cropper) cropper.destroy();

      cropper = new Cropper(cropImage, {
        aspectRatio: 1,
        viewMode: 1,
        dragMode: "move",
        autoCropArea: 0.85,
        responsive: true,
        background: false,
        guides: false,
        center: true,
        movable: true,
        zoomable: true,
        cropBoxMovable: false,
        cropBoxResizable: false,
      });
    };
  });

  document.getElementById("applyCrop").addEventListener("click", function () {
    if (!cropper) return;

    cropper
      .getCroppedCanvas({
        width: 400,
        height: 400,
        imageSmoothingQuality: "high",
      })
      .toBlob(
        function (blob) {
          if (!blob) {
            showMessage("Could not crop the image. Please try again.", "error");
            return;
          }

          croppedPhoto = blob;

          if (previewUrl) URL.revokeObjectURL(previewUrl);
          previewUrl = URL.createObjectURL(blob);

          preview.replaceChildren();

          const image = document.createElement("img");
          image.src = previewUrl;
          image.alt = "Your cropped profile photo";
          preview.appendChild(image);

          cropEditor.hidden = true;
          photoStatus.textContent = "Photo cropped successfully.";

          cropper.destroy();
          cropper = null;
        },
        "image/jpeg",
        0.9,
      );
  });

  document.getElementById("cancelCrop").addEventListener("click", function () {
    cropEditor.hidden = true;

    if (cropper) {
      cropper.destroy();
      cropper = null;
    }

    photoInput.value = "";

    photoStatus.textContent = croppedPhoto
      ? "Your previous cropped photo is still selected."
      : "No photo selected.";
  });

  // 2. Show or hide passwords.
  document.querySelectorAll(".password-toggle").forEach(function (button) {
    button.addEventListener("click", function () {
      const input = document.getElementById(this.dataset.target);
      const icon = this.querySelector("i");
      const show = input.type === "password";

      input.type = show ? "text" : "password";

      if (icon) {
        icon.classList.toggle("fa-eye", !show);
        icon.classList.toggle("fa-eye-slash", show);
      }

      this.setAttribute("aria-label", show ? "Hide password" : "Show password");
    });
  });

  // 3. Bio character counter.
  document.getElementById("bio").addEventListener("input", function () {
    document.getElementById("bioCount").textContent = this.value.length;
  });

  // 4. Require at least one contact method.
  const contactFields = [
    "phone",
    "linkedin",
    "github",
    "portfolio",
    "otherContact",
  ];

  function hasContactDetail() {
    return contactFields.some(function (id) {
      return document.getElementById(id).value.trim() !== "";
    });
  }

  contactFields.forEach(function (id) {
    document.getElementById(id).addEventListener("input", function () {
      if (hasContactDetail()) {
        contactError.hidden = true;
      }
    });
  });

  // 5. Validate and submit signup information to the backend.
  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (signupInProgress) {
      return;
    }

    feedback.textContent = "";
    feedback.className = "form-feedback";
    contactError.hidden = true;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    if (!hasContactDetail()) {
      contactError.hidden = false;
      contactError.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      document.getElementById("phone").focus();
      return;
    }

    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (password !== confirmPassword) {
      showMessage("Your passwords do not match.", "error");
      document.getElementById("confirmPassword").focus();
      return;
    }

    if (cropEditor.hidden === false) {
      showMessage("Please apply or cancel your photo crop first.", "error");
      return;
    }

    // Collect all form fields, including the uploaded photo.
    const formData = new FormData(form);

    // Send the cropped photo rather than the original image.
    if (croppedPhoto) {
      formData.set(
        "profilePhoto",
        new File([croppedPhoto], "profile-photo.jpg", {
          type: "image/jpeg",
        }),
      );
    } else {
      formData.delete("profilePhoto");
    }

    const submitButton = form.querySelector('[type="submit"]');
    signupInProgress = true;

    if (submitButton) {
      submitButton.disabled = true;
    }

    showMessage("Creating your account...", "success");

    try {
      const result = await window.ViniyogAPI.request("/signup", {
        method: "POST",
        body: formData,
      });

      showMessage("Signup successful! Please log in.", "success");
      signupSucceeded = true;
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrl = null;
      }

      if (temporaryUrl) {
        URL.revokeObjectURL(temporaryUrl);
        temporaryUrl = null;
      }
      window.setTimeout(() => {
        window.location.href = "login.html?registered=1";
      }, 900);
    } catch (error) {
      showMessage(
        error.message === "Failed to fetch"
          ? "Cannot connect to the backend. Make sure your server is running on port 5000."
          : error.message,
        "error",
      );
    } finally {
      if (!signupSucceeded) {
        signupInProgress = false;
        if (submitButton) {
          submitButton.disabled = false;
        }
      }
    }
  });
});
