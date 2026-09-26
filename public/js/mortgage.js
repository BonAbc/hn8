function formatOutput(value) {
  if (isNaN(value)) return "";

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(value);
}

// Convert input value to number
function cleanNumber(value) {
  if (!value) return 0;

  const num = parseFloat(value.toString().replace(/,/g, ""));

  return isNaN(num) ? 0 : num;
}

// Mortgage formula
function calculateMonthlyPayment(
  loanAmount,
  annualInterestRate,
  loanTermYears,
) {
  const monthlyRate = annualInterestRate / 100 / 12;
  const totalPayments = loanTermYears * 12;

  if (totalPayments <= 0) return 0;

  if (monthlyRate === 0) {
    return loanAmount / totalPayments;
  }

  return (
    (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, totalPayments)) /
    (Math.pow(1 + monthlyRate, totalPayments) - 1)
  );
}

// Format input on blur
function formatWithCommasAndDecimals(event) {
  const input = event.target;

  const raw = input.value.replace(/,/g, "");
  const num = parseFloat(raw);

  if (!isNaN(num)) {
    input.value = formatOutput(num);
  }
}

/* =====================================================
   GET CURRENT MORTGAGE DATA
   ===================================================== */

function getMortgageData() {
  const purchasePrice = cleanNumber(document.getElementById("num1")?.value);

  const downPayment = cleanNumber(document.getElementById("num2")?.value);

  const loanField = document.getElementById("num3");

  const interestRateRaw = document.getElementById("num4")?.value || "";

  const interestRate = cleanNumber(interestRateRaw.replace(/[^0-9.]/g, ""));

  const loanTermYears = cleanNumber(document.getElementById("num5")?.value);

  let loanAmount = 0;

  /*
    Purchase Price + Down Payment
    take priority when both are valid.
  */
  if (purchasePrice > 0 && downPayment >= 0 && downPayment <= purchasePrice) {
    loanAmount = purchasePrice - downPayment;
  } else {
    loanAmount = cleanNumber(loanField?.value);
  }

  return {
    loanAmount,
    interestRate,
    loanTermYears,
  };
}

/* =====================================================
   GET SCHEDULE 2 INPUTS
   ===================================================== */

function getSchedule2Inputs() {
  const actualPayment = cleanNumber(
    document.getElementById("actualPayment")?.value,
  );

  const actualPaymentPeriod = Math.floor(
    cleanNumber(document.getElementById("actualPaymentPeriod")?.value),
  );

  return {
    actualPayment,
    actualPaymentPeriod,
  };
}

/* =====================================================
   SCHEDULE 1
   Constant Monthly Payment
   ===================================================== */

