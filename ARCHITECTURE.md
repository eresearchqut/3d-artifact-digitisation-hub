# Brief

A platform that enables the management of 3d digital assets. 100% open source.

# Architecture Overview

## Model

- **Asset** → Represents a 3D asset:
  - Supported formats: `.ply`, `.spz`, `.splat`, `.sog`
  - Upload flow: the client calls `POST /asset/upload` (authenticated) to receive a presigned S3 PUT URL; the asset record is written to DynamoDB immediately with `status: pending`, then the client PUTs the file directly to S3
  - Raw uploads are stored in S3 at `assets/{asset_id}`
  - The DynamoDB record (PK=`ASSET#<id>`, SK=`ASSET#<id>`) stores: `bucket`, `key`, `uploadedAt`, `uploadedBy`, `status`, and a `metadata` map containing the original file name, size, MIME type, and last-modified timestamp
  - An asset viewer is generated and stored in S3 under `viewer/{asset_id}/` by the `packages/asset-splat-transform` package
  - Asset access is stored as separate DynamoDB items sharing the asset's partition key: PK=`ASSET#<id>`, SK=`USER#<user_email>` or `TEAM#<team_name>`, with `grantedAt` and `grantedBy` fields
  - The uploading user is automatically granted access (`grantedBy` set to themselves)
  - Additional users and teams can be granted or revoked access at any time with no minimum-owner constraint
  - The asset listing page displays all assets regardless of access
  - When an asset is deleted, all DynamoDB items under `ASSET#<id>` are removed (main record, access records, share records), all share access records under each `SHARE#<id>` are removed, and the raw S3 file and viewer files are deleted

- **User** → Represents a user of the platform:
  - Users are managed in Cognito; each user has an `id` (Cognito username) and an `email`
  - Users can be members of teams
  - Users can be granted access to assets and shares

- **Team** → Represents a group of users:
  - Teams are backed by a Cognito group (group name = team name)
  - Each team has a `name` and an optional `description`
  - Teams can be granted access to assets and shares

- **Share** → Represents a shareable link to an asset's viewer:
  - Stored in DynamoDB with PK=`ASSET#<assetId>`, SK=`SHARE#<shareId>`
  - Fields: `id`, `assetId`, `createdAt`, `createdBy`, optional `durationValue` (integer 1–60), optional `durationUnit` (`minute`|`hour`|`day`|`week`|`month`|`year`), computed `expiresAt` (ISO timestamp derived from duration at creation time), and `isPublic` flag
  - A share with no duration set never expires
  - A public share can be accessed anonymously; the Manage Access controls are hidden for public shares
  - A non-public share can have specific users and teams granted access; access records are stored with PK=`SHARE#<shareId>`, SK=`USER#<email>` or `TEAM#<team_name>`, with `grantedAt` and `grantedBy` fields
  - A share is accessible if: it is public, OR the requester is a listed asset owner or share member, AND either no expiry is set or the expiry has not elapsed
  - Shares are managed from the AssetDetail page and can be revoked at any time
  - The API exposes a dedicated share viewer endpoint `GET /share/{shareId}/{file}` (where `{file}` is one of `index.html`, `index.css`, `index.js`, `index.sog`, `settings.json`). It enforces the access rules above — auth is optional; public shares are served to anyone, non-public shares require the caller to be an asset owner or share member. File serving delegates to the same mechanism as the asset viewer. When a share is created, a lookup record (`PK=SHARE#<id>`, `SK=SHARE#<id>`) is written so the endpoint can resolve the asset without the caller needing to know the `assetId`.

## Packaging

Uses NPM workspace to with packages in the following directories

- api: contains the management API and has endpoints for the above model
- frontend: it contains the management frontend, provides a user interface for uploading and adding metadata to assets, creating and managing teams, creating and managing users, and provisioning shares for assets.
- infra: aws cdk infrastructure to deploy the application

### Management API 

The managment api in the `api` directory and uses the NestJS framework.

-  Uses the @nestjs/config module for configuration
-  Uses the @nestjs/testing module for unit testing
-  Uses the @nestjs/swagger module to generate OpenAPI documentation
-  Uses the @vendia/serverless-express module to serve the API Gateway
-  Uses the @aws-sdk/client-dynamodb module to interact with DynamoDB
-  Uses the @aws-sdk/client-s3 module to interact with s3
-  Uses the @aws-sdk/client-cognito-identity-provider module to interact with Cognito
-  Uses the @aws-sdk/s3-request-presigner to presign S3 requests

- The management API build outputs:

-  An open API spec that represents the API
-  A lambda function that serves the API

The management API can be run locally using
a docker compose file to represent the s3 bucket and dynamodb tables (localstack) and cognito user pool
(cognito-local).

#### Resource Structure

Each resource is implemented using a singular naming convention and a simplified model-driven architecture:

- **Controller**: Handles incoming requests and defines API routes (e.g., `asset.controller.ts`).
- **Service**: Contains the business logic for the resource (e.g., `asset.service.ts`).
- **Model**: A single class used for both data transfer (DTO) and internal representation (e.g., `asset.model.ts`).
- **Module**: Orchestrates the dependency injection for the resource (e.g., `asset.module.ts`).
- **Unit Tests**: Comprehensive test suites for both controllers and services (e.g., `*.spec.ts`).

#### Data Handling

- **Typing**: The project prefers implicit typing and leverages TypeScript's type inference where possible. Explicit types are used only when necessary for clarity or when inference is not sufficient.
- **DynamoDB**: The API uses `@aws-sdk/util-dynamodb` to `marshall` and `unmarshall` objects when interacting with DynamoDB. This ensures consistent mapping between TypeScript objects and DynamoDB attributes.
- **Deconstruction**: The project prefers the use of object deconstruction for assignments and function parameters to improve readability and maintainability.
- **GUIDs**: The `create` method of each resource service generates a GUID (v4) for the resource `id`.

#### Cursor-Based Pagination

All list endpoints use cursor-based (keyset) pagination for stable, performant navigation. Do not use offset-based pagination.

**Query parameters:**
- `limit` (optional): Max records per page (default: 100, max: 1000)
- `cursor` (optional): Opaque base64 cursor from previous response
- `direction` (optional): `forward` (default) or `backward`

**Response format:**
```json
{
  "data": [...],
  "pagination": {
    "limit": 100,
    "has_more": true,
    "next_cursor": "MTczMzU4MDgwMDAwMDphYmMxMjM0...",
    "prev_cursor": null
  }
}
```

### Management Frontend

The management frontend is in the `frontend` directory and uses

- React 19 with TypeScript
- Chakra UI for components
- Storybook for component development
- @tanstack/react-query for data fetching
- @aws-amplify/ui-react for AWS Amplify UI components

The management frontend can be run locally and interacts with the local running instance management API. AWS Amplify should be configured to us the cognito (cognito-local) user pool created by the management API

