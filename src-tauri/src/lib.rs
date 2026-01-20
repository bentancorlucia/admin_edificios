use tauri_plugin_sql::{Migration, MigrationKind};
use tauri::Manager;
use std::fs;

// SQL para inicializar las tablas (incluido en tiempo de compilación)
const INIT_SQL: &str = include_str!("../../prisma/migrations/init.sql");

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // Crear el directorio de datos de la aplicación si no existe
            let app_data_dir = app.path().app_data_dir().expect("No se pudo obtener el directorio de datos de la app");

            if !app_data_dir.exists() {
                fs::create_dir_all(&app_data_dir).expect("No se pudo crear el directorio de datos de la app");
            }

            // Definir migraciones dentro del setup
            let migrations = vec![
                Migration {
                    version: 1,
                    description: "create_initial_tables",
                    sql: INIT_SQL,
                    kind: MigrationKind::Up,
                },
            ];

            // Registrar el plugin SQL después de asegurar que el directorio existe
            app.handle().plugin(
                tauri_plugin_sql::Builder::default()
                    .add_migrations("sqlite:database.db", migrations)
                    .build(),
            )?;

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
