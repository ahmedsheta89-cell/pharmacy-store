import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
// Actual production Firebase SDK and data-layer code, but no production config.
export default defineConfig({plugins:[react(),tailwindcss()],define:{
 'import.meta.env.VITE_FIREBASE_API_KEY':JSON.stringify('demo-only-key'),
 'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN':JSON.stringify('demo-auth.test'),
 'import.meta.env.VITE_FIREBASE_PROJECT_ID':JSON.stringify('demo-auth-qa'),
 'import.meta.env.VITE_FIREBASE_APP_ID':JSON.stringify('demo-only-app')
}});
