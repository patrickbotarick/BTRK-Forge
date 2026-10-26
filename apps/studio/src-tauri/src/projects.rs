use forge_persistence::{err, valid_folder_name, validate_document, ForgeError, Receipt, Session};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};
use tauri::Manager;
type Result<T> = std::result::Result<T, ForgeError>;
#[derive(Default, Clone)]
pub struct Store(Arc<Mutex<HashMap<String, Session>>>);
fn trusted(window: &tauri::WebviewWindow) -> Result<()> {
    if window.label() != "main" {
        return Err(err(
            "denied",
            "Esta janela não tem permissão para gerenciar projetos.",
        ));
    }
    Ok(())
}
async fn work<T: Send + 'static>(
    store: Store,
    f: impl FnOnce(&mut HashMap<String, Session>) -> Result<T> + Send + 'static,
) -> Result<T> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut guard = store.0.lock().map_err(|_| {
            err(
                "internal",
                "Serviço de projetos indisponível. Salve uma cópia e reinicie.",
            )
        })?;
        f(&mut guard)
    })
    .await
    .map_err(|_| {
        err(
            "internal",
            "Não foi possível concluir a operação de projeto.",
        )
    })?
}
fn register(registry: &mut HashMap<String, Session>, session: Session) -> Result<Receipt> {
    if registry.len() >= 8 {
        return Err(err(
            "busy",
            "Feche projetos não utilizados antes de abrir outros.",
        ));
    }
    let receipt = session.receipt();
    registry.insert(receipt.session_id.clone(), session);
    Ok(receipt)
}
fn get<'a>(registry: &'a mut HashMap<String, Session>, id: &str) -> Result<&'a mut Session> {
    registry.get_mut(id).ok_or_else(|| {
        err(
            "unauthorized",
            "A sessão do projeto não está autorizada. Abra a pasta novamente pelo Studio.",
        )
    })
}
#[tauri::command]
pub async fn project_create(
    window: tauri::WebviewWindow,
    store: tauri::State<'_, Store>,
    folder_name: String,
    document_json: String,
) -> Result<Option<Receipt>> {
    trusted(&window)?;
    valid_folder_name(&folder_name)?;
    let document = validate_document(document_json.as_bytes())?;
    let Some(parent) = rfd::AsyncFileDialog::new()
        .set_parent(&window)
        .set_title("Novo projeto — selecione a pasta de destino")
        .pick_folder()
        .await
    else {
        return Ok(None);
    };
    work(store.inner().clone(), move |registry| {
        register(
            registry,
            Session::create(parent.path(), &folder_name, &document)?,
        )
    })
    .await
    .map(Some)
}
#[tauri::command]
pub async fn project_open(
    window: tauri::WebviewWindow,
    store: tauri::State<'_, Store>,
) -> Result<Option<Receipt>> {
    trusted(&window)?;
    let Some(file) = rfd::AsyncFileDialog::new()
        .set_parent(&window)
        .set_title("Abrir projeto — selecione project.btrk.json")
        .add_filter("Manifesto BTRK", &["json"])
        .pick_file()
        .await
    else {
        return Ok(None);
    };
    work(store.inner().clone(), move |registry| {
        register(registry, Session::open(file.path())?)
    })
    .await
    .map(Some)
}
#[tauri::command]
pub async fn project_save(
    window: tauri::WebviewWindow,
    store: tauri::State<'_, Store>,
    session_id: String,
    document_json: String,
) -> Result<Receipt> {
    trusted(&window)?;
    let document = validate_document(document_json.as_bytes())?;
    work(store.inner().clone(), move |registry| {
        get(registry, &session_id)?.save(&document)
    })
    .await
}
#[tauri::command]
pub async fn project_save_as(
    window: tauri::WebviewWindow,
    store: tauri::State<'_, Store>,
    folder_name: String,
    document_json: String,
) -> Result<Option<Receipt>> {
    trusted(&window)?;
    valid_folder_name(&folder_name)?;
    let document = validate_document(document_json.as_bytes())?;
    let Some(parent) = rfd::AsyncFileDialog::new()
        .set_parent(&window)
        .set_title("Salvar como — selecione a pasta de destino")
        .pick_folder()
        .await
    else {
        return Ok(None);
    };
    work(store.inner().clone(), move |registry| {
        register(
            registry,
            Session::create(parent.path(), &folder_name, &document)?,
        )
    })
    .await
    .map(Some)
}
#[tauri::command]
pub async fn project_reload(
    window: tauri::WebviewWindow,
    store: tauri::State<'_, Store>,
    session_id: String,
) -> Result<Receipt> {
    trusted(&window)?;
    work(store.inner().clone(), move |registry| {
        get(registry, &session_id)?.reload()
    })
    .await
}
#[tauri::command]
pub async fn project_restore(
    window: tauri::WebviewWindow,
    store: tauri::State<'_, Store>,
    session_id: String,
) -> Result<Receipt> {
    trusted(&window)?;
    work(store.inner().clone(), move |registry| {
        get(registry, &session_id)?.restore()
    })
    .await
}
#[tauri::command]
pub async fn project_close(
    window: tauri::WebviewWindow,
    store: tauri::State<'_, Store>,
    session_id: String,
) -> Result<()> {
    trusted(&window)?;
    work(store.inner().clone(), move |registry| {
        get(registry, &session_id)?;
        registry.remove(&session_id);
        Ok(())
    })
    .await
}
#[tauri::command]
pub fn project_exit(window: tauri::WebviewWindow) -> Result<()> {
    trusted(&window)?;
    window.app_handle().exit(0);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn invalid_session_never_grants_access() {
        assert_eq!(
            get(&mut HashMap::new(), "../../personal")
                .err()
                .unwrap()
                .code,
            "unauthorized"
        );
    }
}
