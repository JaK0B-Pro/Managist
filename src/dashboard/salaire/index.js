const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;
const { getCurrentWindow } = window.__TAURI__.window;

// Undo stack to store recent actions
let undoStack = [];
const MAX_UNDO_ACTIONS = 10; // Keep last 10 actions
let employeeBeforeEdit = null; // Store employee data before editing for undo

// Role-based access control check
function checkPageAccess() {
    const storedUser = localStorage.getItem('currentUser');
    console.log('Stored user data:', storedUser); // Debug log
    
    if (storedUser) {
        try {
            const userObject = JSON.parse(storedUser);
            console.log('Parsed user object:', userObject); // Debug log
              // Try multiple ways to get the role for compatibility
            const role = userObject.role || userObject.admin || '0';
            console.log('Detected role:', role, 'Type:', typeof role); // Debug log
            console.log('Role comparison: role === "1":', role === '1', 'role === 1:', role === 1); // Debug log
            
            // Only admin (role 1) can access salary page
            // Manager (role 2) and Employee (role 0) cannot access
            if (role === '1' || role === 1) {
                console.log('Access granted for admin user'); // Debug log
                return true;
            } else {
                console.log('Access denied. User role:', role, 'Required: 1 (Admin)'); // Debug log
                alert(`Access denied. You do not have permission to view this page. Your role: ${role}`);
                window.location.href = '../index.html';
                return false;
            }
        } catch (error) {
            console.error('Error checking user role:', error);
            alert('Error checking user permissions. Please log in again.');
            window.location.href = '../index.html';
            return false;
        }
    } else {
        console.log('No user data found in localStorage'); // Debug log
        alert('Please log in to access this page.');
        window.location.href = '../index.html';
        return false;
    }
}

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
            window.location.href = "../";
        });
    }
});

