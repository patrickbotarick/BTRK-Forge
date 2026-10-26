fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "project_create",
            "project_open",
            "project_save",
            "project_save_as",
            "project_reload",
            "project_restore",
            "project_close",
            "project_exit",
        ]),
    ))
    .expect("Falha ao gerar permissões do Studio")
}
