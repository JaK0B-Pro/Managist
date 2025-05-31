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

    // Existing settings functionality
    document.getElementById('change-language').addEventListener('click', function() {
        alert('🌍 Language change feature coming soon!');
    });

    document.getElementById('change-password').addEventListener('click', function() {
        alert('🔒 Password change feature coming soon!');
    });

    document.getElementById('open-chat').addEventListener('click', function() {
        alert('💬 Chat feature coming soon!');
    });

    document.getElementById('logout-setting').addEventListener('click', function() {
        clearCurrentUser();
        resizeWindow(500, 600);
        window.location.href = "../";
    });
});
