const checkbox = document.getElementById("cb1");
const message = document.getElementById("cbt");

checkbox.addEventListener("change", function () {
  if (this.checked) {
    message.style.display = "block";
  } else {
    message.style.display = "none";
  }
});
