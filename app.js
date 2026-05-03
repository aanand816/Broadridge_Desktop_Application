const views = ["dashboard", "employees", "departments", "attendance", "reports"];
const todayDateStr = new Date().toISOString().split('T')[0];
let currentFilter = { emp_id: "", department: "", startDate: todayDateStr, endDate: todayDateStr };
let editingAttendanceId = null;
let editingEmployeeId = null;
let editingDepartmentId = null;

const pageMeta = {
  dashboard: ["Dashboard", "Overview of attendance and cost"],
  employees: ["Employees", "Manage employee master data"],
  departments: ["Departments", "View department pay rates"],
  attendance: ["Attendance", "Add, edit, delete and filter attendance"],
  reports: ["Reports", "Daily and weekly summaries"]
};

document.addEventListener("DOMContentLoaded", async () => {
  const empCSV = await loadCSV("emp.csv");
  const deptCSV = await loadCSV("dept.csv");

  AppData.employees = csvToObjects(empCSV);
  AppData.departments = csvToObjects(deptCSV);

  await openDB();
  await seedInitialData();

  AppData.employees = await getAll(STORES.employees);
  AppData.departments = await getAll(STORES.departments);
  AppData.attendance = await getAll(STORES.attendance);

  renderAll();
  bindMenu();
  bindMobileMenu();
  bindExports();
  bindImportExportButtons();
});

