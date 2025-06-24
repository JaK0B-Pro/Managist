const { invoke } = window.__TAURI__.core;
const { getCurrentWindow } = window.__TAURI__.window;

// Utility functions (embedded to avoid import issues)
async function resizeWindow(width, height) {
  const appWindow = await getCurrentWindow();
  await appWindow.setSize({ type: 'Logical', width, height });
}

function clearCurrentUser() {
    localStorage.removeItem('currentUser');
}

// Logout functionality
document.addEventListener('DOMContentLoaded', function() {
    const logoutButton = document.getElementById("logout-button");
    if (logoutButton) {
        logoutButton.addEventListener("click", () => {
            clearCurrentUser();  // Clear the user state
            resizeWindow(500, 600);
            window.location.href = "../../";
        });
    }
});

// Get project ID from URL parameters
function getProjectIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return parseInt(urlParams.get('projectId')) || 1; // Default to 1 if not specified
}

const PROJECT_ID = getProjectIdFromUrl();

// Current selected bloc (null means "all blocs")
let currentBloc = 'all';

// Project bloc count for dynamic tabs
let projectBlocCount = 0;

// Helper function to convert number to letter (1=A, 2=B, etc.)
function numberToLetter(num) {
    return String.fromCharCode(65 + num - 1); // 65 is ASCII for 'A'
}

// Helper function to get bloc color
function getBlocColor(bloc) {
    const colors = {
        'A': '#3498db', // Blue
        'B': '#2ecc71', // Green  
        'C': '#e74c3c', // Red
        'D': '#f39c12', // Orange
        'E': '#9b59b6', // Purple
        'F': '#1abc9c', // Teal
        'G': '#34495e', // Dark Gray
        'H': '#e67e22', // Dark Orange
        'I': '#16a085', // Dark Teal
        'J': '#8e44ad'  // Dark Purple
    };
    return colors[bloc] || '#7f8c8d'; // Default gray for unknown blocs
}

// Populate bloc dropdown in form (global scope)
async function populateBlocDropdown() {
    const blocSelect = document.getElementById('bloc');
    if (!blocSelect) return;
    
    // Ensure projectBlocCount is loaded if it's still 0
    if (projectBlocCount === 0) {
        try {
            projectBlocCount = await invoke('get_project_bloc_count', { projectId: PROJECT_ID });
        } catch (error) {
            console.error('Error loading project bloc count:', error);
            return;
        }
    }
    
    // Clear existing options except the first placeholder
    blocSelect.innerHTML = '<option value="">Select Bloc</option>';
    
    // Add bloc options using letters (A, B, C...)
    for (let i = 1; i <= projectBlocCount; i++) {
        const blocLetter = numberToLetter(i);
        const option = document.createElement('option');
        option.value = blocLetter;
        option.textContent = `Bloc ${blocLetter}`;
        blocSelect.appendChild(option);
    }
    
    // If we're on a specific bloc tab, pre-select it
    if (currentBloc !== 'all') {
        blocSelect.value = currentBloc;
    }
}

// Tranche management functions
function addTranche() {
    const tranchesContainer = document.getElementById('tranchesContainer');
    const trancheCount = tranchesContainer.children.length;
    
    if (trancheCount >= 10) {
        alert('Maximum 10 tranches allowed');
        return;
    }
      const trancheRow = document.createElement('div');
    trancheRow.className = 'tranche-row';    trancheRow.innerHTML = `
        <label>T${trancheCount}:</label>
        <input type="number" step="0.01" min="0" name="tranche_${trancheCount}" 
               placeholder="Enter amount for T${trancheCount}" oninput="calculateTotalPaid()">
        <input type="date" name="tranche_date_${trancheCount}" title="Payment date for T${trancheCount}">
        <select name="tranche_type_${trancheCount}" title="Payment type for T${trancheCount}">
            <option value="versement">Versement</option>
            <option value="espece">Espèce</option>
        </select>
        <button type="button" class="btn-remove-tranche" onclick="removeTranche(this)">×</button>
    `;
    
    tranchesContainer.appendChild(trancheRow);
    updateAddTrancheButtonVisibility();
}

function removeTranche(button) {
    const trancheRow = button.parentElement;
    const tranchesContainer = document.getElementById('tranchesContainer');
    
    // Don't allow removing T0
    if (tranchesContainer.children.length <= 1) {
        alert('At least T0 tranche is required');
        return;
    }
    
    trancheRow.remove();
    updateTrancheLabels();
    updateAddTrancheButtonVisibility();
    calculateTotalPaid();
}

function updateTrancheLabels() {
    const tranchesContainer = document.getElementById('tranchesContainer');
    Array.from(tranchesContainer.children).forEach((row, index) => {
        const label = row.querySelector('label');
        const amountInput = row.querySelector('input[type="number"]');
        const dateInput = row.querySelector('input[type="date"]');
        const typeSelect = row.querySelector('select');
        label.textContent = `T${index}:`;
        amountInput.name = `tranche_${index}`;
        amountInput.placeholder = `Enter amount for T${index}`;
        dateInput.name = `tranche_date_${index}`;
        dateInput.title = `Payment date for T${index}`;
        if (typeSelect) {
            typeSelect.name = `tranche_type_${index}`;
            typeSelect.title = `Payment type for T${index}`;
        }
    });
}

