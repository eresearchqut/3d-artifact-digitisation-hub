import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { configure as serverlessExpress } from '@codegenie/serverless-express';
import { Context } from 'aws-lambda';
import * as express from 'express';
import { Logger } from '@aws-lambda-powertools/logger';
import { AppModule } from './app.module';

const logger = new Logger({ serviceName: 'management-api' });

let serverlessExpressInstance: any;

async function initApp() {
  const expressApp = express();
  const nestApp = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
  );
  nestApp.enableCors();
  return nestApp.init().then(() => expressApp);
}

async function setup(event: any, context: Context) {
  const app = await initApp();
  serverlessExpressInstance = serverlessExpress({
    app,
    binarySettings: {
      // Only base64-encode explicitly binary content types.
      // An empty content-type (e.g. OPTIONS preflight) must return false or
      // API Gateway will try to decode the empty body and break CORS.
      isBinary: ({ headers }: { headers: Record<string, string> }) => {
        const ct = (headers['content-type'] || '')
          .toLowerCase()
          .split(';')[0]
          .trim();
        if (!ct) return false;
        return (
          ct === 'application/octet-stream' ||
          ct.startsWith('image/') ||
          ct.startsWith('font/')
        );
      },
    },
  });
  return serverlessExpressInstance(event, context);
}

export const handler = async (event: any, context: Context) => {
  logger.addContext(context);
  if (serverlessExpressInstance)
    return serverlessExpressInstance(event, context);
  return setup(event, context);
};
