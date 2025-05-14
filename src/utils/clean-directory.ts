import { mkdir, rm } from 'fs/promises';

export const cleanDirectories = async (
  temp_dir: string,
  output_dir: string,
) => {
  await rm(temp_dir, { recursive: true, force: true });
  await rm(output_dir, { recursive: true, force: true });
  await mkdir(temp_dir);
  await mkdir(output_dir);
};
