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
