import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // -------------------------------------------------------------------------
    // DynamoDB — mirrors: aws dynamodb create-table in init-local-aws.sh
    // -------------------------------------------------------------------------
    const table = new dynamodb.Table(this, 'AssetTable', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // -------------------------------------------------------------------------
    // S3 upload bucket — mirrors: aws s3 mb + put-bucket-cors in init-local-aws.sh
    // -------------------------------------------------------------------------
    const uploadBucket = new s3.Bucket(this, 'UploadBucket', {
      cors: [
        {
          allowedHeaders: ['*'],
          allowedMethods: [
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.GET,
            s3.HttpMethods.HEAD,
          ],
          allowedOrigins: ['*'],
          exposedHeaders: ['ETag'],
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // -------------------------------------------------------------------------
    // Cognito — mirrors: cognito user pool + client in init-local-aws.sh
    // -------------------------------------------------------------------------
    const userPool = new cognito.UserPool(this, 'UserPool', {
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const userPoolClient = userPool.addClient('WebClient', {
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      oAuth: {
        flows: { authorizationCodeGrant: true, implicitCodeGrant: true },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
      },
    });

    // Shared Lambda execution role — mirrors: iam create-role in init-local-aws.sh
    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      roleName: 'lambda-execution-role',
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
    });
    uploadBucket.grantReadWrite(lambdaRole);
    table.grantReadWriteData(lambdaRole);

    // -------------------------------------------------------------------------
    // asset-upload-listener Lambda — mirrors: create-function asset-upload-listener
    // -------------------------------------------------------------------------
    const uploadListenerFn = new lambda.Function(this, 'AssetUploadListener', {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(
        path.join(__dirname, '../../packages/asset-upload-listener/lambda.zip'),
      ),
      role: lambdaRole,
      environment: {
        DYNAMODB_TABLE: table.tableName,
        AWS_REGION_OVERRIDE: this.region,
      },
      timeout: cdk.Duration.seconds(30),
    });

    // -------------------------------------------------------------------------
    // asset-splat-transform Lambda — mirrors: create-function asset-splat-transform
    // timeout: 900s, memorySize: 3008MB (CPU-intensive splat processing)
    // -------------------------------------------------------------------------
    const splatTransformFn = new lambda.Function(this, 'AssetSplatTransform', {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(
        path.join(
          __dirname,
          '../../packages/asset-splat-transform/lambda.zip',
        ),
      ),
      role: lambdaRole,
      environment: {
        AWS_REGION_OVERRIDE: this.region,
      },
      timeout: cdk.Duration.seconds(900),
      memorySize: 3008,
    });

    // -------------------------------------------------------------------------
    // S3 → Lambda notifications — mirrors: put-bucket-notification-configuration
    // Both lambdas trigger on s3:ObjectCreated:* under the assets/ prefix
    // -------------------------------------------------------------------------
    uploadBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(uploadListenerFn),
      { prefix: 'assets/' },
    );

    uploadBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(splatTransformFn),
      { prefix: 'assets/' },
    );

    // -------------------------------------------------------------------------
    // Management API — NestJS deployed as Lambda + API Gateway REST API
    // See: https://docs.nestjs.com/faq/serverless
    // Entry point: api/src/lambda.ts (uses @vendia/serverless-express)
    // -------------------------------------------------------------------------
    const apiLambda = new lambdaNodejs.NodejsFunction(
      this,
      'ManagementApiHandler',
      {
        functionName: 'management-api',
        runtime: lambda.Runtime.NODEJS_24_X,
        entry: path.join(__dirname, '../../api/src/lambda.ts'),
        handler: 'handler',
        bundling: {
          minify: true,
          externalModules: [],
        },
        role: lambdaRole,
        environment: {
          DYNAMODB_TABLE_NAME: table.tableName,
          S3_UPLOAD_BUCKET: uploadBucket.bucketName,
          USER_POOL_ID: userPool.userPoolId,
          USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
        },
        timeout: cdk.Duration.seconds(30),
        memorySize: 512,
      },
    );

    const restApi = new apigateway.LambdaRestApi(this, 'ManagementRestApi', {
      restApiName: 'management-api',
      handler: apiLambda,
      proxy: true,
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // -------------------------------------------------------------------------
    // Frontend SPA — S3 bucket + CloudFront distribution
    // Uses OAC (Origin Access Control) via S3BucketOrigin.withOriginAccessControl(),
    // which supersedes the legacy OAI pattern.
    // index.html served for all 403/404 responses to support client-side routing
    // -------------------------------------------------------------------------
    const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const distribution = new cloudfront.Distribution(
      this,
      'FrontendDistribution',
      {
        defaultBehavior: {
          origin: origins.S3BucketOrigin.withOriginAccessControl(frontendBucket),
        },
        errorResponses: [
          {
            httpStatus: 403,
            responseHttpStatus: 200,
            responsePagePath: '/index.html',
          },
          {
            httpStatus: 404,
            responseHttpStatus: 200,
            responsePagePath: '/index.html',
          },
        ],
      },
    );

    new s3deploy.BucketDeployment(this, 'FrontendDeployment', {
      sources: [
        s3deploy.Source.asset(path.join(__dirname, '../../frontend/dist')),
      ],
      destinationBucket: frontendBucket,
      distribution,
      distributionPaths: ['/*'],
    });

    // -------------------------------------------------------------------------
    // Outputs
    // -------------------------------------------------------------------------
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: restApi.url,
      description: 'Management API Gateway URL',
    });

    new cdk.CfnOutput(this, 'FrontendUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'Frontend CloudFront URL',
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    });

    new cdk.CfnOutput(this, 'UploadBucketName', {
      value: uploadBucket.bucketName,
      description: 'S3 upload bucket name',
    });
  }
}

