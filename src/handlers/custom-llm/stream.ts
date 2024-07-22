import { Request, Response } from 'express';
import fetch from 'node-fetch';
import { PassThrough } from 'stream';
import axios from 'axios';

const conversationStates = new Map<string, boolean>();

const getVoiceflowDomain = () => {
  const customDomain = process.env.VOICEFLOW_DOMAIN;
  return customDomain ? `${customDomain}.general-runtime.voiceflow.com` : 'general-runtime.voiceflow.com';
};

const getTranscriptsDomain = () => {
  const customDomain = process.env.VOICEFLOW_DOMAIN;
  return customDomain ? `api.${customDomain}.voiceflow.com` : 'api.voiceflow.com';
};

async function deleteUserState(user) {
  const request = {
    method: 'DELETE',
    url: `https://${getVoiceflowDomain()}/state/user/${encodeURI(
      user
    )}`,
    headers: {
      Authorization: process.env.VOICEFLOW_API_KEY,
      versionID: process.env.VOICEFLOW_VERSION_ID,
    },
  }
  const response = await axios(request)
  return response
}

async function saveTranscript(user) {

    axios({
      method: 'put',
      url: `https://${getTranscriptsDomain()}/v2/transcripts`,
      data: {
        browser: 'VAPI',
        device: 'Phone',
        os: 'VAPI',
        sessionID: user,
        unread: true,
        versionID: process.env.VOICEFLOW_VERSION_ID,
        projectID: process.env.VOICEFLOW_PROJECT_ID,
        user: {
          name: user,
          image:
            'https://s3.amazonaws.com/com.voiceflow.studio/share/twilio-logo-png-transparent/twilio-logo-png-transparent.png',
        },
      },
      headers: {
        Authorization: process.env.VOICEFLOW_API_KEY,
      },
    })
      .catch((err) => console.log(err))

}

async function voiceflowToOpenAIStream(voiceflowResponse: any, onChunk: any) {
  let content = '';
  let buffer = '';
  let isCompletionStarted = false;

  return new Promise<void>((resolve, reject) => {
    voiceflowResponse.body.on('data', (chunk) => {
      const chunkStr = chunk.toString();
      buffer += chunkStr;

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim() === '') continue;

        if (line.startsWith('data:')) {
          const jsonData = line.slice(5).trim();
          try {
            const data = JSON.parse(jsonData);
            if (data.type === 'trace') {
              switch (data.trace.type) {
                case 'completion-start':
                  isCompletionStarted = true;
                  onChunk({
                    choices: [{
                      delta: { content: '' },
                      index: 0,
                      finish_reason: null
                    }]
                  });
                  break;
                case 'completion-continue':
                  if (isCompletionStarted) {
                    content += data.trace.payload.completion;
                    onChunk({
                      choices: [{
                        delta: { content: data.trace.payload.completion },
                        index: 0,
                        finish_reason: null
                      }]
                    });
                  }
                  break;
                case 'completion-end':
                  if (isCompletionStarted) {
                    onChunk({
                      choices: [{
                        delta: {},
                        index: 0,
                        finish_reason: 'stop'
                      }]
                    });
                    isCompletionStarted = false;
                  }
                  break;
              }
            }
          } catch (error) {
            console.warn('Error parsing JSON:', error, 'Raw data:', jsonData);
          }
        }
      }
    });

    voiceflowResponse.body.on('end', () => {
      if (buffer) {
        console.warn('Unprocessed data in buffer:', buffer);
      }
      console.log('Final content:', content);
      if (isCompletionStarted) {
        onChunk({
          choices: [{
            delta: {},
            index: 0,
            finish_reason: 'stop'
          }]
        });
      }
      resolve();
    });

    voiceflowResponse.body.on('error', (error) => {
      console.error('Error reading Voiceflow response:', error);
      reject(error);
    });
  });
}

export const streamDM = async (req: Request, res: Response) => {
  try {
    const {
      //model,
      messages,
      //max_tokens,
      //temperature,
      call,
      tools,
      stream,
    } = req.body;
    const userID = call?.customer?.number || call.id
    const isNewConversation = !conversationStates.has(call.id);
    conversationStates.set(call.id, true);
    const sessionID = `session_${Math.floor(Date.now() / 1000)}`
    // delete restParams.metadata;

    const voiceflowUrl = `https://${getVoiceflowDomain()}/v2beta1/interact/${process.env.VOICEFLOW_PROJECT_ID}/${process.env.VOICEFLOW_VERSION_ID}/stream`;
    const voiceflowHeaders = {
      'Accept': 'text/event-stream',
      'Authorization': process.env.VOICEFLOW_API_KEY,
      'Content-Type': 'application/json'
    };

    const voiceflowBody = {
      action: {
        type: 'text',
        payload: req.body.messages[req.body.messages.length - 1].content
      },
      session: {
        userID,
        sessionID
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

      await voiceflowToOpenAIStream(voiceflowResponse, (chunk) => {
        stream.write(`data: ${JSON.stringify(chunk)}\n\n`);
      });

      stream.end();

    } catch (error) {
      console.error('Error:', error);
      stream.write(`data: ${JSON.stringify({ error: 'An error occurred while processing your request.' })}\n\n`);
      stream.end();
    }
  } catch (e) {
    console.log('Error:', e);
    res.status(500).json({ error: e });
  }
};
