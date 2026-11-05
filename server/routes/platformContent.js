import { Router } from "express";
import { randomUUID } from "node:crypto";
import requireAuth from "../middleware/auth.js";
import { getOrCreatePlatformPage, publicPlatformPage, versionIdFor } from "../lib/platformContent.js";

const router = Router();
const allowedTypes = new Set([
  "heading", "paragraph", "richText", "bulletList", "numberedList",
  "callout", "quote", "divider", "image", "link", "table", "accordion", "faqGroup"
]);

function text(value, max = 12000) {
  return String(value ?? "").replace(/\u0000/g, "").slice(0, max);
}

function safeUrl(value) {
  const candidate = text(value, 2000).trim();
  if (!candidate) return "";
  try {
    const parsed = new URL(candidate);
    return ["https:", "http:", "mailto:"].includes(parsed.protocol) ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function normalizeComponents(input, slug) {
  if (!Array.isArray(input) || input.length > 300) throw new Error("A page must contain no more than 300 components.");
  return input.map((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`Component ${index + 1} is invalid.`);
    const type = text(raw.type, 40);
    if (!allowedTypes.has(type)) throw new Error(`Component ${index + 1} has an unsupported type.`);
    if (slug === "terms" && type === "faqGroup") throw new Error("FAQ groups can only be added to the FAQ page.");
    const block = { id: text(raw.id, 100).trim() || randomUUID(), type, hidden: raw.hidden === true };

    if (type === "heading") {
      block.text = text(raw.text, 300);
      block.level = [2, 3, 4].includes(Number(raw.level)) ? Number(raw.level) : 2;
    } else if (["paragraph", "richText", "callout", "quote"].includes(type)) {
      block.text = text(raw.text, type === "richText" ? 20000 : 12000);
    } else if (["bulletList", "numberedList"].includes(type)) {
      block.items = Array.isArray(raw.items) ? raw.items.slice(0, 100).map(item => text(item, 1000)) : [];
    } else if (type === "image") {
      block.url = safeUrl(raw.url);
      if (!(block.url.startsWith("https://") || block.url.startsWith("http://"))) throw new Error("Image components need a valid HTTP or HTTPS image URL.");
      block.alt = text(raw.alt, 300);
      if (!block.url) throw new Error("Image components need a valid HTTP or HTTPS image URL.");
    } else if (type === "link") {
      block.url = safeUrl(raw.url);
      block.label = text(raw.label, 160);
      if (!block.url || !block.label.trim()) throw new Error("Link components need a label and a valid URL.");
    } else if (type === "table") {
      block.headers = Array.isArray(raw.headers) ? raw.headers.slice(0, 12).map(item => text(item, 200)) : [];
      block.rows = Array.isArray(raw.rows) ? raw.rows.slice(0, 60).map(row =>
        Array.isArray(row) ? row.slice(0, 12).map(cell => text(cell, 500)) : []
      ) : [];
    } else if (type === "accordion") {
      block.title = text(raw.title, 300);
      block.text = text(raw.text, 12000);
    } else if (type === "faqGroup") {
      block.title = text(raw.title, 300);
      block.questions = Array.isArray(raw.questions) ? raw.questions.slice(0, 100).map(question => ({
        id: text(question?.id, 100).trim() || randomUUID(),
        question: text(question?.question, 500),
        answer: text(question?.answer, 6000)
      })) : [];
    }
    return block;
  });
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ message: "Administrator access is required." });
  next();
}

router.use("/admin", requireAuth, requireAdmin);

