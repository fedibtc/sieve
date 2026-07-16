use anyhow::{bail, Context, Result};
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

#[derive(Debug, Clone)]
pub struct ProjectPolicy {
    pub path: PathBuf,
    pub markdown: String,
}

#[derive(Debug, Clone, Default)]
pub struct EffectivePolicy {
    pub project: Option<ProjectPolicy>,
    pub discovery_warnings: Vec<String>,
}

impl EffectivePolicy {
    pub fn warnings(&self) -> Vec<String> {
        self.discovery_warnings.clone()
    }

    pub fn status_json(&self) -> Value {
        json!({
            "present": self.project.is_some(),
            "path": self.project.as_ref().map(|project| project.path.display().to_string()),
            "warnings": self.warnings(),
        })
    }

    pub fn show_json(&self) -> Value {
        json!({
            "default": DEFAULT_POLICY,
            "project": self.project.as_ref().map(|project| json!({
                "path": project.path.display().to_string(),
                "markdown": project.markdown,
            })),
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
                Ok(markdown) => EffectivePolicy {
                    project: Some(ProjectPolicy {
                        path: candidate,
                        markdown,
                    }),
                    discovery_warnings: vec![],
                },
                Err(error) => EffectivePolicy {
                    project: None,
                    discovery_warnings: vec![format!(
                        "failed to read project review guidance: {error}"
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
    output.push_str("\n\n---\n\n# Project Review Guidance\n\n");
    if let Some(project) = &policy.project {
        output.push_str("Use the project section below as repository-specific authoring guidance. Sieve does not mechanically enforce it.\n\n");
        output.push_str(project.markdown.trim());
    } else {
        output.push_str("No project guidance found. Run `sieve policy init` to create `.sieve/review-policy.md`.");
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
    fn discovers_guidance_from_repository_subdirectory() {
        let repo = tempfile::tempdir().unwrap();
        git(repo.path(), &["init", "-b", "master"]);
        let nested = repo.path().join("packages/app");
        fs::create_dir_all(&nested).unwrap();
        fs::create_dir_all(repo.path().join(".sieve")).unwrap();
        fs::write(
            repo.path().join(".sieve/review-policy.md"),
            "# App review guidance\n",
        )
        .unwrap();
        let policy = discover_from(&nested);
        assert_eq!(
            policy
                .project
                .as_ref()
                .map(|project| project.markdown.as_str()),
            Some("# App review guidance\n")
        );
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
