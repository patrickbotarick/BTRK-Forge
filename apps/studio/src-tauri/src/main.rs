#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // No filesystem, shell, HTTP or updater plugins. No application IPC commands.
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("Falha ao iniciar BTRK Forge");
}
