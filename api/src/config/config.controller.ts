import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
@ApiTags('config')
@Controller('config')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get('amplify')
  getAmplifyConfig() {
    return {
      Auth: {
        authenticationFlowType: this.configService.get<string>(
          'COGNITO_ENDPOINT',
        )
          ? 'USER_PASSWORD_AUTH'
          : undefined,
        Cognito: {
          userPoolId: this.configService.get<string>('USER_POOL_ID'),
          userPoolClientId: this.configService.get<string>(
            'USER_POOL_CLIENT_ID',
          ),
          userPoolEndpoint: this.configService.get<string>('COGNITO_ENDPOINT'),
        },
      },
    };
  }
}
