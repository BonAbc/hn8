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

  // --- Clear flash messages on input ---
  const inputs = document.querySelectorAll("#username, #password");
  function clearFlashMessages() {
    const messages = document.querySelectorAll(".flash-message");
    messages.forEach((msg) => msg.remove());
  }
  inputs.forEach((input) => {
    input.addEventListener("input", clearFlashMessages);
  });
});
