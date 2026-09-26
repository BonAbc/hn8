/* =====================================================
   FORMAT OUTPUT
   ===================================================== */

function formatOutput(value) {
  if (isNaN(value)) return "";

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(value);
}

/* =====================================================
   CLEAN NUMBER
   ===================================================== */

function cleanNumber(value) {
  if (!value) return 0;

  const num = parseFloat(value.toString().replace(/,/g, ""));

  return isNaN(num) ? 0 : num;
}

/* =====================================================
   MORTGAGE FORMULA
   ===================================================== */

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

/* =====================================================
   FORMAT INPUT ON BLUR
   ===================================================== */

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
    if (balance <= 0.000001) {
      break;
    }

    const beginningBalance = balance;

    const interestPaid = monthlyRate === 0 ? 0 : beginningBalance * monthlyRate;

    let payment = monthlyPayment;

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

    // Add totals
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

    balance = endingBalance;
  }

  /* =================================================
     SCHEDULE 1 TOTAL ROW
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

  /* =================================================
     SUMMARY
     ================================================= */

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

  const message = document.getElementById("schedule2PaymentMessage");

  if (message) {
    message.textContent = "";
    message.style.display = "none";
  }

  const monthlyRate = annualInterestRate / 100 / 12;

  const maximumPeriods = Math.ceil(loanTermYears * 12);

  let balance = loanAmount;

  let totalPayment = 0;
  let totalInterest = 0;
  let updatedNumberOfPayments = 0;

  let paymentWasCapped = false;
  let originalActualPayment = 0;
  let cappedPayment = 0;

  for (let period = 1; period <= maximumPeriods; period++) {
    if (balance <= 0.000001) {
      break;
    }

    const beginningBalance = balance;

    const interestPaid = monthlyRate === 0 ? 0 : beginningBalance * monthlyRate;

    /*
      Normally use Constant Monthly Payment.
    */

    let payment = monthlyPayment;

    /*
      Actual Payment applies only
      to the selected period.
    */

    if (
      actualPayment > 0 &&
      actualPaymentPeriod > 0 &&
      period === actualPaymentPeriod
    ) {
      payment = actualPayment;
      originalActualPayment = actualPayment;
    }

    /*
      Amount actually required to pay off
      this period.
    */

    const amountDue = beginningBalance + interestPaid;

    /*
      If the requested payment is greater
      than the amount remaining, cap it.
    */

    if (payment > amountDue) {
      if (period === actualPaymentPeriod) {
        paymentWasCapped = true;
        cappedPayment = amountDue;
      }

      payment = amountDue;
    }

    const principalPaid = payment - interestPaid;

    let endingBalance = beginningBalance - principalPaid;

    if (endingBalance < 0.000001) {
      endingBalance = 0;
    }

    updatedNumberOfPayments = period;

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

    balance = endingBalance;
  }

  /* =================================================
     SHOW ACTUAL PAYMENT MESSAGE
     ================================================= */

  if (message && paymentWasCapped) {
    const excessAmount = originalActualPayment - cappedPayment;

    message.innerHTML = `
      <strong>Payment exceeds remaining balance.</strong>
      The requested payment of $${formatOutput(originalActualPayment)}
      was limited to $${formatOutput(cappedPayment)} because this is the
      amount required to pay off the remaining balance and interest in
      period ${actualPaymentPeriod}.
      <br>
      Excess amount: $${formatOutput(excessAmount)}.
      No further payments are required.
    `;

    message.style.display = "block";
  }

  /* =================================================
     SCHEDULE 2 TOTAL ROW
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

  /* =================================================
     SUMMARY
     ================================================= */

  const constant = document.getElementById("schedule2Constant");

  const additional = document.getElementById("schedule2Additional");

  const payment = document.getElementById("schedule2Payment");

  const plannedPeriods = document.getElementById("schedule2PlannedPeriods");

  const periods = document.getElementById("schedule2Periods");

  const paymentPeriod = document.getElementById("schedule2ActualPeriod");

  if (constant) {
    constant.textContent = formatOutput(monthlyPayment);
  }

  if (additional) {
    additional.textContent =
      actualPayment > 0 ? formatOutput(actualPayment) : formatOutput(0);
  }

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

  if (plannedPeriods) {
    plannedPeriods.textContent = maximumPeriods;
  }

  if (periods) {
    periods.textContent = updatedNumberOfPayments;
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
   CSV HELPER
   ===================================================== */

/*
  Makes a value safe for CSV.

  Example:
  123,456.789
  becomes:
  "123,456.789"
*/

function csvEscape(value) {
  const text = String(value ?? "");

  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n") ||
    text.includes("\r")
  ) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

/* =====================================================
   DOWNLOAD SCHEDULE 1 AS CSV
   ===================================================== */

function downloadSchedule1CSV() {
  const body = document.getElementById("amortizationBody1");

  /*
    Schedule must be calculated first.
  */

  if (!body || body.children.length === 0) {
    alert("Please calculate Schedule 1 first.");

    return;
  }

  /* =================================================
     GET MORTGAGE INFORMATION
     ================================================= */

  const { loanAmount, interestRate, loanTermYears } = getMortgageData();

  const monthlyPayment = cleanNumber(
    document.getElementById("schedule1Payment")?.textContent,
  );

  const purchasePrice = cleanNumber(document.getElementById("num1")?.value);

  const downPayment = cleanNumber(document.getElementById("num2")?.value);

  const date = document.getElementById("date")?.value || "";

  /* =================================================
     CREATE CSV
     ================================================= */

  const csvRows = [];

  /*
    Title
  */

  csvRows.push([csvEscape("Mortgage Amortization Schedule")]);

  csvRows.push([csvEscape("Schedule 1 - Constant Monthly Payment")]);

  csvRows.push([]);

  /*
    Mortgage information
  */

  csvRows.push(["Date", csvEscape(date)]);

  csvRows.push([
    "Purchase Price",
    purchasePrice > 0 ? csvEscape(formatOutput(purchasePrice)) : "",
  ]);

  csvRows.push([
    "Down Payment",
    downPayment >= 0 && purchasePrice > 0
      ? csvEscape(formatOutput(downPayment))
      : "",
  ]);

  csvRows.push(["Mortgage Amount", csvEscape(formatOutput(loanAmount))]);

  csvRows.push(["Interest Rate", csvEscape(`${formatOutput(interestRate)}%`)]);

  csvRows.push([
    "Mortgage Term",
    csvEscape(`${formatOutput(loanTermYears)} years`),
  ]);

  csvRows.push(["Monthly Payment", csvEscape(formatOutput(monthlyPayment))]);

  csvRows.push([
    "Number of Payments",
    csvEscape(document.getElementById("schedule1Periods")?.textContent || "0"),
  ]);

  csvRows.push([]);

  /*
    Schedule table header
  */

  csvRows.push([
    "Period",
    "Beginning Balance",
    "Total Payment",
    "Interest Paid",
    "Principal Paid",
    "Ending Balance",
  ]);

  /* =================================================
     GET TABLE ROWS
     ================================================= */

  const rows = body.querySelectorAll("tr");

  rows.forEach((row) => {
    const cells = row.querySelectorAll("td");

    if (cells.length !== 6) {
      return;
    }

    const rowData = Array.from(cells).map((cell) => {
      const text = cell.textContent.trim();

      /*
            Remove $ and commas from
            numeric values so the CSV
            opens cleanly in Excel.
          */

      if (text !== "TOTAL" && text !== "") {
        return text.replace(/[$,]/g, "");
      }

      return text;
    });

    csvRows.push(rowData.map(csvEscape));
  });

  /* =================================================
     FOOTER
     ================================================= */

  csvRows.push([]);

  csvRows.push([
    csvEscape("For informational purposes only. All numbers are estimates."),
  ]);

  /* =================================================
     CREATE CSV FILE
     ================================================= */

  const csvContent = csvRows.map((row) => row.join(",")).join("\r\n");

  /*
    UTF-8 BOM makes the CSV open
    correctly in Microsoft Excel.
  */

  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;

  link.download = "mortgage-amortization-schedule-1.csv";

  document.body.appendChild(link);

  link.click();

  document.body.removeChild(link);

  /*
    Release browser memory.
  */

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 100);
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
    "schedule2ActualPeriod",
    "schedule2PlannedPeriods",
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
      Schedule 1 CSV Download
    */

  const downloadSchedule1CsvBtn = document.getElementById(
    "downloadSchedule1CsvBtn",
  );

  if (downloadSchedule1CsvBtn) {
    downloadSchedule1CsvBtn.addEventListener("click", downloadSchedule1CSV);
  }

  /*
      Reset button.
    */

  const resetBtn = document.getElementById("resetBtn");

  if (resetBtn) {
    resetBtn.addEventListener("click", clearAllFields);
  }
});
