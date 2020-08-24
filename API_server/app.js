const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

// API-server
// pwXyR7STuq19D3cZ
mongoose.connect(
  "mongodb+srv://API-server:pwXyR7STuq19D3cZ@cluster0.cxpu4.gcp.mongodb.net/funSystemParsingDB?retryWrites=true",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);
// for debugging
// mongoose.connect("mongodb://localhost/funSystemParsingDB", {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// });

const funProgramSchema = new mongoose.Schema({
  title: String,
  department: String,
  date: String,
  remainDate: String,
  url: String,
  id: Number,
  //isNewProgram: Boolean,
  version: Number,
  remainLabel: String,
  isClosed: Boolean
});

const FunProgram = new mongoose.model("FunProgram", funProgramSchema);

const versionSchema = new mongoose.Schema({
  version: Number,
});

const Version = new mongoose.model("Version", versionSchema);

app.get("/version", function (req, res) {
  Version.findOne(function (err, foundVersion) {
    if (!err) {
      res.send(foundVersion);
    } else {
      res.send(err);
    }
  });
});

app.get("/programs", function (req, res) {
  FunProgram.aggregate(
    [
      {$match:
        {"isClosed": false}
      },
      {$project: 
        {
          "title": 1,
          "department": 1,
          "date": 1,
          "remainDate": 1,
          "url": 1,
          //"id": 1,
          "version": 1,
          "remainLabel": 1, 
          "length": { "$strLenCP": "$remainDate" },
          //"isClosed": 1
        } 
      },
      {$sort: 
        {
          "remainLabel": 1,
          "length": 1,
          "remainDate": 1
        }
      }
    ],
      function (err, foundPrograms) {
        if (!err) {
          res.send(foundPrograms);
        } else {
          res.send(err);
        }
      } 
    );
});

app.listen(3333, function () {
  console.log(
    "Soongsil Fun System Parsing data API server is now running on port 3333"
  );
});

// /version
// /programs
