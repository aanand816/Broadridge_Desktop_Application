async function loadCSV(filePath) {
    const res = await fetch(filePath);
    const text = await res.text();
    return text.trim();
}

function csvToObjects(csvText) {
    const lines = csvText.split(/\r?\n/).filter(Boolean);
    const headers = lines[0].split(",").map(s =>
        s.trim().replace(/^"|"$/g, "").toLowerCase().replace(/\s+/g, "_")
    );
    return lines.slice(1).map(line => {
        const values = line.split(",").map(s => s.trim().replace(/^"|"$/g, ""));
        const obj = {};
        headers.forEach((h, i) => obj[h] = values[i] ?? "");
        return obj;
    });
}

function saveJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function loadJSON(key, fallback = []) {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
}

function initLocalStorage() {
    AppData.attendance = loadJSON("attendance", []);
}