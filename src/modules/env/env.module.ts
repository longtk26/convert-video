import { Global, Module } from '@nestjs/common';
import { EnvService } from './env.serivce';

@Global()
@Module({
  providers: [EnvService],
  exports: [EnvService],
})
export class EnvModule {}