function updateAddTrancheButtonVisibility() {
    const tranchesContainer = document.getElementById('tranchesContainer');
    const addButton = document.getElementById('addTrancheBtn');
    addButton.style.display = tranchesContainer.children.length >= 10 ? 'none' : 'inline-block';
}

function calculateTotalPaid() {
    // Calculate total paid from tranches
    const tranchesContainer = document.getElementById('tranchesContainer');
    if (!tranchesContainer) return;
    
    let totalPaid = 0;
    
    Array.from(tranchesContainer.children).forEach(row => {
        const input = row.querySelector('input[type="number"]');
        if (input) {
            totalPaid += parseFloat(input.value) || 0;
        }
    });
    
    // Update total paid display
    const totalPaidEl = document.getElementById('totalPaidDisplay');
    if (totalPaidEl) {
        totalPaidEl.textContent = `${totalPaid.toLocaleString()} DA`;
    }
}

function formatCurrency(amount) {
    return parseFloat(amount || 0).toLocaleString() + ' DA';
}

function getPaymentStatusText(status) {
    switch (status) {
        case 'paid': return 'PAID';
        case 'partial': return 'PARTIAL';
        case 'unpaid': return 'UNPAID';
        default: return 'UNPAID';
    }
}

function getPaymentStatusClass(status) {
    switch (status) {
        case 'paid': return 'paid';
        case 'partial': return 'partial';
        case 'unpaid': return 'unpaid';
        default: return 'unpaid';
    }
}

