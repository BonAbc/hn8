//
//
// Function to format input to 2 decimal places
//function formatToTwoDecimals(event) {
//  const input = event.target;
//  const value = parseFloat(input.value);
//if (!isNaN(value)) {
// input.value = value.toFixed(2);
//// }
//}

//idsToFormat.forEach((id) => {
// const el = document.getElementById(id);
// if (el) {
//   el.addEventListener("blur", formatToTwoDecimals);
// }
// });
//});
//
//

//

//function subtract() {
// const num1 = parseFloat(document.getElementById("num1").value);
// const num2 = parseFloat(document.getElementById("num2").value);
// const resultInput = document.getElementById("num3");

// if (isNaN(num1) || isNaN(num2)) {
//   resultInput.value = "Invalid input";
//   return;
//  }

// const result = num1 - num2;
//resultInput.value = result;
//}

//

// Step 2: Get Interest Rate and Loan Term
//  const annualRate = parseFloat(document.getElementById("num4").value); // %
//5.6% > 5.6 > go to line 52
// const loanTermYears = parseFloat(document.getElementById("num5").value); // years

// || or

//isNaN(annualRate)	Checks if the interest rate is Not a Number (e.g., empty or invalid input like "abc").
//isNaN(loanTermYears)	Same check for the loan term (e.g., left blank or invalid).
//annualRate <= 0	Disallows zero or negative interest rates.
//loanTermYears <= 0	Disallows zero or negative loan durations.

// Convert annual interest rate to monthly and loan term to months
// const monthlyRate = annualRate / 100 / 12;
// const totalPayments = loanTermYears * 12;
//   <!-- Calculate Button -->
//   <div class="calc-block">
//  <button onclick="calculate()">Calculate</button> : onclick="calculate()": FUnction in Line 36
// </div>
// Format a number to 2 decimal places with commas
function formatOutput(value) {
  if (isNaN(value)) return "";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// Convert input value to number (remove commas)
function cleanNumber(value) {
  if (!value) return 0;
  const num = parseFloat(value.toString().replace(/,/g, ""));
  return isNaN(num) ? 0 : num;
}

// Mortgage formula to calculate monthly payment
function calculateMonthlyPayment(
  loanAmount,
  annualInterestRate,
  loanTermYears
) {
  const monthlyRate = annualInterestRate / 100 / 12;
  const totalPayments = loanTermYears * 12;

  if (monthlyRate === 0) return loanAmount / totalPayments;

  return (
    (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, totalPayments)) /
    (Math.pow(1 + monthlyRate, totalPayments) - 1)
  );
}

// Format inputs with commas/decimals when blurred
function formatWithCommasAndDecimals(event) {
  const input = event.target;
  const raw = input.value.replace(/,/g, "");
  const num = parseFloat(raw);
  if (!isNaN(num)) {
    input.value = formatOutput(num);
  }
}

// Clear all input fields and reset dropdown
function clearAllFields() {
  const ids = [
    "num1",
    "num2",
    "num3",
    "num4",
    "num5",
    "num6",
    "num7",
    "num8",
    "num9",
    "result",
  ];

  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const operator = document.getElementById("operator");
  if (operator) operator.selectedIndex = 0;
}

// Perform calculation based on selected operator: Begin
function calculate() {
  const operator = document.getElementById("operator").value;
  const resultInput = document.getElementById("result");

  // Clear result field on every calculation
  resultInput.value = "";

  // Get and clean inputs
  const purchasePrice = cleanNumber(document.getElementById("num1").value);
  const downPayment = cleanNumber(document.getElementById("num2").value);
  const interestRateRaw = document.getElementById("num4").value;
  const interestRate = cleanNumber(interestRateRaw.replace(/[^0-9.]/g, ""));
  const loanTermYears = cleanNumber(document.getElementById("num5").value);
  const tax = cleanNumber(document.getElementById("num7").value);
  const insurance = cleanNumber(document.getElementById("num8").value);
  const others = cleanNumber(document.getElementById("num9").value);

  // DOM references for output fields
  const loanField = document.getElementById("num3");
  const paymentField = document.getElementById("num6");

  // Try to calculate Loan Amount from purchase price and down payment
  let loanAmount = 0;
  if (purchasePrice > 0 && downPayment >= 0 && downPayment <= purchasePrice) {
    loanAmount = purchasePrice - downPayment;
  } else {
    // If not valid, try getting loan amount directly from input field
    loanAmount = cleanNumber(loanField.value);
  }

  if (operator === "loan") {
    if (purchasePrice > 0 && downPayment >= 0 && downPayment <= purchasePrice) {
      loanField.value = formatOutput(loanAmount);
    } else {
      loanField.value = "";
      // Replace alert with message in resultInput
      resultInput.value = "Invalid Num1/Num2";
      // alert("Invalid Purchase Price or Down Payment");
    }
    paymentField.value = "";
    //resultInput.value = "";
    return;
  }

  if (operator === "payment") {
    // Update loan amount field if we computed it from purchase price
    if (purchasePrice > 0 && downPayment >= 0 && downPayment <= purchasePrice) {
      loanField.value = formatOutput(loanAmount);
    }

    if (loanAmount > 0) {
      if (interestRate >= 0 && loanTermYears > 0) {
        const monthlyPayment = calculateMonthlyPayment(
          //Line 76
          loanAmount, //Line 151
          interestRate, // Line 138
          loanTermYears // Lin 139
          // pass 3 parameters , function: monthlyPayment
        );
        paymentField.value = formatOutput(monthlyPayment);
      } else {
        paymentField.value = "";
        alert("Missing or invalid inputs for Monthly Payment");
      }
    } else {
      paymentField.value = "";
      alert(
        "Please provide either Purchase Price & Down Payment or a Loan Amount."
      );
    }

    resultInput.value = "";
    return;
  }

  if (operator === "total") {
    if (loanAmount > 0) {
      loanField.value = formatOutput(loanAmount);
    } else {
      loanField.value = "";
      alert("Invalid Purchase Price or Down Payment");
      paymentField.value = "";
      resultInput.value = "";
      return;
    }

    let monthlyPayment = 0;
    if (interestRate >= 0 && loanTermYears > 0) {
      //&& and
      monthlyPayment = calculateMonthlyPayment(
        loanAmount,
        interestRate,
        loanTermYears
      );
      paymentField.value = formatOutput(monthlyPayment);
    } else {
      paymentField.value = "";
      alert("Missing or invalid inputs for Monthly Payment");
      resultInput.value = "";
      return;
    }

    const totalMonthlyCost = monthlyPayment + tax + insurance + others;
    if (totalMonthlyCost > 0) {
      resultInput.value = formatOutput(totalMonthlyCost);
    } else {
      resultInput.value = "";
    }
    return;
  }

  resultInput.value = "Please select a valid operation"; //Message shown in the result field
}

// Perform calculation based on selected operator: End
// Setup event listeners after page loads
window.addEventListener("DOMContentLoaded", () => {
  // Format specific fields on blur
  const formatIds = ["num1", "num2", "num4", "num5", "num7", "num8", "num9"];
  formatIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("blur", formatWithCommasAndDecimals);
    }
  });

  // Calculate button: manually trigger calculation
  const calculateBtn = document.getElementById("calculateBtn");
  if (calculateBtn) {
    calculateBtn.addEventListener("click", calculate);
  }

  // Reset button: clear all inputs
  const resetBtn = document.getElementById("resetBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", clearAllFields);
  }
});

//
