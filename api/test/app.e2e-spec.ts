import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { ConfigService } from '@nestjs/config';
import {
  CognitoIdentityProviderClient,
  CreateUserPoolCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  DynamoDBClient,
  CreateTableCommand,
  PutItemCommand,
} from '@aws-sdk/client-dynamodb';
import { S3Client, CreateBucketCommand } from '@aws-sdk/client-s3';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { AppModule } from './../src/app.module';

describe('AppController (e2e) with Testcontainers Integration', () => {
  let localstackContainer: StartedTestContainer;
  let cognitoContainer: StartedTestContainer;
  let app: INestApplication;
  let userPoolId: string;
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

  it('should perform CRUD operations on /organisation', async () => {
    // 1. Create (POST)
    const createResponse = await request(app.getHttpServer())
      .post('/organisation')
      .send({ name: 'Test Organisation' })
      .expect(201);

    const organisation = createResponse.body;
    expect(organisation.id).toBeDefined();
    expect(organisation.name).toBe('Test Organisation');

    // 2. Find All (GET)
    const findAllResponse = await request(app.getHttpServer())
      .get('/organisation')
      .expect(200);

    expect(findAllResponse.body.data).toContainEqual(organisation);

    // 3. Find One (GET :id)
    const findOneResponse = await request(app.getHttpServer())
      .get(`/organisation/${organisation.id}`)
      .expect(200);

    expect(findOneResponse.body).toEqual(organisation);

    // 4. Update (PATCH :id)
    const updateResponse = await request(app.getHttpServer())
      .patch(`/organisation/${organisation.id}`)
      .send({ name: 'Updated Organisation' })
      .expect(200);

    expect(updateResponse.body.name).toBe('Updated Organisation');

    // 5. Remove (DELETE :id)
    await request(app.getHttpServer())
      .delete(`/organisation/${organisation.id}`)
      .expect(200);

    // Verify deletion
    await request(app.getHttpServer())
      .get(`/organisation/${organisation.id}`)
      .expect(404);
  });

  it('should manage organisation-user and organisation-team associations', async () => {
    // 1. Setup: Create Organisation, User, and Team
    const orgRes = await request(app.getHttpServer())
      .post('/organisation')
      .send({ name: 'Assoc Org' })
      .expect(201);
    const org = orgRes.body;

    const userRes = await request(app.getHttpServer())
      .post('/user')
      .send({ email: 'assoc-user@example.com' })
      .expect(201);
    const user = userRes.body;

    const teamRes = await request(app.getHttpServer())
      .post('/team')
      .send({ name: 'Assoc Team' })
      .expect(201);
    const team = teamRes.body;

    // 2. Add user to organisation
    await request(app.getHttpServer())
      .post(`/organisation/${org.id}/user/${user.id}`)
      .expect(201);

    // 3. List users in organisation
    const listUsersRes = await request(app.getHttpServer())
      .get(`/organisation/${org.id}/user`)
      .expect(200);
    expect(listUsersRes.body.data).toHaveLength(1);
    expect(listUsersRes.body.data[0]).toMatchObject({
      id: user.id,
      email: user.email,
    });

    // 4. Add team to organisation
    await request(app.getHttpServer())
      .post(`/organisation/${org.id}/team/${team.name}`)
      .expect(201);

    // 5. List teams in organisation
    const listTeamsRes = await request(app.getHttpServer())
      .get(`/organisation/${org.id}/team`)
      .expect(200);
    expect(listTeamsRes.body.data).toHaveLength(1);
    expect(listTeamsRes.body.data[0]).toMatchObject(team);

    // 6. Remove user from organisation
    await request(app.getHttpServer())
      .delete(`/organisation/${org.id}/user/${user.id}`)
      .expect(200);

    const listUsersResAfter = await request(app.getHttpServer())
      .get(`/organisation/${org.id}/user`)
      .expect(200);
    expect(listUsersResAfter.body.data).toHaveLength(0);

    // 7. Remove team from organisation
    await request(app.getHttpServer())
      .delete(`/organisation/${org.id}/team/${team.name}`)
      .expect(200);

    const listTeamsResAfter = await request(app.getHttpServer())
      .get(`/organisation/${org.id}/team`)
      .expect(200);
    expect(listTeamsResAfter.body.data).toHaveLength(0);

    // Cleanup
    await request(app.getHttpServer()).delete(`/organisation/${org.id}`);
    await request(app.getHttpServer()).delete(`/user/${user.id}`);
    await request(app.getHttpServer()).delete(`/team/${team.name}`);
  });

  it('should perform CRUD operations on /team', async () => {
    // 1. Create (POST)
    const createResponse = await request(app.getHttpServer())
      .post('/team')
      .send({ name: 'Test Team' })
      .expect(201);

    const team = createResponse.body;
    expect(team.name).toBe('Test Team');

    // 2. Find All (GET)
    const findAllResponse = await request(app.getHttpServer())
      .get('/team')
      .expect(200);

    expect(findAllResponse.body.data).toContainEqual(team);

    // 3. Find One (GET :id)
    const findOneResponse = await request(app.getHttpServer())
      .get(`/team/${team.name}`)
      .expect(200);

    expect(findOneResponse.body).toEqual(team);

    // 4. Update (PATCH :id)
    const updateResponse = await request(app.getHttpServer())
      .patch(`/team/${team.name}`)
      .send({ description: 'Updated Description' })
      .expect(200);

    expect(updateResponse.body.description).toBe('Updated Description');

    // 5. Remove (DELETE :id)
    await request(app.getHttpServer()).delete(`/team/${team.name}`).expect(200);

    // Verify deletion
    await request(app.getHttpServer()).get(`/team/${team.name}`).expect(404);
  });

  it('should add and remove users from a team on /team/:id/user/:userId', async () => {
    // 1. Create Team
    const teamResponse = await request(app.getHttpServer())
      .post('/team')
      .send({ name: 'E2E Test Team' })
      .expect(201);
    const team = teamResponse.body;

    // 2. Create User
    const userResponse = await request(app.getHttpServer())
      .post('/user')
      .send({ email: 'e2e-team-user@example.com' })
      .expect(201);
    const user = userResponse.body;

    // 3. Add user to team (POST)
    await request(app.getHttpServer())
      .post(`/team/${team.name}/user/${user.id}`)
      .expect(201);

    // 4. List users in team (GET)
    const listUsersResponse = await request(app.getHttpServer())
      .get(`/team/${team.name}/user`)
      .expect(200);

    expect(listUsersResponse.body.data).toHaveLength(1);
    expect(listUsersResponse.body.data[0]).toMatchObject({
      id: user.id,
      email: user.email,
    });

    // 5. Remove user from team (DELETE)
    await request(app.getHttpServer())
      .delete(`/team/${team.name}/user/${user.id}`)
      .expect(200);

    // Cleanup
    await request(app.getHttpServer()).delete(`/team/${team.name}`).expect(200);
    await request(app.getHttpServer()).delete(`/user/${user.id}`).expect(200);
  });

  it('should perform CRUD operations on /user', async () => {
    // 1. Create (POST)
    const createResponse = await request(app.getHttpServer())
      .post('/user')
      .send({ email: 'test@example.com' })
      .expect(201);

    const user = createResponse.body;
    expect(user.id).toBeDefined();
    expect(user.email).toBe('test@example.com');

    // 2. Find All (GET)
    const findAllResponse = await request(app.getHttpServer())
      .get('/user')
      .expect(200);

    expect(findAllResponse.body.data).toContainEqual(user);

    // 3. Find One (GET :id)
    const findOneResponse = await request(app.getHttpServer())
      .get(`/user/${user.id}`)
      .expect(200);

    expect(findOneResponse.body).toEqual(user);

    // 4. Update (PATCH :id)
    const updateResponse = await request(app.getHttpServer())
      .patch(`/user/${user.id}`)
      .send({ email: 'updated@example.com' })
      .expect(200);

    expect(updateResponse.body.email).toBe('updated@example.com');

    // 5. Remove (DELETE :id)
    await request(app.getHttpServer()).delete(`/user/${user.id}`).expect(200);

    // Verify deletion
    await request(app.getHttpServer()).get(`/user/${user.id}`).expect(404);
  });

  it('should be able to add, delete, and add a user again', async () => {
    const email = 'readd_test@example.com';

    // 1. Create User
    const createRes1 = await request(app.getHttpServer())
      .post('/user')
      .send({ email })
      .expect(201);
    const userId1 = createRes1.body.id;

    // 2. Delete User
    await request(app.getHttpServer()).delete(`/user/${userId1}`).expect(200);

    // 3. Create User again
    const createRes2 = await request(app.getHttpServer())
      .post('/user')
      .send({ email })
      .expect(201);
    const userId2 = createRes2.body.id;

    expect(userId2).toBeDefined();

    // Cleanup
    await request(app.getHttpServer()).delete(`/user/${userId2}`).expect(200);
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

    expect(findAllResponse.body.data).toEqual(
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
    // 1. Request presigned URL
    const uploadUrlResponse = await request(app.getHttpServer())
      .post(`/asset/upload`)
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
      Records: [
        {
          s3: {
            bucket: { name: 'asset-uploads' },
            object: {
              key: `assets/${assetId}`,
              eTag: 'dummy',
            },
          },
        },
      ],
    };

    await assetUploadListener(mockS3Event, {} as any, () => {});

    // 4. Verify asset was created
    const getResponse = await request(app.getHttpServer())
      .get(`/asset/${assetId}`)
      .expect(200);

    expect(getResponse.body).toEqual({
      id: assetId,
      key: `assets/${assetId}`,
      metadata: expect.any(Object),
    });
  });

  it('should have ConfigService providing the correct USER_POOL_ID', () => {
    const configService = app.get<ConfigService>(ConfigService);
    expect(configService.get('USER_POOL_ID')).toBe(userPoolId);
  });
});
