use crate::{err, Result, MAX_BYTES};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::sync::LazyLock;

static SCHEMA: LazyLock<jsonschema::Validator> = LazyLock::new(|| {
    let schema: Value =
        serde_json::from_str(include_str!("../../project-schema/project.schema.json"))
            .expect("schema versionado");
    jsonschema::options()
        .should_validate_formats(true)
        .build(&schema)
        .expect("JSON Schema válido")
});
static LEGACY_SCHEMA: LazyLock<jsonschema::Validator> = LazyLock::new(|| {
    let schema: Value =
        serde_json::from_str(include_str!("../../project-schema/project-v1.schema.json"))
            .expect("schema legado");
    jsonschema::options()
        .should_validate_formats(true)
        .build(&schema)
        .expect("schema legado válido")
});
static V2_SCHEMA: LazyLock<jsonschema::Validator> = LazyLock::new(|| {
    let schema: Value =
        serde_json::from_str(include_str!("../../project-schema/project-v2.schema.json"))
            .expect("schema v2");
    jsonschema::options()
        .should_validate_formats(true)
        .build(&schema)
        .expect("schema v2 válido")
});

pub fn parse(bytes: &[u8]) -> Result<Value> {
    if bytes.len() > MAX_BYTES {
        return Err(err("too_large", "O projeto excede o limite de 2 MB."));
    }
    let mut document: Value = serde_json::from_slice(bytes).map_err(|_| {
        err(
            "invalid_json",
            "O arquivo JSON está corrompido ou malformado.",
        )
    })?;
    if document["schemaVersion"].as_f64() == Some(0.0) {
        document["schemaVersion"] = 1.into();
        if document
            .get("functions")
            .is_none_or(|value| value.is_null())
        {
            document["functions"] = Value::Array(vec![]);
        }
    }
    if document["schemaVersion"].as_f64().is_some_and(|v| v > 3.0)
        || document["metadata"]["documentVersion"]
            .as_f64()
            .is_some_and(|v| v > 1.0)
    {
        return Err(err(
            "future_schema",
            "Este projeto usa uma versão futura do schema. Atualize o Studio antes de abri-lo.",
        ));
    }
    if document["schemaVersion"] == 1 {
        LEGACY_SCHEMA
            .validate(&document)
            .map_err(|_| err("invalid_schema", "Documento legado inválido."))?;
        let event_id = document["graph"]["nodes"]
            .as_array()
            .unwrap()
            .iter()
            .find(|n| n["kind"] == "event")
            .map(|n| n["id"].clone())
            .unwrap_or(Value::Null);
        for screen in document["screens"].as_array_mut().unwrap() {
            let button = screen["button"].clone();
            screen.as_object_mut().unwrap().remove("button");
            screen["components"] = serde_json::json!([{
                "id":button["id"],"parentId":null,"type":"Button",
                "props":{"text":button["text"],"disabled":false},"events":{"click":event_id},
                "style":{"width":"auto","height":"auto","background":button["color"],"color":"#111820","borderColor":"#344454","borderWidth":0,"borderRadius":4,"fontSize":16,"fontWeight":"400","textAlign":"left"}
            }]);
        }
        document["schemaVersion"] = 2.into();
    }
    if document["schemaVersion"] == 2 {
        V2_SCHEMA
            .validate(&document)
            .map_err(|_| err("invalid_schema", "Documento v2 inválido."))?;
        if document["graph"]["nodes"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|n| n["kind"] == "event")
            .count()
            != 1
        {
            return Err(err(
                "invalid_graph",
                "Formato legado exige exatamente um evento.",
            ));
        }
        for screen in document["screens"].as_array_mut().unwrap() {
            for c in screen["components"].as_array_mut().unwrap() {
                if c["type"] == "Input" {
                    c["props"]["binding"] = Value::Null;
                    c["events"] = serde_json::json!({"change":null});
                }
            }
        }
        document["schemaVersion"] = 3.into();
    }
    SCHEMA.validate(&document).map_err(|_| {
        err(
            "invalid_schema",
            "O projeto não atende ao formato BTRK ou contém campos não suportados.",
        )
    })?;
    validate_graph(&document)?;
    Ok(document)
}

pub fn encode(document: &Value) -> Result<Vec<u8>> {
    let bytes = serde_json::to_vec_pretty(document)
        .map_err(|_| err("invalid_schema", "Não foi possível serializar o projeto."))?;
    parse(&bytes)?;
    Ok(bytes)
}

