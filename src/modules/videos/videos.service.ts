import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ConvertVideoRequestDto,
  ConvertVideoResponseDto,
} from './dto/convert-video.dto';
import { WorkersProducer } from 'src/workers/workers.producer';
import { cleanDirectories } from 'src/utils/clean-directory';
import path from 'path';
import { mkdir } from 'fs/promises';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import { resolutions } from './videos.constants';
import { IStorageProvider } from 'src/providers/storage/storage.interface';
import { S3_PROVIDER } from 'src/providers/storage/tokens.storage';

@Injectable()
export class VideosService {
  private readonly logger = new Logger(VideosService.name);
  constructor(
    private readonly workerProducer: WorkersProducer,
    @Inject(S3_PROVIDER)
    private readonly storageProvider: IStorageProvider,
  ) {}

  async convertVideo(
    data: ConvertVideoRequestDto,
  ): Promise<ConvertVideoResponseDto> {
    await this.workerProducer.produceJob('video-convert', data);
    return {
      message: 'Video conversion started',
    };
  }

  async processVideo({
    sourceBucket: bucket,
    sourceKey: key,
    destinationBucket: outputBucket,
    outputPrefix = 'converted',
  }: {
    sourceBucket: string;
    sourceKey: string;
    destinationBucket: string;
    outputPrefix?: string;
  }) {
    this.logger.log(`Starting to process video: s3://${bucket}/${key}`);
    const TEMP_DIR = path.join(__dirname, 'temp');
    const OUTPUT_DIR = path.join(__dirname, 'output');
    await cleanDirectories(TEMP_DIR, OUTPUT_DIR);

    const fileName = path.basename(key);
    const inputPath = path.join(TEMP_DIR, fileName);
    const videoName = path.basename(fileName, path.extname(fileName));
    const outputPath = path.join(OUTPUT_DIR, videoName);

    try {
      await this.downloadVideoFromStorage(bucket, key, inputPath);
      console.log(`Downloaded video to ${inputPath}`);
      await mkdir(outputPath);
      await this.convertToHLS({ inputPath, outputPath });
      console.log('Video conversion completed');
      await this.uploadVideoDirectoryToStorage(
        outputPath,
        outputBucket,
        `${outputPrefix}/${videoName}`,
      );
      console.log(
        `Successfully uploaded HLS files to s3://${outputBucket}/${outputPrefix}/${videoName}/`,
      );

      return {
        success: true,
        message: 'Video processed successfully',
        outputLocation: `s3://${outputBucket}/${outputPrefix}/${videoName}/master.m3u8`,
      };
    } catch (error) {
      console.error('Error processing video:', error);
      return {
        success: false,
        error: error.message,
      };
    } finally {
      await cleanDirectories(TEMP_DIR, OUTPUT_DIR);
    }
  }

