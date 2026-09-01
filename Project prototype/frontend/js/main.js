let tickets = [];
let ticketCounter = 1092;
let currentDesk = 'all';

// ============================================================
// SUBMIT QUERYa
// ============================================================
function submitQuery() {
    const studentId = document.getElementById('studentId').value.trim();
    const studentEmail = document.getElementById('studentEmail').value.trim();
    const subject = document.getElementById('emailSubject').value.trim();
    const body = document.getElementById('emailBody').value.trim();
    console.log('Submitting query...');
    if (!subject || !body || !studentEmail || !studentId) {
        showStatus('⚠️ Please fill the form.', 'red');
        return;
    }
    fetch("http://127.0.0.1:8000/api/tickets/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            student_id: studentId,
            email: studentEmail,
            subject: subject,
            email_body: body
        })
    })
        .then(response => response.json())
        .then(data => {
            // console.log("Response:", data);
            renderTicketDetails(data);
            renderRoutingDetails(data);
            showStatus('✅ Ticket #ACT-' + data.ticket_id + ' created and saved to database!', 'green');
            getTickets();
        })
        .catch(error => {
            console.error("Error:", error);
        });
}



//============================================================
// HELPER: Fill a cloned template's [data-field] elements
// ============================================================
function fillFields(root, data) {
    for (const [field, value] of Object.entries(data)) {
        const el = root.querySelector(`[data-field="${field}"]`);
        if (el) el.textContent = value;
    }
}

// ============================================================
// RENDER: Ticket Details
// ============================================================
function renderTicketDetails(ticket) {
    const container = document.getElementById('ticketDetails');
    const template = document.getElementById('ticketDetailsTemplate');
    const node = template.content.cloneNode(true);

    fillFields(node, {
        id: '#ACT- ' + ticket.ticket_id,
        status: ticket.status,
        studentId: ticket.student_id,
        studentEmail: ticket.email,
        subject: ticket.subject,
        body: ticket.email_body,
        timestamp: ticket.created_at,
        category: ticket.category
    });

    container.innerHTML = '';
    container.appendChild(node);
}

// ============================================================
// RENDER: Categorization & Routing
// ============================================================
function renderRoutingDetails(ticket) {
    const container = document.getElementById('routingDetails');
    const template = document.getElementById('routingDetailsTemplate');
    const node = template.content.cloneNode(true);
    fillFields(node, {
        confidence: ticket.confidence,
        label: ticket.category,
        priority: ticket.priority,
        assignedTo: ticket.routed_to,
        deskLabel: ticket.subject,
        category: ticket.category,
        id: ticket.ticket_id
    });
    
    container.innerHTML = '';
    container.appendChild(node);
}

// ============================================================
// RENDER: Desk Panel Dashboard
// ============================================================
function renderDeskPanel(deskFilter) {
    const panel = document.getElementById('deskPanel');
    let filtered = tickets;

    if (deskFilter !== 'all') {
        filtered = tickets.filter(t => {
            const ticketDesk = String(t.desk || t.category || '').toLowerCase();
            const targetFilter = String(deskFilter).toLowerCase();
            return ticketDesk.includes(targetFilter);
        });
    }

    panel.innerHTML = '';

    if (filtered.length === 0) {
        const emptyTemplate = document.getElementById('emptyDeskPanelTemplate');
        panel.appendChild(emptyTemplate.content.cloneNode(true));
        return;
    }

    const cardTemplate = document.getElementById('deskCardTemplate');

    for (const t of filtered) {
        // Safe lowercase check to assign correct styling class
        const currentDeskType = String(t.desk || t.category || '').toLowerCase();
        const deskClass = currentDeskType.includes('fee') ? 'fee' : 
                          currentDeskType.includes('scholarship') ? 'scholarship' : 'refund';
        
        const node = cardTemplate.content.cloneNode(true);
        const cardEl = node.querySelector('.ticket-card');
        cardEl.classList.add(deskClass);

        fillFields(node, {
            id: t.ticket_id,
            status: t.status,
            priority: t.priority,
            subject: t.subject,
            meta: t.studentId + ' · ' + t.timestamp,
            assignedTo: t.assignedTo
        });

                // 1. ADDED: Add a pointer cursor to indicate clickability
        cardEl.style.cursor = 'pointer';

        // 2. ADDED: Click event listener anywhere on the card to open popup modal
        cardEl.addEventListener('click', (e) => {
            // CRITICAL: Stop the popup modal if the user clicks the "Resolve" button directly
            if (e.target.closest('[data-action="resolve"]')) return;
            
            openTicketPopup(t);
        });

        // Fixed alignment to t.ticket_id since 'id' doesn't exist directly on mapping object
        node.querySelector('[data-action="resolve"]').addEventListener('click', () => markResolved(t.ticket_id));

        panel.appendChild(node);
    }
}


// ============================================================
// MARK RESOLVED
// ============================================================
function markResolved(ticketId) {
    const ticket = tickets.find(t => t.ticket_id === ticketId);
    
    if (ticket) {
        // 1. Update the status locally in our array
        ticket.status = 'Resolved';
        
        // 2. Redraw the dashboard panel immediately
        renderDeskPanel(currentDesk);
        
        // 3. Update the display layout panels with the resolved status
        renderTicketDetails(ticket);
        renderRoutingDetails(ticket);
        
        showStatus('✅ Ticket ' + ticketId + ' marked as Resolved!', 'green');
    }
}

