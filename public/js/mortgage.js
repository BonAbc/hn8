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

  if (totalPayments <= 0) {
    return 0;
  }

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
   SCHEDULE 1
   CONSTANT MONTHLY PAYMENT
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

    totalPayment += payment;

    totalInterest += interestPaid;

    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${period}</td>

      <td>
        ${formatOutput(beginningBalance)}
      </td>

      <td>
        ${formatOutput(payment)}
      </td>

      <td>
        ${formatOutput(interestPaid)}
      </td>

      <td>
        ${formatOutput(principalPaid)}
      </td>

      <td>
        ${formatOutput(endingBalance)}
      </td>
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
    <td>
      <strong>TOTAL</strong>
    </td>

    <td></td>

    <td>
      <strong>
        ${formatOutput(totalPayment)}
      </strong>
    </td>

    <td>
      <strong>
        ${formatOutput(totalInterest)}
      </strong>
    </td>

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
   CLEAR SCHEDULE 2 HIGHLIGHTS
   ===================================================== */

function clearSchedule2Highlights() {
  const inputBody = document.getElementById("schedule2PaymentRows");

  if (inputBody) {
    inputBody.querySelectorAll("tr").forEach((row) => {
      row.classList.remove(
        "schedule2-actual-row-highlight",
        "schedule2-incomplete-row",
      );
    });
  }

  const scheduleBody = document.getElementById("amortizationBody2");

  if (scheduleBody) {
    scheduleBody.querySelectorAll("tr").forEach((row) => {
      row.classList.remove("schedule2-actual-period-highlight");
    });
  }
}

/* =====================================================
   GET ALL SCHEDULE 2 ACTUAL PAYMENTS
   ===================================================== */

function getSchedule2Payments(validateIncomplete = false) {
  const body = document.getElementById("schedule2PaymentRows");

  if (!body) {
    return [];
  }

  const rows = body.querySelectorAll("tr");

  const payments = [];

  for (const row of rows) {
    const paymentInput = row.querySelector(".schedule2-actual-payment");

    const periodInput = row.querySelector(".schedule2-actual-period");

    if (!paymentInput || !periodInput) {
      continue;
    }

    const paymentRaw = paymentInput.value.trim();

    const periodRaw = periodInput.value.trim();

    const actualPayment = cleanNumber(paymentRaw);

    const actualPaymentPeriod = Math.floor(cleanNumber(periodRaw));

    const hasPayment = paymentRaw !== "";

    const hasPeriod = periodRaw !== "";

    /*
      Completely empty row:
      allowed.
    */

    if (!hasPayment && !hasPeriod) {
      continue;
    }

    /*
      Incomplete row:
      one field exists but the other is missing.
    */

    if (hasPayment !== hasPeriod) {
      row.classList.add("schedule2-incomplete-row");

      if (validateIncomplete) {
        alert(
          "Incomplete Actual Payment row detected. Please enter both the Actual Monthly Payment and Payment Period, or remove the row.",
        );

        /*
          Focus whichever field is missing.
        */

        if (!hasPayment) {
          paymentInput.focus();
        } else {
          periodInput.focus();
        }

        return null;
      }

      /*
        During normal Mortgage Calculate,
        do not use incomplete rows.
      */

      continue;
    }

    /*
      Both fields exist.
    */

    payments.push({
      actualPayment,
      actualPaymentPeriod,
      row,
    });
  }

  return payments;
}

/* =====================================================
   ADD SCHEDULE 2 PAYMENT ROW
   ===================================================== */

function addSchedule2PaymentRow() {
  const body = document.getElementById("schedule2PaymentRows");

  if (!body) {
    return;
  }

  const row = document.createElement("tr");

  row.classList.add("schedule2-payment-row");

  row.innerHTML = `
    <td>
      <input
        type="text"
        class="schedule2-actual-payment"
        placeholder="0.000"
      />
    </td>

    <td>
      <input
        type="text"
        class="schedule2-actual-period"
        placeholder="Period"
      />
    </td>

    <td>
      <button
        type="button"
        class="schedule2-remove-btn"
      >
        Remove
      </button>
    </td>
  `;

  body.appendChild(row);

  /*
    Format payment on blur.
  */

  const paymentInput = row.querySelector(".schedule2-actual-payment");

  if (paymentInput) {
    paymentInput.addEventListener("blur", formatWithCommasAndDecimals);
  }

  /*
    Format period on blur.
  */

  const periodInput = row.querySelector(".schedule2-actual-period");

  if (periodInput) {
    periodInput.addEventListener("blur", formatWithCommasAndDecimals);
  }

  /*
    Focus new payment field.
  */

  if (paymentInput) {
    paymentInput.focus();
  }
}

