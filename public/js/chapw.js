document.addEventListener("DOMContentLoaded", function () {
  // Setup toggle for New Password
  const newPasswordToggle = document.getElementById("togglPassword");
  const newPasswordInput = document.getElementById("newPassword");

  if (newPasswordToggle && newPasswordInput) {
    const icon = newPasswordToggle.querySelector("i");

    newPasswordToggle.addEventListener("click", function () {
      const isHidden = newPasswordInput.type === "password";
      newPasswordInput.type = isHidden ? "text" : "password";

      if (icon) {
        icon.classList.toggle("bi-eye");
        icon.classList.toggle("bi-eye-slash");
      }
    });
  }

  // Setup toggle for Confirm Password
  const confirmPasswordToggle = document.getElementById("togglePassword");
  const confirmPasswordInput = document.getElementById("confirmPassword");

  if (confirmPasswordToggle && confirmPasswordInput) {
    const icon = confirmPasswordToggle.querySelector("i");

    confirmPasswordToggle.addEventListener("click", function () {
      const isHidden = confirmPasswordInput.type === "password";
      confirmPasswordInput.type = isHidden ? "text" : "password";

      if (icon) {
        icon.classList.toggle("bi-eye");
        icon.classList.toggle("bi-eye-slash");
      }
    });
  }
});
//clear old message
document.addEventListener("DOMContentLoaded", () => {
  const inputs = document.querySelectorAll("input");
  const messageBox = document.getElementById("message");

  inputs.forEach((input) => {
    input.addEventListener("input", () => {
      if (messageBox) {
        messageBox.textContent = "";
        messageBox.style.display = "none"; // hide the message box
      }
    });
  });
});
