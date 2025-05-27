const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;
// const { appWindow } = "@tauri-apps/api/window";

// const { appDir } = "@tauri-apps/api/path";

// const { getCurrentWindow, LogicalSize } = window.__TAURI__.window;
// const { event, window: tauriWindow, path } = window.__TAURI__;


// const ajouter_un_employee_button = document.getElementById("ajouter-un-employee-button");

// ajouter_un_employee_button.addEventListener("click", async () => {
    
// });

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
        modal.style.display = 'block';
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
            const salaire = (prix_jour * nombre_des_jours) + (prix_hour * nombreHeurx);
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

    // Delegate click event for edit buttons
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
    });

    // Handle update button click (implement backend update logic as needed)
    updateButton.addEventListener('click', async function(e) {
        e.preventDefault();
        // Collect updated values
        const updatedEmployee = {
            id: document.getElementById('editId').value,
            nom_et_prenom: document.getElementById('editNomPrenom').value,
            prix_jour: parseFloat(document.getElementById('editPrixJour').value),
            prix_hour: parseFloat(document.getElementById('editPrixHour').value),
            nombre_des_jours: parseFloat(document.getElementById('editNombreJours').value),
            nombreHeurx: parseFloat(document.getElementById('editNombreHeurx').value),
            travaux_attache: document.getElementById('editTravauxAttache').value,
            salaire: parseFloat(document.getElementById('editSalaire').value),
            acompte: parseFloat(document.getElementById('editAcompte').value),
            net_a_payer: parseFloat(document.getElementById('editNetAPayer').value),
            observation: document.getElementById('editObservation').value
        };
        try {
            // Call backend to update employee (implement this in your backend)
            await invoke('update_employee', { employee: updatedEmployee });
            closeEditModal();
            await loadEmployees();
        } catch (error) {
            alert('Erreur lors de la mise à jour de l\'employé.');
        }
    });

    // get the number of projects from the database AND insert them into the dropdown
    const projects = await invoke('get_project_names');
    const projectDropdown = document.getElementById('project-selector');
    projectDropdown.innerHTML = ''; // Clear existing options
    const defaultOption = document.createElement('option');
    defaultOption.value = 'administration';
    defaultOption.textContent = 'Administration';
    defaultOption.selected = true;
    projectDropdown.appendChild(defaultOption);
    projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = project.name;
        projectDropdown.appendChild(option);
    });
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
    
    employees.forEach((employee, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${employee.nom_et_prenom}</td>
            <td>${employee.prix_jour}</td>
            <td>${employee.prix_hour}</td>
            <td>${employee.nombre_des_jours}</td>
            <td>0</td>
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
