mod model;
mod paths;
pub use model::parse as validate_document;
pub use paths::valid_folder_name;
use paths::{publish_new, replace, AuthorizedDirectory};
use serde::Serialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{fs::File, io::Write, path::Path};
use uuid::Uuid;

pub const MAX_BYTES: usize = 2_000_000;
pub const MANIFEST: &str = "project.btrk.json";
pub const BACKUP: &str = "project.btrk.backup.json";
pub type Result<T> = std::result::Result<T, ForgeError>;
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ForgeError {
    pub code: String,
    pub message: String,
    pub committed: bool,
}
impl std::fmt::Display for ForgeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}
impl std::error::Error for ForgeError {}
pub fn err(code: &str, message: &str) -> ForgeError {
    ForgeError {
        code: code.into(),
        message: message.into(),
        committed: false,
    }
}
pub fn io_error(error: std::io::Error) -> ForgeError {
    use std::io::ErrorKind;
    match error.kind() {
        ErrorKind::PermissionDenied => err("permission", "Sem permissão para acessar o projeto. Escolha outra pasta ou verifique as permissões."),
        ErrorKind::NotFound => err("not_found", "O arquivo ou diretório do projeto não foi encontrado."),
        ErrorKind::AlreadyExists => err("exists", "O destino já existe. Escolha outro nome ou outra pasta; nenhum projeto será sobrescrito."),
        _ if matches!(error.raw_os_error(),Some(32|33)) => err("busy", "O projeto está em uso ou bloqueado por outro processo. Feche a outra instância e tente novamente."),
        _ => err("io", &format!("Falha de disco ou acesso ao projeto (código {}). O conteúdo em memória foi preservado.", error.raw_os_error().unwrap_or(0))),
    }
}
fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn fingerprint(bytes: &Option<Vec<u8>>) -> Option<String> {
    bytes.as_ref().map(|b| hash(b))
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Receipt {
    pub session_id: String,
    pub location: String,
    pub document: Value,
    pub revision: Option<String>,
    pub recovery_required: bool,
    pub recovery_available: bool,
    pub recovery_label: Option<String>,
}
pub struct Session {
    token: String,
    dir: AuthorizedDirectory,
    _lock: File,
    document: Value,
    revision: Option<String>,
    recovery_required: bool,
    recovery: Option<(String, String, Value)>,
    #[cfg(test)]
    fault: Option<(&'static str, bool)>,
    #[cfg(test)]
    concurrent_edit: Option<Vec<u8>>,
}
impl Session {
    fn authorized(path: &Path) -> Result<Self> {
        let dir = AuthorizedDirectory::authorize(path)?;
        let lock = dir.lock()?;
        Ok(Self {
            token: Uuid::new_v4().to_string(),
            dir,
            _lock: lock,
            document: Value::Null,
            revision: None,
            recovery_required: false,
            recovery: None,
            #[cfg(test)]
            fault: None,
            #[cfg(test)]
            concurrent_edit: None,
        })
    }
    pub fn create(parent: &Path, folder: &str, document: &Value) -> Result<Self> {
        valid_folder_name(folder)?;
        let bytes = model::encode(document)?;
        let parent_guard = AuthorizedDirectory::authorize(parent)?;
        let root = parent_guard.file(folder)?;
        std::fs::create_dir(&root).map_err(io_error)?;
        let mut session = Self::authorized(&root)?;
        session.document = model::parse(&bytes)?;
        session.write(&bytes, false)?;
        Ok(session)
    }
    pub fn open(file: &Path) -> Result<Self> {
        if file.file_name().and_then(|n| n.to_str()) != Some(MANIFEST) {
            return Err(err("extension", "Selecione o manifesto project.btrk.json. Para JSON legado, use Importar JSON e Salvar como."));
        }
        let parent = file
            .parent()
            .ok_or_else(|| err("unsafe_path", "Localização inválida."))?;
        let mut session = Self::authorized(parent)?;
        session.reload()?;
        Ok(session)
    }
    pub fn receipt(&self) -> Receipt {
        Receipt {
            session_id: self.token.clone(),
            location: self
                .dir
                .path
                .to_string_lossy()
                .strip_prefix("\\\\?\\")
                .unwrap_or(&self.dir.path.to_string_lossy())
                .to_string(),
            document: self.document.clone(),
            revision: self.revision.clone(),
            recovery_required: self.recovery_required,
            recovery_available: self.recovery.is_some(),
            recovery_label: self.recovery.as_ref().map(|r| r.0.clone()),
        }
    }
    pub fn save(&mut self, document: &Value) -> Result<Receipt> {
        if self.recovery_required {
            return Err(err(
                "recovery_required",
                "O manifesto precisa de recuperação. Restaure a cópia válida ou use Salvar como.",
            ));
        }
        let bytes = model::encode(document)?;
        if document["id"] != self.document["id"] {
            return Err(err("identity", "A identidade do projeto não pode ser alterada em um salvamento. Use um novo projeto."));
        }
        self.write(&bytes, false)?;
        Ok(self.receipt())
    }
    pub fn reload(&mut self) -> Result<Receipt> {
        let raw = self.dir.read(MANIFEST)?;
        let parsed = raw.as_ref().map(|b| model::parse(b));
        let mut recovery = self.find_recovery(
            parsed
                .as_ref()
                .and_then(|r| r.as_ref().ok())
                .and_then(|p| p["id"].as_str()),
        )?;
        let (document, required) = match parsed {
            Some(Ok(p)) => (p, false),
            error => {
                // Future schemas are never downgraded by silently offering a backup.
                if let Some(Err(e)) = &error {
                    if e.code == "future_schema" {
                        return Err(e.clone());
                    }
                }
                let Some(candidate) = recovery.as_ref() else {
                    return Err(error.and_then(|r| r.err()).unwrap_or_else(|| {
                        err(
                            "not_found",
                            "Manifesto ausente e nenhuma cópia válida disponível.",
                        )
                    }));
                };
                (candidate.2.clone(), true)
            }
        };
        // A recovery candidate can never change an already-open project's identity.
        if !self.document.is_null() && document["id"] != self.document["id"] {
            return Err(err("identity", "O arquivo foi substituído por outro projeto. Abra-o explicitamente em vez de recarregar."));
        }
        recovery = recovery.filter(|r| r.2["id"] == document["id"]);
        self.document = document;
        self.revision = fingerprint(&raw);
        self.recovery_required = required;
        self.recovery = recovery;
        Ok(self.receipt())
    }
    pub fn restore(&mut self) -> Result<Receipt> {
        self.assert_unchanged()?;
        let (name, expected, document) = self
            .recovery
            .clone()
            .ok_or_else(|| err("no_backup", "Nenhuma cópia válida está disponível."))?;
        let data = self.dir.read(&name)?.ok_or_else(|| {
            err(
                "conflict",
                "A cópia de recuperação foi removida. Recarregue o projeto.",
            )
        })?;
        if hash(&data) != expected {
            return Err(err(
                "conflict",
                "A cópia de recuperação foi alterada externamente. Recarregue o projeto.",
            ));
        }
        model::parse(&data)?;
        let bytes = model::encode(&document)?;
        self.write(&bytes, true)?;
        Ok(self.receipt())
    }
    fn assert_unchanged(&self) -> Result<()> {
        let actual = self.dir.read(MANIFEST)?;
        if fingerprint(&actual) != self.revision {
            return Err(err("conflict","O projeto foi alterado ou removido fora do Studio. Recarregue, salve uma cópia ou cancele; o conteúdo em memória foi preservado."));
        }
        Ok(())
    }
    fn find_recovery(&self, project_id: Option<&str>) -> Result<Option<(String, String, Value)>> {
        let mut names = vec![BACKUP.to_string()];
        let mut transaction_names = vec![];
        for entry in std::fs::read_dir(&self.dir.path)
            .map_err(io_error)?
            .take(1000)
        {
            let entry = entry.map_err(io_error)?;
            let name = entry.file_name().to_string_lossy().to_string();
            if transaction_name(&name) {
                transaction_names.push(name);
            }
        }
        transaction_names.sort(); // Backup first; orphan candidates deterministic, no automatic adoption on disk.
        names.extend(transaction_names.into_iter().take(32));
        for name in names {
            let bytes = match self.dir.read(&name) {
                Ok(Some(b)) => b,
                Ok(None) => continue,
                Err(e) if e.code == "unsafe_path" => return Err(e),
                Err(_) => continue,
            };
            if let Ok(document) = model::parse(&bytes) {
                if project_id.is_none_or(|id| document["id"] == id) {
                    return Ok(Some((name, hash(&bytes), document)));
                }
            }
        }
        Ok(None)
    }
    fn checkpoint(&self, _name: &str, _committed: bool) -> Result<()> {
        #[cfg(test)]
        if let Some((name, _)) = self.fault {
            if name == _name {
                let mut e = err("injected", "Falha controlada de gravação para teste.");
                e.committed = _committed;
                return Err(e);
            }
        }
        Ok(())
    }
    fn write(&mut self, bytes: &[u8], restoring: bool) -> Result<()> {
        self.assert_unchanged()?;
        self.dir.ensure_plain_or_missing(MANIFEST)?;
        self.dir.ensure_plain_or_missing(BACKUP)?;
        let temp = format!(".forge-write-{}.tmp", Uuid::new_v4());
        let old = format!(".forge-old-{}.tmp", Uuid::new_v4());
        let mut switched = false;
        let mut attempted = false;
        let result = (|| {
            let mut file = self.dir.create_temp(&temp)?;
            file.write_all(bytes).map_err(io_error)?;
            self.checkpoint("after_write", false)?;
            file.sync_all().map_err(io_error)?;
            self.checkpoint("after_sync", false)?;
            drop(file);
            model::parse(
                &self
                    .dir
                    .read(&temp)?
                    .ok_or_else(|| err("io", "Arquivo temporário desapareceu."))?,
            )?;
            self.checkpoint("before_replace", false)?;
            self.assert_unchanged()?;
            #[cfg(test)]
            if let Some(external) = self.concurrent_edit.take() {
                std::fs::write(self.dir.file(MANIFEST)?, external).map_err(io_error)?;
            }
            let exists = self.revision.is_some();
            let temp_path = self.dir.file(&temp)?;
            let main_path = self.dir.file(MANIFEST)?;
            let old_path = self.dir.file(&old)?;
            attempted = true;
            if exists {
                replace(&temp_path, &main_path, Some(&old_path))?;
            } else {
                publish_new(&temp_path, &main_path)?;
            }
            switched = true;
            self.checkpoint("after_replace", true)?;
            // Inspect the *actual* replaced bytes too, detecting races with external atomic editors.
            let prior = self.dir.read(&old)?;
            if exists && fingerprint(&prior) != self.revision {
                let mut e=err("conflict","Uma alteração concorrente ocorreu durante a troca atômica. O arquivo substituído foi preservado para recuperação; recarregue antes de continuar.");
                e.committed = true;
                return Err(e);
            }
            let saved = self
                .dir
                .read(MANIFEST)?
                .ok_or_else(|| err("io", "Manifesto ausente após gravação."))?;
            if hash(&saved) != hash(bytes) {
                let mut e=err("conflict","O arquivo foi alterado durante a verificação pós-gravação. Recarregue ou salve uma cópia.");
                e.committed = true;
                return Err(e);
            }
            let document = model::parse(&saved)?;
            self.checkpoint("before_backup", true)?;
            if let Some(previous) = prior {
                if !restoring && model::parse(&previous).is_ok() {
                    replace(&self.dir.file(&old)?, &self.dir.file(BACKUP)?, None)?;
                    // Verify backup bytes, never replacing an intact backup with a corrupted source.
                    let backup = self
                        .dir
                        .read(BACKUP)?
                        .ok_or_else(|| err("io", "Backup ausente após gravação."))?;
                    model::parse(&backup)?;
                    if hash(&backup) != hash(&previous) {
                        return Err(err("io", "Falha na verificação da cópia de segurança."));
                    }
                } else {
                    // Explicit restore preserves displaced bytes, even if corrupted, without overwriting valid backup.
                    let displaced = format!(".forge-displaced-{}.json", Uuid::new_v4());
                    publish_new(&self.dir.file(&old)?, &self.dir.file(&displaced)?)?;
                }
            }
            self.document = document;
            self.revision = Some(hash(&saved));
            self.recovery_required = false;
            self.recovery = self.find_recovery(self.document["id"].as_str())?;
            Ok(())
        })();
        let interrupted = {
            #[cfg(test)]
            {
                self.fault.is_some_and(|(_, crash)| crash)
            }
            #[cfg(not(test))]
            {
                false
            }
        };
        if result.is_err() && !interrupted && !attempted {
            // Only a UUID temporary created by this call; never scan/delete user files or old snapshots.
            let _ = std::fs::remove_file(self.dir.file(&temp)?);
        }
        result.map_err(|mut e: ForgeError| {
            e.committed |= switched;
            if attempted && !switched { e.code="commit_uncertain".into(); e.message.push_str(" A troca de arquivos foi tentada; confira o disco por Recarregar ou salve uma cópia. Temporários de recuperação foram preservados."); }
            e
        })
    }
}
fn transaction_name(name: &str) -> bool {
    [".forge-old-", ".forge-write-"].iter().any(|prefix| {
        name.strip_prefix(prefix)
            .and_then(|n| n.strip_suffix(".tmp"))
            .is_some_and(|id| Uuid::parse_str(id).is_ok())
    })
}

#[cfg(test)]
mod tests;
