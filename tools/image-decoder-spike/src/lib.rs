use image::{
    codecs::png::PngEncoder, DynamicImage, ImageDecoder, ImageEncoder, ImageFormat, ImageReader,
    Limits,
};
use sha2::{Digest, Sha256};
use std::io::{self, Cursor, Write};

pub const MAX_BYTES: usize = 8 * 1024 * 1024;
const MAX_AXIS: u32 = 4096;
const MAX_PIXELS: u64 = 8_000_000;
const MAX_METADATA: usize = 64 * 1024;

#[derive(Debug, PartialEq, Eq)]
pub enum Rejected {
    InputSize,
    Format,
    Container,
    Animation,
    Metadata,
    Dimensions,
    Decode,
    Output,
}

pub fn normalize(input: &[u8]) -> Result<(Vec<u8>, [u8; 32]), Rejected> {
    if input.is_empty() || input.len() > MAX_BYTES {
        return Err(Rejected::InputSize);
    }
    let format = match image::guess_format(input).map_err(|_| Rejected::Format)? {
        ImageFormat::Png => {
            inspect_png(input)?;
            ImageFormat::Png
        }
        ImageFormat::WebP => {
            inspect_webp(input)?;
            ImageFormat::WebP
        }
        ImageFormat::Jpeg => {
            inspect_jpeg(input)?;
            ImageFormat::Jpeg
        }
        _ => return Err(Rejected::Format),
    };

    let mut reader = ImageReader::with_format(Cursor::new(input), format);
    let mut limits = Limits::default();
    limits.max_image_width = Some(MAX_AXIS);
    limits.max_image_height = Some(MAX_AXIS);
    limits.max_alloc = Some(96 * 1024 * 1024);
    reader.limits(limits);
    let decoder = reader.into_decoder().map_err(|_| Rejected::Decode)?;
    let (width, height) = decoder.dimensions();
    check_dimensions(width, height)?;
    let rgba = DynamicImage::from_decoder(decoder)
        .map_err(|_| Rejected::Decode)?
        .into_rgba8();

    let mut output = BoundedOutput(Vec::new());
    PngEncoder::new(&mut output)
        .write_image(
            rgba.as_raw(),
            width,
            height,
            image::ExtendedColorType::Rgba8,
        )
        .map_err(|_| Rejected::Output)?;
    inspect_png(&output.0).map_err(|_| Rejected::Output)?;
    let digest = Sha256::digest(&output.0).into();
    Ok((output.0, digest))
}

fn check_dimensions(width: u32, height: u32) -> Result<(), Rejected> {
    if width == 0
        || height == 0
        || width > MAX_AXIS
        || height > MAX_AXIS
        || u64::from(width) * u64::from(height) > MAX_PIXELS
    {
        return Err(Rejected::Dimensions);
    }
    Ok(())
}

fn inspect_png(input: &[u8]) -> Result<(), Rejected> {
    let mut chunks = input.get(8..).ok_or(Rejected::Container)?;
    let mut header = false;
    let mut data = false;
    let mut metadata = 0;
    while let Some(prefix) = chunks.get(..8) {
        let length = u32::from_be_bytes(prefix[..4].try_into().unwrap()) as usize;
        let end = length.checked_add(12).ok_or(Rejected::Container)?;
        let chunk = chunks.get(..end).ok_or(Rejected::Container)?;
        let kind = &prefix[4..];
        if !kind.iter().all(u8::is_ascii_alphabetic)
            || kind[2].is_ascii_lowercase()
            || crc32fast::hash(&chunk[4..end - 4]).to_be_bytes() != chunk[end - 4..]
            || (!header && kind != b"IHDR")
        {
            return Err(Rejected::Container);
        }
        chunks = &chunks[end..];
        match kind {
            b"IHDR" if !header && length == 13 => {
                header = true;
                check_dimensions(
                    u32::from_be_bytes(chunk[8..12].try_into().unwrap()),
                    u32::from_be_bytes(chunk[12..16].try_into().unwrap()),
                )?;
            }
            b"IDAT" => data = true,
            b"PLTE" => {}
            b"IEND" if data && length == 0 && chunks.is_empty() => return Ok(()),
            b"acTL" | b"fcTL" | b"fdAT" => return Err(Rejected::Animation),
            b"zTXt" | b"iTXt" | b"iCCP" => return Err(Rejected::Metadata),
            _ if kind[0].is_ascii_lowercase() => account_metadata(&mut metadata, length)?,
            _ => return Err(Rejected::Container),
        }
    }
    Err(Rejected::Container)
}