document.addEventListener('DOMContentLoaded', function () {
    // Get DOM elements
    const modal = document.getElementById('buyerModal');
    const successModal = document.getElementById('successModal');
    const addBtn = document.getElementById('addNewBuyerButton');
    const closeBtn = document.querySelector('.close');
    const cancelBtn = document.getElementById('cancelBtn');
    const successOkBtn = document.getElementById('successOkBtn');
    const form = document.getElementById('addBuyerForm');
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const table = document.getElementById('buyersTable');
    const tbody = table.querySelector('tbody');
    const buyerCountEl = document.getElementById('buyerCount');
    const filteredCountEl = document.getElementById('filteredCount');
    const pageTitle = document.getElementById('pageTitle');
    const tableHeader = document.getElementById('tableHeader');

    // Global variable to track the current maximum tranche count and total columns
    let maxTranches = 4; // Default to 4 (T0-T4)
    let totalColumns = 16; // Base columns (11) + tranches (5) = 16

    // Function to determine maximum tranches across all buyers
    function getMaxTranches(buyers) {
        let max = 0;
        buyers.forEach(buyer => {
            let payments = {};
            try {
                payments = typeof buyer.payments === 'string' ? JSON.parse(buyer.payments) : buyer.payments || {};
            } catch (e) {
                payments = {};
            }
            
            // Find the highest tranche number (T0, T1, T2, etc.)
            Object.keys(payments).forEach(key => {
                if (key.startsWith('T')) {
                    const trancheNum = parseInt(key.substring(1));
                    if (!isNaN(trancheNum) && trancheNum > max) {
                        max = trancheNum;
                    }
                }
            });
        });
        
        // Return at least 4 tranches (T0-T4) to maintain minimum layout
        return Math.max(4, max);
    }

    // Function to generate table headers dynamically
    function generateTableHeaders(numTranches) {
        const baseHeaders = [
            'NIVEAU', 'N° LOGT', 'NOM', 'PRENOM', 'TYPE LOGT', 
            'SURFACE', 'DATE', 'PRIX TOTALE', 'REMISE'
        ];
        
        let headersHTML = '';
        
        // Add base headers
        baseHeaders.forEach(header => {
            headersHTML += `<th>${header}</th>`;
        });
        
        // Add tranche headers (T0, T1, T2, etc.)
        for (let i = 0; i <= numTranches; i++) {
            headersHTML += `<th>T${i}</th>`;
        }
        
        // Add final headers
        headersHTML += '<th>TOTAL PAID</th>';
        headersHTML += '<th>STATUS</th>';
        
        tableHeader.innerHTML = headersHTML;
        
        // Update total columns count
        totalColumns = baseHeaders.length + (numTranches + 1) + 2; // base + tranches + total paid + status
    }

    // Function to update buyer count
    function updateBuyerCount(actualCount = null) {
        if (actualCount !== null) {
            buyerCountEl.textContent = `Total Buyers: ${actualCount}`;
        } else {
            // Count only actual buyer rows (exclude empty state and loading rows)
            const buyerRows = tbody.querySelectorAll('.buyer-row');
            buyerCountEl.textContent = `Total Buyers: ${buyerRows.length}`;
        }
    }

    // Function to show loading state
    function showLoading() {
        tbody.innerHTML = `
            <tr>
                <td colspan="${totalColumns}" style="text-align: center; padding: 2rem;">
                    <div class="loading-spinner"></div>
                    <p style="margin-top: 1rem; color: #6c757d;">Loading buyers...</p>
                </td>
            </tr>
        `;
    }

    // Function to show empty state
    function showEmptyState() {
        tbody.innerHTML = `
            <tr>
                <td colspan="${totalColumns}" class="empty-state">
                    <i class="fas fa-users"></i>
                    <h3>No buyers found</h3>
                    <p>Add your first buyer to get started</p>
                </td>
            </tr>
        `;
    }

    // Load buyers from database
    async function loadBuyers() {
        try {
            showLoading();
            const buyers = await invoke('get_buyers_by_project', { projectId: PROJECT_ID });
            
            tbody.innerHTML = '';
            
            // Filter buyers by selected bloc if not "all"
            let filteredBuyers = buyers;
            if (currentBloc !== 'all') {
                filteredBuyers = buyers.filter(buyer => buyer.bloc === currentBloc);
            }
            
            if (filteredBuyers.length === 0) {
                // Generate headers with default 4 tranches for empty state
                maxTranches = 4;
                generateTableHeaders(maxTranches);
                showEmptyState();
                updateBuyerCount(0); // Pass 0 for empty state
                return;
            }

            // Determine the maximum number of tranches across filtered buyers
            maxTranches = getMaxTranches(filteredBuyers);
            
            // Generate table headers dynamically
            generateTableHeaders(maxTranches);

            // Different rendering logic for "All Blocs" vs specific bloc
            if (currentBloc === 'all') {
                // Group buyers by BLOC first, then by NIVEAU for visual separation
                const buyersByBloc = {};
                filteredBuyers.forEach(buyer => {
                    const bloc = buyer.bloc || 'A';
                    if (!buyersByBloc[bloc]) {
                        buyersByBloc[bloc] = {};
                    }
                    const niveau = buyer.niveau || 'Unknown';
                    if (!buyersByBloc[bloc][niveau]) {
                        buyersByBloc[bloc][niveau] = [];
                    }
                    buyersByBloc[bloc][niveau].push(buyer);
                });

                // Sort bloc keys (A, B, C, etc.)
                const sortedBlocs = Object.keys(buyersByBloc).sort();

                // Render buyers grouped by bloc with visual separation
                sortedBlocs.forEach((bloc, blocIndex) => {
                    const buyersByNiveau = buyersByBloc[bloc];
                    const sortedNiveaux = Object.keys(buyersByNiveau).sort();
                    const blocColor = getBlocColor(bloc);

                    // Add bloc separator row if not first bloc
                    if (blocIndex > 0) {
                        const separatorRow = document.createElement('tr');
                        separatorRow.className = 'bloc-separator';
                        separatorRow.innerHTML = `
                            <td colspan="${totalColumns}" class="bloc-separator-cell">
                                <div class="bloc-divider" style="background: linear-gradient(90deg, ${blocColor}33, ${blocColor}66, ${blocColor}33);">
                                    <span class="bloc-label" style="background-color: ${blocColor};">Bloc ${bloc}</span>
                                </div>
                            </td>
                        `;
                        tbody.appendChild(separatorRow);
                    } else {
                        // Add header for first bloc
                        const headerRow = document.createElement('tr');
                        headerRow.className = 'bloc-separator';
                        headerRow.innerHTML = `
                            <td colspan="${totalColumns}" class="bloc-separator-cell">
                                <div class="bloc-divider" style="background: linear-gradient(90deg, ${blocColor}33, ${blocColor}66, ${blocColor}33);">
                                    <span class="bloc-label" style="background-color: ${blocColor};">Bloc ${bloc}</span>
                                </div>
                            </td>
                        `;
                        tbody.appendChild(headerRow);
                    }

                    // Render buyers for this bloc
                    sortedNiveaux.forEach(niveau => {
                        const buyersInNiveau = buyersByNiveau[niveau];
                        
                        buyersInNiveau.forEach((buyer, index) => {
                            const newRow = document.createElement('tr');
                            newRow.className = 'buyer-row';
                            newRow.setAttribute('data-buyer-id', buyer.id);
                            newRow.style.borderLeft = `4px solid ${blocColor}`;
                            
                            renderBuyerRow(newRow, buyer, buyersInNiveau, index, niveau);
                            tbody.appendChild(newRow);
                        });
                    });
                });
            } else {
                // Single bloc view - group by NIVEAU only
                const buyersByNiveau = {};
                filteredBuyers.forEach(buyer => {
                    const niveau = buyer.niveau || 'Unknown';
                    if (!buyersByNiveau[niveau]) {
                        buyersByNiveau[niveau] = [];
                    }
                    buyersByNiveau[niveau].push(buyer);
                });

                // Sort NIVEAU keys for consistent ordering
                const sortedNiveaux = Object.keys(buyersByNiveau).sort();
                const blocColor = getBlocColor(currentBloc);

                // Render grouped buyers for single bloc
                sortedNiveaux.forEach(niveau => {
                    const buyersInNiveau = buyersByNiveau[niveau];
                    
                    buyersInNiveau.forEach((buyer, index) => {
                        const newRow = document.createElement('tr');
                        newRow.className = 'buyer-row';
                        newRow.setAttribute('data-buyer-id', buyer.id);
                        newRow.style.borderLeft = `4px solid ${blocColor}`;
                        
                        renderBuyerRow(newRow, buyer, buyersInNiveau, index, niveau);
                        tbody.appendChild(newRow);
                    });
                });            }
            
            updateBuyerCount(buyers.length);
        } catch (error) {
            console.error('Error loading buyers:', error);
            tbody.innerHTML = `
                <tr>
                    <td colspan="${totalColumns}" style="text-align: center; padding: 2rem; color: #e74c3c;">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p style="margin-top: 1rem;">Error loading buyers. Please try again.</p>
                    </td>
                </tr>
            `;
        }
    }

    // Helper function to render a buyer row
    function renderBuyerRow(newRow, buyer, buyersInNiveau, index, niveau) {
        // Parse payments safely
        let payments = {};
        try {
            payments = typeof buyer.payments === 'string' ? JSON.parse(buyer.payments) : buyer.payments || {};
        } catch (e) {
            console.warn('Error parsing payments for buyer', buyer.id, e);
            payments = {};
        }
        
        // Build the base columns - only show NIVEAU for the first buyer in the group
        let rowHTML = `
            <td ${index === 0 ? `rowspan="${buyersInNiveau.length}"` : 'style="display:none;"'}>${niveau}</td>
            <td>${buyer.logt_num}</td>
            <td>${buyer.nom}</td>
            <td>${buyer.prenom}</td>
            <td>${buyer.type_logt}</td>
            <td>${buyer.surface}</td>
            <td>${buyer.date}</td>
            <td>${formatCurrency(buyer.prix_totale || 0)}</td>
            <td>${formatCurrency(buyer.remise || 0)}</td>
        `;          // Add tranche columns dynamically (T0, T1, T2, etc.)
        for (let i = 0; i <= maxTranches; i++) {
            let trancheAmount = 0;
            let paymentType = 'versement';
            const trancheData = payments[`T${i}`];
            
            // Handle both old format (just amount) and new format (amount + date + type)
            if (typeof trancheData === 'object' && trancheData !== null) {
                // New format: {amount: x, date: 'yyyy-mm-dd', type: 'versement|espece'}
                trancheAmount = trancheData.amount || 0;
                paymentType = trancheData.type || 'versement';
            } else {
                // Old format: just a number
                trancheAmount = trancheData || 0;
                paymentType = 'versement';
            }
            
            const trancheValue = formatCurrency(trancheAmount);
            const typeIndicator = paymentType === 'espece' ? '💵' : '🏦';
            const typeClass = paymentType === 'espece' ? 'payment-cash' : 'payment-bank';
            
            // Show payment type indicator for all tranches (including 0 amounts)
            rowHTML += `<td class="tranche-cell ${typeClass}" title="${paymentType === 'espece' ? 'Espèce' : 'Versement'}: ${trancheValue}">
                ${trancheValue} <span class="payment-type-indicator">${typeIndicator}</span>
            </td>`;
        }
        
        // Add final columns
        const totalPaid = formatCurrency(buyer.total_paid || 0);
        const paymentStatus = getPaymentStatusText(buyer.payment_status || 'unpaid');
        const statusClass = getPaymentStatusClass(buyer.payment_status || 'unpaid');
        
        rowHTML += `
            <td class="total-paid-cell">${totalPaid}</td>
            <td class="status-cell">
                <span class="payment-status ${statusClass}">${paymentStatus}</span>
                <div class="hover-actions" style="display: none;">
                    <button class="action-btn edit-btn" onclick="editBuyer(${buyer.id})" title="Edit Buyer">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete-btn" onclick="deleteBuyer(this, ${buyer.id})" title="Delete Buyer">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        
        newRow.innerHTML = rowHTML;
    }

    // Load project name and set page title
    async function loadProjectInfo() {
        try {
            const projects = await invoke('get_projects');
            const project = projects.find(p => p.id === PROJECT_ID);
            if (project) {
                pageTitle.textContent = `${project.project_name} - Buyers`;
            }
            
            // Get bloc count from database using new function
            projectBlocCount = await invoke('get_project_bloc_count', { projectId: PROJECT_ID });
            // Initialize bloc tabs
            initializeBlocTabs();
        } catch (error) {
            console.error('Error loading project info:', error);
        }
    }

    // Initialize bloc tabs based on project bloc count
    function initializeBlocTabs() {
        const blocTabsContainer = document.getElementById('blocTabs');
        if (!blocTabsContainer) return;
        
        // Clear existing dynamic tabs (keep "Tous les Blocs")
        const allTabsBtn = blocTabsContainer.querySelector('[data-bloc="all"]');
        blocTabsContainer.innerHTML = '';
        blocTabsContainer.appendChild(allTabsBtn);
        
        // Add bloc-specific tabs using letters (A, B, C...)
        for (let i = 1; i <= projectBlocCount; i++) {
            const blocLetter = numberToLetter(i);
            const blocBtn = document.createElement('button');
            blocBtn.className = 'tab-btn';
            blocBtn.setAttribute('data-bloc', blocLetter);
            blocBtn.innerHTML = `
                <i class="fas fa-building"></i>
                Bloc ${blocLetter}
                <span class="bloc-stats" id="bloc-${blocLetter}-stats"></span>
            `;
            blocTabsContainer.appendChild(blocBtn);
        }
        
        // Add event listeners to all tabs
        addTabEventListeners();
        
        // Update tab statistics
        updateTabStatistics();
    }

    // Add event listeners to tab buttons
    function addTabEventListeners() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Remove active class from all tabs
                tabButtons.forEach(btn => btn.classList.remove('active'));
                // Add active class to clicked tab
                button.classList.add('active');
                // Update current bloc
                currentBloc = button.getAttribute('data-bloc');
                // Reload buyers with new filter
                loadBuyers();
            });
        });
    }

    // Update tab statistics (buyer count per bloc)
    async function updateTabStatistics() {
        try {
            const buyers = await invoke('get_buyers_by_project', { projectId: PROJECT_ID });
            
            // Count buyers per bloc
            const blocCounts = {};
            buyers.forEach(buyer => {
                const bloc = buyer.bloc || 'A'; // Default to bloc A if not specified
                blocCounts[bloc] = (blocCounts[bloc] || 0) + 1;
            });
            
            // Update "Tous les Blocs" count
            const allTabBtn = document.querySelector('[data-bloc="all"]');
            if (allTabBtn) {
                const existingStats = allTabBtn.querySelector('.bloc-stats');
                if (existingStats) {
                    existingStats.textContent = `(${buyers.length})`;
                } else {
                    allTabBtn.innerHTML += `<span class="bloc-stats">(${buyers.length})</span>`;
                }
            }
            
            // Update individual bloc counts using letters
            for (let i = 1; i <= projectBlocCount; i++) {
                const blocLetter = numberToLetter(i);
                const statsElement = document.getElementById(`bloc-${blocLetter}-stats`);
                if (statsElement) {
                    const count = blocCounts[blocLetter] || 0;
                    statsElement.textContent = `(${count})`;
                }
            }
        } catch (error) {
            console.error('Error updating tab statistics:', error);
        }
    }

    // Initialize page
    loadProjectInfo();
    loadBuyers();    // Open modal when Add New Buyer button is clicked
    addBtn.addEventListener('click', async function() {
        // Reset form for new buyer
        form.reset();
        form.removeAttribute('data-buyer-id');
        document.querySelector('#buyerModal h2').textContent = 'Add New Buyer';
        document.getElementById('addBuyerBtn').textContent = 'Add Buyer';
        
        // Populate bloc dropdown
        await populateBlocDropdown();
        
        // Populate apartment type dropdown from project_info
        await populateApartmentTypeDropdown();          // Reset tranches to just T0
        const tranchesContainer = document.getElementById('tranchesContainer');
        tranchesContainer.innerHTML = `
            <div class="tranche-row">
                <label>T0:</label>
                <input type="number" step="0.01" min="0" name="tranche_0" 
                       placeholder="Enter amount for T0" oninput="calculateTotalPaid()">
                <input type="date" name="tranche_date_0" title="Payment date for T0">
                <select name="tranche_type_0" title="Payment type for T0">
                    <option value="versement">Versement</option>
                    <option value="espece">Espèce</option>
                </select>
                <button type="button" class="btn-remove-tranche" onclick="removeTranche(this)" style="display: none;">×</button>
            </div>
        `;
        updateAddTrancheButtonVisibility();
        calculateTotalPaid();
        
        modal.style.display = 'block';
    });

    // Close modal when X is clicked
    closeBtn.addEventListener('click', function() {
        modal.style.display = 'none';
    });

    // Close modal when Cancel button is clicked
    cancelBtn.addEventListener('click', function() {
        modal.style.display = 'none';
    });

    // Close modal when clicking outside of it
    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
        if (event.target === successModal) {
            successModal.style.display = 'none';
        }
    });

    // Close success modal
    successOkBtn.addEventListener('click', function() {
        successModal.style.display = 'none';
    });

    // Function to show success modal
    function showSuccessModal() {
        successModal.style.display = 'block';
    }

    // Form submission
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const submitBtn = document.getElementById('addBuyerBtn');
        const originalText = submitBtn.textContent;
        const buyerId = form.getAttribute('data-buyer-id');
        const isEdit = !!buyerId;
        
        try {
            // Show loading state on submit button
            submitBtn.innerHTML = '<div class="loading-spinner"></div> ' + (isEdit ? 'Updating...' : 'Adding...');
            submitBtn.disabled = true;            // Collect tranches data
            const tranchesContainer = document.getElementById('tranchesContainer');
            const tranches = {};
            let totalPaidAmount = 0;
            
            Array.from(tranchesContainer.children).forEach((row, index) => {
                const amountInput = row.querySelector('input[type="number"]');
                const dateInput = row.querySelector('input[type="date"]');
                const typeSelect = row.querySelector('select');
                const value = parseFloat(amountInput.value) || 0;
                const date = dateInput.value || null;
                const type = typeSelect ? typeSelect.value : 'versement';
                if (value > 0) {
                    tranches[`T${index}`] = {
                        amount: value,
                        date: date,
                        type: type
                    };
                    totalPaidAmount += value;
                }
            });

            // Prepare buyer data
            const buyerData = {
                project_id: PROJECT_ID,
                bloc: document.getElementById('bloc').value.trim(),
                niveau: document.getElementById('niveau').value.trim(),
                logt_num: document.getElementById('logtNum').value.trim(),
                nom: document.getElementById('nom').value.trim(),
                prenom: document.getElementById('prenom').value.trim(),
                type_logt: document.getElementById('typeLogt').value.trim(),
                surface: document.getElementById('surface').value.trim(),
                date: document.getElementById('date').value,
                prix_totale: parseFloat(document.getElementById('prixTotale').value) || 0,
                remise: parseFloat(document.getElementById('remise').value) || 0,
                total_paid: totalPaidAmount,
                payments: tranches
            };

            // Add or update buyer in database
            if (isEdit) {
                await invoke('edit_buyer_in_database', { buyerId: parseInt(buyerId), buyer: buyerData });
            } else {
                await invoke('add_buyer_to_database', { buyer: buyerData });
            }
            
            // Reset form and close modal
            form.reset();
            form.removeAttribute('data-buyer-id');
            modal.style.display = 'none';
            
            // Show success modal
            showSuccessModal();
            
            // Reload buyers list
            await loadBuyers();
            
        } catch (error) {
            console.error('Error saving buyer:', error);
            alert('Error saving buyer: ' + error);
        } finally {
            // Reset submit button
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });

    // Search functionality
    function performSearch() {
        const filter = searchInput.value.toLowerCase().trim();
        const rows = tbody.getElementsByTagName('tr');
        let visibleCount = 0;
        
        for (let i = 0; i < rows.length; i++) {
            const rowText = rows[i].textContent.toLowerCase();
            const isVisible = rowText.includes(filter);
            rows[i].style.display = isVisible ? '' : 'none';
            if (isVisible) visibleCount++;
        }
        
        // Update filtered count display
        if (filter) {
            filteredCountEl.textContent = `Showing: ${visibleCount} results`;
            filteredCountEl.style.display = 'inline';
        } else {
            filteredCountEl.style.display = 'none';
        }
        
        // Visual feedback for search
        if (filter && visibleCount === 0) {
            searchInput.style.borderColor = '#e74c3c';
        } else {
            searchInput.style.borderColor = filter ? '#27ae60' : '#ddd';
        }
    }

    // Search on input (real-time search)
    searchInput.addEventListener('input', performSearch);
    
    // Search button click
    searchButton.addEventListener('click', function() {
        performSearch();
        searchInput.focus(); // Keep focus on search input
    });
    
    // Search on Enter key press
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            performSearch();
        }
    });
    
    // Clear search when input is cleared
    searchInput.addEventListener('input', function() {
        if (this.value === '') {
            this.style.borderColor = '#ddd';
        }
    });    // Add event listeners for price and remise changes (for display purposes)
    document.getElementById('prixTotale').addEventListener('input', calculateTotalPaid);
    document.getElementById('remise').addEventListener('input', calculateTotalPaid);
    
    // Add event listener for apartment type selection
    document.getElementById('typeLogt').addEventListener('change', handleApartmentTypeChange);
    
    // Add event listener for add tranche button
    document.getElementById('addTrancheBtn').addEventListener('click', addTranche);
});

// Fetch apartment types from project_info table
async function fetchProjectApartmentTypes(projectId) {
    try {
        console.log('Fetching apartment types for project ID:', projectId);
        const apartmentTypes = await invoke('get_project_info', { projectId });
        console.log('Fetched apartment types:', apartmentTypes);
        return apartmentTypes;
    } catch (error) {
        console.error('Error fetching apartment types:', error);
        return [];
    }
}

// Populate apartment type dropdown
async function populateApartmentTypeDropdown() {
    const typeSelect = document.getElementById('typeLogt');
    if (!typeSelect) return;
    
    console.log('Populating apartment type dropdown...');
    
    // Clear existing options except the first placeholder
    typeSelect.innerHTML = '<option value="">Select Apartment Type</option>';
    
    try {
        const apartmentTypes = await fetchProjectApartmentTypes(PROJECT_ID);
        console.log('Apartment types received:', apartmentTypes);
        
        if (apartmentTypes.length === 0) {
            console.log('No apartment types found for project');
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No apartment types configured for this project';
            option.disabled = true;
            typeSelect.appendChild(option);
            return;
        }
          // Add apartment type options
        apartmentTypes.forEach(apt => {
            console.log('Adding apartment type option:', apt);
            const option = document.createElement('option');
            option.value = apt.type_of_appartement;
            option.textContent = `${apt.type_of_appartement} - ${apt.surface}m² - ${apt.price} DA`;
            option.dataset.surface = apt.surface;
            option.dataset.price = apt.price;
            typeSelect.appendChild(option);
        });
        
        console.log('Apartment type dropdown populated successfully');
        
    } catch (error) {
        console.error('Error populating apartment type dropdown:', error);
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Error loading apartment types';
        option.disabled = true;
        typeSelect.appendChild(option);
    }
}

// Handle apartment type selection change
function handleApartmentTypeChange() {
    const typeSelect = document.getElementById('typeLogt');
    const surfaceInput = document.getElementById('surface');
    const priceInput = document.getElementById('prixTotale');
    
    if (!typeSelect || !surfaceInput || !priceInput) return;
    
    const selectedOption = typeSelect.options[typeSelect.selectedIndex];
    
    if (selectedOption && selectedOption.value) {
        // Check if this is a predefined apartment type (has dataset values)
        if (selectedOption.dataset.surface && selectedOption.dataset.price) {
            // Auto-fill surface and price from selected apartment type
            const surface = selectedOption.dataset.surface;
            const price = selectedOption.dataset.price;
            
            surfaceInput.value = surface;
            priceInput.value = price;
            
            // Make fields readonly for predefined types
            surfaceInput.readOnly = true;
            priceInput.readOnly = true;
            
            // Add visual feedback for auto-filled fields
            [surfaceInput, priceInput].forEach(input => {
                input.classList.add('updated');
                setTimeout(() => input.classList.remove('updated'), 1000);
            });
        } else {
            // Custom apartment type - allow manual editing
            surfaceInput.readOnly = false;
            priceInput.readOnly = false;
        }
    } else {
        // No apartment type selected - clear fields and make them readonly
        surfaceInput.value = '';
        priceInput.value = '';
        surfaceInput.readOnly = true;
        priceInput.readOnly = true;
    }
}

// Delete buyer function (global scope for onclick)
async function deleteBuyer(button, buyerId) {
    showDeleteConfirmationModal(button, buyerId);
}

// Function to show delete confirmation modal
function showDeleteConfirmationModal(button, buyerId) {
    const modal = document.getElementById('deleteConfirmationModal');
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    const cancelBtn = document.getElementById('cancelDeleteBtn');
    
    // Show modal
    modal.style.display = 'block';
    
    // Remove any existing event listeners
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    
    // Add event listeners
    newConfirmBtn.addEventListener('click', async () => {
        try {
            // Show loading state
            newConfirmBtn.innerHTML = '<div class="loading-spinner"></div> Deleting...';
            newConfirmBtn.disabled = true;
            newCancelBtn.disabled = true;
            
            // Delete from database
            await invoke('delete_buyer_from_database', { buyerId: buyerId });
            
            // Close modal
            modal.style.display = 'none';
            
            // Remove row from table
            const row = button.closest('tr');
            row.remove();
            
            // Update buyer count
            const buyerCountEl = document.getElementById('buyerCount');
            const totalRows = document.querySelector('#buyersTable tbody').getElementsByTagName('tr').length;
            buyerCountEl.textContent = `Total Buyers: ${totalRows}`;
            
            // Show success message
            const successMsg = document.createElement('div');
            successMsg.textContent = 'Buyer deleted successfully';
            successMsg.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #27ae60;
                color: white;
                padding: 10px 20px;
                border-radius: 6px;
                z-index: 10000;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                animation: slideIn 0.3s ease;
            `;
            document.body.appendChild(successMsg);
            
            setTimeout(() => {
                successMsg.remove();
            }, 3000);
            
        } catch (error) {
            console.error('Error deleting buyer:', error);
            
            // Close modal
            modal.style.display = 'none';
            
            // Show error message
            alert('Error deleting buyer: ' + error);
        }
    });
    
    newCancelBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}

