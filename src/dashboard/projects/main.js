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

// Logout functionality
document.addEventListener('DOMContentLoaded', function() {
    setupRoleBasedNavigation(); // Setup role-based navigation first
    
    const logoutButton = document.getElementById("logout-button");
    if (logoutButton) {
        logoutButton.addEventListener("click", () => {
            clearCurrentUser();  // Clear the user state
            resizeWindow(500, 600);
            window.location.href = "../";
        });
    }
});

// Function to display projects (optimized with document fragment)
async function afficherProjets() {
  const projects = await invoke('get_projects');
  const container = document.getElementById('projectList');
  container.innerHTML = ""; // Clear container
  
  // Use document fragment for better performance
  const fragment = document.createDocumentFragment();
    projects.forEach((projet, index) => {
      const card = document.createElement('div');
      card.className = 'project-card';
      card.dataset.index = index; // Use dataset for easier access

      // Format dates if they exist (only if defined, to avoid unnecessary operations)
      const dateDebut = projet.project_start_date ? new Date(projet.project_start_date).toLocaleDateString() : 'Non défini';
      const dateFin = projet.project_end_date ? new Date(projet.project_end_date).toLocaleDateString() : 'Non défini';

      // Calculate progress (assuming nda_vendus / nombre_des_appartement * 100)
      const progress = projet.nombre_des_appartement > 0 ? Math.round((projet.nda_vendus / projet.nombre_des_appartement) * 100) : 0;
      
      // Use CSS Grid layout for consistent spacing
      card.innerHTML = `
          <div class="project-actions">
              <button class="action-btn settings-btn" data-project-id="${projet.id}" title="Modifier le projet">
                  <i class="fas fa-cog"></i>
              </button>
              <button class="action-btn delete-btn" data-project-id="${projet.id}" title="Supprimer le projet">
                  <i class="fas fa-trash"></i>
              </button>
          </div>
          <h2>${projet.project_name}</h2>
          <div class="location">${projet.project_location}</div>
          <div class="info-row">
              <div><strong>Total:</strong> ${projet.nombre_des_appartement} appartements</div>
              <div><strong>Vendus:</strong> ${projet.nda_vendus}</div>
          </div>
          <div class="info-row">
              <div><strong>Début:</strong> ${dateDebut}</div>
              <div><strong>Fin:</strong> ${dateFin}</div>
          </div>
          <div class="info-row">
              <div><strong>Types:</strong> ${projet.types_appartements || 'Non spécifié'}</div>
          </div>
          <div class="progress-info">
              <span>Progress</span>
              <span>${progress}%</span>
          </div>
          <div class="progress-bar">
              <div class="progress-fill" style="width: ${progress}%"></div>
          </div>
          <button class="voir-plus-btn">Voir plus</button>
      `;

      fragment.appendChild(card);
  });
  
  // Append all cards at once
  container.appendChild(fragment);
}

// Use event delegation for buttons instead of adding multiple listeners
document.getElementById('projectList').addEventListener('click', function(e) {
  // Check if the clicked element is a "Voir plus" button
  if (e.target.classList.contains('voir-plus-btn')) {
    const card = e.target.closest('.project-card');
    const deleteBtn = card.querySelector('.delete-btn');
    const projectId = deleteBtn.getAttribute('data-project-id');
    window.location.href = `./buyers/chaqueProjetPage.html?projectId=${projectId}`;
  }
  
  // Check if the clicked element is a settings button
  if (e.target.classList.contains('settings-btn') || e.target.closest('.settings-btn')) {
    e.stopPropagation();
    const settingsBtn = e.target.closest('.settings-btn');
    const projectId = settingsBtn.getAttribute('data-project-id');
    openEditProjectModal(projectId);
  }
  
  // Check if the clicked element is a delete button
  if (e.target.classList.contains('delete-btn') || e.target.closest('.delete-btn')) {
    e.stopPropagation();
    const deleteBtn = e.target.closest('.delete-btn');
    const projectId = deleteBtn.getAttribute('data-project-id');
    deleteProject(projectId);
  }
});

