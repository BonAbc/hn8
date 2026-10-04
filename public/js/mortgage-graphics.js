/* =====================================================
   MORTGAGE GRAPHICS
   Remaining Mortgage Balance Chart
   ===================================================== */

let balanceChart = null;

/* =====================================================
   GET SCHEDULE 1 DATA
   ===================================================== */

function getSchedule1BalanceData() {
  const body = document.getElementById("amortizationBody1");

  if (!body) {
    return {
      periods: [],
      balances: [],
    };
  }

  const rows = body.querySelectorAll("tr");

  const periods = [];
  const balances = [];

  rows.forEach((row) => {
    const cells = row.querySelectorAll("td");

    if (cells.length !== 6) {
      return;
    }

    const periodText = cells[0].textContent.trim();

    if (periodText === "TOTAL") {
      return;
    }

    const period = parseInt(periodText, 10);

    const balanceText = cells[5].textContent.trim().replace(/[$,]/g, "");

    const balance = parseFloat(balanceText);

    if (!isNaN(period) && !isNaN(balance)) {
      periods.push(period);
      balances.push(balance);
    }
  });

  return {
    periods,
    balances,
  };
}

/* =====================================================
   FORMAT MONEY
   ===================================================== */

function formatChartMoney(value) {
  if (isNaN(value)) {
    return "";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(value);
}

/* =====================================================
   CREATE / UPDATE BALANCE CHART
   ===================================================== */

function updateBalanceChart() {
  const canvas = document.getElementById("balanceChart");

  if (!canvas) {
    return;
  }

  if (typeof Chart === "undefined") {
    console.error(
      "Chart.js is not loaded. Please load Chart.js before mortgage-graphics.js.",
    );

    return;
  }

  const { periods, balances } = getSchedule1BalanceData();

  if (periods.length === 0 || balances.length === 0) {
    return;
  }

  if (balanceChart) {
    balanceChart.destroy();
    balanceChart = null;
  }

  balanceChart = new Chart(canvas, {
    type: "line",

    data: {
      labels: periods,

      datasets: [
        {
          label: "Remaining Mortgage Balance",

          data: balances,

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
        },
      ],
    },

    options: {
      responsive: true,

      maintainAspectRatio: false,

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
            title: function (tooltipItems) {
              if (!tooltipItems.length) {
                return "";
              }

              return `Payment Period ${tooltipItems[0].label}`;
            },

            label: function (context) {
              return `Remaining Balance: ${formatChartMoney(context.parsed.y)}`;
            },
          },
        },
      },

      scales: {
        x: {
          title: {
            display: true,

            text: "Payment Period",
          },

          ticks: {
            maxTicksLimit: 12,
          },
        },

        y: {
          beginAtZero: true,

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
      },
    },
  });
}

/* =====================================================
   WATCH FOR SCHEDULE 1 CHANGES
   ===================================================== */

function initializeMortgageGraphics() {
  const body = document.getElementById("amortizationBody1");

  if (!body) {
    return;
  }

  const observer = new MutationObserver(() => {
    updateBalanceChart();
  });

  observer.observe(body, {
    childList: true,

    subtree: true,
  });

  updateBalanceChart();
}

/* =====================================================
   PAGE LOAD
   ===================================================== */

window.addEventListener("DOMContentLoaded", () => {
  initializeMortgageGraphics();
});
