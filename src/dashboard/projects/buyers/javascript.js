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
    
    // Settings button click
    const settingsBtn = document.getElementById('settingsButton');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', openSettingsModal);
    }
    
    // Close settings modal when clicking outside
    const settingsModal = document.getElementById('settingsModal');
    if (settingsModal) {
        settingsModal.addEventListener('click', function(event) {
            if (event.target === settingsModal) {
                closeSettingsModal();
            }
        });
    }
    
    // Close modal with Escape key
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            const modal = document.getElementById('settingsModal');
            if (modal && modal.style.display === 'block') {
                closeSettingsModal();
            }
        }
    });
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

// Prix unitaire for validation calculations
let currentPrixUnitaire = 0;

// Helper function to convert number to letter (1=A, 2=B, etc.)
function numberToLetter(num) {    return String.fromCharCode(65 + num - 1); // 65 is ASCII for 'A'
}

// Load prix unitaire for validation calculations
async function loadPrixUnitaire() {
    try {
        console.log('🔍 Loading prix unitaire for project ID:', PROJECT_ID);
        const prixData = await invoke('get_prix_unitaire', { projectId: PROJECT_ID });
        currentPrixUnitaire = prixData?.prix_unitaire || 0;
        
        // Also store it globally for the validation system
        window.currentPrixUnitaire = currentPrixUnitaire;
        
        console.log('✅ Prix unitaire loaded:', currentPrixUnitaire, 'DA/m²');
        return currentPrixUnitaire;
    } catch (error) {
        console.error('❌ Error loading prix unitaire:', error);
        currentPrixUnitaire = 0;
        window.currentPrixUnitaire = 0;
        return 0;
    }
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
    };    return colors[bloc] || '#7f8c8d'; // Default gray for unknown blocs
}

// Validate all loaded buyers and highlight issues
async function validateAllLoadedBuyers(buyers) {
    if (!buyers || buyers.length === 0) return;
    
    console.log('\n🔍 VALIDATING ALL LOADED BUYERS...');
    
    buyers.forEach((buyer, index) => {
        const buyerRow = document.querySelector(`tr[data-buyer-id="${buyer.id}"]`);
        if (!buyerRow) return;
        
        // Parse payments
        let payments = {};
        try {
            payments = typeof buyer.payments === 'string' ? JSON.parse(buyer.payments) : buyer.payments || {};
        } catch (e) {
            console.warn('Error parsing payments for buyer', buyer.id, e);
            return;
        }
          // Calculate limits
        const prixUnitaire = currentPrixUnitaire || 0;
        const surface = parseFloat(buyer.surface) || 0;
        const prixTotale = parseFloat(buyer.prix_totale) || 0;
        const remise = parseFloat(buyer.remise) || 0;
        
        // Calculate the reduced total price after remise (discount)
        const reducedTotalPrice = prixTotale - remise;
        
        const maxVersement = prixUnitaire * surface;
        const maxEspece = reducedTotalPrice - maxVersement;
        
        // Calculate actual amounts
        let actualVersement = 0;
        let actualEspece = 0;
        const exceededTranches = [];
        
        Object.keys(payments).forEach(trancheKey => {
            const trancheData = payments[trancheKey];
            let amount = 0;
            let type = 'versement';
            
            if (typeof trancheData === 'object' && trancheData !== null) {
                amount = parseFloat(trancheData.amount) || 0;
                type = trancheData.type || 'versement';
            } else {
                amount = parseFloat(trancheData) || 0;
                type = 'versement';
            }
            
            if (amount > 0) {
                if (type === 'versement') {
                    actualVersement += amount;
                } else if (type === 'espece') {
                    actualEspece += amount;
                }
            }
        });
        
        // Check for violations and highlight
        const versementExceeded = actualVersement > maxVersement;
        const especeExceeded = actualEspece > maxEspece;
        
        if (versementExceeded || especeExceeded) {
            // Add warning class to the entire row
            buyerRow.classList.add('validation-warning');
            
            // Add visual indicator
            const statusCell = buyerRow.querySelector('.status-cell');
            if (statusCell) {
                let warningIcon = statusCell.querySelector('.validation-warning-icon');
                if (!warningIcon) {
                    warningIcon = document.createElement('span');
                    warningIcon.className = 'validation-warning-icon';
                    warningIcon.innerHTML = '⚠️';
                    warningIcon.title = 'Payment validation warning';
                    statusCell.appendChild(warningIcon);
                }
            }
            
            // Highlight individual tranche cells
            const trancheCells = buyerRow.querySelectorAll('.tranche-cell');
            Object.keys(payments).forEach((trancheKey, trancheIndex) => {
                const trancheData = payments[trancheKey];
                let amount = 0;
                let type = 'versement';
                
                if (typeof trancheData === 'object' && trancheData !== null) {
                    amount = parseFloat(trancheData.amount) || 0;
                    type = trancheData.type || 'versement';
                } else {
                    amount = parseFloat(trancheData) || 0;
                    type = 'versement';
                }
                
                // Check if this specific tranche contributes to the violation
                if (amount > 0) {
                    const isViolation = (type === 'versement' && versementExceeded) || 
                                      (type === 'espece' && especeExceeded);
                    
                    if (isViolation && trancheCells[trancheIndex]) {
                        trancheCells[trancheIndex].classList.add('tranche-exceeded');
                    }
                }
            });
            
            console.log(`🚨 VALIDATION ISSUE - Buyer ${buyer.id} (${buyer.nom} ${buyer.prenom}):`);
            if (versementExceeded) {
                console.log(`   🏦 Versement exceeded: ${actualVersement.toLocaleString()} > ${maxVersement.toLocaleString()}`);
            }
            if (especeExceeded) {
                console.log(`   💸 Espèce exceeded: ${actualEspece.toLocaleString()} > ${maxEspece.toLocaleString()}`);
            }
        } else {
            // Remove any existing warning classes
            buyerRow.classList.remove('validation-warning');
            const warningIcon = buyerRow.querySelector('.validation-warning-icon');
            if (warningIcon) warningIcon.remove();
            
            const trancheCells = buyerRow.querySelectorAll('.tranche-cell');
            trancheCells.forEach(cell => cell.classList.remove('tranche-exceeded'));
        }
    });
    
    console.log('✅ Validation check completed for all buyers\n');
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
    }    // Check if espèce limit is already reached
    const surface = parseFloat(document.getElementById('surface').value) || 0;
    const prixTotale = parseFloat(document.getElementById('prixTotale').value) || 0;
    const remise = parseFloat(document.getElementById('remise').value) || 0;
    const prixUnitaire = currentPrixUnitaire || 0;
    
    // Calculate the reduced total price after remise (discount)
    const reducedTotalPrice = prixTotale - remise;
    
    // Calculate max versement (unchanged)
    const maxVersement = prixUnitaire * surface;
    
    // Calculate max espèce from the reduced total price
    const maxEspece = reducedTotalPrice - maxVersement;
    
    // Calculate current espèce total
    let currentEspeceTotal = 0;
    Array.from(tranchesContainer.children).forEach(row => {
        const amountInput = row.querySelector('input[type="number"]');
        const typeSelect = row.querySelector('select');
        const value = parseFloat(amountInput.value) || 0;
        const type = typeSelect ? typeSelect.value : 'versement';
        
        if (type === 'espece' && value > 0) {
            currentEspeceTotal += value;
        }
    });
    
    // Determine default type for new tranche
    const defaultType = currentEspeceTotal >= maxEspece ? 'versement' : 'espece';
    const defaultSelected = defaultType === 'espece' ? 'selected' : '';
    const versementSelected = defaultType === 'versement' ? 'selected' : '';

    const trancheRow = document.createElement('div');
    trancheRow.className = 'tranche-row';
    trancheRow.innerHTML = `
        <label>T${trancheCount}:</label>
        <input type="number" step="0.01" min="0" name="tranche_${trancheCount}" 
               placeholder="Enter amount for T${trancheCount}" oninput="handleTrancheInput(this)">
        <input type="date" name="tranche_date_${trancheCount}" title="Payment date for T${trancheCount}" onchange="triggerDebouncedValidation()">
        <select name="tranche_type_${trancheCount}" title="Payment type for T${trancheCount}" onchange="handleTrancheTypeChange(this)">
            <option value="espece" ${defaultSelected}>Espèce</option>
            <option value="versement" ${versementSelected}>Versement</option>
        </select>
        <button type="button" class="btn-print-tranche" onclick="printOrdreVersement(${trancheCount})" title="Print Ordre de Versement">
            <i class="fas fa-print"></i>
        </button>
        <button type="button" class="btn-remove-tranche" onclick="removeTranche(this)">×</button>
    `;
    
    tranchesContainer.appendChild(trancheRow);
    updateAddTrancheButtonVisibility();
    
    // Update all tranche type options after adding new tranche
    updateTrancheTypeOptions();
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

