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
    // let url = "postgres://postgres:test@localhost:5432/database";

    // let connection = sqlx::postgres::PgPool::connect(url)
    //     .await
    //     .map_err(|e| e.to_string())?;

    let rows = sqlx::query("SELECT * FROM employees")
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

        Ok::<PgPool, String>(pool)
    })?;

    tauri::Builder::default()
        .manage(pool)
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![login, signup_proccess, insert_employee, get_all_employees, get_project_names, get_projects, add_project_to_the_database, delete_project_from_database])
        .run(tauri::generate_context!())
        .map_err(|e| e.to_string())?;

    Ok(())
}