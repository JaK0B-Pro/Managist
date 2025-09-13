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
document.addEventListener('DOMContentLoaded', function () {
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
        settingsModal.addEventListener('click', function (event) {
            if (event.target === settingsModal) {
                closeSettingsModal();
            }
        });
    }

    // Close modal with Escape key
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            const modal = document.getElementById('settingsModal');
            if (modal && modal.style.display === 'block') {
                closeSettingsModal();
            }
        }
    });

    // Function to print payment summary (moved here)
    async function printPaymentSummary(buyerId) {
        console.log('Attempting to print payment summary for buyer ID:', buyerId);
        // Further implementation will go here
    }

    // Event listener for the new print summary button
    const printSummaryButton = document.getElementById('printPaymentSummaryBtn');
    if (printSummaryButton) {
        printSummaryButton.addEventListener('click', async () => {
            const buyerModal = document.getElementById('buyerModal');
            const buyerId = buyerModal.getAttribute('data-buyer-id');
            if (buyerId) {
                await printPaymentSummary(parseInt(buyerId));
            } else {
                alert('No buyer selected for printing summary.');
            }
        });
    }
});

// Get project ID from URL parameters
function getProjectIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return parseInt(urlParams.get('projectId')) || 1; // Default to 1 if not specified
}

const PROJECT_ID = getProjectIdFromUrl();

// Function to get current project ID for document generation
function getCurrentProjectId() {
    return PROJECT_ID;
}

// Current selected bloc (null means "all blocs")
let currentBloc = 'all';

// Project bloc count for dynamic tabs
let projectBlocCount = 0;

// Prix unitaire for validation calculations
let currentPrixUnitaire = 0;

// Helper function to convert number to letter (1=A, 2=B, etc.)
function numberToLetter(num) {
    return String.fromCharCode(65 + num - 1); // 65 is ASCII for 'A'
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
    }; return colors[bloc] || '#7f8c8d'; // Default gray for unknown blocs
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

        // Calculate the reduced total price after remise (direct value)
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

// Function to check and disable espèce options when limit is reached
function updateEspeceOptionsAvailability() {
    const tranchesContainer = document.getElementById('tranchesContainer');
    const surface = parseFloat(document.getElementById('surface').value) || 0;
    const prixTotale = parseFloat(document.getElementById('prixTotale').value) || 0;
    const remise = parseFloat(document.getElementById('remise').value) || 0;
    const prixUnitaire = currentPrixUnitaire || 0;

    // Calculate the reduced total price after remise (direct value)
    const reducedTotalPrice = prixTotale - (remise || 0);

    // Calculate max versement (unchanged)  
    const maxVersement = prixUnitaire * surface;

    // Calculate max espèce from the reduced total price
    const maxEspece = reducedTotalPrice - maxVersement;

    // Calculate current espèce total
    let currentEspeceTotal = 0;
    Array.from(tranchesContainer.children).forEach(row => {
        if (row.classList.contains('payment-limits-display')) return;

        const amountInput = row.querySelector('input[name^="tranche_"]');
        const typeSelect = row.querySelector('select[name*="type"]');

        if (amountInput && typeSelect) {
            const value = parseFloat(amountInput.value) || 0;
            const type = typeSelect.value;

            if (type === 'espece' && value > 0) {
                currentEspeceTotal += value;
            }
        }
    });

    const isEspeceLimitReached = currentEspeceTotal >= maxEspece;

    // Update all type dropdowns
    Array.from(tranchesContainer.children).forEach(row => {
        if (row.classList.contains('payment-limits-display')) return;

        const typeSelect = row.querySelector('select[name*="type"]');
        if (typeSelect) {
            const especeOption = typeSelect.querySelector('option[value="espece"]');
            if (especeOption) {
                if (isEspeceLimitReached && typeSelect.value !== 'espece') {
                    // Disable espèce option for non-espèce tranches
                    especeOption.disabled = true;
                    especeOption.title = `Limite espèce atteinte: ${maxEspece.toLocaleString()} DA`;
                } else {
                    // Enable espèce option
                    especeOption.disabled = false;
                    especeOption.title = '';
                }
            }
        }
    });

    console.log(`💰 Espèce availability check: ${currentEspeceTotal.toLocaleString()}/${maxEspece.toLocaleString()} DA, limit reached: ${isEspeceLimitReached}`);
}

// Function to check versement overflow and split if needed
function checkVersementOverflow(amountInput, requestedAmount) {
    const surface = parseFloat(document.getElementById('surface').value) || 0;
    const prixUnitaire = currentPrixUnitaire || 0;
    const maxVersement = prixUnitaire * surface;

    const tranchesContainer = document.getElementById('tranchesContainer');
    let currentVersementTotal = 0;

    // Calculate current versement total (excluding the input being changed)
    Array.from(tranchesContainer.children).forEach(row => {
        if (row.classList.contains('payment-limits-display')) return;

        const input = row.querySelector('input[name^="tranche_"]');
        const typeSelect = row.querySelector('select[name*="type"]');

        if (input && typeSelect && input !== amountInput) {
            const value = parseFloat(input.value) || 0;
            const type = typeSelect.value;

            if (type === 'versement' && value > 0) {
                currentVersementTotal += value;
            }
        }
    });

    // Get the type of the current tranche
    const currentTrancheRow = amountInput.closest('.tranche-row');
    const currentTypeSelect = currentTrancheRow.querySelector('select[name*="type"]');

    if (currentTypeSelect && currentTypeSelect.value === 'versement') {
        const newTotal = currentVersementTotal + requestedAmount;

        if (newTotal > maxVersement) {
            const allowedForThisTranche = maxVersement - currentVersementTotal;

            if (allowedForThisTranche > 0) {
                console.log(`⚠️ Versement overflow: Limiting to ${allowedForThisTranche.toLocaleString()} DA (max: ${maxVersement.toLocaleString()}, current: ${currentVersementTotal.toLocaleString()})`);
                amountInput.value = allowedForThisTranche;
                return allowedForThisTranche;
            } else {
                console.log(`❌ Versement limit reached: ${maxVersement.toLocaleString()} DA`);
                amountInput.value = 0;
                return 0;
            }
        }
    }

    return requestedAmount;
}

