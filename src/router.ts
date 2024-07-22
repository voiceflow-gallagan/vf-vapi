import { Router } from 'express';
import { customLLMHandler } from './handlers/custom-llm';

const router = Router();

router.post('/chat/completions', customLLMHandler.dmAPI);

export { router };