// Function to open edit project modal
async function openEditProjectModal(projectId) {
  try {
    const projects = await invoke('get_projects');
    const project = projects.find(p => p.id == projectId);
    
    if (!project) {
      alert('Projet non trouvé');
      return;
    }
    
    // Populate the edit form with current project data
    document.getElementById('editProjectId').value = project.id;
    document.getElementById('editNomProjet').value = project.project_name;
    document.getElementById('editLocation').value = project.project_location;
    document.getElementById('editNmbrDesBlocs').value = project.nombre_des_bloc;
    document.getElementById('editNmbrDesEtages').value = project.nombre_des_etages;
    document.getElementById('editNmbrDesAppartementsDansChaqueBloc').value = project.nda_dans_chaque_etage;
    document.getElementById('editTypes').value = project.types_appartements || '';
    document.getElementById('editSurfaces').value = project.surfaces_appartements || '';
    document.getElementById('editNmbrDesAppartementsTotal').value = project.nombre_des_appartement;
    
    // Format dates for input fields (assuming they come in YYYY-MM-DD format)
    if (project.project_start_date) {
      const startDate = project.project_start_date.split('T')[0]; // Get just the date part
      document.getElementById('editDateDeDebut').value = startDate;
    }
    if (project.project_end_date) {
      const endDate = project.project_end_date.split('T')[0]; // Get just the date part
      document.getElementById('editDateDeFin').value = endDate;
    }    // Show the modal
    const modal = document.getElementById('editProjectModal');
    // Ensure modal is properly positioned
    modal.style.display = 'flex';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.classList.add('show');
    
  } catch (error) {
    console.error('Error loading project data:', error);
    alert('Erreur lors du chargement des données du projet');
  }
}

// Function to close edit project modal
function closeEditProjectModal() {
  const modal = document.getElementById('editProjectModal');
  modal.style.display = 'none';
  modal.classList.remove('show');
  document.getElementById('editProjectForm').reset();
}

// Initialize on DOMContentLoaded for better performance
document.addEventListener('DOMContentLoaded', function() {
  // Display initial projects
  afficherProjets();
  
  // Event listeners for edit project modal
  const editProjectClose = document.getElementById('editProjectClose');
  const editProjectCancel = document.getElementById('editProjectCancel');
  const editProjectForm = document.getElementById('editProjectForm');
  const editProjectModal = document.getElementById('editProjectModal');
  
  if (editProjectClose) {
    editProjectClose.addEventListener('click', closeEditProjectModal);
  }
  
  if (editProjectCancel) {
    editProjectCancel.addEventListener('click', closeEditProjectModal);
  }
  
  // Handle edit project form submission
  if (editProjectForm) {
    editProjectForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const projectId = parseInt(document.getElementById('editProjectId').value);
      const updatedProject = {
        project_name: document.getElementById('editNomProjet').value,
        project_location: document.getElementById('editLocation').value,
        nombre_des_bloc: parseInt(document.getElementById('editNmbrDesBlocs').value),
        nombre_des_etages: parseInt(document.getElementById('editNmbrDesEtages').value),
        nombre_des_appartement: parseInt(document.getElementById('editNmbrDesAppartementsTotal').value),
        nda_dans_chaque_etage: parseInt(document.getElementById('editNmbrDesAppartementsDansChaqueBloc').value),
        nda_vendus: 0, // Keep existing value, backend will preserve this
        project_start_date: document.getElementById('editDateDeDebut').value,
        project_end_date: document.getElementById('editDateDeFin').value,
        types_appartements: document.getElementById('editTypes').value,
        surfaces_appartements: document.getElementById('editSurfaces').value,
      };
      
      try {
        await invoke('update_project', { projectId, project: updatedProject });
          // Close modal and refresh project list
        closeEditProjectModal();
        await afficherProjets();
        
        // Show success modal
        showUpdateProjectSuccessModal();
        showUpdateProjectSuccessModal();
        
      } catch (error) {
        console.error('Error updating project:', error);
        alert('Erreur lors de la modification du projet. Veuillez réessayer.');
      }
    });
  }
  
  // Close edit modal when clicking outside
  if (editProjectModal) {
    editProjectModal.addEventListener('click', function(e) {
      if (e.target === this) {
        closeEditProjectModal();
      }
    });
  }
  
  // Auto-calculate total apartments for edit form
  const editCalcFields = ['editNmbrDesBlocs', 'editNmbrDesEtages', 'editNmbrDesAppartementsDansChaqueBloc'];
  editCalcFields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.addEventListener('input', calculateEditTotalApartments);
      field.addEventListener('change', calculateEditTotalApartments);
    }
  });

  // Allow manual editing of total apartments in edit form
  const editTotalField = document.getElementById('editNmbrDesAppartementsTotal');
  if (editTotalField) {
    editTotalField.addEventListener('input', function() {
      if (this.value) {
        this.dataset.autoCalculated = 'false';
      }
    });
  }
});