function generateSchedule1(
  loanAmount,
  annualInterestRate,
  loanTermYears,
  monthlyPayment,
) {
  const body = document.getElementById("amortizationBody1");

  if (!body) return;

  body.innerHTML = "";

  const monthlyRate = annualInterestRate / 100 / 12;
  const totalPeriods = Math.ceil(loanTermYears * 12);

  let balance = loanAmount;

  // TOTALS
  let totalPayment = 0;
  let totalInterest = 0;

  for (let period = 1; period <= totalPeriods; period++) {
    if (balance <= 0.000001) break;

    const beginningBalance = balance;

    const interestPaid = monthlyRate === 0 ? 0 : beginningBalance * monthlyRate;

    let payment = monthlyPayment;

    // Final payment cannot exceed remaining balance + interest
    if (payment > beginningBalance + interestPaid) {
      payment = beginningBalance + interestPaid;
    }

    const principalPaid = payment - interestPaid;

    let endingBalance = beginningBalance - principalPaid;

    if (endingBalance < 0.000001) {
      endingBalance = 0;
    }

    // Add to totals
    totalPayment += payment;
    totalInterest += interestPaid;

    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${period}</td>
      <td>${formatOutput(beginningBalance)}</td>
      <td>${formatOutput(payment)}</td>
      <td>${formatOutput(interestPaid)}</td>
      <td>${formatOutput(principalPaid)}</td>
      <td>${formatOutput(endingBalance)}</td>
    `;

    body.appendChild(row);

    // Carry balance to next period
    balance = endingBalance;
  }

  /* =================================================
     SCHEDULE 1 TOTAL ROW

     Beginning Balance = blank
     Total Payment     = total
     Interest Paid     = total
     Principal Paid    = blank
     Ending Balance    = blank
     ================================================= */

  const totalRow = document.createElement("tr");

  totalRow.classList.add("amortization-total-row");

  totalRow.innerHTML = `
    <td><strong>TOTAL</strong></td>
    <td></td>
    <td><strong>${formatOutput(totalPayment)}</strong></td>
    <td><strong>${formatOutput(totalInterest)}</strong></td>
    <td></td>
    <td></td>
  `;

  body.appendChild(totalRow);

  // Summary
  const loan = document.getElementById("schedule1Loan");

  const payment = document.getElementById("schedule1Payment");

  const periods = document.getElementById("schedule1Periods");

  if (loan) {
    loan.textContent = formatOutput(loanAmount);
  }

  if (payment) {
    payment.textContent = formatOutput(monthlyPayment);
  }

  if (periods) {
    periods.textContent = totalPeriods;
  }
}

/* =====================================================
   SCHEDULE 2
   Constant Payment + ONE Actual Payment
   ===================================================== */

function generateSchedule2(
  loanAmount,
  annualInterestRate,
  loanTermYears,
  monthlyPayment,
  actualPayment,
  actualPaymentPeriod,
) {
  const body = document.getElementById("amortizationBody2");

  if (!body) return;

  body.innerHTML = "";

  const monthlyRate = annualInterestRate / 100 / 12;

  const maximumPeriods = Math.ceil(loanTermYears * 12);

  let balance = loanAmount;

  // TOTALS
  let totalPayment = 0;
  let totalInterest = 0;

  for (let period = 1; period <= maximumPeriods; period++) {
    if (balance <= 0.000001) break;

    const beginningBalance = balance;

    /*
      Interest is calculated from the
      current beginning balance.
    */
    const interestPaid = monthlyRate === 0 ? 0 : beginningBalance * monthlyRate;

    /*
      Normally use Constant Monthly Payment.
    */
    let payment = monthlyPayment;

    /*
      IMPORTANT:

      Actual Monthly Payment is the TOTAL
      payment for the selected period.

      Example:

      Constant = 53.185
      Actual   = 60.000
      Period   = 10

      Periods 1-9  = 53.185
      Period 10    = 60.000
      Periods 11+  = 53.185
    */
    if (
      actualPayment > 0 &&
      actualPaymentPeriod > 0 &&
      period === actualPaymentPeriod
    ) {
      payment = actualPayment;
    }

    /*
      Final payment cannot exceed
      remaining balance + interest.
    */
    if (payment > beginningBalance + interestPaid) {
      payment = beginningBalance + interestPaid;
    }

    const principalPaid = payment - interestPaid;

    let endingBalance = beginningBalance - principalPaid;

    if (endingBalance < 0.000001) {
      endingBalance = 0;
    }

    // Add to totals
    totalPayment += payment;
    totalInterest += interestPaid;

    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${period}</td>
      <td>${formatOutput(beginningBalance)}</td>
      <td>${formatOutput(payment)}</td>
      <td>${formatOutput(interestPaid)}</td>
      <td>${formatOutput(principalPaid)}</td>
      <td>${formatOutput(endingBalance)}</td>
    `;

    body.appendChild(row);

    /*
      IMPORTANT:

      The new lower balance becomes
      the beginning balance for the
      next period.

      Therefore the extra payment
      affects all following interest
      calculations.
    */
    balance = endingBalance;
  }

  /* =================================================
     SCHEDULE 2 TOTAL ROW

     Beginning Balance = blank
     Total Payment     = total
     Interest Paid     = total
     Principal Paid    = blank
     Ending Balance    = blank
     ================================================= */

  const totalRow = document.createElement("tr");

  totalRow.classList.add("amortization-total-row");

  totalRow.innerHTML = `
    <td><strong>TOTAL</strong></td>
    <td></td>
    <td><strong>${formatOutput(totalPayment)}</strong></td>
    <td><strong>${formatOutput(totalInterest)}</strong></td>
    <td></td>
    <td></td>
  `;

  body.appendChild(totalRow);

  // Summary
  const constant = document.getElementById("schedule2Constant");

  const additional = document.getElementById("schedule2Additional");

  const payment = document.getElementById("schedule2Payment");

  const periods = document.getElementById("schedule2Periods");

  const paymentPeriod = document.getElementById("schedule2PaymentPeriod");

  if (constant) {
    constant.textContent = formatOutput(monthlyPayment);
  }

  if (additional) {
    additional.textContent =
      actualPayment > 0 ? formatOutput(actualPayment) : formatOutput(0);
  }

  /*
    Shows the actual payment amount
    for the special period.
  */
  if (payment) {
    payment.textContent =
      actualPayment > 0
        ? formatOutput(actualPayment)
        : formatOutput(monthlyPayment);
  }

  if (paymentPeriod) {
    paymentPeriod.textContent =
      actualPaymentPeriod > 0 ? actualPaymentPeriod : 0;
  }

  if (periods) {
    periods.textContent = maximumPeriods;
  }
}

