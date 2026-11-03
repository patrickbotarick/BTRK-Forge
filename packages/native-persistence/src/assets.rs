use crate::{err, hash, Result, Session};

const MAX_ASSET_BYTES: u64 = 8 * 1024 * 1024;

impl Session {
    /// Returns an opaque, integrity-checked snapshot. This is not an image decoder.
    pub fn resolve_asset(&self, resource_id: &str, revision: &str) -> Result<Vec<u8>> {
        if self.recovery_required || self.revision.as_deref() != Some(revision) {
            return Err(err(
                "asset_revision",
                "A revisão solicitada não está disponível.",
            ));
        }
        let resource = self.document["resources"]
            .as_array()
            .into_iter()
            .flatten()
            .find(|entry| entry["id"].as_str() == Some(resource_id))
            .ok_or_else(|| err("asset_reference", "Recurso não declarado nesta sessão."))?;
        let digest = resource["sha256"].as_str().unwrap_or("");
        if digest.len() != 64
            || !digest
                .bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
        {
            return Err(err("asset_integrity", "Hash de recurso inválido."));
        }
        let length = resource["byteLength"].as_f64().unwrap_or(0.0) as u64;
        if !(1..=MAX_ASSET_BYTES).contains(&length) {
            return Err(err(
                "asset_integrity",
                "Tamanho declarado do recurso inválido.",
            ));
        }
        self.assert_unchanged()?;
        let data = read_object(self, &format!("{digest}.png"), length)?;
        if data.len() as u64 != length
            || hash(&data) != digest
            || !matches_png_header(&data, resource)
        {
            return Err(err(
                "asset_integrity",
                "Bytes do recurso divergem do manifesto.",
            ));
        }
        self.assert_unchanged()?;
        Ok(data)
    }
}

fn matches_png_header(data: &[u8], resource: &serde_json::Value) -> bool {
    data.len() >= 33
        && data[..8] == [137, 80, 78, 71, 13, 10, 26, 10]
        && data[8..16] == [0, 0, 0, 13, b'I', b'H', b'D', b'R']
        && f64::from(u32::from_be_bytes(data[16..20].try_into().unwrap()))
            == resource["width"].as_f64().unwrap_or(0.0)
        && f64::from(u32::from_be_bytes(data[20..24].try_into().unwrap()))
            == resource["height"].as_f64().unwrap_or(0.0)
}

#[cfg(not(windows))]
fn read_object(_: &Session, _: &str, _: u64) -> Result<Vec<u8>> {
    Err(err(
        "unsupported",
        "A resolução nativa de assets requer Windows.",
    ))
}

#[cfg(windows)]
fn read_object(session: &Session, name: &str, length: u64) -> Result<Vec<u8>> {
    use crate::{io_error, paths::check_file};
    use std::io::Read;
    let root = session.dir.root_handle();
    let assets = windows::open_child(root, "assets", true)?;
    let objects = windows::open_child(&assets, "sha256", true)?;
    let mut object = windows::open_child(&objects, name, false)?;
    if object.metadata().map_err(io_error)?.len() != length {
        return Err(err(
            "asset_integrity",
            "Tamanho do arquivo diverge do manifesto.",
        ));
    }
    let mut data = Vec::with_capacity(length as usize);
    object
        .by_ref()
        .take(length + 1)
        .read_to_end(&mut data)
        .map_err(io_error)?;
    for directory in [root, &assets, &objects] {
        check_file(directory, true)?;
    }
    check_file(&object, false)?;
    Ok(data)
}

#[cfg(windows)]
mod windows {
    use crate::{err, io_error, paths::check_file, Result};
    use std::{
        fs::File,
        os::windows::io::{AsRawHandle, FromRawHandle},
        ptr::null,
    };
    use windows_sys::{
        Wdk::{
            Foundation::OBJECT_ATTRIBUTES,
            Storage::FileSystem::{
                NtCreateFile, FILE_DIRECTORY_FILE, FILE_NON_DIRECTORY_FILE, FILE_OPEN,
                FILE_OPEN_REPARSE_POINT, FILE_SYNCHRONOUS_IO_NONALERT,
            },
        },
        Win32::{
            Foundation::{
                RtlNtStatusToDosError, OBJ_CASE_INSENSITIVE, STATUS_REPARSE_POINT_ENCOUNTERED,
                UNICODE_STRING,
            },
            Storage::FileSystem::{
                FILE_READ_ATTRIBUTES, FILE_READ_DATA, FILE_SHARE_READ, FILE_TRAVERSE, SYNCHRONIZE,
            },
            System::IO::IO_STATUS_BLOCK,
        },
    };