// Tranche management functions
function addTranche() {
    const tranchesContainer = document.getElementById('tranchesContainer');
    const trancheCount = tranchesContainer.children.length;

    if (trancheCount >= 30) {
        alert('Maximum 30 tranches allowed');
        return;
    }

    // Get basic values
    const surface = parseFloat(document.getElementById('surface').value) || 0;
    const prixTotale = parseFloat(document.getElementById('prixTotale').value) || 0;
    const remise = parseFloat(document.getElementById('remise').value) || 0;
    const prixUnitaire = currentPrixUnitaire || 0;

    // Calculate the reduced total price after remise (direct value)
    const reducedTotalPrice = prixTotale - (remise || 0);

    // Check if this is a unit purchase (no profit margin)
    const isUnitPurchase = prixTotale === (surface * prixUnitaire);

    let maxVersement, maxEspece, currentEspeceTotal = 0;
    let isEspeceLimitReached = false;
    let remainingEspece = 0;
    let especeTrancheDetails = [];
    let allTrancheDetails = [];

    if (isUnitPurchase) {
        // Unit purchase - no espèce/versement restrictions
        console.log('🏠 UNIT PURCHASE DETECTED - No espèce/versement limits applied');
        maxVersement = 0; // Not applicable
        maxEspece = prixTotale; // Can pay all in espèce if desired
        isEspeceLimitReached = false; // Never reached for unit purchases
        remainingEspece = prixTotale; // All amount available
    } else {
        // Regular purchase with profit margin - apply normal limits
        maxVersement = prixUnitaire * surface;
        maxEspece = reducedTotalPrice - maxVersement;

        console.log(`🔍 Analyzing ${tranchesContainer.children.length} existing tranches:`);

        Array.from(tranchesContainer.children).forEach((row, index) => {
            const amountInput = row.querySelector('input[name^="tranche_"]');
            const typeSelect = row.querySelector('select[name^="tranche_"][name$="_type"]');

            let trancheInfo = `T${index}: `;

            if (amountInput && typeSelect) {
                const value = parseFloat(amountInput.value) || 0;
                const type = typeSelect.value;

                trancheInfo += `${value.toLocaleString()} DA (${type})`;
                allTrancheDetails.push(trancheInfo);

                if (type === 'espece' && value > 0) {
                    currentEspeceTotal += value;
                    especeTrancheDetails.push(`T${index}: ${value.toLocaleString()} DA`);
                    console.log(`   ✅ T${index} = ${value.toLocaleString()} DA (espèce) ← COUNTED`);
                } else {
                    console.log(`   ⏭️ T${index} = ${value.toLocaleString()} DA (${type}) ← SKIPPED`);
                }
            } else {
                trancheInfo += 'ERROR - missing input or select';
                allTrancheDetails.push(trancheInfo);
                console.log(`   ❌ T${index} - Missing elements: input=${!!amountInput}, select=${!!typeSelect}`);
            }
        });

        isEspeceLimitReached = currentEspeceTotal >= maxEspece;
        remainingEspece = maxEspece - currentEspeceTotal;
    }

    // Determine default type for new tranche and check if espèce should be disabled
    const defaultType = isEspeceLimitReached ? 'versement' : 'espece';
    const defaultSelected = defaultType === 'espece' ? 'selected' : '';
    const versementSelected = defaultType === 'versement' ? 'selected' : '';
    const especeDisabled = isEspeceLimitReached ? 'disabled' : '';
    const especeTitle = isEspeceLimitReached ? `title="Limite espèce atteinte: ${maxEspece.toLocaleString()} DA"` : '';

    // Enhanced debugging
    if (isUnitPurchase) {
        console.log(`🏠 UNIT PURCHASE - No Limits Applied:
        � Project Details:
           - Prix Totale: ${prixTotale.toLocaleString()} DA
           - Surface: ${surface.toLocaleString()} m²
           - Prix Unitaire: ${prixUnitaire.toLocaleString()} DA/m²
           - Unit Purchase: ${prixTotale.toLocaleString()} == ${(surface * prixUnitaire).toLocaleString()} ✅
        🆓 No espèce/versement restrictions - buyer can pay any way they want
        🚫 New tranche will be: ${defaultType.toUpperCase()} (default)`);
    } else {
        console.log(`�🔍 ESPÈCE LIMIT CHECK FOR NEW TRANCHE:
        📊 Project Details:
           - Prix Totale: ${prixTotale.toLocaleString()} DA
           - Remise: ${remise.toLocaleString()} DA  
           - Surface: ${surface.toLocaleString()} m²
           - Prix Unitaire: ${prixUnitaire.toLocaleString()} DA/m²
        💰 Espèce Calculation:
           - Max Versement: ${maxVersement.toLocaleString()} DA
           - Max Espèce (Total): ${maxEspece.toLocaleString()} DA
           - Current Espèce Used: ${currentEspeceTotal.toLocaleString()} DA
           - Remaining Espèce: ${remainingEspece.toLocaleString()} DA
        📋 All Tranches: ${allTrancheDetails.join(', ') || 'None'}
        📋 Current Espèce Tranches: ${especeTrancheDetails.length > 0 ? especeTrancheDetails.join(', ') : 'None'}
        🚫 Limit Reached: ${isEspeceLimitReached} → New tranche will be: ${defaultType.toUpperCase()}`);
    }

    // Show notification if espèce was auto-switched to versement
    if (isEspeceLimitReached) {
        console.log('🔄 Auto-switched new tranche to versement due to espèce limit');
        // Optional: show a brief toast notification to user
        setTimeout(() => {
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #ff9800;
                color: white;
                padding: 12px 20px;
                border-radius: 6px;
                z-index: 10000;
                font-size: 14px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            `;
            notification.textContent = `Limite espèce atteinte (${maxEspece.toLocaleString()} DA) - nouvelle tranche en versement`;
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), 4000);
        }, 100);
    }

    const trancheRow = document.createElement('div');
    trancheRow.className = 'tranche-row';
    trancheRow.innerHTML = `
        <label>T${trancheCount}:</label>
        <div class="tranche-amount-container">
            <input type="number" step="0.01" min="0" name="tranche_${trancheCount}" 
                   placeholder="Enter amount for T${trancheCount}" oninput="handleTrancheInput(this)">
            <div class="check-number-and-print-container" style="display: ${defaultType === 'versement' ? 'flex' : 'none'};">
                <label for="check_${trancheCount}" class="check-label">Chèq N°:</label>
                <input type="text" name="check_${trancheCount}" id="check_${trancheCount}" 
                       placeholder="N° Chèque" class="check-input" title="Numéro de chèque">
                <button type="button" class="btn-print-cheque" onclick="printRecuCheque(${trancheCount})" title="Print Reçu de Chèque">
                    <i class="fas fa-print"></i>
                </button>
            </div>
        </div>
        <input type="date" name="tranche_date_${trancheCount}" title="Payment date for T${trancheCount}" onchange="triggerDebouncedValidation()">
        <select name="tranche_type_${trancheCount}" title="Payment type for T${trancheCount}" onchange="handleTrancheTypeChange(this)">
            <option value="espece" ${defaultSelected} ${especeDisabled} ${especeTitle}>Espèce</option>
            <option value="versement" ${versementSelected}>Versement</option>
        </select>
        <button type="button" class="btn-print-tranche" onclick="printOrdreVersement(${trancheCount})" title="Print Ordre de Versement">
            <i class="fas fa-print"></i>
        </button>
        <button type="button" class="btn-print-tranche btn-print-bordereau" onclick="printBordereauEnvoi(${trancheCount})" title="Print Bordereau d'Envoi" style="background:#6f42c1;color:#fff;margin-left:4px;display:${defaultType === 'versement' ? 'inline-block' : 'none'};">
            <i class="fas fa-file-export"></i>
        </button>
        <button type="button" class="btn-remove-tranche" onclick="removeTranche(this)">×</button>
    `;

    tranchesContainer.appendChild(trancheRow);
    updateAddTrancheButtonVisibility();

    // Update all tranche type options after adding new tranche
    updateTrancheTypeOptions();

    // Return the newly created tranche row so callers (like split logic) can configure it
    return trancheRow;
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
        const amountInput = row.querySelector('input[name^="tranche_"]');
        const dateInput = row.querySelector('input[type="date"]');
        const typeSelect = row.querySelector('select[name^="tranche_"][name$="_type"]');

        if (label) label.textContent = `T${index}:`;
        if (amountInput) {
            amountInput.name = `tranche_${index}`;
            amountInput.placeholder = `Enter amount for T${index}`;
        }
        if (dateInput) {
            dateInput.name = `tranche_date_${index}`;
            dateInput.title = `Payment date for T${index}`;
        }
        if (typeSelect) {
            typeSelect.name = `tranche_type_${index}`;
            typeSelect.title = `Payment type for T${index}`;
        }
    });
}

function updateAddTrancheButtonVisibility() {
    const tranchesContainer = document.getElementById('tranchesContainer');
    const addButton = document.getElementById('addTrancheBtn');
    addButton.style.display = tranchesContainer.children.length >= 30 ? 'none' : 'inline-block';
}

function calculateTotalPaid() {
    // Calculate total paid from tranches
    const tranchesContainer = document.getElementById('tranchesContainer');
    if (!tranchesContainer) return;

    let totalPaid = 0;

    Array.from(tranchesContainer.children).forEach(row => {
        const input = row.querySelector('input[name^="tranche_"]');
        if (input) {
            totalPaid += parseFloat(input.value) || 0;
        }
    });

    // Update total paid display
    const totalPaidEl = document.getElementById('totalPaidDisplay');
    if (totalPaidEl) {
        totalPaidEl.textContent = `${totalPaid.toLocaleString()} DA`;
    }

    // Update espèce options availability
    updateEspeceOptionsAvailability();

    // Also update tranche type options to ensure consistency
    updateTrancheTypeOptions();
}

function validateTrancheAmount(input) {
    // Add a small delay to allow for rapid typing
    clearTimeout(window.validationTimeout);
    window.validationTimeout = setTimeout(() => {
        validateEspeceAmount(input);
    }, 500);
}

// Missing function that's called from HTML
function triggerDebouncedValidation() {
    clearTimeout(window.validationTimeout);
    window.validationTimeout = setTimeout(async () => {
        // Ensure prix unitaire is available for validations
        if (!currentPrixUnitaire || currentPrixUnitaire <= 0) {
            try { await loadPrixUnitaire(); } catch (e) { /* ignore */ }
        }
        validateFormLimits();
        updateTrancheTypeOptions();

        // Check for espece limit violations and show modal if needed
        checkEspeceValidationOnSubmit();
    }, 300);
}

// Async form validation function for form submission
async function performFormValidation() {
    console.log('⚠️ OLD VALIDATION FUNCTION DISABLED - Using checkEspeceViolationSync instead');
    // This function is disabled - espèce validation is now handled by checkEspeceViolationSync()
    return { passed: true };
}
// SYNCHRONOUS ESPECE VALIDATION - BLOCKS FORM AND SHOWS MODAL
function checkEspeceViolationSync() {
    console.log('�🚨🚨 CHECKESPECE FUNCTION STARTED 🚨🚨🚨');
    console.log('�🔍 CHECKING ESPECE VIOLATIONS SYNCHRONOUSLY...');

    const surface = parseFloat(document.getElementById('surface')?.value || 0);
    const prixTotale = parseFloat(document.getElementById('prixTotale')?.value || 0);
    const remise = parseFloat(document.getElementById('remise')?.value || 0);
    const prixUnitaire = currentPrixUnitaire || 0;

    console.log('📊 VALUES:', { surface, prixTotale, remise, prixUnitaire });

    if (surface <= 0 || prixTotale <= 0 || prixUnitaire <= 0) {
        console.log('⚠️ SKIPPING - Missing required values');
        return false;
    }

    const reducedTotalPrice = prixTotale - (remise || 0);
    const maxVersement = prixUnitaire * surface;
    const maxEspece = reducedTotalPrice - maxVersement;

    // ===== DETAILED BUYER DEBUG (like before) =====
    const buyerName = `${document.getElementById('nom')?.value || ''} ${document.getElementById('prenom')?.value || ''}`.trim();
    const buyerId = document.getElementById('addBuyerForm')?.getAttribute('data-buyer-id') || 'NEW';

    console.log(`BUYER DEBUG [ID: ${buyerId}] - ${buyerName}:`);
    console.log(`📐 Surface: ${surface}m² (raw: "${document.getElementById('surface')?.value || ''}")`);
    console.log(`💰 Prix Unitaire: ${prixUnitaire.toLocaleString()} DA/m² (source: local)`);
    console.log(`💵 Prix Totale: ${prixTotale.toLocaleString()} DA (raw: "${document.getElementById('prixTotale')?.value || ''}")`);
    console.log(`🧮 Calculation: ${prixUnitaire.toLocaleString()} × ${surface} = ${maxVersement.toLocaleString()}`);
    console.log(`📊 LIMITS:`);
    console.log(`    🏦 Max Versement: ${maxVersement.toLocaleString()} DA (prix unitaire × surface)`);
    console.log(`    💸 Max Espèce: ${maxEspece.toLocaleString()} DA (prix totale - max versement)`);

    // Calculate actual amounts from tranches
    let actualVersement = 0;
    let actualEspece = 0;
    const tranchesContainer = document.getElementById('tranchesContainer');
    const trancheDetails = [];

    if (tranchesContainer && tranchesContainer.children.length > 0) {
        console.log(`📋 Found ${tranchesContainer.children.length} tranche rows`);
        Array.from(tranchesContainer.children).forEach((row, index) => {
            console.log(`🔍 Row ${index}:`, row.outerHTML.substring(0, 200) + '...');

            if (row.classList.contains('payment-limits-display')) {
                console.log(`⏭️ Skipping payment-limits-display row ${index}`);
                return;
            }

            const amountInput = row.querySelector('input[name^="tranche_"]');
            const typeSelect = row.querySelector('select[name*="type"]'); // FIXED SELECTOR

            console.log(`Row ${index} - Amount input:`, amountInput ? amountInput.name + '=' + amountInput.value : 'NOT FOUND');
            console.log(`Row ${index} - Type select:`, typeSelect ? typeSelect.name + '=' + typeSelect.value : 'NOT FOUND');

            if (amountInput && typeSelect) {
                const amount = parseFloat(amountInput.value) || 0;
                const type = typeSelect.value;

                console.log(`Row ${index} - Parsed: amount=${amount}, type=${type}`);

                if (amount > 0) {
                    trancheDetails.push(`${type}: ${amount.toLocaleString()} DA`);

                    if (type === 'versement') {
                        actualVersement += amount;
                    } else if (type === 'espece') {
                        actualEspece += amount;
                    }
                    console.log(`Row ${index} - Added to totals: versement=${actualVersement}, espece=${actualEspece}`);
                }
            } else {
                console.log(`Row ${index} - MISSING INPUTS!`);
            }
        });
    } else {
        console.log('❌ No tranches container found or no children');
    }

    console.log(`💳 ACTUAL AMOUNTS:`);
    console.log(`    🏦 Actual Versement: ${actualVersement.toLocaleString()} DA`);
    console.log(`    💸 Actual Espèce: ${actualEspece.toLocaleString()} DA`);
    console.log(`� TRANCHES: ${trancheDetails.length > 0 ? trancheDetails.join(', ') : 'No tranches'}`);

    // Check violations
    const versementViolation = actualVersement > maxVersement;
    const especeViolation = actualEspece > maxEspece;

    if (versementViolation) {
        console.log(`❌ Versement VIOLATION: ${actualVersement.toLocaleString()} > ${maxVersement.toLocaleString()}`);
    } else {
        console.log(`✅ Versement OK: ${actualVersement.toLocaleString()} ≤ ${maxVersement.toLocaleString()}`);
    }

    if (especeViolation) {
        console.log(`❌ Espèce VIOLATION: ${actualEspece.toLocaleString()} > ${maxEspece.toLocaleString()}`);
    } else {
        console.log(`✅ Espèce OK: ${actualEspece.toLocaleString()} ≤ ${maxEspece.toLocaleString()}`);
    }

    // Handle espèce violation
    if (especeViolation) {
        console.log('🚨🚨🚨 ESPECE LIMIT EXCEEDED! 🚨🚨🚨');

        // Identify the first tranche that pushes total espèce over the limit
        const trancheRows = Array.from(tranchesContainer.children).filter(r => !r.classList.contains('payment-limits-display'));
        let currentEspeceRunningTotal = 0;
        for (let i = 0; i < trancheRows.length; i++) {
            const row = trancheRows[i];
            const amountInput = row.querySelector('input[name^="tranche_"]');
            const typeSelect = row.querySelector('select[name*="type"]'); // FIXED
            if (!amountInput || !typeSelect || typeSelect.value !== 'espece') continue;

            const enteredAmount = parseFloat(amountInput.value) || 0;
            if (enteredAmount <= 0) continue;

            const totalWithThis = currentEspeceRunningTotal + enteredAmount;
            if (totalWithThis > maxEspece) {
                const availableForThisTranche = Math.max(0, maxEspece - currentEspeceRunningTotal);
                const remainingAmount = Math.max(0, enteredAmount - availableForThisTranche);

                console.log(`💰 Available for this tranche: ${availableForThisTranche.toLocaleString()} DA, Entered: ${enteredAmount.toLocaleString()} DA`);
                console.log(`🔄 Will split: ${enteredAmount.toLocaleString()} = ${availableForThisTranche.toLocaleString()} (espèce) + ${remainingAmount.toLocaleString()} (versement)`);

                // Set up pending data and show modal
                const formEl = document.getElementById('addBuyerForm');
                const submitBtnEl = document.getElementById('addBuyerBtn');
                pendingEspeceData = {
                    trancheInput: amountInput,
                    enteredAmount: enteredAmount,
                    acceptedEspece: availableForThisTranche,
                    remainingVersement: remainingAmount,
                    formData: new FormData(formEl),
                    isEdit: !!formEl.getAttribute('data-buyer-id'),
                    buyerId: formEl.getAttribute('data-buyer-id'),
                    submitBtn: submitBtnEl,
                    originalText: submitBtnEl ? submitBtnEl.textContent : ''
                };

                console.log('📋 PENDING DATA SET:', pendingEspeceData);
                console.log('🎯 SHOWING MODAL TO BLOCK FORM SUBMISSION...');
                showEspeceWarningModal();
                console.log('✅ MODAL DISPLAYED - FORM SUBMISSION BLOCKED');
                return true; // VIOLATION FOUND - FORM BLOCKED
            }
            currentEspeceRunningTotal += enteredAmount;
        }
    }

    console.log('✅ NO ESPECE VIOLATIONS FOUND - FORM CAN PROCEED');
    return false; // NO VIOLATIONS - FORM CAN PROCEED
}

function checkEspeceValidationOnSubmit() {
    const surface = parseFloat(document.getElementById('surface')?.value || 0);
    const prixTotale = parseFloat(document.getElementById('prixTotale')?.value || 0);
    const remise = parseFloat(document.getElementById('remise')?.value || 0);
    const prixUnitaire = currentPrixUnitaire || 0;

    if (surface <= 0 || prixTotale <= 0 || prixUnitaire <= 0) return;

    const reducedTotalPrice = prixTotale - (remise || 0);
    const maxVersement = prixUnitaire * surface;
    const maxEspece = reducedTotalPrice - maxVersement;

    // Check all tranches for espece violations
    const tranchesContainer = document.getElementById('tranchesContainer');
    if (!tranchesContainer) return;

    Array.from(tranchesContainer.children).forEach(row => {
        if (row.classList.contains('payment-limits-display')) return;

        const amountInput = row.querySelector('input[name^="tranche_"]');
        const typeSelect = row.querySelector('select[name*="type"]'); // FIXED

        if (amountInput && typeSelect && typeSelect.value === 'espece') {
            const enteredAmount = parseFloat(amountInput.value) || 0;

            if (enteredAmount > 0) {
                // Calculate current espece total excluding this tranche
                let currentEspeceTotal = 0;
                Array.from(tranchesContainer.children).forEach(otherRow => {
                    if (otherRow === row || otherRow.classList.contains('payment-limits-display')) return;

                    const otherAmountInput = otherRow.querySelector('input[name^="tranche_"]');
                    const otherTypeSelect = otherRow.querySelector('select[name*="type"]'); // FIXED

                    if (otherAmountInput && otherTypeSelect && otherTypeSelect.value === 'espece') {
                        currentEspeceTotal += parseFloat(otherAmountInput.value) || 0;
                    }
                });

                // Check if this tranche would exceed the limit
                const totalWithThis = currentEspeceTotal + enteredAmount;
                if (totalWithThis > maxEspece) {
                    const availableEspece = Math.max(0, maxEspece - currentEspeceTotal);
                    if (availableEspece > 0) {
                        console.log(`🚨 Espece limit exceeded! Showing adjustment modal...`);
                        // Populate pending data so the modal can render meaningful values
                        pendingEspeceData = {
                            trancheInput: amountInput,
                            enteredAmount: enteredAmount,
                            acceptedEspece: availableEspece,
                            remainingVersement: Math.max(0, enteredAmount - availableEspece)
                        };
                        showEspeceWarningModal();
                        return; // Exit early since modal will handle the rest
                    } else {
                        console.log(`🚫 No espece capacity remaining`);
                        amountInput.value = '';
                        alert(`No more espèce capacity available. Max espèce: ${maxEspece.toLocaleString()} DA`);
                    }
                }
            }
        }
    });
}

// Function to validate form payment limits
function validateFormLimits() {
    const surface = parseFloat(document.getElementById('surface')?.value || 0);
    const prixTotale = parseFloat(document.getElementById('prixTotale')?.value || 0);
    const remise = parseFloat(document.getElementById('remise')?.value || 0);
    const prixUnitaire = currentPrixUnitaire || 0;

    console.log('🔍 VALIDATION CHECK:', { surface, prixTotale, remise, prixUnitaire });

    if (surface > 0 && prixTotale > 0 && prixUnitaire > 0) {
        const reducedTotalPrice = prixTotale - (remise || 0);
        const maxVersement = prixUnitaire * surface;
        const maxEspece = reducedTotalPrice - maxVersement;

        console.log('💰 PAYMENT LIMITS:', { reducedTotalPrice, maxVersement, maxEspece });

        // Calculate current totals
        let currentEspeceTotal = 0;
        let currentVersementTotal = 0;

        const tranchesContainer = document.getElementById('tranchesContainer');
        if (tranchesContainer) {
            Array.from(tranchesContainer.children).forEach(row => {
                if (row.classList.contains('payment-limits-display')) return;

                const amountInput = row.querySelector('input[name^="tranche_"]');
                const typeSelect = row.querySelector('select[name*="type"]'); // FIXED

                if (amountInput && typeSelect) {
                    const value = parseFloat(amountInput.value) || 0;
                    const type = typeSelect.value;

                    if (value > 0) {
                        if (type === 'espece') {
                            currentEspeceTotal += value;
                        } else if (type === 'versement') {
                            currentVersementTotal += value;
                        }
                    }
                }
            });
        }

        console.log('📊 CURRENT TOTALS:', { currentEspeceTotal, currentVersementTotal });

        // Initialize warnings array
        let warnings = [];

        // Show validation feedback
        const feedbackContainer = document.getElementById('validationFeedback');
        if (feedbackContainer) {

            if (currentEspeceTotal > maxEspece) {
                // Removed warning message - handled by modal system instead
                // warnings.push(`⚠️ Espèce total (${currentEspeceTotal.toLocaleString()} DA) exceeds limit (${maxEspece.toLocaleString()} DA)`);
                // Try to identify the tranche that pushed the total over the limit and trigger modal
                try {
                    const tranchesContainer = document.getElementById('tranchesContainer');
                    if (tranchesContainer) {
                        let runningEspece = 0;
                        const rows = Array.from(tranchesContainer.children).filter(r => !r.classList.contains('payment-limits-display'));
                        for (const row of rows) {
                            const amountInput = row.querySelector('input[name^="tranche_"]');
                            const typeSelect = row.querySelector('select[name*="type"]'); // FIXED
                            if (!amountInput || !typeSelect || typeSelect.value !== 'espece') continue;
                            const val = parseFloat(amountInput.value) || 0;
                            if (val <= 0) continue;
                            const totalWithThis = runningEspece + val;
                            if (totalWithThis > maxEspece) {
                                const availableForThis = Math.max(0, maxEspece - runningEspece);
                                pendingEspeceData = {
                                    trancheInput: amountInput,
                                    enteredAmount: val,
                                    acceptedEspece: availableForThis,
                                    remainingVersement: Math.max(0, val - availableForThis)
                                };
                                showEspeceWarningModal();
                                break;
                            }
                            runningEspece = totalWithThis;
                        }
                    }
                } catch (e) {
                    console.warn('Could not trigger modal from validation feedback flow:', e);
                }
            }

            if (currentVersementTotal > maxVersement) {
                warnings.push(`⚠️ Versement total (${currentVersementTotal.toLocaleString()} DA) exceeds limit (${maxVersement.toLocaleString()} DA)`);
            }

            if (warnings.length > 0) {
                feedbackContainer.innerHTML = warnings.map(w => `<div class="validation-warning">${w}</div>`).join('');
                feedbackContainer.style.display = 'block';
                console.log('❌ VALIDATION WARNINGS:', warnings);
            } else {
                feedbackContainer.style.display = 'none';
                console.log('✅ VALIDATION PASSED: No limit violations');
            }
        } else {
            console.log('❌ VALIDATION CONTAINER NOT FOUND');

            // Still check for warnings even if container not found
            if (currentEspeceTotal > maxEspece) {
                // Removed warning message - handled by modal system instead
                // warnings.push(`⚠️ Espèce total (${currentEspeceTotal.toLocaleString()} DA) exceeds limit (${maxEspece.toLocaleString()} DA)`);
            }

            if (currentVersementTotal > maxVersement) {
                warnings.push(`⚠️ Versement total (${currentVersementTotal.toLocaleString()} DA) exceeds limit (${maxVersement.toLocaleString()} DA)`);
            }
        }

        // Update payment limits display
        updatePaymentLimitsDisplay();

        return {
            isValid: warnings.length === 0,
            warnings: warnings,
            limits: { maxEspece, maxVersement },
            current: { currentEspeceTotal, currentVersementTotal }
        };
    } else {
        console.log('⚠️ VALIDATION SKIPPED: Missing required values');
        return { isValid: false, warnings: ['Missing required calculation values'], limits: {}, current: {} };
    }
}

// Test validation system
function testValidationSystem() {
    console.log('🧪 TESTING VALIDATION SYSTEM...');

    // Test 1: Check if validation elements exist
    const elements = {
        surface: document.getElementById('surface'),
        prixTotale: document.getElementById('prixTotale'),
        remise: document.getElementById('remise'),
        tranchesContainer: document.getElementById('tranchesContainer'),
        validationFeedback: document.getElementById('validationFeedback'),
        paymentLimits: document.getElementById('paymentLimits')
    };

    console.log('📋 VALIDATION ELEMENTS CHECK:');
    Object.entries(elements).forEach(([name, element]) => {
        console.log(`  ${name}: ${element ? '✅ Found' : '❌ Missing'}`);
    });

    // Test 2: Check global functions
    const functions = [
        'triggerDebouncedValidation',
        'validateFormLimits',
        'updatePaymentLimitsDisplay',
        'handleTrancheInput',
        'handleTrancheTypeChange'
    ];

    console.log('🔧 VALIDATION FUNCTIONS CHECK:');
    functions.forEach(funcName => {
        const exists = typeof window[funcName] === 'function';
        console.log(`  ${funcName}: ${exists ? '✅ Available' : '❌ Missing'}`);
    });

    // Test 3: Trigger validation
    console.log('⚡ TRIGGERING VALIDATION TEST...');
    if (typeof window.triggerDebouncedValidation === 'function') {
        window.triggerDebouncedValidation();
        console.log('✅ Validation triggered successfully');
    } else {
        console.log('❌ Cannot trigger validation - function missing');
    }

    console.log('🧪 VALIDATION SYSTEM TEST COMPLETE');
}

// Make validateTrancheAmount globally accessible
window.validateTrancheAmount = validateTrancheAmount;
window.triggerDebouncedValidation = triggerDebouncedValidation;
window.validateFormLimits = validateFormLimits;
window.testValidationSystem = testValidationSystem;
window.calculateTotalPaid = calculateTotalPaid;
window.handleTrancheInput = handleTrancheInput;
window.handleTrancheTypeChange = handleTrancheTypeChange;
window.updateTrancheTypeOptions = updateTrancheTypeOptions;
window.updateEspeceOptionsAvailability = updateEspeceOptionsAvailability;
window.checkVersementOverflow = checkVersementOverflow;

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

    // Function to add total calculation row
    function addTotalCalculationRow(buyers) {
        // Remove existing total row if it exists
        const existingTotalRow = tbody.querySelector('.total-calculation-row');
        if (existingTotalRow) {
            existingTotalRow.remove();
        }

        // Handle empty buyers array (show zeros)
        if (!buyers) {
            buyers = [];
        }

        // Calculate totals
        let totalPaidAmount = 0;
        let totalPrixTotale = 0;
        let totalRemise = 0;
        const trancheTotals = {};

        buyers.forEach(buyer => {
            // Add to total paid
            totalPaidAmount += parseFloat(buyer.total_paid || 0);
            totalPrixTotale += parseFloat(buyer.prix_totale || 0);
            totalRemise += parseFloat(buyer.remise || 0);

            // Calculate tranche totals
            let payments = {};
            try {
                payments = typeof buyer.payments === 'string' ? JSON.parse(buyer.payments) : buyer.payments || {};
            } catch (e) {
                payments = {};
            }

            Object.keys(payments).forEach(trancheKey => {
                const trancheData = payments[trancheKey];
                let amount = 0;

                if (typeof trancheData === 'object' && trancheData !== null) {
                    amount = parseFloat(trancheData.amount) || 0;
                } else {
                    amount = parseFloat(trancheData) || 0;
                }

                if (!trancheTotals[trancheKey]) {
                    trancheTotals[trancheKey] = 0;
                }
                trancheTotals[trancheKey] += amount;
            });
        });

        // Create total row
        const totalRow = document.createElement('tr');
        totalRow.className = 'total-calculation-row';
        totalRow.style.backgroundColor = '#f8f9fa';
        totalRow.style.fontWeight = 'bold';
        totalRow.style.borderTop = '2px solid #dee2e6';

        // Build row HTML - match the exact table structure
        // Base headers: NIVEAU, N° LOGT, NOM, PRENOM, TYPE LOGT, SURFACE, DATE, PRIX TOTALE, REMISE
        let totalRowHTML = `
            <td style="text-align: center; font-weight: bold; color: #495057;">TOTAL</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td style="text-align: right; color: #28a745;">${formatCurrency(totalPrixTotale)}</td>
            <td style="text-align: right; color: #dc3545;">${formatCurrency(totalRemise)}</td>
        `;

        // Add tranche totals
        for (let i = 0; i <= maxTranches; i++) {
            const trancheTotal = trancheTotals[`T${i}`] || 0;
            totalRowHTML += `<td style="text-align: right; color: #007bff;">${formatCurrency(trancheTotal)}</td>`;
        }

        // Add total paid and status columns
        totalRowHTML += `
            <td style="text-align: right; font-weight: bold; color: #28a745; font-size: 1.1em;">${formatCurrency(totalPaidAmount)}</td>
            <td style="text-align: center; color: #6c757d;">${buyers.length} buyer${buyers.length !== 1 ? 's' : ''}</td>
        `;

        totalRow.innerHTML = totalRowHTML;
        tbody.appendChild(totalRow);
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
            
            // Store buyers globally for search functionality
            window.allBuyers = buyers;

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
                    const sortedNiveaux = Object.keys(buyersByNiveau).sort((a, b) => {
                        const numA = parseInt(a === 'Unknown' ? '9999' : a);
                        const numB = parseInt(b === 'Unknown' ? '9999' : b);
                        return numA - numB;
                    });
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

                        // Sort buyers within niveau by apartment number (N° LOGT)
                        buyersInNiveau.sort((a, b) => {
                            const aptA = parseInt(a.logt_num || '0');
                            const aptB = parseInt(b.logt_num || '0');
                            return aptA - aptB;
                        });

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

                // Sort NIVEAU keys for consistent ordering (numeric)
                const sortedNiveaux = Object.keys(buyersByNiveau).sort((a, b) => {
                    const numA = parseInt(a === 'Unknown' ? '9999' : a);
                    const numB = parseInt(b === 'Unknown' ? '9999' : b);
                    return numA - numB;
                });
                const blocColor = getBlocColor(currentBloc);

                // Render grouped buyers for single bloc
                sortedNiveaux.forEach(niveau => {
                    const buyersInNiveau = buyersByNiveau[niveau];

                    // Sort buyers within niveau by apartment number (N° LOGT)
                    buyersInNiveau.sort((a, b) => {
                        const aptA = parseInt(a.logt_num || '0');
                        const aptB = parseInt(b.logt_num || '0');
                        return aptA - aptB;
                    });

                    buyersInNiveau.forEach((buyer, index) => {
                        const newRow = document.createElement('tr');
                        newRow.className = 'buyer-row';
                        newRow.setAttribute('data-buyer-id', buyer.id);
                        newRow.style.borderLeft = `4px solid ${blocColor}`;

                        renderBuyerRow(newRow, buyer, buyersInNiveau, index, niveau);
                        tbody.appendChild(newRow);
                    });
                });
            }
            updateBuyerCount(buyers.length);

            // Add total calculation row
            addTotalCalculationRow(filteredBuyers);

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

                    // Calculate the reduced total price after remise (direct value)
                    const reducedTotalPrice = prixTotale - (remise || 0);

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

        // Calculate the reduced total price after remise (direct value)
        const reducedTotalPrice = prixTotale - (remise || 0);

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
            // Disable old error logging - new modal system handles this during form submission
            console.log(`   🏦 Versement total: ${actualVersement.toLocaleString()} > ${maxVersement.toLocaleString()} (over by ${(actualVersement - maxVersement).toLocaleString()} DA) - Will be handled by form validation`);
        } else {
            console.log(`   ✅ Versement OK: ${actualVersement.toLocaleString()} ≤ ${maxVersement.toLocaleString()}`);
        }

        if (especeExceeded) {
            // Disable old error logging - new modal system handles this during form submission
            console.log(`   � Espèce total: ${actualEspece.toLocaleString()} > ${maxEspece.toLocaleString()} (over by ${(actualEspece - maxEspece).toLocaleString()} DA) - Will be handled by form validation`);
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
    addBtn.addEventListener('click', async function () {
        // Reset form for new buyer
        form.reset();
        form.removeAttribute('data-buyer-id');
        document.querySelector('#buyerModal h2').textContent = 'Add New Buyer';
        document.getElementById('addBuyerBtn').textContent = 'Add Buyer';

        // Reset prix totale field note to default
        const priceInput = document.getElementById('prixTotale');
        if (priceInput) {
            const fieldNote = priceInput.nextElementSibling;
            if (fieldNote && fieldNote.classList.contains('field-note')) {
                fieldNote.textContent = 'Auto-filled based on apartment type (editable)';
            }
        }

        // Populate bloc dropdown
        await populateBlocDropdown();

        // Populate apartment type dropdown from project_info
        await populateApartmentTypeDropdown();        // Reset tranches to just T0
        const tranchesContainer = document.getElementById('tranchesContainer');
        tranchesContainer.innerHTML = `
            <div class="tranche-row">
                <label>T0:</label>
                <div class="tranche-amount-container">
                    <input type="number" step="0.01" min="0" name="tranche_0" 
                           placeholder="Enter amount for T0" oninput="calculateTotalPaid(); validateTrancheAmount(this)">
                    <div class="check-number-container" style="display: none;">
                        <label for="check_0" class="check-label">Chèq N°:</label>
                        <input type="text" name="check_0" id="check_0" 
                               placeholder="N° Chèque" class="check-input" title="Numéro de chèque">
                    </div>
                </div>
                <input type="date" name="tranche_date_0" title="Payment date for T0">
                <select name="tranche_type_0" title="Payment type for T0" onchange="handleTrancheTypeChange(this)">
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
    closeBtn.addEventListener('click', function () {
        modal.style.display = 'none';
    });

    // Close modal when Cancel button is clicked
    cancelBtn.addEventListener('click', function () {
        modal.style.display = 'none';
    });

    // Close modal when clicking outside of it
    window.addEventListener('click', function (event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
        if (event.target === successModal) {
            successModal.style.display = 'none';
        }
    });

    // Close success modal
    successOkBtn.addEventListener('click', function () {
        successModal.style.display = 'none';
    });

    // Function to show success modal
    function showSuccessModal() {
        successModal.style.display = 'block';
    }
    // Form submission
    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        const submitBtn = document.getElementById('addBuyerBtn');
        const originalText = submitBtn.textContent;
        const buyerId = form.getAttribute('data-buyer-id');
        const isEdit = !!buyerId;

        try {
            // Show loading state on submit button
            submitBtn.innerHTML = '<div class="loading-spinner"></div> ' + (isEdit ? 'Updating...' : 'Adding...');
            submitBtn.disabled = true;

            // ✅ PRE-SUBMISSION VALIDATION
            console.log('=== PRE-SUBMISSION VALIDATION ===');

            // Validate required fields
            const requiredFields = ['nom', 'prenom', 'typeLogt', 'surface', 'prixTotale'];
            for (const fieldId of requiredFields) {
                const field = document.getElementById(fieldId);
                if (!field || !field.value.trim()) {
                    throw new Error(`Field "${fieldId}" is required`);
                }
            }

            // Validate numeric fields
            const surfaceValue = parseFloat(document.getElementById('surface').value);
            const prixTotaleValue = parseFloat(document.getElementById('prixTotale').value);
            const remiseValue = parseFloat(document.getElementById('remise')?.value || 0);

            if (surfaceValue <= 0) throw new Error('Surface must be greater than 0');
            if (prixTotaleValue <= 0) throw new Error('Prix totale must be greater than 0');
            if (remiseValue < 0) throw new Error('Remise cannot be negative');

            // Trigger final validation check and wait for resolution
            console.log('🔍 STARTING FORM VALIDATION...');

            // CHECK FOR ESPECE VIOLATIONS AND SHOW MODAL IF NEEDED
            console.log('🔍 STARTING ESPECE VIOLATION CHECK...');

            // Ensure prix unitaire is loaded before validating
            if (!currentPrixUnitaire || currentPrixUnitaire <= 0) {
                console.log('ℹ️ Prix unitaire not loaded yet. Loading before validation...');
                try {
                    await loadPrixUnitaire();
                } catch (e) {
                    console.warn('⚠️ Failed to load prix unitaire before validation:', e);
                }
            }

            const hasEspeceViolation = checkEspeceViolationSync();
            console.log('📊 ESPECE VIOLATION RESULT:', hasEspeceViolation);

            if (hasEspeceViolation) {
                console.log('🚨 ESPECE VIOLATION DETECTED - BLOCKING FORM SUBMISSION');
                console.log('🛑 FORM SUBMISSION COMPLETELY BLOCKED');
                // Reset submit button since form is blocked
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
                // Form submission is blocked - modal is showing
                // User must click OK to continue via acceptEspeceAdjustment
                return;
            }

            console.log('✅ No espèce violations detected - continuing with form submission');

            // Continue with normal form submission - skip the old validation logic
            console.log('Pre-submission validation passed ✅');
            console.log('=== END PRE-SUBMISSION VALIDATION ===');

            // Collect tranches data
            const tranchesContainer = document.getElementById('tranchesContainer');
            const tranches = {};
            let totalPaidAmount = 0;

            console.log('=== TRANCHE COLLECTION DEBUG ===');
            console.log('TranchesContainer exists:', !!tranchesContainer);
            console.log('TranchesContainer children count:', tranchesContainer ? tranchesContainer.children.length : 0);

            if (tranchesContainer && tranchesContainer.children.length > 0) {
                console.log('Processing tranche rows...');
                Array.from(tranchesContainer.children).forEach((row, index) => {
                    console.log(`Row ${index}:`, row);
                    console.log(`Row ${index} classes:`, row.className);
                    console.log(`Row ${index} innerHTML:`, row.innerHTML.substring(0, 200) + '...');

                    // Skip the payment limits display
                    if (row.classList.contains('payment-limits-display')) {
                        console.log(`Skipping payment-limits-display row ${index}`);
                        return;
                    }

                    // Try multiple selector patterns
                    const amountInput = row.querySelector('input[name^="tranche_"]') || row.querySelector('input[name*="tranche"]');
                    const dateInput = row.querySelector('input[type="date"]') || row.querySelector('input[name*="date"]');
                    const typeSelect = row.querySelector('select[name^="tranche_"][name$="_type"]') || row.querySelector('select[name*="type"]');
                    const checkInput = row.querySelector('.check-input') || row.querySelector('input[name*="check"]');

                    console.log(`Row ${index} - Amount input:`, amountInput ? amountInput.name + '=' + amountInput.value : 'NOT FOUND');
                    console.log(`Row ${index} - Date input:`, dateInput ? (dateInput.name || 'unnamed') + '=' + dateInput.value : 'NOT FOUND');
                    console.log(`Row ${index} - Type select:`, typeSelect ? (typeSelect.name || 'unnamed') + '=' + typeSelect.value : 'NOT FOUND');
                    console.log(`Row ${index} - Check input:`, checkInput ? (checkInput.name || 'unnamed') + '=' + checkInput.value : 'NOT FOUND');

                    // Additional debugging - show all inputs in this row
                    const allInputs = row.querySelectorAll('input, select');
                    console.log(`Row ${index} - All inputs/selects:`, Array.from(allInputs).map(el => `${el.tagName}[name="${el.name}"]="${el.value}"`));

                    if (amountInput && typeSelect) {
                        const value = parseFloat(amountInput.value) || 0;
                        const date = dateInput ? dateInput.value || null : null;
                        const type = typeSelect.value;
                        const checkNumber = checkInput ? checkInput.value.trim() : '';

                        console.log(`Row ${index} - Parsed value:`, value);
                        console.log(`Row ${index} - Parsed date:`, date);
                        console.log(`Row ${index} - Parsed type:`, type);
                        console.log(`Row ${index} - Parsed check:`, checkNumber);

                        if (value > 0) {
                            // Use the tranche index from the input name to ensure proper indexing
                            const nameMatch = amountInput.name.match(/tranche_(\d+)/);
                            const trancheIndex = nameMatch ? nameMatch[1] : index;

                            console.log(`Row ${index} - Tranche index extracted:`, trancheIndex);
                            console.log(`Row ${index} - Name match result:`, nameMatch);

                            tranches[`T${trancheIndex}`] = {
                                amount: value,
                                date: date,
                                type: type,
                                check_number: checkNumber || null
                            };
                            totalPaidAmount += value;

                            console.log(`Row ${index} - Added tranche T${trancheIndex}:`, tranches[`T${trancheIndex}`]);
                        } else {
                            console.log(`Row ${index} - Skipped due to zero or invalid value:`, value);
                        }
                    } else {
                        console.log(`Row ${index} - Missing required inputs - Amount:`, !!amountInput, 'Type:', !!typeSelect);
                    }
                });
            } else {
                console.log('No tranchesContainer or no children found!');
            }

            console.log('Final tranches object:', tranches);
            console.log('Total paid amount:', totalPaidAmount);
            console.log('=== END TRANCHE COLLECTION DEBUG ===');

            // Prepare buyer data
            const buyerData = {
                project_id: PROJECT_ID,
                bloc: document.getElementById('bloc')?.value?.trim() || '',
                niveau: document.getElementById('niveau')?.value?.trim() || '',
                logt_num: document.getElementById('logtNum')?.value?.trim() || '',
                nom: document.getElementById('nom')?.value?.trim() || '',
                prenom: document.getElementById('prenom')?.value?.trim() || '',
                type_logt: document.getElementById('typeLogt')?.value?.trim() || '',
                type_of_logt: document.getElementById('typeOfLogt')?.value?.trim() || '',
                surface: document.getElementById('surface')?.value?.trim() || '',
                date: document.getElementById('date')?.value || '',
                prix_totale: parseFloat(document.getElementById('prixTotale')?.value || 0),
                remise: parseFloat(document.getElementById('remise')?.value || 0),
                total_paid: totalPaidAmount,
                payments: tranches
            };

            console.log('=== BUYER DATA DEBUG ===');
            console.log('Full buyer data being sent to Rust:', buyerData);
            console.log('Payments object:', buyerData.payments);
            console.log('Is edit mode:', isEdit);
            console.log('Buyer ID:', buyerId);
            console.log('=== END BUYER DATA DEBUG ===');            // Validate espèce amounts before submission
            const surface = parseFloat(document.getElementById('surface')?.value || 0);
            const prixTotale = parseFloat(document.getElementById('prixTotale')?.value || 0);
            const remise = parseFloat(document.getElementById('remise')?.value || 0);
            const prixUnitaire = currentPrixUnitaire || 0;

            // Calculate the reduced total price after remise (direct value)
            const reducedTotalPrice = prixTotale - (remise || 0);

            // Calculate max versement (unchanged)
            const maxVersement = prixUnitaire * surface;

            // Calculate max espèce from the reduced total price
            const maxEspece = reducedTotalPrice - maxVersement;            // Calculate espèce amounts and find which tranche causes the violation
            let totalEspeceAmount = 0;
            let violatingTrancheInput = null;
            let violatingTrancheAmount = 0;
            let previousEspeceTotal = 0;

            Array.from(tranchesContainer.children).forEach((row, index) => {
                const amountInput = row.querySelector('input[name^="tranche_"]');
                const typeSelect = row.querySelector('select[name^="tranche_"][name$="_type"]');

                if (amountInput && typeSelect) {
                    const value = parseFloat(amountInput.value) || 0;
                    const type = typeSelect.value;

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
            console.log('=== DATABASE CALL DEBUG ===');
            console.log('About to call database function...');
            console.log('Is edit mode:', isEdit);
            if (isEdit) {
                console.log('Calling edit_buyer_in_database with:', { buyerId: parseInt(buyerId), buyer: buyerData });
                await invoke('edit_buyer_in_database', { buyerId: parseInt(buyerId), buyer: buyerData });
                console.log('edit_buyer_in_database completed successfully');
            } else {
                console.log('Calling add_buyer_to_database with:', { buyer: buyerData });
                await invoke('add_buyer_to_database', { buyer: buyerData });
                console.log('add_buyer_to_database completed successfully');
            }
            console.log('=== END DATABASE CALL DEBUG ===');

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
        const visibleBuyers = [];

        // If no filter, reload to restore original structure
        if (!filter) {
            filteredCountEl.style.display = 'none';
            searchInput.style.borderColor = '#ddd';
            loadBuyers();
            return;
        }

        // First pass: determine visibility and collect visible buyers by BLOC + NIVEAU
        const blocNiveauGroups = {};
        const visibleRows = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            
            // Skip total calculation row and separator rows
            if (row.classList.contains('total-calculation-row') || 
                row.classList.contains('bloc-separator') || 
                row.classList.contains('bloc-header')) {
                continue;
            }

            const rowText = row.textContent.toLowerCase();
            const isVisible = rowText.includes(filter);
            
            if (isVisible && row.classList.contains('buyer-row')) {
                visibleCount++;
                visibleRows.push(row);
                
                // Get NIVEAU from the row (first cell text content)
                const niveauCell = row.querySelector('td:first-child');
                const niveau = niveauCell ? niveauCell.textContent.trim() : 'Unknown';
                
                // Get BLOC from the row's border color or data attribute
                const borderColor = row.style.borderLeft || row.style.borderLeftColor || '';
                let bloc = 'Unknown';
                
                // Try to get bloc from buyer data
                const firstBuyerId = row.getAttribute('data-buyer-id');
                if (firstBuyerId && window.allBuyers) {
                    const buyer = window.allBuyers.find(b => b.id == firstBuyerId);
                    if (buyer && buyer.bloc) {
                        bloc = buyer.bloc;
                    }
                }
                
                // Create unique key combining BLOC and NIVEAU
                const groupKey = `${bloc}-${niveau}`;
                
                if (!blocNiveauGroups[groupKey]) {
                    blocNiveauGroups[groupKey] = [];
                }
                blocNiveauGroups[groupKey].push(row);
                
                // Extract buyer data for total calculation
                const secondBuyerId = row.getAttribute('data-buyer-id');
                if (secondBuyerId && window.allBuyers) {
                    const buyer = window.allBuyers.find(b => b.id == secondBuyerId);
                    if (buyer) {
                        visibleBuyers.push(buyer);
                    }
                }
            }
        }

        // Second pass: apply visibility and intelligent rowspan management
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            
            if (row.classList.contains('total-calculation-row') || 
                row.classList.contains('bloc-separator') || 
                row.classList.contains('bloc-header')) {
                continue;
            }

            const rowText = row.textContent.toLowerCase();
            const isVisible = rowText.includes(filter);
            
            if (isVisible && row.classList.contains('buyer-row')) {
                row.style.display = '';
                
                const niveauCell = row.querySelector('td:first-child');
                const niveau = niveauCell ? niveauCell.textContent.trim() : 'Unknown';
                
                // Get BLOC for this row (same logic as first pass)
                let bloc = 'Unknown';
                const rowBuyerId = row.getAttribute('data-buyer-id');
                if (rowBuyerId && window.allBuyers) {
                    const buyer = window.allBuyers.find(b => b.id == rowBuyerId);
                    if (buyer && buyer.bloc) {
                        bloc = buyer.bloc;
                    }
                }
                
                const groupKey = `${bloc}-${niveau}`;
                const groupSize = blocNiveauGroups[groupKey] ? blocNiveauGroups[groupKey].length : 1;
                
                // Intelligent rowspan management
                if (groupSize === 1) {
                    // Single buyer in BLOC-NIVEAU group - remove rowspan, show cell
                    niveauCell.removeAttribute('rowspan');
                    niveauCell.style.display = '';
                } else {
                    // Multiple buyers in BLOC-NIVEAU group - keep rowspan for first, hide for others
                    const isFirstInGroup = blocNiveauGroups[groupKey][0] === row;
                    if (isFirstInGroup) {
                        niveauCell.setAttribute('rowspan', groupSize);
                        niveauCell.style.display = '';
                    } else {
                        niveauCell.style.display = 'none';
                    }
                }
            } else {
                row.style.display = 'none';
            }
        }

        // Update filtered count display
        filteredCountEl.textContent = `Showing: ${visibleCount} results`;
        filteredCountEl.style.display = 'inline';

        // Visual feedback for search
        if (visibleCount === 0) {
            searchInput.style.borderColor = '#e74c3c';
            addTotalCalculationRow([]);
        } else {
            searchInput.style.borderColor = '#27ae60';
            addTotalCalculationRow(visibleBuyers);
        }
    }

    // Search on input (real-time search)
    searchInput.addEventListener('input', performSearch);

    // Search button click
    searchButton.addEventListener('click', function () {
        performSearch();
        searchInput.focus(); // Keep focus on search input
    });

    // Search on Enter key press
    searchInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            performSearch();
        }
    });

    // Clear search when input is cleared
    searchInput.addEventListener('input', function () {
        if (this.value === '') {
            this.style.borderColor = '#ddd';
        }
    });    // Add event listeners for price and remise changes (for display purposes)
    document.getElementById('prixTotale').addEventListener('input', function () {
        calculateTotalPaid();
        updateTrancheTypeOptions();
        updatePaymentLimitsDisplay();
    });
    document.getElementById('remise').addEventListener('input', function () {
        calculateTotalPaid();
        updateTrancheTypeOptions();
        updatePaymentLimitsDisplay();
    });

    // Add event listener for surface changes
    document.getElementById('surface').addEventListener('input', function () {
        updateTrancheTypeOptions();
        updatePaymentLimitsDisplay();
    });

    // Add event listener for apartment type selection
    document.getElementById('typeLogt').addEventListener('change', handleApartmentTypeChange);

    // Add event listener for add tranche button
    document.getElementById('addTrancheBtn').addEventListener('click', addTranche);
});

