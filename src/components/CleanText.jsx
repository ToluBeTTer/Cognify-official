import React from "react";

/**
 * Renders AI/tutor text in a clean, readable format.
 * Converts markdown-style formatting into proper readable text
 * without showing raw symbols like **, __, ##, $, \, etc.
 */
export default function CleanText({ text }) {
  if (!text) return null;

  const lines = text.split("\n");
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines between blocks
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Numbered list item: "1. " or "1) "
    if (/^\d+[\.\)]\s/.test(line.trim())) {
      const items = [];
      while (i < lines.length && /^\d+[\.\)]\s/.test(lines[i].trim())) {
        items.push(cleanInline(lines[i].replace(/^\d+[\.\)]\s/, "").trim()));
        i++;
      }
      elements.push(
        <ol key={i} className="list-decimal list-outside ml-5 space-y-1.5 my-2">
          {items.map((item, j) => <li key={j} className="text-sm leading-relaxed">{item}</li>)}
        </ol>
      );
      continue;
    }

    // Bullet list item: "- " or "* "
    if (/^[-*•]\s/.test(line.trim())) {
      const items = [];
      while (i < lines.length && /^[-*•]\s/.test(lines[i].trim())) {
        items.push(cleanInline(lines[i].replace(/^[-*•]\s/, "").trim()));
        i++;
      }
      elements.push(
        <ul key={i} className="list-disc list-outside ml-5 space-y-1.5 my-2">
          {items.map((item, j) => <li key={j} className="text-sm leading-relaxed">{item}</li>)}
        </ul>
      );
      continue;
    }

    // Heading: "# " or "## " or "### "
    if (/^#{1,3}\s/.test(line.trim())) {
      const level = line.match(/^(#{1,3})\s/)[1].length;
      const content = cleanInline(line.replace(/^#{1,3}\s/, "").trim());
      const cls = level === 1
        ? "font-semibold text-base mt-3 mb-1"
        : "font-semibold text-sm mt-2 mb-1 text-muted-foreground";
      elements.push(<p key={i} className={cls}>{content}</p>);
      i++;
      continue;
    }

    // Normal paragraph
    const content = cleanInline(line.trim());
    if (content) {
      elements.push(
        <p key={i} className="text-sm leading-relaxed">{content}</p>
      );
    }
    i++;
  }

  return <div className="space-y-1">{elements}</div>;
}

/**
 * Cleans inline markdown/LaTeX symbols and renders readable math/text.
 */
function cleanInline(text) {
  if (!text) return "";

  // Remove LaTeX block delimiters \[ \] and \( \)
  text = text.replace(/\\\[/g, "").replace(/\\\]/g, "");
  text = text.replace(/\\\(/g, "").replace(/\\\)/g, "");

  // Remove $$ and $ (LaTeX math delimiters) — keep the content inside
  text = text.replace(/\$\$([^$]+)\$\$/g, "$1");
  text = text.replace(/\$([^$\n]+)\$/g, "$1");

  // Fix LaTeX-style fractions: \frac{a}{b} -> a/b
  text = text.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1/$2");

  // Fix LaTeX exponents: x^{2} -> x^2, x^2 stays
  text = text.replace(/\^{([^}]+)}/g, "^$1");

  // Fix LaTeX subscripts: x_{1} -> x_1
  text = text.replace(/_{([^}]+)}/g, "_$1");

  // Fix \cdot -> ×
  text = text.replace(/\\cdot/g, "×");

  // Fix \times -> ×
  text = text.replace(/\\times/g, "×");

  // Fix \div -> ÷
  text = text.replace(/\\div/g, "÷");

  // Fix \pm -> ±
  text = text.replace(/\\pm/g, "±");

  // Fix \sqrt{x} -> sqrt(x)
  text = text.replace(/\\sqrt\{([^}]+)\}/g, "sqrt($1)");
  text = text.replace(/\\sqrt/g, "sqrt");

  // Fix \leq -> <=, \geq -> >=, \neq -> ≠
  text = text.replace(/\\leq/g, "<=");
  text = text.replace(/\\geq/g, ">=");
  text = text.replace(/\\neq/g, "≠");

  // Remove remaining backslash commands like \text{}, \left, \right
  text = text.replace(/\\text\{([^}]+)\}/g, "$1");
  text = text.replace(/\\left/g, "");
  text = text.replace(/\\right/g, "");
  text = text.replace(/\\[a-zA-Z]+/g, ""); // remove remaining \commands

  // Remove remaining curly braces used as LaTeX grouping
  text = text.replace(/\{([^}]*)\}/g, "$1");

  // Bold: **text** or __text__ -> render as bold span
  // We'll convert these to tagged segments
  const parts = [];
  const boldRegex = /\*\*(.+?)\*\*|__(.+?)__/g;
  let last = 0;
  let match;
  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(<strong key={match.index} className="font-semibold text-foreground">{match[1] || match[2]}</strong>);
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));

  // If no bold found, just return the cleaned string
  if (parts.length === 1 && typeof parts[0] === "string") return parts[0];
  return parts.length > 0 ? parts : text;
}