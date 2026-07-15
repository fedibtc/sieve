use crate::{upload_png, ApiClient, BLOCK_SCHEMA, MAX_ATTACHMENT_BYTES};
use anyhow::{anyhow, bail, Context, Result};
use clap::Args;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, BTreeSet},
    env, fs,
    io::Cursor,
    path::{Path, PathBuf},
};

#[derive(Args, Debug)]
pub struct VisualDiffArgs {
    #[arg(long)]
    after: PathBuf,
    #[arg(long)]
    before: Option<PathBuf>,
    #[arg(long)]
    baseline_ref: Option<String>,
    #[arg(long, default_value_t = 0.05)]
    threshold: f64,
    #[arg(long, default_value_t = 0.1)]
    pixel_threshold: f64,
    #[arg(long, default_value_t = 10)]
    max_blocks: usize,
    #[arg(long)]
    diff_dir: Option<PathBuf>,
    #[arg(long)]
    manifest_only: bool,
    #[arg(short = 'o', long)]
    output: Option<PathBuf>,
}

#[derive(Debug, Clone)]
struct Image {
    width: u32,
    height: u32,
    rgba: Vec<u8>,
}

#[derive(Debug)]
struct Item {
    name: String,
    status: &'static str,
    before: Option<PathBuf>,
    after: Option<PathBuf>,
    diff: Option<PathBuf>,
    summary: Option<String>,
}

