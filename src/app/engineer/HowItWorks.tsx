import { useEffect, useState, type ReactNode } from 'react';
import { REPO_URL } from '../site';
import { parseInline, parseMarkdown, sourcePaths, type Block, type ListItem } from './markdown';

const DOCS = import.meta.glob('../../../docs/features/*.md', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>;

function loadDoc(id: string): Promise<string> | null {
  const key = Object.keys(DOCS).find((k) => k.endsWith(`/${id}.md`));
  return key ? DOCS[key]!() : null;
}

const repoLink = (path: string): string =>
  `${REPO_URL}/${path.endsWith('/') ? 'tree' : 'blob'}/main/${path}`;

function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((p, i) =>
        p.t === 'bold' ? (
          <strong key={i}>{p.v}</strong>
        ) : p.t === 'code' ? (
          <code key={i}>{p.v}</code>
        ) : p.t === 'link' ? (
          <a key={i} href={p.href} target="_blank" rel="noreferrer">
            {p.v}
          </a>
        ) : (
          <span key={i}>{p.v}</span>
        ),
      )}
    </>
  );
}

function List({ items }: { items: ListItem[] }) {
  return (
    <ul>
      {items.map((it, i) => (
        <li key={i}>
          <Inline text={it.text} />
          {it.children.length > 0 && <List items={it.children} />}
        </li>
      ))}
    </ul>
  );
}

function renderBlock(b: Block, i: number): ReactNode {
  switch (b.type) {
    case 'h':
      return b.level <= 1 ? (
        <h2 key={i}>
          <Inline text={b.text} />
        </h2>
      ) : (
        <h3 key={i}>
          <Inline text={b.text} />
        </h3>
      );
    case 'p':
      return (
        <p key={i}>
          <Inline text={b.text} />
        </p>
      );
    case 'list':
      return <List key={i} items={b.items} />;
    case 'table':
      return (
        <div key={i} className="hiw-table">
          <table>
            <thead>
              <tr>
                {b.head.map((h, j) => (
                  <th key={j}>
                    <Inline text={h} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r, j) => (
                <tr key={j}>
                  {r.map((c, k) => (
                    <td key={k}>
                      <Inline text={c} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'code':
      return (
        <figure key={i} className="hiw-code">
          {b.lang === 'mermaid' && <figcaption>State diagram (Mermaid source)</figcaption>}
          <pre>{b.text}</pre>
        </figure>
      );
  }
}

/**
 * "How it works": a side sheet with the feature's doc (real behaviour, how
 * it's simulated, thresholds) and links to the source files it names.
 */
export function HowItWorks({ doc, onClose }: { doc: string; onClose: () => void }) {
  const [loaded, setLoaded] = useState<{ doc: string; text: string } | null>(null);
  const md = loaded?.doc === doc ? loaded.text : null;
  useEffect(() => {
    let live = true;
    void loadDoc(doc)?.then((text) => live && setLoaded({ doc, text }));
    return () => {
      live = false;
    };
  }, [doc]);
  useEffect(() => {
    const down = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', down, true);
    return () => window.removeEventListener('keydown', down, true);
  }, [onClose]);
  const files = md ? sourcePaths(md) : [];
  return (
    <aside className="hiw" role="dialog" aria-label="How it works">
      <div className="hiw-head">
        <span className="hiw-kicker">How it works</span>
        <button className="round" aria-label="Close" onClick={onClose}>
          ✕
        </button>
      </div>
      {md === null ? (
        <p className="hiw-loading">Loading…</p>
      ) : (
        <div className="hiw-body">{parseMarkdown(md).map(renderBlock)}</div>
      )}
      {files.length > 0 && (
        <section className="hiw-files">
          <h3>Source</h3>
          {files.map((f) => (
            <a key={f} href={repoLink(f)} target="_blank" rel="noreferrer">
              {f}
            </a>
          ))}
          <a href={repoLink(`docs/features/${doc}.md`)} target="_blank" rel="noreferrer">
            docs/features/{doc}.md
          </a>
        </section>
      )}
    </aside>
  );
}