function bindMenu() {
  document.querySelectorAll(".menu-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".menu-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      showView(btn.dataset.view);
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
  const activeEmpList = AppData.employees.filter(e => (e.status || "").toLowerCase() === "active");
  const totalActiveEmp = activeEmpList.length;
  const totalDept = AppData.departments.length;

  // Calculate Yesterday
  const todayDate = new Date();
  const yesterdayDate = new Date(todayDate);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

  const yesterdaysAttendance = AppData.attendance.filter(r => r.date === yesterdayStr);
  const totalRecordsYesterday = yesterdaysAttendance.length;
  const totalCostYesterday = yesterdaysAttendance.reduce((s, r) => s + Number(r.cost || 0), 0).toFixed(2);

  const todayStr = new Date().toISOString().split('T')[0];

  // Calculate Current Week (Sun to Sat)
  const baseDate = new Date(todayStr + "T00:00:00");
  const day = baseDate.getDay();
  const diffToSun = -day;

  const wkStart = new Date(baseDate);
  wkStart.setDate(wkStart.getDate() + diffToSun);

  const wkEnd = new Date(wkStart);
  wkEnd.setDate(wkEnd.getDate() + 6);

  const monStr = wkStart.toISOString().split('T')[0];
  const sunStr = wkEnd.toISOString().split('T')[0];

  const monFmt = `${String(wkStart.getMonth() + 1).padStart(2, '0')}/${String(wkStart.getDate()).padStart(2, '0')}`;
  const sunFmt = `${String(wkEnd.getMonth() + 1).padStart(2, '0')}/${String(wkEnd.getDate()).padStart(2, '0')}`;

  const weekAttendance = AppData.attendance.filter(r => r.date >= monStr && r.date <= sunStr);

  // --- Digital Checklist Logic ---
  const actIdsWithSlips = new Set(yesterdaysAttendance.map(a => a.emp_id));
  let checklistPills = "";
  activeEmpList.forEach(e => {
    if (actIdsWithSlips.has(e.employee_id)) {
      checklistPills += `<span class="status-badge status-active" style="display:inline-block; font-size:13px; padding:6px 10px;">✓ ${e.employee_name}</span>`;
    } else {
      checklistPills += `<span class="status-badge status-inactive" style="color:#6b7280; background:#f3f4f6; display:inline-block; border:1px solid #e5e7eb; font-size:13px; padding:6px 10px;">${e.employee_name}</span>`;
    }
  });

  // --- Overtime Auditor Logic ---
  const empWeekTotal = {};
  weekAttendance.forEach(r => {
    if (!empWeekTotal[r.emp_id]) empWeekTotal[r.emp_id] = { id: r.emp_id, name: r.name, hours: 0 };
    empWeekTotal[r.emp_id].hours += Number(r.hours || 0);
  });

  let overtimeAlertsHTML = "";
  Object.values(empWeekTotal).forEach(e => {
    if (e.hours >= 44) {
      overtimeAlertsHTML += `<div style="background:#fef2f2; border-left:4px solid #ef4444; padding:8px 12px; margin-bottom:8px; border-radius:4px; font-size:14px;"><strong style="color:#b91c1c;">Critical:</strong> ${e.name} has hit <strong>${e.hours} hours</strong> this week.</div>`;
    } else if (e.hours >= 40) {
      overtimeAlertsHTML += `<div style="background:#fffbeb; border-left:4px solid #f59e0b; padding:8px 12px; margin-bottom:8px; border-radius:4px; font-size:14px;"><strong style="color:#b45309;">Approaching:</strong> ${e.name} is at <strong>${e.hours} hours</strong>.</div>`;
    }
  });
  if (overtimeAlertsHTML === "") {
    overtimeAlertsHTML = `<p class="muted" style="margin-top:12px;">All active employees are safely under 40 hours this week.</p>`;
  }

  el.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:24px;">
      <div class="grid cards-4">
        <div class="card"><h3>Employees</h3><div class="stat">${totalEmp}</div><div class="muted">Active master records</div></div>
        <div class="card"><h3>Departments</h3><div class="stat">${totalDept}</div><div class="muted">Pay groups</div></div>
        <div class="card"><h3>Attendance (Yesterday)</h3><div class="stat" style="color:#10b981;">${totalRecordsYesterday}</div><div class="muted">Logged paper slips</div></div>
        <div class="card"><h3>Total Cost (Yesterday)</h3><div class="stat">$${totalCostYesterday}</div><div class="muted">Transcribed expense</div></div>
      </div>

      <!-- DIGITAL CHECKLIST & ACTIONS -->
      <div class="grid dashboard-checklist-split">
        <div class="card" style="display:flex; flex-direction:column;">
           <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
               <h3 style="margin:0;">Data Entry Checklist (Yesterday)</h3>
               <span style="font-weight:700; font-size:16px; color:#1f2937;">${totalRecordsYesterday} / ${totalActiveEmp} Active</span>
           </div>
           <p class="muted" style="margin-bottom:16px; font-size:13px;">If you hold ${totalRecordsYesterday} paper slips in your hands, your entry is 100% finished. Green tags mark entered slips.</p>
           <div style="display:flex; flex-wrap:wrap; gap:8px;">${checklistPills}</div>
        </div>

        <div class="card" style="display:flex; flex-direction:column;">
          <h3>Administrative Actions</h3>
          <p class="muted" style="font-size:13px; margin-bottom:16px;">Quick shortcuts for your morning data entry routine.</p>
          <div style="margin-top:auto;">
              <button id="shortcutAddAtt" class="primary-btn" style="width:100%; margin-bottom:12px; display:flex; justify-content:center; align-items:center;"><span style="font-size:18px; margin-right:8px;">➕</span> Log Yesterday's Slips</button>
              <button id="shortcutExportDay" class="secondary-btn" style="width:100%; display:flex; justify-content:center; align-items:center;"><span style="font-size:18px; margin-right:8px;">📋</span> Export Yesterday Excel</button>
          </div>
        </div>
      </div>

      <!-- SUMMARIES -->
      <div class="grid dashboard-split report-box">
        <div class="card">
            <h3>Weekly Overtime Auditor <span class="muted" style="font-size:14px; font-weight:normal; margin-left:8px;">(${monFmt} to ${sunFmt})</span></h3>
            <p class="muted" style="font-size:13px; margin-bottom:16px;">Monitoring total hours aggressively across your active payroll boundaries.</p>
            ${overtimeAlertsHTML}
        </div>
        <div class="card"><h3>Latest Summary <span class="muted" style="font-size:14px; font-weight:normal; margin-left:8px;">(${monFmt} to ${sunFmt})</span></h3>${departmentSummaryHTML(weekAttendance)}</div>
      </div>
    </div>
  `;

  // --- Bind Shortcuts ---
  document.getElementById("shortcutAddAtt").onclick = () => {
    document.querySelector('button[data-view="attendance"]').click();
  };

  document.getElementById("shortcutExportDay").onclick = () => {
    if (window.exportDailySheet) {
      const targetDate = yesterdayStr;
      window.exportDailySheet(`daily_slips_${targetDate}.xlsx`, targetDate);
      Dialog.success("Export Complete", `Yesterday's Daily Layout saved perfectly!`);
    }
  };
}

function generateNextEmpId() {
  const ids = AppData.employees.map(e => {
    const match = e.employee_id.match(/E(\d+)/i);
    return match ? parseInt(match[1], 10) : 0;
  });
  const maxId = ids.length ? Math.max(...ids) : 0;
  return `E${String(maxId + 1).padStart(3, "0")}`;
}

function employeeRowHTML(e) {
  const statusClass = (e.status || "").toLowerCase() === "active" ? "status-active" : "status-inactive";
  const statusLabel = (e.status || "").toLowerCase() === "active" ? "Active" : "Inactive";
  return `
    <tr>
      <td>${e.employee_id}</td>
      <td>${e.employee_name}</td>
      <td>${e.department}</td>
      <td>${e.shift}</td>
      <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
      <td>
        <button class="action-btn btn-edit" onclick="startEditEmployee('${e.employee_id}')">Edit</button>
        <button class="action-btn btn-delete" onclick="deleteEmployee('${e.employee_id}')">Delete</button>
      </td>
    </tr>
  `;
}

