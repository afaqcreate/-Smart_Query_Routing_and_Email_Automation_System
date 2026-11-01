// API Configuration Constants
const API_BASE_URL = "http://20.196.197.202:8000/api/admin";
const API_BASE_URL_QUERY = "http://20.196.197.202:8000/api";
const QUERY_API_URL = `${API_BASE_URL_QUERY}/query`;
const ADMIN_API_URL = `${API_BASE_URL}/`;

// Application State
let state = {
    queries: [],
    users: [],
    activeQuery: null
};

// Chart Instances
let statusDoughnutChart = null;
let lifecycleBarChart = null;

document.addEventListener("DOMContentLoaded", () => {
    verifyAdminSession(); // 🛡️ Clears and verifies local storage session before app starts
    initApp();
});

function initApp() {
    setupMobileSidebar();
    refreshData(); // Triggers API fetch chains on startup
}

// Global Data Refresh via API Calls
async function refreshData() {
    showToast("Fetching latest data from FastAPI...", "info");
    await Promise.all([fetchQueries(), fetchUsers()]);
    renderDashboard();
    renderQueriesTable();
    renderUsersTable();
    renderAnalyticsCharts();
}

// API Request 1: Fetch All Queries
async function fetchQueries() {
    try {
        const res = await fetch(`${QUERY_API_URL}/`);
        if (!res.ok) throw new Error(`Query API error: ${res.status}`);
        const data = await res.json();
        state.queries = [data];
    } catch (err) {
        console.error("Failed to fetch queries:", err);
        showToast(`Failed to load queries: ${err.message}`, "error");
        state.queries = [];
    }
}

// API Request 2: Fetch Combined Users & Students
async function fetchUsers() {
    try {
        const res = await fetch(ADMIN_API_URL);
        if (!res.ok) throw new Error(`Admin API error: ${res.status}`);
        const data = await res.json();
        state.users = data;
    } catch (err) {
        console.error("Failed to fetch users:", err);
        showToast(`Failed to load accounts: ${err.message}`, "error");
        state.users = [];
    }
}

