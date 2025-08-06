const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

let login_button = document.querySelector(".signup-button");


const togglePassword = document.getElementById('passwordInput');
const passwordInput = document.getElementById('passwordInput');

async function signup_function() {
    let name = document.getElementById("first-name").value;
    let password = document.getElementById("passwordInput").value;
    let admin = document.getElementById("checkAdmin").value;
    let divMessage = document.getElementById("signup-div-message");

    // Debug logging
    console.log('Signup data:', { name, password, admin });
      // Validate required fields
    if (!name || !password || !admin || admin === "") {
        divMessage.textContent = "Please fill in all required fields and select a role.";
        divMessage.style.color = "red";
        return;
    }
    
    // Validate role value
    if (!['0', '1', '2'].includes(admin)) {
        divMessage.textContent = "Please select a valid role.";
        divMessage.style.color = "red";
        return;
    }

    try {        await listen("signup-result", (event) => {
            console.log('Signup result:', event.payload);
            if (event.payload === "Success") {
                divMessage.textContent = "Your signup process is successful!, redirecting you to the login page";
                divMessage.style.color = "green";
                setTimeout(showAfterLogin, 3000);
            } else if (event.payload === "User already exists") {
                divMessage.textContent = "User already exists. Please choose a different username.";
                divMessage.style.color = "red";
            } else {
                divMessage.textContent = "Invalid Credentials please try again.";
                divMessage.style.color = "red";
            }
        })
        await invoke("signup_proccess", {name, password, admin});

    } catch(error) {
        console.error("Error during signup: ", error);
        divMessage.textContent = "An internal error occurred. Please try again.";
        divMessage.style.color = "orange";
    }
}

async function showAfterLogin() {
    globalThis.window.location.href = '../';
}

// Toggling the confirm password
const toggleConfirmPassword = document.getElementById('togglePassword');
const confirmPasswordInput = document.getElementById('togglePassword');


window.addEventListener("DOMContentLoaded", () => {
    // Add signup button event listener
    const signupButton = document.getElementById("signUpButton");
    if (signupButton) {
        signupButton.addEventListener("click", (e) => {
            e.preventDefault();
            signup_function();
        });
    }
    
    // Add form submit event listener
    const form = document.querySelector('form');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            signup_function();
        });
    }
    
    togglePassword.addEventListener('click', () => {
        const currentType = passwordInput.getAttribute('type');
        passwordInput.setAttribute(
            'type', currentType === 'password' ? 'text' : 'password'
        );
    });
    
    toggleConfirmPassword.addEventListener('click', () => {
        const currentType = confirmPasswordInput.getAttribute('type');
        confirmPasswordInput.setAttribute(
            'type', 
            currentType === 'password' ? 'text' : 'password'
        );
    });

    login_button.addEventListener("click", signup_function)
});