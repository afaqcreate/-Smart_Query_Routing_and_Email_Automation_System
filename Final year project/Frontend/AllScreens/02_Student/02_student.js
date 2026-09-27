// frontend/AllScreens/02_Student/02_student.js

const API_BASE_URL = "http://127.0.0.1:8000/api";

// 1. Inject the HTML into Gmail when the page loads
document.addEventListener('DOMContentLoaded', () => {
  injectPanel();
});

function injectPanel() {
  // Check if panel already exists
  if (document.getElementById('uquery-student-panel')) return;

  const panelContainer = document.createElement('div');
  panelContainer.id = 'uquery-extension-root';
  
  // Fetch the HTML file from the extension's resources
  fetch(chrome.runtime.getURL('frontend/AllScreens/02_Student/02_student.html'))
    .then(response => response.text())
    .then(html => {
      panelContainer.innerHTML = html;
      document.body.appendChild(panelContainer);
      initUI(); // Initialize logic after HTML is injected
    })
    .catch(err => console.error("Failed to load Student Panel HTML:", err));
}

// 2. Initialize UI Event Listeners
function initUI() {
  const panel = document.getElementById('uquery-student-panel');
  const closeBtn = document.getElementById('uquery-close-btn');
  const tabs = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const fileInput = document.getElementById('query-file');
  const fileNameDisplay = document.getElementById('file-name');
  const queryForm = document.getElementById('query-form');

  if (!panel) return;

  // For testing, auto-open the panel. In production, you'd trigger this via a button.
  panel.classList.remove('hidden');

  // Close Panel
  closeBtn.addEventListener('click', () => {
    panel.classList.add('hidden');
  });

  // Tab Switching
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');
      
      if (tab.dataset.tab === 'tab-history') {
        loadHistory();
      }
    });
  });

  // File Input Display
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      fileNameDisplay.textContent = e.target.files[0].name;
    } else {
      fileNameDisplay.textContent = '';
    }
  });

  // Form Submission
  queryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('submit-query-btn');
    submitBtn.textContent = 'Submitting...';
    submitBtn.disabled = true;

    const subject = document.getElementById('query-subject').value;
    const body = document.getElementById('query-body').value;

    try {
      // Retrieve logged in user from Chrome Storage
      const user = await getLoggedInUser();
      if (!user) throw new Error("User not logged in. Please login via the extension popup.");

      // Prepare payload matching your FastAPI QueryCreate schema
      const payload = {
        user_id: parseInt(user.id),
        student_id: user.email.split('@')[0], // Extracting student ID from email for now
        query_subject: subject,
        query_body: body,
        category: "General" // Backend will categorize later
      };

      // Call your FastAPI backend
      const response = await fetch(`${API_BASE_URL}/query/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to submit query');
      }

      // Success
      alert('Query submitted successfully!');
      queryForm.reset();
      fileNameDisplay.textContent = '';
      
      // Switch to history tab to show the new ticket
      document.querySelector('[data-tab="tab-history"]').click();

    } catch (error) {
      console.error('Error submitting query:', error);
      alert(`Error: ${error.message}`);
    } finally {
      submitBtn.textContent = 'Submit Query';
      submitBtn.disabled = false;
    }
  });
}

// Helper to get user from chrome storage
function getLoggedInUser() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['uquery_user'], (result) => {
      resolve(result.uquery_user || null);
    });
  });
}

// Load Query History from FastAPI
async function loadHistory() {
  const historyList = document.getElementById('history-list');
  historyList.innerHTML = '<div class="loading-state">Loading history...</div>';

  try {
    const user = await getLoggedInUser();
    if (!user) throw new Error("User not logged in");

    // Fetch all queries. Note: In production, you'd filter by student_id/user_id.
    // For FYP, we fetch all and filter client-side.
    const response = await fetch(`${API_BASE_URL}/query/`);
    if (!response.ok) throw new Error('Failed to fetch history');
    
    const allQueries = await response.json();
    
    // Filter queries for the current user
    const studentId = user.email.split('@')[0];
    const userQueries = allQueries.filter(q => q.student_id === studentId);

    historyList.innerHTML = ''; // Clear loading

    if (userQueries.length === 0) {
      historyList.innerHTML = '<div class="loading-state">No previous queries found.</div>';
      return;
    }

    userQueries.forEach(ticket => {
      const item = document.createElement('div');
      item.className = 'history-item';
      
      const statusClass = ticket.status.toLowerCase() === 'pending' ? 'status-pending' : 'status-resolved';
      
      item.innerHTML = `
        <div class="history-item-header">
          <span>#${ticket.query_id} - ${ticket.query_subject}</span>
          <span class="status-badge ${statusClass}">${ticket.status}</span>
        </div>
        <div class="history-item-body">${ticket.query_body}</div>
        <div style="font-size: 10px; color: #999; margin-top: 5px;">
          ${ticket.submitted_at}
        </div>
      `;
      historyList.appendChild(item);
    });

  } catch (error) {
    console.error('Error loading history:', error);
    historyList.innerHTML = '<div class="loading-state" style="color:red;">Failed to load history.</div>';
  }
}