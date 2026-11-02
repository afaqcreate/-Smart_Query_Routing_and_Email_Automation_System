// --- CONSTANTS & STATE STORAGE ---
const API_BASE = "http://127.0.0.1:8000/api";

// 1. Get and parse the session from localStorage
const storedSession = localStorage.getItem("user_session");

let user = null;
if (storedSession) {
    user = JSON.parse(storedSession);
}

// 2. Validate session existence or redirect to login
if (!user) {
    window.location.href = "../01_Login/01_login.html";
} else {
    console.log("Logged in instructor:", user.name);
    console.log("Instructor email:", user.email);
    console.log("Instructor role:", user.role);
}

let instructorProfile = {};
let instcuqueriesData = [];
let escalationsData = [];
let currentActiveQueryId = null;
let currentFilterStatus = 'all';

window.onload = async function() {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('current-date-display').innerText = new Date().toLocaleDateString('en-US', options);

    await fetchInstructorProfile();
    await fetchEscalationsData(); // 🛠️ Enabled escalation data fetch
    await fetchQueriesData();
};

document.getElementById("heading_id").innerText = user.role.toUpperCase()

// 1. Fetch Instructor Profile dynamically using the logged-in user's ID
async function fetchInstructorProfile() {
    try {
        setGlobalLoading(true)
        const response = await fetch(`${API_BASE}/user/${user.id}`);
        setGlobalLoading(false)
        if (response.ok) {
            instructorProfile = await response.json();
        }
    } catch (error) {
        console.error("Failed to load user profile:", error);
    }
}

// 2. Fetch Escalations history via /api/escalation/
async function fetchEscalationsData() {
    try {
        setGlobalLoading(true)
        const response = await fetch(`${API_BASE}/escalation/`);
        setGlobalLoading(false)
        if (response.ok) {
            escalationsData = await response.json();
        }
    } catch (error) {
        console.error("Failed to load escalations:", error);
    }
}

// 3. Fetch Queries via /api/query/ with robust nested student mapping
async function fetchQueriesData() {
    try {
        setGlobalLoading(true)
        const response = await fetch(`${API_BASE}/query/`);
        setGlobalLoading(false)
        if (response.ok) {
            const rawQueries = await response.json();
            
            // 1. Filter out only the queries that match the user's role
            const filteredQueries = rawQueries.filter(q => 
                q.category && q.category.toLowerCase() === user.role.toLowerCase()
            );

            // 2. Map the filtered data into the structural format you need
            instcuqueriesData = filteredQueries.map(q => {
                const isEscalated = escalationsData.some(e => e.query_id === q.query_id);
                return {
                    id: `Q-${q.query_id}`,
                    numericId: q.query_id,
                    studentName: q.student ? q.student.name : `Student #${q.student_id}`,
                    studentEmail: q.student ? q.student.email : `student_${q.student_id}@university.edu`,
                    roll: q.student ? q.student.roll_number : q.student_id,
                    category: q.category,
                    subject: q.query_subject,
                    description: q.query_body,
                    date: q.submitted_at,
                    status: q.status.toLowerCase(),
                    escalated24h: isEscalated,
                    reply: q.reply || ""
                };
            });

            // 3. Update the UI state with the filtered data
            refreshAllData();
            if (instcuqueriesData.length > 0 && !currentActiveQueryId) {
                selectQuery(instcuqueriesData[0].id);
            }
        }
    } catch (error) {
        console.error("Failed to load queries:", error);
        showNotification("Error connecting to FastAPI backend.", "error");
    }
}


// Update Profile UI
function updateProfileUI() {
    const name = user.name || "Dr. Instructor";
    const email = user.email || "instructor@university.edu";
    document.getElementById('sidebar-name').innerText = name;
    document.getElementById('sidebar-email').innerText = email;
    document.getElementById('sidebar-initials').innerText = getInitials(name);
    document.getElementById('profile-name').innerText = name;
    document.getElementById('profile-email').innerText = email;
    document.getElementById('profile-role').innerText = user.role.toUpperCase() || "Professor";
    document.getElementById('profile-handled-count').innerText = instcuqueriesData.filter(q => q.status === 'resolved').length || "0";
    // document.getElementById('profile-role-id').innerText = `USER-${instructorProfile.id || user.id || 1}`;
    document.getElementById('profile-big-avatar').innerText = getInitials(name);
}

