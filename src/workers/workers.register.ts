import { EWorkerQueues } from './workers.constants';

export const registerWorkerQueues = () => {
  return Object.values(EWorkerQueues).map((queue) => ({
    name: queue,
  }));
};
