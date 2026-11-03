// API Configuration Constants
const API_BASE_URL = window.getApiUrl ? window.getApiUrl("admin") : "http://127.0.0.1:8000/api/admin";
const API_BASE_URL_QUERY = window.getApiUrl ? window.getApiUrl() : "http://127.0.0.1:8000/api";
const QUERY_API_URL = `${API_BASE_URL_QUERY}/query`;
const ADMIN_API_URL = `${API_BASE_URL}/`;

// Application State
let state = {
    queries: [],
    users: [],
    activeQuery: null
};

let currentUser = null;
let hodPollTimer = null;

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatChatTime(dateStr) {
    if (!dateStr) return "";
    try {
        const d = new Date(dateStr);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return "";
    }
}

// Helper: Check if query belongs to or is routed to Admin (HOD cannot view admin queries)
function isAdminQuery(q) {
    if (!q) return false;
    const cat = (q.category || '').toLowerCase().trim();
    const userRole = (q.user && q.user.role ? q.user.role : '').toLowerCase().trim();
    return cat === 'admin' || userRole === 'admin';
}

// Helper: Check if user has admin role (HOD cannot view or manage admin accounts)
function isAdminUser(u) {
    if (!u) return false;
    const role = (u.role || '').toLowerCase().trim();
    return role === 'admin';
}

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

// API Request 1: Fetch All Queries (Filtering out Admin queries)
async function fetchQueries() {
    try {
        setGlobalLoading(true);
        const res = await fetch(`${QUERY_API_URL}/`);
        await setGlobalLoading(false);
        if (!res.ok) throw new Error(`Query API error: ${res.status}`);
        const data = await res.json();
        const rawQueries = Array.isArray(data) ? data : [];
        // HOD cannot view admin queries
        const nonAdminQueries = rawQueries.filter(q => !isAdminQuery(q));
        state.queries = [nonAdminQueries];
    } catch (err) {
        console.error("Failed to fetch queries:", err);
        showToast(`Failed to load queries: ${err.message}`, "error");
        state.queries = [[]];
    }
}

// API Request 2: Fetch Combined Users & Students (Filtering out Admin accounts)
async function fetchUsers() {
    try {
        setGlobalLoading(true);
        const res = await fetch(ADMIN_API_URL);
        await setGlobalLoading(false);
        if (!res.ok) throw new Error(`Admin API error: ${res.status}`);
        const data = await res.json();
        const rawUsers = Array.isArray(data) ? data : [];
        // HOD cannot view admin accounts
        state.users = rawUsers.filter(u => !isAdminUser(u));
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
    const bgCol = type === "success" ? "bg-emerald-600" : type === "error" ? "bg-rose-600" : "bg-blue-600";
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
        btn.className = "nav-btn w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors";
    });
    const activeBtn = document.getElementById(`nav-${tabId}`);
    if (activeBtn) {
        activeBtn.className = "nav-btn w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm bg-blue-50 text-blue-600 border border-blue-200 transition-colors";
    }

    const titles = {
        dashboard: "Dashboard Overview",
        analytics: "Analytics & System Reports",
        queries: "Query Management & History",
        users: "User & Student Registry",
        profile: "HOD Profile & Credentials"
    };
    const pageTitle = document.getElementById("page-title");
    if (pageTitle) pageTitle.innerText = titles[tabId] || "HOD Dashboard";
    
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
    const queries = (state.queries[0] || []).filter(q => !isAdminQuery(q));
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
        const msgList = q.messages || [];
        const msgCount = msgList.length || (q.reply ? 1 : 0);
        const latestMsg = msgList.length > 0 ? msgList[msgList.length - 1] : null;
        const hasNewStudentMsg = latestMsg ? (latestMsg.sender_role || '').toLowerCase() === 'student' : false;

        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-50 transition-colors";
        tr.innerHTML = `
            <td class="p-3 font-semibold text-slate-800">${studentName}<br><span class="text-xs text-slate-400 font-normal">${studentRoll}</span></td>
            <td class="p-3 text-slate-600 truncate max-w-xs">
                <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="font-medium text-slate-900 truncate">${q.query_subject || 'No Subject'}</span>
                    ${hasNewStudentMsg ? `<span class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse"><i class="fa-solid fa-bell text-[8px]"></i> New</span>` : ''}
                </div>
                <div class="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                    <span class="truncate">${q.query_body || ''}</span>
                    ${msgCount > 0 ? `<span class="inline-flex items-center gap-1 text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200 shrink-0"><i class="fa-regular fa-comment-dots text-blue-600"></i> ${msgCount}</span>` : ''}
                </div>
            </td>
            <td class="p-3">${getStatusBadgeHTML(q.status)}</td>
            <td class="p-3">
                <button onclick="openQueryModal(${q.query_id})" class="px-3 py-1 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors shadow-xs flex items-center gap-1.5">
                    <i class="fa-regular fa-comment-dots text-xs"></i>
                    <span>Chat</span>
                </button>
            </td>
        `;
        recentBody.appendChild(tr);
    });
    renderAnalyticsCharts();
}

// Render KPI Metrics and Chart.js Charts
function renderAnalyticsCharts() {
    const queries = (state.queries[0] || []).filter(q => !isAdminQuery(q));

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

    const nonAdminUsers = state.users.filter(u => !isAdminUser(u));

    setInnerTxt("metric-resolution-rate", `${resRate}%`);
    setInnerTxt("metric-escalations-24h", escalations24h);
    setInnerTxt("metric-total-queries", total);
    setInnerTxt("metric-user-count", nonAdminUsers.length);

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
                    backgroundColor: ['#FDE047', '#2563EB', '#059669'],
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
                    backgroundColor: ['#EAB308', '#2563EB', '#059669', '#E11D48'],
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
    const queries = (state.queries[0] || []).filter(q => !isAdminQuery(q));
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
    const visibleUsers = state.users.filter(u => !isAdminUser(u));
    if (visibleUsers.length === 0) {
        showToast("No user data available to export.", "error");
        return;
    }

    let csv = "ID,Name,Email,Role,Roll Number\n";
    visibleUsers.forEach(u => {
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
    if (s === 'pending') return `<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-50 text-yellow-800 border border-yellow-200">Pending</span>`;
    if (s === 'in_progress') return `<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200">Inprogress</span>`;
    if (s === 'resolve' || s === 'resolved') return `<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">Resolve</span>`;
    if (s === 'resolve manual') return `<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300">Resolve Manual</span>`;
    return `<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">${status || 'Unknown'}</span>`;
}