/* =====================================================
   REMOVE SCHEDULE 2 PAYMENT ROW
   ===================================================== */

function setupSchedule2RowEvents() {
  const body = document.getElementById("schedule2PaymentRows");

  if (!body) {
    return;
  }

  body.addEventListener("click", (event) => {
    const removeButton = event.target.closest(".schedule2-remove-btn");

    if (!removeButton) {
      return;
    }

    const row = removeButton.closest("tr");

    if (row) {
      row.remove();
    }
  });
}

/* =====================================================
   VALIDATE SCHEDULE 2 PAYMENTS
   ===================================================== */

function validateSchedule2Payments(payments, maximumPeriods) {
  const usedPeriods = new Set();

  for (const item of payments) {
    /*
      Payment must be greater than zero.
    */

    if (item.actualPayment <= 0) {
      alert("Each Actual Monthly Payment must be greater than zero.");

      if (item.row) {
        item.row.classList.add("schedule2-incomplete-row");

        const paymentInput = item.row.querySelector(
          ".schedule2-actual-payment",
        );

        if (paymentInput) {
          paymentInput.focus();
        }
      }

      return false;
    }

    /*
      Period must be valid.
    */

    if (
      item.actualPaymentPeriod <= 0 ||
      item.actualPaymentPeriod > maximumPeriods
    ) {
      alert(`Actual Payment Period must be between 1 and ${maximumPeriods}.`);

      if (item.row) {
        item.row.classList.add("schedule2-incomplete-row");

        const periodInput = item.row.querySelector(".schedule2-actual-period");

        if (periodInput) {
          periodInput.focus();
        }
      }

      return false;
    }

    /*
      Duplicate periods are not allowed.
    */

    if (usedPeriods.has(item.actualPaymentPeriod)) {
      alert(
        `Period ${item.actualPaymentPeriod} has already been entered. Each payment period can only be used once.`,
      );

      if (item.row) {
        item.row.classList.add("schedule2-incomplete-row");
      }

      return false;
    }

    usedPeriods.add(item.actualPaymentPeriod);
  }

  return true;
}

/* =====================================================
   HIGHLIGHT ACTUAL PAYMENT ROWS
   ===================================================== */

function highlightSchedule2ActualPayments(actualPayments) {
  /*
    Clear old highlights first.
  */

  clearSchedule2Highlights();

  /*
    Highlight input rows.
  */

  actualPayments.forEach((item) => {
    if (item.row) {
      item.row.classList.add("schedule2-actual-row-highlight");
    }
  });

  /*
    Highlight corresponding generated
    amortization schedule rows.
  */

  const body = document.getElementById("amortizationBody2");

  if (!body) {
    return;
  }

  const actualPeriods = new Set(
    actualPayments.map((item) => item.actualPaymentPeriod),
  );

  const scheduleRows = body.querySelectorAll("tr");

  scheduleRows.forEach((row) => {
    const firstCell = row.querySelector("td");

    if (!firstCell) {
      return;
    }

    const period = Math.floor(cleanNumber(firstCell.textContent));

    if (actualPeriods.has(period)) {
      row.classList.add("schedule2-actual-period-highlight");
    }
  });
}

/* =====================================================
   ADD SCHEDULE 2 HIGHLIGHT STYLES
   ===================================================== */

function initializeSchedule2HighlightStyles() {
  /*
    Prevent duplicate style elements.
  */

  if (document.getElementById("schedule2HighlightStyles")) {
    return;
  }

  const style = document.createElement("style");

  style.id = "schedule2HighlightStyles";

  style.textContent = `
    /* Actual payment input row */

    .schedule2-actual-row-highlight td {
      background-color: #fff3cd !important;
      border-color: #ffe69c !important;
    }

    /* Generated Schedule 2 row */

    .schedule2-actual-period-highlight td {
      background-color: #dff3ff !important;
      border-top: 2px solid #0070b8 !important;
      border-bottom: 2px solid #0070b8 !important;
      font-weight: 600;
    }

    /* Incomplete input row */

    .schedule2-incomplete-row td {
      background-color: #f8d7da !important;
      border-color: #dc3545 !important;
    }

    .schedule2-incomplete-row input {
      border-color: #dc3545 !important;
      background-color: #fff5f5 !important;
    }
  `;

  document.head.appendChild(style);
}

