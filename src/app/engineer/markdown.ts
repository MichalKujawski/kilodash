/**
 * Just enough Markdown for the feature docs (headings, paragraphs, nested
 * lists, tables, code blocks), parsed into blocks the sheet renders as React
 * elements. No HTML injection, no dependency.
 */
export type Block =
  | { type: 'h'; level: number; text: string }
  | { type: 'p'; text: string }
  | { type: 'list'; items: ListItem[] }
  | { type: 'table'; head: string[]; rows: string[][] }
  | { type: 'code'; lang: string; text: string };

export interface ListItem {
  text: string;
  children: ListItem[];
}

const cells = (line: string): string[] =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim());

export function parseMarkdown(md: string): Block[] {
  const lines = md.replace(/\r/g, '').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) {
      i++;
      continue;
    }
    const fence = line.match(/^```(\w*)/);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.startsWith('```')) body.push(lines[i++]!);
      blocks.push({ type: 'code', lang: fence[1] ?? '', text: body.join('\n') });
      i++;
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)/);
    if (h) {
      blocks.push({ type: 'h', level: h[1]!.length, text: h[2]! });
      i++;
      continue;
    }
    if (line.trim().startsWith('|')) {
      const head = cells(line);
      i += 2; // header and separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.trim().startsWith('|')) rows.push(cells(lines[i++]!));
      blocks.push({ type: 'table', head, rows });
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s/.test(line)) {
      const items: ListItem[] = [];
      const stack: { indent: number; list: ListItem[] }[] = [{ indent: -1, list: items }];
      while (
        i < lines.length &&
        (/^\s*([-*]|\d+\.)\s/.test(lines[i]!) || /^\s{2,}\S/.test(lines[i]!))
      ) {
        const l = lines[i++]!;
        const m = l.match(/^(\s*)([-*]|\d+\.)\s+(.*)/);
        if (!m) {
          // Continuation of the previous item's text.
          const top = stack[stack.length - 1]!.list;
          const last = top[top.length - 1];
          if (last) last.text += ` ${l.trim()}`;
          continue;
        }
        const indent = m[1]!.length;
        while (stack.length > 1 && indent <= stack[stack.length - 1]!.indent) stack.pop();
        const parent = stack[stack.length - 1]!;
        const item: ListItem = { text: m[3]!, children: [] };
        if (indent > parent.indent && parent.indent >= 0) {
          const host = parent.list[parent.list.length - 1];
          if (host) {
            host.children.push(item);
            stack.push({ indent, list: host.children });
            continue;
          }
        }
        if (parent.indent < 0 && stack.length === 1) stack.push({ indent, list: items });
        stack[stack.length - 1]!.list.push(item);
      }
      blocks.push({ type: 'list', items });
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !/^(#|```|\||\s*([-*]|\d+\.)\s)/.test(lines[i]!))
      para.push(lines[i++]!.trim());
    blocks.push({ type: 'p', text: para.join(' ') });
  }
  return blocks;
}

/** Inline pieces of a line: plain text, **bold**, `code`, [links](url). */
export type Inline =
  | { t: 'text'; v: string }
  | { t: 'bold'; v: string }
  | { t: 'code'; v: string }
  | { t: 'link'; v: string; href: string };

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ t: 'text', v: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ t: 'bold', v: m[1] });
    else if (m[2] !== undefined) out.push({ t: 'code', v: m[2] });
    else out.push({ t: 'link', v: m[3]!, href: m[4]! });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ t: 'text', v: text.slice(last) });
  return out;
}

/**
 * Source files a doc mentions in `code` (e.g. `core/assist/LaneAssist.ts`,
 * `cluster/lanes/`), as repository paths. Docs leave out the `src/` prefix.
 */
export function sourcePaths(md: string): string[] {
  const found = new Set<string>();
  for (const m of md.matchAll(/`([\w./-]+?(\.(ts|tsx|css|mjs)|\/))`/g)) {
    let p = m[1]!.replace(/^\.\//, '');
    if (!p.includes('/')) continue;
    if (!/^(src|docs|scripts|e2e)\//.test(p)) p = `src/${p}`;
    found.add(p);
  }
  return [...found];
}