router.get("/admin/:slug", async (req, res) => {
  try {
    if (!["terms", "faqs"].includes(req.params.slug)) return res.status(404).json({ message: "Page not found." });
    const page = await getOrCreatePlatformPage(req.params.slug);
    res.set("Cache-Control", "no-store");
    return res.json({
      slug: page.slug, draft: page.draft, published: page.published,
      publishedVersion: page.publishedVersion,
      publishedVersionId: versionIdFor(page.slug, page.publishedVersion),
      publishedAt: page.publishedAt,
      revisions: page.revisions.slice().reverse().map(item => ({
        revisionId: item.revisionId, version: item.version, title: item.title,
        publishedAt: item.publishedAt, publishedBy: item.publishedBy
      }))
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Unable to load page content." });
  }
});

router.put("/admin/:slug/draft", async (req, res) => {
  try {
    const slug = req.params.slug;
    if (!["terms", "faqs"].includes(slug)) return res.status(404).json({ message: "Page not found." });
    const title = text(req.body?.title, 160).trim();
    if (!title) return res.status(400).json({ message: "Page title is required." });
    const components = normalizeComponents(req.body?.components, slug);
    const page = await getOrCreatePlatformPage(slug);
    if (req.body?.expectedUpdatedAt && page.draft?.updatedAt &&
        new Date(req.body.expectedUpdatedAt).getTime() !== new Date(page.draft.updatedAt).getTime()) {
      return res.status(409).json({ message: "This draft changed elsewhere. Reload it before saving to avoid overwriting newer work." });
    }
    page.draft = { title, components, updatedAt: new Date() };
    await page.save();
    res.set("Cache-Control", "no-store");
    return res.json({ draft: page.draft, publishedVersion: page.publishedVersion });
  } catch (error) {
    console.error(error);
    return res.status(400).json({ message: error.message || "Unable to save draft." });
  }
});

router.post("/admin/:slug/publish", async (req, res) => {
  try {
    const slug = req.params.slug;
    if (!["terms", "faqs"].includes(slug)) return res.status(404).json({ message: "Page not found." });
    const title = text(req.body?.title, 160).trim();
    if (!title) return res.status(400).json({ message: "Page title is required." });
    const components = normalizeComponents(req.body?.components, slug);
    const page = await getOrCreatePlatformPage(slug);
    const now = new Date();
    const nextVersion = Math.max(1, Number(page.publishedVersion || 0) + 1);
    page.draft = { title, components, updatedAt: now };
    page.published = { title, components, updatedAt: now };
    page.publishedVersion = nextVersion;
    page.publishedAt = now;
    page.revisions.push({
      revisionId: randomUUID(), version: nextVersion, title,
      components, publishedAt: now, publishedBy: req.user.id
    });
    if (page.revisions.length > 100) page.revisions.splice(0, page.revisions.length - 100);
    await page.save();
    res.set("Cache-Control", "no-store");
    return res.json({
      slug, draft: page.draft, published: page.published,
      publishedVersion: page.publishedVersion,
      publishedVersionId: versionIdFor(slug, page.publishedVersion),
      publishedAt: page.publishedAt
    });
  } catch (error) {
    console.error(error);
    return res.status(400).json({ message: error.message || "Unable to publish page." });
  }
});

router.post("/admin/:slug/restore/:revisionId", async (req, res) => {
  try {
    const slug = req.params.slug;
    if (!["terms", "faqs"].includes(slug)) return res.status(404).json({ message: "Page not found." });
    const page = await getOrCreatePlatformPage(slug);
    const revision = page.revisions.find(item => item.revisionId === req.params.revisionId);
    if (!revision) return res.status(404).json({ message: "Published revision not found." });
    page.draft = { title: revision.title, components: revision.components, updatedAt: new Date() };
    await page.save();
    res.set("Cache-Control", "no-store");
    return res.json({ draft: page.draft });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Unable to restore this revision." });
  }
});

router.get("/:slug", async (req, res) => {
  try {
    if (!["terms", "faqs"].includes(req.params.slug)) return res.status(404).json({ message: "Page not found." });
    const page = await getOrCreatePlatformPage(req.params.slug);
    res.set("Cache-Control", "no-store");
    return res.json(publicPlatformPage(page));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Unable to load this page." });
  }
});

export default router;
