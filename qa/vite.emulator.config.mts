import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {fileURLToPath} from 'node:url';
export default defineConfig({plugins:[react(),tailwindcss()],resolve:{dedupe:['firebase','@firebase/app','@firebase/auth','@firebase/firestore'],alias:[{find:/^\.\.\/lib\/firebase$|^\.\/firebase$/,replacement:fileURLToPath(new URL('./firebase-emulator.ts',import.meta.url))}]}});
