import { Module } from '@nestjs/common';
import { S3_PROVIDER } from './tokens.storage';
import { S3Provider } from './s3/s3.provider';

@Module({
  providers: [
    {
      provide: S3_PROVIDER,
      useClass: S3Provider,
    },
  ],
  exports: [S3_PROVIDER],
})
export class StorageModule {}
