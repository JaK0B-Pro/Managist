// Role-based access control (inline to avoid import issues)
function getCurrentUserRole() {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
        try {
            const userObject = JSON.parse(storedUser);
            return userObject.role || userObject.admin || '0';
        } catch (error) {
            return '0';
        }
    }
    return '0';
}

function setupRoleBasedNavigation() {
    const role = getCurrentUserRole();
    
    // Hide salary link ONLY for Manager (role 2)
    // Admin (role 1) should have access to everything
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

// Initialize Analytics Page
document.addEventListener('DOMContentLoaded', async () => {
    setupRoleBasedNavigation(); // Setup role-based navigation first
    
    console.log('Analytics page loading...');
    console.log('Checking Tauri availability...');
    
    // Check if Tauri is available
    if (!window.__TAURI__ || !window.__TAURI__.core) {
        console.error('Tauri is not available!');
        displayFallbackData();
        return;
    }
    
    console.log('Tauri is available, loading data...');
    await loadAnalyticsData();
});

// Load and display analytics data
async function loadAnalyticsData() {
    try {
        console.log('Loading projects and employees...');
        
        // Get the invoke function from Tauri
        const invoke = window.__TAURI__.core.invoke;
        
        if (!invoke) {
            console.error('Tauri invoke function not available');
            displayFallbackData();
            return;
        }
        
        // Load projects and employees data
        const projects = await invoke('get_projects');
        const employees = await invoke('get_all_employees');
        
        console.log('Data loaded:', { projects: projects.length, employees: employees.length });
        
        // Update cards with real data
        displayCards(projects, employees);
        
        // Display charts
        displayCharts(projects, employees);
        
        // Display tables
        displayTables(projects, employees);
        
        // Load and display today's payments
        await loadTodaysPayments();
        
        // Setup refresh button and date display
        setupTodaysPaymentsUI();
        
        console.log('Analytics page fully loaded!');
        
    } catch (error) {
        console.error('Error loading analytics data:', error);
        // Show fallback data if API fails
        displayFallbackData();
    }
}

// Display Analytics Cards
function displayCards(projects, employees) {
    console.log('Updating cards...');
    
    // Calculate performance score (average progress)
    let avgProgress = 0;
    if (projects && projects.length > 0) {
        const totalProgress = projects.reduce((sum, project) => {
            const progress = (project.nda_vendus / project.nombre_des_appartement) * 100;
            return sum + (isNaN(progress) ? 0 : progress);
        }, 0);
        avgProgress = (totalProgress / projects.length).toFixed(1);
    }
    
    const performanceEl = document.getElementById('performance-score');
    if (performanceEl) {
        performanceEl.textContent = avgProgress + '%';
        console.log('Performance score updated:', avgProgress + '%');
    }

    // Calculate completion rate
    let completionRate = 0;
    if (projects && projects.length > 0) {
        const completedProjects = projects.filter(project => {
            const progress = (project.nda_vendus / project.nombre_des_appartement) * 100;
            return progress >= 100;
        }).length;
        completionRate = ((completedProjects / projects.length) * 100).toFixed(1);
    }
    
    const completionEl = document.getElementById('completion-rate');
    if (completionEl) {
        completionEl.textContent = completionRate + '%';
        console.log('Completion rate updated:', completionRate + '%');
    }

    // Active employees
    const employeesEl = document.getElementById('active-employees');
    if (employeesEl) {
        const employeeCount = employees ? employees.length : 0;
        employeesEl.textContent = employeeCount;
        console.log('Active employees updated:', employeeCount);
    }

    // Calculate monthly revenue
    let totalRevenue = 0;
    if (projects && projects.length > 0) {
        totalRevenue = projects.reduce((sum, project) => {
            const estimatedValue = project.nda_vendus * 50000; // 50,000 DZD per apartment
            return sum + estimatedValue;
        }, 0);
    }
    
    const revenueEl = document.getElementById('monthly-revenue');
    if (revenueEl) {
        revenueEl.textContent = formatCurrency(totalRevenue);
        console.log('Monthly revenue updated:', formatCurrency(totalRevenue));
    }
}

// Fallback data display if API fails
function displayFallbackData() {
    console.log('Displaying fallback data...');
    
    const performanceEl = document.getElementById('performance-score');
    if (performanceEl) performanceEl.textContent = '75.2%';
    
    const completionEl = document.getElementById('completion-rate');
    if (completionEl) completionEl.textContent = '68.5%';
    
    const employeesEl = document.getElementById('active-employees');
    if (employeesEl) employeesEl.textContent = '12';
    
    const revenueEl = document.getElementById('monthly-revenue');
    if (revenueEl) revenueEl.textContent = '1,250,000 DZD';
}

// Display Charts with Real Data
function displayCharts(projects, employees) {
    if (!projects || !employees) return;
    
    // Project Progress Chart
    const projectProgressCtx = document.getElementById('progressChart');
    if (projectProgressCtx && projects.length > 0) {
        try {            new Chart(projectProgressCtx, {
                type: 'bar',
                data: {
                    labels: projects.slice(0, 5).map(p => p.project_name || 'Unknown'),
                    datasets: [{
                        label: 'Progress %',
                        data: projects.slice(0, 5).map(p => {
                            const progress = (p.nda_vendus / p.nombre_des_appartement) * 100;
                            return isNaN(progress) ? 0 : progress;
                        }),
                        backgroundColor: [
                            '#FF6B6B', // Red
                            '#4ECDC4', // Teal
                            '#45B7D1', // Blue
                            '#96CEB4', // Green
                            '#FFEAA7'  // Yellow
                        ],
                        borderColor: [
                            '#FF5252',
                            '#26A69A',
                            '#2196F3',
                            '#4CAF50',
                            '#FFC107'
                        ],
                        borderWidth: 2,
                        borderRadius: 8,
                        borderSkipped: false,
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            display: true,
                            labels: {
                                color: '#333',
                                font: {
                                    size: 12,
                                    weight: 'bold'
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            grid: {
                                color: '#E0E0E0'
                            },
                            ticks: {
                                color: '#666'
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            },
                            ticks: {
                                color: '#666'
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error creating progress chart:', error);
        }
    }

    // Employee Salary Distribution Chart
    const salaryDistributionCtx = document.getElementById('employeeChart');
    if (salaryDistributionCtx && employees.length > 0) {
        try {
            const salaryRanges = {
                'Low (< 50k)': employees.filter(e => e.salaire < 50000).length,
                'Medium (50k-100k)': employees.filter(e => e.salaire >= 50000 && e.salaire < 100000).length,
                'High (100k-150k)': employees.filter(e => e.salaire >= 100000 && e.salaire < 150000).length,
                'Very High (> 150k)': employees.filter(e => e.salaire >= 150000).length
            };

            new Chart(salaryDistributionCtx, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(salaryRanges),
                    datasets: [{
                        data: Object.values(salaryRanges),
                        backgroundColor: ['#3498db', '#e74c3c', '#f39c12', '#27ae60'],
                        borderWidth: 2,
                        borderColor: '#fff'
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error creating salary chart:', error);
        }
    }
}

// Display Tables
function displayTables(projects, employees) {
    const topProjectsBody = document.getElementById('top-projects');
    if (topProjectsBody && projects && projects.length > 0) {
        try {
            const sortedProjects = projects
                .map(project => ({
                    ...project,
                    progress: (project.nda_vendus / project.nombre_des_appartement) * 100 || 0
                }))
                .sort((a, b) => b.progress - a.progress)
                .slice(0, 5);
            
            // For each project, we need to get buyers and calculate totals
            loadProjectFinancials(sortedProjects, topProjectsBody);
            
        } catch (error) {
            console.error('Error displaying tables:', error);
        }
    }
}

// Load financial data for each project
async function loadProjectFinancials(projects, tableBody) {
    const invoke = window.__TAURI__.core.invoke;
    
    try {
        tableBody.innerHTML = ''; // Clear existing content
          for (const project of projects) {
            // Get buyers for this project - using correct parameter name
            const buyers = await invoke('get_buyers_by_project', { projectId: project.id });
            
            // Calculate total price (sum of all apartment prices)
            const totalPrice = buyers.reduce((sum, buyer) => sum + parseFloat(buyer.prix_totale || 0), 0);
            
            // Calculate total paid (sum of all payments made)
            const totalPaid = buyers.reduce((sum, buyer) => sum + parseFloat(buyer.total_paid || 0), 0);
            
            // Create table row
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${project.project_name || 'Unknown'}</td>
                <td>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${Math.min(project.progress, 100)}%"></div>
                        <span class="progress-text">${project.progress.toFixed(1)}%</span>
                    </div>
                </td>
                <td>${project.nda_vendus}/${project.nombre_des_appartement}</td>
                <td>${formatCurrency(totalPrice)}</td>
                <td>${formatCurrency(totalPaid)}</td>
                <td>
                    <span class="status ${getStatusClass(project.progress)}">
                        ${getStatusText(project.progress)}
                    </span>
                </td>
            `;
            tableBody.appendChild(row);
        }
    } catch (error) {
        console.error('Error loading project financials:', error);
        // Fallback to basic display if buyers data fails
        displayBasicProjectTable(projects, tableBody);
    }
}

// Fallback function if buyers data is not available
function displayBasicProjectTable(projects, tableBody) {
    tableBody.innerHTML = projects.map(project => `
        <tr>
            <td>${project.project_name || 'Unknown'}</td>
            <td>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${Math.min(project.progress, 100)}%"></div>
                    <span class="progress-text">${project.progress.toFixed(1)}%</span>
                </div>
            </td>
            <td>${project.nda_vendus}/${project.nombre_des_appartement}</td>
            <td>No data</td>
            <td>No data</td>
            <td>
                <span class="status ${getStatusClass(project.progress)}">
                    ${getStatusText(project.progress)}
                </span>
            </td>
        </tr>
    `).join('');
}

// Helper Functions
function formatCurrency(amount) {
    try {
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'DZD',
            minimumFractionDigits: 0
        }).format(amount || 0);
    } catch (error) {
        return (amount || 0).toLocaleString() + ' DZD';
    }
}

function getStatusClass(progress) {
    if (progress >= 100) return 'completed';
    if (progress >= 75) return 'in-progress';
    if (progress >= 25) return 'started';
    return 'not-started';
}

function getStatusText(progress) {
    if (progress >= 100) return 'Completed';
    if (progress >= 75) return 'Near Completion'; 
    if (progress >= 25) return 'In Progress';
    return 'Started';
}

// Logout functionality
document.getElementById('logout-button')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to logout?')) {
        window.location.href = '../../index.html';
    }
});

// Role-based navigation setup
setupRoleBasedNavigation();

// Load and display today's payments (wrapper for today)
async function loadTodaysPayments() {
    const today = new Date().toISOString().split('T')[0];
    await loadPaymentsForDate(today);
}

// Load and display payments for a specific date
async function loadPaymentsForDate(targetDate) {
    try {
        console.log('Loading payments for date:', targetDate);
        
        // Show loading state
        const paymentsList = document.getElementById('todays-payment-list');
        if (paymentsList) {
            paymentsList.innerHTML = `
                <div class="no-payments">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Loading payments for ${targetDate}...</p>
                </div>
            `;
        }
        
        const invoke = window.__TAURI__.core.invoke;
        if (!invoke) {
            console.error('Tauri invoke function not available');
            displayTodaysPayments([], 0, 0, 0, 0, targetDate);
            return;
        }

        // Get all projects to iterate through their buyers
        const projects = await invoke('get_projects');
        console.log('Found projects:', projects.length);
        
        let todaysPayments = [];
        let totalVersements = 0;
        let totalEspeces = 0;
        let versementCount = 0;
        let especeCount = 0;

        // Iterate through all projects to get buyers and their payments
        for (const project of projects) {
            try {
                const buyers = await invoke('get_buyers_by_project', { projectId: project.id });
                console.log(`Project ${project.project_name}: ${buyers.length} buyers`);
                
                for (const buyer of buyers) {
                    // Check if buyer has payment data
                    if (buyer.payments) {
                        console.log(`Buyer ${buyer.nom} ${buyer.prenom} has payments:`, typeof buyer.payments);
                    }
                    
                    if (buyer.payments && typeof buyer.payments === 'string') {
                        try {
                            const payments = JSON.parse(buyer.payments);
                            console.log(`Buyer ${buyer.nom} parsed payments:`, payments);
                            
                            // Check each payment tranche for today's date
                            for (const [trancheKey, tranche] of Object.entries(payments)) {
                                console.log(`Checking tranche ${trancheKey}:`, tranche, 'vs target date:', targetDate);
                                
                                // Skip if tranche is just a number (legacy format)
                                if (typeof tranche !== 'object' || tranche === null) {
                                    console.log(`Skipping ${trancheKey} - not an object`);
                                    continue;
                                }
                                
                                // Check if payment date matches target date and amount > 0
                                if (tranche.date === targetDate && tranche.amount && parseFloat(tranche.amount) > 0) {
                                    console.log(`Found today's payment:`, tranche);
                                    todaysPayments.push({
                                        buyerName: `${buyer.nom} ${buyer.prenom}`,
                                        projectName: project.project_name,
                                        type: tranche.type || 'versement',
                                        amount: parseFloat(tranche.amount),
                                        tranche: trancheKey
                                    });
                                    
                                    // Add to totals based on type
                                    if (tranche.type === 'espece') {
                                        totalEspeces += parseFloat(tranche.amount);
                                        especeCount++;
                                    } else {
                                        totalVersements += parseFloat(tranche.amount);
                                        versementCount++;
                                    }
                                }
                            }
                        } catch (parseError) {
                            console.log('Error parsing payments for buyer:', buyer.id, parseError);
                        }
                    } else if (buyer.payments && typeof buyer.payments === 'object') {
                        // Handle case where payments is already an object
                        const payments = buyer.payments;
                        
                        for (const [trancheKey, tranche] of Object.entries(payments)) {
                            // Skip if tranche is just a number (legacy format)
                            if (typeof tranche !== 'object' || tranche === null) continue;
                            
                            // Check if payment date matches target date and amount > 0
                            if (tranche.date === targetDate && tranche.amount && parseFloat(tranche.amount) > 0) {
                                todaysPayments.push({
                                    buyerName: `${buyer.nom} ${buyer.prenom}`,
                                    projectName: project.project_name,
                                    type: tranche.type || 'versement',
                                    amount: parseFloat(tranche.amount),
                                    tranche: trancheKey
                                });
                                
                                // Add to totals based on type
                                if (tranche.type === 'espece') {
                                    totalEspeces += parseFloat(tranche.amount);
                                    especeCount++;
                                } else {
                                    totalVersements += parseFloat(tranche.amount);
                                    versementCount++;
                                }
                            }
                        }
                    }
                }
            } catch (buyerError) {
                console.log('Error loading buyers for project:', project.id, buyerError);
            }
        }

        // Display the results
        displayTodaysPayments(todaysPayments, totalVersements, totalEspeces, versementCount, especeCount, targetDate);
        
        console.log('Payments loaded for', targetDate, ':', {
            total: todaysPayments.length,
            versements: versementCount,
            especes: especeCount
        });
        
    } catch (error) {
        console.error('Error loading today\'s payments:', error);
        displayTodaysPayments([], 0, 0, 0, 0, targetDate);
    }
}

// Display today's payments in the UI
function displayTodaysPayments(payments, totalVersements, totalEspeces, versementCount, especeCount, selectedDate) {
    // Update summary cards
    const versementsEl = document.getElementById('today-versements');
    const especesEl = document.getElementById('today-especes');
    const totalEl = document.getElementById('today-total');
    const versementCountEl = document.getElementById('versement-count');
    const especeCountEl = document.getElementById('espece-count');
    const totalCountEl = document.getElementById('total-count');
    
    if (versementsEl) versementsEl.textContent = formatCurrency(totalVersements);
    if (especesEl) especesEl.textContent = formatCurrency(totalEspeces);
    if (totalEl) totalEl.textContent = formatCurrency(totalVersements + totalEspeces);
    if (versementCountEl) versementCountEl.textContent = `${versementCount} payment${versementCount !== 1 ? 's' : ''}`;
    if (especeCountEl) especeCountEl.textContent = `${especeCount} payment${especeCount !== 1 ? 's' : ''}`;
    if (totalCountEl) totalCountEl.textContent = `${payments.length} payment${payments.length !== 1 ? 's' : ''}`;

    // Display payment list
    const paymentsList = document.getElementById('todays-payment-list');
    if (paymentsList) {
        if (payments.length === 0) {
            paymentsList.innerHTML = `
                <div class="no-payments">
                    <i class="fas fa-calendar-times"></i>
                    <p>No payments recorded for today</p>
                </div>
            `;
        } else {
            // Sort payments by amount (highest first)
            const sortedPayments = payments.sort((a, b) => b.amount - a.amount);
            
            paymentsList.innerHTML = sortedPayments.map(payment => `
                <div class="payment-item">
                    <div class="payment-info">
                        <div class="payment-buyer">${payment.buyerName}</div>
                        <div class="payment-details-text">
                            ${payment.projectName} • Tranche ${payment.tranche}
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span class="payment-type ${payment.type}">${payment.type}</span>
                        <div class="payment-amount">${formatCurrency(payment.amount)}</div>
                    </div>
                </div>
            `).join('');
        }
    }
}

// Setup today's payments UI elements
function setupTodaysPaymentsUI() {
    // Display current date
    const currentDateEl = document.getElementById('current-date');
    if (currentDateEl) {
        const today = new Date();
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        currentDateEl.textContent = today.toLocaleDateString('fr-FR', options);
    }

    // Setup date picker with today's date
    const datePicker = document.getElementById('payment-date-picker');
    if (datePicker) {
        const today = new Date().toISOString().split('T')[0];
        datePicker.value = today;
        
        // Add event listener for date changes
        datePicker.addEventListener('change', async () => {
            await loadPaymentsForDate(datePicker.value);
        });
    }

    // Setup refresh button
    const refreshBtn = document.getElementById('refresh-payments-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            refreshBtn.classList.add('loading');
            refreshBtn.disabled = true;
            
            try {
                const selectedDate = document.getElementById('payment-date-picker')?.value || new Date().toISOString().split('T')[0];
                await loadPaymentsForDate(selectedDate);
            } catch (error) {
                console.error('Error refreshing payments:', error);
            } finally {
                refreshBtn.classList.remove('loading');
                refreshBtn.disabled = false;
            }
        });
    }
}