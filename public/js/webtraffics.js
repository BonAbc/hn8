const socket = io();

socket.on("new-visitor", (data) => {
  const table = document.getElementById("list");

  if (!table) {
    return;
  }

  const row = document.createElement("tr");

  row.innerHTML = `
    <!-- SELECT -->
    <td data-label="Select">
      <input
        type="checkbox"
        name="ids"
        value="${data.id || ""}"
        class="visitor-checkbox"
      >
    </td>

    <!-- ID -->
    <td data-label="ID">
      ${data.id || ""}
    </td>

    <!-- REAL VISITOR IP -->
    <td data-label="Visitor IP">
      ${data.visitor_ip || "Unknown"}
    </td>

    <!-- CLOUDFLARE / CONNECTION IP -->
    <td data-label="Cloudflare IP">
      ${data.ip_address || "Unknown"}
    </td>

    <!-- COUNTRY -->
    <td data-label="Country">
      ${data.country || "Unknown"}
    </td>

    <!-- CITY -->
    <td data-label="City">
      ${data.city || "Unknown"}
    </td>

    <!-- TIMEZONE -->
    <td data-label="Timezone">
      ${data.timezone || "Unknown"}
    </td>

    <!-- PAGE -->
    <td data-label="Page">
      ${data.page || "Unknown"}
    </td>

    <!-- STATUS -->
    <td data-label="Status">
      ${data.status ?? "Unknown"}
    </td>

    <!-- TIME -->
    <td data-label="Time">
      ${data.time || "Unknown"}
    </td>
  `;

  table.prepend(row);
});

document.addEventListener("DOMContentLoaded", () => {
  const selectAll = document.getElementById("select-all");

  if (!selectAll) {
    return;
  }

  selectAll.addEventListener("change", () => {
    const checkboxes = document.querySelectorAll(".visitor-checkbox");

    checkboxes.forEach((checkbox) => {
      checkbox.checked = selectAll.checked;
    });
  });

  document.addEventListener("change", (event) => {
    if (!event.target.classList.contains("visitor-checkbox")) {
      return;
    }

    const checkboxes = document.querySelectorAll(".visitor-checkbox");

    const allChecked =
      checkboxes.length > 0 &&
      [...checkboxes].every((checkbox) => checkbox.checked);

    selectAll.checked = allChecked;
  });
});

function confirmBulkDelete() {
  const selected = document.querySelectorAll(".visitor-checkbox:checked");

  if (selected.length === 0) {
    alert("Please select at least one visitor.");

    return false;
  }

  return confirm(`Delete ${selected.length} selected visitor record(s)?`);
}
