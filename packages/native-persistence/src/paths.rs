use crate::{err, io_error, Result};
use std::{
    fs::{File, OpenOptions},
    path::{Component, Path, PathBuf},
};
#[cfg(windows)]
use std::{
    os::windows::fs::{MetadataExt, OpenOptionsExt},
    os::windows::io::AsRawHandle,
};

pub fn valid_folder_name(name: &str) -> Result<()> {
    let base = name.split('.').next().unwrap_or("").to_uppercase();
    let reserved = [
        "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
        "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
    ];
    if name.is_empty()
        || name.encode_utf16().count() > 80
        || name.trim() != name
        || name.ends_with('.')
        || name.contains(['/', '\\', ':', '*', '?', '"', '<', '>', '|'])
        || name.chars().any(|c| c.is_control())
        || [".", ".."].contains(&name)
        || reserved.contains(&base.as_str())
    {
        return Err(err("invalid_name", "Use um nome de pasta de até 80 caracteres, sem caminhos, pontos finais ou nomes reservados do Windows."));
    }
    Ok(())
}

pub struct AuthorizedDirectory {
    pub path: PathBuf,
    _pins: Vec<File>,
}

impl AuthorizedDirectory {
    pub fn authorize(path: &Path) -> Result<Self> {
        if !cfg!(windows) {
            return Err(err(
                "unsupported",
                "A persistência nativa desta fase requer Windows.",
            ));
        }
        if !path.is_absolute()
            || path
                .components()
                .any(|c| matches!(c, Component::ParentDir | Component::CurDir))
            || path
                .to_string_lossy()
                .split(['\\', '/'])
                .any(|c| c == ".." || c == ".")
        {
            return Err(err(
                "unsafe_path",
                "Selecione um caminho absoluto, sem traversal ou componentes relativos.",
            ));
        }
        #[cfg(windows)]
        {
            use std::path::Prefix;
            if !matches!(path.components().next(), Some(Component::Prefix(p)) if matches!(p.kind(), Prefix::Disk(_) | Prefix::VerbatimDisk(_)))
            {
                return Err(err("unsafe_path", "Selecione uma unidade local do Windows. Rede, UNC e caminhos de dispositivo não são suportados."));
            }
            let drive = match path.components().next() {
                Some(Component::Prefix(p)) => match p.kind() {
                    Prefix::Disk(d) | Prefix::VerbatimDisk(d) => d,
                    _ => unreachable!(),
                },
                _ => unreachable!(),
            };
            let root = [drive as u16, b':' as u16, b'\\' as u16, 0];
            let drive_type =
                unsafe { windows_sys::Win32::Storage::FileSystem::GetDriveTypeW(root.as_ptr()) };
            if !matches!(drive_type, 2 | 3 | 6) {
                return Err(err("unsafe_path", "Unidades de rede, desconhecidas ou indisponíveis não são suportadas. Selecione uma unidade local."));
            }
        }
        let mut current = PathBuf::new();
        let mut pins = vec![];
        for component in path.components() {
            current.push(component.as_os_str());
            if matches!(component, Component::Prefix(_)) {
                continue;
            }
            let mut options = OpenOptions::new();
            options.read(true);
            #[cfg(windows)]
            options
                .access_mode(0x80)
                .share_mode(3)
                .custom_flags(0x02000000 | 0x00200000);
            let file = options.open(&current).map_err(io_error)?;
            check_file(&file, true)?;
            pins.push(file);
        }
        let canonical = std::fs::canonicalize(path).map_err(io_error)?;
        Ok(Self {
            path: canonical,
            _pins: pins,
        })
    }
    pub fn file(&self, name: &str) -> Result<PathBuf> {
        // All callers use fixed names or UUID-based transaction names, never model paths.
        if name.contains(['/', '\\', ':']) || name == "." || name == ".." || name.is_empty() {
            return Err(err(
                "unsafe_path",
                "Nome de arquivo fora do workspace autorizado.",
            ));
        }
        Ok(self.path.join(name))
    }
    pub fn lock(&self) -> Result<File> {
        let path = self.file(".forge.lock")?;
        let mut options = OpenOptions::new();
        options.read(true).write(true).create(true).truncate(false);
        #[cfg(windows)]
        options.share_mode(0).custom_flags(0x00200000);
        let file = options.open(path).map_err(io_error)?;
        check_file(&file, false)?;
        Ok(file)
    }
    pub fn read(&self, name: &str) -> Result<Option<Vec<u8>>> {
        use std::io::Read;
        let mut options = OpenOptions::new();
        options.read(true);
        #[cfg(windows)]
        options.share_mode(1).custom_flags(0x00200000);
        let file = match options.open(self.file(name)?) {
            Ok(f) => f,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(e) => return Err(io_error(e)),
        };
        check_file(&file, false)?;
        if file.metadata().map_err(io_error)?.len() > crate::MAX_BYTES as u64 {
            return Err(err("too_large", "O projeto excede o limite de 2 MB."));
        }
        let mut data = vec![];
        file.take(crate::MAX_BYTES as u64 + 1)
            .read_to_end(&mut data)
            .map_err(io_error)?;
        if data.len() > crate::MAX_BYTES {
            return Err(err("too_large", "O projeto excede o limite de 2 MB."));
        }
        Ok(Some(data))
    }
    pub fn create_temp(&self, name: &str) -> Result<File> {
        let mut options = OpenOptions::new();
        options.write(true).read(true).create_new(true);
        #[cfg(windows)]
        options.share_mode(0).custom_flags(0x00200000);
        let file = options.open(self.file(name)?).map_err(io_error)?;
        check_file(&file, false)?;
        Ok(file)
    }
    pub fn ensure_plain_or_missing(&self, name: &str) -> Result<()> {
        let path = self.file(name)?;
        let metadata = match std::fs::symlink_metadata(&path) {
            Ok(m) => m,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(()),
            Err(e) => return Err(io_error(e)),
        };
        if metadata.permissions().readonly() {
            return Err(err(
                "readonly",
                "O arquivo está somente leitura. Salve uma cópia em outra pasta.",
            ));
        }
        self.read(name)?;
        Ok(())
    }
}

