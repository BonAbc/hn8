/* ============================================================
   MORTGAGE GRAPHICS
   Remaining Mortgage Balance + Interest Paid Chart
   ============================================================ */

let balanceChart = null;

/* ============================================================
   GET SCHEDULE 1 BALANCE + INTEREST DATA
   ============================================================ */

function getSchedule1BalanceData() {
  const body = document.getElementById("amortizationBody1");

  if (!body) {
    console.warn("#amortizationBody1 was not found.");

    return {
      labels: [],
      balances: [],
      interest: [],
      periods: [],
      dates: [],
    };
  }

  const table = body.closest("table");

  if (!table) {
    console.warn("Schedule 1 table was not found.");

    return {
      labels: [],
      balances: [],
      interest: [],
      periods: [],
      dates: [],
    };
  }

  const headers = table.querySelectorAll("thead th");

  let periodIndex = -1;
  let paymentDateIndex = -1;
  let interestPaidIndex = -1;
  let endingBalanceIndex = -1;

  /*
   * Find columns by header name.
   */

  headers.forEach((header, index) => {
    const text = header.textContent.trim().toLowerCase().replace(/\s+/g, " ");

    if (text === "period") {
      periodIndex = index;
    }

    if (text === "payment date") {
      paymentDateIndex = index;
    }

    if (text === "interest paid") {
      interestPaidIndex = index;
    }

    if (text === "ending balance") {
      endingBalanceIndex = index;
    }
  });

  /*
   * Fallback positions for the current Schedule 1 table:
   *
   * Period          = 0
   * Payment Date    = 2
   * Interest Paid   = 5
   * Ending Balance  = 8
   *
   * Late Fee        = 9
   * Other Charges   = 10
   *
   * Late Fee and Other Charges are NOT used.
   */

  if (periodIndex === -1) {
    periodIndex = 0;
  }

  if (paymentDateIndex === -1) {
    paymentDateIndex = 2;
  }

  if (interestPaidIndex === -1) {
    interestPaidIndex = 5;
  }

  if (endingBalanceIndex === -1) {
    endingBalanceIndex = 8;
  }

  const rows = body.querySelectorAll("tr");

  const labels = [];
  const balances = [];
  const interest = [];
  const periods = [];
  const dates = [];

  rows.forEach((row) => {
    /*
     * Ignore annual summary rows.
     */

    if (row.classList.contains("amortization-annual-summary-row")) {
      return;
    }

    /*
     * Ignore overall TOTAL row.
     */

    if (row.classList.contains("amortization-total-row")) {
      return;
    }

    const cells = row.querySelectorAll("td");

    /*
     * Normal Schedule 1 payment rows have 11 cells.
     */

    if (cells.length !== 11) {
      return;
    }

    /*
     * Get payment period.
     */

    const periodText = cells[periodIndex].textContent.trim();

    const period = parseInt(periodText.replace(/[^\d-]/g, ""), 10);

    if (!Number.isFinite(period) || period <= 0) {
      return;
    }

    /*
     * Get payment date.
     */

    const paymentDateText = cells[paymentDateIndex].textContent.trim();

    if (!paymentDateText) {
      return;
    }

    /*
     * Get Interest Paid for THIS payment.
     *
     * This is NOT the annual summary interest.
     */

    const interestText = cells[interestPaidIndex].textContent
      .trim()
      .replace(/[$,]/g, "")
      .replace(/[^\d.-]/g, "");

    const interestPaid = parseFloat(interestText);

    if (!Number.isFinite(interestPaid)) {
      return;
    }

    /*
     * Get ONLY Ending Balance.
     *
     * Late Fee and Other Charges are ignored.
     */

    const balanceText = cells[endingBalanceIndex].textContent
      .trim()
      .replace(/[$,]/g, "")
      .replace(/[^\d.-]/g, "");

    const balance = parseFloat(balanceText);

    if (!Number.isFinite(balance)) {
      return;
    }

    /*
     * Convert payment date to calendar month/year.
     *
     * Example:
     *
     * 10/31/2026 -> Oct 2026
     * 11/30/2026 -> Nov 2026
     * 12/31/2026 -> Dec 2026
     */

    const label = formatChartMonthYear(paymentDateText);

    if (!label) {
      return;
    }

    periods.push(period);
    dates.push(paymentDateText);
    labels.push(label);
    balances.push(balance);
    interest.push(interestPaid);
  });

  return {
    labels,
    balances,
    interest,
    periods,
    dates,
  };
}

/* ============================================================
   FORMAT CHART DATE
   ============================================================ */

function formatChartMonthYear(dateText) {
  if (!dateText) {
    return "";
  }

  const text = String(dateText).trim();

  /*
   * Schedule 1 normally uses MM/DD/YYYY.
   */

  const parts = text.split("/");

  if (parts.length === 3) {
    const month = parseInt(parts[0], 10);
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);

    if (
      Number.isInteger(month) &&
      Number.isInteger(day) &&
      Number.isInteger(year) &&
      month >= 1 &&
      month <= 12
    ) {
      const date = new Date(year, month - 1, day);

      if (
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
      ) {
        return new Intl.DateTimeFormat("en-US", {
          month: "short",
          year: "numeric",
        }).format(date);
      }
    }
  }

  /*
   * Fallback.
   */

  const parsedDate = new Date(text);

  if (!Number.isNaN(parsedDate.getTime())) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      year: "numeric",
    }).format(parsedDate);
  }

  return text;
}

/* ============================================================
   FORMAT MONEY
   ============================================================ */

