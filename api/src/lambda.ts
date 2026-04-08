import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { configure as serverlessExpress } from '@codegenie/serverless-express';
import { Context } from 'aws-lambda';
import * as express from 'express';
import { AppModule } from './app.module';

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
  serverlessExpressInstance = serverlessExpress({ app });
  return serverlessExpressInstance(event, context);
}

export const handler = async (event: any, context: Context) => {
  if (serverlessExpressInstance)
    return serverlessExpressInstance(event, context);
  return setup(event, context);
};