fn scalar_type(value: &Value) -> &'static str {
    if value.is_number() {
        "number"
    } else if value.is_boolean() {
        "boolean"
    } else {
        "string"
    }
}
type Ports = (HashMap<String, String>, HashMap<String, String>);
fn ports(node: &Value, variables: &HashMap<String, String>, components: &[Value]) -> Result<Ports> {
    let list = |entries: &[(&str, &str)]| {
        entries
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect()
    };
    let variable_type = || {
        variables
            .get(node["variableId"].as_str().unwrap())
            .cloned()
            .ok_or_else(|| err("invalid_reference", "Uma variável referenciada não existe."))
    };
    let component_ref = || {
        components
            .iter()
            .find(|c| c["id"] == node["componentId"])
            .ok_or_else(|| err("invalid_reference", "Componente referenciado ausente."))
    };
    Ok(match node["kind"].as_str().unwrap() {
        "event" => {
            if !node["componentId"].is_null() {
                let expected = if node["event"] == "button.click" {
                    "Button"
                } else {
                    "Input"
                };
                if component_ref()?["type"] != expected {
                    return Err(err("invalid_type", "Tipo de evento incompatível."));
                }
            } else if node["event"] == "input.change" {
                return Err(err(
                    "invalid_reference",
                    "Evento de Input exige componente.",
                ));
            }
            (list(&[]), list(&[("next", "exec")]))
        }
        "constant" => (list(&[]), list(&[("value", scalar_type(&node["value"]))])),
        "variable" => (list(&[]), list(&[("value", &variable_type()?)])),
        "add" => (
            list(&[("a", "number"), ("b", "number")]),
            list(&[("value", "number")]),
        ),
        "greater" => (
            list(&[("a", "number"), ("b", "number")]),
            list(&[("value", "boolean")]),
        ),
        "condition" => (
            list(&[("in", "exec"), ("test", "boolean")]),
            list(&[("yes", "exec"), ("no", "exec")]),
        ),
        "set" => (
            list(&[("in", "exec"), ("value", &variable_type()?)]),
            list(&[("next", "exec")]),
        ),
        "empty" => (list(&[("value", "string")]), list(&[("value", "boolean")])),
        "concat" => (
            list(&[("a", "string"), ("b", "string")]),
            list(&[("value", "string")]),
        ),
        "component-value" => {
            let expected = if node["property"] == "value" {
                "Input"
            } else {
                "Text"
            };
            if component_ref()?["type"] != expected {
                return Err(err(
                    "invalid_type",
                    "Propriedade de componente incompatível.",
                ));
            }
            (list(&[]), list(&[("value", "string")]))
        }
        "set-text" => {
            if component_ref()?["type"] != "Text" {
                return Err(err("invalid_type", "Ação exige Text."));
            }
            (
                list(&[("in", "exec"), ("value", "string")]),
                list(&[("next", "exec")]),
            )
        }
        _ => return Err(err("invalid_schema", "Tipo de node não suportado.")),
    })
}

