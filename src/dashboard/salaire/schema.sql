CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    nom_et_prenom TEXT NOT NULL,
    prix_jour NUMERIC(10, 2) NOT NULL,
    prix_hour NUMERIC(10, 2) NOT NULL,
    nombre_des_jours INTEGER NOT NULL,
    traveaux_attache NUMERIC(10, 2) NOT NULL,
    salaire NUMERIC(10, 2) NOT NULL,
    acompte NUMERIC(10, 2) NOT NULL,
    net_a_payer NUMERIC(10, 2) NOT NULL,
    observation TEXT
);


CREATE TABLE IF NOT EXISTS buyers (
            id SERIAL PRIMARY KEY,
            project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            niveau INTEGER,
            logt_num INTEGER,
            nom TEXT,
            prenom TEXT,
            type_logt TEXT,
            surface DOUBLE PRECISION,
            date DATE,
            prix_totale NUMERIC,
            remise NUMERIC,
            payments JSONB
        )