pub fn run(client: &ApiClient, args: VisualDiffArgs) -> Result<Value> {
    if !(0.0..=100.0).contains(&args.threshold) {
        bail!("--threshold must be between 0 and 100 percent");
    }
    if !(0.0..=1.0).contains(&args.pixel_threshold) {
        bail!("--pixel-threshold must be between 0 and 1");
    }
    let diff_dir = args.diff_dir.clone().unwrap_or_else(|| {
        env::temp_dir().join(format!("sieve-visual-diff-{}", std::process::id()))
    });
    fs::create_dir_all(&diff_dir)?;

    let after = collect_pngs(&args.after)?;
    let before = args
        .before
        .as_ref()
        .map(|path| collect_pngs(path))
        .transpose()?
        .unwrap_or_default();
    let mut names = BTreeSet::new();
    names.extend(after.keys().cloned());
    names.extend(before.keys().cloned());
    let mut changed = vec![];
    let mut added = vec![];
    let mut removed = vec![];
    let mut unchanged = 0usize;

    for name in names {
        match (before.get(&name), after.get(&name)) {
            (Some(before_path), Some(after_path)) => {
                let before_image = decode_png(before_path)?;
                let after_image = decode_png(after_path)?;
                if before_image.width != after_image.width
                    || before_image.height != after_image.height
                {
                    let overlay =
                        compare_dimension_change(&before_image, &after_image, args.pixel_threshold);
                    let overlay_path = diff_dir.join(format!("{}.png", name));
                    if let Some(parent) = overlay_path.parent() {
                        fs::create_dir_all(parent)?;
                    }
                    encode_png(&overlay_path, &overlay)?;
                    changed.push(Item {
                        name,
                        status: "changed",
                        before: Some(before_path.clone()),
                        after: Some(after_path.clone()),
                        diff: Some(overlay_path),
                        summary: Some(format!(
                            "dimensions changed {}×{} → {}×{}",
                            before_image.width,
                            before_image.height,
                            after_image.width,
                            after_image.height
                        )),
                    });
                    continue;
                }
                let (ratio, overlay) = compare(&before_image, &after_image, args.pixel_threshold);
                if ratio * 100.0 > args.threshold {
                    let overlay_path = diff_dir.join(format!("{}.png", name));
                    if let Some(parent) = overlay_path.parent() {
                        fs::create_dir_all(parent)?;
                    }
                    encode_png(&overlay_path, &overlay)?;
                    changed.push(Item {
                        name,
                        status: "changed",
                        before: Some(before_path.clone()),
                        after: Some(after_path.clone()),
                        diff: Some(overlay_path),
                        summary: None,
                    });
                } else {
                    unchanged += 1;
                }
            }
            (None, Some(after_path)) => added.push(Item {
                name,
                status: "added",
                before: None,
                after: Some(after_path.clone()),
                diff: None,
                summary: None,
            }),
            (Some(before_path), None) => removed.push(Item {
                name,
                status: "removed",
                before: Some(before_path.clone()),
                after: None,
                diff: None,
                summary: None,
            }),
            (None, None) => unreachable!(),
        }
    }

    let counts = (changed.len(), added.len(), removed.len(), unchanged);
    let ordered = changed
        .into_iter()
        .chain(added)
        .chain(removed)
        .collect::<Vec<_>>();
    let omitted = ordered
        .iter()
        .skip(args.max_blocks)
        .map(|item| item.name.clone())
        .collect::<Vec<_>>();
    let mut blocks = vec![];
    let mut block_ids = BTreeSet::new();
    for item in ordered.iter().take(args.max_blocks) {
        let before_value = item
            .before
            .as_ref()
            .map(|path| attachment(client, path, args.manifest_only))
            .transpose()?;
        let after_value = item
            .after
            .as_ref()
            .map(|path| attachment(client, path, args.manifest_only))
            .transpose()?;
        let diff_value = item
            .diff
            .as_ref()
            .map(|path| attachment(client, path, args.manifest_only))
            .transpose()?;
        let mut data = json!({ "name": item.name, "status": item.status });
        if let Some(value) = before_value {
            data["before"] = value;
        }
        if let Some(value) = after_value {
            data["after"] = value;
        }
        if let Some(value) = diff_value {
            data["diff"] = value;
        }
        if let Some(baseline_ref) = &args.baseline_ref {
            data["baseline"] = json!({ "ref": baseline_ref, "platform": format!("{}-{}", env::consts::OS, env::consts::ARCH) });
        }
        let slug = slug(&item.name);
        if slug.is_empty() {
            bail!(
                "PNG name `{}` cannot produce a stable image-diff block id",
                item.name
            );
        }
        let block_id = format!("visual-{slug}");
        if !block_ids.insert(block_id.clone()) {
            bail!("PNG names produce duplicate image-diff block id `{block_id}`");
        }
        let mut block = json!({ "id": block_id, "type": "image-diff", "data": data });
        if let Some(summary) = &item.summary {
            block["summary"] = json!(summary);
        }
        validate_block(&block)?;
        blocks.push(block);
    }
    if !omitted.is_empty() {
        let block = json!({
            "id": "visual-capture-note",
            "type": "callout",
            "data": { "tone": "info", "markdown": format!("**Additional changed screens:** {} ({} omitted after the {}-comparison cap).", omitted.join(", "), omitted.len(), args.max_blocks) }
        });
        validate_block(&block)?;
        blocks.push(block);
    }
    let mut summary = json!({
        "changed": counts.0,
        "added": counts.1,
        "removed": counts.2,
        "unchanged": counts.3,
        "omitted": omitted,
    });
    if let Some(baseline_ref) = &args.baseline_ref {
        summary["baseline"] = json!({
            "ref": baseline_ref,
            "platform": format!("{}-{}", env::consts::OS, env::consts::ARCH),
        });
    }
    let manifest = json!({ "summary": summary, "blocks": blocks });
    if let Some(output) = &args.output {
        fs::write(output, serde_json::to_string_pretty(&manifest)?)?;
        Ok(json!({ "output": output, "summary": manifest["summary"] }))
    } else {
        Ok(manifest)
    }
}

fn collect_pngs(root: &Path) -> Result<BTreeMap<String, PathBuf>> {
    if !root.is_dir() {
        bail!("PNG directory does not exist: {}", root.display());
    }
    let mut output = BTreeMap::new();
    collect_pngs_at(root, root, &mut output)?;
    Ok(output)
}

fn collect_pngs_at(
    root: &Path,
    current: &Path,
    output: &mut BTreeMap<String, PathBuf>,
) -> Result<()> {
    let mut entries = fs::read_dir(current)?.collect::<std::result::Result<Vec<_>, _>>()?;
    entries.sort_by_key(|entry| entry.file_name());
    for entry in entries {
        let path = entry.path();
        let file_type = entry.file_type()?;
        if file_type.is_dir() {
            collect_pngs_at(root, &path, output)?;
        } else if file_type.is_file()
            && path.extension().and_then(|value| value.to_str()) == Some("png")
        {
            let size = entry.metadata()?.len();
            if size > MAX_ATTACHMENT_BYTES {
                bail!(
                    "{} exceeds {MAX_ATTACHMENT_BYTES} byte PNG limit",
                    path.display()
                );
            }
            let relative = path.strip_prefix(root)?.with_extension("");
            let key = relative.to_string_lossy().replace('\\', "/");
            if output.insert(key.clone(), path.clone()).is_some() {
                bail!("duplicate PNG key `{key}`");
            }
        }
    }
    Ok(())
}

