document.addEventListener("DOMContentLoaded", function () {
  // --- Password visibility toggle ---
  const togglePassword = document.getElementById("togglePassword");
  const passwordField = document.getElementById("password");
  if (togglePassword && passwordField) {
    const icon = togglePassword.querySelector("i");

    togglePassword.addEventListener("click", function () {
      const isPasswordHidden = passwordField.type === "password";
      passwordField.type = isPasswordHidden ? "text" : "password";

      if (icon) {
        icon.classList.toggle("bi-eye");
        icon.classList.toggle("bi-eye-slash");
      }
    });
  }
});
//Add email verified
document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("form[action='/signup']"); // so amny form > form sign up
  const emailInput = document.getElementById("username");
  const emailError = document.getElementById("emailError");

  if (!form || !emailInput) return;

  form.addEventListener("submit", (e) => {
    const email = emailInput.value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      e.preventDefault(); // Stop form submission
      emailError.textContent = "Please enter a valid email address.";
      emailError.style.display = "block";
      emailInput.focus();
    } else {
      emailError.textContent = "";
      emailError.style.display = "none";
    }
  });
});
//clear old message
//clear old message
document.addEventListener("DOMContentLoaded", () => {
  const emailInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");

  const emailErrorBox = document.getElementById("emailServerError");
  const passwordErrorBox = document.getElementById("passwordServerError");

  if (emailInput) {
    emailInput.addEventListener("input", () => {
      if (emailErrorBox) {
        emailErrorBox.textContent = "";
        emailErrorBox.style.display = "none";
      }
    });
  }

  if (passwordInput) {
    passwordInput.addEventListener("input", () => {
      if (passwordErrorBox) {
        passwordErrorBox.textContent = "";
        passwordErrorBox.style.display = "none";
      }
    });
  }
});
