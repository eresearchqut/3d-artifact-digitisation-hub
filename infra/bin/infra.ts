#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { InfraStack } from '../lib/infra-stack';

const app = new cdk.App();

// Tags are injected via the CDK_TAGS environment variable as a JSON string,
// avoiding shell-quoting issues with --context.
// Define them as a GitHub Actions variable (vars.CDK_TAGS):
//   {"CostCentre":"12345","Project":"DigitisationHub"}
//
// For manual deploys:
//   CDK_TAGS='{"CostCentre":"12345"}' cdk deploy
const tags: Record<string, string> = process.env.CDK_TAGS
  ? JSON.parse(process.env.CDK_TAGS)
  : {};

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
