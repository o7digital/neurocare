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
  seo?: { title?: string; description?: string; noindex?: boolean };
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
