//! Test harness only; not registered in Tauri or distributed with the Studio.
use forge_persistence::{err, valid_folder_name, validate_document, Session, MANIFEST};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    io::{self, BufRead, Write},
    path::PathBuf,
};
fn main() {
    let root = PathBuf::from(std::env::args_os().nth(1).expect("test-owned root"));
    let root = root.canonicalize().expect("existing test-owned root");
    let mut registry: HashMap<String, Session> = HashMap::new();
    for line in io::stdin().lock().lines() {
        let result = (|| -> forge_persistence::Result<Value> {
            let line = line.map_err(forge_persistence::io_error)?;
            if line.len() > 2_100_000 {
                return Err(err("too_large", "Mensagem de teste excessiva."));
            }
            let request: Value = serde_json::from_str(&line)
                .map_err(|_| err("invalid_json", "Requisição de teste inválida."))?;
            let op = request["op"].as_str().unwrap_or("");
            if matches!(op, "create" | "saveAs" | "open") {
                let folder = request["folderName"]
                    .as_str()
                    .ok_or_else(|| err("invalid_name", "Nome ausente."))?;
                valid_folder_name(folder)?;
                let session = if op == "open" {
                    Session::open(&root.join(folder).join(MANIFEST))?
                } else {
                    let document = validate_document(
                        request["documentJson"].as_str().unwrap_or("").as_bytes(),
                    )?;
                    Session::create(&root, folder, &document)?
                };
                let receipt = session.receipt();
                registry.insert(receipt.session_id.clone(), session);
                return Ok(json!(receipt));
            }
            let token = request["sessionId"].as_str().unwrap_or("");
            let session = registry
                .get_mut(token)
                .ok_or_else(|| err("unauthorized", "Sessão de teste não autorizada."))?;
            let receipt = match op {
                "save" => {
                    let p = validate_document(
                        request["documentJson"].as_str().unwrap_or("").as_bytes(),
                    )?;
                    session.save(&p)?
                }
                "reload" => session.reload()?,
                "restore" => session.restore()?,
                "close" => {
                    registry.remove(token);
                    return Ok(Value::Null);
                }
                _ => return Err(err("denied", "Operação de teste não permitida.")),
            };
            Ok(json!(receipt))
        })();
        let response = match result {
            Ok(data) => json!({"ok":true,"data":data}),
            Err(error) => json!({"ok":false,"error":error}),
        };
        println!("{response}");
        io::stdout().flush().unwrap();
    }
}
