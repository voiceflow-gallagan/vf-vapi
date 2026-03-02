# Voiceflow Vapi Custom LLM integration

## STEP 1: Voiceflow
#### Import the Agent demo file on your Voiceflow workspace.
Import the **vapi_agent.vf** file on your Voiceflow workspace by clicking on the import button.

![Import](./doc/vf_import.png)

Open your agent and be sure to test the **Agent** demo at least once to compile the version if your **VOICEFLOW_VERSION_ID** is set to **development**, or to click on the **Publish** button if you've set the **VOICEFLOW_VERSION_ID** to **production**.

Retrieve the **Voiceflow API key** from the Voiceflow integrations view.
![Get Voiceflow API key](./doc/vf_api_key.png)

Retrieve the Voiceflow **project ID** from the Voiceflow settings view.
![Get Voiceflow project ID](./doc/vf_project_id.png)


## STEP 2: VAPI API KEY

Retrieve you **private API key** from the VAPI dashboard

![Get API key](./doc/get_vapi_key_1.png)
![Get API key](./doc/get_vapi_key_2.png)



## STEP 3: SETUP THE INTEGRATION
#### Create the .env file

``` bash
cp .env.template .env
```

Update the .env file with your **Voiceflow API key** and **project ID**.

#### Start ngrok on your port

``` bash
ngrok http 3101
```

Save the ngrok forwarding url for next step to update the Custom LLM endpoint in the VAPI assistant.

![Ngrok](./doc/ngrok.png)

#### Setup the integration

``` bash
npm run setup
```

#### Start the client

``` bash
npm run cli
```

``` bash
Welcome to the VF | VAPI Custom LLM Endpoint
1. Launch server
2. Create an assistant
Enter your choice (1 or 2):
```

Select **2** to create an assistant.

``` bash
Enter assistant name: { any name }
Enter endpoint: { the ngrok forwarding url copied from previous step }
Enter VAPI API key: { the VAPI API key copied from previous step }
```

You can now start the server
``` bash
Assistant {name} created successfully
Do you want to start the server now? (y/n): y
```

``` bash
[ ready ] http://localhost:3101
```

### OR (if you've already done the previous step)

#### Start the server

``` bash
npm run start
```

## STEP 4: TESTING
On VAPI, select the assistant you've just created and click on the **Talk** button to test your assistant.

![Test](./doc/talk_button.png)


<a href="https://trackgit.com">
<img src="https://us-central1-trackgit-analytics.cloudfunctions.net/token/ping/m0ct6kqg6un750li0f7m" alt="trackgit-views" />
</a>
<a href="https://trackgit.com">
<img src="https://api.swetrix.com/log/noscript?pid=fnSZorwAce9B" alt="" referrerpolicy="no-referrer-when-downgrade" />
</a>

[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=voiceflow-community_vf-vapi&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=voiceflow-community_vf-vapi)
