// --- CONSTANTS & STATE STORAGE ---
const API_BASE = window.getApiUrl ? window.getApiUrl() : "http://127.0.0.1:8000/api";

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
let deptPollTimer = null;

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

window.onload = async function() {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('current-date-display').innerText = new Date().toLocaleDateString('en-US', options);

    await fetchInstructorProfile();
    await fetchEscalationsData(); // 🛠️ Enabled escalation data fetch
    await fetchQueriesData();
    await fetchInstructorLeaveSettings();
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
                    reply: q.reply || "",
                    messages: q.messages || []
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
    if (tabId === 'profile') fetchInstructorLeaveSettings();
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

    container.innerHTML = filtered.map(q => {
        const msgList = q.messages || [];
        const msgCount = msgList.length || (q.reply ? 1 : 0);
        const latestMsg = msgList.length > 0 ? msgList[msgList.length - 1] : null;
        const hasNewStudentMsg = latestMsg ? (latestMsg.sender_role || '').toLowerCase() === 'student' : false;

        return `
            <div onclick="selectQuery('${q.id}')" class="p-4 cursor-pointer transition hover:bg-slate-50 ${currentActiveQueryId === q.id ? 'bg-accentlight/60 border-l-4 border-primary' : ''}">
                <div class="flex items-center justify-between mb-1 gap-1 flex-wrap">
                    <span class="text-[11px] font-bold px-2 py-0.5 rounded bg-bglight text-slate-600">${q.category}</span>
                    <div class="flex items-center gap-1.5">
                        ${hasNewStudentMsg ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse"><span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span><i class="fa-solid fa-bell text-[8px]"></i> New</span>` : ''}
                        <span class="text-xs font-bold px-2 py-0.5 rounded-lg ${getStatusBadgeClass(q.status)}">
                            ${formatStatus(q.status)}
                        </span>
                    </div>
                </div>
                <h4 class="font-bold text-slate-900 text-sm truncate mt-1">${q.subject}</h4>
                <div class="flex items-center justify-between mt-2 text-xs text-slate-500">
                    <span>${q.studentName}</span>
                    <span class="flex items-center gap-1 text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                        <i class="fa-regular fa-comment-dots text-xs text-blue-600"></i> ${msgCount > 0 ? `${msgCount} msg` : 'Chat'}
                    </span>
                </div>
            </div>
        `;
    }).join('');
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

    const msgList = q.messages || [];
    const latestMsg = msgList.length > 0 ? msgList[msgList.length - 1] : null;
    const hasNewStudentMsg = latestMsg ? (latestMsg.sender_role || '').toLowerCase() === 'student' : false;
    const newMsgBadge = document.getElementById("detail-new-msg-badge");
    if (newMsgBadge) {
        if (hasNewStudentMsg) newMsgBadge.classList.remove("hidden");
        else newMsgBadge.classList.add("hidden");
    }
    const countText = document.getElementById("detail-chat-count-text");
    if (countText) {
        countText.innerText = `${msgList.length} ${msgList.length === 1 ? 'Message' : 'Messages'}`;
    }

    const replyInput = document.getElementById('instructor-reply-text');
    if (replyInput) replyInput.value = '';

    loadDepartmentChatMessages(q.numericId);
    fetchAiDraftSuggestions(q.numericId);

    if (deptPollTimer) clearInterval(deptPollTimer);
    deptPollTimer = setInterval(() => {
        if (currentActiveQueryId === id) {
            loadDepartmentChatMessages(q.numericId, true);
        }
    }, 3000);
}

async function loadDepartmentChatMessages(queryId, silent = false) {
    try {
        const res = await fetch(`${API_BASE}/message/${queryId}`);
        if (res.ok) {
            const data = await res.json();
            renderDepartmentChat(data.messages || []);
            const q = instcuqueriesData.find(item => item.numericId === queryId);
            if (q) {
                q.status = data.status;
                q.reply = data.reply;
                q.messages = data.messages || [];
                const statusBadge = document.getElementById('detail-status-badge');
                if (statusBadge) {
                    statusBadge.innerText = formatStatus(data.status);
                    statusBadge.className = `text-xs font-bold px-2.5 py-1 rounded-lg ${getStatusBadgeClass(data.status)}`;
                }
            }
            const msgs = data.messages || [];
            const latestMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
            const hasNewStudentMsg = latestMsg ? (latestMsg.sender_role || '').toLowerCase() === 'student' : false;
            const newMsgBadge = document.getElementById("detail-new-msg-badge");
            if (newMsgBadge) {
                if (hasNewStudentMsg) newMsgBadge.classList.remove("hidden");
                else newMsgBadge.classList.add("hidden");
            }
            const countText = document.getElementById("detail-chat-count-text");
            if (countText) {
                countText.innerText = `${msgs.length} ${msgs.length === 1 ? 'Message' : 'Messages'}`;
            }
        }
    } catch (err) {
        if (!silent) console.error("Error loading chat messages:", err);
    }
}

function renderDepartmentChat(messages) {
    const container = document.getElementById('department-chat-timeline');
    if (!container) return;

    if (!messages || messages.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 bg-white/80 rounded-2xl border border-dashed border-slate-200">
                <div class="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2 text-base">
                    <i class="fa-solid fa-comments"></i>
                </div>
                <p class="text-xs font-semibold text-slate-700">No conversation messages yet</p>
                <p class="text-[11px] text-slate-400 mt-0.5">Type a reply below to send a message to the student!</p>
            </div>
        `;
        return;
    }

    const previousScrollHeight = container.scrollHeight;
    const isScrolledToBottom = (container.scrollHeight - container.scrollTop - container.clientHeight) < 60;

    container.innerHTML = messages.map(msg => {
        const role = (msg.sender_role || "").toLowerCase();
        const myRole = (user && user.role ? user.role : "instructor").toLowerCase();
        // A message is "self" for Department staff ONLY if not student and role matches
        const isSelf = role !== "student" && role === myRole;
        const timeStr = formatChatTime(msg.sent_at);
        const roleDisplay = role ? role.toUpperCase() : "STAFF";

        let senderLabel = msg.sender_name || "";
        if (!senderLabel) {
            if (role === "student") {
                const q = instcuqueriesData.find(item => item.id === currentActiveQueryId);
                senderLabel = q ? q.studentName : "Student";
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

// Single Consolidated Submit Reply Function (WhatsApp Style)
async function submitInstructorReply() {
    if (!currentActiveQueryId) return;
    const q = instcuqueriesData.find(item => item.id === currentActiveQueryId);
    const replyInput = document.getElementById('instructor-reply-text');
    const replyText = replyInput ? replyInput.value.trim() : '';
    
    if (!replyText) {
        showNotification("Please write a message before sending.");
        return;
    }

    try {
        const payload = {
            sender_id: user.id,
            sender_name: user.name || user.role,
            sender_role: user.role,
            message_body: replyText,
            status: "in_progress"
        };

        const response = await fetch(`${API_BASE}/message/${q.numericId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            replyInput.value = '';
            q.reply = replyText;
            q.status = "in_progress";
            await loadDepartmentChatMessages(q.numericId, true);
            showNotification("Message sent to student!");
        } else {
            showNotification("Failed to send message.", "error");
        }
    } catch (error) {
        console.error("Error submitting reply:", error);
        showNotification("Failed to send message.", "error");
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

// AI Draft Reply Suggestions Logic
let currentAiDrafts = [];

async function fetchAiDraftSuggestions(targetId) {
    const container = document.getElementById("ai-draft-chips");
    const refreshBtn = document.getElementById("btn-refresh-ai-draft");
    if (!container) return;

    let targetNumericId = null;
    let q = null;
    if (typeof targetId === 'number') {
        targetNumericId = targetId;
        q = instcuqueriesData.find(item => item.numericId === targetId);
    } else if (typeof targetId === 'string') {
        q = instcuqueriesData.find(item => item.id === targetId || item.numericId == targetId);
        targetNumericId = q ? q.numericId : parseInt(targetId.replace(/\D/g, ''), 10);
    } else if (currentActiveQueryId) {
        q = instcuqueriesData.find(item => item.id === currentActiveQueryId);
        if (q) targetNumericId = q.numericId;
    }

    if (!targetNumericId) return;

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
        const staffRole = user ? (user.role || "Instructor") : "Instructor";
        const staffName = user ? (user.name || staffRole) : staffRole;
        const payload = {
            query_id: targetNumericId,
            query_subject: q ? q.subject : "",
            query_body: q ? q.description : "",
            category: q ? q.category : "General",
            student_name: q ? (q.studentName || "Student") : "Student",
            staff_role: staffRole,
            staff_name: staffName
        };
        const res = await fetch(`${API_BASE}/query/${targetNumericId}/ai-draft-reply`, {
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
    const replyInput = document.getElementById("instructor-reply-text");
    if (replyInput) {
        replyInput.value = draft.text;
        replyInput.focus();
        replyInput.classList.add("ring-2", "ring-primary");
        setTimeout(() => replyInput.classList.remove("ring-2", "ring-primary"), 1200);
    }
}

// --- INSTRUCTOR LEAVE & AUTO-REPLY LOGIC (EXCLUSIVE TO INSTRUCTOR ROLE) ---
let instructorLeaveData = null;

function isInstructorRole() {
    return !!(user && (user.role || "").toLowerCase().trim() === "instructor");
}

async function fetchInstructorLeaveSettings() {
    // Only proceed for users with the Instructor role
    if (!user || !user.id || !isInstructorRole()) {
        const headerBadge = document.getElementById("header-leave-badge");
        if (headerBadge) {
            headerBadge.classList.add("hidden");
            headerBadge.classList.remove("flex");
        }
        const banner = document.getElementById("dashboard-leave-banner");
        if (banner) banner.classList.add("hidden");
        const leaveCard = document.getElementById("card-leave-settings");
        if (leaveCard) leaveCard.classList.add("hidden");
        return;
    }

    // Display the leave card for instructors
    const leaveCard = document.getElementById("card-leave-settings");
    if (leaveCard) leaveCard.classList.remove("hidden");

    try {
        const res = await fetch(`${API_BASE}/instructor/${user.id}/leave`);
        if (res.ok) {
            instructorLeaveData = await res.json();
            renderLeaveSettingsUI(instructorLeaveData);
        }
    } catch (err) {
        console.error("Error fetching leave settings:", err);
    }
}

function renderLeaveSettingsUI(data) {
    if (!data || !isInstructorRole()) return;

    const isOnLeave = !!data.is_on_leave;

    // 1. Header Quick Badge (Only for Instructor)
    const headerBadge = document.getElementById("header-leave-badge");
    const headerDot = document.getElementById("header-leave-dot");
    const headerText = document.getElementById("header-leave-text");
    if (headerBadge && headerDot && headerText) {
        headerBadge.classList.remove("hidden");
        headerBadge.classList.add("flex");
        if (isOnLeave) {
            headerBadge.className = "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition shadow-xs bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 cursor-pointer";
            headerDot.className = "w-2 h-2 rounded-full bg-amber-500 animate-pulse";
            headerText.innerText = data.auto_reply_enabled ? "On Leave (Auto-Reply ON)" : "On Leave";
        } else {
            headerBadge.className = "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition shadow-xs bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 cursor-pointer";
            headerDot.className = "w-2 h-2 rounded-full bg-emerald-500 animate-pulse";
            headerText.innerText = "Status: Available";
        }
    }

    // 2. Dashboard Banner (Only for Instructor)
    const banner = document.getElementById("dashboard-leave-banner");
    const bannerDesc = document.getElementById("dashboard-leave-banner-desc");
    if (banner) {
        if (isOnLeave) {
            banner.classList.remove("hidden");
            const periodStr = (data.leave_start && data.leave_end)
                ? `from ${data.leave_start} to ${data.leave_end}`
                : (data.leave_end ? `until ${data.leave_end}` : "currently active");
            const reasonStr = data.leave_reason ? ` (${data.leave_reason})` : "";
            const autoStr = data.auto_reply_enabled
                ? "Automated out-of-office replies are actively sent to all student inquiries."
                : "Automatic reply is currently disabled.";
            if (bannerDesc) {
                bannerDesc.innerText = `You are marked on leave ${periodStr}${reasonStr}. ${autoStr}`;
            }
        } else {
            banner.classList.add("hidden");
        }
    }

    // 3. Profile Card Inputs
    const toggle = document.getElementById("leave-mode-toggle");
    const toggleLabel = document.getElementById("leave-toggle-status-label");
    const statusBadge = document.getElementById("profile-leave-status-badge");
    if (toggle) toggle.checked = isOnLeave;
    if (toggleLabel) toggleLabel.innerText = isOnLeave ? "On Leave" : "Available";
    if (statusBadge) {
        if (isOnLeave) {
            statusBadge.innerText = "ON LEAVE / AWAY";
            statusBadge.className = "px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300";
        } else {
            statusBadge.innerText = "AVAILABLE";
            statusBadge.className = "px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200";
        }
    }

    const startDateInput = document.getElementById("leave-start-date");
    if (startDateInput) startDateInput.value = data.leave_start || "";

    const endDateInput = document.getElementById("leave-end-date");
    if (endDateInput) endDateInput.value = data.leave_end || "";

    const reasonInput = document.getElementById("leave-reason");
    if (reasonInput) reasonInput.value = data.leave_reason || "";

    const autoReplyToggle = document.getElementById("leave-auto-reply-enabled");
    if (autoReplyToggle) autoReplyToggle.checked = !!data.auto_reply_enabled;

    const autoReplyMsg = document.getElementById("leave-auto-reply-message");
    if (autoReplyMsg) autoReplyMsg.value = data.auto_reply_message || "";

    const lastUpdated = document.getElementById("leave-last-updated");
    if (lastUpdated) {
        if (data.updated_at) {
            lastUpdated.innerText = `Last updated: ${new Date(data.updated_at).toLocaleString()}`;
        } else {
            lastUpdated.innerText = "";
        }
    }
}

function toggleLeaveModeState(isOnLeave) {
    if (!isInstructorRole()) return;
    const toggleLabel = document.getElementById("leave-toggle-status-label");
    if (toggleLabel) toggleLabel.innerText = isOnLeave ? "On Leave" : "Available";
    const statusBadge = document.getElementById("profile-leave-status-badge");
    if (statusBadge) {
        if (isOnLeave) {
            statusBadge.innerText = "ON LEAVE / AWAY";
            statusBadge.className = "px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300";
        } else {
            statusBadge.innerText = "AVAILABLE";
            statusBadge.className = "px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200";
        }
    }
}

async function saveInstructorLeaveSettings(event) {
    if (event) event.preventDefault();
    if (!user || !user.id || !isInstructorRole()) {
        showNotification("Leave & Auto-Reply mode is only accessible for Instructors.", "error");
        return;
    }

    const btn = document.getElementById("btn-save-leave");
    const originalText = btn ? btn.innerHTML : "";
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Saving...`;
    }

    const isOnLeave = document.getElementById("leave-mode-toggle") ? document.getElementById("leave-mode-toggle").checked : false;
    const startDate = document.getElementById("leave-start-date") ? document.getElementById("leave-start-date").value : "";
    const endDate = document.getElementById("leave-end-date") ? document.getElementById("leave-end-date").value : "";
    const reason = document.getElementById("leave-reason") ? document.getElementById("leave-reason").value.trim() : "";
    const autoReplyEnabled = document.getElementById("leave-auto-reply-enabled") ? document.getElementById("leave-auto-reply-enabled").checked : true;
    const autoReplyMessage = document.getElementById("leave-auto-reply-message") ? document.getElementById("leave-auto-reply-message").value.trim() : "";

    const payload = {
        is_on_leave: isOnLeave,
        leave_start: startDate,
        leave_end: endDate,
        leave_reason: reason,
        auto_reply_enabled: autoReplyEnabled,
        auto_reply_message: autoReplyMessage
    };

    try {
        const res = await fetch(`${API_BASE}/instructor/${user.id}/leave`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            instructorLeaveData = await res.json();
            renderLeaveSettingsUI(instructorLeaveData);
            showNotification(isOnLeave ? "Leave mode activated! Auto-reply is active." : "Leave settings saved. Status: Available.", "success");
        } else {
            showNotification("Failed to save leave settings.", "error");
        }
    } catch (err) {
        console.error("Error saving leave settings:", err);
        showNotification("Error connecting to server.", "error");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
}

async function generateAiLeaveAutoReply() {
    if (!isInstructorRole()) {
        showNotification("Leave & Auto-Reply mode is only accessible for Instructors.", "error");
        return;
    }

    const btn = document.getElementById("btn-ai-auto-reply");
    const msgTextarea = document.getElementById("leave-auto-reply-message");
    if (!msgTextarea) return;

    const originalHTML = btn ? btn.innerHTML : "";
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-blue-600"></i><span>Drafting...</span>`;
    }

    const instructorName = user ? (user.name || "Instructor") : "Instructor";
    const startDate = document.getElementById("leave-start-date") ? document.getElementById("leave-start-date").value : "";
    const endDate = document.getElementById("leave-end-date") ? document.getElementById("leave-end-date").value : "";
    const reason = document.getElementById("leave-reason") ? document.getElementById("leave-reason").value.trim() : "";

    try {
        const res = await fetch(`${API_BASE}/instructor/generate-auto-reply`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                instructor_name: instructorName,
                leave_start: startDate,
                leave_end: endDate,
                leave_reason: reason,
                contact_person: "Head of Department"
            })
        });
        if (res.ok) {
            const data = await res.json();
            if (data.auto_reply_message) {
                msgTextarea.value = data.auto_reply_message;
                msgTextarea.focus();
                msgTextarea.classList.add("ring-2", "ring-primary");
                setTimeout(() => msgTextarea.classList.remove("ring-2", "ring-primary"), 1200);
                showNotification("AI draft out-of-office message generated!");
            }
        } else {
            showNotification("Could not generate AI draft.", "error");
        }
    } catch (err) {
        console.error("Error generating auto-reply:", err);
        showNotification("Error generating AI auto-reply.", "error");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHTML;
        }
    }
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