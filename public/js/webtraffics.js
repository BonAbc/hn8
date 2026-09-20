//
// WEB TRAFFIC
//

const socket = io();

// ==================================================
// NEW VISITOR
// ==================================================

socket.on("new-visitor", (data) => {
  const table = document.getElementById("list");

  if (!table) {
    return;
  }

  const row = document.createElement("tr");

  row.innerHTML = `
    <td data-label="Select">
      <input
        type="checkbox"
        name="ids"
        value="${data.id}"
        class="visitor-checkbox"
      >
    </td>

    <td data-label="ID">
      ${data.id || ""}
    </td>

    <td data-label="IP">
      ${data.ip || ""}
    </td>

    <td data-label="Country">
      ${data.country || ""}
    </td>

    <td data-label="City">
      ${data.city || ""}
    </td>

    <td data-label="Timezone">
      ${data.timezone || ""}
    </td>

    <td data-label="Page">
      ${data.page || ""}
    </td>

    <td data-label="Status">
      ${data.status || ""}
    </td>

    <td data-label="Time">
      ${data.time || ""}
    </td>
  `;

  table.prepend(row);
});

// ==================================================
// SELECT ALL
// ==================================================

document.addEventListener("DOMContentLoaded", () => {
  const selectAll = document.getElementById("select-all");

  if (!selectAll) {
    return;
  }

  // ----------------------------------------------
  // SELECT / UNSELECT ALL
  // ----------------------------------------------

  selectAll.addEventListener("change", () => {
    const checkboxes = document.querySelectorAll(".visitor-checkbox");

    checkboxes.forEach((checkbox) => {
      checkbox.checked = selectAll.checked;
    });
  });

  // ----------------------------------------------
  // INDIVIDUAL CHECKBOXES
  // ----------------------------------------------

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

// ==================================================
// CONFIRM BULK DELETE
// ==================================================

function confirmBulkDelete() {
  const selected = document.querySelectorAll(".visitor-checkbox:checked");

  if (selected.length === 0) {
    alert("Please select at least one visitor.");

    return false;
  }

  return confirm(`Delete ${selected.length} selected visitor record(s)?`);
}
