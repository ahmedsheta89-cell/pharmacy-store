// Test-only rendering with synthetic data. Never use for deployment.
import {defineConfig} from 'vite';import react from '@vitejs/plugin-react';import tailwindcss from '@tailwindcss/vite';import {fileURLToPath} from 'node:url';
export default defineConfig({define:{"import.meta.env.VITE_CRM_OWNER_UID":JSON.stringify("owner")},plugins:[react(),tailwindcss()],resolve:{alias:[{find:'./lib/crm',replacement:fileURLToPath(new URL('../testing/visual-fixtures.js',import.meta.url))}]}});
