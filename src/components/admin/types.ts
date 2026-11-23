export type NewsletterEvent = {
  id: string;
  category: string;
  title: string;
  date: string;
  venue: string;
  description: string;
  url: string;
  sourceLabel: string;
  imageUrl?: string;
  month?: string;
  sortDate?: string;
  language?: "es" | "en";
  version?: number;
};
export type NewsletterCampaign = {
  id: string;
  version?: number;
  kind: "email" | "social";
  subject: string;
  body: string;
  bodyHtml?: string;
  headline: string;
  preheader: string;
  eyebrow: string;
  heroImage: string;
  cta: string;
  ctaUrl: string;
  highlights: string[];
  events: NewsletterEvent[];
  month: string;
  monthKey: string;
  year: number;
  status: "DRAFT" | "READY";
  sendWindow: string;
  segment: string;
  goal: string;
  language: "es" | "en";
  channelIds: string[];
  mediaUrl: string;
  mode: "draft" | "queue" | "scheduled";
  dueAt: string;
  design?: Pick<
    MailchimpSetup,
    | "heroImage"
    | "gallery"
    | "address"
    | "phone"
    | "websiteUrl"
    | "reservationUrl"
  >;
  updated?: string;
  sourceCampaignId?: string;
  sourceEventId?: string;
};
export type PreviewMode = "desktop" | "mobile";
export type MailchimpSetup = {
  heroImage: string;
  gallery: string[];
  address: string;
  phone: string;
  websiteUrl: string;
  reservationUrl: string;
  replyTo: string;
  fromName: string;
  fromEmail: string;
  accountLabel: string;
  mailchimp: { apiKey: string; serverPrefix: string; audienceId: string };
  buffer?: { apiKey: string; organizationId: string };
};
export type Delivery = {
  id: string;
  campaign_id: string;
  version: number;
  provider: string;
  target: string;
  status: string;
  remote_id?: string;
  created: string;
};
export type Channel = {
  id: string;
  name: string;
  displayName?: string;
  service: string;
};
export type Lead = {
  id: string;
  visitor_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  interest: string;
  message: string;
  status: string;
  note: string;
  created: string;
  updated: string;
  consent_at: string;
  marketing_consent: boolean;
  mode: string;
  language: string;
  page: string;
};
export type Conversation = {
  id: string;
  mode: string;
  language: string;
  page: string;
  last_message: string;
  updated: string;
};
export type Message = {
  id: string;
  role: string;
  content: string;
  created: string;
};
export type Workspace = {
  user: { id: string; name: string; email: string; role: string };
  posts: Array<Record<string, unknown>>;
  campaigns: NewsletterCampaign[];
  program: Record<string, unknown> | null;
  connections: Record<string, Record<string, unknown>>;
  deliveries: Delivery[];
  marketingSetup: Partial<MailchimpSetup>;
  bufferCheckedAt: string;
  catalog: NewsletterEvent[];
  publications: Array<{
    id: string;
    campaign_id: string;
    month_key: string;
    version: number;
    updated: string;
  }>;
  bufferRemote: Record<
    string,
    { status: string; dueAt?: string; text?: string }
  >;
  media: Array<{ id: string; url: string; name: string; created: string }>;
};