function validateTrancheAmount(input) {
    // Add a small delay to allow for rapid typing
    clearTimeout(window.validationTimeout);
    window.validationTimeout = setTimeout(() => {
        validateEspeceAmount(input);
    }, 500);
}

// Make validateTrancheAmount globally accessible
window.validateTrancheAmount = validateTrancheAmount;
window.calculateTotalPaid = calculateTotalPaid;
window.handleTrancheInput = handleTrancheInput;
window.handleTrancheTypeChange = handleTrancheTypeChange;
window.updateTrancheTypeOptions = updateTrancheTypeOptions;

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
    }    // Load buyers from database
    async function loadBuyers() {
        try {
            showLoading();
            
            // 🐛 DEBUG: Load prix unitaire first for validation calculations
            await loadPrixUnitaire();
            
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
            
            // 🔍 Trigger validation for all loaded buyers to show warnings
            await validateAllLoadedBuyers(filteredBuyers);
            
              // 🐛 DEBUG: Summary statistics for all buyers
            if (filteredBuyers.length > 0) {
                const prixUnitaire = currentPrixUnitaire || window.currentPrixUnitaire || 0;
                let totalMaxVersement = 0;
                let totalMaxEspece = 0;
                let totalSurface = 0;
                let totalPrixTotale = 0;
                  filteredBuyers.forEach(buyer => {
                    const surface = parseFloat(buyer.surface) || 0;
                    const prixTotale = parseFloat(buyer.prix_totale) || 0;
                    const remise = parseFloat(buyer.remise) || 0;
                    
                    // Calculate the reduced total price after remise (discount)
                    const reducedTotalPrice = prixTotale - remise;
                    
                    const maxVersement = prixUnitaire * surface;
                    const maxEspece = reducedTotalPrice - maxVersement;
                    
                    totalMaxVersement += maxVersement;
                    totalMaxEspece += maxEspece;
                    totalSurface += surface;
                    totalPrixTotale += prixTotale;
                });
                
                console.log(`\n📊 VALIDATION LIMITS SUMMARY (${filteredBuyers.length} buyers):`);
                console.log(`   🏗️  Total Surface: ${totalSurface.toLocaleString()}m²`);
                console.log(`   💰 Prix Unitaire: ${prixUnitaire.toLocaleString()} DA/m² (${prixUnitaire === 0 ? '❌ NOT LOADED!' : '✅ loaded'})`);
                console.log(`   💵 Total Prix Totale: ${totalPrixTotale.toLocaleString()} DA`);
                console.log(`   🏦 Total Max Versement: ${totalMaxVersement.toLocaleString()} DA`);
                console.log(`   💸 Total Max Espèce: ${totalMaxEspece.toLocaleString()} DA`);
                
                if (prixUnitaire === 0) {
                    console.error(`   🚨 CRITICAL: Prix unitaire is 0! All max versement calculations will be 0!`);
                    console.error(`   🔧 Check: 1) Database has prix_unitaire for project ${PROJECT_ID}`);
                    console.error(`   🔧 Check: 2) get_prix_unitaire Tauri command is working`);
                }
                
                console.log(`   ═══════════════════════════════════════════════════════════`);
            }
        } catch (error) {
            console.error('Error loading buyers:', error);
            tbody.innerHTML = `
                <tr>
                    <td colspan="${totalColumns}" style="text-align: center; padding: 2rem; color: #e74c3c;">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p style="margin-top: 1rem;">Error loading buyers. Please try again.</p>
                    </td>                </tr>
            `;
        }
    }

    // Make loadBuyers globally accessible
    window.loadBuyers = loadBuyers;// Helper function to render a buyer row
    function renderBuyerRow(newRow, buyer, buyersInNiveau, index, niveau) {
        // Parse payments safely
        let payments = {};
        try {
            payments = typeof buyer.payments === 'string' ? JSON.parse(buyer.payments) : buyer.payments || {};
        } catch (e) {
            console.warn('Error parsing payments for buyer', buyer.id, e);
            payments = {};
        }        // 🐛 DEBUG: Calculate and display maximum validation limits for this buyer
        const prixUnitaire = currentPrixUnitaire || window.currentPrixUnitaire || 0;
        const surface = parseFloat(buyer.surface) || 0;
        const prixTotale = parseFloat(buyer.prix_totale) || 0;
        const remise = parseFloat(buyer.remise) || 0;
        
        // Calculate the reduced total price after remise (discount)
        const reducedTotalPrice = prixTotale - remise;
        
        // Calculate maximum versement (prix unitaire × surface)
        const maxVersement = prixUnitaire * surface;
        
        // Calculate maximum espèce (reduced total price - max versement)
        const maxEspece = reducedTotalPrice - maxVersement;
        
        // 🔍 Calculate actual amounts from tranches
        let actualVersement = 0;
        let actualEspece = 0;
        const trancheDetails = [];
        
        Object.keys(payments).forEach(trancheKey => {
            const trancheData = payments[trancheKey];
            let amount = 0;
            let type = 'versement';
            
            if (typeof trancheData === 'object' && trancheData !== null) {
                amount = parseFloat(trancheData.amount) || 0;
                type = trancheData.type || 'versement';
            } else {
                amount = parseFloat(trancheData) || 0;
                type = 'versement';
            }
            
            if (amount > 0) {
                trancheDetails.push(`${trancheKey}: ${amount.toLocaleString()} DA (${type})`);
                if (type === 'versement') {
                    actualVersement += amount;
                } else if (type === 'espece') {
                    actualEspece += amount;
                }
            }
        });
        
        // Debug output for each buyer with detailed validation
        console.log(`🏠 BUYER DEBUG [ID: ${buyer.id}] - ${buyer.nom} ${buyer.prenom}:`);
        console.log(`   📐 Surface: ${surface}m² (raw: "${buyer.surface}")`);
        console.log(`   💰 Prix Unitaire: ${prixUnitaire.toLocaleString()} DA/m² (source: ${prixUnitaire === currentPrixUnitaire ? 'local' : 'window'})`);
        console.log(`   💵 Prix Totale: ${prixTotale.toLocaleString()} DA (raw: "${buyer.prix_totale}")`);
        console.log(`   🧮 Calculation: ${prixUnitaire} × ${surface} = ${maxVersement}`);
        console.log(`   📊 LIMITS:`);
        console.log(`       🏦 Max Versement: ${maxVersement.toLocaleString()} DA (prix unitaire × surface)`);
        console.log(`       💸 Max Espèce: ${maxEspece.toLocaleString()} DA (prix totale - max versement)`);
        console.log(`   💳 ACTUAL AMOUNTS:`);
        console.log(`       🏦 Actual Versement: ${actualVersement.toLocaleString()} DA`);
        console.log(`       💸 Actual Espèce: ${actualEspece.toLocaleString()} DA`);
        console.log(`   📋 TRANCHES: ${trancheDetails.length > 0 ? trancheDetails.join(', ') : 'No tranches'}`);
        
        // 🚨 Validation checks and warnings
        const versementExceeded = actualVersement > maxVersement;
        const especeExceeded = actualEspece > maxEspece;
        
        if (versementExceeded) {
            console.error(`   🚨 VERSEMENT EXCEEDED! ${actualVersement.toLocaleString()} > ${maxVersement.toLocaleString()} (over by ${(actualVersement - maxVersement).toLocaleString()} DA)`);
        } else {
            console.log(`   ✅ Versement OK: ${actualVersement.toLocaleString()} ≤ ${maxVersement.toLocaleString()}`);
        }
        
        if (especeExceeded) {
            console.error(`   🚨 ESPÈCE EXCEEDED! ${actualEspece.toLocaleString()} > ${maxEspece.toLocaleString()} (over by ${(actualEspece - maxEspece).toLocaleString()} DA)`);
        } else {
            console.log(`   ✅ Espèce OK: ${actualEspece.toLocaleString()} ≤ ${maxEspece.toLocaleString()}`);
        }
        
        // Validation warnings
        if (prixUnitaire === 0) {
            console.warn(`   ⚠️  WARNING: Prix unitaire is 0! Cannot calculate proper validation limits.`);
        }
        if (surface === 0) {
            console.warn(`   ⚠️  WARNING: Surface is 0! Check buyer data.`);
        }
        if (maxVersement === 0) {
            console.warn(`   ⚠️  WARNING: Max versement is 0! Validation will not work properly.`);
        }
        
        console.log(`   ─────────────────────────────────────────────────────`);
        
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
        await populateApartmentTypeDropdown();        // Reset tranches to just T0
        const tranchesContainer = document.getElementById('tranchesContainer');
        tranchesContainer.innerHTML = `
            <div class="tranche-row">
                <label>T0:</label>
                <input type="number" step="0.01" min="0" name="tranche_0" 
                       placeholder="Enter amount for T0" oninput="calculateTotalPaid(); validateTrancheAmount(this)">
                <input type="date" name="tranche_date_0" title="Payment date for T0">
                <select name="tranche_type_0" title="Payment type for T0">
                    <option value="espece" selected>Espèce</option>
                    <option value="versement">Versement</option>
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
                }            });

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
            };            // Validate espèce amounts before submission
            const surface = parseFloat(document.getElementById('surface').value) || 0;
            const prixTotale = parseFloat(document.getElementById('prixTotale').value) || 0;
            const remise = parseFloat(document.getElementById('remise').value) || 0;
            const prixUnitaire = currentPrixUnitaire || 0;
            
            // Calculate the reduced total price after remise (discount)
            const reducedTotalPrice = prixTotale - remise;
            
            // Calculate max versement (unchanged)
            const maxVersement = prixUnitaire * surface;
            
            // Calculate max espèce from the reduced total price
            const maxEspece = reducedTotalPrice - maxVersement;            // Calculate espèce amounts and find which tranche causes the violation
            let totalEspeceAmount = 0;
            let violatingTrancheInput = null;
            let violatingTrancheAmount = 0;
            let previousEspeceTotal = 0;
            
            Array.from(tranchesContainer.children).forEach((row, index) => {
                const amountInput = row.querySelector('input[type="number"]');
                const typeSelect = row.querySelector('select');
                const value = parseFloat(amountInput.value) || 0;
                const type = typeSelect ? typeSelect.value : 'versement';
                
                if (type === 'espece' && value > 0) {
                    const previousTotal = totalEspeceAmount;
                    totalEspeceAmount += value;
                    
                    // Check if this tranche causes the violation
                    if (previousTotal <= maxEspece && totalEspeceAmount > maxEspece) {
                        violatingTrancheInput = amountInput;
                        violatingTrancheAmount = value;
                        previousEspeceTotal = previousTotal;
                    }
                }
            });            // Check if total espèce exceeds the limit
            if (totalEspeceAmount > maxEspece && totalEspeceAmount > 0 && violatingTrancheInput) {
                // Calculate how much espèce room is left for the violating tranche
                const availableEspeceRoom = maxEspece - previousEspeceTotal;
                const excessAmount = violatingTrancheAmount - availableEspeceRoom;                // Store pending data for the modal
                pendingEspeceData = {
                    trancheInput: violatingTrancheInput,
                    enteredAmount: violatingTrancheAmount, // The amount in the violating tranche
                    maxEspece: availableEspeceRoom, // Available room for this tranche
                    acceptedEspece: availableEspeceRoom, // Max this tranche can take
                    remainingVersement: excessAmount, // Amount that should become versement
                    formData: buyerData,
                    isEdit: isEdit,
                    buyerId: buyerId,
                    submitBtn: submitBtn,
                    originalText: originalText
                };
                
                // Reset submit button state                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
                
                // Show the modal and stop form submission
                showEspeceWarningModal();
                return;
            }

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
    document.getElementById('prixTotale').addEventListener('input', function() {
        calculateTotalPaid();
        updateTrancheTypeOptions();
    });
    document.getElementById('remise').addEventListener('input', function() {
        calculateTotalPaid();
        updateTrancheTypeOptions();
    });
    
    // Add event listener for surface changes
    document.getElementById('surface').addEventListener('input', function() {
        updateTrancheTypeOptions();
    });
    
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
    
    // Update tranche type options when surface/price changes
    updateTrancheTypeOptions();
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
                <input type="date" name="tranche_date_${index}" value="${date}" title="Payment date for T${index}">                <select name="tranche_type_${index}" title="Payment type for T${index}">
                    <option value="espece" ${type === 'espece' ? 'selected' : ''}>Espèce</option>
                    <option value="versement" ${type === 'versement' ? 'selected' : ''}>Versement</option>
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
window.printOrdreVersement = printOrdreVersement;

// Print Ordre de Versement function
async function printOrdreVersement(trancheIndex) {
    try {
        // Get form data
        const form = document.getElementById('addBuyerForm');
        if (!form) {
            alert('No form found');
            return;
        }
        
        const formData = new FormData(form);
        const buyerName = formData.get('nom') || 'N/A';
        const prenom = formData.get('prenom') || '';
        const trancheAmount = formData.get(`tranche_${trancheIndex}`) || '0';
        const trancheDate = formData.get(`tranche_date_${trancheIndex}`) || new Date().toISOString().split('T')[0];
        const trancheType = formData.get(`tranche_type_${trancheIndex}`) || 'versement';
        
        if (!trancheAmount || parseFloat(trancheAmount) <= 0) {
            alert('Please enter a valid amount for this tranche before printing');
            return;
        }
        
        // Get current project info
        const projectTitle = document.getElementById('pageTitle')?.textContent || 'Project';
        
        // Create PDF using the DocumentGenerator from utils if available
        if (window.DocumentGenerator) {
            const docGenerator = new window.DocumentGenerator();
            const buyerData = {
                nom: buyerName,
                prenom: prenom,
                bloc: formData.get('bloc') || '',
                niveau: formData.get('niveau') || '',
                logt_num: formData.get('logtNum') || '',
                type_logt: formData.get('typeLogt') || ''
            };
            
            const trancheData = {
                index: trancheIndex,
                amount: parseFloat(trancheAmount),
                date: trancheDate,
                type: trancheType
            };
            
            await docGenerator.generateOrdreVersement(buyerData, trancheData);
        } else {
            // Fallback to simple print functionality
            generateSimpleOrdreVersement(buyerName, prenom, trancheIndex, trancheAmount, trancheDate, trancheType);
        }
        
    } catch (error) {
        console.error('Error generating Ordre de Versement:', error);
        alert('Error generating Ordre de Versement: ' + error.message);
    }
}

// Simple ordre de versement generation fallback
function generateSimpleOrdreVersement(buyerName, prenom, trancheIndex, amount, date, type) {
    const printWindow = window.open('', '_blank');
    
    const currentDate = new Date().toLocaleDateString('fr-FR');
    const paymentDate = date ? new Date(date).toLocaleDateString('fr-FR') : currentDate;
    
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Ordre de Versement - T${trancheIndex}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .header { text-align: center; margin-bottom: 30px; }
                .title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
                .subtitle { font-size: 16px; color: #666; }
                .content { margin: 30px 0; }
                .buyer-info { margin-bottom: 20px; }
                .info-row { margin: 8px 0; }
                .amount-section { border: 2px solid #333; padding: 15px; margin: 20px 0; text-align: center; }
                .amount { font-size: 20px; font-weight: bold; }
                .amount-words { font-style: italic; margin-top: 10px; }
                .footer { margin-top: 50px; }
                .signature { text-align: right; margin-top: 40px; }
                @media print { body { margin: 0; } }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="title">ORDRE DE VERSEMENT</div>
                <div class="subtitle">Tranche T${trancheIndex} - ${type.charAt(0).toUpperCase() + type.slice(1)}</div>
            </div>
            
            <div class="content">
                <div class="buyer-info">
                    <div class="info-row"><strong>Client:</strong> ${prenom} ${buyerName}</div>
                    <div class="info-row"><strong>Date de versement:</strong> ${paymentDate}</div>
                    <div class="info-row"><strong>Type de paiement:</strong> ${type}</div>
                </div>
                
                <div class="amount-section">
                    <div class="amount">Montant: ${parseFloat(amount).toFixed(2)} DA</div>
                    <div class="amount-words">${numberToWords(parseFloat(amount))} dinars algériens</div>
                </div>
                
                <div class="footer">
                    <p>Ce document certifie le versement de la tranche T${trancheIndex} pour le logement mentionné ci-dessus.</p>
                    <p>Date d'émission: ${currentDate}</p>
                </div>
                
                <div class="signature">
                    <p>Signature et cachet de l'entreprise</p>
                    <br><br>
                    <p>_________________________</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Wait for content to load then print
    printWindow.onload = function() {
        printWindow.print();
        printWindow.close();
    };
}

// Helper function to convert numbers to words (French)
function numberToWords(num) {
    const ones = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
    const teens = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
    const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'];
    
    if (num === 0) return 'zéro';
    
    let result = '';
    let thousandCounter = 0;
    
    while (num > 0) {
        let chunk = num % 1000;
        if (chunk !== 0) {
            let chunkText = '';
            
            // Hundreds
            if (chunk >= 100) {
                if (Math.floor(chunk / 100) === 1) {
                    chunkText += 'cent ';
                } else {
                    chunkText += ones[Math.floor(chunk / 100)] + ' cent ';
                }
                chunk %= 100;
            }
            
            // Tens and ones
            if (chunk >= 20) {
                chunkText += tens[Math.floor(chunk / 10)];
                if (chunk % 10 !== 0) {
                    chunkText += '-' + ones[chunk % 10];
                }
            } else if (chunk >= 10) {
                chunkText += teens[chunk - 10];
            } else if (chunk > 0) {
                chunkText += ones[chunk];
            }
            
            // Add thousand multiplier
            if (thousandCounter > 0 && chunk > 0) {
                if (thousandCounter === 1) {
                    chunkText += ' mille';
                } else if (thousandCounter === 2) {
                    chunkText += ' millions';
                }
            }
            
            result = chunkText + ' ' + result;
        }
        
        num = Math.floor(num / 1000);
        thousandCounter++;
    }
    
    return result.trim();
}

// Add event listener for apartment type change

document.getElementById('typeLogt').addEventListener('change', handleApartmentTypeChange);

// ⚙️ Settings Modal Functions
function openSettingsModal() {
    const modal = document.getElementById('settingsModal');
    const currentValueSpan = document.getElementById('currentPrixUnitaire');
    const prixUnitaireInput = document.getElementById('prixUnitaireInput');
    
    // Display current prix unitaire
    currentValueSpan.textContent = currentPrixUnitaire ? currentPrixUnitaire.toLocaleString() : '0';
    
    // Pre-fill the input with current value
    prixUnitaireInput.value = currentPrixUnitaire || '';
    
    // Show modal with animation
    modal.style.display = 'block';
    modal.classList.add('show');
    document.body.style.overflow = 'hidden'; // Prevent scrolling
    
    // Focus on input after animation
    setTimeout(() => {
        prixUnitaireInput.focus();
        prixUnitaireInput.select();
    }, 300);
}

function closeSettingsModal() {
    const modal = document.getElementById('settingsModal');
    
    // Hide modal
    modal.classList.remove('show');
    modal.style.display = 'none';
    
    document.body.style.overflow = 'auto'; // Restore scrolling
    
    // Reset button states
    const saveBtn = document.querySelector('.btn-save');
    if (saveBtn) {
        saveBtn.classList.remove('loading', 'success');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
    }
}

async function savePrixUnitaire() {
    const prixUnitaireInput = document.getElementById('prixUnitaireInput');
    const newPrixUnitaire = parseFloat(prixUnitaireInput.value);
    
    // Validate input
    if (isNaN(newPrixUnitaire) || newPrixUnitaire < 0) {
        alert('Please enter a valid positive number for Prix Unitaire.');
        prixUnitaireInput.focus();
        return;
    }
    
    const saveBtn = document.querySelector('.btn-save');
    
    try {
        // Show loading state
        saveBtn.classList.add('loading');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        
        console.log('🔄 Saving prix unitaire:', newPrixUnitaire);
        
        // Save to database
        await invoke('update_prix_unitaire', { 
            projectId: PROJECT_ID, 
            prixUnitaire: newPrixUnitaire 
        });
        
        // Update local variables
        currentPrixUnitaire = newPrixUnitaire;
        window.currentPrixUnitaire = newPrixUnitaire;
        
        console.log('✅ Prix unitaire saved successfully');
        
        // Update the current value display
        document.getElementById('currentPrixUnitaire').textContent = newPrixUnitaire.toLocaleString();
        
        // Show success state
        saveBtn.classList.remove('loading');
        saveBtn.classList.add('success');
        saveBtn.textContent = 'Saved!';
        
        console.log('✅ Prix unitaire updated successfully:', newPrixUnitaire);
        
        // Close modal and reload after a brief delay
        setTimeout(async () => {
            closeSettingsModal();
            
            try {
                console.log('🔄 Reloading buyers with new prix unitaire...');
                await loadBuyers();
                console.log('✅ Buyers reloaded successfully');
            } catch (reloadError) {
                console.error('❌ Error reloading buyers:', reloadError);
                // Don't show alert for reload error, just log it
            }
        }, 1200);
        
    } catch (error) {
        console.error('❌ Error saving prix unitaire:', error);
        
        // Show user-friendly error message
        let errorMessage = 'Error saving prix unitaire';
        if (error.message) {
            errorMessage += ': ' + error.message;
        } else if (typeof error === 'string') {
            errorMessage += ': ' + error;
        }
        
        alert(errorMessage);
        
        // Reset button state
        saveBtn.classList.remove('loading', 'success');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
        prixUnitaireInput.focus();
    }
}

// Make functions globally accessible
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.savePrixUnitaire = savePrixUnitaire;

// 🚨 Espèce Warning Modal Functions
let pendingEspeceData = null;

function validateEspeceAmount(trancheInput) {
    const amount = parseFloat(trancheInput.value) || 0;
    const type = trancheInput.closest('.tranche-row').querySelector('select').value;
    
    // Only validate if it's espèce type
    if (type !== 'espece' || amount <= 0) return true;
    
    // Calculate validation limits
    const prixUnitaire = currentPrixUnitaire || 0;
    const surface = parseFloat(document.getElementById('surface').value) || 0;
    const prixTotale = parseFloat(document.getElementById('prixTotale').value) || 0;
    const remise = parseFloat(document.getElementById('remise').value) || 0;
    
    // Calculate the reduced total price after remise (discount)
    const reducedTotalPrice = prixTotale - remise;
    
    // Calculate max versement (unchanged)
    const maxVersement = prixUnitaire * surface;
    
    // Calculate max espèce from the reduced total price
    const maxEspece = reducedTotalPrice - maxVersement;
    
    if (amount > maxEspece) {
        // Store the pending data
        pendingEspeceData = {
            trancheInput: trancheInput,
            enteredAmount: amount,
            maxEspece: maxEspece,
            acceptedEspece: maxEspece,
            remainingVersement: amount - maxEspece
        };
        
        showEspeceWarningModal();
        return false;
    }
    
    return true;
}

function showEspeceWarningModal() {
    if (!pendingEspeceData) return;
    
    const modal = document.getElementById('especeWarningModal');
    
    // Calculate total maximum espèce for display
    const prixUnitaire = currentPrixUnitaire || 0;
    const surface = parseFloat(document.getElementById('surface').value) || 0;
    const prixTotale = parseFloat(document.getElementById('prixTotale').value) || 0;
    const remise = parseFloat(document.getElementById('remise').value) || 0;
    
    const reducedTotalPrice = prixTotale - remise;
    const maxVersement = prixUnitaire * surface;
    const totalMaxEspece = reducedTotalPrice - maxVersement;
    
    // Update modal content with actual values
    document.getElementById('enteredEspeceAmount').textContent = pendingEspeceData.enteredAmount.toLocaleString() + ' DA';
    document.getElementById('maxEspeceAllowed').textContent = totalMaxEspece.toLocaleString() + ' DA';
    document.getElementById('acceptedEspeceAmount').textContent = pendingEspeceData.acceptedEspece.toLocaleString() + ' DA';
    document.getElementById('remainingVersementAmount').textContent = pendingEspeceData.remainingVersement.toLocaleString() + ' DA';
    
    // Show modal
    modal.style.display = 'block';
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeEspeceWarningModal() {
    const modal = document.getElementById('especeWarningModal');
    modal.classList.remove('show');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
    
    // Reset the input to the original entered value (don't change user's input)
    if (pendingEspeceData && pendingEspeceData.trancheInput) {
        // Keep the user's original amount - they can adjust it manually if needed
        // Don't force change their input value
        calculateTotalPaid();
    }
    
    pendingEspeceData = null;
}

function acceptEspeceAdjustment() {
    if (!pendingEspeceData) return;
    
    // Store the original amount entered by user
    const originalAmount = pendingEspeceData.enteredAmount;
    const maxEspeceAllowed = pendingEspeceData.acceptedEspece;
    const remainingAmount = originalAmount - maxEspeceAllowed;
    
    // Set the current tranche to max espèce amount allowed
    pendingEspeceData.trancheInput.value = maxEspeceAllowed;
    
    // Only create new tranche if there's remaining amount
    if (remainingAmount > 0) {
        // Create new tranche for remaining versement amount
        addTranche();
        const tranchesContainer = document.getElementById('tranchesContainer');
        const newTranche = tranchesContainer.lastElementChild;
        
        // Set the new tranche values
        const newAmountInput = newTranche.querySelector('input[type="number"]');
        const newTypeSelect = newTranche.querySelector('select');
        const newDateInput = newTranche.querySelector('input[type="date"]');
        
        newAmountInput.value = remainingAmount;
        newTypeSelect.value = 'versement';
        
        // Set today's date for the new tranche
        const today = new Date().toISOString().split('T')[0];
        newDateInput.value = today;
        
        console.log(`✅ Split: ${maxEspeceAllowed.toLocaleString()} DA (espèce) + ${remainingAmount.toLocaleString()} DA (versement)`);
    }
    
    calculateTotalPaid();
    closeEspeceWarningModal();
    
    // Show the versement order modal
    showVersementOrderModal();
    
    // Complete the form submission after modal is closed
    completeFormSubmission();
    
    console.log('✅ Espèce adjustment accepted - Amount properly split');
}

function acceptEspeceAndPrintRecu() {
    if (!pendingEspeceData) return;
    
    // Print the reçu - this function now handles the complete flow
    printRecuVersement();
}

async function completeFormSubmission() {
    if (!pendingEspeceData) return;
    
    const { formData, isEdit, buyerId, submitBtn, originalText } = pendingEspeceData;
    
    try {
        // Show loading state on submit button
        submitBtn.innerHTML = '<div class="loading-spinner"></div> ' + (isEdit ? 'Updating...' : 'Adding...');
        submitBtn.disabled = true;
        
        // Recalculate tranches data after adjustment
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
        
        // Update formData with new tranche information
        formData.payments = tranches;
        formData.total_paid = totalPaidAmount;
        
        // Add or update buyer in database
        if (isEdit) {
            await invoke('edit_buyer_in_database', { buyerId: parseInt(buyerId), buyer: formData });
        } else {
            await invoke('add_buyer_to_database', { buyer: formData });
        }
        
        // Reset form and close modal
        const form = document.getElementById('addBuyerForm');
        form.reset();
        form.removeAttribute('data-buyer-id');
        const modal = document.getElementById('buyerModal');
        modal.style.display = 'none';
        
        // Show success modal
        const successModal = document.getElementById('successModal');
        successModal.style.display = 'block';
        
        // Reload buyers list
        await loadBuyers();
        
    } catch (error) {
        console.error('Error saving buyer:', error);
        alert('Error saving buyer: ' + error);
    } finally {
        // Reset submit button
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        
        // Clear pending data
        pendingEspeceData = null;
    }
}

function showVersementOrderModal() {
    if (!pendingEspeceData) return;
    
    const modal = document.getElementById('versementOrderModal');
    if (!modal) {
        console.error('Versement order modal not found');
        return;
    }
    
    // Update modal content with versement amount
    const versementAmountEl = document.getElementById('versementOrderAmount');
    if (versementAmountEl) {
        versementAmountEl.textContent = pendingEspeceData.remainingVersement.toLocaleString() + ' DA';
    }
    
    // Show modal
    modal.style.display = 'block';
    modal.classList.add('show');
}

function closeVersementOrderModal() {
    const modal = document.getElementById('versementOrderModal');
    if (modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
    }
    
    // Clear pending data since operation is complete
    pendingEspeceData = null;
}

function printVersementOrderFromModal() {
    if (!pendingEspeceData) return;
    
    console.log('🖨️ Printing Ordre de Versement for versement amount');
    
    // TODO: Implement French versement order printing logic
    alert('Printing Ordre de Versement for ' + pendingEspeceData.remainingVersement.toLocaleString() + ' DA');
    
    // Close the modal after printing
    closeVersementOrderModal();
}

function skipPrintVersementOrder() {
    console.log('User chose not to print Ordre de Versement');
    closeVersementOrderModal();
}

function printRecuVersement() {
    if (!pendingEspeceData) return;
    
    console.log('🖨️ Printing Reçu de Versement (Arabic receipt)');
    
    // Get buyer data for the receipt
    const surface = parseFloat(document.getElementById('surface').value) || 0;
    const nom = document.getElementById('nom').value || '';
    const prenom = document.getElementById('prenom').value || '';
    const bloc = document.getElementById('bloc').value || '';
    const logtNum = document.getElementById('logtNum').value || '';
    
    // Create and show printable receipt document
    const receiptWindow = window.open('', '_blank', 'width=800,height=600');
    receiptWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <title>وصل استلام - Reçu de Versement</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; direction: rtl; }
                .header { text-align: center; margin-bottom: 30px; }
                .amount { font-size: 24px; font-weight: bold; color: #2c3e50; }
                .details { margin: 20px 0; }
                .signature { margin-top: 50px; text-align: left; }
                @media print { body { margin: 0; } }
            </style>
        </head>
        <body>
            <div class="header">
                <h2>وصل استلام نقدي</h2>
                <h3>Reçu de Versement en Espèce</h3>
            </div>
            <div class="details">
                <p><strong>المبلغ / Montant:</strong> <span class="amount">${pendingEspeceData.acceptedEspece.toLocaleString()} DA</span></p>
                <p><strong>الاسم / Nom:</strong> ${nom} ${prenom}</p>
                <p><strong>الكتلة / Bloc:</strong> ${bloc}</p>
                <p><strong>رقم السكن / N° Logement:</strong> ${logtNum}</p>
                <p><strong>المساحة / Surface:</strong> ${surface} m²</p>
                <p><strong>التاريخ / Date:</strong> ${new Date().toLocaleDateString('fr-FR')}</p>
            </div>            <div class="signature">                <p>التوقيع / Signature: ____________________</p>
            </div>
            <script>
                let printTriggered = false;
                
                window.onload = function() {
                    printTriggered = true;
                    window.print();
                }
                
                window.onafterprint = function() {
                    // Close window after 200ms delay (whether printed or cancelled)
                    setTimeout(() => {
                        window.close();
                    }, 200);
                }
                
                window.onbeforeunload = function() {
                    // Also close if user navigates away or closes manually
                    if (printTriggered) {
                        window.close();
                    }
                }
            </script>
        </body>
        </html>
    `);
    receiptWindow.document.close();
    
    // After showing the receipt, check if there's remaining versement amount
    setTimeout(() => {
        if (pendingEspeceData.remainingVersement > 0) {
            // Show proper modal asking if user wants to print ordre de versement
            showOrdreVersementConfirmModal();
        } else {
            // No remaining amount, just proceed with the adjustment
            acceptEspeceAdjustment();
        }
    }, 1000);
}

