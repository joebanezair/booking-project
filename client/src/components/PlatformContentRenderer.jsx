import React from "react";
import { Image } from "./ui/image.jsx";

function TextLines({ value }) {
  return <div className="platform-content-text">{String(value || "").split(/\n{2,}/).map((part, index) =>
    <p key={index}>{part}</p>
  )}</div>;
}

export default function PlatformContentRenderer({ title, components = [] }) {
  return <article className="platform-public-content">
    <h1>{title}</h1>
    {components.filter(block => !block.hidden).map((block, index) => {
      const key = block.id || `${block.type}-${index}`;
      switch (block.type) {
        case "heading": {
          const Tag = [2, 3, 4].includes(Number(block.level)) ? `h${Number(block.level)}` : "h2";
          return <Tag key={key}>{block.text}</Tag>;
        }
        case "paragraph":
        case "richText":
          return <TextLines key={key} value={block.text} />;
        case "bulletList":
          return <ul key={key}>{(block.items || []).filter(Boolean).map((item, i) => <li key={i}>{item}</li>)}</ul>;
        case "numberedList":
          return <ol key={key}>{(block.items || []).filter(Boolean).map((item, i) => <li key={i}>{item}</li>)}</ol>;
        case "callout":
          return <aside className="platform-content-callout" key={key}><TextLines value={block.text} /></aside>;
        case "quote":
          return <blockquote key={key}><TextLines value={block.text} /></blockquote>;
        case "divider":
          return <hr className="platform-content-divider" key={key}/>;
        case "image":
          return <figure className="platform-content-image" key={key}>
            <Image src={block.url} alt={block.alt || ""} loading="lazy"/>
            {block.alt && <figcaption>{block.alt}</figcaption>}
          </figure>;
        case "link":
          return <p className="platform-content-link" key={key}><a href={block.url} target={/^https?:/i.test(block.url || "") ? "_blank" : undefined} rel="noreferrer">{block.label}</a></p>;
        case "table":
          return <div className="platform-content-table-wrap" key={key}><table className="platform-content-table">
            {block.headers?.length > 0 && <thead><tr>{block.headers.map((cell, i) => <th key={i}>{cell}</th>)}</tr></thead>}
            <tbody>{(block.rows || []).map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody>
          </table></div>;
        case "accordion":
          return <details className="platform-content-accordion" key={key}>
            <summary>{block.title || "More information"}</summary>
            <TextLines value={block.text}/>
          </details>;
        case "faqGroup":
          return <section className="platform-content-faq-group" key={key}>
            <h2>{block.title}</h2>
            {(block.questions || []).map((item, i) => <details className="platform-content-accordion" key={item.id || i}>
              <summary>{item.question || "Question"}</summary>
              <TextLines value={item.answer}/>
            </details>)}
          </section>;
        default:
          return null;
      }
    })}
  </article>;
}
