const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

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

// Utility functions (embedded to avoid import issues)
async function resizeWindow(width, height) {
    const { getCurrentWindow } = window.__TAURI__.window;
    const appWindow = await getCurrentWindow();
    await appWindow.setSize({ type: 'Logical', width, height });
}

function clearCurrentUser() {
    localStorage.removeItem('currentUser');
}

document.addEventListener('DOMContentLoaded', function() {
    setupRoleBasedNavigation(); // Setup role-based navigation first
    
    // Logout functionality
    const logoutButton = document.getElementById("logout-button");
    if (logoutButton) {
        logoutButton.addEventListener("click", () => {
            clearCurrentUser();
            resizeWindow(500, 600);
            window.location.href = "../../";
        });
    }

    // Password change functionality
    initPasswordChangeSystem();    // Chat and language features - popups removed
    // The openSection function in HTML will handle the section opening directly
    setupRoleBasedNavigation();
});

function initPasswordChangeSystem() {
    const passwordForm = document.getElementById('password-change-form');
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const passwordStrength = document.getElementById('password-strength');
    const toast = document.getElementById('toast-notification');
    const closeToast = document.getElementById('close-toast');

    // Password visibility toggle
    document.querySelectorAll('.toggle-password').forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.getAttribute('data-target');
            const targetInput = document.getElementById(targetId);
            const icon = button.querySelector('i');
            
            if (targetInput.type === 'password') {
                targetInput.type = 'text';
                icon.className = 'fas fa-eye-slash';
            } else {
                targetInput.type = 'password';
                icon.className = 'fas fa-eye';
            }
        });
    });

    // Password strength checker
    if (newPasswordInput && passwordStrength) {
        newPasswordInput.addEventListener('input', () => {
            const password = newPasswordInput.value;
            const strength = checkPasswordStrength(password);
            
            passwordStrength.textContent = strength.text;
            passwordStrength.className = `password-strength ${strength.class}`;
        });
    }

    // Password confirmation validation
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', () => {
            const newPassword = newPasswordInput.value;
            const confirmPassword = confirmPasswordInput.value;
            
            if (confirmPassword && newPassword !== confirmPassword) {
                confirmPasswordInput.setCustomValidity('Passwords do not match');
            } else {
                confirmPasswordInput.setCustomValidity('');
            }
        });
    }

    // Form submission
    if (passwordForm) {
        passwordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const currentPassword = document.getElementById('current-password').value;
            const newPassword = newPasswordInput.value;
            const confirmPassword = confirmPasswordInput.value;
            
            // Validation
            if (newPassword !== confirmPassword) {
                showToast('New passwords do not match!', 'error');
                return;
            }
            
            if (newPassword.length < 6) {
                showToast('New password must be at least 6 characters long!', 'error');
                return;
            }

            if (currentPassword === newPassword) {
                showToast('New password must be different from current password!', 'error');
                return;
            }

            try {
                // Get current user from localStorage
                const userData = localStorage.getItem('currentUser');
                if (!userData) {
                    showToast('User data not found. Please log in again.', 'error');
                    return;
                }
                
                const currentUser = JSON.parse(userData);
                const username = currentUser.username || currentUser.name;
                
                if (!username) {
                    showToast('Username not found. Please log in again.', 'error');
                    return;
                }

                // Disable submit button during request
                const submitBtn = passwordForm.querySelector('.submit-btn');
                submitBtn.disabled = true;
                submitBtn.textContent = 'Updating...';

                // Set up event listener for the password update result
                const unlisten = await listen("password-update-result", (event) => {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Password';
                    
                    if (event.payload === "Password updated successfully") {
                        // Update localStorage with new password
                        currentUser.password = newPassword;
                        localStorage.setItem('currentUser', JSON.stringify(currentUser));
                        
                        showToast('Password updated successfully!', 'success');
                        passwordForm.reset();
                        passwordStrength.textContent = '';
                        passwordStrength.className = 'password-strength';
                        
                        // Close password section after successful update
                        setTimeout(() => {
                            closePasswordSection();
                        }, 2000);
                    } else if (event.payload === "Invalid current password") {
                        showToast('Current password is incorrect!', 'error');
                    } else {
                        showToast('An error occurred while updating password.', 'error');
                    }
                    
                    // Clean up listener
                    unlisten();
                });
                
                // Call backend to update password in database
                await invoke('update_user_password', {
                    username: username,
                    currentPassword: currentPassword,
                    newPassword: newPassword
                });

            } catch (error) {
                const submitBtn = passwordForm.querySelector('.submit-btn');
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Password';
                
                showToast('An error occurred while updating password.', 'error');
                console.error('Password update error:', error);
            }
        });
    }

    // Toast notification system
    function showToast(message, type = 'success') {
        const toastMessage = document.getElementById('toast-message');
        const toastIcon = document.getElementById('toast-icon');
        
        if (toastMessage) toastMessage.textContent = message;
        
        // Set icon based on type
        if (toastIcon) {
            if (type === 'success') {
                toastIcon.className = 'fas fa-check-circle';
            } else if (type === 'error') {
                toastIcon.className = 'fas fa-exclamation-circle';
            }
        }
        
        toast.className = `toast ${type}`;
        toast.classList.remove('hidden');
        toast.classList.add('show');
        
        // Auto hide after 5 seconds
        setTimeout(() => {
            hideToast();
        }, 5000);
    }

    function hideToast() {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 300);
    }

    // Close toast manually
    if (closeToast) {
        closeToast.addEventListener('click', hideToast);
    }
}

// Password strength checker function
function checkPasswordStrength(password) {
    let score = 0;
    
    if (password.length >= 8) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    
    if (score < 2) {
        return { text: 'Weak password', class: 'weak' };
    } else if (score < 4) {
        return { text: 'Medium strength', class: 'medium' };
    } else {
        return { text: 'Strong password', class: 'strong' };
    }
}
