import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Example NestJS bootstrap file
 * This demonstrates how to run the JobsModule in a standalone NestJS application.
 * 
 * To use this:
 * 1. Ensure all dependencies are installed (npm install)
 * 2. Run: tsx src/nest-main.ts
 * 
 * The SSE endpoint will be available at: http://localhost:3002/jobs/:id/logs
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS for frontend access
  app.enableCors();
  
  // Use a different port from the Express API
  const port = process.env.NEST_PORT || 3002;
  await app.listen(port);
  
  console.log(`NestJS application is running on: http://localhost:${port}`);
  console.log(`SSE endpoint available at: http://localhost:${port}/jobs/:id/logs`);
}

bootstrap().catch(err => {
  console.error('Failed to start NestJS application:', err);
  process.exit(1);
});
