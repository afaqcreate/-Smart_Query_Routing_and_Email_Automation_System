// --- CONSTANTS & STATE STORAGE ---
const API_BASE = window.getApiUrl ? window.getApiUrl() : "http://127.0.0.1:8000/api";

const storedSession = localStorage.getItem("user_session");
let user = null;
if (storedSession) {
    user = JSON.parse(storedSession);
}

if (user) {
    document.getElementById('userName').innerText = user.name || "Student";
    document.getElementById('userEmail').innerText = user.email || "";
    document.getElementById('userRoll').innerText = `Roll # ${user.roll_number || 'N/A'}`;
} else {
    window.location.href = "../01_Login/01_login.html";
}

let currentStudent = {
    student_id: user.id,
    name: user.name,
    email: user.email,
    roll: user.roll_number,
    avatar: "https://images.unsplash.com/photo-1793252539504-eea54c3bc2c9?w=150&auto=format&fit=crop&q=80"
};

let queriesData = [];
let uploadedFiles = [];
let currentFilter = 'ALL';
let activeQueryId = null;
let chatPollTimer = null;

// --- SEEN REPLY NOTIFICATION TRACKING ---
function getSeenRepliesMap() {
    try {
        const key = `seen_replies_${user?.id || 'default'}`;
        return JSON.parse(localStorage.getItem(key) || '{}');
    } catch (e) {
        return {};
    }
}

function getQueryLatestReplyIdentifier(q) {
    if (!q) return null;
    const msgs = q.messages || [];
    if (msgs.length > 0) {
        const last = msgs[msgs.length - 1];
        const isFromStaff = (last.sender_role || '').toLowerCase() !== 'student';
        if (isFromStaff) {
            return String(last.message_id || last.sent_at || last.message_body || '1');
        }
        return null;
    }
    if (q.reply) {
        return String(q.reply);
    }
    return null;
}

function hasUnseenReply(q) {
    const replyId = getQueryLatestReplyIdentifier(q);
    if (!replyId) return false;
    const seenMap = getSeenRepliesMap();
    return seenMap[q.query_id] !== replyId;
}

function markQueryReplyAsSeen(queryId) {
    const q = queriesData.find(item => item.query_id === queryId);
    if (!q) return;
    const replyId = getQueryLatestReplyIdentifier(q);
    if (!replyId) return;
    try {
        const key = `seen_replies_${user?.id || 'default'}`;
        const seenMap = getSeenRepliesMap();
        seenMap[queryId] = replyId;
        localStorage.setItem(key, JSON.stringify(seenMap));
    } catch (e) {}
}

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
    loadUserProfile();
    await Promise.all([
        fetchQueriesforstudent(),
        fetchStudentAnnouncements()
    ]);
    setupMobileMenu();
};

function loadUserProfile() {
    document.getElementById('userName').innerText = currentStudent.name;
    document.getElementById('userRoll').innerText = `Roll No: ${currentStudent.roll}`;
    document.getElementById('userEmail').innerText = currentStudent.email;
    document.getElementById('userAvatar').src = currentStudent.avatar;
}

function setupMobileMenu() {
    const mobileBtn = document.getElementById('mobileMenuBtn');
    const navContainer = document.getElementById('navContainer');
    if (mobileBtn && navContainer) {
        mobileBtn.addEventListener('click', () => {
            navContainer.classList.toggle('hidden');
        });
    }
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
    const target = document.getElementById(tabId);
    if (target) target.classList.remove('hidden');

    const navSubmit = document.getElementById('navSubmit');
    const navHistory = document.getElementById('navHistory');
    const navAnnouncements = document.getElementById('navAnnouncements');
    const pageTitle = document.getElementById('pageTitle');
    const pageSubTitle = document.getElementById('pageSubTitle');

    const inactiveClass = "w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-all duration-200 cursor-pointer";
    const activeClass = "w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 bg-blue-50 text-blue-600 border border-blue-200 cursor-pointer";

    if (navSubmit) navSubmit.className = inactiveClass;
    if (navHistory) navHistory.className = inactiveClass;
    if (navAnnouncements) navAnnouncements.className = inactiveClass;

    if (tabId === 'submitTab') {
        pageTitle.innerText = "Submit New Query";
        pageSubTitle.innerText = "Need help? Fill in the details below and our academic desk will assist you.";
        if (navSubmit) navSubmit.className = activeClass;
    } else if (tabId === 'historyTab') {
        pageTitle.innerText = "Query History & Tracking";
        pageSubTitle.innerText = "Track your submitted tickets, view status updates, and read desk replies.";
        if (navHistory) navHistory.className = activeClass;
        fetchQueriesforstudent();
    } else if (tabId === 'announcementsTab') {
        pageTitle.innerText = "Campus Announcements";
        pageSubTitle.innerText = "Official notices, broadcasts, and campus updates from university administration.";
        if (navAnnouncements) navAnnouncements.className = activeClass;
        fetchStudentAnnouncements(true);
    }

    if (window.innerWidth < 768) {
        const container = document.getElementById('navContainer');
        if (container) container.classList.add('hidden');
    }
}

