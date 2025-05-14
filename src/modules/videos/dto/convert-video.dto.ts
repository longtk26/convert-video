import { IsString } from 'class-validator';

export class ConvertVideoRequestDto {
  @IsString()
  sourceBucket: string;

  @IsString()
  sourceKey: string;

  @IsString()
  destinationBucket: string;
}

export class ConvertVideoResponseDto {
  @IsString()
  message: string;
}
