// Format num1 and num2 inputs on blur (show 1,000.00 style)
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

  // Shrink font dynamically as user types
  input.addEventListener("input", () => shrinkFont(input));
});

// Shrink font function for very large numbers
function shrinkFont(input) {
  const length = input.value.replace(/,/g, "").length;

  if (length > 12) input.style.fontSize = "12px";
  else if (length > 9) input.style.fontSize = "14px";
  else input.style.fontSize = "16px";
}

// Calculate when button clicked
document.getElementById("calculateBtn").addEventListener("click", calculate);

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
    shrinkFont(resultInput);
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
  shrinkFont(resultInput); // shrink result if too long
}

// Reset button
document.getElementById("resetBtn").addEventListener("click", () => {
  ["num1", "num2", "result"].forEach((id) => {
    const input = document.getElementById(id);
    input.value = "";
    input.style.fontSize = "16px"; // reset font size
  });

  document.getElementById("operator").value = ""; // reset operator
});