fn decode_png(path: &Path) -> Result<Image> {
    let data = fs::read(path)?;
    let mut decoder = png::Decoder::new(Cursor::new(data));
    decoder.set_transformations(png::Transformations::EXPAND | png::Transformations::STRIP_16);
    let mut reader = decoder
        .read_info()
        .with_context(|| format!("failed to decode {}", path.display()))?;
    let mut buffer = vec![0; reader.output_buffer_size()];
    let info = reader.next_frame(&mut buffer)?;
    let bytes = &buffer[..info.buffer_size()];
    let rgba = match info.color_type {
        png::ColorType::Rgba => bytes.to_vec(),
        png::ColorType::Rgb => bytes
            .chunks_exact(3)
            .flat_map(|pixel| [pixel[0], pixel[1], pixel[2], 255])
            .collect(),
        png::ColorType::GrayscaleAlpha => bytes
            .chunks_exact(2)
            .flat_map(|pixel| [pixel[0], pixel[0], pixel[0], pixel[1]])
            .collect(),
        png::ColorType::Grayscale => bytes
            .iter()
            .flat_map(|value| [*value, *value, *value, 255])
            .collect(),
        png::ColorType::Indexed => bail!("indexed PNG was not expanded: {}", path.display()),
    };
    Ok(Image {
        width: info.width,
        height: info.height,
        rgba,
    })
}

fn compare(before: &Image, after: &Image, pixel_threshold: f64) -> (f64, Image) {
    let limit = pixel_threshold * 255.0;
    let mut differing = 0usize;
    let mut rgba = Vec::with_capacity(after.rgba.len());
    for (old, new) in before.rgba.chunks_exact(4).zip(after.rgba.chunks_exact(4)) {
        let delta = (0..4)
            .map(|index| old[index].abs_diff(new[index]) as f64)
            .fold(0.0, f64::max);
        if delta > limit {
            differing += 1;
            rgba.extend_from_slice(&[255, 0, 0, 255]);
        } else {
            let gray = ((new[0] as u16 + new[1] as u16 + new[2] as u16) / 6) as u8;
            rgba.extend_from_slice(&[gray, gray, gray, 255]);
        }
    }
    let pixels = (before.width as usize) * (before.height as usize);
    (
        differing as f64 / pixels.max(1) as f64,
        Image {
            width: after.width,
            height: after.height,
            rgba,
        },
    )
}

fn compare_dimension_change(before: &Image, after: &Image, pixel_threshold: f64) -> Image {
    let width = before.width.max(after.width);
    let height = before.height.max(after.height);
    let limit = pixel_threshold * 255.0;
    let mut rgba = Vec::with_capacity((width as usize) * (height as usize) * 4);
    for y in 0..height {
        for x in 0..width {
            match (pixel_at(before, x, y), pixel_at(after, x, y)) {
                (Some(old), Some(new)) => {
                    let delta = (0..4)
                        .map(|index| old[index].abs_diff(new[index]) as f64)
                        .fold(0.0, f64::max);
                    if delta > limit {
                        rgba.extend_from_slice(&[255, 0, 0, 255]);
                    } else {
                        let gray = ((new[0] as u16 + new[1] as u16 + new[2] as u16) / 6) as u8;
                        rgba.extend_from_slice(&[gray, gray, gray, 255]);
                    }
                }
                _ => rgba.extend_from_slice(&[255, 0, 0, 255]),
            }
        }
    }
    Image {
        width,
        height,
        rgba,
    }
}

fn pixel_at(image: &Image, x: u32, y: u32) -> Option<&[u8]> {
    if x >= image.width || y >= image.height {
        return None;
    }
    let index = ((y as usize) * (image.width as usize) + (x as usize)) * 4;
    Some(&image.rgba[index..index + 4])
}

