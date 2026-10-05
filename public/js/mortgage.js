/* =====================================================
   MORTGAGE CALCULATOR
   mortgage.js
   ===================================================== */

/* =====================================================
   FORMAT OUTPUT
   ===================================================== */

function formatOutput(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "";
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(number);
}

/* =====================================================
   CLEAN NUMBER
   ===================================================== */

function cleanNumber(value) {
  if (value === null || value === undefined) {
    return 0;
  }

  const text = String(value).replace(/,/g, "").trim();

  if (text === "") {
    return 0;
  }

  const number = parseFloat(text);

  return Number.isFinite(number) ? number : 0;
}

/* =====================================================
   MORTGAGE FORMULA
   ===================================================== */

function calculateMonthlyPayment(
  loanAmount,
  annualInterestRate,
  loanTermYears,
) {
  const principal = Number(loanAmount);
  const rate = Number(annualInterestRate);
  const years = Number(loanTermYears);

  if (!Number.isFinite(principal) || principal <= 0) {
    return 0;
  }

  if (!Number.isFinite(rate) || rate < 0) {
    return 0;
  }

  if (!Number.isFinite(years) || years <= 0) {
    return 0;
  }

  const monthlyRate = rate / 100 / 12;
  const totalPayments = Math.ceil(years * 12);

  if (totalPayments <= 0) {
    return 0;
  }

  if (monthlyRate === 0) {
    return principal / totalPayments;
  }

  const factor = Math.pow(1 + monthlyRate, totalPayments);

  return (principal * monthlyRate * factor) / (factor - 1);
}

/* =====================================================
   FORMAT INPUT ON BLUR
   ===================================================== */

function formatWithCommasAndDecimals(event) {
  const input = event.target;

  if (!input) {
    return;
  }

  const raw = input.value.replace(/,/g, "").trim();

  if (raw === "") {
    return;
  }

  const number = parseFloat(raw);

  if (Number.isFinite(number)) {
    input.value = formatOutput(number);
  }
}

/* =====================================================
   DATE HELPERS
   ===================================================== */

/*
  Parse YYYY-MM-DD as a local date.

  This avoids the UTC date-shift problem that can happen
  when using new Date("YYYY-MM-DD").
*/

function parseLocalDate(dateString) {
  if (!dateString) {
    return null;
  }

  const parts = String(dateString).split("-");

  if (parts.length !== 3) {
    return null;
  }

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

/* =====================================================
   DATE -> YYYY-MM-DD
   ===================================================== */

function formatDateForInput(date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/* =====================================================
   DATE -> MM/DD/YYYY
   ===================================================== */

function formatDisplayDate(date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
    return "";
  }

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  const year = date.getFullYear();

  return `${month}/${day}/${year}`;
}

/* =====================================================
   ADD CALENDAR MONTHS
   ===================================================== */

function addMonths(date, months) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
    return null;
  }

  const originalDate = new Date(date.getTime());

  const originalDay = originalDate.getDate();

  /*
    Determine whether original date is the final
    calendar day of its month.
  */

  const lastDayOfOriginalMonth = new Date(
    originalDate.getFullYear(),
    originalDate.getMonth() + 1,
    0,
  ).getDate();

  const isEndOfMonth = originalDay === lastDayOfOriginalMonth;

  /*
    Move to target month, starting at day 1.
  */

  const result = new Date(
    originalDate.getFullYear(),
    originalDate.getMonth() + months,
    1,
  );

  /*
    Last day of target month.
  */

  const lastDayOfTargetMonth = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0,
  ).getDate();

  /*
    Preserve month-end behavior.

    01/31 -> 02/28
    02/28 -> 03/31
    03/31 -> 04/30
  */

  if (isEndOfMonth) {
    result.setDate(lastDayOfTargetMonth);
  } else {
    result.setDate(Math.min(originalDay, lastDayOfTargetMonth));
  }

  return result;
}

/* =====================================================
   GET SCHEDULE 1 PAYMENT DATE
   ===================================================== */

function getSchedule1PaymentDate(period) {
  const startInput = document.getElementById("schedule1StartDate");

  if (!startInput || !startInput.value) {
    return null;
  }

  const startDate = parseLocalDate(startInput.value);

  if (!startDate) {
    return null;
  }

  const paymentPeriod = Math.floor(Number(period));

  if (!Number.isFinite(paymentPeriod) || paymentPeriod <= 0) {
    return null;
  }

  return addMonths(startDate, paymentPeriod - 1);
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
    Purchase Price + Down Payment take priority
    when valid.
  */

  if (purchasePrice > 0 && downPayment >= 0 && downPayment <= purchasePrice) {
    loanAmount = purchasePrice - downPayment;
  } else {
    loanAmount = cleanNumber(loanField?.value);
  }

  return {
    purchasePrice,
    downPayment,
    loanAmount,
    interestRate,
    loanTermYears,
  };
}

