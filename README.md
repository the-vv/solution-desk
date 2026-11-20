# Solution Desk

Write down problems and their solutions once, find them again in seconds.

- Organizations with roles: **Admin**, **Member**, **Viewer**
- Problems and solutions in Markdown (split live preview) or plain text, with attachments (25 MB each)
- Full-text search plus a "recently added" list
- Share one problem by secret read-only link (no account needed), revocable
- Google sign-in. New users can only create organizations until an admin invites their email
- Edits and deletes of someone else's problem go to an admin for approval

**Stack:** Angular 22, Taiga UI 5, Tailwind CSS 4, NestJS 12, Prisma 7, PostgreSQL 17. pnpm workspaces.

```
apps/api   NestJS API (/api)
apps/web   Angular app
docker/    Dockerfiles and nginx config
```

## Who can do what

| | Admin | Member | Viewer |
|---|---|---|---|
| Search and read | yes | yes | yes |
| Add problems | yes | yes | no |
| Edit or delete own problems | yes | yes | no |
| Edit or delete others' problems | yes | request, admin approves | no |
| Share link (own or any problem) | yes | own problems | no |
| Invite, change roles, remove, approve, settings | yes | no | no |

## Local development

1. Create a Google OAuth client (Web application). Add redirect URI `http://localhost:4200/api/auth/google/callback`.
2. Start the database and API:

```bash
pnpm install
pnpm db:up
```

```bash
export DATABASE_URL=postgresql://solution_desk:dev@localhost:5432/solution_desk
export JWT_SECRET=$(openssl rand -base64 48)
export GOOGLE_CLIENT_ID=your-id GOOGLE_CLIENT_SECRET=your-secret
export PUBLIC_URL=http://localhost:4200 UPLOAD_DIR=./uploads
pnpm --filter api prisma:migrate:deploy
pnpm dev:api
```

```bash
pnpm dev:web   # http://localhost:4200, proxies /api to localhost:3000
```

## Deploy to your VM

The workflow in `.github/workflows/deploy.yml` builds the API and web images, pushes them to Docker Hub, then SSHes into the VM, uploads `docker-compose.yml`, and runs `docker compose pull && up -d`. Database migrations run automatically when the API container starts.

### 1. GitHub secrets

Add these under Settings > Secrets and variables > Actions (the deploy job uses a `production` environment, which you can protect with approvals):

| Secret | Value |
|---|---|
| `DOCKERHUB_USERNAME` | Docker Hub namespace |
| `DOCKERHUB_TOKEN` | Docker Hub access token with write access |
| `VM_HOST` | VM hostname or IP |
| `VM_USER` | SSH user (must be able to run `docker`) |
| `VM_SSH_KEY` | Private key for that user (deploy-only key recommended) |
| `VM_KNOWN_HOSTS` | Output of `ssh-keyscan -p <port> <host>`, so the host key is pinned |
| `VM_DEPLOY_PATH` | Folder on the VM, e.g. `/opt/solution-desk` |
| `VM_PORT` | Optional, defaults to 22 |

### 2. One-time VM setup

```bash
mkdir -p /opt/solution-desk && cd /opt/solution-desk
# copy .env.example here as .env and fill every value
chmod 600 .env
```

If the Docker Hub repositories are private, run `docker login` once on the VM.

### 3. Google OAuth

Create a Web application client in Google Cloud Console. Authorized redirect URI:
`<PUBLIC_URL>/api/auth/google/callback`. Put the client id and secret in the VM `.env`.

### 4. Reverse proxy

Point your proxy at `WEB_BIND_ADDRESS:WEB_PORT` (the web container). It serves the app and forwards `/api` to the API, so everything is one origin. Your proxy must terminate HTTPS and send `X-Forwarded-For` and `X-Forwarded-Proto`. Set the upload limit to at least 26 MB.

### Backups

Two Docker volumes hold all data: `db-data` (Postgres) and `uploads` (attachments). Back up both.

## Notes

- Share links carry a 256-bit random token and give read-only access to one problem and its attachments. Turning a link off invalidates it immediately.
- Attachments are served as downloads, except PNG, JPEG, GIF and WebP which display inline. SVG and HTML never render inline.
- Uploads that were never saved into a problem are removed after 24 hours.