/* =====================================================
   CALCULATE ONLY SCHEDULE 2
   ===================================================== */

function calculateSchedule2() {
  const { loanAmount, interestRate, loanTermYears } = getMortgageData();

  const { actualPayment, actualPaymentPeriod } = getSchedule2Inputs();

  /*
    Get Constant Monthly Payment from num6.
  */
  let monthlyPayment = cleanNumber(document.getElementById("num6")?.value);

  /*
    If num6 is empty, calculate it.
  */
  if (
    monthlyPayment <= 0 &&
    loanAmount > 0 &&
    loanTermYears > 0 &&
    interestRate >= 0
  ) {
    monthlyPayment = calculateMonthlyPayment(
      loanAmount,
      interestRate,
      loanTermYears,
    );
  }

  if (loanAmount <= 0 || loanTermYears <= 0 || monthlyPayment <= 0) {
    alert(
      "Please calculate the Mortgage Amount and Constant Monthly Payment first.",
    );

    return;
  }

  /*
    Actual Payment requires a valid period.
  */
  if (
    actualPayment > 0 &&
    (actualPaymentPeriod <= 0 ||
      actualPaymentPeriod > Math.ceil(loanTermYears * 12))
  ) {
    alert("Please enter a valid Actual Payment Period.");

    return;
  }

  /*
    Period requires an Actual Payment.
  */
  if (actualPaymentPeriod > 0 && actualPayment <= 0) {
    alert("Please enter an Actual Monthly Payment.");

    return;
  }

  /*
    Recalculate Schedule 2 only.
  */
  generateSchedule2(
    loanAmount,
    interestRate,
    loanTermYears,
    monthlyPayment,
    actualPayment,
    actualPaymentPeriod,
  );
}

/* =====================================================
   CLEAR
   ===================================================== */

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
    "actualPayment",
    "actualPaymentPeriod",
  ];

  ids.forEach((id) => {
    const el = document.getElementById(id);

    if (el) {
      el.value = "";
    }
  });

  const operator = document.getElementById("operator");

  if (operator) {
    operator.selectedIndex = 0;
  }

  const body1 = document.getElementById("amortizationBody1");

  const body2 = document.getElementById("amortizationBody2");

  if (body1) {
    body1.innerHTML = "";
  }

  if (body2) {
    body2.innerHTML = "";
  }

  const summaryIds = [
    "schedule1Loan",
    "schedule1Payment",
    "schedule1Periods",
    "schedule2Constant",
    "schedule2Additional",
    "schedule2Payment",
    "schedule2PaymentPeriod",
    "schedule2Periods",
  ];

  summaryIds.forEach((id) => {
    const el = document.getElementById(id);

    if (el) {
      el.textContent = "0";
    }
  });
}

/* =====================================================
   MAIN CALCULATION
   ===================================================== */