    pub(super) fn open_child(parent: &File, name: &str, directory: bool) -> Result<File> {
        if name.is_empty()
            || name.len() > 68
            || name == "."
            || name == ".."
            || !name.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'.')
        {
            return Err(err("unsafe_path", "Nome de objeto inválido."));
        }
        check_file(parent, true)?;
        let mut utf16: Vec<u16> = name.encode_utf16().collect();
        let length = (utf16.len() * 2) as u16;
        let name = UNICODE_STRING {
            Length: length,
            MaximumLength: length,
            Buffer: utf16.as_mut_ptr(),
        };
        let attributes = OBJECT_ATTRIBUTES {
            Length: std::mem::size_of::<OBJECT_ATTRIBUTES>() as u32,
            RootDirectory: parent.as_raw_handle(),
            ObjectName: &name,
            Attributes: OBJ_CASE_INSENSITIVE,
            SecurityDescriptor: null(),
            SecurityQualityOfService: null(),
        };
        let mut status_block = IO_STATUS_BLOCK::default();
        let mut handle = std::ptr::null_mut();
        let (rights, kind) = if directory {
            (FILE_TRAVERSE, FILE_DIRECTORY_FILE)
        } else {
            (FILE_READ_DATA, FILE_NON_DIRECTORY_FILE)
        };
        // A single name relative to a live directory handle, with final reparsing disabled.
        // The buffers remain alive for this synchronous call.
        let status = unsafe {
            NtCreateFile(
                &mut handle,
                rights | FILE_READ_ATTRIBUTES | SYNCHRONIZE,
                &attributes,
                &mut status_block,
                null(),
                0,
                FILE_SHARE_READ,
                FILE_OPEN,
                kind | FILE_OPEN_REPARSE_POINT | FILE_SYNCHRONOUS_IO_NONALERT,
                null(),
                0,
            )
        };
        if status < 0 {
            if status == STATUS_REPARSE_POINT_ENCOUNTERED {
                return Err(err(
                    "unsafe_path",
                    "Reparse point recusado no armazenamento de assets.",
                ));
            }
            let error =
                std::io::Error::from_raw_os_error(unsafe { RtlNtStatusToDosError(status) } as i32);
            return Err(if error.kind() == std::io::ErrorKind::NotFound {
                err(
                    "asset_missing",
                    "Objeto do recurso indisponível no workspace.",
                )
            } else {
                io_error(error)
            });
        }
        if handle.is_null() {
            return Err(err(
                "unsafe_path",
                "O sistema não retornou um handle de asset válido.",
            ));
        }
        // The successful call transfers ownership of the handle to this File.
        let file = unsafe { File::from_raw_handle(handle) };
        check_file(&file, directory)?;
        Ok(file)
    }
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use crate::MANIFEST;
    use serde_json::json;
    use std::{fs, os::windows::process::CommandExt, path::PathBuf};

    // A fixed 1×1 PNG. Tests provision it directly, outside the production API.
    const PNG: &[u8] = &[
        137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 4,
        0, 0, 0, 181, 28, 12, 2, 0, 0, 0, 11, 73, 68, 65, 84, 120, 218, 99, 100, 248, 15, 0, 1, 5,
        1, 1, 39, 24, 227, 102, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
    ];

    fn setup() -> (tempfile::TempDir, Session, String, PathBuf) {
        let root = tempfile::tempdir().unwrap();
        let mut document = crate::model::parse(include_bytes!(
            "../../../tests/fixtures/projects/phase0-v1.json"
        ))
        .unwrap();
        let digest = hash(PNG);
        document["resources"] = json!([
            {"id":"asset-one","kind":"image","mediaType":"image/png","sha256":digest,
             "byteLength":PNG.len(),"width":1,"height":1},
            {"id":"asset-two","kind":"image","mediaType":"image/png","sha256":digest,
             "byteLength":PNG.len(),"width":1,"height":1}
        ]);
        let session = Session::create(root.path(), "media", &document).unwrap();
        let revision = session.receipt().revision.unwrap();
        let object = session
            .dir
            .path
            .join("assets")
            .join("sha256")
            .join(format!("{digest}.png"));
        (root, session, revision, object)
    }

    #[test]
    fn resolves_only_declared_content_at_the_current_revision() {
        let (_root, mut session, revision, object) = setup();
        for id in ["../outside", "C:\\outside", "undeclared"] {
            assert_eq!(
                session.resolve_asset(id, &revision).unwrap_err().code,
                "asset_reference"
            );
        }
        assert_eq!(
            session
                .resolve_asset("asset-one", "stale")
                .unwrap_err()
                .code,
            "asset_revision"
        );
        assert_eq!(
            session
                .resolve_asset("asset-one", &revision)
                .unwrap_err()
                .code,
            "asset_missing"
        );
        fs::create_dir_all(object.parent().unwrap()).unwrap();
        fs::write(&object, PNG).unwrap();
        assert_eq!(session.resolve_asset("asset-one", &revision).unwrap(), PNG);
        assert_eq!(session.resolve_asset("asset-two", &revision).unwrap(), PNG);
        assert!(Session::save_as(_root.path(), "blocked-copy", &session.document).is_err());
        assert!(!_root.path().join("blocked-copy").exists());
        let mut changed = session.document.clone();
        changed["name"] = "Nova revisão".into();
        let next = session.save(&changed).unwrap().revision.unwrap();
        assert_ne!(next, revision);
        assert_eq!(
            session
                .resolve_asset("asset-one", &revision)
                .unwrap_err()
                .code,
            "asset_revision"
        );
        let manifest = session.dir.path.join(MANIFEST);
        drop(session);
        let session = Session::open(&manifest).unwrap();
        assert_eq!(session.resolve_asset("asset-one", &next).unwrap(), PNG);
        let mut altered = PNG.to_vec();
        altered[40] ^= 1;
        fs::write(&object, altered).unwrap();
        assert_eq!(
            session.resolve_asset("asset-one", &next).unwrap_err().code,
            "asset_integrity"
        );
        fs::write(&object, &PNG[..PNG.len() - 1]).unwrap();
        assert_eq!(
            session.resolve_asset("asset-one", &next).unwrap_err().code,
            "asset_integrity"
        );
        fs::write(&object, PNG).unwrap();
        fs::write(manifest, b"{}").unwrap();
        assert_eq!(
            session.resolve_asset("asset-one", &next).unwrap_err().code,
            "conflict"
        );
    }

    #[test]
    fn refuses_external_junctions_and_hard_links_even_with_matching_bytes() {
        let (root, session, revision, object) = setup();
        let outside = root.path().join("outside");
        fs::create_dir_all(outside.join("sha256")).unwrap();
        let original = outside.join("sha256").join(object.file_name().unwrap());
        fs::write(&original, PNG).unwrap();
        let assets = session.dir.path.join("assets");
        let result = std::process::Command::new("cmd.exe")
            .args(["/d", "/c", "mklink", "/J"])
            .arg(&assets)
            .arg(&outside)
            .creation_flags(0x08000000)
            .output()
            .unwrap();
        assert!(
            result.status.success(),
            "Junction fixture could not be created"
        );
        assert_eq!(
            session
                .resolve_asset("asset-one", &revision)
                .unwrap_err()
                .code,
            "unsafe_path"
        );
        fs::remove_dir(&assets).unwrap();
        fs::create_dir_all(object.parent().unwrap()).unwrap();
        fs::hard_link(&original, &object).unwrap();
        assert_eq!(
            session
                .resolve_asset("asset-one", &revision)
                .unwrap_err()
                .code,
            "unsafe_path"
        );
        assert_eq!(fs::read(original).unwrap(), PNG);
    }

    #[test]
    fn live_handles_refuse_ancestor_rename_and_file_replacement() {
        let (_root, session, revision, object) = setup();
        fs::create_dir_all(object.parent().unwrap()).unwrap();
        fs::write(&object, PNG).unwrap();
        let assets = windows::open_child(session.dir.root_handle(), "assets", true).unwrap();
        let objects = windows::open_child(&assets, "sha256", true).unwrap();
        let file = windows::open_child(
            &objects,
            object.file_name().unwrap().to_str().unwrap(),
            false,
        )
        .unwrap();
        assert!(fs::rename(
            session.dir.path.join("assets"),
            session.dir.path.join("moved")
        )
        .is_err());
        assert!(fs::rename(&object, object.with_extension("moved")).is_err());
        assert!(fs::write(&object, b"replacement").is_err());
        drop((file, objects, assets));
        assert_eq!(session.resolve_asset("asset-one", &revision).unwrap(), PNG);
    }
}
