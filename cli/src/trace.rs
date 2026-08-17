use serde_json::{json, Map, Value};
use std::collections::HashMap;

const TARGET_LIMIT: usize = 500;
const ARGUMENT_LIMIT: usize = 2000;
const TEXT_LIMIT: usize = 20_000;

/// First match wins, so keep the specific keys ahead of the generic ones.
const TARGET_KEYS: &[&str] = &[
    "command",
    "file_path",
    "path",
    "pattern",
    "url",
    "notebook_path",
    "query",
    "prompt",
    "description",
];

#[derive(Debug, Clone, PartialEq)]
pub enum StepKind {
    Tool,
    Text,
    Result,
}

impl StepKind {
    fn as_str(&self) -> &'static str {
        match self {
            StepKind::Tool => "tool",
            StepKind::Text => "text",
            StepKind::Result => "result",
        }
    }
}

#[derive(Debug, Clone)]
pub struct Step {
    pub kind: StepKind,
    pub name: Option<String>,
    pub target: Option<String>,
    pub argument: Option<String>,
    pub result_bytes: Option<u64>,
    pub is_error: bool,
    pub text: Option<String>,
    pub at: Option<String>,
}

impl Step {
    fn to_json(&self) -> Value {
        json!({
            "kind": self.kind.as_str(),
            "name": self.name,
            "target": self.target,
            "argument": self.argument,
            "resultBytes": self.result_bytes,
            "isError": self.is_error,
            "text": self.text,
            "at": self.at,
        })
    }
}

#[derive(Debug, Default)]
pub struct Trace {
    pub model: Option<String>,
    pub agent_version: Option<String>,
    pub session_ref: Option<String>,
    pub started_at: Option<String>,
    pub ended_at: Option<String>,
    pub duration_ms: Option<u64>,
    pub turns: Option<u64>,
    pub cost_usd_micros: Option<u64>,
    pub input_tokens: Option<u64>,
    pub output_tokens: Option<u64>,
    pub is_error: bool,
    pub subtype: Option<String>,
    pub permission_denials: usize,
    pub final_message: Option<String>,
    pub steps: Vec<Step>,
    pub unparsed_lines: usize,
}

impl Trace {
    pub fn tool_calls(&self) -> usize {
        self.steps
            .iter()
            .filter(|step| step.kind == StepKind::Tool)
            .count()
    }

    pub fn steps_json(&self) -> Value {
        Value::Array(self.steps.iter().map(Step::to_json).collect())
    }

    pub fn result_json(&self) -> Value {
        json!({
            "subtype": self.subtype,
            "isError": self.is_error,
            "permissionDenials": self.permission_denials,
            "toolCalls": self.tool_calls(),
        })
    }
}