function renderEmployees() {
  const el = document.getElementById("view-employees");
  const deptOptions = AppData.departments.map(d => `<option value="${d.department}">${d.department}</option>`).join("");
  const nextId = editingEmployeeId || generateNextEmpId();

  const editEmp = editingEmployeeId ? AppData.employees.find(x => x.employee_id === editingEmployeeId) : null;
  const currentStatus = editEmp ? editEmp.status : "Active";

  el.innerHTML = `
    <div class="card ${editingEmployeeId ? "edit-mode" : ""}">
      <h3>${editingEmployeeId ? "Edit Employee" : "Add Employee"}</h3>
      <div class="form-grid">
        <input id="empId" class="form-control" value="${nextId}" disabled />
        <input id="empName" class="form-control" placeholder="Employee Name" />
        <select id="empDept" class="form-control">
          <option value="">-- Select Department --</option>
          ${deptOptions}
        </select>
        <select id="empShift" class="form-control">
          <option value="">-- Select Shift --</option>
          <option value="Morning">Morning</option>
          <option value="Afternoon">Afternoon</option>
          <option value="Night">Night</option>
        </select>
        <div class="radio-group full">
          <label>Status:</label>
          <label class="radio-label radio-active">
            <input type="radio" name="empStatus" value="Active" ${currentStatus.toLowerCase() === "active" ? "checked" : ""} />
            <span class="radio-dot"></span> Active
          </label>
          <label class="radio-label radio-inactive">
            <input type="radio" name="empStatus" value="Inactive" ${currentStatus.toLowerCase() === "inactive" ? "checked" : ""} />
            <span class="radio-dot"></span> Inactive
          </label>
        </div>
        <button id="saveEmpBtn" class="secondary-btn full">${editingEmployeeId ? "Update Employee" : "Save Employee"}</button>
        <button id="cancelEmpBtn" class="secondary-btn full" style="${editingEmployeeId ? "" : "display:none;"}">​Cancel Edit</button>
      </div>
    </div>

    <div class="toolbar report-box">
      <input id="empSearch" placeholder="Search employee..." />
    </div>

    <div class="table-wrap">
      <table>
        <thead><tr><th>ID</th><th>Name</th><th>Department</th><th>Shift</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          ${AppData.employees.map(e => employeeRowHTML(e)).join("")}
        </tbody>
      </table>
    </div>
  `;

  if (editEmp) {
    document.getElementById("empName").value = editEmp.employee_name;
    document.getElementById("empDept").value = editEmp.department;
    document.getElementById("empShift").value = editEmp.shift;
  }

  document.getElementById("saveEmpBtn").onclick = saveEmployee;
  const cancelEmpBtn = document.getElementById("cancelEmpBtn");
  if (cancelEmpBtn) cancelEmpBtn.onclick = cancelEditEmployee;

  const input = document.getElementById("empSearch");
  input?.addEventListener("input", () => {
    const q = input.value.toLowerCase();
    const rows = AppData.employees.filter(e => Object.values(e).join(" ").toLowerCase().includes(q));
    el.querySelector("tbody").innerHTML = rows.map(e => employeeRowHTML(e)).join("");
  });
}

async function saveEmployee() {
  const employee_id = document.getElementById("empId").value.trim();
  const employee_name = document.getElementById("empName").value.trim();
  const department = document.getElementById("empDept").value.trim();
  const shift = document.getElementById("empShift").value.trim();
  const statusRadio = document.querySelector('input[name="empStatus"]:checked');
  const status = statusRadio ? statusRadio.value : "Active";

  if (!employee_name || !department || !shift) {
    Dialog.warning("Missing Fields", "Fill employee name, department and shift.");
    return;
  }

  const row = { employee_id, employee_name, department, shift, status };

  if (editingEmployeeId) {
    const original = AppData.employees.find(e => e.employee_id === editingEmployeeId);
    if (!original) {
      Dialog.error("Not Found", "Employee no longer exists.");
      return;
    }

    await saveOne(STORES.employees, normalizeEmployeeRow(row));
    cancelEditEmployee(false);
    AppData.employees = await getAll(STORES.employees);
    renderEmployees();
    renderAttendance();
    renderDashboard();
    Dialog.success("Updated", "Employee updated successfully.");
    return;
  }

  await saveOne(STORES.employees, normalizeEmployeeRow(row));
  AppData.employees = await getAll(STORES.employees);
  renderEmployees();
  renderAttendance();
  renderDashboard();
  Dialog.success("Saved", `Employee <strong>${employee_name}</strong> added as <strong>${employee_id}</strong>.`);
}

