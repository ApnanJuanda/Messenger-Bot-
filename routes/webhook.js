require("dotenv").config();
var request = require("request");
var express = require("express");
var router = express.Router();
var crypto = require("crypto");
var stomp = require("stomp-client");
var dbConnection = require("../mysql/connection/config");
const stompClient = new stomp("localhost", 61613);
const { client_webhook } = require("../mongodb/models/client_webhook");
const {
  insertMessage,
  getMessageIn,
} = require("../mysql/models/messageinModel");
//const messageinController = require("../mysql/controllers/messageinController");

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
    //console.log(body.entry[0].messaging[0].message);
    if (body.object === "page") {
      body.entry.forEach(function (entry) {
        let webhook_event = entry.messaging[0];

        //Fill Data to send QUEUE
        let link = req.originalUrl;
        let webhook_id = link.match(/^\/.*?\/([0-9]+).*$/)[1];
        let trx_id = crypto.randomBytes(16).toString("hex"); //To get random String
        let message_id = webhook_event.message.mid;
        let json_message = webhook_event.message;
        let sender_id = webhook_event.sender.id;
        let timestamp = webhook_event.timestamp;
        let date_incoming = new Date(timestamp);
        let page_id = webhook_event.recipient.id; //recipient or chatbot
        let message_text = webhook_event.message.text;
        let echo = webhook_event.message.is_echo;
        var jsonMessageIn= JSON.stringify(json_message);
        if (echo == null) {
          /*Publish to QUEUE ActiveMQ */
          //console.log(trx_id);
          
          const notification = {
            client_id: sender_id,
            page_id: page_id,
            message_text: message_text,
            webhook_id: webhook_id,
            message_in: {
              trx_id: trx_id,
              message_id: message_id,
              json_message: json_message,
              sender_id: sender_id,
              date_incoming: date_incoming,
            },
          };
          var message = JSON.stringify(notification);
          if (stompClient.publish("/queue/coresystem", message)) {
            console.log("QUEUE SEND");
          }
        } else if (echo == true) {
          /*Logic to save respond from chatbot to table message_out (MySQL) */
          //console.log(body.entry[0].messaging);
          const queryGetData = "SELECT * FROM message_in WHERE trx_id = ?";
          const id = "4947e1421f376dd5ebe20317688547ed";
          // const readData = (req, res) => {
          //   getMessageIn(res, queryGetData, id);
          //   console.log(res);
          // };
          // getMessageIn(res, queryGetData, id, (err, result) => {
          //   console.log(result);
          // })
          // dbConnection.query(queryGetData, trx_id, (err, result) => {
          //   if (err) {
          //     console.log("Terjadi error: ", err);
          //   } else if (result.length) {
          //     console.log(result[0].date_incoming);
          //   } else {
          //     //console.log("Tidak menemukan data");
          //   }
          // });
          var jsonResponse = JSON.stringify(req.body.entry[0].messaging[0].message);
          var date_response = new Date(req.body.entry[0].messaging[0].timestamp);
          
          var messageOut = {
            trx_id: trx_id,
            message_id: req.body.entry[0].messaging[0].message.mid,
            webhook_id: webhook_id,
            json_message: jsonMessageIn,
            recipient_id: req.body.entry[0].messaging[0].recipient.id,
            date_submit: date_incoming,
            date_response: date_response,
            http_status: 200,
            json_response: jsonResponse

          };
          const queryMessageOut = "INSERT INTO message_out SET ?";
          insertMessage(queryMessageOut, messageOut);

        }

        if (webhook_event.message) {
          handleMessage(sender_id, webhook_event.message);
          res.status(200).send("EVENT_RECEIVED");
        } else if (webhook_event.postback) {
          handlePostback(sender_id, webhook_event.postback);
        }
      });

      res.status(200).send("EVENT_RECEIVED");
    } else {
      res.sendStatus(404);
    }
  });

  stompClient.subscribe("/queue/coresystem", function (body, headers) {
    var queue = JSON.parse(body);
    //Save to MongoDB
    var client = new client_webhook({
      page_id: queue.page_id,
      client_id: queue.client_id,
      message: queue.message_text,
      message_id: headers["message-id"],
    });
    client.save();
    console.log("Save to MongoDB");

    /*Controller message_in*/
    /*Save to table message_in MySQL*/
    var jsonString = JSON.stringify(queue.message_in.json_message);
    var data = {
      trx_id: queue.message_in.trx_id,
      message_id: queue.message_in.message_id,
      webhook_id: queue.webhook_id,
      json_message: jsonString,
      sender_id: queue.message_in.sender_id,
      date_incoming: queue.message_in.date_incoming,
    };
    const querySql = "INSERT INTO message_in SET ?";
    insertMessage(querySql, data);

    // const queryGetData = "SELECT * FROM message_in WHERE trx_id = ?";
    // dbConnection.query(queryGetData, queue.message_in.trx_id, (err, result) => {
    //   if (err) {
    //     console.log("Terjadi error: ", err);
    //   } else if (result.length) {
    //     console.log(result[0]);
    //   } else {
    //     //console.log("Tidak menemukan data");
    //   }
    // });

    /*const createData = (req, res) => {
      const querySql = 'INSERT INTO message_in SET ?';
  
      // masukkan ke dalam model
      insertBootcamp(res, querySql, data);
    };*/
  });
});

// Handles messages events
function handleMessage(sender_id, received_message) {
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
  callSendAPI(sender_id, response);
}

function handlePostback(sender_id, received_postback) {
  let response;
  let payload = received_postback.payload;

  if (payload === "yes") {
    response = { text: "Thanks!" };
  } else if (payload === "no") {
    response = { text: "Oops, try sending another image." };
  }

  callSendAPI(sender_id, response);
}

// Sends response messages via the Send API
function callSendAPI(sender_id, response) {
  // Construct the message body
  let request_body = {
    recipient: {
      id: sender_id,
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
