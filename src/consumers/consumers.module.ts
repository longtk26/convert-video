import { Module } from '@nestjs/common';
import { VideosModule } from 'src/modules/videos/videos.module';
import { ConvertVideoConsumer } from './convert-video.consumers';

@Module({
  imports: [VideosModule],
  providers: [ConvertVideoConsumer],
})
export class ConsumersModule {}