// Test validation system functionality
function runValidationTests() {
    console.log('\n🧪 RUNNING VALIDATION SYSTEM TESTS...');

    // Test 1: Check if all required functions exist
    console.log('\n📋 Test 1: Function Availability Check');
    const requiredFunctions = [
        'validateFormLimits',
        'triggerDebouncedValidation',
        'testValidationSystem',
        'updatePaymentLimitsDisplay'
    ];

    let allFunctionsExist = true;
    requiredFunctions.forEach(funcName => {
        if (typeof window[funcName] === 'function') {
            console.log(`   ✅ ${funcName} - Available`);
        } else {
            console.error(`   ❌ ${funcName} - Missing!`);
            allFunctionsExist = false;
        }
    });

    if (allFunctionsExist) {
        console.log('   🎉 All validation functions are available!');
    } else {
        console.error('   🚨 Some validation functions are missing!');
        return false;
    }

    // Test 2: Check DOM elements
    console.log('\n🖼️ Test 2: DOM Elements Check');
    const requiredElements = [
        'validationFeedback',
        'paymentLimits'
    ];

    let allElementsExist = true;
    requiredElements.forEach(elementId => {
        const element = document.getElementById(elementId);
        if (element) {
            console.log(`   ✅ #${elementId} - Found`);
        } else {
            console.error(`   ❌ #${elementId} - Missing!`);
            allElementsExist = false;
        }
    });

    if (allElementsExist) {
        console.log('   🎉 All required DOM elements found!');
    } else {
        console.error('   🚨 Some DOM elements are missing!');
        return false;
    }

    // Test 3: Try running validation functions
    console.log('\n⚡ Test 3: Function Execution Test');
    try {
        // Test validation system
        if (typeof window.testValidationSystem === 'function') {
            window.testValidationSystem();
            console.log('   ✅ testValidationSystem executed successfully');
        }

        // Test form limits validation
        if (typeof window.validateFormLimits === 'function') {
            window.validateFormLimits();
            console.log('   ✅ validateFormLimits executed successfully');
        }

        console.log('   🎉 All validation functions executed successfully!');
        return true;

    } catch (error) {
        console.error('   ❌ Error executing validation functions:', error);
        return false;
    }
}

// Make function globally accessible
window.runValidationTests = runValidationTests;

// Test the espece validation system
function testEspeceValidationSystem() {
    console.log('\n🧪 TESTING ESPECE VALIDATION SYSTEM...');

    // Check if required DOM elements exist
    const surfaceInput = document.getElementById('surface');
    const prixTotaleInput = document.getElementById('prixTotale');
    const remiseInput = document.getElementById('remise');
    const tranchesContainer = document.getElementById('tranchesContainer');

    if (!surfaceInput || !prixTotaleInput || !remiseInput || !tranchesContainer) {
        console.error('❌ Required DOM elements not found for testing');
        return false;
    }

    // Set test values
    surfaceInput.value = '60';  // 60 m²
    prixTotaleInput.value = '6000000';  // 6M DA
    remiseInput.value = '0';  // No discount

    // Assuming currentPrixUnitaire is loaded (e.g., 50000 DA/m²)
    const testPrixUnitaire = currentPrixUnitaire || 50000;
    console.log('📊 Test parameters:', {
        surface: 60,
        prixTotale: 6000000,
        remise: 0,
        prixUnitaire: testPrixUnitaire
    });

    const maxVersement = testPrixUnitaire * 60;  // Should be 3M DA
    const maxEspece = 6000000 - maxVersement;    // Should be 3M DA

    console.log('💰 Calculated limits:', { maxVersement, maxEspece });

    // Add a tranche and set it to espece with amount exceeding limit
    const initialTrancheCount = tranchesContainer.children.length;
    addTranche();

    const newTranche = tranchesContainer.lastElementChild;
    const amountInput = newTranche.querySelector('input[name^="tranche_"]');
    const typeSelect = newTranche.querySelector('select[name^="tranche_"][name$="_type"]');

    if (!amountInput || !typeSelect) {
        console.error('❌ Could not find tranche inputs');
        return false;
    }

    // Set tranche to espece type
    typeSelect.value = 'espece';

    // Set amount that exceeds limit (should trigger modal)
    const testAmount = maxEspece + 500000;  // Exceed by 500K DA
    console.log(`🧪 Setting test amount: ${testAmount} (exceeds limit by 500,000 DA)`);

    amountInput.value = testAmount;

    // Trigger the validation
    handleTrancheInput(amountInput);

    console.log('✅ Test completed - check if modal appeared');
    return true;
}

// Make function globally accessible
window.testEspeceValidationSystem = testEspeceValidationSystem;

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

            // Make surface readonly for predefined types, but keep prix totale editable
            surfaceInput.readOnly = true;
            priceInput.readOnly = false; // Always allow prix totale to be editable
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
        // No apartment type selected - clear fields
        surfaceInput.value = '';
        priceInput.value = '';
        surfaceInput.readOnly = true;  // Keep surface readonly when no type selected
        priceInput.readOnly = false;   // But allow prix totale to be manually entered
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
document.addEventListener('mouseover', function (e) {
    if (e.target.closest('.buyer-row')) {
        const row = e.target.closest('.buyer-row');
        const actions = row.querySelector('.hover-actions');
        if (actions) {
            actions.style.display = 'flex';
        }
    }
});

document.addEventListener('mouseout', function (e) {
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

        // Set the type of logt field
        const typeOfLogtSelect = document.getElementById('typeOfLogt');
        if (typeOfLogtSelect && buyer.type_of_logt) {
            typeOfLogtSelect.value = buyer.type_of_logt;
        }

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

        // Add payment limits display at the top
        const paymentLimitsDisplay = createPaymentLimitsDisplay(buyer);
        tranchesContainer.appendChild(paymentLimitsDisplay);

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
        } trancheKeys.forEach((key, index) => {
            const trancheRow = document.createElement('div');
            trancheRow.className = 'tranche-row';

            // Handle both old format (just amount) and new format (amount + date + type + check_number)
            let amount = 0;
            let date = '';
            let type = 'versement';
            let checkNumber = '';

            if (typeof payments[key] === 'object' && payments[key] !== null) {
                // New format: {amount: x, date: 'yyyy-mm-dd', type: 'versement|espece', check_number: 'xxx'}
                amount = payments[key].amount || 0;
                date = payments[key].date || '';
                type = payments[key].type || 'versement';
                checkNumber = payments[key].check_number || '';
            } else {
                // Old format: just a number
                amount = payments[key] || 0;
                date = '';
                type = 'versement';
                checkNumber = '';
            } trancheRow.innerHTML = `
                <label>T${index}:</label>
                <div class="tranche-amount-container">
                    <input type="number" step="0.01" min="0" name="tranche_${index}" 
                           value="${amount}" placeholder="Enter amount for T${index}" 
                           oninput="calculateTotalPaid()">
                    <div class="check-number-and-print-container" style="display: ${type === 'versement' ? 'flex' : 'none'};">
                        <label for="check_${index}" class="check-label">Chèq N°:</label>
                        <input type="text" name="check_${index}" id="check_${index}" 
                               value="${checkNumber}" placeholder="N° Chèque" class="check-input" title="Numéro de chèque">
                        <button type="button" class="btn-print-cheque" onclick="printRecuCheque(${index})" title="Print Reçu de Chèque">
                            <i class="fas fa-print"></i>
                        </button>
                    </div>
                </div>
                <input type="date" name="tranche_date_${index}" value="${date}" title="Payment date for T${index}">
                <select name="tranche_type_${index}" title="Payment type for T${index}" onchange="handleTrancheTypeChange(this)">
                    <option value="espece" ${type === 'espece' ? 'selected' : ''}>Espèce</option>
                    <option value="versement" ${type === 'versement' ? 'selected' : ''}>Versement</option>
                </select>
                <button type="button" class="btn-print-tranche" onclick="printOrdreVersement(${index})" title="Print Ordre de Versement">
                    <i class="fas fa-print"></i>
                </button>
                <button type="button" class="btn-print-tranche btn-print-bordereau" onclick="printBordereauEnvoi(${index})" title="Print Bordereau d'Envoi" style="background:#6f42c1;color:#fff;margin-left:4px;display:${type === 'versement' ? 'inline-block' : 'none'};">
                    <i class="fas fa-file-export"></i>
                </button>
                <button type="button" class="btn-remove-tranche" onclick="removeTranche(this)">×</button>
            `;
            tranchesContainer.appendChild(trancheRow);
        });
        updateAddTrancheButtonVisibility();
        calculateTotalPaid();

        // Update modal title and button
        document.querySelector('#buyerModal h2').textContent = 'Edit Buyer';
        document.getElementById('addBuyerBtn').textContent = 'Update Buyer';

        // Ensure print reservation button is visible and store buyer data
        const printReservationBtn = document.getElementById('printReservationBtn');
        if (printReservationBtn) {
            printReservationBtn.style.display = 'inline-flex';
            printReservationBtn.setAttribute('data-buyer-id', buyerId);
        }

        // Ensure prix totale is always editable in edit mode
        const priceInput = document.getElementById('prixTotale');
        if (priceInput) {
            priceInput.readOnly = false;
            // Update the field note to indicate it's editable
            const fieldNote = priceInput.nextElementSibling;
            if (fieldNote && fieldNote.classList.contains('field-note')) {
                fieldNote.textContent = 'Editable - you can modify this value';
            }
        }

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

// Create payment limits display section for edit modal
function createPaymentLimitsDisplay(buyer) {
    const surface = parseFloat(buyer.surface) || 0;
    const prixTotale = parseFloat(buyer.prix_totale) || 0;
    const remise = parseFloat(buyer.remise) || 0;
    const prixUnitaire = currentPrixUnitaire || 0;

    // Calculate the reduced total price after remise (direct value)
    const reducedTotalPrice = prixTotale - (remise || 0);

    // Calculate maximum amounts
    const maxVersement = prixUnitaire * surface;
    const maxEspece = reducedTotalPrice - maxVersement;
    const padAmount = maxVersement / 5; // PAD calculation

    // Calculate used amounts from existing tranches
    let usedVersement = 0;
    let usedEspece = 0;

    try {
        const payments = typeof buyer.payments === 'string' ? JSON.parse(buyer.payments) : buyer.payments || {};
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
                    usedVersement += amount;
                } else if (type === 'espece') {
                    usedEspece += amount;
                }
            }
        });
    } catch (e) {
        console.warn('Error calculating used amounts:', e);
    }

    // Calculate remaining amounts
    const remainingVersement = Math.max(0, maxVersement - usedVersement);
    const remainingEspece = Math.max(0, maxEspece - usedEspece);

    const limitsContainer = document.createElement('div');
    limitsContainer.className = 'payment-limits-display';
    limitsContainer.innerHTML = `
        <div class="payment-limits-header">
            <h4>💰 Limites de Paiement</h4>
        </div>
        <div class="payment-limits-content">
            <div class="limit-item versement-limit">
                <span class="limit-label">🏦 Max Versement:</span>
                <span class="limit-value" id="maxVersementValue">${maxVersement.toLocaleString()} DA</span>
                <span class="remaining-label">Disponible:</span>
                <span class="remaining-value" id="remainingVersementValue">${remainingVersement.toLocaleString()} DA</span>
            </div>
            <div class="limit-item espece-limit">
                <span class="limit-label">💵 Max Espèce:</span>
                <span class="limit-value" id="maxEspeceValue">${maxEspece.toLocaleString()} DA</span>
                <span class="remaining-label">Disponible:</span>
                <span class="remaining-value" id="remainingEspeceValue">${remainingEspece.toLocaleString()} DA</span>
            </div>
            <div class="limit-item pad-limit">
                <span class="limit-label">📊 PAD / 5:</span>
                <span class="limit-value" id="padValue">${padAmount.toLocaleString()} DA</span>
            </div>
        </div>
        
        <style>
            .payment-limits-display {
                background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                border: 2px solid #3498db;
                border-radius: 12px;
                padding: 15px;
                margin-bottom: 20px;
                box-shadow: 0 4px 12px rgba(52, 152, 219, 0.15);
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }
            
            .payment-limits-header {
                text-align: center;
                margin-bottom: 12px;
            }
            
            .payment-limits-header h4 {
                margin: 0;
                color: #2c3e50;
                font-size: 16px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            .payment-limits-content {
                display: flex;
                justify-content: space-around;
                align-items: center;
                gap: 15px;
                flex-wrap: wrap;
            }
            
            .limit-item {
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 12px;
                background: white;
                border-radius: 8px;
                border: 1px solid #dee2e6;
                min-width: 140px;
                flex: 1;
                box-shadow: 0 2px 6px rgba(0,0,0,0.08);
                transition: transform 0.2s ease, box-shadow 0.2s ease;
            }
            
            .limit-item:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.12);
            }
            
            .versement-limit {
                border-left: 4px solid #2980b9;
            }
            
            .espece-limit {
                border-left: 4px solid #27ae60;
            }
            
            .pad-limit {
                border-left: 4px solid #e67e22;
            }
            
            .limit-label {
                font-size: 11px;
                font-weight: 600;
                color: #5d6d7e;
                margin-bottom: 4px;
                text-align: center;
            }
            
            .limit-value {
                font-size: 14px;
                font-weight: bold;
                color: #2c3e50;
                text-align: center;
                margin-bottom: 6px;
                background: linear-gradient(135deg, #f1c40f, #f39c12);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }
            
            .remaining-label {
                font-size: 10px;
                font-weight: 500;
                color: #7f8c8d;
                margin-bottom: 2px;
                text-align: center;
            }
            
            .remaining-value {
                font-size: 12px;
                font-weight: 600;
                color: #34495e;
                text-align: center;
            }
            
            .versement-limit .limit-value {
                background: linear-gradient(135deg, #3498db, #2980b9);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }
            
            .espece-limit .limit-value {
                background: linear-gradient(135deg, #2ecc71, #27ae60);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }
            
            .pad-limit .limit-value {
                background: linear-gradient(135deg, #e67e22, #d35400);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }
            
            .versement-limit .remaining-value {
                color: #2980b9;
                font-weight: bold;
            }
            
            .espece-limit .remaining-value {
                color: #27ae60;
                font-weight: bold;
            }
            
            .pad-limit .remaining-value {
                color: #d35400;
                font-weight: bold;
            }
            
            /* Fallback for browsers that don't support background-clip */
            @supports not (-webkit-background-clip: text) {
                .limit-value {
                    color: #2c3e50 !important;
                }
                .versement-limit .limit-value {
                    color: #2980b9 !important;
                }
                .espece-limit .limit-value {
                    color: #27ae60 !important;
                }
                .pad-limit .limit-value {
                    color: #e67e22 !important;
                }
            }
            
            /* Responsive design for smaller screens */
            @media (max-width: 768px) {
                .payment-limits-content {
                    flex-direction: column;
                    gap: 10px;
                }
                .limit-item {
                    min-width: 100%;
                }
            }
        </style>
    `;

    return limitsContainer;
}