fn encode_png(path: &Path, image: &Image) -> Result<()> {
    let file = fs::File::create(path)?;
    let mut encoder = png::Encoder::new(file, image.width, image.height);
    encoder.set_color(png::ColorType::Rgba);
    encoder.set_depth(png::BitDepth::Eight);
    encoder.set_compression(png::Compression::Best);
    encoder.set_filter(png::FilterType::NoFilter);
    encoder.write_header()?.write_image_data(&image.rgba)?;
    Ok(())
}

fn attachment(client: &ApiClient, path: &Path, manifest_only: bool) -> Result<Value> {
    let data = fs::read(path)?;
    let image = decode_png(path)?;
    if manifest_only {
        let sha = hex::encode(Sha256::digest(&data));
        Ok(
            json!({ "attachmentId": format!("sha256:{sha}"), "width": image.width, "height": image.height }),
        )
    } else {
        let uploaded = upload_png(client, data)?;
        Ok(
            json!({ "attachmentId": uploaded["attachmentId"], "width": uploaded["width"], "height": uploaded["height"] }),
        )
    }
}

fn validate_block(block: &Value) -> Result<()> {
    let schema: Value = serde_json::from_str(BLOCK_SCHEMA)?;
    let compiled = jsonschema::JSONSchema::options()
        .compile(&schema)
        .map_err(|error| anyhow!(error.to_string()))?;
    if let Err(errors) = compiled.validate(block) {
        bail!(
            "generated image-diff block failed schema validation: {}",
            errors
                .map(|error| error.to_string())
                .collect::<Vec<_>>()
                .join("; ")
        );
    }
    Ok(())
}