function startEditEmployee(id) {
  editingEmployeeId = id;
  renderEmployees();
  window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
}

function cancelEditEmployee(showMessage = true) {
  editingEmployeeId = null;
  renderEmployees();
  if (showMessage) Dialog.info("Edit Cancelled", "Employee edit cleared.");
}

async function deleteEmployee(id) {
  const ok = await Dialog.confirm("Delete Employee", `Delete employee <strong>${id}</strong>? This cannot be undone.`, { okText: "Delete" });
  if (!ok) return;

  await deleteOne(STORES.employees, id);
  AppData.employees = await getAll(STORES.employees);

  AppData.attendance = AppData.attendance.filter(a => a.emp_id !== id);
  await clearStore(STORES.attendance);
  await saveMany(STORES.attendance, AppData.attendance);

  renderEmployees();
  renderAttendance();
  renderDashboard();
  renderReports();
  Dialog.success("Deleted", "Employee deleted.");
}

function generateNextDeptId() {
  const ids = AppData.departments.map(d => {
    const match = (d.dept_id || "").match(/D(\d+)/i);
    return match ? parseInt(match[1], 10) : 0;
  });
  const maxId = ids.length ? Math.max(...ids) : 0;
  return `D${String(maxId + 1).padStart(3, "0")}`;
}

function departmentRowHTML(d) {
  return `
    <tr>
      <td>${d.dept_id || ""}</td>
      <td>${d.department}</td>
      <td>${d.hourly_rate}</td>
      <td>${d.overtime_rate}</td>
      <td>
        <button class="action-btn btn-edit" onclick="startEditDepartment('${d.dept_id}')">Edit</button>
        <button class="action-btn btn-delete" onclick="deleteDepartment('${d.dept_id}')">Delete</button>
      </td>
    </tr>
  `;
}

function renderDepartments() {
  const el = document.getElementById("view-departments");
  const nextId = editingDepartmentId ? editingDepartmentId : generateNextDeptId();
  const editDept = editingDepartmentId ? AppData.departments.find(x => x.dept_id === editingDepartmentId) : null;

  el.innerHTML = `
    <div class="card ${editingDepartmentId ? "edit-mode" : ""}">
      <h3>${editingDepartmentId ? "Edit Department" : "Add Department"}</h3>
      <div class="form-grid">
        <input id="deptId" class="form-control" value="${nextId}" placeholder="Dept ID (e.g. D001)" />
        <input id="deptName" class="form-control" placeholder="Department Name" />
        <input id="deptHourly" type="number" step="0.01" class="form-control" placeholder="Hourly Rate" />
        <input id="deptOvertime" type="number" step="0.01" class="form-control" placeholder="Overtime Rate" />
        <button id="saveDeptBtn" class="secondary-btn full">${editingDepartmentId ? "Update Department" : "Save Department"}</button>
        <button id="cancelDeptBtn" class="secondary-btn full" style="${editingDepartmentId ? "" : "display:none;"}">​Cancel Edit</button>
      </div>
    </div>

    <div class="toolbar report-box">
      <input id="deptSearch" placeholder="Search department..." />
    </div>

    <div class="table-wrap">
      <table>
        <thead><tr><th>Dept ID</th><th>Department</th><th>Hourly Rate</th><th>Overtime Rate</th><th>Actions</th></tr></thead>
        <tbody>
          ${AppData.departments.map(d => departmentRowHTML(d)).join("")}
        </tbody>
      </table>
    </div>
  `;

  if (editDept) {
    document.getElementById("deptId").value = editDept.dept_id;
    document.getElementById("deptName").value = editDept.department;
    document.getElementById("deptHourly").value = editDept.hourly_rate;
    document.getElementById("deptOvertime").value = editDept.overtime_rate;
  }

  document.getElementById("saveDeptBtn").onclick = saveDepartment;
  const cancelDeptBtn = document.getElementById("cancelDeptBtn");
  if (cancelDeptBtn) cancelDeptBtn.onclick = cancelEditDepartment;

  const input = document.getElementById("deptSearch");
  input?.addEventListener("input", () => {
    const q = input.value.toLowerCase();
    const rows = AppData.departments.filter(d => Object.values(d).join(" ").toLowerCase().includes(q));
    el.querySelector("tbody").innerHTML = rows.map(d => departmentRowHTML(d)).join("");
  });
}