// Update payment limits display when surface, price, or remise changes
function updatePaymentLimitsDisplay() {
    const maxVersementEl = document.getElementById('maxVersementValue');
    const maxEspeceEl = document.getElementById('maxEspeceValue');
    const padValueEl = document.getElementById('padValue');
    const remainingVersementEl = document.getElementById('remainingVersementValue');
    const remainingEspeceEl = document.getElementById('remainingEspeceValue');

    if (!maxVersementEl || !maxEspeceEl) return;

    const surfaceEl = document.getElementById('surface');
    const prixTotaleEl = document.getElementById('prixTotale');
    const remiseEl = document.getElementById('remise');

    if (!surfaceEl || !prixTotaleEl || !remiseEl) return;

    const surface = parseFloat(surfaceEl.value) || 0;
    const prixTotale = parseFloat(prixTotaleEl.value) || 0;
    const remise = parseFloat(remiseEl.value) || 0;
    const prixUnitaire = currentPrixUnitaire || 0;

    // Calculate the reduced total price after remise (direct value)
    const reducedTotalPrice = prixTotale - (remise || 0);

    // Calculate maximum amounts
    const maxVersement = prixUnitaire * surface;
    const maxEspece = reducedTotalPrice - maxVersement;
    const padAmount = maxVersement / 5; // PAD calculation

    // Calculate used amounts from current form tranches
    let usedVersement = 0;
    let usedEspece = 0;

    // Get tranches from the form if they exist
    const tranchesContainer = document.getElementById('tranchesContainer');
    if (tranchesContainer) {
        const trancheRows = tranchesContainer.querySelectorAll('.tranche-row');
        trancheRows.forEach(row => {
            const amountInput = row.querySelector('input[name^="tranche_"]');
            const typeSelect = row.querySelector('select[name^="tranche_"][name$="_type"]');

            if (amountInput && typeSelect) {
                const amount = parseFloat(amountInput.value) || 0;
                const type = typeSelect.value;

                if (amount > 0) {
                    if (type === 'versement') {
                        usedVersement += amount;
                    } else if (type === 'espece') {
                        usedEspece += amount;
                    }
                }
            }
        });
    }

    // Calculate remaining amounts
    const remainingVersement = Math.max(0, maxVersement - usedVersement);
    const remainingEspece = Math.max(0, maxEspece - usedEspece);

    // Update display values
    maxVersementEl.textContent = `${maxVersement.toLocaleString()} DA`;
    maxEspeceEl.textContent = `${maxEspece.toLocaleString()} DA`;

    if (padValueEl) padValueEl.textContent = `${padAmount.toLocaleString()} DA`;
    if (remainingVersementEl) remainingVersementEl.textContent = `${remainingVersement.toLocaleString()} DA`;
    if (remainingEspeceEl) remainingEspeceEl.textContent = `${remainingEspece.toLocaleString()} DA`;
}

// Make functions globally accessible
window.updatePaymentLimitsDisplay = updatePaymentLimitsDisplay;
window.editTranches = editTranches;
window.deleteBuyer = deleteBuyer;
window.removeTranche = removeTranche;
window.printOrdreVersement = printOrdreVersement;

// Print appropriate document based on tranche type (Ordre de Versement or Reçu de Versement)
async function printOrdreVersement(trancheIndex) {
    try {
        // Get form data
        const form = document.getElementById('addBuyerForm');
        if (!form) {
            alert('No form found');
            return;
        }

        // Get buyer information directly from form inputs by ID (these don't have name attributes)
        const buyerName = document.getElementById('nom')?.value || 'N/A';
        const prenom = document.getElementById('prenom')?.value || '';

        // Get tranche information from FormData (these have name attributes)
        const formData = new FormData(form);
        const trancheAmount = formData.get(`tranche_${trancheIndex}`) || '0';
        const trancheDate = formData.get(`tranche_date_${trancheIndex}`) || new Date().toISOString().split('T')[0];
        const trancheType = formData.get(`tranche_type_${trancheIndex}`) || 'versement';

        if (!trancheAmount || parseFloat(trancheAmount) <= 0) {
            alert('Please enter a valid amount for this tranche before printing');
            return;
        }

        // Determine document type based on tranche type
        const documentType = trancheType === 'espece' ? 'Reçu de Versement' : 'Ordre de Virement';
        const documentTitle = trancheType === 'espece' ? 'REÇU DE VERSEMENT' : 'ORDRE DE VIREMENT';

        console.log(`📄 Document type: ${documentType} (tranche type: ${trancheType})`);

        // Get current project info and apartment type
        const projectTitle = document.getElementById('pageTitle')?.textContent || '136 logements promotionnels à EL TARF';

        // Get buyer ID to fetch their apartment type from project_info
        const buyerId = form.getAttribute('data-buyer-id');
        let apartmentType = '';

        console.log('🔍 Buyer ID for apartment type fetch:', buyerId);

        if (buyerId) {
            try {
                console.log('📡 Fetching buyer data for apartment type...');
                // Fetch buyer data to get their type_logt
                const buyerData = await invoke('get_buyer', { buyerId: parseInt(buyerId) });
                console.log('👤 Buyer data:', buyerData);

                if (buyerData && buyerData.type_logt) {
                    apartmentType = buyerData.type_logt;
                    console.log('🏠 Apartment type fetched from buyer details:', apartmentType);
                } else {
                    console.log('⚠️ No type_logt found in buyer data, defaulting to Appartement');
                    apartmentType = 'Appartement';
                }
            } catch (error) {
                console.error('❌ Error fetching apartment type from project_info:', error);
                // Fall back to form data if database fetch fails
                apartmentType = formData.get('typeLogt') || 'Appartement';
            }
        } else {
            console.log('ℹ️ No buyer ID found, using form data');
            // For new buyers, get from form
            apartmentType = formData.get('typeLogt') || 'Appartement';
        }

        console.log('🏠 Final apartment type:', apartmentType);

        // Create PDF using the DocumentGenerator from utils if available
        // Temporarily disabled to use fallback system
        if (false && window.DocumentGenerator) {
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
                type: trancheType,
                documentType: documentType,
                documentTitle: documentTitle
            };

            if (trancheType === 'espece') {
                await docGenerator.generateRecuVersement(buyerData, trancheData);
            } else {
                await docGenerator.generateOrdreVersement(buyerData, trancheData);
            }
        } else {
            // Fallback to simple print functionality
            if (trancheType === 'espece') {
                // Show modal for additional information for espece payments
                showUserInfoModal({
                    buyerName,
                    prenom,
                    trancheIndex,
                    trancheAmount,
                    trancheDate,
                    trancheType,
                    documentType,
                    documentTitle,
                    apartmentType,
                    projectTitle
                });
                return;
            } else {
                generateSimpleDocument(buyerName, prenom, trancheIndex, trancheAmount, trancheDate, trancheType, documentType, documentTitle, apartmentType, projectTitle, null, null, null);
            }
        }

    } catch (error) {
        console.error('Error generating document:', error);
        alert('Error generating document: ' + error.message);
    }
}
// Simple document generation fallback (handles both Ordre de Versement and Reçu de Versement)
function generateSimpleDocument(buyerName, prenom, trancheIndex, amount, date, type, documentType, documentTitle, apartmentType, projectTitle, surface, prixUnitaire, description) {
    // Create fullscreen centered window
    const screenWidth = window.screen.availWidth;
    const screenHeight = window.screen.availHeight;
    const left = (screenWidth - screenWidth) / 2;
    const top = (screenHeight - screenHeight) / 2;

    const printWindow = window.open('', '_blank',
        `width=${screenWidth},height=${screenHeight},left=${left},top=${top},scrollbars=yes,resizable=yes`);

    const currentDate = new Date();
    const paymentDate = date ? new Date(date) : currentDate;
    const refNumber = `N°${Math.floor(Math.random() * 100)}/2025`;

    const htmlContent = `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <title>${documentType}</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    margin: 0;
                    padding: 20px; 
                    line-height: 1.4;
                    color: #000;
                    font-size: 14px;
                }
                .header { 
                    text-align: center; 
                    margin-bottom: 30px; 
                }
                .company-name {
                    font-size: 16px;
                    font-weight: bold;
                    margin-bottom: 8px;
                }
                .company-details {
                    font-size: 12px;
                    margin: 3px 0;
                }
                .ref-date-section {
                    display: flex;
                    justify-content: space-between;
                    margin: 25px 0;
                    font-size: 12px;
                }
                .document-title {
                    text-align: center;
                    font-size: 18px;
                    font-weight: bold;
                    margin: 30px 0;
                    text-decoration: underline;
                }
                .content {
                    margin: 25px 0;
                    font-size: 13px;
                    line-height: 1.6;
                }
                .amount-section {
                    margin: 25px 0;
                }
                .amount-large {
                    font-size: 16px;
                    font-weight: bold;
                    margin-bottom: 10px;
                }
                .observations {
                    border: 2px solid #000;
                    border-radius: 15px;
                    padding: 20px;
                    margin: 30px 0;
                }
                .observations-title {
                    font-weight: bold;
                    text-decoration: underline;
                    margin-bottom: 15px;
                }
                .footer {
                    margin-top: 50px;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                }
                .signature-section {
                    text-align: center;
                }
                .seal-area {
                    width: 150px;
                    height: 150px;
                    border: 2px solid #000;
                    border-radius: 50%;
                    margin: 0 auto;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    text-align: center;
                }
                @media print { body { margin: 0; padding: 20px; } }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="company-name">PROMOTION IMMOBILIERE</div>
                <div class="company-name">FARTAS YAZID</div>
                <div class="company-details">Siège social : Cité 20 Août 1956 EL TARF Centre</div>
                <div class="company-details">Tel : 038 30 17 74</div>
            </div>

            <div style="text-align: left; margin: 20px 0; font-size: 12px;">
                N° REF : ...... ${refNumber}
            </div>

            <div class="document-title">
                ${documentTitle}
            </div>

            <div class="content">
                <p><strong>Mr : ${buyerName.toUpperCase()} ${prenom.toUpperCase()}</strong></p>
                
                <p><strong>EST REQUIS DE REGLER AU :</strong> PROMOTEUR « FARTAS YAZID »</p>
                
                <p><strong>PAR CHEQUE DE BANQUE OU PAR VIREMENT AU COMPTE N°:</strong><br>
                00100489-03-00001148/89 BNA Agence 489 EL-TARF</p>
                
                <div class="amount-section">
                    <p><strong>LA SOMME DE :</strong> <span class="amount-large">(En chiffres) ${parseFloat(amount).toLocaleString().replace(/,/g, ' ')} DA</span></p>
                    
                    <p><strong>(En lettres) :</strong> ${numberToFrenchWords(parseFloat(amount))} Dinars Algériens</p>
                </div>
                
                <p>Représentant le paiement d'un Appartement <strong>${apartmentType}</strong> du projet ${(projectTitle || '136 logements promotionnels').replace(/\s*-\s*Buyers\s*$/i, '')} à EL TAREF</p>
            </div>

            <div class="observations">
                <div class="observations-title">Observations :</div>
                <p>- Valable 15 jours, si le réservataire dépasse ce délai</p>
                <p>- Le promoteur se réserve le droit d'annuler la cession</p>
            </div>

            <div class="footer">
                <div class="date-location">
                    <p><strong>Fait à EL TARF LE :</strong> ${currentDate.toLocaleDateString('fr-FR')}</p>
                </div>
                
                <div class="signature-section">
                    <p><strong>LE PROMOTEUR</strong></p>
                    <div class="seal-area">
                        <div>CACHET<br>ET<br>SIGNATURE</div>
                    </div>
                </div>
            </div>
            
            <script>
                window.onload = function() {
                    window.print();
                }
                
                // Handle print dialog events but don't auto-close
                window.addEventListener('beforeprint', function() {
                    console.log('Print dialog opened');
                });
                
                window.addEventListener('afterprint', function() {
                    console.log('Print dialog closed - window stays open');
                });
                
                // Optional: Add keyboard shortcut to close window manually
                window.addEventListener('keydown', function(event) {
                    if (event.key === 'Escape') {
                        window.close();
                    }
                });
            </script>
        </body>
        </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
}

// French format for Reçu de Versement (Receipt of Payment for Espèce)
function generateFrenchRecuVersement(buyerName, prenom, trancheIndex, amount, date, type, documentType, documentTitle, apartmentType, projectTitle, additionalInfo) {
    const printWindow = window.open('', '_blank');

    const currentDate = new Date();
    const paymentDate = date ? new Date(date) : currentDate;
    const amountInWords = numberToWords(parseFloat(amount));

    const htmlContent = `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <title>Reçu de Versement - T${trancheIndex}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Times+New+Roman:wght@400;700&display=swap');
                
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body { 
                    font-family: 'Times New Roman', serif;
                    margin: 0;
                    padding: 30px;
                    line-height: 1.8;
                    color: #000;
                    font-size: 16px;
                    direction: ltr;
                    text-align: left;
                }
                
                .document-container {
                    max-width: 210mm;
                    margin: 0 auto;
                    border: 3px solid #000;
                    padding: 30px 30px 20px 30px;
                    overflow: hidden;
                }
                
                .document-container::after {
                    content: "";
                    display: table;
                    clear: both;
                }
                
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 30px;
                    border-bottom: 2px solid #000;
                    padding-bottom: 20px;
                }
                
                .logo-section {
                    text-align: left;
                }
                
                .logo-text {
                    font-weight: bold;
                    font-size: 18px;
                    margin-bottom: 5px;
                }
                
                .logo-subtitle {
                    font-size: 12px;
                    font-style: italic;
                }
                
                .company-info {
                    text-align: center;
                    flex: 1;
                    margin: 0 20px;
                }
                
                .company-name {
                    font-size: 18px;
                    font-weight: bold;
                    margin-bottom: 10px;
                }
                
                .company-address {
                    font-size: 14px;
                    margin-bottom: 5px;
                }
                
                .company-phone {
                    font-size: 14px;
                    font-weight: bold;
                }
                
                .project-info {
                    text-align: center;
                    margin: 20px 0;
                    font-size: 14px;
                    border-bottom: 1px solid #000;
                    padding-bottom: 15px;
                }
                
                .document-title {
                    text-align: center;
                    font-size: 24px;
                    font-weight: bold;
                    margin: 40px 0;
                    text-decoration: underline;
                }
                
                .content {
                    margin: 30px 0;
                    font-size: 16px;
                    line-height: 2.5;
                }
                
                .content p {
                    margin: 15px 0;
                    text-align: left;
                }
                
                .amount-section {
                    text-align: center;
                    margin: 20px 0;
                    font-size: 18px;
                    font-weight: bold;
                }
                
                .date-location {
                    text-align: right;
                    margin: 30px 0 20px 0;
                    font-size: 16px;
                }
                
                .signature-section {
                    text-align: right;
                    margin: 20px 0 15px 0;
                    width: 100%;
                    display: block;
                    position: relative;
                }
                
                .signature-title {
                    font-size: 16px;
                    font-weight: bold;
                    margin-bottom: 20px;
                }
                
                .seal-area {
                    width: 120px;
                    height: 120px;
                    border: 2px solid #000;
                    border-radius: 50%;
                    margin: 20px 0 10px auto;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    text-align: center;
                }
                
                @media print {
                    body { padding: 15px; font-size: 14px; }
                    .document-container { border: 2px solid #000; padding: 20px; }
                    .seal-area { width: 100px; height: 100px; }
                }
            </style>
        </head>
        <body>
            <div class="document-container">
                <div class="header">
                    <div class="logo-section">
                        <div class="logo-text">FARTAS YAZID</div>
                        <div class="logo-subtitle">ENSEMBLE NOUS CONSTRUISONS L'AVENIR</div>
                    </div>
                    
                    <div class="company-info">
                        <div class="company-name">ENTREPRISE DE PROMOTION IMMOBILIÈRE FARTAS YAZID</div>
                        <div class="company-address">Adresse: El Tarf Centre, Wilaya d'El Tarf</div>
                        <div class="company-phone">Tél/Fax: 0660323271 / 0660448872</div>
                    </div>
                </div>
                
                <div class="document-title">
                    REÇU DE VERSEMENT
                </div>
                
                <div class="content">
                    <p>Je soussigné Monsieur <strong>FARTAS YAZID</strong> atteste avoir reçu</p>
                    <p>un montant financier de ${additionalInfo && additionalInfo.gender ? additionalInfo.gender : 'Madame'} <strong>${buyerName.toUpperCase()} ${prenom.toUpperCase()}</strong></p>
                    <p>${additionalInfo && additionalInfo.gender === 'Mr' ? 'Né' : 'Née'} le: ${additionalInfo ? additionalInfo.birthDate : '07/01/1990'} à ${additionalInfo ? additionalInfo.birthPlace : 'Besbana'}</p>
                    <p>Titulaire de la carte d'identité nationale N°: ${additionalInfo ? additionalInfo.nationalCardNumber : '326367'}</p>
                    <p>Délivrée par la commune de: ${additionalInfo ? additionalInfo.issuePlace : 'Bouteldja'} le: ${additionalInfo ? additionalInfo.issueDate : '04/11/2015'}</p>
                </div>
                
                <div class="amount-section">
                    <p>D'un montant de ${parseFloat(amount).toLocaleString()} DA</p>
                    <p>${amountInWords}</p>
                    <p>Dans le cadre du projet ${(projectTitle || '136 logements El Tarf').replace(/\s*-\s*Buyers\s*$/i, '')}</p>
                </div>
                
                <div class="date-location">
                    El Tarf, le ${paymentDate.toLocaleDateString('fr-FR')}
                </div>
                
                <div class="signature-section">
                    <div class="signature-title">Signature</div>
                    <div class="seal-area">
                        Cachet et Signature<br>
                        FARTAS YAZID
                    </div>
                </div>
            </div>
            
            <script>
                window.onload = function() {
                    window.print();
                };
            </script>
        </body>
        </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
}

// Helper function to convert numbers to words (French)
function numberToWords(num) {
    const ones = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
    const teens = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
    const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'];

    if (num === 0) return 'zéro dinars algériens';

    function convertChunk(chunk) {
        let result = '';

        // Hundreds
        if (chunk >= 100) {
            const hundreds = Math.floor(chunk / 100);
            if (hundreds === 1) {
                result += 'cent';
            } else {
                result += ones[hundreds] + ' cent';
            }

            // Add 's' for plural hundreds when no remainder
            if (chunk % 100 === 0 && hundreds > 1) {
                result += 's';
            }

            result += ' ';
            chunk %= 100;
        }

        // Tens and ones
        if (chunk >= 20) {
            const tensDigit = Math.floor(chunk / 10);
            const onesDigit = chunk % 10;

            result += tens[tensDigit];

            // Handle special cases for quatre-vingt
            if (tensDigit === 8 && onesDigit === 0) {
                result += 's'; // quatre-vingts
            }

            if (onesDigit !== 0) {
                if (tensDigit === 7 || tensDigit === 9) {
                    // 70-79 and 90-99 special cases
                    if (tensDigit === 7) {
                        result = result.replace('soixante-dix', 'soixante');
                        if (onesDigit === 1) {
                            result += '-et-un';
                        } else {
                            result += '-' + teens[onesDigit - 1];
                        }
                    } else {
                        result = result.replace('quatre-vingt-dix', 'quatre-vingt');
                        result += '-' + teens[onesDigit - 1];
                    }
                } else {
                    if (onesDigit === 1 && (tensDigit === 2 || tensDigit === 3 || tensDigit === 4 || tensDigit === 5 || tensDigit === 6)) {
                        result += '-et-un';
                    } else {
                        result += '-' + ones[onesDigit];
                    }
                }
            }
        } else if (chunk >= 10) {
            result += teens[chunk - 10];
        } else if (chunk > 0) {
            result += ones[chunk];
        }

        return result.trim();
    }

    let result = '';
    const billion = Math.floor(num / 1000000000);
    const million = Math.floor((num % 1000000000) / 1000000);
    const thousand = Math.floor((num % 1000000) / 1000);
    const remainder = num % 1000;

    // Billions
    if (billion > 0) {
        result += convertChunk(billion);
        result += billion === 1 ? ' milliard ' : ' milliards ';
    }

    // Millions
    if (million > 0) {
        result += convertChunk(million);
        result += million === 1 ? ' million ' : ' millions ';
    }

    // Thousands
    if (thousand > 0) {
        if (thousand === 1) {
            result += 'mille ';
        } else {
            result += convertChunk(thousand) + ' mille ';
        }
    }

    // Remainder (0-999)
    if (remainder > 0) {
        result += convertChunk(remainder);
    }

    return result.trim() + ' dinars algériens';
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

        // Use add_prix_unitaire which handles both create and update
        await invoke('add_prix_unitaire', {
            prixUnitaireInput: {
                project_id: PROJECT_ID,
                prix_unitaire: newPrixUnitaire
            }
        });
        console.log('✅ Prix unitaire saved successfully (create or update)');

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

    console.log('🔍 REAL-TIME VALIDATION:', { amount, type });

    // Only validate if it's espèce type
    if (type !== 'espece' || amount <= 0) {
        console.log('   ⏩ Skipping validation (not espece or zero amount)');
        return true;
    }

    // Calculate validation limits
    const prixUnitaire = currentPrixUnitaire || 0;
    const surface = parseFloat(document.getElementById('surface').value) || 0;
    const prixTotale = parseFloat(document.getElementById('prixTotale').value) || 0;
    const remise = parseFloat(document.getElementById('remise').value) || 0;

    // Calculate the reduced total price after remise (direct value)
    const reducedTotalPrice = prixTotale - (remise || 0);

    // Calculate max versement (unchanged)
    const maxVersement = prixUnitaire * surface;

    // Calculate max espèce from the reduced total price
    const maxEspece = reducedTotalPrice - maxVersement;

    console.log('💰 ESPECE VALIDATION LIMITS:', {
        amount,
        maxEspece,
        prixUnitaire,
        surface,
        prixTotale,
        remise,
        reducedTotalPrice,
        maxVersement
    });

    if (amount > maxEspece) {
        console.log('🚨 ESPECE LIMIT EXCEEDED! Triggering modal...');

        // Store the pending data
        pendingEspeceData = {
            trancheInput: trancheInput,
            enteredAmount: amount,
            maxEspece: maxEspece,
            acceptedEspece: maxEspece,
            remainingVersement: amount - maxEspece
        };

        console.log('📋 PENDING ESPECE DATA:', pendingEspeceData);

        showEspeceWarningModal();
        return false;
    }

    console.log('✅ Espece amount within limits');
    return true;
}

