import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { JobsOptions, Queue } from 'bullmq';
import { EWorkerQueues } from './workers.constants';
import { TProduceJobQueue } from './workers.type';

@Injectable()
export class WorkersProducer {
  private listQueues: Record<string, Queue>;
  constructor(
    @InjectQueue(EWorkerQueues.VIDEO_CONVERT)
    private convertVideoQueueService: Queue,
  ) {
    this.registerQueuesService();
  }

  async produceJob<T>(
    queue: TProduceJobQueue,
    data: T,
    options?: JobsOptions,
  ): Promise<string | undefined> {
    try {
      // Get queue service
      const queueService: Queue = this.listQueues[queue];

      // Add job to queue
      const job = await queueService.add(queue, data, options);

      return job.id;
    } catch (error) {
      console.error(error);
      return error;
    }
  }

  private registerQueuesService() {
    this.listQueues = {
      [EWorkerQueues.VIDEO_CONVERT]: this.convertVideoQueueService,
    };
  }
}
