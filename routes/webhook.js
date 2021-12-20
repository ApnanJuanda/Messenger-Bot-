require("dotenv").config();
var request = require("request");
var express = require("express");
var router = express.Router();
var url = require("url");
const stomp = require("stomp-client");
const { client_webhook } = require("../mongodb/models/client_webhook");

const stompClient = new stomp("localhost", 61613); //https://coresystem-messenger.herokuapp.com/

router.get("/", (req, res) => {
  let VERIFY_TOKEN = process.env.MY_VERIFY_TOKEN;

  let mode = req.query["hub.mode"];
  let token = req.query["hub.verify_token"];
  let challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

stompClient.connect(() => {
  router.post("/", (req, res) => {
    let body = req.body;
    
    //var headersMessage;
    var url = req.originalUrl;
    var webhook_id = url.match(/^\/.*?\/([0-9]+).*$/)[1];
    //console.log("Ini Webhook_id" + webhook_id);

    if (body.object === "page") {
      body.entry.forEach(function (entry) {
        let webhook_event = entry.messaging[0];
        let sender_psid = webhook_event.sender.id;
        let page_id = webhook_event.recipient.id;
        let message_text = webhook_event.message.text;
        let echo = webhook_event.message.is_echo;

        if (echo == null) {
          /*Publish to QUEUE ActiveMQ */
          const notification = {
            client_id: sender_psid,
            page_id: page_id,
            message_text: message_text,
          };
          var message = JSON.stringify(notification);
          if(stompClient.publish("/queue/coresystem", message)){
            console.log("QUEUE SEND");
          }  
        }
        
        if (webhook_event.message) {
          //entry.messaging[0].message
          handleMessage(sender_psid, webhook_event.message);
          res.status(200).send("EVENT_RECEIVED");
        } else if (webhook_event.postback) {
          handlePostback(sender_psid, webhook_event.postback);
        }
      });
      
      res.status(200).send("EVENT_RECEIVED");
    } else {
      res.sendStatus(404);
    }
      
    
  });

  stompClient.subscribe("/queue/coresystem", function (body, headers){
    var jsonMessage = JSON.parse(body);
    var client = new client_webhook({
      page_id: jsonMessage.page_id,
      client_id: jsonMessage.client_id,
      message: jsonMessage.message_text,
      message_id: headers["message-id"],
    });
    client.save();
    console.log("Database saveddddddddddd");
  });
});

// Handles messages events
function handleMessage(sender_psid, received_message) {  
  let response;

  if (received_message.text) {
    response = {
      text: `You sent the message: "${received_message.text}". Now send me an image!`,
    };
  } else if (received_message.attachments) {
    let attachment_url = received_message.attachments[0].payload.url;
    response = {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [
            {
              title: "Is this the right picture?",
              subtitle: "Tap a button to answer.",
              image_url: attachment_url,
              buttons: [
                {
                  type: "postback",
                  title: "Yes!",
                  payload: "yes",
                },
                {
                  type: "postback",
                  title: "No!",
                  payload: "no",
                },
              ],
            },
          ],
        },
      },
    };
  }

  // Sends the response message
  callSendAPI(sender_psid, response);
}

function handlePostback(sender_psid, received_postback) {
  let response;
  let payload = received_postback.payload;

  if (payload === "yes") {
    response = { text: "Thanks!" };
  } else if (payload === "no") {
    response = { text: "Oops, try sending another image." };
  }

  callSendAPI(sender_psid, response);
}

// Sends response messages via the Send API
function callSendAPI(sender_psid, response) {
  // Construct the message body
  let request_body = {
    recipient: {
      id: sender_psid,
    },
    message: response,
  };

  // Send the HTTP request to the Messenger Platform
  request(
    {
      uri: "https://graph.facebook.com/v2.6/me/messages",
      qs: { access_token: process.env.PAGE_ACCESS_TOKEN },
      method: "POST",
      json: request_body,
    },
    (err, res, body) => {
      if (!err) {
        console.log("message sent!");
      } else {
        console.error("Unable to send message:" + err);
      }
    }
  );
}

module.exports = router;