// Auto-calculate total apartments for edit form
function calculateEditTotalApartments() {
  const nmbrDesBlocs = parseInt(document.getElementById('editNmbrDesBlocs').value) || 0;
  const nmbrDesEtages = parseInt(document.getElementById('editNmbrDesEtages').value) || 0;
  const nmbrDesAppartementsDansChaqueBloc = parseInt(document.getElementById('editNmbrDesAppartementsDansChaqueBloc').value) || 0;
  
  const totalApartments = nmbrDesBlocs * nmbrDesEtages * nmbrDesAppartementsDansChaqueBloc;
  
  const totalField = document.getElementById('editNmbrDesAppartementsTotal');
  if (!totalField.value || totalField.dataset.autoCalculated === 'true') {
    totalField.value = totalApartments;
    totalField.dataset.autoCalculated = 'true';  }
}

async function deleteProject(projectId) {
  // Show confirmation modal
  const modal = document.getElementById('confirmationModal');
  const confirmBtn = document.getElementById('confirmDelete');
  const cancelBtn = document.getElementById('confirmCancel');
  const closeBtn = document.getElementById('confirmModalClose');
  
  // Show modal
  modal.style.display = 'flex';
  modal.classList.add('show');
  
  // Handle confirm deletion
  const handleConfirm = async () => {
    try {
      await invoke('delete_project_from_database', { projectId: parseInt(projectId) });
      
      // Close confirmation modal
      modal.style.display = 'none';
      modal.classList.remove('show');
      
      // Refresh project list
      await afficherProjets();
      
      // Show success modal
      showDeleteSuccessModal();
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Erreur lors de la suppression du projet. Veuillez réessayer.');
    }
    
    // Clean up event listeners
    confirmBtn.removeEventListener('click', handleConfirm);
    cancelBtn.removeEventListener('click', handleCancel);
    closeBtn.removeEventListener('click', handleCancel);
  };
  
  // Handle cancel deletion
  const handleCancel = () => {
    modal.style.display = 'none';
    modal.classList.remove('show');
    
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
  modal.addEventListener('click', function closeOnOutsideClick(event) {
    if (event.target === modal) {
      handleCancel();
      modal.removeEventListener('click', closeOnOutsideClick);
    }
  });
}

// Function to show update success modal
function showUpdateProjectSuccessModal() {
  const modal = document.getElementById('updateProjectSuccessModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
  
  // Handle OK button click
  const okBtn = document.getElementById('updateProjectSuccessOk');
  const handleOk = () => {
    modal.style.display = 'none';
    modal.classList.remove('show');
    okBtn.removeEventListener('click', handleOk);
  };
  
  okBtn.addEventListener('click', handleOk);
  
  // Close modal when clicking outside
  modal.addEventListener('click', function closeOnOutsideClick(event) {
    if (event.target === modal) {
      handleOk();
      modal.removeEventListener('click', closeOnOutsideClick);
    }
  });
}

// Function to show delete success modal
function showDeleteSuccessModal() {
  const modal = document.getElementById('successModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
  
  // Handle OK button click
  const okBtn = document.getElementById('successOk');
  const handleOk = () => {
    modal.style.display = 'none';
    modal.classList.remove('show');
    okBtn.removeEventListener('click', handleOk);
  };
  
  okBtn.addEventListener('click', handleOk);
  
  // Close modal when clicking outside
  modal.addEventListener('click', function closeOnOutsideClick(event) {
    if (event.target === modal) {
      handleOk();
      modal.removeEventListener('click', closeOnOutsideClick);
    }
  });
}

// Initialize on DOMContentLoaded for better performance
document.addEventListener('DOMContentLoaded', function() {
  // Affichage initial
  afficherProjets();
});

// Bouton "Ajouter un projet" : afficher / cacher le formulaire
document.getElementById('showFormBtn').addEventListener('click', () => {
  const form = document.getElementById('projectForm');
  form.style.display = 'block';
  // Add modal overlay
  addModalOverlay();
});

// Fonction pour ajouter l'overlay modal
function addModalOverlay() {
  // Check if overlay already exists
  if (!document.getElementById('modal-overlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'modal-overlay';
    document.body.appendChild(overlay);
    
    // Add fade-in animation with requestAnimationFrame for better performance
    requestAnimationFrame(() => {
      overlay.classList.add('active');
    });
  }
}

// Fonction pour supprimer l'overlay modal
function removeModalOverlay() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) {
    overlay.classList.remove('active');
    setTimeout(() => {
      overlay.remove();
    }, 300); // Match transition time
  }
}

// Gestion du bouton Cancel et de la fermeture du formulaire (consolidated)
function closeForm() {
  const form = document.getElementById('projectForm');
  form.style.display = 'none';
  form.reset();
  removeModalOverlay();
}

// Using a single handler for both cancel button and overlay click
document.querySelector('.cancel-btn').addEventListener('click', closeForm);

// Gestion du clic en dehors du formulaire
document.addEventListener('click', function(event) {
  const overlay = document.getElementById('modal-overlay');
  if (overlay && event.target === overlay) {
    closeForm();
  }
});

// Gestion du formulaire
document.getElementById('projectForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  
  const project = {
    project_name: document.getElementById('nomProjet').value,
    project_location: document.getElementById('location').value,
    nombre_des_bloc: parseInt(document.getElementById('nmbrDesBlocs').value, 10) || 0,
    nombre_des_etages: parseInt(document.getElementById('nmbrDesEtages').value, 10) || 0,
    nombre_des_appartement: parseInt(document.getElementById('nmbrDesAppartementsTotal').value, 10) || 0,
    nda_dans_chaque_etage: Math.floor(parseInt(document.getElementById('nmbrDesAppartementsDansChaqueBloc').value, 10) / parseInt(document.getElementById('nmbrDesEtages').value, 10)) || 0,
    nda_vendus: 0, // Initially no apartments are sold
    project_start_date: document.getElementById('dateDeDebut').value,
    project_end_date: document.getElementById('dateDeFin').value,
    types_appartements: document.getElementById('types').value,
    surfaces_appartements: document.getElementById('surfaces').value,
  };
  
  try {
    await invoke('add_project_to_the_database', { project });
    afficherProjets();
    closeForm();
    // Show success modal for project addition
    showAddProjectSuccessModal();
  } catch (error) {
    console.error("Error adding project:", error);
    alert("Erreur lors de l'ajout du projet. Veuillez réessayer.");
  }
});

// Automatic calculation for total apartments
function calculateTotalApartments() {
  const nmbrDesBlocs = parseInt(document.getElementById('nmbrDesBlocs').value, 10) || 0;
  const nmbrDesEtages = parseInt(document.getElementById('nmbrDesEtages').value, 10) || 0;
  const nmbrDesAppartementsDansChaqueBloc = parseInt(document.getElementById('nmbrDesAppartementsDansChaqueBloc').value, 10) || 0;
  
  const totalApartments = nmbrDesBlocs * nmbrDesEtages * nmbrDesAppartementsDansChaqueBloc;
  
  // Update the total apartments field only if it's empty or if user wants auto-calculation
  const totalField = document.getElementById('nmbrDesAppartementsTotal');
  
  // Only auto-fill if the field is empty or has the calculated value
  if (!totalField.value || totalField.dataset.autoCalculated === 'true') {
    totalField.value = totalApartments;
    totalField.dataset.autoCalculated = 'true';
    
    // Add visual feedback with a subtle animation
    totalField.style.backgroundColor = '#e8f5e8';
    setTimeout(() => {
      totalField.style.backgroundColor = '';
    }, 1000);
  }
}

// Add event listeners for automatic calculation
document.addEventListener('DOMContentLoaded', function() {
  const calcFields = ['nmbrDesBlocs', 'nmbrDesEtages', 'nmbrDesAppartementsDansChaqueBloc'];
  calcFields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.addEventListener('input', calculateTotalApartments);
      field.addEventListener('change', calculateTotalApartments);
    }
  });
  
  // Allow manual editing of total apartments field
  const totalField = document.getElementById('nmbrDesAppartementsTotal');
  if (totalField) {
    // Remove readonly attribute to allow manual editing
    totalField.removeAttribute('readonly');
    totalField.style.backgroundColor = '';
    totalField.title = 'Auto-calculé ou saisissez manuellement';
    
    // When user manually edits, mark it as manually edited
    totalField.addEventListener('input', function() {
      if (this.value) {
        this.dataset.autoCalculated = 'false';
      }
    });
    
    // Add a button to recalculate if needed
    const recalcButton = document.createElement('button');
    recalcButton.type = 'button';
    recalcButton.innerHTML = '<i class="fas fa-calculator"></i> Recalculer';
    recalcButton.className = 'recalc-btn';
    recalcButton.style.cssText = `
      margin-left: 10px;
      padding: 5px 10px;
      background: #4a90e2;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    `;
    recalcButton.addEventListener('click', function() {
      totalField.dataset.autoCalculated = 'true';
      calculateTotalApartments();
    });
    
    // Insert the button after the total field
    totalField.parentNode.appendChild(recalcButton);
  }
});

