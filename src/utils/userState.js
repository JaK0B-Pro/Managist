let currentUser = null;

export function setCurrentUser(username) {
    currentUser = username;
    // You can also store it in localStorage for persistence
    localStorage.setItem('currentUser', username);
}

export function getCurrentUser() {
    // First try to get from memory
    if (currentUser) return currentUser;
    
    // If not in memory, try to get from localStorage
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
        currentUser = storedUser;
        return storedUser;
    }
    
    return null;
}

export function clearCurrentUser() {
    currentUser = null;
    localStorage.removeItem('currentUser');
} 