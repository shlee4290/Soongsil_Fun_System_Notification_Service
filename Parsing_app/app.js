const axios = require("axios");
const cheerio = require("cheerio");
const mongoose = require("mongoose");
// const express = require("express");
// const bodyParser = require("body-parser");

//const app = express();

// Parsing-app
// BkOEURxNL5ZabmDo
mongoose.connect("mongodb+srv://Parsing-app:BkOEURxNL5ZabmDo@cluster0.cxpu4.gcp.mongodb.net/funSystemParsingDB?retryWrites=true", {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const funProgramSchema = mongoose.Schema({
  title: String,
  department: String,
  date: String,
  remainDate: String,
  url: String,
  id: Number,
  isNewProgram: Boolean
})

const FunProgram = mongoose.model("FunProgram", funProgramSchema);

const versionSchema = mongoose.Schema({
  version: Number
})

const Version = mongoose.model("Version", versionSchema);

const funSystemURL = "https://fun.ssu.ac.kr/ko/program/all/list/all/";

async function getHTML(url) {
  try {
    return await axios.get(url);
  } catch (err) {
    console.error(err);
  }
}

const Program = function(title, department, date, remainDate, url, id) {
  this.title = title;
  this.department = department;
  this.date = date;
  this.remainDate = remainDate;
  this.url = url;
  this.id = id
  this.isNewProgram = false;
}

let newProgramList = [];
let oldProgramList;

async function checkFunSystem(pageNum) {
  //console.log("checkFunSystem()");

  await getHTML(funSystemURL + pageNum).then(html => {
    const $ = cheerio.load(html.data);

    $("ul.columns-4 li").each(function(index, element) {
      const remainLabel = $(element).find("label").attr("class");
      if (remainLabel === "CLOSED") {
        return false;
      }

      const title = $(element).find(".content .title").text();
      const department = $(element).find(".content .department").text().replace(/\s/g, '');
      const tmpDate = $(element).find(".content small :nth-child(2)").text();
      const date = tmpDate.slice(15) + ' ~ ' + tmpDate.slice(15, tmpDate.length);
      const remainDate = $(element).find("label").first().find("b").text();
      const url = $(element).find("a").attr('href');
      let tmpId = "";
      let i = 21;
      while (true) {
        const convertedNum = Number(url[i])
        if (convertedNum >= 0 && convertedNum <= 9) {
          tmpId += url[i];
        } else {
          break;
        }
        ++i;
      }
      const id = Number(tmpId);

      const newProgram = new Program(title, department, date, remainDate, url, id)
      //console.log(newProgram);
      newProgramList.push(newProgram);

      if (index == 11) {
        checkFunSystem(pageNum + 1);
      }
    });
  });
}

let isListChanged = false;
function checkProgramsState(newProgramList) {
  //console.log("checkProgramsState()");
  if (!newProgramList) return;
  if (newProgramList.length == 0) return;

  isListChanged = false;

  getOldFunPrograms().then(function(oldProgramList) {
    const isNewProgramAdded = insertNewPrograms(oldProgramList, newProgramList);
    const isClosedProgramDeleted = deleteClosedPrograms(oldProgramList, newProgramList);
    setTimeout(function() {
      let needToChangeNewToOldFlag = false;
      if (isListChanged) { // 프로그램 삭제 or 추가된 경우
        for (oldProgram of oldProgramList) {
          needToChangeNewToOldFlag = false;
          if (oldProgram.isNewProgram){
            for (program of newProgramList) {
              if (oldProgram.id == program.id) {
                needToChangeNewToOldFlag = true;
                FunProgram.updateOne({id: program.id}, {$set: {isNewProgram: false}},function(err) {
                  if (err) {
                    console.log(err);
                    console.log("mongoose updateOne error in checkProgramsState()");
                  }
                })
                break;
              }
            }
          }
        }
        changeVersion();
      }
    }, 5000);
  });
  // if (!oldProgramList) return;
}

async function getOldFunPrograms() {
  //console.log("getOldFunPrograms()");
  return await FunProgram.find(async function(err, foundFunPrograms) {
    if (!err) {
      return await foundFunPrograms;
    } else {
      console.log(err);
      console.log("mongoose find error in checkProgramsState()");
    }
  })
}

function insertNewPrograms(oldProgramList, newProgramList) {
  //console.log("insertNewProgramList()");

  if (!oldProgramList) {
    console.log(oldProgramList)
    oldProgramList = [];
  }

  // FunProgram.updateMany({
  //   isNewProgram: true
  // }, {
  //   $set: {
  //     isNewProgram: false
  //   }
  // }, function(err) {
  //   if (err) {
  //     console.log(err);
  //     console.log("mongoose updateMany error in checkNewProgramList()");
  //     return false;
  //   }
  // })

  for (newProgram of newProgramList) {
    let notFoundFlag = true;
    for (oldProgram of oldProgramList) {
      if (oldProgram.id == newProgram.id) {
        notFoundFlag = false;
        break;
      }
    }
    if (notFoundFlag) {
      newProgram.isNewProgram = true;
      const funProgram = new FunProgram(newProgram);
      funProgram.save(function(err) {
        if (err) {
          console.log(err);
          console.log("mongoose save error in insertNewProgramList()");
        } else {
          console.log("INSERT a new program");
        }
      });

      isListChanged = true;
    }
  }

  // for (programToInsert of newProgramList) {
  //   console.log(programToInsert);
  //   FunProgram.findOne({
  //     id: programToInsert.id
  //   }, function(err, foundProgram) {
  //     if (!err) {
  //       //console.log(foundProgram);
  //       if (foundProgram != null && foundProgram) { // 기존에 있던 프로그램인 경우
  //         ;
  //       } else { // 새로 추가된 프로그램인 경우
  //         programToInsert.isNewProgram = true;
  //
  //         //console.log(programToInsert);
  //         const funProgram = new FunProgram(programToInsert);
  //         //console.log(newFunProgram);
  //         return;
  //         funProgram.save(function(err) {
  //           if (err) {
  //             console.log(err);
  //             console.log("mongoose save error in insertNewProgramList()");
  //           } else {
  //             console.log("INSERT a new program:");
  //             console.log(programToInsert.id);
  //           }
  //         });
  //
  //         isListChanged = true;
  //       }
  //     } else {
  //       console.log(err);
  //       console.log("mongoose findOne error in checkNewProgramList()");
  //     }
  //   })
  // }
}

function deleteClosedPrograms(oldProgramList, newProgramList) {
  //console.log("deleteClosedPrograms()");
  if (!oldProgramList) return false;

  for (oldProgram of oldProgramList) {
    let notFoundFlag = true;
    for (newProgram of newProgramList) {
      if (oldProgram.id == newProgram.id) {
        notFoundFlag = false;
        if (isProgramModified(oldProgram, newProgram)) { // 남은 날짜 (remainDate/d-day)와 프로그램 진행 날짜(date)는 변경될 수 있다. 따라서 펀시스템 상에서 이 둘 중 하나가 수정되면 DB의 내용도 수정해준다
                                                        // 하지만 이 때는 새로운 프로그램이 추가되거나, 종료된 프로그램이 있는 것이 아니므로 버전 수정은 하지 않는다.
          console.log("change date in " + oldProgram.id);
          FunProgram.updateOne({id: oldProgram.id}, {$set: {date: newProgram.date, remainDate: newProgram.remainDate}}, function(err){
            if (err) {
              console.log(err);
              console.log("mongoose updateOne error in deleteClosedPrograms()");
            }
          })
        }
        break;
      }
    }
    if (notFoundFlag) {
      FunProgram.deleteOne({
        id: oldProgram.id
      }, function(err) {
        if (err) {
          console.log(err);
          console.log("mongoose deleteOne error in checkClosedPrograms()");
        } else {
          console.log("DELETE a closed program :");

          isListChanged = true;
        }
      });
    }
  }
}

function changeVersion() {
  //console.log("changeVersion()");
  Version.findOne({}, function(err, foundVersion) {
    if (!err) {
      let newVersion;
      if (foundVersion) {
        newVersion = foundVersion.version + 1;
        Version.updateOne({
          version: foundVersion.version
        }, {
          version: newVersion
        }, function(err) {
          if (err) {
            console.log(err);
            console.log("mongoose updateOne error in changeVersion()");
          } else {
            console.log("UPDATE a version :");
            console.log(newVersion);
          }
        })
      } else { // 기존에 저장된 버전이 없는경우
        newVersion = 1;
        const version = new Version({
          version: newVersion
        });
        version.save(function(err) {
          if (err) {
            console.log(err);
            console.log("mongoose save error in changeVersion()");
          } else {
            console.log("UPDATE a version :");
          }
        })
      }
    } else {
      console.log(err);
      console.log("mongoose find error in changeVersion()");
    }
  })
}

function isProgramModified(oldProgram, newProgram) {
  if (oldProgram.date != newProgram.date) {
    return true;
  } else if (oldProgram.remainDate != newProgram.remainDate) {
    return true;
  }

  return false;
}

function parseFunSystemAndUpdateDB() {
  newProgramList = [];
  console.log("==============================================");
  console.log(new Date().toString());
  checkFunSystem(1);

  setTimeout(function() {
    checkProgramsState(newProgramList);

    // FunProgram.find(function(err, foundPrograms) {
    //   console.log(foundPrograms);
    // })
  }, 5000);

}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
console.log("service start");
setInterval(parseFunSystemAndUpdateDB, 60000);
