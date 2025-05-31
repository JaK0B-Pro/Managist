import { resizeWindow } from "../utils/windowUtils.js";
import { clearCurrentUser } from '../utils/userState.js';

// Logout functionality
document.addEventListener('DOMContentLoaded', function() {
    const logoutButton = document.getElementById("logout-button");
    if (logoutButton) {
        logoutButton.addEventListener("click", () => {
            clearCurrentUser();  // Clear the user state
            resizeWindow(500, 600);
            window.location.href = "../";
        });
    }
});