// --- BACKEND API INTEGRATION ---

async function fetchQueriesforstudent(showLoading = true) {
    try {
        if (showLoading) setGlobalLoading(true);
        const response = await fetch(`${API_BASE}/query/`);
        if (response.ok) {
            const data = await response.json();
            queriesData = data.filter(q => q.student && q.student.email === user.email);
            
            // Sort queries so newest/most recent submissions or replies are at the top
            queriesData.sort((a, b) => {
                const dateA = new Date(a.submitted_at || 0);
                const dateB = new Date(b.submitted_at || 0);
                return dateB - dateA;
            });

            renderQueries();
            updateStats();
            if (showLoading) await setGlobalLoading(false);
        } else {
            console.error("Failed to fetch queries from backend");
            if (showLoading) await setGlobalLoading(false);
        }
    } catch (error) {
        console.error("Connection error:", error);
        if (showLoading) await setGlobalLoading(false);
    }
}

async function handleQuerySubmit(e) {
    e.preventDefault();

    const subject = document.getElementById('querySubject').value.trim();
    const description = document.getElementById('queryDescription').value.trim();

    if (!subject || !description) {
        alert("Please fill in both subject and description.");
        return;
    }

    const payload = {
        student_id: currentStudent.student_id,   
        email: currentStudent.email,
        query_subject: subject,
        query_body: description
    };

    try {
        setGlobalLoading(true)
        const response = await fetch(`${API_BASE}/query/ai`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const newQuery = await response.json();
            
            // Instantly unshift to the top of the array so it appears first
            queriesData.unshift(newQuery);
            
            showSuccessModal(`Q-${newQuery.query_id}`);
            resetForm();
            
            await fetchQueriesforstudent(); // Re-fetch and sort latest records
            await setGlobalLoading(false)
        } else {
            alert("Failed to submit query to backend.");
        }
    } catch (error) {
        console.error("Error submitting query:", error);
        alert("Error connecting to backend server.");
    }
}

async function submitFollowUp() {
    const input = document.getElementById('followUpInput');
    const message = input.value.trim();
    if (!message || !activeQueryId) return;

    try {
        const payload = {
            sender_id: currentStudent.student_id,
            sender_name: currentStudent.name || "Student",
            sender_role: "student",
            message_body: message,
            status: "in_progress"
        };

        const sendBtn = document.querySelector("#queryModal button[onclick='submitFollowUp()']");
        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>Sending...</span>`;
        }

        const response = await fetch(`${API_BASE}/message/${activeQueryId}/messages`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i><span>Send</span>`;
        }

        if (response.ok) {
            input.value = "";
            await refreshActiveQueryMessages(activeQueryId, true);
            fetchQueriesforstudent(false);
        } else {
            alert("Failed to send reply.");
        }
    } catch (error) {
        console.error("Error sending follow-up:", error);
    }
}

function resetForm() {
    document.getElementById('queryForm').reset();
    uploadedFiles = [];
}

