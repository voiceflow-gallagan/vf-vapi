import { Router } from 'express';
import { customLLMHandler } from './handlers/custom-llm/index.js';

const router = Router();

router.post('/chat/completions', customLLMHandler.dmAPI);

export { router };
