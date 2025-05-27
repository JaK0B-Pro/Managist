document.addEventListener('DOMContentLoaded', function() {
    // Configuration de base
    let currentDate = new Date();
    const dailySalary = 1500;
    let attendance = JSON.parse(localStorage.getItem('attendance')) || {};
    let chatMessages = JSON.parse(localStorage.getItem('chatMessages')) || [];
    
    // Réponses automatiques
    const autoResponses = {
        'salaire': 'Les salaires sont versés le 28 de chaque mois.',
        'absence': 'Veuillez signaler les absences 48h à l\'avance.',
        'congé': 'Utilisez le formulaire RH pour les demandes de congé.',
        'default': 'Nous traitons votre demande. Merci de patienter.'
    };

    // Éléments DOM
    const elements = {
        calendar: document.getElementById('calendar'),
        currentMonth: document.getElementById('currentMonth'),
        navButtons: document.querySelectorAll('.nav-btn'),
        chatWindow: document.getElementById('chatWindow'),
        chatBody: document.getElementById('chatBody'),
        messageInput: document.getElementById('messageInput'),
        clearChatBtn: document.getElementById('clearChat')
    };

    // Fonctions Calendrier
    function generateCalendar(month, year) {
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
    }

    function createDayElement(day, status = 'future', dateKey) {
        const dayEl = document.createElement('div');
        dayEl.className = `day ${status}`;
        dayEl.textContent = day || '';
        
        if(dateKey) {
            dayEl.dataset.date = dateKey;
            dayEl.addEventListener('click', () => toggleStatus(dateKey));
        }
        return dayEl;
    }

    function toggleStatus(dateKey) {
        const states = ['future', 'present', 'absent'];
        attendance[dateKey] = states[(states.indexOf(attendance[dateKey] || 'future') + 1) % 3];
        localStorage.setItem('attendance', JSON.stringify(attendance));
        generateCalendar(currentDate.getMonth(), currentDate.getFullYear());
    }

    function updateSalary() {
        const counts = Object.values(attendance).reduce((acc, val) => {
            acc[val] = (acc[val] || 0) + 1;
            return acc;
        }, {});

        document.getElementById('workedDays').textContent = counts.present || 0;
        document.getElementById('absentDays').textContent = counts.absent || 0;
        document.getElementById('monthSalary').textContent = 
            `${((counts.present || 0) * dailySalary).toLocaleString('fr-FR')} DA`;
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
        }

        function updateChatUI() {
            elements.chatBody.innerHTML = chatMessages.map(msg => `
                <div class="message ${msg.type}">
                    <div class="text">${msg.text}</div>
                    <div class="time">${msg.time}</div>
                </div>
            `).join('');
            
            elements.chatBody.scrollTop = elements.chatBody.scrollHeight;
            updateNotifications();
        }

        function updateNotifications() {
            const unread = chatMessages.filter(m => !m.read && m.type === 'received').length;
            document.querySelector('.chat-notification').textContent = unread || '';
        }

        function clearHistory() {
            if(confirm('Effacer toute la conversation ?')) {
                chatMessages = [];
                localStorage.removeItem('chatMessages');
                updateChatUI();
            }
        }

        return { addMessage, autoReply, clearHistory, updateChatUI };
    }

    const chat = manageChat();

    // Gestion des événements
    function initEvents() {
        // Navigation calendrier
        document.getElementById('prevMonth').addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() - 1);
            generateCalendar(currentDate.getMonth(), currentDate.getFullYear());
        });

        document.getElementById('nextMonth').addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() + 1);
            generateCalendar(currentDate.getMonth(), currentDate.getFullYear());
        });

        // Navigation principale
        elements.navButtons.forEach(btn => btn.addEventListener('click', function() {
            elements.navButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            document.querySelectorAll('section').forEach(s => 
                s.style.display = s.classList.contains(this.dataset.page) ? 'block' : 'none');
        }));

        // Chat
        document.getElementById('sendBtn').addEventListener('click', () => {
            const message = elements.messageInput.value.trim();
            if(message) {
                chat.addMessage(message);
                chat.autoReply(message);
                elements.messageInput.value = '';
            }
        });

        elements.messageInput.addEventListener('keypress', e => {
            if(e.key === 'Enter') document.getElementById('sendBtn').click();
        });

        document.getElementById('chatIcon').addEventListener('click', () => {
            elements.chatWindow.style.display = 
                elements.chatWindow.style.display === 'block' ? 'none' : 'block';
            chatMessages.forEach(m => m.read = true);
            chat.updateNotifications();
        });

        document.getElementById('closeChat').addEventListener('click', () => {
            elements.chatWindow.style.display = 'none';
        });

        elements.clearChatBtn.addEventListener('click', chat.clearHistory);

        document.addEventListener('click', e => {
            if(!elements.chatWindow.contains(e.target) && 
               !document.getElementById('chatIcon').contains(e.target)) {
                elements.chatWindow.style.display = 'none';
            }
        });
    }
    // Ajouter cette fonctionnalité
function generatePaySlip() {
    const doc = new jspdf.jsPDF();
    
    // Configurer le document
    doc.setFontSize(18);
    doc.text("BULLETIN DE PAIE", 20, 20);
    
    // Ajouter les détails
    doc.setFontSize(12);
    doc.text(`Mois: ${document.getElementById('currentMonth').textContent}`, 20, 30);
    doc.text(`Jours travaillés: ${document.getElementById('workedDays').textContent}`, 20, 40);
    doc.text(`Salaire brut: ${document.getElementById('monthSalary').textContent}`, 20, 50);
    
    // Générer le fichier
    doc.save(`bulletin-paie-${new Date().toISOString().slice(0,7)}.pdf`);
}

// Ajouter l'événement click au bouton PDF
document.querySelector('.download-btn').addEventListener('click', generatePaySlip);

    // Initialisation
    generateCalendar(currentDate.getMonth(), currentDate.getFullYear());
    chat.updateChatUI();
    initEvents();
});