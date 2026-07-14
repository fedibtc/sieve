use anyhow::{bail, Context, Result};
use serde::Serialize;
use serde_json::{json, Value};
use std::{
    env, fs,
    path::{Path, PathBuf},
    process::Command,
};

pub const DEFAULT_POLICY: &str =
    include_str!("../../skills/sieve/references/default-review-policy.md");
pub const POLICY_TEMPLATE: &str =
    include_str!("../../skills/sieve/references/review-policy-template.md");

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PolicyFrontmatter {
    pub ui_paths: Option<Vec<String>>,
}

#[derive(Debug, Clone)]
pub struct ProjectPolicy {
    pub path: PathBuf,
    pub markdown: String,
    pub frontmatter: PolicyFrontmatter,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Default)]
pub struct EffectivePolicy {
    pub project: Option<ProjectPolicy>,
    pub discovery_warnings: Vec<String>,
}

impl EffectivePolicy {
    pub fn ui_paths(&self) -> Option<&[String]> {
        self.project.as_ref()?.frontmatter.ui_paths.as_deref()
    }

    pub fn warnings(&self) -> Vec<String> {
        let mut warnings = self.discovery_warnings.clone();
        if let Some(project) = &self.project {
            warnings.extend(project.warnings.clone());
        }
        warnings
    }

    pub fn status_json(&self) -> Value {
        json!({
            "present": self.project.is_some(),
            "path": self.project.as_ref().map(|project| project.path.display().to_string()),
            "uiPaths": self.ui_paths().unwrap_or(&[]),
            "warnings": self.warnings(),
        })
    }

    pub fn show_json(&self) -> Value {
        json!({
            "default": DEFAULT_POLICY,
            "project": self.project.as_ref().map(|project| json!({
                "path": project.path.display().to_string(),
                "markdown": project.markdown,
                "frontmatter": project.frontmatter,
                "warnings": project.warnings,
            })),
            "effective": { "uiPaths": self.ui_paths().unwrap_or(&[]) },
        })
    }
}

