const mysql = require('mysql');
//local mysql db connection
const dbConnection = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : '',
  database : 'messenger_trans'
});
dbConnection.connect((err) => {
  if (err) throw err;
  console.log("Database Connected!");
});
module.exports = dbConnection;