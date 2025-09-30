use tauri::{AppHandle, Emitter, State, Manager};
use serde::{Serialize, Deserialize};
use sqlx::Row;
use sqlx::PgPool;
use rust_decimal::Decimal;
use chrono::NaiveDate;
use std::env;
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

// Macro to conditionally print only in debug builds
#[cfg(debug_assertions)]
macro_rules! debug_println {
    ($($arg:tt)*) => {
        println!($($arg)*);
    };
}

#[cfg(not(debug_assertions))]
macro_rules! debug_println {
    ($($arg:tt)*) => {};
}

// Structure to represent the Employee (simplified - only basic employee info)
#[derive(Serialize, Deserialize, Debug)]
pub struct Employee {
    id: i32,
    nom_et_prenom: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct EmployeeInput {
    nom_et_prenom: String,
}

// Structure to represent Employee Salary (project-specific salary records)
#[derive(Serialize, Deserialize, Debug)]
pub struct EmployeeSalary {
    id: i32,
    employee_id: i32,
    project_id: String, // Can be "administration" or project ID
    prix_jour: Decimal,
    prix_hour: Decimal, 
    nombre_des_jours: i32,
    nombre_des_heurx: i32,
    travaux_attache: Decimal,
    salaire: Decimal,
    acompte: Decimal,
    net_a_payer: Decimal,
    observation: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct EmployeeSalaryInput {
    nom_et_prenom: String,
    project_id: String,
    prix_jour: f64,
    prix_hour: f64,
    nombre_des_jours: i32,
    nombre_des_heurx: i32,
    travaux_attache: f64,
    salaire: f64,
    acompte: f64,
    net_a_payer: f64,
    observation: String,
}

// Input structure for adding employee to ALL projects (doesn't require project_id)
#[derive(Serialize, Deserialize, Debug)]
pub struct EmployeeAddInput {
    nom_et_prenom: String,
    prix_jour: f64,
    prix_hour: f64,
    nombre_des_jours: i32,
    nombre_des_heurx: i32,
    travaux_attache: f64,
    salaire: f64,
    acompte: f64,
    net_a_payer: f64,
    observation: String,
}

// Combined structure for frontend display (joins employee + salary data)
#[derive(Serialize, Deserialize, Debug)]
pub struct EmployeeWithSalary {
    id: i32,
    employee_id: i32,
    nom_et_prenom: String,
    project_id: String,
    prix_jour: Decimal,
    prix_hour: Decimal, 
    nombre_des_jours: i32,
    nombre_des_heurx: i32,
    travaux_attache: Decimal,
    salaire: Decimal,
    acompte: Decimal,
    net_a_payer: Decimal,
    observation: String,
}

// Structure to represent a project
#[derive(Serialize, Deserialize, Debug)]
pub struct Project {
    id: i32,
    project_name: String,
    project_location: String,
    project_start_date: NaiveDate,
    project_end_date: NaiveDate,
    nombre_des_bloc: i32,
    nombre_des_etages: i32,
    nombre_des_appartement: i32,
    nda_dans_chaque_etage: i32,
    nda_vendus: i32,
    types_appartements: Option<String>,
    surfaces_appartements: Option<String>
}

// Structure to represent project info (apartment types and prices)
#[derive(Serialize, Deserialize, Debug)]
pub struct ProjectInfo {
    id: i32,
    project_id: i32,
    type_of_appartement: String,
    surface: Decimal,
    price: Decimal,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ProjectInfoInput {
    project_id: i32,
    type_of_appartement: String,
    surface: f64,
    price: f64,
}

// Structure to represent Prix Unitaire
#[derive(Serialize, Deserialize, Debug)]
pub struct PrixUnitaire {
    id: i32,
    project_id: i32,
    prix_unitaire: Decimal,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct PrixUnitaireInput {
    project_id: i32,
    prix_unitaire: f64,
}

// Structure to represent a buyer
#[derive(Serialize, Deserialize, Debug)]
pub struct Buyer {
    id: i32,
    project_id: i32,
    bloc: String,
    niveau: String,
    logt_num: String,
    nom: String,
    prenom: String,
    type_logt: String,
    type_of_logt: String,
    surface: String,
    date: NaiveDate,
    prix_totale: Decimal,
    remise: Decimal,
    payments: serde_json::Value,
    payment_status: String,
    total_paid: Decimal,
    is_sold: bool,
    payment_limits_disabled: bool,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct BuyerInput {
    project_id: i32,
    bloc: String,
    niveau: String,
    logt_num: String,
    nom: String,
    prenom: String,
    type_logt: String,
    type_of_logt: String,
    surface: String,
    date: String,
    prix_totale: f64,
    remise: f64,
    payments: serde_json::Value,
    #[serde(default)]
    payment_limits_disabled: bool,
}

#[derive(serde::Serialize, serde::Deserialize, Debug)]
pub struct ProjectName {
    id: i32,
    name: String,
}

#[derive(serde::Serialize, serde::Deserialize, Debug)]
pub struct ProjectInput {
    project_name: String,
    project_location: String,
    project_start_date: String,
    project_end_date: String,
    nombre_des_bloc: i32,
    nombre_des_etages: i32,
    nombre_des_appartement: i32,
    nda_dans_chaque_etage: i32,
    nda_vendus: i32,
    types_appartements: Option<String>,
    surfaces_appartements: Option<String>,
}

// Function to handle login process
#[tauri::command]
async fn login(app: AppHandle, pool: tauri::State<'_, PgPool>, user: String, password: String) -> Result<(), String> {
    let user = user.trim_end().to_string();
    let password = password.trim_end().to_string();
    
    debug_println!("Login attempt - User: {}", user);
    
    let rows = sqlx::query("SELECT id, name, password, admin FROM users WHERE name = $1 AND password = $2")
        .bind(&user)
        .bind(&password)
        .fetch_all(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    if let Some(row) = rows.first() {
        let admin_value: String = row.try_get("admin").map_err(|e| e.to_string())?;
        debug_println!("Login successful - User: {}, Admin role from DB: {}", user, admin_value);
        app.emit_to("login", "login-result", format!("LoggedIn:{}", admin_value)).map_err(|e| e.to_string())?;
    } else {
        debug_println!("Login failed - Invalid credentials for user: {}", user);
        app.emit_to("login", "login-result", "Invalid Credentials").map_err(|e| e.to_string())?;
    }
    
    Ok(())
}




// Function to handle signup process
#[tauri::command]
async fn signup_proccess(app: AppHandle, pool: tauri::State<'_, PgPool>, name: String, password: String, admin: String) -> Result<(), String> {
    debug_println!("Signup attempt - Name: {}, Admin role: {}", name, admin);
    
    // Check if user already exists
    let existing_user = sqlx::query("SELECT name FROM users WHERE name = $1")
        .bind(&name)
        .fetch_optional(&*pool)
        .await
        .map_err(|e| e.to_string())?;
    
    if existing_user.is_some() {
        debug_println!("User '{}' already exists", name);
        app.emit_to("signup", "signup-result", "User already exists").map_err(|e| e.to_string())?;
        return Err("User already exists".to_string());
    }
    
    // Insert new user
    sqlx::query("INSERT INTO users(name, password, admin) VALUES ($1, $2, $3)")
        .bind(&name)
        .bind(&password)
        .bind(&admin)
        .execute(&*pool)
        .await
        .map_err(|e| {
            debug_println!("Signup database error: {}", e);
            e.to_string()
        })?;
    
    debug_println!("User '{}' created successfully with admin role: {}", name, admin);
    app.emit_to("signup", "signup-result", "Success").map_err(|e| e.to_string())?;
    Ok(())
}

// Function to update user password in the database
#[tauri::command]
async fn update_user_password(app: AppHandle, pool: tauri::State<'_, PgPool>, username: String, current_password: String, new_password: String) -> Result<(), String> {
    // First verify the current password
    let rows = sqlx::query("SELECT id, name, password FROM users WHERE name = $1 AND password = $2")
        .bind(&username)
        .bind(&current_password)
        .fetch_all(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    if rows.is_empty() {
        app.emit_to("password-update", "password-update-result", "Invalid current password").map_err(|e| e.to_string())?;
        return Err("Invalid current password".to_string());
    }

    // Update the password in the database
    sqlx::query("UPDATE users SET password = $1 WHERE name = $2")
        .bind(&new_password)
        .bind(&username)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    app.emit_to("password-update", "password-update-result", "Password updated successfully").map_err(|e| e.to_string())?;
    Ok(())
}

// Function to get employee data by name for dashboard
#[tauri::command]
async fn get_employee_by_name(pool: tauri::State<'_, PgPool>, employee_name: String) -> Result<Option<Employee>, String> {
    let rows = sqlx::query("SELECT id, nom_et_prenom FROM employees WHERE nom_et_prenom = $1")
        .bind(&employee_name)
        .fetch_all(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    if let Some(row) = rows.first() {
        let employee = Employee {
            id: row.try_get("id").map_err(|e| e.to_string())?,
            nom_et_prenom: row.try_get("nom_et_prenom").map_err(|e| e.to_string())?,
        };
        Ok(Some(employee))
    } else {
        Ok(None)
    }
}

// Function to insert employee salary data into the database
#[tauri::command]
async fn insert_employee(app: AppHandle, pool: tauri::State<'_, PgPool>, employee: EmployeeAddInput) -> Result<(), String> {
    // First, insert or get the employee in the main employees table (basic info only)
    let employee_id = match sqlx::query("SELECT id FROM employees WHERE nom_et_prenom = $1")
        .bind(&employee.nom_et_prenom)
        .fetch_optional(&*pool)
        .await
        .map_err(|e| e.to_string())?
    {
        Some(row) => {
            // Employee exists, get their ID
            row.try_get::<i32, _>("id").map_err(|e| e.to_string())?
        }
        None => {
            // Employee doesn't exist, insert them and get the new ID
            let employee_insert_query = "INSERT INTO employees (nom_et_prenom) VALUES ($1) RETURNING id";
            let row = sqlx::query(employee_insert_query)
                .bind(&employee.nom_et_prenom)
                .fetch_one(&*pool)
                .await
                .map_err(|e| e.to_string())?;
            
            row.try_get::<i32, _>("id").map_err(|e| e.to_string())?
        }
    };
    
    // Get all projects to add this employee to each one
    let projects = sqlx::query("SELECT id FROM projects")
        .fetch_all(&*pool)
        .await
        .map_err(|e| e.to_string())?;
    
    // Insert salary record for this employee in each project
    let salary_insert_query = "INSERT INTO employee_salary (employee_id, project_id, prix_jour, prix_hour, nombre_des_jours, nombre_des_heurx, travaux_attache, salaire, acompte, net_a_payer, observation) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)";
    
    // Add to administration project with user-provided data
    let existing_admin = sqlx::query("SELECT id FROM employee_salary WHERE employee_id = $1 AND project_id = $2")
        .bind(employee_id)
        .bind("administration")
        .fetch_optional(&*pool)
        .await
        .map_err(|e| e.to_string())?;
    
    if existing_admin.is_none() {
        sqlx::query(salary_insert_query)
            .bind(employee_id)
            .bind("administration")
            .bind(Decimal::from_f64_retain(employee.prix_jour).unwrap_or_default())
            .bind(Decimal::from_f64_retain(employee.prix_hour).unwrap_or_default())
            .bind(employee.nombre_des_jours)
            .bind(employee.nombre_des_heurx)
            .bind(Decimal::from_f64_retain(employee.travaux_attache).unwrap_or_default())
            .bind(Decimal::from_f64_retain(employee.salaire).unwrap_or_default())
            .bind(Decimal::from_f64_retain(employee.acompte).unwrap_or_default())
            .bind(Decimal::from_f64_retain(employee.net_a_payer).unwrap_or_default())
            .bind(&employee.observation)
            .execute(&*pool)
            .await
            .map_err(|e| e.to_string())?;
    }
    
    // Add to all actual projects (with default/zero values for other projects)
    for project_row in projects {
        let project_id: i32 = project_row.try_get("id").map_err(|e| e.to_string())?;
        
        // Check if this employee already exists for this project
        let existing_project = sqlx::query("SELECT id FROM employee_salary WHERE employee_id = $1 AND project_id = $2")
            .bind(employee_id)
            .bind(project_id.to_string())
            .fetch_optional(&*pool)
            .await
            .map_err(|e| e.to_string())?;
        
        if existing_project.is_none() {
            // Insert with default/zero values for actual projects (user can edit them later)
            sqlx::query(salary_insert_query)
                .bind(employee_id)
                .bind(project_id.to_string())
                .bind(Decimal::new(0, 2)) // prix_jour = 0
                .bind(Decimal::new(0, 2)) // prix_hour = 0
                .bind(0) // nombre_des_jours = 0
                .bind(0) // nombre_des_heurx = 0
                .bind(Decimal::new(0, 2)) // travaux_attache = 0
                .bind(Decimal::new(0, 2)) // salaire = 0
                .bind(Decimal::new(0, 2)) // acompte = 0
                .bind(Decimal::new(0, 2)) // net_a_payer = 0
                .bind("") // observation = empty
                .execute(&*pool)
                .await
                .map_err(|e| e.to_string())?;
        }
    }
        
    app.emit_to("add_emplyee", "add_emplyee_result", "success").map_err(|e| e.to_string())?;
    Ok(())
}




// Function to get all employees with salary data for a specific project
#[tauri::command]
async fn get_all_employees(pool: State<'_, PgPool>) -> Result<Vec<EmployeeWithSalary>, String> {
    // Default to administration project if not specified
    get_employees_by_project(pool, "administration".to_string()).await
}

// Function to get employees by project from employee_salary table
#[tauri::command]
async fn get_employees_by_project(pool: State<'_, PgPool>, project_id: String) -> Result<Vec<EmployeeWithSalary>, String> {
    let rows = sqlx::query("SELECT es.id, es.employee_id, e.nom_et_prenom, es.project_id, es.prix_jour, es.prix_hour, es.nombre_des_jours, es.nombre_des_heurx, es.travaux_attache, es.salaire, es.acompte, es.net_a_payer, es.observation FROM employee_salary es JOIN employees e ON es.employee_id = e.id WHERE es.project_id = $1 ORDER BY es.id ASC")
        .bind(&project_id)
        .fetch_all(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut employees = Vec::new();
    
    for row in rows {
        let employee = EmployeeWithSalary {
            id: row.try_get("id").map_err(|e| e.to_string())?,
            employee_id: row.try_get("employee_id").map_err(|e| e.to_string())?,
            nom_et_prenom: row.try_get("nom_et_prenom").map_err(|e| e.to_string())?,
            project_id: row.try_get("project_id").map_err(|e| e.to_string())?,
            prix_jour: row.try_get("prix_jour").map_err(|e| e.to_string())?,
            prix_hour: row.try_get("prix_hour").map_err(|e| e.to_string())?,
            nombre_des_jours: row.try_get("nombre_des_jours").map_err(|e| e.to_string())?,
            nombre_des_heurx: row.try_get("nombre_des_heurx").map_err(|e| e.to_string())?,
            travaux_attache: row.try_get("travaux_attache").map_err(|e| e.to_string())?,
            salaire: row.try_get("salaire").map_err(|e| e.to_string())?,
            acompte: row.try_get("acompte").map_err(|e| e.to_string())?,
            net_a_payer: row.try_get("net_a_payer").map_err(|e| e.to_string())?,
            observation: row.try_get("observation").map_err(|e| e.to_string())?
        };
        employees.push(employee);
    }
    Ok(employees)
}

// Functions for the original employees table (for backward compatibility)

// Function to insert employee data into the original employees table
#[tauri::command]
async fn insert_employee_original(app: AppHandle, pool: tauri::State<'_, PgPool>, employee: EmployeeInput) -> Result<(), String> {
    // Check if employee already exists
    let existing_employee = sqlx::query("SELECT id FROM employees WHERE nom_et_prenom = $1")
        .bind(&employee.nom_et_prenom)
        .fetch_optional(&*pool)
        .await
        .map_err(|e| e.to_string())?;
    
    if existing_employee.is_none() {
        let query = "INSERT INTO employees (nom_et_prenom) VALUES ($1)";
        sqlx::query(query)
            .bind(&employee.nom_et_prenom)
            .execute(&*pool)
            .await
            .map_err(|e| e.to_string())?;
    }
        
    app.emit_to("add_emplyee", "add_emplyee_result", "success").map_err(|e| e.to_string())?;
    Ok(())
}


// Get all the projects name and insert them into a vector
#[tauri::command]
async fn get_project_names(pool: tauri::State<'_, PgPool>) -> Result<Vec<ProjectName>, String> {
    let rows = sqlx::query("SELECT id, project_name FROM projects")
        .fetch_all(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut projects = Vec::new();
    for row in rows {        projects.push(ProjectName {
            id: row.try_get("id").map_err(|e| e.to_string())?,
            name: row.try_get("project_name").map_err(|e| e.to_string())?,
        });
    }
    Ok(projects)
}

// Function to get all employees from the original employees table
#[tauri::command]
async fn get_all_employees_original(pool: State<'_, PgPool>) -> Result<Vec<Employee>, String> {
    let rows = sqlx::query("SELECT * FROM employees ORDER BY id ASC")
        .fetch_all(&*pool)
        .await
        .map_err(|e| e.to_string())?;    let mut employees = Vec::new();
    for row in rows {
        employees.push(Employee {
            id: row.try_get("id").map_err(|e| e.to_string())?,
            nom_et_prenom: row.try_get("nom_et_prenom").map_err(|e| e.to_string())?,
        });
    }
    Ok(employees)
}

// Function to update employee in the original employees table
#[tauri::command]
async fn update_employee_original(pool: tauri::State<'_, PgPool>, employee: Employee) -> Result<(), String> {
    let query = "UPDATE employees SET nom_et_prenom = $1 WHERE id = $2";

    sqlx::query(query)
        .bind(&employee.nom_et_prenom)
        .bind(&employee.id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// Function to delete employee from the original employees table
#[tauri::command]
async fn delete_employee_original(pool: tauri::State<'_, PgPool>, employee_id: i32) -> Result<(), String> {
    let query = "DELETE FROM employees WHERE id = $1";

    sqlx::query(query)
        .bind(employee_id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// Get all the projects data
#[tauri::command]
async fn get_projects(pool: tauri::State<'_, PgPool>) -> Result<Vec<Project>, String> {
    let rows = sqlx::query("SELECT * FROM projects")
        .fetch_all(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut projects = Vec::new();
    for row in rows {        projects.push(Project {
            id: row.try_get("id").map_err(|e| e.to_string())?,
            project_name: row.try_get("project_name").map_err(|e| e.to_string())?,
            project_location: row.try_get("project_location").map_err(|e| e.to_string())?,
            project_start_date: row.try_get("project_start_date").map_err(|e| e.to_string())?,
            project_end_date: row.try_get("project_end_date").map_err(|e| e.to_string())?,
            nombre_des_bloc: row.try_get("nombre_des_bloc").map_err(|e| e.to_string())?,
            nombre_des_etages: row.try_get("nombre_des_etages").map_err(|e| e.to_string())?,
            nombre_des_appartement: row.try_get("nombre_des_appartement").map_err(|e| e.to_string())?,
            nda_dans_chaque_etage: row.try_get("nda_dans_chaque_etage").map_err(|e| e.to_string())?,
            nda_vendus: row.try_get("nda_vendus").map_err(|e| e.to_string())?,
            types_appartements: row.try_get("types_appartements").ok(),
            surfaces_appartements: row.try_get("surfaces_appartements").ok()
        });
    }
    Ok(projects)
}



// Function to add project to the database
#[tauri::command]
async fn add_project_to_the_database(pool: tauri::State<'_, PgPool>, project: ProjectInput) -> Result<(), String> {
    // Parse date strings to NaiveDate
    let start_date = NaiveDate::parse_from_str(&project.project_start_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid start date format: {}", e))?;
    let end_date = NaiveDate::parse_from_str(&project.project_end_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid end date format: {}", e))?;    let query = "INSERT INTO projects (project_name, project_location, project_start_date, project_end_date, nombre_des_bloc, nombre_des_etages, nombre_des_appartement, nda_dans_chaque_etage, nda_vendus, types_appartements, surfaces_appartements) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)";

    sqlx::query(query)
        .bind(&project.project_name)
        .bind(&project.project_location)
        .bind(start_date)
        .bind(end_date)
        .bind(&project.nombre_des_bloc)
        .bind(&project.nombre_des_etages)
        .bind(&project.nombre_des_appartement)
        .bind(&project.nda_dans_chaque_etage)
        .bind(&project.nda_vendus)
        .bind(&project.types_appartements)
        .bind(&project.surfaces_appartements)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
    

// Function to delete project from the database
#[tauri::command]
async fn delete_project_from_database(pool: tauri::State<'_, PgPool>, project_id: i32) -> Result<(), String> {
    let query = "DELETE FROM projects WHERE id = $1";

    sqlx::query(query)
        .bind(project_id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// Helper function to calculate total paid from payments
fn calculate_total_paid(payments: &serde_json::Value) -> f64 {
    debug_println!("=== CALCULATE TOTAL PAID DEBUG ===");
    debug_println!("Payments JSON received: {}", serde_json::to_string_pretty(payments).unwrap_or_else(|_| "Invalid JSON".to_string()));
    
    if let Some(obj) = payments.as_object() {
        debug_println!("Payments is an object with {} keys", obj.len());
        
        let total: f64 = obj.iter()
            .map(|(key, value)| {
                debug_println!("Processing key: {}, value: {}", key, serde_json::to_string(value).unwrap_or_else(|_| "Invalid".to_string()));
                
                // Handle both old format (direct number) and new format (object with amount)
                if let Some(amount) = value.as_f64() {
                    debug_println!("  -> Direct number: {}", amount);
                    amount
                } else if let Some(tranche_obj) = value.as_object() {
                    if let Some(amount) = tranche_obj.get("amount").and_then(|a| a.as_f64()) {
                        debug_println!("  -> Object amount: {}", amount);
                        amount
                    } else {
                        debug_println!("  -> Object has no amount field or amount is not a number");
                        0.0
                    }
                } else {
                    debug_println!("  -> Value is neither number nor object");
                    0.0
                }
            })
            .sum();
        
        debug_println!("Total calculated: {}", total);
        debug_println!("=== END CALCULATE TOTAL PAID DEBUG ===");
        total
    } else {
        debug_println!("Payments is not an object: {:?}", payments);
        debug_println!("=== END CALCULATE TOTAL PAID DEBUG ===");
        0.0
    }
}

// Helper function to update project sold count
async fn update_project_sold_count(pool: &PgPool, project_id: i32) -> Result<(), String> {
    sqlx::query("UPDATE projects SET nda_vendus = nda_vendus + 1 WHERE id = $1")
        .bind(project_id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// Helper function to decrease project sold count
async fn decrease_project_sold_count(pool: &PgPool, project_id: i32) -> Result<(), String> {
    sqlx::query("UPDATE projects SET nda_vendus = GREATEST(nda_vendus - 1, 0) WHERE id = $1")
        .bind(project_id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// Helper function to check if buyer was previously sold
async fn check_if_buyer_was_sold(pool: &PgPool, buyer_id: i32) -> Result<bool, String> {
    let result = sqlx::query("SELECT is_sold FROM buyers WHERE id = $1")
        .bind(buyer_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(result.map(|row| row.try_get::<bool, _>("is_sold").unwrap_or(false)).unwrap_or(false))
}

// Function to add buyer to the database
#[tauri::command]
async fn add_buyer_to_database(pool: tauri::State<'_, PgPool>, buyer: BuyerInput) -> Result<(), String> {
    debug_println!("=== ADD BUYER DEBUG ===");
    debug_println!("Received buyer data: {:?}", buyer);
    debug_println!("Payments JSON: {}", serde_json::to_string_pretty(&buyer.payments).unwrap_or_else(|_| "Invalid JSON".to_string()));
    
    // Parse date string to NaiveDate
    let date = NaiveDate::parse_from_str(&buyer.date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid date format: {}", e))?;

    // Calculate total_paid from payments
    let total_paid = calculate_total_paid(&buyer.payments);
    debug_println!("Calculated total_paid: {}", total_paid);
    
    let final_price = buyer.prix_totale - buyer.remise;
    let is_sold = total_paid >= final_price;
    let payment_status = if is_sold { "paid" } else if total_paid > 0.0 { "partial" } else { "unpaid" };
    
    debug_println!("Final price: {}, Is sold: {}, Payment status: {}", final_price, is_sold, payment_status);

    let query = "INSERT INTO buyers (project_id, bloc, niveau, logt_num, nom, prenom, type_logt, type_of_logt, surface, date, prix_totale, remise, payments, payment_status, total_paid, is_sold, payment_limits_disabled) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)";

    sqlx::query(query)
        .bind(&buyer.project_id)
        .bind(&buyer.bloc)
        .bind(&buyer.niveau)
        .bind(&buyer.logt_num)
        .bind(&buyer.nom)
        .bind(&buyer.prenom)
        .bind(&buyer.type_logt)
        .bind(&buyer.type_of_logt)
        .bind(&buyer.surface)
        .bind(date)
        .bind(Decimal::from_f64_retain(buyer.prix_totale).unwrap_or_default())
        .bind(Decimal::from_f64_retain(buyer.remise).unwrap_or_default())
        .bind(&buyer.payments)
        .bind(payment_status)
        .bind(Decimal::from_f64_retain(total_paid).unwrap_or_default())
        .bind(is_sold)
        .bind(buyer.payment_limits_disabled)
        .execute(&*pool)
        .await
        .map_err(|e| {
            debug_println!("Database insert error: {}", e);
            e.to_string()
        })?;

    debug_println!("Buyer inserted successfully with payments: {}", serde_json::to_string(&buyer.payments).unwrap_or_else(|_| "Invalid JSON".to_string()));
    debug_println!("=== END ADD BUYER DEBUG ===");

    // Update project's nda_vendus if apartment is sold
    if is_sold {
        update_project_sold_count(&pool, buyer.project_id).await?;
    }

    Ok(())
}

// Function to get all buyers for a specific project
#[tauri::command]
async fn get_buyers_by_project(pool: tauri::State<'_, PgPool>, project_id: i32) -> Result<Vec<Buyer>, String> {
    let rows = sqlx::query("SELECT * FROM buyers WHERE project_id = $1 ORDER BY id DESC")
        .bind(project_id)
        .fetch_all(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut buyers = Vec::new();
    for row in rows {
        buyers.push(Buyer {
            id: row.try_get("id").map_err(|e| e.to_string())?,
            project_id: row.try_get("project_id").map_err(|e| e.to_string())?,
            bloc: row.try_get("bloc").unwrap_or_else(|_| "A".to_string()),
            niveau: row.try_get("niveau").map_err(|e| e.to_string())?,
            logt_num: row.try_get("logt_num").map_err(|e| e.to_string())?,
            nom: row.try_get("nom").map_err(|e| e.to_string())?,
            prenom: row.try_get("prenom").map_err(|e| e.to_string())?,
            type_logt: row.try_get("type_logt").map_err(|e| e.to_string())?,
            type_of_logt: row.try_get("type_of_logt").unwrap_or_else(|_| "".to_string()),
            surface: row.try_get("surface").map_err(|e| e.to_string())?,
            date: row.try_get("date").map_err(|e| e.to_string())?,
            prix_totale: row.try_get("prix_totale").map_err(|e| e.to_string())?,
            remise: row.try_get("remise").map_err(|e| e.to_string())?,
            payments: row.try_get("payments").map_err(|e| e.to_string())?,
            payment_status: row.try_get("payment_status").map_err(|e| e.to_string())?,
            total_paid: row.try_get("total_paid").map_err(|e| e.to_string())?,
            is_sold: row.try_get("is_sold").map_err(|e| e.to_string())?,
            payment_limits_disabled: row.try_get("payment_limits_disabled").unwrap_or_else(|_| false),
        });
    }
    Ok(buyers)
}

// Function to delete buyer from database
#[tauri::command]
async fn delete_buyer_from_database(pool: tauri::State<'_, PgPool>, buyer_id: i32) -> Result<(), String> {
    let query = "DELETE FROM buyers WHERE id = $1";

    sqlx::query(query)
        .bind(buyer_id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// Function to delete employee salary record from database
#[tauri::command]
async fn delete_employee(pool: tauri::State<'_, PgPool>, employee_salary_id: i32) -> Result<(), String> {
    let query = "DELETE FROM employee_salary WHERE id = $1";

    sqlx::query(query)
        .bind(employee_salary_id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// Function to update employee salary in database
#[tauri::command]
async fn update_employee(pool: tauri::State<'_, PgPool>, employee: EmployeeWithSalary) -> Result<(), String> {
    // First, update the employee name in the employees table
    let update_employee_query = "UPDATE employees SET nom_et_prenom = $1 WHERE id = $2";
    sqlx::query(update_employee_query)
        .bind(&employee.nom_et_prenom)
        .bind(&employee.employee_id)
        .execute(&*pool)
        .await
        .map_err(|e| format!("Failed to update employee name: {}", e))?;

    // Then, update the salary data in the employee_salary table
    let update_salary_query = "UPDATE employee_salary SET prix_jour = $1, prix_hour = $2, nombre_des_jours = $3, nombre_des_heurx = $4, travaux_attache = $5, salaire = $6, acompte = $7, net_a_payer = $8, observation = $9 WHERE employee_id = $10 AND project_id = $11";

    sqlx::query(update_salary_query)
        .bind(&employee.prix_jour)
        .bind(&employee.prix_hour)
        .bind(&employee.nombre_des_jours)
        .bind(&employee.nombre_des_heurx)
        .bind(&employee.travaux_attache)
        .bind(&employee.salaire)
        .bind(&employee.acompte)
        .bind(&employee.net_a_payer)
        .bind(&employee.observation)
        .bind(&employee.employee_id)
        .bind(&employee.project_id)
        .execute(&*pool)
        .await
        .map_err(|e| format!("Failed to update salary data: {}", e))?;

    Ok(())
}

// Function to edit buyer in database
#[tauri::command]
async fn edit_buyer_in_database(pool: tauri::State<'_, PgPool>, buyer_id: i32, buyer: BuyerInput) -> Result<(), String> {
    debug_println!("=== EDIT BUYER DEBUG ===");
    debug_println!("Buyer ID: {}", buyer_id);
    debug_println!("Received buyer data: {:?}", buyer);
    debug_println!("Payments JSON: {}", serde_json::to_string_pretty(&buyer.payments).unwrap_or_else(|_| "Invalid JSON".to_string()));
    
    // Parse date string to NaiveDate
    let date = NaiveDate::parse_from_str(&buyer.date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid date format: {}", e))?;

    // Calculate total_paid from payments
    let total_paid = calculate_total_paid(&buyer.payments);
    debug_println!("Calculated total_paid: {}", total_paid);
    let final_price = buyer.prix_totale - buyer.remise;
    let was_sold_before = check_if_buyer_was_sold(&pool, buyer_id).await?;
    let is_sold = total_paid >= final_price;
    let payment_status = if is_sold { "paid" } else if total_paid > 0.0 { "partial" } else { "unpaid" };

    let query = "UPDATE buyers SET project_id = $1, bloc = $2, niveau = $3, logt_num = $4, nom = $5, prenom = $6, type_logt = $7, type_of_logt = $8, surface = $9, date = $10, prix_totale = $11, remise = $12, payments = $13, payment_status = $14, total_paid = $15, is_sold = $16, payment_limits_disabled = $17 WHERE id = $18";

    sqlx::query(query)
        .bind(&buyer.project_id)
        .bind(&buyer.bloc)
        .bind(&buyer.niveau)
        .bind(&buyer.logt_num)
        .bind(&buyer.nom)
        .bind(&buyer.prenom)
        .bind(&buyer.type_logt)
        .bind(&buyer.type_of_logt)
        .bind(&buyer.surface)
        .bind(date)
        .bind(Decimal::from_f64_retain(buyer.prix_totale).unwrap_or_default())
        .bind(Decimal::from_f64_retain(buyer.remise).unwrap_or_default())
        .bind(&buyer.payments)
        .bind(payment_status)
        .bind(Decimal::from_f64_retain(total_paid).unwrap_or_default())
        .bind(is_sold)
        .bind(buyer.payment_limits_disabled)
        .bind(buyer_id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    // Update project sold count if status changed
    if !was_sold_before && is_sold {
        update_project_sold_count(&pool, buyer.project_id).await?;
    } else if was_sold_before && !is_sold {
        decrease_project_sold_count(&pool, buyer.project_id).await?;
    }

    Ok(())
}

// Function to update buyer payments only
#[tauri::command]
async fn update_buyer_payments(app: AppHandle, pool: tauri::State<'_, PgPool>, buyer_id: i32, payments: serde_json::Value) -> Result<(), String> {
    // Calculate total_paid from payments
    let total_paid = calculate_total_paid(&payments);
    
    // Get buyer's prix_totale and remise to calculate if sold
    let buyer_data = sqlx::query("SELECT prix_totale, remise, project_id, is_sold FROM buyers WHERE id = $1")
        .bind(buyer_id)
        .fetch_one(&*pool)
        .await
        .map_err(|e| e.to_string())?;
    
    let prix_totale: Decimal = buyer_data.try_get("prix_totale").map_err(|e| e.to_string())?;
    let remise: Decimal = buyer_data.try_get("remise").map_err(|e| e.to_string())?;
    let project_id: i32 = buyer_data.try_get("project_id").map_err(|e| e.to_string())?;
    let was_sold_before: bool = buyer_data.try_get("is_sold").map_err(|e| e.to_string())?;
    
    use num_traits::ToPrimitive;
    let final_price = prix_totale.to_f64().unwrap_or(0.0) - remise.to_f64().unwrap_or(0.0);
    let is_sold = total_paid >= final_price;
    let payment_status = if is_sold { "paid" } else if total_paid > 0.0 { "partial" } else { "unpaid" };

    // Update buyer payments, total_paid, payment_status, and is_sold
    let query = "UPDATE buyers SET payments = $1, total_paid = $2, payment_status = $3, is_sold = $4 WHERE id = $5";
    
    sqlx::query(query)
        .bind(&payments)
        .bind(Decimal::from_f64_retain(total_paid).unwrap_or_default())
        .bind(payment_status)
        .bind(is_sold)
        .bind(buyer_id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    // Update project sold count if status changed
    if !was_sold_before && is_sold {
        update_project_sold_count(&pool, project_id).await?;
    } else if was_sold_before && !is_sold {
        decrease_project_sold_count(&pool, project_id).await?;
    }

    // Send Tauri notification
    let message = if is_sold {
        "Payment completed! Apartment marked as sold."
    } else if payment_status == "partial" {
        "Partial payment updated successfully."
    } else {
        "Payment updated successfully."
    };
    
    app.emit_to("payment-update", "payment-notification", message).map_err(|e| e.to_string())?;

    Ok(())
}

// Internal migration function for startup
async fn migrate_buyers_table_internal(pool: &PgPool) -> Result<(), String> {
    // First, check if the table exists and what columns it has
    let table_info = sqlx::query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'buyers'")
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;
    
    let column_info: Vec<(String, String)> = table_info.iter()
        .map(|row| {
            let name = row.try_get::<String, _>("column_name").unwrap_or_default();
            let data_type = row.try_get::<String, _>("data_type").unwrap_or_default();
            (name, data_type)
        })
        .collect();
    
    let column_names: Vec<String> = column_info.iter().map(|(name, _)| name.clone()).collect();
    
    // Check if logt_num exists and is integer type - if so, convert to varchar
    if let Some((_, data_type)) = column_info.iter().find(|(name, _)| name == "logt_num") {
        if data_type == "integer" {
            // Convert logt_num from integer to varchar
            sqlx::query("ALTER TABLE buyers ALTER COLUMN logt_num TYPE VARCHAR(50) USING logt_num::text")
                .execute(pool)
                .await
                .map_err(|e| e.to_string())?;
        }
    }
    
    // Add missing columns if they don't exist
    if !column_names.contains(&"payment_status".to_string()) {
        sqlx::query("ALTER TABLE buyers ADD COLUMN payment_status VARCHAR(20) DEFAULT 'unpaid'")
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }
    
    if !column_names.contains(&"total_paid".to_string()) {
        sqlx::query("ALTER TABLE buyers ADD COLUMN total_paid NUMERIC(15, 2) DEFAULT 0")
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }
    
    if !column_names.contains(&"is_sold".to_string()) {
        sqlx::query("ALTER TABLE buyers ADD COLUMN is_sold BOOLEAN DEFAULT FALSE")
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }
    
    if !column_names.contains(&"bloc".to_string()) {
        sqlx::query("ALTER TABLE buyers ADD COLUMN bloc VARCHAR(10) DEFAULT 'A'")
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }
    
    if !column_names.contains(&"type_of_logt".to_string()) {
        sqlx::query("ALTER TABLE buyers ADD COLUMN type_of_logt VARCHAR(20) DEFAULT ''")
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }
    
    // Update any null bloc values to 'A'
    sqlx::query("UPDATE buyers SET bloc = 'A' WHERE bloc IS NULL")
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    
    // If t0 column exists but payments doesn't, migrate
    if column_names.contains(&"t0".to_string()) && !column_names.contains(&"payments".to_string()) {
        // Add payments column
        sqlx::query("ALTER TABLE buyers ADD COLUMN payments JSONB DEFAULT '{}'")
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
        
        // Migrate t0 data to payments as initial payment
        sqlx::query("UPDATE buyers SET payments = jsonb_build_object('t0', t0) WHERE payments = '{}' OR payments IS NULL")
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

// Function to migrate existing buyers table
#[tauri::command]
async fn migrate_buyers_table(pool: tauri::State<'_, PgPool>) -> Result<(), String> {
    migrate_buyers_table_internal(&*pool).await
}

// Internal migration function for employees table
async fn migrate_employees_table_internal(pool: &PgPool) -> Result<(), String> {
    // Check if the employees table exists and what columns it has
    let table_info = sqlx::query("SELECT column_name FROM information_schema.columns WHERE table_name = 'employees'")
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;
    
    let column_names: Vec<String> = table_info.iter()
        .map(|row| row.try_get::<String, _>("column_name").unwrap_or_default())
        .collect();
    
    // If the table has salary columns, it's the old structure - need to migrate
    if column_names.contains(&"prix_jour".to_string()) {
        debug_println!("Found old employees table structure, migrating...");
        
        // Create new employees table with correct structure
        sqlx::query("CREATE TABLE employees_new (
            id SERIAL PRIMARY KEY,
            nom_et_prenom VARCHAR(255) NOT NULL UNIQUE
        )")
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
          // Copy basic employee data from old table to new table
        sqlx::query("INSERT INTO employees_new (nom_et_prenom) 
                    SELECT DISTINCT nom_et_prenom FROM employees 
                    WHERE nom_et_prenom IS NOT NULL")
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
        
        // Drop old table and rename new table
        sqlx::query("DROP TABLE employees")
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
        
        sqlx::query("ALTER TABLE employees_new RENAME TO employees")
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
        
        debug_println!("Employees table migration completed successfully");
    }
    
    Ok(())
}

// Function to migrate existing employees table
#[tauri::command]
async fn migrate_employees_table(pool: tauri::State<'_, PgPool>) -> Result<(), String> {
    migrate_employees_table_internal(&*pool).await
}

// Internal migration function for employee_salary table to fix foreign key references
async fn migrate_employee_salary_table_internal(pool: &PgPool) -> Result<(), String> {
    debug_println!("Checking employee_salary table structure...");
    
    // Check if the employee_salary table has nom_et_prenom column (old structure)
    let table_info = sqlx::query("SELECT column_name FROM information_schema.columns WHERE table_name = 'employee_salary'")
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;
    
    let column_names: Vec<String> = table_info.iter()
        .map(|row| row.try_get::<String, _>("column_name").unwrap_or_default())
        .collect();
    
    if column_names.contains(&"nom_et_prenom".to_string()) {
        debug_println!("Found old employee_salary table structure with nom_et_prenom column");
        
        // Get all unique employee names from employee_salary
        let salary_employees = sqlx::query("SELECT DISTINCT nom_et_prenom FROM employee_salary WHERE nom_et_prenom IS NOT NULL")
            .fetch_all(pool)
            .await
            .map_err(|e| e.to_string())?;
        
        // For each employee name, ensure they exist in employees table and get their correct ID
        for row in salary_employees {
            let nom_et_prenom: String = row.try_get("nom_et_prenom").map_err(|e| e.to_string())?;
            
            // Insert employee if they don't exist
            let employee_id = match sqlx::query("SELECT id FROM employees WHERE nom_et_prenom = $1")
                .bind(&nom_et_prenom)
                .fetch_optional(pool)
                .await
                .map_err(|e| e.to_string())?
            {
                Some(row) => {
                    row.try_get::<i32, _>("id").map_err(|e| e.to_string())?
                }
                None => {
                    // Insert the employee and get the new ID
                    let row = sqlx::query("INSERT INTO employees (nom_et_prenom) VALUES ($1) RETURNING id")
                        .bind(&nom_et_prenom)
                        .fetch_one(pool)
                        .await
                        .map_err(|e| e.to_string())?;
                    
                    row.try_get::<i32, _>("id").map_err(|e| e.to_string())?
                }
            };
            
            // Update all salary records with this name to use the correct employee_id
            sqlx::query("UPDATE employee_salary SET employee_id = $1 WHERE nom_et_prenom = $2")
                .bind(employee_id)
                .bind(&nom_et_prenom)
                .execute(pool)
                .await
                .map_err(|e| e.to_string())?;
        }
        
        // Drop the nom_et_prenom column from employee_salary table
        sqlx::query("ALTER TABLE employee_salary DROP COLUMN IF EXISTS nom_et_prenom")
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
        
        debug_println!("Employee_salary table migration completed successfully");
    }
    
    Ok(())
}

// Function to migrate existing employee_salary table
#[tauri::command]
async fn migrate_employee_salary_table(pool: tauri::State<'_, PgPool>) -> Result<(), String> {
    migrate_employee_salary_table_internal(&*pool).await
}

// Internal migration function for projects table
async fn migrate_projects_table_internal(pool: &PgPool) -> Result<(), String> {
    // Check if the projects table exists and what columns it has
    let table_info = sqlx::query("SELECT column_name FROM information_schema.columns WHERE table_name = 'projects'")
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;
    
    let column_names: Vec<String> = table_info.iter()
        .map(|row| {
            row.try_get::<String, _>("column_name").unwrap_or_default()
        })
        .collect();
    
    // Add missing columns if they don't exist
    if !column_names.contains(&"types_appartements".to_string()) {
        sqlx::query("ALTER TABLE projects ADD COLUMN types_appartements TEXT")
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }
    
    if !column_names.contains(&"surfaces_appartements".to_string()) {
        sqlx::query("ALTER TABLE projects ADD COLUMN surfaces_appartements TEXT")
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

// Function to migrate existing projects table
#[tauri::command]
async fn migrate_projects_table(pool: tauri::State<'_, PgPool>) -> Result<(), String> {
    migrate_projects_table_internal(&*pool).await
}

// Structure to represent dashboard statistics
#[derive(Serialize, Deserialize, Debug)]
pub struct DashboardStats {
    total_projects: i32,
    total_apartments: i32,
    average_progress: f64,
}

// Function to get dashboard statistics
#[tauri::command]
async fn get_dashboard_stats(pool: tauri::State<'_, PgPool>) -> Result<DashboardStats, String> {
    // Get total projects count
    let total_projects_row = sqlx::query("SELECT COUNT(*) as count FROM projects")
        .fetch_one(&*pool)
        .await
        .map_err(|e| e.to_string())?;
    let total_projects: i64 = total_projects_row.try_get("count").map_err(|e| e.to_string())?;

    // Get total apartments and calculate average progress
    let projects_data = sqlx::query("SELECT nombre_des_appartement, nda_vendus FROM projects")
        .fetch_all(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut total_apartments = 0i32;
    let mut total_progress = 0.0f64;
    let project_count = projects_data.len();

    for row in projects_data {
        let apartments: i32 = row.try_get("nombre_des_appartement").map_err(|e| e.to_string())?;
        let sold: i32 = row.try_get("nda_vendus").map_err(|e| e.to_string())?;
        
        total_apartments += apartments;
        
        // Calculate progress for this project (avoid division by zero)
        if apartments > 0 {
            let project_progress = (sold as f64 / apartments as f64) * 100.0;
            total_progress += project_progress;
        }
    }

    // Calculate average progress across all projects
    let average_progress = if project_count > 0 {
        total_progress / project_count as f64
    } else {
        0.0
    };

    Ok(DashboardStats {
        total_projects: total_projects as i32,
        total_apartments,
        average_progress,
    })
}

// Function to ensure database exists and create it if not
async fn ensure_database_exists(base_url: &str, db_name: &str) -> Result<(), String> {
    // Connect to the default postgres database to check if our target database exists
    let admin_url = format!("{}postgres", base_url);
    
    match PgPool::connect(&admin_url).await {
        Ok(admin_pool) => {
            // Check if database exists
            let exists = sqlx::query("SELECT 1 FROM pg_database WHERE datname = $1")
                .bind(db_name)
                .fetch_optional(&admin_pool)
                .await
                .map_err(|e| e.to_string())?;
            
            if exists.is_none() {
                // Database doesn't exist, create it
                debug_println!("Creating database '{}'...", db_name);
                let create_db_query = format!("CREATE DATABASE \"{}\"", db_name);
                sqlx::query(&create_db_query)
                    .execute(&admin_pool)
                    .await
                    .map_err(|e| format!("Failed to create database '{}': {}", db_name, e))?;
                debug_println!("Database '{}' created successfully!", db_name);
            } else {
                debug_println!("Database '{}' already exists.", db_name);
            }
            
            admin_pool.close().await;
            Ok(())
        }        Err(e) => {
            debug_println!("Warning: Could not connect to PostgreSQL admin database: {}", e);
            debug_println!("This might be because:");
            debug_println!("1. PostgreSQL is not running");
            debug_println!("2. Connection credentials are incorrect");
            debug_println!("3. PostgreSQL is not installed");
            debug_println!("\nContinuing with the assumption that the database exists...");
            Ok(())
        }
    }
}

// Function to parse database URL and extract components
fn parse_database_url(url: &str) -> Result<(String, String), String> {
    // Expected format: postgres://user:password@host:port/database
    if let Some(db_part) = url.strip_prefix("postgres://") {
        if let Some(slash_pos) = db_part.rfind('/') {
            let base_url = format!("postgres://{}/", &db_part[..slash_pos]);
            let db_name = &db_part[slash_pos + 1..];
            return Ok((base_url, db_name.to_string()));
        }
    }
    Err("Invalid database URL format. Expected: postgres://user:password@host:port/database".to_string())
}

// Function to create default admin user if no users exist
async fn create_default_admin_user(pool: &PgPool) -> Result<(), String> {
    // Check if any users exist
    let user_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;
    
    if user_count == 0 {
        debug_println!("No users found. Creating default admin user...");
        
        // Create default admin user
        sqlx::query("INSERT INTO users (name, password, admin) VALUES ($1, $2, $3)")
            .bind("admin")
            .bind("admin123")
            .bind("1")
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
          debug_println!("Default admin user created:");
        debug_println!("  Username: admin");
        debug_println!("  Password: admin123");
        debug_println!("  Please change this password after first login!");
    }
    
    Ok(())
}

// PostgreSQL Service Management
static POSTGRES_STARTED_BY_APP: AtomicBool = AtomicBool::new(false);

// Function to check if PostgreSQL service is running
fn is_postgres_running() -> (bool, Option<String>) {
    #[cfg(target_os = "windows")]
    {
        let service_names = [
            "postgresql-x64-17",
            "postgresql-x64-16",
            "postgresql-x64-15",
            "postgresql-x64-14", 
            "postgresql-x64-13",
            "postgresql-x64-12",
            "PostgreSQL",
            "postgres"
        ];
        
        for service_name in &service_names {
            let output = Command::new("sc")
                .args(&["query", service_name])
                .creation_flags(CREATE_NO_WINDOW)
                .output();
            
            if let Ok(output) = output {
                let output_str = String::from_utf8_lossy(&output.stdout);
                if output_str.contains("RUNNING") {
                    debug_println!("Found running PostgreSQL service: {}", service_name);
                    return (true, Some(service_name.to_string()));
                } else if output_str.contains("STOPPED") || output_str.contains("START_PENDING") {
                    debug_println!("Found stopped PostgreSQL service: {}", service_name);
                    return (false, Some(service_name.to_string()));
                }
            }
        }
        
        // Check if PostgreSQL is running on the default port (connection test)
        debug_println!("No PostgreSQL service found via 'sc query', checking port 5432...");
        (false, None)
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        // Try systemctl first
        let output = Command::new("systemctl")
            .args(&["is-active", "postgresql"])
            .output();
        
        match output {
            Ok(output) => {
                if output.status.success() {
                    return (true, Some("postgresql".to_string()));
                }
            }
            Err(_) => {
                // Try alternative methods for non-systemd systems
                let output = Command::new("service")
                    .args(&["postgresql", "status"])
                    .output();
                
                if let Ok(output) = output {
                    if output.status.success() {
                        return (true, Some("postgresql".to_string()));
                    }
                }
            }
        }
        
        (false, None)
    }
}

// Function to start PostgreSQL service
fn start_postgres_service() -> Result<String, String> {
    debug_println!("Attempting to start PostgreSQL service...");
    
    #[cfg(target_os = "windows")]
    {
        let service_names = [
            "postgresql-x64-17",
            "postgresql-x64-16",
            "postgresql-x64-15", 
            "postgresql-x64-14",
            "postgresql-x64-13",
            "postgresql-x64-12",
            "PostgreSQL",
            "postgres"
        ];
        
        // First, check if any service exists and try to start it
        for service_name in &service_names {
            debug_println!("Trying to start service: {}", service_name);
            
            let output = Command::new("net")
                .args(&["start", service_name])
                .creation_flags(CREATE_NO_WINDOW)
                .output();
            
            match output {
                Ok(output) => {
                    let output_str = String::from_utf8_lossy(&output.stderr);
                    if output.status.success() {
                        debug_println!("PostgreSQL service '{}' started successfully!", service_name);
                        POSTGRES_STARTED_BY_APP.store(true, Ordering::Relaxed);
                        return Ok(service_name.to_string());
                    } else if output_str.contains("already started") || output_str.contains("already running") {
                        debug_println!("PostgreSQL service '{}' was already running!", service_name);
                        return Ok(service_name.to_string());
                    } else {
                        debug_println!("Failed to start service '{}': {}", service_name, output_str);
                    }
                }
                Err(e) => {
                    debug_println!("Error executing 'net start {}': {}", service_name, e);
                }
            }
        }
        
        Err("Failed to start PostgreSQL service. Please ensure PostgreSQL is installed and the service name is correct.".to_string())
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        let output = Command::new("sudo")
            .args(&["systemctl", "start", "postgresql"])
            .output();
        
        match output {
            Ok(output) => {
                if output.status.success() {
                    debug_println!("PostgreSQL service started successfully!");
                    POSTGRES_STARTED_BY_APP.store(true, Ordering::Relaxed);
                    Ok("postgresql".to_string())
                } else {
                    let error = String::from_utf8_lossy(&output.stderr);
                    Err(format!("Failed to start PostgreSQL service: {}", error))
                }
            }
            Err(e) => Err(format!("Failed to start PostgreSQL service: {}", e))
        }
    }
}

// Function to stop PostgreSQL service (only if we started it)
fn stop_postgres_service() -> Result<(), String> {
    if !POSTGRES_STARTED_BY_APP.load(Ordering::Relaxed) {
        debug_println!("PostgreSQL was not started by this application, leaving it running.");
        return Ok(());
    }
    
    debug_println!("Stopping PostgreSQL service (started by this application)...");
    
    #[cfg(target_os = "windows")]
    {
        let service_names = [
            "postgresql-x64-17",
            "postgresql-x64-16",
            "postgresql-x64-15",
            "postgresql-x64-14", 
            "postgresql-x64-13",
            "postgresql-x64-12",
            "PostgreSQL",
            "postgres"
        ];
        
        for service_name in &service_names {
            let output = Command::new("net")
                .args(&["stop", service_name])
                .creation_flags(CREATE_NO_WINDOW)
                .output();
            
            if let Ok(output) = output {
                if output.status.success() {
                    debug_println!("PostgreSQL service '{}' stopped successfully!", service_name);
                    return Ok(());
                }
            }
        }
        
        Err("Failed to stop PostgreSQL service".to_string())
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        let output = Command::new("sudo")
            .args(&["systemctl", "stop", "postgresql"])
            .output();
        
        match output {
            Ok(output) => {
                if output.status.success() {
                    debug_println!("PostgreSQL service stopped successfully!");
                    Ok(())
                } else {
                    Err("Failed to stop PostgreSQL service".to_string())
                }
            }
            Err(e) => Err(format!("Failed to stop PostgreSQL service: {}", e))
        }
    }
}

// Function to test database connectivity
async fn test_database_connection(database_url: &str) -> bool {
    match PgPool::connect(database_url).await {
        Ok(pool) => {
            // Try a simple query
            let result = sqlx::query("SELECT 1")
                .fetch_one(&pool)
                .await;
            pool.close().await;
            result.is_ok()
        }
        Err(_) => false,
    }
}

// Function to ensure PostgreSQL is running (start if needed)
async fn ensure_postgres_running() -> Result<(), String> {    debug_println!("Checking PostgreSQL status...");
    
    // First check if service is running
    let (is_running, service_name) = is_postgres_running();
    
    if is_running {
        debug_println!("PostgreSQL service is already running: {:?}", service_name);
        
        // Test database connection to make sure it's actually accessible
        let database_url = std::env::var("DATABASE_URL")
            .unwrap_or_else(|_| "postgres://postgres:test@localhost:5432/managist_db".to_string());
        
        if test_database_connection(&database_url).await {
            debug_println!("PostgreSQL is running and accessible.");
            return Ok(());
        } else {
            debug_println!("PostgreSQL service is running but database is not accessible. Waiting a moment...");
            tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
            
            if test_database_connection(&database_url).await {
                debug_println!("PostgreSQL is now accessible.");
                return Ok(());
            } else {
                debug_println!("PostgreSQL service is running but database connection failed. Continuing anyway...");
                return Ok(()); // Don't fail completely, let the main connection logic handle it
            }
        }
    }
    
    debug_println!("PostgreSQL is not running. Attempting to start it...");
    
    // Try to start the service
    match start_postgres_service() {        Ok(started_service) => {
            debug_println!("Started PostgreSQL service: {}", started_service);
            
            // Wait for the service to fully start
            debug_println!("Waiting for PostgreSQL to become ready...");            for attempt in 1..=6 {
                tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                
                let (is_now_running, _) = is_postgres_running();
                if is_now_running {
                    debug_println!("PostgreSQL service is now running (attempt {}).", attempt);
                    
                    // Test database connection
                    let database_url = std::env::var("DATABASE_URL")
                        .unwrap_or_else(|_| "postgres://postgres:test@localhost:5432/managist_db".to_string());
                    
                    if test_database_connection(&database_url).await {
                        debug_println!("PostgreSQL started successfully and is accessible.");
                        return Ok(());
                    } else {
                        debug_println!("PostgreSQL service started but database not yet accessible (attempt {})...", attempt);
                    }
                } else {
                    debug_println!("PostgreSQL service not yet running (attempt {})...", attempt);
                }
            }
            
            // Service started but might not be fully ready yet
            debug_println!("PostgreSQL service started but may still be initializing. Continuing...");
            Ok(())
        }
        Err(e) => {
            debug_println!("Failed to start PostgreSQL service: {}", e);
            debug_println!("Attempting to continue without autostart...");
            Ok(()) // Don't completely fail - user might have PostgreSQL running manually
        }
    }
}

// Loading window management functions
#[tauri::command]
async fn initialize_app(app_handle: tauri::AppHandle) -> Result<(), String> {
    // Initialize with progress using the existing function
    initialize_with_progress(app_handle).await
}

#[tauri::command]
async fn close_loading_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    // Close the loading window
    if let Some(loading_window) = app_handle.get_webview_window("loading") {
        loading_window.close().map_err(|e| e.to_string())?;
    }
    
    // Show the main window
    if let Some(main_window) = app_handle.get_webview_window("main") {
        main_window.show().map_err(|e| e.to_string())?;
        main_window.set_focus().map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

async fn emit_loading_progress(app_handle: &tauri::AppHandle, progress: u32, message: &str) -> Result<(), String> {
    let payload = serde_json::json!({
        "progress": progress,
        "message": message
    });
    
    app_handle
        .emit("loading-progress", payload)
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

// fn get_database_path(app_handle: &tauri::AppHandle) -> Result<String, String> {
//     let app_data_dir = app_handle
//         .path()
//         .app_data_dir()
//         .map_err(|e| e.to_string())?;
//     
//     std::fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;
//     
//     let db_path = app_data_dir.join("login.db");
//     Ok(db_path.to_string_lossy().to_string())
// }

// Database state management (not needed with current setup)
// struct DatabaseState(Arc<Mutex<Option<PgPool>>>);

// Main function
// Command aliases for backwards compatibility
#[tauri::command]
async fn add_buyer(pool: tauri::State<'_, PgPool>, buyer_data: BuyerInput) -> Result<(), String> {
    add_buyer_to_database(pool, buyer_data).await
}

#[tauri::command]
async fn update_buyer(pool: tauri::State<'_, PgPool>, buyer_id: i32, buyer_data: BuyerInput) -> Result<(), String> {
    edit_buyer_in_database(pool, buyer_id, buyer_data).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> Result<(), String> {
    // Load environment variables from .env file if it exists
    dotenvy::dotenv().ok();
    
    // Setup Tauri with loading screen
    let result = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            login,
            signup_proccess,
            update_user_password,
            get_employee_by_name,
            insert_employee,
            get_all_employees,
            get_employees_by_project,
            delete_employee,
            update_employee,
            insert_employee_original,
            get_all_employees_original,
            update_employee_original,
            delete_employee_original,
            get_project_names,
            get_projects,
            add_project_to_the_database,
            update_project,
            delete_project_from_database,
            add_buyer_to_database,
            add_buyer,
            get_buyers_by_project,
            get_buyer,
            delete_buyer_from_database,
            edit_buyer_in_database,
            update_buyer,
            update_buyer_payments,
            migrate_buyers_table,
            migrate_employees_table,
            migrate_employee_salary_table,
            migrate_projects_table,
            get_dashboard_stats,
            show_main_window,
            retry_initialization,
            initialize_app,
            close_loading_window,
            debug_windows,
            check_for_updates,
            add_prix_unitaire,
            get_prix_unitaire,
            update_prix_unitaire,
            get_project_bloc_count,
            get_project_info,
            add_project_info,
            update_project_info,
            delete_project_info
        ])
        .setup(|app| {
            // Ensure loading window gets focus
            if let Some(loading_window) = app.get_webview_window("loading") {
                let _ = loading_window.set_focus();
                let _ = loading_window.show();
            }
            
            // Delay main window creation to ensure loading window shows first
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                // Wait a bit to ensure loading window is shown
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                
                // Create the main window but keep it hidden
                let _main_window = tauri::WebviewWindowBuilder::new(
                    &app_handle,
                    "main",
                    tauri::WebviewUrl::App("index.html".into())
                )
                .title("Managist")
                .inner_size(500.0, 600.0)
                .center()
                .resizable(true)
                .visible(false)
                .build();
                
                // Initialize database pool
                if let Err(e) = ensure_database_pool_ready(app_handle).await {
                    eprintln!("Failed to ensure database pool is ready: {}", e);
                }
            });
            
            Ok(())
        })
        .run(tauri::generate_context!());
    
    // Stop PostgreSQL service if we started it (normal exit)
    if let Err(e) = stop_postgres_service() {
        eprintln!("Failed to stop PostgreSQL service on exit: {}", e);
    }
    
    result.map_err(|e| e.to_string())?;
    
    Ok(())
}

// Loading screen management
#[tauri::command]
async fn show_main_window(app: AppHandle) -> Result<(), String> {
    if let Some(loading_window) = app.get_webview_window("loading") {
        loading_window.close().map_err(|e| e.to_string())?;
    }
    
    if let Some(main_window) = app.get_webview_window("main") {
        main_window.show().map_err(|e| e.to_string())?;
        main_window.set_focus().map_err(|e| e.to_string())?;
        main_window.set_size(tauri::LogicalSize::new(1080, 720)).map_err(|e| e.to_string())?;
        main_window.center().map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

// Function to restart the initialization process
#[tauri::command]
async fn retry_initialization(app: AppHandle) -> Result<(), String> {
    // Restart the initialization process
    initialize_with_progress(app).await
}

// Function to emit loading completion
fn emit_loading_complete(app: &AppHandle) {
    if let Err(e) = app.emit_to("loading", "loading-complete", ()) {
        eprintln!("Failed to emit loading complete: {}", e);
    }
}

// Helper function to ensure database pool is ready during setup
// Function to ensure payment limits column exists
async fn ensure_payment_limits_column(pool: &PgPool) -> Result<(), String> {
    debug_println!("Checking if payment_limits_disabled column exists...");
    
    // Check if column exists
    let column_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'buyers' 
            AND column_name = 'payment_limits_disabled'
        )"
    )
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Failed to check column existence: {}", e))?;

    if !column_exists {
        debug_println!("payment_limits_disabled column doesn't exist, creating it...");
        
        // Add the column with default value
        sqlx::query("ALTER TABLE buyers ADD COLUMN payment_limits_disabled BOOLEAN DEFAULT false")
            .execute(pool)
            .await
            .map_err(|e| format!("Failed to add payment_limits_disabled column: {}", e))?;
        
        // Set default values for existing records (false = limits enabled)
        sqlx::query("UPDATE buyers SET payment_limits_disabled = false WHERE payment_limits_disabled IS NULL")
            .execute(pool)
            .await
            .map_err(|e| format!("Failed to set default values: {}", e))?;
        
        // Make column NOT NULL
        sqlx::query("ALTER TABLE buyers ALTER COLUMN payment_limits_disabled SET NOT NULL")
            .execute(pool)
            .await
            .map_err(|e| format!("Failed to set NOT NULL constraint: {}", e))?;
        
        debug_println!("payment_limits_disabled column created successfully!");
    } else {
        debug_println!("payment_limits_disabled column already exists");
    }
    
    Ok(())
}

async fn ensure_database_pool_ready(app: AppHandle) -> Result<(), String> {
    debug_println!("Ensuring database pool is ready during setup...");
    
    // Get database URL
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:test@localhost:5432/managist_db".to_string());
    
    debug_println!("Using database URL for setup: {}", database_url);
    
    // Start PostgreSQL if needed (non-blocking)
    tokio::spawn(async move {
        if let Err(e) = ensure_postgres_running().await {
            debug_println!("PostgreSQL startup warning during setup: {}", e);
        }
    });
    
    // Give PostgreSQL a moment to start
    tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;
    
    // Try to connect to database with retries
    let mut attempts = 0;
    let max_attempts = 3;    while attempts < max_attempts {
        attempts += 1;
        debug_println!("Database connection attempt {} of {}...", attempts, max_attempts);
        
        match PgPool::connect(&database_url).await {
            Ok(pool) => {
                debug_println!("Database pool created successfully during setup");
                
                // Ensure payment_limits_disabled column exists
                if let Err(e) = ensure_payment_limits_column(&pool).await {
                    debug_println!("Warning: Failed to ensure payment_limits_disabled column: {}", e);
                }
                
                app.manage(pool);
                debug_println!("Database pool managed successfully");
                return Ok(());
            }
            Err(e) => {
                debug_println!("Database connection attempt {} failed: {}", attempts, e);
                if attempts < max_attempts {
                    debug_println!("Retrying database connection in 2 seconds...");
                    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                } else {
                    debug_println!("Database not ready during setup (will retry during initialization): {}", e);
                    // Don't fail setup - the loading screen will handle the full initialization
                }
            }
        }
    }
    
    Ok(())
}

// Function to emit loading error
fn emit_loading_error(app: &AppHandle, message: &str) {
    if let Err(e) = app.emit_to("loading", "loading-error", serde_json::json!({
        "message": message
    })) {
        eprintln!("Failed to emit loading error: {}", e);
    }
}

// Initialize application with progress updates
async fn initialize_with_progress(app: AppHandle) -> Result<(), String> {
    debug_println!("Starting initialization process...");
    
    // Step 1: Initialize application
    emit_loading_progress(&app, 15, "Initializing application...").await?;
    debug_println!("Step 1: Application initialized");
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    
    // Step 2: Start PostgreSQL
    emit_loading_progress(&app, 35, "Starting database services...").await?;
    debug_println!("Step 2: Starting PostgreSQL...");
    match ensure_postgres_running().await {
        Ok(()) => {
            debug_println!("PostgreSQL started successfully");
            emit_loading_progress(&app, 40, "Database services started successfully").await?;
        }
        Err(e) => {
            debug_println!("PostgreSQL warning: {}", e);
            emit_loading_progress(&app, 40, "Database services may need manual setup").await?;
        }
    }
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    
    // Step 3: Connect to database
    emit_loading_progress(&app, 60, "Connecting to database...").await?;
    debug_println!("Step 3: Connecting to database...");
    
    // Get database URL
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:test@localhost:5432/managist_db".to_string());
    
    debug_println!("Using database URL: {}", database_url);
    
    // Try to ensure database exists
    if let Ok((base_url, db_name)) = parse_database_url(&database_url) {
        debug_println!("Ensuring database '{}' exists...", db_name);
        if let Err(e) = ensure_database_exists(&base_url, &db_name).await {
            debug_println!("Database creation warning: {}", e);
        }
    }
    
    // Connect to database (or use existing pool if already managed)
    debug_println!("Attempting to connect to database...");
    
    let pool = match app.try_state::<PgPool>() {
        Some(existing_pool) => {
            debug_println!("Using existing database pool from setup");            // Test the existing pool
            match sqlx::query("SELECT 1").fetch_one(&*existing_pool).await {
                Ok(_) => {
                    debug_println!("Existing database pool is working");
                    existing_pool.inner().clone()
                }
                Err(e) => {
                    debug_println!("Existing pool test failed: {}, creating new pool", e);
                    
                    // Create a new pool
                    let new_pool = create_database_pool_with_retries(&database_url, &app).await?;
                    app.manage(new_pool.clone());
                    new_pool
                }
            }
        }
        None => {
            // Pool doesn't exist yet, create a new one
            debug_println!("Creating new database pool...");
            let new_pool = create_database_pool_with_retries(&database_url, &app).await?;
            
            // Manage the new pool
            app.manage(new_pool.clone());
            debug_println!("New database pool managed successfully");
            new_pool
        }
    };
    
    debug_println!("Database connected successfully");
    emit_loading_progress(&app, 65, "Database connected successfully").await?;
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    
    // Step 4: Setup tables
    emit_loading_progress(&app, 80, "Setting up database tables...").await?;
    debug_println!("Step 4: Setting up database tables...");
    
    // Create tables (existing code)
    setup_database_tables(&pool).await?;
    
    debug_println!("Database tables ready");
    emit_loading_progress(&app, 85, "Database tables ready").await?;
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    
    // Step 5: Finalize
    emit_loading_progress(&app, 100, "Loading user interface...").await?;
    debug_println!("Step 5: Finalizing...");
    tokio::time::sleep(tokio::time::Duration::from_millis(800)).await;
    
    // Pool is already managed above, so we don't need to manage it again
    debug_println!("Database pool is ready and managed");
    
    // Emit completion
    emit_loading_complete(&app);
    debug_println!("Loading complete event emitted");
    
    Ok(())
}

// Helper function to create database pool with retries
async fn create_database_pool_with_retries(database_url: &str, app: &AppHandle) -> Result<PgPool, String> {
    let max_attempts = 5;
    let mut last_error = String::new();
      for attempt in 1..=max_attempts {
        debug_println!("Database connection attempt {} of {}...", attempt, max_attempts);
        
        match PgPool::connect(&database_url).await {
            Ok(pool) => {
                debug_println!("Database pool created successfully on attempt {}", attempt);
                return Ok(pool);
            }
            Err(e) => {
                last_error = e.to_string();
                debug_println!("Database connection attempt {} failed: {}", attempt, last_error);
                
                if attempt < max_attempts {
                    let wait_time = attempt * 2; // Exponential backoff: 2, 4, 6, 8 seconds
                    debug_println!("Retrying in {} seconds...", wait_time);
                    
                    emit_loading_progress(
                        app, 
                        60 + (attempt * 2) as u32, 
                        &format!("Database connection attempt {} of {}...", attempt, max_attempts)
                    ).await.ok();
                    
                    tokio::time::sleep(tokio::time::Duration::from_secs(wait_time as u64)).await;
                }
            }
        }
    }
    
    let error_msg = format!("Database connection failed after {} attempts. Last error: {}", max_attempts, last_error);
    debug_println!("{}", error_msg);
    emit_loading_error(app, &error_msg);
    Err(error_msg)
}

// Extract database setup logic
async fn setup_database_tables(pool: &PgPool) -> Result<(), String> {
    // Users table
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            admin VARCHAR(10) DEFAULT '0' -- Role: 0=User, 1=Admin, 2=Manager
        )"
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    // Employees table (simplified - only basic employee information)
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS employees (
            id SERIAL PRIMARY KEY,
            nom_et_prenom VARCHAR(255) NOT NULL UNIQUE
        )"
    ).execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    // Employee Salary table (project-specific salary records)
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS employee_salary (
            id SERIAL PRIMARY KEY,
            employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
            project_id VARCHAR(255) NOT NULL DEFAULT 'administration',
            prix_jour NUMERIC(10, 2),
            prix_hour NUMERIC(10, 2),
            nombre_des_jours INTEGER,
            nombre_des_heurx INTEGER DEFAULT 0,
            travaux_attache NUMERIC(10, 2),
            salaire NUMERIC(10, 2),
            acompte NUMERIC(10, 2),
            net_a_payer NUMERIC(10, 2),
            observation TEXT,
            UNIQUE(employee_id, project_id)
        )"
    ).execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    // Projects table
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS projects (
            id SERIAL PRIMARY KEY,
            project_name VARCHAR(255) NOT NULL,
            project_location VARCHAR(255),
            project_start_date DATE,
            project_end_date DATE,
            nombre_des_bloc INTEGER,
            nombre_des_etages INTEGER,
            nombre_des_appartement INTEGER,
            nda_dans_chaque_etage INTEGER,
            types_appartements TEXT,
            surfaces_appartements TEXT,
            nda_vendus INTEGER DEFAULT 0
        )"
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;    // Buyers table
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS buyers (
            id SERIAL PRIMARY KEY,
            project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            bloc VARCHAR(10) DEFAULT 'A',
            niveau VARCHAR(50),
            logt_num VARCHAR(50),
            nom VARCHAR(255),
            prenom VARCHAR(255),
            type_logt VARCHAR(100),
            surface VARCHAR(50),
            date DATE,
            prix_totale NUMERIC(15, 2),
            remise NUMERIC(15, 2),
            payments JSONB DEFAULT '{}',
            payment_status VARCHAR(20) DEFAULT 'unpaid',
            total_paid NUMERIC(15, 2) DEFAULT 0,
            is_sold BOOLEAN DEFAULT FALSE,
            payment_limits_disabled BOOLEAN DEFAULT FALSE
        )"
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    // Add payment_limits_disabled column to existing buyers table if it doesn't exist
    let add_column_result = sqlx::query(
        "ALTER TABLE buyers ADD COLUMN IF NOT EXISTS payment_limits_disabled BOOLEAN DEFAULT FALSE"
    )
    .execute(pool)
    .await;

    match add_column_result {
        Ok(_) => {
            debug_println!("Payment limits column added/verified successfully");
        }
        Err(e) => {
            debug_println!("Note: Could not add payment_limits_disabled column (might already exist): {}", e);
            // This is not critical - the column might already exist
        }
    }

    // Project info table (apartment types and prices)
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS project_info (
            id SERIAL PRIMARY KEY,
            project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            type_of_appartement TEXT NOT NULL,
            surface NUMERIC(10, 2) NOT NULL,            price NUMERIC(15, 2) NOT NULL
        )"
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    // Prix unitaire table
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS prix_unitaire (
            id SERIAL PRIMARY KEY,
            project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            prix_unitaire NUMERIC(15, 2) NOT NULL
        )"
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;    // Run migrations
    migrate_employees_table_internal(pool).await?;
    migrate_employee_salary_table_internal(pool).await?;
    migrate_projects_table_internal(pool).await?;
    migrate_buyers_table_internal(pool).await?;
    
    // Initialize default prix unitaire for projects
    initialize_default_prix_unitaire(pool).await?;
    
    // Create default admin user
    create_default_admin_user(pool).await?;
    
    Ok(())
}

// Debugging and utility functions
#[tauri::command]
async fn debug_windows(app_handle: tauri::AppHandle) -> Result<String, String> {
    let mut info = String::new();
    
    // Check if loading window exists
    if let Some(loading_window) = app_handle.get_webview_window("loading") {
        info.push_str("Loading window exists\n");
        info.push_str(&format!("Loading window visible: {:?}\n", loading_window.is_visible()));
    } else {
        info.push_str("Loading window does not exist\n");
    }
    
    // Check if main window exists
    if let Some(main_window) = app_handle.get_webview_window("main") {
        info.push_str("Main window exists\n");
        info.push_str(&format!("Main window visible: {:?}\n", main_window.is_visible()));
    } else {
        info.push_str("Main window does not exist\n");
    }
    
    Ok(info)
}

// Function to check for updates
#[tauri::command]
async fn check_for_updates(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_updater::UpdaterExt;
    
    match app.updater() {
        Ok(updater) => {
            match updater.check().await {
                Ok(Some(update)) => {
                    println!("Update available: {}", update.version);
                    // You can show a dialog or handle the update here
                    match update.download_and_install(|chunk_length, content_length| {
                        println!("Downloaded {} of {:?}", chunk_length, content_length);
                    }, || {
                        println!("Download finished");
                    }).await {
                        Ok(_) => {
                            println!("Update installed successfully");
                            Ok(())
                        }
                        Err(e) => {
                            eprintln!("Failed to install update: {}", e);
                            Err(format!("Failed to install update: {}", e))
                        }
                    }
                }
                Ok(None) => {
                    println!("No update available");
                    Ok(())
                }
                Err(e) => {
                    eprintln!("Failed to check for updates: {}", e);
                    Err(format!("Failed to check for updates: {}", e))
                }
            }
        }
        Err(e) => {
            eprintln!("Failed to initialize updater: {}", e);
            Err(format!("Failed to initialize updater: {}", e))
        }
    }
}

// Function to update project in the database
#[tauri::command]
async fn update_project(pool: tauri::State<'_, PgPool>, project_id: i32, project: ProjectInput) -> Result<(), String> {
    // Parse date strings to NaiveDate
    let start_date = NaiveDate::parse_from_str(&project.project_start_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid start date format: {}", e))?;
    let end_date = NaiveDate::parse_from_str(&project.project_end_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid end date format: {}", e))?;

    let query = "UPDATE projects SET project_name = $1, project_location = $2, project_start_date = $3, project_end_date = $4, nombre_des_bloc = $5, nombre_des_etages = $6, nombre_des_appartement = $7, nda_dans_chaque_etage = $8, types_appartements = $9, surfaces_appartements = $10 WHERE id = $11";

    sqlx::query(query)
        .bind(&project.project_name)
        .bind(&project.project_location)
        .bind(start_date)
        .bind(end_date)
        .bind(&project.nombre_des_bloc)
        .bind(&project.nombre_des_etages)
        .bind(&project.nombre_des_appartement)
        .bind(&project.nda_dans_chaque_etage)
        .bind(&project.types_appartements)
        .bind(&project.surfaces_appartements)
        .bind(project_id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// Function to add prix unitaire to database
#[tauri::command]
async fn add_prix_unitaire(pool: tauri::State<'_, PgPool>, prix_unitaire_input: PrixUnitaireInput) -> Result<(), String> {
    // Check if prix unitaire already exists for this project
    let existing = sqlx::query("SELECT id FROM prix_unitaire WHERE project_id = $1")
        .bind(&prix_unitaire_input.project_id)
        .fetch_optional(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    if existing.is_some() {
        // Update existing prix unitaire
        sqlx::query("UPDATE prix_unitaire SET prix_unitaire = $1 WHERE project_id = $2")
            .bind(Decimal::from_f64_retain(prix_unitaire_input.prix_unitaire).unwrap_or_default())
            .bind(&prix_unitaire_input.project_id)
            .execute(&*pool)
            .await
            .map_err(|e| e.to_string())?;
    } else {
        // Insert new prix unitaire
        sqlx::query("INSERT INTO prix_unitaire (project_id, prix_unitaire) VALUES ($1, $2)")
            .bind(&prix_unitaire_input.project_id)
            .bind(Decimal::from_f64_retain(prix_unitaire_input.prix_unitaire).unwrap_or_default())
            .execute(&*pool)
            .await
            .map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

// Function to get prix unitaire for a project
#[tauri::command]
async fn get_prix_unitaire(pool: tauri::State<'_, PgPool>, project_id: i32) -> Result<Option<PrixUnitaire>, String> {
    let row = sqlx::query("SELECT id, project_id, prix_unitaire FROM prix_unitaire WHERE project_id = $1")
        .bind(project_id)
        .fetch_optional(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    if let Some(row) = row {
        Ok(Some(PrixUnitaire {
            id: row.try_get("id").map_err(|e| e.to_string())?,
            project_id: row.try_get("project_id").map_err(|e| e.to_string())?,
            prix_unitaire: row.try_get("prix_unitaire").map_err(|e| e.to_string())?,
        }))
    } else {
        Ok(None)
    }
}

// Function to update prix unitaire
#[tauri::command]
async fn update_prix_unitaire(pool: tauri::State<'_, PgPool>, prix_unitaire_id: i32, prix_unitaire_input: PrixUnitaireInput) -> Result<(), String> {
    sqlx::query("UPDATE prix_unitaire SET project_id = $1, prix_unitaire = $2 WHERE id = $3")
        .bind(&prix_unitaire_input.project_id)
        .bind(Decimal::from_f64_retain(prix_unitaire_input.prix_unitaire).unwrap_or_default())
        .bind(prix_unitaire_id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

// Function to get project bloc count
#[tauri::command]
async fn get_project_bloc_count(pool: tauri::State<'_, PgPool>, project_id: i32) -> Result<i32, String> {
    let row = sqlx::query("SELECT nombre_des_bloc FROM projects WHERE id = $1")
        .bind(project_id)
        .fetch_one(&*pool)
        .await
        .map_err(|e| e.to_string())?;
    
    let bloc_count: i32 = row.try_get("nombre_des_bloc").map_err(|e| e.to_string())?;
    Ok(bloc_count)
}

// Function to get project info (apartment types and prices)
#[tauri::command]
async fn get_project_info(pool: tauri::State<'_, PgPool>, project_id: i32) -> Result<Vec<ProjectInfo>, String> {
    let rows = sqlx::query("SELECT id, project_id, type_of_appartement, surface, price FROM project_info WHERE project_id = $1")
        .bind(project_id)
        .fetch_all(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut project_infos = Vec::new();
    for row in rows {
        project_infos.push(ProjectInfo {
            id: row.try_get("id").map_err(|e| e.to_string())?,
            project_id: row.try_get("project_id").map_err(|e| e.to_string())?,
            type_of_appartement: row.try_get("type_of_appartement").map_err(|e| e.to_string())?,
            surface: row.try_get("surface").map_err(|e| e.to_string())?,
            price: row.try_get("price").map_err(|e| e.to_string())?,
        });
    }
    Ok(project_infos)
}

// Function to add project info
#[tauri::command]
async fn add_project_info(pool: tauri::State<'_, PgPool>, project_info_input: ProjectInfoInput) -> Result<(), String> {
    sqlx::query("INSERT INTO project_info (project_id, type_of_appartement, surface, price) VALUES ($1, $2, $3, $4)")
        .bind(&project_info_input.project_id)
        .bind(&project_info_input.type_of_appartement)
        .bind(Decimal::from_f64_retain(project_info_input.surface).unwrap_or_default())
        .bind(Decimal::from_f64_retain(project_info_input.price).unwrap_or_default())
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

// Function to update project info
#[tauri::command]
async fn update_project_info(pool: tauri::State<'_, PgPool>, project_info_id: i32, project_info_input: ProjectInfoInput) -> Result<(), String> {
    sqlx::query("UPDATE project_info SET project_id = $1, type_of_appartement = $2, surface = $3, price = $4 WHERE id = $5")
        .bind(&project_info_input.project_id)
        .bind(&project_info_input.type_of_appartement)
        .bind(Decimal::from_f64_retain(project_info_input.surface).unwrap_or_default())
        .bind(Decimal::from_f64_retain(project_info_input.price).unwrap_or_default())
        .bind(project_info_id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

// Function to delete project info
#[tauri::command]
async fn delete_project_info(pool: tauri::State<'_, PgPool>, project_info_id: i32) -> Result<(), String> {
    sqlx::query("DELETE FROM project_info WHERE id = $1")
        .bind(project_info_id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

// Function to initialize default prix unitaire for projects that don't have one
async fn initialize_default_prix_unitaire(pool: &PgPool) -> Result<(), String> {
    // Get all projects that don't have prix unitaire
    let projects_without_prix = sqlx::query("SELECT p.id FROM projects p LEFT JOIN prix_unitaire pu ON p.id = pu.project_id WHERE pu.id IS NULL")
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;
    
    // Insert default prix unitaire for each project
    for project_row in projects_without_prix {
        let project_id: i32 = project_row.try_get("id").map_err(|e| e.to_string())?;
        
        // Insert default prix unitaire (you can adjust this default value)
        sqlx::query("INSERT INTO prix_unitaire (project_id, prix_unitaire) VALUES ($1, $2)")
            .bind(project_id)
            .bind(Decimal::new(100000, 2)) // Default: 1000.00
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
        
        debug_println!("Added default prix unitaire for project {}", project_id);
    }
    
    Ok(())
}

// Function to get a single buyer by ID
#[tauri::command]
async fn get_buyer(pool: tauri::State<'_, PgPool>, buyer_id: i32) -> Result<Option<Buyer>, String> {
    let row = sqlx::query("SELECT * FROM buyers WHERE id = $1")
        .bind(buyer_id)
        .fetch_optional(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    if let Some(row) = row {
        Ok(Some(Buyer {
            id: row.try_get("id").map_err(|e| e.to_string())?,
            project_id: row.try_get("project_id").map_err(|e| e.to_string())?,
            bloc: row.try_get("bloc").unwrap_or_else(|_| "A".to_string()),
            niveau: row.try_get("niveau").map_err(|e| e.to_string())?,
            logt_num: row.try_get("logt_num").map_err(|e| e.to_string())?,
            nom: row.try_get("nom").map_err(|e| e.to_string())?,
            prenom: row.try_get("prenom").map_err(|e| e.to_string())?,
            type_logt: row.try_get("type_logt").map_err(|e| e.to_string())?,
            type_of_logt: row.try_get("type_of_logt").unwrap_or_else(|_| "".to_string()),
            surface: row.try_get("surface").map_err(|e| e.to_string())?,
            date: row.try_get("date").map_err(|e| e.to_string())?,
            prix_totale: row.try_get("prix_totale").map_err(|e| e.to_string())?,
            remise: row.try_get("remise").map_err(|e| e.to_string())?,
            payments: row.try_get("payments").map_err(|e| e.to_string())?,
            payment_status: row.try_get("payment_status").map_err(|e| e.to_string())?,
            total_paid: row.try_get("total_paid").map_err(|e| e.to_string())?,
            is_sold: row.try_get("is_sold").map_err(|e| e.to_string())?,
            payment_limits_disabled: row.try_get("payment_limits_disabled").unwrap_or_else(|_| false),
        }))
    } else {
        Ok(None)
    }
}