// Debug: Add logging to track initialization
console.log('emploi.js loaded');

// Utility functions (embedded to avoid import issues)
async function resizeWindow(width, height) {
    try {
        if (window.__TAURI__ && window.__TAURI__.window) {
            const { getCurrentWindow } = window.__TAURI__.window;
            const appWindow = await getCurrentWindow();
            await appWindow.setSize({ type: 'Logical', width, height });
        }
    } catch (error) {
        console.warn('Failed to resize window:', error);
    }
}

function clearCurrentUser() {
    localStorage.removeItem('currentUser');
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded event fired');
    try {
        console.log('Starting initialization...');

        // Éléments DOM - Define elements first
        const elements = {
            calendar: document.getElementById('calendar'),
            currentMonth: document.getElementById('currentMonth'),
            navButtons: document.querySelectorAll('.nav-btn'),
            chatWindow: document.getElementById('chatWindow'),
            chatBody: document.getElementById('chatBody'),
            messageInput: document.getElementById('messageInput'),
            clearChatBtn: document.getElementById('clearChat')
        };

        console.log('Elements found:', elements);
        // Logout functionality
        const logoutButton = document.getElementById("logout-button");
        if (logoutButton) {
            logoutButton.addEventListener("click", () => {
                clearCurrentUser();  // Clear the user state
                resizeWindow(500, 600);
                window.location.href = "../../index.html";  // Go to login page
            });
        }

        // Configuration de base
    let currentDate = new Date();
    let dailySalary = 1500; // Default salary, will be updated from database
    let employeeData = null; // Will store employee data from database
    let attendance = JSON.parse(localStorage.getItem('attendance')) || {};
    let chatMessages = JSON.parse(localStorage.getItem('chatMessages')) || [];
      // Load employee data from database with error handling
    loadEmployeeDataFromDatabase();
    
    // Function to load employee data from database
    async function loadEmployeeDataFromDatabase() {
        try {
            // Check if Tauri is available
            if (!window.__TAURI__ || !window.__TAURI__.core) {
                console.warn('Tauri not available, using fallback');
                generateCalendar(currentDate.getMonth(), currentDate.getFullYear());
                return;
            }
            
            // Import Tauri API functions
            const { invoke } = window.__TAURI__.core;
            
            // Get current user from localStorage
            const userData = localStorage.getItem('currentUser');
            if (!userData) {
                console.warn('No user data found, using default calendar');
                generateCalendar(currentDate.getMonth(), currentDate.getFullYear());
                return;
            }
            
            const currentUser = JSON.parse(userData);
            
            // Fetch employee data from database using the logged-in user's name
            const result = await invoke('get_employee_by_name', {
                employeeName: currentUser.username
            });
            
            if (result) {
                employeeData = result;
                
                // Update daily salary based on database prix_jour
                dailySalary = parseFloat(employeeData.prix_jour) || 1500;
                
                // Generate calendar with worked days from database
                generateCalendarWithWorkedDays();
                  // Update salary display with database data
                updateSalaryFromDatabase();
                
                console.log('Employee data loaded:', employeeData);
            } else {
                console.warn('Employee not found in database');
                // Fall back to default behavior
                generateCalendar(currentDate.getMonth(), currentDate.getFullYear());
            }
            
        } catch (error) {
            console.error('Error loading employee data:', error);
            // Fall back to default behavior
            generateCalendar(currentDate.getMonth(), currentDate.getFullYear());
        }
    }
      // Function to generate calendar with worked days highlighted
    function generateCalendarWithWorkedDays() {
        if (!elements.calendar || !elements.currentMonth) return;
        
        elements.calendar.innerHTML = '';
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth());
        
        elements.currentMonth.textContent = 
            date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

        // Calculate worked days from database
        const workedDaysInMonth = employeeData ? employeeData.nombre_des_jours : 0;
        
        // Génération des jours
        const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
        const startDay = date.getDay();

        // Jours vides
        Array.from({ length: startDay }).forEach(() => 
            elements.calendar.appendChild(createDayElement('')));

        // Jours du mois avec statut basé sur la base de données
        Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const dateKey = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-${day}`;
            
            // Determine status based on database worked days only
            let status;
            if (day <= workedDaysInMonth) {
                status = 'present';
                attendance[dateKey] = 'present';
            } else {
                status = 'future';
                attendance[dateKey] = 'future';
            }
            
            return createDayElement(day, status, dateKey);
        }).forEach(dayEl => elements.calendar.appendChild(dayEl));

        // Save updated attendance to localStorage
        localStorage.setItem('attendance', JSON.stringify(attendance));
        updateSalaryFromDatabase();
    }      // Function to update salary display with database data
    function updateSalaryFromDatabase() {
        if (!employeeData) return;
        
        // Use database worked days directly
        const workedDays = employeeData.nombre_des_jours || 0;
        
        // Calculate absent days logic: if worked days < 22, set absent days to 0
        let absentDays = 0;
        if (workedDays >= 22) {
            // Get total calendar days for current month
            const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
            absentDays = Math.max(0, daysInMonth - workedDays);
        }
        
        // Use database salary values instead of calculating
        const netSalary = parseFloat(employeeData.net_a_payer) || 0;
        
        // Update DOM elements
        document.getElementById('workedDays').textContent = workedDays;
        document.getElementById('absentDays').textContent = absentDays;
        document.getElementById('monthSalary').textContent = 
            `${netSalary.toLocaleString('fr-FR')} DA`;
            
        // Update pay section with database data
        updatePaySection();
    }// Function to update pay section with current database data
    function updatePaySection() {
        if (!employeeData) {
            console.warn('Employee data not available for pay section update');
            return;
        }
        
        try {
            // Set specific June 2025 date
            const currentYear = 2025;
            const currentMonth = 'juin';
            const monthNum = '06';
            const daysInMonth = 30;
            
            // Update pay period title and details
            document.getElementById('pay-period-title').textContent = `Salaire Net ${currentMonth} ${currentYear}`;
            document.getElementById('pay-period').textContent = `➤ Période: 01/${monthNum} - ${daysInMonth}/${monthNum}`;
            
            // Calculate hours worked (assuming 8 hours per worked day)
            const workedDays = employeeData.nombre_des_jours || 0;
            const totalHours = workedDays * 8;
            document.getElementById('pay-hours').textContent = `➤ Heures: ${totalHours}h`;
            
            // Update amounts from database
            const salaire = parseFloat(employeeData.salaire) || 0;
            const acompte = parseFloat(employeeData.acompte) || 0;
            const netAPayer = parseFloat(employeeData.net_a_payer) || 0;
            
            // Calculate social contributions (typically around 13% of gross salary)
            const socialContributions = salaire * 0.13;
            
            document.getElementById('pay-amount').textContent = `${netAPayer.toLocaleString('fr-FR')} DA`;
            document.getElementById('gross-salary').textContent = `${salaire.toLocaleString('fr-FR')} DA`;
            document.getElementById('social-contributions').textContent = `- ${socialContributions.toLocaleString('fr-FR')} DA`;
            document.getElementById('acompte-amount').textContent = `- ${acompte.toLocaleString('fr-FR')} DA`;
            
            // Update bulletin title
            document.getElementById('bulletin-title').textContent = `Bulletin ${currentMonth} ${currentYear}`;
            
            console.log('Pay section updated with database values:', {
                salaire: salaire,
                acompte: acompte,
                netAPayer: netAPayer,
                workedDays: workedDays
            });
        } catch (error) {
            console.error('Error updating pay section:', error);
        }
    }

    // Réponses automatiques
    const autoResponses = {
        'salaire': 'Les salaires sont versés le 28 de chaque mois.',
        'absence': 'Veuillez signaler les absences 48h à l\'avance.',
        'congé': 'Utilisez le formulaire RH pour les demandes de congé.',
        'default': 'Nous traitons votre demande. Merci de patienter.'    };

    // Éléments DOM are now defined above

    // Fonctions Calendrier
    function generateCalendar(month, year) {
        if (!elements.calendar || !elements.currentMonth) return;
        
        elements.calendar.innerHTML = '';
        const date = new Date(year, month);
        
        elements.currentMonth.textContent = 
            date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

        // Génération des jours
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const startDay = date.getDay();

        // Jours vides
        Array.from({ length: startDay }).forEach(() => 
            elements.calendar.appendChild(createDayElement('')));

        // Jours du mois
        Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const dateKey = `${year}-${month + 1}-${day}`;
            const status = attendance[dateKey] || 'future';
            return createDayElement(day, status, dateKey);
        }).forEach(dayEl => elements.calendar.appendChild(dayEl));

        updateSalary();
    }    function createDayElement(day, status = 'future', dateKey) {
        const dayEl = document.createElement('div');
        dayEl.className = `day ${status}`;
        dayEl.textContent = day || '';
        
        if(dateKey) {
            dayEl.dataset.date = dateKey;
            // Calendar is now non-editable - no click handlers
        }
        return dayEl;
    }function toggleStatus(dateKey) {
        const states = ['future', 'present', 'absent'];
        attendance[dateKey] = states[(states.indexOf(attendance[dateKey] || 'future') + 1) % 3];
        localStorage.setItem('attendance', JSON.stringify(attendance));
        
        if (employeeData) {
            generateCalendarWithWorkedDays();
        } else {
            generateCalendar(currentDate.getMonth(), currentDate.getFullYear());
        }
    }function updateSalary() {
        if (employeeData) {
            // Use database-based salary calculation
            updateSalaryFromDatabase();
        } else {
            // Fallback to original calculation
            const counts = Object.values(attendance).reduce((acc, val) => {
                acc[val] = (acc[val] || 0) + 1;
                return acc;
            }, {});

            document.getElementById('workedDays').textContent = counts.present || 0;
            document.getElementById('absentDays').textContent = counts.absent || 0;
            document.getElementById('monthSalary').textContent = 
                `${((counts.present || 0) * dailySalary).toLocaleString('fr-FR')} DA`;
        }
    }

    // Fonctions Chat
    function manageChat() {
        function addMessage(text, type = 'sent') {
            const message = {
                text,
                type,
                time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                read: false
            };
            
            chatMessages.push(message);
            localStorage.setItem('chatMessages', JSON.stringify(chatMessages));
            updateChatUI();
        }

        function autoReply(message) {
            const response = Object.entries(autoResponses)
                .find(([key]) => message.toLowerCase().includes(key))?.[1] || autoResponses.default;
            
            setTimeout(() => {
                addMessage(response, 'received');
                updateNotifications();
            }, 1000);
        }        function updateChatUI() {
            if (elements.chatBody) {
                elements.chatBody.innerHTML = chatMessages.map(msg => `
                    <div class="message ${msg.type}">
                        <div class="text">${msg.text}</div>
                        <div class="time">${msg.time}</div>
                    </div>
                `).join('');
                
                elements.chatBody.scrollTop = elements.chatBody.scrollHeight;
            }
            updateNotifications();
        }function updateNotifications() {
            const unread = chatMessages.filter(m => !m.read && m.type === 'received').length;
            const notificationEl = document.querySelector('.chat-notification');
            if (notificationEl) {
                notificationEl.textContent = unread || '';
            }
        }

        function clearHistory() {
            if(confirm('Effacer toute la conversation ?')) {
                chatMessages = [];
                localStorage.removeItem('chatMessages');
                updateChatUI();
            }
        }

        return { addMessage, autoReply, clearHistory, updateChatUI, updateNotifications };
    }

    const chat = manageChat();    // Gestion des événements
    function initEvents() {
        // Navigation calendrier
        const prevBtn = document.getElementById('prevMonth');
        const nextBtn = document.getElementById('nextMonth');
          if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                currentDate.setMonth(currentDate.getMonth() - 1);
                if (employeeData) {
                    generateCalendarWithWorkedDays();
                } else {
                    generateCalendar(currentDate.getMonth(), currentDate.getFullYear());
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                currentDate.setMonth(currentDate.getMonth() + 1);
                if (employeeData) {
                    generateCalendarWithWorkedDays();
                } else {
                    generateCalendar(currentDate.getMonth(), currentDate.getFullYear());
                }
            });
        }        // Navigation principale
        if (elements.navButtons && elements.navButtons.length > 0) {
            elements.navButtons.forEach(btn => btn.addEventListener('click', function() {
                elements.navButtons.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                document.querySelectorAll('section').forEach(s => 
                    s.style.display = s.classList.contains(this.dataset.page) ? 'block' : 'none');
                
                // Update pay section when switching to pay view
                if (this.dataset.page === 'pay') {
                    updatePaySection();
                }
            }));
        }

        // Chat
        const sendBtn = document.getElementById('sendBtn');
        if (sendBtn && elements.messageInput) {
            sendBtn.addEventListener('click', () => {
                const message = elements.messageInput.value.trim();
                if(message) {
                    chat.addMessage(message);
                    chat.autoReply(message);
                    elements.messageInput.value = '';
                }
            });
        }

        if (elements.messageInput) {
            elements.messageInput.addEventListener('keypress', e => {
                if(e.key === 'Enter') {
                    const sendBtn = document.getElementById('sendBtn');
                    if (sendBtn) sendBtn.click();
                }
            });
        }

        const chatIcon = document.getElementById('chatIcon');
        if (chatIcon && elements.chatWindow) {
            chatIcon.addEventListener('click', () => {
                elements.chatWindow.style.display = 
                    elements.chatWindow.style.display === 'block' ? 'none' : 'block';
                chatMessages.forEach(m => m.read = true);
                chat.updateNotifications();
            });
        }

        const closeChat = document.getElementById('closeChat');
        if (closeChat && elements.chatWindow) {
            closeChat.addEventListener('click', () => {
                elements.chatWindow.style.display = 'none';
            });
        }

        if (elements.clearChatBtn) {
            elements.clearChatBtn.addEventListener('click', chat.clearHistory);
        }

        document.addEventListener('click', e => {
            const chatIcon = document.getElementById('chatIcon');
            if(elements.chatWindow && chatIcon && 
               !elements.chatWindow.contains(e.target) && 
               !chatIcon.contains(e.target)) {
                elements.chatWindow.style.display = 'none';
            }
        });
    }    // Ajouter cette fonctionnalité
    function generatePaySlip() {
        if (typeof jspdf === 'undefined') {
            alert('PDF library not loaded');
            return;
        }
        
        if (!employeeData) {
            alert('Données employé non disponibles');
            return;
        }
          const doc = new jspdf.jsPDF();
        const currentYear = 2025;
        const currentMonth = 'juin';
        const monthNum = '06';
        const daysInMonth = 30;
        
        // Colors and styling
        const primaryColor = [52, 152, 219]; // Blue
        const secondaryColor = [236, 240, 241]; // Light gray
        
        // Header - Company info
        doc.setFillColor(...primaryColor);
        doc.rect(0, 0, 210, 30, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.setFont(undefined, 'bold');
        doc.text("MANAGIST", 20, 20);
        
        doc.setFontSize(12);
        doc.setFont(undefined, 'normal');
        doc.text("Bulletin de Paie", 150, 20);
        
        // Reset text color
        doc.setTextColor(0, 0, 0);
        
        // Employee information section
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text("INFORMATIONS EMPLOYÉ", 20, 45);
        
        doc.setFontSize(11);
        doc.setFont(undefined, 'normal');
        doc.text(`Nom: ${employeeData.nom_et_prenom}`, 20, 55);
        doc.text(`Période: ${currentMonth} ${currentYear}`, 20, 65);
        doc.text(`Du 01/${monthNum}/${currentYear} au ${daysInMonth}/${monthNum}/${currentYear}`, 20, 75);
        
        // Salary details section
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text("DÉTAILS DE LA PAIE", 20, 95);
        
        // Table headers
        doc.setFillColor(...secondaryColor);
        doc.rect(20, 105, 170, 10, 'F');
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text("ÉLÉMENTS DE PAIE", 25, 112);
        doc.text("MONTANT (DA)", 140, 112);
        
        // Table content
        doc.setFont(undefined, 'normal');
        let yPosition = 125;
        
        // Salary
        const salaire = parseFloat(employeeData.salaire) || 0;
        doc.text("Salaire de base", 25, yPosition);
        doc.text(salaire.toLocaleString('fr-FR'), 140, yPosition);
        yPosition += 10;
        
        // Worked days bonus if applicable
        const workedDays = employeeData.nombre_des_jours || 0;
        if (employeeData.travaux_attache && parseFloat(employeeData.travaux_attache) > 0) {
            doc.text("Travaux attachés", 25, yPosition);
            doc.text(parseFloat(employeeData.travaux_attache).toLocaleString('fr-FR'), 140, yPosition);
            yPosition += 10;
        }
        
        // Gross total
        doc.setFont(undefined, 'bold');
        doc.text("TOTAL BRUT", 25, yPosition);
        doc.text(salaire.toLocaleString('fr-FR'), 140, yPosition);
        yPosition += 15;
        
        // Deductions section
        doc.setFont(undefined, 'bold');
        doc.text("RETENUES", 25, yPosition);
        yPosition += 10;
        
        doc.setFont(undefined, 'normal');
        // Social contributions
        const socialContributions = salaire * 0.13;
        doc.text("Cotisations sociales (13%)", 25, yPosition);
        doc.text(`-${socialContributions.toLocaleString('fr-FR')}`, 140, yPosition);
        yPosition += 10;
        
        // Acompte
        const acompte = parseFloat(employeeData.acompte) || 0;
        doc.text("Acompte", 25, yPosition);
        doc.text(`-${acompte.toLocaleString('fr-FR')}`, 140, yPosition);
        yPosition += 15;
        
        // Net to pay
        doc.setFillColor(...primaryColor);
        doc.rect(20, yPosition - 5, 170, 15, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        const netAPayer = parseFloat(employeeData.net_a_payer) || 0;
        doc.text("NET À PAYER", 25, yPosition + 5);
        doc.text(`${netAPayer.toLocaleString('fr-FR')} DA`, 140, yPosition + 5);
        
        // Reset text color
        doc.setTextColor(0, 0, 0);
        yPosition += 25;
        
        // Summary section
        doc.setFontSize(11);
        doc.setFont(undefined, 'normal');
        doc.text(`Jours travaillés: ${workedDays}`, 20, yPosition);
        doc.text(`Prix par jour: ${parseFloat(employeeData.prix_jour || 0).toLocaleString('fr-FR')} DA`, 20, yPosition + 10);
        
        if (employeeData.observation) {
            yPosition += 25;
            doc.setFont(undefined, 'bold');
            doc.text("Observations:", 20, yPosition);
            doc.setFont(undefined, 'normal');
            doc.text(employeeData.observation, 20, yPosition + 10);
        }
        
        // Footer
        doc.setFontSize(9);
        doc.setTextColor(128, 128, 128);
        doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, 20, 280);
        doc.text("Ce bulletin de paie est généré automatiquement par Managist", 20, 290);
        
        // Générer le fichier
        doc.save(`bulletin-paie-${employeeData.nom_et_prenom}-${currentYear}-${monthNum}.pdf`);
    }

    // Ajouter l'événement click au bouton PDF
    const downloadBtn = document.querySelector('.download-btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', generatePaySlip);
    }

    // Profile functionality
    function initProfileSystem() {
        const profilePic = document.getElementById('profile-picture');
        const profileDropdown = document.getElementById('profile-dropdown');
        const viewProfileBtn = document.getElementById('view-profile');
        const profileModal = document.getElementById('profile-modal');
        const closeProfile = document.getElementById('close-profile');
        const changeAvatarBtn = document.getElementById('change-avatar');
        const avatarUpload = document.getElementById('avatar-upload');
        const passwordResetForm = document.getElementById('password-reset-form');
        const toast = document.getElementById('message-toast');
        const closeToast = document.getElementById('close-toast');        // Load current user info
        function loadUserInfo() {
            let currentUser = {};
            try {
                const userData = localStorage.getItem('currentUser');
                if (userData) {
                    currentUser = JSON.parse(userData);
                } else {
                    // Default user if no data exists
                    currentUser = {
                        username: 'Employee Name',
                        email: 'employee@company.com',
                        role: 'Employee',
                        password: 'defaultPassword123'
                    };
                    localStorage.setItem('currentUser', JSON.stringify(currentUser));
                }
            } catch (error) {
                console.error('Error loading user info:', error);
                currentUser = {
                    username: 'Employee Name',
                    email: 'employee@company.com',
                    role: 'Employee',
                    password: 'defaultPassword123'
                };
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
            }

            const employeeName = document.getElementById('employee-name');
            const employeeEmail = document.getElementById('employee-email');
            const employeeRole = document.getElementById('employee-role');

            // Use employee data from database if available, otherwise use localStorage
            const displayName = employeeData ? employeeData.nom_et_prenom : (currentUser.username || 'Employee Name');
            const displayEmail = currentUser.email || 'employee@company.com';
            const displayRole = currentUser.role || 'Employee';

            if (employeeName) employeeName.textContent = displayName;
            if (employeeEmail) employeeEmail.textContent = displayEmail;
            if (employeeRole) employeeRole.textContent = displayRole;
        }

        // Profile picture dropdown toggle
        if (profilePic && profileDropdown) {
            profilePic.addEventListener('click', (e) => {
                e.stopPropagation();
                profileDropdown.classList.toggle('show');
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', () => {
                profileDropdown.classList.remove('show');
            });

            profileDropdown.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

        // Open profile modal
        if (viewProfileBtn && profileModal) {
            viewProfileBtn.addEventListener('click', (e) => {
                e.preventDefault();
                profileModal.style.display = 'block';
                profileDropdown.classList.remove('show');
                loadUserInfo();
            });
        }

        // Close profile modal
        if (closeProfile && profileModal) {
            closeProfile.addEventListener('click', () => {
                profileModal.style.display = 'none';
            });
        }

        // Close modal when clicking outside
        if (profileModal) {
            profileModal.addEventListener('click', (e) => {
                if (e.target === profileModal) {
                    profileModal.style.display = 'none';
                }
            });
        }

        // Avatar upload functionality
        if (changeAvatarBtn && avatarUpload) {
            changeAvatarBtn.addEventListener('click', () => {
                avatarUpload.click();
            });

            avatarUpload.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file && file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const imageData = e.target.result;
                        
                        // Update all profile pictures
                        document.getElementById('profile-picture').src = imageData;
                        document.querySelector('.large-profile-pic').src = imageData;
                        
                        // Save to localStorage
                        localStorage.setItem('employeeAvatar', imageData);
                        
                        showToast('Profile picture updated successfully!', 'success');
                    };
                    reader.readAsDataURL(file);
                } else {
                    showToast('Please select a valid image file.', 'error');
                }
            });
        }

        // Load saved avatar
        function loadSavedAvatar() {
            const savedAvatar = localStorage.getItem('employeeAvatar');
            if (savedAvatar) {
                const profilePics = document.querySelectorAll('#profile-picture, .large-profile-pic');
                profilePics.forEach(pic => {
                    if (pic) pic.src = savedAvatar;
                });
            }
        }

        // Password visibility toggle
        const togglePasswordButtons = document.querySelectorAll('.toggle-password');
        togglePasswordButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetId = button.getAttribute('data-target');
                const targetInput = document.getElementById(targetId);
                const icon = button.querySelector('i');
                
                if (targetInput.type === 'password') {
                    targetInput.type = 'text';
                    icon.textContent = 'visibility_off';
                } else {
                    targetInput.type = 'password';
                    icon.textContent = 'visibility';
                }
            });
        });

        // Password strength checker
        const newPasswordInput = document.getElementById('new-password');
        const passwordStrength = document.getElementById('password-strength');
        
        if (newPasswordInput && passwordStrength) {
            newPasswordInput.addEventListener('input', () => {
                const password = newPasswordInput.value;
                const strength = checkPasswordStrength(password);
                
                passwordStrength.textContent = strength.text;
                passwordStrength.className = `password-strength ${strength.class}`;
            });
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

        // Password reset form submission
        if (passwordResetForm) {
            passwordResetForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const currentPassword = document.getElementById('current-password').value;
                const newPassword = document.getElementById('new-password').value;
                const confirmPassword = document.getElementById('confirm-password').value;
                
                // Validation
                if (newPassword !== confirmPassword) {
                    showToast('New passwords do not match!', 'error');
                    return;
                }
                
                if (newPassword.length < 6) {
                    showToast('New password must be at least 6 characters long!', 'error');
                    return;
                }                try {
                    // Get user data from localStorage
                    const userData = localStorage.getItem('currentUser');
                    if (!userData) {
                        showToast('User data not found. Please log in again.', 'error');
                        return;
                    }
                    
                    const currentUser = JSON.parse(userData);
                    
                    // Import invoke function for Tauri API calls
                    const { invoke } = window.__TAURI__.core;
                    const { listen } = window.__TAURI__.event;
                    
                    // Set up event listener for the password update result
                    await listen("password-update-result", (event) => {
                        if (event.payload === "Password updated successfully") {
                            // Update localStorage with new password
                            currentUser.password = newPassword;
                            localStorage.setItem('currentUser', JSON.stringify(currentUser));
                            
                            showToast('Password updated successfully!', 'success');
                            passwordResetForm.reset();
                            
                            // Close modal after successful reset
                            setTimeout(() => {
                                profileModal.style.display = 'none';
                            }, 2000);
                        } else if (event.payload === "Invalid current password") {
                            showToast('Current password is incorrect!', 'error');
                        } else {
                            showToast('An error occurred while updating password.', 'error');
                        }
                    });
                    
                    // Call backend to update password in database
                    await invoke('update_user_password', {
                        username: currentUser.username,
                        currentPassword: currentPassword,
                        newPassword: newPassword
                    });
                    
                } catch (error) {
                    showToast('An error occurred while updating password.', 'error');
                    console.error('Password reset error:', error);
                }
            });
        }

        // Cancel password reset
        const cancelResetBtn = document.getElementById('cancel-reset');
        if (cancelResetBtn) {
            cancelResetBtn.addEventListener('click', () => {
                passwordResetForm.reset();
                if (passwordStrength) {
                    passwordStrength.textContent = '';
                    passwordStrength.className = 'password-strength';
                }
            });
        }

        // Toast notification system
        function showToast(message, type = 'success') {
            const toastMessage = document.getElementById('toast-message');
            if (toastMessage) toastMessage.textContent = message;
            
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

        // Initialize
        loadUserInfo();
        loadSavedAvatar();    }    // Initialisation
    // Note: Calendar generation is now handled by loadEmployeeDataFromDatabase()
    chat.updateChatUI();
    initEvents();
    initProfileSystem();
      } catch (error) {
        console.error('Error initializing employee page:', error);
        // Basic fallback functionality to prevent blank page
        try {
            // Ensure calendar is visible
            const calendar = document.getElementById('calendar');
            if (calendar) {
                calendar.innerHTML = '<div class="day">Calendar Loading...</div>';
            }
            
            // Ensure basic navigation works
            const navButtons = document.querySelectorAll('.nav-btn');
            if (navButtons.length > 0) {
                navButtons.forEach(btn => {
                    btn.addEventListener('click', function() {
                        navButtons.forEach(b => b.classList.remove('active'));
                        this.classList.add('active');
                        document.querySelectorAll('section').forEach(s => 
                            s.style.display = s.classList.contains(this.dataset.page) ? 'block' : 'none');
                    });
                });
            }
            
            // Basic calendar fallback
            const currentMonthEl = document.getElementById('currentMonth');
            if (currentMonthEl) {
                currentMonthEl.textContent = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
            }
        } catch (fallbackError) {
            console.error('Even fallback failed:', fallbackError);
        }
    }
});