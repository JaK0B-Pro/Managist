use actix_web::{web, App, HttpServer, Responder, HttpResponse};
use serde::{Serialize, Deserialize};
use std::fs;

// Structure pour représenter une transaction
#[derive(Serialize, Deserialize)]
struct Transaction {
    date: String,
    description: String,
    montant: String,
    statut: String,
}

// Fonction pour servir le fichier HTML
async fn index() -> impl Responder {
    let html = fs::read_to_string("index.html").unwrap();
    HttpResponse::Ok().content_type("text/html").body(html)
}

// Fonction pour récupérer les transactions en JSON
async fn transactions() -> impl Responder {
    let transactions = vec![
        Transaction { date: "07/03/2025".to_string(), description: "Supermarché".to_string(), montant: "-45.60 €".to_string(), statut: "Complété".to_string() },
        Transaction { date: "06/03/2025".to_string(), description: "Virement reçu".to_string(), montant: "+250.00 €".to_string(), statut: "En attente This is from rust".to_string() },
        Transaction { date: "05/03/2025".to_string(), description: "Abonnement".to_string(), montant: "-13.99 €".to_string(), statut: "Complété".to_string() },
    ];

    HttpResponse::Ok().json(transactions)
}

// Configuration du serveur Actix-Web
#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| {
        App::new()
            .route("/", web::get().to(index))  // Page principale
            .route("/transactions", web::get().to(transactions))  // API JSON
    })
    .bind("127.0.0.1:8080")?
    .run()
    .await
}
