import { Request, Response } from 'express';
//import fetch = require('node-fetch');
import { PassThrough } from 'stream';
import OpenAI from 'openai';
import { envConfig } from '../../config/env.config';
import axios from 'axios';

// const openai = new OpenAI({ apiKey: envConfig.openai.apiKey });

async function* voiceflowToOpenAIStream(voiceflowResponse) {
  let content = '';
  for await (const chunk of voiceflowResponse.body) {
    const lines = chunk.toString().split('\n\n');
    for (const line of lines) {
      if (line.startsWith('data:')) {
        const data = JSON.parse(line.slice(5));
        if (data.type === 'trace' && data.trace.type === 'completion-continue') {
          content += data.trace.payload.completion;
          yield JSON.stringify({
            choices: [{
              delta: { content: data.trace.payload.completion },
              index: 0,
              finish_reason: null
            }]
          }) + '\n';
        }
      }
    }
  }

  // Final message
  yield JSON.stringify({
    choices: [{
      delta: {},
      index: 0,
      finish_reason: 'stop'
    }]
  }) + '\n';
}

export const openaiSSE = async (req: Request, res: Response) => {
  try {
    const {
      model,
      messages,
      max_tokens,
      temperature,
      call,
      stream,
      ...restParams
    } = req.body;

    delete restParams.metadata;

    console.log(req.body);
    const voiceflowUrl = 'https://general-runtime.voiceflow.com/v2beta1/interact/66854b1150071d75d0bdd702/development/stream';
  const voiceflowHeaders = {
    'Accept': 'text/event-stream',
    'Authorization': 'VF.DM.66854b63a012b6c03983587f.2guwZJauMOEnwceM',
    'Content-Type': 'application/json'
  };

  const voiceflowBody = {
    action: {
      type: 'intent',
      payload: {
        intent: { name: 'receive_message' },
        query: req.body.messages[req.body.messages.length - 1].content
      }
    },
    session: {
      userID: '1234',
      sessionID: 'session_123'
    }
  };

  try {
    const voiceflowResponse = await fetch(voiceflowUrl, {
      method: 'POST',
      headers: voiceflowHeaders,
      body: JSON.stringify(voiceflowBody)
    });

    if (!voiceflowResponse.ok) {
      throw new Error(`Voiceflow API responded with status ${voiceflowResponse.status}`);
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    const stream = new PassThrough();
    stream.pipe(res);

    for await (const chunk of voiceflowToOpenAIStream(voiceflowResponse)) {
      stream.write(`data: ${chunk}\n\n`);
    }

    stream.end();
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'An error occurred while processing your request.' });
  }

  } catch (e) {
    console.log(e);
    res.status(500).json({ error: e });
  }
};
