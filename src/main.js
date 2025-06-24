const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;
const { getCurrentWindow, LogicalSize } = window.__TAURI__.window;
// const { event, window: tauriWindow, path } = window.__TAURI__.;
import { setCurrentUser } from './utils/userState.js';
import { setCurrentUser as setCurrentUserWithRole } from './utils/roleManager.js';

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
        
        // Set user with role information
        setCurrentUser(user); // Keep for backward compatibility
        setCurrentUserWithRole(user, adminValue); // New role-based storage
        
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

export async function resizeWindow(width, height) {
  const appWindow = await getCussrrentWindow();
  await appWindow.setSize({type: 'Logical', width, height});
}

export async function centerWindow() {
  const appWindow = await getCurrentWindow();
  await appWindow.center();
}

window.addEventListener("DOMContentLoaded", () => {

  document.getElementById("login_Button").addEventListener("click", login);
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