/**
 * Source-level UI regression guard for BookFlow.
 * It cannot replace screenshot/a11y browser tests, but prevents accidental
 * re-introduction of raw buttons/images and legacy button-like Link markup.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../src/", import.meta.url)));
const failures = [];
const seen = { jsx: 0, buttons: 0, images: 0, buttonLinks: 0 };

function visit(folder) {
  for (const entry of readdirSync(folder,{withFileTypes:true})) {
    const path = join(folder,entry.name);
    if (entry.isDirectory()) { visit(path); continue; }
    if (!entry.name.endsWith(".jsx")) continue;
    const name = relative(root,path).replaceAll("\\","/");
    const content = readFileSync(path,"utf8");
    seen.jsx++;
    if (name !== "components/ui/button.jsx") {
      const hits = content.match(/<button(?=[\s>])/g) || [];
      if (hits.length) failures.push(name+": "+hits.length+" raw <button> tags; use <Button> from ui/button.jsx");
    }
    if (name !== "components/ui/image.jsx") {
      const hits = content.match(/<img(?=[\s>])/g) || [];
      if (hits.length) failures.push(name+": "+hits.length+" raw <img> tags; use <Image> from ui/image.jsx");
    }
    seen.buttons += (content.match(/<Button(?=[\s>])/g)||[]).length;
    seen.images += (content.match(/<Image(?=[\s>])/g)||[]).length;
    // Navigation links visually styled as buttons should go through Button asChild.
    for (const hit of content.matchAll(/<Link\b[^>]*\bclassName="([^"]*(?:button-link|public-book-session-button)[^"]*)"[^>]*>/g)) {
      seen.buttonLinks++;
      const prefix = content.slice(Math.max(0,hit.index-170),hit.index);
      if (!/<Button\b[^>]*\basChild\b[^>]*>\s*$/.test(prefix))
        failures.push(name+": styled button Link needs a <Button asChild> wrapper");
    }
  }
}
visit(root);

const geometry = readFileSync(join(root,"component-polish.css"),"utf8");
const refresh = readFileSync(join(root,"shadcn-refresh.css"),"utf8");
for(const token of ["--ui-card-radius: 10px", "--ui-control-radius: 10px", "--ui-image-radius: 10px"]) {
  if (!refresh.includes(token)) failures.push("shadcn-refresh.css: missing "+token);
}
if (!geometry.includes("width: fit-content")) failures.push("component-polish.css: missing content-fit sizing");
const editorCover=readFileSync(join(root,"components/ProfileMediaHeader.jsx"),"utf8");
const publicCover=readFileSync(join(root,"pages/PublicProfilePage.jsx"),"utf8");
if (!editorCover.includes('className="ui-profile-cover-image"')) failures.push("ProfileMediaHeader cover is not using shared Image");
if (!publicCover.includes('className="ui-profile-cover-image"')) failures.push("PublicProfilePage cover is not using shared Image");

console.log("UI source audit: "+JSON.stringify(seen));
if(failures.length){ for(const reason of failures)console.error("FAIL: "+reason);process.exitCode=1; }
else console.log("PASS: all authored UI buttons/images use shared primitives; button-like Links, cover images, and 10px radius tokens verified.");