document.addEventListener('DOMContentLoaded', async function() {
    // Check access control
    const hasAccess = checkPageAccess();
    if (!hasAccess) return;
    
    // Display current user name in header
    displayCurrentUserName();
    
    // Set initial amounts to 0
    const balSalaire = document.getElementById('balance-salaire');
    const balAcompte = document.getElementById('balance-acompte');
    const balNet     = document.getElementById('balance-net');
    if (balSalaire) balSalaire.textContent = '0,00 DA';
    if (balAcompte) balAcompte.textContent = '0,00 DA';
    if (balNet)     balNet.textContent     = '0,00 DA';
    // Get modal elements
    const modal = document.getElementById('addEmployeeModal');
    const addButton = document.getElementById('ajouter-un-emploee-button');
    const closeButton = document.querySelector('.close');
    const cancelButton = document.querySelector('.cancel-btn');
    const saveButton = document.querySelector('.save-btn');
    const employeeForm = document.getElementById('employeeForm');
    const modeDeSaisierButton = document.getElementById('mode-de-saisir-button');
    const projectSelector = document.getElementById('project-selector');
    const yearSelector = document.getElementById('year-selector');
    const monthSelector = document.getElementById('month-selector');

    // Initialize year and month selectors
    initializeDateSelectors();
    
    // Load employees from database when page loads (default to administration)
    await loadEmployeesByProject('administration');
    
    // Load projects into the dropdown
    await loadProjects();

    // Set up event listener for database updates
    await listen('employees-data', (event) => {
        const employees = event.payload;
        updateEmployeeTable(employees);
    });

    // Open modal when add button is clicked
    addButton.addEventListener('click', function() {
        modal.style.display = 'block';
    });


    // open modal when modeDeSaisier button is clicked
    modeDeSaisierButton.addEventListener('click', async function() {
        // Open the mode de saisir modal instead of the regular add modal
        const modeDeSaisirModal = document.getElementById('modeDeSaisirModal');
        
        // Load projects into the dropdown
        await loadModeSaisirProjects();
        
        // Set the current project as default selection
        const currentProject = getCurrentSelectedProject();
        const modeSaisirProjectSelect = document.getElementById('modeSaisirProject');
        if (currentProject && currentProject !== 'recap' && currentProject !== 'recap_chantier') {
            modeSaisirProjectSelect.value = currentProject;
        }
        
        modeDeSaisirModal.style.display = 'block';
    });


    // Close modal when close button is clicked
    closeButton.addEventListener('click', function() {
        modal.style.display = 'none';
    });

    // Close modal when cancel button is clicked
    cancelButton.addEventListener('click', function() {
        modal.style.display = 'none';
    });

    // Close modal when clicking outside the modal
    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });    
    
    // Handle year/month selection change
    yearSelector.addEventListener('change', async function() {
        await reloadCurrentView();
    });

    monthSelector.addEventListener('change', async function() {
        await reloadCurrentView();
    });

    // Handle project selection change
    projectSelector.addEventListener('change', async function() {
        const selectedProject = this.value;
        if (selectedProject) {
            console.log(`Selected project: ${selectedProject}`);
            
            // Hide filter checkbox when not in recap view
            const filterContainer = document.getElementById('recap-filter-container');
            if (filterContainer && selectedProject !== 'recap') {
                filterContainer.style.display = 'none';
            }
            
            if (selectedProject === 'recap') {
                await loadEmployeesRecap();
            } else if (selectedProject === 'recap_chantier') {
                await loadRecapChantier();
            } else {
                await loadEmployeesByProject(selectedProject);
            }
        }
    });

    // Handle checkbox for showing all employees in recap view
    const showAllCheckbox = document.getElementById('show-all-employees-checkbox');
    if (showAllCheckbox) {
        showAllCheckbox.addEventListener('change', function() {
            if (currentRecapData && currentRecapProjects) {
                displayEmployeesRecapTable(currentRecapData, currentRecapProjects, this.checked);
            }
        });
    }

    // Handle form submission
    saveButton.addEventListener('click', async function() {
        if (employeeForm.checkValidity()) {
            // Get form values
            const nom_et_prenom = document.getElementById('nomPrenom').value;
            const prix_jour = parseInt(document.getElementById('prixJour').value);
            const prix_hour = prix_jour / 8; // Calculate hourly rate
            const nombre_des_jours = parseFloat(document.getElementById('nombreJours').value);
            const nombreHeurx = parseFloat(document.getElementById('nombreHeurx').value);
            const travaux_attache = parseInt(document.getElementById('travauxAttache').value) || 0;
            const salaire = (prix_jour * nombre_des_jours) + (prix_hour * nombreHeurx) + travaux_attache;
            const acompte = parseFloat(document.getElementById('acompte').value);            
            const net_a_payer = salaire - acompte;
            const observation = document.getElementById('observation').value;
            
            try {
                // Debug log the data being sent
                console.log('Sending data to backend:', {
                    nom_et_prenom,
                    prix_jour,
                    prix_hour,
                    nombre_des_jours,
                    travaux_attache,
                    salaire,
                    acompte,
                    net_a_payer,
                    observation
                });
                
                // Call Tauri command to add employee to database (will be added to all projects)
                const { annee, mois } = getCurrentYearMonth();
                await invoke('insert_employee', {
                    employee: {
                        nom_et_prenom,
                        prix_jour,
                        prix_hour,
                        nombre_des_jours,
                        nombre_des_heurx: nombreHeurx,
                        travaux_attache,
                        salaire,
                        acompte,
                        net_a_payer,
                        observation
                    },
                    annee: annee,
                    mois: mois
                });// Reset form and close modal
                employeeForm.reset();
                modal.style.display = 'none';

                // Reload employees from database
                await reloadCurrentEmployees();
                
                // Refresh the employee names list for autocomplete in mode de saisir
                await loadEmployeeNames();
            } catch (error) {
                console.error("Error adding employee:", error);
                alert("Failed to add employee. Please try again.");
            }
        } else {
            // Show validation messages
            employeeForm.reportValidity();
        }
    });

    // Edit modal elements
    const editModal = document.getElementById('editEmployeeModal');
    const closeEditButton = document.querySelector('.close-edit');
    const cancelEditButton = document.querySelector('.cancel-edit-btn');
    const updateButton = document.querySelector('.update-btn');
    const editEmployeeForm = document.getElementById('editEmployeeForm');

    // Close edit modal
    function closeEditModal() {
        editModal.style.display = 'none';
    }
    closeEditButton.addEventListener('click', closeEditModal);
    cancelEditButton.addEventListener('click', function(e) {
        e.preventDefault();
        closeEditModal();
    });
    window.addEventListener('click', function(event) {
        if (event.target === editModal) {
            closeEditModal();
        }    });

    // Delegate click event for edit and delete buttons
    document.querySelector('table tbody').addEventListener('click', function(e) {
        if (e.target.closest('.edit-btn')) {
            const row = e.target.closest('tr');
            // Get all cell values
            const cells = row.querySelectorAll('td');
            // Get data attributes
            const employeeId = row.getAttribute('data-employee-id');
            const projectId = row.getAttribute('data-project-id');
            
            // Get current year/month
            const { annee, mois } = getCurrentYearMonth();
            
            // Store current values before editing for undo
            employeeBeforeEdit = {
                id: parseInt(cells[0].textContent.trim()),
                employee_id: parseInt(employeeId),
                nom_et_prenom: cells[1].textContent.trim(),
                project_id: projectId,
                prix_jour: parseFloat(cells[2].textContent.trim()),
                prix_hour: parseFloat(cells[3].textContent.trim()),
                nombre_des_jours: parseInt(cells[4].textContent.trim()),
                nombre_des_heurx: parseFloat(cells[5].textContent.trim()),
                travaux_attache: parseFloat(cells[6].textContent.trim()),
                salaire: parseFloat(cells[7].textContent.trim()),
                acompte: parseFloat(cells[8].textContent.trim()),
                net_a_payer: parseFloat(cells[9].textContent.trim()),
                observation: cells[10].childNodes[0].textContent.trim(),
                annee: annee,
                mois: mois
            };
            
            // Fill modal fields
            document.getElementById('editId').value = cells[0].textContent.trim();
            document.getElementById('editNomPrenom').value = cells[1].textContent.trim();
            document.getElementById('editPrixJour').value = cells[2].textContent.trim();
            document.getElementById('editPrixHour').value = cells[3].textContent.trim();
            document.getElementById('editNombreJours').value = cells[4].textContent.trim();
            document.getElementById('editNombreHeurx').value = cells[5].textContent.trim();
            document.getElementById('editTravauxAttache').value = cells[6].textContent.trim();
            document.getElementById('editSalaire').value = cells[7].textContent.trim();
            document.getElementById('editAcompte').value = cells[8].textContent.trim();
            document.getElementById('editNetAPayer').value = cells[9].textContent.trim();
            document.getElementById('editObservation').value = cells[10].childNodes[0].textContent.trim();
            
            // Store employee_id and project_id for later use
            editModal.setAttribute('data-employee-id', employeeId);
            editModal.setAttribute('data-project-id', projectId);
            
            // Show modal
            editModal.style.display = 'block';
        }
        
        // Handle delete button clicks
        if (e.target.closest('.delete-btn')) {
            const row = e.target.closest('tr');
            const cells = row.querySelectorAll('td');
            const employeeId = cells[0].textContent.trim();
            const employeeName = cells[1].textContent.trim();
            
            deleteEmployee(e.target.closest('.delete-btn'), employeeId, employeeName);
        }
    });    // Handle update button click with proper salary calculations
    updateButton.addEventListener('click', async function(e) {
        e.preventDefault();
        
        // Get basic values
        const id = parseInt(document.getElementById('editId').value);
        const nom_et_prenom = document.getElementById('editNomPrenom').value;
        const prix_jour = parseFloat(document.getElementById('editPrixJour').value);
        const nombre_des_jours = parseInt(document.getElementById('editNombreJours').value);
        const nombreHeurx = parseFloat(document.getElementById('editNombreHeurx').value) || 0;
        const travaux_attache = parseFloat(document.getElementById('editTravauxAttache').value) || 0;
        const acompte = parseFloat(document.getElementById('editAcompte').value) || 0;
        const observation = document.getElementById('editObservation').value;
        
        // Get employee_id and project_id from modal data attributes
        const employee_id = parseInt(editModal.getAttribute('data-employee-id'));
        const project_id = editModal.getAttribute('data-project-id');
        
        // Calculate derived values (same logic as in add employee)
        const prix_hour = prix_jour / 8; // Prix de hour is prix de jour/8
        const salaire = (prix_jour * nombre_des_jours) + (prix_hour * nombreHeurx) + travaux_attache;
        const net_a_payer = salaire - acompte;
        
        // Get current year/month
        const { annee, mois } = getCurrentYearMonth();
        
        // Create the updated employee object
        const updatedEmployee = {
            id: id, // ID is never changed, only used for WHERE clause
            employee_id: employee_id,
            nom_et_prenom: nom_et_prenom,
            project_id: project_id,
            prix_jour: prix_jour,
            prix_hour: prix_hour,
            nombre_des_jours: nombre_des_jours,
            nombre_des_heurx: nombreHeurx,
            travaux_attache: travaux_attache,
            salaire: salaire,
            acompte: acompte,
            net_a_payer: net_a_payer,
            observation: observation,
            annee: annee,
            mois: mois
        };
          try {
            // Save to undo stack before updating
            if (employeeBeforeEdit) {
                addToUndoStack({
                    type: 'update',
                    previousData: employeeBeforeEdit,
                    newData: updatedEmployee
                });
            }
            
            // Call backend to update employee
            await invoke('update_employee', { employee: updatedEmployee });
            closeEditModal();
            employeeBeforeEdit = null; // Clear after successful update
            await reloadCurrentEmployees();
        } catch (error) {
            console.error('Update error:', error);
            alert('Erreur lors de la mise à jour de l\'employé: ' + error);
        }
    });

    // Add automatic calculation listeners for edit modal
    function addEditModalCalculationListeners() {
        const editPrixJour = document.getElementById('editPrixJour');
        const editNombreJours = document.getElementById('editNombreJours');
        const editNombreHeurx = document.getElementById('editNombreHeurx');
        const editTravauxAttache = document.getElementById('editTravauxAttache');
        const editAcompte = document.getElementById('editAcompte');
        const editPrixHour = document.getElementById('editPrixHour');
        const editSalaire = document.getElementById('editSalaire');
        const editNetAPayer = document.getElementById('editNetAPayer');
        
        let isCalculatingFromEditSalaire = false;
        let lastEditedEditField = null; // Track which field was last edited
        
        // Calculate from Prix de Jour -> Salaire (forward calculation)
        function calculateEditValues() {
            if (isCalculatingFromEditSalaire) return; // Prevent circular calculation
            
            const prixJour = parseFloat(editPrixJour.value) || 0;
            const nombreJours = parseInt(editNombreJours.value) || 0;
            const nombreHeurx = parseFloat(editNombreHeurx.value) || 0;
            const travauxAttache = parseFloat(editTravauxAttache.value) || 0;
            const acompte = parseFloat(editAcompte.value) || 0;
            
            // Calculate prix_hour (prix de jour / 8)
            const prixHour = prixJour / 8;
            editPrixHour.value = prixHour;
            
            // Calculate salaire: (prix_jour * nombre_des_jours) + (prix_hour * nombre_heurx) + travaux_attache
            const salaire = (prixJour * nombreJours) + (prixHour * nombreHeurx) + travauxAttache;
            editSalaire.value = salaire;
            
            // Calculate net_a_payer: salaire - acompte
            const netAPayer = salaire - acompte;
            editNetAPayer.value = netAPayer;
        }
        
        // Calculate from Salaire -> Prix de Jour (reverse calculation)
        function calculateEditPrixJourFromSalaire() {
            isCalculatingFromEditSalaire = true;
            
            const salaire = parseFloat(editSalaire.value) || 0;
            const nombreJours = parseInt(editNombreJours.value) || 0;
            const nombreHeurx = parseFloat(editNombreHeurx.value) || 0;
            const travauxAttache = parseFloat(editTravauxAttache.value) || 0;
            const acompte = parseFloat(editAcompte.value) || 0;
            
            // If nombre de jours is 0, we can't calculate prix_jour
            if (nombreJours === 0) {
                editPrixJour.value = '';
                editPrixHour.value = '';
                isCalculatingFromEditSalaire = false;
                return;
            }
            
            // Reverse calculation: prix_jour = (salaire - travaux_attache) / (nombre_jours + (nombre_heurx / 8))
            const totalDaysEquivalent = nombreJours + (nombreHeurx / 8);
            const prixJour = (salaire - travauxAttache) / totalDaysEquivalent;
            
            // Store the EXACT value without rounding to avoid precision loss
            editPrixJour.value = prixJour;
            editPrixHour.value = prixJour / 8;
            
            // DON'T recalculate salaire - keep it exactly as user entered
            // Only update net_a_payer
            const netAPayer = salaire - acompte;
            editNetAPayer.value = netAPayer;
            
            isCalculatingFromEditSalaire = false;
        }
        
        // Add event listeners with field tracking
        editPrixJour.addEventListener('input', function() {
            lastEditedEditField = 'prixJour';
            calculateEditValues();
        });
        
        editNombreJours.addEventListener('input', function() {
            // Only recalculate if user was editing salaire before
            if (lastEditedEditField === 'salaire') {
                calculateEditPrixJourFromSalaire();
            } else {
                calculateEditValues();
            }
        });
        
        editNombreHeurx.addEventListener('input', function() {
            // Only recalculate if user was editing salaire before
            if (lastEditedEditField === 'salaire') {
                calculateEditPrixJourFromSalaire();
            } else {
                calculateEditValues();
            }
        });
        
        editTravauxAttache.addEventListener('input', function() {
            // Only recalculate if user was editing salaire before
            if (lastEditedEditField === 'salaire') {
                calculateEditPrixJourFromSalaire();
            } else {
                calculateEditValues();
            }
        });
        
        editAcompte.addEventListener('input', function() {
            // Only update net a payer when acompte changes
            const salaire = parseFloat(editSalaire.value) || 0;
            const acompte = parseFloat(editAcompte.value) || 0;
            const netAPayer = salaire - acompte;
            editNetAPayer.value = netAPayer.toFixed(2);
        });
        
        // Add event listener for reverse calculation (Salaire -> Prix Jour)
        editSalaire.addEventListener('input', function() {
            lastEditedEditField = 'salaire';
            calculateEditPrixJourFromSalaire();
        });
    }
    
    // Call this function when the page loads
    addEditModalCalculationListeners();

    // Mode de Saisir Modal functionality
    const modeDeSaisirModal = document.getElementById('modeDeSaisirModal');
    const closeModeSaisirButton = document.querySelector('.close-mode-saisir');
    const cancelModeSaisirButton = document.querySelector('.cancel-mode-saisir-btn');
    const saveModeSaisirButton = document.querySelector('.save-mode-saisir-btn');
    const modeDeSaisirForm = document.getElementById('modeDeSaisirForm');

    // Close mode de saisir modal functions
    function closeModeDeSaisirModal() {
        modeDeSaisirModal.style.display = 'none';
        clearAutocomplete();
        window.selectedEmployeeId = null; // Reset selected employee when closing
    }

    closeModeSaisirButton.addEventListener('click', closeModeDeSaisirModal);
    cancelModeSaisirButton.addEventListener('click', function(e) {
        e.preventDefault();
        closeModeDeSaisirModal();
    });

    window.addEventListener('click', function(event) {
        if (event.target === modeDeSaisirModal) {
            closeModeDeSaisirModal();
        }
    });

    // Autocomplete functionality for names (global scope)
    let employeeNames = [];
    
    // Make loadEmployeeNames globally accessible
    window.loadEmployeeNames = async function() {
        try {
            // Use get_all_employees_original to get ALL employees regardless of salary data
            const employees = await invoke('get_all_employees_original');
            employeeNames = employees.map(emp => emp.nom_et_prenom);
        } catch (error) {
            console.error("Error loading employee names:", error);
        }
    };
    
    // Alias for convenience
    const loadEmployeeNames = window.loadEmployeeNames;

    function setupAutocomplete() {
        const input = document.getElementById('modeSaisirNomPrenom');
        const autocompleteList = document.getElementById('autocomplete-list');
        let currentFocus = -1;

        input.addEventListener('input', function() {
            const value = this.value;
            clearAutocomplete();
            if (!value) return;
            
            currentFocus = -1;
            const filteredNames = employeeNames.filter(name => 
                name.toLowerCase().includes(value.toLowerCase())
            );

            if (filteredNames.length > 0) {
                filteredNames.forEach((name, index) => {
                    const item = document.createElement('div');
                    const matchIndex = name.toLowerCase().indexOf(value.toLowerCase());
                    const beforeMatch = name.substr(0, matchIndex);
                    const match = name.substr(matchIndex, value.length);
                    const afterMatch = name.substr(matchIndex + value.length);
                    
                    item.innerHTML = beforeMatch + '<strong>' + match + '</strong>' + afterMatch;
                    item.addEventListener('click', function() {
                        input.value = name;
                        clearAutocomplete();
                        
                        // Auto-fill data if employee exists
                        fillEmployeeData(name);
                    });
                    autocompleteList.appendChild(item);
                });
            }
        });

        input.addEventListener('keydown', function(e) {
            const items = autocompleteList.getElementsByTagName('div');
            if (e.keyCode === 40) { // Arrow Down
                currentFocus++;
                addActive(items);
            } else if (e.keyCode === 38) { // Arrow Up
                currentFocus--;
                addActive(items);
            } else if (e.keyCode === 13) { // Enter
                e.preventDefault();
                if (currentFocus > -1 && items[currentFocus]) {
                    items[currentFocus].click();
                }
            }
        });

        function addActive(items) {
            if (!items) return;
            removeActive(items);
            if (currentFocus >= items.length) currentFocus = 0;
            if (currentFocus < 0) currentFocus = items.length - 1;
            items[currentFocus].classList.add('autocomplete-active');
        }

        function removeActive(items) {
            for (let item of items) {
                item.classList.remove('autocomplete-active');
            }
        }
    }

    function clearAutocomplete() {
        const autocompleteList = document.getElementById('autocomplete-list');
        autocompleteList.innerHTML = '';
    }

    async function fillEmployeeData(name) {
        // Store the selected employee ID for updating, but don't fill the fields
        try {
            const employees = await invoke('get_all_employees');
            const employee = employees.find(emp => emp.nom_et_prenom === name);
            
            if (employee) {
                // Store the employee ID for later update, but keep fields blank
                window.selectedEmployeeId = employee.id;
                // Don't fill any fields - let user enter new values
            }
        } catch (error) {
            console.error("Error finding employee:", error);
        }
    }

    // Automatic calculation functionality for mode de saisir
    function addModeSaisirCalculationListeners() {
        const prixJour = document.getElementById('modeSaisirPrixJour');
        const nombreJours = document.getElementById('modeSaisirNombreJours');
        const nombreHeurx = document.getElementById('modeSaisirNombreHeurx');
        const travauxAttache = document.getElementById('modeSaisirTravauxAttache');
        const acompte = document.getElementById('modeSaisirAcompte');
        const prixHour = document.getElementById('modeSaisirPrixHour');
        const salaire = document.getElementById('modeSaisirSalaire');
        const netAPayer = document.getElementById('modeSaisirNetAPayer');
        
        let isCalculatingFromSalaire = false;
        let lastEditedField = null; // Track which field was last edited
        
        // Calculate from Prix de Jour -> Salaire (forward calculation)
        function calculateModeSaisirValues() {
            if (isCalculatingFromSalaire) return; // Prevent circular calculation
            
            const prixJourVal = parseFloat(prixJour.value) || 0;
            const nombreJoursVal = parseInt(nombreJours.value) || 0;
            const nombreHeurxVal = parseFloat(nombreHeurx.value) || 0;
            const travauxAttacheVal = parseFloat(travauxAttache.value) || 0;
            const acompteVal = parseFloat(acompte.value) || 0;
            
            // Calculate prix_hour (prix de jour / 8)
            const prixHourVal = prixJourVal / 8;
            prixHour.value = prixHourVal;
            
            // Calculate salaire: (prix_jour * nombre_des_jours) + (prix_hour * nombre_heurx) + travaux_attache
            const salaireVal = (prixJourVal * nombreJoursVal) + (prixHourVal * nombreHeurxVal) + travauxAttacheVal;
            salaire.value = salaireVal;
            
            // Calculate net_a_payer: salaire - acompte
            const netAPayerVal = salaireVal - acompteVal;
            netAPayer.value = netAPayerVal;
        }
        
        // Calculate from Salaire -> Prix de Jour (reverse calculation)
        function calculatePrixJourFromSalaire() {
            isCalculatingFromSalaire = true;
            
            const salaireVal = parseFloat(salaire.value) || 0;
            const nombreJoursVal = parseInt(nombreJours.value) || 0;
            const nombreHeurxVal = parseFloat(nombreHeurx.value) || 0;
            const travauxAttacheVal = parseFloat(travauxAttache.value) || 0;
            const acompteVal = parseFloat(acompte.value) || 0;
            
            // If nombre de jours is 0, we can't calculate prix_jour
            if (nombreJoursVal === 0) {
                prixJour.value = '';
                prixHour.value = '';
                isCalculatingFromSalaire = false;
                return;
            }
            
            // Reverse calculation: prix_jour = (salaire - travaux_attache) / (nombre_jours + (nombre_heurx / 8))
            // This assumes: salaire = (prix_jour * nombre_jours) + (prix_jour/8 * nombre_heurx) + travaux_attache
            const totalDaysEquivalent = nombreJoursVal + (nombreHeurxVal / 8);
            const prixJourVal = (salaireVal - travauxAttacheVal) / totalDaysEquivalent;
            
            // Store the EXACT value without rounding to avoid precision loss
            prixJour.value = prixJourVal;
            prixHour.value = prixJourVal / 8;
            
            // DON'T recalculate salaire - keep it exactly as user entered
            // Only update net_a_payer
            const netAPayerVal = salaireVal - acompteVal;
            netAPayer.value = netAPayerVal;
            
            isCalculatingFromSalaire = false;
        }
        
        // Add event listeners for forward calculation (Prix Jour -> Salaire)
        prixJour.addEventListener('input', function() {
            lastEditedField = 'prixJour';
            calculateModeSaisirValues();
        });
        
        nombreJours.addEventListener('input', function() {
            // Only recalculate if user was editing salaire before
            if (lastEditedField === 'salaire') {
                calculatePrixJourFromSalaire();
            } else {
                calculateModeSaisirValues();
            }
        });
        
        nombreHeurx.addEventListener('input', function() {
            // Only recalculate if user was editing salaire before
            if (lastEditedField === 'salaire') {
                calculatePrixJourFromSalaire();
            } else {
                calculateModeSaisirValues();
            }
        });
        
        travauxAttache.addEventListener('input', function() {
            // Only recalculate if user was editing salaire before
            if (lastEditedField === 'salaire') {
                calculatePrixJourFromSalaire();
            } else {
                calculateModeSaisirValues();
            }
        });
        
        acompte.addEventListener('input', function() {
            // Only update net a payer when acompte changes
            const salaireVal = parseFloat(salaire.value) || 0;
            const acompteVal = parseFloat(acompte.value) || 0;
            const netAPayerVal = salaireVal - acompteVal;
            netAPayer.value = netAPayerVal.toFixed(2);
        });
        
        // Add event listener for reverse calculation (Salaire -> Prix Jour)
        salaire.addEventListener('input', function() {
            lastEditedField = 'salaire';
            calculatePrixJourFromSalaire();
        });
        
        // Store function globally for external access
        window.calculateModeSaisirValues = calculateModeSaisirValues;
    }

    // Handle save button for mode de saisir
    saveModeSaisirButton.addEventListener('click', async function(e) {
        e.preventDefault();
        // Helper to robustly parse localized numbers (handles spaces, NBSP, commas)
        const parseNumber = (val) => {
            if (typeof val === 'number') return val;
            if (!val) return 0;
            let s = String(val).trim();
            // remove spaces and NBSP
            s = s.replace(/[\s\u00A0\u202F]/g, '');
            // European format like 1.234,56 -> 1234.56
            if (/^\d{1,3}(\.\d{3})+,\d+$/.test(s)) {
                s = s.replace(/\./g, '').replace(',', '.');
                return parseFloat(s);
            }
            // US format like 1,234.56 -> 1234.56
            if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
                s = s.replace(/,/g, '');
                return parseFloat(s);
            }
            // If only comma present, treat as decimal separator
            if (s.includes(',') && !s.includes('.')) {
                s = s.replace(',', '.');
            }
            return parseFloat(s);
        };
        
        // Get the employee name
    const nom_et_prenom = document.getElementById('modeSaisirNomPrenom').value;
        if (!nom_et_prenom || nom_et_prenom.trim() === '') {
            alert("Veuillez entrer le nom de l'employé.");
            return;
        }
        
        // Get the selected project
    const selectedProjectId = document.getElementById('modeSaisirProject').value;
        if (!selectedProjectId || selectedProjectId === '') {
            alert("Veuillez sélectionner un projet.");
            return;
        }
        
        try {
            // Get all employees
            const employees = await invoke('get_all_employees');
            
            // If selectedEmployeeId is not set, try to find employee by name
            let currentEmployee = null;
            if (window.selectedEmployeeId) {
                currentEmployee = employees.find(emp => emp.id === window.selectedEmployeeId);
            } else {
                // Try to find by name (exact match)
                currentEmployee = employees.find(emp => emp.nom_et_prenom.toLowerCase() === nom_et_prenom.trim().toLowerCase());
                if (currentEmployee) {
                    window.selectedEmployeeId = currentEmployee.id;
                }
            }
            
            if (!currentEmployee) {
                alert("Employé introuvable. Veuillez sélectionner un employé existant depuis la liste.");
                return;
            }
            
            // Debug: log current employee from database
            console.log('[Mode de Saisir] Current employee from DB:', currentEmployee);
            
            // Start with current employee data
            const updatedEmployee = { ...currentEmployee };
            
            // Update only the fields that have new values
            const nom_et_prenom = document.getElementById('modeSaisirNomPrenom').value;
            if (nom_et_prenom && nom_et_prenom.trim() !== '') {
                updatedEmployee.nom_et_prenom = nom_et_prenom.trim();
            }
            
            const prixJourVal = document.getElementById('modeSaisirPrixJour').value;
            if (prixJourVal && prixJourVal.trim() !== '') {
                const pj = parseNumber(prixJourVal);
                updatedEmployee.prix_jour = pj;
                updatedEmployee.prix_hour = pj / 8;
            }
            
            const nombreJoursVal = document.getElementById('modeSaisirNombreJours').value;
            if (nombreJoursVal && nombreJoursVal.trim() !== '') {
                updatedEmployee.nombre_des_jours = Math.trunc(parseNumber(nombreJoursVal));
            }
            
            const nombreHeurxVal = document.getElementById('modeSaisirNombreHeurx').value;
            if (nombreHeurxVal && nombreHeurxVal.trim() !== '') {
                updatedEmployee.nombre_des_heurx = parseNumber(nombreHeurxVal);
            }
            
            const travauxAttacheVal = document.getElementById('modeSaisirTravauxAttache').value;
            if (travauxAttacheVal && travauxAttacheVal.trim() !== '') {
                updatedEmployee.travaux_attache = parseNumber(travauxAttacheVal);
            }
            
            const acompteVal = document.getElementById('modeSaisirAcompte').value;
            if (acompteVal && acompteVal.trim() !== '') {
                updatedEmployee.acompte = parseNumber(acompteVal);
            }
            
            const observationVal = document.getElementById('modeSaisirObservation').value;
            if (observationVal && observationVal.trim() !== '') {
                updatedEmployee.observation = observationVal.trim();
            }
            
            // Ensure all numeric fields have valid NUMBER values for calculation
            // CRITICAL: Convert strings from DB to numbers to avoid concatenation bugs!
            const prixJour = Number(updatedEmployee.prix_jour) || 0;
            const prixHour = Number(updatedEmployee.prix_hour) || 0;
            const nombreJours = Number(updatedEmployee.nombre_des_jours) || 0;
            const nombreHeurx = Number(updatedEmployee.nombre_des_heurx) || 0;
            const travauxAttache = Number(updatedEmployee.travaux_attache) || 0;
            const acompte = Number(updatedEmployee.acompte) || 0;
            
            // Recalculate salary with updated values
            const salaire = (prixJour * nombreJours) + (prixHour * nombreHeurx) + travauxAttache;
            console.log('[Mode de Saisir] Calculated salaire:', {
                prixJour,
                nombreJours,
                prixHour,
                nombreHeurx,
                travauxAttache,
                formula: `(${prixJour} * ${nombreJours}) + (${prixHour} * ${nombreHeurx}) + ${travauxAttache}`,
                result: salaire
            });
            updatedEmployee.salaire = salaire;
            updatedEmployee.net_a_payer = salaire - acompte;
            
            // Set the project_id to the selected project
            updatedEmployee.project_id = selectedProjectId;
            
            // Set the current year and month
            const { annee, mois } = getCurrentYearMonth();
            updatedEmployee.annee = annee;
            updatedEmployee.mois = mois;

            // Debug log what we're about to send (helps trace 10x issues)
            console.log('[Mode de Saisir] Updating employee', {
                employee_id: updatedEmployee.employee_id,
                project_id: updatedEmployee.project_id,
                prix_jour: updatedEmployee.prix_jour,
                prix_hour: updatedEmployee.prix_hour,
                nombre_des_jours: updatedEmployee.nombre_des_jours,
                nombre_des_heurx: updatedEmployee.nombre_des_heurx,
                travaux_attache: updatedEmployee.travaux_attache,
                salaire: updatedEmployee.salaire,
                acompte: updatedEmployee.acompte,
                net_a_payer: updatedEmployee.net_a_payer,
            });

            // Call Tauri command to update employee
            await invoke('update_employee', { employee: updatedEmployee });

            // Reset form and close modal
            modeDeSaisirForm.reset();
            closeModeDeSaisirModal();            window.selectedEmployeeId = null; // Reset selected employee

            // Reload employees from database - load the project where data was saved
            if (selectedProjectId === 'administration') {
                await loadEmployeesByProject('administration');
            } else {
                await loadEmployeesByProject(selectedProjectId);
            }
            
            await loadEmployeeNames(); // Refresh autocomplete data
            
            // Show success modal instead of alert
            showSuccessModal();
            
        } catch (error) {
            console.error("Error updating employee:", error);
            alert("Erreur lors de la mise à jour de l'employé: " + error);
        }
    });

    // Initialize mode de saisir functionality
    addModeSaisirCalculationListeners();
    await loadEmployeeNames();
    setupAutocomplete();

    // Initialize search functionality
    initializeSearch();
    
    console.log('Salary page initialized successfully');
});

