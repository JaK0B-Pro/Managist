let currentUser = null;

export function setCurrentUser(username) {
    // Create a proper user object instead of just storing the username string
    const userObject = {
        username: username,
        email: username + '@company.com',
        role: 'Employee',
        password: 'defaultPassword123' // Default password for demo
    };
    
    currentUser = userObject;
    // Store the complete user object as JSON
    localStorage.setItem('currentUser', JSON.stringify(userObject));
}

export function getCurrentUser() {
    // First try to get from memory
    if (currentUser) return currentUser;
    
    // If not in memory, try to get from localStorage
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
        try {
            // Try to parse as JSON first
            const userObject = JSON.parse(storedUser);
            currentUser = userObject;
            return userObject;
        } catch (error) {
            // If it's not JSON, assume it's just a username string and convert it
            const userObject = {
                username: storedUser,
                email: storedUser + '@company.com',
                role: 'Employee',
                password: 'defaultPassword123'
            };
            currentUser = userObject;
            // Update localStorage with the proper format
            localStorage.setItem('currentUser', JSON.stringify(userObject));
            return userObject;
        }
    }
    
    return null;
}

export function clearCurrentUser() {
    currentUser = null;
    localStorage.removeItem('currentUser');
}