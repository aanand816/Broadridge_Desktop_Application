const Dialog = (() => {
    let overlay = null;
    let activeClose = false;

    const icons = {
        error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
        warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
        success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
        info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
        confirm: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
        prompt: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`
    };

    const colors = {
        error: { bg: "#fef2f2", border: "#fca5a5", icon: "#ef4444", btn: "#ef4444" },
        warning: { bg: "#fffbeb", border: "#fcd34d", icon: "#f59e0b", btn: "#f59e0b" },
        success: { bg: "#f0fdf4", border: "#86efac", icon: "#22c55e", btn: "#22c55e" },
        info: { bg: "#eff6ff", border: "#93c5fd", icon: "#3b82f6", btn: "#3b82f6" },
        confirm: { bg: "#fefce8", border: "#fde68a", icon: "#eab308", btn: "#eab308" },
        prompt: { bg: "#eff6ff", border: "#93c5fd", icon: "#1597c4", btn: "#1597c4" }
    };

    function ensureOverlay() {
        if (overlay) return overlay;
        overlay = document.createElement("div");
        overlay.className = "dialog-overlay";
        overlay.id = "dialogOverlay";
        document.body.appendChild(overlay);
        return overlay;
    }

    function closeDialog(resolve, box, ov, value) {
        if (activeClose) return;
        activeClose = true;
        box.classList.remove("active");
        box.classList.add("closing");
        ov.classList.add("closing");

        setTimeout(() => {
            ov.classList.remove("active", "closing");
            ov.innerHTML = "";
            activeClose = false;
            resolve(value);
        }, 200);
    }

    function show(type, title, message, options = {}) {
        return new Promise(resolve => {
            const ov = ensureOverlay();
            const c = colors[type] || colors.info;
            const isPrompt = type === "prompt";
            const isConfirm = type === "confirm";

            ov.innerHTML = `
                <div class="dialog-box">
                    <div class="dialog-icon-circle" style="background:${c.bg};border-color:${c.border}">
                        <span class="dialog-icon" style="color:${c.icon}">${icons[type] || icons.info}</span>
                    </div>
                    <h3 class="dialog-title">${title}</h3>
                    <p class="dialog-message">${message}</p>
                    ${isPrompt ? `<input type="${options.inputType || "text"}" class="dialog-input" id="dialogInput" value="${options.defaultValue || ""}" placeholder="${options.placeholder || ""}" />` : ""}
                    <div class="dialog-actions">
                        ${(isConfirm || isPrompt) ? `<button class="dialog-btn dialog-btn-cancel" id="dialogCancel">Cancel</button>` : ""}
                        <button class="dialog-btn dialog-btn-ok" id="dialogOk" style="background:${c.btn}">${options.okText || "OK"}</button>
                    </div>
                </div>
            `;

            const box = ov.querySelector(".dialog-box");
            const input = ov.querySelector("#dialogInput");
            const okBtn = ov.querySelector("#dialogOk");
            const cancelBtn = ov.querySelector("#dialogCancel");

            ov.classList.add("active");
            box.classList.add("active");

            if (input) {
                input.focus();
                input.select();
            } else {
                okBtn.focus();
            }

            const doClose = value => closeDialog(resolve, box, ov, value);

            okBtn.onclick = () => {
                if (isPrompt) doClose(input.value);
                else doClose(true);
            };

            if (cancelBtn) {
                cancelBtn.onclick = () => doClose(isPrompt ? null : false);
            }

            ov.onclick = e => {
                if (e.target === ov) {
                    if (isPrompt) doClose(null);
                    else if (isConfirm) doClose(false);
                    else doClose(true);
                }
            };

            box.onkeydown = e => {
                if (e.key === "Escape") {
                    if (isPrompt) doClose(null);
                    else if (isConfirm) doClose(false);
                    else doClose(true);
                }
                if (e.key === "Enter") {
                    if (isPrompt) doClose(input.value);
                    else doClose(true);
                }
            };
        });
    }

    return {
        error: (title, msg) => show("error", title, msg),
        warning: (title, msg) => show("warning", title, msg),
        success: (title, msg) => show("success", title, msg),
        info: (title, msg) => show("info", title, msg),
        confirm: (title, msg, opts) => show("confirm", title, msg, opts),
        prompt: (title, msg, opts) => show("prompt", title, msg, opts)
    };
})();
