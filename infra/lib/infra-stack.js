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
const cognito = require("aws-cdk-lib/aws-cognito");
const cloudfront = require("aws-cdk-lib/aws-cloudfront");
const origins = require("aws-cdk-lib/aws-cloudfront-origins");
const iam = require("aws-cdk-lib/aws-iam");
const events = require("aws-cdk-lib/aws-events");
const targets = require("aws-cdk-lib/aws-events-targets");
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
        // -------------------------------------------------------------------------
        // Cognito — mirrors: cognito user pool + client in init-local-aws.sh
        // Email delivery uses Cognito's default sender (no-reply@verificationemail.com).
        // This is limited to 50 emails/day. For higher volume or better deliverability,
        // switch to cognito.UserPoolEmail.withSES({ fromEmail, sesRegion }).
        // -------------------------------------------------------------------------
        const userPool = new cognito.UserPool(this, 'UserPool', {
            selfSignUpEnabled: false,
            signInAliases: { email: true },
            autoVerify: { email: true },
            // Explicitly route all account recovery through email (no phone fallback)
            accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
            // Customise subjects so emails are less likely to be flagged as spam
            userVerification: {
                emailSubject: '3D Digitisation Hub — verify your email address',
                emailBody: 'Hello,\n\nYour verification code is {####}\n\nIf you did not request this, you can ignore this email.',
                emailStyle: cognito.VerificationEmailStyle.CODE,
            },
            passwordPolicy: {
                minLength: 8,
                requireLowercase: true,
                requireUppercase: true,
                requireDigits: true,
                requireSymbols: false,
            },
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
        // S3 → Lambda notifications via EventBridge
        // S3 does not allow two notification rules with the same event type and
        // overlapping prefix filter. EventBridge solves this cleanly: one S3
        // notification fans out to both Lambdas via separate EventBridge rules.
        // -------------------------------------------------------------------------
        uploadBucket.enableEventBridgeNotification();
        const assetCreatedPattern = {
            source: ['aws.s3'],
            detailType: ['Object Created'],
            detail: {
                bucket: { name: [uploadBucket.bucketName] },
                object: { key: [{ prefix: 'assets/' }] },
            },
        };
        new events.Rule(this, 'UploadListenerRule', {
            ruleName: 'asset-upload-listener-rule',
            eventPattern: assetCreatedPattern,
            targets: [new targets.LambdaFunction(uploadListenerFn)],
        });
        new events.Rule(this, 'SplatTransformRule', {
            ruleName: 'asset-splat-transform-rule',
            eventPattern: assetCreatedPattern,
            targets: [new targets.LambdaFunction(splatTransformFn)],
        });
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
                // NestJS uses optionalRequire() for these peer/optional packages at
                // runtime — they are never actually needed in a standard REST API
                // deployment, so marking them external silences the bundle errors.
                externalModules: [
                    '@nestjs/websockets',
                    '@nestjs/websockets/socket-module',
                    '@nestjs/microservices',
                    '@nestjs/microservices/microservices-module',
                    'class-transformer',
                    'class-validator',
                ],
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
                // runtime-config.json is fetched by the SPA at startup to discover the
                // API Gateway URL without baking it into the Vite build at compile time.
                s3deploy.Source.jsonData('runtime-config.json', {
                    apiUrl: restApi.url.replace(/\/$/, ''), // strip trailing slash
                }),
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5mcmEtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmZyYS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSw2QkFBNkI7QUFDN0IsbUNBQW1DO0FBRW5DLGlEQUFpRDtBQUNqRCw4REFBOEQ7QUFDOUQseURBQXlEO0FBQ3pELHFEQUFxRDtBQUNyRCx5Q0FBeUM7QUFDekMsMERBQTBEO0FBQzFELG1EQUFtRDtBQUNuRCx5REFBeUQ7QUFDekQsOERBQThEO0FBQzlELDJDQUEyQztBQUMzQyxpREFBaUQ7QUFDakQsMERBQTBEO0FBRTFELE1BQWEsVUFBVyxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ3ZDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBc0I7UUFDOUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsNEVBQTRFO1FBQzVFLHFFQUFxRTtRQUNyRSw0RUFBNEU7UUFDNUUsTUFBTSxLQUFLLEdBQUcsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxZQUFZLEVBQUU7WUFDbkQsWUFBWSxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUU7WUFDakUsT0FBTyxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUU7WUFDNUQsV0FBVyxFQUFFLFFBQVEsQ0FBQyxXQUFXLENBQUMsZUFBZTtZQUNqRCxhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxPQUFPO1NBQ3pDLENBQUMsQ0FBQztRQUVILDRFQUE0RTtRQUM1RSwrRUFBK0U7UUFDL0UsNEVBQTRFO1FBQzVFLE1BQU0sWUFBWSxHQUFHLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFO1lBQ3ZELElBQUksRUFBRTtn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TyxDQUFDLEdBQUc7WUFDbEIsV0FBVyxFQUFFLDRCQUE0QjtTQUMxQyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRTtZQUNyQyxLQUFLLEVBQUUsV0FBVyxZQUFZLENBQUMsc0JBQXNCLEVBQUU7WUFDdkQsV0FBVyxFQUFFLHlCQUF5QjtTQUN2QyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRTtZQUNwQyxLQUFLLEVBQUUsUUFBUSxDQUFDLFVBQVU7WUFDMUIsV0FBVyxFQUFFLHNCQUFzQjtTQUNwQyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGtCQUFrQixFQUFFO1lBQzFDLEtBQUssRUFBRSxjQUFjLENBQUMsZ0JBQWdCO1lBQ3RDLFdBQVcsRUFBRSw2QkFBNkI7U0FDM0MsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxrQkFBa0IsRUFBRTtZQUMxQyxLQUFLLEVBQUUsWUFBWSxDQUFDLFVBQVU7WUFDOUIsV0FBVyxFQUFFLHVCQUF1QjtTQUNyQyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUE3UkQsZ0NBNlJDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGxhbWJkYU5vZGVqcyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhLW5vZGVqcyc7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuaW1wb3J0ICogYXMgczNkZXBsb3kgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzLWRlcGxveW1lbnQnO1xuaW1wb3J0ICogYXMgY29nbml0byBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY29nbml0byc7XG5pbXBvcnQgKiBhcyBjbG91ZGZyb250IGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250JztcbmltcG9ydCAqIGFzIG9yaWdpbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQtb3JpZ2lucyc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBldmVudHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cyc7XG5pbXBvcnQgKiBhcyB0YXJnZXRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMtdGFyZ2V0cyc7XG5cbmV4cG9ydCBjbGFzcyBJbmZyYVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBjZGsuU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vIER5bmFtb0RCIOKAlCBtaXJyb3JzOiBhd3MgZHluYW1vZGIgY3JlYXRlLXRhYmxlIGluIGluaXQtbG9jYWwtYXdzLnNoXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIGNvbnN0IHRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdBc3NldFRhYmxlJywge1xuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdQSycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdTSycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyBTMyB1cGxvYWQgYnVja2V0IOKAlCBtaXJyb3JzOiBhd3MgczMgbWIgKyBwdXQtYnVja2V0LWNvcnMgaW4gaW5pdC1sb2NhbC1hd3Muc2hcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgY29uc3QgdXBsb2FkQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnVXBsb2FkQnVja2V0Jywge1xuICAgICAgY29yczogW1xuICAgICAgICB7XG4gICAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBbXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5QVVQsXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5QT1NULFxuICAgICAgICAgICAgczMuSHR0cE1ldGhvZHMuR0VULFxuICAgICAgICAgICAgczMuSHR0cE1ldGhvZHMuSEVBRCxcbiAgICAgICAgICBdLFxuICAgICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcbiAgICAgICAgICBleHBvc2VkSGVhZGVyczogWydFVGFnJ10sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIGF1dG9EZWxldGVPYmplY3RzOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyBDb2duaXRvIOKAlCBtaXJyb3JzOiBjb2duaXRvIHVzZXIgcG9vbCArIGNsaWVudCBpbiBpbml0LWxvY2FsLWF3cy5zaFxuICAgIC8vIEVtYWlsIGRlbGl2ZXJ5IHVzZXMgQ29nbml0bydzIGRlZmF1bHQgc2VuZGVyIChuby1yZXBseUB2ZXJpZmljYXRpb25lbWFpbC5jb20pLlxuICAgIC8vIFRoaXMgaXMgbGltaXRlZCB0byA1MCBlbWFpbHMvZGF5LiBGb3IgaGlnaGVyIHZvbHVtZSBvciBiZXR0ZXIgZGVsaXZlcmFiaWxpdHksXG4gICAgLy8gc3dpdGNoIHRvIGNvZ25pdG8uVXNlclBvb2xFbWFpbC53aXRoU0VTKHsgZnJvbUVtYWlsLCBzZXNSZWdpb24gfSkuXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIGNvbnN0IHVzZXJQb29sID0gbmV3IGNvZ25pdG8uVXNlclBvb2wodGhpcywgJ1VzZXJQb29sJywge1xuICAgICAgc2VsZlNpZ25VcEVuYWJsZWQ6IGZhbHNlLFxuICAgICAgc2lnbkluQWxpYXNlczogeyBlbWFpbDogdHJ1ZSB9LFxuICAgICAgYXV0b1ZlcmlmeTogeyBlbWFpbDogdHJ1ZSB9LFxuICAgICAgLy8gRXhwbGljaXRseSByb3V0ZSBhbGwgYWNjb3VudCByZWNvdmVyeSB0aHJvdWdoIGVtYWlsIChubyBwaG9uZSBmYWxsYmFjaylcbiAgICAgIGFjY291bnRSZWNvdmVyeTogY29nbml0by5BY2NvdW50UmVjb3ZlcnkuRU1BSUxfT05MWSxcbiAgICAgIC8vIEN1c3RvbWlzZSBzdWJqZWN0cyBzbyBlbWFpbHMgYXJlIGxlc3MgbGlrZWx5IHRvIGJlIGZsYWdnZWQgYXMgc3BhbVxuICAgICAgdXNlclZlcmlmaWNhdGlvbjoge1xuICAgICAgICBlbWFpbFN1YmplY3Q6ICczRCBEaWdpdGlzYXRpb24gSHViIOKAlCB2ZXJpZnkgeW91ciBlbWFpbCBhZGRyZXNzJyxcbiAgICAgICAgZW1haWxCb2R5OiAnSGVsbG8sXFxuXFxuWW91ciB2ZXJpZmljYXRpb24gY29kZSBpcyB7IyMjI31cXG5cXG5JZiB5b3UgZGlkIG5vdCByZXF1ZXN0IHRoaXMsIHlvdSBjYW4gaWdub3JlIHRoaXMgZW1haWwuJyxcbiAgICAgICAgZW1haWxTdHlsZTogY29nbml0by5WZXJpZmljYXRpb25FbWFpbFN0eWxlLkNPREUsXG4gICAgICB9LFxuICAgICAgcGFzc3dvcmRQb2xpY3k6IHtcbiAgICAgICAgbWluTGVuZ3RoOiA4LFxuICAgICAgICByZXF1aXJlTG93ZXJjYXNlOiB0cnVlLFxuICAgICAgICByZXF1aXJlVXBwZXJjYXNlOiB0cnVlLFxuICAgICAgICByZXF1aXJlRGlnaXRzOiB0cnVlLFxuICAgICAgICByZXF1aXJlU3ltYm9sczogZmFsc2UsXG4gICAgICB9LFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHVzZXJQb29sQ2xpZW50ID0gdXNlclBvb2wuYWRkQ2xpZW50KCdXZWJDbGllbnQnLCB7XG4gICAgICBhdXRoRmxvd3M6IHtcbiAgICAgICAgdXNlclBhc3N3b3JkOiB0cnVlLFxuICAgICAgICB1c2VyU3JwOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIG9BdXRoOiB7XG4gICAgICAgIGZsb3dzOiB7IGF1dGhvcml6YXRpb25Db2RlR3JhbnQ6IHRydWUsIGltcGxpY2l0Q29kZUdyYW50OiB0cnVlIH0sXG4gICAgICAgIHNjb3BlczogW1xuICAgICAgICAgIGNvZ25pdG8uT0F1dGhTY29wZS5PUEVOSUQsXG4gICAgICAgICAgY29nbml0by5PQXV0aFNjb3BlLkVNQUlMLFxuICAgICAgICAgIGNvZ25pdG8uT0F1dGhTY29wZS5QUk9GSUxFLFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIFNoYXJlZCBMYW1iZGEgZXhlY3V0aW9uIHJvbGUg4oCUIG1pcnJvcnM6IGlhbSBjcmVhdGUtcm9sZSBpbiBpbml0LWxvY2FsLWF3cy5zaFxuICAgIGNvbnN0IGxhbWJkYVJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0xhbWJkYUV4ZWN1dGlvblJvbGUnLCB7XG4gICAgICByb2xlTmFtZTogJ2xhbWJkYS1leGVjdXRpb24tcm9sZScsXG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnbGFtYmRhLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoXG4gICAgICAgICAgJ3NlcnZpY2Utcm9sZS9BV1NMYW1iZGFCYXNpY0V4ZWN1dGlvblJvbGUnLFxuICAgICAgICApLFxuICAgICAgXSxcbiAgICB9KTtcbiAgICB1cGxvYWRCdWNrZXQuZ3JhbnRSZWFkV3JpdGUobGFtYmRhUm9sZSk7XG4gICAgdGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGxhbWJkYVJvbGUpO1xuXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vIGFzc2V0LXVwbG9hZC1saXN0ZW5lciBMYW1iZGEg4oCUIG1pcnJvcnM6IGNyZWF0ZS1mdW5jdGlvbiBhc3NldC11cGxvYWQtbGlzdGVuZXJcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgY29uc3QgdXBsb2FkTGlzdGVuZXJGbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0Fzc2V0VXBsb2FkTGlzdGVuZXInLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjRfWCxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChcbiAgICAgICAgcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL3BhY2thZ2VzL2Fzc2V0LXVwbG9hZC1saXN0ZW5lci9sYW1iZGEuemlwJyksXG4gICAgICApLFxuICAgICAgcm9sZTogbGFtYmRhUm9sZSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIERZTkFNT0RCX1RBQkxFOiB0YWJsZS50YWJsZU5hbWUsXG4gICAgICAgIEFXU19SRUdJT05fT1ZFUlJJREU6IHRoaXMucmVnaW9uLFxuICAgICAgfSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICB9KTtcblxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyBhc3NldC1zcGxhdC10cmFuc2Zvcm0gTGFtYmRhIOKAlCBtaXJyb3JzOiBjcmVhdGUtZnVuY3Rpb24gYXNzZXQtc3BsYXQtdHJhbnNmb3JtXG4gICAgLy8gdGltZW91dDogOTAwcywgbWVtb3J5U2l6ZTogMzAwOE1CIChDUFUtaW50ZW5zaXZlIHNwbGF0IHByb2Nlc3NpbmcpXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIGNvbnN0IHNwbGF0VHJhbnNmb3JtRm4gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdBc3NldFNwbGF0VHJhbnNmb3JtJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzI0X1gsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoXG4gICAgICAgIHBhdGguam9pbihcbiAgICAgICAgICBfX2Rpcm5hbWUsXG4gICAgICAgICAgJy4uLy4uL3BhY2thZ2VzL2Fzc2V0LXNwbGF0LXRyYW5zZm9ybS9sYW1iZGEuemlwJyxcbiAgICAgICAgKSxcbiAgICAgICksXG4gICAgICByb2xlOiBsYW1iZGFSb2xlLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgQVdTX1JFR0lPTl9PVkVSUklERTogdGhpcy5yZWdpb24sXG4gICAgICB9LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoOTAwKSxcbiAgICAgIG1lbW9yeVNpemU6IDMwMDgsXG4gICAgfSk7XG5cbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy8gUzMg4oaSIExhbWJkYSBub3RpZmljYXRpb25zIHZpYSBFdmVudEJyaWRnZVxuICAgIC8vIFMzIGRvZXMgbm90IGFsbG93IHR3byBub3RpZmljYXRpb24gcnVsZXMgd2l0aCB0aGUgc2FtZSBldmVudCB0eXBlIGFuZFxuICAgIC8vIG92ZXJsYXBwaW5nIHByZWZpeCBmaWx0ZXIuIEV2ZW50QnJpZGdlIHNvbHZlcyB0aGlzIGNsZWFubHk6IG9uZSBTM1xuICAgIC8vIG5vdGlmaWNhdGlvbiBmYW5zIG91dCB0byBib3RoIExhbWJkYXMgdmlhIHNlcGFyYXRlIEV2ZW50QnJpZGdlIHJ1bGVzLlxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICB1cGxvYWRCdWNrZXQuZW5hYmxlRXZlbnRCcmlkZ2VOb3RpZmljYXRpb24oKTtcblxuICAgIGNvbnN0IGFzc2V0Q3JlYXRlZFBhdHRlcm46IGV2ZW50cy5FdmVudFBhdHRlcm4gPSB7XG4gICAgICBzb3VyY2U6IFsnYXdzLnMzJ10sXG4gICAgICBkZXRhaWxUeXBlOiBbJ09iamVjdCBDcmVhdGVkJ10sXG4gICAgICBkZXRhaWw6IHtcbiAgICAgICAgYnVja2V0OiB7IG5hbWU6IFt1cGxvYWRCdWNrZXQuYnVja2V0TmFtZV0gfSxcbiAgICAgICAgb2JqZWN0OiB7IGtleTogW3sgcHJlZml4OiAnYXNzZXRzLycgfV0gfSxcbiAgICAgIH0sXG4gICAgfTtcblxuICAgIG5ldyBldmVudHMuUnVsZSh0aGlzLCAnVXBsb2FkTGlzdGVuZXJSdWxlJywge1xuICAgICAgcnVsZU5hbWU6ICdhc3NldC11cGxvYWQtbGlzdGVuZXItcnVsZScsXG4gICAgICBldmVudFBhdHRlcm46IGFzc2V0Q3JlYXRlZFBhdHRlcm4sXG4gICAgICB0YXJnZXRzOiBbbmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24odXBsb2FkTGlzdGVuZXJGbildLFxuICAgIH0pO1xuXG4gICAgbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdTcGxhdFRyYW5zZm9ybVJ1bGUnLCB7XG4gICAgICBydWxlTmFtZTogJ2Fzc2V0LXNwbGF0LXRyYW5zZm9ybS1ydWxlJyxcbiAgICAgIGV2ZW50UGF0dGVybjogYXNzZXRDcmVhdGVkUGF0dGVybixcbiAgICAgIHRhcmdldHM6IFtuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbihzcGxhdFRyYW5zZm9ybUZuKV0sXG4gICAgfSk7XG5cbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy8gTWFuYWdlbWVudCBBUEkg4oCUIE5lc3RKUyBkZXBsb3llZCBhcyBMYW1iZGEgKyBBUEkgR2F0ZXdheSBSRVNUIEFQSVxuICAgIC8vIFNlZTogaHR0cHM6Ly9kb2NzLm5lc3Rqcy5jb20vZmFxL3NlcnZlcmxlc3NcbiAgICAvLyBFbnRyeSBwb2ludDogYXBpL3NyYy9sYW1iZGEudHMgKHVzZXMgQHZlbmRpYS9zZXJ2ZXJsZXNzLWV4cHJlc3MpXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIGNvbnN0IGFwaUxhbWJkYSA9IG5ldyBsYW1iZGFOb2RlanMuTm9kZWpzRnVuY3Rpb24oXG4gICAgICB0aGlzLFxuICAgICAgJ01hbmFnZW1lbnRBcGlIYW5kbGVyJyxcbiAgICAgIHtcbiAgICAgICAgZnVuY3Rpb25OYW1lOiAnbWFuYWdlbWVudC1hcGknLFxuICAgICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjRfWCxcbiAgICAgICAgZW50cnk6IHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9hcGkvc3JjL2xhbWJkYS50cycpLFxuICAgICAgICBoYW5kbGVyOiAnaGFuZGxlcicsXG4gICAgICAgIGJ1bmRsaW5nOiB7XG4gICAgICAgICAgbWluaWZ5OiB0cnVlLFxuICAgICAgICAgIC8vIE5lc3RKUyB1c2VzIG9wdGlvbmFsUmVxdWlyZSgpIGZvciB0aGVzZSBwZWVyL29wdGlvbmFsIHBhY2thZ2VzIGF0XG4gICAgICAgICAgLy8gcnVudGltZSDigJQgdGhleSBhcmUgbmV2ZXIgYWN0dWFsbHkgbmVlZGVkIGluIGEgc3RhbmRhcmQgUkVTVCBBUElcbiAgICAgICAgICAvLyBkZXBsb3ltZW50LCBzbyBtYXJraW5nIHRoZW0gZXh0ZXJuYWwgc2lsZW5jZXMgdGhlIGJ1bmRsZSBlcnJvcnMuXG4gICAgICAgICAgZXh0ZXJuYWxNb2R1bGVzOiBbXG4gICAgICAgICAgICAnQG5lc3Rqcy93ZWJzb2NrZXRzJyxcbiAgICAgICAgICAgICdAbmVzdGpzL3dlYnNvY2tldHMvc29ja2V0LW1vZHVsZScsXG4gICAgICAgICAgICAnQG5lc3Rqcy9taWNyb3NlcnZpY2VzJyxcbiAgICAgICAgICAgICdAbmVzdGpzL21pY3Jvc2VydmljZXMvbWljcm9zZXJ2aWNlcy1tb2R1bGUnLFxuICAgICAgICAgICAgJ2NsYXNzLXRyYW5zZm9ybWVyJyxcbiAgICAgICAgICAgICdjbGFzcy12YWxpZGF0b3InLFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICAgIHJvbGU6IGxhbWJkYVJvbGUsXG4gICAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgICAgRFlOQU1PREJfVEFCTEVfTkFNRTogdGFibGUudGFibGVOYW1lLFxuICAgICAgICAgIFMzX1VQTE9BRF9CVUNLRVQ6IHVwbG9hZEJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICAgIFVTRVJfUE9PTF9JRDogdXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgICAgICBVU0VSX1BPT0xfQ0xJRU5UX0lEOiB1c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkLFxuICAgICAgICB9LFxuICAgICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICAgIH0sXG4gICAgKTtcblxuICAgIGNvbnN0IHJlc3RBcGkgPSBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFSZXN0QXBpKHRoaXMsICdNYW5hZ2VtZW50UmVzdEFwaScsIHtcbiAgICAgIHJlc3RBcGlOYW1lOiAnbWFuYWdlbWVudC1hcGknLFxuICAgICAgaGFuZGxlcjogYXBpTGFtYmRhLFxuICAgICAgcHJveHk6IHRydWUsXG4gICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBhcGlnYXRld2F5LkNvcnMuQUxMX09SSUdJTlMsXG4gICAgICAgIGFsbG93TWV0aG9kczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9NRVRIT0RTLFxuICAgICAgICBhbGxvd0hlYWRlcnM6IFsnQ29udGVudC1UeXBlJywgJ0F1dGhvcml6YXRpb24nXSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy8gRnJvbnRlbmQgU1BBIOKAlCBTMyBidWNrZXQgKyBDbG91ZEZyb250IGRpc3RyaWJ1dGlvblxuICAgIC8vIFVzZXMgT0FDIChPcmlnaW4gQWNjZXNzIENvbnRyb2wpIHZpYSBTM0J1Y2tldE9yaWdpbi53aXRoT3JpZ2luQWNjZXNzQ29udHJvbCgpLFxuICAgIC8vIHdoaWNoIHN1cGVyc2VkZXMgdGhlIGxlZ2FjeSBPQUkgcGF0dGVybi5cbiAgICAvLyBpbmRleC5odG1sIHNlcnZlZCBmb3IgYWxsIDQwMy80MDQgcmVzcG9uc2VzIHRvIHN1cHBvcnQgY2xpZW50LXNpZGUgcm91dGluZ1xuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICBjb25zdCBmcm9udGVuZEJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ0Zyb250ZW5kQnVja2V0Jywge1xuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBhdXRvRGVsZXRlT2JqZWN0czogdHJ1ZSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGRpc3RyaWJ1dGlvbiA9IG5ldyBjbG91ZGZyb250LkRpc3RyaWJ1dGlvbihcbiAgICAgIHRoaXMsXG4gICAgICAnRnJvbnRlbmREaXN0cmlidXRpb24nLFxuICAgICAge1xuICAgICAgICBkZWZhdWx0QmVoYXZpb3I6IHtcbiAgICAgICAgICBvcmlnaW46IG9yaWdpbnMuUzNCdWNrZXRPcmlnaW4ud2l0aE9yaWdpbkFjY2Vzc0NvbnRyb2woZnJvbnRlbmRCdWNrZXQpLFxuICAgICAgICB9LFxuICAgICAgICBlcnJvclJlc3BvbnNlczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGh0dHBTdGF0dXM6IDQwMyxcbiAgICAgICAgICAgIHJlc3BvbnNlSHR0cFN0YXR1czogMjAwLFxuICAgICAgICAgICAgcmVzcG9uc2VQYWdlUGF0aDogJy9pbmRleC5odG1sJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIGh0dHBTdGF0dXM6IDQwNCxcbiAgICAgICAgICAgIHJlc3BvbnNlSHR0cFN0YXR1czogMjAwLFxuICAgICAgICAgICAgcmVzcG9uc2VQYWdlUGF0aDogJy9pbmRleC5odG1sJyxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICApO1xuXG4gICAgbmV3IHMzZGVwbG95LkJ1Y2tldERlcGxveW1lbnQodGhpcywgJ0Zyb250ZW5kRGVwbG95bWVudCcsIHtcbiAgICAgIHNvdXJjZXM6IFtcbiAgICAgICAgczNkZXBsb3kuU291cmNlLmFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9mcm9udGVuZC9kaXN0JykpLFxuICAgICAgICAvLyBydW50aW1lLWNvbmZpZy5qc29uIGlzIGZldGNoZWQgYnkgdGhlIFNQQSBhdCBzdGFydHVwIHRvIGRpc2NvdmVyIHRoZVxuICAgICAgICAvLyBBUEkgR2F0ZXdheSBVUkwgd2l0aG91dCBiYWtpbmcgaXQgaW50byB0aGUgVml0ZSBidWlsZCBhdCBjb21waWxlIHRpbWUuXG4gICAgICAgIHMzZGVwbG95LlNvdXJjZS5qc29uRGF0YSgncnVudGltZS1jb25maWcuanNvbicsIHtcbiAgICAgICAgICBhcGlVcmw6IHJlc3RBcGkudXJsLnJlcGxhY2UoL1xcLyQvLCAnJyksIC8vIHN0cmlwIHRyYWlsaW5nIHNsYXNoXG4gICAgICAgIH0pLFxuICAgICAgXSxcbiAgICAgIGRlc3RpbmF0aW9uQnVja2V0OiBmcm9udGVuZEJ1Y2tldCxcbiAgICAgIGRpc3RyaWJ1dGlvbixcbiAgICAgIGRpc3RyaWJ1dGlvblBhdGhzOiBbJy8qJ10sXG4gICAgfSk7XG5cbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy8gT3V0cHV0c1xuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXBpVXJsJywge1xuICAgICAgdmFsdWU6IHJlc3RBcGkudXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdNYW5hZ2VtZW50IEFQSSBHYXRld2F5IFVSTCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRnJvbnRlbmRVcmwnLCB7XG4gICAgICB2YWx1ZTogYGh0dHBzOi8vJHtkaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uRG9tYWluTmFtZX1gLFxuICAgICAgZGVzY3JpcHRpb246ICdGcm9udGVuZCBDbG91ZEZyb250IFVSTCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclBvb2xJZCcsIHtcbiAgICAgIHZhbHVlOiB1c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgZGVzY3JpcHRpb246ICdDb2duaXRvIFVzZXIgUG9vbCBJRCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclBvb2xDbGllbnRJZCcsIHtcbiAgICAgIHZhbHVlOiB1c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkLFxuICAgICAgZGVzY3JpcHRpb246ICdDb2duaXRvIFVzZXIgUG9vbCBDbGllbnQgSUQnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1VwbG9hZEJ1Y2tldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogdXBsb2FkQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1MzIHVwbG9hZCBidWNrZXQgbmFtZScsXG4gICAgfSk7XG4gIH1cbn1cblxuIl19