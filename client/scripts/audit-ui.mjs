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
// Service status filters have a dedicated desktop-row/mobile-column layout.
const services = readFileSync(join(root,"pages/ContentManagementPage.jsx"),"utf8");
const filterButtons = services.match(/className=\{\`stat-card service-stat-card/g) || [];
if (filterButtons.length !== 3) failures.push("Services filters must retain all three Total/Published/Drafts buttons.");
if (!services.includes('aria-label="Filter services by publication status"'))
  failures.push("Services filter controls need an accessible group.");
const servicesCss = geometry.slice(geometry.indexOf("Services management status filters"));
const mobileBreakpoint = servicesCss.indexOf("@media (max-width: 640px)");
if (!servicesCss.includes("#root .services-stats-grid.stats-grid") ||
    mobileBreakpoint < 0 ||
    !servicesCss.slice(0, mobileBreakpoint).includes("flex-direction: row !important") ||
    !servicesCss.slice(mobileBreakpoint).includes("flex-direction: column !important"))
  failures.push("Services stats must use compact desktop row and mobile column rules.");
// Inventory cards must be single-surface, with a borderless selection target
// and a separate action control; list view must still be present.
const inventory = readFileSync(join(root,"pages/ProductsPage.jsx"),"utf8");
const inventoryStyles = readFileSync(join(root,"inventory-card-refresh.css"),"utf8");
const uiEntry = readFileSync(join(root,"main.jsx"),"utf8");
if (!inventory.includes('product-shop-card product-inventory-tile') ||
    !inventory.includes('className="product-card-primary"') ||
    !inventory.includes("product-card-actions product-card-menu"))
  failures.push("Product inventory must retain one tile, selection button and edit/delete menu.");
if (!inventory.includes('product-shop-list') ||
    !inventoryStyles.includes(".product-shop-grid.product-shop-list") ||
    !inventoryStyles.includes("product-shop-grid:not(.product-shop-list)"))
  failures.push("Product inventory must retain distinct grid and list layouts.");
if (!inventoryStyles.includes("border: 0 !important;") ||
    !inventoryStyles.includes("padding: 0 !important;") ||
    !inventoryStyles.includes("border: 1px solid var(--border) !important;"))
  failures.push("Product cards need exactly one visible border; the inner selection must be borderless.");
if (!uiEntry.includes('import "./inventory-card-refresh.css";'))
  failures.push("Product inventory refinement stylesheet must load after the legacy styles.");
// The business onboarding refresh preserves seven actionable setup links,
// accessible progress and disclosure semantics, and 3/2/1-column layouts.
const onboardingComponent = readFileSync(join(root,"components/BusinessSetupChecklist.jsx"),"utf8");
const dashboard = readFileSync(join(root,"pages/DashboardPage.jsx"),"utf8");
const onboardingCss = readFileSync(join(root,"business-onboarding-refresh.css"),"utf8");
const appEntry = readFileSync(join(root,"main.jsx"),"utf8");
const onboardingSteps = [
  "Business account created", "Complete your Business Page", "Add profile and cover photos",
  "Set your working availability", "Create your first service",
  "Publish a bookable service", "Share your booking link or QR"
];
for (const step of onboardingSteps)
  if (!dashboard.includes(step)) failures.push("Business onboarding task missing: " + step);
if (!dashboard.includes("<BusinessSetupChecklist") ||
    !onboardingComponent.includes("items.map(") ||
    !onboardingComponent.includes("to={item.to}"))
  failures.push("Business checklist must preserve all action links.");
if (!onboardingComponent.includes('role="progressbar"') ||
    !onboardingComponent.includes("aria-valuenow={completed}") ||
    !onboardingComponent.includes("aria-expanded={expanded}") ||
    !onboardingComponent.includes('id="business-onboarding-steps"'))
  failures.push("Business checklist needs accessible progress and working collapse semantics.");
if (!onboardingCss.includes("repeat(3, minmax(0, 1fr))") ||
    !onboardingCss.includes("repeat(2, minmax(0, 1fr))") ||
    !onboardingCss.includes("grid-template-columns: minmax(0, 1fr) !important") ||
    !onboardingCss.includes(".onboarding-launch-list[hidden]"))
  failures.push("Business checklist needs responsive 3/2/1-column layout and hidden state.");
if (!appEntry.includes('import "./business-onboarding-refresh.css";'))
  failures.push("Business checklist styles must load after legacy dashboard CSS.");
// The compact create-product dialog and sidebar must keep their core controls.
const posSource = readFileSync(join(root,"pages/ProductsPage.jsx"),"utf8");
const sidebarSource = readFileSync(join(root,"components/AppLayout.jsx"),"utf8");
const workspaceCss = readFileSync(join(root,"workspace-polish.css"),"utf8");
const dashboardSource = readFileSync(join(root,"pages/DashboardPage.jsx"),"utf8");
for(const required of [
  'className="product-create-dialog"', 'className="product-edit-form product-create-form"',
  'className="product-create-publish"', 'product-upload-dropzone',
  'aria-label="Choose product images"', 'onSubmit={addProduct}',
  'readProductImages(', 'Save changes', 'Confirm checkout'
]) if(!posSource.includes(required)) failures.push("Product create/edit/POS control missing: "+required);
if(!workspaceCss.includes('input[type="checkbox"]') ||
   !workspaceCss.includes("max-height: calc(100dvh - 28px)") ||
   !workspaceCss.includes(".product-create-actions"))
  failures.push("Create product modal must have compact checkbox and responsive actions.");
if(!sidebarSource.includes('aria-label="Dashboard navigation"') ||
   !sidebarSource.includes('className="sidebar-nav-link"') ||
   !sidebarSource.includes('className="sidebar-section-label"') ||
   !workspaceCss.includes(".sidebar-nav a.sidebar-nav-link.active"))
  failures.push("Navigation sidebar must preserve links, label and active state.");
if(!dashboardSource.includes('const [setupExpanded, setSetupExpanded] = useState(false);'))
  failures.push("Business setup checklist must be collapsed initially.");
if(!appEntry.includes('import "./workspace-polish.css";'))
  failures.push("Workspace styles must load after existing styles.");
// Sidebar redesign: all routes remain in navigation with a More disclosure;
// hide scrollbar chrome without disabling wheel/keyboard/touch scrolling.
const sidebarRefinements = readFileSync(join(root,"sidebar-redesign.css"),"utf8");
const expectedRoutes = [
  "/dashboard", "/dashboard/services", "/dashboard/bookings",
  "/dashboard/sales", "/dashboard/products", "/dashboard/businesses",
  "/dashboard/messages", "/dashboard/profile", "/dashboard/notifications",
  "/forum", "/dashboard/settings", "/search"
];
for (const route of expectedRoutes)
  if (!sidebarSource.includes('to: "'+route+'"'))
    failures.push("Sidebar route removed: "+route);
for (const groupName of ["workspaceNavigation", "activityNavigation", "moreNavigation"])
  if (!sidebarSource.includes(groupName+".map(renderSidebarLink)"))
    failures.push("Sidebar group is missing: "+groupName);
for (const required of [
  'aria-controls="sidebar-more-links"', 'aria-expanded={moreOpen}',
  'setMoreOpen(value => !value)', 'sidebar-nav-toggle', 'sidebar-more-links',
  'moreRoutePaths.some', 'aria-label="Dashboard navigation"'
]) if (!sidebarSource.includes(required))
  failures.push("Sidebar dropdown accessibility/state missing: "+required);
if (!sidebarRefinements.includes("overflow-y: auto !important") ||
    !sidebarRefinements.includes("scrollbar-width: none !important") ||
    !sidebarRefinements.includes("::-webkit-scrollbar") ||
    !sidebarRefinements.includes("@media (max-width: 800px)"))
  failures.push("Sidebar must scroll on short screens with visually hidden scrollbar.");
if (!appEntry.includes('import "./sidebar-redesign.css";'))
  failures.push("Sidebar redesign must be loaded last in client/main.jsx.");
// Approved full-page dashboard: preserve real data, all quick links,
 // period selector, accessible controls, and the glow-free full-width drawer.
const analyticsSource = readFileSync(join(root,"components/DashboardAnalytics.jsx"),"utf8");
const fullDashboardCss = readFileSync(join(root,"dashboard-fullpage.css"),"utf8");
const searchPageSource = readFileSync(join(root,"pages/SearchPage.jsx"),"utf8");
for (const required of [
  "<DashboardAnalytics", "statusSummary={bookingSummary}", "dashboardRange={isAdmin ? null : dashboardRange}",
  "onDashboardRangeChange={setDashboardRange}", "api.bookings.statusSummary", "api.sales.analytics"
]) if (!dashboardSource.includes(required))
  failures.push("Live dashboard integration missing: " + required);
for (const required of [
  "data?.records", "statusSummary", "ServiceSalesChart", "SalesTrendChart", "dashboard-v2-stats",
  "dashboard-v2-analysis-grid", "dashboard-v2-top-services", "aria-pressed={chartTab === key}"
]) if (!analyticsSource.includes(required))
  failures.push("Real dashboard analytics feature missing: " + required);
for (const required of [
  'className="workspace-global-search"', 'className="workspace-account-menu"',
  'onLogout?.()', 'aria-label="Dashboard analytics period"', 'aria-label="Search BookFlow"'
]) if (!sidebarSource.includes(required))
  failures.push("Functional workspace topbar missing: " + required);
if (!searchPageSource.includes('searchParams.get("q")') ||
    !fullDashboardCss.includes("grid-template-columns: repeat(4, minmax(0, 1fr))") ||
    !fullDashboardCss.includes("box-shadow: none !important") ||
    !fullDashboardCss.includes("dashboard-v2-analysis-grid") ||
    !appEntry.includes('import "./dashboard-fullpage.css";'))
  failures.push("Full-page responsive UI, search wiring or glow-free drawer missing.");
const editorCover=readFileSync(join(root,"components/ProfileMediaHeader.jsx"),"utf8");
const publicCover=readFileSync(join(root,"pages/PublicProfilePage.jsx"),"utf8");
if (!editorCover.includes('className="ui-profile-cover-image"')) failures.push("ProfileMediaHeader cover is not using shared Image");
if (!publicCover.includes('className="ui-profile-cover-image"')) failures.push("PublicProfilePage cover is not using shared Image");

console.log("UI source audit: "+JSON.stringify(seen));
if(failures.length){ for(const reason of failures)console.error("FAIL: "+reason);process.exitCode=1; }
else console.log("PASS: all authored UI buttons/images use shared primitives; button-like Links, cover images, and 10px radius tokens verified.");
