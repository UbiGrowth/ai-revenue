import { Module } from '@nestjs/common';
import { JobsModule } from './jobs';

/**
 * Example AppModule for integrating the JobsModule
 * This is a reference implementation showing how to use the JobsModule
 * in a NestJS application.
 */
@Module({
  imports: [JobsModule],
})
export class AppModule {}
