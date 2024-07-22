import { Request, Response } from 'express';
import axios from 'axios';

const conversationStates = new Map<string, boolean>();

async function deleteUserState(user) {
  const request = {
    method: 'DELETE',
    url: `https://general-runtime.voiceflow.com/state/user/${encodeURI(
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
      url: 'https://api.voiceflow.com/v2/transcripts',
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

export const nostreamDM = async (req: Request, res: Response) => {

  try {
    const {
      // model,
      messages,
      //max_tokens,
      //temperature,
      call,
      tools,
      //stream,
      //...restParams
    } = req.body;

    const lastMessage = messages?.[messages.length - 1];

    let userId = call?.customer?.number || call.id
    const isNewConversation = !conversationStates.has(call.id);
    conversationStates.set(call.id, true);

    const baseRequest = {
      method: 'POST',
      url: `${process.env.VOICEFLOW_API_URL}/state/user/${encodeURI(userId)}/interact`,
      headers: {
        Authorization: process.env.VOICEFLOW_API_KEY,
        sessionID: userId,
        versionID: process.env.VOICEFLOW_VERSION_ID,
      },
      data: {
        config: { tts: false, stripSSML: true, stopTypes: ['DTMF'] },
      },
    };

    let response;
    let shouldEndCall = false;
    let messageshistory = [];

    if (isNewConversation) {
      await deleteUserState(userId);
      response = await axios({
        ...baseRequest,
        data: {
          ...baseRequest.data,
          action: { type: "launch" },
        },
      });
    } else {
      response = await axios({
        ...baseRequest,
        data: {
          ...baseRequest.data,
          action: {
            type: "text",
            payload: lastMessage.content,
          } as { type: string; payload: string },
        },
      });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for (const trace of response.data) {
      switch (trace.type) {
        case 'text':
        case 'speak': {
          if (trace.payload?.message) {
            const chunk = {
              id: `chatcmpl-${Math.floor(Date.now() / 1000)}`,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model: "dmapi",
              choices: [
                {
                  index: 0,
                  delta: { content: trace.payload.message },
                  finish_reason: null,
                },
              ],
            };
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          }
          break;
        }
        case 'end': {
          shouldEndCall = true;
          break;
        }
        default: {
          console.log('Unknown trace type', trace)
        }
      }
    }
  // If there's no 'end' trace, send a final chunk and end the response
  if (shouldEndCall) {

    const endCallChunk = {
      id: `chatcmpl-${Math.floor(Date.now() / 1000)}`,
      object: "chat.completion.chunk",
      created: Math.floor(Date.now() / 1000),
      model: "dmapi",
      tools: tools,
      tool_choice: "endCall",
      choices: [
        {
          index: 0,
          delta: {
            content: "Goodbye!",
            function_call: {
              name: "endCall",
              arguments: {}
            }
          },
          finish_reason: "function_call" //null //"tool_calls"
        }
      ]
    };
    res.write(`data: ${JSON.stringify(endCallChunk)}\n\n`);
  } else {
    // If there's no 'end' trace, send a final chunk and end the response
    const finalChunk = {
      id: `chatcmpl-${Math.floor(Date.now() / 1000)}`,
      object: "chat.completion.chunk",
      created: Math.floor(Date.now() / 1000),
      model: "dmapi",
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: 'stop',
        },
      ],
    };
    res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
  }
  res.end();
  saveTranscript(userId)
  } catch (e) {
    console.log(e);
    res.status(500).json({ error: e });
  }
};
