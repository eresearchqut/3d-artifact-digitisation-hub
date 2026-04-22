#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { OidcStack } from '../lib/oidc-stack';

const app = new cdk.App();

// If a GitHub OIDC provider already exists in the target account, pass its ARN
// via context to import it rather than creating a new one:
//
//   cdk --app 'npx ts-node bin/oidc.ts' deploy \
//     --context existingOidcProviderArn=arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com
//
// Omit the context value to have the stack create a fresh provider.
const existingOidcProviderArn = app.node.tryGetContext('existingOidcProviderArn') as string | undefined;

new OidcStack(app, 'DigitisationHubOidcStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  description: '3D Artifact Digitisation Hub — GitHub Actions OIDC provider and deploy role',
  deployRoleName: '3d-digitisation-hub-deploy-role',
  existingOidcProviderArn,
  repositoryConfig: [
    {
      owner: 'eresearchqut',
      repo: '3d-artifact-digitisation-hub',
      // '*' permits any branch, tag, or environment from this repo.
      // Tighten this (e.g. 'ref:refs/heads/main') once deploys are working.
      filter: '*',
    },
  ],
});
