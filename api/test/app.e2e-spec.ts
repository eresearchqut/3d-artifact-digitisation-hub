import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { ConfigService } from '@nestjs/config';
import {
  CognitoIdentityProviderClient,
  CreateUserPoolCommand,
  CreateUserPoolClientCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  InitiateAuthCommand,
  CreateGroupCommand,
  AdminAddUserToGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  DynamoDBClient,
  CreateTableCommand,
  PutItemCommand,
} from '@aws-sdk/client-dynamodb';
import {
  S3Client,
  CreateBucketCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { AppModule } from './../src/app.module';

describe('AppController (e2e) with Testcontainers Integration', () => {
  let localstackContainer: StartedTestContainer;
  let cognitoContainer: StartedTestContainer;
  let app: INestApplication;
  let userPoolId: string;
  let userPoolClientId: string;
  let testIdToken: string;
  let nonAdminIdToken: string;
  const testUserEmail = 'e2e-upload@example.com';
  const testUserPassword = 'TestPass123!';
  const nonAdminEmail = 'e2e-nonadmin@example.com';
  const nonAdminPassword = 'TestPass123!';
  const tableName = 'test-table';

  jest.setTimeout(180000); // Docker can be slow

  beforeAll(async () => {
    // Localstack (S3 & DynamoDB)
    localstackContainer = await new GenericContainer(
      'localstack/localstack:4.14',
    )
      .withExposedPorts(4566)
      .withEnvironment({
        SERVICES: 's3,dynamodb',
      })
      .start();

    // Cognito Local
    cognitoContainer = await new GenericContainer('jagregory/cognito-local')
      .withExposedPorts(9229)
      .start();

    const localstackEndpoint = `http://${localstackContainer.getHost()}:${localstackContainer.getMappedPort(4566)}`;
    const cognitoEndpoint = `http://${cognitoContainer.getHost()}:${cognitoContainer.getMappedPort(9229)}`;

    // Create a User Pool in Cognito Local
    const tempCognitoClient = new CognitoIdentityProviderClient({
      endpoint: cognitoEndpoint,
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test',
      },
    });

    const createPoolResponse = await tempCognitoClient.send(
      new CreateUserPoolCommand({ PoolName: 'test-pool' }),
    );
    userPoolId = createPoolResponse.UserPool?.Id || 'default-id';

    // Create a User Pool Client with USER_PASSWORD_AUTH enabled
    const createClientResponse = await tempCognitoClient.send(
      new CreateUserPoolClientCommand({
        UserPoolId: userPoolId,
        ClientName: 'test-client',
        ExplicitAuthFlows: [
          'ALLOW_USER_PASSWORD_AUTH',
          'ALLOW_REFRESH_TOKEN_AUTH',
        ],
      }),
    );
    userPoolClientId =
      createClientResponse.UserPoolClient?.ClientId || 'default-client-id';

    // Create a test user for upload auth
    await tempCognitoClient.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: testUserEmail,
        TemporaryPassword: 'Temp1234!',
        MessageAction: 'SUPPRESS',
        UserAttributes: [
          { Name: 'email', Value: testUserEmail },
          { Name: 'email_verified', Value: 'true' },
        ],
      }),
    );

    await tempCognitoClient.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: userPoolId,
        Username: testUserEmail,
        Password: testUserPassword,
        Permanent: true,
      }),
    );

    // Create the administrators group and add testUserEmail to it so the token
    // carries cognito:groups = ['administrators'] → isAdmin = true.
    await tempCognitoClient.send(
      new CreateGroupCommand({
        UserPoolId: userPoolId,
        GroupName: 'administrators',
      }),
    );

    await tempCognitoClient.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: userPoolId,
        Username: testUserEmail,
        GroupName: 'administrators',
      }),
    );

    // Obtain an ID token for use in authenticated tests
    const authResult = await tempCognitoClient.send(
      new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: userPoolClientId,
        AuthParameters: {
          USERNAME: testUserEmail,
          PASSWORD: testUserPassword,
        },
      }),
    );
    testIdToken = authResult.AuthenticationResult?.IdToken ?? '';

    // Create a non-admin user for permission boundary tests
    await tempCognitoClient.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: nonAdminEmail,
        TemporaryPassword: 'Temp1234!',
        MessageAction: 'SUPPRESS',
        UserAttributes: [
          { Name: 'email', Value: nonAdminEmail },
          { Name: 'email_verified', Value: 'true' },
        ],
      }),
    );

    await tempCognitoClient.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: userPoolId,
        Username: nonAdminEmail,
        Password: nonAdminPassword,
        Permanent: true,
      }),
    );

    const nonAdminAuthResult = await tempCognitoClient.send(
      new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: userPoolClientId,
        AuthParameters: {
          USERNAME: nonAdminEmail,
          PASSWORD: nonAdminPassword,
        },
      }),
    );
    nonAdminIdToken = nonAdminAuthResult.AuthenticationResult?.IdToken ?? '';

    // Create DynamoDB table
    const tempDynamoClient = new DynamoDBClient({
      endpoint: localstackEndpoint,
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test',
      },
    });

    const tempS3Client = new S3Client({
      endpoint: localstackEndpoint,
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test',
      },
      forcePathStyle: true,
    });

    try {
      await tempS3Client.send(
        new CreateBucketCommand({
          Bucket: 'asset-uploads',
        }),
      );
    } catch (err) {
      console.error('Error creating bucket:', err);
    }

    try {
      await tempDynamoClient.send(
        new CreateTableCommand({
          TableName: tableName,
          KeySchema: [
            { AttributeName: 'PK', KeyType: 'HASH' },
            { AttributeName: 'SK', KeyType: 'RANGE' },
          ],
          AttributeDefinitions: [
            { AttributeName: 'PK', AttributeType: 'S' },
            { AttributeName: 'SK', AttributeType: 'S' },
          ],
          ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5,
          },
        }),
      );

      // Wait a bit for DynamoDB Local to actually have the table ready
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (err) {
      console.error('Error creating table:', err);
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ConfigService)
      .useValue({
        get: jest.fn((key: string) => {
          const config: Record<string, string> = {
            AWS_REGION: 'us-east-1',
            S3_ENDPOINT: localstackEndpoint,
            DYNAMODB_ENDPOINT: localstackEndpoint,
            COGNITO_ENDPOINT: cognitoEndpoint,
            AWS_ACCESS_KEY_ID: 'test',
            AWS_SECRET_ACCESS_KEY: 'test',
            USER_POOL_ID: userPoolId,
            USER_POOL_CLIENT_ID: userPoolClientId,
            DYNAMODB_TABLE_NAME: tableName,
            S3_UPLOAD_BUCKET: 'asset-uploads',
          };
          return config[key];
        }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
    if (localstackContainer) await localstackContainer.stop();
    if (cognitoContainer) await cognitoContainer.stop();
  });

  it('should perform CRUD operations on /team', async () => {
    const auth = { Authorization: `Bearer ${testIdToken}` };

    // 1. Create (POST)
    const createResponse = await request(app.getHttpServer())
      .post('/team')
      .set(auth)
      .send({ name: 'Test-Team' })
      .expect(201);

    const team = createResponse.body;
    expect(team.name).toBe('Test-Team');

    // 2. Find All (GET)
    const findAllResponse = await request(app.getHttpServer())
      .get('/team')
      .set(auth)
      .expect(200);

    expect(findAllResponse.body).toContainEqual(team);

    // 3. Find One (GET :id)
    const findOneResponse = await request(app.getHttpServer())
      .get(`/team/${team.name}`)
      .set(auth)
      .expect(200);

    expect(findOneResponse.body).toEqual(team);

    // 4. Update (PATCH :id)
    const updateResponse = await request(app.getHttpServer())
      .patch(`/team/${team.name}`)
      .set(auth)
      .send({ description: 'Updated Description' })
      .expect(200);

    expect(updateResponse.body.description).toBe('Updated Description');

    // 5. Remove (DELETE :id)
    await request(app.getHttpServer())
      .delete(`/team/${team.name}`)
      .set(auth)
      .expect(200);

    // Verify deletion
    await request(app.getHttpServer())
      .get(`/team/${team.name}`)
      .set(auth)
      .expect(404);
  });

  it('should add and remove users from a team on /team/:id/user/:userId', async () => {
    const auth = { Authorization: `Bearer ${testIdToken}` };

    // 1. Create Team
    const teamResponse = await request(app.getHttpServer())
      .post('/team')
      .set(auth)
      .send({ name: 'E2E-Test-Team' })
      .expect(201);
    const team = teamResponse.body;

    // 2. Create User
    const userResponse = await request(app.getHttpServer())
      .post('/user')
      .set(auth)
      .send({ email: 'e2e-team-user@example.com' })
      .expect(201);
    const user = userResponse.body;

    // 3. Add user to team (POST)
    await request(app.getHttpServer())
      .post(`/team/${team.name}/user/${user.id}`)
      .set(auth)
      .expect(201);

    // 4. List users in team (GET)
    const listUsersResponse = await request(app.getHttpServer())
      .get(`/team/${team.name}/user`)
      .set(auth)
      .expect(200);

    expect(listUsersResponse.body).toHaveLength(1);
    expect(listUsersResponse.body[0]).toMatchObject({
      id: user.id,
      email: user.email,
    });

    // 5. Remove user from team (DELETE)
    await request(app.getHttpServer())
      .delete(`/team/${team.name}/user/${user.id}`)
      .set(auth)
      .expect(200);

    // Cleanup
    await request(app.getHttpServer())
      .delete(`/team/${team.name}`)
      .set(auth)
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/user/${user.id}`)
      .set(auth)
      .expect(200);
  });

  it('should perform CRUD operations on /user', async () => {
    const auth = { Authorization: `Bearer ${testIdToken}` };

    // 1. Create (POST)
    const createResponse = await request(app.getHttpServer())
      .post('/user')
      .set(auth)
      .send({ email: 'test@example.com' })
      .expect(201);

    const user = createResponse.body;
    expect(user.id).toBeDefined();
    expect(user.email).toBe('test@example.com');

    // 2. Find All (GET)
    const findAllResponse = await request(app.getHttpServer())
      .get('/user')
      .set(auth)
      .expect(200);

    // The findAll response includes isAdmin; use objectContaining so the
    // assertion is robust to additional fields added in future.
    expect(findAllResponse.body).toContainEqual(
      expect.objectContaining({ id: user.id, email: user.email }),
    );

    // 3. Find One (GET :id)
    const findOneResponse = await request(app.getHttpServer())
      .get(`/user/${user.id}`)
      .set(auth)
      .expect(200);

    expect(findOneResponse.body).toEqual(
      expect.objectContaining({ id: user.id, email: user.email }),
    );

    // 4. Update (PATCH :id)
    const updateResponse = await request(app.getHttpServer())
      .patch(`/user/${user.id}`)
      .set(auth)
      .send({ email: 'updated@example.com' })
      .expect(200);

    expect(updateResponse.body.email).toBe('updated@example.com');

    // 5. Remove (DELETE :id)
    await request(app.getHttpServer())
      .delete(`/user/${user.id}`)
      .set(auth)
      .expect(200);

    // Verify deletion
    await request(app.getHttpServer())
      .get(`/user/${user.id}`)
      .set(auth)
      .expect(404);
  });

  it('should be able to add, delete, and add a user again', async () => {
    const auth = { Authorization: `Bearer ${testIdToken}` };
    const email = 'readd_test@example.com';

    // 1. Create User
    const createRes1 = await request(app.getHttpServer())
      .post('/user')
      .set(auth)
      .send({ email })
      .expect(201);
    const userId1 = createRes1.body.id;

    // 2. Delete User
    await request(app.getHttpServer())
      .delete(`/user/${userId1}`)
      .set(auth)
      .expect(200);

    // 3. Create User again
    const createRes2 = await request(app.getHttpServer())
      .post('/user')
      .set(auth)
      .send({ email })
      .expect(201);
    const userId2 = createRes2.body.id;

    expect(userId2).toBeDefined();

    // Cleanup
    await request(app.getHttpServer())
      .delete(`/user/${userId2}`)
      .set(auth)
      .expect(200);
  });

  it('should perform GET and DELETE operations on /asset', async () => {
    const dynamoDBClient = app.get(DynamoDBClient);
    const id = 'e2e-asset-123';

    // 1. Seed the database (simulate Lambda)
    await dynamoDBClient.send(
      new PutItemCommand({
        TableName: tableName,
        Item: {
          PK: { S: `ASSET#${id}` },
          SK: { S: `ASSET#${id}` },
          key: { S: `assets/${id}` },
        },
      }),
    );

    // 2. Find All (GET)
    const findAllResponse = await request(app.getHttpServer())
      .get('/asset')
      .expect(200);

    expect(findAllResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id,
          key: `assets/${id}`,
        }),
      ]),
    );

    // 3. Find One (GET :id)
    const findOneResponse = await request(app.getHttpServer())
      .get(`/asset/${id}`)
      .expect(200);

    expect(findOneResponse.body).toEqual({
      id,
      key: `assets/${id}`,
    });

    // 4. Remove (DELETE :id)
    await request(app.getHttpServer()).delete(`/asset/${id}`).expect(200);

    // Verify deletion
    await request(app.getHttpServer()).get(`/asset/${id}`).expect(404);
  });

  it('should generate a presigned upload URL for a asset', async () => {
    // 1. Request presigned URL — must include the ID token from the test user
    const uploadUrlResponse = await request(app.getHttpServer())
      .post(`/asset/upload`)
      .set('Authorization', `Bearer ${testIdToken}`)
      .send({ metadata: { name: 'test.ply' } })
      .expect(201);

    const data = uploadUrlResponse.body;
    const assetId = data.id;
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('uploadUrl');
    expect(data.uploadUrl).toContain('asset-uploads');
    expect(data.uploadUrl).toContain(assetId);
    expect(data.uploadUrl).toContain('X-Amz-Algorithm');

    // 2. Perform actual upload using the presigned URL
    const dummyContent =
      'ply\nformat ascii 1.0\nelement vertex 0\nend_header\n';
    const uploadResponse = await fetch(data.uploadUrl, {
      method: 'PUT',
      body: dummyContent,
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-amz-meta-name': 'test.ply',
      },
    });

    expect(uploadResponse.ok).toBe(true);
    expect(uploadResponse.status).toBe(200);

    // 3. Simulate S3 Event for the listener Lambda
    process.env.DYNAMODB_ENDPOINT = `http://${localstackContainer.getHost()}:${localstackContainer.getMappedPort(4566)}`;
    process.env.S3_ENDPOINT = `http://${localstackContainer.getHost()}:${localstackContainer.getMappedPort(4566)}`;
    process.env.DYNAMODB_TABLE = tableName;
    process.env.AWS_REGION = 'us-east-1';

    const { handler: assetUploadListener } =
      await import('../../packages/asset-upload-listener/src/index');

    const mockS3Event: any = {
      version: '0',
      id: 'test-event-id',
      source: 'aws.s3',
      account: '123456789012',
      time: new Date().toISOString(),
      region: 'us-east-1',
      resources: [],
      'detail-type': 'Object Created',
      detail: {
        version: '0',
        bucket: { name: 'asset-uploads' },
        object: {
          key: `assets/${assetId}`,
          size: 100,
          etag: 'dummy',
          sequencer: '0',
        },
        'request-id': 'test-request-id',
        requester: 'test-requester',
        reason: 'PutObject',
      },
    };

    await assetUploadListener(mockS3Event, {} as any, () => {});

    // 4. Verify asset was created and uploadedBy is set
    const getResponse = await request(app.getHttpServer())
      .get(`/asset/${assetId}`)
      .expect(200);

    expect(getResponse.body).toEqual(
      expect.objectContaining({
        id: assetId,
        key: `assets/${assetId}`,
        uploadedBy: testUserEmail,
        metadata: expect.any(Object),
        status: 'UPLOADED',
      }),
    );
  });

  it('should have ConfigService providing the correct USER_POOL_ID', () => {
    const configService = app.get<ConfigService>(ConfigService);
    expect(configService.get('USER_POOL_ID')).toBe(userPoolId);
  });

  describe('GET /share/:shareId/:file — share viewer access control', () => {
    const assetId = 'e2e-share-viewer-asset';
    const publicShareId = 'e2e-public-share';
    const ownerShareId = 'e2e-owner-share';
    const memberShareId = 'e2e-member-share';
    const expiredShareId = 'e2e-expired-share';

    beforeAll(async () => {
      const dynamoDBClient = app.get(DynamoDBClient);
      const s3Client = app.get(S3Client);
      const now = new Date().toISOString();
      const expired = new Date(Date.now() - 60_000).toISOString();

      // Asset record
      await dynamoDBClient.send(
        new PutItemCommand({
          TableName: tableName,
          Item: {
            PK: { S: `ASSET#${assetId}` },
            SK: { S: `ASSET#${assetId}` },
            key: { S: `assets/${assetId}` },
          },
        }),
      );

      // Asset owner access — testUserEmail owns this asset
      await dynamoDBClient.send(
        new PutItemCommand({
          TableName: tableName,
          Item: {
            PK: { S: `ASSET#${assetId}` },
            SK: { S: `USER#${testUserEmail}` },
            grantedAt: { S: now },
            grantedBy: { S: testUserEmail },
          },
        }),
      );

      // Public share — main item + lookup record
      for (const share of [
        { id: publicShareId, isPublic: true, expiresAt: null },
        { id: ownerShareId, isPublic: false, expiresAt: null },
        { id: memberShareId, isPublic: false, expiresAt: null },
        { id: expiredShareId, isPublic: true, expiresAt: expired },
      ]) {
        const item: Record<string, any> = {
          PK: { S: `ASSET#${assetId}` },
          SK: { S: `SHARE#${share.id}` },
          shareId: { S: share.id },
          assetId: { S: assetId },
          createdAt: { S: now },
          isPublic: { BOOL: share.isPublic },
        };
        if (share.expiresAt) {
          item.expiresAt = { S: share.expiresAt };
        }
        await dynamoDBClient.send(
          new PutItemCommand({ TableName: tableName, Item: item }),
        );

        // Lookup record so getShareViewerFile can resolve assetId by shareId
        await dynamoDBClient.send(
          new PutItemCommand({
            TableName: tableName,
            Item: {
              PK: { S: `SHARE#${share.id}` },
              SK: { S: `SHARE#${share.id}` },
              assetId: { S: assetId },
            },
          }),
        );
      }

      // Share member access on memberShare — testUserEmail is a share member
      await dynamoDBClient.send(
        new PutItemCommand({
          TableName: tableName,
          Item: {
            PK: { S: `SHARE#${memberShareId}` },
            SK: { S: `USER#${testUserEmail}` },
            grantedAt: { S: now },
          },
        }),
      );

      // Seed a minimal viewer index.html in S3
      await s3Client.send(
        new PutObjectCommand({
          Bucket: 'asset-uploads',
          Key: `viewer/${assetId}/index.html`,
          Body: '<html><body>viewer</body></html>',
          ContentType: 'text/html',
        }),
      );
    });

    it('serves a public share without authentication', async () => {
      await request(app.getHttpServer())
        .get(`/share/${publicShareId}/index.html`)
        .expect(200);
    });

    it('serves a non-public share to an authenticated asset owner', async () => {
      await request(app.getHttpServer())
        .get(`/share/${ownerShareId}/index.html`)
        .set('Authorization', `Bearer ${testIdToken}`)
        .expect(200);
    });

    it('serves a non-public share to an authenticated share member', async () => {
      await request(app.getHttpServer())
        .get(`/share/${memberShareId}/index.html`)
        .set('Authorization', `Bearer ${testIdToken}`)
        .expect(200);
    });

    it('rejects an unauthenticated request to a non-public share with 403', async () => {
      await request(app.getHttpServer())
        .get(`/share/${ownerShareId}/index.html`)
        .expect(403);
    });

    it('rejects an expired share with 403', async () => {
      await request(app.getHttpServer())
        .get(`/share/${expiredShareId}/index.html`)
        .expect(403);
    });

    it('returns 404 for a non-existent share', async () => {
      await request(app.getHttpServer())
        .get('/share/00000000-0000-0000-0000-000000000000/index.html')
        .expect(404);
    });
  });

  describe('Admin role', () => {
    const adminAuth = () => ({ Authorization: `Bearer ${testIdToken}` });
    const nonAdminAuth = () => ({ Authorization: `Bearer ${nonAdminIdToken}` });

    it('non-admin GET /user returns 200 with filtered results (empty, no teams yet)', async () => {
      const res = await request(app.getHttpServer())
        .get('/user')
        .set(nonAdminAuth())
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      // nonAdminIdToken was issued before team membership, so groups = [] → empty list
      expect(res.body).toEqual([]);
    });

    it('non-admin GET /team returns 200 with filtered results (empty, no teams yet)', async () => {
      const res = await request(app.getHttpServer())
        .get('/team')
        .set(nonAdminAuth())
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Same reason as above — no groups in token yet
      expect(res.body).toEqual([]);
    });

    it('unauthenticated request to GET /user returns 401', async () => {
      await request(app.getHttpServer()).get('/user').expect(401);
    });

    it('admin can access GET /user and responses include sub', async () => {
      const response = await request(app.getHttpServer())
        .get('/user')
        .set(adminAuth())
        .expect(200);

      const adminUser = response.body.find(
        (u: any) => u.email === testUserEmail,
      );
      expect(adminUser).toBeDefined();
      expect(adminUser.sub).toBeDefined();

      // sub in the response must match the sub claim in the JWT
      const jwtPayload = JSON.parse(
        Buffer.from(testIdToken.split('.')[1], 'base64url').toString(),
      );
      expect(adminUser.sub).toBe(jwtPayload.sub);
    });

    it('admin cannot remove their own admin role (403)', async () => {
      await request(app.getHttpServer())
        .put(`/user/${testUserEmail}/admin`)
        .set(adminAuth())
        .send({ isAdmin: false })
        .expect(403);
    });

    it('admin can grant the admin role to another user', async () => {
      await request(app.getHttpServer())
        .put(`/user/${nonAdminEmail}/admin`)
        .set(adminAuth())
        .send({ isAdmin: true })
        .expect(200);

      const userResponse = await request(app.getHttpServer())
        .get(`/user/${nonAdminEmail}`)
        .set(adminAuth())
        .expect(200);
      expect(userResponse.body.isAdmin).toBe(true);
    });

    it('admin can revoke the admin role from another user', async () => {
      await request(app.getHttpServer())
        .put(`/user/${nonAdminEmail}/admin`)
        .set(adminAuth())
        .send({ isAdmin: false })
        .expect(200);

      const userResponse = await request(app.getHttpServer())
        .get(`/user/${nonAdminEmail}`)
        .set(adminAuth())
        .expect(200);
      expect(userResponse.body.isAdmin).toBe(false);
    });

    it('cannot create a team named "administrators" (403)', async () => {
      await request(app.getHttpServer())
        .post('/team')
        .set(adminAuth())
        .send({ name: 'administrators' })
        .expect(403);
    });

    it('GET /team does not include the administrators group', async () => {
      const response = await request(app.getHttpServer())
        .get('/team')
        .set(adminAuth())
        .expect(200);

      const names: string[] = response.body.map((t: any) => t.name);
      expect(names).not.toContain('administrators');
    });
  });

  // ─── Non-admin filtering & access-grant authorisation ───────────────────────
  //
  // These tests cover:
  //   1. GET /team and GET /user return filtered results for non-admins
  //   2. Non-admins can grant asset/share access to their own teams and team members
  //   3. Non-admins are blocked from granting access to teams/users outside their teams
  //   4. Non-admins are blocked from granting access to assets they don't own/access
  //
  // A fresh Cognito token is obtained for the non-admin *after* they are added to
  // a team, so the JWT carries the correct cognito:groups claim.

  describe('Non-admin filtering and access-grant authorisation', () => {
    const adminAuth = () => ({ Authorization: `Bearer ${testIdToken}` });
    let nonAdminTeamToken: string;
    let nonAdminAssetId: string;
    let nonAdminShareId: string;
    const sharedTeamName = 'e2e-nonadmin-team';
    const teamMemberEmail = 'e2e-team-member@example.com';
    const outsideUserEmail = 'e2e-outside-user@example.com';

    beforeAll(async () => {
      const cognitoClient = app.get(CognitoIdentityProviderClient);
      const configService = app.get(ConfigService);
      const clientId = configService.get<string>('USER_POOL_CLIENT_ID');

      // Create the shared team and add non-admin to it
      await request(app.getHttpServer())
        .post('/team')
        .set(adminAuth())
        .send({ name: sharedTeamName })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/team/${sharedTeamName}/user/${encodeURIComponent(nonAdminEmail)}`)
        .set(adminAuth())
        .expect(201);

      // Create a team member who shares the team with the non-admin
      await request(app.getHttpServer())
        .post('/user')
        .set(adminAuth())
        .send({ email: teamMemberEmail })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/team/${sharedTeamName}/user/${encodeURIComponent(teamMemberEmail)}`)
        .set(adminAuth())
        .expect(201);

      // Create an outside user NOT in any shared team
      await request(app.getHttpServer())
        .post('/user')
        .set(adminAuth())
        .send({ email: outsideUserEmail })
        .expect(201);

      // Re-authenticate the non-admin to get a fresh JWT with cognito:groups
      const authResult = await cognitoClient.send(
        new InitiateAuthCommand({
          AuthFlow: 'USER_PASSWORD_AUTH',
          ClientId: clientId,
          AuthParameters: {
            USERNAME: nonAdminEmail,
            PASSWORD: nonAdminPassword,
          },
        }),
      );
      nonAdminTeamToken = authResult.AuthenticationResult?.IdToken ?? '';

      // Admin creates an asset and grants the non-admin access to it
      const uploadRes = await request(app.getHttpServer())
        .post('/asset/upload')
        .set(adminAuth())
        .send({ metadata: { name: 'nonadmin-owned.ply' } })
        .expect(201);
      nonAdminAssetId = uploadRes.body.id;
      await request(app.getHttpServer())
        .post(
          `/asset/${nonAdminAssetId}/user/${encodeURIComponent(nonAdminEmail)}`,
        )
        .set(adminAuth())
        .expect(201);

      // Create a share on that asset
      const shareRes = await request(app.getHttpServer())
        .post(`/asset/${nonAdminAssetId}/share`)
        .set(adminAuth())
        .send({ isPublic: false })
        .expect(201);
      nonAdminShareId = shareRes.body.id;
    });

    afterAll(async () => {
      await Promise.allSettled([
        request(app.getHttpServer())
          .delete(`/asset/${nonAdminAssetId}`)
          .set(adminAuth()),
        request(app.getHttpServer())
          .delete(`/user/${encodeURIComponent(teamMemberEmail)}`)
          .set(adminAuth()),
        request(app.getHttpServer())
          .delete(`/user/${encodeURIComponent(outsideUserEmail)}`)
          .set(adminAuth()),
        request(app.getHttpServer())
          .delete(`/team/${sharedTeamName}`)
          .set(adminAuth()),
      ]);
    });

    // ── Filtering ─────────────────────────────────────────────────────────────

    it('non-admin GET /team returns only teams they belong to', async () => {
      const res = await request(app.getHttpServer())
        .get('/team')
        .set({ Authorization: `Bearer ${nonAdminTeamToken}` })
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const names: string[] = res.body.map((t: any) => t.name);
      expect(names).toContain(sharedTeamName);
      expect(names).not.toContain('administrators');
    });

    it('non-admin GET /user returns only users from their teams', async () => {
      const res = await request(app.getHttpServer())
        .get('/user')
        .set({ Authorization: `Bearer ${nonAdminTeamToken}` })
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const emails: string[] = res.body.map((u: any) => u.email);
      expect(emails).toContain(teamMemberEmail);
      expect(emails).not.toContain(outsideUserEmail);
    });

    it('non-admin GET /asset returns only assets they have access to', async () => {
      const res = await request(app.getHttpServer())
        .get('/asset')
        .set({ Authorization: `Bearer ${nonAdminTeamToken}` })
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const ids: string[] = res.body.map((a: any) => a.id);
      expect(ids).toContain(nonAdminAssetId);
    });

    // ── Asset access grants ───────────────────────────────────────────────────

    it('non-admin CAN add a team they belong to on an asset they have access to', async () => {
      await request(app.getHttpServer())
        .post(
          `/asset/${nonAdminAssetId}/team/${encodeURIComponent(sharedTeamName)}`,
        )
        .set({ Authorization: `Bearer ${nonAdminTeamToken}` })
        .expect(201);

      // verify it appears, then revoke so later tests start clean
      const listRes = await request(app.getHttpServer())
        .get(`/asset/${nonAdminAssetId}/team`)
        .set(adminAuth())
        .expect(200);
      expect(listRes.body.map((a: any) => a.id)).toContain(sharedTeamName);

      await request(app.getHttpServer())
        .delete(
          `/asset/${nonAdminAssetId}/team/${encodeURIComponent(sharedTeamName)}`,
        )
        .set(adminAuth());
    });

    it('non-admin CANNOT add a team they are NOT a member of to an asset (403)', async () => {
      await request(app.getHttpServer())
        .post(`/asset/${nonAdminAssetId}/team/some-other-team`)
        .set({ Authorization: `Bearer ${nonAdminTeamToken}` })
        .expect(403);
    });

    it('non-admin CAN add a user who shares their team to an asset they have access to', async () => {
      await request(app.getHttpServer())
        .post(
          `/asset/${nonAdminAssetId}/user/${encodeURIComponent(teamMemberEmail)}`,
        )
        .set({ Authorization: `Bearer ${nonAdminTeamToken}` })
        .expect(201);

      const listRes = await request(app.getHttpServer())
        .get(`/asset/${nonAdminAssetId}/user`)
        .set(adminAuth())
        .expect(200);
      expect(listRes.body.map((a: any) => a.id)).toContain(teamMemberEmail);

      await request(app.getHttpServer())
        .delete(
          `/asset/${nonAdminAssetId}/user/${encodeURIComponent(teamMemberEmail)}`,
        )
        .set(adminAuth());
    });

    it('non-admin CANNOT add a user NOT in their teams to an asset (403)', async () => {
      await request(app.getHttpServer())
        .post(
          `/asset/${nonAdminAssetId}/user/${encodeURIComponent(outsideUserEmail)}`,
        )
        .set({ Authorization: `Bearer ${nonAdminTeamToken}` })
        .expect(403);
    });

    it('non-admin CANNOT add access to an asset they do not have access to (403)', async () => {
      const uploadRes = await request(app.getHttpServer())
        .post('/asset/upload')
        .set(adminAuth())
        .send({ metadata: { name: 'unowned.ply' } })
        .expect(201);
      const unownedId = uploadRes.body.id;

      await request(app.getHttpServer())
        .post(
          `/asset/${unownedId}/team/${encodeURIComponent(sharedTeamName)}`,
        )
        .set({ Authorization: `Bearer ${nonAdminTeamToken}` })
        .expect(403);

      await request(app.getHttpServer())
        .delete(`/asset/${unownedId}`)
        .set(adminAuth());
    });

    // ── Share access grants ───────────────────────────────────────────────────

    it('non-admin CAN add their team to a share on an asset they have access to', async () => {
      await request(app.getHttpServer())
        .post(
          `/asset/${nonAdminAssetId}/share/${nonAdminShareId}/team/${encodeURIComponent(sharedTeamName)}`,
        )
        .set({ Authorization: `Bearer ${nonAdminTeamToken}` })
        .expect(201);

      const listRes = await request(app.getHttpServer())
        .get(`/asset/${nonAdminAssetId}/share/${nonAdminShareId}/team`)
        .set(adminAuth())
        .expect(200);
      expect(listRes.body.map((a: any) => a.id)).toContain(sharedTeamName);

      await request(app.getHttpServer())
        .delete(
          `/asset/${nonAdminAssetId}/share/${nonAdminShareId}/team/${encodeURIComponent(sharedTeamName)}`,
        )
        .set(adminAuth());
    });

    it('non-admin CAN add a team member to a share on an asset they have access to', async () => {
      await request(app.getHttpServer())
        .post(
          `/asset/${nonAdminAssetId}/share/${nonAdminShareId}/user/${encodeURIComponent(teamMemberEmail)}`,
        )
        .set({ Authorization: `Bearer ${nonAdminTeamToken}` })
        .expect(201);

      const listRes = await request(app.getHttpServer())
        .get(`/asset/${nonAdminAssetId}/share/${nonAdminShareId}/user`)
        .set(adminAuth())
        .expect(200);
      expect(listRes.body.map((a: any) => a.id)).toContain(teamMemberEmail);

      await request(app.getHttpServer())
        .delete(
          `/asset/${nonAdminAssetId}/share/${nonAdminShareId}/user/${encodeURIComponent(teamMemberEmail)}`,
        )
        .set(adminAuth());
    });

    it('non-admin CANNOT add a user not in their teams to a share (403)', async () => {
      await request(app.getHttpServer())
        .post(
          `/asset/${nonAdminAssetId}/share/${nonAdminShareId}/user/${encodeURIComponent(outsideUserEmail)}`,
        )
        .set({ Authorization: `Bearer ${nonAdminTeamToken}` })
        .expect(403);
    });

    it('non-admin CANNOT add a team they are not in to a share (403)', async () => {
      await request(app.getHttpServer())
        .post(
          `/asset/${nonAdminAssetId}/share/${nonAdminShareId}/team/some-other-team`,
        )
        .set({ Authorization: `Bearer ${nonAdminTeamToken}` })
        .expect(403);
    });
  });

  // ─── Asset & Share access management ─────────────────────────────────────────
  //
  // These tests directly exercise the endpoints that power the "Manage Access"
  // section of the AssetDetailPage — the area that was reported as broken in
  // production. They cover the full grant / list / revoke lifecycle for both
  // users and teams on assets and shares.

  describe('Asset access management', () => {
    const auth = () => ({ Authorization: `Bearer ${testIdToken}` });
    let assetId: string;
    let shareId: string;
    let memberUserId: string;
    const memberEmail = 'e2e-access-member@example.com';
    const teamName = 'e2e-access-team';

    beforeAll(async () => {
      // Create the asset via the upload endpoint so it is a real DB record
      const uploadRes = await request(app.getHttpServer())
        .post('/asset/upload')
        .set(auth())
        .send({ metadata: { name: 'access-test.ply' } })
        .expect(201);
      assetId = uploadRes.body.id;

      // Create a second user to be used as the access member
      const userRes = await request(app.getHttpServer())
        .post('/user')
        .set(auth())
        .send({ email: memberEmail })
        .expect(201);
      memberUserId = userRes.body.id;

      // Create a team to be used for team access
      await request(app.getHttpServer())
        .post('/team')
        .set(auth())
        .send({ name: teamName })
        .expect(201);

      // Create a share for share-access tests
      const shareRes = await request(app.getHttpServer())
        .post(`/asset/${assetId}/share`)
        .set(auth())
        .send({ isPublic: false })
        .expect(201);
      shareId = shareRes.body.id;
    });

    afterAll(async () => {
      // Best-effort cleanup — ignore errors if resources were already removed
      await request(app.getHttpServer())
        .delete(`/asset/${assetId}`)
        .set(auth());
      await request(app.getHttpServer())
        .delete(`/user/${memberUserId}`)
        .set(auth());
      await request(app.getHttpServer())
        .delete(`/team/${teamName}`)
        .set(auth());
    });

    // ── User list ─────────────────────────────────────────────────────────────

    it('GET /user returns a paginated list of users for an admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/user')
        .set(auth())
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);

      const found = res.body.find((u: any) => u.email === testUserEmail);
      expect(found).toBeDefined();
    });

    // ── Team create ───────────────────────────────────────────────────────────

    it('POST /team creates a new team for an admin', async () => {
      const name = 'e2e-create-team-check';
      const res = await request(app.getHttpServer())
        .post('/team')
        .set(auth())
        .send({ name })
        .expect(201);

      expect(res.body.name).toBe(name);

      // Verify it appears in the list
      const listRes = await request(app.getHttpServer())
        .get('/team')
        .set(auth())
        .expect(200);
      expect(listRes.body.map((t: any) => t.name)).toContain(name);

      // Cleanup
      await request(app.getHttpServer())
        .delete(`/team/${name}`)
        .set(auth())
        .expect(200);
    });

    // ── Asset user access ─────────────────────────────────────────────────────

    it('POST /asset/:id/user/:email grants a user access to an asset', async () => {
      await request(app.getHttpServer())
        .post(`/asset/${assetId}/user/${encodeURIComponent(memberEmail)}`)
        .set(auth())
        .expect(201);
    });

    it('GET /asset/:id/user lists users with access to an asset', async () => {
      const res = await request(app.getHttpServer())
        .get(`/asset/${assetId}/user`)
        .set(auth())
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);

      // The uploading user is automatically granted access; the member we added
      // should also appear.
      const emails = res.body.map((a: any) => a.id);
      expect(emails).toContain(memberEmail);
    });

    it('DELETE /asset/:id/user/:email revokes a user from an asset', async () => {
      await request(app.getHttpServer())
        .delete(`/asset/${assetId}/user/${encodeURIComponent(memberEmail)}`)
        .set(auth())
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/asset/${assetId}/user`)
        .set(auth())
        .expect(200);

      const emails = res.body.map((a: any) => a.id);
      expect(emails).not.toContain(memberEmail);
    });

    // ── Asset team access ─────────────────────────────────────────────────────

    it('POST /asset/:id/team/:teamName grants a team access to an asset', async () => {
      await request(app.getHttpServer())
        .post(`/asset/${assetId}/team/${encodeURIComponent(teamName)}`)
        .set(auth())
        .expect(201);
    });

    it('GET /asset/:id/team lists teams with access to an asset', async () => {
      const res = await request(app.getHttpServer())
        .get(`/asset/${assetId}/team`)
        .set(auth())
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const names = res.body.map((a: any) => a.id);
      expect(names).toContain(teamName);
    });

    it('DELETE /asset/:id/team/:teamName revokes a team from an asset', async () => {
      await request(app.getHttpServer())
        .delete(`/asset/${assetId}/team/${encodeURIComponent(teamName)}`)
        .set(auth())
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/asset/${assetId}/team`)
        .set(auth())
        .expect(200);

      const names = res.body.map((a: any) => a.id);
      expect(names).not.toContain(teamName);
    });

    // ── Share user access ─────────────────────────────────────────────────────

    it('POST /asset/:assetId/share/:shareId/user/:email grants a user access to a share', async () => {
      await request(app.getHttpServer())
        .post(
          `/asset/${assetId}/share/${shareId}/user/${encodeURIComponent(memberEmail)}`,
        )
        .set(auth())
        .expect(201);
    });

    it('GET /asset/:assetId/share/:shareId/user lists users with access to a share', async () => {
      const res = await request(app.getHttpServer())
        .get(`/asset/${assetId}/share/${shareId}/user`)
        .set(auth())
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const emails = res.body.map((a: any) => a.id);
      expect(emails).toContain(memberEmail);
    });

    it('DELETE /asset/:assetId/share/:shareId/user/:email revokes a user from a share', async () => {
      await request(app.getHttpServer())
        .delete(
          `/asset/${assetId}/share/${shareId}/user/${encodeURIComponent(memberEmail)}`,
        )
        .set(auth())
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/asset/${assetId}/share/${shareId}/user`)
        .set(auth())
        .expect(200);

      const emails = res.body.map((a: any) => a.id);
      expect(emails).not.toContain(memberEmail);
    });

    // ── Share team access ─────────────────────────────────────────────────────

    it('POST /asset/:assetId/share/:shareId/team/:teamName grants a team access to a share', async () => {
      await request(app.getHttpServer())
        .post(
          `/asset/${assetId}/share/${shareId}/team/${encodeURIComponent(teamName)}`,
        )
        .set(auth())
        .expect(201);
    });

    it('GET /asset/:assetId/share/:shareId/team lists teams with access to a share', async () => {
      const res = await request(app.getHttpServer())
        .get(`/asset/${assetId}/share/${shareId}/team`)
        .set(auth())
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const names = res.body.map((a: any) => a.id);
      expect(names).toContain(teamName);
    });

    it('DELETE /asset/:assetId/share/:shareId/team/:teamName revokes a team from a share', async () => {
      await request(app.getHttpServer())
        .delete(
          `/asset/${assetId}/share/${shareId}/team/${encodeURIComponent(teamName)}`,
        )
        .set(auth())
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/asset/${assetId}/share/${shareId}/team`)
        .set(auth())
        .expect(200);

      const names = res.body.map((a: any) => a.id);
      expect(names).not.toContain(teamName);
    });
  });
});
