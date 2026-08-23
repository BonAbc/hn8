document.addEventListener("DOMContentLoaded", function () {
  let selectedForm = null;

  document.querySelectorAll(".confirm-btn").forEach((button) => {
    button.addEventListener("click", function () {
      selectedForm = this.closest("form");

      const action = this.dataset.action;

      const message = document.getElementById("confirmMessage");
      const confirmBtn = document.getElementById("confirmActionBtn");

      if (action === "disable") {
        message.textContent = "Are you sure you want to disable this user?";

        confirmBtn.className = "btn btn-danger";
      } else {
        message.textContent = "Are you sure you want to reactivate this user?";

        confirmBtn.className = "btn btn-success";
      }
    });
  });

  document
    .getElementById("confirmActionBtn")
    .addEventListener("click", function () {
      if (selectedForm) {
        selectedForm.submit();
      }
    });
});
