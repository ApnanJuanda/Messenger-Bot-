var dbConnection = require("../connection/config");

exports.insertMessage = (statement, data) => {
  //execute query
  dbConnection.query(statement, data, (err, rows, field) => {
    // error handling
    if (err) {
      console.log("Error: ", err);
      //return response.status(500).json({ message: 'Gagal insert data!', error: err });
    } else {
      console.log("Data Save to MySQL: ");
    }
    //return response.status(200).json({ message: 'Berhasil insert data!'});
  });
};

// execute query
exports.getMessageIn = (res, statement, id) => {

  dbConnection.query(statement, id, (err, result) => {
    const responseData = function (res, statusCode, values) {
      var data = {
          success: true,
          data: values,
      };
      res.status(statusCode).json(data);
      res.end();
    };
    if (err) {
      return res.status(500).json({ message: "Something is error: ", error: err });
    }
    responseData(res, 200, result);
  });
};
