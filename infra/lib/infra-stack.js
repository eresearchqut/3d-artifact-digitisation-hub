"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InfraStack = void 0;
const cdk = require("aws-cdk-lib");
class InfraStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Placeholder for DynamoDB
        // const table = new dynamodb.Table(this, 'SovereignTable', {
        //   partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
        //   sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
        // });
        // Placeholder for S3
        // const bucket = new s3.Bucket(this, 'SovereignBucket');
        // Placeholder for Cognito
        // const userPool = new cognito.UserPool(this, 'SovereignUserPool');
        // Placeholder for Lambda & API Gateway
        // const managementApiLambda = new lambda.Function(this, 'ManagementApiHandler', ...);
        // asset-splat-transform requires a long timeout (up to 15 min) and high memory
        // (Lambda CPU allocation scales with memory) for CPU-intensive splat processing.
        // const splatTransformLambda = new lambda.Function(this, 'AssetSplatTransform', {
        //   runtime: lambda.Runtime.NODEJS_20_X,
        //   timeout: cdk.Duration.minutes(15),
        //   memorySize: 3008,
        //   ...
        // });
    }
}
exports.InfraStack = InfraStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5mcmEtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmZyYS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtQ0FBbUM7QUFXbkMsTUFBYSxVQUFXLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDdkMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QiwyQkFBMkI7UUFDM0IsNkRBQTZEO1FBQzdELHVFQUF1RTtRQUN2RSxrRUFBa0U7UUFDbEUsTUFBTTtRQUVOLHFCQUFxQjtRQUNyQix5REFBeUQ7UUFFekQsMEJBQTBCO1FBQzFCLG9FQUFvRTtRQUVwRSx1Q0FBdUM7UUFDdkMsc0ZBQXNGO1FBRXRGLCtFQUErRTtRQUMvRSxpRkFBaUY7UUFDakYsa0ZBQWtGO1FBQ2xGLHlDQUF5QztRQUN6Qyx1Q0FBdUM7UUFDdkMsc0JBQXNCO1FBQ3RCLFFBQVE7UUFDUixNQUFNO0lBQ1IsQ0FBQztDQUNGO0FBNUJELGdDQTRCQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXknO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XG5pbXBvcnQgKiBhcyBjb2duaXRvIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jb2duaXRvJztcbmltcG9ydCAqIGFzIGNsb3VkZnJvbnQgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQnO1xuaW1wb3J0ICogYXMgcm91dGU1MyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtcm91dGU1Myc7XG5pbXBvcnQgKiBhcyBhY20gZnJvbSAnYXdzLWNkay1saWIvYXdzLWNlcnRpZmljYXRlbWFuYWdlcic7XG5cbmV4cG9ydCBjbGFzcyBJbmZyYVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBjZGsuU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8gUGxhY2Vob2xkZXIgZm9yIER5bmFtb0RCXG4gICAgLy8gY29uc3QgdGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1NvdmVyZWlnblRhYmxlJywge1xuICAgIC8vICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdwaycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgLy8gICBzb3J0S2V5OiB7IG5hbWU6ICdzaycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgLy8gfSk7XG5cbiAgICAvLyBQbGFjZWhvbGRlciBmb3IgUzNcbiAgICAvLyBjb25zdCBidWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdTb3ZlcmVpZ25CdWNrZXQnKTtcblxuICAgIC8vIFBsYWNlaG9sZGVyIGZvciBDb2duaXRvXG4gICAgLy8gY29uc3QgdXNlclBvb2wgPSBuZXcgY29nbml0by5Vc2VyUG9vbCh0aGlzLCAnU292ZXJlaWduVXNlclBvb2wnKTtcblxuICAgIC8vIFBsYWNlaG9sZGVyIGZvciBMYW1iZGEgJiBBUEkgR2F0ZXdheVxuICAgIC8vIGNvbnN0IG1hbmFnZW1lbnRBcGlMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdNYW5hZ2VtZW50QXBpSGFuZGxlcicsIC4uLik7XG5cbiAgICAvLyBhc3NldC1zcGxhdC10cmFuc2Zvcm0gcmVxdWlyZXMgYSBsb25nIHRpbWVvdXQgKHVwIHRvIDE1IG1pbikgYW5kIGhpZ2ggbWVtb3J5XG4gICAgLy8gKExhbWJkYSBDUFUgYWxsb2NhdGlvbiBzY2FsZXMgd2l0aCBtZW1vcnkpIGZvciBDUFUtaW50ZW5zaXZlIHNwbGF0IHByb2Nlc3NpbmcuXG4gICAgLy8gY29uc3Qgc3BsYXRUcmFuc2Zvcm1MYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdBc3NldFNwbGF0VHJhbnNmb3JtJywge1xuICAgIC8vICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXG4gICAgLy8gICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcygxNSksXG4gICAgLy8gICBtZW1vcnlTaXplOiAzMDA4LFxuICAgIC8vICAgLi4uXG4gICAgLy8gfSk7XG4gIH1cbn1cbiJdfQ==