  private async convertToHLS({
    inputPath,
    outputPath,
  }: {
    inputPath: string;
    outputPath: string;
  }) {
    const videoInfo = await this.getVideoInfo(inputPath);
    const hasAudio = videoInfo.audioStreams > 0;

    // Extract the source video resolution
    const sourceHeight = videoInfo.height || 0;
    console.log(`Source video resolution height: ${sourceHeight}px`);
    console.log(`Video has audio: ${hasAudio}`);

    let masterPlaylist = '#EXTM3U\n#EXT-X-VERSION:3\n';

    // Process each resolution
    const conversionPromises = resolutions.map(async (resolution) => {
      const variantDir = path.join(outputPath, resolution.name);
      await mkdir(variantDir);

      const variantOutputPath = path.join(variantDir, 'index.m3u8');

      masterPlaylist += `#EXT-X-STREAM-INF:BANDWIDTH=${
        parseInt(resolution.videoBitrate) * 1000
      },RESOLUTION=${resolution.height >= 720 ? 1280 : 640}x${
        resolution.height
      }\n`;
      masterPlaylist += `${resolution.name}/index.m3u8\n`;

      const isUpscaling = sourceHeight > 0 && resolution.height > sourceHeight;
      const upscaleFactor = isUpscaling ? resolution.height / sourceHeight : 1;

      // Build the filtergraph based on source quality and target resolution
      let filterGraph: string[] = [];

      // If upscaling significantly, apply pre-processing filters
      if (isUpscaling) {
        if (upscaleFactor >= 2) {
          // For significant upscaling (2x or more), apply more aggressive enhancement
          filterGraph.push('unsharp=5:5:1.0:5:5:0.0'); // Apply light unsharp mask to source
          filterGraph.push('hqdn3d=1.5:1.5:6:6'); // Denoise without losing too much detail
        } else {
          // For moderate upscaling, apply lighter enhancement
          filterGraph.push('unsharp=3:3:0.7:3:3:0.0'); // Subtle sharpening
          filterGraph.push('hqdn3d=1:1:2:3'); // Light denoising
        }
      }

      // Apply scaling with high quality settings
      if (isUpscaling && upscaleFactor > 1.5) {
        // For significant upscaling, use a higher quality scaler
        filterGraph.push(`scale=-2:${resolution.height}:flags=lanczos`);
      } else {
        // For downscaling or minor upscaling, use bilinear
        filterGraph.push(`scale=-2:${resolution.height}`);
      }

      // Apply post-scaling enhancements
      if (isUpscaling) {
        // Add post-processing sharpening for upscaled content
        filterGraph.push('unsharp=5:5:0.8:3:3:0.4');
      }

      // Combine the filters
      const finalFiltergraph = filterGraph.join(',');
      console.log(
        `${resolution.name} filtergraph: ${finalFiltergraph}${
          isUpscaling ? ' (upscaling)' : ''
        }`,
      );

      let command = ffmpeg(inputPath)
        .outputOptions([
          '-profile:v main',
          '-codec:v h264',
          '-map 0:v',
          '-f hls',
          '-hls_time 6',
          '-hls_list_size 0',
          '-hls_segment_filename',
          path.join(variantDir, 'segment_%03d.ts'),
        ])
        .outputOption('-vf', finalFiltergraph)
        .outputOption('-b:v', resolution.videoBitrate);

      // Add audio options if the video has audio
      if (hasAudio) {
        command = command
          .outputOption('-codec:a', 'aac')
          .outputOption('-map', '0:a')
          .outputOption('-b:a', resolution.audioBitrate);
      }

      // Convert to this resolution's HLS stream
      return new Promise((resolve, reject) => {
        command
          .output(variantOutputPath)
          .on('end', () => {
            console.log(`Finished processing ${resolution.name} variant`);
            resolve('');
          })
          .on('error', (err) => {
            console.error(`Error processing ${resolution.name} variant:`, err);
            reject(err);
          })
          .run();
      });
    });

    await Promise.all(conversionPromises);
    await fs.promises.writeFile(
      path.join(outputPath, 'master.m3u8'),
      masterPlaylist,
    );
  }

  private async getVideoInfo(filePath: string): Promise<{
    duration: number | undefined;
    audioStreams: number;
    videoStreams: number;
    format: string | undefined;
    height: number;
    width: number;
  }> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          return reject(err);
        }

        // Count audio streams
        const audioStreams = metadata.streams.filter(
          (stream) => stream.codec_type === 'audio',
        ).length;

        // Find video height
        let height = 0;
        const videoStream = metadata.streams.find(
          (stream) => stream.codec_type === 'video',
        );
        if (videoStream && videoStream.height) {
          height = videoStream.height;
        }

        resolve({
          duration: metadata.format.duration,
          audioStreams: audioStreams,
          videoStreams: metadata.streams.filter(
            (stream) => stream.codec_type === 'video',
          ).length,
          format: metadata.format.format_name,
          height: height,
          width: videoStream?.width || 0,
        });
      });
    });
  }
  private async downloadVideoFromStorage(
    bucket: string,
    key: string,
    outputPath: string,
  ): Promise<void> {
    const stream = await this.storageProvider.getObject(key, {
      bucketName: bucket,
    });
    this.logger.log(`Stream: ${stream}`);
    const writeStream = fs.createWriteStream(outputPath);
    stream.pipe(writeStream);

    return new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
  }
  private async uploadVideoDirectoryToStorage(
    directory: string,
    bucket: string,
    prefix: string,
  ): Promise<void> {
    const files = await fs.promises.readdir(directory);

    for (const file of files) {
      const filePath = path.join(directory, file);
      const stats = await fs.promises.stat(filePath);

      if (stats.isDirectory()) {
        // Recursive call for subdirectories
        await this.uploadVideoDirectoryToStorage(
          filePath,
          bucket,
          `${prefix}/${file}`,
        );
      } else {
        const fileContent = await fs.promises.readFile(filePath);

        let contentType = 'application/octet-stream';
        if (file.endsWith('.m3u8')) {
          contentType = 'application/x-mpegURL';
        } else if (file.endsWith('.ts')) {
          contentType = 'video/MP2T';
        }

        const params = {
          Bucket: bucket,
          Key: `${prefix}/${file}`,
          Body: fileContent,
          ContentType: contentType,
        };

        await this.storageProvider.uploadFile(params, {
          bucketName: bucket,
          path: params.Key,
        });
        console.log(`Uploaded: ${params.Key}`);
      }
    }
  }
}