fn slug(value: &str) -> String {
    let mut output = String::new();
    let mut dash = false;
    for character in value.chars() {
        if character.is_ascii_alphanumeric() {
            output.push(character.to_ascii_lowercase());
            dash = false;
        } else if !output.is_empty() && !dash {
            output.push('-');
            dash = true;
        }
    }
    output.trim_matches('-').chars().take(80).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ApiClient;

    #[test]
    fn comparison_respects_pixel_and_ratio_thresholds() {
        let before = Image {
            width: 2,
            height: 1,
            rgba: vec![0, 0, 0, 255, 0, 0, 0, 255],
        };
        let after = Image {
            width: 2,
            height: 1,
            rgba: vec![30, 0, 0, 255, 0, 0, 0, 255],
        };
        let (ratio, overlay) = compare(&before, &after, 0.1);
        assert_eq!(ratio, 0.5);
        assert_eq!(&overlay.rgba[..4], &[255, 0, 0, 255]);
        let (ratio, _) = compare(&before, &after, 0.2);
        assert_eq!(ratio, 0.0);
    }

    #[test]
    fn overlay_encoding_is_stable() {
        let dir = tempfile::tempdir().unwrap();
        let image = Image {
            width: 1,
            height: 1,
            rgba: vec![255, 0, 0, 255],
        };
        let one = dir.path().join("one.png");
        let two = dir.path().join("two.png");
        encode_png(&one, &image).unwrap();
        encode_png(&two, &image).unwrap();
        assert_eq!(fs::read(one).unwrap(), fs::read(two).unwrap());
    }

    #[test]
    fn emits_changed_added_removed_and_unchanged_blocks() {
        let dir = tempfile::tempdir().unwrap();
        let before = dir.path().join("before");
        let after = dir.path().join("after");
        fs::create_dir_all(before.join("nested")).unwrap();
        fs::create_dir_all(after.join("nested")).unwrap();
        let black = Image {
            width: 1,
            height: 1,
            rgba: vec![0, 0, 0, 255],
        };
        let white = Image {
            width: 1,
            height: 1,
            rgba: vec![255, 255, 255, 255],
        };
        encode_png(&before.join("changed.png"), &black).unwrap();
        encode_png(&after.join("changed.png"), &white).unwrap();
        encode_png(&before.join("same.png"), &black).unwrap();
        encode_png(&after.join("same.png"), &black).unwrap();
        encode_png(&after.join("nested/added.png"), &black).unwrap();
        encode_png(&before.join("removed.png"), &black).unwrap();
        let client = ApiClient::new("http://localhost:1".to_string(), None);
        let result = run(
            &client,
            VisualDiffArgs {
                after,
                before: Some(before),
                baseline_ref: Some("merge-base@abc".to_string()),
                threshold: 0.05,
                pixel_threshold: 0.1,
                max_blocks: 10,
                diff_dir: Some(dir.path().join("diff")),
                manifest_only: true,
                output: None,
            },
        )
        .unwrap();
        assert_eq!(
            result.pointer("/summary/changed").and_then(Value::as_u64),
            Some(1)
        );
        assert_eq!(
            result.pointer("/summary/added").and_then(Value::as_u64),
            Some(1)
        );
        assert_eq!(
            result.pointer("/summary/removed").and_then(Value::as_u64),
            Some(1)
        );
        assert_eq!(
            result.pointer("/summary/unchanged").and_then(Value::as_u64),
            Some(1)
        );
        let statuses = result["blocks"]
            .as_array()
            .unwrap()
            .iter()
            .map(|block| {
                block
                    .pointer("/data/status")
                    .and_then(Value::as_str)
                    .unwrap()
            })
            .collect::<Vec<_>>();
        assert_eq!(statuses, ["changed", "added", "removed"]);
        assert_eq!(
            result
                .pointer("/blocks/1/data/name")
                .and_then(Value::as_str),
            Some("nested/added")
        );
        assert!(result
            .pointer("/blocks/0/data/diff/attachmentId")
            .and_then(Value::as_str)
            .unwrap()
            .starts_with("sha256:"));
    }

    #[test]
    fn dimension_changes_emit_publishable_padded_overlays() {
        let dir = tempfile::tempdir().unwrap();
        let before = dir.path().join("before");
        let after = dir.path().join("after");
        fs::create_dir_all(&before).unwrap();
        fs::create_dir_all(&after).unwrap();
        encode_png(
            &before.join("screen.png"),
            &Image {
                width: 1,
                height: 1,
                rgba: vec![0, 0, 0, 255],
            },
        )
        .unwrap();
        encode_png(
            &after.join("screen.png"),
            &Image {
                width: 2,
                height: 1,
                rgba: vec![0, 0, 0, 255, 0, 0, 0, 255],
            },
        )
        .unwrap();
        let client = ApiClient::new("http://localhost:1".to_string(), None);
        let result = run(
            &client,
            VisualDiffArgs {
                after,
                before: Some(before),
                baseline_ref: None,
                threshold: 0.05,
                pixel_threshold: 0.1,
                max_blocks: 10,
                diff_dir: None,
                manifest_only: true,
                output: None,
            },
        )
        .unwrap();
        assert!(result
            .pointer("/blocks/0/data/diff/attachmentId")
            .and_then(Value::as_str)
            .unwrap()
            .starts_with("sha256:"));
        assert_eq!(
            result
                .pointer("/blocks/0/data/diff/width")
                .and_then(Value::as_u64),
            Some(2)
        );
        assert_eq!(
            result
                .pointer("/blocks/0/data/diff/height")
                .and_then(Value::as_u64),
            Some(1)
        );
        assert_eq!(
            result.pointer("/blocks/0/summary").and_then(Value::as_str),
            Some("dimensions changed 1×1 → 2×1")
        );
        assert!(result.pointer("/blocks/0/data/baseline").is_none());
        crate::validate_manifest_content(&json!({
            "content": { "version": 1, "blocks": result["blocks"] }
        }))
        .unwrap();
    }

    #[test]
    fn rejects_png_names_that_collapse_to_the_same_block_id() {
        let dir = tempfile::tempdir().unwrap();
        let after = dir.path().join("after");
        fs::create_dir_all(&after).unwrap();
        let image = Image {
            width: 1,
            height: 1,
            rgba: vec![0, 0, 0, 255],
        };
        encode_png(&after.join("a-b.png"), &image).unwrap();
        encode_png(&after.join("a_b.png"), &image).unwrap();
        let client = ApiClient::new("http://localhost:1".to_string(), None);
        let error = run(
            &client,
            VisualDiffArgs {
                after,
                before: None,
                baseline_ref: None,
                threshold: 0.05,
                pixel_threshold: 0.1,
                max_blocks: 10,
                diff_dir: None,
                manifest_only: true,
                output: None,
            },
        )
        .unwrap_err();
        assert!(error.to_string().contains("duplicate image-diff block id"));
    }
}
