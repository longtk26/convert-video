import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { IStorageProvider, StorageOptions } from '../storage.interface';
import { EnvService } from 'src/modules/env/env.serivce';
import { TAWSConfig } from 'src/modules/env/env.types';

@Injectable()
export class S3Provider implements IStorageProvider {
  private readonly logger = new Logger(S3Provider.name);
  private bucketName: string;
  private s3Client: S3Client;
  private awsConfig: TAWSConfig;

  constructor(protected readonly envService: EnvService) {
    this.awsConfig = this.envService.getAWSConfig();
    this.bucketName = this.awsConfig.bucketName;
    this.initS3Client();
  }

  initS3Client() {
    try {
      this.s3Client = new S3Client({
        region: this.awsConfig.region,
        credentials: {
          accessKeyId: this.awsConfig.accessKeyId,
          secretAccessKey: this.awsConfig.secretAccessKey,
        },
      });
      this.logger.log('AWS S3 client initialized successfully');
    } catch (error) {
      this.logger.error(`Error initializing S3 client: ${error.message}`);
    }
  }

  async uploadFile(file: any, options?: StorageOptions): Promise<void> {
    try {
      const command = new PutObjectCommand({
        Bucket: options?.bucketName || this.bucketName,
        Key: options?.path || file.originalname,
        Body: file.buffer,
        ContentType: file.mimetype,
      });
      await this.s3Client.send(command);
      this.logger.log(`File ${options?.path} uploaded successfully to S3`);
    } catch (error) {
      this.logger.error(`Error uploading file to S3: ${error.message}`);
      throw error;
    }
  }

  setBucketName(bucketName: string): void {
    this.bucketName = bucketName;
  }

  async getObject(key: string, options?: StorageOptions): Promise<any> {
    try {
      this.logger.log(`Getting object from S3: ${key}`);
      const command = new GetObjectCommand({
        Bucket: options?.bucketName || this.bucketName,
        Key: key,
      });
      const response = await this.s3Client.send(command);
      return response.Body;
    } catch (error) {
      this.logger.error(`Error getting object from S3: ${error.message}`);
      throw error;
    }
  }
}