// ============================================================
// SWITCH DESK
// ============================================================
function switchDesk(desk) {
    currentDesk = desk;
    document.querySelectorAll('.desk-tab').forEach(tab => {
        const d = tab.dataset.desk;
        tab.classList.toggle('active', d === desk);
    });
    renderDeskPanel(desk); 
}

// ============================================================
// STATUS MESSAGE
// ============================================================
function showStatus(message, color) {
    const el = document.getElementById('ingestionStatus');
    el.className = 'status-message ' + (color === 'green' ? 'status-message--green' : 'status-message--red');
    el.textContent = message;
    el.classList.remove('hidden');
    setTimeout(() => { el.classList.add('hidden'); }, 6000);
}

// ============================================================
// MODAL POPUP CONTROL ACTIONS
// ============================================================
function openTicketPopup(ticket) {
    const modal = document.getElementById('ticketModal');
    if (!modal) {
        console.error("Error: Element with ID 'ticketModal' not found in HTML.");
        return;
    }
    
    // Inject matching data values into the popup elements
    document.getElementById('popId').textContent = '#ACT-' + ticket.ticket_id;
    document.getElementById('popStatus').textContent = ticket.status;
    document.getElementById('popPriority').textContent = ticket.priority || 'Normal';
    document.getElementById('popCategory').textContent = ticket.category || 'General';
    document.getElementById('popStudentId').textContent = ticket.studentId || ticket.student_id;
    document.getElementById('popEmail').textContent = ticket.studentEmail || ticket.email;
    document.getElementById('popTimestamp').textContent = ticket.timestamp || ticket.created_at;
    document.getElementById('popSubject').textContent = ticket.subject;
    document.getElementById('popBody').textContent = ticket.body || ticket.email_body;

    // Tweak background colors based on ticket status
    const statusLabel = document.getElementById('popStatus');
    if (statusLabel) {
        statusLabel.className = 'badge';
        if (ticket.status === 'Resolved') {
            statusLabel.classList.add('resolved-status');
        } else {
            statusLabel.classList.add('pending-status');
        }
    }

    // Force show the modal overlay box layout
    modal.style.display = 'flex'; 
    modal.classList.remove('hidden');
}

// Global modal shutdown listener setups
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('ticketModal');
    const closeBtn = document.getElementById('closeModalBtn');
    
    // Close modal when X is clicked
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (modal) {
                modal.style.display = 'none';
                modal.classList.add('hidden');
            }
        });
    }

    // Close modal when clicking outside on the blurred overlay background
    window.addEventListener('click', (e) => {
        if (modal && e.target === modal) {
            modal.style.display = 'none';
            modal.classList.add('hidden');
        }
    });
});



// ============================================================
// LOAD SAMPLE DATA
// ============================================================
function loadSampleFee() {
    document.getElementById('emailSubject').value = 'Urgent: Challan Payment Verification & Late Fee Fine';
    document.getElementById('emailBody').value =
        'Respected Sir, I paid my semester fee voucher yesterday via mobile banking, but my LMS account still shows an unpaid status and has applied a Rs. 1000 late fine. Attached is my bank receipt. Kindly update my fee status.';
    document.getElementById('studentId').value = 'BC200401234';
    document.getElementById('studentEmail').value = 'student@vu.edu.pk';
    showStatus('📝 Sample Fee query loaded. Click Submit to process.', 'green');
    
}

function loadSampleScholarship() {
    document.getElementById('emailSubject').value = 'Scholarship Application Status Inquiry';
    document.getElementById('emailBody').value =
        'Dear Sir/Madam, I applied for the need-based scholarship three weeks ago. My application ID is S-2024-089. I have not received any confirmation yet. Please update me on the status. My father is a daily wager and I am relying on this scholarship to continue my studies.';
    document.getElementById('studentId').value = 'BC200400567';
    document.getElementById('studentEmail').value = 'scholar@vu.edu.pk';
    showStatus('📝 Sample Scholarship query loaded. Click Submit to process.', 'green');
}

function loadSampleRefund() {
    document.getElementById('emailSubject').value = 'Request for Refund After Course Withdrawal';
    document.getElementById('emailBody').value =
        'Hello, I withdrew from one course before the deadline and was told I am eligible for a partial refund of the excess payment. I have not received the reimbursement yet — could you please process my refund and confirm the amount?';
    document.getElementById('studentId').value = 'BC200405678';
    document.getElementById('studentEmail').value = 'refund@vu.edu.pk';
    showStatus('📝  Sample Refund query loaded. Click Submit to process.', 'green');
}

// ============================================================
// PAGE LOAD
// ============================================================
window.onload = function () {
    getTickets();
};

function getTickets() {
    const requestOptions = {
        method: "GET",
        redirect: "follow"
    };

    fetch("http://127.0.0.1:8000/api/tickets/", requestOptions)
        .then((response) => {
            if (!response.ok) throw new Error("Database fetch failed");

            return response.json(); 
        })

        .then(ticketList => {
            // 1. Map your records from the database
            let mappedTickets = ticketList.map(item => ({
                ticket_id: item.ticket_id,
                status: item.status,
                studentId: item.student_id,
                studentEmail: item.email,
                subject: item.subject,
                body: item.email_body,
                timestamp: item.created_at,
                category: item.category,
                desk: item.desk,
                priority: item.priority,
                assignedTo: item.routed_to
            }));

            tickets = mappedTickets.sort((a, b) => b.ticket_id - a.ticket_id);

            renderDeskPanel(currentDesk);
        })
        
        .catch((error) => console.error("Error breaking down data stream:", error));
}
