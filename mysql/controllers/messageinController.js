const MessageIn = require("../models/messageinModel");

exports.create = (req, res) => {
    const newMessage = new MessageIn(req.body);
    //check all data is filled
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
      res.status(400).
      res.send({ error:true, message: 'Please provide all required field' });
    }else{
    //Save to database
    MessageIn.create(newMessage, (err, messageAdd) => {
      if (err){
          res.send(err);    
      }else{
          res.json({error:false,message:"message_in added successfully!",data: messageAdd});
      }
    });
    }
};