/// Unparseable lines are counted and skipped, because a transcript truncated
/// mid-write is still worth most of its steps.
pub fn parse(stream: &str) -> Trace {
    let mut trace = Trace::default();
    let mut pending: HashMap<String, usize> = HashMap::new();

    for line in stream.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let Ok(event) = serde_json::from_str::<Value>(line) else {
            trace.unparsed_lines += 1;
            continue;
        };
        let at = event.get("timestamp").and_then(Value::as_str);
        if let Some(at) = at {
            if trace.started_at.is_none() {
                trace.started_at = Some(at.to_string());
            }
            trace.ended_at = Some(at.to_string());
        }

        match event.get("type").and_then(Value::as_str) {
            Some("system") if event.get("subtype").and_then(Value::as_str) == Some("init") => {
                trace.model = string_at(&event, "model");
                trace.session_ref = string_at(&event, "session_id");
                trace.agent_version = string_at(&event, "claude_code_version");
            }
            Some("assistant") => {
                for item in content_items(&event) {
                    match item.get("type").and_then(Value::as_str) {
                        Some("text") => {
                            if let Some(text) = item.get("text").and_then(Value::as_str) {
                                if !text.trim().is_empty() {
                                    trace.steps.push(Step {
                                        kind: StepKind::Text,
                                        name: None,
                                        target: None,
                                        argument: None,
                                        result_bytes: None,
                                        is_error: false,
                                        text: Some(truncate(text, TEXT_LIMIT)),
                                        at: at.map(str::to_string),
                                    });
                                }
                            }
                        }
                        Some("tool_use") => {
                            if let Some(id) = item.get("id").and_then(Value::as_str) {
                                pending.insert(id.to_string(), trace.steps.len());
                            }
                            let input = item.get("input");
                            trace.steps.push(Step {
                                kind: StepKind::Tool,
                                name: string_at(item, "name"),
                                target: input.and_then(target_of),
                                argument: input
                                    .map(|value| truncate(&compact(value), ARGUMENT_LIMIT)),
                                result_bytes: None,
                                is_error: false,
                                text: None,
                                at: at.map(str::to_string),
                            });
                        }
                        _ => {}
                    }
                }
            }
            Some("user") => {
                for item in content_items(&event) {
                    if item.get("type").and_then(Value::as_str) != Some("tool_result") {
                        continue;
                    }
                    let Some(index) = item
                        .get("tool_use_id")
                        .and_then(Value::as_str)
                        .and_then(|id| pending.remove(id))
                    else {
                        continue;
                    };
                    let Some(step) = trace.steps.get_mut(index) else {
                        continue;
                    };
                    step.result_bytes = Some(result_size(item.get("content")));
                    step.is_error = item
                        .get("is_error")
                        .and_then(Value::as_bool)
                        .unwrap_or(false);
                }
            }
            Some("result") => {
                trace.subtype = string_at(&event, "subtype");
                trace.is_error = event
                    .get("is_error")
                    .and_then(Value::as_bool)
                    .unwrap_or(false);
                trace.duration_ms = event.get("duration_ms").and_then(Value::as_u64);
                trace.turns = event.get("num_turns").and_then(Value::as_u64);
                trace.cost_usd_micros = event
                    .get("total_cost_usd")
                    .and_then(Value::as_f64)
                    .map(|cost| (cost * 1_000_000.0).round().max(0.0) as u64);
                trace.input_tokens = event.pointer("/usage/input_tokens").and_then(Value::as_u64);
                trace.output_tokens = event
                    .pointer("/usage/output_tokens")
                    .and_then(Value::as_u64);
                trace.permission_denials = event
                    .get("permission_denials")
                    .and_then(Value::as_array)
                    .map(Vec::len)
                    .unwrap_or(0);
                trace.final_message = string_at(&event, "result")
                    .filter(|text| !text.trim().is_empty())
                    .map(|text| truncate(&text, TEXT_LIMIT));
                trace.steps.push(Step {
                    kind: StepKind::Result,
                    name: None,
                    target: None,
                    argument: None,
                    result_bytes: None,
                    is_error: trace.is_error,
                    text: trace.final_message.clone(),
                    at: at.map(str::to_string),
                });
            }
            _ => {}
        }
    }
    trace
}

fn content_items(event: &Value) -> Vec<&Value> {
    event
        .pointer("/message/content")
        .and_then(Value::as_array)
        .map(|items| items.iter().collect())
        .unwrap_or_default()
}

fn target_of(input: &Value) -> Option<String> {
    let map = input.as_object()?;
    for key in TARGET_KEYS {
        if let Some(text) = map.get(*key).and_then(Value::as_str) {
            if !text.trim().is_empty() {
                return Some(truncate(text, TARGET_LIMIT));
            }
        }
    }
    first_string(map).map(|text| truncate(&text, TARGET_LIMIT))
}

fn first_string(map: &Map<String, Value>) -> Option<String> {
    map.values()
        .find_map(Value::as_str)
        .filter(|text| !text.trim().is_empty())
        .map(str::to_string)
}

fn result_size(content: Option<&Value>) -> u64 {
    match content {
        Some(Value::String(text)) => text.len() as u64,
        Some(value) => compact(value).len() as u64,
        None => 0,
    }
}

fn compact(value: &Value) -> String {
    serde_json::to_string(value).unwrap_or_default()
}

fn string_at(value: &Value, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(Value::as_str)
        .map(str::to_string)
        .filter(|text| !text.is_empty())
}

fn truncate(value: &str, limit: usize) -> String {
    if value.chars().count() <= limit {
        return value.to_string();
    }
    let head: String = value.chars().take(limit).collect();
    format!("{head}...")
}

#[cfg(test)]
mod tests {
    use super::*;