// Render Queries Table & Filters
function renderQueriesTable(filteredList = null) {
    const queries = (filteredList || state.queries[0] || []).filter(q => !isAdminQuery(q));
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
        const msgList = q.messages || [];
        const msgCount = msgList.length || (q.reply ? 1 : 0);
        const latestMsg = msgList.length > 0 ? msgList[msgList.length - 1] : null;
        const hasNewStudentMsg = latestMsg ? (latestMsg.sender_role || '').toLowerCase() === 'student' : false;
        
        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-50 transition-colors";
        tr.innerHTML = `
            <td class="p-3 font-mono text-xs font-bold text-blue-600">#${q.query_id}</td>
            <td class="p-3 font-semibold text-slate-800">${studentName}<br><span class="text-xs text-slate-400 font-normal">${studentRoll}</span></td>
            <td class="p-3 text-slate-700 max-w-xs space-y-1">
                <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="font-semibold text-slate-900 truncate">${q.query_subject || 'No Subject'}</span>
                    ${hasNewStudentMsg ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse"><span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span><i class="fa-solid fa-bell text-[9px]"></i> New Message</span>` : ''}
                </div>
                <div class="flex items-center gap-2 text-xs">
                    <span class="text-slate-400">${q.category ? `Category: ${q.category}` : 'Uncategorized'}</span>
                    ${msgCount > 0 ? `<span class="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200"><i class="fa-regular fa-comment-dots text-blue-600"></i> ${msgCount} ${msgCount === 1 ? 'msg' : 'msgs'}</span>` : ''}
                </div>
            </td>
            <td class="p-3">${getStatusBadgeHTML(q.status)}</td>
            <td class="p-3">
                ${escCount > 0 ? `<span class="px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-xs font-bold"><i class="fa-solid fa-triangle-exclamation mr-1"></i>${escCount}</span>` : `<span class="text-slate-400 text-xs">None</span>`}
            </td>
            <td class="p-3 text-xs text-slate-400">${submittedDate}</td>
            <td class="p-3 text-right">
                <button onclick="openQueryModal(${q.query_id})" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5 ml-auto active:scale-95">
                    ${hasNewStudentMsg ? '<span class="relative flex h-2 w-2 mr-0.5"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-75"></span><span class="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span></span>' : ''}
                    <i class="fa-regular fa-comment-dots text-sm"></i> Chat / Reply
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterQueries() {
    const search = document.getElementById("query-search").value.toLowerCase();
    const statusFilter = document.getElementById("query-status-filter").value;

    const currentQueries = (state.queries[0] || []).filter(q => !isAdminQuery(q));
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

// Open Query Modal & Single GET Fetch (WhatsApp Style)
async function openQueryModal(queryId) {
    try {
        setGlobalLoading(true);
        const res = await fetch(`${API_BASE_URL_QUERY}/message/${queryId}`);
        await setGlobalLoading(false);
        if (!res.ok) throw new Error(`Query details fetch failed with status ${res.status}`);
        const q = await res.json();

        // Restriction: HOD cannot view admin queries
        if (isAdminQuery(q)) {
            showToast("Access Restricted: HOD cannot view Admin queries.", "error");
            return;
        }

        state.activeQuery = q;

        document.getElementById("modal-query-title").innerText = `Query #${q.query_id} Conversation`;
        document.getElementById("modal-query-subtitle").innerText = `Student: ${q.student ? (q.student.name || "N/A") : "N/A"} (${q.student ? q.student.email : "N/A"})`;
        
        document.getElementById("modal-student-name").innerText = q.student ? (q.student.name || "N/A") : "N/A";
        document.getElementById("modal-student-roll").innerText = q.student ? q.student.roll_number : "N/A";
        document.getElementById("modal-student-email").innerText = q.student ? q.student.email : "N/A";

        document.getElementById("modal-query-subject").innerText = q.query_subject || "No Subject";
        document.getElementById("modal-query-body").innerText = q.query_body || "No Body Content";
        const dateEl = document.getElementById("modal-query-date");
        if (dateEl) dateEl.innerText = q.submitted_at ? new Date(q.submitted_at).toLocaleString() : '';

        const badgeEl = document.getElementById("modal-status-badge");
        if (badgeEl) {
            badgeEl.innerText = (q.status || 'pending').toUpperCase();
            badgeEl.className = `px-2 py-0.5 rounded-full text-[10px] font-bold ${
                q.status === 'resolved' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
                q.status === 'in_progress' ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
            }`;
        }

        const replyArea = document.getElementById("modal-admin-reply");
        replyArea.value = "";

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

        const msgList = q.messages || [];
        const latestMsg = msgList.length > 0 ? msgList[msgList.length - 1] : null;
        const hasNewStudentMsg = latestMsg ? (latestMsg.sender_role || '').toLowerCase() === 'student' : false;
        const newMsgBadge = document.getElementById("modal-new-msg-badge");
        if (newMsgBadge) {
            if (hasNewStudentMsg) newMsgBadge.classList.remove("hidden");
            else newMsgBadge.classList.add("hidden");
        }
        const countText = document.getElementById("modal-chat-count-text");
        if (countText) {
            countText.innerText = `${msgList.length} ${msgList.length === 1 ? 'Message' : 'Messages'}`;
        }

        renderChatTimeline(q.messages || []);
        document.getElementById("query-modal").classList.remove("hidden");

        // Fetch AI draft reply suggestions for staff
        fetchAiDraftSuggestions(queryId);

        const chatBox = document.getElementById("modal-chat-timeline");
        if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;

        // Setup real-time polling every 3 seconds while modal is open
        if (hodPollTimer) clearInterval(hodPollTimer);
        hodPollTimer = setInterval(() => {
            if (state.activeQuery && state.activeQuery.query_id === queryId) {
                refreshModalMessages(queryId, true);
            }
        }, 3000);

    } catch (err) {
        showToast(`Failed to load query details: ${err.message}`, "error");
    }
}

async function refreshModalMessages(queryId, silent = false) {
    if (!state.activeQuery || state.activeQuery.query_id !== queryId) return;
    try {
        const res = await fetch(`${API_BASE_URL_QUERY}/message/${queryId}`);
        if (res.ok) {
            const data = await res.json();
            if (isAdminQuery(data)) {
                closeQueryModal();
                showToast("Access Restricted: Admin query.", "error");
                return;
            }
            state.activeQuery.messages = data.messages || [];
            state.activeQuery.status = data.status;
            const msgs = data.messages || [];
            const latestMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
            const hasNewStudentMsg = latestMsg ? (latestMsg.sender_role || '').toLowerCase() === 'student' : false;
            const newMsgBadge = document.getElementById("modal-new-msg-badge");
            if (newMsgBadge) {
                if (hasNewStudentMsg) newMsgBadge.classList.remove("hidden");
                else newMsgBadge.classList.add("hidden");
            }
            const countText = document.getElementById("modal-chat-count-text");
            if (countText) {
                countText.innerText = `${msgs.length} ${msgs.length === 1 ? 'Message' : 'Messages'}`;
            }

            renderChatTimeline(data.messages || []);
            const badgeEl = document.getElementById("modal-status-badge");
            if (badgeEl) {
                badgeEl.innerText = (data.status || 'pending').toUpperCase();
                badgeEl.className = `px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    data.status === 'resolved' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
                    data.status === 'in_progress' ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                }`;
            }
        }
    } catch (e) {
        if (!silent) console.error("Error refreshing modal messages:", e);
    }
}

function renderChatTimeline(messages) {
    const container = document.getElementById("modal-chat-timeline");
    if (!container) return;

    if (!messages || messages.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 bg-white/80 rounded-2xl border border-dashed border-slate-200">
                <div class="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2 text-base">
                    <i class="fa-solid fa-comments"></i>
                </div>
                <p class="text-xs font-semibold text-slate-700">No conversation history yet</p>
                <p class="text-[11px] text-slate-400 mt-0.5">Send a message below to reply to the student.</p>
            </div>
        `;
        return;
    }

    const previousScrollHeight = container.scrollHeight;
    const isScrolledToBottom = (container.scrollHeight - container.scrollTop - container.clientHeight) < 60;

    container.innerHTML = messages.map(msg => {
        const role = (msg.sender_role || "").toLowerCase();
        // A message is "self" for HOD ONLY if sender_role is head of department / hod
        const isSelf = role === "head of department" || role === "hod";
        const timeStr = formatChatTime(msg.sent_at);
        const roleDisplay = role ? role.toUpperCase() : "USER";

        let senderLabel = msg.sender_name || "";
        if (!senderLabel) {
            if (role === "student") {
                senderLabel = (state.activeQuery && state.activeQuery.student) ? (state.activeQuery.student.name || "Student") : "Student";
            } else {
                senderLabel = roleDisplay;
            }
        }

        if (isSelf) {
            return `
                <div class="flex justify-end my-2">
                    <div class="max-w-[85%] sm:max-w-[75%] bg-blue-600 text-white rounded-2xl rounded-tr-xs px-4 py-2.5 shadow-xs space-y-1">
                        <div class="flex items-center justify-between gap-3 text-[10px] text-blue-100 font-bold">
                            <span>You</span>
                            <span class="text-[9px] font-normal text-blue-200">${timeStr}</span>
                        </div>
                        <p class="text-xs text-white leading-relaxed whitespace-pre-wrap select-text">${escapeHtml(msg.message_body || '')}</p>
                    </div>
                </div>
            `;
        } else {
            const isStudent = role === "student";
            return `
                <div class="flex justify-start my-2">
                    <div class="max-w-[85%] sm:max-w-[75%] bg-white text-slate-800 rounded-2xl rounded-tl-xs px-4 py-2.5 shadow-xs border border-slate-200 space-y-1">
                        <div class="flex items-center justify-between gap-3 text-[10px] mb-1">
                            <span class="font-bold text-blue-600 flex items-center gap-1.5">
                                <i class="fa-solid ${isStudent ? 'fa-graduation-cap' : 'fa-shield-halved'} text-[11px]"></i>
                                ${escapeHtml(senderLabel)}
                                <span class="bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded text-[9px] font-semibold border border-blue-200">${escapeHtml(roleDisplay)}</span>
                            </span>
                            <span class="text-[9px] text-slate-400 font-normal">${timeStr}</span>
                        </div>
                        <p class="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap select-text">${escapeHtml(msg.message_body || '')}</p>
                    </div>
                </div>
            `;
        }
    }).join('');

    if (isScrolledToBottom || previousScrollHeight === 0) {
        container.scrollTop = container.scrollHeight;
    }
}

let currentAiDrafts = [];

function closeQueryModal() {
    if (hodPollTimer) {
        clearInterval(hodPollTimer);
        hodPollTimer = null;
    }
    document.getElementById("query-modal").classList.add("hidden");
    state.activeQuery = null;
    currentAiDrafts = [];
    const draftChips = document.getElementById("ai-draft-chips");
    if (draftChips) {
        draftChips.innerHTML = `<span class="text-[11px] text-slate-400 italic">Select a query to load suggestions...</span>`;
    }
    refreshData();
}

async function fetchAiDraftSuggestions(queryId) {
    const container = document.getElementById("ai-draft-chips");
    const refreshBtn = document.getElementById("btn-refresh-ai-draft");
    if (!container || !queryId) return;

    if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-[10px]"></i><span>Generating...</span>`;
    }
    container.innerHTML = `
        <div class="flex items-center gap-2 py-1 text-xs text-blue-600 font-medium">
            <i class="fa-solid fa-spinner fa-spin text-xs"></i>
            <span>Generating AI draft suggestions...</span>
        </div>
    `;

    try {
        const q = state.activeQuery;
        const payload = {
            query_id: queryId,
            query_subject: q ? q.query_subject : "",
            query_body: q ? q.query_body : "",
            category: q ? q.category : "Head Of Department",
            student_name: (q && q.student) ? (q.student.name || "Student") : "Student",
            staff_role: "Head of Department",
            staff_name: currentUser ? (currentUser.name || "Head of Department") : "Head of Department"
        };
        const res = await fetch(`${API_BASE_URL_QUERY}/query/${queryId}/ai-draft-reply`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            const data = await res.json();
            currentAiDrafts = data.suggestions || [];
            renderAiDraftChips(currentAiDrafts);
        } else {
            renderAiDraftChips([]);
        }
    } catch (err) {
        console.error("AI Draft generation error:", err);
        renderAiDraftChips([]);
    } finally {
        if (refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = `<i class="fa-solid fa-rotate text-[10px]"></i><span>Regenerate</span>`;
        }
    }
}

function renderAiDraftChips(suggestions) {
    const container = document.getElementById("ai-draft-chips");
    if (!container) return;
    if (!suggestions || suggestions.length === 0) {
        container.innerHTML = `<span class="text-xs text-slate-400">Click Regenerate to fetch AI drafts.</span>`;
        return;
    }
    const icons = {
        "Detailed Guidance": "fa-solid fa-lightbulb text-amber-500",
        "Review / In-Progress": "fa-solid fa-clock-rotate-left text-blue-500",
        "Issue Resolved": "fa-solid fa-circle-check text-emerald-500"
    };
    container.innerHTML = suggestions.map((s, idx) => `
        <button type="button" onclick="applyAiDraft(${idx})" class="group flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-blue-600 text-blue-700 hover:text-white rounded-lg text-xs font-semibold border border-blue-200 hover:border-blue-600 transition-all shadow-xs active:scale-95 text-left" title="Click to insert draft into reply box">
            <i class="${icons[s.title] || 'fa-solid fa-wand-magic-sparkles text-blue-500'} text-[11px] group-hover:text-white"></i>
            <span>${escapeHtml(s.title)}</span>
        </button>
    `).join('');
}

function applyAiDraft(index) {
    const draft = currentAiDrafts[index];
    if (!draft) return;
    const replyInput = document.getElementById("modal-admin-reply");
    if (replyInput) {
        replyInput.value = draft.text;
        replyInput.focus();
        replyInput.classList.add("ring-2", "ring-blue-600");
        setTimeout(() => replyInput.classList.remove("ring-2", "ring-blue-600"), 1200);
    }
}

async function saveQueryUpdate() {
    if (!state.activeQuery) return;
    const queryId = state.activeQuery.query_id;
    const newReply = document.getElementById("modal-admin-reply").value.trim();
    const newStatus = document.getElementById("modal-status-select").value;

    if (!newReply && newStatus === state.activeQuery.status) {
        showToast("Please enter a message or change status.", "info");
        return;
    }

    const saveBtn = document.querySelector("#query-modal button[onclick='saveQueryUpdate()']");
    const originalHTML = saveBtn ? saveBtn.innerHTML : "";

    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Sending...`;
    }

    try {
        if (newReply) {
            const payload = {
                sender_id: currentUser ? currentUser.id : 2,
                sender_name: currentUser ? (currentUser.name || "Head of Department") : "Head of Department",
                sender_role: "head of department",
                message_body: newReply,
                status: newStatus
            };
            const postRes = await fetch(`${API_BASE_URL_QUERY}/message/${queryId}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (!postRes.ok) throw new Error("Could not send reply.");
            document.getElementById("modal-admin-reply").value = "";
            showToast("Reply sent successfully!", "success");
            await refreshModalMessages(queryId, true);
        } else {
            const patchRes = await fetch(`${QUERY_API_URL}/${queryId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus })
            });
            if (!patchRes.ok) throw new Error("Could not update status.");
            showToast(`Status updated to ${newStatus}`, "success");
            await refreshModalMessages(queryId, true);
        }
    } catch (err) {
        showToast(`Error: ${err.message}`, "error");
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalHTML;
        }
    }
}

// Render User Registry Table
function renderUsersTable() {
    const tbody = document.getElementById("users-table-body");
    if (!tbody) return;
    tbody.innerHTML = "";

    const visibleUsers = state.users.filter(u => !isAdminUser(u));

    if (visibleUsers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-400 text-xs">No registered users or students found in API.</td></tr>`;
        return;
    }

    visibleUsers.forEach(u => {
        const rollDisplay = u.roll_number ? escapeHtml(u.roll_number) : '<span class="text-slate-300">N/A</span>';
        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-50 transition-colors";
        tr.innerHTML = `
            <td class="p-3 font-semibold text-slate-800">${escapeHtml(u.name || 'Unnamed')}</td>
            <td class="p-3 font-semibold text-blue-600">${rollDisplay}</td>
            <td class="p-3 text-slate-600">${escapeHtml(u.email || '')}</td>
            <td class="p-3"><span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200">${escapeHtml(u.role || '')}</span></td>
            <td class="p-3 text-right">
                <button onclick="prefillDeleteUser('${escapeHtml(u.email || '')}', '${escapeHtml(u.role || '')}')" class="px-3 py-1 bg-rose-50 text-rose-600 rounded-xl text-xs font-medium hover:bg-rose-100 border border-rose-200 transition-colors">Delete</button>
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
    const role = document.getElementById("add-user-role").value.trim();
    const roll_number = document.getElementById("add-user-roll").value.trim();

    // Security check: HOD cannot create admin accounts
    if (role.toLowerCase() === 'admin') {
        showToast("Access Denied: Head of Department cannot create Admin accounts.", "error");
        return;
    }

    const payload = { name, role, email, roll_number };

    const submitBtn = document.querySelector("#add-user-form button[type='submit']");
    const originalText = submitBtn ? submitBtn.innerHTML : "";

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Creating...`;
    }

    try {
        const targetUrl = `${API_BASE_URL}/create`;
        setGlobalLoading(true)
        const Response = await fetch(targetUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        setGlobalLoading(false)
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
    if ((role || '').toLowerCase().trim() === 'admin') {
        showToast("Access Denied: Head of Department cannot delete Admin accounts.", "error");
        return;
    }
    openDeleteUserModal();
    document.getElementById("delete-user-email").value = email;
    document.getElementById("delete-user-role").value = role;
}

async function handleDeleteUserSubmit(event) {
    event.preventDefault();
    const email = document.getElementById("delete-user-email").value.trim();
    const role = document.getElementById("delete-user-role").value.toLowerCase().trim();
    const reason = document.getElementById("delete-user-reason").value.trim() || "User requested account closure";

    // Security check: HOD cannot delete admin accounts
    if (role === 'admin') {
        showToast("Access Denied: Head of Department cannot delete Admin accounts.", "error");
        return;
    }

    const payload = { role, email, reason };

    const submitBtn = document.querySelector("#delete-user-form button[type='submit']");
    const originalText = submitBtn ? submitBtn.innerHTML : "";

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Deleting...`;
    }

    try {
        setGlobalLoading(true)
        const res = await fetch(`${API_BASE_URL}/delete`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        setGlobalLoading(false)
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
        if (role !== "admin" && role !== "head of department") {
            console.warn("Unauthorized role access attempt. Redirecting...");
            window.location.replace("../01_Login/01_login.html");
            return;
        }
        
        currentUser = currentAdminSession;
        updateAdminProfileUI(currentAdminSession);
    } catch (e) {
        console.error("Failed to parse user session:", e);
        window.location.replace("../01_Login/01_login.html");
    }
}

function updateAdminProfileUI(admin) {
    const name = admin.name || "Head of Department";
    const email = admin.email || "";
    const role = admin.role || "Head of Department";

    const setElText = (id, txt) => {
        const el = document.getElementById(id);
        if (el) el.innerText = txt;
    };

    setElText("header-admin-name", name);
    setElText("profile-name-title", name);
    setElText("profile-name", name);
    setElText("profile-email", email);
    setElText("profile-roll-title", "Head of Department");
}

function handleLogout() {
    showToast("Logging out from your session...", "info");
    localStorage.removeItem("user_session");
    
    setTimeout(() => {
        window.location.href = "../01_Login/01_login.html"; 
    }, 1000);
}