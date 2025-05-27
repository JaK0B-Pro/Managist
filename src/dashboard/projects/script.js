// Liste des projets par défaut
const projects = [
    {
      nom: "Projet Alpha",
      achat: 1500,
      vente: 3000,
      nbBatiments: 5,
      types: ["Villa", "Appartement"],
      vendus: 3,
      restants: 2,
      pourcentage: 60,
      acheteur: {
        nom: "Benali",
        prenom: "Sofiane",
        tel: "0550 112233",
        paye: 1800,
        restant: 1200
      }
    },
    {
      nom: "Projet Beta",
      achat: 800,
      vente: 2000,
      nbBatiments: 4,
      types: ["Duplex"],
      vendus: 1,
      restants: 3,
      pourcentage: 25,
      acheteur: {
        nom: "Ziane",
        prenom: "Nour",
        tel: "0661 445566",
        paye: 500,
        restant: 1500
      }
    }
  ];
  
  // Fonction pour afficher les projets
function afficherProjets() {
  const container = document.getElementById('projectList');
  container.innerHTML = "";
  
  projects.forEach((projet, index) => {
    const card = document.createElement('div');
    card.className = 'project-card';
  
    card.innerHTML = `
      <div class="project-card-header">
        ${projet.picture ? `<img src="${projet.picture}" alt="Image du projet" class="project-img">` : ''}
        <h2>${projet.name}</h2>
      </div>
      <div><strong>Localisation :</strong> ${projet.location}</div>
      <div><strong>Nombre d'appartements :</strong> ${projet.numApt}</div>
      <div><strong>Nombre de blocs :</strong> ${projet.numBlocks}</div>
      <div><strong>Appartements par bloc :</strong> ${projet.aptsPerBlock.join(', ')}</div>
      <button class="voir-plus-btn" data-id="${projet.id}">Voir plus</button>
      <div class="project-details-wrapper">
        <div><strong>Avancement :</strong> ${projet.pourcentage ?? 0}%</div>
        <div><strong>Acheteur :</strong> ${projet.acheteur?.nom ?? ''} ${projet.acheteur?.prenom ?? ''}</div>
        <div><strong>Téléphone :</strong> ${projet.acheteur?.tel ?? ''}</div>
        <div><strong>Montant payé :</strong> ${projet.acheteur?.paye ?? 0} DZD</div>
        <div><strong>Montant restant :</strong> ${projet.acheteur?.restant ?? 0} DZD</div>
      </div>
    `;
    card.querySelector('.voir-plus-btn').addEventListener('click', () => {
      // Redirect to the folder/page for this project
      window.location.href = `./evreyProject/chaqueProjetPage.html?project=${projet.id}`;
    });
    container.appendChild(card);
  });
}

    // Boutons "Voir plus"
    document.querySelectorAll(".toggle-details-btn").forEach(button => {
      button.addEventListener("click", function () {
        const index = this.getAttribute("data-index");
        const details = document.getElementById(`details-${index}`);
        const isVisible = details.style.display === "block";
        details.style.display = isVisible ? "none" : "block";
        this.textContent = isVisible ? "Voir plus" : "Voir moins";
      });
    });
  
// Modal logic
const modal = document.getElementById('projectModal');
const openModalBtn = document.getElementById('showFormBtn');
const closeModalBtn = document.getElementById('closeModal');
const modalForm = document.getElementById('modalProjectForm');
const blocksContainer = document.getElementById('blocksContainer');

openModalBtn.onclick = () => {
  modal.style.display = 'block';
  resetModalForm();
};
closeModalBtn.onclick = () => {
  modal.style.display = 'none';
};
window.onclick = (event) => {
  if (event.target === modal) modal.style.display = 'none';
};

// Dynamic fields for apartments per block
const numBlocksInput = document.getElementById('modalProjectNumBlocks');
numBlocksInput.addEventListener('input', () => {
  blocksContainer.innerHTML = '';
  const numBlocks = parseInt(numBlocksInput.value, 10);
  if (!isNaN(numBlocks) && numBlocks > 0) {
    for (let i = 1; i <= numBlocks; i++) {
      const label = document.createElement('label');
      label.textContent = `Appartements dans le bloc ${i}`;
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '1';
      input.required = true;
      input.className = 'block-apt-input';
      input.placeholder = `Bloc ${i}`;
      blocksContainer.appendChild(label);
      blocksContainer.appendChild(input);
    }
  }
});

// Handle form submit
modalForm.onsubmit = function(e) {
  e.preventDefault();
  const name = document.getElementById('modalProjectName').value;
  const pictureInput = document.getElementById('modalProjectPicture');
  const location = document.getElementById('modalProjectLocation').value;
  const numApt = parseInt(document.getElementById('modalProjectNumApt').value, 10);
  const numBlocks = parseInt(document.getElementById('modalProjectNumBlocks').value, 10);
  const blockInputs = blocksContainer.querySelectorAll('.block-apt-input');
  const aptsPerBlock = Array.from(blockInputs).map(input => parseInt(input.value, 10));
  let picture = '';
  if (pictureInput.files && pictureInput.files[0]) {
    picture = URL.createObjectURL(pictureInput.files[0]);
  }
  projects.push({
    id: projectIdCounter++,
    name,
    picture,
    location,
    numApt,
    numBlocks,
    aptsPerBlock
  });
  modal.style.display = 'none';
  afficherProjets();
};

function resetModalForm() {
  modalForm.reset();
  blocksContainer.innerHTML = '';
}

document.addEventListener('DOMContentLoaded', afficherProjets);
  
  // Gestion du formulaire
  document.getElementById('projectForm').addEventListener('submit', function (e) {
    e.preventDefault();
  
    const projet = {
      nom: document.getElementById('nomProjet').value,
      achat: parseFloat(document.getElementById('achatProjet').value),
      vente: parseFloat(document.getElementById('venteProjet').value),
      nbBatiments: parseInt(document.getElementById('nbBat').value),
      types: document.getElementById('types').value.split(',').map(t => t.trim()),
      vendus: parseInt(document.getElementById('vendus').value),
      restants: parseInt(document.getElementById('restants').value),
      pourcentage: parseFloat(document.getElementById('pourcentage').value),
      acheteur: {
        nom: document.getElementById('nomAcheteur').value,
        prenom: document.getElementById('prenomAcheteur').value,
        tel: document.getElementById('telAcheteur').value,
        paye: parseFloat(document.getElementById('montantPaye').value),
        restant: parseFloat(document.getElementById('montantRestant').value)
      }
    };
  
    projects.push(projet);
    afficherProjets();
    this.reset();
    this.style.display = 'none';
  });
  
  // Affichage initial
  afficherProjets();
  