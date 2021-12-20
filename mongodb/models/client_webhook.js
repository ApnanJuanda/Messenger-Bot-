const mongoose = require("mongoose");

const client_webhook = mongoose.model("client_webhook", {
  page_id: {
    type: String,
  },
  client_id: {
    type: String,
  },
  message: {
    type: String,
  },
  message_id: {
    type: String
  }
});

module.exports = { client_webhook };
