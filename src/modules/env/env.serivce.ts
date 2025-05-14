import { Injectable } from '@nestjs/common';
import { TAWSConfig } from './env.types';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EnvService {
  constructor(private readonly configService: ConfigService) {}

  getAWSConfig(): TAWSConfig {
    return {
      accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') || '',
      secretAccessKey:
        this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '',
      region: this.configService.get<string>('AWS_REGION') || '',
      bucketName: this.configService.get<string>('AWS_BUCKET_NAME') || '',
    };
  }
}