/* =====================================================
   SCHEDULE 2
   MULTIPLE ACTUAL PAYMENTS
   ===================================================== */

function generateSchedule2(
  loanAmount,
  annualInterestRate,
  loanTermYears,
  monthlyPayment,
  actualPayments = [],
) {
  const body = document.getElementById("amortizationBody2");

  if (!body) {
    return;
  }

  body.innerHTML = "";

  const message = document.getElementById("schedule2PaymentMessage");

  if (message) {
    message.textContent = "";
    message.style.display = "none";
  }

  const monthlyRate = annualInterestRate / 100 / 12;

  const maximumPeriods = Math.ceil(loanTermYears * 12);

  /*
    Sort payments by period.
  */

  const sortedPayments = [...actualPayments].sort(
    (a, b) => a.actualPaymentPeriod - b.actualPaymentPeriod,
  );

  /*
    Create payment lookup map.
  */

  const actualPaymentMap = new Map();

  sortedPayments.forEach((item) => {
    actualPaymentMap.set(item.actualPaymentPeriod, item.actualPayment);
  });

  let balance = loanAmount;

  let totalPayment = 0;

  let totalInterest = 0;

  let updatedNumberOfPayments = 0;

  const cappedPayments = [];

  /* =================================================
     GENERATE AMORTIZATION
     ================================================= */

  for (let period = 1; period <= maximumPeriods; period++) {
    if (balance <= 0.000001) {
      break;
    }

    const beginningBalance = balance;

    const interestPaid = monthlyRate === 0 ? 0 : beginningBalance * monthlyRate;

    /*
      Default to Constant Monthly Payment.
    */

    let payment = monthlyPayment;

    /*
      Use Actual Monthly Payment
      when this period has one.
    */

    if (actualPaymentMap.has(period)) {
      payment = actualPaymentMap.get(period);
    }

    /*
      Amount required to pay off
      remaining balance.
    */

    const amountDue = beginningBalance + interestPaid;

    /*
      Prevent overpayment.
    */

    if (payment > amountDue) {
      if (actualPaymentMap.has(period)) {
        cappedPayments.push({
          period: period,
          requestedPayment: payment,
          cappedPayment: amountDue,
        });
      }

      payment = amountDue;
    }

    /*
      Calculate principal.
    */

    const principalPaid = payment - interestPaid;

    let endingBalance = beginningBalance - principalPaid;

    if (endingBalance < 0.000001) {
      endingBalance = 0;
    }

    /*
      Totals.
    */

    totalPayment += payment;

    totalInterest += interestPaid;

    updatedNumberOfPayments = period;

    /*
      Create schedule row.
    */

    const row = document.createElement("tr");

    /*
      Mark rows that use an Actual Payment.
    */

    if (actualPaymentMap.has(period)) {
      row.classList.add("schedule2-actual-period-highlight");
    }

    row.innerHTML = `
      <td>${period}</td>

      <td>
        ${formatOutput(beginningBalance)}
      </td>

      <td>
        ${formatOutput(payment)}
      </td>

      <td>
        ${formatOutput(interestPaid)}
      </td>

      <td>
        ${formatOutput(principalPaid)}
      </td>

      <td>
        ${formatOutput(endingBalance)}
      </td>
    `;

    body.appendChild(row);

    balance = endingBalance;
  }

  /* =================================================
     SHOW CAPPED PAYMENT MESSAGE
     ================================================= */

  if (message && cappedPayments.length > 0) {
    let messageHTML = `
      <strong>
        One or more Actual Payments exceeded the remaining balance.
      </strong>
      <br><br>
    `;

    cappedPayments.forEach((item) => {
      const excess = item.requestedPayment - item.cappedPayment;

      messageHTML += `
        Period ${item.period}:
        requested payment of
        $${formatOutput(item.requestedPayment)}
        was limited to
        $${formatOutput(item.cappedPayment)}.
        Excess amount:
        $${formatOutput(excess)}.
        <br>
      `;
    });

    message.innerHTML = messageHTML;

    message.style.display = "block";
  }

  /* =================================================
     TOTAL ROW
     ================================================= */

  const totalRow = document.createElement("tr");

  totalRow.classList.add("amortization-total-row");

  totalRow.innerHTML = `
    <td>
      <strong>TOTAL</strong>
    </td>

    <td></td>

    <td>
      <strong>
        ${formatOutput(totalPayment)}
      </strong>
    </td>

    <td>
      <strong>
        ${formatOutput(totalInterest)}
      </strong>
    </td>

    <td></td>

    <td></td>
  `;

  body.appendChild(totalRow);

  /* =================================================
     SUMMARY
     ================================================= */

  const constant = document.getElementById("schedule2Constant");

  const additional = document.getElementById("schedule2Additional");

  const actualPaymentCount = document.getElementById(
    "schedule2ActualPaymentCount",
  );

  const periods = document.getElementById("schedule2Periods");

  if (constant) {
    constant.textContent = formatOutput(monthlyPayment);
  }

  /*
    Total of all entered actual payments.
  */

  if (additional) {
    const totalActualPayments = actualPayments.reduce(
      (sum, item) => sum + item.actualPayment,
      0,
    );

    additional.textContent = formatOutput(totalActualPayments);
  }

  /*
    Number of actual payment rows.
  */

  if (actualPaymentCount) {
    actualPaymentCount.textContent = actualPayments.length;
  }

  /*
    Number of payments actually generated.
  */

  if (periods) {
    periods.textContent = updatedNumberOfPayments;
  }
}