function formatChartMoney(value) {
  if (!Number.isFinite(value)) {
    return "";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(value);
}

/* ============================================================
   DESTROY EXISTING CHART
   ============================================================ */

function destroyBalanceChart() {
  if (balanceChart) {
    balanceChart.destroy();
    balanceChart = null;
  }
}

/* ============================================================
   UPDATE BALANCE + INTEREST CHART
   ============================================================ */

function updateBalanceChart() {
  const canvas = document.getElementById("balanceChart");

  if (!canvas) {
    console.warn("#balanceChart was not found.");
    return;
  }

  if (typeof Chart === "undefined") {
    console.error("Chart.js is not loaded.");
    return;
  }

  /*
   * Schedule 1 only.
   */

  const data = getSchedule1BalanceData();

  /*
   * No Schedule 1 data yet.
   */

  if (data.labels.length === 0 || data.balances.length === 0) {
    destroyBalanceChart();
    return;
  }

  /*
   * Make sure chart container has a usable width.
   */

  const container = canvas.parentElement;

  if (container && container.clientWidth === 0) {
    return;
  }

  /*
   * Destroy previous chart before rebuilding.
   */

  destroyBalanceChart();

  balanceChart = new Chart(canvas, {
    type: "line",

    data: {
      /*
       * Same calendar month/year labels
       * are used by both lines.
       */

      labels: data.labels,

      datasets: [
        /* ======================================================
           BLUE LINE
           REMAINING MORTGAGE BALANCE
           ====================================================== */

        {
          label: "Remaining Mortgage Balance",

          /*
           * Ending Balance from each Schedule 1
           * payment row.
           */

          data: data.balances,

          borderColor: "#0070b8",

          backgroundColor: "rgba(0, 112, 184, 0.12)",

          borderWidth: 3,

          pointRadius: 0,

          pointHoverRadius: 5,

          pointBackgroundColor: "#0070b8",

          pointBorderColor: "#ffffff",

          pointBorderWidth: 2,

          fill: true,

          tension: 0.25,

          yAxisID: "y",
        },

        /* ======================================================
           GREEN LINE
           INTEREST PAID FOR EACH PAYMENT
           ====================================================== */

        {
          label: "Interest Paid",

          /*
           * Interest Paid from EACH individual
           * Schedule 1 payment row.
           *
           * Annual summary rows are NOT used.
           */

          data: data.interest,

          borderColor: "#198754",

          backgroundColor: "rgba(25, 135, 84, 0.08)",

          borderWidth: 3,

          pointRadius: 0,

          pointHoverRadius: 5,

          pointBackgroundColor: "#198754",

          pointBorderColor: "#ffffff",

          pointBorderWidth: 2,

          fill: false,

          tension: 0.25,

          /*
           * Use a separate Y axis because the
           * balance and interest amounts are very
           * different scales.
           */

          yAxisID: "yInterest",
        },
      ],
    },

    options: {
      responsive: true,

      maintainAspectRatio: false,

      animation: false,

      interaction: {
        mode: "index",

        intersect: false,
      },

      plugins: {
        legend: {
          display: true,

          position: "top",
        },

        tooltip: {
          callbacks: {
            /*
             * Example:
             * Dec 2026
             */

            title: function (items) {
              if (!items || items.length === 0) {
                return "";
              }

              return items[0].label;
            },

            /*
             * Show the correct label for each line.
             */

            label: function (context) {
              if (context.dataset.label === "Interest Paid") {
                return "Interest Paid: " + formatChartMoney(context.parsed.y);
              }

              return "Remaining Balance: " + formatChartMoney(context.parsed.y);
            },
          },
        },
      },

      scales: {
        x: {
          title: {
            display: true,

            text: "Payment Date",
          },

          ticks: {
            maxTicksLimit: 15,

            autoSkip: true,

            maxRotation: 45,

            minRotation: 0,
          },
        },

        /*
         * BLUE Y AXIS
         */

        y: {
          beginAtZero: true,

          position: "left",

          title: {
            display: true,

            text: "Remaining Mortgage Balance",
          },

          ticks: {
            callback: function (value) {
              return formatChartMoney(value);
            },
          },
        },

        /*
         * GREEN Y AXIS
         */

        yInterest: {
          beginAtZero: true,

          position: "right",

          grid: {
            drawOnChartArea: false,
          },

          title: {
            display: true,

            text: "Interest Paid",
          },

          ticks: {
            callback: function (value) {
              return formatChartMoney(value);
            },
          },
        },
      },
    },
  });
}

/* ============================================================
   WATCH SCHEDULE 1
   ============================================================ */

function initializeMortgageGraphics() {
  const body = document.getElementById("amortizationBody1");

  if (!body) {
    console.warn("#amortizationBody1 was not found.");

    return;
  }

  /*
   * Watch Schedule 1 only.
   *
   * Schedule 2 cannot affect this chart.
   */

  const observer = new MutationObserver(() => {
    updateBalanceChart();
  });

  observer.observe(body, {
    childList: true,
    subtree: true,
  });

  /*
   * Initial attempt.
   */

  updateBalanceChart();

  /*
   * Allow mortgage.js to finish calculating.
   */

  setTimeout(updateBalanceChart, 100);

  setTimeout(updateBalanceChart, 500);

  setTimeout(updateBalanceChart, 1000);
}

/* ============================================================
   PAGE LOAD
   ============================================================ */

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeMortgageGraphics);
} else {
  initializeMortgageGraphics();
}