// Function to load employees from database and insert them into the table
async function loadEmployees() {
    try {
        const employees = await invoke('get_all_employees');
        updateEmployeeTable(employees);
    } catch (error) {
        console.error("Error loading employees:", error);
    }
}

// Function to load employees for a specific project
async function loadEmployeesByProject(projectId) {
    try {
        const { annee, mois } = getCurrentYearMonth();
        const employees = await invoke('get_employees_by_project', { 
            projectId: projectId,
            annee: annee,
            mois: mois
        });
        updateEmployeeTable(employees);
    } catch (error) {
        console.error("Error loading employees for project:", error);
        // If there's an error, show an empty table
        updateEmployeeTable([]);
    }
}

// Helper function to get currently selected project
function getCurrentSelectedProject() {
    const projectSelector = document.getElementById('project-selector');
    return projectSelector.value || 'administration';
}

// Function to reload employees for the currently selected project
async function reloadCurrentEmployees() {
    const currentProject = getCurrentSelectedProject();
    await loadEmployeesByProject(currentProject);
}

// Function to load projects into the dropdown
async function loadProjects() {
    try {
        // Ideally, this would call a backend function to get projects from the database
        // For now, we'll use sample projects since the backend function isn't implemented yet
        // const projects = [
        //     { id: 1, name: "Projet Alpha" },
        //     { id: 2, name: "Projet Beta" },
        //     { id: 3, name: "Projet Gamma" }
        // ];
        
        // When the backend function is implemented, you would use:
        const projects = await invoke('get_project_names');
        
        updateProjectDropdown(projects);
    } catch (error) {
        console.error("Error loading projects:", error);
    }
}

// Function to update the project dropdown with data
function updateProjectDropdown(projects) {
    const dropdown = document.getElementById('project-selector');
    
    // Keep the Administration option as default
    const adminOption = document.createElement('option');
    adminOption.value = 'administration';
    adminOption.textContent = 'Administration';
    adminOption.selected = true;
    dropdown.innerHTML = '';
    dropdown.appendChild(adminOption);
    
    // Add projects to dropdown
    projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = project.name;
        dropdown.appendChild(option);
    });

    // Add Recap option (employee recap across projects)
    const recapEmployeesOption = document.createElement('option');
    recapEmployeesOption.value = 'recap';
    recapEmployeesOption.textContent = '📋 Recap';
    dropdown.appendChild(recapEmployeesOption);

    // Add Recap Chantier option at the end
    const recapOption = document.createElement('option');
    recapOption.value = 'recap_chantier';
    recapOption.textContent = '📊 Recap Chantier';
    dropdown.appendChild(recapOption);
}

// Function to load projects into mode de saisir dropdown
async function loadModeSaisirProjects() {
    try {
        const projects = await invoke('get_project_names');
        const dropdown = document.getElementById('modeSaisirProject');
        
        // Clear and add placeholder
        dropdown.innerHTML = '<option value="">-- Sélectionner un projet --</option>';
        
        // Add Administration option
        const adminOption = document.createElement('option');
        adminOption.value = 'administration';
        adminOption.textContent = 'Administration';
        dropdown.appendChild(adminOption);
        
        // Add all projects
        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name;
            dropdown.appendChild(option);
        });
    } catch (error) {
        console.error("Error loading projects for mode de saisir:", error);
    }
}

// Global variable to store recap data for filtering
let currentRecapData = null;
let currentRecapProjects = null;