/* =====================================================
   CREATE SCHEDULE ROW
   ===================================================== */

function createScheduleRow({
  period,
  year,
  paymentDate,
  beginningBalance,
  payment,
  interestPaid,
  principalPaid,
  unpaidInterest = 0,
  endingBalance,
  actualPayment = false,
}) {
  const row = document.createElement("tr");

  if (actualPayment) {
    row.classList.add("schedule2-actual-period-highlight");
  }

  row.innerHTML = `
    <td>${period}</td>

    <td>${year}</td>

    <td>${paymentDate}</td>

    <td>${formatOutput(beginningBalance)}</td>

    <td>${formatOutput(payment)}</td>

    <td>${formatOutput(interestPaid)}</td>

    <td>${formatOutput(principalPaid)}</td>

    <td>${formatOutput(unpaidInterest)}</td>

    <td>${formatOutput(endingBalance)}</td>

    <td>0.000</td>

    <td>0.000</td>
  `;

  return row;
}

/* =====================================================
   CREATE ANNUAL SUMMARY ROW
   ===================================================== */

function createAnnualSummaryRow({
  year,
  totalPayment,
  totalInterest,
  totalPrincipal,
  totalUnpaidInterest = 0,
  endingBalance,
}) {
  const row = document.createElement("tr");

  row.classList.add("amortization-annual-summary-row");

  row.innerHTML = `
    <td colspan="3">
      <strong>${year} TOTAL</strong>
    </td>

    <td></td>

    <td>
      <strong>${formatOutput(totalPayment)}</strong>
    </td>

    <td>
      <strong>${formatOutput(totalInterest)}</strong>
    </td>

    <td>
      <strong>${formatOutput(totalPrincipal)}</strong>
    </td>

    <td>
      <strong>${formatOutput(totalUnpaidInterest)}</strong>
    </td>

    <td>
      <strong>${formatOutput(endingBalance)}</strong>
    </td>

    <td>
      <strong>0.000</strong>
    </td>

    <td>
      <strong>0.000</strong>
    </td>
  `;

  return row;
}

/* =====================================================
   CREATE OVERALL TOTAL ROW
   ===================================================== */

