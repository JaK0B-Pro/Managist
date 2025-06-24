use tauri::{AppHandle, Emitter, State, Manager};
use serde::{Serialize, Deserialize};
use sqlx::Row;
use sqlx::PgPool;
use rust_decimal::Decimal;
use chrono::NaiveDate;
use std::env;
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};

// Structure to represent the Employee
#[derive(Serialize, Deserialize, Debug)]
pub struct Employee {
    id: i32,
    nom_et_prenom: String,
    prix_jour: Decimal,
    prix_hour: Decimal, 
    nombre_des_jours: i32,
    travaux_attache: Decimal,
    salaire: Decimal,
    acompte: Decimal,
    net_a_payer: Decimal,
    observation: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct EmployeeInput {
    nom_et_prenom: String,
    prix_jour: i32,
    prix_hour: f64,
    nombre_des_jours: i32,
    travaux_attache: i32,
    salaire: i32,
    acompte: i32,
    net_a_payer: i32,
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
    surface: String,
    date: NaiveDate,
    prix_totale: Decimal,
    remise: Decimal,
    payments: serde_json::Value,
    payment_status: String,
    total_paid: Decimal,
    is_sold: bool,
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
    surface: String,
    date: String,
    prix_totale: f64,
    remise: f64,
    payments: serde_json::Value, 
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
    
    let rows = sqlx::query("SELECT id, name, password, admin FROM users WHERE name = $1 AND password = $2")
        .bind(&user)
        .bind(&password)
        .fetch_all(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    if let Some(row) = rows.first() {
        let admin_value: String = row.try_get("admin").map_err(|e| e.to_string())?;
        app.emit_to("login", "login-result", format!("LoggedIn:{}", admin_value)).map_err(|e| e.to_string())?;
    } else {
        app.emit_to("login", "login-result", "Invalid Credentials").map_err(|e| e.to_string())?;
    }
    
    Ok(())
}




// Function to handle signup process
#[tauri::command]
async fn signup_proccess(app: AppHandle, pool: tauri::State<'_, PgPool>, name: String, password: String, admin: String) -> Result<(), String> {
    sqlx::query("INSERT INTO users(name, password, admin) VALUES ($1, $2, $3)")
        .bind(&name)
        .bind(&password)
        .bind(&admin)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;
    
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
    let rows = sqlx::query("SELECT * FROM employees WHERE nom_et_prenom = $1")
        .bind(&employee_name)
        .fetch_all(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    if let Some(row) = rows.first() {
        let employee = Employee {
            id: row.try_get("id").map_err(|e| e.to_string())?,
            nom_et_prenom: row.try_get("nom_et_prenom").map_err(|e| e.to_string())?,
            prix_jour: row.try_get("prix_jour").map_err(|e| e.to_string())?,
            prix_hour: row.try_get("prix_hour").map_err(|e| e.to_string())?,
            nombre_des_jours: row.try_get("nombre_des_jours").map_err(|e| e.to_string())?,
            travaux_attache: row.try_get("traveaux_attache").map_err(|e| e.to_string())?,
            salaire: row.try_get("salaire").map_err(|e| e.to_string())?,
            acompte: row.try_get("acompte").map_err(|e| e.to_string())?,
            net_a_payer: row.try_get("net_a_payer").map_err(|e| e.to_string())?,
            observation: row.try_get("observation").map_err(|e| e.to_string())?,
        };
        Ok(Some(employee))
    } else {
        Ok(None)
    }
}

// Function to insert employee data into the database
#[tauri::command]
async fn insert_employee(app: AppHandle, pool: tauri::State<'_, PgPool>, employee: EmployeeInput) -> Result<(), String> {
    let query = "INSERT INTO employees (nom_et_prenom, prix_jour, prix_hour, nombre_des_jours, traveaux_attache, salaire, acompte, net_a_payer, observation) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)";

    sqlx::query(query)
        .bind(&employee.nom_et_prenom)
        .bind(employee.prix_jour)
        .bind(employee.prix_hour)
        .bind(employee.nombre_des_jours)
        .bind(employee.travaux_attache)
        .bind(employee.salaire)
        .bind(employee.acompte)
        .bind(employee.net_a_payer)
        .bind(&employee.observation)
        .execute(&*pool)
        .await.map_err(|e| e.to_string())?;
        
    app.emit_to("add_emplyee", "add_emplyee_result", "success").map_err(|e| e.to_string())?;
    Ok(())
}




// Function to get all employees from the database
#[tauri::command]
async fn get_all_employees(pool: State<'_, PgPool>) -> Result<Vec<Employee>, String> {
    // Query with ORDER BY id to maintain consistent ranking
    let rows = sqlx::query("SELECT * FROM employees ORDER BY id ASC")
        .fetch_all(&*pool)
        .await
        .map_err(|e| e.to_string())?;


    let mut employees = Vec::new();
    
    for row in rows {
        let prix_jour_db: Decimal = row.try_get("prix_jour").map_err(|e| e.to_string())?;

        let employee = Employee {
            id: row.try_get("id").map_err(|e| e.to_string())?,
            nom_et_prenom: row.try_get("nom_et_prenom").map_err(|e| e.to_string())?,
            prix_jour: prix_jour_db,
            prix_hour: row.try_get("prix_hour").map_err(|e| e.to_string())?,
            nombre_des_jours: row.try_get("nombre_des_jours").map_err(|e| e.to_string())?,
            travaux_attache: row.try_get("traveaux_attache").map_err(|e| e.to_string())?,
            salaire: row.try_get("salaire").map_err(|e| e.to_string())?,
            acompte: row.try_get("acompte").map_err(|e| e.to_string())?,
            net_a_payer: row.try_get("net_a_payer").map_err(|e| e.to_string())?,
            observation: row.try_get("observation").map_err(|e| e.to_string())?
        };
        employees.push(employee);
    }
    // app.emit_to("employees", "employees-data", &employees).map_err(|e| e.to_string())?;
    Ok(employees)
}



// Get all the projects name and insert them into a vector
#[tauri::command]
async fn get_project_names(pool: tauri::State<'_, PgPool>) -> Result<Vec<ProjectName>, String> {
    let rows = sqlx::query("SELECT id, project_name FROM projects")
        .fetch_all(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut projects = Vec::new();
    for row in rows {
        projects.push(ProjectName {
            id: row.try_get("id").map_err(|e| e.to_string())?,
            name: row.try_get("project_name").map_err(|e| e.to_string())?,
        });
    }
    Ok(projects)
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
    if let Some(obj) = payments.as_object() {
        obj.values()
            .filter_map(|v| {
                // Handle both old format (direct number) and new format (object with amount)
                if let Some(amount) = v.as_f64() {
                    Some(amount)
                } else if let Some(tranche_obj) = v.as_object() {
                    tranche_obj.get("amount").and_then(|a| a.as_f64())
                } else {
                    None
                }
            })
            .sum()
    } else {
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
    // Parse date string to NaiveDate
    let date = NaiveDate::parse_from_str(&buyer.date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid date format: {}", e))?;

    // Calculate total_paid from payments
    let total_paid = calculate_total_paid(&buyer.payments);
    let final_price = buyer.prix_totale - buyer.remise;
    let is_sold = total_paid >= final_price;
    let payment_status = if is_sold { "paid" } else if total_paid > 0.0 { "partial" } else { "unpaid" };

    let query = "INSERT INTO buyers (project_id, bloc, niveau, logt_num, nom, prenom, type_logt, surface, date, prix_totale, remise, payments, payment_status, total_paid, is_sold) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)";

    sqlx::query(query)
        .bind(&buyer.project_id)
        .bind(&buyer.bloc)
        .bind(&buyer.niveau)
        .bind(&buyer.logt_num)
        .bind(&buyer.nom)
        .bind(&buyer.prenom)
        .bind(&buyer.type_logt)
        .bind(&buyer.surface)
        .bind(date)
        .bind(Decimal::from_f64_retain(buyer.prix_totale).unwrap_or_default())
        .bind(Decimal::from_f64_retain(buyer.remise).unwrap_or_default())
        .bind(&buyer.payments)
        .bind(payment_status)
        .bind(Decimal::from_f64_retain(total_paid).unwrap_or_default())
        .bind(is_sold)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;

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
            surface: row.try_get("surface").map_err(|e| e.to_string())?,
            date: row.try_get("date").map_err(|e| e.to_string())?,
            prix_totale: row.try_get("prix_totale").map_err(|e| e.to_string())?,
            remise: row.try_get("remise").map_err(|e| e.to_string())?,
            payments: row.try_get("payments").map_err(|e| e.to_string())?,
            payment_status: row.try_get("payment_status").map_err(|e| e.to_string())?,
            total_paid: row.try_get("total_paid").map_err(|e| e.to_string())?,
            is_sold: row.try_get("is_sold").map_err(|e| e.to_string())?,
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

// Function to delete employee from database
#[tauri::command]
async fn delete_employee(pool: tauri::State<'_, PgPool>, employee_id: i32) -> Result<(), String> {
    let query = "DELETE FROM employees WHERE id = $1";

    sqlx::query(query)
        .bind(employee_id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// Function to update employee in database (ID is never updated)
#[tauri::command]
async fn update_employee(pool: tauri::State<'_, PgPool>, employee: Employee) -> Result<(), String> {
    let query = "UPDATE employees SET nom_et_prenom = $1, prix_jour = $2, prix_hour = $3, nombre_des_jours = $4, traveaux_attache = $5, salaire = $6, acompte = $7, net_a_payer = $8, observation = $9 WHERE id = $10";

    sqlx::query(query)
        .bind(&employee.nom_et_prenom)
        .bind(&employee.prix_jour)
        .bind(&employee.prix_hour)
        .bind(&employee.nombre_des_jours)
        .bind(&employee.travaux_attache)
        .bind(&employee.salaire)
        .bind(&employee.acompte)
        .bind(&employee.net_a_payer)
        .bind(&employee.observation)
        .bind(&employee.id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// Function to edit buyer in database
#[tauri::command]
async fn edit_buyer_in_database(pool: tauri::State<'_, PgPool>, buyer_id: i32, buyer: BuyerInput) -> Result<(), String> {
    // Parse date string to NaiveDate
    let date = NaiveDate::parse_from_str(&buyer.date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid date format: {}", e))?;

    // Calculate total_paid from payments
    let total_paid = calculate_total_paid(&buyer.payments);
    let final_price = buyer.prix_totale - buyer.remise;
    let was_sold_before = check_if_buyer_was_sold(&pool, buyer_id).await?;
    let is_sold = total_paid >= final_price;
    let payment_status = if is_sold { "paid" } else if total_paid > 0.0 { "partial" } else { "unpaid" };

    let query = "UPDATE buyers SET project_id = $1, bloc = $2, niveau = $3, logt_num = $4, nom = $5, prenom = $6, type_logt = $7, surface = $8, date = $9, prix_totale = $10, remise = $11, payments = $12, payment_status = $13, total_paid = $14, is_sold = $15 WHERE id = $16";

    sqlx::query(query)
        .bind(&buyer.project_id)
        .bind(&buyer.bloc)
        .bind(&buyer.niveau)
        .bind(&buyer.logt_num)
        .bind(&buyer.nom)
        .bind(&buyer.prenom)
        .bind(&buyer.type_logt)
        .bind(&buyer.surface)
        .bind(date)
        .bind(Decimal::from_f64_retain(buyer.prix_totale).unwrap_or_default())
        .bind(Decimal::from_f64_retain(buyer.remise).unwrap_or_default())
        .bind(&buyer.payments)
        .bind(payment_status)
        .bind(Decimal::from_f64_retain(total_paid).unwrap_or_default())
        .bind(is_sold)
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

// Functions for managing project info (apartment types and prices)

// Function to get all project info for a specific project
#[tauri::command]
async fn get_project_info(pool: tauri::State<'_, PgPool>, project_id: i32) -> Result<Vec<ProjectInfo>, String> {
    let rows = sqlx::query("SELECT * FROM project_info WHERE project_id = $1 ORDER BY id ASC")
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
async fn add_project_info(pool: tauri::State<'_, PgPool>, project_info: ProjectInfoInput) -> Result<(), String> {
    let query = "INSERT INTO project_info (project_id, type_of_appartement, surface, price) VALUES ($1, $2, $3, $4)";

    sqlx::query(query)
        .bind(&project_info.project_id)
        .bind(&project_info.type_of_appartement)
        .bind(Decimal::from_f64_retain(project_info.surface).unwrap_or_default())
        .bind(Decimal::from_f64_retain(project_info.price).unwrap_or_default())
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// Function to update project info
#[tauri::command]
async fn update_project_info(pool: tauri::State<'_, PgPool>, info_id: i32, project_info: ProjectInfoInput) -> Result<(), String> {
    let query = "UPDATE project_info SET type_of_appartement = $1, surface = $2, price = $3 WHERE id = $4";

    sqlx::query(query)
        .bind(&project_info.type_of_appartement)
        .bind(Decimal::from_f64_retain(project_info.surface).unwrap_or_default())
        .bind(Decimal::from_f64_retain(project_info.price).unwrap_or_default())
        .bind(info_id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// Function to delete project info
#[tauri::command]
async fn delete_project_info(pool: tauri::State<'_, PgPool>, info_id: i32) -> Result<(), String> {
    let query = "DELETE FROM project_info WHERE id = $1";

    sqlx::query(query)
        .bind(info_id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
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
                println!("Creating database '{}'...", db_name);
                let create_db_query = format!("CREATE DATABASE \"{}\"", db_name);
                sqlx::query(&create_db_query)
                    .execute(&admin_pool)
                    .await
                    .map_err(|e| format!("Failed to create database '{}': {}", db_name, e))?;
                println!("Database '{}' created successfully!", db_name);
            } else {
                println!("Database '{}' already exists.", db_name);
            }
            
            admin_pool.close().await;
            Ok(())
        }
        Err(e) => {
            eprintln!("Warning: Could not connect to PostgreSQL admin database: {}", e);
            eprintln!("This might be because:");
            eprintln!("1. PostgreSQL is not running");
            eprintln!("2. Connection credentials are incorrect");
            eprintln!("3. PostgreSQL is not installed");
            eprintln!("\nContinuing with the assumption that the database exists...");
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
        println!("No users found. Creating default admin user...");
        
        // Create default admin user
        sqlx::query("INSERT INTO users (name, password, admin) VALUES ($1, $2, $3)")
            .bind("admin")
            .bind("admin123")
            .bind("1")
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
        
        println!("Default admin user created:");
        println!("  Username: admin");
        println!("  Password: admin123");
        println!("  Please change this password after first login!");
    }
    
    Ok(())
}

// PostgreSQL Service Management
static POSTGRES_STARTED_BY_APP: AtomicBool = AtomicBool::new(false);

// Function to check if PostgreSQL service is running
fn is_postgres_running() -> bool {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("sc")
            .args(&["query", "postgresql-x64-16"]) // Adjust service name as needed
            .output();
        
        match output {
            Ok(output) => {
                let output_str = String::from_utf8_lossy(&output.stdout);
                output_str.contains("RUNNING")
            }
            Err(_) => {
                // Try alternative service names
                let alternative_names = [
                    "postgresql-x64-15",
                    "postgresql-x64-14", 
                    "postgresql-x64-13",
                    "PostgreSQL",
                    "postgres"
                ];
                
                for name in &alternative_names {
                    let output = Command::new("sc")
                        .args(&["query", name])
                        .output();
                    
                    if let Ok(output) = output {
                        let output_str = String::from_utf8_lossy(&output.stdout);
                        if output_str.contains("RUNNING") {
                            return true;
                        }
                    }
                }
                false
            }
        }
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        let output = Command::new("systemctl")
            .args(&["is-active", "postgresql"])
            .output();
        
        match output {
            Ok(output) => output.status.success(),
            Err(_) => {
                // Try alternative methods for non-systemd systems
                let output = Command::new("service")
                    .args(&["postgresql", "status"])
                    .output();
                
                match output {
                    Ok(output) => output.status.success(),
                    Err(_) => false
                }
            }
        }
    }
}

// Function to start PostgreSQL service
fn start_postgres_service() -> Result<(), String> {
    println!("Attempting to start PostgreSQL service...");
    
    #[cfg(target_os = "windows")]
    {
        let service_names = [
            "postgresql-x64-16",
            "postgresql-x64-15", 
            "postgresql-x64-14",
            "postgresql-x64-13",
            "PostgreSQL",
            "postgres"
        ];
        
        for service_name in &service_names {
            let output = Command::new("net")
                .args(&["start", service_name])
                .output();
            
            match output {
                Ok(output) => {
                    if output.status.success() {
                        println!("PostgreSQL service '{}' started successfully!", service_name);
                        POSTGRES_STARTED_BY_APP.store(true, Ordering::Relaxed);
                        return Ok(());
                    }
                }
                Err(_) => continue,
            }
        }
        
        return Err("Failed to start PostgreSQL service. Please ensure PostgreSQL is installed and the service name is correct.".to_string());
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        let output = Command::new("sudo")
            .args(&["systemctl", "start", "postgresql"])
            .output();
        
        match output {
            Ok(output) => {
                if output.status.success() {
                    println!("PostgreSQL service started successfully!");
                    POSTGRES_STARTED_BY_APP.store(true, Ordering::Relaxed);
                    Ok(())
                } else {
                    Err("Failed to start PostgreSQL service".to_string())
                }
            }
            Err(e) => Err(format!("Failed to start PostgreSQL service: {}", e))
        }
    }
}

// Function to stop PostgreSQL service (only if we started it)
fn stop_postgres_service() -> Result<(), String> {
    if !POSTGRES_STARTED_BY_APP.load(Ordering::Relaxed) {
        println!("PostgreSQL was not started by this application, leaving it running.");
        return Ok(());
    }
    
    println!("Stopping PostgreSQL service (started by this application)...");
    
    #[cfg(target_os = "windows")]
    {
        let service_names = [
            "postgresql-x64-16",
            "postgresql-x64-15",
            "postgresql-x64-14", 
            "postgresql-x64-13",
            "PostgreSQL",
            "postgres"
        ];
        
        for service_name in &service_names {
            let output = Command::new("net")
                .args(&["stop", service_name])
                .output();
            
            match output {
                Ok(output) => {
                    if output.status.success() {
                        println!("PostgreSQL service '{}' stopped successfully!", service_name);
                        return Ok(());
                    }
                }
                Err(_) => continue,
            }
        }
        
        return Err("Failed to stop PostgreSQL service".to_string());
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        let output = Command::new("sudo")
            .args(&["systemctl", "stop", "postgresql"])
            .output();
        
        match output {
            Ok(output) => {
                if output.status.success() {
                    println!("PostgreSQL service stopped successfully!");
                    Ok(())
                } else {
                    Err("Failed to stop PostgreSQL service".to_string())
                }
            }
            Err(e) => Err(format!("Failed to stop PostgreSQL service: {}", e))
        }
    }
}

// Function to ensure PostgreSQL is running (start if needed)
async fn ensure_postgres_running() -> Result<(), String> {
    if is_postgres_running() {
        println!("PostgreSQL is already running.");
        return Ok(());
    }
    
    println!("PostgreSQL is not running. Starting it now...");
    start_postgres_service()?;
    
    // Wait a bit for the service to fully start
    tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
    
    // Verify it's actually running
    if is_postgres_running() {
        println!("PostgreSQL started successfully and is now running.");
        Ok(())
    } else {
        Err("PostgreSQL service was started but is not responding. Please check the service manually.".to_string())
    }
}

// Main function
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
            delete_employee, 
            update_employee, 
            get_project_names, 
            get_projects, 
            add_project_to_the_database, 
            delete_project_from_database, 
            add_buyer_to_database, 
            get_buyers_by_project, 
            delete_buyer_from_database, 
            edit_buyer_in_database, 
            update_buyer_payments, 
            migrate_buyers_table, 
            get_project_bloc_count, 
            get_dashboard_stats,
            show_main_window,
            retry_initialization,
            get_project_info,
            add_project_info,
            update_project_info,
            delete_project_info
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();
            
            // Start initialization in background
            tauri::async_runtime::spawn(async move {
                if let Err(e) = initialize_with_progress(app_handle).await {
                    eprintln!("Initialization failed: {}", e);
                }
            });
            
            // Setup panic handler as backup
            std::panic::set_hook(Box::new(|_| {
                if let Err(e) = stop_postgres_service() {
                    eprintln!("Failed to stop PostgreSQL service on panic: {}", e);
                }
            }));
            Ok(())
        })
        .on_window_event(|_window, event| match event {
            tauri::WindowEvent::CloseRequested { .. } => {
                println!("Application window is closing...");
                if let Err(e) = stop_postgres_service() {
                    eprintln!("Failed to stop PostgreSQL service on window close: {}", e);
                } else {
                    println!("PostgreSQL service management completed.");
                }
            }
            _ => {}        })
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

#[tauri::command]
async fn retry_initialization(app: AppHandle) -> Result<(), String> {
    // Restart the initialization process
    initialize_with_progress(app).await
}

// Function to emit loading progress
fn emit_loading_progress(app: &AppHandle, step: i32, message: &str, progress: i32) {
    if let Err(e) = app.emit_to("loading", "loading-progress", serde_json::json!({
        "step": step,
        "message": message,
        "progress": progress
    })) {
        eprintln!("Failed to emit loading progress: {}", e);
    }
}

// Function to emit loading completion
fn emit_loading_complete(app: &AppHandle) {
    if let Err(e) = app.emit_to("loading", "loading-complete", ()) {
        eprintln!("Failed to emit loading complete: {}", e);
    }
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
    // Step 1: Initialize application
    emit_loading_progress(&app, 0, "Initializing application...", 15);
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    
    // Step 2: Start PostgreSQL
    emit_loading_progress(&app, 1, "Starting database services...", 35);
    match ensure_postgres_running().await {
        Ok(()) => {
            emit_loading_progress(&app, 1, "Database services started successfully", 40);
        }
        Err(e) => {
            emit_loading_progress(&app, 1, &format!("Database services warning: {}", e), 40);
        }
    }
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    
    // Step 3: Connect to database
    emit_loading_progress(&app, 2, "Connecting to database...", 60);
    
    // Get database URL
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:test@localhost:5432/managist_db".to_string());
    
    // Try to ensure database exists
    if let Ok((base_url, db_name)) = parse_database_url(&database_url) {
        ensure_database_exists(&base_url, &db_name).await?;
    }
    
    // Connect to database
    let pool = PgPool::connect(&database_url).await
        .map_err(|e| {
            emit_loading_error(&app, &format!("Database connection failed: {}", e));
            e.to_string()
        })?;
    
    emit_loading_progress(&app, 2, "Database connected successfully", 65);
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    
    // Step 4: Setup tables
    emit_loading_progress(&app, 3, "Setting up database tables...", 80);
    
    // Create tables (existing code)
    setup_database_tables(&pool).await?;
    
    emit_loading_progress(&app, 3, "Database tables ready", 85);
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    
    // Step 5: Finalize
    emit_loading_progress(&app, 4, "Loading user interface...", 100);
    tokio::time::sleep(tokio::time::Duration::from_millis(800)).await;
    
    // Store pool in app state
    app.manage(pool);
    
    // Emit completion
    emit_loading_complete(&app);
    
    Ok(())
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
    .map_err(|e| e.to_string())?;    // Employees table
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS employees (
            id SERIAL PRIMARY KEY,
            nom_et_prenom VARCHAR(255) NOT NULL,
            prix_jour NUMERIC(10, 2),
            prix_hour NUMERIC(10, 2),
            nombre_des_jours INTEGER,
            traveaux_attache NUMERIC(10, 2),
            salaire NUMERIC(10, 2),
            acompte NUMERIC(10, 2),
            net_a_payer NUMERIC(10, 2),
            observation TEXT
        )"
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;// Projects table
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
    .map_err(|e| e.to_string())?;

    // Buyers table
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS buyers (
            id SERIAL PRIMARY KEY,
            project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
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
            is_sold BOOLEAN DEFAULT FALSE
        )"
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    // Project info table (apartment types and prices)
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS project_info (
            id SERIAL PRIMARY KEY,
            project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            type_of_appartement TEXT NOT NULL,
            surface NUMERIC(10, 2) NOT NULL,
            price NUMERIC(15, 2) NOT NULL
        )"
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    // Run migrations
    migrate_buyers_table_internal(pool).await?;
    
    // Create default admin user
    create_default_admin_user(pool).await?;
    
    Ok(())
}