const headings = new Set(["About the role", "Responsibilities", "Requirements", "About the company", "Benefits", "How to apply", "Additional details"]);
const sourceHeading = (line: string): string | undefined => {
  const canonical = [...headings].find(heading => heading.toLowerCase() === line.replace(/:$/, "").trim().toLowerCase());
  if (canonical) return canonical;
  if (/^(?:about the job|job description|position summary|role summary|role overview|job summary)\s*:?$/i.test(line)) return "About the role";
  if (/^(?:tasks\s*\/\s*responsibilities|responsibilities|essential duties and responsibilities)\s*:?$/i.test(line)) return "Responsibilities";
  if (/^(?:requirements?(?:\s+skills\s*\/\s*experience)?|qualifications|skills|required qualifications|preferred qualifications|professional experience\s*\/\s*qualifications|critical competencies)\s*:?$/i.test(line)) return "Requirements";
  if (/^about\s+(?!the (?:role|job)\b).+/i.test(line)) return "About the company";
  if (/^(?:benefits|perks)\s*:?$/i.test(line)) return "Benefits";
};
const cleanLine = (line: string) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim();
function render(sections: Array<{ heading: string; excerpts: string[] }>): string {
  return sections.map(({heading,excerpts}) => `${heading}\n${excerpts.map(line => ["Responsibilities","Requirements","Benefits"].includes(heading) ? `• ${cleanLine(line)}` : line).join("\n")}`).join("\n\n");
}
/** Only organize original lines; never accept model-written replacement prose. */
export function refineOpportunityDescription(output: unknown, source: string): string {
  const lines = [...new Set(source.split(/\r?\n/).map(line => line.trim()).filter(Boolean))];
  const body = lines.filter(line => !sourceHeading(line));
  const sections: Array<{heading:string;excerpts:string[]}> = [];
  let heading = "About the role";
  for (const line of lines) {
    const next = sourceHeading(line);
    if (next) { heading = next; continue; }
    if (/^(?:do you like|join our talent|to apply|apply now|if this job)\b/i.test(line)) heading = "How to apply";
    if (/^\d+\s+.+\b(?:Inc\.?|Ltd\.?|LLC|Corporation)$/i.test(line)) heading = "About the company";
    let section = sections.at(-1);
    if (!section || section.heading !== heading) { section = {heading,excerpts:[]}; sections.push(section); }
    section.excerpts.push(line);
  }
  const sectionForLine = new Map(sections.flatMap(section => section.excerpts.map(line => [line, section.heading] as const)));
  const supplied = output && typeof output === "object" && !Array.isArray(output) ? (output as Record<string,unknown>).descriptionSections : undefined;
  if (Array.isArray(supplied) && supplied.length > 0 && supplied.length <= 8) {
    const seen = new Set<string>();
    const sections: Array<{heading:string;excerpts:string[]}> = [];
    let valid = true;
    for (const item of supplied) {
      if (!item || typeof item !== "object" || Array.isArray(item)) { valid = false; break; }
      const record = item as Record<string,unknown>;
      if (Object.keys(record).some(key => !["heading","excerpts"].includes(key)) || typeof record.heading !== "string" || !headings.has(record.heading) || !Array.isArray(record.excerpts) || record.excerpts.length > lines.length) { valid = false; break; }
      const excerpts: string[] = [];
      for (const excerpt of record.excerpts) {
        if (typeof excerpt !== "string" || !body.includes(excerpt) || sectionForLine.get(excerpt) !== record.heading) { valid = false; break; }
        if (!seen.has(excerpt)) { seen.add(excerpt); excerpts.push(excerpt); }
      }
      if (!valid) break;
      if (excerpts.length) sections.push({heading:record.heading,excerpts});
    }
    if (valid && body.every(line => seen.has(line))) return render(sections);
  }
  return render(sections);
}
export function formatRoleTitle(value: string): string {
  return value.replace(/[A-Za-z][A-Za-z0-9+#.]*/g, word => {
    const brands = ["iOS", "macOS", "JavaScript", "TypeScript", "Node.js", "GitHub", "GitLab", "NET"];
    const brand = brands.find(name => name.toLowerCase() === word.toLowerCase());
    if (brand) return brand;
    if (["api","qa","ui","ux","sql","aws","devops","cto","cfo","ceo","it","hr","ai","ml","sre"].includes(word.toLowerCase())) return word.toLowerCase() === "devops" ? "DevOps" : word.toUpperCase();
    return word[0].toUpperCase() + word.slice(1).toLowerCase();
  });
}