function showEspeceWarningModal() {
    console.log('🪟 SHOWING ESPECE WARNING MODAL...');

    if (!pendingEspeceData) {
        console.error('❌ No pendingEspeceData found!');
        return;
    }

    console.log('📋 PendingEspeceData:', pendingEspeceData);

    const modal = document.getElementById('especeWarningModal');

    if (!modal) {
        console.error('❌ Modal element especeWarningModal not found in DOM!');
        console.log('📋 Available modals:', Array.from(document.querySelectorAll('[id*="modal" i]')).map(el => el.id));
        return;
    }

    console.log('✅ Modal element found:', modal);
    console.log('📋 Modal display style before:', modal.style.display);
    console.log('📋 Modal computed style before:', window.getComputedStyle(modal).display);

    // Calculate total maximum espèce for display
    const prixUnitaire = currentPrixUnitaire || 0;
    const surface = parseFloat(document.getElementById('surface').value) || 0;
    const prixTotale = parseFloat(document.getElementById('prixTotale').value) || 0;
    const remise = parseFloat(document.getElementById('remise').value) || 0;

    const reducedTotalPrice = prixTotale - (remise || 0);
    const maxVersement = prixUnitaire * surface;
    const totalMaxEspece = reducedTotalPrice - maxVersement;

    // Update modal content with actual values
    console.log('📝 Updating modal content...');
    try {
        document.getElementById('enteredEspeceAmount').textContent = pendingEspeceData.enteredAmount.toLocaleString() + ' DA';
        document.getElementById('maxEspeceAllowed').textContent = totalMaxEspece.toLocaleString() + ' DA';
        document.getElementById('acceptedEspeceAmount').textContent = pendingEspeceData.acceptedEspece.toLocaleString() + ' DA';
        document.getElementById('remainingVersementAmount').textContent = pendingEspeceData.remainingVersement.toLocaleString() + ' DA';
        console.log('✅ Modal content updated successfully');
    } catch (error) {
        console.error('❌ Error updating modal content:', error);
    }

    // Force show modal with multiple methods
    console.log('🚀 FORCE SHOWING MODAL...');

    // Method 1: Standard display
    modal.style.display = 'block';
    modal.style.visibility = 'visible';
    modal.style.opacity = '1';
    modal.style.zIndex = '9999';

    // Method 2: Add show class
    modal.classList.add('show');
    modal.classList.remove('hidden');

    // Method 3: Force body overflow
    document.body.style.overflow = 'hidden';

    // Method 4: Bring to front
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';

    console.log('📋 Modal display style after:', modal.style.display);
    console.log('📋 Modal computed style after:', window.getComputedStyle(modal).display);
    console.log('📋 Modal visibility:', window.getComputedStyle(modal).visibility);
    console.log('📋 Modal opacity:', window.getComputedStyle(modal).opacity);
    console.log('📋 Modal z-index:', window.getComputedStyle(modal).zIndex);

    // Test: Try to focus on modal
    try {
        modal.focus();
        console.log('✅ Modal focused');
    } catch (error) {
        console.error('❌ Error focusing modal:', error);
    }

    console.log('🎯 MODAL SHOULD NOW BE VISIBLE!');
}
function closeEspeceWarningModal(options = {}) {
    const { preservePending = false } = options;
    const modal = document.getElementById('especeWarningModal');
    if (modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
    }
    document.body.style.overflow = 'auto';

    // Reset submit button ONLY if we are cancelling flow (not when preserving for submission)
    if (!preservePending && pendingEspeceData && pendingEspeceData.submitBtn && pendingEspeceData.originalText) {
        pendingEspeceData.submitBtn.innerHTML = pendingEspeceData.originalText;
        pendingEspeceData.submitBtn.disabled = false;
    }

    // Do not null pending data if we still need it (e.g., finishing submission after split)
    if (!preservePending) {
        pendingEspeceData = null;
    }
}

function acceptEspeceAdjustment() {
    if (!pendingEspeceData) {
        console.error('❌ No pendingEspeceData found!');
        return;
    }

    // Prevent double execution
    if (pendingEspeceData.isProcessing) {
        console.log('⚠️ ESPECE ADJUSTMENT ALREADY IN PROGRESS - SKIPPING');
        return;
    }

    pendingEspeceData.isProcessing = true;
    console.log('🔄 ACCEPTING ESPECE ADJUSTMENT...');
    console.log('📋 Original data:', pendingEspeceData);

    // Store the original amount entered by user
    const originalAmount = pendingEspeceData.enteredAmount;
    const maxEspeceAllowed = pendingEspeceData.acceptedEspece;
    const remainingAmount = originalAmount - maxEspeceAllowed;

    console.log(`💡 Splitting: ${originalAmount} = ${maxEspeceAllowed} (espèce) + ${remainingAmount} (versement)`);

    // Set the current tranche to max espèce amount allowed
    pendingEspeceData.trancheInput.value = maxEspeceAllowed;

    // Create new tranche if there's remaining amount
    if (remainingAmount > 0) {
        console.log('➕ Creating new versement tranche...');

        // Calculate versement limits before creating the tranche
        const surface = parseFloat(document.getElementById('surface').value) || 0;
        const prixUnitaire = currentPrixUnitaire || 0;
        const maxVersement = prixUnitaire * surface;

        // Calculate current versement total (excluding the tranche we're about to create)
        let currentVersementTotal = 0;
        const tranchesContainer = document.getElementById('tranchesContainer');
        Array.from(tranchesContainer.children).forEach(row => {
            if (row.classList.contains('payment-limits-display')) return;

            const input = row.querySelector('input[name^="tranche_"]');
            const typeSelect = row.querySelector('select[name*="type"]');

            if (input && typeSelect && input !== pendingEspeceData.trancheInput) {
                const value = parseFloat(input.value) || 0;
                const type = typeSelect.value;

                if (type === 'versement' && value > 0) {
                    currentVersementTotal += value;
                }
            }
        });

        // Calculate how much versement we can still add
        const availableVersement = maxVersement - currentVersementTotal;
        const versementAmount = Math.min(remainingAmount, availableVersement);
        const excessAmount = remainingAmount - versementAmount;

        console.log(`🔢 Versement calculation:
        - Remaining: ${remainingAmount.toLocaleString()} DA
        - Max versement: ${maxVersement.toLocaleString()} DA  
        - Current versement: ${currentVersementTotal.toLocaleString()} DA
        - Available versement: ${availableVersement.toLocaleString()} DA
        - Will set: ${versementAmount.toLocaleString()} DA
        - Excess: ${excessAmount.toLocaleString()} DA`);

        if (versementAmount <= 0) {
            console.warn('⚠️ No versement capacity available, cannot create versement tranche');
            // Just continue without creating versement tranche
            closeEspeceWarningModal({ preservePending: true });
            pendingEspeceData.isProcessing = false;

            setTimeout(() => {
                if (pendingEspeceData && pendingEspeceData.formData) {
                    console.log('🚀 Continuing form submission without versement tranche...');
                    continueFormSubmissionAfterModal();
                }
            }, 200);
            return;
        }

        // Add new tranche using the existing function
        addTranche();

        // Wait a moment for DOM to update, then configure the new tranche
        setTimeout(() => {
            const tranchesContainer = document.getElementById('tranchesContainer');
            const allRows = Array.from(tranchesContainer.children).filter(row => !row.classList.contains('payment-limits-display'));
            const lastTranche = allRows[allRows.length - 1];

            console.log('🔍 Configuring last tranche:', lastTranche);

            if (lastTranche) {
                const amountInput = lastTranche.querySelector('input[name^="tranche_"]');
                const typeSelect = lastTranche.querySelector('select[name*="type"]'); // FIXED SELECTOR
                const dateInput = lastTranche.querySelector('input[type="date"]');

                console.log('🔍 Found elements:', { amountInput: !!amountInput, typeSelect: !!typeSelect, dateInput: !!dateInput });

                if (amountInput && typeSelect) {
                    // Set the calculated versement amount (respecting limits)
                    amountInput.value = versementAmount;
                    console.log(`💰 Set versement amount: ${versementAmount.toLocaleString()} DA (limited by max versement)`);

                    // Set type to versement
                    typeSelect.value = 'versement';
                    console.log(`🏦 Set type: versement`);

                    // Trigger change event to show check number field
                    typeSelect.dispatchEvent(new Event('change', { bubbles: true }));

                    // Set today's date
                    if (dateInput) {
                        dateInput.value = new Date().toISOString().split('T')[0];
                        console.log(`📅 Set date: ${dateInput.value}`);
                    }

                    console.log(`✅ Versement tranche created: ${versementAmount.toLocaleString()} DA (within limits)`);

                    // Handle excess amount if any
                    if (excessAmount > 0) {
                        console.warn(`⚠️ Excess amount cannot be processed: ${excessAmount.toLocaleString()} DA (exceeds max versement)`);
                        // Could show a warning to user about the excess amount
                    }
                } else {
                    console.error('❌ Could not find amount input or type select in new tranche');
                }
            } else {
                console.error('❌ Could not find last tranche');
            }

            // Update totals
            calculateTotalPaid();

            // Close modal and continue with form submission
            closeEspeceWarningModal({ preservePending: true });

            // Reset processing flag before continuing
            pendingEspeceData.isProcessing = false;

            // Store remaining versement amount for modal (use the actual versement amount created)
            if (versementAmount > 0) {
                pendingEspeceData.remainingVersement = versementAmount;
                console.log(`💳 Stored remaining versement: ${versementAmount.toLocaleString()} DA`);

                // Only show versement modal if we're not in the print reçu flow
                if (!pendingEspeceData.fromEspeceWarning) {
                    // Show versement modal after a short delay
                    setTimeout(() => {
                        showOrdreVersementConfirmModal();
                    }, 300);
                } else {
                    console.log('🎯 Skipping first ordre modal - will show after reçu is printed');
                }
            } else {
                // No versement tranche created - continue with form submission
                setTimeout(() => {
                    if (pendingEspeceData && pendingEspeceData.formData) {
                        console.log('🚀 Continuing form submission after split...');
                        continueFormSubmissionAfterModal();
                    }
                }, 200);
            }

        }, 100);
    } else {
        // No remaining amount - just close modal and continue
        calculateTotalPaid();
        closeEspeceWarningModal({ preservePending: true });

        // Reset processing flag
        pendingEspeceData.isProcessing = false;

        setTimeout(() => {
            if (pendingEspeceData && pendingEspeceData.formData) {
                console.log('🚀 Continuing form submission...');
                continueFormSubmissionAfterModal();
            }
        }, 100);
    }
}

// Function to continue form submission after modal interaction
function continueFormSubmissionAfterModal() {
    if (!pendingEspeceData) return;

    const { formData, isEdit, buyerId, submitBtn, originalText } = pendingEspeceData;

    // Show loading on submit button
    submitBtn.innerHTML = '<div class="loading-spinner"></div> ' + (isEdit ? 'Updating...' : 'Adding...');
    submitBtn.disabled = true;

    // Use the stored form data instead of re-collecting from DOM
    console.log('🚀 Using stored form data for submission:', formData);

    // Clear pending data after extracting what we need
    pendingEspeceData = null;

    // Call the actual form submission function with stored data
    setTimeout(() => {
        // Use the stored formData instead of re-collecting from DOM
        processFormSubmissionWithStoredData(formData, isEdit, buyerId, submitBtn, originalText);
    }, 50);
}

