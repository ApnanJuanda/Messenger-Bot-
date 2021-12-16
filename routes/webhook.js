require("dotenv").config();
var request = require("request");
var express = require("express");
var router = express.Router();
const stomp = require("stomp-client");
const { client_webhook} = require("../mongodb/models/client_webhook");

const stompClient = new stomp("localhost", 61613); //https://coresystem-messenger.herokuapp.com/

router.get("/", (req, res) => {
  let VERIFY_TOKEN = process.env.PAGE_ACCESS_TOKEN;

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


router.post("/", (req, res) => {
  let body = req.body;
  var jsonMessage;

  if (body.object === "page") {
    body.entry.forEach(function (entry) {
      let webhook_event = entry.messaging[0];
      //console.log(webhook_event);

      let sender_psid = webhook_event.sender.id;
      let page_idd = webhook_event.recipient.id;
      let message_textt = webhook_event.message.text;
      let echo = webhook_event.message.is_echo;
      //console.log("Sender PSID: " + sender_psid);

      if(echo == null){
        stompClient.connect(() => {
          const notification = {
            client_id: sender_psid,
            page_id: page_idd,
            message_text: message_textt,
  
          }
          stompClient.publish("/queue/coresystem", JSON.stringify(notification));
      
          stompClient.subscribe("/queue/coresystem", (body, headers) => {
            jsonMessage = JSON.parse(body)
            var client = new client_webhook({
              page_id: jsonMessage.page_id,
              client_id: jsonMessage.client_id,
              message: jsonMessage.message_text
            });
            console.log(jsonMessage);
          
            client.save().then(
              (doc) => {
                console.log("Success save to mongoDB");
              },
              (e) => {
                console.log("fail to ssave with error: ", e);
              }
            );
          });
          //stompClient.disconnect();
        })
      }
      
      

      if (webhook_event.message) { //entry.messaging[0].message
        handleMessage(sender_psid, webhook_event.message);
        res.status(200).send("EVENT_RECEIVED");
      }
      else if (webhook_event.postback) {
        handlePostback(sender_psid, webhook_event.postback);
      }
    });

    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});

// router.post("/", (req, res) => {
//   // Parse the request body from the POST
//   let body = req.body;

//   // Check the webhook event is from a Page subscription
//   if (body.object === "page") {
//     // Iterate over each entry - there may be multiple if batched
//     body.entry.forEach(function (entry) {
//       // Get the webhook event. entry.messaging is an array, but
//       // will only ever contain one event, so we get index 0
//       let webhook_event = entry.messaging[0];
//       console.log(webhook_event);

//       // Get the sender PSID
//       // let sender_psid = webhook_event.sender.id;
//       // console.log("Sender PSID: " + sender_psid);
//     });

//     // Return a '200 OK' response to all events
//     res.status(200).send("EVENT_RECEIVED");
//   } else {
//     // Return a '404 Not Found' if event is not from a page subscription
//     res.sendStatus(404);
//   }
// }); 

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