// Function to show success modal for project addition
function showAddProjectSuccessModal() {
  const modal = document.getElementById('addProjectSuccessModal');
  const okBtn = document.getElementById('addProjectSuccessOk');
  
  // Show modal with flexbox centering
  modal.style.display = 'flex';
  modal.classList.add('show');
  
  // Handle OK button click
  const handleOk = () => {
    modal.style.display = 'none';
    modal.classList.remove('show');
    
    // Clean up event listener
    okBtn.removeEventListener('click', handleOk);
  };
  
  // Add event listener
  okBtn.addEventListener('click', handleOk);
  
  // Close modal when clicking outside
  modal.addEventListener('click', function closeOnOutsideClick(event) {
    if (event.target === modal) {
      handleOk();
      modal.removeEventListener('click', closeOnOutsideClick);
    }
  });
}

// Project Parameters Management
let currentEditingInfoId = null;
let currentSelectedProjectId = null;

// Show project parameters modal
document.getElementById('projectParamsBtn').addEventListener('click', function() {
  const modal = document.getElementById('projectParamsModal');
  modal.classList.add('show');
  loadProjectsGrid();
});

// Close project parameters modal
document.getElementById('projectParamsClose').addEventListener('click', function() {
  const modal = document.getElementById('projectParamsModal');
  modal.classList.remove('show');
  resetForm();
  showProjectsGrid();
});

