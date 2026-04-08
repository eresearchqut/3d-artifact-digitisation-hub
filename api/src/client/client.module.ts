import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { S3Client, S3ClientConfig } from '@aws-sdk/client-s3';
import { DynamoDBClient, DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
import {
  CognitoIdentityProviderClient,
  CognitoIdentityProviderClientConfig,
} from '@aws-sdk/client-cognito-identity-provider';

/**
 * Build explicit credentials only when a custom endpoint is set (local dev via
 * LocalStack). In Lambda the runtime injects temporary STS credentials
 * (AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY + AWS_SESSION_TOKEN) and the SDK
 * resolves them automatically from the environment — passing only the first two
 * without the session token produces "invalid security token" errors.
 */
function localCredentials(
  endpoint: string | undefined,
  accessKeyId: string | undefined,
  secretAccessKey: string | undefined,
) {
  return endpoint && accessKeyId && secretAccessKey
    ? { accessKeyId, secretAccessKey }
    : undefined;
}

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: S3Client,
      useFactory: (configService: ConfigService) => {
        const endpoint = configService.get<string>('S3_ENDPOINT');
        const region = configService.get<string>('AWS_REGION');
        const config: S3ClientConfig = {
          region,
          endpoint,
          forcePathStyle: !!endpoint,
          credentials: localCredentials(
            endpoint,
            configService.get('AWS_ACCESS_KEY_ID'),
            configService.get('AWS_SECRET_ACCESS_KEY'),
          ),
        };
        return new S3Client(config);
      },
      inject: [ConfigService],
    },
    {
      provide: DynamoDBClient,
      useFactory: (configService: ConfigService) => {
        const endpoint = configService.get<string>('DYNAMODB_ENDPOINT');
        const region = configService.get<string>('AWS_REGION');
        const config: DynamoDBClientConfig = {
          region,
          endpoint,
          credentials: localCredentials(
            endpoint,
            configService.get('AWS_ACCESS_KEY_ID'),
            configService.get('AWS_SECRET_ACCESS_KEY'),
          ),
        };
        return new DynamoDBClient(config);
      },
      inject: [ConfigService],
    },
    {
      provide: CognitoIdentityProviderClient,
      useFactory: (configService: ConfigService) => {
        const endpoint = configService.get<string>('COGNITO_ENDPOINT');
        const region = configService.get<string>('AWS_REGION');
        const config: CognitoIdentityProviderClientConfig = {
          region,
          endpoint,
          credentials: localCredentials(
            endpoint,
            configService.get('AWS_ACCESS_KEY_ID'),
            configService.get('AWS_SECRET_ACCESS_KEY'),
          ),
        };
        return new CognitoIdentityProviderClient(config);
      },
      inject: [ConfigService],
    },
  ],
  exports: [S3Client, DynamoDBClient, CognitoIdentityProviderClient],
})
export class ClientModule {}