// Add hover functionality for buyer rows
document.addEventListener('mouseover', function(e) {
    if (e.target.closest('.buyer-row')) {
        const row = e.target.closest('.buyer-row');
        const actions = row.querySelector('.hover-actions');
        if (actions) {
            actions.style.display = 'flex';
        }
    }
});

document.addEventListener('mouseout', function(e) {
    if (e.target.closest('.buyer-row')) {
        const row = e.target.closest('.buyer-row');
        const actions = row.querySelector('.hover-actions');
        if (actions && !row.matches(':hover')) {
            actions.style.display = 'none';
        }
    }
});

// Edit buyer function (global scope for onclick)
async function editBuyer(buyerId) {
    try {
        // Get current buyer data
        const buyers = await invoke('get_buyers_by_project', { projectId: PROJECT_ID });
        const buyer = buyers.find(b => b.id === buyerId);
        
        if (!buyer) {
            alert('Buyer not found');
            return;
        }
          // Populate form with current data
        await populateBlocDropdown();
        await populateApartmentTypeDropdown();
        
        document.getElementById('bloc').value = buyer.bloc || 'A';
        document.getElementById('niveau').value = buyer.niveau || '';
        document.getElementById('logtNum').value = buyer.logt_num || '';
        document.getElementById('nom').value = buyer.nom || '';
        document.getElementById('prenom').value = buyer.prenom || '';
        
        // For editing, we need to handle apartment type differently
        // First select the apartment type, then manually set surface and price if needed
        const typeSelect = document.getElementById('typeLogt');
        if (buyer.type_logt) {            // Try to find matching apartment type in dropdown
            let matchFound = false;
            for (let option of typeSelect.options) {
                if (option.value === buyer.type_logt) {
                    typeSelect.value = buyer.type_logt;
                    matchFound = true;
                    break;
                }
            }
            
            // If exact match not found, allow custom value for existing data
            if (!matchFound) {
                const customOption = document.createElement('option');
                customOption.value = buyer.type_logt;
                customOption.textContent = `${buyer.type_logt} (Custom)`;
                typeSelect.appendChild(customOption);
                typeSelect.value = buyer.type_logt;
            }
        }
        
        // Set surface and price (will be readonly for new apartment types, editable for custom ones)
        document.getElementById('surface').value = buyer.surface || '';
        document.getElementById('prixTotale').value = buyer.prix_totale || '';
        document.getElementById('date').value = buyer.date || '';
        document.getElementById('remise').value = buyer.remise || '';
        
        // Parse and populate payments
        let payments = {};
        try {
            payments = typeof buyer.payments === 'string' ? JSON.parse(buyer.payments) : buyer.payments || {};
        } catch (e) {
            console.warn('Error parsing payments for buyer', buyer.id, e);
            payments = {};
        }
        
        // Clear existing tranches and populate with buyer's data
        const tranchesContainer = document.getElementById('tranchesContainer');
        tranchesContainer.innerHTML = '';
        
        // Create tranches based on existing data, ensuring at least T0 exists
        const trancheKeys = Object.keys(payments).sort((a, b) => {
            const numA = parseInt(a.substring(1));
            const numB = parseInt(b.substring(1));
            return numA - numB;
        });
        
        // If no tranches exist, create T0
        if (trancheKeys.length === 0) {
            trancheKeys.push('T0');
            payments['T0'] = 0;
        }          trancheKeys.forEach((key, index) => {
            const trancheRow = document.createElement('div');
            trancheRow.className = 'tranche-row';
            
            // Handle both old format (just amount) and new format (amount + date + type)
            let amount = 0;
            let date = '';
            let type = 'versement';
            
            if (typeof payments[key] === 'object' && payments[key] !== null) {
                // New format: {amount: x, date: 'yyyy-mm-dd', type: 'versement|espece'}
                amount = payments[key].amount || 0;
                date = payments[key].date || '';
                type = payments[key].type || 'versement';
            } else {
                // Old format: just a number
                amount = payments[key] || 0;
                date = '';
                type = 'versement';
            }
              trancheRow.innerHTML = `
                <label>T${index}:</label>
                <input type="number" step="0.01" min="0" name="tranche_${index}" 
                       value="${amount}" placeholder="Enter amount for T${index}" 
                       oninput="calculateTotalPaid()">
                <input type="date" name="tranche_date_${index}" value="${date}" title="Payment date for T${index}">
                <select name="tranche_type_${index}" title="Payment type for T${index}">
                    <option value="versement" ${type === 'versement' ? 'selected' : ''}>Versement</option>
                    <option value="espece" ${type === 'espece' ? 'selected' : ''}>Espèce</option>
                </select>
                <button type="button" class="btn-remove-tranche" onclick="removeTranche(this)">×</button>
            `;
            tranchesContainer.appendChild(trancheRow);
        });
          updateAddTrancheButtonVisibility();
        calculateTotalPaid();
        
        // Update modal title and button
        document.querySelector('#buyerModal h2').textContent = 'Edit Buyer';
        document.getElementById('addBuyerBtn').textContent = 'Update Buyer';
        
        // Store buyer ID for update
        document.getElementById('addBuyerForm').setAttribute('data-buyer-id', buyerId);
        
        // Show modal
        document.getElementById('buyerModal').style.display = 'block';
        
    } catch (error) {
        console.error('Error loading buyer for edit:', error);
        alert('Error loading buyer data: ' + error);
    }
}

