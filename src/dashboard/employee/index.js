// Employee Dashboard JavaScript
import { resizeWindow } from "../utils/windowUtils.js";
import { clearCurrentUser } from '../utils/userState.js';

document.addEventListener('DOMContentLoaded', function() {
  // Logout functionality
  const logoutButton = document.getElementById("logout-button");
  if (logoutButton) {
    logoutButton.addEventListener("click", () => {
      clearCurrentUser();  // Clear the user state
      resizeWindow(500, 600);
      window.location.href = "../";
    });
  }

  // Get current user from localStorage (set during login)
  const currentUser = localStorage.getItem('currentUser') || 'Employee';
  
  // Update welcome message with user name
  const welcomeHeading = document.querySelector('.welcome-message h2');
  if (welcomeHeading) {
    welcomeHeading.textContent = `Welcome, ${currentUser}`;
  }
  
  // Simulate loading some employee data
  // In a real application, you would fetch this from your backend
  setTimeout(() => {
    document.getElementById('task-count').textContent = '5';
    document.getElementById('completed-count').textContent = '2';
    document.getElementById('pending-count').textContent = '3';
  }, 500);
});