async function saveDepartment() {
  const dept_id = document.getElementById("deptId").value.trim();
  const department = document.getElementById("deptName").value.trim();
  const hourly_rate = document.getElementById("deptHourly").value.trim();
  const overtime_rate = document.getElementById("deptOvertime").value.trim();

  if (!dept_id || !department || !hourly_rate || !overtime_rate) {
    Dialog.warning("Missing Fields", "Fill all department fields.");
    return;
  }

  const row = { dept_id, department, hourly_rate: Number(hourly_rate), overtime_rate: Number(overtime_rate) };

  if (editingDepartmentId) {
    const original = AppData.departments.find(d => d.dept_id === editingDepartmentId);
    if (!original) {
      Dialog.error("Not Found", "Department no longer exists.");
      return;
    }

    if (editingDepartmentId !== dept_id) {
      if (AppData.departments.some(d => d.dept_id === dept_id)) {
        Dialog.error("Duplicate", "Dept ID already exists.");
        return;
      }
      await deleteOne(STORES.departments, editingDepartmentId);
    }

    await saveOne(STORES.departments, normalizeDepartmentRow(row));
    cancelEditDepartment(false);
    AppData.departments = await getAll(STORES.departments);
    renderDepartments();
    renderEmployees();
    Dialog.success("Updated", "Department updated successfully.");
    return;
  }

  const exists = AppData.departments.some(d => d.dept_id === dept_id);
  if (exists) {
    Dialog.error("Duplicate", "Dept ID already exists.");
    return;
  }

  await saveOne(STORES.departments, normalizeDepartmentRow(row));
  AppData.departments = await getAll(STORES.departments);
  renderDepartments();
  renderEmployees();
  Dialog.success("Saved", `Department <strong>${department}</strong> added as <strong>${dept_id}</strong>.`);
}

function startEditDepartment(id) {
  editingDepartmentId = id;
  renderDepartments();
  window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
}

function cancelEditDepartment(showMessage = true) {
  editingDepartmentId = null;
  renderDepartments();
  if (showMessage) Dialog.info("Edit Cancelled", "Department edit cleared.");
}

async function deleteDepartment(id) {
  const dept = AppData.departments.find(d => d.dept_id === id);
  if (!dept) return;

  const hasEmployees = AppData.employees.some(e => e.department === dept.department);
  if (hasEmployees) {
    Dialog.error("Cannot Delete", `Cannot delete <strong>${dept.department}</strong> because there are employees currently assigned to it.`);
    return;
  }

  const ok = await Dialog.confirm("Delete Department", `Delete department <strong>${dept.department}</strong>? This cannot be undone.`, { okText: "Delete" });
  if (!ok) return;

  await deleteOne(STORES.departments, id);
  AppData.departments = await getAll(STORES.departments);

  if (editingDepartmentId === id) editingDepartmentId = null;

  renderDepartments();
  renderEmployees();
  renderDashboard();
  Dialog.success("Deleted", "Department deleted.");
}

function attendanceFormHTML() {
  const activeEmployees = AppData.employees.filter(e => (e.status || "").toLowerCase() === "active");
  const empOptions = activeEmployees.map(e => `<option value="${e.employee_id} - ${e.employee_name}"></option>`).join("");
  const deptOptionsList = AppData.departments.map(d => `<option value="${d.department}">${d.department}</option>`).join("");
  const todayDate = editingAttendanceId ? "" : new Date().toISOString().split('T')[0];

  return `
    <div class="card ${editingAttendanceId ? "edit-mode" : ""}">
      <h3>${editingAttendanceId ? "Edit Attendance" : "Add Attendance"}</h3>
      <div class="form-grid">
        <input id="attDate" type="date" class="form-control" value="${todayDate}" />
        <input list="empDataListForm" id="attEmp" class="form-control" placeholder="Search Employee (ID or Name)..." autocomplete="off">
        <datalist id="empDataListForm">
          ${empOptions}
        </datalist>
        <select id="attDeptOverride" class="form-control" title="Temporary Override Department">
          <option value="">-- Employee's Dept --</option>
          ${deptOptionsList}
        </select>
        <div style="display:flex; gap:12px; grid-column: span 2;">
          <div class="time-input-wrap" style="flex:1;">
            <label class="time-label">Punch In</label>
            <input id="attIn" type="time" class="form-control time-input" style="width:100%; box-sizing:border-box;" />
          </div>
          <div class="time-input-wrap" style="flex:1;">
            <label class="time-label">Punch Out</label>
            <input id="attOut" type="time" class="form-control time-input" style="width:100%; box-sizing:border-box;" />
          </div>
        </div>
        ${editingAttendanceId ? `<input id="attOverrideHours" type="number" step="0.25" class="form-control full" placeholder="Total Hours (Optional Override)" />` : ""}
        <input id="attNotes" type="text" class="form-control full" placeholder="Notes (Optional)" />
        <div style="display:flex; gap:12px; grid-column: 1 / -1;">
          <button id="saveAttBtn" class="secondary-btn" style="flex:1;">${editingAttendanceId ? "Update Attendance" : "Save Attendance"}</button>
          <button id="resetAttBtn" class="secondary-btn" style="flex:1; background:#9ca3af; color:white; ${editingAttendanceId ? "display:none;" : ""}">Reset Form</button>
          <button id="cancelEditBtn" class="secondary-btn" style="flex:1; ${editingAttendanceId ? "" : "display:none;"}">Cancel Edit</button>
        </div>
      </div>
    </div>
    `;
}