function showSuccessModal(queryId) {
    const modal = document.createElement('div');
    modal.className = "fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4";
    modal.innerHTML = `
        <div class="bg-white rounded-2xl p-6 max-w-sm w-full text-center space-y-4 border border-blue-200 shadow-2xl">
            <div class="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-3xl">
                <i class="fa-solid fa-circle-check"></i>
            </div>
            <h3 class="text-lg font-bold text-slate-900">Query Submitted!</h3>
            <p class="text-xs text-slate-600">Your query reference ID is:</p>
            <div class="bg-blue-50 text-blue-600 font-black text-xl py-2 px-4 rounded-xl border border-blue-200 inline-block tracking-wider">
                ${queryId}
            </div>
            <p class="text-xs text-slate-400">Our automated AI router has classified and forwarded your ticket.</p>
            <button onclick="this.closest('.fixed').remove(); switchTab('historyTab');" class="w-full py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors">
                View Query in History
            </button>
        </div>
    `;
    document.body.appendChild(modal);
}

function setFilter(filter) {
    currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.className = "filter-btn flex-1 md:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900";
    });

    if (filter === 'ALL') document.getElementById('filterAll').className = "filter-btn flex-1 md:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold bg-white text-blue-600 shadow-xs";
    if (filter === 'pending') document.getElementById('filterPending').className = "filter-btn flex-1 md:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold bg-yellow-100 text-yellow-800 shadow-xs";
    if (filter === 'in_progress') document.getElementById('filterInProgress').className = "filter-btn flex-1 md:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-600 shadow-xs";
    if (filter === 'resolved') document.getElementById('filterResolved').className = "filter-btn flex-1 md:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-600 shadow-xs";

    renderQueries();
}

