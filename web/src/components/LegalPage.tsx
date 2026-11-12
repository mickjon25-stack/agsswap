import { markdownToHtml } from "@/lib/markdown";

export function LegalPage({ title, markdown }: { title: string; markdown: string }) {
  return (
    <div className="wrap">
      <article className="panel legal-doc">
        <h1>{title}</h1>
        <div dangerouslySetInnerHTML={{ __html: markdownToHtml(markdown) }} />
      </article>
    </div>
  );
}
