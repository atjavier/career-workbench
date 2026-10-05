
function extractFirstJsonObject(str: string): string | null {
  const start = str.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < str.length; i++) {
    const char = str[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === "{") depth++;
      else if (char === "}") {
        depth--;
        if (depth === 0) {
          return str.slice(start, i + 1);
        }
      }
    }
  }
  return null;
}

export function repairJsonBrackets(source: string): string {
  let result = "";
  let inString = false;
  let escaped = false;
  const stack: ("{" | "[")[] = [];

  for (let i = 0; i < source.length; i++) {
    const ch = source[i]!;

    if (inString) {
      result += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      result += ch;
      continue;
    }

    if (ch === "{" || ch === "[") {
      stack.push(ch);
      result += ch;
      continue;
    }

    if (ch === "}") {
      const top = stack[stack.length - 1];
      if (top === "[") {
        result += "]";
        stack.pop();
        continue;
      } else if (top === "{") {
        stack.pop();
        result += ch;
        continue;
      }
    }

    if (ch === "]") {
      const top = stack[stack.length - 1];
      if (top === "{") {
        result += "}";
        stack.pop();
        continue;
      } else if (top === "[") {
        stack.pop();
        result += ch;
        continue;
      }
    }

    result += ch;
  }

  if (stack.length > 0) {
    result = result.replace(/,\s*$/, "");
    while (stack.length > 0) {
      const top = stack.pop();
      result += top === "{" ? "}" : "]";
    }
  }

  return result;
}

