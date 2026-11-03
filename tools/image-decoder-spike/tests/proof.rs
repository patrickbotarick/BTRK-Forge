use forge_image_decoder_spike::{normalize, Rejected, MAX_BYTES};
use sha2::{Digest, Sha256};
use std::io::Write;
use std::process::{Command, Stdio};
use std::time::Instant;

const PNG: &[u8] = include_bytes!("fixtures/static.png");
const JPEG: &[u8] = include_bytes!("fixtures/static.jpeg");
const WEBP: &[u8] = include_bytes!("fixtures/static.webp");

#[test]
fn independent_static_formats_roundtrip() {
    for (name, input) in [("PNG", PNG), ("JPEG", JPEG), ("WebP", WEBP)] {
        let start = Instant::now();
        let (png, digest) = normalize(input).unwrap();
        println!(
            "{name}: {} us, {} bytes",
            start.elapsed().as_micros(),
            png.len()
        );
        assert_eq!(normalize(input).unwrap(), (png.clone(), digest));
        assert_eq!(<[u8; 32]>::from(Sha256::digest(&png)), digest);
        let rgba = image::load_from_memory_with_format(&png, image::ImageFormat::Png)
            .unwrap()
            .into_rgba8();
        assert_eq!(rgba.dimensions(), (16, 12));
        for pixel in rgba.pixels() {
            for (actual, expected) in pixel.0.into_iter().zip([32u8, 160, 64, 255]) {
                assert!(actual.abs_diff(expected) <= 5);
            }
        }
    }
}

#[test]
fn truncated_forged_inconsistent_and_extra_bytes() {
    for input in [PNG, JPEG, WEBP] {
        assert!(normalize(&input[..input.len() - 1]).is_err());
        assert!(normalize(&[input, b"payload"].concat()).is_err());
        assert!(normalize(&input[..12]).is_err());
    }
    assert_eq!(normalize(b"not an image.png"), Err(Rejected::Format));
    assert_eq!(normalize(&vec![0; MAX_BYTES + 1]), Err(Rejected::InputSize));
    let mut png = PNG.to_vec();
    png[29] ^= 1;
    assert_eq!(normalize(&png), Err(Rejected::Container));
    let mut webp = WEBP.to_vec();
    webp[4] ^= 1;
    assert_eq!(normalize(&webp), Err(Rejected::Container));
}

fn png_chunk(kind: &[u8; 4], body: &[u8]) -> Vec<u8> {
    let mut chunk = (body.len() as u32).to_be_bytes().to_vec();
    chunk.extend(kind);
    chunk.extend(body);
    chunk.extend(crc32fast::hash(&chunk[4..]).to_be_bytes());
    chunk
}

#[test]
fn dimensions_metadata_and_animation() {
    let mut header = PNG[16..29].to_vec();
    header[..4].copy_from_slice(&4097u32.to_be_bytes());
    let png = [&PNG[..8], &png_chunk(b"IHDR", &header), &PNG[33..]].concat();
    assert_eq!(normalize(&png), Err(Rejected::Dimensions));
    let png = [
        &PNG[..33],
        &png_chunk(b"tEXt", &vec![b'a'; 65537]),
        &PNG[33..],
    ]
    .concat();
    assert_eq!(normalize(&png), Err(Rejected::Metadata));
    let png = [
        &PNG[..33],
        &png_chunk(b"acTL", &[0, 0, 0, 1, 0, 0, 0, 0]),
        &PNG[33..],
    ]
    .concat();
    assert_eq!(normalize(&png), Err(Rejected::Animation));
    let mut webp = [WEBP, b"ANIM\x06\0\0\0\0\0\0\0\0\0"].concat();
    let length = (webp.len() - 8) as u32;
    webp[4..8].copy_from_slice(&length.to_le_bytes());
    assert_eq!(normalize(&webp), Err(Rejected::Animation));
}

#[test]
fn process_protocol_rejects_bad_frames_and_recovers() {
    let good = [&(PNG.len() as u32).to_le_bytes()[..], PNG].concat();
    for input in [
        b"".as_slice(),
        &good[..good.len() - 1],
        &[&good[..], b"x"].concat(),
        &good,
    ] {
        let start = Instant::now();
        let mut worker = Command::new(env!("CARGO_BIN_EXE_forge-image-decoder-spike"))
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .spawn()
            .unwrap();
        worker.stdin.take().unwrap().write_all(input).unwrap();
        let result = worker.wait_with_output().unwrap();
        println!(
            "process: {} ms, success={}",
            start.elapsed().as_millis(),
            result.status.success()
        );
        if input == good {
            assert!(result.status.success());
            let png = &result.stdout[4..];
            assert_eq!(result.stdout[..4], (png.len() as u32).to_le_bytes());
            assert_eq!(png, normalize(PNG).unwrap().0);
        } else {
            assert!(!result.status.success());
            assert!(result.stdout.is_empty());
        }
    }
}

#[test]
fn blocked_protocol_can_be_terminated() {
    let mut worker = Command::new(env!("CARGO_BIN_EXE_forge-image-decoder-spike"))
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .spawn()
        .unwrap();
    let pipe = worker.stdin.take().unwrap();
    let start = Instant::now();
    std::thread::sleep(std::time::Duration::from_millis(100));
    assert!(worker.try_wait().unwrap().is_none());
    worker.kill().unwrap();
    assert!(!worker.wait().unwrap().success());
    println!(
        "blocked process killed and reaped in {} ms",
        start.elapsed().as_millis()
    );
    drop(pipe);
}
