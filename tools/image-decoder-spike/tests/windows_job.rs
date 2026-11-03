#![cfg(windows)]

use forge_image_decoder_spike::{normalize, MAX_BYTES};
use sha2::{Digest, Sha256};
use std::io::{self, Read, Write};
use std::os::windows::io::AsRawHandle;
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
use windows_sys::Win32::System::JobObjects::*;

const MEMORY: usize = 192 * 1024 * 1024;
const DECODER: &str = env!("CARGO_BIN_EXE_forge-image-decoder-spike");
const PNG: &[u8] = include_bytes!("fixtures/static.png");
static SLOT: Mutex<()> = Mutex::new(());

#[derive(Debug)]
enum Failure {
    Busy,
    Setup(io::Error),
    Timeout,
    Worker(i32),
    Protocol,
}

impl From<io::Error> for Failure {
    fn from(error: io::Error) -> Self {
        Self::Setup(error)
    }
}

struct Job(HANDLE);

impl Job {
    fn new(memory: usize) -> io::Result<Self> {
        let handle = unsafe { CreateJobObjectW(std::ptr::null(), std::ptr::null()) };
        if handle.is_null() {
            return Err(io::Error::last_os_error());
        }
        let job = Self(handle);
        let mut limits = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
        limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
            | JOB_OBJECT_LIMIT_JOB_MEMORY
            | JOB_OBJECT_LIMIT_ACTIVE_PROCESS;
        limits.BasicLimitInformation.ActiveProcessLimit = 1;
        limits.JobMemoryLimit = memory;
        let result = unsafe {
            SetInformationJobObject(
                job.0,
                JobObjectExtendedLimitInformation,
                (&limits as *const JOBOBJECT_EXTENDED_LIMIT_INFORMATION).cast(),
                std::mem::size_of_val(&limits) as u32,
            )
        };
        if result == 0 {
            return Err(io::Error::last_os_error());
        }
        Ok(job)
    }

    fn peak(&self) -> io::Result<usize> {
        let mut info = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
        let result = unsafe {
            QueryInformationJobObject(
                self.0,
                JobObjectExtendedLimitInformation,
                (&mut info as *mut JOBOBJECT_EXTENDED_LIMIT_INFORMATION).cast(),
                std::mem::size_of_val(&info) as u32,
                std::ptr::null_mut(),
            )
        };
        if result == 0 {
            return Err(io::Error::last_os_error());
        }
        Ok(info.PeakJobMemoryUsed)
    }
}

impl Drop for Job {
    fn drop(&mut self) {
        unsafe { CloseHandle(self.0) };
    }
}

