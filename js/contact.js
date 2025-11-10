//To clear message when user enter a second message

function clearThanks() {
  const thanksBox = document.getElementById("thanks-message");
  if (thanksBox) {
    thanksBox.innerText = "";
  }
}
//DOMContentLoaded: all inputs and message loaded
document.addEventListener("DOMContentLoaded", () => {
  const inputs = document.querySelectorAll("input, textarea");
  //Add eventListener: input event, Clear Message: Line 7.
  inputs.forEach((input) => {
    input.addEventListener("input", clearThanks); // Function in Line 3
  });
});
