const inputs = document.querySelectorAll('input[type="text"]');

// Get specific inputs by ID
const ac1 = document.getElementById("ac1");
const ac2 = document.getElementById("ac2");
const ac3 = document.getElementById("ac3");
const ac4 = document.getElementById("ac4");
const ac5 = document.getElementById("ac5");
const calBtn = document.getElementById("ac6");
const cleanBtn = document.getElementById("ac7");

// Format number to US style with commas and 2 decimals
function formatNumberUS(val) {
  const num = parseFloat(val) || 0;
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Parse number safely (remove commas)
function parseNumber(val) {
  return parseFloat(val.replace(/,/g, "")) || 0;
}

// Perform calculation
function calcu() {
  const val1 = parseNumber(ac1.value);
  const val2 = parseNumber(ac2.value);
  const val4 = parseNumber(ac4.value);

  ac3.value = formatNumberUS(val1 - val2);
  ac5.value = formatNumberUS(val1 - val2 - val4);

  // Format all other inputs in US format
  [ac1, ac2, ac4].forEach((input) => {
    input.value = formatNumberUS(parseNumber(input.value));
  });
}

// Clear all inputs
function cleaAll() {
  inputs.forEach((input) => (input.value = ""));
}

// Event listeners
calBtn.addEventListener("click", calcu);
cleanBtn.addEventListener("click", cleaAll);

// Optional: format AC1, AC2, AC4 on blur
[ac1, ac2, ac4].forEach((input) => {
  input.addEventListener("blur", () => {
    input.value = formatNumberUS(parseNumber(input.value));
  });
});
