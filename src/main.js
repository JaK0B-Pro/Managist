const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;
const { getCurrentWindow, LogicalSize } = window.__TAURI__.window;
// const { event, window: tauriWindow, path } = window.__TAURI__.;
import { setCurrentUser } from './utils/userState.js';
import { getCurrentUser, setCurrentUserWithRole } from './utils/roleManager.js'; // Modify this line

let greetInputEl;
let greetMsgEl;

let user;
let password;
let divMessage;

async function login() {
  user = document.getElementById("username").value;                                                                                                                                                                                                                                                                                                              
  password = document.getElementById("passwordInput").value;
  divMessage = document.getElementById("login-message");

  try {
    console.log(user);
    console.log(password);

    await listen("login-result", (event) => {
      const response = event.payload;      if (response.startsWith("LoggedIn:")) {
        // Get admin value (role)
        const adminValue = response.split(":")[1];
        console.log('Login response:', response);
        console.log('Extracted admin value:', adminValue);
        console.log('Admin value type:', typeof adminValue);
          // Set user with role information (this should be the primary storage)
        console.log('About to call setCurrentUserWithRole with:', user, adminValue);
        setCurrentUserWithRole(user, adminValue);
        
        // Verify what was stored
        const storedUser = localStorage.getItem('currentUser');
        console.log('Stored user after login:', storedUser);
        const parsedUser = JSON.parse(storedUser);
        console.log('Parsed stored user:', parsedUser);
        console.log('Role field value:', parsedUser.role);
        console.log('Admin field value:', parsedUser.admin);
        
        divMessage.textContent = "You are successfully logged in!";
        divMessage.style.color = "green";
          // Redirect based on admin value
        setTimeout(() => {
          if (adminValue === "1") {
            showAdminPage();
          } else if (adminValue === "2") {
            showManagerPage();
          } else {
            showEmployeePage();
          }
        }, 2000);
      } else if (response === "Invalid Credentials") {
        divMessage.textContent = "Invalid Credentials please try again.";
        divMessage.style.color = "red";
      } else {
        divMessage.textContent = "An error occurred. Please try again.";
        divMessage.style.color = "red";
      }
    });

    await invoke("login", { user, password });
  }
  catch (error) {
    console.error("Error during login: ", error);
    divMessage.textContent = "An error occurred. Please try again later.";
    divMessage.style.color = "orange";
  }
}

// Function to show admin dashboard
async function showAdminPage() {
  const appWindow = await getCurrentWindow();
  await appWindow.setSize({ type: 'Logical', width: 1080, height: 720 });
  await appWindow.center();

  globalThis.window.location.href = './dashboard/index.html';
}

// Function to show manager dashboard (role 2)
async function showManagerPage() {
  const appWindow = await getCurrentWindow();
  await appWindow.setSize({ type: 'Logical', width: 1080, height: 720 });
  await appWindow.center();

  globalThis.window.location.href = './dashboard/index.html';
}

// Function to show employee dashboard - keeping this for future use if needed
async function showEmployeePage() {
  const appWindow = await getCurrentWindow();
  await appWindow.setSize({ type: 'Logical', width: 1080, height: 720 });
  await appWindow.center();

  // Make sure this path exists or adjust it to an existing page
  globalThis.window.location.href = './dashboard/employee/emploi.html';
}

async function checkLoginStatus() {
  const user = getCurrentUser();
  console.log('Checking login status on startup. User:', user);
  if (user && user.role) {
    const role = user.role;
    console.log('User found with role:', role);
    if (role === "1") {
      await showAdminPage();
    } else if (role === "2") {
      await showManagerPage();
    } else {
      await showEmployeePage();
    }
    return true; // A redirect was initiated
  } else {
    console.log('No active user session found.');
    return false; // No redirect
  }
}

export async function resizeWindow(width, height) {
  const appWindow = await getCussrrentWindow();
  await appWindow.setSize({type: 'Logical', width, height});
}

export async function centerWindow() {
  const appWindow = await getCurrentWindow();
  await appWindow.center();
}

window.addEventListener("DOMContentLoaded", async () => {
  console.log("DOM content loaded. Checking login status...");
  const redirected = await checkLoginStatus(); // Await the check and get its status

  if (!redirected) {
    // Only initialize login form elements if no redirect occurred
    const loginButton = document.getElementById("login_Button");
    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("passwordInput");
    const loginMessage = document.getElementById("login-message");

    if (usernameInput && passwordInput && loginButton && loginMessage) {
      user = usernameInput.value;
      password = passwordInput.value;
      divMessage = loginMessage;
      loginButton.addEventListener("click", login);
    } else {
      console.warn("Login page elements not found. This is expected if already redirected.");
    }
  }
});

// togglePassword.addEventListener('click', () => {

//   const currentType = passwordInut.getAttribute('type');
//   if (currentType === 'password') {
//     passwordInut.setAttribute('type', 'text');
//   } 
//   else {
//     passwordInut.setAttribute('type', 'password');
//   }
// });
// document.getElementById("login_Button").addEventListener("click", ()  => {

//   username = document.getElementById("username").value;                                                                                                                                                                                                                                                                                                                           
//   password = document.getElementById("passwordInput").value;

//   console.log(username);
//   console.log(password);
// });