// Function to handle form submission with stored form data (used after modal interactions)
async function processFormSubmissionWithStoredData(formData, isEdit, buyerId, submitBtn, originalText) {
    try {
        console.log('📤 Submitting stored buyer data:', formData);

        // Close edit modal first (regardless of submission success)
        const editModal = document.getElementById('editBuyerModal');
        if (editModal) {
            editModal.style.display = 'none';
            console.log('✅ Closed edit modal before form submission');
        }

        // Submit to backend using the stored formData
        let result;
        if (isEdit) {
            result = await invoke('update_buyer', {
                buyerId: parseInt(buyerId),
                buyerData: formData
            });
        } else {
            result = await invoke('add_buyer', {
                buyerData: formData
            });
        }

        console.log('✅ Form submission successful:', result);

        // Show success message
        alert(isEdit ? 'Buyer updated successfully!' : 'Buyer added successfully!');

        // Reset form or reload buyers
        if (!isEdit) {
            const buyerForm = document.getElementById('buyerForm');
            if (buyerForm) buyerForm.reset();
            const tranchesContainer = document.getElementById('tranchesContainer');
            if (tranchesContainer) {
                tranchesContainer.innerHTML = '';
                addTranche(); // Add initial tranche
            }
        }

        // Reload buyers list
        loadBuyers();

    } catch (error) {
        console.error('❌ Error submitting form:', error);
        alert('Error: ' + error.message);
    } finally {
        // Reset submit button
        if (submitBtn) {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }
}

// Function to handle the actual form submission after validation
async function processFormSubmission(formData, isEdit, buyerId, submitBtn, originalText) {
    try {
        // Collect fresh tranches data after any modifications
        const tranchesContainer = document.getElementById('tranchesContainer');
        const tranches = {};
        let totalPaidAmount = 0;

        if (tranchesContainer && tranchesContainer.children.length > 0) {
            Array.from(tranchesContainer.children).forEach((row, index) => {
                if (row.classList.contains('payment-limits-display')) return;

                const amountInput = row.querySelector('input[name^="tranche_"]');
                const dateInput = row.querySelector('input[type="date"]');
                const typeSelect = row.querySelector('select[name^="tranche_"][name$="_type"]');
                const checkInput = row.querySelector('.check-input');

                if (amountInput && typeSelect) {
                    const value = parseFloat(amountInput.value) || 0;
                    const date = dateInput ? dateInput.value || null : null;
                    const type = typeSelect.value;
                    const checkNumber = checkInput ? checkInput.value.trim() : '';

                    if (value > 0) {
                        tranches[`T${index}`] = {
                            amount: value,
                            date: date,
                            type: type,
                            check_number: checkNumber || null
                        };
                        totalPaidAmount += value;
                    }
                }
            });
        }

        // Prepare buyer data with null checks
        const nomEl = document.getElementById('nom');
        const prenomEl = document.getElementById('prenom');
        const telephoneEl = document.getElementById('telephone');
        const typeOfLogtEl = document.getElementById('typeOfLogt');
        const typeLogtEl = document.getElementById('typeLogt');
        const surfaceEl = document.getElementById('surface');
        const prixTotaleEl = document.getElementById('prixTotale');
        const remiseEl = document.getElementById('remise');

        // More specific error checking
        const missingElements = [];
        if (!nomEl) missingElements.push('nom');
        if (!prenomEl) missingElements.push('prenom');
        if (!telephoneEl) missingElements.push('telephone');
        if (!typeLogtEl) missingElements.push('typeLogt');
        if (!surfaceEl) missingElements.push('surface');
        if (!prixTotaleEl) missingElements.push('prixTotale');

        if (missingElements.length > 0) {
            console.error('❌ Missing required form elements:', missingElements);
            console.error('Current DOM context:', document.title);
            console.error('Available form IDs:', Array.from(document.querySelectorAll('[id]')).map(el => el.id).filter(id => ['nom', 'prenom', 'telephone', 'typeLogt', 'surface', 'prixTotale'].includes(id)));
            throw new Error(`Missing required form elements: ${missingElements.join(', ')}`);
        }

        const buyerData = {
            nom: nomEl.value.trim(),
            prenom: prenomEl.value.trim(),
            telephone: telephoneEl.value.trim(),
            typeLogt: typeLogtEl.value,
            type_of_logt: document.getElementById('typeOfLogt').value,
            surface: parseFloat(surfaceEl.value),
            prixTotale: parseFloat(prixTotaleEl.value),
            remise: parseFloat(remiseEl?.value || 0),
            bloc: document.getElementById('bloc').value,
            appartementNumber: document.getElementById('appartementNumber').value.trim(),
            projectId: PROJECT_ID,
            payments: JSON.stringify(tranches),
            totalPaid: totalPaidAmount
        };

        console.log('📤 Submitting buyer data:', buyerData);

        // Submit to backend
        if (isEdit) {
            await invoke('update_buyer', {
                buyerId: parseInt(buyerId),
                buyerData: buyerData
            });
            console.log('✅ Buyer updated successfully');
        } else {
            await invoke('add_buyer', { buyerData: buyerData });
            console.log('✅ Buyer added successfully');
        }

        // Reset form and close modal
        document.getElementById('addBuyerForm').reset();
        document.getElementById('buyerModal').style.display = 'none';

        // Reload buyers table
        loadBuyers();

        // Reset submit button
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;

        console.log('✅ Form submission completed successfully');

    } catch (error) {
        console.error('❌ Error submitting form:', error);
        alert('Error saving buyer: ' + error.message);

        // Reset submit button
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

function acceptEspeceAndPrintRecu() {
    if (!pendingEspeceData) return;
    console.log('🖨️ Accept + Print Reçu flow started');

    // Mark that we're in the espèce warning modal flow to prevent duplicate ordre modal
    pendingEspeceData.fromEspeceWarning = true;

    // Perform split first (synchronously modifies existing tranche / adds new)
    const originalPending = { ...pendingEspeceData };
    let remainingAmount = originalPending.enteredAmount - originalPending.acceptedEspece;

    // Run core split logic but defer submission clearing
    acceptEspeceAdjustment();

    // Schedule printing after DOM updates - use modal system without index
    setTimeout(() => {
        try {
            console.log('🖨️ Printing reçu via user info modal');
            // Use the modal system for consistent user info collection
            printRecuVersement();
        } catch (e) {
            console.error('❌ Error printing reçu after split:', e);
        }
    }, 250);
}

// Utility: create or configure a versement tranche with retries
function createOrConfigureVersementTranche(amount, callback, attempt = 1) {
    const MAX_ATTEMPTS = 3;
    try {
        let newTranche = addTranche();
        if (!newTranche || !newTranche.classList.contains('tranche-row')) {
            const rows = Array.from(document.querySelectorAll('#tranchesContainer .tranche-row'));
            newTranche = rows[rows.length - 1];
        }
        if (!newTranche) throw new Error('No tranche row found after addTranche');
        const amountInput = newTranche.querySelector('input[name^="tranche_"]');
        const typeSelect = newTranche.querySelector('select[name^="tranche_"][name$="_type"]');
        const dateInput = newTranche.querySelector('input[type="date"]');
        if (!amountInput || !typeSelect) throw new Error('Missing inputs inside tranche row');
        amountInput.value = amount;
        typeSelect.value = 'versement';
        typeSelect.dispatchEvent(new Event('change', { bubbles: true }));
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
        console.log(`✅ Versement tranche created with amount ${amount}`);
        if (callback) callback(true);
    } catch (err) {
        console.warn(`⚠️ Attempt ${attempt} to create versement tranche failed:`, err.message);
        if (attempt < MAX_ATTEMPTS) {
            return setTimeout(() => createOrConfigureVersementTranche(amount, callback, attempt + 1), 80 * attempt);
        }
        if (callback) callback(false);
    }
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
            const amountInput = row.querySelector('input[name^="tranche_"]');
            const dateInput = row.querySelector('input[type="date"]');
            const typeSelect = row.querySelector('select[name^="tranche_"][name$="_type"]');
            const checkInput = row.querySelector('.check-input');

            if (amountInput && typeSelect) {
                const value = parseFloat(amountInput.value) || 0;
                const date = dateInput ? dateInput.value || null : null;
                const type = typeSelect.value;
                const checkNumber = checkInput ? checkInput.value.trim() : '';

                if (value > 0) {
                    tranches[`T${index}`] = {
                        amount: value,
                        date: date,
                        type: type,
                        check_number: checkNumber || null
                    };
                    totalPaidAmount += value;
                }
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

    console.log('🖨️ Preparing Reçu de Versement with user info modal');

    // Get buyer data for the receipt
    const surface = parseFloat(document.getElementById('surface').value) || 0;
    const nom = document.getElementById('nom').value || '';
    const prenom = document.getElementById('prenom').value || '';
    const bloc = document.getElementById('bloc').value || '';
    const logtNum = document.getElementById('logtNum').value || '';
    const projectTitle = document.getElementById('pageTitle')?.textContent || '136 logements promotionnels à EL TARF';

    // Prepare document data for the user info modal
    const documentData = {
        buyerName: nom,
        prenom: prenom,
        trancheIndex: 'Espèce',
        trancheAmount: pendingEspeceData.acceptedEspece,
        trancheDate: new Date().toISOString().split('T')[0],
        trancheType: 'espece',
        documentType: 'Reçu de Versement',
        documentTitle: 'REÇU DE VERSEMENT',
        apartmentType: 'Appartement',
        projectTitle: projectTitle,
        isEspeceWarningModal: true // Flag to identify this comes from espece warning modal
    };

    // Show user info modal to collect additional details
    showUserInfoModal(documentData);
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

    // Close edit modal if it exists
    const editModal = document.getElementById('editBuyerModal');
    if (editModal) {
        editModal.style.display = 'none';
        console.log('✅ Closed edit modal');
    }

    // Print the ordre de versement
    printOrdreVersementForRemaining();
}

function skipOrdreVersementPrint() {
    // Remove the confirmation modal
    const modal = document.getElementById('ordreVersementConfirmModal');
    if (modal) modal.remove();
    document.body.style.overflow = 'auto';

    // Close edit modal if it exists
    const editModal = document.getElementById('editBuyerModal');
    if (editModal) {
        editModal.style.display = 'none';
        console.log('✅ Closed edit modal');
    }

    // Proceed without printing - continue with form submission
    console.log('✅ Skipped Ordre de Versement print, continuing with form submission');
    setTimeout(() => {
        if (pendingEspeceData && pendingEspeceData.formData) {
            console.log('🚀 Continuing form submission after skipping versement print...');
            continueFormSubmissionAfterModal();
        }
    }, 100);
}
async function printOrdreVersementForRemaining() {
    if (!pendingEspeceData) return;

    console.log('🖨️ Printing Ordre de Versement for remaining amount');

    // Get buyer data for the order
    const surface = parseFloat(document.getElementById('surface').value) || 0;
    const nom = document.getElementById('nom').value || '';
    const prenom = document.getElementById('prenom').value || '';
    const bloc = document.getElementById('bloc').value || '';
    const logtNum = document.getElementById('logtNum').value || '';
    let typeLogt = document.getElementById('typeLogt').value || 'Appartement';

    // Get buyer ID to fetch their apartment type from project_info
    const form = document.getElementById('addBuyerForm');
    const buyerId = form?.getAttribute('data-buyer-id');

    console.log('🔍 Buyer ID for apartment type fetch:', buyerId);

    if (buyerId) {
        try {
            console.log('📡 Fetching buyer data for apartment type...');
            // Fetch buyer data to get their type_logt
            const buyerData = await invoke('get_buyer', { buyerId: parseInt(buyerId) });
            console.log('👤 Buyer data:', buyerData);

            if (buyerData && buyerData.type_logt) {
                console.log('🏠 Found buyer type_logt:', buyerData.type_logt);
                // Fetch project info to get apartment type details
                const projectId = getCurrentProjectId();
                console.log('🏗️ Project ID:', projectId);
                const projectInfo = await fetchProjectApartmentTypes(projectId);
                console.log('📋 Project info:', projectInfo);

                // Find the apartment type that matches the buyer's type_logt
                const apartmentTypeInfo = projectInfo.find(info => info.type_logt === buyerData.type_logt);
                if (apartmentTypeInfo) {
                    typeLogt = apartmentTypeInfo.type_logt;
                    console.log('✅ Found matching apartment type:', typeLogt);
                } else {
                    console.log('⚠️ No matching apartment type found in project info');
                    // Try using the buyer's type_logt directly
                    typeLogt = buyerData.type_logt;
                    console.log('🔄 Using buyer type_logt directly:', typeLogt);
                }
            } else {
                console.log('⚠️ No type_logt found in buyer data');
            }
        } catch (error) {
            console.error('❌ Error fetching apartment type from project_info:', error);
            // Fall back to form data if database fetch fails
            typeLogt = document.getElementById('typeLogt').value || 'Appartement';
        }
    } else {
        console.log('ℹ️ No buyer ID found, using form data');
        // For new buyers, get from form
        typeLogt = document.getElementById('typeLogt').value || 'Appartement';
    }

    console.log('🏠 Final apartment type:', typeLogt);

    // Generate reference number (current date + random)
    const currentDate = new Date();
    const refNumber = `N°${Math.floor(Math.random() * 100)}/2025`;

    // Get current project title
    const projectTitle = document.getElementById('pageTitle')?.textContent || '136 logements promotionnels à EL TARF';

    // Create and show printable order document - fullscreen and centered
    const screenWidth = window.screen.availWidth;
    const screenHeight = window.screen.availHeight;
    const left = (screenWidth - screenWidth) / 2;
    const top = (screenHeight - screenHeight) / 2;

    const orderWindow = window.open('', '_blank',
        `width=${screenWidth},height=${screenHeight},left=${left},top=${top},scrollbars=yes,resizable=yes`);

    orderWindow.document.write(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <title>Ordre de Versement</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    margin: 0;
                    padding: 20px; 
                    line-height: 1.4;
                    color: #000;
                    font-size: 14px;
                }
                .header { 
                    text-align: center; 
                    margin-bottom: 30px; 
                }
                .company-name {
                    font-size: 16px;
                    font-weight: bold;
                    margin-bottom: 8px;
                }
                .company-details {
                    font-size: 12px;
                    margin: 3px 0;
                }
                .document-title {
                    text-align: center;
                    font-size: 18px;
                    font-weight: bold;
                    margin: 30px 0;
                    text-decoration: underline;
                }
                .content {
                    margin: 25px 0;
                    font-size: 13px;
                    line-height: 1.6;
                }
                .amount-section {
                    margin: 25px 0;
                }
                .amount-large {
                    font-size: 16px;
                    font-weight: bold;
                    margin-bottom: 10px;
                }
                .observations {
                    border: 2px solid #000;
                    border-radius: 15px;
                    padding: 20px;
                    margin: 30px 0;
                }
                .observations-title {
                    font-weight: bold;
                    text-decoration: underline;
                    margin-bottom: 15px;
                }
                .footer {
                    margin-top: 30px;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                }
                .signature-section {
                    text-align: center;
                }
                .seal-area {
                    width: 150px;
                    height: 150px;
                    border: 2px solid #000;
                    border-radius: 50%;
                    margin: 0 auto;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    text-align: center;
                }
                @media print { 
                    body { margin: 0; padding: 20px; } 
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="company-name">PROMOTION IMMOBILIERE</div>
                <div class="company-name">FARTAS YAZID</div>
                <div class="company-details">Siège social : Cité 20 Août 1956 EL TARF Centre</div>
                <div class="company-details">Tel : 038 30 17 74</div>
            </div>

            <div class="ref-number">
                N° REF : ...... ${refNumber}
            </div>            <div class="document-title">
                ORDRE DE VIREMENT
            </div>            <div class="content">
                <p><strong>Mr : ${nom.toUpperCase()} ${prenom.toUpperCase()}</strong></p>
                
                <p><strong>EST REQUIS DE REGLER AU :</strong> PROMOTEUR « FARTAS YAZID »</p>
                
                <p><strong>PAR CHEQUE DE BANQUE OU PAR VIREMENT AU COMPTE N°:</strong><br>
                00100489-03-00001148/89 BNA Agence 489 EL-TARF</p>
                
                <div class="amount-section">
                    <p><strong>LA SOMME DE :</strong> <span class="amount-large">(En chiffres) ${pendingEspeceData.remainingVersement.toLocaleString().replace(/,/g, ' ')} DA</span></p>
                    
                    <p><strong>(En lettres) :</strong> ${numberToFrenchWords(pendingEspeceData.remainingVersement)} Dinars Algériens</p>
                </div>
                
                <p>Représentant le paiement de la première tranche de réservation d'un <strong>${typeLogt}</strong> du projet ${(projectTitle || '136 logements promotionnels à EL TARF').replace(/\s*-\s*Buyers\s*$/i, '')} à EL TARF</p>
            </div>            <div class="observations">
                <div class="observations-title">Observations :</div>
                <p>- Valable 15 jours, si le réservataire dépasse ce délai</p>
                <p>- Le promoteur se réserve le droit d'annuler la cession</p>
            </div>

            <div class="footer">
                <div class="date-location">
                    <p><strong>Fait à EL TARF LE :</strong> ${currentDate.toLocaleDateString('fr-FR')}</p>
                    
                </div>
                
                <div class="signature-section">
                    <p><strong>LE PROMOTEUR</strong></p>
                    <div class="seal-area">
                        <div>CACHET<br>ET<br>SIGNATURE</div>
                    </div>
                </div>
            </div>
            
            <script>
                window.onload = function() {
                    window.print();
                }
                
                // Handle print dialog events but don't auto-close
                window.addEventListener('beforeprint', function() {
                    console.log('Print dialog opened');
                });
                
                window.addEventListener('afterprint', function() {
                    console.log('Print dialog closed - window stays open');
                });
                
                // Optional: Add keyboard shortcut to close window manually
                window.addEventListener('keydown', function(event) {
                    if (event.key === 'Escape') {
                        window.close();
                    }
                });
            </script>
        </body>
        </html>
    `);
    orderWindow.document.close();

    // After showing the order, continue with form submission
    setTimeout(() => {
        console.log('✅ Ordre de Versement printed, continuing with form submission');

        // Close edit modal if it exists
        const editModal = document.getElementById('editBuyerModal');
        if (editModal) {
            editModal.style.display = 'none';
            console.log('✅ Closed edit modal after print');
        }

        if (pendingEspeceData && pendingEspeceData.formData) {
            console.log('🚀 Continuing form submission after versement print...');
            continueFormSubmissionAfterModal();
        }
    }, 1000);
}

// Helper function to convert numbers to French words (basic implementation)
function numberToFrenchWords(number) {
    // Basic number to words conversion for French
    // This is a simplified version - you might want to expand this
    const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
    const teens = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
    const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'];

    if (number === 0) return 'zéro';
    if (number < 10) return units[number];
    if (number < 20) return teens[number - 10];
    if (number < 100) {
        const ten = Math.floor(number / 10);
        const unit = number % 10;
        return tens[ten] + (unit > 0 ? '-' + units[unit] : '');
    }

    // For larger numbers, use a simplified approach
    if (number >= 1000000) {
        const millions = Math.floor(number / 1000000);
        const remainder = number % 1000000;
        let result = millions === 1 ? 'un million' : `${numberToFrenchWords(millions)} millions`;
        if (remainder > 0) {
            result += ' ' + numberToFrenchWords(remainder);
        }
        return result;
    }

    if (number >= 1000) {
        const thousands = Math.floor(number / 1000);
        const remainder = number % 1000;
        let result = thousands === 1 ? 'mille' : `${numberToFrenchWords(thousands)} mille`;
        if (remainder > 0) {
            result += ' ' + numberToFrenchWords(remainder);
        }
        return result;
    }

    if (number >= 100) {
        const hundreds = Math.floor(number / 100);
        const remainder = number % 100;
        let result = hundreds === 1 ? 'cent' : `${numberToFrenchWords(hundreds)} cent`;
        if (remainder > 0) {
            result += ' ' + numberToFrenchWords(remainder);
        }
        return result;
    }

    return number.toString(); // Fallback for complex numbers
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
window.numberToFrenchWords = numberToFrenchWords;

// Handle tranche input changes
function handleTrancheInput(inputElement) {
    const requestedAmount = parseFloat(inputElement.value) || 0;

    // Check versement overflow and adjust if needed
    const adjustedAmount = checkVersementOverflow(inputElement, requestedAmount);

    // Calculate total and validate
    calculateTotalPaid();
    // Removed real-time validation - only validate on form submission
    // validateTrancheAmount(inputElement);

    // Check espèce limits and update dropdown options
    updateTrancheTypeOptions();
}

// Handle tranche type changes
function handleTrancheTypeChange(selectElement) {
    calculateTotalPaid();

    // Show/hide check number and print container based on tranche type
    const trancheRow = selectElement.closest('.tranche-row');
    const checkContainer = trancheRow.querySelector('.check-number-and-print-container');
    const selectedType = selectElement.value;

    if (checkContainer) {
        if (selectedType === 'versement') {
            checkContainer.style.display = 'flex';
        } else {
            checkContainer.style.display = 'none';
            // Clear check number when switching to espèce
            const checkInput = checkContainer.querySelector('.check-input');
            if (checkInput) {
                checkInput.value = '';
            }
        }
    }

    // Trigger validation when type changes
    const amountInput = trancheRow.querySelector('input[name^="tranche_"]');
    if (amountInput) {
        validateTrancheAmount(amountInput);
    }

    // Update all tranche type options based on current limits
    updateTrancheTypeOptions();
}

// Update tranche type dropdown options based on espèce limits
function updateTrancheTypeOptions() {
    const surfaceEl = document.getElementById('surface');
    const prixTotaleEl = document.getElementById('prixTotale');
    const remiseEl = document.getElementById('remise');

    if (!surfaceEl || !prixTotaleEl || !remiseEl) return;

    const surface = parseFloat(surfaceEl.value) || 0;
    const prixTotale = parseFloat(prixTotaleEl.value) || 0;
    const remise = parseFloat(remiseEl.value) || 0;
    const prixUnitaire = currentPrixUnitaire || 0;

    // Check if this is a unit purchase (no profit margin)
    const isUnitPurchase = prixTotale === (surface * prixUnitaire);

    const tranchesContainer = document.getElementById('tranchesContainer');

    if (isUnitPurchase) {
        // Unit purchase - no restrictions, enable all options
        console.log('🏠 UNIT PURCHASE - Enabling all payment options');

        if (tranchesContainer) {
            Array.from(tranchesContainer.children).forEach(row => {
                const typeSelect = row.querySelector('select');

                if (typeSelect) {
                    const especeOption = typeSelect.querySelector('option[value="espece"]');
                    if (especeOption) {
                        especeOption.disabled = false;
                        especeOption.title = '';
                    }
                }
            });
        }
        return; // Exit early for unit purchases
    }

    // Regular purchase with profit margin - apply normal limits
    const reducedTotalPrice = prixTotale - (remise || 0);
    const maxVersement = prixUnitaire * surface;
    const maxEspece = reducedTotalPrice - maxVersement;

    // Calculate current total espèce amount
    let currentEspeceTotal = 0;

    if (tranchesContainer) {
        Array.from(tranchesContainer.children).forEach(row => {
            const amountInput = row.querySelector('input[name^="tranche_"]');
            const typeSelect = row.querySelector('select[name^="tranche_"][name$="_type"]');

            if (amountInput && typeSelect) {
                const value = parseFloat(amountInput.value) || 0;
                const type = typeSelect.value;

                if (type === 'espece' && value > 0) {
                    currentEspeceTotal += value;
                }
            }
        });
    }

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

    // Only disable espèce option if the current total has reached or exceeded the limit
    const especeLimitReached = currentEspeceTotal >= maxEspece;

    // Update all select dropdowns
    Array.from(tranchesContainer.children).forEach(row => {
        const typeSelect = row.querySelector('select');

        if (typeSelect) {
            const especeOption = typeSelect.querySelector('option[value="espece"]');

            // Disable espèce option when limit is reached, but allow existing espèce tranches to remain
            if (especeLimitReached && typeSelect.value !== 'espece') {
                especeOption.disabled = true;
                especeOption.title = `Limite espèce atteinte: ${maxEspece.toLocaleString()} DA`;
            } else {
                especeOption.disabled = false;
                especeOption.title = '';
            }
        }
    });
}

// Print Reçu de Chèque function
async function printRecuCheque(trancheIndex) {
    try {
        const form = document.getElementById('addBuyerForm');
        if (!form) {
            alert('No form found');
            return;
        }

        // Get buyer information from form inputs by ID
        const buyerName = document.getElementById('nom')?.value || 'N/A';
        const prenom = document.getElementById('prenom')?.value || '';

        // Get tranche information from FormData (these have name attributes)
        const formData = new FormData(form);
        const trancheAmount = formData.get(`tranche_${trancheIndex}`) || '0';
        const trancheDate = formData.get(`tranche_date_${trancheIndex}`) || new Date().toISOString().split('T')[0];
        const trancheType = formData.get(`tranche_type_${trancheIndex}`) || 'versement';
        const checkNumber = formData.get(`check_${trancheIndex}`) || '';

        if (!trancheAmount || parseFloat(trancheAmount) <= 0) {
            alert('Please enter a valid amount for this tranche before printing');
            return;
        }

        if (trancheType !== 'versement') {
            alert('Reçu de chèque can only be printed for "versement" type tranches');
            return;
        }

        if (!checkNumber.trim()) {
            alert('Please enter a check number before printing the receipt');
            return;
        }

        // Get current project info
        const projectTitle = document.getElementById('pageTitle')?.textContent || 'Project';

        // Generate the receipt
        generateRecuCheque(buyerName, prenom, trancheIndex, trancheAmount, trancheDate, checkNumber, projectTitle);

    } catch (error) {
        console.error('Error generating Reçu de Chèque:', error);
        alert('Error generating Reçu de Chèque: ' + error.message);
    }
}
// Compact French Check Receipt Document Generator - Single Page
function generateRecuCheque(buyerName, prenom, trancheIndex, amount, date, checkNumber, projectTitle) {
    const printWindow = window.open('', '_blank', 'width=800,height=1000,scrollbars=yes,resizable=yes');

    // Set window title to avoid 'about:blank'
    if (printWindow) {
        printWindow.document.title = `Reçu de Chèque - ${buyerName} ${prenom}`;
    }

    const currentDate = new Date();
    const paymentDate = date ? new Date(date) : currentDate;
    const refNumber = `RÇ${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}/2025`;

    // Convert number to French words (corrected)
    function numberToFrenchWords(num) {
        const ones = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
            'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
        const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'];

        if (num === 0) return 'zéro';

        function convertHundreds(n) {
            let result = '';

            // Handle hundreds
            if (n >= 100) {
                const hundreds = Math.floor(n / 100);
                if (hundreds === 1) {
                    result += 'cent';
                } else {
                    result += ones[hundreds] + ' cent';
                }

                // Add 's' to cent if it's plural and no remainder
                if (hundreds > 1 && n % 100 === 0) {
                    result += 's';
                }

                n %= 100;
                if (n > 0) result += ' ';
            }

            // Handle tens and ones
            if (n >= 20) {
                const tensDigit = Math.floor(n / 10);
                const onesDigit = n % 10;

                result += tens[tensDigit];

                // Special cases for French
                if (tensDigit === 7) { // 70-79
                    if (onesDigit === 1) {
                        result = result.replace('soixante-dix', 'soixante et onze');
                    } else if (onesDigit > 1) {
                        result += '-' + ones[10 + onesDigit];
                    }
                } else if (tensDigit === 9) { // 90-99
                    if (onesDigit === 1) {
                        result = result.replace('quatre-vingt-dix', 'quatre-vingt-onze');
                    } else if (onesDigit > 1) {
                        result += '-' + ones[10 + onesDigit];
                    }
                } else if (tensDigit === 8) { // 80-89
                    if (n === 80) {
                        result += 's'; // quatre-vingts
                    } else if (onesDigit > 0) {
                        result += '-' + ones[onesDigit];
                    }
                } else {
                    // Normal tens (20-69)
                    if (onesDigit === 1 && tensDigit > 1) {
                        result += ' et un';
                    } else if (onesDigit > 0) {
                        result += '-' + ones[onesDigit];
                    }
                }
            } else if (n > 0) {
                // Handle 1-19
                result += ones[n];
            }

            return result.trim();
        }

        if (num < 1000) {
            return convertHundreds(num);
        } else if (num < 1000000) {
            const thousands = Math.floor(num / 1000);
            const remainder = num % 1000;
            let result = '';

            if (thousands === 1) {
                result += 'mille';
            } else {
                result += convertHundreds(thousands) + ' mille';
            }

            if (remainder > 0) {
                result += ' ' + convertHundreds(remainder);
            }

            return result.trim();
        } else if (num < 1000000000) {
            const millions = Math.floor(num / 1000000);
            const remainder = num % 1000000;
            let result = '';

            if (millions === 1) {
                result += 'un million';
            } else {
                result += convertHundreds(millions) + ' million';
                if (millions > 1) result += 's';
            }

            if (remainder >= 1000) {
                const thousands = Math.floor(remainder / 1000);
                const final = remainder % 1000;

                if (thousands === 1) {
                    result += ' mille';
                } else {
                    result += ' ' + convertHundreds(thousands) + ' mille';
                }

                if (final > 0) {
                    result += ' ' + convertHundreds(final);
                }
            } else if (remainder > 0) {
                result += ' ' + convertHundreds(remainder);
            }

            return result.trim();
        } else {
            return 'montant très élevé';
        }
    }

    const amountInWords = numberToFrenchWords(Math.floor(parseFloat(amount)));

    const htmlContent = `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reçu de Chèque N° ${refNumber}</title>
            <style>
                @page {
                    size: A4;
                    margin: 15mm;
                }
                
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body { 
                    font-family: 'Times New Roman', serif; 
                    font-size: 13px;
                    line-height: 1.3;
                    color: #000;
                    background: white;
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                }
                
                .document-container {
                    flex: 1;
                    border: 3px solid #2c3e50;
                    border-radius: 8px;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    max-height: 100vh;
                    overflow: hidden;
                }
                
                .header { 
                    text-align: center; 
                    border-bottom: 2px solid #2c3e50; 
                    padding-bottom: 15px;
                    margin-bottom: 15px;
                    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                    border-radius: 6px;
                    padding: 15px;
                }
                

                
                .company-name { 
                    font-size: 18px; 
                    font-weight: bold; 
                    margin: 8px 0 5px 0; 
                    color: #2c3e50;
                    text-transform: uppercase;
                }
                
                .company-details {
                    font-size: 11px;
                    margin: 2px 0;
                    color: #5d6d7e;
                }
                
                .document-title { 
                    font-size: 22px; 
                    font-weight: bold; 
                    margin: 15px 0; 
                    text-decoration: underline;
                    text-align: center;
                    color: #2c3e50;
                    text-transform: uppercase;
                }
                
                .reference-section {
                    display: flex;
                    justify-content: space-between;
                    margin: 10px 0;
                    font-size: 12px;
                    font-weight: 600;
                    background: #f8f9fa;
                    padding: 8px;
                    border-radius: 4px;
                }
                
                .content {
                    flex: 1;
                    margin: 10px 0;
                    font-size: 14px;
                    line-height: 1.4;
                }
                
                .main-text {
                    text-align: center;
                    font-size: 15px;
                    font-weight: 600;
                    margin: 15px 0;
                    color: #2c3e50;
                    background: #ecf0f1;
                    padding: 12px;
                    border-radius: 6px;
                    border-left: 4px solid #3498db;
                }
                
                .client-name {
                    font-size: 18px;
                    font-weight: bold;
                    color: #e74c3c;
                    margin: 8px 0;
                    text-transform: uppercase;
                }
                
                .payment-details {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                    margin: 15px 0;
                    font-size: 13px;
                }
                
                .detail-item {
                    background: #f8f9fa;
                    padding: 8px;
                    border-radius: 4px;
                    border-left: 3px solid #3498db;
                }
                
                .detail-label {
                    font-weight: 600;
                    color: #2c3e50;
                    font-size: 12px;
                }
                
                .detail-value {
                    font-weight: bold;
                    color: #27ae60;
                    margin-top: 2px;
                }
                
                .amount-section { 
                    margin: 15px 0; 
                    padding: 15px; 
                    border: 3px solid #e74c3c; 
                    background: linear-gradient(135deg, #fff5f5, #fef2f2);
                    text-align: center;
                    border-radius: 8px;
                }
                
                .amount-header {
                    font-size: 16px;
                    font-weight: bold;
                    color: #c0392b;
                    margin-bottom: 8px;
                }
                
                .amount-row { 
                    font-size: 20px; 
                    font-weight: bold; 
                    margin: 8px 0; 
                    color: #2c3e50;
                    padding: 8px;
                    background: white;
                    border-radius: 4px;
                }
                
                .amount-words {
                    font-size: 13px;
                    font-style: italic;
                    color: #5d6d7e;
                    margin-top: 8px;
                }
                
                .date-location {
                    text-align: right;
                    font-size: 13px;
                    font-weight: 600;
                    margin: 10px 0 5px 0;
                    color: #2c3e50;
                }
                
                .footer { 
                    display: flex; 
                    justify-content: space-between;
                    align-items: flex-end;
                    margin-top: 10px;
                    padding-top: 10px;
                    border-top: 1px solid #dee2e6;
                }
                
                .signature-section {
                    text-align: center;
                    width: 160px;
                }
                
                .signature-title {
                    font-size: 11px;
                    font-weight: bold;
                    color: #2c3e50;
                    margin-bottom: 5px;
                    text-transform: uppercase;
                }
                
                .signature-box { 
                    width: 140px; 
                    height: 50px;
                    border: 2px solid #2c3e50; 
                    border-radius: 4px;
                    margin: 5px auto;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #f8f9fa;
                    font-size: 9px;
                    color: #6c757d;
                    font-style: italic;
                }
                
                .signature-name {
                    font-size: 9px;
                    color: #6c757d;
                    margin-top: 3px;
                }
                
                @media print {
                    body { 
                        margin: 0; 
                        padding: 0;
                        height: 297mm;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .document-container {
                        border: 2px solid #2c3e50;
                        height: 100%;
                        page-break-inside: avoid;
                        overflow: visible;
                    }
                }
                
                @media screen {
                    body {
                        background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
                        padding: 20px;
                        min-height: 100vh;
                    }
                }
            </style>
        </head>
        <body>
            <div class="document-container">
                <div class="header">
                    <div class="company-name">PROMOTION IMMOBILIÈRE FARTAS YAZID</div>
                    <div class="company-details">Siège Social: Cité 20 Août 1956, El Tarf Centre - 36000</div>
                    <div class="company-details">Tél: 038 30 17 74 | NIF: 098765432109876</div>
                </div>
                
                <div class="reference-section">
                    <div><strong>Réf:</strong> ${refNumber}</div>
                    <div><strong>Date:</strong> ${currentDate.toLocaleDateString('fr-FR')}</div>
                </div>
                
                <div class="document-title">REÇU DE CHÈQUE</div>
                
                <div class="content">
                    <div class="main-text">
                        Je soussigné <strong>Mr. FARTAS YAZID</strong>, gérant de<br>
                        <strong>PROMOTION IMMOBILIÈRE FARTAS YAZID</strong><br>
                        <strong>ATTESTE AVOIR REÇU</strong> de:
                    </div>
                    
                    <div style="text-align: center;">
                        <div class="client-name">${buyerName.toUpperCase()} ${prenom.toUpperCase()}</div>
                        <div style="font-size: 13px; color: #6c757d; margin-bottom: 15px;">Client - Acquéreur</div>
                    </div>
                    
                    <div class="payment-details">
                        <div class="detail-item">
                            <div class="detail-label">Projet:</div>
                            <div class="detail-value">${projectTitle}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Tranche:</div>
                            <div class="detail-value">T${trancheIndex}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">N° Chèque:</div>
                            <div class="detail-value">${checkNumber}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Date remise:</div>
                            <div class="detail-value">${paymentDate.toLocaleDateString('fr-FR')}</div>
                        </div>
                    </div>
                    
                    <div class="amount-section">
                        <div class="amount-header">MONTANT REÇU</div>
                        <div class="amount-row">
                            ${parseFloat(amount).toLocaleString('fr-FR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })} DA
                        </div>
                        <div class="amount-words">
                            <strong>En lettres:</strong> ${amountInWords} dinars algériens exactement.
                        </div>
                    </div>
                    
                    <div style="text-align: center; font-size: 14px; margin: 15px 0; padding: 10px; background: #f8f9fa; border-radius: 6px;">
                        Un chèque bancaire en règlement partiel pour l'acquisition d'un logement<br>
                        dans le cadre de notre projet immobilier.
                    </div>
                    
                    <div style="font-size: 12px; text-align: justify; margin: 8px 0; color: #5d6d7e; background: #fffbf0; padding: 6px; border-radius: 4px;">
                        <strong>Note:</strong> Ce reçu fait foi du versement effectué. Le chèque sera présenté à l'encaissement 
                        selon les termes convenus dans le contrat de vente.
                    </div>
                </div>
                
                <div class="date-location">
                    <strong>El Tarf, le ${currentDate.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    })}</strong>
                </div>
                
                <div class="footer">
                    <div class="signature-section">
                        <div class="signature-title">Le Client</div>
                        <div class="signature-box">Signature & Date</div>
                        <div class="signature-name">${buyerName.toUpperCase()}<br>${prenom.toUpperCase()}</div>
                    </div>
                    
                    <div class="signature-section">
                        <div class="signature-title">Le Promoteur</div>
                        <div class="signature-box">Cachet & Signature</div>
                        <div class="signature-name">FARTAS YAZID<br>Gérant</div>
                    </div>
                </div>
            </div>
            
            <script>
                window.onload = function() {
                    // Center the window
                    if (window.screen) {
                        const left = Math.max(0, (screen.width - 800) / 2);
                        const top = Math.max(0, (screen.height - 1000) / 2);
                        window.moveTo(left, top);
                    }
                    
                    // Auto-print
                    setTimeout(function() {
                        window.print();
                    }, 800);
                };
                
                // Handle print completion
                window.onafterprint = function() {
                    if (confirm('Impression terminée. Fermer cette fenêtre ?')) {
                        window.close();
                    }
                };
            </script>
        </body>
        </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();

    if (!printWindow || printWindow.closed) {
        alert('La fenêtre d\'impression a été bloquée. Veuillez autoriser les pop-ups pour ce site.');
    }
}

// Make printRecuCheque function globally accessible
window.printRecuCheque = printRecuCheque;

// Utility function to calculate maxEspece safely (never negative)
function calculateMaxEspece(reducedTotalPrice, maxVersement) {
    return Math.max(0, reducedTotalPrice - maxVersement);
}

// User Information Modal Functions
let pendingDocumentData = null;

function showUserInfoModal(documentData) {
    pendingDocumentData = documentData;
    const modal = document.getElementById('userInfoModal');
    if (modal) {
        // Clear previous form data
        const form = document.getElementById('userInfoForm');
        if (form) {
            form.reset();
        }

        // Show modal
        modal.style.display = 'block';

        // Focus on first input
        setTimeout(() => {
            const firstInput = document.getElementById('birthDate');
            if (firstInput) {
                firstInput.focus();
            }
        }, 100);
    }
}

function closeUserInfoModal() {
    const modal = document.getElementById('userInfoModal');
    if (modal) {
        modal.style.display = 'none';
        pendingDocumentData = null;

        // Clear form
        const form = document.getElementById('userInfoForm');
        if (form) {
            form.reset();
        }
    }
}

function generateRecuWithUserInfo() {
    if (!pendingDocumentData) {
        alert('Aucune donnée de document en attente');
        return;
    }

    // Get form values
    const gender = document.getElementById('gender').value.trim();
    const birthDate = document.getElementById('birthDate').value.trim();
    const birthPlace = document.getElementById('birthPlace').value.trim();
    const nationalCardNumber = document.getElementById('nationalCardNumber').value.trim();
    const issueDate = document.getElementById('issueDate').value.trim();
    const issuePlace = document.getElementById('issuePlace').value.trim();

    // Validate required fields
    if (!gender || !birthDate || !birthPlace || !nationalCardNumber || !issueDate || !issuePlace) {
        alert('Veuillez remplir tous les champs obligatoires');
        return;
    }

    // Validate date formats (basic validation)
    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!dateRegex.test(birthDate)) {
        alert('Format de date de naissance invalide. Utilisez JJ/MM/AAAA');
        document.getElementById('birthDate').focus();
        return;
    }

    if (!dateRegex.test(issueDate)) {
        alert('Format de date de délivrance invalide. Utilisez JJ/MM/AAAA');
        document.getElementById('issueDate').focus();
        return;
    }

    // Create additional info object
    const additionalInfo = {
        gender: gender,
        birthDate: birthDate,
        birthPlace: birthPlace,
        nationalCardNumber: nationalCardNumber,
        issueDate: issueDate,
        issuePlace: issuePlace
    };

    // Generate document with additional info
    const {
        buyerName,
        prenom,
        trancheIndex,
        trancheAmount,
        trancheDate,
        trancheType,
        documentType,
        documentTitle,
        apartmentType,
        projectTitle,
        isEspeceWarningModal
    } = pendingDocumentData;

    try {
        generateFrenchRecuVersement(
            buyerName,
            prenom,
            trancheIndex,
            trancheAmount,
            trancheDate,
            trancheType,
            documentType,
            documentTitle,
            apartmentType,
            projectTitle,
            additionalInfo
        );

        // Close modal after successful generation
        closeUserInfoModal();

        // If this came from the espece warning modal, continue with the flow
        if (isEspeceWarningModal && pendingEspeceData) {
            console.log('📋 Continuing espece warning modal flow after recu generation');

            // Check if there's remaining versement amount and we're not from espèce warning modal
            setTimeout(() => {
                if (pendingEspeceData.remainingVersement > 0) {
                    if (pendingEspeceData.fromEspeceWarning) {
                        // Coming from espèce warning flow - show ordre modal after reçu is printed
                        console.log('✅ Receipt printed from espèce warning flow, showing ordre de versement modal');
                    } else {
                        console.log('✅ Receipt printed, no espèce warning flow context');
                    }
                    showOrdreVersementConfirmModal();
                } else {
                    // No remaining amount, splitting already handled
                    console.log('✅ Receipt printed, no remaining versement');
                }
            }, 1000);
        }

    } catch (error) {
        console.error('Error generating recu with user info:', error);
        alert('Erreur lors de la génération du document: ' + error.message);
    }
}

// Add event listeners for modal functionality
document.addEventListener('DOMContentLoaded', function () {
    // Close modal when clicking outside
    const modal = document.getElementById('userInfoModal');
    if (modal) {
        modal.addEventListener('click', function (event) {
            if (event.target === modal) {
                closeUserInfoModal();
            }
        });
    }

    // Handle Enter key for form submission
    const form = document.getElementById('userInfoForm');
    if (form) {
        form.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                generateRecuWithUserInfo();
            }
        });
    }

    // Auto-format date inputs
    const dateInputs = ['birthDate', 'issueDate'];
    dateInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('input', function (event) {
                let value = event.target.value.replace(/\D/g, ''); // Remove non-digits
                if (value.length >= 2 && value.length < 4) {
                    value = value.substring(0, 2) + '/' + value.substring(2);
                } else if (value.length >= 4) {
                    value = value.substring(0, 2) + '/' + value.substring(2, 4) + '/' + value.substring(4, 8);
                }
                event.target.value = value;
            });
        }
    });
});

