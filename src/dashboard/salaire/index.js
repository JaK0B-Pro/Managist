const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;
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
            window.location.href = "../";
        });
    }
});

document.addEventListener('DOMContentLoaded', async function() {
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
    
    // Load employees from database when page loads
    await loadEmployees();
    
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

    // Handle project selection change
    projectSelector.addEventListener('change', function() {
        const selectedProject = this.value;
        if (selectedProject) {
            console.log(`Selected project: ${selectedProject}`);
            // You can filter employees by project here if needed
            // For example: filterEmployeesByProject(selectedProject);
        }
    });

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

                // Call Tauri command to add employee to database
                await invoke('insert_employee', {
                    employee: {
                        nom_et_prenom,
                        prix_jour,
                        prix_hour,
                        nombre_des_jours,
                        travaux_attache,
                        salaire,
                        acompte,
                        net_a_payer,
                        observation
                    }
                });

                // Reset form and close modal
                employeeForm.reset();
                modal.style.display = 'none';

                // Reload employees from database
                await loadEmployees();
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
        }
    });

    // Delegate click event for edit and delete buttons
    document.querySelector('table tbody').addEventListener('click', function(e) {
        if (e.target.closest('.edit-btn')) {
            const row = e.target.closest('tr');
            // Get all cell values
            const cells = row.querySelectorAll('td');
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
    });

    // Handle update button click with proper salary calculations
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
        
        // Calculate derived values (same logic as in add employee)
        const prix_hour = prix_jour / 8; // Prix de hour is prix de jour/8
        const salaire = (prix_jour * nombre_des_jours) + (prix_hour * nombreHeurx) + travaux_attache;
        const net_a_payer = salaire - acompte;
        
        // Create the updated employee object
        const updatedEmployee = {
            id: id, // ID is never changed, only used for WHERE clause
            nom_et_prenom: nom_et_prenom,
            prix_jour: prix_jour,
            prix_hour: prix_hour,
            nombre_des_jours: nombre_des_jours,
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
            await loadEmployees();
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
            closeModeDeSaisirModal();
            window.selectedEmployeeId = null; // Reset selected employee

            // Reload employees from database
            await loadEmployees();
            await loadEmployeeNames(); // Refresh autocomplete data
            
            // Show success modal instead of alert
            showSuccessModal();
            
        } catch (error) {
            console.error("Error updating employee:", error);
            alert("Erreur lors de la mise à jour de l'employé: " + error);
        }
    });    // Initialize mode de saisir functionality
    addModeSaisirCalculationListeners();
    await loadEmployeeNames();
    setupAutocomplete();

    // Initialize search functionality
    initializeSearch();
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
}

// Function to update the employee table with data from database
function updateEmployeeTable(employees) {
    const tbody = document.querySelector('table tbody');
    tbody.innerHTML = '';
    
    let totalNetAPayer = 0;
    
    employees.forEach((employee) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${employee.id}</td>
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
            await invoke('delete_employee', { employeeId: parseInt(employeeId) });
            
            // Remove row from table
            const row = button.closest('tr');
            row.remove();
            
            // Reload employees to update the table and total
            await loadEmployees();
            
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