export function parseModelJson(content: string): Record<string, unknown> {
  const cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(cleaned);
  let source = (fenced?.[1] ?? cleaned).trim();
  const firstBrace = source.indexOf("{");
  if (firstBrace > 0) source = source.slice(firstBrace);
  try {
    return JSON.parse(source);
  } catch (firstError) {
    if (process.env.NODE_ENV === "development") {
      console.log("[parseModelJson raw model output before edits]:\n", source);
    }
    let repaired = "";
    let inString = false;
    let escaped = false;
    for (const character of source) {
      if (inString && /[\u0000-\u001f]/.test(character)) {
        repaired += JSON.stringify(character).slice(1, -1);
        escaped = false;
        continue;
      }
      repaired += character;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === "\\") {
        escaped = true;
        continue;
      }
      if (character === '"') inString = !inString;
    }
    // Qwen occasionally emits its supplied SHA references as bare hexadecimal
    // tokens. Repair only those tokens within evidenceIndexes arrays; never
    // relax the envelope or accept arbitrary JavaScript syntax.
    repaired = repaired
      .replace(
        /("evidenceIndexes"\s*:\s*\[)([^\]]*)(\])/g,
        (_match, opening, indexes, closing) =>
          `${opening}${indexes.replace(/(^|,)(\s*)([a-f0-9]{64})(\s*)(?=,|$)/gi, '$1$2"$3"$4')}${closing}`,
      )
      // Qwen can place an empty per-edit unknowns property between edit
      // objects. Removing only that empty malformed fragment restores JSON
      // without adding model content or weakening the response schema.
      .replace(
        /,\s*"unknowns"\s*:\s*\[\s*(?:""\s*)?\]\s*}(?=\s*,\s*\{\s*"sectionIndex")/g,
        "",
      )
      // At end-of-response Qwen can close the dangling member before the
      // edits array, yielding `…}]` instead of the required `…]}`.
      .replace(
        /(?<=})\s*,\s*"unknowns"\s*:\s*\[\s*(?:""\s*)?\]\s*}\s*](?=\s*$)/g,
        "]}",
      )
      // A dangling member can also appear before an already valid root close.
      .replace(
        /(?<=})\s*,\s*"unknowns"\s*:\s*\[\s*(?:""\s*)?\]\s*}(?=\s*\])/g,
        "",
      )
      // Or it can be the final property within an edit. Preserve that edit's
      // closing brace while removing the empty non-contract property.
      .replace(
        /(?<=])\s*,\s*"unknowns"\s*:\s*\[\s*(?:""\s*)?\](?=\s*}\s*\])/g,
        "",
      )
      // Qwen can emit {"unknowns": [...]} at the end of the edits array,
      // frequently ending with `]]` or `}]` instead of closing edits and placing
      // unknowns at the root. Restructure it into a valid root property.
      .replace(
        /,\s*\{\s*"unknowns"\s*:\s*(\[[^\]]*\])\s*\}?\s*\]\s*\}?\s*$/g,
        '],"unknowns":$1}',
      )
      // Gemma can re-emit a duplicate `"claims": [` key between claim objects
      // inside an already open claims array. Flattening that duplicate key
      // restores the valid claims array without losing claims or citations.
      .replace(
        /(?<=\})\s*,?\s*"claims"\s*:\s*\[\s*(?=\{)/g,
        ",",
      )
      // Gemma can emit an unclosed claim followed by a new project text and claims key
      // (e.g. `},\n "Personal-Job-Discovery-Workplace | ...",\n "claims": [`)
      // instead of closing the previous edit and starting a new edit object.
      // Restructure it into a valid second edit object for that slot.
      .replace(
        /\},\s*"([A-Za-z0-9_-]+ \| [^"]+)"\s*,\s*"claims"\s*:\s*\[/g,
        `]}]},{"slotId":"projects","text":"$1","claims":[`
      )
      // Gemma can close a claims array with a curly brace `}` instead of a square bracket `]`
      // before closing the edit object (e.g. `}\n }\n },\n {` instead of `}\n ]\n },\n {`).
      // Restoring the closing bracket `]` ensures claims and edits parse correctly.
      .replace(
        /(?<=(?:\}\s*\]|\])\s*\}\s*)\s*\}\s*\}(?=\s*(?:,\s*\{|,?\s*"unknowns"|\]|\}))/g,
        "]}",
      )
      // Models can close a string array (such as bullets, unknowns, or techStack) with a curly brace `}`
      // instead of a square bracket `]`.
      .replace(
        /("bullets"|"unknowns"|"techStack"|"evidenceIndexes"|"clarificationIndexes")\s*:\s*\[([^\]]*?)\}(?=\s*(?:\}|\]|,))/g,
        "$1: [$2]",
      )
      // Gemma can emit "text_2": "...", "claims_2": [...] inside the same edit object
      // instead of closing the edit and starting a new edit object.
      // Restructure it into a valid second edit object for the projects slot.
      .replace(
        /(?:\]|\})\s*,\s*"text_?\d+"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"claims_?\d+"\s*:\s*\[/g,
        `]}]},{"slotId":"projects","text":"$1","claims":[`
      )
      // Gemma can emit a stray quote and omit closing brackets between edits
      // (e.g. `}]}" ,"slotId":` instead of `}]},{"slotId":`).
      .replace(/(?<=\}\s*\]\s*\}\s*)"\s*,\s*"slotId"\s*:/g, ']}]},{"slotId":')
      // Gemma can omit the edit object and edits array closing tokens before
      // the unknowns property (e.g. `}]}], "unknowns":` instead of `}]}]}], "unknowns":`).
      .replace(
        /(?<!\}\s*\]\s*\}\s*\]\s*\}\s*\])(?<=\}\s*\]\s*\}\s*\])\s*,\s*("unknowns"\s*:)/g,
        "],$1",
      )
      .replace(
        /(?<!\}\s*\]\s*\}\s*\]\s*\}\s*\])(?<=\}\s*\]\s*\}\s*\])\s*\}\s*$/g,
        "}]}}",
      );
    const candidates = [
      repairJsonBrackets(source),
      repaired,
      repairJsonBrackets(repaired),
      repaired.replace(/(?<=})\s*,\s*"unknowns"\s*:/g, '],"unknowns":'),
      repaired.replace(/(?<=\])\s*\}\s*,\s*"unknowns"\s*:/g, ',"unknowns":'),
    ];
    const balancedRepaired = extractFirstJsonObject(repaired);
    if (balancedRepaired && !candidates.includes(balancedRepaired)) {
      candidates.push(balancedRepaired);
    }
    const lastBrace = repaired.lastIndexOf("}");
    if (lastBrace > 0 && lastBrace < repaired.length - 1) {
      candidates.push(repaired.slice(0, lastBrace + 1));
    }
    for (const [idx, candidate] of candidates.entries()) {
      try {
        return JSON.parse(candidate);
      } catch (candidateError) {
        if (process.env.NODE_ENV === "development") {
          console.error(
            `[parseModelJson candidate ${idx} error]:`,
            (candidateError as Error).message,
            "tail:",
            candidate.slice(-60),
          );
        }
      }
    }
    const firstBalanced = extractFirstJsonObject(source);
    if (firstBalanced && firstBalanced !== source) {
      try {
        return JSON.parse(firstBalanced);
      } catch {}
    }
    const posMatch = /after JSON at position (\d+)/i.exec(
      (firstError as Error)?.message ?? "",
    );
    if (posMatch) {
      const truncated = source.slice(0, Number(posMatch[1])).trim();
      try {
        return JSON.parse(truncated);
      } catch {}
    }
    throw firstError;
  }
}

