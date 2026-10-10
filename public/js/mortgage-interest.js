(() => {
  "use strict";

  const form = document.getElementById("mortgageCalculatorForm");
  if (!form) return;

  const financeInput = document.getElementById("financeAmount");
  const paymentsInput = document.getElementById("numberOfPayments");
  const constantPaymentInput = document.getElementById("constantPayment");
  const totalPaymentInput = document.getElementById("totalPayment");
  const startDateInput = document.getElementById("paymentStartDate");
  const endDateInput = document.getElementById("paymentEndDate");
  const rateInput = document.getElementById("annualInterestRate");
  const tableBody = document.getElementById("amortizationBody");
  const tableFooter = document.getElementById("amortizationFooter");
  const message = document.getElementById("mortgageCalculatorMessage");

  const requiredElements = [
    financeInput,
    paymentsInput,
    constantPaymentInput,
    totalPaymentInput,
    startDateInput,
    endDateInput,
    rateInput,
    tableBody,
    tableFooter,
    message,
  ];

  if (requiredElements.some((element) => !element)) {
    console.error(
      "Mortgage calculator: one or more required HTML element IDs are missing.",
    );
    return;
  }

  // The end date is calculated automatically.
  endDateInput.readOnly = true;
  endDateInput.required = false;
  endDateInput.removeAttribute("data-local-today");

  function roundCents(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  function money(value) {
    return Number(value).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function moneyCell(value) {
    return `$${money(value)}`;
  }

  function showMessage(text, type = "danger") {
    message.className = `mt-3 text-${type}`;
    message.textContent = text;
  }

  function clearResults() {
    totalPaymentInput.value = "";
    rateInput.value = "";
    tableBody.replaceChildren();
    tableFooter.replaceChildren();
  }

  function renderEmptyTable(text) {
    tableBody.replaceChildren();
    tableFooter.replaceChildren();

    const row = document.createElement("tr");
    const cell = document.createElement("td");

    cell.colSpan = 11;
    cell.className = "text-center";
    cell.textContent = text;

    row.appendChild(cell);
    tableBody.appendChild(row);
  }

  // Use local calendar dates, avoiding UTC date shifts.
  function parseDate(value) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return null;
    }

    const [year, month, day] = value.split("-").map(Number);
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

  function toInputDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function formatDate(date) {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }

  function lastDayOfMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
  }

  function isMonthEnd(date) {
    return (
      date.getDate() === lastDayOfMonth(date.getFullYear(), date.getMonth())
    );
  }

  // Calculate every payment date from the original start date.
  // If the start date is month-end, preserve month-end.
  function getPaymentDate(startDate, paymentIndex) {
    const originalDay = startDate.getDate();
    const preserveMonthEnd = isMonthEnd(startDate);

    const target = new Date(
      startDate.getFullYear(),
      startDate.getMonth() + paymentIndex,
      1,
    );

    const year = target.getFullYear();
    const month = target.getMonth();
    const lastDay = lastDayOfMonth(year, month);

    const day = preserveMonthEnd ? lastDay : Math.min(originalDay, lastDay);

    return new Date(year, month, day);
  }

  // Initialize the start date to today's local date only when empty.
  // An existing value or a date selected by the user is preserved.
  function initializeLocalStartDate() {
    if (startDateInput.value) return;

    const today = new Date();
    startDateInput.value = toInputDate(today);
  }

  // End date = start date + (number of payments - 1) months.
  function updateEndDate() {
    const startDate = parseDate(startDateInput.value);
    const countText = paymentsInput.value.trim();
    const count = Number(countText);

    if (
      !startDate ||
      countText === "" ||
      !Number.isSafeInteger(count) ||
      count < 1
    ) {
      endDateInput.value = "";
      return;
    }

    endDateInput.value = toInputDate(getPaymentDate(startDate, count - 1));
  }

  // Present value of a fixed monthly payment stream.
  function presentValue(payment, monthlyRate, count) {
    if (Math.abs(monthlyRate) < 1e-12) {
      return payment * count;
    }

    return (
      (payment * -Math.expm1(-count * Math.log1p(monthlyRate))) / monthlyRate
    );
  }

  // Solve for the implied monthly interest rate.
  function calculateMonthlyRate(principal, payment, count) {
    const totalScheduled = payment * count;

    if (totalScheduled < principal - 0.005) {
      throw new Error(
        "Total scheduled payments are less than the finance amount. " +
          "A non-negative interest rate cannot be calculated.",
      );
    }

    if (Math.abs(totalScheduled - principal) < 0.005) {
      return 0;
    }

    let low = 0;
    let high = 0.01;

    while (presentValue(payment, high, count) > principal && high < 1e6) {
      high *= 2;
    }

    if (presentValue(payment, high, count) > principal) {
      throw new Error("Unable to calculate a valid interest rate.");
    }

    for (let i = 0; i < 200; i++) {
      const mid = (low + high) / 2;

      if (presentValue(payment, mid, count) > principal) {
        low = mid;
      } else {
        high = mid;
      }
    }

    return (low + high) / 2;
  }

  function addCell(row, value) {
    const cell = document.createElement("td");
    cell.textContent = value;
    row.appendChild(cell);
    return cell;
  }

  // Create a year-end summary row using the same 11-column layout.
  function addYearSummaryRow(fragment, totals) {
    if (!totals) return;

    const row = document.createElement("tr");
    row.className = "table-info fw-bold year-end-summary";

    const labelCell = document.createElement("td");
    labelCell.colSpan = 4;
    labelCell.textContent = `${totals.year} YEAR-END SUMMARY`;
    row.appendChild(labelCell);

    addCell(row, moneyCell(totals.payments));
    addCell(row, moneyCell(totals.interest));
    addCell(row, moneyCell(totals.principal));
    addCell(row, moneyCell(totals.unpaidInterest));
    addCell(row, moneyCell(totals.endingBalance));
    addCell(row, moneyCell(totals.lateFees));
    addCell(row, moneyCell(totals.otherCharges));

    fragment.appendChild(row);
  }

  function createYearTotals(year, startingBalance) {
    return {
      year,
      payments: 0,
      interest: 0,
      principal: 0,
      unpaidInterest: 0,
      lateFees: 0,
      otherCharges: 0,
      endingBalance: startingBalance,
    };
  }

  function calculateSchedule() {
    clearResults();
    showMessage("");

    const principal = Number(financeInput.value);
    const count = Number(paymentsInput.value);
    const payment = Number(constantPaymentInput.value);
    const startDate = parseDate(startDateInput.value);

    // Synchronize the calculated end date.
    updateEndDate();

    if (
      !Number.isFinite(principal) ||
      principal <= 0 ||
      !Number.isSafeInteger(count) ||
      count < 1 ||
      !Number.isFinite(payment) ||
      payment <= 0
    ) {
      throw new Error(
        "Enter a finance amount and constant payment greater than zero, " +
          "and a whole number of payments greater than zero.",
      );
    }

    if (!startDate) {
      throw new Error("Please select a valid payment start date.");
    }

    const monthlyRate = calculateMonthlyRate(principal, payment, count);

    // Nominal annual rate = monthly rate × 12.
    const annualRate = monthlyRate * 12 * 100;

    totalPaymentInput.value = money(roundCents(payment) * count);
    rateInput.value = `${annualRate.toFixed(3)}%`;

    let balance = roundCents(principal);
    let totalInterest = 0;
    let totalPrincipal = 0;
    let totalPayments = 0;

    let currentYear = null;
    let yearTotals = null;

    const fragment = document.createDocumentFragment();

    for (let period = 1; period <= count; period++) {
      const paymentDate = getPaymentDate(startDate, period - 1);
      const paymentYear = paymentDate.getFullYear();

      // Close the previous year before starting the new year.
      if (currentYear !== paymentYear) {
        addYearSummaryRow(fragment, yearTotals);

        currentYear = paymentYear;
        yearTotals = createYearTotals(paymentYear, balance);
      }

      const beginningBalance = balance;
      const interest = roundCents(balance * monthlyRate);

      // The final payment clears the remaining balance.
      const actualPayment =
        period === count ? roundCents(balance + interest) : roundCents(payment);

      if (period < count && actualPayment < interest) {
        throw new Error(
          `Payment ${period} does not cover the monthly interest. ` +
            "Increase the constant payment amount.",
        );
      }

      const principalPaid = roundCents(actualPayment - interest);

      balance = roundCents(balance - principalPaid);

      if (Math.abs(balance) < 0.01) {
        balance = 0;
      }

      // These fields remain zero, matching the existing calculator.
      const unpaidInterest = 0;
      const lateFee = 0;
      const otherCharges = 0;

      totalInterest = roundCents(totalInterest + interest);
      totalPrincipal = roundCents(totalPrincipal + principalPaid);
      totalPayments = roundCents(totalPayments + actualPayment);

      yearTotals.payments = roundCents(yearTotals.payments + actualPayment);
      yearTotals.interest = roundCents(yearTotals.interest + interest);
      yearTotals.principal = roundCents(yearTotals.principal + principalPaid);
      yearTotals.unpaidInterest = roundCents(
        yearTotals.unpaidInterest + unpaidInterest,
      );
      yearTotals.lateFees = roundCents(yearTotals.lateFees + lateFee);
      yearTotals.otherCharges = roundCents(
        yearTotals.otherCharges + otherCharges,
      );
      yearTotals.endingBalance = balance;

      const row = document.createElement("tr");

      addCell(row, String(period));
      addCell(row, String(paymentYear));
      addCell(row, formatDate(paymentDate));
      addCell(row, moneyCell(beginningBalance));
      addCell(row, moneyCell(actualPayment));
      addCell(row, moneyCell(interest));
      addCell(row, moneyCell(principalPaid));
      addCell(row, moneyCell(unpaidInterest));
      addCell(row, moneyCell(balance));
      addCell(row, moneyCell(lateFee));
      addCell(row, moneyCell(otherCharges));

      fragment.appendChild(row);
    }

    // Include the last calendar year's summary.
    addYearSummaryRow(fragment, yearTotals);

    tableBody.replaceChildren(fragment);

    // Preserve the existing grand-total footer.
    const footerRow = document.createElement("tr");
    footerRow.className = "fw-bold";

    const labelCell = document.createElement("th");
    labelCell.colSpan = 3;
    labelCell.textContent = "TOTAL";
    footerRow.appendChild(labelCell);

    addCell(footerRow, "—");
    addCell(footerRow, moneyCell(totalPayments));
    addCell(footerRow, moneyCell(totalInterest));
    addCell(footerRow, moneyCell(totalPrincipal));
    addCell(footerRow, moneyCell(0));
    addCell(footerRow, "—");
    addCell(footerRow, moneyCell(0));
    addCell(footerRow, moneyCell(0));

    tableFooter.replaceChildren(footerRow);

    showMessage("Calculation completed successfully.", "success");
  }

  // Update the end date whenever the user changes the inputs.
  paymentsInput.addEventListener("input", updateEndDate);
  paymentsInput.addEventListener("change", updateEndDate);
  startDateInput.addEventListener("input", updateEndDate);
  startDateInput.addEventListener("change", updateEndDate);

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    try {
      calculateSchedule();
    } catch (error) {
      clearResults();
      renderEmptyTable("Please correct the inputs and calculate again.");
      showMessage(error.message || "Unable to calculate the loan.");
    }
  });

  form.addEventListener("reset", () => {
    window.setTimeout(() => {
      clearResults();
      initializeLocalStartDate();
      updateEndDate();
      renderEmptyTable("Enter your loan information and click Calculate.");
      showMessage("");
    }, 0);
  });

  // Initialize the local start date only if no date is already set.
  initializeLocalStartDate();
  updateEndDate();

  renderEmptyTable("Enter your loan information and click Calculate.");
})();
