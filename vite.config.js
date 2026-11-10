import {defineConfig} from 'vite';
import {createAuthHandler} from './server/platform-auth.mjs';
export default defineConfig({
  plugins:[{
    name:'platform-credentials',
    configureServer(server){server.middlewares.use('/api/platform',createAuthHandler());},
    configurePreviewServer(server){server.middlewares.use('/api/platform',createAuthHandler());},
  }],
});
