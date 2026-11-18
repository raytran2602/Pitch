import express from 'express';
import dotenv from 'dotenv';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw Object.assign(
      new Error('GEMINI_API_KEY is not configured in the server environment.'),
      { status: 503 }
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const e = err as { status?: number; code?: number; message?: string };
  const rawMessage = e?.message || 'Unexpected Gemini API error.';
  const status = typeof e?.status === 'number' ? e.status : typeof e?.code === 'number' ? e.code : 500;

  if (status === 403 || rawMessage.includes('PERMISSION_DENIED')) {
    return {
      status: 403,
      message:
        'Permission denied for this model. Please ensure a billing-enabled GEMINI_API_KEY is configured in Settings > Secrets.',
    };
  }
  if (status === 429 || rawMessage.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message:
        'Quota exhausted for this model. Paid-tier models require a billing-enabled GEMINI_API_KEY in Settings > Secrets.',
    };
  }
  if (status === 400 || rawMessage.includes('API_KEY_INVALID')) {
    return {
      status: 400,
      message: rawMessage,
    };
  }
  return { status, message: rawMessage };
}

async function startServer() {
  const app = express();
  const port = 3000;

  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'pitch-career-server' });
  });

  app.post('/api/media/generate-image', async (req, res) => {
    try {
      const { prompt, imageSize = '1K', aspectRatio = '16:9' } = req.body ?? {};
      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return res.status(400).json({ error: 'A prompt is required to generate an image.' });
      }
      const allowedSizes = ['1K', '2K', '4K'];
      const allowedRatios = ['1:1', '3:4', '4:3', '9:16', '16:9'];
      const resolvedSize = allowedSizes.includes(imageSize) ? imageSize : '1K';
      const resolvedRatio = allowedRatios.includes(aspectRatio) ? aspectRatio : '16:9';

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: {
          parts: [{ text: prompt.trim() }],
        },
        config: {
          imageConfig: {
            aspectRatio: resolvedRatio,
            imageSize: resolvedSize,
          },
        },
      });

      let imageUrl: string | null = null;
      let caption = '';

      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType ?? 'image/png';
          imageUrl = `data:${mime};base64,${part.inlineData.data}`;
        } else if (part.text) {
          caption += part.text;
        }
      }

      if (!imageUrl) {
        return res.status(502).json({
          error: 'Model completed without returning an image payload.',
          caption,
        });
      }

      return res.json({
        imageUrl,
        caption,
        model: 'gemini-3-pro-image-preview',
        imageSize: resolvedSize,
        aspectRatio: resolvedRatio,
      });
    } catch (err) {
      const { status, message } = formatGeminiError(err);
      return res.status(status).json({ error: message });
    }
  });

  app.post('/api/media/animate-image', async (req, res) => {
    try {
      const {
        imageBase64,
        mimeType = 'image/png',
        prompt = 'Subtle stadium floodlights shimmer, cinematic camera push-in, grass blades moving gently in the breeze.',
        aspectRatio = '16:9',
      } = req.body ?? {};

      if (!imageBase64 || typeof imageBase64 !== 'string') {
        return res.status(400).json({ error: 'An uploaded image is required.' });
      }

      const resolvedRatio = aspectRatio === '9:16' ? '9:16' : '16:9';
      const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

      const ai = getAiClient();
      const interaction = await ai.interactions.create(
        {
          model: 'gemini-omni-1.2-flash',
          input: [
            {
              type: 'image',
              mime_type: mimeType,
              data: cleanBase64,
            },
            {
              type: 'text',
              text: String(prompt).trim() || 'Animate this football scene smoothly.',
            },
          ],
          background: false,
          store: false,
          stream: false,
          response_format: {
            type: 'video',
            aspect_ratio: resolvedRatio,
          },
        },
        { timeout: 300000 }
      );

      const videoPart = interaction.output_video;
      if (!videoPart) {
        return res.status(502).json({
          error: 'Video generation finished without returning a video output.',
        });
      }

      const outMime = videoPart.mime_type || 'video/mp4';
      const videoUrl = videoPart.data
        ? `data:${outMime};base64,${videoPart.data}`
        : videoPart.uri || null;

      if (!videoUrl) {
        return res.status(502).json({ error: 'Video output was empty.' });
      }

      return res.json({
        videoUrl,
        mimeType: outMime,
        aspectRatio: resolvedRatio,
        model: 'gemini-omni-1.2-flash',
      });
    } catch (err) {
      const { status, message } = formatGeminiError(err);
      return res.status(status).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, host: true, allowedHosts: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Pitch server running:`);
    console.log(`  Local:   http://localhost:${port}`);
    const nets = os.networkInterfaces();
    for (const addrs of Object.values(nets)) {
      for (const net of addrs ?? []) {
        if (net.family === 'IPv4' && !net.internal) {
          console.log(`  Network: http://${net.address}:${port}`);
        }
      }
    }
  });
}

startServer();
