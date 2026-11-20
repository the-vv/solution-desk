import DOMPurify from 'dompurify';
import { Marked } from 'marked';

const marked = new Marked({ gfm: true, breaks: true });

/** Matches an organization attachment URL so it can be swapped for a public share URL. */
const ORG_ATTACHMENT = /\/api\/orgs\/[0-9a-f-]{36}\/attachments\/([0-9a-f-]{36})/g;

export function orgAttachmentUrl(orgId: string, attachmentId: string) {
  return `/api/orgs/${orgId}/attachments/${attachmentId}`;
}

export function publicAttachmentUrl(token: string, attachmentId: string) {
  return `/api/public/share/${encodeURIComponent(token)}/attachments/${attachmentId}`;
}

export function renderMarkdown(source: string, shareToken?: string): string {
  const raw = marked.parse(source, { async: false });
  const html = DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
  return shareToken ? html.replace(ORG_ATTACHMENT, (_m, id: string) => publicAttachmentUrl(shareToken, id)) : html;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