function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

function switchTab(tabId) {
    const tabs = ['dashboard', 'queries', 'history', 'profile'];
    tabs.forEach(t => {
        const contentEl = document.getElementById(`tab-content-${t}`);
        const navEl = document.getElementById(`nav-${t}`);
        if (contentEl && navEl) {
            if (t === tabId) {
                contentEl.classList.remove('hidden');
                navEl.className = "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition text-left bg-accentlight text-primary border border-borderblue/50";
                document.getElementById("department-replies").innerText = `Review historical inquiries along with your previously submitted '${user.role}' replies.`
            } else {
                contentEl.classList.add('hidden');
                navEl.className = "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition text-left text-slate-600 hover:bg-bglight";
            }
        }
    });

    const pageTitleEl = document.getElementById('page-title');
    if (pageTitleEl) {
        pageTitleEl.innerText = {
            dashboard: 'Dashboard Overview',
            queries: 'Student Queries Inbox',
            history: 'Query History & Archives',
            profile: 'Instructor Profile & Settings'
        }[tabId];
    }

    if (tabId === 'history') renderHistory();
}

function refreshAllData() {
    renderStats();
    updateProfileUI()
    renderDashboardRecent();
    renderQueriesList();
    if (currentActiveQueryId) selectQuery(currentActiveQueryId);
}

// Render Statistics
function renderStats() {
    document.getElementById('stat-total').innerText = instcuqueriesData.length;
    document.getElementById('stat-pending').innerText = instcuqueriesData.filter(q => q.status === 'pending').length;
    document.getElementById('stat-inprogress').innerText = instcuqueriesData.filter(q => q.status === 'in_progress').length;
    cout2 = document.getElementById('stat-resolved').innerText = instcuqueriesData.filter(q => q.status === 'resolved' || q.status === 'resolve').length;
    console.log(cout2)
    document.getElementById('stat-escalations').innerText = instcuqueriesData.filter(q => q.escalated24h).length;

    const pendingCount = instcuqueriesData.filter(q => q.status === 'pending').length;
    const badge = document.getElementById('pending-badge');
    if (badge) {
        badge.innerText = pendingCount;
        if (pendingCount === 0) badge.classList.add('hidden');
        else badge.classList.remove('hidden');
    }
}

function renderDashboardRecent() {
    const container = document.getElementById('dashboard-recent-list');
    if (!container) return;
    container.innerHTML = instcuqueriesData.slice(0, 4).map(q => `
        <div class="p-4 rounded-xl border border-borderblue bg-bglight/30 flex items-center justify-between hover:bg-accentlight/40 transition cursor-pointer" onclick="jumpToQuery('${q.id}')">
            <div class="flex items-center gap-3 overflow-hidden">
                <div class="w-10 h-10 rounded-xl bg-accentlight text-primary font-bold flex items-center justify-center text-xs shrink-0 border border-borderblue">
                    ${getInitials(q.studentName)}
                </div>
                <div class="overflow-hidden">
                    <h4 class="font-bold text-sm text-slate-900 truncate">${q.subject}</h4>
                    <p class="text-xs text-slate-500 truncate">${q.studentName} | ${q.category}</p>
                </div>
            </div>
            <span class="text-xs font-bold px-2.5 py-1 rounded-lg ${getStatusBadgeClass(q.status)}">
            ${formatStatus(q.status)}
            </span>
        </div>
    `).join('');
}

function jumpToQuery(id) {
    switchTab('queries');
    selectQuery(id);
}

