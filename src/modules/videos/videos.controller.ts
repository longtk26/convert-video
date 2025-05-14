import { Body, Controller, Post } from '@nestjs/common';
import {
  ConvertVideoRequestDto,
  ConvertVideoResponseDto,
} from './dto/convert-video.dto';
import { VideosService } from './videos.service';

@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Post('convert')
  async convertVideo(
    @Body() body: ConvertVideoRequestDto,
  ): Promise<ConvertVideoResponseDto> {
    return this.videosService.convertVideo(body);
  }
}