    const STREAM: &str = r#"
{"type":"system","subtype":"init","model":"claude-opus-5[1m]","session_id":"827c21c4","claude_code_version":"2.1.0","cwd":"/tmp/repo"}
{"type":"assistant","timestamp":"2026-08-12T16:58:16.021Z","message":{"content":[{"type":"text","text":"I'll start by reading the manifest."}]}}
{"type":"assistant","timestamp":"2026-08-12T16:58:18.145Z","message":{"content":[{"type":"tool_use","id":"toolu_1","name":"Bash","input":{"command":"cat sieve-prior-feedback.json","description":"read prior feedback"}}]}}
{"type":"user","timestamp":"2026-08-12T16:58:19.000Z","message":{"content":[{"type":"tool_result","tool_use_id":"toolu_1","is_error":null,"content":"ship as is"}]}}
{"type":"assistant","timestamp":"2026-08-12T16:58:23.494Z","message":{"content":[{"type":"tool_use","id":"toolu_2","name":"Read","input":{"file_path":"/tmp/repo/sieve-recap.json"}}]}}
{"type":"user","timestamp":"2026-08-12T16:58:24.000Z","message":{"content":[{"type":"tool_result","tool_use_id":"toolu_2","is_error":true,"content":[{"type":"text","text":"no such file"}]}]}}
not json at all
{"type":"result","subtype":"success","is_error":false,"duration_ms":27709,"num_turns":44,"total_cost_usd":0.191148,"usage":{"input_tokens":2,"output_tokens":4},"permission_denials":[],"result":"Prior feedback honored: oz answered ship as is."}
"#;

    #[test]
    fn reads_provenance_from_the_init_event() {
        let trace = parse(STREAM);
        assert_eq!(trace.model.as_deref(), Some("claude-opus-5[1m]"));
        assert_eq!(trace.session_ref.as_deref(), Some("827c21c4"));
        assert_eq!(trace.agent_version.as_deref(), Some("2.1.0"));
    }

    #[test]
    fn orders_steps_and_names_their_targets() {
        let trace = parse(STREAM);
        let kinds: Vec<_> = trace.steps.iter().map(|step| step.kind.clone()).collect();
        assert_eq!(
            kinds,
            vec![
                StepKind::Text,
                StepKind::Tool,
                StepKind::Tool,
                StepKind::Result
            ]
        );
        assert_eq!(trace.steps[1].name.as_deref(), Some("Bash"));
        assert_eq!(
            trace.steps[1].target.as_deref(),
            Some("cat sieve-prior-feedback.json")
        );
        assert_eq!(
            trace.steps[2].target.as_deref(),
            Some("/tmp/repo/sieve-recap.json")
        );
        assert_eq!(trace.tool_calls(), 2);
    }

    #[test]
    fn pairs_tool_results_back_to_their_call() {
        let trace = parse(STREAM);
        assert_eq!(trace.steps[1].result_bytes, Some("ship as is".len() as u64));
        assert!(!trace.steps[1].is_error);
        assert!(trace.steps[2].is_error);
        assert!(trace.steps[2].result_bytes.unwrap() > 0);
    }

    #[test]
    fn reads_totals_and_the_closing_message() {
        let trace = parse(STREAM);
        assert_eq!(trace.duration_ms, Some(27709));
        assert_eq!(trace.turns, Some(44));
        assert_eq!(trace.cost_usd_micros, Some(191_148));
        assert_eq!(trace.input_tokens, Some(2));
        assert_eq!(trace.subtype.as_deref(), Some("success"));
        assert!(!trace.is_error);
        assert_eq!(
            trace.final_message.as_deref(),
            Some("Prior feedback honored: oz answered ship as is.")
        );
        assert_eq!(
            trace.started_at.as_deref(),
            Some("2026-08-12T16:58:16.021Z")
        );
        assert_eq!(trace.ended_at.as_deref(), Some("2026-08-12T16:58:24.000Z"));
    }

    #[test]
    fn counts_lines_it_could_not_parse_instead_of_failing() {
        let trace = parse(STREAM);
        assert_eq!(trace.unparsed_lines, 1);
    }

    #[test]
    fn truncates_on_character_boundaries() {
        let long = "é".repeat(TARGET_LIMIT + 10);
        let input = json!({ "command": long });
        let target = target_of(&input).unwrap();
        assert!(target.ends_with("..."));
        assert_eq!(target.chars().count(), TARGET_LIMIT + 3);
    }

    #[test]
    fn an_empty_transcript_yields_an_empty_trace() {
        let trace = parse("");
        assert!(trace.steps.is_empty());
        assert_eq!(trace.tool_calls(), 0);
        assert!(trace.model.is_none());
    }
}