function createOverallTotalRow({
  totalPayment,
  totalInterest,
  totalPrincipal,
  totalUnpaidInterest = 0,
  endingBalance,
}) {
  const row = document.createElement("tr");

  row.classList.add("amortization-total-row");

  row.innerHTML = `
    <td colspan="3">
      <strong>TOTAL</strong>
    </td>

    <td></td>

    <td>
      <strong>${formatOutput(totalPayment)}</strong>
    </td>

    <td>
      <strong>${formatOutput(totalInterest)}</strong>
    </td>

    <td>
      <strong>${formatOutput(totalPrincipal)}</strong>
    </td>

    <td>
      <strong>${formatOutput(totalUnpaidInterest)}</strong>
    </td>

    <td>
      <strong>${formatOutput(endingBalance)}</strong>
    </td>

    <td>
      <strong>0.000</strong>
    </td>

    <td>
      <strong>0.000</strong>
    </td>
  `;

  return row;
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

  if (!body) {
    return;
  }

  body.innerHTML = "";

  const monthlyRate = annualInterestRate / 100 / 12;

  const totalPeriods = Math.ceil(loanTermYears * 12);

  let balance = loanAmount;

  let totalPayment = 0;
  let totalInterest = 0;
  let totalPrincipal = 0;

  let currentYear = null;

  let annualPayment = 0;
  let annualInterest = 0;
  let annualPrincipal = 0;

  const startInput = document.getElementById("schedule1StartDate");

  if (!startInput || !startInput.value) {
    alert("Please select a Payment Start Date before calculating.");

    return;
  }

  const startDate = parseLocalDate(startInput.value);

  if (!startDate) {
    alert("Invalid Payment Start Date.");

    return;
  }

  for (let period = 1; period <= totalPeriods; period++) {
    if (balance <= 0.000001) {
      break;
    }

    const beginningBalance = balance;

    const interestPaid = monthlyRate === 0 ? 0 : beginningBalance * monthlyRate;

    let payment = monthlyPayment;

    /*
      Final payment cannot exceed:
      beginning balance + interest.
    */

    const amountDue = beginningBalance + interestPaid;

    if (payment > amountDue) {
      payment = amountDue;
    }

    let principalPaid = payment - interestPaid;

    if (principalPaid < 0) {
      principalPaid = 0;
    }

    let endingBalance = beginningBalance - principalPaid;

    if (endingBalance < 0.000001) {
      endingBalance = 0;
    }

    const paymentDate = addMonths(startDate, period - 1);

    const year = paymentDate.getFullYear();

    /*
      Finish previous annual summary when year changes.
    */

    if (currentYear !== null && year !== currentYear) {
      body.appendChild(
        createAnnualSummaryRow({
          year: currentYear,
          totalPayment: annualPayment,
          totalInterest: annualInterest,
          totalPrincipal: annualPrincipal,
          totalUnpaidInterest: 0,
          endingBalance: beginningBalance,
        }),
      );

      annualPayment = 0;
      annualInterest = 0;
      annualPrincipal = 0;
    }

    currentYear = year;

    /*
      Add totals.
    */

    totalPayment += payment;
    totalInterest += interestPaid;
    totalPrincipal += principalPaid;

    annualPayment += payment;
    annualInterest += interestPaid;
    annualPrincipal += principalPaid;

    /*
      Add schedule row.
    */

    body.appendChild(
      createScheduleRow({
        period,
        year,
        paymentDate: formatDisplayDate(paymentDate),
        beginningBalance,
        payment,
        interestPaid,
        principalPaid,
        unpaidInterest: 0,
        endingBalance,
        actualPayment: false,
      }),
    );

    balance = endingBalance;

    /*
      Loan is paid off.
    */

    if (balance <= 0.000001) {
      body.appendChild(
        createAnnualSummaryRow({
          year: currentYear,
          totalPayment: annualPayment,
          totalInterest: annualInterest,
          totalPrincipal: annualPrincipal,
          totalUnpaidInterest: 0,
          endingBalance: balance,
        }),
      );

      break;
    }

    /*
      Final scheduled period.
    */

    if (period === totalPeriods) {
      body.appendChild(
        createAnnualSummaryRow({
          year: currentYear,
          totalPayment: annualPayment,
          totalInterest: annualInterest,
          totalPrincipal: annualPrincipal,
          totalUnpaidInterest: 0,
          endingBalance: balance,
        }),
      );
    }
  }

  /*
    Overall total.
  */

  body.appendChild(
    createOverallTotalRow({
      totalPayment,
      totalInterest,
      totalPrincipal,
      totalUnpaidInterest: 0,
      endingBalance: balance,
    }),
  );

  /*
    Summary.
  */

  const loan = document.getElementById("schedule1Loan");

  const payment = document.getElementById("schedule1Payment");

  const periods = document.getElementById("schedule1Periods");

  if (loan) {
    loan.textContent = formatOutput(loanAmount);
  }

  if (payment) {
    payment.textContent = formatOutput(monthlyPayment);
  }

  /*
    This represents the maximum scheduled number
    of payments, not necessarily the number actually
    generated if the mortgage pays off early.
  */
  let generatedPeriods = 0;

  const scheduleRows = body.querySelectorAll("tr");

  scheduleRows.forEach((row) => {
    const firstCell = row.querySelector("td");

    if (!firstCell) {
      return;
    }

    const value = parseInt(firstCell.textContent.trim(), 10);

    if (Number.isInteger(value)) {
      generatedPeriods = Math.max(generatedPeriods, value);
    }
  });

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
   GET SCHEDULE 2 ACTUAL / SCENARIO PAYMENTS
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

    const dateInput = row.querySelector(".schedule2-actual-payment-date");

    if (!paymentInput || !periodInput) {
      continue;
    }

    const paymentRaw = paymentInput.value.trim();

    const periodRaw = periodInput.value.trim();

    /*
      Empty row is allowed.
    */

    if (paymentRaw === "" && periodRaw === "") {
      row.classList.remove("schedule2-incomplete-row");

      continue;
    }

    const hasPayment = paymentRaw !== "";

    const hasPeriod = periodRaw !== "";

    /*
      Incomplete row.
    */

    if (hasPayment !== hasPeriod) {
      row.classList.add("schedule2-incomplete-row");

      if (validateIncomplete) {
        alert(
          "Incomplete Scenario Payment row. Enter both the Actual Monthly Payment and Payment Period, or remove the row.",
        );

        if (!hasPayment) {
          paymentInput.focus();
        } else {
          periodInput.focus();
        }

        return null;
      }

      continue;
    }

    const actualPayment = cleanNumber(paymentRaw);

    const actualPaymentPeriod = Math.floor(cleanNumber(periodRaw));

    let actualPaymentDate = "";

    if (dateInput) {
      actualPaymentDate = dateInput.value.trim();
    }

    /*
      Automatically use Schedule 1's payment date
      if the user doesn't provide a custom date.
    */

    if (actualPaymentPeriod > 0 && !actualPaymentDate) {
      const defaultDate = getSchedule1PaymentDate(actualPaymentPeriod);

      if (defaultDate) {
        actualPaymentDate = formatDateForInput(defaultDate);

        dateInput.value = actualPaymentDate;
      }
    }

    payments.push({
      actualPayment,
      actualPaymentPeriod,
      actualPaymentDate,
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

  /*
    IMPORTANT:
    This now matches the EJS exactly.

    EJS has:
    1. Actual Monthly Payment
    2. Actual Payment Period
    3. Actual Payment Date
    4. Action
  */

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
      <input
        type="date"
        class="schedule2-actual-payment-date"
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
    Payment formatting.
  */

  const paymentInput = row.querySelector(".schedule2-actual-payment");

  if (paymentInput) {
    paymentInput.addEventListener("blur", formatWithCommasAndDecimals);
  }

  /*
    Period input.
  */

  const periodInput = row.querySelector(".schedule2-actual-period");

  if (periodInput) {
    periodInput.addEventListener("blur", formatWithCommasAndDecimals);

    /*
      When the period changes, automatically
      populate the matching Schedule 1 date.
    */

    periodInput.addEventListener("change", () => {
      const period = Math.floor(cleanNumber(periodInput.value));

      const dateInput = row.querySelector(".schedule2-actual-payment-date");

      if (dateInput && period > 0) {
        const defaultDate = getSchedule1PaymentDate(period);

        if (defaultDate) {
          dateInput.value = formatDateForInput(defaultDate);
        }
      }
    });
  }

  /*
    Focus payment input.
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

  /*
    Event delegation means this works for
    dynamically-created rows too.
  */

  body.addEventListener("click", (event) => {
    const removeButton = event.target.closest(".schedule2-remove-btn");

    if (!removeButton) {
      return;
    }

    const row = removeButton.closest("tr");

    if (row) {
      row.remove();
    }

    /*
        Keep at least one blank row available.
      */

    if (body.children.length === 0) {
      addSchedule2PaymentRow();
    }

    clearSchedule2Highlights();
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
      alert("Each Scenario Payment must be greater than zero.");

      if (item.row) {
        item.row.classList.add("schedule2-incomplete-row");

        const input = item.row.querySelector(".schedule2-actual-payment");

        if (input) {
          input.focus();
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
      alert(`Scenario Payment Period must be between 1 and ${maximumPeriods}.`);

      if (item.row) {
        item.row.classList.add("schedule2-incomplete-row");

        const input = item.row.querySelector(".schedule2-actual-period");

        if (input) {
          input.focus();
        }
      }

      return false;
    }

    /*
      Duplicate periods are not allowed.
    */

    if (usedPeriods.has(item.actualPaymentPeriod)) {
      alert(
        `Period ${item.actualPaymentPeriod} has already been entered. Each scenario payment period can only be used once.`,
      );

      if (item.row) {
        item.row.classList.add("schedule2-incomplete-row");
      }

      return false;
    }

    usedPeriods.add(item.actualPaymentPeriod);

    /*
      Payment date.

      If blank, automatically use the
      Schedule 1 payment date.
    */

    if (!item.actualPaymentDate) {
      const defaultDate = getSchedule1PaymentDate(item.actualPaymentPeriod);

      if (defaultDate) {
        item.actualPaymentDate = formatDateForInput(defaultDate);

        const dateInput = item.row?.querySelector(
          ".schedule2-actual-payment-date",
        );

        if (dateInput) {
          dateInput.value = item.actualPaymentDate;
        }
      }
    }

    /*
      Date is required after fallback.
    */

    if (!item.actualPaymentDate) {
      alert(
        `Please enter an Actual Payment Date for Period ${item.actualPaymentPeriod}.`,
      );

      const dateInput = item.row?.querySelector(
        ".schedule2-actual-payment-date",
      );

      if (dateInput) {
        dateInput.focus();
      }

      return false;
    }

    /*
      Date must actually be valid.
    */

    if (!parseLocalDate(item.actualPaymentDate)) {
      alert(
        `Invalid Actual Payment Date for Period ${item.actualPaymentPeriod}.`,
      );

      const dateInput = item.row?.querySelector(
        ".schedule2-actual-payment-date",
      );

      if (dateInput) {
        dateInput.focus();
      }

      return false;
    }
  }

  return true;
}

/* =====================================================
   HIGHLIGHT ACTUAL / SCENARIO PAYMENT ROWS
   ===================================================== */

function highlightSchedule2ActualPayments(actualPayments) {
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
    Highlight amortization periods.
  */

  const body = document.getElementById("amortizationBody2");

  if (!body) {
    return;
  }

  const actualPeriods = new Set(
    actualPayments.map((item) => item.actualPaymentPeriod),
  );

  body.querySelectorAll("tr").forEach((row) => {
    const firstCell = row.querySelector("td");

    if (!firstCell) {
      return;
    }

    const period = parseInt(firstCell.textContent.trim(), 10);

    if (Number.isInteger(period) && actualPeriods.has(period)) {
      row.classList.add("schedule2-actual-period-highlight");
    }
  });
}

/* =====================================================
   SCHEDULE 2 HIGHLIGHT STYLES
   ===================================================== */

function initializeSchedule2HighlightStyles() {
  if (document.getElementById("schedule2HighlightStyles")) {
    return;
  }

  const style = document.createElement("style");

  style.id = "schedule2HighlightStyles";

  style.textContent = `
    .schedule2-actual-row-highlight td {
      background-color: #fff3cd !important;
      border-color: #ffe69c !important;
    }

    .schedule2-actual-period-highlight td {
      background-color: #dff3ff !important;
      border-top: 2px solid #0070b8 !important;
      border-bottom: 2px solid #0070b8 !important;
      font-weight: 600;
    }

    .schedule2-incomplete-row td {
      background-color: #f8d7da !important;
      border-color: #dc3545 !important;
    }

    .schedule2-incomplete-row input {
      border-color: #dc3545 !important;
      background-color: #fff5f5 !important;
    }

    .amortization-annual-summary-row td {
      background-color: #eef5ff !important;
      font-weight: 600;
      border-top: 2px solid #6c8ebf !important;
    }

    .amortization-total-row td {
      font-weight: 700;
      background-color: #e8e8e8 !important;
      border-top: 3px solid #444 !important;
    }
  `;

  document.head.appendChild(style);
}

/* =====================================================
   SCHEDULE 2
   WHAT-IF / SCENARIO AMORTIZATION
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
    message.innerHTML = "";
    message.style.display = "none";
  }

  const monthlyRate = annualInterestRate / 100 / 12;

  const maximumPeriods = Math.ceil(loanTermYears * 12);

  /*
    Sort scenario payments by period.
  */

  const sortedPayments = [...actualPayments].sort(
    (a, b) => a.actualPaymentPeriod - b.actualPaymentPeriod,
  );

  /*
    Create lookup map.
  */

  const scenarioPaymentMap = new Map();

  sortedPayments.forEach((item) => {
    scenarioPaymentMap.set(item.actualPaymentPeriod, item);
  });

  let balance = loanAmount;

  let totalPayment = 0;
  let totalInterest = 0;
  let totalPrincipal = 0;
  let totalUnpaidInterest = 0;

  let numberOfPayments = 0;

  /*
    Track requested scenario payments
    and payments actually applied.

    This lets the summary remain accurate
    if a final payment is capped.
  */

  let totalScenarioPaymentsApplied = 0;

  const cappedPayments = [];

  /*
    Annual totals.
  */

  let currentYear = null;

  let annualPayment = 0;
  let annualInterest = 0;
  let annualPrincipal = 0;
  let annualUnpaidInterest = 0;

  /* =================================================
     GENERATE SCENARIO
     ================================================= */

  for (let period = 1; period <= maximumPeriods; period++) {
    /*
      Stop after the mortgage is paid off.
    */

    if (balance <= 0.000001) {
      break;
    }

    const beginningBalance = balance;

    /*
      Current period interest.
    */

    const interestPaid = monthlyRate === 0 ? 0 : beginningBalance * monthlyRate;

    /*
      Default payment = constant payment.
    */

    let payment = monthlyPayment;

    let scenarioItem = null;

    /*
      Override constant payment if
      this period has a scenario payment.
    */

    if (scenarioPaymentMap.has(period)) {
      scenarioItem = scenarioPaymentMap.get(period);

      payment = scenarioItem.actualPayment;
    }

    /*
      Amount needed to completely pay
      the remaining mortgage this period.
    */

    const amountDue = beginningBalance + interestPaid;

    /*
      Cap overpayment.

      Example:

      Remaining amount = $3,000
      Scenario payment = $5,000

      Schedule uses $3,000.
      The $2,000 excess is not added
      to the mortgage balance.
    */

    const requestedPayment = payment;

    if (payment > amountDue) {
      payment = amountDue;

      if (scenarioItem) {
        cappedPayments.push({
          period,
          requestedPayment,
          appliedPayment: payment,
          excess: requestedPayment - payment,
        });
      }
    }

    /*
      Calculate principal.
    */

    let principalPaid = payment - interestPaid;

    /*
      If payment is less than interest,
      principal cannot become negative.

      The difference is shown as
      Unpaid Interest.
    */

    let unpaidInterest = 0;

    if (principalPaid < 0) {
      unpaidInterest = Math.abs(principalPaid);

      principalPaid = 0;
    }

    /*
      Calculate ending mortgage balance.
    */

    let endingBalance = beginningBalance - principalPaid;

    if (endingBalance < 0.000001) {
      endingBalance = 0;
    }

    /*
      Payment date.

      Scenario payment can have its own
      entered date.

      Otherwise use Schedule 1's date.
    */

    let paymentDate = getSchedule1PaymentDate(period);

    if (scenarioItem && scenarioItem.actualPaymentDate) {
      const customDate = parseLocalDate(scenarioItem.actualPaymentDate);

      if (customDate) {
        paymentDate = customDate;
      }
    }

    const year = paymentDate ? paymentDate.getFullYear() : "";

    const displayDate = paymentDate ? formatDisplayDate(paymentDate) : "";

    /*
      Finish previous annual summary.
    */

    if (currentYear !== null && year !== currentYear) {
      body.appendChild(
        createAnnualSummaryRow({
          year: currentYear,
          totalPayment: annualPayment,
          totalInterest: annualInterest,
          totalPrincipal: annualPrincipal,
          totalUnpaidInterest: annualUnpaidInterest,
          endingBalance: beginningBalance,
        }),
      );

      annualPayment = 0;
      annualInterest = 0;
      annualPrincipal = 0;
      annualUnpaidInterest = 0;
    }

    currentYear = year;

    /*
      Overall totals.
    */

    totalPayment += payment;
    totalInterest += interestPaid;
    totalPrincipal += principalPaid;
    totalUnpaidInterest += unpaidInterest;

    /*
      Scenario payment summary.

      Only count payments entered by the user,
      not normal constant payments.
    */

    if (scenarioItem) {
      totalScenarioPaymentsApplied += payment;
    }

    /*
      Annual totals.
    */

    annualPayment += payment;
    annualInterest += interestPaid;
    annualPrincipal += principalPaid;
    annualUnpaidInterest += unpaidInterest;

    numberOfPayments = period;

    /*
      Add row.
    */

    body.appendChild(
      createScheduleRow({
        period,
        year,
        paymentDate: displayDate,
        beginningBalance,
        payment,
        interestPaid,
        principalPaid,
        unpaidInterest,
        endingBalance,
        actualPayment: !!scenarioItem,
      }),
    );

    balance = endingBalance;

    /*
      Mortgage paid off.
    */

    if (balance <= 0.000001) {
      body.appendChild(
        createAnnualSummaryRow({
          year: currentYear,
          totalPayment: annualPayment,
          totalInterest: annualInterest,
          totalPrincipal: annualPrincipal,
          totalUnpaidInterest: annualUnpaidInterest,
          endingBalance: balance,
        }),
      );

      break;
    }

    /*
      Final scheduled period.
    */

    if (period === maximumPeriods) {
      body.appendChild(
        createAnnualSummaryRow({
          year: currentYear,
          totalPayment: annualPayment,
          totalInterest: annualInterest,
          totalPrincipal: annualPrincipal,
          totalUnpaidInterest: annualUnpaidInterest,
          endingBalance: balance,
        }),
      );
    }
  }

  /*
    Show overpayment information.
  */

  if (message && cappedPayments.length > 0) {
    let messageHTML = `
      <strong>
        One or more scenario payments exceeded the remaining mortgage balance.
      </strong>
      <br><br>
    `;

    cappedPayments.forEach((item) => {
      messageHTML += `
          Period ${item.period}:
          requested payment of
          $${formatOutput(item.requestedPayment)}
          was limited to
          $${formatOutput(item.appliedPayment)}.
          Excess amount:
          $${formatOutput(item.excess)}.
          <br>
        `;
    });

    message.innerHTML = messageHTML;

    message.style.display = "block";
  }

  /*
    Overall total row.
  */

  body.appendChild(
    createOverallTotalRow({
      totalPayment,
      totalInterest,
      totalPrincipal,
      totalUnpaidInterest,
      endingBalance: balance,
    }),
  );

  /* =================================================
     SCHEDULE 2 SUMMARY
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
    This is the sum of scenario payments
    actually applied to the mortgage.

    It does NOT include ordinary constant payments.
  */

  if (additional) {
    additional.textContent = formatOutput(totalScenarioPaymentsApplied);
  }

  /*
    Number of scenario overrides.
  */

  if (actualPaymentCount) {
    actualPaymentCount.textContent = actualPayments.length;
  }

  /*
    Number of payments until payoff.
  */

  if (periods) {
    periods.textContent = numberOfPayments;
  }
}

/* =====================================================
   CALCULATE ONLY SCHEDULE 2
   ===================================================== */

function calculateSchedule2() {
  const { loanAmount, interestRate, loanTermYears } = getMortgageData();

  /*
    num6 is the Constant Monthly Payment.
  */

  let monthlyPayment = cleanNumber(document.getElementById("num6")?.value);

  /*
    If num6 is unavailable, calculate it.
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
    Validate.
  */

  if (loanAmount <= 0 || loanTermYears <= 0 || monthlyPayment <= 0) {
    alert(
      "Please calculate the Mortgage Amount and Constant Monthly Payment first.",
    );

    return;
  }

  /*
    Clear previous highlighting.
  */

  clearSchedule2Highlights();

  /*
    Strictly read scenario payments.
  */

  const actualPayments = getSchedule2Payments(true);

  if (actualPayments === null) {
    return;
  }

  const maximumPeriods = Math.ceil(loanTermYears * 12);

  /*
    Validate.
  */

  if (!validateSchedule2Payments(actualPayments, maximumPeriods)) {
    return;
  }

  /*
    Generate.
  */

  generateSchedule2(
    loanAmount,
    interestRate,
    loanTermYears,
    monthlyPayment,
    actualPayments,
  );

  /*
    Highlight.
  */

  highlightSchedule2ActualPayments(actualPayments);
}

/* =====================================================
   CSV ESCAPE
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
   DOWNLOAD SCHEDULE 1 CSV
   ===================================================== */

function downloadSchedule1CSV() {
  const body = document.getElementById("amortizationBody1");

  if (!body || body.children.length === 0) {
    alert("Please calculate Schedule 1 first.");

    return;
  }

  const {
    loanAmount,
    interestRate,
    loanTermYears,
    purchasePrice,
    downPayment,
  } = getMortgageData();

  const monthlyPayment = cleanNumber(
    document.getElementById("schedule1Payment")?.textContent,
  );

  const date = document.getElementById("date")?.value || "";

  const startDate = document.getElementById("schedule1StartDate")?.value || "";

  const csvRows = [];

  csvRows.push([csvEscape("Mortgage Amortization Schedule")]);

  csvRows.push([csvEscape("Schedule 1 - Constant Monthly Payment")]);

  csvRows.push([]);

  csvRows.push(["Date", csvEscape(date)]);

  csvRows.push(["Payment Start Date", csvEscape(startDate)]);

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
    Table header.
  */

  csvRows.push([
    "Period",
    "Year",
    "Payment Date",
    "Beginning Balance",
    "Total Payment",
    "Interest Paid",
    "Principal Paid",
    "Unpaid Interest",
    "Ending Balance",
    "Late Fee",
    "Other Charges",
  ]);

  /*
    Table rows.
  */

  const rows = body.querySelectorAll("tr");

  rows.forEach((row) => {
    const cells = row.querySelectorAll("td");

    if (cells.length === 11) {
      const rowData = Array.from(cells).map((cell) => {
        const text = cell.textContent.trim();

        if (text !== "TOTAL" && text !== "") {
          return text.replace(/[$,]/g, "");
        }

        return text;
      });

      csvRows.push(rowData.map(csvEscape));

      return;
    }

    const text = row.textContent.trim();

    if (text) {
      csvRows.push([csvEscape(text)]);
    }
  });

  /*
    Footer.
  */

  csvRows.push([]);

  csvRows.push([
    csvEscape("For informational purposes only. All numbers are estimates."),
  ]);

  /*
    Create file.
  */

  const csvContent = csvRows.map((row) => row.join(",")).join("\r\n");

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
    const element = document.getElementById(id);

    if (element) {
      element.value = "";
    }
  });

  /*
    Reset operation.
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
    Reset scenario payment rows.
  */

  const inputBody = document.getElementById("schedule2PaymentRows");

  if (inputBody) {
    inputBody.innerHTML = "";

    addSchedule2PaymentRow();
  }

  /*
    Clear highlighting.
  */

  clearSchedule2Highlights();

  /*
    Hide messages.
  */

  const message = document.getElementById("schedule2PaymentMessage");

  if (message) {
    message.innerHTML = "";

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
    const element = document.getElementById(id);

    if (element) {
      element.textContent = "0";
    }
  });
}

