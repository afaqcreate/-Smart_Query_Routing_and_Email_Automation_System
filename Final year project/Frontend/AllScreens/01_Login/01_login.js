const URL = window.getApiUrl ? window.getApiUrl() : "http://127.0.0.1:8000/api";
const button = document.querySelector('.btn-container');

if (button) {
  button.addEventListener('click', () => {
    setGlobalLoading(true);
    
    // Open the login route cleanly in a popup browser window
    const authWindow = window.open(`${URL}/auth/google/login`, "_blank", "width=500,height=600");

    // 🛡️ Safety fallback: If user closes the popup manually, reset loading state
    const checkClosed = setInterval(() => {
      if (authWindow && authWindow.closed) {
        clearInterval(checkClosed);
        setGlobalLoading(false);
      }
    }, 1000);
  });
}

// 🎯 LISTEN FOR THE BACKEND MESSAGE DYNAMICALLY
window.addEventListener("message", (event) => {
    // Safety check: ensure the incoming broadcast matches our target message structure
    if (event.data && event.data.type === "GOOGLE_AUTH_SUCCESS") {
        const userdata = event.data.user;

        // Save session locally to memory spaces
        localStorage.setItem("user_session", JSON.stringify(userdata));

        // Stop loading state before redirecting
        setGlobalLoading(false);

        // Redirect your main dashboard page immediately based on role!
        const role = (userdata.role || "").toLowerCase();

        if (role === "student") {
          window.location.href = "../02_Student/02_student.html";
        } else if (role === "instructor" || role === "it department" || role === "registrar department" || role === "exam department" || role === "finance department") {
          window.location.href = "../05_department/05_department.html";
        } else if (role === "head of department") {
          window.location.href = "../04_hod/04_hod.html";
        } else if (role === "admin") {
          window.location.href = "../06_admin/06_admin.html";
        } else {
          console.error("Unknown user role:", userdata.role);
          setGlobalLoading(false);
        }
    }
});