function formatStatus(status) {
    if (!status) return "";
    if (status.toLowerCase() === 'in_progress') return 'In Progress';
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

function filterStatus(status) {
    currentFilterStatus = status;
    ['all', 'pending', 'in_progress', 'resolved'].forEach(s => {
        const btn = document.getElementById(`filter-${s}`);
        if (btn) {
            btn.className = s === status ? "px-3.5 py-2 rounded-xl text-xs font-semibold bg-primary text-white transition shadow-sm" : "px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition";
        }
    });
    renderQueriesList();
}

function filterQueries() { renderQueriesList(); }

function renderQueriesList() {
    const searchVal = document.getElementById('query-search') ? document.getElementById('query-search').value.toLowerCase() : '';
    const container = document.getElementById('queries-list-container');
    if (!container) return;

    let filtered = instcuqueriesData.filter(q => {
        const matchesStatus = currentFilterStatus === 'all' || q.status === currentFilterStatus;
        const matchesSearch = q.subject.toLowerCase().includes(searchVal) || q.studentName.toLowerCase().includes(searchVal);
        return matchesStatus && matchesSearch;
    });

    const countBadge = document.getElementById('query-count-badge');
    if (countBadge) countBadge.innerText = `${filtered.length} items`;

    if (filtered.length === 0) {
        container.innerHTML = `<div class="p-8 text-center text-slate-400 text-sm"><p>No queries match your criteria.</p></div>`;
        return;
    }

    container.innerHTML = filtered.map(q => `
        <div onclick="selectQuery('${q.id}')" class="p-4 cursor-pointer transition hover:bg-slate-50 ${currentActiveQueryId === q.id ? 'bg-accentlight/60 border-l-4 border-primary' : ''}">
            <div class="flex items-center justify-between mb-1">
                <span class="text-[11px] font-bold px-2 py-0.5 rounded bg-bglight text-slate-600">${q.category}</span>
                <span class="text-xs font-bold px-2.5 py-1 rounded-lg ${getStatusBadgeClass(q.status)}">
                ${formatStatus(q.status)}
                </span>
            </div>
            <h4 class="font-bold text-slate-900 text-sm truncate mt-1">${q.subject}</h4>
            <div class="flex items-center justify-between mt-2 text-xs text-slate-500">
                <span>${q.studentName}</span>
                <span>${q.id}</span>
            </div>
        </div>
    `).join('');
}

function selectQuery(id) {
    currentActiveQueryId = id;
    const q = instcuqueriesData.find(item => item.id === id);
    if (!q) return;

    renderQueriesList();

    const noQueryEl = document.getElementById('no-query-selected');
    const activeContentEl = document.getElementById('query-active-content');
    if (noQueryEl) noQueryEl.classList.add('hidden');
    if (activeContentEl) activeContentEl.classList.remove('hidden');

    document.getElementById('detail-category').innerText = q.category;
    document.getElementById('detail-subject').innerText = q.subject;
    document.getElementById('detail-date').innerText = new Date(q.date).toLocaleString();
    document.getElementById('detail-student-name').innerText = q.studentName;
    document.getElementById('detail-student-email').innerText = `${q.studentEmail} | Roll: ${q.roll}`;
    document.getElementById('detail-student-avatar').innerText = getInitials(q.studentName);
    document.getElementById('detail-description').innerText = q.description;

    const statusBadge = document.getElementById('detail-status-badge');
    if (statusBadge) {
        statusBadge.innerText = formatStatus(q.status);
        statusBadge.className = `text-xs font-bold px-2.5 py-1 rounded-lg ${getStatusBadgeClass(q.status)}`;
    }

    const replyInput = document.getElementById('instructor-reply-text');
    if (replyInput) replyInput.value = q.reply || '';
}

function getStatusBadgeClass(status) {
    if (status === 'pending') return 'bg-amber-50 text-amber-700 border border-amber-200';
    if (status === 'in_progress') return 'bg-accentlight text-primary border border-borderblue';
    if (status === 'resolved' || status === 'resolve') return 'bg-emerald-50 text-successgreen border border-emerald-200';
    return 'bg-slate-100 text-slate-600';
}

// Manual Status Update
async function updateQueryStatus(newStatus) {
    if (!currentActiveQueryId) return;
    const q = instcuqueriesData.find(item => item.id === currentActiveQueryId);
    if (!q) return;

    try {
        setGlobalLoading(true)
        const response = await fetch(`${API_BASE}/query/${q.numericId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus.toLowerCase() })
        });
        setGlobalLoading(false)
        if (response.ok) {
            q.status = newStatus.toLowerCase();
            refreshAllData();
            showNotification(`Query status updated to ${newStatus}`);
        } else {
            showNotification("Failed to update status on backend.", "error");
        }
    } catch (error) {
        console.error("Error updating status:", error);
        showNotification("Failed to update status on FastAPI backend.", "error");
    }
}

// Single Consolidated Submit Reply Function
async function submitInstructorReply() {
    if (!currentActiveQueryId) return;
    const q = instcuqueriesData.find(item => item.id === currentActiveQueryId);
    const replyText = document.getElementById('instructor-reply-text').value.trim();
    
    if (!replyText) {
        showNotification("Please write a response before submitting.");
        return;
    }

    try {
        setGlobalLoading(true)
        const response = await fetch(`${API_BASE}/query/${q.numericId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                reply: replyText,
                status: "resolved"
            })
        });
        setGlobalLoading(false)

        if (response.ok) {
            q.reply = replyText;
            q.status = "resolved";
            refreshAllData();
            showNotification("Reply sent and query marked as resolved!");
        } else {
            showNotification("Failed to send reply on backend.", "error");
        }
    } catch (error) {
        console.error("Error submitting reply:", error);
        showNotification("Failed to send reply.", "error");
    }
}

