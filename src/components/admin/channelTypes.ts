export type ChannelThread = {
  id: string;
  mode: "ai" | "manual" | "closed";
  language: string;
  page: string;
  consent_at: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  version: number;
  tags: string[];
  name: string;
  email: string;
  phone: string;
  lead_id: string | null;
  interest: string | null;
  lead_status: string | null;
  followup_note: string | null;
  lead_message: string | null;
  created: string;
  updated: string;
  last_message: string;
  unread: number;
  channel: string;
  site: string;
  siteUrl: string;
};
export type ChannelFile = {
  id: string;
  name: string;
  size: number;
  mime: string;
  url?: string;
};
export type ChannelMessage = {
  id: string;
  role: string;
  content: string;
  created: string;
  sequence: number;
  attachment?: ChannelFile;
};
export type ChannelDetail = {
  conversation: ChannelThread;
  messages: ChannelMessage[];
  notes: Array<{
    id: string;
    author_id: string;
    author: string;
    content: string;
    created: string;
  }>;
  pages: Array<{ id: string; path: string; title: string; created: string }>;
};
export type ChannelSummary = {
  conversations: ChannelThread[];
  counts: Record<string, number>;
  total: number;
  nextOffset: number | null;
  syncedAt: string;
};
export type ChannelSettings = {
  automation: {
    autoReply: boolean;
    humanHandoff: boolean;
    quickReplies: string[];
  };
  channels: Record<string, { connected: boolean }>;
};
