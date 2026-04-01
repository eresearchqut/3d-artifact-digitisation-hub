import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { S3Client, S3ClientConfig } from '@aws-sdk/client-s3';
import { DynamoDBClient, DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
import {
  CognitoIdentityProviderClient,
  CognitoIdentityProviderClientConfig,
} from '@aws-sdk/client-cognito-identity-provider';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: S3Client,
      useFactory: (configService: ConfigService) => {
        const endpoint = configService.get<string>('S3_ENDPOINT');
        const accessKeyId = configService.get<string>('AWS_ACCESS_KEY_ID');
        const secretAccessKey = configService.get<string>(
          'AWS_SECRET_ACCESS_KEY',
        );
        const region = configService.get<string>('AWS_REGION');

        const config: S3ClientConfig = {
          region,
          endpoint,
          forcePathStyle: !!endpoint,
          credentials:
            accessKeyId && secretAccessKey
              ? { accessKeyId, secretAccessKey }
              : undefined,
        };

        return new S3Client(config);
      },
      inject: [ConfigService],
    },
    {
      provide: DynamoDBClient,
      useFactory: (configService: ConfigService) => {
        const accessKeyId = configService.get<string>('AWS_ACCESS_KEY_ID');
        const secretAccessKey = configService.get<string>(
          'AWS_SECRET_ACCESS_KEY',
        );
        const region = configService.get<string>('AWS_REGION');
        const endpoint = configService.get<string>('DYNAMODB_ENDPOINT');

        const config: DynamoDBClientConfig = {
          region,
          endpoint,
          credentials:
            accessKeyId && secretAccessKey
              ? { accessKeyId, secretAccessKey }
              : undefined,
        };

        return new DynamoDBClient(config);
      },
      inject: [ConfigService],
    },
    {
      provide: CognitoIdentityProviderClient,
      useFactory: (configService: ConfigService) => {
        const accessKeyId = configService.get<string>('AWS_ACCESS_KEY_ID');
        const secretAccessKey = configService.get<string>(
          'AWS_SECRET_ACCESS_KEY',
        );
        const region = configService.get<string>('AWS_REGION');
        const endpoint = configService.get<string>('COGNITO_ENDPOINT');

        const config: CognitoIdentityProviderClientConfig = {
          region,
          endpoint,
          credentials:
            accessKeyId && secretAccessKey
              ? { accessKeyId, secretAccessKey }
              : undefined,
        };

        return new CognitoIdentityProviderClient(config);
      },
      inject: [ConfigService],
    },
  ],
  exports: [S3Client, DynamoDBClient, CognitoIdentityProviderClient],
})
export class ClientModule {}