/* =====================================================
   CALCULATE ONLY SCHEDULE 2
   ===================================================== */

function calculateSchedule2() {
  const { loanAmount, interestRate, loanTermYears } = getMortgageData();

  /*
    Get Constant Monthly Payment
    from num6.
  */

  let monthlyPayment = cleanNumber(document.getElementById("num6")?.value);

  /*
    If num6 is empty,
    calculate the payment.
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

  /*
    Validate mortgage.
  */

  if (loanAmount <= 0 || loanTermYears <= 0 || monthlyPayment <= 0) {
    alert(
      "Please calculate the Mortgage Amount and Constant Monthly Payment first.",
    );

    return;
  }

  /*
    Clear old highlights before validation.
  */

  clearSchedule2Highlights();

  /*
    Get all actual payments.

    TRUE means incomplete rows
    must show an error.
  */

  const actualPayments = getSchedule2Payments(true);

  /*
    Stop if an incomplete row was found.
  */

  if (actualPayments === null) {
    return;
  }

  const maximumPeriods = Math.ceil(loanTermYears * 12);

  /*
    Validate actual payments.
  */

  if (!validateSchedule2Payments(actualPayments, maximumPeriods)) {
    return;
  }

  /*
    Generate Schedule 2.
  */

  generateSchedule2(
    loanAmount,
    interestRate,
    loanTermYears,
    monthlyPayment,
    actualPayments,
  );

  /*
    Highlight all actual payment periods
    and their corresponding input rows.
  */

  highlightSchedule2ActualPayments(actualPayments);
}

