import { WorkerHost, Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { EWorkerQueues } from '../workers/workers.constants';
import { Logger } from '@nestjs/common';
import { VideosService } from 'src/modules/videos/videos.service';

@Processor(EWorkerQueues.VIDEO_CONVERT)
export class ConvertVideoConsumer extends WorkerHost {
  private readonly logger = new Logger(ConvertVideoConsumer.name);
  constructor(private readonly videoConvertService: VideosService) {
    super();
  }

  async process(job: Job): Promise<any> {
    this.logger.log(`===Convert video consumer===`);
    this.logger.log(`Job ${JSON.stringify(job.data)}`);
    this.videoConvertService.processVideo(job.data);
    return job.data;
  }

  async processVideo() {}

  async convertToHLS() {}
}
