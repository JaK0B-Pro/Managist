const { invoke } = window.__TAURI__.core;

// Utility functions (embedded to avoid import issues)
async function resizeWindow(width, height) {
    const { getCurrentWindow } = window.__TAURI__.window;
    const appWindow = await getCurrentWindow();
    await appWindow.setSize({ type: 'Logical', width, height });
}

async function centerWindow() {
    const { getCurrentWindow } = window.__TAURI__.window;
    const appWindow = await getCurrentWindow();
    await appWindow.center();
}

function getCurrentUser() {
    try {
        const userData = localStorage.getItem('currentUser');
        return userData ? JSON.parse(userData).username || JSON.parse(userData).name : null;
    } catch (error) {
        console.error('Error getting current user:', error);
        return null;
    }
}

function clearCurrentUser() {
    localStorage.removeItem('currentUser');
}

// Logout functionality
document.getElementById("logout-button").addEventListener("click", () => {
    clearCurrentUser();
    resizeWindow(500, 600);
    window.location.href = "../";
});

// Load dashboard statistics from database
async function loadDashboardStats() {
    try {
        const stats = await invoke('get_dashboard_stats');
        
        // Update total projects
        const totalProjectsElement = document.getElementById('total-projects');
        if (totalProjectsElement) {
            totalProjectsElement.textContent = stats.total_projects;
        }
        
        // Update total apartments
        const totalApartmentsElement = document.getElementById('total-apartments');
        if (totalApartmentsElement) {
            totalApartmentsElement.textContent = stats.total_apartments;
        }
        
        // Update average progress (rounded to 1 decimal place)
        const averageProgressElement = document.getElementById('average-progress');
        if (averageProgressElement) {
            const progressPercentage = Math.round(stats.average_progress * 10) / 10;
            averageProgressElement.textContent = `${progressPercentage}%`;
        }
        
    } catch (error) {
        console.error('Error loading dashboard statistics:', error);
        
        // Show error message in the elements
        const totalProjectsElement = document.getElementById('total-projects');
        const totalApartmentsElement = document.getElementById('total-apartments');
        const averageProgressElement = document.getElementById('average-progress');
        
        if (totalProjectsElement) totalProjectsElement.textContent = 'Error';
        if (totalApartmentsElement) totalApartmentsElement.textContent = 'Error';
        if (averageProgressElement) averageProgressElement.textContent = 'Error';
    }
}

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

// Role-based access control (inline to avoid import issues)
function getCurrentUserRole() {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
        try {
            const userObject = JSON.parse(storedUser);
            return userObject.role || '0';
        } catch (error) {
            return '0';
        }
    }
    return '0';
}

function setupRoleBasedNavigation() {
    const role = getCurrentUserRole();
    
    // Hide salary link for role 2 (Manager)
    if (role === '2') {
        const salaryLinks = document.querySelectorAll('a[href*="salaire"]');
        salaryLinks.forEach(link => {
            const listItem = link.closest('li');
            if (listItem) {
                listItem.style.display = 'none';
            }
        });
    }
}

// Call functions when the page loads
window.addEventListener('DOMContentLoaded', () => {
    updateUserDisplay();
    loadDashboardStats();
    setupRoleBasedNavigation();
});