/* =====================================================
   MAIN CALCULATION
   ===================================================== */

function calculate() {
  const operator = document.getElementById("operator")?.value;

  const resultInput = document.getElementById("result");

  if (resultInput) {
    resultInput.value = "";
  }

  const {
    purchasePrice,
    downPayment,
    loanAmount,
    interestRate,
    loanTermYears,
  } = getMortgageData();

  const tax = cleanNumber(document.getElementById("num7")?.value);

  const insurance = cleanNumber(document.getElementById("num8")?.value);

  const others = cleanNumber(document.getElementById("num9")?.value);

  const loanField = document.getElementById("num3");

  const paymentField = document.getElementById("num6");

  /* ===================================================
     MORTGAGE AMOUNT
     =================================================== */

  if (operator === "loan") {
    if (purchasePrice > 0 && downPayment >= 0 && downPayment <= purchasePrice) {
      if (loanField) {
        loanField.value = formatOutput(loanAmount);
      }
    } else {
      if (loanField) {
        loanField.value = "";
      }

      if (resultInput) {
        resultInput.value = "Invalid Num1/Num2";
      }
    }

    if (paymentField) {
      paymentField.value = "";
    }

    return;
  }

  /* ===================================================
     MONTHLY PAYMENT
     =================================================== */

  if (operator === "payment") {
    if (purchasePrice > 0 && downPayment >= 0 && downPayment <= purchasePrice) {
      if (loanField) {
        loanField.value = formatOutput(loanAmount);
      }
    }

    if (loanAmount > 0) {
      if (interestRate >= 0 && loanTermYears > 0) {
        const monthlyPayment = calculateMonthlyPayment(
          loanAmount,
          interestRate,
          loanTermYears,
        );

        if (paymentField) {
          paymentField.value = formatOutput(monthlyPayment);
        }

        /*
          Schedule 1 baseline.
        */

        generateSchedule1(
          loanAmount,
          interestRate,
          loanTermYears,
          monthlyPayment,
        );

        /*
          Schedule 2.

          Normal Calculate accepts
          currently complete rows and
          ignores incomplete rows.
        */

        const actualPayments = getSchedule2Payments(false);

        if (actualPayments !== null) {
          const maximumPeriods = Math.ceil(loanTermYears * 12);

          if (validateSchedule2Payments(actualPayments, maximumPeriods)) {
            generateSchedule2(
              loanAmount,
              interestRate,
              loanTermYears,
              monthlyPayment,
              actualPayments,
            );

            highlightSchedule2ActualPayments(actualPayments);
          }
        }
      } else {
        if (paymentField) {
          paymentField.value = "";
        }

        alert("Missing or invalid inputs for Monthly Payment");
      }
    } else {
      if (paymentField) {
        paymentField.value = "";
      }

      alert(
        "Please provide either Purchase Price & Down Payment or a Mortgage Amount.",
      );
    }

    if (resultInput) {
      resultInput.value = "";
    }

    return;
  }

  /* ===================================================
     TOTAL MONTHLY PAYMENT
     =================================================== */

  if (operator === "total") {
    if (loanAmount > 0) {
      if (loanField) {
        loanField.value = formatOutput(loanAmount);
      }
    } else {
      if (loanField) {
        loanField.value = "";
      }

      alert("Invalid Purchase Price or Down Payment");

      if (paymentField) {
        paymentField.value = "";
      }

      if (resultInput) {
        resultInput.value = "";
      }

      return;
    }

    let monthlyPayment = 0;

    if (interestRate >= 0 && loanTermYears > 0) {
      monthlyPayment = calculateMonthlyPayment(
        loanAmount,
        interestRate,
        loanTermYears,
      );

      if (paymentField) {
        paymentField.value = formatOutput(monthlyPayment);
      }
    } else {
      if (paymentField) {
        paymentField.value = "";
      }

      alert("Missing or invalid inputs for Monthly Payment");

      if (resultInput) {
        resultInput.value = "";
      }

      return;
    }

    /*
      Total monthly cost.
    */

    const totalMonthlyCost = monthlyPayment + tax + insurance + others;

    if (resultInput) {
      if (totalMonthlyCost > 0) {
        resultInput.value = formatOutput(totalMonthlyCost);
      } else {
        resultInput.value = "";
      }
    }

    /*
      Schedule 1.
    */

    generateSchedule1(loanAmount, interestRate, loanTermYears, monthlyPayment);

    /*
      Schedule 2.
    */

    const actualPayments = getSchedule2Payments(false);

    if (actualPayments !== null) {
      const maximumPeriods = Math.ceil(loanTermYears * 12);

      if (validateSchedule2Payments(actualPayments, maximumPeriods)) {
        generateSchedule2(
          loanAmount,
          interestRate,
          loanTermYears,
          monthlyPayment,
          actualPayments,
        );

        highlightSchedule2ActualPayments(actualPayments);
      }
    }

    return;
  }

  if (resultInput) {
    resultInput.value = "Please select a valid operation";
  }
}

/* =====================================================
   INITIALIZE SCHEDULE 2
   ===================================================== */

function initializeSchedule2() {
  const body = document.getElementById("schedule2PaymentRows");

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
    Recalculate Schedule 2.
  */

  const recalculateButton = document.getElementById("recalculateSchedule2Btn");

  if (recalculateButton) {
    recalculateButton.addEventListener("click", calculateSchedule2);
  }

  /*
    Highlight styles.
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
    const element = document.getElementById(id);

    if (element) {
      element.addEventListener("blur", formatWithCommasAndDecimals);
    }
  });

  /*
      Main Calculate button.
    */

  const calculateButton = document.getElementById("calculateBtn");

  if (calculateButton) {
    calculateButton.addEventListener("click", calculate);
  }

  /*
      Schedule 2.
    */

  initializeSchedule2();

  /*
      Schedule 1 CSV.
    */

  const csvButton = document.getElementById("downloadSchedule1CsvBtn");

  if (csvButton) {
    csvButton.addEventListener("click", downloadSchedule1CSV);
  }

  /*
      Reset.
    */

  const resetButton = document.getElementById("resetBtn");

  if (resetButton) {
    resetButton.addEventListener("click", clearAllFields);
  }
});
