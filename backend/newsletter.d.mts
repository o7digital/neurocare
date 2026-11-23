import type {
  MailchimpSetup,
  NewsletterCampaign,
} from "../src/components/admin/types";
export function escapeHtml(value: unknown): string;
export function sanitizeRichHtml(value: string): string;
export function paragraphsToRichHtml(value: string): string;
export function previewMergeTags(value: string): string;
export function toMailchimpText(value: string): string;
export function buildNewsletterHtml(
  campaign: NewsletterCampaign,
  setup: MailchimpSetup,
): string;
