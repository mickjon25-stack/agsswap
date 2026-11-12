// Minimal Markdown → HTML for our own trusted legal pages (headings, lists, tables, > notes, bold/italic, links).
function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function inline(s: string) {
  return esc(s)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, t, h) => {
      const ext = /^https?:/.test(h);
      return `<a href="${h}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ""}>${t}</a>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,})\b/g, '<a href="mailto:$1">$1</a>');
}
export function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim() === "---") { i++; continue; }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) { const lvl = Math.min(h[1].length + 1, 4); out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`); i++; continue; }
    if (line.startsWith("> ")) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) { quote.push(inline(lines[i].slice(2))); i++; }
      out.push(`<blockquote class="legal-draft">${quote.join("<br />")}</blockquote>`);
      continue;
    }
    if (line.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        const cells = lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (!cells.every((c) => /^-+$/.test(c))) rows.push(cells);
        i++;
      }
      const [head, ...body] = rows;
      out.push(`<div class="legal-table"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }
    if (/^\s*- /.test(line)) {
      // two-level lists
      let html = "<ul>"; let inSub = false; let open = false;
      while (i < lines.length && /^\s*- /.test(lines[i])) {
        const sub = /^\s{2,}- /.test(lines[i]);
        const text = inline(lines[i].replace(/^\s*- /, ""));
        if (sub) { if (!inSub) { html += "<ul>"; inSub = true; } html += `<li>${text}</li>`; }
        else { if (inSub) { html += "</ul>"; inSub = false; } if (open) html += "</li>"; html += `<li>${text}`; open = true; }
        i++;
      }
      if (inSub) html += "</ul>"; if (open) html += "</li>";
      out.push(html + "</ul>"); continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#|\||> |\s*- )/.test(lines[i]) && lines[i].trim() !== "---") { para.push(inline(lines[i])); i++; }
    out.push(`<p>${para.join("<br />")}</p>`);
  }
  return out.join("\n");
}
