use tauri::{AppHandle, Emitter, State};
use serde::{Serialize, Deserialize};
use sqlx::Row;
use sqlx::PgPool;
use rust_decimal::Decimal;
use chrono::NaiveDate;

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
    nda_vendus: i32
}

// Structure to represent a buyer
#[derive(Serialize, Deserialize, Debug)]
pub struct Buyer {
    id: i32,
    project_id: i32,
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
    for row in rows {
        projects.push(Project {
            id: row.try_get("id").map_err(|e| e.to_string())?,
            project_name: row.try_get("project_name").map_err(|e| e.to_string())?,
            project_location: row.try_get("project_location").map_err(|e| e.to_string())?,
            project_start_date: row.try_get("project_start_date").map_err(|e| e.to_string())?,
            project_end_date: row.try_get("project_end_date").map_err(|e| e.to_string())?,
            nombre_des_bloc: row.try_get("nombre_des_bloc").map_err(|e| e.to_string())?,
            nombre_des_etages: row.try_get("nombre_des_etages").map_err(|e| e.to_string())?,
            nombre_des_appartement: row.try_get("nombre_des_appartement").map_err(|e| e.to_string())?,
            nda_dans_chaque_etage: row.try_get("nda_dans_chaque_etage").map_err(|e| e.to_string())?,
            nda_vendus: row.try_get("nda_vendus").map_err(|e| e.to_string())?
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
        .map_err(|e| format!("Invalid end date format: {}", e))?;

    let query = "INSERT INTO projects (project_name, project_location, project_start_date, project_end_date, nombre_des_bloc, nombre_des_etages, nombre_des_appartement, nda_dans_chaque_etage, nda_vendus) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)";

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
            .filter_map(|v| v.as_f64())
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

    let query = "INSERT INTO buyers (project_id, niveau, logt_num, nom, prenom, type_logt, surface, date, prix_totale, remise, payments, payment_status, total_paid, is_sold) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)";

    sqlx::query(query)
        .bind(&buyer.project_id)
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

    let query = "UPDATE buyers SET project_id = $1, niveau = $2, logt_num = $3, nom = $4, prenom = $5, type_logt = $6, surface = $7, date = $8, prix_totale = $9, remise = $10, payments = $11, payment_status = $12, total_paid = $13, is_sold = $14 WHERE id = $15";

    sqlx::query(query)
        .bind(&buyer.project_id)
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

// Main function
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> Result<(), String> {
    let pool = tauri::async_runtime::block_on(async {
        let pool = PgPool::connect("postgres://postgres:test@localhost:5432/database").await
            .map_err(|e| e.to_string())?;
        
        // Create users table if it doesn't exist
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                admin VARCHAR(10) DEFAULT '0'
            )"
        )
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

        // Create employees table if it doesn't exist
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS employees (
                id SERIAL PRIMARY KEY,
                nom_et_prenom VARCHAR(255) NOT NULL,
                prix_jour NUMERIC(10, 2) NOT NULL,
                prix_hour NUMERIC(10, 2) NOT NULL,
                nombre_des_jours INTEGER NOT NULL,
                traveaux_attache NUMERIC(10, 2) DEFAULT 0,
                salaire NUMERIC(10, 2) NOT NULL,
                acompte NUMERIC(10, 2) DEFAULT 0,
                net_a_payer NUMERIC(10, 2) NOT NULL,
                observation TEXT
            )"
        )
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

        // Create projects table if it doesn't exist
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS projects (
                id SERIAL PRIMARY KEY,
                project_name VARCHAR(255) NOT NULL,
                project_location VARCHAR(255) NOT NULL,
                project_start_date DATE NOT NULL,
                project_end_date DATE NOT NULL,
                nombre_des_bloc INTEGER NOT NULL,
                nombre_des_etages INTEGER NOT NULL,
                nombre_des_appartement INTEGER NOT NULL,
                nda_dans_chaque_etage INTEGER NOT NULL,
                nda_vendus INTEGER NOT NULL
            )"
        )
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

        // Create buyers table if it doesn't exist
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
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

        // Run migration to ensure table structure is up to date
        // This handles converting logt_num from integer to varchar and adding new columns
        migrate_buyers_table_internal(&pool).await?;

        Ok::<PgPool, String>(pool)
    })?;

    tauri::Builder::default()
        .manage(pool)
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![login, signup_proccess, update_user_password, get_employee_by_name, insert_employee, get_all_employees, delete_employee, update_employee, get_project_names, get_projects, add_project_to_the_database, delete_project_from_database, add_buyer_to_database, get_buyers_by_project, delete_buyer_from_database, edit_buyer_in_database, update_buyer_payments, migrate_buyers_table])
        .run(tauri::generate_context!())
        .map_err(|e| e.to_string())?;

    Ok(())
}