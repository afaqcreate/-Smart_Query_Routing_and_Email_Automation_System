// API Configuration Constants
const API_BASE_URL = window.getApiUrl ? window.getApiUrl("admin") : "http://127.0.0.1:8000/api/admin";
const API_BASE_URL_QUERY = window.getApiUrl ? window.getApiUrl() : "http://127.0.0.1:8000/api";
const QUERY_API_URL = `${API_BASE_URL_QUERY}/query`;
const ADMIN_API_URL = `${API_BASE_URL}/`;
const ANNOUNCEMENTS_API_URL = window.getApiUrl ? window.getApiUrl("announcements") : `${API_BASE_URL_QUERY}/announcements`;

// Application State
let state = {
    queries: [],
    users: [],
    announcements: [],
    announcementsFilter: 'all',
    activeQuery: null
};

let currentUser = null;
let adminPollTimer = null;

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
    await Promise.all([fetchQueries(), fetchUsers(), fetchAnnouncements()]);
    renderDashboard();
    renderQueriesTable();
    renderUsersTable();
    renderAnalyticsCharts();
}

// API Request 1: Fetch All Queries
async function fetchQueries() {
    try {
        setGlobalLoading(true)
        const res = await fetch(`${QUERY_API_URL}/`);
        setGlobalLoading(false)
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
        setGlobalLoading(true)
        const res = await fetch(ADMIN_API_URL);
        setGlobalLoading(false)
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
        broadcast: "Broadcast Announcements to Students",
        analytics: "Analytics & System Reports",
        queries: "Query Management & History",
        users: "User & Student Registry",
        profile: "Admin Profile & Credentials"
    };
    const pageTitle = document.getElementById("page-title");
    if (pageTitle) pageTitle.innerText = titles[tabId] || "Admin Dashboard";
    
    const sidebar = document.getElementById("sidebar");
    if (sidebar) sidebar.classList.add("-translate-x-full");

    if (tabId === "broadcast") {
        fetchAnnouncements();
    } else if (tabId === "analytics") {
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
    if (s === 'pending') return `<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-50 text-yellow-800 border border-yellow-200">Pending</span>`;
    if (s === 'in_progress') return `<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200">Inprogress</span>`;
    if (s === 'resolve' || s === 'resolved') return `<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">Resolve</span>`;
    if (s === 'resolve manual') return `<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300">Resolve Manual</span>`;
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

// Open Query Modal & Single GET Fetch (WhatsApp Style)
async function openQueryModal(queryId) {
    try {
        setGlobalLoading(true);
        const res = await fetch(`${API_BASE_URL_QUERY}/message/${queryId}`);
        await setGlobalLoading(false);
        if (!res.ok) throw new Error(`Query details fetch failed with status ${res.status}`);
        const q = await res.json();
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
        if (adminPollTimer) clearInterval(adminPollTimer);
        adminPollTimer = setInterval(() => {
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
        // A message is "self" for Admin ONLY if it was sent by an admin
        const isSelf = role === "admin";
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
    if (adminPollTimer) {
        clearInterval(adminPollTimer);
        adminPollTimer = null;
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
            category: q ? q.category : "General",
            student_name: (q && q.student) ? (q.student.name || "Student") : "Student",
            staff_role: "Admin",
            staff_name: currentUser ? (currentUser.name || "Admin") : "Admin"
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
                sender_id: currentUser ? currentUser.id : 1,
                sender_name: currentUser ? (currentUser.name || "Admin") : "Admin",
                sender_role: "admin",
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

    if (state.users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400 text-xs">No registered users or students found in API.</td></tr>`;
        return;
    }

    state.users.forEach(u => {
        const rollDisplay = u.roll_number ? u.roll_number : '<span class="text-slate-300">N/A</span>';
        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-50 transition-colors";
        tr.innerHTML = `
            <td class="p-3 font-semibold text-slate-800">${u.name || 'Unnamed'}</td>
            <td class="p-3 font-semibold text-blue-600">${rollDisplay}</td>
            <td class="p-3 text-slate-600">${u.email}</td>
            <td class="p-3"><span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200">${u.role}</span></td>
            <td class="p-3 text-right">
                <button onclick="prefillDeleteUser('${u.email}', '${u.role}')" class="px-3 py-1 bg-rose-50 text-rose-600 rounded-xl text-xs font-medium hover:bg-rose-100 border border-rose-200 transition-colors">Delete</button>
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
        setGlobalLoading(true)
        const targetUrl = `${API_BASE_URL}/create`;
        setGlobalLoading(false)
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
        if (role !== "admin") {
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

// ==========================================
// CAMPUS ANNOUNCEMENT & BROADCAST SYSTEM
// (STRICTLY AUTHORIZED ONLY FOR ADMIN USERS)
// ==========================================

async function fetchAnnouncements() {
    try {
        const res = await fetch(`${ANNOUNCEMENTS_API_URL}/?active_only=false`);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        state.announcements = Array.isArray(data) ? data : [];
    } catch (err) {
        console.error("Error fetching announcements:", err);
        state.announcements = [];
    }
    updateBroadcastMetrics();
    renderAdminBroadcasts();
}

function updateBroadcastMetrics() {
    const activeList = state.announcements.filter(a => a.is_active);
    const activeCount = activeList.length;

    const navBadge = document.getElementById("nav-broadcast-badge");
    if (navBadge) {
        if (activeCount > 0) {
            navBadge.innerText = activeCount;
            navBadge.classList.remove("hidden");
        } else {
            navBadge.classList.add("hidden");
        }
    }

    const headerCount = document.getElementById("admin-broadcast-active-count");
    if (headerCount) headerCount.innerText = activeCount;

    const dashBadge = document.getElementById("dashboard-broadcast-badge");
    if (dashBadge) dashBadge.innerText = `${activeCount} Active`;
}

function setAdminBroadcastFilter(filter) {
    state.announcementsFilter = filter;
    ['all', 'active', 'urgent'].forEach(f => {
        const btn = document.getElementById(`btn-bcast-filter-${f}`);
        if (!btn) return;
        if (f === filter) {
            btn.className = "px-2.5 py-1 rounded-lg font-bold bg-white text-blue-600 shadow-xs transition cursor-pointer";
        } else {
            btn.className = "px-2.5 py-1 rounded-lg font-medium text-slate-600 hover:text-blue-600 transition cursor-pointer";
        }
    });
    renderAdminBroadcasts();
}

function renderAdminBroadcasts() {
    const container = document.getElementById("admin-broadcasts-list");
    if (!container) return;

    let list = state.announcements || [];
    if (state.announcementsFilter === 'active') {
        list = list.filter(a => a.is_active);
    } else if (state.announcementsFilter === 'urgent') {
        list = list.filter(a => (a.priority || '').toLowerCase() === 'urgent');
    }

    if (list.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-12 px-4 border border-dashed border-slate-200 rounded-2xl text-center bg-slate-50/50">
                <div class="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                    <i class="fa-solid fa-bullhorn text-xl"></i>
                </div>
                <h5 class="text-sm font-bold text-slate-800">No announcements found</h5>
                <p class="text-xs text-slate-400 max-w-sm mt-1">Use the form on the left to broadcast official updates, schedules, or urgent campus alerts to all students.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = list.map(item => {
        const priority = (item.priority || 'normal').toLowerCase();
        let prioBadge = '';
        let cardBorder = 'border-slate-200';

        if (priority === 'urgent') {
            prioBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1"><i class="fa-solid fa-triangle-exclamation text-[9px]"></i> Urgent Alert</span>';
            cardBorder = 'border-rose-200 bg-rose-50/20';
        } else if (priority === 'important') {
            prioBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1"><i class="fa-solid fa-star text-[9px]"></i> Important</span>';
            cardBorder = 'border-amber-200 bg-amber-50/10';
        } else {
            prioBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200">Normal</span>';
        }

        const statusPill = item.is_active
            ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active</span>'
            : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">Archived</span>';

        const categoryPill = `<span class="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700">${escapeHtml(item.category || 'General')}</span>`;

        let formattedDate = "";
        try {
            formattedDate = new Date(item.created_at).toLocaleString([], {
                month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });
        } catch (e) {
            formattedDate = item.created_at || "";
        }

        return `
            <div class="p-4 rounded-xl border ${cardBorder} bg-white shadow-xs transition hover:shadow-sm space-y-2.5">
                <div class="flex items-start justify-between gap-3">
                    <div class="space-y-1 flex-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            ${statusPill}
                            ${prioBadge}
                            ${categoryPill}
                            <span class="text-[11px] text-slate-400">${formattedDate}</span>
                        </div>
                        <h5 class="text-sm font-bold text-slate-900 break-words">${escapeHtml(item.title)}</h5>
                    </div>
                </div>

                <p class="text-xs text-slate-600 leading-relaxed whitespace-pre-line font-sans break-words">${escapeHtml(item.message)}</p>

                <div class="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                    <span class="text-slate-400 flex items-center gap-1">
                        <i class="fa-solid fa-user-shield text-blue-500"></i>
                        <span>By ${escapeHtml(item.admin_name || 'Admin')}</span>
                    </span>
                    <div class="flex items-center gap-2">
                        <button onclick="toggleAnnouncementStatus(${item.id})" class="px-2.5 py-1 text-xs rounded-lg font-semibold transition border ${item.is_active ? 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'} cursor-pointer">
                            ${item.is_active ? '<i class="fa-solid fa-box-archive mr-1"></i> Archive' : '<i class="fa-solid fa-rotate-left mr-1"></i> Restore'}
                        </button>
                        <button onclick="deleteAnnouncement(${item.id})" class="px-2.5 py-1 text-xs rounded-lg font-semibold bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition cursor-pointer">
                            <i class="fa-solid fa-trash-can mr-1"></i> Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join("");
}

async function handleBroadcastSubmit(event) {
    if (event) event.preventDefault();

    if (!currentUser || (currentUser.role || '').toLowerCase() !== 'admin') {
        showToast("Access Denied: Only administrators can broadcast announcements.", "error");
        return;
    }

    const titleInput = document.getElementById("broadcast-title");
    const msgInput = document.getElementById("broadcast-message");
    const catInput = document.getElementById("broadcast-category");
    const prioInput = document.getElementById("broadcast-priority");
    const submitBtn = document.getElementById("btn-submit-broadcast");

    const title = titleInput ? titleInput.value.trim() : "";
    const message = msgInput ? msgInput.value.trim() : "";
    const category = catInput ? catInput.value : "General";
    const priority = prioInput ? prioInput.value : "normal";

    if (!title || !message) {
        showToast("Please enter both title and message.", "error");
        return;
    }

    const originalBtnHtml = submitBtn ? submitBtn.innerHTML : "";
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Broadcasting to students...`;
    }

    try {
        const payload = {
            admin_id: currentUser.id,
            title: title,
            message: message,
            category: category,
            priority: priority,
            target_audience: "all_students"
        };

        const res = await fetch(`${ANNOUNCEMENTS_API_URL}/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            showToast("Announcement broadcasted successfully to all students!", "success");
            if (titleInput) titleInput.value = "";
            if (msgInput) msgInput.value = "";
            await fetchAnnouncements();
        } else {
            const errData = await res.json().catch(() => ({}));
            showToast(errData.detail || "Failed to broadcast announcement.", "error");
        }
    } catch (err) {
        console.error("Error broadcasting:", err);
        showToast("Network error while broadcasting announcement.", "error");
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHtml;
        }
    }
}

async function handleAiEnhanceAnnouncement() {
    if (!currentUser || (currentUser.role || '').toLowerCase() !== 'admin') {
        showToast("Only administrators can use AI broadcast tools.", "error");
        return;
    }

    const titleInput = document.getElementById("broadcast-title");
    const msgInput = document.getElementById("broadcast-message");
    const catInput = document.getElementById("broadcast-category");
    const prioInput = document.getElementById("broadcast-priority");
    const aiBtn = document.getElementById("btn-ai-enhance-broadcast");

    const currentTitle = titleInput ? titleInput.value.trim() : "";
    const currentMsg = msgInput ? msgInput.value.trim() : "";

    if (!currentMsg) {
        showToast("Please type a rough draft note in the message box first.", "info");
        return;
    }

    const originalAiHtml = aiBtn ? aiBtn.innerHTML : "";
    if (aiBtn) {
        aiBtn.disabled = true;
        aiBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-blue-600"></i><span>Polishing...</span>`;
    }

    try {
        const res = await fetch(`${ANNOUNCEMENTS_API_URL}/ai-enhance`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                admin_id: currentUser.id,
                title: currentTitle || "Campus Notice",
                raw_message: currentMsg,
                category: catInput ? catInput.value : "General",
                priority: prioInput ? prioInput.value : "normal"
            })
        });

        if (res.ok) {
            const data = await res.json();
            if (titleInput && data.enhanced_title) {
                titleInput.value = data.enhanced_title;
            }
            if (msgInput && data.enhanced_message) {
                msgInput.value = data.enhanced_message;
            }
            showToast("Draft polished with Gemini AI!", "success");
        } else {
            showToast("AI enhancement was unavailable.", "error");
        }
    } catch (err) {
        console.error("AI enhance error:", err);
        showToast("Error communicating with AI service.", "error");
    } finally {
        if (aiBtn) {
            aiBtn.disabled = false;
            aiBtn.innerHTML = originalAiHtml;
        }
    }
}

async function toggleAnnouncementStatus(id) {
    if (!currentUser || (currentUser.role || '').toLowerCase() !== 'admin') {
        showToast("Only administrators can toggle announcements.", "error");
        return;
    }

    try {
        const res = await fetch(`${ANNOUNCEMENTS_API_URL}/${id}/toggle?admin_id=${currentUser.id}`, {
            method: "PATCH"
        });
        if (res.ok) {
            showToast("Announcement status updated.", "success");
            await fetchAnnouncements();
        } else {
            showToast("Failed to update status.", "error");
        }
    } catch (err) {
        console.error("Error toggling:", err);
        showToast("Network error.", "error");
    }
}

async function deleteAnnouncement(id) {
    if (!currentUser || (currentUser.role || '').toLowerCase() !== 'admin') {
        showToast("Only administrators can delete announcements.", "error");
        return;
    }

    if (!confirm("Are you sure you want to permanently delete this broadcast announcement?")) {
        return;
    }

    try {
        const res = await fetch(`${ANNOUNCEMENTS_API_URL}/${id}?admin_id=${currentUser.id}`, {
            method: "DELETE"
        });
        if (res.ok) {
            showToast("Announcement deleted successfully.", "success");
            await fetchAnnouncements();
        } else {
            showToast("Failed to delete announcement.", "error");
        }
    } catch (err) {
        console.error("Error deleting announcement:", err);
        showToast("Network error.", "error");
    }
}