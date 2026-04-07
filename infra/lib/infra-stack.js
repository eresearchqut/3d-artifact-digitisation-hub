"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InfraStack = void 0;
const path = require("path");
const cdk = require("aws-cdk-lib");
const lambda = require("aws-cdk-lib/aws-lambda");
const lambdaNodejs = require("aws-cdk-lib/aws-lambda-nodejs");
const apigateway = require("aws-cdk-lib/aws-apigateway");
const dynamodb = require("aws-cdk-lib/aws-dynamodb");
const s3 = require("aws-cdk-lib/aws-s3");
const s3deploy = require("aws-cdk-lib/aws-s3-deployment");
const s3n = require("aws-cdk-lib/aws-s3-notifications");
const cognito = require("aws-cdk-lib/aws-cognito");
const cloudfront = require("aws-cdk-lib/aws-cloudfront");
const origins = require("aws-cdk-lib/aws-cloudfront-origins");
const iam = require("aws-cdk-lib/aws-iam");
class InfraStack extends cdk.Stack {
    constructor(scope, id, props) {
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
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
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
            code: lambda.Code.fromAsset(path.join(__dirname, '../../packages/asset-upload-listener/lambda.zip')),
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
            code: lambda.Code.fromAsset(path.join(__dirname, '../../packages/asset-splat-transform/lambda.zip')),
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
        uploadBucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.LambdaDestination(uploadListenerFn), { prefix: 'assets/' });
        uploadBucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.LambdaDestination(splatTransformFn), { prefix: 'assets/' });
        // -------------------------------------------------------------------------
        // Management API — NestJS deployed as Lambda + API Gateway REST API
        // See: https://docs.nestjs.com/faq/serverless
        // Entry point: api/src/lambda.ts (uses @vendia/serverless-express)
        // -------------------------------------------------------------------------
        const apiLambda = new lambdaNodejs.NodejsFunction(this, 'ManagementApiHandler', {
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
        });
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
        const distribution = new cloudfront.Distribution(this, 'FrontendDistribution', {
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
        });
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
exports.InfraStack = InfraStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5mcmEtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmZyYS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSw2QkFBNkI7QUFDN0IsbUNBQW1DO0FBRW5DLGlEQUFpRDtBQUNqRCw4REFBOEQ7QUFDOUQseURBQXlEO0FBQ3pELHFEQUFxRDtBQUNyRCx5Q0FBeUM7QUFDekMsMERBQTBEO0FBQzFELHdEQUF3RDtBQUN4RCxtREFBbUQ7QUFDbkQseURBQXlEO0FBQ3pELDhEQUE4RDtBQUM5RCwyQ0FBMkM7QUFFM0MsTUFBYSxVQUFXLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDdkMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4Qiw0RUFBNEU7UUFDNUUscUVBQXFFO1FBQ3JFLDRFQUE0RTtRQUM1RSxNQUFNLEtBQUssR0FBRyxJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRTtZQUNuRCxZQUFZLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRTtZQUNqRSxPQUFPLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRTtZQUM1RCxXQUFXLEVBQUUsUUFBUSxDQUFDLFdBQVcsQ0FBQyxlQUFlO1lBQ2pELGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87U0FDekMsQ0FBQyxDQUFDO1FBRUgsNEVBQTRFO1FBQzVFLCtFQUErRTtRQUMvRSw0RUFBNEU7UUFDNUUsTUFBTSxZQUFZLEdBQUcsSUFBSSxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxjQUFjLEVBQUU7WUFDdkQsSUFBSSxFQUFFO2dCQUNKO29CQUNFLGNB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RSx5QkFBeUI7U0FDdkMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxZQUFZLEVBQUU7WUFDcEMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxVQUFVO1lBQzFCLFdBQVcsRUFBRSxzQkFBc0I7U0FDcEMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxrQkFBa0IsRUFBRTtZQUMxQyxLQUFLLEVBQUUsY0FBYyxDQUFDLGdCQUFnQjtZQUN0QyxXQUFXLEVBQUUsNkJBQTZCO1NBQzNDLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsa0JBQWtCLEVBQUU7WUFDMUMsS0FBSyxFQUFFLFlBQVksQ0FBQyxVQUFVO1lBQzlCLFdBQVcsRUFBRSx1QkFBdUI7U0FDckMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBOU9ELGdDQThPQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBsYW1iZGFOb2RlanMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYS1ub2RlanMnO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheSc7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCAqIGFzIHMzZGVwbG95IGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMy1kZXBsb3ltZW50JztcbmltcG9ydCAqIGFzIHMzbiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMtbm90aWZpY2F0aW9ucyc7XG5pbXBvcnQgKiBhcyBjb2duaXRvIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jb2duaXRvJztcbmltcG9ydCAqIGFzIGNsb3VkZnJvbnQgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQnO1xuaW1wb3J0ICogYXMgb3JpZ2lucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udC1vcmlnaW5zJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcblxuZXhwb3J0IGNsYXNzIEluZnJhU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IGNkay5TdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy8gRHluYW1vREIg4oCUIG1pcnJvcnM6IGF3cyBkeW5hbW9kYiBjcmVhdGUtdGFibGUgaW4gaW5pdC1sb2NhbC1hd3Muc2hcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgY29uc3QgdGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ0Fzc2V0VGFibGUnLCB7XG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ1BLJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ1NLJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vIFMzIHVwbG9hZCBidWNrZXQg4oCUIG1pcnJvcnM6IGF3cyBzMyBtYiArIHB1dC1idWNrZXQtY29ycyBpbiBpbml0LWxvY2FsLWF3cy5zaFxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICBjb25zdCB1cGxvYWRCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdVcGxvYWRCdWNrZXQnLCB7XG4gICAgICBjb3JzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXG4gICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IFtcbiAgICAgICAgICAgIHMzLkh0dHBNZXRob2RzLlBVVCxcbiAgICAgICAgICAgIHMzLkh0dHBNZXRob2RzLlBPU1QsXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5HRVQsXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5IRUFELFxuICAgICAgICAgIF0sXG4gICAgICAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLFxuICAgICAgICAgIGV4cG9zZWRIZWFkZXJzOiBbJ0VUYWcnXSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IHRydWUsXG4gICAgfSk7XG5cbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy8gQ29nbml0byDigJQgbWlycm9yczogY29nbml0byB1c2VyIHBvb2wgKyBjbGllbnQgaW4gaW5pdC1sb2NhbC1hd3Muc2hcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgY29uc3QgdXNlclBvb2wgPSBuZXcgY29nbml0by5Vc2VyUG9vbCh0aGlzLCAnVXNlclBvb2wnLCB7XG4gICAgICBzZWxmU2lnblVwRW5hYmxlZDogZmFsc2UsXG4gICAgICBzaWduSW5BbGlhc2VzOiB7IGVtYWlsOiB0cnVlIH0sXG4gICAgICBhdXRvVmVyaWZ5OiB7IGVtYWlsOiB0cnVlIH0sXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgY29uc3QgdXNlclBvb2xDbGllbnQgPSB1c2VyUG9vbC5hZGRDbGllbnQoJ1dlYkNsaWVudCcsIHtcbiAgICAgIGF1dGhGbG93czoge1xuICAgICAgICB1c2VyUGFzc3dvcmQ6IHRydWUsXG4gICAgICAgIHVzZXJTcnA6IHRydWUsXG4gICAgICB9LFxuICAgICAgb0F1dGg6IHtcbiAgICAgICAgZmxvd3M6IHsgYXV0aG9yaXphdGlvbkNvZGVHcmFudDogdHJ1ZSwgaW1wbGljaXRDb2RlR3JhbnQ6IHRydWUgfSxcbiAgICAgICAgc2NvcGVzOiBbXG4gICAgICAgICAgY29nbml0by5PQXV0aFNjb3BlLk9QRU5JRCxcbiAgICAgICAgICBjb2duaXRvLk9BdXRoU2NvcGUuRU1BSUwsXG4gICAgICAgICAgY29nbml0by5PQXV0aFNjb3BlLlBST0ZJTEUsXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gU2hhcmVkIExhbWJkYSBleGVjdXRpb24gcm9sZSDigJQgbWlycm9yczogaWFtIGNyZWF0ZS1yb2xlIGluIGluaXQtbG9jYWwtYXdzLnNoXG4gICAgY29uc3QgbGFtYmRhUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnTGFtYmRhRXhlY3V0aW9uUm9sZScsIHtcbiAgICAgIHJvbGVOYW1lOiAnbGFtYmRhLWV4ZWN1dGlvbi1yb2xlJyxcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdsYW1iZGEuYW1hem9uYXdzLmNvbScpLFxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZShcbiAgICAgICAgICAnc2VydmljZS1yb2xlL0FXU0xhbWJkYUJhc2ljRXhlY3V0aW9uUm9sZScsXG4gICAgICAgICksXG4gICAgICBdLFxuICAgIH0pO1xuICAgIHVwbG9hZEJ1Y2tldC5ncmFudFJlYWRXcml0ZShsYW1iZGFSb2xlKTtcbiAgICB0YWJsZS5ncmFudFJlYWRXcml0ZURhdGEobGFtYmRhUm9sZSk7XG5cbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy8gYXNzZXQtdXBsb2FkLWxpc3RlbmVyIExhbWJkYSDigJQgbWlycm9yczogY3JlYXRlLWZ1bmN0aW9uIGFzc2V0LXVwbG9hZC1saXN0ZW5lclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICBjb25zdCB1cGxvYWRMaXN0ZW5lckZuID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQXNzZXRVcGxvYWRMaXN0ZW5lcicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yNF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KFxuICAgICAgICBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vLi4vcGFja2FnZXMvYXNzZXQtdXBsb2FkLWxpc3RlbmVyL2xhbWJkYS56aXAnKSxcbiAgICAgICksXG4gICAgICByb2xlOiBsYW1iZGFSb2xlLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgRFlOQU1PREJfVEFCTEU6IHRhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgQVdTX1JFR0lPTl9PVkVSUklERTogdGhpcy5yZWdpb24sXG4gICAgICB9LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgIH0pO1xuXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vIGFzc2V0LXNwbGF0LXRyYW5zZm9ybSBMYW1iZGEg4oCUIG1pcnJvcnM6IGNyZWF0ZS1mdW5jdGlvbiBhc3NldC1zcGxhdC10cmFuc2Zvcm1cbiAgICAvLyB0aW1lb3V0OiA5MDBzLCBtZW1vcnlTaXplOiAzMDA4TUIgKENQVS1pbnRlbnNpdmUgc3BsYXQgcHJvY2Vzc2luZylcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgY29uc3Qgc3BsYXRUcmFuc2Zvcm1GbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0Fzc2V0U3BsYXRUcmFuc2Zvcm0nLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjRfWCxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChcbiAgICAgICAgcGF0aC5qb2luKFxuICAgICAgICAgIF9fZGlybmFtZSxcbiAgICAgICAgICAnLi4vLi4vcGFja2FnZXMvYXNzZXQtc3BsYXQtdHJhbnNmb3JtL2xhbWJkYS56aXAnLFxuICAgICAgICApLFxuICAgICAgKSxcbiAgICAgIHJvbGU6IGxhbWJkYVJvbGUsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBBV1NfUkVHSU9OX09WRVJSSURFOiB0aGlzLnJlZ2lvbixcbiAgICAgIH0sXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyg5MDApLFxuICAgICAgbWVtb3J5U2l6ZTogMzAwOCxcbiAgICB9KTtcblxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyBTMyDihpIgTGFtYmRhIG5vdGlmaWNhdGlvbnMg4oCUIG1pcnJvcnM6IHB1dC1idWNrZXQtbm90aWZpY2F0aW9uLWNvbmZpZ3VyYXRpb25cbiAgICAvLyBCb3RoIGxhbWJkYXMgdHJpZ2dlciBvbiBzMzpPYmplY3RDcmVhdGVkOiogdW5kZXIgdGhlIGFzc2V0cy8gcHJlZml4XG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIHVwbG9hZEJ1Y2tldC5hZGRFdmVudE5vdGlmaWNhdGlvbihcbiAgICAgIHMzLkV2ZW50VHlwZS5PQkpFQ1RfQ1JFQVRFRCxcbiAgICAgIG5ldyBzM24uTGFtYmRhRGVzdGluYXRpb24odXBsb2FkTGlzdGVuZXJGbiksXG4gICAgICB7IHByZWZpeDogJ2Fzc2V0cy8nIH0sXG4gICAgKTtcblxuICAgIHVwbG9hZEJ1Y2tldC5hZGRFdmVudE5vdGlmaWNhdGlvbihcbiAgICAgIHMzLkV2ZW50VHlwZS5PQkpFQ1RfQ1JFQVRFRCxcbiAgICAgIG5ldyBzM24uTGFtYmRhRGVzdGluYXRpb24oc3BsYXRUcmFuc2Zvcm1GbiksXG4gICAgICB7IHByZWZpeDogJ2Fzc2V0cy8nIH0sXG4gICAgKTtcblxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyBNYW5hZ2VtZW50IEFQSSDigJQgTmVzdEpTIGRlcGxveWVkIGFzIExhbWJkYSArIEFQSSBHYXRld2F5IFJFU1QgQVBJXG4gICAgLy8gU2VlOiBodHRwczovL2RvY3MubmVzdGpzLmNvbS9mYXEvc2VydmVybGVzc1xuICAgIC8vIEVudHJ5IHBvaW50OiBhcGkvc3JjL2xhbWJkYS50cyAodXNlcyBAdmVuZGlhL3NlcnZlcmxlc3MtZXhwcmVzcylcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgY29uc3QgYXBpTGFtYmRhID0gbmV3IGxhbWJkYU5vZGVqcy5Ob2RlanNGdW5jdGlvbihcbiAgICAgIHRoaXMsXG4gICAgICAnTWFuYWdlbWVudEFwaUhhbmRsZXInLFxuICAgICAge1xuICAgICAgICBmdW5jdGlvbk5hbWU6ICdtYW5hZ2VtZW50LWFwaScsXG4gICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yNF9YLFxuICAgICAgICBlbnRyeTogcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL2FwaS9zcmMvbGFtYmRhLnRzJyksXG4gICAgICAgIGhhbmRsZXI6ICdoYW5kbGVyJyxcbiAgICAgICAgYnVuZGxpbmc6IHtcbiAgICAgICAgICBtaW5pZnk6IHRydWUsXG4gICAgICAgICAgZXh0ZXJuYWxNb2R1bGVzOiBbXSxcbiAgICAgICAgfSxcbiAgICAgICAgcm9sZTogbGFtYmRhUm9sZSxcbiAgICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgICBEWU5BTU9EQl9UQUJMRV9OQU1FOiB0YWJsZS50YWJsZU5hbWUsXG4gICAgICAgICAgUzNfVVBMT0FEX0JVQ0tFVDogdXBsb2FkQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgICAgVVNFUl9QT09MX0lEOiB1c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgICAgIFVTRVJfUE9PTF9DTElFTlRfSUQ6IHVzZXJQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQsXG4gICAgICAgIH0sXG4gICAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgICAgbWVtb3J5U2l6ZTogNTEyLFxuICAgICAgfSxcbiAgICApO1xuXG4gICAgY29uc3QgcmVzdEFwaSA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYVJlc3RBcGkodGhpcywgJ01hbmFnZW1lbnRSZXN0QXBpJywge1xuICAgICAgcmVzdEFwaU5hbWU6ICdtYW5hZ2VtZW50LWFwaScsXG4gICAgICBoYW5kbGVyOiBhcGlMYW1iZGEsXG4gICAgICBwcm94eTogdHJ1ZSxcbiAgICAgIGRlZmF1bHRDb3JzUHJlZmxpZ2h0T3B0aW9uczoge1xuICAgICAgICBhbGxvd09yaWdpbnM6IGFwaWdhdGV3YXkuQ29ycy5BTExfT1JJR0lOUyxcbiAgICAgICAgYWxsb3dNZXRob2RzOiBhcGlnYXRld2F5LkNvcnMuQUxMX01FVEhPRFMsXG4gICAgICAgIGFsbG93SGVhZGVyczogWydDb250ZW50LVR5cGUnLCAnQXV0aG9yaXphdGlvbiddLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyBGcm9udGVuZCBTUEEg4oCUIFMzIGJ1Y2tldCArIENsb3VkRnJvbnQgZGlzdHJpYnV0aW9uXG4gICAgLy8gVXNlcyBPQUMgKE9yaWdpbiBBY2Nlc3MgQ29udHJvbCkgdmlhIFMzQnVja2V0T3JpZ2luLndpdGhPcmlnaW5BY2Nlc3NDb250cm9sKCksXG4gICAgLy8gd2hpY2ggc3VwZXJzZWRlcyB0aGUgbGVnYWN5IE9BSSBwYXR0ZXJuLlxuICAgIC8vIGluZGV4Lmh0bWwgc2VydmVkIGZvciBhbGwgNDAzLzQwNCByZXNwb25zZXMgdG8gc3VwcG9ydCBjbGllbnQtc2lkZSByb3V0aW5nXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIGNvbnN0IGZyb250ZW5kQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnRnJvbnRlbmRCdWNrZXQnLCB7XG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIGF1dG9EZWxldGVPYmplY3RzOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgY29uc3QgZGlzdHJpYnV0aW9uID0gbmV3IGNsb3VkZnJvbnQuRGlzdHJpYnV0aW9uKFxuICAgICAgdGhpcyxcbiAgICAgICdGcm9udGVuZERpc3RyaWJ1dGlvbicsXG4gICAgICB7XG4gICAgICAgIGRlZmF1bHRCZWhhdmlvcjoge1xuICAgICAgICAgIG9yaWdpbjogb3JpZ2lucy5TM0J1Y2tldE9yaWdpbi53aXRoT3JpZ2luQWNjZXNzQ29udHJvbChmcm9udGVuZEJ1Y2tldCksXG4gICAgICAgIH0sXG4gICAgICAgIGVycm9yUmVzcG9uc2VzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgaHR0cFN0YXR1czogNDAzLFxuICAgICAgICAgICAgcmVzcG9uc2VIdHRwU3RhdHVzOiAyMDAsXG4gICAgICAgICAgICByZXNwb25zZVBhZ2VQYXRoOiAnL2luZGV4Lmh0bWwnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgaHR0cFN0YXR1czogNDA0LFxuICAgICAgICAgICAgcmVzcG9uc2VIdHRwU3RhdHVzOiAyMDAsXG4gICAgICAgICAgICByZXNwb25zZVBhZ2VQYXRoOiAnL2luZGV4Lmh0bWwnLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgICk7XG5cbiAgICBuZXcgczNkZXBsb3kuQnVja2V0RGVwbG95bWVudCh0aGlzLCAnRnJvbnRlbmREZXBsb3ltZW50Jywge1xuICAgICAgc291cmNlczogW1xuICAgICAgICBzM2RlcGxveS5Tb3VyY2UuYXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL2Zyb250ZW5kL2Rpc3QnKSksXG4gICAgICBdLFxuICAgICAgZGVzdGluYXRpb25CdWNrZXQ6IGZyb250ZW5kQnVja2V0LFxuICAgICAgZGlzdHJpYnV0aW9uLFxuICAgICAgZGlzdHJpYnV0aW9uUGF0aHM6IFsnLyonXSxcbiAgICB9KTtcblxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyBPdXRwdXRzXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBcGlVcmwnLCB7XG4gICAgICB2YWx1ZTogcmVzdEFwaS51cmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ01hbmFnZW1lbnQgQVBJIEdhdGV3YXkgVVJMJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdGcm9udGVuZFVybCcsIHtcbiAgICAgIHZhbHVlOiBgaHR0cHM6Ly8ke2Rpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25Eb21haW5OYW1lfWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ0Zyb250ZW5kIENsb3VkRnJvbnQgVVJMJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVc2VyUG9vbElkJywge1xuICAgICAgdmFsdWU6IHVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvZ25pdG8gVXNlciBQb29sIElEJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVc2VyUG9vbENsaWVudElkJywge1xuICAgICAgdmFsdWU6IHVzZXJQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvZ25pdG8gVXNlciBQb29sIENsaWVudCBJRCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXBsb2FkQnVja2V0TmFtZScsIHtcbiAgICAgIHZhbHVlOiB1cGxvYWRCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUzMgdXBsb2FkIGJ1Y2tldCBuYW1lJyxcbiAgICB9KTtcbiAgfVxufVxuXG4iXX0=