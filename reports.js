function groupByDepartment(rows) {
    const map = {};
    rows.forEach(r => {
        if (!map[r.department]) map[r.department] = { department: r.department, hours: 0, cost: 0 };
        map[r.department].hours += Number(r.hours || 0);
        map[r.department].cost += Number(r.cost || 0);
    });
    return Object.values(map).map(x => ({
        ...x,
        hours: Math.round(x.hours * 100) / 100,
        cost: Math.round(x.cost * 100) / 100
    }));
}

function groupByEmployee(rows) {
    const map = {};
    rows.forEach(r => {
        if (!map[r.emp_id]) {
            map[r.emp_id] = {
                emp_id: r.emp_id,
                name: r.name,
                department: r.department,
                hours: 0,
                cost: 0,
                days: []
            };
        }
        map[r.emp_id].hours += Number(r.hours || 0);
        map[r.emp_id].cost += Number(r.cost || 0);
        map[r.emp_id].days.push(r.date);
    });
    return Object.values(map).map(x => ({
        ...x,
        hours: Math.round(x.hours * 100) / 100,
        cost: Math.round(x.cost * 100) / 100
    }));
}

function exportExcel(fileName, rows, sheetName = "Sheet1") {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`);
}

const todayDateStrReports = new Date().toISOString().split('T')[0];
const _baseRDate = new Date(todayDateStrReports + "T00:00:00");
const _rDay = _baseRDate.getDay();
const _rDiffToSun = -_rDay;

const _rSunStart = new Date(_baseRDate);
_rSunStart.setDate(_rSunStart.getDate() + _rDiffToSun);
const _rSatEnd = new Date(_rSunStart);
_rSatEnd.setDate(_rSatEnd.getDate() + 6);

const defaultRepMon = _rSunStart.toISOString().split('T')[0];
const defaultRepSun = _rSatEnd.toISOString().split('T')[0];

let reportFilterDept = { dept: "", startDate: defaultRepMon, endDate: defaultRepSun };
let reportFilterEmp = { emp: "", startDate: defaultRepMon, endDate: defaultRepSun };

function departmentSummaryHTML(rows) {
    if (!rows || !rows.length) return `<p class="muted">No attendance data yet.</p>`;
    const summary = groupByDepartment(rows);
    return `
        <table style="min-width:auto;width:100%">
            <thead><tr><th>Department</th><th>Hours</th><th>Cost</th></tr></thead>
            <tbody>
                ${summary.map(d => `
                    <tr>
                        <td>${d.department}</td>
                        <td>${d.hours}</td>
                        <td>$${d.cost.toFixed(2)}</td>
                    </tr>
                `).join("")}
            </tbody>
        </table>
    `;
}

window.viewWorkedDays = function(emp_id) {
    let ov = document.getElementById("calendarOverlay");
    if (!ov) {
        ov = document.createElement("div");
        ov.className = "dialog-overlay active";
        ov.id = "calendarOverlay";
        document.body.appendChild(ov);
    } else {
        ov.classList.add("active");
    }
    
    const empData = AppData.employees.find(x => x.employee_id === emp_id);
    const empName = empData ? empData.employee_name : emp_id;

    // Gather ALL attendance history for this employee so the calendar spans all time
    const empRecords = AppData.attendance.filter(r => r.emp_id === emp_id);
    const datesWorked = new Set(empRecords.map(r => r.date));

    // Calendar aligns initially to end date or today
    const baseDateStr = reportFilterEmp.endDate || new Date().toISOString().split('T')[0];
    const [y, m, d] = baseDateStr.split("-").map(Number);
    let viewYear = y;
    let viewMonth = m - 1; // 0-11
    
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    function renderModalCal() {
        const firstDay = new Date(viewYear, viewMonth, 1).getDay();
        const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
        
        let dt = `<div class="calendar-grid">`;
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        days.forEach(d => dt += `<div class="cal-header">${d}</div>`);
        
        for (let i = 0; i < firstDay; i++) {
            dt += `<div class="cal-day empty"></div>`;
        }
        for (let day = 1; day <= daysInMonth; day++) {
            const dStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const hasWorked = datesWorked.has(dStr);
            dt += `<div class="cal-day ${hasWorked ? 'worked' : ''}">${day}</div>`;
        }
        dt += `</div>`;

        ov.innerHTML = `
            <div class="calendar-box">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                    <h3 style="margin:0">${empName} <span class="muted" style="font-size:16px; margin-left:8px;">${monthNames[viewMonth]} ${viewYear}</span></h3>
                    <button id="closeCalendar" class="icon-btn" style="background:#ef4444; color:white; width:30px; height:30px; font-size:18px; border-radius:50%;">&times;</button>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
                    <button id="prevMonthCal" class="secondary-btn" style="padding:4px 10px;">&laquo; Prev</button>
                    <span style="font-size:12px; font-weight:600; color:#9ca3af; align-self:center;">Complete Employee History</span>
                    <button id="nextMonthCal" class="secondary-btn" style="padding:4px 10px;">Next &raquo;</button>
                </div>
                ${dt}
            </div>
        `;

        document.getElementById("closeCalendar").onclick = closeCal;
        document.getElementById("prevMonthCal").onclick = () => {
            viewMonth--;
            if (viewMonth < 0) { viewMonth = 11; viewYear--; }
            renderModalCal();
        };
        document.getElementById("nextMonthCal").onclick = () => {
            viewMonth++;
            if (viewMonth > 11) { viewMonth = 0; viewYear++; }
            renderModalCal();
        };
    }

    const closeCal = () => {
        ov.classList.remove("active");
        setTimeout(() => { if (ov) ov.innerHTML = ""; }, 200);
    };

    ov.onclick = e => { if (e.target === ov) closeCal(); };
    renderModalCal();
};

function renderReports() {
    const el = document.getElementById("view-reports");
    if (!el) return;

    // Filter logic for Dept
    const filteredDept = AppData.attendance.filter(r => 
        (!reportFilterDept.dept || r.department === reportFilterDept.dept) &&
        (!reportFilterDept.startDate || r.date >= reportFilterDept.startDate) &&
        (!reportFilterDept.endDate || r.date <= reportFilterDept.endDate)
    );
    const deptSummary = groupByDepartment(filteredDept);

    // Filter logic for Emp
    const filteredEmp = AppData.attendance.filter(r => 
        (!reportFilterEmp.emp || r.emp_id === reportFilterEmp.emp) &&
        (!reportFilterEmp.startDate || r.date >= reportFilterEmp.startDate) &&
        (!reportFilterEmp.endDate || r.date <= reportFilterEmp.endDate)
    );
    const empSummary = groupByEmployee(filteredEmp);
    
    // Datalist and Options Generation
    const deptOptions = [...new Set(AppData.departments.map(d => d.department))].map(d => `<option value="${d}">${d}</option>`).join("");
    const empOptions = AppData.employees.map(e => `<option value="${e.employee_id} - ${e.employee_name}"></option>`).join("");
    
    el.innerHTML = `
        <div class="card report-box">
            <h3>Department Summary</h3>
            <div class="toolbar" style="align-items:center;">
                <select id="rFilterDept" class="form-control" style="flex:1;">
                    <option value="">All Departments</option>
                    ${deptOptions}
                </select>
                <div style="display:flex; gap:8px; align-items:center; flex:1.5;">
                    <span class="muted" style="font-size:13px; white-space:nowrap;">From:</span>
                    <input id="rDeptStart" type="date" class="form-control full" value="${reportFilterDept.startDate}" />
                    <span class="muted" style="font-size:13px; white-space:nowrap; margin-left:4px;">To:</span>
                    <input id="rDeptEnd" type="date" class="form-control full" value="${reportFilterDept.endDate}" />
                </div>
                <button id="clearRFilterDept" class="secondary-btn" style="background:#ef4444; color:white; border:none;">Clear Filters</button>
            </div>
            ${deptSummary.length ? `
            <div class="table-wrap" style="box-shadow:none;border:none;">
                <table style="min-width:auto">
                    <thead><tr><th>Department</th><th>Total Hours</th><th>Total Cost</th></tr></thead>
                    <tbody>
                        ${deptSummary.map(d => `
                            <tr>
                                <td>${d.department}</td>
                                <td>${d.hours}</td>
                                <td>$${d.cost.toFixed(2)}</td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </div>
            ` : `<p class="muted" style="margin-top:12px;">No attendance data found for this range.</p>`}
        </div>

        <div class="card report-box">
            <h3>Employee Summary</h3>
            <div class="toolbar" style="align-items:center;">
                <input list="rFilterEmpList" id="rFilterEmp" class="form-control" style="flex:1;" placeholder="Search Employee (ID or Name)..." autocomplete="off" />
                <datalist id="rFilterEmpList">
                    ${empOptions}
                </datalist>
                <div style="display:flex; gap:8px; align-items:center; flex:1.5;">
                    <span class="muted" style="font-size:13px; white-space:nowrap;">From:</span>
                    <input id="rEmpStart" type="date" class="form-control full" value="${reportFilterEmp.startDate}" />
                    <span class="muted" style="font-size:13px; white-space:nowrap; margin-left:4px;">To:</span>
                    <input id="rEmpEnd" type="date" class="form-control full" value="${reportFilterEmp.endDate}" />
                </div>
                <button id="clearRFilterEmp" class="secondary-btn" style="background:#ef4444; color:white; border:none;">Clear Filters</button>
            </div>
            ${empSummary.length ? `
            <div class="table-wrap" style="box-shadow:none;border:none;">
                <table style="min-width:auto">
                    <thead><tr><th>Emp ID</th><th>Name</th><th>Department</th><th>Total Hours</th><th>Total Cost</th><th>Days Worked</th><th>Actions</th></tr></thead>
                    <tbody>
                        ${empSummary.map(e => `
                            <tr>
                                <td>${e.emp_id}</td>
                                <td><strong>${e.name}</strong></td>
                                <td>${e.department}</td>
                                <td>${e.hours}</td>
                                <td>$${e.cost.toFixed(2)}</td>
                                <td>${e.days.length}</td>
                                <td>
                                    <button class="action-btn btn-view" onclick="viewWorkedDays('${e.emp_id}')">Calendar</button>
                                </td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </div>
            ` : `<p class="muted" style="margin-top:12px;">No attendance data found for this range.</p>`}
        </div>
    `;

    // Bind event listeners
    document.getElementById("rFilterDept").value = reportFilterDept.dept;
    document.getElementById("rFilterDept").onchange = (e) => { reportFilterDept.dept = e.target.value; renderReports(); };
    document.getElementById("rDeptStart").onchange = (e) => { reportFilterDept.startDate = e.target.value; renderReports(); };
    document.getElementById("rDeptEnd").onchange = (e) => { reportFilterDept.endDate = e.target.value; renderReports(); };
    
    document.getElementById("clearRFilterDept").onclick = () => {
        reportFilterDept = { dept: "", startDate: "", endDate: "" };
        renderReports();
    };

    // Restore Employee datalist exactly as mapped
    const rFilterEmpInput = document.getElementById("rFilterEmp");
    if (rFilterEmpInput && reportFilterEmp.emp) {
        const activeEmp = AppData.employees.find(e => e.employee_id === reportFilterEmp.emp);
        rFilterEmpInput.value = activeEmp ? `${activeEmp.employee_id} - ${activeEmp.employee_name}` : reportFilterEmp.emp;
    }

    document.getElementById("rFilterEmp").onchange = (e) => { reportFilterEmp.emp = e.target.value.split(" ")[0] || ""; renderReports(); };
    document.getElementById("rEmpStart").onchange = (e) => { reportFilterEmp.startDate = e.target.value; renderReports(); };
    document.getElementById("rEmpEnd").onchange = (e) => { reportFilterEmp.endDate = e.target.value; renderReports(); };
    
    document.getElementById("clearRFilterEmp").onclick = () => {
        reportFilterEmp = { emp: "", startDate: "", endDate: "" };
        renderReports();
    };
}

// --- Custom Excel Logic ---

function exportCustomAOA(fileName, aoa, sheetName = "Sheet1") {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`);
}

window.exportDailySheet = function(fileName, overrideDate = null) {
    // Uses optional override Date from Dashboard, otherwise falls back to the Report filter.
    const targetDate = overrideDate || reportFilterEmp.endDate || todayDateStrReports;
    const rows = AppData.attendance.filter(r => r.date === targetDate);
    
    if (!rows.length) {
        Dialog.warning("No Data", `There is no attendance data for ${targetDate} to export.`);
        return;
    }
    
    const aoa = [];
    aoa.push(["Broadridge Attendance - Daily Sheet", targetDate]);
    aoa.push([]);
    
    // --- 1. Employee List ---
    aoa.push(["Date", "Employee Name", "Department Name", "Total Hours Worked", "Cost Per Hour", "Total Cost"]);
    let grandHours = 0;
    let grandCost = 0;
    
    rows.forEach(r => {
        grandHours += Number(r.hours || 0);
        grandCost += Number(r.cost || 0);
        aoa.push([
            r.date, 
            r.name, 
            r.department, 
            Number(r.hours || 0), 
            Number(r.rate || 0), 
            Number(r.cost || 0)
        ]);
    });
    
    aoa.push([]);
    aoa.push(["", "", "TOTALS:", grandHours, "", grandCost]);
    aoa.push([]);
    
    // --- 2. Department Block ---
    aoa.push(["DEPARTMENT DETAILS"]);
    aoa.push(["Department Name", "Total Hours", "Total Cost"]);
    
    const deptMap = {};
    rows.forEach(r => {
        if (!deptMap[r.department]) deptMap[r.department] = { dept: r.department, hours: 0, cost: 0 };
        deptMap[r.department].hours += Number(r.hours || 0);
        deptMap[r.department].cost += Number(r.cost || 0);
    });
    
    let deptTotalHours = 0;
    let deptTotalCost = 0;
    Object.values(deptMap).forEach(d => {
        deptTotalHours += d.hours;
        deptTotalCost += d.cost;
        aoa.push([d.dept, d.hours, d.cost]);
    });
    
    aoa.push(["GRAND TOTAL", deptTotalHours, deptTotalCost]);
    exportCustomAOA(fileName, aoa);
};

window.exportWeeklySheet = function(fileName) {
    // Computes Sunday to Saturday based on the currently filtered Date
    const baseDate = new Date((reportFilterEmp.endDate || todayDateStrReports) + "T00:00:00");
    const day = baseDate.getDay();
    const diffToSun = -day;
    
    const weekDates = [];
    const dateHeaders = [];
    
    for (let i = 0; i < 7; i++) {
        const d = new Date(baseDate);
        d.setDate(d.getDate() + diffToSun + i);
        const iso = d.toISOString().split('T')[0];
        weekDates.push(iso);
        const dayStr = d.toLocaleDateString('en-US', { weekday: 'short' });
        dateHeaders.push(`${dayStr} (${d.getDate()})`);
    }
    
    const rows = AppData.attendance.filter(r => weekDates.includes(r.date));
    
    if (!rows.length) {
        Dialog.warning("No Data", `There is no attendance data for the week of ${weekDates[0]} to export.`);
        return;
    }
    
    const aoa = [];
    aoa.push(["Broadridge Attendance - Weekly Sheet", `Week of ${weekDates[0]} to ${weekDates[6]}`]);
    aoa.push([]);
    
    // --- 1. Employee Pivot Array ---
    aoa.push(["Employee ID", "Employee Name", "Department Name", ...dateHeaders, "Total Hours", "Total Cost"]);
    
    const empPivot = {};
    rows.forEach(r => {
        if (!empPivot[r.emp_id]) {
            empPivot[r.emp_id] = { id: r.emp_id, name: r.name, dept: r.department, hoursByDate: {}, totalHours: 0, totalCost: 0 };
            weekDates.forEach(wd => empPivot[r.emp_id].hoursByDate[wd] = 0);
        }
        empPivot[r.emp_id].hoursByDate[r.date] += Number(r.hours || 0);
        empPivot[r.emp_id].totalHours += Number(r.hours || 0);
        empPivot[r.emp_id].totalCost += Number(r.cost || 0);
    });
    
    let grandWeekHours = 0;
    let grandWeekCost = 0;
    
    Object.values(empPivot).forEach(e => {
        grandWeekHours += e.totalHours;
        grandWeekCost += e.totalCost;
        const rowData = [e.id, e.name, e.dept];
        weekDates.forEach(wd => rowData.push(e.hoursByDate[wd] || ""));
        rowData.push(e.totalHours);
        rowData.push(e.totalCost);
        aoa.push(rowData);
    });
    
    aoa.push([]);
    const totalRow = ["", "TOTALS", ""];
    weekDates.forEach(() => totalRow.push(""));
    totalRow.push(grandWeekHours);
    totalRow.push(grandWeekCost);
    aoa.push(totalRow);
    aoa.push([]);
    
    // --- 2. Department Weekly Summary ---
    aoa.push(["DEPARTMENT DETAILS (WEEKLY)"]);
    aoa.push(["Department Name", "Total Hours", "Total Cost"]);
    
    const deptMap = {};
    rows.forEach(r => {
        if (!deptMap[r.department]) deptMap[r.department] = { dept: r.department, hours: 0, cost: 0 };
        deptMap[r.department].hours += Number(r.hours || 0);
        deptMap[r.department].cost += Number(r.cost || 0);
    });
    
    let deptTotalHours = 0;
    let deptTotalCost = 0;
    Object.values(deptMap).forEach(d => {
        deptTotalHours += d.hours;
        deptTotalCost += d.cost;
        aoa.push([d.dept, d.hours, d.cost]);
    });
    
    aoa.push(["GRAND TOTAL", deptTotalHours, deptTotalCost]);
    exportCustomAOA(fileName, aoa);
};