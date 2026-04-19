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