function renderAttendance() {
  const el = document.getElementById("view-attendance");
  const empOptions = AppData.employees.map(e => `<option value="${e.employee_id} - ${e.employee_name}"></option>`).join("");
  const deptOptions = [...new Set(AppData.employees.map(e => e.department))].map(d => `<option value="${d}"></option>`).join("");

  const filtered = AppData.attendance.filter(r =>
    (!currentFilter.emp_id || r.emp_id === currentFilter.emp_id) &&
    (!currentFilter.department || r.department === currentFilter.department) &&
    (!currentFilter.startDate || r.date >= currentFilter.startDate) &&
    (!currentFilter.endDate || r.date <= currentFilter.endDate)
  ).sort((a, b) => {
    if (a.date !== b.date) return a.date > b.date ? -1 : 1;
    return (a.punch_in || "") > (b.punch_in || "") ? -1 : 1;
  });

  el.innerHTML = `
    ${attendanceFormHTML()}

    <div class="card report-box">
      <h3>Filters</h3>
      <div class="toolbar" style="align-items:center;">
        <input list="filterEmpList" id="filterEmp" class="form-control" placeholder="Filter Employee..." autocomplete="off">
        <datalist id="filterEmpList">${empOptions}</datalist>

        <input list="filterDeptList" id="filterDept" class="form-control" placeholder="Filter Department..." autocomplete="off">
        <datalist id="filterDeptList">${deptOptions}</datalist>

        <div style="display:flex; gap:8px; align-items:center;">
          <span class="muted" style="font-size:13px; white-space:nowrap;">From:</span>
          <input id="filterStartDate" type="date" class="form-control" />
          <span class="muted" style="font-size:13px; white-space:nowrap; margin-left:4px;">To:</span>
          <input id="filterEndDate" type="date" class="form-control" />
        </div>

        <button id="clearFilters" class="secondary-btn" style="background:#ef4444;">Clear Filters</button>
      </div>
    </div>

    <div class="table-wrap report-box">
      <table>
        <thead>
          <tr>
            <th>Name</th><th>Date</th><th>Dept</th><th>Shift</th><th>In</th><th>Out</th>
            <th>Total Hours</th><th>Rate</th><th>Cost</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(r => `
            <tr>
              <td><strong>${r.name}</strong></td><td>${r.date}</td><td>${r.department}</td><td style="text-transform:capitalize;">${r.shift}</td>
              <td>${r.punch_in}</td><td>${r.punch_out}</td>
              <td>${r.hours}</td><td>$${r.rate}</td><td>$${r.cost}</td>
              <td>
                <button class="action-btn btn-edit" onclick="startEditAttendance(${r.id})">Edit</button>
                <button class="action-btn btn-delete" onclick="deleteRow(${r.id})">Delete</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  if (editingAttendanceId) {
    const row = AppData.attendance.find(r => r.id === editingAttendanceId);
    if (row) {
      document.getElementById("attDate").value = row.date;
      document.getElementById("attEmp").value = `${row.emp_id} - ${row.name}`;
      document.getElementById("attIn").value = row.punch_in;
      document.getElementById("attOut").value = row.punch_out;
      document.getElementById("attDeptOverride").value = row.department;
      if (document.getElementById("attOverrideHours")) document.getElementById("attOverrideHours").value = "";
      document.getElementById("attNotes").value = row.notes || "";
    }
  }

  // Auto-fetch department when employee is selected (Create Mode)
  const attEmpInput = document.getElementById("attEmp");
  if (attEmpInput && !editingAttendanceId) {
    attEmpInput.addEventListener("input", e => {
      const parts = e.target.value.split(" ");
      if (parts.length > 0) {
        const selectedEmp = AppData.employees.find(x => x.employee_id === parts[0]);
        if (selectedEmp) {
          document.getElementById("attDeptOverride").value = selectedEmp.department;
        }
      }
    });
  }

  // Restore filter values
  const filterEmpInput = document.getElementById("filterEmp");
  if (filterEmpInput && currentFilter.emp_id) {
    const activeEmp = AppData.employees.find(e => e.employee_id === currentFilter.emp_id);
    filterEmpInput.value = activeEmp ? `${activeEmp.employee_id} - ${activeEmp.employee_name}` : currentFilter.emp_id;
  }
  document.getElementById("filterDept").value = currentFilter.department || "";
  document.getElementById("filterStartDate").value = currentFilter.startDate || "";
  document.getElementById("filterEndDate").value = currentFilter.endDate || "";

  document.getElementById("saveAttBtn").onclick = saveAttendance;

  document.getElementById("filterEmp").onchange = e => { currentFilter.emp_id = e.target.value.split(" ")[0] || ""; renderAttendance(); };
  document.getElementById("filterDept").onchange = e => { currentFilter.department = e.target.value; renderAttendance(); };
  document.getElementById("filterStartDate").onchange = e => { currentFilter.startDate = e.target.value; renderAttendance(); };
  document.getElementById("filterEndDate").onchange = e => { currentFilter.endDate = e.target.value; renderAttendance(); };
  document.getElementById("clearFilters").onclick = () => {
    const t = new Date().toISOString().split('T')[0];
    currentFilter = { emp_id: "", department: "", startDate: t, endDate: t };
    renderAttendance();
  };

  const cancelBtn = document.getElementById("cancelEditBtn");
  if (cancelBtn) cancelBtn.onclick = cancelEditAttendance;

  const resetBtn = document.getElementById("resetAttBtn");
  if (resetBtn) resetBtn.onclick = () => { editingAttendanceId = null; renderAttendance(); };
}

