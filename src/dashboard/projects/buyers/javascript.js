// Modal and table functionality for buyer management

document.addEventListener('DOMContentLoaded', function () {
    // Get DOM elements
    const modal = document.getElementById('buyerModal');
    const addBtn = document.getElementById('addNewBuyerButton');
    const closeBtn = document.querySelector('.close');
    const cancelBtn = document.getElementById('cancelBtn');
    const form = document.getElementById('addBuyerForm');
    const searchInput = document.getElementById('searchInput');
    const table = document.getElementById('buyersTable');
    const tbody = table.querySelector('tbody');

    // Open modal when Add New Buyer button is clicked
    addBtn.addEventListener('click', function() {
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
    });

    // Form submission
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Create new row with form data
        const newRow = document.createElement('tr');
        
        // Add table data cells with form values
        newRow.innerHTML = `
            <td>${document.getElementById('niveau').value}</td>
            <td>${document.getElementById('logtNum').value}</td>
            <td>${document.getElementById('nom').value}</td>
            <td>${document.getElementById('prenom').value}</td>
            <td>${document.getElementById('typeLogt').value}</td>
            <td>${document.getElementById('surface').value}</td>
            <td>${document.getElementById('date').value}</td>
            <td>${document.getElementById('prixTotale').value}</td>
            <td>${document.getElementById('remise').value}</td>
            <td>${document.getElementById('t0').value}</td>
            <td>${document.getElementById('total').value}</td>
        `;
        
        // Add new row to table
        tbody.appendChild(newRow);
        
        // Reset form and close modal
        form.reset();
        modal.style.display = 'none';
    });

    // Search functionality
    searchInput.addEventListener('input', function() {
        const filter = this.value.toLowerCase();
        const rows = tbody.getElementsByTagName('tr');
        
        for (let i = 0; i < rows.length; i++) {
            const rowText = rows[i].textContent.toLowerCase();
            rows[i].style.display = rowText.includes(filter) ? '' : 'none';
        }
    });
});

