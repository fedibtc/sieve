import { common, createLowlight } from "lowlight";
import type { ReactNode } from "react";

const lowlight = createLowlight(common);

export type HighlightToken = {
  className?: string;
  text: string;
  emphasized?: boolean;
};

export type HighlightLine = HighlightToken[];

export function highlightCode(value: string, language?: string) {
  return renderHighlightLine(highlightCodeLine(value, language));
}

export function highlightCodeLines(
  value: string,
  language?: string,
): HighlightLine[] {
  const normalizedLanguage = normalizeHighlightLanguage(language);
  try {
    const tree = normalizedLanguage
      ? lowlight.highlight(normalizedLanguage, value)
      : { children: [{ type: "text", value }] };
    const lines: HighlightLine[] = [[]];
    for (const token of flattenLowlightNodes(tree.children)) {
      const parts = token.text.split("\n");
      for (const [index, part] of parts.entries()) {
        if (index > 0) {
          lines.push([]);
        }
        if (part) {
          lines[lines.length - 1]?.push({ ...token, text: part });
        }
      }
    }
    return lines.length > 0 ? lines : [[]];
  } catch {
    return value.split("\n").map((text) => [{ text }]);
  }
}

export function highlightCodeLine(
  value: string,
  language?: string,
): HighlightLine {
  const normalizedLanguage = normalizeHighlightLanguage(language);
  try {
    const tree = normalizedLanguage
      ? lowlight.highlight(normalizedLanguage, value)
      : lowlight.highlightAuto(value);
    return flattenLowlightNodes(tree.children);
  } catch {
    return [{ text: value }];
  }
}

type LowlightNode = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: { className?: string[] };
  children?: LowlightNode[];
};

function flattenLowlightNodes(
  nodes: LowlightNode[] = [],
  inheritedClassName?: string,
): HighlightToken[] {
  return nodes.flatMap((node) => {
    if (node.type === "text") {
      return [{ className: inheritedClassName, text: node.value ?? "" }];
    }
    const className = node.properties?.className?.join(" ");
    return flattenLowlightNodes(
      node.children,
      [inheritedClassName, className].filter(Boolean).join(" ") || undefined,
    );
  });
}

export function renderHighlightLine(
  tokens: HighlightLine = [],
  emphasisClass = "",
): ReactNode[] {
  return tokens.map((token, index) => {
    const className = [token.className, token.emphasized ? emphasisClass : ""]
      .filter(Boolean)
      .join(" ");
    if (!className && !token.emphasized) {
      return token.text;
    }
    return (
      <span
        className={className || undefined}
        data-diff-emphasis={token.emphasized ? "" : undefined}
        // biome-ignore lint/suspicious/noArrayIndexKey: lowlight token spans are stateless render output.
        key={`${className}:${index}`}
      >
        {token.text}
      </span>
    );
  });
}

// aliases onto the grammar names lowlight's common set registers
const languageAliases: Record<string, string> = {
  bash: "bash",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  c: "c",
  h: "c",
  cc: "cpp",
  cpp: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  cs: "csharp",
  css: "css",
  diff: "diff",
  patch: "diff",
  go: "go",
  graphql: "graphql",
  gql: "graphql",
  html: "xml",
  plist: "xml",
  svg: "xml",
  xml: "xml",
  ini: "ini",
  toml: "ini",
  java: "java",
  cjs: "javascript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  json: "json",
  kt: "kotlin",
  kts: "kotlin",
  less: "less",
  lua: "lua",
  makefile: "makefile",
  mk: "makefile",
  markdown: "markdown",
  md: "markdown",
  m: "objectivec",
  objc: "objectivec",
  pl: "perl",
  php: "php",
  py: "python",
  python: "python",
  r: "r",
  rb: "ruby",
  ruby: "ruby",
  rs: "rust",
  rust: "rust",
  scss: "scss",
  sql: "sql",
  swift: "swift",
  ts: "typescript",
  tsx: "typescript",
  typescript: "typescript",
  yaml: "yaml",
  yml: "yaml",
};

export function normalizeHighlightLanguage(language?: string) {
  const normalized = language?.toLowerCase();
  if (!normalized) {
    return undefined;
  }
  return languageAliases[normalized] ?? normalized;
}

export function inferLanguageFromFilename(filename: string, language?: string) {
  if (language) {
    return normalizeHighlightLanguage(language);
  }
  const basename = filename.split("/").pop() ?? filename;
  if (/^makefile$/i.test(basename)) {
    return "makefile";
  }
  const extension = basename.includes(".")
    ? basename.split(".").pop()?.toLowerCase()
    : undefined;
  return extension ? languageAliases[extension] : undefined;
}