function printOrdreVersementForEspece() {
    if (!pendingEspeceData) return;
    
    console.log('🖨️ Printing Ordre de Versement (French order)');
    
    // TODO: Implement French order printing logic  
    alert('Printing Ordre de Versement for ' + pendingEspeceData.remainingVersement.toLocaleString() + ' DA');
}

// Confirmation modal for printing ordre de versement
function showOrdreVersementConfirmModal() {
    if (!pendingEspeceData) return;
    
    // Create a simple modal for ordre de versement confirmation
    const modalHTML = `
        <div id="ordreVersementConfirmModal" class="modal" style="display: block;">
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-print"></i> Impression Ordre de Versement</h3>
                </div>
                <div class="modal-body">
                    <p>Voulez-vous imprimer l'<strong>Ordre de Versement</strong> pour le montant restant?</p>
                    <div class="amount-display">
                        <strong>${pendingEspeceData.remainingVersement.toLocaleString()} DA</strong>
                        <br><small>Montant à convertir en versement</small>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-primary" onclick="confirmPrintOrdreVersement()">
                        <i class="fas fa-print"></i> Oui, Imprimer
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="skipOrdreVersementPrint()">
                        <i class="fas fa-times"></i> Non, Continuer
                    </button>
                </div>
            </div>
        </div>
        <style>
            #ordreVersementConfirmModal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 10001;
            }
            
            #ordreVersementConfirmModal .modal-content {
                background: white;
                max-width: 450px;
                margin: 15% auto;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
            }
            
            #ordreVersementConfirmModal .modal-header {
                padding: 20px;
                border-bottom: 1px solid #eee;
                background: #f8f9fa;
                border-radius: 8px 8px 0 0;
            }
            
            #ordreVersementConfirmModal .modal-header h3 {
                margin: 0;
                color: #2c3e50;
                font-size: 18px;
            }
            
            #ordreVersementConfirmModal .modal-body {
                padding: 20px;
                text-align: center;
            }
            
            #ordreVersementConfirmModal .amount-display {
                background: #e3f2fd;
                padding: 15px;
                border-radius: 6px;
                margin: 15px 0;
                border: 1px solid #bbdefb;
            }
            
            #ordreVersementConfirmModal .amount-display strong {
                font-size: 20px;
                color: #1976d2;
            }
            
            #ordreVersementConfirmModal .modal-footer {
                padding: 20px;
                text-align: center;
                border-top: 1px solid #eee;
                background: #f8f9fa;
                border-radius: 0 0 8px 8px;
            }
            
            #ordreVersementConfirmModal .btn {
                padding: 10px 20px;
                margin: 0 5px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
            }
            
            #ordreVersementConfirmModal .btn-primary {
                background: #007bff;
                color: white;
            }
            
            #ordreVersementConfirmModal .btn-primary:hover {
                background: #0056b3;
            }
            
            #ordreVersementConfirmModal .btn-secondary {
                background: #6c757d;
                color: white;
            }
            
            #ordreVersementConfirmModal .btn-secondary:hover {
                background: #545b62;
            }
        </style>
    `;
    
    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.body.style.overflow = 'hidden';
}

