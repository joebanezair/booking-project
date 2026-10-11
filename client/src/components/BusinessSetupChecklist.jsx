import { Link } from "react-router-dom";
import {
  FiArrowRight, FiBriefcase, FiCamera, FiChevronDown, FiCircle,
  FiClock, FiFileText, FiLink, FiSend, FiSettings
} from "react-icons/fi";
import { Button } from "./ui/button.jsx";
import { Card } from "./ui/card.jsx";

const stepIcons = [FiBriefcase, FiFileText, FiCamera, FiClock, FiSettings, FiSend, FiLink];

function LaunchIllustration() {
  return <div className="onboarding-launch-art" aria-hidden="true">
    <svg viewBox="0 0 170 126" fill="none" focusable="false">
      <circle cx="98" cy="64" r="52" fill="currentColor" opacity=".055" />
      <circle cx="105" cy="58" r="37" fill="currentColor" opacity=".045" />
      <path d="M8 94a9 9 0 0 1 9-9h5a14 14 0 0 1 26 2h4a7 7 0 0 1 0 14H17a9 9 0 0 1-9-7Z" fill="currentColor" opacity=".12"/>
      <path d="M137 101a8 8 0 0 1 8-8h4a10 10 0 0 1 19 2h2v12h-26a8 8 0 0 1-7-6Z" fill="currentColor" opacity=".10"/>
      <path d="m35 25 2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5ZM145 24l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z" fill="#EAB54E"/>
      <circle cx="42" cy="51" r="2" fill="#718AF2"/>
      <circle cx="144" cy="68" r="2" fill="#718AF2"/>
      <g transform="translate(96 57) rotate(27)">
        <path d="M-7 38-4 60 0 52l4 8 3-22" fill="#F2AB48"/>
        <path d="M-4 37-2 54 0 47l2 7 2-17" fill="#F8D77A"/>
        <path d="M-13 15-30 36-13 30-8 21M13 15l17 21-17-6-5-9" fill="#4668DD" stroke="#3457DC" strokeWidth="1.4" strokeLinejoin="round"/>
        <path d="M-14 24C-14-12-8-34 0-47 8-34 14-12 14 24l-7 15H-7l-7-15Z" fill="#FBFDFF" stroke="#4765D2" strokeWidth="2" strokeLinejoin="round"/>
        <path d="M-8-30C-6-37-3-43 0-47 3-43 6-37 8-30H-8Z" fill="#4769DD"/>
        <path d="M-14 22H14l-7 17H-7l-7-17Z" fill="#CDD9FF" stroke="#4765D2" strokeWidth="1.4"/>
        <circle cx="0" cy="-8" r="9" fill="#C9DBFF" stroke="#4765D2" strokeWidth="2"/>
        <circle cx="0" cy="-8" r="5" fill="#5881EB"/>
        <path d="M-7 39H7" stroke="#3457DC" strokeWidth="2" strokeLinecap="round"/>
      </g>
    </svg>
  </div>;
}

export default function BusinessSetupChecklist({ items, expanded, onToggle }) {
  const completed = items.filter(item => item.done).length;
  const percentage = Math.round((completed / Math.max(items.length, 1)) * 100);

  return <Card as="section" className="panel onboarding-panel onboarding-relaunch" aria-labelledby="business-setup-title">
    <div className="onboarding-launch-hero">
      <Button type="button" variant="ghost" className="onboarding-collapse-trigger onboarding-launch-trigger"
        onClick={onToggle} aria-expanded={expanded} aria-controls="business-onboarding-steps"
        aria-label={`Business setup checklist, ${percentage}% complete. ${expanded ? "Collapse" : "Expand"} steps`}>
        <span className="onboarding-launch-copy">
          <span className="onboarding-launch-eyebrow">GET READY TO LAUNCH</span>
          <span id="business-setup-title" role="heading" aria-level={2} className="onboarding-launch-title">Business setup checklist</span>
          <span className="onboarding-launch-description">Complete these steps to set up your business and start offering services.</span>
        </span>
        <span className="onboarding-launch-metrics">
          <strong className="onboarding-progress-label">{percentage}%</strong>
          <span>{completed} of {items.length} completed</span>
          <FiChevronDown className={expanded ? "onboarding-chevron open" : "onboarding-chevron"} aria-hidden="true" />
        </span>
      </Button>
      <LaunchIllustration />
    </div>

    <div className="onboarding-progress onboarding-launch-progress" role="progressbar"
      aria-label="Business setup progress" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={completed}>
      <span style={{ width: percentage + "%" }} />
    </div>

    <div id="business-onboarding-steps" className="onboarding-list onboarding-launch-list" hidden={!expanded}>
      {items.map((item, index) => {
        const Icon = stepIcons[index] || FiCircle;
        return <Button key={item.label} asChild variant="ghost">
          <Link className={item.done ? "onboarding-item onboarding-launch-item done" : "onboarding-item onboarding-launch-item"}
            to={item.to} aria-label={`${item.label}. ${item.done ? "Completed" : "Not completed"}. ${item.description}`}>
            <span className="onboarding-item-icon" aria-hidden="true"><Icon /></span>
            <span className="onboarding-item-copy">
              <strong>{item.label}</strong>
              <small>{item.description}</small>
            </span>
            <FiArrowRight className="onboarding-item-arrow" aria-hidden="true" />
          </Link>
        </Button>;
      })}
    </div>
  </Card>;
}
