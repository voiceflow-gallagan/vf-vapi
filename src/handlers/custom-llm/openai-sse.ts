import { Request, Response } from 'express';
import fetch from 'node-fetch';
import { PassThrough } from 'stream';


async function voiceflowToOpenAIStream(voiceflowResponse: any, onChunk: any) {
  let content = '';
  console.log('Voiceflow response status:', voiceflowResponse.status);
  console.log('Voiceflow response headers:', voiceflowResponse.headers);

  return new Promise<void>((resolve, reject) => {
    voiceflowResponse.body.on('data', (chunk) => {
      const chunkStr = chunk.toString();

      const lines = chunkStr.split('\n');
      for (const line of lines) {
        if (line.trim() === '') continue;

        //console.log('Processing line:', line);

        if (line.startsWith('data:')) {
          const jsonData = line.slice(5).trim();
          try {
            const data = JSON.parse(jsonData);
            if (data.type === 'trace' && data.trace.type === 'completion-continue') {
              console.log('Raw chunk:', chunkStr);
              content += data.trace.payload.completion;
              console.log('Content:', content);
              onChunk({
                choices: [{
                  delta: { content: data.trace.payload.completion },
                  index: 0,
                  finish_reason: null
                }]
              });
            }
          } catch (error) {
            console.error('Error parsing JSON:', error);
          }
        }
      }
    });

    voiceflowResponse.body.on('end', () => {
      console.log('Final content:', content);
      onChunk({
        choices: [{
          delta: {},
          index: 0,
          finish_reason: 'stop'
        }]
      });
      resolve();
    });

    voiceflowResponse.body.on('error', (error) => {
      console.error('Error reading Voiceflow response:', error);
      reject(error);
    });
  });
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

    // delete restParams.metadata;

    // console.log(req.body);
    const voiceflowUrl = 'https://general-runtime.voiceflow.com/v2beta1/interact/66854b1150071d75d0bdd702/development/stream';
    const voiceflowHeaders = {
      'Accept': 'text/event-stream',
      'Authorization': 'VF.DM.66854b63a012b6c03983587f.2guwZJauMOEnwceM',
      'Content-Type': 'application/json'
    };
    console.log('Message:', req.body.messages[req.body.messages.length - 1].content);
    const voiceflowBody = {
      action: {
        type: 'intent',
        payload: {
          intent: { name: 'receive_message' },
          query: req.body.messages[req.body.messages.length - 1].content
        }
      },
      session: {
        userID: '12345',
        sessionID: 'session_1234'
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

      // console.log('Voiceflow Response:', voiceflowResponse);

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });

      const stream = new PassThrough();
      stream.pipe(res);

      await voiceflowToOpenAIStream(voiceflowResponse, (chunk) => {
        console.log('Write Chunk:', chunk);
        stream.write(`data: ${chunk}\n\n`);
      });

      stream.end();

    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: 'An error occurred while processing your request.' });
    }
  } catch (e) {
    console.log('Error:', e);
    res.status(500).json({ error: e });
  }
};