function calculate() {
  const operator = document.getElementById("operator").value;

  const resultInput = document.getElementById("result");

  resultInput.value = "";

  const purchasePrice = cleanNumber(document.getElementById("num1").value);

  const downPayment = cleanNumber(document.getElementById("num2").value);

  const interestRateRaw = document.getElementById("num4").value;

  const interestRate = cleanNumber(interestRateRaw.replace(/[^0-9.]/g, ""));

  const loanTermYears = cleanNumber(document.getElementById("num5").value);

  const tax = cleanNumber(document.getElementById("num7").value);

  const insurance = cleanNumber(document.getElementById("num8").value);

  const others = cleanNumber(document.getElementById("num9").value);

  const loanField = document.getElementById("num3");

  const paymentField = document.getElementById("num6");

  /*
    Schedule 2 inputs
  */
  const { actualPayment, actualPaymentPeriod } = getSchedule2Inputs();

  /*
    Mortgage amount
  */
  let loanAmount = 0;

  if (purchasePrice > 0 && downPayment >= 0 && downPayment <= purchasePrice) {
    loanAmount = purchasePrice - downPayment;
  } else {
    loanAmount = cleanNumber(loanField.value);
  }

  /* ===================================================
     Mortgage Amount
     =================================================== */

  if (operator === "loan") {
    if (purchasePrice > 0 && downPayment >= 0 && downPayment <= purchasePrice) {
      loanField.value = formatOutput(loanAmount);
    } else {
      loanField.value = "";

      resultInput.value = "Invalid Num1/Num2";
    }

    paymentField.value = "";

    return;
  }

  /* ===================================================
     Monthly Payment
     =================================================== */

  if (operator === "payment") {
    if (purchasePrice > 0 && downPayment >= 0 && downPayment <= purchasePrice) {
      loanField.value = formatOutput(loanAmount);
    }

    if (loanAmount > 0) {
      if (interestRate >= 0 && loanTermYears > 0) {
        const monthlyPayment = calculateMonthlyPayment(
          loanAmount,
          interestRate,
          loanTermYears,
        );

        paymentField.value = formatOutput(monthlyPayment);

        /*
          Schedule 1
        */
        generateSchedule1(
          loanAmount,
          interestRate,
          loanTermYears,
          monthlyPayment,
        );

        /*
          Schedule 2
        */
        generateSchedule2(
          loanAmount,
          interestRate,
          loanTermYears,
          monthlyPayment,
          actualPayment,
          actualPaymentPeriod,
        );
      } else {
        paymentField.value = "";

        alert("Missing or invalid inputs for Monthly Payment");
      }
    } else {
      paymentField.value = "";

      alert(
        "Please provide either Purchase Price & Down Payment or a Mortgage Amount.",
      );
    }

    resultInput.value = "";

    return;
  }

  /* ===================================================
     Total Monthly Payment
     =================================================== */

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
      monthlyPayment = calculateMonthlyPayment(
        loanAmount,
        interestRate,
        loanTermYears,
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

    /*
      Schedule 1
    */
    generateSchedule1(loanAmount, interestRate, loanTermYears, monthlyPayment);

    /*
      Schedule 2
    */
    generateSchedule2(
      loanAmount,
      interestRate,
      loanTermYears,
      monthlyPayment,
      actualPayment,
      actualPaymentPeriod,
    );

    return;
  }

  resultInput.value = "Please select a valid operation";
}

/* =====================================================
   PAGE LOAD
   ===================================================== */

window.addEventListener("DOMContentLoaded", () => {
  const formatIds = [
    "num1",
    "num2",
    "num4",
    "num5",
    "num7",
    "num8",
    "num9",
    "actualPayment",
    "actualPaymentPeriod",
  ];

  formatIds.forEach((id) => {
    const el = document.getElementById(id);

    if (el) {
      el.addEventListener("blur", formatWithCommasAndDecimals);
    }
  });

  /*
      Existing Calculate button.
    */
  const calculateBtn = document.getElementById("calculateBtn");

  if (calculateBtn) {
    calculateBtn.addEventListener("click", calculate);
  }

  /*
      Schedule 2 Recalculate button.
    */
  const recalculateSchedule2Btn = document.getElementById(
    "recalculateSchedule2Btn",
  );

  if (recalculateSchedule2Btn) {
    recalculateSchedule2Btn.addEventListener("click", calculateSchedule2);
  }

  /*
      Reset button.
    */
  const resetBtn = document.getElementById("resetBtn");

  if (resetBtn) {
    resetBtn.addEventListener("click", clearAllFields);
  }
});
