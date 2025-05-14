import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { VideosModule } from './modules/videos/videos.module';
import { ConfigModule } from '@nestjs/config';
import { WorkersModule } from './workers/workers.module';
import { EnvModule } from './modules/env/env.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    WorkersModule,
    VideosModule,
    EnvModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