// Print Reservation Document Function
async function printReservationDocument() {
    // Instead of generating the document immediately, show the info modal
    showReservationInfoModal();
}

// Show Reservation Info Modal
function showReservationInfoModal() {
    const modal = document.getElementById('reservationInfoModal');
    if (modal) {
        modal.style.display = 'block';

        // Focus on first input
        setTimeout(() => {
            const firstInput = modal.querySelector('input');
            if (firstInput) {
                firstInput.focus();
            }
        }, 100);
    }
}

// Close Reservation Info Modal
function closeReservationInfoModal() {
    const modal = document.getElementById('reservationInfoModal');
    if (modal) {
        modal.style.display = 'none';

        // Clear form
        const form = document.getElementById('reservationInfoForm');
        if (form) {
            form.reset();
        }
    }
}
// Generate Reservation with Additional Info
function generateReservationWithInfo() {
    try {
        console.log('🔍 Starting reservation document generation...');

        // Validate required fields with unique IDs
        const requiredFields = ['reservationBirthDate', 'reservationBirthPlace', 'reservationNationalId', 'reservationIdIssueDate', 'reservationIdIssuePlace', 'typeOfBankReservation', 'typeOfCheck'];
        let isValid = true;
        let missingFields = [];

        for (const fieldId of requiredFields) {
            const field = document.getElementById(fieldId);
            console.log(`Checking field ${fieldId}:`, field ? `"${field.value}"` : 'FIELD NOT FOUND');

            if (!field) {
                console.error(`❌ Field with ID "${fieldId}" not found in DOM!`);
                isValid = false;
                missingFields.push(fieldId + ' (not found)');
            } else if (!field.value || !field.value.trim()) {
                console.error(`❌ Field "${fieldId}" is empty or only whitespace`);
                isValid = false;
                missingFields.push(fieldId + ' (empty)');
                field.style.borderColor = '#dc3545';
                if (field.focus) field.focus();
            } else {
                console.log(`✅ Field "${fieldId}" is valid: "${field.value.trim()}"`);
                field.style.borderColor = '#e9ecef';
            }
        }

        if (!isValid) {
            console.error('❌ Validation failed. Missing fields:', missingFields);
            alert('يرجى ملء جميع الحقول المطلوبة\nMissing: ' + missingFields.join(', '));
            return;
        }

        console.log('✅ All fields validated successfully!');

        // Collect additional info
        const additionalInfo = {
            birthDate: document.getElementById('reservationBirthDate').value.trim(),
            birthPlace: document.getElementById('reservationBirthPlace').value.trim(),
            nationalId: document.getElementById('reservationNationalId').value.trim(),
            idIssueDate: document.getElementById('reservationIdIssueDate').value.trim(),
            idIssuePlace: document.getElementById('reservationIdIssuePlace').value.trim(),
            typeOfBank: document.getElementById('typeOfBankReservation').value.trim(),
            typeOfCheck: document.getElementById('typeOfCheck').value.trim()
        };

        console.log('📋 Additional Info for Reservation:', additionalInfo);

        // Get buyer data from the form
        const buyerData = {
            nom: document.getElementById('nom')?.value || '',
            prenom: document.getElementById('prenom')?.value || '',
            bloc: document.getElementById('bloc')?.value || '',
            niveau: document.getElementById('niveau')?.value || '',
            logtNum: document.getElementById('logtNum')?.value || '',
            typeLogt: document.getElementById('typeLogt')?.value || '',
            type_of_logt: document.getElementById('typeOfLogt')?.value || '',
            surface: document.getElementById('surface')?.value || '',
            prixTotale: document.getElementById('prixTotale')?.value || '',
            date: document.getElementById('date')?.value || new Date().toISOString().split('T')[0],
            payments: {} // Initialize payments object
        };

        // Collect tranches data from form
        const tranchesContainer = document.getElementById('tranchesContainer');
        if (tranchesContainer) {
            Array.from(tranchesContainer.children).forEach((row, index) => {
                const amountInput = row.querySelector('input[name^="tranche_"]');
                const dateInput = row.querySelector('input[type="date"]');
                const typeSelect = row.querySelector('select[name*="type"]');

                if (amountInput && amountInput.value) {
                    const amount = parseFloat(amountInput.value) || 0;
                    const date = dateInput?.value || null;
                    const type = typeSelect?.value || 'versement';

                    if (amount > 0) {
                        buyerData.payments[`T${index}`] = {
                            amount: amount,
                            date: date,
                            type: type
                        };
                    }
                }
            });
        }

        // Create print content with additional info
        const printContent = generateReservationDocument(buyerData, additionalInfo);

        // Create print window
        const printWindow = window.open('', '_blank', `width=${screen.width},height=${screen.height},left=0,top=0,resizable=yes,scrollbars=yes,toolbar=yes,menubar=yes,location=yes,status=yes`);
        if (!printWindow) {
            alert('تعذر فتح نافذة الطباعة. يرجى التأكد من السماح للنوافذ المنبثقة.');
            return;
        }

        printWindow.document.write(printContent);
        printWindow.document.close();

        // Print after content loads
        printWindow.onload = function () {
            printWindow.focus();
            printWindow.print();

            // Close print window after printing
            printWindow.onafterprint = function () {
                printWindow.close();
            };
        };

        // Close the modal
        closeReservationInfoModal();

        console.log('Reservation document generated with additional info:', additionalInfo);

    } catch (error) {
        console.error('Error generating reservation with info:', error);
        alert('حدث خطأ في إنشاء الوثيقة. يرجى المحاولة مرة أخرى.');
    }
}