// Toast Notification System
function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    const bgCol = type === "success" ? "bg-emerald-600" : type === "error" ? "bg-rose-600" : "bg-primary";
    toast.className = `${bgCol} text-white px-4 py-3 rounded-xl shadow-lg text-xs font-medium flex items-center space-x-2 pointer-events-auto transition-all transform translate-y-2 opacity-0`;
    toast.innerHTML = `<i class="fa-solid fa-circle-info"></i><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.remove("translate-y-2", "opacity-0"); }, 10);
    setTimeout(() => {
        toast.classList.add("translate-y-2", "opacity-0");
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Tab Navigation
function switchTab(tabId) {
    document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
    const targetTab = document.getElementById(`tab-${tabId}`);
    if (targetTab) targetTab.classList.remove("hidden");

    document.querySelectorAll(".nav-btn").forEach(btn => {
        btn.className = "nav-btn w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm text-slate-600 hover:bg-softBlue hover:text-primary transition-colors";
    });
    const activeBtn = document.getElementById(`nav-${tabId}`);
    if (activeBtn) {
        activeBtn.className = "nav-btn w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm bg-softBlue text-primary";
    }

    const titles = {
        dashboard: "Dashboard Overview",
        analytics: "Analytics & System Reports",
        queries: "Query Management & History",
        users: "User & Student Registry",
        profile: "Admin Profile & Credentials"
    };
    const pageTitle = document.getElementById("page-title");
    if (pageTitle) pageTitle.innerText = titles[tabId] || "Admin Dashboard";
    
    const sidebar = document.getElementById("sidebar");
    if (sidebar) sidebar.classList.add("-translate-x-full");

    if (tabId === "analytics") {
        renderAnalyticsCharts();
    }
}

function setupMobileSidebar() {
    const openBtn = document.getElementById("open-sidebar");
    const closeBtn = document.getElementById("close-sidebar");
    const sidebar = document.getElementById("sidebar");

    if (openBtn && sidebar) {
        openBtn.addEventListener("click", () => sidebar.classList.remove("-translate-x-full"));
    }
    if (closeBtn && sidebar) {
        closeBtn.addEventListener("click", () => sidebar.classList.add("-translate-x-full"));
    }
}

// Helper: Check if query has escalations in last 24h
function hasRecentEscalations(q) {
    if (!q.escalations || !Array.isArray(q.escalations) || q.escalations.length === 0) return false;
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    return q.escalations.some(e => {
        if (!e.escalated_at) return true;
        const escTime = new Date(e.escalated_at);
        return escTime >= twentyFourHoursAgo;
    });
}

// Render Dashboard Visual Metrics
function renderDashboard() {
    const queries = state.queries[0] || [];
    const total = queries.length;

    let pending = 0;
    let inprogress = 0;
    let resolved = 0;
    let escalations24h = 0;

    queries.forEach(q => {
        const statusStr = (q.status || "").toLowerCase();
        if (statusStr === "pending") pending++;
        else if (statusStr === "in_progress") inprogress++;
        else if (["resolve", "resolved", "resolve manual"].includes(statusStr)) resolved++;

        if (hasRecentEscalations(q)) escalations24h++;
    });

    const setInnerTxt = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    };
    
    setInnerTxt("stat-pending", pending);
    setInnerTxt("stat-inprogress", inprogress);
    setInnerTxt("stat-resolved", resolved);
    setInnerTxt("stat-total", total);
    setInnerTxt("stat-escalations", escalations24h);

    const recentBody = document.getElementById("dashboard-recent-queries");
    if (!recentBody) return;
    recentBody.innerHTML = "";

    if (total === 0) {
        recentBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400 text-xs">No queries available in database.</td></tr>`;
        return;
    }

    queries.slice(0, 5).forEach(q => {
        const studentName = q.student?.name || 'Student';
        const studentRoll = q.student?.roll_number || 'N/A';
        const tr = document.createElement("tr");
        tr.className = "hover:bg-bgLight/50 transition-colors";
        tr.innerHTML = `
            <td class="p-3 font-semibold text-slate-800">${studentName}<br><span class="text-xs text-slate-400 font-normal">${studentRoll}</span></td>
            <td class="p-3 text-slate-600 truncate max-w-xs">
                <span class="font-medium text-slate-900 block truncate">${q.query_subject || 'No Subject'}</span>
                <span class="text-xs text-slate-400 truncate block">${q.query_body || ''}</span>
            </td>
            <td class="p-3">${getStatusBadgeHTML(q.status)}</td>
            <td class="p-3">
                <button onclick="openQueryModal(${q.query_id})" class="px-3 py-1 bg-softBlue text-primary rounded-xl text-xs font-medium hover:bg-blue-100 transition-colors">Manage</button>
            </td>
        `;
        recentBody.appendChild(tr);
    });
    renderAnalyticsCharts();
}

