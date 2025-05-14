import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { WorkersProducer } from './workers.producer';
import { registerWorkerQueues } from './workers.register';
import { ConsumersModule } from 'src/consumers/consumers.module';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST') || 'localhost',
          port: parseInt(configService.get('REDIS_PORT') || '6379', 10),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(...registerWorkerQueues()),
    ConsumersModule,
  ],
  providers: [WorkersProducer],
  exports: [WorkersProducer],
})
export class WorkersModule {}
