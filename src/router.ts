import { Router } from 'express';
import { customLLMHandler } from './handlers/custom-llm';

const router = Router();

//router.post('/custom-llm/basic/chat/completions', customLLMHandler.basic);
router.post(
  '/custom-llm/openai-sse/chat/completions',
  customLLMHandler.openaiSSE
);

router.post('/custom-llm/stream/chat/completions', customLLMHandler.streamDM);

export { router };
