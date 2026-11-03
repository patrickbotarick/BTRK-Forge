use forge_image_decoder_spike::{normalize, MAX_BYTES};
use std::io::{self, Read, Write};

fn run() -> Result<(), ()> {
    let mut input = io::stdin().lock();
    let mut length = [0; 4];
    input.read_exact(&mut length).map_err(|_| ())?;
    let length = u32::from_le_bytes(length) as usize;
    if length == 0 || length > MAX_BYTES {
        return Err(());
    }
    let mut bytes = vec![0; length];
    input.read_exact(&mut bytes).map_err(|_| ())?;
    if input.read(&mut [0]).map_err(|_| ())? != 0 {
        return Err(());
    }
    let (png, _) = normalize(&bytes).map_err(|_| ())?;
    let mut output = io::stdout().lock();
    output
        .write_all(&(png.len() as u32).to_le_bytes())
        .map_err(|_| ())?;
    output.write_all(&png).map_err(|_| ())?;
    output.flush().map_err(|_| ())
}

fn main() -> std::process::ExitCode {
    if run().is_ok() {
        std::process::ExitCode::SUCCESS
    } else {
        std::process::ExitCode::FAILURE
    }
}
