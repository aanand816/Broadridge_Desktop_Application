
const views = ["dashboard", "employees", "departments", "attendance", "reports"];
let currentFilter = { emp_id: "", department: "", date: "" };

const pageMeta = {
    dashboard: ["Dashboard", "Overview of attendance and cost"],
    employees: ["Employees", "Manage employee master data"],
    departments: ["Departments", "View department pay rates"],
    attendance: ["Attendance", "Add, edit, delete and filter attendance"],
    reports: ["Reports", "Daily and weekly summaries"]
};

document.addEventListener("DOMContentLoaded", async () => {
    console.log("DOM loaded");
    const empCSV = await loadCSV("emp.csv");
    const deptCSV = await loadCSV("dept.csv");
    AppData.employees = csvToObjects(empCSV);
    AppData.departments = csvToObjects(deptCSV);
    initLocalStorage();

    renderAll();
    bindMenu();
    bindSearch();
    bindMobileMenu();
    bindExports();
});

function bindMenu() {
    document.querySelectorAll(".menu-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".menu-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const view = btn.dataset.view;
            showView(view);
        });
    });
}

function showView(view) {
    views.forEach(v => document.getElementById(`view-${v}`).classList.remove("active"));
    document.getElementById(`view-${view}`).classList.add("active");
    document.getElementById("pageTitle").textContent = pageMeta[view][0];
    document.getElementById("pageSubtitle").textContent = pageMeta[view][1];
    renderView(view);
}

function renderAll() {
    views.forEach(renderView);
}

function renderView(view) {
    if (view === "dashboard") renderDashboard();
    if (view === "employees") renderEmployees();
    if (view === "departments") renderDepartments();
    if (view === "attendance") renderAttendance();
    if (view === "reports") renderReports();
}

function renderDashboard() {
    const el = document.getElementById("view-dashboard");
    const totalEmp = AppData.employees.length;
    const totalDept = AppData.departments.length;
    const totalRecords = AppData.attendance.length;
    const totalCost = AppData.attendance.reduce((s, r) => s + Number(r.cost || 0), 0).toFixed(2);

    el.innerHTML = `
    <div class="grid cards-4">
      <div class="card"><h3>Employees</h3><div class="stat">${totalEmp}</div><div class="muted">Active master records</div></div>
      <div class="card"><h3>Departments</h3><div class="stat">${totalDept}</div><div class="muted">Pay groups</div></div>
      <div class="card"><h3>Attendance</h3><div class="stat">${totalRecords}</div><div class="muted">Saved rows</div></div>
      <div class="card"><h3>Total Cost</h3><div class="stat">$${totalCost}</div><div class="muted">Local stored expense</div></div>
    </div>
    <div class="grid small-grid report-box">
      <div class="card"><h3>Quick Actions</h3><p class="muted">Use Attendance screen to add, edit or delete rows before export.</p></div>
      <div class="card"><h3>Latest Summary</h3>${departmentSummaryHTML(AppData.attendance)}</div>
    </div>
  `;
}

function renderEmployees() {
    const el = document.getElementById("view-employees");
    el.innerHTML = `
    <div class="toolbar">
      <input id="empSearch" placeholder="Search employee..." />
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>ID</th><th>Name</th><th>Department</th><th>Shift</th><th>Status</th></tr></thead>
        <tbody>
          ${AppData.employees.map(e => `
            <tr>
              <td>${e.employee_id}</td>
              <td>${e.employee_name}</td>
              <td>${e.department}</td>
              <td>${e.shift}</td>
              <td>${e.status}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
    const input = document.getElementById("empSearch");
    input?.addEventListener("input", () => {
        const q = input.value.toLowerCase();
        const rows = AppData.employees.filter(e =>
            Object.values(e).join(" ").toLowerCase().includes(q)
        );
        el.querySelector("tbody").innerHTML = rows.map(e => `
      <tr>
        <td>${e.employee_id}</td><td>${e.employee_name}</td><td>${e.department}</td><td>${e.shift}</td><td>${e.status}</td>
      </tr>
    `).join("");
    });
}