// Make editBuyer function globally accessible
window.editBuyer = editBuyer;

// Edit tranches function (for payment updates only)
async function editTranches(buyerId) {
    try {
        // Get current buyer data
        const buyers = await invoke('get_buyers_by_project', { projectId: PROJECT_ID });
        const buyer = buyers.find(b => b.id === buyerId);
        
        if (!buyer) {
            alert('Buyer not found');
            return;
        }
        
        // Parse payments
        let payments = {};
        try {
            payments = typeof buyer.payments === 'string' ? JSON.parse(buyer.payments) : buyer.payments || {};
        } catch (e) {
            console.warn('Error parsing payments for buyer', buyer.id, e);
            payments = {};
        }
        
        // Create a simple payment update modal
        const paymentModal = document.createElement('div');
        paymentModal.className = 'modal';
        paymentModal.style.display = 'block';
        
        // Get all possible tranches (from T0 to current max, plus allow adding new ones)
        const currentMaxTranche = getMaxTranches([buyer]);
        const allTranches = [];
        
        // Add existing tranches
        for (let i = 0; i <= currentMaxTranche; i++) {
            allTranches.push(`T${i}`);
        }
        
        // Add a few extra empty tranches for potential expansion
        for (let i = currentMaxTranche + 1; i <= Math.min(currentMaxTranche + 2, 9); i++) {
            allTranches.push(`T${i}`);
        }
          let tranchesHTML = '';
        allTranches.forEach(key => {
            let value = 0;
            const trancheData = payments[key];
            
            // Handle both old format (just amount) and new format (amount + date)
            if (typeof trancheData === 'object' && trancheData !== null) {
                // New format: {amount: x, date: 'yyyy-mm-dd'}
                value = trancheData.amount || 0;
            } else {
                // Old format: just a number
                value = trancheData || 0;
            }
            
            tranchesHTML += `
                <div class="tranche-row">
                    <label>${key}:</label>
                    <input type="number" step="0.01" min="0" 
                           id="edit_${key}" value="${value}" 
                           placeholder="Enter amount for ${key}">
                </div>
            `;
        });
        
        paymentModal.innerHTML = `
            <div class="modal-content">
                <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
                <h2>Update Payments - ${buyer.nom} ${buyer.prenom}</h2>
                <form id="updatePaymentForm">
                    <div class="tranches-section">
                        ${tranchesHTML}
                    </div>
                    <div class="modal-actions">
                        <button type="button" onclick="this.closest('.modal').remove()">Cancel</button>
                        <button type="submit">Update Payments</button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(paymentModal);
        
        // Handle payment form submission
        document.getElementById('updatePaymentForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            try {
                const updatedPayments = {};
                allTranches.forEach(key => {
                    const input = document.getElementById(`edit_${key}`);
                    const value = parseFloat(input.value) || 0;
                    if (value > 0) {
                        updatedPayments[key] = value;
                    }
                });
                
                await invoke('update_buyer_payments', { 
                    buyerId: buyerId, 
                    payments: updatedPayments 
                });
                
                paymentModal.remove();
                
                // Refresh the table - this will automatically update columns if new tranches were added
                await loadBuyers();
                
            } catch (error) {
                console.error('Error updating tranches:', error);
                alert('Error updating payments: ' + error);
            }
        });
        
    } catch (error) {
        console.error('Error loading buyer for payment edit:', error);
        alert('Error loading buyer data: ' + error);
    }
}

// Make functions globally accessible for onclick handlers
window.editTranches = editTranches;
window.deleteBuyer = deleteBuyer;
window.removeTranche = removeTranche;

// Add event listener for apartment type change
document.getElementById('typeLogt').addEventListener('change', handleApartmentTypeChange);