fn check_file(file: &File, directory: bool) -> Result<()> {
    let metadata = file.metadata().map_err(io_error)?;
    if metadata.is_dir() != directory || metadata.file_type().is_symlink() {
        return Err(err(
            "unsafe_path",
            "O caminho não é um arquivo ou diretório regular autorizado.",
        ));
    }
    #[cfg(windows)]
    {
        if metadata.file_attributes() & 0x400 != 0 {
            return Err(err(
                "unsafe_path",
                "Symlinks, junctions e outros reparse points não são permitidos no workspace.",
            ));
        }
        let mut info = std::mem::MaybeUninit::uninit();
        if unsafe {
            windows_sys::Win32::Storage::FileSystem::GetFileInformationByHandle(
                file.as_raw_handle(),
                info.as_mut_ptr(),
            )
        } == 0
        {
            return Err(io_error(std::io::Error::last_os_error()));
        }
        if !directory && unsafe { info.assume_init() }.nNumberOfLinks > 1 {
            return Err(err(
                "unsafe_path",
                "Hard links não são permitidos nos arquivos gerenciados.",
            ));
        }
    }
    Ok(())
}

#[cfg(windows)]
pub fn replace(source: &Path, target: &Path, backup: Option<&Path>) -> Result<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, ReplaceFileW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };
    let wide = |path: &Path| {
        path.as_os_str()
            .encode_wide()
            .chain(Some(0))
            .collect::<Vec<u16>>()
    };
    let s = wide(source);
    let t = wide(target);
    let b = backup.map(wide);
    let ok = unsafe {
        if let Some(b) = b {
            ReplaceFileW(
                t.as_ptr(),
                s.as_ptr(),
                b.as_ptr(),
                0,
                std::ptr::null(),
                std::ptr::null(),
            )
        } else {
            MoveFileExW(
                s.as_ptr(),
                t.as_ptr(),
                MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
            )
        }
    };
    if ok == 0 {
        Err(io_error(std::io::Error::last_os_error()))
    } else {
        Ok(())
    }
}
#[cfg(windows)]
pub fn publish_new(source: &Path, target: &Path) -> Result<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{MoveFileExW, MOVEFILE_WRITE_THROUGH};
    let wide = |p: &Path| {
        p.as_os_str()
            .encode_wide()
            .chain(Some(0))
            .collect::<Vec<u16>>()
    };
    if unsafe {
        MoveFileExW(
            wide(source).as_ptr(),
            wide(target).as_ptr(),
            MOVEFILE_WRITE_THROUGH,
        )
    } == 0
    {
        Err(io_error(std::io::Error::last_os_error()))
    } else {
        Ok(())
    }
}
#[cfg(not(windows))]
pub fn publish_new(source: &Path, target: &Path) -> Result<()> {
    replace(source, target, None)
}
#[cfg(not(windows))]
pub fn replace(_source: &Path, _target: &Path, _backup: Option<&Path>) -> Result<()> {
    Err(err(
        "unsupported",
        "A persistência nativa desta fase requer Windows.",
    ))
}