function renderDepartments() {
    const el = document.getElementById("view-departments");
    el.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Department</th><th>Hourly Rate</th><th>Overtime Rate</th></tr></thead>
        <tbody>
          ${AppData.departments.map(d => `
            <tr>
              <td>${d.department}</td>
              <td>${d.hourly_rate}</td>
              <td>${d.overtime_rate}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderAttendance() {
    const el = document.getElementById("view-attendance");
    const empOptions = AppData.employees.map(e => `<option value="${e.employee_id}">${e.employee_id} - ${e.employee_name}</option>`).join("");
    const deptOptions = [...new Set(AppData.employees.map(e => e.department))].map(d => `<option value="${d}">${d}</option>`).join("");

    const filtered = AppData.attendance.filter(r =>
        (!currentFilter.emp_id || r.emp_id === currentFilter.emp_id) &&
        (!currentFilter.department || r.department === currentFilter.department) &&
        (!currentFilter.date || r.date === currentFilter.date)
    );

    el.innerHTML = `
    <div class="card">
      <h3>Add Attendance</h3>
      <div class="form-grid">
        <input id="attDate" type="date" class="form-control" />
        <select id="attEmp" class="form-control">${empOptions}</select>
        <input id="attIn" type="time" class="form-control" />
        <input id="attOut" type="time" class="form-control" />
        <input id="attStatus" type="text" class="form-control" value="Active" />
        <input id="attNotes" type="text" class="form-control full" placeholder="Notes" />
        <button id="saveAttBtn" class="secondary-btn full">Save Attendance</button>
      </div>
    </div>

    <div class="card report-box">
      <h3>Filters</h3>
      <div class="toolbar">
        <select id="filterEmp"><option value="">All Employees</option>${empOptions}</select>
        <select id="filterDept"><option value="">All Departments</option>${deptOptions}</select>
        <input id="filterDate" type="date" />
        <button id="clearFilters" class="secondary-btn">Clear</button>
      </div>
    </div>

    <div class="table-wrap report-box">
      <table>
        <thead>
          <tr>
            <th>ID</th><th>Date</th><th>Emp</th><th>Name</th><th>Dept</th><th>Shift</th>
            <th>In</th><th>Out</th><th>Hours</th><th>Reg</th><th>OT</th><th>Rate</th><th>OT Rate</th><th>Cost</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(r => `
            <tr>
              <td>${r.id}</td><td>${r.date}</td><td>${r.emp_id}</td><td>${r.name}</td><td>${r.department}</td><td>${r.shift}</td>
              <td>${r.punch_in}</td><td>${r.punch_out}</td><td>${r.hours}</td><td>${r.regular_hours}</td><td>${r.overtime_hours}</td>
              <td>${r.rate}</td><td>${r.overtime_rate}</td><td>${r.cost}</td>
              <td>
                <button class="action-btn btn-edit" onclick="editRow(${r.id})">Edit</button>
                <button class="action-btn btn-delete" onclick="deleteRow(${r.id})">Delete</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

    document.getElementById("saveAttBtn").onclick = saveAttendance;
    document.getElementById("filterEmp").onchange = e => { currentFilter.emp_id = e.target.value; renderAttendance(); };
    document.getElementById("filterDept").onchange = e => { currentFilter.department = e.target.value; renderAttendance(); };
    document.getElementById("filterDate").onchange = e => { currentFilter.date = e.target.value; renderAttendance(); };
    document.getElementById("clearFilters").onclick = () => { currentFilter = { emp_id: "", department: "", date: "" }; renderAttendance(); };
}

function renderReports() {
    const el = document.getElementById("view-reports");
    const deptSummary = groupByDepartment(AppData.attendance);
    const empSummary = groupByEmployee(AppData.attendance);

    el.innerHTML = `
    <div class="grid small-grid">
      <div class="card">
        <h3>Department Summary</h3>
        <div class="table-wrap">
          <table style="min-width:0">
            <thead><tr><th>Department</th><th>Hours</th><th>Cost</th></tr></thead>
            <tbody>
              ${deptSummary.map(d => `<tr><td>${d.department}</td><td>${d.hours}</td><td>${d.cost}</td></tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h3>Employee Summary</h3>
        <div class="table-wrap">
          <table style="min-width:0">
            <thead><tr><th>Employee</th><th>Dept</th><th>Hours</th><th>Cost</th></tr></thead>
            <tbody>
              ${empSummary.map(e => `<tr><td>${e.emp_id} - ${e.name}</td><td>${e.department}</td><td>${e.hours}</td><td>${e.cost}</td></tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function departmentSummaryHTML(rows) {
    const deptSummary = groupByDepartment(rows);
    return `
    <div class="table-wrap">
      <table style="min-width:0">
        <thead><tr><th>Department</th><th>Hours</th><th>Cost</th></tr></thead>
        <tbody>
          ${deptSummary.map(d => `<tr><td>${d.department}</td><td>${d.hours}</td><td>${d.cost}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function saveAttendance() {
    const date = document.getElementById("attDate").value;
    const emp_id = document.getElementById("attEmp").value;
    const punch_in = document.getElementById("attIn").value;
    const punch_out = document.getElementById("attOut").value;
    const status = document.getElementById("attStatus").value;
    const notes = document.getElementById("attNotes").value;

    /* ── Validation ── */
    const missing = [];
    if (!date) missing.push("Date");
    if (!emp_id) missing.push("Employee");
    if (!punch_in) missing.push("Punch In");
    if (!punch_out) missing.push("Punch Out");
    if (missing.length) {
        Dialog.warning("Missing Fields", `Please fill in: <strong>${missing.join(", ")}</strong>`);
        return;
    }
    if (punch_in === punch_out) {
        Dialog.error("Invalid Time", "Punch In and Punch Out cannot be the same time.");
        return;
    }

    const emp = AppData.employees.find(e => e.employee_id === emp_id);
    if (!emp) {
        Dialog.error("Employee Not Found", `No employee found with ID <strong>${emp_id}</strong>.`);
        return;
    }

    const dept = AppData.departments.find(d => d.department === emp.department);
    const hours = calculateHours(punch_in, punch_out, emp.shift);
    const pay = calculatePay(emp_id, emp.department, hours, AppData.departments);

    const row = {
        id: Date.now(),
        date, emp_id, name: emp.employee_name, department: emp.department, shift: emp.shift,
        punch_in, punch_out, hours,
        regular_hours: pay.regularHours,
        overtime_hours: pay.overtimeHours,
        rate: pay.rate,
        overtime_rate: pay.otRate,
        cost: pay.cost,
        status, notes
    };

    AppData.attendance.push(row);
    saveJSON("attendance", AppData.attendance);
    renderAttendance();
    renderDashboard();
    renderReports();
    Dialog.success("Saved", `Attendance for <strong>${emp.employee_name}</strong> on ${date} has been recorded.`);
}

async function editRow(id) {
    const row = AppData.attendance.find(r => r.id === id);
    if (!row) {
        Dialog.error("Not Found", "This attendance record no longer exists.");
        return;
    }
    const newIn = await Dialog.prompt("Edit Punch In", `Update the punch-in time for <strong>${row.name}</strong>.`, { defaultValue: row.punch_in, inputType: "time" });
    if (newIn === null) return;
    const newOut = await Dialog.prompt("Edit Punch Out", `Update the punch-out time for <strong>${row.name}</strong>.`, { defaultValue: row.punch_out, inputType: "time" });
    if (newOut === null) return;

    if (!newIn || !newOut) {
        Dialog.warning("Invalid Input", "Both Punch In and Punch Out times are required.");
        return;
    }
    if (newIn === newOut) {
        Dialog.error("Invalid Time", "Punch In and Punch Out cannot be the same time.");
        return;
    }

    row.punch_in = newIn;
    row.punch_out = newOut;
    const emp = AppData.employees.find(e => e.employee_id === row.emp_id);
    const hours = calculateHours(row.punch_in, row.punch_out, emp.shift);
    const pay = calculatePay(row.emp_id, emp.department, hours, AppData.departments);
    row.hours = hours;
    row.regular_hours = pay.regularHours;
    row.overtime_hours = pay.overtimeHours;
    row.cost = pay.cost;
    saveJSON("attendance", AppData.attendance);
    renderAttendance();
    renderDashboard();
    renderReports();
    Dialog.success("Updated", `Attendance for <strong>${row.name}</strong> has been updated.`);
}

async function deleteRow(id) {
    const row = AppData.attendance.find(r => r.id === id);
    const name = row ? row.name : "this record";
    const ok = await Dialog.confirm("Delete Record", `Are you sure you want to delete the attendance record for <strong>${name}</strong>? This action cannot be undone.`, { okText: "Delete" });
    if (!ok) return;
    AppData.attendance = AppData.attendance.filter(r => r.id !== id);
    saveJSON("attendance", AppData.attendance);
    renderAttendance();
    renderDashboard();
    renderReports();
    Dialog.success("Deleted", "The attendance record has been removed.");
}

function bindSearch() {
    document.getElementById("globalSearch").addEventListener("input", e => {
        const q = e.target.value.toLowerCase();
        if (document.getElementById("view-attendance").classList.contains("active")) {
            currentFilter = { emp_id: "", department: "", date: "" };
            const rows = AppData.attendance.filter(r => Object.values(r).join(" ").toLowerCase().includes(q));
            const tbody = document.querySelector("#view-attendance tbody");
            if (tbody) tbody.innerHTML = rows.map(r => `
        <tr>
          <td>${r.id}</td><td>${r.date}</td><td>${r.emp_id}</td><td>${r.name}</td><td>${r.department}</td><td>${r.shift}</td>
          <td>${r.punch_in}</td><td>${r.punch_out}</td><td>${r.hours}</td><td>${r.regular_hours}</td><td>${r.overtime_hours}</td>
          <td>${r.rate}</td><td>${r.overtime_rate}</td><td>${r.cost}</td>
          <td>
            <button class="action-btn btn-edit" onclick="editRow(${r.id})">Edit</button>
            <button class="action-btn btn-delete" onclick="deleteRow(${r.id})">Delete</button>
          </td>
        </tr>
      `).join("");
        }
    });
}

function bindMobileMenu() {
    document.getElementById("mobileMenuBtn").addEventListener("click", () => {
        document.querySelector(".sidebar").classList.toggle("open");
    });
}

function bindExports() {
    document.getElementById("exportDailyBtn").addEventListener("click", async () => {
        if (!AppData.attendance.length) {
            Dialog.warning("No Data", "There are no attendance records to export.");
            return;
        }
        const fileName = await Dialog.prompt("Export Daily Report", "Enter a file name for the daily attendance export.", { defaultValue: `daily_${new Date().toISOString().slice(0, 10)}`, placeholder: "file name" });
        if (!fileName) return;
        try {
            exportExcel(fileName, AppData.attendance, "DailyAttendance");
            Dialog.success("Export Complete", `Daily report saved as <strong>${fileName.endsWith(".xlsx") ? fileName : fileName + ".xlsx"}</strong>.`);
        } catch (e) {
            Dialog.error("Export Failed", `Something went wrong: ${e.message}`);
        }
    });

    document.getElementById("exportWeeklyBtn").addEventListener("click", async () => {
        if (!AppData.attendance.length) {
            Dialog.warning("No Data", "There are no attendance records to export.");
            return;
        }
        const fileName = await Dialog.prompt("Export Weekly Report", "Enter a file name for the weekly summary export.", { defaultValue: `weekly_${new Date().toISOString().slice(0, 10)}`, placeholder: "file name" });
        if (!fileName) return;
        try {
            const deptSummary = groupByDepartment(AppData.attendance);
            const empSummary = groupByEmployee(AppData.attendance);
            const wb = XLSX.utils.book_new();

            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(AppData.attendance), "AllAttendance");
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(deptSummary), "DeptSummary");
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(empSummary), "EmpSummary");

            XLSX.writeFile(wb, fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`);
            Dialog.success("Export Complete", `Weekly report saved as <strong>${fileName.endsWith(".xlsx") ? fileName : fileName + ".xlsx"}</strong>.`);
        } catch (e) {
            Dialog.error("Export Failed", `Something went wrong: ${e.message}`);
        }
    });
}

window.editRow = editRow;
window.deleteRow = deleteRow;