/* =====================================================
   CSV HELPER
   ===================================================== */

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
    Title.
  */

  csvRows.push([csvEscape("Mortgage Amortization Schedule")]);

  csvRows.push([csvEscape("Schedule 1 - Constant Monthly Payment")]);

  csvRows.push([]);

  /*
    Mortgage information.
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
    Schedule table header.
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
          Remove $ and commas
          from numeric values.
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
    UTF-8 BOM for Excel.
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
   CLEAR ALL FIELDS
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
  ];

  ids.forEach((id) => {
    const el = document.getElementById(id);

    if (el) {
      el.value = "";
    }
  });

  /*
    Reset operator.
  */

  const operator = document.getElementById("operator");

  if (operator) {
    operator.selectedIndex = 0;
  }

  /*
    Clear Schedule 1.
  */

  const body1 = document.getElementById("amortizationBody1");

  if (body1) {
    body1.innerHTML = "";
  }

  /*
    Clear Schedule 2.
  */

  const body2 = document.getElementById("amortizationBody2");

  if (body2) {
    body2.innerHTML = "";
  }

  /*
    Clear Schedule 2 payment input rows.
  */

  const schedule2InputBody = document.getElementById("schedule2PaymentRows");

  if (schedule2InputBody) {
    schedule2InputBody.innerHTML = "";

    /*
      Create one fresh empty row.
    */

    addSchedule2PaymentRow();
  }

  /*
    Clear highlights.
  */

  clearSchedule2Highlights();

  /*
    Hide Schedule 2 message.
  */

  const message = document.getElementById("schedule2PaymentMessage");

  if (message) {
    message.textContent = "";

    message.style.display = "none";
  }

  /*
    Reset summaries.
  */

  const summaryIds = [
    "schedule1Loan",
    "schedule1Payment",
    "schedule1Periods",

    "schedule2Constant",
    "schedule2Additional",
    "schedule2ActualPaymentCount",
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
    Mortgage amount.
  */

  let loanAmount = 0;

  if (purchasePrice > 0 && downPayment >= 0 && downPayment <= purchasePrice) {
    loanAmount = purchasePrice - downPayment;
  } else {
    loanAmount = cleanNumber(loanField.value);
  }

  /* ===================================================
     MORTGAGE AMOUNT
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
     MONTHLY PAYMENT
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
          Schedule 1.
        */

        generateSchedule1(
          loanAmount,
          interestRate,
          loanTermYears,
          monthlyPayment,
        );

        /*
          Schedule 2.

          Normal Calculate ignores
          incomplete rows. The dedicated
          Recalculate button performs
          strict validation.
        */

        const actualPayments = getSchedule2Payments(false);

        if (actualPayments !== null) {
          generateSchedule2(
            loanAmount,
            interestRate,
            loanTermYears,
            monthlyPayment,
            actualPayments,
          );

          highlightSchedule2ActualPayments(actualPayments);
        }
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
     TOTAL MONTHLY PAYMENT
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

    /*
      Total monthly cost.
    */

    const totalMonthlyCost = monthlyPayment + tax + insurance + others;

    if (totalMonthlyCost > 0) {
      resultInput.value = formatOutput(totalMonthlyCost);
    } else {
      resultInput.value = "";
    }

    /*
      Schedule 1.
    */

    generateSchedule1(loanAmount, interestRate, loanTermYears, monthlyPayment);

    /*
      Schedule 2.

      Normal Calculate ignores incomplete
      rows. Recalculate performs strict
      validation.
    */

    const actualPayments = getSchedule2Payments(false);

    if (actualPayments !== null) {
      generateSchedule2(
        loanAmount,
        interestRate,
        loanTermYears,
        monthlyPayment,
        actualPayments,
      );

      highlightSchedule2ActualPayments(actualPayments);
    }

    return;
  }

  resultInput.value = "Please select a valid operation";
}

/* =====================================================
   INITIALIZE SCHEDULE 2
   ===================================================== */

function initializeSchedule2() {
  const body = document.getElementById("schedule2PaymentRows");

  /*
    Create first empty row.
  */

  if (body && body.children.length === 0) {
    addSchedule2PaymentRow();
  }

  /*
    Add button.
  */

  const addButton = document.getElementById("addSchedule2PaymentBtn");

  if (addButton) {
    addButton.addEventListener("click", addSchedule2PaymentRow);
  }

  /*
    Remove buttons.
  */

  setupSchedule2RowEvents();

  /*
    Recalculate button.
  */

  const recalculateButton = document.getElementById("recalculateSchedule2Btn");

  if (recalculateButton) {
    recalculateButton.addEventListener("click", calculateSchedule2);
  }

  /*
    Schedule 2 highlight styles.
  */

  initializeSchedule2HighlightStyles();
}

/* =====================================================
   PAGE LOAD
   ===================================================== */

window.addEventListener("DOMContentLoaded", () => {
  /*
      Main input formatting.
    */

  const formatIds = ["num1", "num2", "num4", "num5", "num7", "num8", "num9"];

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
      Initialize Schedule 2.
    */

  initializeSchedule2();

  /*
      Schedule 1 CSV Download.
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
