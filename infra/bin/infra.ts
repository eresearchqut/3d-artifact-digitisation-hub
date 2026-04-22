#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { InfraStack } from '../lib/infra-stack';

const app = new cdk.App();

// Tags are read from CDK context and applied to every taggable resource in the
// stack (Lambda, S3, DynamoDB, Cognito, CloudFront, etc.), making them available
// for cost allocation reports and resource discovery.
//
// Define tags in cdk.json under context.tags:
//   "tags": { "CostCentre": "12345", "Project": "DigitisationHub" }
//
// Or supply them at deploy time (overrides cdk.json values):
//   cdk deploy --context tags='{"CostCentre":"12345","Project":"DigitisationHub"}'
const tags = (app.node.tryGetContext('tags') ?? {}) as Record<string, string>;

new InfraStack(app, 'DigitisationHubStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  description: '3D Artifact Digitisation Hub — API, storage, processing and frontend infrastructure',
  // Applies tags to the CloudFormation stack resource itself.
  tags,
});

// Applies tags to every individual AWS resource inside the stack.
Object.entries(tags).forEach(([key, value]) => cdk.Tags.of(app).add(key, value));
