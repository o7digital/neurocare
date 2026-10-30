export type DemoPost = {
  id: string;
  title: string;
  author: string;
  category: string;
  body: string;
  status: "draft" | "preview";
  updated: string;
};
export type DemoProgram = {
  start: string;
  weeks: number;
  minutes: number;
  title: string;
};
export type SocialDraft = {
  image?: string;
  id: string;
  body: string;
  channels: string[];
  date: string;
  prepared: boolean;
};
export const keys = {
  posts: "neurodiversa:demo:posts:v1",
  program: "neurodiversa:demo:program:v1",
  social: "neurodiversa:demo:social:v1",
  newsletters: "neurodiversa:demo:newsletters:v1",
  mailing: "neurodiversa:demo:mailing:v1",
};
export function readDemo<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
export function writeDemo(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export function getPosts(): DemoPost[] {
  const value = readDemo<unknown>(keys.posts, []);
  return Array.isArray(value)
    ? value.filter(
        (p): p is DemoPost =>
          p &&
          typeof p.id === "string" &&
          typeof p.title === "string" &&
          typeof p.body === "string" &&
          typeof p.author === "string" &&
          typeof p.category === "string" &&
          typeof p.updated === "string" &&
          ["draft", "preview"].includes(p.status),
      )
    : [];
}
export function applyProgramPreview() {
  const p = readDemo<Partial<DemoProgram> | null>(keys.program, null);
  if (!p || typeof p !== "object") return;
  const update = (selector: string, value: unknown) => {
    if (typeof value === "string" || typeof value === "number")
      document.querySelectorAll(selector).forEach((el) => {
        el.textContent = String(value);
      });
  };
  if (typeof p.start === "string") update("[data-program-start]", p.start);
  if (typeof p.weeks === "number" && p.weeks >= 1 && p.weeks <= 52)
    update("[data-program-weeks]", p.weeks);
  if (typeof p.minutes === "number" && p.minutes >= 15 && p.minutes <= 240)
    update("[data-program-minutes]", p.minutes);
  if (typeof p.title === "string") update("[data-program-title]", p.title);
}