function renderQueries() {
    const searchVal = document.getElementById('searchQuery').value.toLowerCase();
    const container = document.getElementById('queryListContainer');
    if (!container) return;
    container.innerHTML = '';
     
    const filtered = queriesData.filter(q => {
        const matchesFilter = currentFilter === 'ALL' || (q.status && q.status.toLowerCase() === currentFilter.toLowerCase());
        const matchesSearch = String(q.query_id).toLowerCase().includes(searchVal) || (q.query_subject && q.query_subject.toLowerCase().includes(searchVal));
        return matchesFilter && matchesSearch;
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="bg-white p-12 text-center rounded-2xl border border-blue-200/60">
                <div class="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">
                    <i class="fa-solid fa-folder-open"></i>
                </div>
                <h4 class="font-bold text-slate-800 text-sm">No queries found</h4>
                <p class="text-xs text-slate-400 mt-1">Try adjusting your search terms or filter view</p>
            </div>
        `;
        return;
    }

    filtered.forEach(q => {
        const queryIdFormatted = `ACT# - ${q.query_id}`;
        const statusBadge = getStatusBadgeHTML(q.status);
        const msgList = q.messages || [];
        const msgCount = msgList.length || (q.reply ? 1 : 0);
        const unseen = hasUnseenReply(q);
        
        const card = document.createElement('div');
        card.className = "bg-white p-5 rounded-2xl border border-blue-200/70 hover:border-blue-600 shadow-xs hover:shadow-md transition-all cursor-pointer space-y-3";
        card.onclick = () => openQueryModal(q.query_id);

        card.innerHTML = `
            <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center space-x-2">
                    <span class="text-xs font-extrabold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">${queryIdFormatted}</span>
                    <span class="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold">${q.category || 'General'}</span>
                    ${unseen ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300 shadow-xs animate-pulse"><span class="w-1.5 h-1.5 rounded-full bg-blue-600"></span><i class="fa-solid fa-reply text-[9px]"></i> New Reply</span>` : ''}
                </div>
                <div>${statusBadge}</div>
            </div>

            <div>
                <h3 class="font-bold text-slate-900 text-base line-clamp-1">${q.query_subject}</h3>
                <p class="text-xs text-slate-500 line-clamp-2 mt-1">${q.query_body}</p>
            </div>

            <div class="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                <span><i class="fa-regular fa-clock mr-1"></i>${q.submitted_at ? new Date(q.submitted_at).toLocaleString() : 'N/A'}</span>
                <span class="text-slate-700 font-semibold flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 text-xs">
                    <i class="fa-regular fa-comment-dots text-sm text-blue-600"></i>
                    <span>${msgCount} ${msgCount === 1 ? 'Message' : 'Messages'}</span>
                    ${unseen ? '<span class="bg-blue-600 text-white text-[9px] px-1.5 py-0.2 rounded-full font-bold ml-0.5">New</span>' : ''}
                </span>
            </div>
        `;
        container.appendChild(card);
    });
}

function getStatusBadgeHTML(status) {
    const s = (status || "").toLowerCase();
    if (s === 'pending') {
        return `<span class="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-yellow-50 text-yellow-800 border border-yellow-200">
                    <span class="w-2 h-2 rounded-full bg-yellow-500"></span>
                    <span>Pending</span>
                </span>`;
    } else if (s === 'in_progress') {
        return `<span class="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-600 border border-blue-200">
                    <span class="w-2 h-2 rounded-full bg-blue-600"></span>
                    <span>In Progress</span>
                </span>`;
    } else {
        return `<span class="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                    <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>Resolved</span>
                </span>`;
    }
}

function updateStats() {
    document.getElementById('totalQueryBadge').innerText = queriesData.length;
    document.getElementById('statPending').innerText = queriesData.filter(q => (q.status || "").toLowerCase() === 'pending').length;
    document.getElementById('statProgress').innerText = queriesData.filter(q => (q.status || "").toLowerCase() === 'in_progress').length;
    document.getElementById('statResolved').innerText = queriesData.filter(q => ['resolved', 'resolve'].includes((q.status || "").toLowerCase())).length;

    // Check for new desk replies across all student queries (unseen only)
    const totalNewReplies = queriesData.filter(q => hasUnseenReply(q)).length;
    const navReplyBadge = document.getElementById('navReplyBadge');
    if (navReplyBadge) {
        if (totalNewReplies > 0) {
            navReplyBadge.classList.remove('hidden');
            navReplyBadge.innerHTML = `<i class="fa-solid fa-reply text-[8px]"></i> ${totalNewReplies} New`;
        } else {
            navReplyBadge.classList.add('hidden');
        }
    }
}

function updateModalStatusTracker(status) {
    const progressBar = document.getElementById('modalProgressBar');
    const stepProgress = document.getElementById('stepProgress');
    const stepResolved = document.getElementById('stepResolved');

    if (!progressBar || !stepProgress || !stepResolved) return;

    stepProgress.className = "w-8 h-8 rounded-full bg-white text-slate-400 border-2 border-slate-300 flex items-center justify-center font-bold text-xs shadow-xs";
    stepResolved.className = "w-8 h-8 rounded-full bg-white text-slate-400 border-2 border-slate-300 flex items-center justify-center font-bold text-xs shadow-xs";

    const statusStr = (status || "").toLowerCase();
    if (statusStr === 'pending') {
        progressBar.style.width = '0%';
    } else if (statusStr === 'in_progress') {
        progressBar.style.width = '50%';
        stepProgress.className = "w-8 h-8 rounded-full bg-blue-600 text-white border-2 border-blue-600 flex items-center justify-center font-bold text-xs shadow-md";
    } else if (statusStr === 'resolved' || statusStr === 'resolve') {
        progressBar.style.width = '100%';
        stepProgress.className = "w-8 h-8 rounded-full bg-blue-600 text-white border-2 border-blue-600 flex items-center justify-center font-bold text-xs shadow-md";
        stepResolved.className = "w-8 h-8 rounded-full bg-emerald-500 text-white border-2 border-emerald-500 flex items-center justify-center font-bold text-xs shadow-md";
    }
}

async function refreshActiveQueryMessages(queryId, silent = false) {
    if (!queryId || activeQueryId !== queryId) return;
    try {
        const res = await fetch(`${API_BASE}/message/${queryId}`);
        if (res.ok) {
            const data = await res.json();
            const idx = queriesData.findIndex(item => item.query_id === queryId);
            if (idx !== -1) {
                queriesData[idx].messages = data.messages || [];
                queriesData[idx].status = data.status;
                queriesData[idx].reply = data.reply;
            }
            updateModalStatusTracker(data.status);
            renderReplyTimeline(data.messages || []);

            // Since student currently has the modal open, mark as seen
            markQueryReplyAsSeen(queryId);

            const msgs = data.messages || [];
            const modalReplyBadge = document.getElementById('modalReplyBadge');
            const modalMsgCountText = document.getElementById('modalMsgCountText');
            if (modalReplyBadge) {
                modalReplyBadge.classList.add('hidden');
            }
            if (modalMsgCountText) {
                modalMsgCountText.innerText = `${msgs.length} ${msgs.length === 1 ? 'Message' : 'Messages'}`;
            }
        }
    } catch (err) {
        if (!silent) console.error("Error refreshing query messages:", err);
    }
}

function openQueryModal(queryId) {
    activeQueryId = queryId;
    const q = queriesData.find(item => item.query_id === queryId);
    if (!q) return;

    // Mark seen immediately upon opening modal and clear notification icons
    markQueryReplyAsSeen(queryId);
    renderQueries();
    updateStats();

    document.getElementById('modalQueryId').innerText = `ACT# - ${q.query_id}`;
    document.getElementById('modalSubject').innerText = q.query_subject || "";
    document.getElementById('modalTimestamp').innerText = "Submitted: " + (q.submitted_at ? new Date(q.submitted_at).toLocaleString() : '');
    document.getElementById('modalDescription').innerText = q.query_body || "";

    const msgs = q.messages || [];
    const modalReplyBadge = document.getElementById('modalReplyBadge');
    const modalMsgCountText = document.getElementById('modalMsgCountText');
    if (modalReplyBadge) {
        modalReplyBadge.classList.add('hidden');
    }
    if (modalMsgCountText) {
        modalMsgCountText.innerText = `${msgs.length} ${msgs.length === 1 ? 'Message' : 'Messages'}`;
    }

    updateModalStatusTracker(q.status);
    renderReplyTimeline(q.messages || []);

    const modal = document.getElementById('queryModal');
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            modal.firstElementChild.classList.remove('scale-95');
            modal.firstElementChild.classList.add('scale-100');
            const container = document.getElementById('replyTimeline');
            if (container) container.scrollTop = container.scrollHeight;
        }, 10);
    }

    if (chatPollTimer) clearInterval(chatPollTimer);
    refreshActiveQueryMessages(queryId, true);
    chatPollTimer = setInterval(() => {
        if (activeQueryId) {
            refreshActiveQueryMessages(activeQueryId, true);
        }
    }, 3000);
}

