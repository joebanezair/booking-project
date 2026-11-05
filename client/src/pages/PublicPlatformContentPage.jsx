import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiArrowLeft, FiFileText, FiHelpCircle } from "react-icons/fi";
import { api } from "../api.js";
import PlatformContentRenderer from "../components/PlatformContentRenderer.jsx";

export default function PublicPlatformContentPage({ slug }) {
  const [page, setPage] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.platformContent.public(slug).then(result => {
      if (active) { setPage(result); setError(""); }
    }).catch(e => {
      if (active) setError(e.message || "Unable to load this page.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [slug]);

  const isTerms = slug === "terms";
  return <main className="platform-public-page">
    <header className="platform-public-header">
      <Link to="/" className="platform-public-brand"><span className="platform-public-mark">B</span>BookFlow</Link>
      <nav aria-label="Platform pages">
        <Link className={isTerms ? "active" : ""} to="/terms"><FiFileText/>Terms</Link>
        <Link className={!isTerms ? "active" : ""} to="/faqs"><FiHelpCircle/>FAQs</Link>
      </nav>
    </header>
    <div className="platform-public-main">
      <Link to="/" className="platform-back-link"><FiArrowLeft/> Back to BookFlow</Link>
      {loading ? <p className="platform-loading">Loading page…</p> : error ? <p className="error" role="alert">{error}</p> : page && <>
        <div className="platform-public-meta">
          <span>{isTerms ? "PLATFORM POLICIES" : "HELP CENTER"}</span>
          {isTerms && <span>Version {page.version}</span>}
        </div>
        <PlatformContentRenderer title={page.title} components={page.components}/>
        <p className="platform-public-updated">
          {page.publishedAt ? `Last updated ${new Date(page.publishedAt).toLocaleDateString()}` : ""}
        </p>
        <div className="platform-public-bottom-links">
          <Link to={isTerms ? "/faqs" : "/terms"}>{isTerms ? "View frequently asked questions" : "Read Terms & Conditions"}</Link>
          <Link to="/register">Create a business account</Link>
        </div>
      </>}
    </div>
    <footer className="platform-public-footer">© {new Date().getFullYear()} BookFlow</footer>
  </main>;
}