// Render KPI Metrics and Chart.js Charts
function renderAnalyticsCharts() {
    const queries = state.queries[0] || [];

    let pending = 0;
    let inprogress = 0;
    let resolved = 0;
    let escalations24h = 0;

    queries.forEach(q => {
        const statusStr = (q.status || "").toLowerCase();
        if (statusStr === "pending") pending++;
        else if (statusStr === "in_progress") inprogress++;
        else if (["resolve", "resolved", "resolve manual"].includes(statusStr)) resolved++;

        if (hasRecentEscalations(q)) escalations24h++;
    });

    const total = queries.length;
    const resRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    const setInnerTxt = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    };

    setInnerTxt("metric-resolution-rate", `${resRate}%`);
    setInnerTxt("metric-escalations-24h", escalations24h);
    setInnerTxt("metric-total-queries", total);
    setInnerTxt("metric-user-count", state.users.length);

    // Chart 1: Status Distribution Doughnut Chart
    const ctxStatus = document.getElementById("chart-status-distribution")?.getContext("2d");
    if (ctxStatus) {
        if (statusDoughnutChart) statusDoughnutChart.destroy();
        statusDoughnutChart = new Chart(ctxStatus, {
            type: 'doughnut',
            data: {
                labels: ['Pending', 'In-Progress', 'Resolved'],
                datasets: [{
                    data: [pending, inprogress, resolved],
                    backgroundColor: ['#FDF9C3', '#3663EB', '#4EA44B'],
                    borderWidth: 2,
                    borderColor: '#FFFFFF'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } }
            }
        });
    }

    // Chart 2: Lifecycle Comparison Bar Chart
    const ctxBar = document.getElementById("chart-lifecycle-bar")?.getContext("2d");
    if (ctxBar) {
        if (lifecycleBarChart) lifecycleBarChart.destroy();
        lifecycleBarChart = new Chart(ctxBar, {
            type: 'bar',
            data: {
                labels: ['Pending', 'In-Progress', 'Resolved', '24h Escalations'],
                datasets: [{
                    label: 'Queries Count',
                    data: [pending, inprogress, resolved, escalations24h],
                    backgroundColor: ['#EAB308', '#3663EB', '#4EA44B', '#E11D48'],
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
            }
        });
    }
}

// Export Queries as CSV Report
function exportQueriesCSV() {
    const queries = state.queries[0] || [];
    if (queries.length === 0) {
        showToast("No query data available to export.", "error");
        return;
    }

    let csv = "Query ID,Student Name,Student Roll,Subject,Category,Status,Reply,Submitted At\n";
    queries.forEach(q => {
        const sName = (q.student ? q.student.name || '' : '').replace(/,/g, " ");
        const sRoll = q.student ? q.student.roll_number || '' : '';
        const subject = (q.query_subject || '').replace(/,/g, " ");
        const cat = (q.category || 'N/A').replace(/,/g, " ");
        const status = q.status || '';
        const reply = (q.reply || '').replace(/,/g, " ").replace(/\n/g, " ");
        const submitted = q.submitted_at || '';

        csv += `${q.query_id},"${sName}","${sRoll}","${subject}","${cat}","${status}","${reply}","${submitted}"\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.setAttribute("href", url);
    a.setAttribute("download", `analytics_queries_report_${new Date().toISOString().slice(0, 10)}.csv`);
    a.click();
    showToast("Exported queries report CSV!");
}

// Export Users as CSV Report
function exportUsersCSV() {
    if (state.users.length === 0) {
        showToast("No user data available to export.", "error");
        return;
    }

    let csv = "ID,Name,Email,Role,Roll Number\n";
    state.users.forEach(u => {
        const name = (u.name || '').replace(/,/g, " ");
        const email = u.email || '';
        const role = u.role || '';
        const roll = u.roll_number || 'N/A';

        csv += `${u.id},"${name}","${email}","${role}","${roll}"\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.setAttribute("href", url);
    a.setAttribute("download", `analytics_users_registry_${new Date().toISOString().slice(0, 10)}.csv`);
    a.click();
    showToast("Exported users registry CSV!");
}

function getStatusBadgeHTML(status) {
    const s = (status || "").toLowerCase();
    if (s === 'pending') return `<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">Pending</span>`;
    if (s === 'in_progress') return `<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-primary border border-blue-200">Inprogress</span>`;
    if (s === 'resolve' || s === 'resolved') return `<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-successGreen border border-emerald-200">Resolve</span>`;
    if (s === 'resolve manual') return `<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">Resolve Manual</span>`;
    return `<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">${status || 'Unknown'}</span>`;
}

// Render Queries Table & Filters
function renderQueriesTable(filteredList = null) {
    const queries = filteredList || state.queries[0] || [];
    const tbody = document.getElementById("queries-table-body");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (queries.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-400 text-xs">No queries found matching filter criteria.</td></tr>`;
        return;
    }

    queries.forEach(q => {
        const studentName = q.student ? (q.student.name || 'Student') : 'N/A';
        const studentRoll = q.student ? q.student.roll_number : 'N/A';
        const submittedDate = q.submitted_at ? new Date(q.submitted_at).toLocaleString() : 'N/A';
        const escCount = q.escalations ? q.escalations.length : 0;
        
        const tr = document.createElement("tr");
        tr.className = "hover:bg-bgLight/50 transition-colors";
        tr.innerHTML = `
            <td class="p-3 font-mono text-xs font-bold text-slate-500">#${q.query_id}</td>
            <td class="p-3 font-semibold text-slate-800">${studentName}<br><span class="text-xs text-slate-400 font-normal">${studentRoll}</span></td>
            <td class="p-3 text-slate-700 max-w-xs">
                <span class="font-semibold block truncate">${q.query_subject || 'No Subject'}</span>
                <span class="text-xs text-slate-400 block">${q.category ? `Category: ${q.category}` : 'Uncategorized'}</span>
            </td>
            <td class="p-3">${getStatusBadgeHTML(q.status)}</td>
            <td class="p-3">
                ${escCount > 0 ? `<span class="px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-xs font-bold"><i class="fa-solid fa-triangle-exclamation mr-1"></i>${escCount}</span>` : `<span class="text-slate-400 text-xs">None</span>`}
            </td>
            <td class="p-3 text-xs text-slate-400">${submittedDate}</td>
            <td class="p-3 text-right">
                <button onclick="openQueryModal(${q.query_id})" class="px-3 py-1.5 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm">
                    <i class="fa-solid fa-pen-to-square mr-1"></i> Read / Reply
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterQueries() {
    const search = document.getElementById("query-search").value.toLowerCase();
    const statusFilter = document.getElementById("query-status-filter").value;

    const currentQueries = state.queries[0] || [];
    const filtered = currentQueries.filter(q => {
        const sName = q.student && q.student.name ? q.student.name.toLowerCase() : "";
        const sRoll = q.student && q.student.roll_number ? q.student.roll_number.toLowerCase() : "";
        const subject = (q.query_subject || "").toLowerCase();
        const body = (q.query_body || "").toLowerCase();

        const matchesSearch = sName.includes(search) || sRoll.includes(search) || subject.includes(search) || body.includes(search);
        
        let matchesStatus = true;
        if (statusFilter === "pending") matchesStatus = (q.status || "").toLowerCase() === "pending";
        else if (statusFilter === "in_progress") matchesStatus = (q.status || "").toLowerCase() === "in_progress";
        else if (statusFilter === "resolved") matchesStatus = (q.status || "").toLowerCase() === "resolve" || (q.status || "").toLowerCase() === "resolved";
        else if (statusFilter === "ESCALATED_24H") matchesStatus = hasRecentEscalations(q);

        return matchesSearch && matchesStatus;
    });

    renderQueriesTable(filtered);
}

// Open Query Modal & Single GET Fetch
async function openQueryModal(queryId) {
    try {
        const res = await fetch(`${QUERY_API_URL}/${queryId}`);
        if (!res.ok) throw new Error(`Query details fetch failed with status ${res.status}`);
        const q = await res.json();
        state.activeQuery = q;

        document.getElementById("modal-query-title").innerText = `Query #${q.query_id} Management`;
        document.getElementById("modal-query-subtitle").innerText = `Submitted: ${q.submitted_at ? new Date(q.submitted_at).toLocaleString() : 'N/A'}`;
        
        document.getElementById("modal-student-name").innerText = q.student ? (q.student.name || "N/A") : "N/A";
        document.getElementById("modal-student-roll").innerText = q.student ? q.student.roll_number : "N/A";
        document.getElementById("modal-student-email").innerText = q.student ? q.student.email : "N/A";

        document.getElementById("modal-query-subject").innerText = q.query_subject || "No Subject";
        document.getElementById("modal-query-body").innerText = q.query_body || "No Body Content";
        
        const replyArea = document.getElementById("modal-admin-reply");
        replyArea.value = ""; 
        replyArea.placeholder = q.reply ? `Previous Reply: "${q.reply}"\n\nType a new follow-up message...` : "Enter reply to student...";

        document.getElementById("modal-status-select").value = q.status || "pending";

        const escContainer = document.getElementById("modal-escalations-container");
        const escList = document.getElementById("modal-escalations-list");
        escList.innerHTML = "";
        
        if (q.escalations && q.escalations.length > 0) {
            escContainer.classList.remove("hidden");
            q.escalations.forEach(e => {
                const item = document.createElement("div");
                item.className = "p-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800";
                item.innerHTML = `<strong>Routed To Department:</strong> ${e.escalated_to} | <strong>Reason:</strong> ${e.reason}`;
                escList.appendChild(item);
            });
        } else {
            escContainer.classList.add("hidden");
        }

        document.getElementById("query-modal").classList.remove("hidden");
    } catch (err) {
        showToast(`Failed to load query details: ${err.message}`, "error");
    }
}

function closeQueryModal() {
    document.getElementById("query-modal").classList.add("hidden");
    state.activeQuery = null;
}

async function saveQueryUpdate() {
    if (!state.activeQuery) return;
    const queryId = state.activeQuery.query_id;
    const newReply = document.getElementById("modal-admin-reply").value.trim();
    const newStatus = document.getElementById("modal-status-select").value;

    const saveBtn = document.querySelector("#query-modal button[onclick='saveQueryUpdate()']");
    const originalHTML = saveBtn ? saveBtn.innerHTML : "";

    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.className = "px-4 py-1.5 bg-blue-400 text-white rounded-xl text-xs font-semibold cursor-not-allowed flex items-center";
        saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Sending...`;
    }

    try {
        const patchRes = await fetch(`${QUERY_API_URL}/${queryId}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                status: newStatus,
                reply: newReply
            })
        });
        if (!patchRes.ok) throw new Error("Could not update query status/reply.");

        showToast(`Query #${queryId} updated to status '${newStatus}'`);
        closeQueryModal();
        refreshData();
    } catch (err) {
        showToast(`Update error: ${err.message}`, "error");
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.className = "px-4 py-1.5 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors flex items-center";
            saveBtn.innerHTML = originalHTML;
        }
    }
}