// Function to load and display employee recap across all projects
async function loadEmployeesRecap() {
    try {
        const { annee, mois } = getCurrentYearMonth();
        const recapData = await invoke('get_employees_recap', {
            annee: annee,
            mois: mois
        });
        const projects = await invoke('get_project_names');
        
        // Store data globally for filtering
        currentRecapData = recapData;
        currentRecapProjects = projects;
        
        // Show the filter checkbox
        const filterContainer = document.getElementById('recap-filter-container');
        if (filterContainer) {
            filterContainer.style.display = 'block';
        }
        
        // Display with default filter (only active employees)
        const showAll = document.getElementById('show-all-employees-checkbox')?.checked || false;
        displayEmployeesRecapTable(recapData, projects, showAll);
    } catch (error) {
        console.error('Error loading employees recap:', error);
        showNotification('Erreur lors du chargement du récapitulatif des employés', 'error');
    }
}

// Function to load and display recap of all projects
async function loadRecapChantier() {
    try {
        const { annee, mois } = getCurrentYearMonth();
        const recapData = await invoke('get_projects_recap', {
            annee: annee,
            mois: mois
        });
        displayRecapTable(recapData);
    } catch (error) {
        console.error('Error loading recap chantier:', error);
        showNotification('Erreur lors du chargement du récapitulatif', 'error');
    }
}

// Function to display employee recap in a table with projects as columns
function displayEmployeesRecapTable(recapData, projects, showAll = false) {
    const table = document.querySelector('table');
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    
    // Filter data based on showAll flag
    let filteredData = recapData;
    if (!showAll) {
        // Only show employees who have worked (total_jours > 0 OR net_a_payer > 0)
        filteredData = recapData.filter(employee => {
            const totalJours = parseInt(employee.total_jours) || 0;
            const netAPayer = parseFloat(employee.total_net_a_payer) || 0;
            return totalJours > 0 || netAPayer > 0;
        });
    }
    
    // Build dynamic header with centered text
    let headerHTML = `
        <tr>
            <th style="text-align: center;">#</th>
            <th style="text-align: center;">Nom et Prénom</th>
            <th style="text-align: center;">Administration</th>`;
    
    projects.forEach(project => {
        headerHTML += `<th style="text-align: center;">${project.name}</th>`;
    });
    
    headerHTML += `
            <th style="text-align: center;">Jours Total</th>
            <th style="text-align: center;">Salaire Total</th>
            <th style="text-align: center;">Acompte Total</th>
            <th style="text-align: center;">Net à Payer Total</th>
        </tr>`;
    
    thead.innerHTML = headerHTML;
    tbody.innerHTML = '';
    
    let grandTotalJours = 0;
    let grandTotalSalaire = 0;
    let grandTotalAcompte = 0;
    let grandTotalNet = 0;
    
    filteredData.forEach((employee, index) => {
        const row = document.createElement('tr');
        row.style.cursor = 'default';
        row.style.backgroundColor = index % 2 === 0 ? '#f8f9fa' : 'white';
        
        // Display name with optional tag badge
        const tagBadge = employee.tag ? `<span style="display: inline-block; margin-left: 8px; padding: 2px 8px; background: #3498db; color: white; border-radius: 12px; font-size: 0.75em; font-weight: bold;">${employee.tag}</span>` : '';
        
        let rowHTML = `
            <td style="text-align: center; font-weight: 600;">${employee.employee_id}</td>
            <td style="text-align: left; font-weight: 600; padding-left: 15px;">${employee.nom_et_prenom}${tagBadge}</td>`;
        
        // Administration column
        const adminData = employee.projects['Administration'];
        if (adminData) {
            rowHTML += `<td style="text-align: center;">${adminData.jours || 0}</td>`;
        } else {
            rowHTML += `<td style="text-align: center;">0</td>`;
        }
        
        // Project columns
        projects.forEach(project => {
            const projectData = employee.projects[project.name];
            if (projectData) {
                rowHTML += `<td style="text-align: center;">${projectData.jours || 0}</td>`;
            } else {
                rowHTML += `<td style="text-align: center;">0</td>`;
            }
        });
        
        // Totals
        const totalJours = parseInt(employee.total_jours) || 0;
        const totalSalaire = parseFloat(employee.total_salaire) || 0;
        const totalAcompte = parseFloat(employee.total_acompte) || 0;
        const totalNet = parseFloat(employee.total_net_a_payer) || 0;
        
        grandTotalJours += totalJours;
        grandTotalSalaire += totalSalaire;
        grandTotalAcompte += totalAcompte;
        grandTotalNet += totalNet;
        
        rowHTML += `
            <td style="text-align: center; font-weight: 700; color: #3498db;">${totalJours}</td>
            <td style="text-align: right; font-weight: 700; color: #27ae60;">${totalSalaire.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DA</td>
            <td style="text-align: right; font-weight: 700; color: #e67e22;">${totalAcompte.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DA</td>
            <td style="text-align: right; font-weight: 700; color: #2ecc71;">${totalNet.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DA</td>`;
        
        row.innerHTML = rowHTML;
        tbody.appendChild(row);
    });
    
    // Add grand total row
    const totalRow = document.createElement('tr');
    totalRow.style.backgroundColor = '#3498db';
    totalRow.style.color = 'white';
    totalRow.style.fontWeight = 'bold';
    totalRow.style.fontSize = '1.1em';
    
    const projectsCount = projects.length;
    totalRow.innerHTML = `
        <td colspan="${2 + 1 + projectsCount}" style="text-align: right; padding-right: 20px;">⭐ TOTAUX GÉNÉRAUX</td>
        <td style="text-align: center; font-size: 1.2em;">${grandTotalJours}</td>
        <td style="text-align: right; font-size: 1.2em;">${grandTotalSalaire.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DA</td>
        <td style="text-align: right; font-size: 1.2em;">${grandTotalAcompte.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DA</td>
        <td style="text-align: right; font-size: 1.2em;">${grandTotalNet.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DA</td>`;
    
    tbody.appendChild(totalRow);
    
    // Update the total display at the bottom
    const totalDisplay = document.querySelector('.total-display');
    if (totalDisplay) {
        totalDisplay.querySelector('.total-value').textContent = `${grandTotalNet.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DA`;
    }
}

// Function to display recap data in a special table
function displayRecapTable(recapData) {
    const table = document.querySelector('table');
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    
    // Reset headers to default
    thead.innerHTML = `
        <tr>
            <th>Id</th>
            <th>Nom et Prenom</th>
            <th>Prix de Jour</th>
            <th>Prix de Hour</th>
            <th>Nombre des Jours</th>
            <th>Nombre des Heurx</th>
            <th>Traveux Attache</th>
            <th>Salaire</th>
            <th>Acompte</th>
            <th>Net a Payer</th>
            <th>Observation</th>
        </tr>`;
    
    tbody.innerHTML = '';
    
    let grandTotal = 0;
    
    recapData.forEach((project, index) => {
        const netAPayer = parseFloat(project.total_net_a_payer) || 0;
        grandTotal += netAPayer;
        
        const row = document.createElement('tr');
        row.style.cursor = 'default';
        row.style.backgroundColor = index % 2 === 0 ? '#f8f9fa' : 'white';
        row.innerHTML = `
            <td style="text-align: center; font-weight: 600; font-size: 1.1em;">${index + 1}</td>
            <td colspan="8" style="text-align: left; font-weight: 600; padding-left: 30px; font-size: 1.05em;">
                ${project.project_name}
            </td>
            <td style="font-weight: 700; color: #27ae60; font-size: 1.15em; text-align: right; padding-right: 20px;">
                ${netAPayer.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DA
            </td>
            <td></td>
        `;
        tbody.appendChild(row);
    });
    
    // Add separator row
    const separatorRow = document.createElement('tr');
    separatorRow.innerHTML = `
        <td colspan="11" style="border-top: 3px solid #34495e; border-bottom: 3px solid #34495e; height: 5px;"></td>
    `;
    tbody.appendChild(separatorRow);
    
    // Add grand total row
    const totalRow = document.createElement('tr');
    totalRow.style.backgroundColor = '#3498db';
    totalRow.style.color = 'white';
    totalRow.style.fontWeight = 'bold';
    totalRow.style.fontSize = '1.3em';
    totalRow.innerHTML = `
        <td colspan="9" style="text-align: right; padding-right: 30px; letter-spacing: 1px;">
            ⭐ TOTAL GÉNÉRAL
        </td>
        <td style="font-size: 1.4em; text-align: right; padding-right: 20px;">
            ${grandTotal.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DA
        </td>
        <td></td>
    `;
    tbody.appendChild(totalRow);
    
    // Update the total display at the bottom
    const totalDisplay = document.querySelector('.total-display');
    if (totalDisplay) {
        totalDisplay.querySelector('.total-value').textContent = `${grandTotal.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DA`;
    }
}

