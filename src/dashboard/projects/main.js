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

// // Liste des projets par défaut
// const projects = [
//   {
//       nom: "Projet 1",
//       lieu: "Annaba, Algerie",
//       totalAppartements: 120,
//       appartementsSold: 90,
//       progress: 75,
//       dateDeDebut: "2022-01-01",
//       dateDeFin: "2023-01-01"
//   },
//   {
//       nom: "Projet 2",
//       lieu: "Alger, Algérie",
//       totalAppartements: 80,
//       appartementsSold: 45,
//       progress: 56,
//       dateDeDebut: "2023-01-01",
//       dateDeFin: "2024-01-01"
//   }
// ];

// Fonction pour afficher les projets (optimized with document fragment)
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
      const dateFin = projet.project_end_date ? new Date(projet.project_end_date).toLocaleDateString() : 'Non défini';      // Calculate progress (assuming nda_vendus / nombre_des_appartement * 100)
      const progress = projet.nombre_des_appartement > 0 ? Math.round((projet.nda_vendus / projet.nombre_des_appartement) * 100) : 0;
      
      // Use CSS Grid layout for consistent spacing
      card.innerHTML = `
          <div class="project-actions">
              <button class="action-btn delete-btn" data-project-id="${projet.id}">
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
  
  // Check if the clicked element is a delete button
  if (e.target.classList.contains('delete-btn') || e.target.closest('.delete-btn')) {
    e.stopPropagation();
    const deleteBtn = e.target.closest('.delete-btn');
    const projectId = deleteBtn.getAttribute('data-project-id') ;
    deleteProject(projectId);
  }
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
    nombre_des_bloc: parseInt(document.getElementById('nmbrDesBlocs').value, 10),
    nombre_des_etages: parseInt(document.getElementById('nmbrDesEtages').value, 10),
    nombre_des_appartement: parseInt(document.getElementById('nmbrDesAppartementsTotal').value, 10),
    nda_dans_chaque_etage: Math.floor(parseInt(document.getElementById('nmbrDesAppartementsDansChaqueBloc').value, 10) / parseInt(document.getElementById('nmbrDesEtages').value, 10)) || 0,
    nda_vendus: 0, // Initially no apartments are sold
    project_start_date: document.getElementById('dateDeDebut').value,
    project_end_date: document.getElementById('dateDeFin').value,
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

// Initialize on DOMContentLoaded for better performance
document.addEventListener('DOMContentLoaded', function() {
  // Affichage initial
  afficherProjets();
});

// Automatic calculation for total apartments
function calculateTotalApartments() {
  const nmbrDesBlocs = parseInt(document.getElementById('nmbrDesBlocs').value, 10) || 0;
  const nmbrDesEtages = parseInt(document.getElementById('nmbrDesEtages').value, 10) || 0;
  const nmbrDesAppartementsDansChaqueBloc = parseInt(document.getElementById('nmbrDesAppartementsDansChaqueBloc').value, 10) || 0;
  
  const totalApartments = nmbrDesBlocs * nmbrDesEtages * nmbrDesAppartementsDansChaqueBloc;
  
  // Update the total apartments field
  const totalField = document.getElementById('nmbrDesAppartementsTotal');
  totalField.value = totalApartments;
  
  // Add visual feedback with a subtle animation
  totalField.style.backgroundColor = '#e8f5e8';
  setTimeout(() => {
    totalField.style.backgroundColor = '';
  }, 1000);
}

// Add event listeners for automatic calculation
const calcFields = ['nmbrDesBlocs', 'nmbrDesEtages', 'nmbrDesAppartementsDansChaqueBloc'];
calcFields.forEach(fieldId => {
  const field = document.getElementById(fieldId);
  if (field) {
    field.addEventListener('input', calculateTotalApartments);
    field.addEventListener('change', calculateTotalApartments);
  }
});

// Make total apartments field read-only to prevent manual editing
const totalField = document.getElementById('nmbrDesAppartementsTotal');
if (totalField) {
  totalField.setAttribute('readonly', true);
  totalField.style.backgroundColor = '#f5f5f5';
  totalField.title = 'Ce champ est calculé automatiquement';
}

// Function to delete a project
async function deleteProject(projectId) {
  showConfirmationModal(projectId);
}

// Function to show confirmation modal
function showConfirmationModal(projectId) {
  const modal = document.getElementById('confirmationModal');
  const confirmBtn = document.getElementById('confirmDelete');
  const cancelBtn = document.getElementById('confirmCancel');
  const closeBtn = document.getElementById('confirmModalClose');
  
  // Store project ID for deletion
  modal.dataset.projectId = projectId;
  
  // Show modal with flexbox centering
  modal.style.display = 'flex';
  modal.classList.add('show');
    // Handle confirm deletion
  const handleConfirm = async () => {
    try {
      await invoke('delete_project_from_database', { projectId: parseInt(projectId) });
      
      // Reload projects after successful deletion
      await afficherProjets();
      
      // Close confirmation modal
      modal.style.display = 'none';
      modal.classList.remove('show');
      
      // Show success modal instead of alert
      showSuccessModal();
    } catch (error) {
      console.error("Error deleting project:", error);
      alert("Erreur lors de la suppression du projet. Veuillez réessayer.");
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
  window.addEventListener('click', function closeOnOutsideClick(event) {
    if (event.target === modal) {
      handleCancel();
      window.removeEventListener('click', closeOnOutsideClick);
    }
  });
}

// Function to show success modal
function showSuccessModal() {
  const modal = document.getElementById('successModal');
  const okBtn = document.getElementById('successOk');
  
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
  window.addEventListener('click', function closeOnOutsideClick(event) {
    if (event.target === modal) {
      handleOk();
      window.removeEventListener('click', closeOnOutsideClick);
    }
  });
}

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
  window.addEventListener('click', function closeOnOutsideClick(event) {
    if (event.target === modal) {
      handleOk();
      window.removeEventListener('click', closeOnOutsideClick);
    }
  });
}

// Add hover effects for delete button
document.getElementById('projectList').addEventListener('mouseover', function(e) {
  if (e.target.classList.contains('delete-btn') || e.target.closest('.delete-btn')) {
    const card = e.target.closest('.project-card');
    card.classList.add('delete-hover');
  }
});

document.getElementById('projectList').addEventListener('mouseout', function(e) {
  if (e.target.classList.contains('delete-btn') || e.target.closest('.delete-btn')) {
    const card = e.target.closest('.project-card');
    card.classList.remove('delete-hover');
  }
});