// Render User Registry Table
function renderUsersTable() {
    const tbody = document.getElementById("users-table-body");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (state.users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400 text-xs">No registered users or students found in API.</td></tr>`;
        return;
    }

    state.users.forEach(u => {
        const rollDisplay = u.roll_number ? u.roll_number : '<span class="text-slate-300">N/A</span>';
        const tr = document.createElement("tr");
        tr.className = "hover:bg-bgLight/50 transition-colors";
        tr.innerHTML = `
            <td class="p-3 font-semibold text-slate-800">${u.name || 'Unnamed'}</td>
            <td class="p-3 font-semibold text-primary">${rollDisplay}</td>
            <td class="p-3 text-slate-600">${u.email}</td>
            <td class="p-3"><span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-softBlue text-primary border border-borderBlue">${u.role}</span></td>
            <td class="p-3 text-right">
                <button onclick="prefillDeleteUser('${u.email}', '${u.role}')" class="px-3 py-1 bg-rose-50 text-rose-600 rounded-xl text-xs font-medium hover:bg-rose-100 transition-colors">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// User Add Modal Handling
function openAddUserModal() {
    document.getElementById("add-user-form").reset();
    toggleRollNumberInput();
    document.getElementById("add-user-modal").classList.remove("hidden");
}

function closeAddUserModal() {
    document.getElementById("add-user-modal").classList.add("hidden");
}

function toggleRollNumberInput() {
    const role = document.getElementById("add-user-role").value;
    const rollContainer = document.getElementById("roll-number-container");
    const rollInput = document.getElementById("add-user-roll");
    if (role === "student") {
        rollContainer.classList.remove("hidden");
        rollInput.required = true;
    } else {
        rollContainer.classList.add("hidden");
        rollInput.required = false;
    }
}

async function handleAddUserSubmit(event) {
    event.preventDefault();
    const name = document.getElementById("add-user-name").value.trim() || null;
    const email = document.getElementById("add-user-email").value.trim();
    const role = document.getElementById("add-user-role").value;
    const roll_number = document.getElementById("add-user-roll").value.trim();

    const payload = { name, role, email, roll_number };

    const submitBtn = document.querySelector("#add-user-form button[type='submit']");
    const originalText = submitBtn ? submitBtn.innerHTML : "";

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Creating...`;
    }

    try {
        const targetUrl = `${API_BASE_URL}/create`;
        const Response = await fetch(targetUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!Response.ok) {
            const errorPayload = await Response.json();
            console.error("❌ Backend Rejected Transaction:", errorPayload.detail || errorPayload);
            showToast("Failed to create account.", "error");
            return;
        }

        const allUsersData = await Response.json();
        console.log("✅ Server Sync Complete. Saved Record Data:", allUsersData);
        showToast("Account created successfully!");
        closeAddUserModal();
        refreshData();
    } catch (err) {
        console.warn("⚠️ Network connection fault:", err);
        showToast("Network connection error.", "error");
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }
}

// User Delete Modal Handling
function openDeleteUserModal() {
    document.getElementById("delete-user-form").reset();
    document.getElementById("delete-user-modal").classList.remove("hidden");
}

function closeDeleteUserModal() {
    document.getElementById("delete-user-modal").classList.add("hidden");
}

function prefillDeleteUser(email, role) {
    openDeleteUserModal();
    document.getElementById("delete-user-email").value = email;
    document.getElementById("delete-user-role").value = role;
}

async function handleDeleteUserSubmit(event) {
    event.preventDefault();
    const email = document.getElementById("delete-user-email").value.trim();
    const role = document.getElementById("delete-user-role").value.toLowerCase();
    const reason = document.getElementById("delete-user-reason").value.trim() || "User requested account closure";

    const payload = { role, email, reason };

    const submitBtn = document.querySelector("#delete-user-form button[type='submit']");
    const originalText = submitBtn ? submitBtn.innerHTML : "";

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Deleting...`;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/delete`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            const errorMsg = errData.success || `Server returned ${res.status}`;
            showToast(errorMsg, "error");
            throw new Error(errorMsg);
        }

        const successData = await res.json();
        showToast(successData.success || "Account deleted successfully!", "success");
        closeDeleteUserModal();
        refreshData();
    } catch (err) {
        console.error("Purge failure trace:", err);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }
}

