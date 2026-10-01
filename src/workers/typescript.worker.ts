import { startJavaScriptWorker } from './javascript-runtime'
import { compile } from '@/lib/typescript-runtime/browser'
startJavaScriptWorker(compile)
