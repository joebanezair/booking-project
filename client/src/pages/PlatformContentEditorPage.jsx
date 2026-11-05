import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiArrowDown, FiArrowLeft, FiArrowUp, FiCheck, FiClock, FiCopy, FiEye,
  FiFileText, FiMove, FiHelpCircle, FiImage, FiInfo, FiLink, FiEyeOff,
  FiList, FiMinus, FiPlus, FiRefreshCw, FiSave, FiSend,
  FiGrid, FiTrash2, FiType
} from "react-icons/fi";
import { Button } from "../components/ui/button.jsx";
import AppLayout from "../components/AppLayout.jsx";
import PlatformContentRenderer from "../components/PlatformContentRenderer.jsx";
import { api } from "../api.js";

const LIBRARY = [
  { type: "heading", label: "Heading", icon: FiType, terms: true, faqs: true },
  { type: "paragraph", label: "Paragraph", icon: FiFileText, terms: true, faqs: true },
  { type: "richText", label: "Rich text", icon: FiFileText, terms: true, faqs: true },
  { type: "bulletList", label: "Bullet list", icon: FiList, terms: true, faqs: true },
  { type: "numberedList", label: "Numbered list", icon: FiList, terms: true, faqs: true },
  { type: "callout", label: "Callout / notice", icon: FiInfo, terms: true, faqs: true },
  { type: "quote", label: "Quote", icon: FiFileText, terms: true, faqs: true },
  { type: "divider", label: "Divider", icon: FiMinus, terms: true, faqs: true },
  { type: "image", label: "Image", icon: FiImage, terms: true, faqs: true },
  { type: "link", label: "Link / button", icon: FiLink, terms: true, faqs: true },
  { type: "table", label: "Table", icon: FiGrid, terms: true, faqs: false },
  { type: "accordion", label: "Accordion", icon: FiHelpCircle, terms: true, faqs: true },
  { type: "faqGroup", label: "FAQ group", icon: FiHelpCircle, terms: false, faqs: true }
];

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `block-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function newBlock(type) {
  const id = makeId();
  const defaults = {
    heading: { text: "New section heading", level: 2 },
    paragraph: { text: "Write your paragraph here." },
    richText: { text: "Write your content here. Use line breaks to separate paragraphs." },
    bulletList: { items: ["First item", "Second item"] },
    numberedList: { items: ["First step", "Second step"] },
    callout: { text: "Add an important notice here." },
    quote: { text: "Add a quotation or highlighted statement here." },
    divider: {},
    image: { url: "", alt: "" },
    link: { label: "Learn more", url: "https://" },
    table: { headers: ["Column 1", "Column 2"], rows: [["Value", "Value"]] },
    accordion: { title: "Expandable section", text: "Add details here." },
    faqGroup: { title: "New FAQ group", questions: [{ id: makeId(), question: "New question", answer: "Write the answer here." }] }
  };
  return { id, type, ...(defaults[type] || {}) };
}

function Field({ label, value, onChange, multiline = false, placeholder = "", rows = 3, type = "text" }) {
  return <label className="platform-editor-field">
    <span>{label}</span>
    {multiline
      ? <textarea rows={rows} value={value ?? ""} placeholder={placeholder} onChange={event => onChange(event.target.value)}/>
      : <input type={type} value={value ?? ""} placeholder={placeholder} onChange={event => onChange(event.target.value)}/>}
  </label>;
}

export default function PlatformContentEditorPage({ user, onLogout }) {
  const [slug, setSlug] = useState(() => new URLSearchParams(window.location.search).get("tab") === "faqs" ? "faqs" : "terms");
  const [record, setRecord] = useState(null);
  const [draft, setDraft] = useState({ title: "", components: [] });
  const [activeTab, setActiveTab] = useState("edit");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [draggedId, setDraggedId] = useState("");

  const isFaq = slug === "faqs";
  const library = useMemo(() => LIBRARY.filter(item => item[isFaq ? "faqs" : "terms"]), [isFaq]);

  async function loadPage(nextSlug = slug) {
    setLoading(true);
    setError("");
    try {
      const result = await api.platformContent.admin(nextSlug);
      setRecord(result);
      setDraft({ title: result.draft?.title || "", components: result.draft?.components || [] });
      setDirty(false);
    } catch (e) {
      setError(e.message || "Unable to load the page editor.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadPage(slug); }, [slug]);

  function switchPage(nextSlug) {
    if (nextSlug === slug) return;
    if (dirty && !window.confirm("Discard your unsaved changes and switch pages?")) return;
    setMessage("");
    setActiveTab("edit");
    setSlug(nextSlug);
  }

  function updateDraft(patch) {
    setDraft(current => ({ ...current, ...patch }));
    setDirty(true);
    setMessage("");
  }

  function updateBlock(id, patch) {
    updateDraft({ components: draft.components.map(block => block.id === id ? { ...block, ...patch } : block) });
  }

  function addBlock(type) {
    updateDraft({ components: [...draft.components, newBlock(type)] });
    setActiveTab("edit");
  }

  function moveBlock(id, direction) {
    const items = [...draft.components];
    const index = items.findIndex(item => item.id === id);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= items.length) return;
    [items[index], items[next]] = [items[next], items[index]];
    updateDraft({ components: items });
  }

  function dropBlock(targetId, movingId = draggedId) {
    const fromIndex = draft.components.findIndex(item => item.id === movingId);
    const toIndex = draft.components.findIndex(item => item.id === targetId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
    const items = [...draft.components];
    const [moved] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, moved);
    updateDraft({ components: items });
    setDraggedId("");
  }

  function updateQuestion(blockId, questionId, patch) {
    const block = draft.components.find(item => item.id === blockId);
    if (!block) return;
    updateBlock(blockId, { questions: (block.questions || []).map(item =>
      item.id === questionId ? { ...item, ...patch } : item
    ) });
  }

  async function saveDraft() {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await api.platformContent.saveDraft(slug, {
        ...draft,
        expectedUpdatedAt: record?.draft?.updatedAt
      });
      setRecord(current => ({ ...current, draft: result.draft }));
      setDraft({ title: result.draft.title, components: result.draft.components || [] });
      setDirty(false);
      setMessage("Draft saved. The published page has not changed.");
    } catch (e) {
      setError(e.message || "Unable to save draft.");
      if (e.status === 409) setMessage("Reload the page to review the latest saved draft before trying again.");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!window.confirm(`Publish the current ${isFaq ? "FAQ" : "Terms & Conditions"} draft? The public page will update immediately.`)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await api.platformContent.publish(slug, draft);
      await loadPage(slug);
      setActiveTab("history");
      setMessage("Page published successfully.");
    } catch (e) {
      setError(e.message || "Unable to publish this page.");
    } finally {
      setBusy(false);
    }
  }

  async function restoreRevision(revisionId) {
    if (!window.confirm("Restore this revision into the draft? It will not become public until you publish it.")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await api.platformContent.restore(slug, revisionId);
      setDraft({ title: result.draft.title, components: result.draft.components || [] });
      setRecord(current => ({ ...current, draft: result.draft }));
      setDirty(false);
      setActiveTab("edit");
      setMessage("Revision restored to the draft. Publish it when you are ready.");
    } catch (e) {
      setError(e.message || "Unable to restore this revision.");
    } finally {
      setBusy(false);
    }
  }

  function renderBlockFields(block) {
    if (block.type === "heading") return <>
      <Field label="Heading text" value={block.text} onChange={value => updateBlock(block.id, { text: value })}/>
      <label className="platform-editor-field"><span>Heading level</span><select value={block.level || 2} onChange={event => updateBlock(block.id, { level: Number(event.target.value) })}><option value="2">Heading 2</option><option value="3">Heading 3</option><option value="4">Heading 4</option></select></label>
    </>;
    if (["paragraph", "richText", "callout", "quote"].includes(block.type))
      return <Field label={block.type === "callout" ? "Notice text" : block.type === "quote" ? "Quote" : "Content"} value={block.text} multiline rows={4} onChange={value => updateBlock(block.id, { text: value })}/>;
    if (["bulletList", "numberedList"].includes(block.type))
      return <Field label="One item per line" value={(block.items || []).join("\n")} multiline rows={5} onChange={value => updateBlock(block.id, { items: value.split("\n").slice(0, 100) })}/>;
    if (block.type === "image") return <>
      <Field label="Image URL (HTTPS)" value={block.url} onChange={value => updateBlock(block.id, { url: value })} placeholder="https://example.com/image.jpg"/>
      <Field label="Alternative text" value={block.alt} onChange={value => updateBlock(block.id, { alt: value })}/>
    </>;
    if (block.type === "link") return <>
      <Field label="Link text" value={block.label} onChange={value => updateBlock(block.id, { label: value })}/>
      <Field label="Destination URL" value={block.url} onChange={value => updateBlock(block.id, { url: value })} placeholder="https://example.com"/>
    </>;
    if (block.type === "accordion") return <>
      <Field label="Expandable heading" value={block.title} onChange={value => updateBlock(block.id, { title: value })}/>
      <Field label="Expandable content" value={block.text} multiline rows={4} onChange={value => updateBlock(block.id, { text: value })}/>
    </>;
    if (block.type === "table") return <>
      <Field label="Column headings (separate with |)" value={(block.headers || []).join(" | ")} onChange={value => updateBlock(block.id, { headers: value.split("|").slice(0, 12).map(v => v.trim()) })}/>
      <Field label="Rows (one per line, cells separated with |)" value={(block.rows || []).map(row => row.join(" | ")).join("\n")} multiline rows={5} onChange={value => updateBlock(block.id, { rows: value.split("\n").slice(0, 60).map(row => row.split("|").slice(0, 12).map(v => v.trim())) })}/>
    </>;
    if (block.type === "faqGroup") return <div className="platform-faq-question-list">
      <Field label="FAQ group title" value={block.title} onChange={value => updateBlock(block.id, { title: value })}/>
      {(block.questions || []).map((item, index) => <div className="platform-faq-question-editor" key={item.id}>
        <div className="platform-faq-question-heading"><span>Question {index + 1}</span><Button variant="plain" type="button" className="platform-icon-button danger" aria-label="Remove question" onClick={() => updateBlock(block.id, { questions: block.questions.filter(q => q.id !== item.id) })}><FiTrash2/></Button></div>
        <Field label="Question" value={item.question} onChange={value => updateQuestion(block.id, item.id, { question: value })}/>
        <Field label="Answer" value={item.answer} multiline rows={3} onChange={value => updateQuestion(block.id, item.id, { answer: value })}/>
      </div>)}
      <Button type="button" variant="outline" size="sm" onClick={() => updateBlock(block.id, { questions: [...(block.questions || []), { id: makeId(), question: "", answer: "" }] })}><FiPlus/> Add question</Button>
    </div>;
    if (block.type === "divider") return <p className="platform-editor-hint">A horizontal divider will appear at this position on the public page.</p>;
    return null;
  }

  return <AppLayout user={user} onLogout={onLogout}>
    <div className="platform-editor-page">
      <header className="platform-editor-topbar">
        <div>
          <Link to="/dashboard/profile" className="platform-editor-back"><FiArrowLeft/> Back to profile</Link>
          <p className="eyebrow">ADMIN PROFILE / PLATFORM CONTENT</p>
          <h1>Page builder</h1>
          <p className="muted">Build and publish the public Terms & Conditions and FAQ pages.</p>
        </div>
        <div className="platform-editor-header-actions">
          <Button type="button" variant="outline" onClick={() => loadPage(slug)} disabled={busy || loading}><FiRefreshCw/> Reload</Button>
          <Button type="button" variant="outline" onClick={saveDraft} disabled={busy || loading || !dirty}><FiSave/> Save draft</Button>
          <Button type="button" onClick={publish} disabled={busy || loading || !draft.title.trim()}><FiSend/> Publish</Button>
        </div>
      </header>

      <div className="platform-editor-page-tabs">
        <Button variant="plain" type="button" className={slug === "terms" ? "active" : ""} onClick={() => switchPage("terms")}><FiFileText/> Terms & Conditions</Button>
        <Button variant="plain" type="button" className={slug === "faqs" ? "active" : ""} onClick={() => switchPage("faqs")}><FiHelpCircle/> FAQs</Button>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="platform-editor-message" role="status"><FiCheck/>{message}</p>}

      {loading ? <p className="platform-loading">Loading editor…</p> : <>
        <div className="platform-editor-status-row">
          <span><span className="platform-status-dot"/> Published version {record?.publishedVersion || 1}</span>
          <span>{dirty ? "Unsaved changes" : "Draft saved"}</span>
          <span>{draft.components.length} components</span>
        </div>

        <div className="platform-editor-workspace">
          <aside className="platform-component-library">
            <div className="platform-editor-section-title"><strong>Components</strong><small>Click to add</small></div>
            <div className="platform-component-grid">
              {library.map(item => {
                const Icon = item.icon;
                return <Button variant="plain" type="button" key={item.type} onClick={() => addBlock(item.type)}><Icon/><span>{item.label}</span><FiPlus className="platform-add-icon"/></Button>;
              })}
            </div>
            <div className="platform-editor-side-note">
              <FiInfo/>
              <p>Components can be added multiple times, edited individually, duplicated, removed and reordered.</p>
            </div>
          </aside>

          <section className="platform-editor-main">
            <div className="platform-editor-main-tabs">
              <Button variant="plain" type="button" className={activeTab === "edit" ? "active" : ""} onClick={() => setActiveTab("edit")}>Edit content</Button>
              <Button variant="plain" type="button" className={activeTab === "preview" ? "active" : ""} onClick={() => setActiveTab("preview")}><FiEye/> Preview</Button>
              <Button variant="plain" type="button" className={activeTab === "history" ? "active" : ""} onClick={() => setActiveTab("history")}><FiClock/> History</Button>
            </div>

            {activeTab === "edit" && <div className="platform-editor-canvas">
              <Field label="Public page title" value={draft.title} onChange={value => updateDraft({ title: value })}/>
              <div className="platform-editor-canvas-hint">Page components · Drag to reorder or use the arrow controls</div>
              {draft.components.map((block, index) => <section
                className={"platform-editor-block" + (draggedId === block.id ? " dragging" : "") + (block.hidden ? " is-hidden" : "")}
                key={block.id}
                draggable
                onDragStart={event => { setDraggedId(block.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", block.id); }}
                onDragOver={event => event.preventDefault()}
                onDrop={event => { event.preventDefault(); const moving = event.dataTransfer.getData("text/plain") || draggedId; dropBlock(block.id, moving); setDraggedId(""); }}
                onDragEnd={() => setDraggedId("")}
              >
                <div className="platform-editor-block-toolbar">
                  <span className="platform-editor-block-label"><FiMove/>{index + 1}. {LIBRARY.find(item => item.type === block.type)?.label || block.type}{block.hidden && <small className="platform-editor-hidden-label">Hidden from public</small>}</span>
                  <div className="platform-editor-block-actions">
                    <Button variant="plain" type="button" title="Move up" aria-label="Move up" disabled={index === 0} onClick={() => moveBlock(block.id, -1)}><FiArrowUp/></Button>
                    <Button variant="plain" type="button" title="Move down" aria-label="Move down" disabled={index === draft.components.length - 1} onClick={() => moveBlock(block.id, 1)}><FiArrowDown/></Button>
                    <Button variant="plain" type="button" title={block.hidden ? "Show on public page" : "Hide from public page"} aria-label={block.hidden ? "Show component" : "Hide component"} onClick={() => updateBlock(block.id, { hidden: !block.hidden })}>{block.hidden ? <FiEye/> : <FiEyeOff/>}</Button>
                    <Button variant="plain" type="button" title="Duplicate" aria-label="Duplicate component" onClick={() => {
                      const copy = { ...block, id: makeId(), ...(block.questions ? { questions: block.questions.map(q => ({ ...q, id: makeId() })) } : {}) };
                      const next = [...draft.components]; next.splice(index + 1, 0, copy); updateDraft({ components: next });
                    }}><FiCopy/></Button>
                    <Button variant="plain" type="button" title="Delete" aria-label="Delete component" className="danger" onClick={() => updateDraft({ components: draft.components.filter(item => item.id !== block.id) })}><FiTrash2/></Button>
                  </div>
                </div>
                <div className="platform-editor-block-fields">{renderBlockFields(block)}</div>
              </section>)}
              {draft.components.length === 0 && <div className="platform-editor-empty">Choose a component from the left to start building this page.</div>}
            </div>}

            {activeTab === "preview" && <div className="platform-editor-preview">
              <PlatformContentRenderer title={draft.title} components={draft.components}/>
              <p className="platform-editor-hint">Preview only. Save the draft and publish when ready.</p>
            </div>}

            {activeTab === "history" && <div className="platform-editor-history">
              <h2>Published revisions</h2>
              {(record?.revisions || []).length === 0 ? <p className="muted">No published revisions yet.</p> : record.revisions.map(item => <div className="platform-editor-revision" key={item.revisionId}>
                <div><strong>Version {item.version}</strong><small>{item.title}</small><time>{item.publishedAt ? new Date(item.publishedAt).toLocaleString() : "Date unavailable"}</time></div>
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => restoreRevision(item.revisionId)}>Restore to draft</Button>
              </div>)}
            </div>}
          </section>
        </div>
        {isFaq && <p className="platform-editor-footnote">Add multiple FAQ groups and as many question-and-answer entries as each group needs.</p>}
        {!isFaq && <p className="platform-editor-footnote">Newly published Terms receive a new version number. Each new registration records the exact version accepted. Review the starter wording and obtain appropriate legal review before relying on it as your final policy.</p>}
      </>}
    </div>
  </AppLayout>;
}
