import { formatDayLabel } from "../../convex/rankingDays";

// Post text, links, and clipboard for weekly top 10 shares. The public
// weekly page, the admin weekly panel, and the Share video page all build
// the same words from here.

const YAPPERS_BOARD = "impressions";
const CONVEX_BOARD = "convex";

export function weeklyPostText(args: {
  communityName: string;
  boardName: string;
  board: string;
  boardLabel: string;
  weekOf: string;
  handles: Array<string>;
}): string {
  const boardTitle = `${args.communityName} ${args.boardName}`;
  const week = `the week ending ${formatDayLabel(args.weekOf)}`;
  const count = args.handles.length;
  const top = count === 1 ? "The top spot" : `Top ${count}`;
  const base =
    args.board === CONVEX_BOARD
      ? `${top} Convex mentions for ${week} on the ${boardTitle}`
      : args.board === YAPPERS_BOARD
        ? `${top} yappers for ${week} on the ${boardTitle}`
        : `${top} on ${args.boardLabel} for ${week} on the ${boardTitle}`;
  const leaders = args.handles
    .slice(0, 3)
    .map((handle) => `@${handle}`)
    .join(" ");
  return leaders ? `${base}: ${leaders}` : base;
}

export function shareLink(shareId: string): string {
  return `${window.location.origin}/b/${shareId}`;
}

export function weeklyPageLink(weekOf: string, board?: string): string {
  const params = new URLSearchParams({ week: weekOf });
  if (board) params.set("board", board);
  return `${window.location.origin}/weekly?${params.toString()}`;
}

export function openXIntent(text: string, url: string): void {
  const intent = new URL("https://x.com/intent/post");
  intent.searchParams.set("text", text);
  intent.searchParams.set("url", url);
  window.open(intent, "_blank", "noopener,noreferrer");
}

// Resolves false when the browser refuses both the Clipboard API (missing,
// or rejected for an unfocused page) and the execCommand fallback.
export async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }
}
