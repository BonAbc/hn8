function clearThanks() {
  const thanksBox = document.getElementById("thanks-message");
  if (thanksBox) {
    thanksBox.innerText = "";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const inputs = document.querySelectorAll("input, textarea");
  //Add eventListener: input event, Clear Message: Line 7.
  inputs.forEach((input) => {
    input.addEventListener("input", clearThanks); // Function in Line 3
  });
});
