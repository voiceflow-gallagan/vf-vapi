import { Router } from 'express';
import { customLLMHandler } from './handlers/custom-llm';

const router = Router();

router.post('/custom-llm/nostream/chat/completions', customLLMHandler.nostreamDM);
router.post('/custom-llm/stream/chat/completions', customLLMHandler.streamDM);

export { router };
