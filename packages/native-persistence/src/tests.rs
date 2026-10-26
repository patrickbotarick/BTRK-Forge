use super::*;
use std::fs;
use tempfile::TempDir;
fn fixture() -> Value {
    model::parse(include_bytes!(
        "../../../tests/fixtures/projects/phase0-v1.json"
    ))
    .unwrap()
}
fn setup() -> (TempDir, Session) {
    let root = tempfile::tempdir().unwrap();
    let s = Session::create(root.path(), "Projeto São José", &fixture()).unwrap();
    (root, s)
}
fn changed(s: &Session, name: &str) -> Value {
    let mut p = s.receipt().document;
    p["name"] = name.into();
    p
}
fn main_path(s: &Session) -> std::path::PathBuf {
    s.dir.path.join(MANIFEST)
}

#[test]
fn validates_shared_legacy_fixtures_and_rejects_invalid_versions() {
    let v0 = model::parse(include_bytes!(
        "../../../tests/fixtures/projects/phase0-v0.json"
    ))
    .unwrap();
    assert_eq!(v0, fixture());
    assert_eq!(
        model::parse(include_bytes!(
            "../../../tests/fixtures/projects/future.json"
        ))
        .unwrap_err()
        .code,
        "future_schema"
    );
    assert_eq!(
        model::parse(include_bytes!(
            "../../../tests/fixtures/projects/invalid-reference.json"
        ))
        .unwrap_err()
        .code,
        "invalid_reference"
    );
    assert_eq!(model::parse(b"{").unwrap_err().code, "invalid_json");
    assert_eq!(
        model::parse(&vec![b' '; MAX_BYTES + 1]).unwrap_err().code,
        "too_large"
    );
}
#[test]
fn creates_saves_reopens_and_preserves_complete_blueprint() {
    let (_root, mut s) = setup();
    let original = fixture();
    assert_eq!(s.receipt().document, original);
    let mut edited = changed(&s, "Editado");
    edited["graph"]["nodes"][0]["position"]["x"] = 812.into();
    s.save(&edited).unwrap();
    let file = main_path(&s);
    drop(s);
    let reopened = Session::open(&file).unwrap();
    assert_eq!(reopened.receipt().document, edited);
    assert_eq!(
        reopened.receipt().document["graph"]["connections"],
        original["graph"]["connections"]
    );
}
#[test]
fn saves_as_copy_without_modifying_source_or_ids() {
    let (root, s) = setup();
    let copied = Session::create(root.path(), "Cópia", &s.receipt().document).unwrap();
    assert_eq!(copied.receipt().document, s.receipt().document);
    assert_ne!(copied.receipt().location, s.receipt().location);
    assert_eq!(
        model::parse(&fs::read(main_path(&s)).unwrap()).unwrap(),
        fixture()
    );
}
#[test]
fn never_overwrites_existing_destination() {
    let (root, _s) = setup();
    let error = Session::create(root.path(), "Projeto São José", &fixture())
        .err()
        .unwrap();
    assert_eq!(error.code, "exists");
}
#[test]
fn missing_malformed_and_future_files_leave_original_bytes_intact() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join(MANIFEST);
    assert_eq!(Session::open(&path).err().unwrap().code, "not_found");
    fs::write(&path, b"corrompido").unwrap();
    assert_eq!(Session::open(&path).err().unwrap().code, "invalid_json");
    assert_eq!(fs::read(&path).unwrap(), b"corrompido");
    let future = include_bytes!("../../../tests/fixtures/projects/future.json");
    fs::write(&path, future).unwrap();
    fs::write(
        dir.path().join(BACKUP),
        serde_json::to_vec(&fixture()).unwrap(),
    )
    .unwrap();
    assert_eq!(Session::open(&path).err().unwrap().code, "future_schema");
    assert_eq!(fs::read(path).unwrap(), future);
}
#[test]
fn detects_external_edits_deletion_and_keeps_memory() {
    let (_root, mut s) = setup();
    let edit = changed(&s, "Na memória");
    let external = serde_json::to_vec(&changed(&s, "Externo")).unwrap();
    fs::write(main_path(&s), &external).unwrap();
    assert_eq!(s.save(&edit).unwrap_err().code, "conflict");
    assert_eq!(fs::read(main_path(&s)).unwrap(), external);
    assert_eq!(s.receipt().document, fixture());
    fs::remove_file(main_path(&s)).unwrap();
    assert_eq!(s.save(&edit).unwrap_err().code, "conflict");
}
#[test]
fn backup_is_previous_valid_version_and_recovery_is_explicit() {
    let (_root, mut s) = setup();
    s.save(&changed(&s, "Versão dois")).unwrap();
    let file = main_path(&s);
    let backup = fs::read(s.dir.path.join(BACKUP)).unwrap();
    assert_eq!(model::parse(&backup).unwrap(), fixture());
    fs::write(&file, b"corrompido").unwrap();
    drop(s);
    let mut recovery = Session::open(&file).unwrap();
    assert!(recovery.receipt().recovery_required);
    assert_eq!(fs::read(&file).unwrap(), b"corrompido");
    assert_eq!(
        recovery.save(&fixture()).unwrap_err().code,
        "recovery_required"
    );
    recovery.restore().unwrap();
    assert_eq!(model::parse(&fs::read(&file).unwrap()).unwrap(), fixture());
    assert_eq!(fs::read(recovery.dir.path.join(BACKUP)).unwrap(), backup);
    assert!(fs::read_dir(&recovery.dir.path).unwrap().any(|e| e
        .unwrap()
        .file_name()
        .to_string_lossy()
        .starts_with(".forge-displaced-")));
}
#[test]
fn restore_detects_changed_backup_and_preserves_main() {
    let (_root, mut s) = setup();
    s.save(&changed(&s, "Dois")).unwrap();
    let bytes = fs::read(main_path(&s)).unwrap();
    fs::write(s.dir.path.join(BACKUP), b"bad").unwrap();
    assert_eq!(s.restore().unwrap_err().code, "conflict");
    assert_eq!(fs::read(main_path(&s)).unwrap(), bytes);
}
#[test]
fn readonly_file_and_permission_failure_are_localized() {
    let (_root, mut s) = setup();
    let path = main_path(&s);
    let mut perms = fs::metadata(&path).unwrap().permissions();
    perms.set_readonly(true);
    fs::set_permissions(&path, perms).unwrap();
    assert_eq!(s.save(&changed(&s, "Dois")).unwrap_err().code, "readonly");
    // Reset only this test-owned fixture so TempDir can clean up.
    #[cfg(windows)]
    {
        let mut perms = fs::metadata(&path).unwrap().permissions();
        perms.set_readonly(false);
        fs::set_permissions(&path, perms).unwrap();
    }
    let error = io_error(std::io::Error::from(std::io::ErrorKind::PermissionDenied));
    assert_eq!(error.code, "permission");
    assert!(error.message.starts_with("Sem permissão"));
}
#[test]
fn denies_unsupported_extensions_names_relative_and_traversal_paths() {
    for name in [
        "..",
        "../escape",
        "a\\b",
        "C:escape",
        "CON",
        "LPT1.txt",
        "NUL",
        "nome.",
        " espaço ",
    ] {
        assert!(valid_folder_name(name).is_err(), "{name}");
    }
    assert!(AuthorizedDirectory::authorize(Path::new("relative")).is_err());
    let (root, s) = setup();
    assert!(AuthorizedDirectory::authorize(
        &root.path().join("Projeto São José/../Projeto São José")
    )
    .is_err());
    assert!(s.dir.file("../other.json").is_err());
    assert_eq!(
        Session::open(&root.path().join("project.exe"))
            .err()
            .unwrap()
            .code,
        "extension"
    );
}
#[test]
fn rejects_invalid_document_before_touching_disk() {
    let (_root, mut s) = setup();
    let bytes = fs::read(main_path(&s)).unwrap();
    let mut p = fixture();
    p["graph"]["connections"][0]["target"] = "missing".into();
    assert_eq!(s.save(&p).unwrap_err().code, "invalid_reference");
    assert_eq!(fs::read(main_path(&s)).unwrap(), bytes);
    let mut p = fixture();
    p["id"] = "another-project".into();
    assert_eq!(s.save(&p).unwrap_err().code, "identity");
}
#[test]
fn injected_failures_preserve_old_or_complete_new_document_and_backup() {
    for stage in [
        "after_write",
        "after_sync",
        "before_replace",
        "after_replace",
        "before_backup",
    ] {
        let (_root, mut s) = setup();
        s.save(&changed(&s, "Dois")).unwrap();
        let before = fs::read(main_path(&s)).unwrap();
        let backup = fs::read(s.dir.path.join(BACKUP)).unwrap();
        s.fault = Some((stage, true));
        let newer = changed(&s, "Três");
        assert_eq!(s.save(&newer).unwrap_err().code, "injected");
        let path = main_path(&s);
        drop(s);
        let reopened = Session::open(&path).unwrap();
        let actual = fs::read(&path).unwrap();
        assert!(
            actual == before || model::parse(&actual).unwrap() == newer,
            "{stage}"
        );
        assert_eq!(fs::read(reopened.dir.path.join(BACKUP)).unwrap(), backup);
        assert!(!reopened.receipt().recovery_required);
    }
}
#[test]
fn recover_missing_manifest_from_interrupted_synchronized_temp() {
    let root = tempfile::tempdir().unwrap();
    let dir = root.path().join("Interrompido");
    fs::create_dir(&dir).unwrap();
    let mut s = Session::authorized(&dir).unwrap();
    s.document = fixture();
    s.fault = Some(("after_sync", true));
    s.write(&model::encode(&fixture()).unwrap(), false)
        .unwrap_err();
    drop(s);
    assert!(!dir.join(MANIFEST).exists());
    let mut recovered = Session::open(&dir.join(MANIFEST)).unwrap();
    assert!(recovered.receipt().recovery_required);
    recovered.restore().unwrap();
    assert_eq!(recovered.receipt().document, fixture());
}
#[test]
fn ordinary_failed_write_cleans_only_its_own_temporary() {
    let (_root, mut s) = setup();
    let personal = s.dir.path.join("personal.tmp");
    fs::write(&personal, b"keep").unwrap();
    s.fault = Some(("after_sync", false));
    s.save(&changed(&s, "Dois")).unwrap_err();
    assert_eq!(fs::read(personal).unwrap(), b"keep");
    assert!(!fs::read_dir(&s.dir.path).unwrap().any(|e| e
        .unwrap()
        .file_name()
        .to_string_lossy()
        .starts_with(".forge-write-")));
}
#[test]
fn future_document_version_never_offers_a_downgrade_from_backup() {
    let (_root, mut s) = setup();
    s.save(&changed(&s, "Dois")).unwrap();
    let mut future = fixture();
    future["metadata"] = serde_json::json!({"documentVersion":2,"createdAt":"2026-10-26T00:00:00Z","updatedAt":"2026-10-26T00:00:00Z","savedBy":"BTRK Forge"});
    let bytes = serde_json::to_vec(&future).unwrap();
    let path = main_path(&s);
    fs::write(&path, &bytes).unwrap();
    drop(s);
    assert_eq!(Session::open(&path).err().unwrap().code, "future_schema");
    assert_eq!(fs::read(path).unwrap(), bytes);
}
#[test]
fn concurrent_edit_inside_commit_window_is_reported_and_displaced_bytes_survive() {
    let (_root, mut s) = setup();
    s.save(&changed(&s, "Dois")).unwrap();
    let intact_backup = fs::read(s.dir.path.join(BACKUP)).unwrap();
    let external = model::encode(&changed(&s, "Edição concorrente")).unwrap();
    s.concurrent_edit = Some(external.clone());
    let error = s.save(&changed(&s, "Na memória")).unwrap_err();
    assert_eq!(error.code, "conflict");
    assert!(error.committed);
    assert_eq!(fs::read(s.dir.path.join(BACKUP)).unwrap(), intact_backup);
    let preserved = fs::read_dir(&s.dir.path)
        .unwrap()
        .filter_map(|e| e.ok())
        .any(|e| {
            e.file_name().to_string_lossy().starts_with(".forge-old-")
                && fs::read(e.path()).ok().as_ref() == Some(&external)
        });
    assert!(preserved);
    assert_eq!(s.receipt().document["name"], "Dois");
}
#[cfg(windows)]
#[test]
fn real_directory_acl_denial_preserves_manifest() {
    use std::os::windows::process::CommandExt;
    struct RestoreAcl(std::path::PathBuf);
    impl Drop for RestoreAcl {
        fn drop(&mut self) {
            let _ = std::process::Command::new("icacls.exe")
                .arg(&self.0)
                .args(["/remove:d", "*S-1-1-0"])
                .creation_flags(0x08000000)
                .output();
        }
    }
    let (_root, mut s) = setup();
    let path = main_path(&s);
    let before = fs::read(&path).unwrap();
    let guard = RestoreAcl(s.dir.path.clone());
    let denied = std::process::Command::new("icacls.exe")
        .arg(&s.dir.path)
        .args(["/deny", "*S-1-1-0:(W)"])
        .creation_flags(0x08000000)
        .output()
        .unwrap();
    assert!(denied.status.success());
    let error = s.save(&changed(&s, "Denied")).unwrap_err();
    drop(guard);
    assert_eq!(error.code, "permission");
    assert_eq!(fs::read(path).unwrap(), before);
}
#[cfg(windows)]
#[test]
fn workspace_locks_reject_second_instance_and_root_rename() {
    let (root, s) = setup();
    assert_eq!(Session::open(&main_path(&s)).err().unwrap().code, "busy");
    assert!(fs::rename(&s.dir.path, root.path().join("moved")).is_err());
}
#[cfg(windows)]
#[test]
fn rejects_real_junction_and_hardlinked_manifest() {
    use std::os::windows::process::CommandExt;
    let root = tempfile::tempdir().unwrap();
    let actual = root.path().join("target");
    let link = root.path().join("junction");
    fs::create_dir(&actual).unwrap();
    // Fixed test operation, paths passed as distinct arguments; never project-supplied executable or shell text.
    let result = std::process::Command::new("cmd.exe")
        .args(["/d", "/c", "mklink", "/J"])
        .arg(&link)
        .arg(&actual)
        .creation_flags(0x08000000)
        .output()
        .unwrap();
    assert!(
        result.status.success(),
        "Junction fixture could not be created"
    );
    assert_eq!(
        AuthorizedDirectory::authorize(&link).err().unwrap().code,
        "unsafe_path"
    );
    fs::remove_dir(&link).unwrap();
    let (projects, s) = setup();
    let other = projects.path().join("other.json");
    fs::hard_link(main_path(&s), &other).unwrap();
    drop(s);
    assert_eq!(
        Session::open(&projects.path().join("Projeto São José").join(MANIFEST))
            .err()
            .unwrap()
            .code,
        "unsafe_path"
    );
}
