# 3D Artifact Digitisation Hub

A self-hosted, open-source platform for managing 3D digital assets. Upload Gaussian Splat and point-cloud files, automatically generate an in-browser viewer for each asset, organise access by user and team, and share assets via expiring links — all deployed to your own AWS account.

---

## Features

- **Upload & store** — supports `.ply`, `.spz`, `.splat`, and `.sog` formats; files are uploaded directly from the browser to S3 via presigned URLs
- **Viewer generation** — uploaded assets are automatically converted to an interactive in-browser viewer (Gaussian Splat renderer) served from S3/CloudFront
- **Asset status tracking** — real-time status updates (`UPLOADING → UPLOADED → VIEWER_BUILDING → VIEWER_CONSTRUCTED`) visible from the asset list
- **Access control** — grant or revoke access to assets per-user or per-team
- **Shareable links** — create public or access-controlled share links with optional expiry (minutes → years)
- **User & team management** — invite users, organise them into teams, promote to administrator role
- **Admin role** — `administrators` Cognito group gates user/team management API endpoints; hidden in the UI for non-admin users

---

## Architecture

```
Browser
  │
  ├── CloudFront CDN ──► S3 (management frontend SPA)
  │
  └── API Gateway ──► Lambda (NestJS management API)
                           │
                    ┌──────┴──────┐
                    │             │
                 DynamoDB       Cognito
                 (assets,       (users,
                  shares,        teams,
                  access)        auth)
                    │
                    └── S3 (raw uploads + generated viewers)
                              │
                    EventBridge (S3 object created)
                              │
                    Lambda: asset-upload-listener
                    (sets status → UPLOADED)
                              │
                    Lambda: asset-splat-transform
                    (converts file, writes viewer to S3,
                     sets status → VIEWER_CONSTRUCTED)
```

### Packages

| Directory | Description |
|---|---|
| `api/` | NestJS management API — REST endpoints for assets, users, teams, shares |
| `frontend/` | React 19 + Chakra UI management SPA |
| `infra/` | AWS CDK stack — provisions all AWS resources |
| `packages/asset-upload-listener/` | Lambda triggered by S3 `Object Created` events |
| `packages/asset-splat-transform/` | Lambda that converts raw uploads into in-browser viewer files |

### AWS Services Used

- **Lambda** — management API, upload listener, splat transform
- **API Gateway** — REST gateway for the management API
- **DynamoDB** — single-table design (PK/SK) for assets, users, teams, shares, and access records
- **S3** — raw asset uploads and generated viewer files
- **Cognito** — user pool for authentication and group-based authorisation
- **CloudFront** — CDN for the management frontend SPA and asset viewer files
- **EventBridge** — triggers background Lambdas on S3 events

---

## Local Development

### Prerequisites

- Node.js ≥ 18
- Docker & Docker Compose
- AWS CDK CLI (`npm install -g aws-cdk`)
- AWS CLI (for deployment)

### 1. Install dependencies

```bash
npm install
```

### 2. Start local AWS services

```bash
cd api
docker compose up
```

This starts:
- **LocalStack** on `:4566` — S3 + DynamoDB
- **cognito-local** on `:9229` — Cognito user pool emulator
- **dynamodb-admin** on `:8001` — DynamoDB browser UI
- **s3manager** on `:8002` — S3 browser UI
- An `aws-cli` init container that creates the S3 bucket, DynamoDB table, Cognito user pool, and local Lambda functions

### 3. Configure the frontend

Create `frontend/.env.local` pointing at your local Cognito and API:

```
VITE_API_URL=http://localhost:3000
VITE_USER_POOL_ID=local_<id>        # from cognito-local output
VITE_USER_POOL_CLIENT_ID=<clientId> # from cognito-local output
VITE_AWS_REGION=us-east-1
```

### 4. Start the app

```bash
npm start
```

This concurrently starts the NestJS API (`:3000`) and the Vite frontend dev server (`:5173`).

### Other useful commands

```bash
npm run test          # run all unit tests
npm run lint          # lint all workspaces
npm run build         # build all workspaces
npm run storybook     # launch Storybook component explorer
```

---

## Deployment

The infrastructure is defined as an AWS CDK stack in `infra/`.

```bash
# Bootstrap your AWS account (first time only)
cdk bootstrap

# Deploy
npm run deploy
```

The stack provisions all resources listed above. Cognito email delivery uses Cognito's default sender (50 emails/day limit). For higher volume, update the `UserPool` construct in `infra/lib/infra-stack.ts` to use SES.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Chakra UI v3, TanStack Query, AWS Amplify UI |
| API | NestJS, TypeScript, `@vendia/serverless-express` |
| Infrastructure | AWS CDK v2, TypeScript |
| Database | DynamoDB (single-table, PAY_PER_REQUEST) |
| Auth | Amazon Cognito (user pool + groups) |
| Local dev | LocalStack, cognito-local, Docker Compose |
| Testing | Jest, `@nestjs/testing`, Testcontainers |

---

## License

This project is licensed under the [MIT License](LICENSE).