function confirmPrintOrdreVersement() {
    // Remove the confirmation modal
    const modal = document.getElementById('ordreVersementConfirmModal');
    if (modal) modal.remove();
    document.body.style.overflow = 'auto';
    
    // Print the ordre de versement
    printOrdreVersementForRemaining();
}

function skipOrdreVersementPrint() {
    // Remove the confirmation modal
    const modal = document.getElementById('ordreVersementConfirmModal');
    if (modal) modal.remove();
    document.body.style.overflow = 'auto';
    
    // Proceed without printing
    acceptEspeceAdjustment();
}

function printOrdreVersementForRemaining() {
    if (!pendingEspeceData) return;
    
    console.log('🖨️ Printing Ordre de Versement for remaining amount');
    
    // Get buyer data for the order
    const surface = parseFloat(document.getElementById('surface').value) || 0;
    const nom = document.getElementById('nom').value || '';
    const prenom = document.getElementById('prenom').value || '';
    const bloc = document.getElementById('bloc').value || '';
    const logtNum = document.getElementById('logtNum').value || '';
    
    // Create and show printable order document
    const orderWindow = window.open('', '_blank', 'width=800,height=600');
    orderWindow.document.write(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <title>Ordre de Versement</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2c3e50; padding-bottom: 20px; }
                .amount { font-size: 24px; font-weight: bold; color: #c0392b; background: #ecf0f1; padding: 10px; border-radius: 5px; }
                .details { margin: 20px 0; line-height: 1.6; }
                .footer { margin-top: 50px; display: flex; justify-content: space-between; }
                @media print { body { margin: 0; } }
            </style>
        </head>
        <body>
            <div class="header">
                <h2>ORDRE DE VERSEMENT</h2>
                <p>Paiement par Versement Bancaire</p>
            </div>
            <div class="details">
                <p><strong>Montant à Verser:</strong> <span class="amount">${pendingEspeceData.remainingVersement.toLocaleString()} DA</span></p>
                <p><strong>Bénéficiaire:</strong> ${nom} ${prenom}</p>
                <p><strong>Bloc:</strong> ${bloc}</p>
                <p><strong>N° Logement:</strong> ${logtNum}</p>
                <p><strong>Surface:</strong> ${surface} m²</p>
                <p><strong>Date d'émission:</strong> ${new Date().toLocaleDateString('fr-FR')}</p>
                <p><strong>Modalité:</strong> Versement bancaire (complément après dépassement limite espèce)</p>
            </div>            <div class="footer">
                <div>
                    <p>Signature du Client:</p>
                    <p>____________________</p>
                </div>
                <div>                    <p>Cachet et Signature:</p>
                    <p>____________________</p>
                </div>
            </div>
            <script>
                let printTriggered = false;
                
                window.onload = function() {
                    printTriggered = true;
                    window.print();
                }
                
                window.onafterprint = function() {
                    // Close window after 200ms delay (whether printed or cancelled)
                    setTimeout(() => {
                        window.close();
                    }, 200);
                }
                
                window.onbeforeunload = function() {
                    // Also close if user navigates away or closes manually
                    if (printTriggered) {
                        window.close();
                    }
                }
            </script>
        </body>
        </html>
    `);
    orderWindow.document.close();
    
    // After showing the order, proceed with the adjustment
    setTimeout(() => {
        acceptEspeceAdjustment();
    }, 1000);
}

// Make espèce functions globally accessible
window.closeEspeceWarningModal = closeEspeceWarningModal;
window.acceptEspeceAdjustment = acceptEspeceAdjustment;
window.acceptEspeceAndPrintRecu = acceptEspeceAndPrintRecu;
window.printRecuVersement = printRecuVersement;
window.printOrdreVersementForEspece = printOrdreVersementForEspece;
window.showOrdreVersementConfirmModal = showOrdreVersementConfirmModal;
window.confirmPrintOrdreVersement = confirmPrintOrdreVersement;
window.skipOrdreVersementPrint = skipOrdreVersementPrint;
window.printOrdreVersementForRemaining = printOrdreVersementForRemaining;
window.printOrdreVersementForRemaining = printOrdreVersementForRemaining;
window.showVersementOrderModal = showVersementOrderModal;
window.closeVersementOrderModal = closeVersementOrderModal;
window.printVersementOrderFromModal = printVersementOrderFromModal;
window.skipPrintVersementOrder = skipPrintVersementOrder;
window.completeFormSubmission = completeFormSubmission;

// Handle tranche input changes
function handleTrancheInput(inputElement) {
    // Calculate total and validate
    calculateTotalPaid();
    validateTrancheAmount(inputElement);
    
    // Check espèce limits and update dropdown options
    updateTrancheTypeOptions();
}

// Handle tranche type changes
function handleTrancheTypeChange(selectElement) {
    calculateTotalPaid();
    
    // Trigger validation when type changes
    const trancheRow = selectElement.closest('.tranche-row');
    const amountInput = trancheRow.querySelector('input[type="number"]');
    if (amountInput) {
        validateTrancheAmount(amountInput);
    }
    
    // Update all tranche type options based on current limits
    updateTrancheTypeOptions();
}

// Update tranche type dropdown options based on espèce limits
function updateTrancheTypeOptions() {
    const surface = parseFloat(document.getElementById('surface').value) || 0;
    const prixTotale = parseFloat(document.getElementById('prixTotale').value) || 0;
    const remise = parseFloat(document.getElementById('remise').value) || 0;
    const prixUnitaire = currentPrixUnitaire || 0;
    
    // Calculate the reduced total price after remise (discount)
    const reducedTotalPrice = prixTotale - remise;
    
    // Calculate max versement (unchanged)
    const maxVersement = prixUnitaire * surface;
    
    // Calculate max espèce from the reduced total price
    const maxEspece = reducedTotalPrice - maxVersement;
    
    // Calculate current total espèce amount
    let currentEspeceTotal = 0;
    const tranchesContainer = document.getElementById('tranchesContainer');
    
    Array.from(tranchesContainer.children).forEach(row => {
        const amountInput = row.querySelector('input[type="number"]');
        const typeSelect = row.querySelector('select');
        const value = parseFloat(amountInput.value) || 0;
        const type = typeSelect ? typeSelect.value : 'versement';
        
        if (type === 'espece' && value > 0) {
            currentEspeceTotal += value;
        }
    });
    
    // Calculate remaining espèce available
    const remainingEspece = maxEspece - currentEspeceTotal;
    
    // Debug output
    console.log(`🔍 ESPÈCE VALIDATION DEBUG:
    📊 Prix Totale: ${prixTotale.toLocaleString()} DA
    💸 Remise: ${remise.toLocaleString()} DA
    🏠 Reduced Total: ${reducedTotalPrice.toLocaleString()} DA
    🏦 Max Versement: ${maxVersement.toLocaleString()} DA
    💵 Max Espèce: ${maxEspece.toLocaleString()} DA
    💰 Current Espèce Total: ${currentEspeceTotal.toLocaleString()} DA
    ✅ Remaining Espèce: ${remainingEspece.toLocaleString()} DA
    🚫 Should Disable: ${remainingEspece <= 0}`);
    
    // Only disable espèce option if there's no remaining espèce available
    const especeLimitReached = remainingEspece <= 0;
    
    // Update all select dropdowns
    Array.from(tranchesContainer.children).forEach(row => {
        const typeSelect = row.querySelector('select');
        
        if (typeSelect) {
            const especeOption = typeSelect.querySelector('option[value="espece"]');
            
            // Only disable espèce option when there's no room left
            if (especeLimitReached) {
                especeOption.disabled = true;
            } else {
                especeOption.disabled = false;
            }
        }
    });
}

