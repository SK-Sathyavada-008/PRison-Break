import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function githubWebhookDevPlugin(): Plugin {
  return {
    name: 'github-webhook-dev-handler',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0];
        if (url === '/api/github/webhook' || url === '/api/webhook') {
          try {
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
            }
            const rawBody = Buffer.concat(chunks).toString('utf-8');
            let body: any = {};
            try {
              body = rawBody ? JSON.parse(rawBody) : {};
            } catch {
              body = rawBody;
            }

            // Dynamically load webhook handler
            const { default: handler } = await import('./api/github/webhook.ts');

            const vercelRes: any = {
              status(code: number) {
                res.statusCode = code;
                return vercelRes;
              },
              json(data: any) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
                return vercelRes;
              },
              send(data: any) {
                res.end(data);
                return vercelRes;
              },
            };

            const vercelReq: any = req;
            vercelReq.body = body;

            await handler(vercelReq, vercelRes);
            return;
          } catch (err: any) {
            console.error('[ViteDevWebhook] Error:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
            return;
          }
        }
        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    githubWebhookDevPlugin(),
  ],
})