function renderReplyTimeline(replyData) {
    const container = document.getElementById('replyTimeline');
    if (!container) return;

    const messages = Array.isArray(replyData) ? replyData : [];

    if (messages.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 bg-white/80 rounded-2xl border border-dashed border-slate-200">
                <div class="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2 text-base">
                    <i class="fa-solid fa-comments"></i>
                </div>
                <p class="text-xs font-semibold text-slate-700">No responses yet</p>
                <p class="text-[11px] text-slate-400 mt-0.5">Send a message below to chat with your academic desk!</p>
            </div>
        `;
        return;
    }

    const previousScrollHeight = container.scrollHeight;
    const isScrolledToBottom = (container.scrollHeight - container.scrollTop - container.clientHeight) < 60;

    container.innerHTML = messages.map(msg => {
        const role = (msg.sender_role || "").toLowerCase();
        // A message is from the student ONLY if sender_role is student
        const isStudent = role === "student";
        const timeStr = formatChatTime(msg.sent_at);
        const roleDisplay = role ? role.toUpperCase() : "OFFICER";

        let senderLabel = msg.sender_name || "";
        if (!senderLabel) {
            senderLabel = isStudent ? "You" : roleDisplay;
        }

        if (isStudent) {
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
            return `
                <div class="flex justify-start my-2">
                    <div class="max-w-[85%] sm:max-w-[75%] bg-white text-slate-800 rounded-2xl rounded-tl-xs px-4 py-2.5 shadow-xs border border-slate-200 space-y-1">
                        <div class="flex items-center justify-between gap-3 text-[10px] mb-1">
                            <span class="font-bold text-blue-600 flex items-center gap-1.5">
                                <i class="fa-solid fa-shield-halved text-[11px]"></i>
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

function closeModal() {
    if (chatPollTimer) {
        clearInterval(chatPollTimer);
        chatPollTimer = null;
    }
    const modal = document.getElementById('queryModal');
    if (modal) {
        modal.classList.add('opacity-0');
        modal.firstElementChild.classList.remove('scale-100');
        modal.firstElementChild.classList.add('scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
            activeQueryId = null;
        }, 300);
    }
}

const logoutButton = document.getElementById("logout_button");
if (logoutButton) {
    logoutButton.addEventListener("click", () => {
        localStorage.removeItem("user_session");
        window.location.href = "../01_Login/01_login.html";
    });
}

// ==========================================
// CAMPUS ANNOUNCEMENTS FOR STUDENTS
// ==========================================

let studentAnnouncements = [];
let studentAnnFilter = 'all';
let dismissedBannerId = null;

async function fetchStudentAnnouncements(showLoading = false) {
    const feed = document.getElementById("student-announcements-feed");
    if (showLoading && feed) {
        feed.innerHTML = `
            <div class="flex flex-col items-center justify-center py-12 text-slate-400 text-center">
                <i class="fa-solid fa-spinner fa-spin text-2xl text-blue-600 mb-2"></i>
                <p class="text-xs">Fetching campus announcements...</p>
            </div>
        `;
    }

    try {
        const res = await fetch(`${API_BASE}/announcements/?active_only=true`);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        studentAnnouncements = Array.isArray(data) ? data : [];
    } catch (err) {
        console.error("Error fetching student announcements:", err);
        studentAnnouncements = [];
    }

    updateStudentAnnouncementBadges();
    updateStudentUrgentBanner();
    renderStudentAnnouncements();
}

function updateStudentAnnouncementBadges() {
    const badge = document.getElementById("navAnnouncementBadge");
    if (badge) {
        const count = studentAnnouncements.length;
        if (count > 0) {
            badge.innerText = count;
            badge.classList.remove("hidden");
        } else {
            badge.classList.add("hidden");
        }
    }
}

function updateStudentUrgentBanner() {
    const banner = document.getElementById("student-urgent-announcement-banner");
    if (!banner) return;

    // Find the latest active urgent or important notice that hasn't been dismissed in this session
    const alertNotice = studentAnnouncements.find(a => {
        const prio = (a.priority || '').toLowerCase();
        return (prio === 'urgent' || prio === 'important') && a.id !== dismissedBannerId;
    });

    if (alertNotice) {
        const titleEl = document.getElementById("student-banner-title");
        const prevEl = document.getElementById("student-banner-preview");
        const dateEl = document.getElementById("student-banner-date");
        const catEl = document.getElementById("student-banner-category");

        if (titleEl) titleEl.innerText = alertNotice.title;
        if (prevEl) prevEl.innerText = alertNotice.message;
        if (catEl) catEl.innerText = alertNotice.category || 'General';

        if (dateEl) {
            try {
                dateEl.innerText = new Date(alertNotice.created_at).toLocaleDateString([], {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                });
            } catch (e) {
                dateEl.innerText = "";
            }
        }

        banner.classList.remove("hidden");
        banner.dataset.announcementId = alertNotice.id;
    } else {
        banner.classList.add("hidden");
    }
}

function dismissStudentBanner() {
    const banner = document.getElementById("student-urgent-announcement-banner");
    if (banner) {
        const id = banner.dataset.announcementId;
        if (id) dismissedBannerId = parseInt(id);
        banner.classList.add("hidden");
    }
}

function setStudentAnnouncementFilter(filter) {
    studentAnnFilter = filter;
    ['all', 'urgent', 'academic', 'exam', 'fee'].forEach(f => {
        const btn = document.getElementById(`student-ann-filter-${f}`);
        if (!btn) return;
        const matches = f === filter.toLowerCase() || (f === 'fee' && filter === 'Fee & Finance');
        if (matches) {
            btn.className = "px-3 py-1.5 rounded-lg font-bold bg-white text-blue-600 shadow-xs transition cursor-pointer";
        } else {
            btn.className = "px-3 py-1.5 rounded-lg font-medium text-slate-600 hover:text-blue-600 transition cursor-pointer";
        }
    });
    renderStudentAnnouncements();
}

function renderStudentAnnouncements() {
    const feed = document.getElementById("student-announcements-feed");
    const countEl = document.getElementById("student-ann-count");
    if (!feed) return;

    let list = studentAnnouncements || [];
    if (studentAnnFilter === 'urgent') {
        list = list.filter(a => (a.priority || '').toLowerCase() === 'urgent');
    } else if (studentAnnFilter !== 'all') {
        list = list.filter(a => (a.category || '').toLowerCase() === studentAnnFilter.toLowerCase());
    }

    if (countEl) countEl.innerText = list.length;

    if (list.length === 0) {
        feed.innerHTML = `
            <div class="bg-white p-10 rounded-2xl border border-blue-200/70 text-center flex flex-col items-center justify-center space-y-3">
                <div class="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <i class="fa-solid fa-bullhorn text-2xl"></i>
                </div>
                <h4 class="font-bold text-slate-800 text-base">No announcements in this category</h4>
                <p class="text-xs text-slate-500 max-w-sm leading-relaxed">
                    Official administrative broadcasts, exams datesheets, and notices will appear here once published by the university administration.
                </p>
            </div>
        `;
        return;
    }

    feed.innerHTML = list.map(item => {
        const priority = (item.priority || 'normal').toLowerCase();
        let borderClass = 'border-blue-200/80 hover:border-blue-300';
        let prioPill = '';
        let iconBg = 'bg-blue-50 text-blue-600 border border-blue-200';

        if (priority === 'urgent') {
            borderClass = 'border-rose-300 bg-gradient-to-br from-white to-rose-50/20';
            prioPill = '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1"><i class="fa-solid fa-triangle-exclamation text-[9px]"></i> Urgent Notice</span>';
            iconBg = 'bg-rose-100 text-rose-700 border border-rose-300';
        } else if (priority === 'important') {
            borderClass = 'border-amber-300 bg-gradient-to-br from-white to-amber-50/20';
            prioPill = '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1"><i class="fa-solid fa-star text-[9px]"></i> Important</span>';
            iconBg = 'bg-amber-100 text-amber-700 border border-amber-300';
        } else {
            prioPill = '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Notice</span>';
        }

        const catPill = `<span class="px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">${escapeHtml(item.category || 'General')}</span>`;

        let formattedTime = "";
        try {
            formattedTime = new Date(item.created_at).toLocaleString([], {
                month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });
        } catch (e) {
            formattedTime = item.created_at || "";
        }

        return `
            <div class="bg-white p-5 sm:p-6 rounded-2xl border ${borderClass} shadow-xs hover:shadow-sm transition-all space-y-3.5">
                <div class="flex items-start justify-between gap-3">
                    <div class="flex items-start space-x-3.5 min-w-0 flex-1">
                        <div class="w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0">
                            <i class="fa-solid fa-bullhorn text-sm"></i>
                        </div>
                        <div class="space-y-1 min-w-0 flex-1">
                            <div class="flex items-center gap-2 flex-wrap">
                                ${prioPill}
                                ${catPill}
                                <span class="text-[11px] text-slate-400 font-medium">${formattedTime}</span>
                            </div>
                            <h4 class="text-base font-bold text-slate-900 tracking-tight break-words">${escapeHtml(item.title)}</h4>
                        </div>
                    </div>
                </div>

                <div class="bg-slate-50/80 p-4 rounded-xl border border-slate-200/70">
                    <p class="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line font-sans break-words">${escapeHtml(item.message)}</p>
                </div>

                <div class="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                    <div class="flex items-center gap-1.5 font-medium">
                        <i class="fa-solid fa-shield-halved text-blue-600"></i>
                        <span>Published by <strong>${escapeHtml(item.admin_name || 'Administration')}</strong></span>
                    </div>
                    <span class="text-slate-400">Target: All Students</span>
                </div>
            </div>
        `;
    }).join('');
}