// Function to update the employee table with data from database
function updateEmployeeTable(employees) {
    const table = document.querySelector('table');
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    
    // Reset headers to default
    thead.innerHTML = `
        <tr>
            <th>Id</th>
            <th>Nom et Prenom</th>
            <th>Prix de Jour</th>
            <th>Prix de Hour</th>
            <th>Nombre des Jours</th>
            <th>Nombre des Heurx</th>
            <th>Traveux Attache</th>
            <th>Salaire</th>
            <th>Acompte</th>
            <th>Net a Payer</th>
            <th>Observation</th>
        </tr>`;
    
    tbody.innerHTML = '';
    
    let totalSalaire = 0;
    let totalAcompte = 0;
    let totalNetAPayer = 0;

    employees.forEach((employee) => {
        const row = document.createElement('tr');
        row.setAttribute('data-employee-id', employee.employee_id);
        row.setAttribute('data-project-id', employee.project_id);
        row.innerHTML = `
            <td>${employee.employee_id}</td>
            <td>${employee.nom_et_prenom}</td>
            <td>${employee.prix_jour}</td>
            <td>${employee.prix_hour}</td>
            <td>${employee.nombre_des_jours}</td>
            <td>${employee.nombre_des_heurx || 0}</td>
            <td>${employee.travaux_attache}</td>
            <td>${employee.salaire}</td>
            <td>${employee.acompte}</td>
            <td>${employee.net_a_payer}</td>
            <td style="position:relative;"><span class='observation-text'>${employee.observation}</span>
                <div class='action-buttons'>
                    <button class='action-btn edit-btn'><i class='fas fa-edit'></i></button>
                    <button class='action-btn delete-btn'><i class='fas fa-trash'></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
        
        // Accumulate totals
        totalSalaire    += Number(employee.salaire)     || 0;
        totalAcompte    += Number(employee.acompte)     || 0;
        totalNetAPayer  += Number(employee.net_a_payer) || 0;
    });

    // ── Totals row ────────────────────────────────────────────────────────────
    if (employees.length > 0) {
        // Thin separator line above the totals
        const separatorRow = document.createElement('tr');
        separatorRow.innerHTML = `<td colspan="11" style="border-top: 3px solid #2c3e50; padding: 0; height: 4px;"></td>`;
        tbody.appendChild(separatorRow);

        const totalRow = document.createElement('tr');
        totalRow.style.backgroundColor = '#2c3e50';
        totalRow.style.color = 'white';
        totalRow.style.fontWeight = 'bold';
        totalRow.style.fontSize = '1.05em';
        totalRow.innerHTML = `
            <td colspan="7" style="text-align: right; padding-right: 18px; letter-spacing: 0.5px;">
                ⭐ TOTAUX
            </td>
            <td style="text-align: right; padding-right: 8px; color: #2ecc71;">
                ${totalSalaire.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DA
            </td>
            <td style="text-align: right; padding-right: 8px; color: #f39c12;">
                ${totalAcompte.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DA
            </td>
            <td style="text-align: right; padding-right: 8px; color: #3498db; font-size: 1.1em;">
                ${totalNetAPayer.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DA
            </td>
            <td></td>
        `;
        tbody.appendChild(totalRow);
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Update balance panel
    const fmt = v => v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DA';
    const balSalaire = document.getElementById('balance-salaire');
    const balAcompte = document.getElementById('balance-acompte');
    const balNet     = document.getElementById('balance-net');
    if (balSalaire) balSalaire.textContent = fmt(totalSalaire);
    if (balAcompte) balAcompte.textContent = fmt(totalAcompte);
    if (balNet)     balNet.textContent     = fmt(totalNetAPayer);
    // Keep legacy .amount selector working
    const legacyAmount = document.querySelector('.amount');
    if (legacyAmount) legacyAmount.textContent = totalNetAPayer.toLocaleString('fr-FR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

// Delete employee function (global scope for onclick)
async function deleteEmployee(button, employeeId, employeeName) {
    showDeleteConfirmationModal(button, employeeId, employeeName);
}

// Function to show delete confirmation modal
function showDeleteConfirmationModal(button, employeeId, employeeName) {
    const modal = document.getElementById('deleteConfirmationModal');
    const confirmBtn = document.getElementById('confirmDelete');
    const cancelBtn = document.getElementById('cancelDelete');
    const closeBtn = document.querySelector('.close-delete');
    const confirmationText = document.getElementById('deleteConfirmationText');
    
    // Update confirmation text with employee name
    confirmationText.textContent = `Êtes-vous sûr de vouloir supprimer l'employé "${employeeName}" ?`;
    
    // Show modal
    modal.style.display = 'flex';
    
    // Handle confirm deletion
    const handleConfirm = async () => {
        try {
            // Show loading state
            const originalHTML = button.innerHTML;
            button.innerHTML = '<div class="loading-spinner"></div>';
            button.disabled = true;
            
            // Close modal first
            modal.style.display = 'none';
            
            // Get employee data before deletion for undo
            const row = button.closest('tr');
            const employeeData = {
                id: employeeId,
                nom_et_prenom: employeeName,
                prix_jour: parseFloat(row.cells[2].textContent) || 0,
                prix_hour: parseFloat(row.cells[3].textContent) || 0,
                nombre_des_jours: parseInt(row.cells[4].textContent) || 0,
                nombre_des_heurx: parseInt(row.cells[5].textContent) || 0,
                travaux_attache: parseFloat(row.cells[6].textContent) || 0,
                salaire: parseFloat(row.cells[7].textContent) || 0,
                acompte: parseFloat(row.cells[8].textContent) || 0,
                net_a_payer: parseFloat(row.cells[9].textContent) || 0,
                observation: row.cells[10].textContent || ''
            };
            
            // Delete from database
            await invoke('delete_employee', { employeeSalaryId: parseInt(employeeId) });
            
            // Remove row from table
            row.remove();
            
            // Add to undo stack
            addToUndoStack({
                type: 'delete',
                data: employeeData
            });
            
            // Reload employees to update the table and total
            await reloadCurrentEmployees();
            
            // Show success message
            const successMsg = document.createElement('div');
            successMsg.textContent = 'Employé supprimé avec succès';
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
            console.error('Error deleting employee:', error);
            
            // Reset button state
            button.innerHTML = originalHTML;
            button.disabled = false;
            
            // Show error message
            alert('Erreur lors de la suppression: ' + error);
        }
        
        // Clean up event listeners
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
        closeBtn.removeEventListener('click', handleCancel);
    };
    
    // Handle cancel deletion
    const handleCancel = () => {
        modal.style.display = 'none';
        
        // Clean up event listeners
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
        closeBtn.removeEventListener('click', handleCancel);
    };
    
    // Add event listeners
    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
    closeBtn.addEventListener('click', handleCancel);
    
    // Close modal when clicking outside
    window.addEventListener('click', function closeOnOutsideClick(event) {
        if (event.target === modal) {
            handleCancel();
            window.removeEventListener('click', closeOnOutsideClick);
        }
    });
}

// Success Modal Functions
function showSuccessModal() {
    const successModal = document.getElementById('updateSuccessModal');
    const successOkBtn = document.getElementById('successOk');
    
    successModal.style.display = 'flex';
    
    // Handle OK button click
    const handleOk = () => {
        successModal.style.display = 'none';
        successOkBtn.removeEventListener('click', handleOk);
    };
    
    successOkBtn.addEventListener('click', handleOk);
    
    // Close on outside click
    window.addEventListener('click', function closeSuccessOnOutside(event) {
        if (event.target === successModal) {
            successModal.style.display = 'none';
            window.removeEventListener('click', closeSuccessOnOutside);
        }
    });
}

// Function to initialize search functionality
function initializeSearch() {
    const searchInput = document.getElementById('search');
    const searchButton = document.getElementById('search-button');
    
    if (!searchInput || !searchButton) {
        console.warn('Search elements not found');
        return;
    }
    
    // Add event listeners for search functionality
    searchInput.addEventListener('input', performSearch);
    searchButton.addEventListener('click', performSearch);
    
    // Add Enter key support
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
}

// Function to perform search filtering
function performSearch() {
    const searchInput = document.getElementById('search');
    const searchTerm = searchInput.value.toLowerCase().trim();
    const tableRows = document.querySelectorAll('table tbody tr');
    
    let visibleCount = 0;
    
    tableRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        let found = false;
        
        // Search through all text content in the row
        cells.forEach(cell => {
            const cellText = cell.textContent.toLowerCase();
            if (cellText.includes(searchTerm)) {
                found = true;
            }
        });
        
        // Show or hide the row based on search result
        if (found || searchTerm === '') {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });
    
    // Visual feedback for search input
    if (searchTerm !== '') {
        searchInput.style.borderColor = visibleCount > 0 ? '#27ae60' : '#e74c3c';
    } else {
        searchInput.style.borderColor = '#e1e4e8';
    }
    
    // Optional: Update total amount based on visible rows
    updateVisibleTotal();
}

// Function to update total amount based on visible rows
function updateVisibleTotal() {
    const visibleRows = document.querySelectorAll('table tbody tr:not([style*="display: none"])');
    let totalSalaire   = 0;
    let totalAcompte   = 0;
    let totalNetAPayer = 0;

    visibleRows.forEach(row => {
        // Skip separator / totals rows (they have colspan cells)
        if (row.cells.length < 11) return;
        const salaireCell = row.cells[7];  // Salaire   – column index 7
        const acompteCell = row.cells[8];  // Acompte   – column index 8
        const netPayCell  = row.cells[9];  // Net Payer – column index 9
        if (salaireCell) totalSalaire   += parseFloat(salaireCell.textContent) || 0;
        if (acompteCell) totalAcompte   += parseFloat(acompteCell.textContent) || 0;
        if (netPayCell)  totalNetAPayer += parseFloat(netPayCell.textContent)  || 0;
    });

    const fmt = v => v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DA';

    const balSalaire = document.getElementById('balance-salaire');
    const balAcompte = document.getElementById('balance-acompte');
    const balNet     = document.getElementById('balance-net');
    if (balSalaire) balSalaire.textContent = fmt(totalSalaire);
    if (balAcompte) balAcompte.textContent = fmt(totalAcompte);
    if (balNet)     balNet.textContent     = fmt(totalNetAPayer);

    // Keep legacy .amount selector working for any other code that reads it
    const legacyAmount = document.querySelector('.amount');
    if (legacyAmount) legacyAmount.textContent = totalNetAPayer.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// PDF Generation Functionality
document.addEventListener('DOMContentLoaded', () => {
    const pdfButton = document.getElementById('generate-pdf-button');
    if (pdfButton) {
        pdfButton.addEventListener('click', generatePDFReport);
    }
});

async function generatePDFReport() {
    try {
        // Show loading state
        const pdfButton = document.getElementById('generate-pdf-button');
        const originalText = pdfButton.innerHTML;
        pdfButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        pdfButton.disabled = true;

        // Get current employees data
        const employees = await invoke('get_all_employees');
        
        if (employees.length === 0) {
            alert('No employee data available to generate report.');
            return;
        }

        // Initialize jsPDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Add title and header
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('SALARY REPORT', 105, 20, { align: 'center' });
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(`Generated on: ${new Date().toLocaleDateString('fr-FR')}`, 105, 30, { align: 'center' });
        
        // Company info (optional)
        doc.setFontSize(10);
        doc.text('Managist - Employee Management System', 105, 40, { align: 'center' });

        // Prepare table data
        const tableColumns = [
            'ID',
            'Employee Name',
            'Daily Rate',
            'Hourly Rate',
            'Days Worked',
            'Hours Worked',
            'Attached Work',
            'Salary',
            'Advance',
            'Net Pay',
            'Observation'
        ];        const tableRows = employees.map(emp => [
            emp.id?.toString() || '',
            emp.nom_et_prenom || '',
            (parseFloat(emp.prix_jour) || 0).toFixed(2),
            (parseFloat(emp.prix_hour) || 0).toFixed(2),
            (parseInt(emp.nombre_des_jours) || 0).toString(),
            (parseFloat(emp.nombre_des_heurx) || 0).toString(),
            (parseFloat(emp.travaux_attache) || 0).toFixed(2),
            (parseFloat(emp.salaire) || 0).toFixed(2),
            (parseFloat(emp.acompte) || 0).toFixed(2),
            (parseFloat(emp.net_a_payer) || 0).toFixed(2),
            emp.observation || 'None'
        ]);

        // Generate table using autoTable plugin
        doc.autoTable({
            head: [tableColumns],
            body: tableRows,
            startY: 50,
            styles: {
                fontSize: 8,
                cellPadding: 2,
                textColor: [0, 0, 0],
                lineColor: [200, 200, 200],
                lineWidth: 0.1
            },
            headStyles: {
                fillColor: [52, 152, 219],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 9
            },
            alternateRowStyles: {
                fillColor: [245, 245, 245]
            },
            columnStyles: {
                0: { halign: 'center', cellWidth: 10 }, // ID
                1: { halign: 'left', cellWidth: 25 },   // Name
                2: { halign: 'right', cellWidth: 15 },  // Daily Rate
                3: { halign: 'right', cellWidth: 15 },  // Hourly Rate
                4: { halign: 'center', cellWidth: 12 }, // Days
                5: { halign: 'center', cellWidth: 12 }, // Hours
                6: { halign: 'right', cellWidth: 18 },  // Attached Work
                7: { halign: 'right', cellWidth: 18 },  // Salary
                8: { halign: 'right', cellWidth: 18 },  // Advance
                9: { halign: 'right', cellWidth: 18 },  // Net Pay
                10: { halign: 'left', cellWidth: 25 }   // Observation
            },
            margin: { left: 10, right: 10 },
            theme: 'striped'
        });        // Calculate totals
        const totalSalary = employees.reduce((sum, emp) => sum + (parseFloat(emp.salaire) || 0), 0);
        const totalAdvance = employees.reduce((sum, emp) => sum + (parseFloat(emp.acompte) || 0), 0);
        const totalNetPay = employees.reduce((sum, emp) => sum + (parseFloat(emp.net_a_payer) || 0), 0);

        // Add summary section
        const finalY = doc.lastAutoTable.finalY + 10;
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('SUMMARY', 14, finalY);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Total Employees: ${employees.length}`, 14, finalY + 10);
        doc.text(`Total Salary: ${totalSalary.toFixed(2)} DZD`, 14, finalY + 20);
        doc.text(`Total Advances: ${totalAdvance.toFixed(2)} DZD`, 14, finalY + 30);
        doc.text(`Total Net Pay: ${totalNetPay.toFixed(2)} DZD`, 14, finalY + 40);
        
        // Add footer
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'italic');
            doc.text(
                `Page ${i} of ${pageCount}`,
                doc.internal.pageSize.width / 2,
                doc.internal.pageSize.height - 10,
                { align: 'center' }
            );
        }

        // Save the PDF
        const fileName = `salary_report_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(fileName);

        // Show success message
        showPDFSuccessMessage();

    } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Error generating PDF report: ' + error.message);
    } finally {
        // Reset button state
        const pdfButton = document.getElementById('generate-pdf-button');
        pdfButton.innerHTML = '<i class="fas fa-file-pdf"></i> Generate PDF Report';
        pdfButton.disabled = false;
    }
}

function showPDFSuccessMessage() {
    const message = document.createElement('div');
    message.textContent = 'PDF Report Generated Successfully!';
    message.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #27ae60;
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        font-weight: 600;
        animation: slideInRight 0.3s ease;
    `;
    
    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(message);
    
    setTimeout(() => {
        message.remove();
        style.remove();
    }, 4000);
}

// Function to get current user from localStorage
function getCurrentUser() {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
        try {
            // Try to parse as JSON first
            const userObject = JSON.parse(storedUser);
            return userObject;
        } catch (error) {
            // If it's not JSON, assume it's just a username string
            return { username: storedUser };
        }
    }
    return null;
}

// Function to display current user name in the header
function displayCurrentUserName() {
    const currentUserElement = document.getElementById('current-user');
    if (currentUserElement) {
        const user = getCurrentUser();
        if (user && user.username) {
            currentUserElement.textContent = user.username;
        } else {
            currentUserElement.textContent = 'Utilisateur';
        }
    }
}

// Call displayCurrentUserName on page load
document.addEventListener('DOMContentLoaded', displayCurrentUserName);

// ========================================
// ATTACHEMENT MODAL FUNCTIONALITY
// ========================================

// Global variable to store current employee for edit modal context
let currentEmployeeForAttachement = null;

// Function to open attachement modal
function openAttachementModal(employeeName = null) {
    const modal = document.getElementById('attachementModal');
    const employeeInput = document.getElementById('attachementEmployeeName');
    
    // Load employees into datalist
    loadEmployeesForAttachement();
    
    // If employee name is provided (from edit modal), pre-fill it
    if (employeeName) {
        currentEmployeeForAttachement = employeeName;
        employeeInput.value = employeeName;
        employeeInput.disabled = true; // Disable when coming from edit modal
        employeeInput.style.backgroundColor = '#f0f0f0';
        // Load existing attachments for this employee
        setTimeout(() => {
            loadExistingAttachements(employeeName);
        }, 100);
    } else {
        employeeInput.value = '';
        employeeInput.disabled = false;
        employeeInput.style.backgroundColor = '';
        currentEmployeeForAttachement = null;
    }
    
    modal.style.display = 'block';
    calculateAttachementTotal();
}

// Function to close attachement modal
function closeAttachementModal() {
    const modal = document.getElementById('attachementModal');
    modal.style.display = 'none';
    
    // Reset form
    document.getElementById('attachementForm').reset();
    currentEmployeeForAttachement = null;
    
    // Reset to single row
    const container = document.getElementById('attachementItemsContainer');
    container.innerHTML = `
        <div class="attachement-item-row">
            <div class="attachement-field">
                <label>Article</label>
                <input type="text" class="article-input" placeholder="Article..." required>
            </div>
            <div class="attachement-field">
                <label>Quantité</label>
                <input type="number" class="quantity-input" placeholder="Qté" min="0" step="1" required>
            </div>
            <div class="attachement-field">
                <label>Prix Unitaire</label>
                <input type="number" class="prix-unitaire-input" placeholder="Prix" min="0" step="0.01" required>
            </div>
            <button type="button" class="remove-item-btn" title="Supprimer">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    calculateAttachementTotal();
}

// Function to load employees for the datalist
async function loadEmployeesForAttachement() {
    try {
        const selectedProject = document.getElementById('project-selector').value || 'administration';
        const employees = await invoke('get_employees_by_project', { projectName: selectedProject });
        
        const employeeDatalist = document.getElementById('employeeNamesList');
        employeeDatalist.innerHTML = '';
        
        employees.forEach(emp => {
            const option = document.createElement('option');
            option.value = emp.nom_et_prenom;
            employeeDatalist.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading employees for attachement:', error);
    }
}

// Function to add a new attachement item row
function addAttachementItemRow() {
    const container = document.getElementById('attachementItemsContainer');
    const newRow = document.createElement('div');
    newRow.className = 'attachement-item-row';
    newRow.innerHTML = `
        <div class="attachement-field">
            <label>Article</label>
            <input type="text" class="article-input" placeholder="Article..." required>
        </div>
        <div class="attachement-field">
            <label>Quantité</label>
            <input type="number" class="quantity-input" placeholder="Qté" min="0" step="1" required>
        </div>
        <div class="attachement-field">
            <label>Prix Unitaire</label>
            <input type="number" class="prix-unitaire-input" placeholder="Prix" min="0" step="0.01" required>
        </div>
        <button type="button" class="remove-item-btn" title="Supprimer">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    container.appendChild(newRow);
    calculateAttachementTotal();
}

// Function to remove an attachement item row
function removeAttachementItemRow(button) {
    const container = document.getElementById('attachementItemsContainer');
    const rows = container.getElementsByClassName('attachement-item-row');
    
    // Keep at least one row
    if (rows.length > 1) {
        button.closest('.attachement-item-row').remove();
        calculateAttachementTotal();
    } else {
        showNotification('Au moins un article est requis!', 'error');
    }
}

// Function to calculate total amount
function calculateAttachementTotal() {
    const rows = document.querySelectorAll('.attachement-item-row');
    let total = 0;
    
    rows.forEach(row => {
        const quantity = parseFloat(row.querySelector('.quantity-input').value) || 0;
        const prixUnitaire = parseFloat(row.querySelector('.prix-unitaire-input').value) || 0;
        total += quantity * prixUnitaire;
    });
    
    document.getElementById('attachementTotalAmount').textContent = total.toFixed(2) + ' DA';
}

// Function to collect attachement data from form
function collectAttachementData() {
    const rows = document.querySelectorAll('.attachement-item-row');
    const items = [];
    
    rows.forEach(row => {
        const article = row.querySelector('.article-input').value.trim();
        const quantity = parseFloat(row.querySelector('.quantity-input').value) || 0;
        const prixUnitaire = parseFloat(row.querySelector('.prix-unitaire-input').value) || 0;
        
        if (article && quantity > 0 && prixUnitaire > 0) {
            items.push({
                article: article,
                quantity: quantity,
                prix_unitaire: prixUnitaire
            });
        }
    });
    
    return items;
}

// Function to save attachements
async function saveAttachements() {
    // Use currentEmployeeForAttachement if set (from edit modal), otherwise get from input
    const employeeName = currentEmployeeForAttachement || document.getElementById('attachementEmployeeName').value.trim();
    
    if (!employeeName) {
        showNotification('Veuillez entrer le nom de l\'employé!', 'error');
        return;
    }
    
    const items = collectAttachementData();
    
    if (items.length === 0) {
        showNotification('Veuillez ajouter au moins un article!', 'error');
        return;
    }
    
    try {
        const selectedProject = document.getElementById('project-selector').value || 'administration';
        const { annee, mois } = getCurrentYearMonth();
        
        await invoke('save_employee_attachements', {
            employeeName: employeeName,
            projectName: selectedProject,
            attachements: items,
            annee: annee,
            mois: mois
        });
        
        // Calculate total and update travaux_attache field
        const total = items.reduce((sum, item) => sum + (item.quantity * item.prix_unitaire), 0);
        
        // Update the travaux_attache value in the edit modal if it's open
        const editTravauxInput = document.getElementById('editTravauxAttache');
        if (editTravauxInput && currentEmployeeForAttachement === employeeName) {
            editTravauxInput.value = total.toFixed(2);
        }
        
        showNotification('Attachement enregistré avec succès!', 'success');
        closeAttachementModal();
        
        // Reload employees to reflect changes
        await loadEmployeesByProject(selectedProject);
    } catch (error) {
        console.error('Error saving attachements:', error);
        showNotification('Erreur lors de l\'enregistrement: ' + error, 'error');
    }
}

// Function to load existing attachements for an employee
async function loadExistingAttachements(employeeName) {
    try {
        const selectedProject = document.getElementById('project-selector').value || 'administration';
        const { annee, mois } = getCurrentYearMonth();
        const attachements = await invoke('get_employee_attachements', {
            employeeName: employeeName,
            projectName: selectedProject,
            annee: annee,
            mois: mois
        });
        
        if (attachements && attachements.length > 0) {
            const container = document.getElementById('attachementItemsContainer');
            container.innerHTML = ''; // Clear existing rows
            
            attachements.forEach(item => {
                const row = document.createElement('div');
                row.className = 'attachement-item-row';
                row.innerHTML = `
                    <div class="attachement-field">
                        <label>Article</label>
                        <input type="text" class="article-input" placeholder="Article..." value="${item.article}" required>
                    </div>
                    <div class="attachement-field">
                        <label>Quantité</label>
                        <input type="number" class="quantity-input" placeholder="Qté" value="${item.quantity}" min="0" step="1" required>
                    </div>
                    <div class="attachement-field">
                        <label>Prix Unitaire</label>
                        <input type="number" class="prix-unitaire-input" placeholder="Prix" value="${item.prix_unitaire}" min="0" step="0.01" required>
                    </div>
                    <button type="button" class="remove-item-btn" title="Supprimer">
                        <i class="fas fa-times"></i>
                    </button>
                `;
                container.appendChild(row);
            });
            
            calculateAttachementTotal();
        }
    } catch (error) {
        console.error('Error loading existing attachements:', error);
    }
}

// Function to show notification
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        border-radius: 8px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        font-weight: 600;
        animation: slideInRight 0.3s ease;
        background: ${type === 'success' ? '#27ae60' : '#e74c3c'};
        color: white;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 3000);
}

// Set up event listeners for attachement modal
document.addEventListener('DOMContentLoaded', function() {
    // Main page "Ajouter un Attachement" button
    const ajouterAttachementBtn = document.getElementById('ajouter-attachement-button');
    if (ajouterAttachementBtn) {
        ajouterAttachementBtn.addEventListener('click', () => openAttachementModal());
    }
    
    // Edit modal plus button
    const editAttachementBtn = document.getElementById('edit-attachement-btn');
    if (editAttachementBtn) {
        editAttachementBtn.addEventListener('click', function() {
            const employeeName = document.getElementById('editNomPrenom').value;
            if (employeeName) {
                openAttachementModal(employeeName);
            } else {
                showNotification('Nom de l\'employé introuvable!', 'error');
            }
        });
    }
    
    // Close button
    const closeAttachementBtn = document.querySelector('.close-attachement');
    if (closeAttachementBtn) {
        closeAttachementBtn.addEventListener('click', closeAttachementModal);
    }
    
    // Cancel button
    const cancelAttachementBtn = document.querySelector('.cancel-attachement-btn');
    if (cancelAttachementBtn) {
        cancelAttachementBtn.addEventListener('click', closeAttachementModal);
    }
    
    // Save button
    const saveAttachementBtn = document.querySelector('.save-attachement-btn');
    if (saveAttachementBtn) {
        saveAttachementBtn.addEventListener('click', saveAttachements);
    }
    
    // Add item button
    const addItemBtn = document.getElementById('addAttachementItemBtn');
    if (addItemBtn) {
        addItemBtn.addEventListener('click', addAttachementItemRow);
    }
    
    // Delegate event for remove buttons and input changes
    document.addEventListener('click', function(e) {
        if (e.target.closest('.remove-item-btn')) {
            removeAttachementItemRow(e.target.closest('.remove-item-btn'));
        }
    });
    
    document.addEventListener('input', function(e) {
        if (e.target.matches('.quantity-input, .prix-unitaire-input')) {
            calculateAttachementTotal();
        }
    });
    
    // Close modal when clicking outside
    const attachementModal = document.getElementById('attachementModal');
    if (attachementModal) {
        window.addEventListener('click', function(event) {
            if (event.target === attachementModal) {
                closeAttachementModal();
            }
        });
    }
    
    // ===== Import Employees Functionality =====
    const importEmployeesBtn = document.getElementById('import-employees-button');
    const importModal = document.getElementById('importEmployeesModal');
    const closeImportBtn = document.querySelector('.close-import');
    const cancelImportBtn = document.querySelector('.cancel-import-btn');
    const saveImportBtn = document.querySelector('.save-import-btn');
    
    if (importEmployeesBtn) {
        importEmployeesBtn.addEventListener('click', () => {
            importModal.style.display = 'block';
            document.getElementById('importEmployeesText').value = '';
        });
    }
    
    if (closeImportBtn) {
        closeImportBtn.addEventListener('click', () => {
            importModal.style.display = 'none';
        });
    }
    
    if (cancelImportBtn) {
        cancelImportBtn.addEventListener('click', () => {
            importModal.style.display = 'none';
        });
    }
    
    if (saveImportBtn) {
        saveImportBtn.addEventListener('click', async () => {
            const text = document.getElementById('importEmployeesText').value.trim();
            if (!text) {
                showNotification('Veuillez entrer au moins un employé!', 'error');
                return;
            }
            
            // Parse the input
            const lines = text.split('\n').filter(line => line.trim());
            const employees = [];
            
            for (const line of lines) {
                const parts = line.split(',').map(p => p.trim());
                if (parts.length >= 1) {
                    employees.push({
                        nom_et_prenom: parts[0],
                        tag: parts.length > 1 ? parts[1] : null
                    });
                }
            }
            
            if (employees.length === 0) {
                showNotification('Aucun employé valide trouvé!', 'error');
                return;
            }
            
            try {
                const { annee, mois } = getCurrentYearMonth();
                const result = await invoke('import_employees', { 
                    employees,
                    annee: annee,
                    mois: mois
                });
                showNotification(result, 'success');
                importModal.style.display = 'none';
                
                // Reload employees for current project
                const currentProject = getCurrentSelectedProject();
                if (currentProject && currentProject !== 'recap' && currentProject !== 'recap_chantier') {
                    await loadEmployeesByProject(currentProject);
                }
                
                // Refresh the employee names list for autocomplete in mode de saisir
                await loadEmployeeNames();
            } catch (error) {
                console.error('Error importing employees:', error);
                showNotification('Erreur lors de l\'importation: ' + error, 'error');
            }
        });
    }
    
    if (importModal) {
        window.addEventListener('click', function(event) {
            if (event.target === importModal) {
                importModal.style.display = 'none';
            }
        });
    }
});

// Initialize year and month selectors with current date
function initializeDateSelectors() {
    const yearSelector = document.getElementById('year-selector');
    const monthSelector = document.getElementById('month-selector');
    
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // JavaScript months are 0-based
    
    // Populate years (current year - 5 to current year + 2)
    for (let year = currentYear - 5; year <= currentYear + 2; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === currentYear) {
            option.selected = true;
        }
        yearSelector.appendChild(option);
    }
    
    // Set current month as selected
    monthSelector.value = currentMonth.toString();
}

// Get current selected year and month
function getCurrentYearMonth() {
    const yearSelector = document.getElementById('year-selector');
    const monthSelector = document.getElementById('month-selector');
    
    return {
        annee: parseInt(yearSelector.value),
        mois: parseInt(monthSelector.value)
    };
}

// Reload current view with selected year/month
async function reloadCurrentView() {
    const projectSelector = document.getElementById('project-selector');
    const selectedProject = projectSelector.value;
    
    if (selectedProject === 'recap') {
        await loadEmployeesRecap();
    } else if (selectedProject === 'recap_chantier') {
        await loadRecapChantier();
    } else {
        await loadEmployeesByProject(selectedProject);
    }
}

// Undo functionality
function addToUndoStack(action) {
    undoStack.push(action);
    
    // Keep only last MAX_UNDO_ACTIONS
    if (undoStack.length > MAX_UNDO_ACTIONS) {
        undoStack.shift();
    }
    
    // Show undo button
    updateUndoButtonVisibility();
}

function updateUndoButtonVisibility() {
    const undoBtn = document.getElementById('undo-button');
    if (undoBtn) {
        undoBtn.style.display = undoStack.length > 0 ? 'inline-flex' : 'none';
    }
}

async function performUndo() {
    if (undoStack.length === 0) return;
    
    const action = undoStack.pop();
    updateUndoButtonVisibility();
    
    try {
        if (action.type === 'delete') {
            // Restore deleted employee
            const { annee, mois } = getCurrentYearMonth();
            await invoke('insert_employee', {
                employee: {
                    nom_et_prenom: action.data.nom_et_prenom,
                    prix_jour: action.data.prix_jour,
                    prix_hour: action.data.prix_hour,
                    nombre_des_jours: action.data.nombre_des_jours,
                    nombre_des_heurx: action.data.nombre_des_heurx,
                    travaux_attache: action.data.travaux_attache,
                    salaire: action.data.salaire,
                    acompte: action.data.acompte,
                    net_a_payer: action.data.net_a_payer,
                    observation: action.data.observation
                },
                annee: annee,
                mois: mois
            });
            
            showNotification('Suppression annulée avec succès', 'success');
            await reloadCurrentEmployees();
        } else if (action.type === 'update') {
            // Restore previous values
            await invoke('update_employee', { employee: action.previousData });
            
            showNotification('Modification annulée avec succès', 'success');
            await reloadCurrentEmployees();
        }
    } catch (error) {
        console.error('Error performing undo:', error);
        showNotification('Erreur lors de l\'annulation: ' + error, 'error');
    }
}

// Setup undo button listener
document.addEventListener('DOMContentLoaded', function() {
    const undoBtn = document.getElementById('undo-button');
    if (undoBtn) {
        undoBtn.addEventListener('click', performUndo);
    }
    
    // Setup Excel export button listener
    const excelBtn = document.getElementById('export-excel-button');
    if (excelBtn) {
        excelBtn.addEventListener('click', exportToExcel);
    }
});

// Excel Export Functionality
async function exportToExcel() {
    try {
        const projectSelector = document.getElementById('project-selector');
        const selectedProject = projectSelector.value;
        const { annee, mois } = getCurrentYearMonth();
        
        // Get month name in French
        const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                           'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
        const monthName = monthNames[mois - 1];
        
        if (selectedProject === 'recap') {
            await exportRecapToExcel(annee, monthName);
        } else if (selectedProject === 'recap_chantier') {
            await exportRecapChantierToExcel(annee, monthName);
        } else {
            await exportProjectToExcel(selectedProject, annee, monthName);
        }
    } catch (error) {
        console.error('Error exporting to Excel:', error);
        showNotification('Erreur lors de l\'export Excel: ' + error, 'error');
    }
}

// Export Recap view to Excel with project columns
async function exportRecapToExcel(annee, monthName) {
    try {
        const { annee: year, mois } = getCurrentYearMonth();
        const recapData = await invoke('get_employees_recap', {
            annee: year,
            mois: mois
        });
        const projects = await invoke('get_project_names');
        
        // Prepare data for Excel
        const excelData = [];
        
        // Add header row
        const headers = ['ID', 'Nom et Prénom', 'Administration'];
        projects.forEach(project => {
            headers.push(project.name);
        });
        headers.push('Jours Total', 'Salaire Total', 'Acompte Total', 'Net à Payer Total');
        excelData.push(headers);
        
        // Filter employees who worked (total_jours > 0 OR net_a_payer > 0)
        const workingEmployees = recapData.filter(employee => {
            const totalJours = parseInt(employee.total_jours) || 0;
            const netAPayer = parseFloat(employee.total_net_a_payer) || 0;
            return totalJours > 0 || netAPayer > 0;
        });
        
        // Add employee rows
        workingEmployees.forEach(employee => {
            const row = [employee.employee_id, employee.nom_et_prenom];
            
            // Add Administration days
            const adminData = employee.projects && employee.projects['Administration'];
            row.push(adminData ? adminData.jours : 0);
            
            // Add days worked for each project
            projects.forEach(project => {
                const projectData = employee.projects && employee.projects[project.name];
                row.push(projectData ? projectData.jours : 0);
            });
            
            // Add totals
            row.push(
                parseInt(employee.total_jours) || 0,
                parseFloat(employee.total_salaire) || 0,
                parseFloat(employee.total_acompte) || 0,
                parseFloat(employee.total_net_a_payer) || 0
            );
            
            excelData.push(row);
        });
        
        // Create workbook and worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(excelData);
        
        // Get the range
        const range = XLSX.utils.decode_range(ws['!ref']);
        
        // Apply BOLD and STYLING to ALL cells
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
                if (!ws[cellAddress]) continue;
                
                // Initialize cell style
                ws[cellAddress].s = {
                    font: { bold: true, sz: 11, name: "Calibri" },
                    alignment: { vertical: "center", horizontal: C > 1 ? "center" : "left" },
                    border: {
                        top: { style: "thin", color: { rgb: "000000" } },
                        bottom: { style: "thin", color: { rgb: "000000" } },
                        left: { style: "thin", color: { rgb: "000000" } },
                        right: { style: "thin", color: { rgb: "000000" } }
                    }
                };
                
                // Header row styling - Blue background, white bold text
                if (R === 0) {
                    ws[cellAddress].s.fill = { patternType: "solid", fgColor: { rgb: "4472C4" } };
                    ws[cellAddress].s.font = { bold: true, sz: 11, name: "Calibri", color: { rgb: "FFFFFF" } };
                    ws[cellAddress].s.alignment = { horizontal: "center", vertical: "center" };
                } else {
                    // Data rows - alternating light blue
                    if (R % 2 === 0) {
                        ws[cellAddress].s.fill = { patternType: "solid", fgColor: { rgb: "D9E1F2" } };
                    } else {
                        ws[cellAddress].s.fill = { patternType: "solid", fgColor: { rgb: "FFFFFF" } };
                    }
                    
                    // Format numbers with thousands separator
                    if (C > 1 && typeof ws[cellAddress].v === 'number') {
                        ws[cellAddress].z = '#,##0';
                        ws[cellAddress].s.alignment.horizontal = "center";
                    }
                }
            }
        }
        
        // Set column widths
        const colWidths = [
            { wch: 8 },  // ID
            { wch: 28 }, // Nom et Prénom
            { wch: 15 }, // Administration
        ];
        projects.forEach(() => colWidths.push({ wch: 14 })); // Project columns
        colWidths.push({ wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 18 }); // Totals
        ws['!cols'] = colWidths;
        
        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Recap Employés');
        
        // Generate filename and save with proper options
        const filename = `Recap_Employes_${monthName}_${annee}.xlsx`;
        XLSX.writeFile(wb, filename, { 
            bookType: 'xlsx',
            cellStyles: true,
            type: 'binary'
        });
        
        showNotification('Export Excel réussi!', 'success');
    } catch (error) {
        console.error('Error exporting recap to Excel:', error);
        showNotification('Erreur lors de l\'export Excel', 'error');
    }
}

// Export Recap Chantier to Excel
async function exportRecapChantierToExcel(annee, monthName) {
    try {
        const { annee: year, mois } = getCurrentYearMonth();
        const recapData = await invoke('get_projects_recap', {
            annee: year,
            mois: mois
        });
        
        const excelData = [];
        excelData.push(['Projet', 'Net à Payer Total']);
        
        recapData.forEach(project => {
            excelData.push([
                project.project_name,
                parseFloat(project.total_net_a_payer) || 0
            ]);
        });
        
        // Add grand total row
        const grandTotal = recapData.reduce((sum, project) => {
            return sum + (parseFloat(project.total_net_a_payer) || 0);
        }, 0);
        excelData.push(['TOTAL GÉNÉRAL', grandTotal]);
        
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(excelData);
        
        // Apply styling - Blue theme with bold text
        const range = XLSX.utils.decode_range(ws['!ref']);
        
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
                if (!ws[cellAddress]) continue;
                
                // Initialize cell style with borders
                ws[cellAddress].s = {
                    font: { bold: true, sz: 11, name: "Calibri" },
                    alignment: { vertical: "center", horizontal: C === 0 ? "left" : "right" },
                    border: {
                        top: { style: "thin", color: { rgb: "000000" } },
                        bottom: { style: "thin", color: { rgb: "000000" } },
                        left: { style: "thin", color: { rgb: "000000" } },
                        right: { style: "thin", color: { rgb: "000000" } }
                    }
                };
                
                // Header row - blue background with white text
                if (R === 0) {
                    ws[cellAddress].s.fill = { patternType: "solid", fgColor: { rgb: "4472C4" } };
                    ws[cellAddress].s.font = { bold: true, sz: 12, name: "Calibri", color: { rgb: "FFFFFF" } };
                    ws[cellAddress].s.alignment = { horizontal: "center", vertical: "center" };
                } else if (R === range.e.r) {
                    // Total row - dark blue
                    ws[cellAddress].s.fill = { patternType: "solid", fgColor: { rgb: "2E5090" } };
                    ws[cellAddress].s.font = { bold: true, sz: 13, name: "Calibri", color: { rgb: "FFFFFF" } };
                    ws[cellAddress].s.alignment = { horizontal: C === 0 ? "left" : "right", vertical: "center" };
                } else {
                    // Data rows - alternating light blue
                    if (R % 2 === 0) {
                        ws[cellAddress].s.fill = { patternType: "solid", fgColor: { rgb: "D9E1F2" } };
                    } else {
                        ws[cellAddress].s.fill = { patternType: "solid", fgColor: { rgb: "FFFFFF" } };
                    }
                }
                
                // Format numbers
                if (C === 1 && typeof ws[cellAddress].v === 'number') {
                    ws[cellAddress].z = '#,##0.00" DA"';
                }
            }
        }
        
        ws['!cols'] = [{ wch: 35 }, { wch: 25 }];
        
        XLSX.utils.book_append_sheet(wb, ws, 'Recap Chantier');
        
        const filename = `Recap_Chantier_${monthName}_${annee}.xlsx`;
        XLSX.writeFile(wb, filename, { 
            bookType: 'xlsx',
            cellStyles: true,
            type: 'binary'
        });
        
        showNotification('Export Excel réussi!', 'success');
    } catch (error) {
        console.error('Error exporting recap chantier to Excel:', error);
        showNotification('Erreur lors de l\'export Excel', 'error');
    }
}

// Export single project to Excel
async function exportProjectToExcel(projectId, annee, monthName) {
    try {
        const { annee: year, mois } = getCurrentYearMonth();
        const employees = await invoke('get_employees_by_project', {
            projectId: projectId,
            annee: year,
            mois: mois
        });
        
        const excelData = [];
        excelData.push([
            'ID',
            'Nom et Prénom',
            'Prix de Jour',
            'Prix de Hour',
            'Nombre des Jours',
            'Nombre des Heurx',
            'Travaux Attaché',
            'Salaire',
            'Acompte',
            'Net à Payer',
            'Observation'
        ]);
        
        employees.forEach(employee => {
            excelData.push([
                employee.employee_id,
                employee.nom_et_prenom,
                parseFloat(employee.prix_jour) || 0,
                parseFloat(employee.prix_hour) || 0,
                parseInt(employee.nombre_des_jours) || 0,
                parseFloat(employee.nombre_des_heurx) || 0,
                parseFloat(employee.travaux_attache) || 0,
                parseFloat(employee.salaire) || 0,
                parseFloat(employee.acompte) || 0,
                parseFloat(employee.net_a_payer) || 0,
                employee.observation || ''
            ]);
        });
        
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(excelData);
        
        // Apply styling - Blue theme with bold text
        const range = XLSX.utils.decode_range(ws['!ref']);
        
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
                if (!ws[cellAddress]) continue;
                
                // Initialize cell style with borders
                ws[cellAddress].s = {
                    font: { bold: true, sz: 11, name: "Calibri" },
                    alignment: { vertical: "center", horizontal: "left" },
                    border: {
                        top: { style: "thin", color: { rgb: "000000" } },
                        bottom: { style: "thin", color: { rgb: "000000" } },
                        left: { style: "thin", color: { rgb: "000000" } },
                        right: { style: "thin", color: { rgb: "000000" } }
                    }
                };
                
                // Header row - blue background with white text
                if (R === 0) {
                    ws[cellAddress].s.fill = { patternType: "solid", fgColor: { rgb: "4472C4" } };
                    ws[cellAddress].s.font = { bold: true, sz: 11, name: "Calibri", color: { rgb: "FFFFFF" } };
                    ws[cellAddress].s.alignment = { horizontal: "center", vertical: "center" };
                } else {
                    // Data rows - alternating light blue
                    if (R % 2 === 0) {
                        ws[cellAddress].s.fill = { patternType: "solid", fgColor: { rgb: "D9E1F2" } };
                    } else {
                        ws[cellAddress].s.fill = { patternType: "solid", fgColor: { rgb: "FFFFFF" } };
                    }
                    
                    // Numbers right-aligned for numeric columns (2-9)
                    if (C >= 2 && C <= 9) {
                        ws[cellAddress].s.alignment = { horizontal: "right", vertical: "center" };
                        if (typeof ws[cellAddress].v === 'number') {
                            ws[cellAddress].z = '#,##0.00';
                        }
                    } else if (C === 1) {
                        // Name column - left aligned
                        ws[cellAddress].s.alignment = { horizontal: "left", vertical: "center" };
                    } else if (C === 0) {
                        // ID column - centered
                        ws[cellAddress].s.alignment = { horizontal: "center", vertical: "center" };
                    }
                }
            }
        }
        
        ws['!cols'] = [
            { wch: 8 }, { wch: 28 }, { wch: 13 }, { wch: 13 }, { wch: 16 },
            { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 35 }
        ];
        
        XLSX.utils.book_append_sheet(wb, ws, 'Salaires');
        
        const projectName = projectId === 'administration' ? 'Administration' : `Projet_${projectId}`;
        const filename = `${projectName}_${monthName}_${annee}.xlsx`;
        XLSX.writeFile(wb, filename, { 
            bookType: 'xlsx',
            cellStyles: true,
            type: 'binary'
        });
        
        showNotification('Export Excel réussi!', 'success');
    } catch (error) {
        console.error('Error exporting project to Excel:', error);
        showNotification('Erreur lors de l\'export Excel', 'error');
    }
}

// ========================================
// EMPLOYEE ID MANAGEMENT
// ========================================

// Reset employee sequence button
const resetSequenceButton = document.getElementById('reset-sequence-button');
if (resetSequenceButton) {
    resetSequenceButton.addEventListener('click', async () => {
        const confirmed = confirm('Voulez-vous vraiment réinitialiser la séquence des IDs?\n\nCela définira le prochain ID automatique basé sur l\'ID maximum actuel.');
        
        if (confirmed) {
            try {
                const result = await invoke('reset_employee_sequence');
                showNotification(result, 'success');
            } catch (error) {
                console.error('Error resetting sequence:', error);
                showNotification(`Erreur: ${error}`, 'error');
            }
        }
    });
}

// Cleanup duplicate records button
const cleanupDuplicatesButton = document.getElementById('cleanup-duplicates-button');
if (cleanupDuplicatesButton) {
    cleanupDuplicatesButton.addEventListener('click', async () => {
        const confirmed = confirm('⚠️ ATTENTION ⚠️\n\nCette opération va supprimer les enregistrements de salaire en double dans la base de données.\n\nCela peut résoudre les erreurs "duplicate key violation".\n\nVoulez-vous continuer?');
        
        if (confirmed) {
            try {
                const result = await invoke('cleanup_duplicate_salary_records');
                showNotification(result, 'success');
                // Reload the current view to reflect changes
                reloadCurrentView();
            } catch (error) {
                console.error('Error cleaning up duplicates:', error);
                showNotification(`Erreur: ${error}`, 'error');
            }
        }
    });
}

// Change Employee ID Modal
const changeIdModal = document.getElementById('changeIdModal');
const closeChangeIdBtn = document.querySelector('.close-change-id');
const cancelChangeIdBtn = document.querySelector('.cancel-change-id-btn');
const saveChangeIdBtn = document.querySelector('.save-change-id-btn');
const changeIdEmployeeSelect = document.getElementById('changeIdEmployeeName');
const currentIdDisplay = document.getElementById('currentIdDisplay');
const newEmployeeIdInput = document.getElementById('newEmployeeId');

// Add click event to table rows to open change ID modal
document.addEventListener('click', async (e) => {
    // Check if clicked element is the ID cell or within it
    const idCell = e.target.closest('td:first-child');
    if (idCell && idCell.parentElement.querySelector('.edit-btn')) {
        const employeeId = parseInt(idCell.textContent);
        const employeeName = idCell.parentElement.children[1].textContent;
        
        try {
            // Load all employees for the dropdown
            const allEmployees = await invoke('get_all_employees');
            changeIdEmployeeSelect.innerHTML = '<option value="">-- Sélectionner un employé --</option>';
            
            allEmployees.forEach(emp => {
                const option = document.createElement('option');
                option.value = emp.id;
                option.textContent = `${emp.nom_et_prenom} (ID: ${emp.id})`;
                if (emp.id === employeeId) {
                    option.selected = true;
                }
                changeIdEmployeeSelect.appendChild(option);
            });
            
            // Set current values
            currentIdDisplay.value = employeeId;
            newEmployeeIdInput.value = '';
            
            // Show modal
            changeIdModal.style.display = 'block';
        } catch (error) {
            console.error('Error loading employees:', error);
            showNotification('Erreur lors du chargement des employés', 'error');
        }
    }
});

// Update current ID display when employee is selected
changeIdEmployeeSelect.addEventListener('change', function() {
    const selectedOption = this.options[this.selectedIndex];
    if (selectedOption.value) {
        currentIdDisplay.value = selectedOption.value;
        newEmployeeIdInput.value = '';
    } else {
        currentIdDisplay.value = '';
    }
});

// Close modal handlers
if (closeChangeIdBtn) {
    closeChangeIdBtn.addEventListener('click', () => {
        changeIdModal.style.display = 'none';
    });
}

if (cancelChangeIdBtn) {
    cancelChangeIdBtn.addEventListener('click', () => {
        changeIdModal.style.display = 'none';
    });
}

// Save new ID
if (saveChangeIdBtn) {
    saveChangeIdBtn.addEventListener('click', async () => {
        const oldId = parseInt(currentIdDisplay.value);
        const newId = parseInt(newEmployeeIdInput.value);
        
        if (!oldId || !newId) {
            showNotification('Veuillez sélectionner un employé et entrer un nouvel ID', 'error');
            return;
        }
        
        if (oldId === newId) {
            showNotification('Le nouvel ID doit être différent de l\'ID actuel', 'error');
            return;
        }
        
        try {
            await invoke('update_employee_id', { oldId, newId });
            showNotification(`ID modifié avec succès: ${oldId} → ${newId}`, 'success');
            changeIdModal.style.display = 'none';
            
            // Reload the current view
            reloadCurrentView();
        } catch (error) {
            console.error('Error updating employee ID:', error);
            showNotification(`Erreur: ${error}`, 'error');
        }
    });
}

// Close modal when clicking outside
window.addEventListener('click', (event) => {
    if (event.target === changeIdModal) {
        changeIdModal.style.display = 'none';
    }
    
    const autoFillModal = document.getElementById('autoFillModal');
    if (event.target === autoFillModal) {
        closeAutoFillModal();
    }
});

// ============================================
// AUTO-FILL FROM LAST MONTH FUNCTIONALITY
// ============================================

let lastMonthData = null;

// Open auto-fill modal
function openAutoFillModal() {
    const modal = document.getElementById('autoFillModal');
    const projectSelect = document.getElementById('autoFillProjectSelect');
    const applyBtn = document.getElementById('applyAutoFillBtn');
    const infoDiv = document.getElementById('autoFillInfo');
    
    // Reset modal state
    projectSelect.value = '';
    applyBtn.disabled = true;
    infoDiv.style.display = 'none';
    lastMonthData = null;
    
    // Load projects into dropdown
    loadProjectsForAutoFill();
    
    modal.style.display = 'block';
}

// Close auto-fill modal
function closeAutoFillModal() {
    const modal = document.getElementById('autoFillModal');
    modal.style.display = 'none';
    lastMonthData = null;
}

// Load projects into auto-fill dropdown
async function loadProjectsForAutoFill() {
    const projectSelect = document.getElementById('autoFillProjectSelect');
    
    try {
        const projects = await invoke('get_projects');
        
        // Clear existing options except the first one
        projectSelect.innerHTML = '<option value="">-- Sélectionner un projet --</option><option value="administration">Administration</option>';
        
        projects.forEach(project => {
            const option = document.createElement('option');
            // Use project ID as value (this matches what's stored in employee_salary)
            option.value = project.id.toString();
            option.textContent = project.project_name;
            projectSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading projects for auto-fill:', error);
    }
}

// Handle project selection for auto-fill
document.addEventListener('DOMContentLoaded', function() {
    const autoFillBtn = document.getElementById('auto-fill-settings-btn');
    const projectSelect = document.getElementById('autoFillProjectSelect');
    const applyBtn = document.getElementById('applyAutoFillBtn');
    
    if (autoFillBtn) {
        autoFillBtn.addEventListener('click', openAutoFillModal);
    }
    
    if (projectSelect) {
        projectSelect.addEventListener('change', async function() {
            const selectedProject = this.value;
            const infoDiv = document.getElementById('autoFillInfo');
            const applyBtn = document.getElementById('applyAutoFillBtn');
            
            if (!selectedProject) {
                infoDiv.style.display = 'none';
                applyBtn.disabled = true;
                lastMonthData = null;
                return;
            }
            
            // Get previous month
            const { annee, mois } = getCurrentYearMonth();
            let prevMonth = mois - 1;
            let prevYear = annee;
            
            if (prevMonth === 0) {
                prevMonth = 12;
                prevYear = annee - 1;
            }
            
            console.log('🔍 Auto-fill search:', {
                selectedProject,
                prevYear,
                prevMonth,
                currentYear: annee,
                currentMonth: mois
            });
            
            try {
                // Fetch employees from previous month
                const employees = await invoke('get_employees_salary', {
                    project: selectedProject,
                    annee: prevYear,
                    mois: prevMonth
                });
                
                console.log('✅ Found employees:', employees.length);
                
                lastMonthData = {
                    project: selectedProject,
                    employees: employees,
                    sourceMonth: prevMonth,
                    sourceYear: prevYear
                };
                
                // Show info
                const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                                   'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
                document.getElementById('autoFillPeriod').textContent = 
                    `${monthNames[prevMonth - 1]} ${prevYear}`;
                document.getElementById('autoFillEmployeeCount').textContent = employees.length;
                
                infoDiv.style.display = 'block';
                applyBtn.disabled = employees.length === 0;
                
                if (employees.length === 0) {
                    showNotification('Aucune donnée trouvée pour le mois précédent', 'warning');
                }
            } catch (error) {
                console.error('Error fetching last month data:', error);
                showNotification('Erreur lors du chargement des données', 'error');
                infoDiv.style.display = 'none';
                applyBtn.disabled = true;
            }
        });
    }
    
    if (applyBtn) {
        applyBtn.addEventListener('click', async function() {
            if (!lastMonthData || !lastMonthData.employees || lastMonthData.employees.length === 0) {
                showNotification('Aucune donnée à importer', 'warning');
                return;
            }
            
            const { annee, mois } = getCurrentYearMonth();
            const currentProject = document.getElementById('project-selector').value;
            
            try {
                applyBtn.disabled = true;
                applyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Application...';
                
                // Insert each employee into the current month/project
                let successCount = 0;
                for (const emp of lastMonthData.employees) {
                    try {
                        await invoke('insert_employee_salary', {
                            employee: {
                                nom_et_prenom: emp.nom_et_prenom,
                                prix_jour: emp.prix_jour,
                                prix_hour: emp.prix_hour,
                                nombre_des_jours: emp.nombre_des_jours,
                                nombre_des_heurx: emp.nombre_des_heurx,
                                travaux_attache: emp.travaux_attache,
                                salaire: emp.salaire,
                                acompte: emp.acompte,
                                net_a_payer: emp.net_a_payer,
                                observation: emp.observation || ''
                            },
                            project: currentProject,
                            annee: annee,
                            mois: mois
                        });
                        successCount++;
                    } catch (error) {
                        console.error('Error inserting employee:', emp.nom_et_prenom, error);
                    }
                }
                
                closeAutoFillModal();
                showNotification(`${successCount} employé(s) importé(s) avec succès`, 'success');
                
                // Reload employees for current project
                await reloadCurrentEmployees();
                
            } catch (error) {
                console.error('Error applying auto-fill:', error);
                showNotification('Erreur lors de l\'application', 'error');
            } finally {
                applyBtn.disabled = false;
                applyBtn.innerHTML = '<i class="fas fa-check"></i> Appliquer';
            }
        });
    }
});

// Make functions globally accessible
window.openAutoFillModal = openAutoFillModal;
window.closeAutoFillModal = closeAutoFillModal;