function renderHistory() {
    const container = document.getElementById('history-list-container');
    if (!container) return;
    const historyItems = instcuqueriesData.filter(q => q.status);

    // console.log(historyItems);

    // 1. First check if the array is completely empty
    if (historyItems.length === 0) {
        container.innerHTML = `<div class="p-12 text-center text-slate-400 text-sm bg-bglight/40 rounded-2xl border border-borderblue"><p>No history records found.</p></div>`;
        return;
    }

    // 2. Map through items and check statuses one by one
    container.innerHTML = historyItems.map(q => {
        
        // Check the individual status of this specific query item
        if (["pending", "in_progress"].includes(q.status)) {
            container.innerHTML = `<div class="p-12 text-center text-slate-400 text-sm bg-bglight/40 rounded-2xl border border-borderblue"><p>No history records found.</p></div>`;
            return;
        }
        
        // Return the normal card layout for completed/replied queries
        return `
            <div class="p-6 bg-cardwhite rounded-2xl border border-borderblue shadow-sm space-y-4">
                <div class="flex items-center justify-between pb-3 border-b border-borderblue">
                    <span class="text-xs font-bold px-2.5 py-1 rounded-lg bg-accentlight text-primary">${(q.status).toUpperCase()}</span>
                    <span class="text-xs text-slate-400">${new Date(q.date).toLocaleString()}</span>
                </div>
                <h4 class="font-bold text-slate-900 text-base">${q.subject}</h4>
                <p class="text-sm text-slate-600 bg-bglight/50 p-3.5 rounded-xl border border-borderblue">"${q.description}"</p>
                <div class="bg-emerald-50/40 p-4 rounded-xl border border-emerald-200">
                    <span class="text-xs font-bold text-successgreen block mb-1">Instructor Reply</span>
                    <p class="text-sm text-slate-800">${q.reply || 'No reply yet.'}</p>
                </div>
            </div>
        `;
    }).join('');
}


function showNotification(message) {
    const toast = document.createElement('div');
    toast.className = "fixed bottom-6 right-6 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xl z-50 text-xs font-semibold flex items-center gap-3 border border-slate-700";
    toast.innerHTML = `<i class="fa-solid fa-circle-check text-successgreen text-base"></i> ${message}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

// Logout synchronization with session handling
const logoutButton = document.getElementById("logout_button");
if (logoutButton) {
    logoutButton.addEventListener("click", () => {
        localStorage.removeItem("user_session");
        localStorage.removeItem("userToken");
        window.location.href = "../01_Login/01_login.html";
    });
}