import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type {
  Attachment,
  ChangeRequest,
  ChangeStatus,
  Invitation,
  Me,
  Member,
  OrgDetail,
  Page,
  ProblemDetail,
  ProblemInput,
  ProblemListItem,
  PublicProblem,
  Role,
} from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  me() {
    return this.http.get<Me>('/api/auth/me');
  }
  logout() {
    return this.http.post('/api/auth/logout', {});
  }

  createOrg(body: { name: string; description?: string }) {
    return this.http.post<{ id: string; name: string }>('/api/orgs', body);
  }
  org(orgId: string) {
    return this.http.get<OrgDetail>(`/api/orgs/${orgId}`);
  }
  updateOrg(orgId: string, body: { name?: string; description?: string }) {
    return this.http.patch(`/api/orgs/${orgId}`, body);
  }
  deleteOrg(orgId: string) {
    return this.http.delete(`/api/orgs/${orgId}`);
  }

  members(orgId: string) {
    return this.http.get<{ members: Member[]; invitations: Invitation[] }>(`/api/orgs/${orgId}/members`);
  }
  invite(orgId: string, body: { email: string; role: Role }) {
    return this.http.post<{ status: 'added' | 'invited' }>(`/api/orgs/${orgId}/invitations`, body);
  }
  cancelInvitation(orgId: string, id: string) {
    return this.http.delete(`/api/orgs/${orgId}/invitations/${id}`);
  }
  changeRole(orgId: string, userId: string, role: Role) {
    return this.http.patch(`/api/orgs/${orgId}/members/${userId}`, { role });
  }
  removeMember(orgId: string, userId: string) {
    return this.http.delete(`/api/orgs/${orgId}/members/${userId}`);
  }

  problems(orgId: string, opts: { q?: string; tag?: string; page?: number; pageSize?: number }) {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(opts)) if (v !== undefined && v !== '') params = params.set(k, String(v));
    return this.http.get<Page<ProblemListItem>>(`/api/orgs/${orgId}/problems`, { params });
  }
  tags(orgId: string) {
    return this.http.get<{ tag: string; count: number }[]>(`/api/orgs/${orgId}/tags`);
  }
  problem(orgId: string, id: string) {
    return this.http.get<ProblemDetail>(`/api/orgs/${orgId}/problems/${id}`);
  }
  createProblem(orgId: string, body: ProblemInput) {
    return this.http.post<{ id: string }>(`/api/orgs/${orgId}/problems`, body);
  }
  updateProblem(orgId: string, id: string, body: ProblemInput) {
    return this.http.patch<{ applied: boolean; changeRequestId?: string }>(`/api/orgs/${orgId}/problems/${id}`, body);
  }
  deleteProblem(orgId: string, id: string) {
    return this.http.delete<{ applied: boolean }>(`/api/orgs/${orgId}/problems/${id}`);
  }

  createShare(orgId: string, id: string) {
    return this.http.post<{ token: string }>(`/api/orgs/${orgId}/problems/${id}/share`, {});
  }
  revokeShare(orgId: string, id: string) {
    return this.http.delete(`/api/orgs/${orgId}/problems/${id}/share`);
  }

  upload(orgId: string, file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<Attachment>(`/api/orgs/${orgId}/attachments`, form);
  }

  changeRequests(orgId: string, status?: ChangeStatus) {
    const params = status ? new HttpParams().set('status', status) : undefined;
    return this.http.get<ChangeRequest[]>(`/api/orgs/${orgId}/change-requests`, { params });
  }
  reviewRequest(orgId: string, id: string, action: 'approve' | 'reject', note?: string) {
    return this.http.post(`/api/orgs/${orgId}/change-requests/${id}/${action}`, note ? { note } : {});
  }
  cancelRequest(orgId: string, id: string) {
    return this.http.delete(`/api/orgs/${orgId}/change-requests/${id}`);
  }

  publicProblem(token: string) {
    return this.http.get<PublicProblem>(`/api/public/share/${encodeURIComponent(token)}`);
  }
}
