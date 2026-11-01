// --- CONSTANTS & STATE STORAGE ---
const API_BASE = "http://20.196.197.202:8000/api";

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
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
};

let queriesData = [];
let uploadedFiles = [];
let currentFilter = 'ALL';
let activeQueryId = null;

window.onload = async function() {
    loadUserProfile();
    await fetchQueriesforstudent();
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
    document.getElementById(tabId).classList.remove('hidden');

    const navSubmit = document.getElementById('navSubmit');
    const navHistory = document.getElementById('navHistory');
    const pageTitle = document.getElementById('pageTitle');
    const pageSubTitle = document.getElementById('pageSubTitle');

    if (tabId === 'submitTab') {
        pageTitle.innerText = "Submit New Query";
        pageSubTitle.innerText = "Need help? Fill in the details below and our academic desk will assist you.";
        
        navSubmit.className = "w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 bg-blue-50 text-blue-600 border border-blue-200";
        navHistory.className = "w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-all duration-200";
    } else {
        pageTitle.innerText = "Query History & Tracking";
        pageSubTitle.innerText = "Track your submitted tickets, view status updates, and read desk replies.";
        
        navHistory.className = "w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 bg-blue-50 text-blue-600 border border-blue-200";
        navSubmit.className = "w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-all duration-200";
        
        fetchQueriesforstudent();
    }

    if (window.innerWidth < 768) {
        document.getElementById('navContainer').classList.add('hidden');
    }
}

// --- BACKEND API INTEGRATION ---

async function fetchQueriesforstudent() {
    try {
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
        } else {
            console.error("Failed to fetch queries from backend");
        }
    } catch (error) {
        console.error("Connection error:", error);
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
            message_body: message,
            status: "in_progress"
        };

        const response = await fetch(`${API_BASE}/query/${activeQueryId}/messages`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            input.value = "";
            await fetchQueriesforstudent();
            openQueryModal(activeQueryId);
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
        
        const card = document.createElement('div');
        card.className = "bg-white p-5 rounded-2xl border border-blue-200/70 hover:border-blue-600 shadow-xs hover:shadow-md transition-all cursor-pointer space-y-3";
        card.onclick = () => openQueryModal(q.query_id);

        card.innerHTML = `
            <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center space-x-2">
                    <span class="text-xs font-extrabold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">${queryIdFormatted}</span>
                    <span class="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold">${q.category || 'General'}</span>
                </div>
                <div>${statusBadge}</div>
            </div>

            <div>
                <h3 class="font-bold text-slate-900 text-base line-clamp-1">${q.query_subject}</h3>
                <p class="text-xs text-slate-500 line-clamp-2 mt-1">${q.query_body}</p>
            </div>

            <div class="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                <span><i class="fa-regular fa-clock mr-1"></i>${q.submitted_at ? new Date(q.submitted_at).toLocaleString() : 'N/A'}</span>
                <span class="text-blue-600 font-bold flex items-center"><i class="fa-solid fa-comment-dots mr-1"></i>${q.message ? '1 Reply' : 'No Reply'}</span>
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
}

function openQueryModal(queryId) {
    activeQueryId = queryId;
    const q = queriesData.find(item => item.query_id === queryId);
    if (!q) return;

    document.getElementById('modalQueryId').innerText = `ACT# - ${q.query_id}`;
    document.getElementById('modalSubject').innerText = q.query_subject || "";
    document.getElementById('modalTimestamp').innerText = "Submitted: " + (q.submitted_at ? new Date(q.submitted_at).toLocaleString() : '');
    document.getElementById('modalDescription').innerText = q.query_body || "";

    const progressBar = document.getElementById('modalProgressBar');
    const stepProgress = document.getElementById('stepProgress');
    const stepResolved = document.getElementById('stepResolved');

    if (progressBar && stepProgress && stepResolved) {
        stepProgress.className = "w-8 h-8 rounded-full bg-white text-slate-400 border-2 border-slate-300 flex items-center justify-center font-bold text-xs shadow-xs";
        stepResolved.className = "w-8 h-8 rounded-full bg-white text-slate-400 border-2 border-slate-300 flex items-center justify-center font-bold text-xs shadow-xs";

        const statusStr = (q.status || "").toLowerCase();
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

    renderReplyTimeline(q.message);

    const modal = document.getElementById('queryModal');
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            modal.firstElementChild.classList.remove('scale-95');
            modal.firstElementChild.classList.add('scale-100');
        }, 10);
    }
}

function renderReplyTimeline(replyData) {
    const container = document.getElementById('replyTimeline');
    if (!container) return;
    container.innerHTML = '';

    if (!replyData) {
        container.innerHTML = `
            <div class="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <p class="text-xs text-slate-400">No responses from instructor or desk yet. Send a follow-up message below!</p>
            </div>
        `;
        return;
    }

    if (Array.isArray(replyData)) {
        container.innerHTML = replyData.map(msg => {
            const isStudent = msg.sender_id === currentStudent.student_id;
            const youroll = msg.sender_roll in ['admin','head of department', user.roll]
            return `
                <div class="flex ${isStudent ? 'justify-end' : 'justify-start'} my-2">
                    <div class="max-w-[85%] rounded-2xl p-4 ${isStudent ? 'bg-blue-50 border border-blue-200 text-slate-900' : 'bg-blue-50 border border-blue-200 text-slate-800'} shadow-xs space-y-1">
                        <div class="flex items-center justify-between text-[10px] text-blue-600 font-bold mb-1">
                            <span><i class="fa-solid ${isStudent ? 'fa-user' : 'fa-user-shield'} mr-1"></i>${isStudent ? 'You' : ''}</span>
                        </div>
                        <p class="text-xs leading-relaxed whitespace-pre-wrap">${msg.message_body || msg}</p>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        container.innerHTML = `
            <div class="flex justify-start">
                <div class="max-w-[85%] rounded-2xl p-4 bg-blue-50 border border-blue-200 text-slate-800 shadow-xs space-y-1">
                    <div class="flex items-center justify-between text-[10px] text-blue-600 font-bold mb-1">
                        <span><i class="fa-solid fa-user-shield mr-1"></i>University Desk / Instructor</span>
                    </div>
                    <p class="text-xs leading-relaxed whitespace-pre-wrap">${replyData}</p>
                </div>
            </div>
        `;
    }
}

function closeModal() {
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