export type Role = 'ADMIN' | 'MEMBER' | 'VIEWER';
export type ContentFormat = 'MARKDOWN' | 'PLAIN';
export type ChangeStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface OrgSummary {
  id: string;
  name: string;
  role: Role;
}

export interface Me {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  organizations: OrgSummary[];
}

export interface OrgDetail {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  problemCount: number;
  memberCount: number;
  role: Role;
}

export interface PersonRef {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface ProblemListItem {
  id: string;
  title: string;
  excerpt: string;
  format: ContentFormat;
  tags: string[];
  author: PersonRef;
  attachmentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface ProblemDetail {
  id: string;
  title: string;
  problem: string;
  solution: string;
  format: ContentFormat;
  tags: string[];
  author: PersonRef;
  createdAt: string;
  updatedAt: string;
  attachments: Attachment[];
  pendingRequests: number;
  shareToken: string | null;
  permissions: { canEdit: boolean; canRequestChange: boolean; canShare: boolean };
}

export interface ProblemInput {
  title: string;
  problem: string;
  solution: string;
  format: ContentFormat;
  tags: string[];
  attachmentIds: string[];
}

export interface Member {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: Role;
  joinedAt: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
}

export interface ChangeRequest {
  id: string;
  type: 'EDIT' | 'DELETE';
  status: ChangeStatus;
  createdAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  requester: PersonRef;
  reviewer: PersonRef | null;
  problem: { id: string; title: string; problem: string; solution: string; tags: string[]; format: ContentFormat };
  proposed: ProblemInput | null;
}

export interface PublicProblem {
  title: string;
  problem: string;
  solution: string;
  format: ContentFormat;
  tags: string[];
  organization: string;
  author: string;
  updatedAt: string;
  attachments: Attachment[];
}
