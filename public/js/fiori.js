// -----------------------------
function roundAndFormat(value) {
  if (isNaN(value) || value === "") return "";
  let rounded = Math.round(parseFloat(value));
  return rounded.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getRoundedValue(input) {
  const val = parseFloat(input.value.replace(/,/g, ""));
  return isNaN(val) ? 0 : Math.round(val);
}

// -----------------------------
// Format inputs on blur
// -----------------------------
const numericInputs = document.querySelectorAll(
  "#sap1, #sap2, #sap3, #input1, #input2, #input3, #input4, #input5, #input6"
);

numericInputs.forEach((input) => {
  input.addEventListener("blur", () => {
    let val = parseFloat(input.value.replace(/,/g, ""));
    if (!isNaN(val)) {
      input.value = roundAndFormat(val);
    } else if (input.value.trim() !== "") {
      alert("Please enter a valid number.");
      input.focus();
    }
  });
});

// -----------------------------
// Element References
// -----------------------------
const sap1 = document.getElementById("sap1"); // Gross Income
const sap2 = document.getElementById("sap2"); // Total Deduction
const sap3 = document.getElementById("sap3"); // Taxable Income

const stateSelect = document.getElementById("st"); // State dropdown
const filingSelect = document.getElementById("fs"); // Filing Status dropdown
//Line 104 in ejs fs
// State Section
const stateTaxInput = document.getElementById("input4");
const stateWithheldInput = document.getElementById("input5");
const stateRefundInput = document.getElementById("input6");

// Federal Section
const fedTaxInput = document.getElementById("input1");
const fedWithheldInput = document.getElementById("input2");
const fedRefundInput = document.getElementById("input3");

// Buttons
const stateBtn = document.getElementById("stateBtn");
const federalBtn = document.getElementById("federalBtn");
const clearBtn = document.querySelector('button[type="reset"]');

// -----------------------------
// Calculate Taxable Income
// -----------------------------
function updateResult() {
  const gross = getRoundedValue(sap1);
  const deduction = getRoundedValue(sap2);
  const taxable = Math.round(gross - deduction); // use rounded values
  sap3.value = roundAndFormat(taxable);
  return taxable;
}

sap1.addEventListener("input", updateResult);
sap2.addEventListener("input", updateResult);

// -----------------------------
// STATE TAX CALCULATION
// -----------------------------
function calculateStateTax() {
  const taxableIncome = updateResult();
  const selectedState = stateSelect.value;

  if (!selectedState) {
    alert("Please select a state.");
    return;
  }

  const rate = parseFloat(stateRates[selectedState]);
  if (isNaN(rate)) {
    alert("Tax rate for this state not found.");
    return;
  }

  const stateTax = Math.round(taxableIncome * (rate / 100));
  stateTaxInput.value = roundAndFormat(stateTax);

  calculateStateRefund();
}

function calculateStateRefund() {
  const tax = getRoundedValue(stateTaxInput);
  const withheld = getRoundedValue(stateWithheldInput);
  const refund = Math.round(withheld - tax);
  stateRefundInput.value = roundAndFormat(refund);
}

stateWithheldInput.addEventListener("input", calculateStateRefund);

stateBtn.addEventListener("click", (e) => {
  e.preventDefault();
  calculateStateTax();
});

// -----------------------------
// FEDERAL TAX CALCULATION
// -----------------------------
function calculateFederalTax() {
  const taxableIncome = updateResult();
  const filingStatus = filingSelect.value; // "S" or "M"
  //filingselect > line 109
  let brackets;
  if (!filingStatus) {
    alert("Please select a filing status.");
    return;
  }

  if (filingStatus === "M") {
    brackets = [
      { limit: 23850, rate: 0.1, base: 0 },
      { limit: 96950, rate: 0.12, base: 2385 },
      { limit: 206700, rate: 0.22, base: 11157 },
      { limit: 394600, rate: 0.24, base: 35302 },
      { limit: 501050, rate: 0.32, base: 80398 },
      { limit: 751600, rate: 0.35, base: 114462 },
      { limit: Infinity, rate: 0.37, base: 202154.5 },
    ];
  } else {
    brackets = [
      { limit: 11925, rate: 0.1, base: 0 },
      { limit: 48475, rate: 0.12, base: 1192.5 },
      { limit: 103350, rate: 0.22, base: 5578.5 },
      { limit: 197300, rate: 0.24, base: 17651 },
      { limit: 250525, rate: 0.32, base: 40199 },
      { limit: 626350, rate: 0.35, base: 57231 },
      { limit: Infinity, rate: 0.37, base: 188769.75 },
    ];
  }

  let federalTax = 0;

  for (let i = 0; i < brackets.length; i++) {
    const lowerLimit = i === 0 ? 0 : brackets[i - 1].limit;
    const bracket = brackets[i];

    if (taxableIncome <= bracket.limit) {
      federalTax = Math.round(
        bracket.base + (taxableIncome - lowerLimit) * bracket.rate
      );
      break;
    }
  }

  fedTaxInput.value = roundAndFormat(federalTax);
  calculateFederalRefund();
}

function calculateFederalRefund() {
  const tax = getRoundedValue(fedTaxInput);
  const withheld = getRoundedValue(fedWithheldInput);
  const refund = Math.round(withheld - tax);
  fedRefundInput.value = roundAndFormat(refund);
}

fedWithheldInput.addEventListener("input", calculateFederalRefund);
filingSelect.addEventListener("change", calculateFederalTax);
federalBtn.addEventListener("click", (e) => {
  e.preventDefault();
  calculateFederalTax();
});

// -----------------------------
// CLEAR ALL INPUTS
// -----------------------------
clearBtn.addEventListener("click", (e) => {
  e.preventDefault();

  document.querySelectorAll("input").forEach((input) => {
    input.value = "";
  });

  document.querySelectorAll("select").forEach((select) => {
    select.selectedIndex = 0;
  });
});