// Arabic Number to Text Conversion
function convertNumberToArabicText(num) {
    if (num === 0) return "صفر";

    const ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
    const tens = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
    const teens = ["عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
    const hundreds = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

    function convertHundreds(n) {
        let result = "";

        const h = Math.floor(n / 100);
        const t = Math.floor((n % 100) / 10);
        const o = n % 10;

        if (h > 0) {
            result += hundreds[h];
            if (t > 0 || o > 0) result += " و ";
        }

        if (t === 1) {
            result += teens[o];
        } else {
            if (t > 0) {
                result += tens[t];
                if (o > 0) result += " و ";
            }
            if (o > 0 && t !== 1) {
                result += ones[o];
            }
        }

        return result.trim();
    }

    if (num < 1000) {
        return convertHundreds(num);
    } else if (num < 1000000) {
        const thousands = Math.floor(num / 1000);
        const remainder = num % 1000;
        let result = "";

        if (thousands === 1) {
            result = "ألف";
        } else if (thousands === 2) {
            result = "ألفان";
        } else if (thousands < 11) {
            result = convertHundreds(thousands) + " آلاف";
        } else {
            result = convertHundreds(thousands) + " ألف";
        }

        if (remainder > 0) {
            result += " و " + convertHundreds(remainder);
        }

        return result.trim();
    } else if (num < 1000000000) {
        const millions = Math.floor(num / 1000000);
        const remainder = num % 1000000;
        let result = "";

        if (millions === 1) {
            result = "مليون";
        } else if (millions === 2) {
            result = "مليونان";
        } else if (millions < 11) {
            result = convertHundreds(millions) + " ملايين";
        } else {
            result = convertHundreds(millions) + " مليون";
        }

        if (remainder >= 1000) {
            const thousands = Math.floor(remainder / 1000);
            const ones = remainder % 1000;
            if (thousands === 1) {
                result += " و ألف";
            } else if (thousands === 2) {
                result += " و ألفان";
            } else {
                result += " و " + convertHundreds(thousands) + " ألف";
            }
            if (ones > 0) {
                result += " و " + convertHundreds(ones);
            }
        } else if (remainder > 0) {
            result += " و " + convertHundreds(remainder);
        }

        return result.trim();
    }

    return num.toString(); // Fallback for very large numbers
}

// Generate Reservation Document HTML
function generateReservationDocument(buyerData, additionalInfo = {}) {
    const currentDate = new Date().toLocaleDateString('ar-DZ');

    // Get first tranche amount
    let firstTrancheAmount = 0;
    if (buyerData.payments && typeof buyerData.payments === 'object') {
        // Check for T0 first, then T1, etc.
        for (let i = 0; i <= 10; i++) {
            const trancheKey = `T${i}`;
            if (buyerData.payments[trancheKey]) {
                const trancheData = buyerData.payments[trancheKey];
                if (typeof trancheData === 'object' && trancheData.amount > 0) {
                    firstTrancheAmount = trancheData.amount;
                    break;
                } else if (typeof trancheData === 'number' && trancheData > 0) {
                    firstTrancheAmount = trancheData;
                    break;
                }
            }
        }
    }

    // If no first tranche found, use a portion of total price as fallback
    if (firstTrancheAmount === 0 && buyerData.prixTotale) {
        firstTrancheAmount = parseFloat(buyerData.prixTotale) * 0.2; // 20% as default first tranche
    }

    const amountInArabic = convertNumberToArabicText(Math.floor(firstTrancheAmount));

    return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            @page {
                margin: 15mm;
                size: A4;
            }
            body {
                font-family: 'Arial', sans-serif;
                line-height: 1.6;
                margin: 0;
                padding: 15px;
                direction: rtl;
                text-align: right;
                font-size: 14px;
            }
            .header {
                text-align: center;
                margin-bottom: 20px;
                border-bottom: 2px solid #333;
                padding-bottom: 12px;
            }
            .company-info {
                font-size: 14px;
                line-height: 1.4;
            }
            .document-title {
                font-size: 24px;
                font-weight: bold;
                margin: 20px 0;
                text-align: center;
                text-decoration: underline;
            }
            .content {
                font-size: 16px;
                line-height: 1.6;
                margin: 15px 0;
            }
            .buyer-details {
                background-color: #f9f9f9;
                padding: 6px;
                border-radius: 5px;
                margin: 15px 0;
                font-size: 16px;
            }
            .signature-section {
                margin-top: 30px;
                display: flex;
                justify-content: space-between;
            }
            .signature-box {
                text-align: center;
                width: 200px;
            }
            .date {
                text-align: left;
                margin-top: 20px;
                font-size: 12px;
            }
            .amount {
                font-weight: bold;
                color: #2c5aa0;
                font-size: 16px;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="company-info">
                <strong>مؤسسة الترقية العقارية</strong><br>
                فرطاس يزيد<br>
                عنوان الترقية: حي 20 وحدة 56 مقابل مركز التكوين المهني<br>
                بلدية : دائرة ، ولاية الطارف<br>
                رقم الاعتماد الوزاري : 3601P3895<br>
                السجل التجاري: 36/01-3423747 106<br>
                رقم الهاتف: 038 30 17 74<br>
                التاريخ: ${currentDate}
            </div>
        </div>

        <div class="document-title">
            إشهـــــــــــــــاد
        </div>

        <div class="content">
            <p>أنا الممضي أسفله السيد فرطاس يزيد صاحب مؤسسة الترقية العقارية الكائن مركزها بالعنوان التالي:</p>
            <p>حي 20 أوت 56 مقابل مركز التكوين المهني بالطارف مركز</p>
            
            <p><strong>أشهد بأنني استلمت بتاريخ</strong> ${buyerData.date} <strong>من السيد:</strong> ${buyerData.prenom} ${buyerData.nom}</p>
            
            <div class="buyer-details">
                <p><strong>المولــــــود بتـــــاريخ:</strong> ${additionalInfo.birthDate || '_______________'} <strong>بـــ:</strong> ${additionalInfo.birthPlace || '_______________'}</p>
                <p><strong>الحامل لبطاقة الهوية رقم:</strong> ${additionalInfo.nationalId || '_______________'}</p>
                <p><strong>الصادرة عن دائرة:</strong> ${additionalInfo.idIssuePlace || '_______________'} <strong>بتاريخ:</strong> ${additionalInfo.idIssueDate || '_______________'}</p>
                <p><strong>مبلغا ماليا قدره:</strong> <span class="amount">${firstTrancheAmount.toLocaleString()} د.ج</span></p>
                <div class="amount-in-words"><strong> (بالأحرف) ${amountInArabic} دينار جزائري</strong></div>
                <p><strong>${getBankText(additionalInfo.typeOfBank)}  عن طريق صك ${additionalInfo.typeOfCheck} وفقا لوصل الدفع رقم: VE 2-0117 بتاريخ: 2016/04/26</strong></p>
            </div>

            <p><strong>و ذلك لغرض تخصيص شقة من نوع ${buyerData.typeLogt} في الطابق ${buyerData.niveau} بمساحة ${buyerData.surface} في الجناح ${buyerData.bloc}, و المترتبة عن انجاز مشروع 136 سكن ترقوي المتواجد ببلدية الطارف</strong></p>

            <p><strong>أن المبلغ المذكور يعد تسبيقا على ثمن بيع الشقة و الذي سوف يتم حسابه لاحقا بعد الانتهاء من جميع عمليات البناء و التهيئة.</strong></p>
            <p><strong>ان تحديد الشقة المعنية يبقى مؤقت و قابل لأي تعديل إلى حين المصادقة على مخطط التجزئة من قبل المصالح المخولة.</strong></p>
            <p><strong>الطارف في:</strong> ${currentDate}</p>
        </div>

        <div class="signature-section">
            <div class="signature-box">
                <p><strong>الإمضاء:</strong></p>
            </div>
        </div>
    </body>
    </html>
    `;
}

// Add event listener for print reservation button
document.addEventListener('DOMContentLoaded', function () {
    const printReservationBtn = document.getElementById('printReservationBtn');
    const printReservationBtn2 = document.getElementById('printReservationBtn2');

    console.log('Searching for print buttons...');
    console.log('Button 1:', printReservationBtn);
    console.log('Button 2:', printReservationBtn2);

    if (printReservationBtn) {
        console.log('Adding event listener to button 1');
        printReservationBtn.addEventListener('click', showReservationInfoModal);
    }

    if (printReservationBtn2) {
        console.log('Adding event listener to button 2');
        printReservationBtn2.addEventListener('click', function () {
            console.log('Print button 2 clicked!');
            showReservationInfoModal();
        });
    }

    if (!printReservationBtn && !printReservationBtn2) {
        console.error('NO PRINT BUTTONS FOUND!');
    }
});

// Show/hide facture button depending on typeLogt / typeOfLogt
function _updateFactureButtonVisibility() {
    const factureBtn = document.getElementById('printFactureBtn');
    if (!factureBtn) return;

    const typeLogt = document.getElementById('typeLogt')?.value || '';
    const typeOfLogt = document.getElementById('typeOfLogt')?.value || '';
    const normalized = (typeLogt + '|' + typeOfLogt).toLowerCase();
    // Always show the facture button now
    factureBtn.style.display = 'inline-block';
}

// Call visibility update when apartment type fields change
document.addEventListener('DOMContentLoaded', () => {
    const typeSelect = document.getElementById('typeLogt');
    const typeOfLogtSelect = document.getElementById('typeOfLogt');
    if (typeSelect) typeSelect.addEventListener('change', _updateFactureButtonVisibility);
    if (typeOfLogtSelect) typeOfLogtSelect.addEventListener('change', _updateFactureButtonVisibility);
    // initial run
    setTimeout(_updateFactureButtonVisibility, 200);

    // Hook facture button
    const factureBtn = document.getElementById('printFactureBtn');
    if (factureBtn) factureBtn.addEventListener('click', printFactureFromModal);
});

function _calcTotals(tranches) {
    const total = tranches.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    return total;
}

function _buildFactureHtml({ buyerName, bloc, logtNum, typeLogt, surface, prixTotal, tranches }) {
    const surfaceNum = parseFloat(surface) || 1;

    // Get prix unitaire from global variable (loaded from project settings)
    const prixUnitaireFromSettings = currentPrixUnitaire || 0;

    // TTC = maxVersement (this is the known value)
    const ttc = prixUnitaireFromSettings * surfaceNum;

    // Determine TVA rate based on apartment type
    // 9% TVA for apartments (appartement, F*, appart)
    // 19% TVA for other types (terrain, lot, etc.)
    const typeLogtLower = (typeLogt || '').toLowerCase();
    const isApartment = typeLogtLower.includes('appartement') ||
        typeLogtLower.includes('appart') ||
        /f\d+/i.test(typeLogt || ''); // Matches F1, F2, F3, etc.

    const tvaRate = isApartment ? 0.09 : 0.19;
    const tvaMultiplier = 1 + tvaRate; // 1.09 for apartments, 1.19 for others

    // Work backwards from TTC to get HT and Prix U
    // TTC = HT + (HT × tvaRate) = HT × tvaMultiplier
    // Therefore: HT = TTC ÷ tvaMultiplier
    const ht = parseFloat((ttc / tvaMultiplier).toFixed(2));

    // Prix U = HT ÷ Surface
    const prixUnitaire = parseFloat((ht / surfaceNum).toFixed(2));

    // TVA = TTC - HT
    const tva = parseFloat((ttc - ht).toFixed(2));

    // Generate unique invoice number
    const currentDate = new Date();
    const invoiceNumber = `${currentDate.getFullYear()}${String(currentDate.getMonth() + 1).padStart(2, '0')}${String(currentDate.getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;

    // Build the invoice HTML matching the exact format provided
    return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Facture</title>
    <style>
        @page { 
            size: A4; 
            margin: 15mm; 
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: Arial, sans-serif;
            font-size: 12px;
            line-height: 1.4;
            color: #000;
            background: white;
        }
        
        .invoice-container {
            width: 100%;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            border: 2px solid #000;
            background: white;
        }
        
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 30px;
            border-bottom: 1px solid #000;
            padding-bottom: 15px;
        }
        
        .company-info {
            flex: 1;
        }
        
        .logo {
            width: 120px;
            height: 80px;
            background: #2c5530;
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            margin-bottom: 10px;
        }
        
        .logo .company-name {
            font-size: 14px;
            margin-bottom: 5px;
        }
        
        .logo .tagline {
            font-size: 8px;
            text-align: center;
        }
        
        .company-details {
            font-size: 10px;
            line-height: 1.3;
        }
        
        .invoice-info {
            text-align: right;
            flex: 1;
        }
        
        .invoice-title {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 10px;
            text-align: center;
            border: 2px solid #000;
            padding: 10px;
            background: #f8f8f8;
        }
        
        .invoice-details {
            margin-top: 20px;
            margin-bottom: 30px;
        }
        
        .invoice-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        
        .invoice-table th,
        .invoice-table td {
            border: 1px solid #000;
            padding: 8px;
            text-align: center;
            vertical-align: middle;
        }
        
        .invoice-table th {
            background: #f0f0f0;
            font-weight: bold;
            font-size: 11px;
        }
        
        .invoice-table td {
            font-size: 11px;
        }
        
        .designation-cell {
            text-align: left;
            padding-left: 10px;
        }
        
        .amount-cell {
            text-align: right;
            padding-right: 10px;
            font-weight: bold;
        }
        
        .totals-section {
            margin-top: 20px;
            display: flex;
            justify-content: flex-end;
        }
        
        .totals-table {
            border-collapse: collapse;
            margin-left: auto;
        }
        
        .totals-table td {
            border: 1px solid #000;
            padding: 5px 15px;
            font-weight: bold;
        }
        
        .totals-table .label {
            background: #f0f0f0;
            text-align: left;
        }
        
        .totals-table .amount {
            text-align: right;
            min-width: 120px;
        }
        
        .signature-section {
            margin-top: 40px;
            text-align: center;
        }
        
        .signature-title {
            font-weight: bold;
            text-decoration: underline;
            margin-bottom: 60px;
        }
        
        @media print {
            body {
                margin: 0;
                padding: 0;
            }
            
            .invoice-container {
                border: none;
                padding: 0;
                margin: 0;
                max-width: none;
            }
            
            @page {
                margin: 15mm;
            }
        }
    </style>
</head>
<body>
    <div class="invoice-container">
        <!-- Header Section -->
        <div class="header">
            <div class="company-info">
                <div class="logo">
                    <div class="company-name">FARTAS YAZID</div>
                    <div class="tagline">TOGETHER WE BUILD THE FUTURE</div>
                </div>
                <div class="company-details">
                    <strong>Adresse :</strong> ELTARF CENTRE wilaya d'ELTARF &nbsp;&nbsp; <strong>R.C.N° :</strong>36/00-3423747A06<br>
                    <strong>NIF :</strong> 198236080007631 <strong>NIS :</strong> 18236080007634 <strong>AI.N° :</strong> 36010068154<br>
                    <strong>N° Compte :</strong> 00300811113916300058 <strong>BADR ELTARF</strong>
                </div>
            </div>
            <div class="invoice-info">
                <div style="text-align: right; font-size: 10px;">
                    ELTARF LE: ${currentDate.toLocaleDateString('fr-FR')}
                </div>
            </div>
        </div>
        
        <!-- Invoice Title -->
        <div class="invoice-title">
            FACTURE N° ${invoiceNumber}
        </div>
        
        <!-- Invoice Details -->
        <div class="invoice-details">
            <strong>DOIT :</strong>
        </div>
        
        <!-- Invoice Table -->
        <table class="invoice-table">
            <thead>
                <tr>
                    <th style="width: 5%;">N°</th>
                    <th style="width: 45%;">DESIGNATION</th>
                    <th style="width: 10%;">UNITE</th>
                    <th style="width: 15%;">SURFACE</th>
                    <th style="width: 15%;">PRIX U</th>
                    <th style="width: 15%;">MONTANT</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>1</td>
                    <td class="designation-cell">
                        Lot de terrain prés à batis à Sidi<br>
                        Belgacem w ELTARF
                    </td>
                    <td>M²</td>
                    <td>${surfaceNum.toFixed(2)}</td>
                    <td class="amount-cell">${prixUnitaire.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td class="amount-cell">${ht.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
            </tbody>
        </table>
        
        <!-- Totals Section -->
        <div class="totals-section">
            <table class="totals-table">
                <tr>
                    <td class="label">HT</td>
                    <td class="amount">${ht.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                    <td class="label">TVA ${Math.round(tvaRate * 100)}%</td>
                    <td class="amount">${tva.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                    <td class="label">TTC</td>
                    <td class="amount">${ttc.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
            </table>
        </div>
        
        <!-- Signature Section -->
        <div class="signature-section">
            <div class="signature-title">LE PROMOTEUR</div>
        </div>
    </div>
    
    <script>
        window.onload = function() {
            window.print();
        }
        
        window.addEventListener('afterprint', function() {
            console.log('Print dialog closed - window stays open');
        });
    </script>
</body>
</html>`;
}

function printFactureFromModal() {
    const nom = document.getElementById('nom')?.value || '';
    const prenom = document.getElementById('prenom')?.value || '';
    const buyerName = [nom, prenom].filter(Boolean).join(' ') || '—';
    const bloc = document.getElementById('bloc')?.value || '';
    const logtNum = document.getElementById('logtNum')?.value || '';
    const typeLogt = document.getElementById('typeLogt')?.value || document.getElementById('typeOfLogt')?.value || '';
    const surface = document.getElementById('surface')?.value || '';
    const prixTotal = parseFloat(document.getElementById('prixTotale')?.value) || 0;

    // Build simple tranche lines using existing tranches; for facture we approximate unit price
    const trancheEls = Array.from(document.querySelectorAll('#tranchesContainer .tranche-row'));
    const tranches = trancheEls.map((row, idx) => {
        const labelEl = row.querySelector('label');
        const amountEl = row.querySelector('input[type="number"]');
        const dateEl = row.querySelector('input[type="date"]');
        const label = labelEl ? labelEl.textContent.replace(':', '').trim() : `L${idx + 1}`;
        const amount = parseFloat(amountEl?.value) || 0;
        return { label, amount, date: dateEl?.value };
    });

    const html = _buildFactureHtml({ buyerName, bloc, logtNum, typeLogt, surface, prixTotal, tranches });
    const w = window.open('', '_blank');
    if (!w) { alert('Impossible d\'ouvrir la fenêtre d\'impression. Autorisez les popups.'); return; }
    w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 500);
}

// --- Payment summary (French) printing helpers ---

function __formatDA(n) {
    if (isNaN(n)) return '0 DA';
    return Number(n).toLocaleString('fr-FR') + ' DA';
}

function __escapeHtml(s) {
    return String(s || '').replace(/[&<>"]+/g, function (m) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[m]; });
}

function __buildPaymentSummaryHtml({ buyerName, bloc, logtNum, typeLogt, surface, prixTotal, tranches }) {
    const totalTranches = tranches.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    const headerTitle = 'Récapitulatif des paiements';
    const projectTitle = (document.getElementById('pageTitle')?.textContent || '').trim();

    const rowsHtml = tranches.map(t => {
        const rawType = (t.type || '').toString();
        const displayType = rawType === 'versement' ? 'Virment' : (rawType === 'espece' ? 'Virment E' : rawType);
        return `<tr>
                <td style="padding:6px;border:1px solid #ccc">${__escapeHtml(t.label)}</td>
                <td style="padding:6px;border:1px solid #ccc;text-align:right">${__formatDA(t.amount)}</td>
                <td style="padding:6px;border:1px solid #ccc">${__escapeHtml(t.date || '')}</td>
                <td style="padding:6px;border:1px solid #ccc">${__escapeHtml(displayType)}</td>
            </tr>`;
    }).join('\n');

    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${__escapeHtml(headerTitle)}</title>
<style>
    body{font-family: Arial, sans-serif; margin:20px; color:#111}
    h1{font-size:18px; text-align:center; margin-bottom:8px}
    .meta{margin:10px 0 18px 0}
    .meta div{margin:2px 0}
    table{width:100%; border-collapse:collapse; margin-bottom:12px}
    th,td{border:1px solid #444; padding:8px; text-align:left}
    th{background:#f2f2f2}
    tfoot td{font-weight:bold}
    .right{ text-align:right }
    @media print { @page { size: A4; margin: 15mm } }
</style>
</head>
<body>
    <h1>${__escapeHtml(headerTitle)}</h1>
    <div class="meta">
        <div><strong>Projet :</strong> ${__escapeHtml(projectTitle)}</div>
        <div><strong>Réservataire :</strong> ${__escapeHtml(buyerName)}</div>
        <div><strong>Bloc / N° Logt :</strong> ${__escapeHtml(bloc)} - ${__escapeHtml(logtNum)}</div>
        <div><strong>Type d'appartement :</strong> ${__escapeHtml(typeLogt || '')} &nbsp; <strong>Surface :</strong> ${__escapeHtml(surface || '')}</div>
        <div><strong>Prix Total :</strong> ${__formatDA(prixTotal)}</div>
    </div>

        <table>
            <thead>
                <tr>
                    <th style="text-align:center">Tranche</th>
                    <th style="text-align:center">Montant</th>
                    <th style="text-align:center">Date</th>
                    <th style="text-align:center">Type</th>
                </tr>
            </thead>
        <tbody>
            ${rowsHtml || `<tr><td colspan="4" style="padding:8px;text-align:center">Aucune tranche</td></tr>`}
        </tbody>
        <tfoot>
            <tr>
                <td style="padding:8px">Total des tranches</td>
                <td style="padding:8px;text-align:right">${__formatDA(totalTranches)}</td>
                <td></td>
                <td></td>
            </tr>
            <tr>
                <td style="padding:8px">Prix total</td>
                <td style="padding:8px;text-align:right">${__formatDA(prixTotal)}</td>
                <td></td>
                <td></td>
            </tr>
        </tfoot>
    </table>

    <div style="margin-top:18px; font-size:12px; color:#555">Généré : ${new Date().toLocaleString('fr-FR')}</div>
</body>
</html>`;

    return html;
}

function printPaymentSummaryFromModal() {
    const nom = document.getElementById('nom')?.value || '';
    const prenom = document.getElementById('prenom')?.value || '';
    const buyerName = [nom, prenom].filter(Boolean).join(' ') || '—';
    const bloc = document.getElementById('bloc')?.value || '';
    const logtNum = document.getElementById('logtNum')?.value || '';
    const typeLogt = document.getElementById('typeLogt')?.value || document.getElementById('typeOfLogt')?.value || '';
    const surface = document.getElementById('surface')?.value || '';
    const prixTotal = parseFloat(document.getElementById('prixTotale')?.value) || 0;

    const trancheEls = Array.from(document.querySelectorAll('#tranchesContainer .tranche-row'));
    const tranches = trancheEls.map((row, idx) => {
        const labelEl = row.querySelector('label');
        const amountEl = row.querySelector('input[type="number"]');
        const dateEl = row.querySelector('input[type="date"]');
        const typeEl = row.querySelector('select');
        const label = labelEl ? labelEl.textContent.replace(':', '').trim() : `T${idx}`;
        const amount = parseFloat(amountEl?.value) || 0;
        const date = dateEl?.value || '';
        const type = typeEl?.value || '';
        return { label, amount, date, type };
    });

    const html = __buildPaymentSummaryHtml({ buyerName, bloc, logtNum, typeLogt, surface, prixTotal, tranches });

    const w = window.open('', '_blank');
    if (!w) { alert('Impossible d\'ouvrir la fenêtre d\'impression. Autorisez les popups.'); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 500);
}

// Hook the top button after DOM ready
document.addEventListener('DOMContentLoaded', () => {
    const topBtn = document.getElementById('printPaymentSummaryTopBtn');
    if (topBtn) topBtn.addEventListener('click', printPaymentSummaryFromModal);
});

// Make functions globally accessible
window.showUserInfoModal = showUserInfoModal;
window.closeUserInfoModal = closeUserInfoModal;
window.generateRecuWithUserInfo = generateRecuWithUserInfo;
window.showReservationInfoModal = showReservationInfoModal;
window.closeReservationInfoModal = closeReservationInfoModal;
window.generateReservationWithInfo = generateReservationWithInfo;

function getBankText(bankName) {
    if (!bankName) {
        return 'مدفوعا لدى بنك الفلاحة والتنمية الريفية'; // Default text
    }
    const lowerCaseBankName = bankName.toLowerCase();
    if (lowerCaseBankName === 'badr') {
        return 'مدفوعا لدى بنك الفلاحة والتنمية الريفية';
    } else if (lowerCaseBankName === 'bna') {
        return 'مدفوعا لدى البنك الوطني الجزائري';
    } else {
        return `مدفوعا لدى ${bankName}`;
    }
}

// Function to print payment summary
async function printPaymentSummary(buyerId) {
    console.log('Attempting to print payment summary for buyer ID:', buyerId);
    // Further implementation will go here
}

// Event listener for the new print summary button
document.addEventListener('DOMContentLoaded', function () {
    const printSummaryButton = document.getElementById('printPaymentSummaryBtn');
    if (printSummaryButton) {
        printSummaryButton.addEventListener('click', async () => {
            const buyerModal = document.getElementById('buyerModal');
            const buyerId = buyerModal.getAttribute('data-buyer-id');
            if (buyerId) {
                await printPaymentSummary(parseInt(buyerId));
            } else {
                alert('No buyer selected for printing summary.');
            }
        });
    }

    // ... existing code ...
});

// Excel Export Functionality
async function exportToExcel() {
    try {
        console.log('🔄 Starting Excel export...');

        // Get current project information
        const projectTitle = document.getElementById('pageTitle')?.textContent || 'Project Data';
        const cleanProjectTitle = projectTitle.replace(/\s*-\s*Buyers?\s*$/i, '').trim();

        // Get all buyers data (visible and filtered)
        const allBuyers = await invoke('get_buyers_by_project', { projectId: PROJECT_ID });

        if (!allBuyers || allBuyers.length === 0) {
            alert('No buyer data available to export.');
            return;
        }

        // Get project details
        const projectDetails = await invoke('get_projects');
        const currentProject = projectDetails.find(p => p.id === PROJECT_ID);

        console.log(`📊 Exporting ${allBuyers.length} buyers for project: ${cleanProjectTitle}`);

        // Create a new workbook
        const workbook = XLSX.utils.book_new();

        // Prepare project summary data
        const projectSummary = [
            ['PROJECT SUMMARY', '', '', ''],
            ['Project Name:', cleanProjectTitle, '', ''],
            ['Location:', currentProject?.project_location || 'N/A', '', ''],
            ['Total Apartments:', currentProject?.nombre_des_appartement || 'N/A', '', ''],
            ['Sold Apartments:', allBuyers.length, '', ''],
            ['Start Date:', currentProject?.project_start_date ? new Date(currentProject.project_start_date).toLocaleDateString() : 'N/A', '', ''],
            ['End Date:', currentProject?.project_end_date ? new Date(currentProject.project_end_date).toLocaleDateString() : 'N/A', '', ''],
            ['Export Date:', new Date().toLocaleDateString(), '', ''],
            ['', '', '', ''], // Empty row
        ];

        // Prepare buyers data with headers
        const buyersData = [
            // Headers
            [
                'ID',
                'Bloc',
                'Level',
                'Apartment',
                'Full Name',
                'Apartment Type',
                'Surface (m²)',
                'Purchase Date',
                'Total Price (DA)',
                'Discount (DA)',
                'Final Price (DA)',
                'Total Paid (DA)',
                'Remaining (DA)',
                'Payment Status',
                'Payment Details'
            ]
        ];

        // Add buyer rows
        allBuyers.forEach((buyer, index) => {
            let payments = {};
            try {
                payments = typeof buyer.payments === 'string' ? JSON.parse(buyer.payments) : buyer.payments || {};
            } catch (e) {
                console.warn('Error parsing payments for buyer', buyer.id, e);
            }

            // Calculate financial details
            const totalPrice = parseFloat(buyer.prix_totale) || 0;
            const discount = parseFloat(buyer.remise) || 0;
            const finalPrice = totalPrice - discount;
            const totalPaid = parseFloat(buyer.total_paid) || 0;
            const remaining = finalPrice - totalPaid;

            // Format payment details
            const paymentDetails = Object.keys(payments).map(trancheKey => {
                const trancheData = payments[trancheKey];
                let amount = 0;
                let type = 'versement';
                let date = '';

                if (typeof trancheData === 'object' && trancheData !== null) {
                    amount = parseFloat(trancheData.amount) || 0;
                    type = trancheData.type || 'versement';
                    date = trancheData.date || '';
                } else {
                    amount = parseFloat(trancheData) || 0;
                }

                if (amount > 0) {
                    return `${trancheKey}: ${amount.toLocaleString()} DA (${type})${date ? ' - ' + date : ''}`;
                }
                return null;
            }).filter(Boolean).join('; ');

            buyersData.push([
                buyer.id,
                buyer.bloc,
                buyer.niveau,
                buyer.logt_num,
                `${buyer.nom} ${buyer.prenom}`,
                buyer.type_logt,
                buyer.surface,
                new Date(buyer.date).toLocaleDateString(),
                totalPrice.toLocaleString(),
                discount.toLocaleString(),
                finalPrice.toLocaleString(),
                totalPaid.toLocaleString(),
                remaining.toLocaleString(),
                buyer.payment_status,
                paymentDetails || 'No payments recorded'
            ]);
        });

        // Combine project summary and buyers data
        const combinedData = [...projectSummary, ...buyersData];

        // Create worksheet
        const worksheet = XLSX.utils.aoa_to_sheet(combinedData);

        // Set column widths for better formatting
        const columnWidths = [
            { wch: 8 },   // ID
            { wch: 8 },   // Bloc
            { wch: 8 },   // Level
            { wch: 12 },  // Apartment
            { wch: 20 },  // Full Name
            { wch: 15 },  // Apartment Type
            { wch: 12 },  // Surface
            { wch: 12 },  // Purchase Date
            { wch: 15 },  // Total Price
            { wch: 12 },  // Discount
            { wch: 15 },  // Final Price
            { wch: 15 },  // Total Paid
            { wch: 15 },  // Remaining
            { wch: 15 },  // Payment Status
            { wch: 50 }   // Payment Details
        ];
        worksheet['!cols'] = columnWidths;

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Buyers Data');

        // Generate filename with project name and date
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
        const filename = `${cleanProjectTitle.replace(/[^a-zA-Z0-9]/g, '_')}_Buyers_${dateStr}.xlsx`;

        // Write and download the file
        XLSX.writeFile(workbook, filename);

        console.log(`✅ Excel export completed: ${filename}`);

        // Show success message
        setTimeout(() => {
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #28a745;
                color: white;
                padding: 15px 25px;
                border-radius: 8px;
                z-index: 10000;
                font-size: 14px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                display: flex;
                align-items: center;
                gap: 10px;
            `;
            notification.innerHTML = `
                <i class="fas fa-check-circle"></i>
                <span>Excel file exported successfully!<br><small>${filename}</small></span>
            `;
            document.body.appendChild(notification);

            setTimeout(() => notification.remove(), 5000);
        }, 500);

    } catch (error) {
        console.error('❌ Error exporting to Excel:', error);
        alert('Error exporting to Excel: ' + error.message);
    }
}

// Initialize Excel export functionality
document.addEventListener('DOMContentLoaded', function() {
    const exportButton = document.getElementById('exportToExcelButton');
    if (exportButton) {
        exportButton.addEventListener('click', exportToExcel);
        console.log('✅ Excel export button initialized');
    }
});

// Print Bordereau d'Envoi function
async function printBordereauEnvoi(trancheIndex) {
    try {
        const form = document.getElementById('addBuyerForm');
        if (!form) {
            alert('No form found');
            return;
        }

        // Get buyer information from form inputs by ID
        const buyerName = document.getElementById('nom')?.value || 'N/A';
        const prenom = document.getElementById('prenom')?.value || '';

        // Get tranche information from FormData
        const formData = new FormData(form);
        const trancheAmount = formData.get(`tranche_${trancheIndex}`) || '0';
        const trancheDate = formData.get(`tranche_date_${trancheIndex}`) || new Date().toISOString().split('T')[0];
        const trancheType = formData.get(`tranche_type_${trancheIndex}`) || 'versement';
        const checkNumber = formData.get(`check_${trancheIndex}`) || '';

        if (!trancheAmount || parseFloat(trancheAmount) <= 0) {
            alert('Please enter a valid amount for this tranche before printing');
            return;
        }

        if (trancheType !== 'versement') {
            alert('Bordereau d\'envoi can only be printed for "versement" type tranches');
            return;
        }

        if (!checkNumber.trim()) {
            alert('Please enter a check number before printing the bordereau d\'envoi');
            return;
        }

        // Get current project info
        const projectTitle = document.getElementById('pageTitle')?.textContent || 'Project';

        // Generate the bordereau d'envoi
        generateBordereauEnvoi(buyerName, prenom, trancheIndex, trancheAmount, trancheDate, checkNumber, projectTitle);

    } catch (error) {
        console.error('Error generating Bordereau d\'Envoi:', error);
        alert('Error generating Bordereau d\'Envoi: ' + error.message);
    }
}

// Generate Bordereau d'Envoi Document
function generateBordereauEnvoi(buyerName, prenom, trancheIndex, amount, date, checkNumber, projectTitle) {
    const printWindow = window.open('', '_blank', 'width=800,height=1000,scrollbars=yes,resizable=yes');

    // Set window title
    if (printWindow) {
        printWindow.document.title = `Bordereau d'Envoi - ${buyerName} ${prenom}`;
    }

    const currentDate = new Date();
    const paymentDate = date ? new Date(date) : currentDate;
    const refNumber = `N°02/08/PROMO 2025`;

    const htmlContent = `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Bordereau d'Envoi</title>
            <style>
                @page {
                    size: A4;
                    margin: 8mm;
                }

                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }

                body {
                    font-family: 'Times New Roman', serif;
                    font-size: 14px;
                    line-height: 1.4;
                    color: #000;
                    background: white;
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                }

                .document-container {
                    flex: 1;
                    padding: 10px;
                    display: flex;
                    flex-direction: column;
                    max-height: 100vh;
                }

                .header {
                    text-align: center; 
                    margin-bottom: 20px;
                }

                .company-name {
                    font-size: 20px;
                    font-weight: bold;
                    margin-bottom: 10px;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                }

                .company-address {
                    font-size: 14px;
                    margin-bottom: 20px;
                }

                .document-ref {
                    text-align: left;
                    margin-bottom: 15px;
                    font-size: 12px;
                }

                .document-title {
                    font-size: 24px;
                    font-weight: bold;
                    text-align: center;
                    margin: 20px 0;
                    text-decoration: underline;
                    letter-spacing: 1px;
                }

                .destination {
                    text-align: center;
                    font-size: 16px;
                    margin: 10px 0;
                }

                .bank-name {
                    font-size: 18px;
                    font-weight: bold;
                    margin: 10px 0;
                }

                .table-container {
                    margin: 20px 0 10px 0;
                    flex: 1;
                }

                .items-table {
                    width: 100%;
                    border-collapse: collapse;
                    border: 2px solid #000;
                }

                .items-table th,
                .items-table td {
                    border: 1px solid #000;
                    padding: 12px 8px;
                    text-align: center;
                    vertical-align: middle;
                }

                .items-table th {
                    background: #f0f0f0;
                    font-weight: bold;
                    font-size: 14px;
                }

                .items-table td {
                    font-size: 13px;
                    height: 60px;
                }

                .designation-cell {
                    text-align: left;
                    padding-left: 8px;
                }

                .footer-section {
                    margin-top: 15px;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    height: 80px;
                }

                .signature-section {
                    text-align: center;
                    width: 200px;
                }

                .signature-title {
                    font-size: 14px;
                    font-weight: bold;
                    margin-bottom: 20px;
                    text-decoration: underline;
                }

                @media print {
                    body {
                        margin: 0;
                        padding: 0;
                        height: 297mm;
                    }
                    .document-container {
                        height: 100%;
                        page-break-inside: avoid;
                    }
                }
            </style>
        </head>
        <body>
            <div class="document-container">
                <div class="header">
                    <div class="company-name">PROMOTION FARTAS Yazid</div>
                    <div class="company-address">Siège Social : El-Tarf</div>
                </div>

                <div class="document-ref">
                    EL-TARF Le : ${currentDate.toLocaleDateString('fr-FR')}. ${refNumber}
                </div>

                <div class="document-title">Bordereau d'Envoi</div>

                <div class="destination">
                    <div>A</div>
                    <div class="bank-name">BADR EL-TARF</div>
                </div>

                <div class="table-container">
                    <table class="items-table">
                        <thead>
                            <tr>
                                <th style="width: 8%;">N°</th>
                                <th style="width: 60%;">Désignation</th>
                                <th style="width: 12%;">Nbre</th>
                                <th style="width: 20%;">Observations</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>01</td>
                                <td class="designation-cell">
                                    Chèque BDL N° <strong>${checkNumber}</strong><br>
                                    <strong>Montant: ${parseFloat(amount).toLocaleString('fr-FR', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2
                                    })} DA</strong><br>
                                    <strong>Client: ${buyerName.toUpperCase()} ${prenom.toUpperCase()}</strong><br>
                                </td>
                                <td>01</td>
                                <td></td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="footer-section">
                    <div class="signature-section">
                        <div class="signature-title">BADR EL-TARF</div>
                    </div>

                    <div class="signature-section">
                        <div class="signature-title">LE PROMOTEUR</div>
                    </div>
                </div>
            </div>

            <script>
                window.onload = function() {
                    // Center the window
                    if (window.screen) {
                        const left = Math.max(0, (screen.width - 800) / 2);
                        const top = Math.max(0, (screen.height - 1000) / 2);
                        window.moveTo(left, top);
                    }

                    // Auto-print
                    setTimeout(function() {
                        window.print();
                    }, 800);
                };

                // Handle print completion
                window.onafterprint = function() {
                    if (confirm('Impression terminée. Fermer cette fenêtre ?')) {
                        window.close();
                    }
                };
            </script>
        </body>
        </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
}

// Make printBordereauEnvoi function globally accessible
window.printBordereauEnvoi = printBordereauEnvoi;