fn validate_graph(p: &Value) -> Result<()> {
    let mut ids = HashSet::new();
    let mut unique = |id: &str| {
        if ids.insert(id.to_owned()) {
            Ok(())
        } else {
            Err(err(
                "duplicate_id",
                "Existem identificadores duplicados no projeto.",
            ))
        }
    };
    unique(p["id"].as_str().unwrap())?;
    for screen in p["screens"].as_array().unwrap() {
        unique(screen["id"].as_str().unwrap())?;
        let components = screen["components"].as_array().unwrap();
        for c in components {
            let id = c["id"].as_str().unwrap();
            unique(id)?;
            let mut visited = HashSet::from([id]);
            let mut parent = c["parentId"].as_str();
            let mut depth = 1;
            while let Some(parent_id) = parent {
                if !visited.insert(parent_id) {
                    return Err(err("cycle", "Ciclo na hierarquia de componentes."));
                }
                let container = components
                    .iter()
                    .find(|v| v["id"] == parent_id)
                    .ok_or_else(|| err("invalid_reference", "Pai de componente ausente."))?;
                if container["type"] != "Container" {
                    return Err(err("invalid_reference", "Somente Container admite filhos."));
                }
                depth += 1;
                if depth > 12 {
                    return Err(err(
                        "limit",
                        "Profundidade máxima de 12 componentes excedida.",
                    ));
                }
                parent = container["parentId"].as_str();
            }
            if c["type"] == "Button"
                && !c["events"]["click"].is_null()
                && !p["graph"]["nodes"].as_array().unwrap().iter().any(|n| {
                    n["id"] == c["events"]["click"]
                        && n["kind"] == "event"
                        && n["event"] == "button.click"
                        && (n["componentId"].is_null() || n["componentId"] == c["id"])
                })
            {
                return Err(err("invalid_reference", "Referência de evento inválida."));
            }
            if c["type"] == "Input" {
                if !c["props"]["binding"].is_null()
                    && !p["variables"]
                        .as_array()
                        .unwrap()
                        .iter()
                        .any(|v| v["id"] == c["props"]["binding"] && v["type"] == "string")
                {
                    return Err(err(
                        "invalid_reference",
                        "Binding de Input exige variável string existente.",
                    ));
                }
                if !c["events"]["change"].is_null()
                    && !p["graph"]["nodes"].as_array().unwrap().iter().any(|n| {
                        n["id"] == c["events"]["change"]
                            && n["kind"] == "event"
                            && n["event"] == "input.change"
                            && n["componentId"] == c["id"]
                    })
                {
                    return Err(err("invalid_reference", "Referência de evento inválida."));
                }
            }
        }
    }
    let mut variables = HashMap::new();
    for v in p["variables"].as_array().unwrap() {
        unique(v["id"].as_str().unwrap())?;
        let kind = v["type"].as_str().unwrap();
        if kind != scalar_type(&v["initial"]) {
            return Err(err(
                "invalid_type",
                "O tipo inicial de uma variável é incompatível.",
            ));
        }
        variables.insert(v["id"].as_str().unwrap().to_string(), kind.to_string());
    }
    let mut definitions = HashMap::new();
    let mut events = 0;
    for node in p["graph"]["nodes"].as_array().unwrap() {
        let id = node["id"].as_str().unwrap();
        unique(id)?;
        if node["kind"] == "event" {
            events += 1;
        }
        definitions.insert(
            id,
            ports(
                node,
                &variables,
                p["screens"][0]["components"].as_array().unwrap(),
            )?,
        );
    }
    if !(1..=32).contains(&events) {
        return Err(err("invalid_graph", "O grafo exige de 1 a 32 eventos."));
    }
    let mut inputs = HashSet::new();
    let mut control_outputs = HashSet::new();
    let mut adjacency: HashMap<&str, Vec<&str>> = HashMap::new();
    for edge in p["graph"]["connections"].as_array().unwrap() {
        unique(edge["id"].as_str().unwrap())?;
        let source = edge["source"].as_str().unwrap();
        let target = edge["target"].as_str().unwrap();
        let output = edge["output"].as_str().unwrap();
        let input = edge["input"].as_str().unwrap();
        let (Some(from), Some(to)) = (definitions.get(source), definitions.get(target)) else {
            return Err(err(
                "invalid_reference",
                "Uma conexão referencia um node inexistente.",
            ));
        };
        let (Some(from_type), Some(to_type)) = (from.1.get(output), to.0.get(input)) else {
            return Err(err(
                "invalid_socket",
                "Uma conexão referencia um socket inexistente.",
            ));
        };
        if from_type != to_type {
            return Err(err(
                "invalid_type",
                "Uma conexão possui tipos incompatíveis.",
            ));
        }
        if !inputs.insert((target, input))
            || (from_type == "exec" && !control_outputs.insert((source, output)))
        {
            return Err(err(
                "invalid_graph",
                "Uma entrada ou saída de execução está conectada mais de uma vez.",
            ));
        }
        adjacency.entry(source).or_default().push(target);
    }
    fn visit<'a>(
        id: &'a str,
        graph: &HashMap<&'a str, Vec<&'a str>>,
        active: &mut HashSet<&'a str>,
        done: &mut HashSet<&'a str>,
    ) -> Result<()> {
        if done.contains(id) {
            return Ok(());
        }
        if !active.insert(id) {
            return Err(err(
                "cycle",
                "Ciclos ainda não são suportados pelo Blueprint Core.",
            ));
        }
        if let Some(children) = graph.get(id) {
            for child in children {
                visit(child, graph, active, done)?;
            }
        }
        active.remove(id);
        done.insert(id);
        Ok(())
    }
    let mut active = HashSet::new();
    let mut done = HashSet::new();
    for id in definitions.keys() {
        visit(id, &adjacency, &mut active, &mut done)?;
    }
    // Missing inputs are valid editing drafts. The existing execution engine still rejects them.
    Ok(())
}
