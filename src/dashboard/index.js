import { resizeWindow , centerWindow} from "../utils/windowUtils.js";
import { getCurrentUser, clearCurrentUser } from '../utils/userState.js';


document.getElementById("logout-button").addEventListener("click", () => {
    clearCurrentUser();  // Clear the user state
    resizeWindow(500, 600);
    window.location.href = "../";
});



// Update the username display
function updateUserDisplay() {
    const username = getCurrentUser();
    if (username) {
        const userDisplay = document.getElementById('userDisplay');        
        if (userDisplay) {
            userDisplay.textContent = username;
        }
    }
}

// Call it when the page loads
window.addEventListener('DOMContentLoaded', () => {
    updateUserDisplay();
});