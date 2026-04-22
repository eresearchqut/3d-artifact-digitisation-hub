import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface OidcStackProps extends cdk.StackProps {
  /**
   * Name of the IAM role that GitHub Actions will assume.
   */
  readonly deployRoleName: string;

  /**
   * ARN of an existing GitHub OIDC provider in this account.
   * If omitted, a new provider is created.
   *
   * Only one OIDC provider per URL is permitted per AWS account, so supply
   * this when `token.actions.githubusercontent.com` is already registered:
   *   `arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com`
   */
  readonly existingOidcProviderArn?: string;

  /**
   * GitHub repositories permitted to assume the deploy role.
   *
   * The optional `filter` is appended to `repo:<owner>/<repo>:` in the trust
   * condition. Useful examples:
   *   - `ref:refs/heads/main`        — main branch only
   *   - `environment:production`     — GitHub environment named "production"
   *   - `*`                          — any branch / tag (default)
   *
   * @see https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/about-security-hardening-with-openid-connect#configuring-the-oidc-trust-with-the-cloud
   */
  readonly repositoryConfig: { owner: string; repo: string; filter?: string }[];
}

export class OidcStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: OidcStackProps) {
    super(scope, id, props);

    const githubDomain = 'token.actions.githubusercontent.com';

    const provider = props.existingOidcProviderArn
      ? iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
          this,
          'GithubOidcProvider',
          props.existingOidcProviderArn,
        )
      : new iam.OpenIdConnectProvider(this, 'GithubOidcProvider', {
          url: `https://${githubDomain}`,
          clientIds: ['sts.amazonaws.com'],
        });

    const subjects = props.repositoryConfig.map(
      ({ owner, repo, filter = '*' }) => `repo:${owner}/${repo}:${filter}`,
    );

    const deployRole = new iam.Role(this, 'GithubDeployRole', {
      roleName: props.deployRoleName,
      description: 'Assumed by GitHub Actions via OIDC to deploy the 3D Artifact Digitisation Hub CDK stack',
      assumedBy: new iam.WebIdentityPrincipal(provider.openIdConnectProviderArn, {
        StringLike: {
          [`${githubDomain}:sub`]: subjects,
        },
        StringEquals: {
          [`${githubDomain}:aud`]: 'sts.amazonaws.com',
        },
      }),
      // AdministratorAccess is required for CDK to create and manage all resource types.
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'),
      ],
      maxSessionDuration: cdk.Duration.hours(1),
    });

    new cdk.CfnOutput(this, 'DeployRoleArn', {
      value: deployRole.roleArn,
      description: 'Set this as the DEPLOY_ROLE_ARN secret in your GitHub repository',
    });
  }
}
