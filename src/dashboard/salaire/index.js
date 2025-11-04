const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;
const { getCurrentWindow } = window.__TAURI__.window;

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
    
    // Set initial amount to 0
    document.querySelector('.amount').textContent = '0,00';
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
    modeDeSaisierButton.addEventListener('click', function() {
        // Open the mode de saisir modal instead of the regular add modal
        const modeDeSaisirModal = document.getElementById('modeDeSaisirModal');
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
            observation: observation
        };
          try {
            // Call backend to update employee
            await invoke('update_employee', { employee: updatedEmployee });
            closeEditModal();
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
        
        function calculateEditValues() {
            const prixJour = parseFloat(editPrixJour.value) || 0;
            const nombreJours = parseInt(editNombreJours.value) || 0;
            const nombreHeurx = parseFloat(editNombreHeurx.value) || 0;
            const travauxAttache = parseFloat(editTravauxAttache.value) || 0;
            const acompte = parseFloat(editAcompte.value) || 0;
            
            // Calculate prix_hour (prix de jour / 8)
            const prixHour = prixJour / 8;
            editPrixHour.value = prixHour.toFixed(2);
            
            // Calculate salaire: (prix_jour * nombre_des_jours) + (prix_hour * nombre_heurx) + travaux_attache
            const salaire = (prixJour * nombreJours) + (prixHour * nombreHeurx) + travauxAttache;
            editSalaire.value = salaire.toFixed(2);
            
            // Calculate net_a_payer: salaire - acompte
            const netAPayer = salaire - acompte;
            editNetAPayer.value = netAPayer.toFixed(2);
        }
        
        // Add event listeners to all relevant fields
        editPrixJour.addEventListener('input', calculateEditValues);
        editNombreJours.addEventListener('input', calculateEditValues);
        editNombreHeurx.addEventListener('input', calculateEditValues);
        editTravauxAttache.addEventListener('input', calculateEditValues);
        editAcompte.addEventListener('input', calculateEditValues);
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

    // Autocomplete functionality for names
    let employeeNames = [];
    
    async function loadEmployeeNames() {
        try {
            const employees = await invoke('get_all_employees');
            employeeNames = employees.map(emp => emp.nom_et_prenom);
        } catch (error) {
            console.error("Error loading employee names:", error);
        }
    }

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
        
        function calculateModeSaisirValues() {
            const prixJourVal = parseFloat(prixJour.value) || 0;
            const nombreJoursVal = parseInt(nombreJours.value) || 0;
            const nombreHeurxVal = parseFloat(nombreHeurx.value) || 0;
            const travauxAttacheVal = parseFloat(travauxAttache.value) || 0;
            const acompteVal = parseFloat(acompte.value) || 0;
            
            // Calculate prix_hour (prix de jour / 8)
            const prixHourVal = prixJourVal / 8;
            prixHour.value = prixHourVal.toFixed(2);
            
            // Calculate salaire: (prix_jour * nombre_des_jours) + (prix_hour * nombre_heurx) + travaux_attache
            const salaireVal = (prixJourVal * nombreJoursVal) + (prixHourVal * nombreHeurxVal) + travauxAttacheVal;
            salaire.value = salaireVal.toFixed(2);
            
            // Calculate net_a_payer: salaire - acompte
            const netAPayerVal = salaireVal - acompteVal;
            netAPayer.value = netAPayerVal.toFixed(2);
        }
        
        // Add event listeners to all relevant fields
        prixJour.addEventListener('input', calculateModeSaisirValues);
        nombreJours.addEventListener('input', calculateModeSaisirValues);
        nombreHeurx.addEventListener('input', calculateModeSaisirValues);
        travauxAttache.addEventListener('input', calculateModeSaisirValues);
        acompte.addEventListener('input', calculateModeSaisirValues);
        
        // Store function globally for external access
        window.calculateModeSaisirValues = calculateModeSaisirValues;
    }

    // Handle save button for mode de saisir
    saveModeSaisirButton.addEventListener('click', async function(e) {
        e.preventDefault();
        
        // Check if an employee is selected
        if (!window.selectedEmployeeId) {
            alert("Veuillez sélectionner un employé à modifier.");
            return;
        }
        
        try {
            // First, get the current employee data from database
            const employees = await invoke('get_all_employees');
            const currentEmployee = employees.find(emp => emp.id === window.selectedEmployeeId);
            
            if (!currentEmployee) {
                alert("Employé introuvable dans la base de données.");
                return;
            }
            
            // Start with current employee data
            const updatedEmployee = { ...currentEmployee };
            
            // Update only the fields that have new values
            const nom_et_prenom = document.getElementById('modeSaisirNomPrenom').value;
            if (nom_et_prenom && nom_et_prenom.trim() !== '') {
                updatedEmployee.nom_et_prenom = nom_et_prenom.trim();
            }
            
            const prixJourVal = document.getElementById('modeSaisirPrixJour').value;
            if (prixJourVal && prixJourVal.trim() !== '') {
                updatedEmployee.prix_jour = parseFloat(prixJourVal);
                updatedEmployee.prix_hour = parseFloat(prixJourVal) / 8;
            }
            
            const nombreJoursVal = document.getElementById('modeSaisirNombreJours').value;
            if (nombreJoursVal && nombreJoursVal.trim() !== '') {
                updatedEmployee.nombre_des_jours = parseInt(nombreJoursVal);
            }
            
            const nombreHeurxVal = document.getElementById('modeSaisirNombreHeurx').value;
            if (nombreHeurxVal && nombreHeurxVal.trim() !== '') {
                updatedEmployee.nombre_des_heurx = parseFloat(nombreHeurxVal);
            }
            
            const travauxAttacheVal = document.getElementById('modeSaisirTravauxAttache').value;
            if (travauxAttacheVal && travauxAttacheVal.trim() !== '') {
                updatedEmployee.travaux_attache = parseFloat(travauxAttacheVal);
            }
            
            const acompteVal = document.getElementById('modeSaisirAcompte').value;
            if (acompteVal && acompteVal.trim() !== '') {
                updatedEmployee.acompte = parseFloat(acompteVal);
            }
            
            const observationVal = document.getElementById('modeSaisirObservation').value;
            if (observationVal && observationVal.trim() !== '') {
                updatedEmployee.observation = observationVal.trim();
            }
            
            // Ensure all numeric fields have valid values for calculation
            const prixJour = updatedEmployee.prix_jour || 0;
            const prixHour = updatedEmployee.prix_hour || 0;
            const nombreJours = updatedEmployee.nombre_des_jours || 0;
            const nombreHeurx = updatedEmployee.nombre_des_heurx || 0;
            const travauxAttache = updatedEmployee.travaux_attache || 0;
            const acompte = updatedEmployee.acompte || 0;
            
            // Recalculate salary with updated values
            const salaire = (prixJour * nombreJours) + (prixHour * nombreHeurx) + travauxAttache;
            updatedEmployee.salaire = salaire;
            updatedEmployee.net_a_payer = salaire - acompte;

            // Call Tauri command to update employee
            await invoke('update_employee', { employee: updatedEmployee });

            // Reset form and close modal
            modeDeSaisirForm.reset();
            closeModeDeSaisirModal();            window.selectedEmployeeId = null; // Reset selected employee

            // Reload employees from database
            await reloadCurrentEmployees();            await loadEmployeeNames(); // Refresh autocomplete data
            
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
        // Only show employees who have worked (total_jours > 0)
        filteredData = recapData.filter(employee => {
            const totalJours = parseInt(employee.total_jours) || 0;
            return totalJours > 0;
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
        
        // Add to total Net a Payer
        totalNetAPayer += Number(employee.net_a_payer);
    });
    
    // Update total Net a Payer in the balance section
    document.querySelector('.amount').textContent = totalNetAPayer.toLocaleString('fr-FR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
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
            
            // Delete from database
            await invoke('delete_employee', { employeeSalaryId: parseInt(employeeId) });
            
            // Remove row from table
            const row = button.closest('tr');            row.remove();
            
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
    let totalNetAPayer = 0;
      visibleRows.forEach(row => {
        const netPayCell = row.cells[9]; // Net a Payer is the 10th column (index 9)
        if (netPayCell) {
            const value = parseFloat(netPayCell.textContent) || 0;
            totalNetAPayer += value;
        }
    });
    
    // Update the total amount display
    document.querySelector('.amount').textContent = totalNetAPayer.toLocaleString('fr-FR', {
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2
    });
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
