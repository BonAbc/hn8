// Format num1 and num2 inputs on blur (show 1,000.00 style)
["num1", "num2"].forEach((id) => {
  const input = document.getElementById(id);

  input.addEventListener("blur", () => {
    const value = parseFloat(input.value.replace(/,/g, ""));
    if (!isNaN(value)) {
      input.value = value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } else {
      input.value = ""; // clear invalid input
    }
  });
});

// Calculate when button clicked
document.getElementById("calculateBtn").addEventListener("click", calculate);

// Calculate when Enter pressed in num1, num2, or operator
//["num1", "num2", "operator"].forEach((id) => {
// document.getElementById(id).addEventListener("keydown", (event) => {
//    if (event.key === "Enter") {
//      event.preventDefault();
//     calculate();
//   }
//  });
//});

function calculate() {
  const num1 = parseFloat(
    document.getElementById("num1").value.replace(/,/g, "")
  );
  const num2 = parseFloat(
    document.getElementById("num2").value.replace(/,/g, "")
  );
  const operator = document.getElementById("operator").value;
  const resultInput = document.getElementById("result");

  if (isNaN(num1) || isNaN(num2)) {
    resultInput.value = "Invalid input";
    return;
  }

  let result;
  switch (operator) {
    case "+":
      result = num1 + num2;
      break;
    case "-":
      result = num1 - num2;
      break;
    case "*":
      result = num1 * num2;
      break;
    case "/":
      result = num2 !== 0 ? num1 / num2 : "Cannot divide by 0";
      break;
    case "^":
      result = Math.pow(num1, num2);
      break;
    default:
      result = "Invalid operator";
  }

  if (typeof result === "number" && isFinite(result)) {
    result = result.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  resultInput.value = result;
}
