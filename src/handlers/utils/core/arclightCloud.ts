import { httpPost, httpDelete, httpGet } from '../../../utils/http';
import logger from '../../logger';

const ARCLIGHT_CLOUD_URL = 'https://api.arclight.my.id';

async function streamToBuffer(stream: unknown): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const readable = stream as AsyncIterable<Buffer>;
  for await (const chunk of readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export class ArclightCloudClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async uploadFile(fileStream: unknown, fileName: string) {
    const buffer = await streamToBuffer(fileStream);
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(buffer)]), fileName);

    try {
      const response = await httpPost(`${ARCLIGHT_CLOUD_URL}/storage/upload`, form, {
        headers: {
          'X-API-Key': this.apiKey,
        },
      });

      return response.data;
    } catch (error) {
      logger.error('Arclight Cloud upload error:', error);
      throw error;
    }
  }

  async deleteFile(fileId: string) {
    try {
      const response = await httpDelete(`${ARCLIGHT_CLOUD_URL}/storage/files/${fileId}`, undefined, {
        headers: {
          'X-API-Key': this.apiKey,
        },
      });

      return response.data;
    } catch (error) {
      logger.error('Arclight Cloud delete error:', error);
      throw error;
    }
  }

  async getDownloadStream(fileId: string) {
    try {
      const response = await httpGet(`${ARCLIGHT_CLOUD_URL}/storage/download/${fileId}`, {
        headers: {
          'X-API-Key': this.apiKey,
        },
        responseType: 'stream',
      });

      return response;
    } catch (error) {
      logger.error('Arclight Cloud download error:', error);
      throw error;
    }
  }
}