// Test fixtures only. The known worker waits for a complete frame and EOF.
// Its startup runs before assignment, so this is not a sandbox for untrusted input.
fn run(frame: Option<Vec<u8>>, deadline: Duration) -> Result<(Vec<u8>, usize), Failure> {
    let _slot = SLOT.try_lock().map_err(|_| Failure::Busy)?;
    if frame
        .as_ref()
        .is_some_and(|bytes| bytes.len() > MAX_BYTES + 4)
    {
        return Err(Failure::Protocol);
    }
    let start = Instant::now();
    let expected = Sha256::digest(include_bytes!(env!(
        "CARGO_BIN_EXE_forge-image-decoder-spike"
    )));
    if Sha256::digest(std::fs::read(DECODER)?) != expected {
        return Err(Failure::Protocol);
    }
    let job = Job::new(MEMORY)?;
    let mut child = Command::new(DECODER)
        .env_clear()
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()?;
    if unsafe { AssignProcessToJobObject(job.0, child.as_raw_handle()) } == 0 {
        let error = io::Error::last_os_error();
        child.kill()?;
        child.wait()?;
        return Err(error.into());
    }

    let mut input = child.stdin.take();
    let output = child.stdout.take().unwrap();
    let writer = frame.map(|bytes| {
        let mut pipe = input.take().unwrap();
        std::thread::spawn(move || pipe.write_all(&bytes))
    });
    let reader = std::thread::spawn(move || {
        let mut bytes = Vec::new();
        output
            .take((MAX_BYTES + 5) as u64)
            .read_to_end(&mut bytes)?;
        Ok::<_, io::Error>(bytes)
    });

    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if start.elapsed() < deadline => std::thread::sleep(Duration::from_millis(5)),
            outcome => {
                drop(job);
                child.wait()?;
                reader.join().unwrap()?;
                if let Some(writer) = writer {
                    let _ = writer.join();
                }
                return match outcome {
                    Err(error) => Err(error.into()),
                    _ => Err(Failure::Timeout),
                };
            }
        }
    };
    let bytes = reader.join().unwrap()?;
    let written = writer.map(|writer| writer.join().unwrap());
    if !status.success() {
        return Err(Failure::Worker(status.code().unwrap_or(-1)));
    }
    written.ok_or(Failure::Protocol)??;
    let prefix: [u8; 4] = bytes.get(..4).ok_or(Failure::Protocol)?.try_into().unwrap();
    let length = u32::from_le_bytes(prefix) as usize;
    if length == 0 || length > MAX_BYTES || bytes.len() != length + 4 {
        return Err(Failure::Protocol);
    }
    Ok((bytes[4..].to_vec(), job.peak()?))
}

fn frame(bytes: &[u8]) -> Vec<u8> {
    [&(bytes.len() as u32).to_le_bytes()[..], bytes].concat()
}

#[test]
fn windows_job_protocol_timeout_and_recovery() {
    {
        let _occupied = SLOT.lock().unwrap();
        assert!(matches!(
            std::thread::spawn(|| run(None, Duration::ZERO))
                .join()
                .unwrap(),
            Err(Failure::Busy)
        ));
    }
    let start = Instant::now();
    let timeout = Duration::from_millis(250);
    let result = run(None, timeout);
    if let Err(Failure::Setup(error)) = &result {
        panic!("Windows supervisor setup: {error}");
    }
    assert!(matches!(result, Err(Failure::Timeout)), "{result:?}");
    println!(
        "timeout and process wait: {} ms",
        start.elapsed().as_millis()
    );

    let deadline = Duration::from_secs(5);
    assert!(matches!(
        run(Some(vec![1]), deadline),
        Err(Failure::Worker(1))
    ));
    assert!(matches!(
        run(Some(vec![0; MAX_BYTES + 5]), deadline),
        Err(Failure::Protocol)
    ));
    for (name, input) in [
        ("PNG", PNG),
        ("JPEG", &include_bytes!("fixtures/static.jpeg")[..]),
        ("WebP", &include_bytes!("fixtures/static.webp")[..]),
    ] {
        let start = Instant::now();
        let (png, peak) = run(Some(frame(input)), deadline).unwrap();
        assert_eq!(png, normalize(input).unwrap().0);
        assert!((1..=MEMORY).contains(&peak));
        println!(
            "{name}: {} ms, peak job commit={peak} bytes",
            start.elapsed().as_millis()
        );
    }

    let raster = image::DynamicImage::ImageRgb8(image::RgbImage::from_pixel(
        4000,
        1999,
        image::Rgb([32, 160, 64]),
    ));
    for format in [
        image::ImageFormat::Png,
        image::ImageFormat::Jpeg,
        image::ImageFormat::WebP,
    ] {
        let mut input = io::Cursor::new(Vec::new());
        raster.write_to(&mut input, format).unwrap();
        let start = Instant::now();
        let (png, peak) = run(Some(frame(input.get_ref())), deadline).unwrap();
        let decoded = image::load_from_memory_with_format(&png, image::ImageFormat::Png)
            .unwrap()
            .into_rgba8();
        assert_eq!(decoded.dimensions(), (4000, 1999));
        assert!(decoded.pixels().all(|pixel| pixel
            .0
            .into_iter()
            .zip([32, 160, 64, 255])
            .all(|(actual, expected)| actual.abs_diff(expected) <= 5)));
        assert!((1..=MEMORY).contains(&peak));
        println!("{format:?} 7996000 pixels: {} ms including output verification, peak job commit={peak} bytes", start.elapsed().as_millis());
    }
}

