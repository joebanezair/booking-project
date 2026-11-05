import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog.jsx";
import { Button } from "./ui/button.jsx";
import { FiCheckCircle, FiFileText, FiShield } from "react-icons/fi";
import PlatformContentRenderer from "./PlatformContentRenderer.jsx";

export default function TermsAcceptanceDialog({
  open,
  onOpenChange,
  page,
  loading = false,
  error = "",
  checked = false,
  onCheckedChange,
  onAccept,
  accepted = false,
  onRetry
}) {
  return <Dialog
    open={open}
    onOpenChange={onOpenChange}
    title="BookFlow Terms & Conditions"
    className="auth-terms-dialog"
    dismissible
  >
    <DialogContent className="auth-terms-dialog-content">
      <DialogHeader className="auth-terms-dialog-header">
        <span className="auth-terms-dialog-eyebrow"><FiShield/> BOOKFLOW ACCOUNT AGREEMENT</span>
        <DialogTitle>Terms & Conditions</DialogTitle>
        <DialogDescription>
          Please review the current terms before creating your business account.
          {page?.version ? ` · Version ${page.version}` : ""}
        </DialogDescription>
      </DialogHeader>

      <div className="auth-terms-dialog-scroll" role="document" aria-label="Terms and conditions content">
        {loading ? <div className="auth-terms-dialog-state">Loading the current Terms & Conditions…</div>
          : error ? <div className="auth-terms-dialog-state auth-terms-dialog-error" role="alert">
            <p>{error}</p>
            {onRetry && <Button type="button" variant="outline" size="sm" onClick={onRetry}>Try again</Button>}
          </div>
          : page ? <PlatformContentRenderer title={page.title || "Terms & Conditions"} components={page.components || []}/>
          : <div className="auth-terms-dialog-state">The current terms are not available. Please try again.</div>}
      </div>

      <div className="auth-terms-dialog-consent">
        <label className="auth-terms-dialog-check">
          <input
            type="checkbox"
            checked={checked || accepted}
            onChange={event => onCheckedChange?.(event.target.checked)}
            disabled={loading || !page?.versionId || accepted}
          />
          <span>I have read and agree to the Terms & Conditions shown above.</span>
        </label>
        <p>Your acceptance is saved with this Terms version and the date and time you agree.</p>
      </div>

      <DialogFooter className="auth-terms-dialog-footer">
        <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)}>
          {accepted ? "Close" : "Not now"}
        </Button>
        <Button type="button" onClick={onAccept} disabled={accepted || loading || !page?.versionId || !checked}>
          <FiCheckCircle aria-hidden="true"/> Agree & continue
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