pub fn discover() -> EffectivePolicy {
    discover_from(&env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
}

pub fn discover_from(start: &Path) -> EffectivePolicy {
    let Some(root) = git_root(start) else {
        return EffectivePolicy::default();
    };
    let mut cursor = start.to_path_buf();
    loop {
        let candidate = cursor.join(".sieve/review-policy.md");
        if candidate.is_file() {
            return match fs::read_to_string(&candidate) {
                Ok(markdown) => {
                    let (frontmatter, warnings) = parse_frontmatter(&markdown);
                    EffectivePolicy {
                        project: Some(ProjectPolicy {
                            path: candidate,
                            markdown,
                            frontmatter,
                            warnings,
                        }),
                        discovery_warnings: vec![],
                    }
                }
                Err(error) => EffectivePolicy {
                    project: None,
                    discovery_warnings: vec![format!(
                        "failed to read project review policy: {error}"
                    )],
                },
            };
        }
        if cursor == root || !cursor.pop() {
            break;
        }
    }
    EffectivePolicy::default()
}

pub fn show_human(policy: &EffectivePolicy) -> String {
    let mut output = String::from(DEFAULT_POLICY.trim_end());
    output.push_str("\n\n---\n\n# Project Review Policy\n\n");
    if let Some(project) = &policy.project {
        output.push_str("The project section below is authoritative where it conflicts with defaults. It may tighten or relax defaults, but cannot relax grounding and honesty invariants.\n\n");
        output.push_str(project.markdown.trim());
    } else {
        output.push_str("No project policy found; defaults apply. Run `sieve policy init` to create `.sieve/review-policy.md`.");
    }
    output.push('\n');
    output
}

pub fn init(force: bool) -> Result<Value> {
    let cwd = env::current_dir()?;
    let root = git_root(&cwd).context("policy init must run inside a git repository")?;
    let path = root.join(".sieve/review-policy.md");
    if path.exists() && !force {
        bail!(
            "{} already exists; pass --force to overwrite",
            path.display()
        );
    }
    fs::create_dir_all(path.parent().expect("policy parent"))?;
    fs::write(&path, POLICY_TEMPLATE)?;
    Ok(json!({
        "created": path.display().to_string(),
        "hint": "Link .sieve/review-policy.md from the repository's AGENTS.md or CLAUDE.md",
    }))
}

pub fn parse_frontmatter(markdown: &str) -> (PolicyFrontmatter, Vec<String>) {
    let mut parsed = PolicyFrontmatter::default();
    let mut warnings = vec![];
    let mut lines = markdown.lines().enumerate();
    let Some((_, first)) = lines.next() else {
        return (parsed, warnings);
    };
    if first.trim() != "---" {
        return (parsed, warnings);
    }
    let mut current_key: Option<String> = None;
    let mut ui_paths = vec![];
    let mut ui_paths_declared = false;
    let mut closed = false;
    for (index, raw) in lines {
        let line = raw.trim();
        if line == "---" {
            closed = true;
            break;
        }
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some(value) = line.strip_prefix("- ") {
            if current_key.as_deref() != Some("ui-paths") {
                warnings.push(format!(
                    "policy frontmatter line {} has a list item without a supported list key",
                    index + 1
                ));
                continue;
            }
            let value = unquote(value.trim());
            if value.is_empty() {
                warnings.push(format!(
                    "policy frontmatter line {} has an empty ui-path",
                    index + 1
                ));
            } else {
                ui_paths.push(value.to_string());
            }
            continue;
        }
        let Some((key, value)) = line.split_once(':') else {
            warnings.push(format!(
                "policy frontmatter unreadable at line {}; mechanical checks disabled",
                index + 1
            ));
            return (PolicyFrontmatter::default(), warnings);
        };
        let key = key.trim();
        let value = value.trim();
        current_key = Some(key.to_string());
        match key {
            "ui-paths" => {
                ui_paths_declared = true;
                if value == "[]" || value.is_empty() {
                    // Empty scalar opens a list; [] explicitly declares no paths.
                } else {
                    warnings.push(format!(
                        "policy frontmatter ui-paths must be a list or [] (line {})",
                        index + 1
                    ));
                    return (PolicyFrontmatter::default(), warnings);
                }
            }
            other => warnings.push(format!("unknown policy frontmatter key `{other}`")),
        }
    }
    if !closed {
        warnings.push(
            "policy frontmatter unreadable: missing closing ---; mechanical checks disabled"
                .to_string(),
        );
        return (PolicyFrontmatter::default(), warnings);
    }
    if ui_paths_declared {
        parsed.ui_paths = Some(ui_paths);
    }
    (parsed, warnings)
}

fn unquote(value: &str) -> &str {
    if value.len() >= 2
        && ((value.starts_with('"') && value.ends_with('"'))
            || (value.starts_with('\'') && value.ends_with('\'')))
    {
        &value[1..value.len() - 1]
    } else {
        value
    }
}

fn git_root(start: &Path) -> Option<PathBuf> {
    let output = Command::new("git")
        .args(["rev-parse", "--show-toplevel"])
        .current_dir(start)
        .output()
        .ok()?;
    output
        .status
        .success()
        .then(|| PathBuf::from(String::from_utf8_lossy(&output.stdout).trim()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn git(path: &Path, args: &[&str]) {
        let status = Command::new("git")
            .args(args)
            .current_dir(path)
            .status()
            .unwrap();
        assert!(status.success());
    }

    #[test]
    fn parses_supported_frontmatter_and_warns_on_unknown_keys() {
        let (frontmatter, warnings) = parse_frontmatter("---\nui-paths:\n  - \"src/**/*.tsx\"\n  - src/**/*.css\nfuture-key: yes\n---\n# Policy\n");
        assert_eq!(
            frontmatter.ui_paths.unwrap(),
            ["src/**/*.tsx", "src/**/*.css"]
        );
        assert_eq!(warnings, ["unknown policy frontmatter key `future-key`"]);
    }

    #[test]
    fn supports_explicit_empty_ui_paths() {
        let (frontmatter, warnings) = parse_frontmatter("---\nui-paths: []\n---\n");
        assert_eq!(frontmatter.ui_paths, Some(vec![]));
        assert!(warnings.is_empty());
    }

    #[test]
    fn malformed_frontmatter_disables_mechanical_keys() {
        let (frontmatter, warnings) = parse_frontmatter("---\nui-paths:\nnot valid\n---\n");
        assert!(frontmatter.ui_paths.is_none());
        assert!(warnings[0].contains("mechanical checks disabled"));
    }

    #[test]
    fn discovers_policy_from_repository_subdirectory() {
        let repo = tempfile::tempdir().unwrap();
        git(repo.path(), &["init", "-b", "master"]);
        let nested = repo.path().join("packages/app");
        fs::create_dir_all(&nested).unwrap();
        fs::create_dir_all(repo.path().join(".sieve")).unwrap();
        fs::write(
            repo.path().join(".sieve/review-policy.md"),
            "---\nui-paths:\n  - app/**/*.tsx\n---\n# App\n",
        )
        .unwrap();
        let policy = discover_from(&nested);
        assert!(policy.project.is_some());
        assert_eq!(policy.ui_paths().unwrap(), ["app/**/*.tsx"]);
    }

    #[test]
    fn absence_is_a_clean_default_state() {
        let repo = tempfile::tempdir().unwrap();
        git(repo.path(), &["init", "-b", "master"]);
        let policy = discover_from(repo.path());
        assert!(policy.project.is_none());
        assert!(policy.warnings().is_empty());
    }
}