async function saveAttendance() {
  const date = document.getElementById("attDate").value;
  const rawEmp = document.getElementById("attEmp").value.trim();
  const emp_id = rawEmp.split(" ")[0]; // Handle extracting ID from datalist (e.g. "E001 - John Doe")
  const punch_in = document.getElementById("attIn").value;
  const punch_out = document.getElementById("attOut").value;
  const dept_override = document.getElementById("attDeptOverride").value;
  const notes = document.getElementById("attNotes").value;

  const missing = [];
  if (!date) missing.push("Date");
  if (!emp_id) missing.push("Employee");

  const overrideNode = document.getElementById("attOverrideHours");
  const overrideHoursRaw = overrideNode ? overrideNode.value.trim() : "";
  const overrideHoursNum = parseFloat(overrideHoursRaw);
  const useOverride = overrideHoursRaw !== "" && !isNaN(overrideHoursNum);

  if (!punch_in && !useOverride) missing.push("Punch In");
  if (!punch_out && !useOverride) missing.push("Punch Out");
  if (missing.length) {
    Dialog.warning("Missing Fields", `Please fill in: <strong>${missing.join(", ")}</strong>`);
    return;
  }

  const emp = AppData.employees.find(e => e.employee_id === emp_id);
  if (!emp) {
    Dialog.error("Employee Not Found", `No employee found with ID <strong>${emp_id}</strong>. Ensure you have selected a valid employee.`);
    return;
  }

  let hours = 0;
  if (useOverride) {
    hours = overrideHoursNum;
  } else {
    if (punch_in && punch_out && punch_in === punch_out) {
      Dialog.error("Invalid Time", "Punch In and Punch Out cannot be the same time.");
      return;
    }
    hours = calculateHours(punch_in, punch_out, emp.shift);
  }

  if (!editingAttendanceId) {
    const isDuplicate = AppData.attendance.some(r => r.emp_id === emp_id && r.date === date && r.shift === emp.shift);
    if (isDuplicate) {
      Dialog.error("Duplicate Record", `<strong>${emp.employee_name}</strong> already has a ${emp.shift} shift registered on ${date}. Showing their history so you can review and edit.`);
      currentFilter = { emp_id: emp_id, department: "", startDate: "", endDate: "" };
      renderAttendance();
      return;
    }
  }

  // Use overridden department rate if provided
  const activeDepartment = dept_override || emp.department;
  const pay = calculatePay(emp_id, activeDepartment, hours, AppData.departments);

  if (editingAttendanceId) {
    const row = AppData.attendance.find(r => r.id === editingAttendanceId);
    if (!row) {
      Dialog.error("Not Found", "This attendance record no longer exists.");
      return;
    }

    row.date = date;
    row.emp_id = emp_id;
    row.name = emp.employee_name;
    row.department = activeDepartment;
    row.shift = emp.shift;
    row.punch_in = punch_in;
    row.punch_out = punch_out;
    row.hours = hours;
    row.regular_hours = pay.regularHours;
    row.overtime_hours = pay.overtimeHours;
    row.rate = pay.rate;
    row.overtime_rate = pay.otRate;
    row.cost = pay.cost;
    row.notes = notes;

    await saveOne(STORES.attendance, normalizeAttendanceRow(row));
    AppData.attendance = await getAll(STORES.attendance);
    cancelEditAttendance(false);
    renderAttendance();
    renderDashboard();
    renderReports();
    Dialog.success("Updated", `Attendance for <strong>${emp.employee_name}</strong> has been updated.`);
    return;
  }

  const row = {
    id: Date.now(),
    date,
    emp_id,
    name: emp.employee_name,
    department: activeDepartment,
    shift: emp.shift,
    punch_in,
    punch_out,
    hours,
    regular_hours: pay.regularHours,
    overtime_hours: pay.overtimeHours,
    rate: pay.rate,
    overtime_rate: pay.otRate,
    cost: pay.cost,
    status: "Active", // Keep in DB for backwards compatibility but remove from UI
    notes
  };

  await saveOne(STORES.attendance, normalizeAttendanceRow(row));
  AppData.attendance = await getAll(STORES.attendance);
  renderAttendance();
  renderDashboard();
  renderReports();
  Dialog.success("Saved", `Attendance for <strong>${emp.employee_name}</strong> on ${date} has been recorded.`);
}

