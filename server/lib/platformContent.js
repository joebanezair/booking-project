import { randomUUID } from "node:crypto";
import PlatformContent from "../models/PlatformContent.js";

const starterPages = {
  terms: {
    title: "Terms & Conditions",
    components: [
      { id: "terms-intro", type: "paragraph", text: "These Terms & Conditions explain the basic rules for creating an account and using BookFlow. Please read them before registering or using the platform." },
      { id: "terms-account", type: "heading", level: 2, text: "1. Account registration" },
      { id: "terms-account-copy", type: "paragraph", text: "You must provide accurate, current information when creating an account. You are responsible for protecting your sign-in credentials and for activity carried out through your account. Keep your account information up to date." },
      { id: "terms-platform", type: "heading", level: 2, text: "2. Acceptable use" },
      { id: "terms-platform-copy", type: "paragraph", text: "Use BookFlow lawfully and respectfully. Do not attempt to disrupt the platform, access another account without permission, submit misleading information, or use the service to violate another person's rights." },
      { id: "terms-business", type: "heading", level: 2, text: "3. Business listings, bookings and transactions" },
      { id: "terms-business-copy", type: "paragraph", text: "Business owners are responsible for the accuracy of their business details, service descriptions, product information, prices, availability and fulfillment. Users should review the relevant business information before confirming a booking or purchase." },
      { id: "terms-content", type: "heading", level: 2, text: "4. Content and intellectual property" },
      { id: "terms-content-copy", type: "paragraph", text: "You retain responsibility for content you submit and must have the rights needed to publish it. You must not upload unlawful, deceptive, abusive or infringing material." },
      { id: "terms-security", type: "heading", level: 2, text: "5. Account restrictions" },
      { id: "terms-security-copy", type: "paragraph", text: "BookFlow may restrict or suspend access where reasonably necessary to protect users, investigate suspected misuse, maintain platform security, or address a violation of these terms." },
      { id: "terms-changes", type: "heading", level: 2, text: "6. Changes to these terms" },
      { id: "terms-changes-copy", type: "paragraph", text: "BookFlow may update these terms. The current published version and its effective publication date will be displayed on this page. Where a new version requires renewed acceptance, users will be asked to review and accept it." },
      { id: "terms-contact", type: "heading", level: 2, text: "7. Contact" },
      { id: "terms-contact-copy", type: "paragraph", text: "For questions about these terms, use the official contact or support channel published by BookFlow." }
    ]
  },
  faqs: {
    title: "Frequently Asked Questions",
    components: [
      { id: "faqs-intro", type: "paragraph", text: "Find answers to common questions about using BookFlow." },
      { id: "faqs-account", type: "faqGroup", title: "Account and registration", questions: [
        { id: "faqs-register", question: "How do I create an account?", answer: "Choose Sign up, provide your business or account name, email address and password, then review and accept the current Terms & Conditions." },
        { id: "faqs-password", question: "What if I forget my password?", answer: "Use the account support channel provided by BookFlow to request help with account access." }
      ] },
      { id: "faqs-business", type: "faqGroup", title: "Business management", questions: [
        { id: "faqs-profile", question: "Where can I update my business information?", answer: "Sign in and open Profile or your Business Page to manage the information shown on your public profile." },
        { id: "faqs-services", question: "How do I manage services and bookings?", answer: "Use the Services and Bookings areas of your business dashboard when the Booking feature is enabled for your account." },
        { id: "faqs-pos", question: "Where can I manage products and sales?", answer: "Use the Products and Sales areas of your dashboard when the POS feature is enabled for your account." }
      ] }
    ]
  }
};

export function versionIdFor(slug, version) {
  return `${slug}-v${Number(version) || 1}`;
}

export async function getOrCreatePlatformPage(slug) {
  if (!Object.hasOwn(starterPages, slug)) throw new Error("Unknown platform page.");
  let page = await PlatformContent.findOne({ slug });
  if (page) return page;
  const now = new Date();
  const starter = starterPages[slug];
  const snapshot = { title: starter.title, components: starter.components, updatedAt: now };
  try {
    return await PlatformContent.create({
      slug, draft: snapshot, published: snapshot, publishedVersion: 1, publishedAt: now,
      revisions: [{
        revisionId: randomUUID(), version: 1, title: starter.title,
        components: starter.components, publishedAt: now, publishedBy: null
      }]
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    return PlatformContent.findOne({ slug });
  }
}

export function publicPlatformPage(page) {
  return {
    slug: page.slug,
    title: page.published.title,
    components: page.published.components || [],
    version: page.publishedVersion,
    versionId: versionIdFor(page.slug, page.publishedVersion),
    publishedAt: page.publishedAt
  };
}
