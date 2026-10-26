#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod projects;
use tauri::Emitter;

fn main() {
    tauri::Builder::default()
        .manage(projects::Store::default())
        .invoke_handler(tauri::generate_handler![
            projects::project_create,
            projects::project_open,
            projects::project_save,
            projects::project_save_as,
            projects::project_reload,
            projects::project_restore,
            projects::project_close,
            projects::project_exit,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.emit("forge-close-requested", ());
            }
        })
        .run(tauri::generate_context!())
        .expect("Falha ao iniciar BTRK Forge");
}