// Back to projects button
document.addEventListener('DOMContentLoaded', function() {
  const backBtn = document.getElementById('backToProjects');
  if (backBtn) {
    backBtn.addEventListener('click', showProjectsGrid);
  }
});

// Load projects as grid cards
async function loadProjectsGrid() {
  try {
    const projects = await invoke('get_projects');
    const container = document.getElementById('projectsList');
    
    if (projects.length === 0) {
      container.innerHTML = '<div class="empty-state">Aucun projet disponible</div>';
      return;
    }
    
    container.innerHTML = projects.map(project => `
      <div class="project-card" data-project-id="${project.id}" data-project-name="${project.project_name}">
        <i class="fas fa-building"></i>
        <h4>${project.project_name}</h4>
        <p>${project.project_location}</p>
      </div>
    `).join('');
    
    // Add click event listeners to project cards
    container.querySelectorAll('.project-card').forEach(card => {
      card.addEventListener('click', function() {
        const projectId = parseInt(this.dataset.projectId);
        const projectName = this.dataset.projectName;
        selectProject(projectId, projectName);
      });
    });
  } catch (error) {
    console.error('Error loading projects:', error);
    alert('Erreur lors du chargement des projets');
  }
}

// Show projects grid (hide apartment types section)
function showProjectsGrid() {
  document.getElementById('apartmentTypesSection').style.display = 'none';
  document.querySelector('.projects-list').style.display = 'block';
  currentSelectedProjectId = null;
}

// Select a project and show its apartment types
function selectProject(projectId, projectName) {
  currentSelectedProjectId = projectId;
  document.getElementById('selectedProjectName').textContent = `Types d'appartements - ${projectName}`;
  document.querySelector('.projects-list').style.display = 'none';
  document.getElementById('apartmentTypesSection').style.display = 'block';
  loadApartmentTypes(projectId);
}

// Load apartment types for selected project
async function loadApartmentTypes(projectId) {
  try {
    const apartmentTypes = await invoke('get_project_info', { projectId });
    displayApartmentTypes(apartmentTypes);
  } catch (error) {
    console.error('Error loading apartment types:', error);
    alert('Erreur lors du chargement des types d\'appartements');
  }
}