// Session Validation & User Interface Setup
function verifyAdminSession() {
    const storedSession = localStorage.getItem("user_session");
    if (!storedSession) {
        console.warn("No active session found. Redirecting to login.");
        window.location.replace("../01_Login/01_login.html");
        return;
    }

    try {
        const currentAdminSession = JSON.parse(storedSession);
        const role = (currentAdminSession.role || "").toLowerCase();

        // 🛠️ Fixed: Allow access if the role is EITHER admin OR head of department
        if (role !== "admin") {
            console.warn("Unauthorized role access attempt. Redirecting...");
            window.location.replace("../01_Login/01_login.html");
            return;
        }
        
        updateAdminProfileUI(currentAdminSession);
    } catch (e) {
        console.error("Failed to parse user session:", e);
        window.location.replace("../01_Login/01_login.html");
    }
}

function updateAdminProfileUI(admin) {
    const name = admin.name || "Admin User";
    const email = admin.email || "";
    const role = admin.role || "Administrator";

    const setElText = (id, txt) => {
        const el = document.getElementById(id);
        if (el) el.innerText = txt;
    };

    setElText("header-admin-name", name);
    setElText("profile-name-title", name);
    setElText("profile-name", name);
    setElText("profile-email", email);
    // Dynamically set title based on their actual role
    setElText("profile-roll-title", role.toLowerCase() === "head of department" ? "Head of Department" : "System Administrator");
}

function handleLogout() {
    showToast("Logging out from your session...", "info");
    localStorage.removeItem("user_session");
    
    setTimeout(() => {
        window.location.href = "../01_Login/01_login.html"; 
    }, 1000);
}