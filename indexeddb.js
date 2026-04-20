const DB_NAME = "BroadridgeDB";
const DB_VERSION = 2;
const STORES = {
    employees: "employees",
    departments: "departments",
    attendance: "attendance"
};

let dbInstance = null;

function openDB() {
    if (dbInstance) return Promise.resolve(dbInstance);

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = event => {
            const db = event.target.result;

            if (!db.objectStoreNames.contains(STORES.employees)) {
                const store = db.createObjectStore(STORES.employees, { keyPath: "employee_id" });
                store.createIndex("employee_name", "employee_name", { unique: false });
                store.createIndex("department", "department", { unique: false });
            }

            if (event.oldVersion < 2 && db.objectStoreNames.contains(STORES.departments)) {
                db.deleteObjectStore(STORES.departments);
            }

            if (!db.objectStoreNames.contains(STORES.departments)) {
                db.createObjectStore(STORES.departments, { keyPath: "dept_id" });
            }

            if (!db.objectStoreNames.contains(STORES.attendance)) {
                const store = db.createObjectStore(STORES.attendance, { keyPath: "id" });
                store.createIndex("emp_id", "emp_id", { unique: false });
                store.createIndex("date", "date", { unique: false });
                store.createIndex("department", "department", { unique: false });
            }
        };

        request.onsuccess = () => {
            dbInstance = request.result;
            resolve(dbInstance);
        };

        request.onerror = () => reject(request.error);
    });
}

async function getAll(storeName) {
    await openDB();
    return new Promise((resolve, reject) => {
        const request = dbInstance.transaction(storeName, "readonly").objectStore(storeName).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

async function saveOne(storeName, value) {
    await openDB();
    return new Promise((resolve, reject) => {
        const request = dbInstance.transaction(storeName, "readwrite").objectStore(storeName).put(value);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
    });
}

async function saveMany(storeName, values) {
    await openDB();
    return new Promise((resolve, reject) => {
        const store = dbInstance.transaction(storeName, "readwrite").objectStore(storeName);
        let i = 0;

        const next = () => {
            if (i >= values.length) return resolve(true);
            const request = store.put(values[i++]);
            request.onsuccess = next;
            request.onerror = () => reject(request.error);
        };

        next();
    });
}

async function deleteOne(storeName, id) {
    await openDB();
    return new Promise((resolve, reject) => {
        const request = dbInstance.transaction(storeName, "readwrite").objectStore(storeName).delete(id);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
    });
}

async function clearStore(storeName) {
    await openDB();
    return new Promise((resolve, reject) => {
        const request = dbInstance.transaction(storeName, "readwrite").objectStore(storeName).clear();
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
    });
}

async function seedInitialData() {
    await openDB();

    const employees = await getAll(STORES.employees);
    const departments = await getAll(STORES.departments);

    if (!employees.length && AppData.employees.length) {
        await saveMany(STORES.employees, AppData.employees);
    }
    if (!departments.length && AppData.departments.length) {
        await saveMany(STORES.departments, AppData.departments);
    }
}

function normalizeEmployeeRow(row) {
    return {
        employee_id: String(row.employee_id || row.emp_id || row.id || "").trim(),
        employee_name: String(row.employee_name || row.name || "").trim(),
        department: String(row.department || "").trim(),
        shift: String(row.shift || "morning").trim(),
        status: String(row.status || "Active").trim()
    };
}

function normalizeAttendanceRow(row) {
    return {
        id: Number(row.id || Date.now()),
        date: String(row.date || "").trim(),
        emp_id: String(row.emp_id || "").trim(),
        name: String(row.name || "").trim(),
        department: String(row.department || "").trim(),
        shift: String(row.shift || "").trim(),
        punch_in: String(row.punch_in || "").trim(),
        punch_out: String(row.punch_out || "").trim(),
        hours: Number(row.hours || 0),
        regular_hours: Number(row.regular_hours || 0),
        overtime_hours: Number(row.overtime_hours || 0),
        rate: Number(row.rate || 0),
        overtime_rate: Number(row.overtime_rate || 0),
        cost: Number(row.cost || 0),
        status: String(row.status || "Active").trim(),
        notes: String(row.notes || "").trim()
    };
}

function normalizeDepartmentRow(row) {
    return {
        dept_id: String(row.dept_id || row.id || "").trim(),
        department: String(row.department || row.name || "").trim(),
        hourly_rate: Number(row.hourly_rate || row.rate || 0),
        overtime_rate: Number(row.overtime_rate || row.ot_rate || 0)
    };
}