// Display apartment types
function displayApartmentTypes(apartmentTypes) {
  const container = document.getElementById('apartmentTypesList');
  
  if (apartmentTypes.length === 0) {
    container.innerHTML = '<div class="empty-state">Aucun type d\'appartement défini pour ce projet</div>';
    return;
  }
  
  container.innerHTML = '';
  apartmentTypes.forEach(apartmentType => {
    const item = document.createElement('div');
    item.className = 'apartment-type-item';
    item.innerHTML = `
      <div class="apartment-type-info">
        <h4>${apartmentType.type_of_appartement}</h4>
        <p>Surface: ${apartmentType.surface}m² | Prix: ${formatPrice(apartmentType.price)} DA</p>
      </div>
      <div class="apartment-type-actions">
        <button class="btn-edit" data-id="${apartmentType.id}" data-type="${apartmentType.type_of_appartement}" data-surface="${apartmentType.surface}" data-price="${apartmentType.price}">
          <i class="fas fa-edit"></i> Modifier
        </button>
        <button class="btn-delete" data-id="${apartmentType.id}">
          <i class="fas fa-trash"></i> Supprimer
        </button>
      </div>
    `;
    container.appendChild(item);
  });
  
  // Add event listeners to the newly created buttons
  container.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', function() {
      const id = parseInt(this.dataset.id);
      const type = this.dataset.type;
      const surface = parseFloat(this.dataset.surface);
      const price = parseFloat(this.dataset.price);
      editApartmentType(id, type, surface, price);
    });
  });
  
  container.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', function() {
      const id = parseInt(this.dataset.id);
      deleteApartmentType(id);
    });
  });
}

// Format price with thousands separator
function formatPrice(price) {
  return new Intl.NumberFormat('fr-FR').format(price);
}

// Show add apartment type form
document.addEventListener('DOMContentLoaded', function() {
  const addBtn = document.getElementById('addApartmentTypeBtn');
  if (addBtn) {
    addBtn.addEventListener('click', function() {
      resetForm();
      document.getElementById('formTitle').textContent = 'Ajouter un type d\'appartement';
      document.getElementById('apartmentTypeForm').style.display = 'block';
    });
  }
});

// Edit apartment type
function editApartmentType(id, type, surface, price) {
  currentEditingInfoId = id;
  document.getElementById('formTitle').textContent = 'Modifier le type d\'appartement';
  document.getElementById('apartmentType').value = type;
  document.getElementById('apartmentSurface').value = surface;
  document.getElementById('apartmentPrice').value = price;
  document.getElementById('apartmentTypeForm').style.display = 'block';
}

// Save apartment type (add or update)
document.addEventListener('DOMContentLoaded', function() {
  const saveBtn = document.getElementById('saveApartmentType');
  if (saveBtn) {
    saveBtn.addEventListener('click', async function() {
      const type = document.getElementById('apartmentType').value.trim();
      const surface = parseFloat(document.getElementById('apartmentSurface').value);
      const price = parseFloat(document.getElementById('apartmentPrice').value);
      
      if (!type || !surface || !price) {
        alert('Veuillez remplir tous les champs');
        return;
      }
      
      if (!currentSelectedProjectId) {
        alert('Aucun projet sélectionné');
        return;
      }
      
      try {
        const projectInfo = {
          project_id: currentSelectedProjectId,
          type_of_appartement: type,
          surface: surface,
          price: price
        };
        
        if (currentEditingInfoId) {
          // Update existing - Fixed parameter names to match Rust backend
          await invoke('update_project_info', { 
            projectInfoId: currentEditingInfoId, 
            projectInfoInput: projectInfo 
          });
        } else {
          // Add new - Using camelCase parameter name as expected by Tauri
          await invoke('add_project_info', { projectInfoInput: projectInfo });
        }
        
        // Reload the list
        await loadApartmentTypes(currentSelectedProjectId);
        resetForm();
        
      } catch (error) {
        console.error('Error saving apartment type:', error);
        alert('Erreur lors de la sauvegarde');
      }
    });
  }
  
  // Cancel form
  const cancelBtn = document.getElementById('cancelApartmentType');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', function() {
      resetForm();
    });
  }
});

// Delete apartment type
async function deleteApartmentType(id) {
  if (!confirm('Êtes-vous sûr de vouloir supprimer ce type d\'appartement ?')) {
    return;
  }
  
  try {
    await invoke('delete_project_info', { projectInfoId: id });
    await loadApartmentTypes(currentSelectedProjectId);
  } catch (error) {
    console.error('Error deleting apartment type:', error);
    alert('Erreur lors de la suppression');
  }
}

// Reset form
function resetFormParams() {
  currentEditingInfoId = null;
  document.getElementById('apartmentTypeForm').style.display = 'none';
  document.getElementById('apartmentType').value = '';
  document.getElementById('apartmentSurface').value = '';
  document.getElementById('apartmentPrice').value = '';
}

// Rename conflicting resetForm function
function resetForm() {
  resetFormParams();
}
