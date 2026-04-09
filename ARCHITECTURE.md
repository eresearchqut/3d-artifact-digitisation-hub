# Brief

A platform that enables the management of 3d digital assets. 100% open source.

# Architecture Overview

## Model

- **Asset** → Represents a 3D asset:
  - Assets are uploaded into S3 using presigned URLs
  - Raw uploads are stored at `assets/{asset_id}`
  - A metadata record is stored in DynamoDB capturing the original file metadata and the user who uploaded the asset (`packages/asset-upload-listener`)
  - An asset viewer is generated and stored in S3 under `viewer/{asset_id}` (`packages/asset-splat-transform`)
  - **Ownership** is managed through a dedicated Cognito group:
    - When an asset is created, a Cognito group is created with the asset ID as the group name
    - The uploading user is the initial owner and is added to that group
    - Additional users and teams can be added to the group to grant access
    - When an asset is deleted, its Cognito group, raw upload, and viewer files are all removed
- **User** → Represents a user of the platform:
  - Users are managed in Cognito
  - Users can be members of teams
  - Users can be granted access to assets via asset ownership groups
- **Team** → Represents a group of users:
  - Teams are backed by a Cognito group (group name = team ID)
  - Teams can be granted access to assets via asset ownership groups


## Packaging

Uses NPM workspace to with packages in the following directories

- api: contains the management API and has endpoints for the above model
- frontend: contains the management frontend, provides a user interface for uploading and adding mettadata to assets, creating and managing teams, creating and managing users, and provisioning shares for assets.
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

