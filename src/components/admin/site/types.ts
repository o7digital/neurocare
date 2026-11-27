export type SiteField = {
  id: string;
  key: string;
  document: string;
  page: string;
  kind: "text" | "image" | "link" | "alt";
  section: string;
  label: string;
  source: string;
  sourceHash: string;
  runtime?: string;
};
export type SiteDraft = {
  values: Record<string, string>;
  blocks?: SiteBlock[];
  seo?: { title?: string; description?: string; noindex?: boolean };
};
export type SiteBlock = {
  id: string;
  type: "text" | "image" | "video" | "columns";
  html?: string;
  src?: string;
  alt?: string;
  caption?: string;
  size?: number;
  font?: "site" | "sans" | "serif" | "georgia";
  align?: "left" | "center" | "right";
  columns?: number;
  children?: SiteBlock[][];
  anchor?: string;
  position?: "before" | "after";
};
export type SitePage = {
  id: string;
  path: string | null;
  locale: "es" | "en" | "shared";
  title: string;
  catalog: SiteField[];
  draft: SiteDraft;
  revision: number;
};
export type SiteData = {
  pages: SitePage[];
  release: string;
  directusUrl: string;
  publishedRevisions?: Record<string, number>;
};
