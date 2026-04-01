import { Test, TestingModule } from '@nestjs/testing';
import { ConfigController } from './config.controller';
import { ConfigService } from '@nestjs/config';

describe('ConfigController', () => {
  let controller: ConfigController;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConfigController],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'USER_POOL_ID') return 'test-pool-id';
              if (key === 'USER_POOL_CLIENT_ID') return 'test-client-id';
              if (key === 'COGNITO_ENDPOINT') return 'http://localhost:9229';
              return null;
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<ConfigController>(ConfigController);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return amplify configuration', () => {
    const result = controller.getAmplifyConfig();
    expect(result).toEqual({
      Auth: {
        Cognito: {
          userPoolId: 'test-pool-id',
          userPoolClientId: 'test-client-id',
          userPoolEndpoint: 'http://localhost:9229',
        },
        authenticationFlowType: 'USER_PASSWORD_AUTH',
      },
    });
    expect(configService.get).toHaveBeenCalledWith('USER_POOL_ID');
    expect(configService.get).toHaveBeenCalledWith('USER_POOL_CLIENT_ID');
    expect(configService.get).toHaveBeenCalledWith('COGNITO_ENDPOINT');
  });
});
