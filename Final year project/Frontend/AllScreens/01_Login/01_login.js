const URL = "http://20.196.197.202:8000/api";
const button = document.querySelector('.btn-container');

if (button) {
  button.addEventListener('click', () => {
    // 🚀 FIXED: Open the login route cleanly in a popup browser window
    window.open(`${URL}/auth/google/login`, "_blank", "width=500,height=600");
  });
}


// 🎯 LISTEN FOR THE BACKEND MESSAGE DYNAMICALLY
window.addEventListener("message", (event) => {
    // Safety check: ensure the incoming broadcast matches our target message structure
    if (event.data && event.data.type === "GOOGLE_AUTH_SUCCESS") {
        const userdata = event.data.user;

        // Save session locally to memory spaces
        localStorage.setItem("user_session", JSON.stringify(userdata));

        // Redirect your main dashboard page immediately!
        if (userdata.role == "student") {
          window.location.href = "../02_Student/02_student.html";
        } else if(userdata.role == "instructor"){
          window.location.href = "../05_department/05_department.html";

        } else if(userdata.role == "head of department"){
          window.location.href = "../04_hod/04_hod.html";

        } else if(userdata.role == "it department"){
          window.location.href = "../05_department/05_department.html";

        } else if(userdata.role == "registrar department"){
          window.location.href = "../05_department/05_department.html";

        } else if(userdata.role == "exam department"){
          window.location.href = "../05_department/05_department.html";

        } else if(userdata.role == "finance department"){
          window.location.href = "../05_department/05_department.html";

        } else if(userdata.role == "admin"){
          window.location.href = "../06_admin/06_admin.html";

        }else {
          console.log(Error);
        }
    }
});