#[test]
#[ignore = "executed only by the suspended Job probe"]
fn memory_probe_child() {
    use windows_sys::Win32::System::Memory::{
        VirtualAlloc, MEM_COMMIT, MEM_RESERVE, PAGE_READWRITE,
    };

    const BLOCK: usize = 4 * 1024 * 1024;
    for step in 0..50 {
        let address = unsafe {
            VirtualAlloc(
                std::ptr::null(),
                BLOCK,
                MEM_COMMIT | MEM_RESERVE,
                PAGE_READWRITE,
            )
        };
        if address.is_null() {
            let error = io::Error::last_os_error().raw_os_error().unwrap_or(0);
            eprintln!("commit refused after {step} blocks of 4 MiB: Win32 {error}");
            std::process::exit(if matches!(error, 8 | 1455 | 1816) {
                100 + step
            } else {
                72
            });
        }
        for offset in (0..BLOCK).step_by(4096) {
            unsafe { address.cast::<u8>().add(offset).write_volatile(1) };
        }
    }
}

#[test]
fn windows_suspended_probe_rejects_commit_above_192_mib() {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Foundation::{WAIT_OBJECT_0, WAIT_TIMEOUT};
    use windows_sys::Win32::System::Threading::*;

    let executable = std::env::current_exe().unwrap();
    let application: Vec<u16> = executable.as_os_str().encode_wide().chain([0]).collect();
    for budget in [256 * 1024 * 1024, MEMORY] {
        let job = Job::new(budget).unwrap();
        let mut command: Vec<u16> = "memory-probe --exact memory_probe_child --ignored --nocapture"
            .encode_utf16()
            .chain([0])
            .collect();
        let mut startup = STARTUPINFOW::default();
        startup.cb = std::mem::size_of_val(&startup) as u32;
        let mut process = PROCESS_INFORMATION::default();
        let created = unsafe {
            CreateProcessW(
                application.as_ptr(),
                command.as_mut_ptr(),
                std::ptr::null(),
                std::ptr::null(),
                0,
                CREATE_SUSPENDED,
                std::ptr::null(),
                std::ptr::null(),
                &startup,
                &mut process,
            )
        };
        assert_ne!(created, 0, "{}", io::Error::last_os_error());
        let result = (|| {
            if unsafe { AssignProcessToJobObject(job.0, process.hProcess) } == 0
                || unsafe { ResumeThread(process.hThread) } != 1
            {
                return Err(io::Error::last_os_error());
            }
            match unsafe { WaitForSingleObject(process.hProcess, 5000) } {
                WAIT_OBJECT_0 => {}
                WAIT_TIMEOUT => return Err(io::Error::from(io::ErrorKind::TimedOut)),
                _ => return Err(io::Error::last_os_error()),
            }
            let mut code = 0;
            if unsafe { GetExitCodeProcess(process.hProcess, &mut code) } == 0 {
                return Err(io::Error::last_os_error());
            }
            Ok((code, job.peak()?))
        })();
        unsafe {
            if result.is_err() {
                TerminateProcess(process.hProcess, 73);
                WaitForSingleObject(process.hProcess, 5000);
            }
            CloseHandle(process.hThread);
            CloseHandle(process.hProcess);
        }
        let (code, peak) = result.unwrap();
        println!("probe budget={budget} peak={peak} exit={code}");
        if budget == MEMORY {
            assert!(
                (140..148).contains(&code),
                "expected a near-budget allocation refusal"
            );
        } else {
            assert_eq!(code, 0);
            assert!(peak > MEMORY);
        }
    }
}