function startEditAttendance(id) {
  editingAttendanceId = id;
  renderAttendance();
  window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
}

function cancelEditAttendance(showMessage = true) {
  editingAttendanceId = null;
  renderAttendance();
  if (showMessage) Dialog.info("Edit Cancelled", "Edit mode has been cleared.");
}

async function deleteRow(id) {
  const row = AppData.attendance.find(r => r.id === id);
  const name = row ? row.name : "this record";
  const ok = await Dialog.confirm("Delete Record", `Are you sure you want to delete the attendance record for <strong>${name}</strong>? This action cannot be undone.`, { okText: "Delete" });
  if (!ok) return;

  await deleteOne(STORES.attendance, id);
  AppData.attendance = await getAll(STORES.attendance);

  if (editingAttendanceId === id) editingAttendanceId = null;

  renderAttendance();
  renderDashboard();
  renderReports();
  Dialog.success("Deleted", "The attendance record has been removed.");
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
    const defaultName = `daily_${new Date().toISOString().slice(0, 10)}`;
    const fileName = await Dialog.prompt("Export Daily Report", "Enter a file name for the daily attendance export.", { defaultValue: defaultName });
    if (!fileName) return;

    if (window.exportDailySheet) {
      window.exportDailySheet(fileName);
      Dialog.success("Export Complete", `Daily layout saved as <strong>${fileName.endsWith(".xlsx") ? fileName : fileName + ".xlsx"}</strong>.`);
    }
  });

  document.getElementById("exportWeeklyBtn").addEventListener("click", async () => {
    if (!AppData.attendance.length) {
      Dialog.warning("No Data", "There are no attendance records to export.");
      return;
    }
    const defaultName = `weekly_${new Date().toISOString().slice(0, 10)}`;
    const fileName = await Dialog.prompt("Export Weekly Report", "Enter a file name for the weekly summary export.", { defaultValue: defaultName });
    if (!fileName) return;

    if (window.exportWeeklySheet) {
      window.exportWeeklySheet(fileName);
      Dialog.success("Export Complete", `Weekly layout saved as <strong>${fileName.endsWith(".xlsx") ? fileName : fileName + ".xlsx"}</strong>.`);
    }
  });
}

function bindImportExportButtons() {
  document.getElementById("exportEmployeesBtn").addEventListener("click", async () => {
    if (!AppData.employees.length) {
      Dialog.warning("No Data", "There are no employees to export.");
      return;
    }
    const fileName = await Dialog.prompt("Export Employees", "Enter a file name for employee export.", { defaultValue: "employees_backup" });
    if (!fileName) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(AppData.employees), "Employees");
    XLSX.writeFile(wb, fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`);
    Dialog.success("Export Complete", "Employee data exported successfully.");
  });

  document.getElementById("importEmployeesBtn").addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls,.csv";
    input.onchange = async e => {
      const file = e.target.files[0];
      if (!file) return;

      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

      const cleaned = rows.map(normalizeEmployeeRow).filter(r => r.employee_id && r.employee_name);
      if (!cleaned.length) {
        Dialog.error("Invalid File", "No valid employee rows found.");
        return;
      }

      const existing = await getAll(STORES.employees);
      const map = new Map(existing.map(e => [String(e.employee_id), e]));
      cleaned.forEach(e => map.set(String(e.employee_id), e));

      const merged = [...map.values()];
      await clearStore(STORES.employees);
      await saveMany(STORES.employees, merged);

      AppData.employees = await getAll(STORES.employees);
      renderEmployees();
      renderAttendance();
      renderDashboard();
      Dialog.success("Imported", `${cleaned.length} employee rows imported successfully.`);
    };
    input.click();
  });
}

window.startEditAttendance = startEditAttendance;
window.deleteRow = deleteRow;
window.cancelEditAttendance = cancelEditAttendance;
window.startEditEmployee = startEditEmployee;
window.deleteEmployee = deleteEmployee;
window.startEditDepartment = startEditDepartment;
window.deleteDepartment = deleteDepartment;
window.cancelEditDepartment = cancelEditDepartment;
new Date(2025 - 11 - 20).toLocaleDateString("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric"
});
