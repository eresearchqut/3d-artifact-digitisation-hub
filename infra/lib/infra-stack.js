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
    }
}
exports.InfraStack = InfraStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5mcmEtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmZyYS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtQ0FBbUM7QUFXbkMsTUFBYSxVQUFXLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDdkMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QiwyQkFBMkI7UUFDM0IsNkRBQTZEO1FBQzdELHVFQUF1RTtRQUN2RSxrRUFBa0U7UUFDbEUsTUFBTTtRQUVOLHFCQUFxQjtRQUNyQix5REFBeUQ7UUFFekQsMEJBQTBCO1FBQzFCLG9FQUFvRTtRQUVwRSx1Q0FBdUM7UUFDdkMsc0ZBQXNGO0lBQ3hGLENBQUM7Q0FDRjtBQW5CRCxnQ0FtQkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuaW1wb3J0ICogYXMgY29nbml0byBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY29nbml0byc7XG5pbXBvcnQgKiBhcyBjbG91ZGZyb250IGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250JztcbmltcG9ydCAqIGFzIHJvdXRlNTMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXJvdXRlNTMnO1xuaW1wb3J0ICogYXMgYWNtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jZXJ0aWZpY2F0ZW1hbmFnZXInO1xuXG5leHBvcnQgY2xhc3MgSW5mcmFTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIFBsYWNlaG9sZGVyIGZvciBEeW5hbW9EQlxuICAgIC8vIGNvbnN0IHRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdTb3ZlcmVpZ25UYWJsZScsIHtcbiAgICAvLyAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAncGsnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgIC8vICAgc29ydEtleTogeyBuYW1lOiAnc2snLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgIC8vIH0pO1xuXG4gICAgLy8gUGxhY2Vob2xkZXIgZm9yIFMzXG4gICAgLy8gY29uc3QgYnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnU292ZXJlaWduQnVja2V0Jyk7XG5cbiAgICAvLyBQbGFjZWhvbGRlciBmb3IgQ29nbml0b1xuICAgIC8vIGNvbnN0IHVzZXJQb29sID0gbmV3IGNvZ25pdG8uVXNlclBvb2wodGhpcywgJ1NvdmVyZWlnblVzZXJQb29sJyk7XG5cbiAgICAvLyBQbGFjZWhvbGRlciBmb3IgTGFtYmRhICYgQVBJIEdhdGV3YXlcbiAgICAvLyBjb25zdCBtYW5hZ2VtZW50QXBpTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnTWFuYWdlbWVudEFwaUhhbmRsZXInLCAuLi4pO1xuICB9XG59XG4iXX0=