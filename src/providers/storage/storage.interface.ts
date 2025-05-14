export interface StorageOptions {
  bucketName?: string;
  path?: string;
}

export interface IStorageProvider {
  uploadFile(file: any, options?: StorageOptions): Promise<void>;
  getObject(key: string, options?: StorageOptions): Promise<any>;
}