fn inspect_webp(input: &[u8]) -> Result<(), Rejected> {
    let header = input.get(..12).ok_or(Rejected::Container)?;
    if &header[8..] != b"WEBP"
        || u32::from_le_bytes(header[4..8].try_into().unwrap()) as usize != input.len() - 8
    {
        return Err(Rejected::Container);
    }
    let mut chunks = &input[12..];
    let mut image_data = false;
    let mut metadata = 0;
    while !chunks.is_empty() {
        let prefix = chunks.get(..8).ok_or(Rejected::Container)?;
        let length = u32::from_le_bytes(prefix[4..].try_into().unwrap()) as usize;
        let end = length
            .checked_add(8 + length % 2)
            .ok_or(Rejected::Container)?;
        let chunk = chunks.get(..end).ok_or(Rejected::Container)?;
        if length % 2 == 1 && chunk[end - 1] != 0 {
            return Err(Rejected::Container);
        }
        match &prefix[..4] {
            b"ANIM" | b"ANMF" => return Err(Rejected::Animation),
            b"VP8X" if length == 10 => {
                if chunk[8] & 2 != 0 {
                    return Err(Rejected::Animation);
                }
                let axis = |offset| {
                    1 + u32::from_le_bytes([chunk[offset], chunk[offset + 1], chunk[offset + 2], 0])
                };
                check_dimensions(axis(12), axis(15))?;
            }
            b"VP8 " | b"VP8L" if !image_data => image_data = true,
            b"ALPH" => {}
            b"ICCP" | b"EXIF" | b"XMP " => account_metadata(&mut metadata, length)?,
            _ => return Err(Rejected::Container),
        }
        chunks = &chunks[end..];
    }
    if image_data {
        Ok(())
    } else {
        Err(Rejected::Container)
    }
}

fn inspect_jpeg(input: &[u8]) -> Result<(), Rejected> {
    let mut rest = input.get(2..).ok_or(Rejected::Container)?;
    let mut in_scan = false;
    let mut saw_scan = false;
    let mut metadata = 0;
    loop {
        if in_scan {
            let next = rest
                .iter()
                .position(|byte| *byte == 0xff)
                .ok_or(Rejected::Container)?;
            rest = &rest[next..];
        }
        if rest.first() != Some(&0xff) {
            return Err(Rejected::Container);
        }
        let marker_offset = rest
            .iter()
            .position(|byte| *byte != 0xff)
            .ok_or(Rejected::Container)?;
        let marker = rest[marker_offset];
        rest = &rest[marker_offset + 1..];
        match marker {
            0x00 | 0xd0..=0xd7 if in_scan => continue,
            0xd9 if saw_scan && rest.is_empty() => return Ok(()),
            0x00 | 0xd0..=0xd9 | 0x01 => return Err(Rejected::Container),
            _ => {}
        }
        let size = rest.get(..2).ok_or(Rejected::Container)?;
        let length = u16::from_be_bytes(size.try_into().unwrap()) as usize;
        if length < 2 {
            return Err(Rejected::Container);
        }
        let segment = rest.get(..length).ok_or(Rejected::Container)?;
        if matches!(marker, 0xe0..=0xef | 0xfe) {
            account_metadata(&mut metadata, length - 2)?;
        }
        if matches!(marker, 0xc0..=0xc3) {
            let dimensions = segment.get(3..7).ok_or(Rejected::Container)?;
            let height = u16::from_be_bytes(dimensions[..2].try_into().unwrap());
            let width = u16::from_be_bytes(dimensions[2..].try_into().unwrap());
            check_dimensions(width.into(), height.into())?;
        }
        in_scan = marker == 0xda;
        saw_scan |= in_scan;
        rest = &rest[length..];
    }
}

fn account_metadata(total: &mut usize, length: usize) -> Result<(), Rejected> {
    *total = total.checked_add(length).ok_or(Rejected::Metadata)?;
    if *total > MAX_METADATA {
        Err(Rejected::Metadata)
    } else {
        Ok(())
    }
}

struct BoundedOutput(Vec<u8>);

impl Write for BoundedOutput {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        if bytes.len() > MAX_BYTES - self.0.len() {
            return Err(io::Error::other("PNG output limit"));
        }
        self.0.write(bytes)
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

#[test]
fn output_writer_refuses_excess_without_appending_partial_chunk() {
    let mut output = BoundedOutput(Vec::new());
    output.write_all(&vec![0; MAX_BYTES]).unwrap();
    assert!(output.write_all(&[1]).is_err());
    assert_eq!(output.0.len(), MAX_BYTES);
}
