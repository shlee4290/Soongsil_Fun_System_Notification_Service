const axios = require("axios");
const cheerio = require("cheerio");
const mongoose = require("mongoose");

// mongoose 설정 ////////////////////////////////////////////////////////////////

// mongodb Atlas ID: Parsing-app
// pw: BkOEURxNL5ZabmDo
mongoose.connect(
  "mongodb+srv://Parsing-app:BkOEURxNL5ZabmDo@cluster0.cxpu4.gcp.mongodb.net/funSystemParsingDB?retryWrites=true",
  {
    // mongodb cloude에 연결
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
  isClosed: Boolean,
});

const FunProgram = new mongoose.model("FunProgram", funProgramSchema);

const versionSchema = new mongoose.Schema({
  version: Number,
});

const Version = new mongoose.model("Version", versionSchema);

// 펀시스템 파싱 ////////////////////////////////////////////////////////////////

const funSystemURL = "https://fun.ssu.ac.kr/ko/program/all/list/all/"; // 펀시스템 파싱에 사용할 url

async function getHTML(url) {
  try {
    return await axios.get(url);
  } catch (err) {
    console.error(err);
  }
}

const Program = function (
  title,
  department,
  date,
  remainDate,
  url,
  id,
  remainLabel,
  version,
  isClosed
) {
  // 펀시스템 프로그램 정보 저장할 객체의 생성자
  this.title = title;
  this.department = department;
  this.date = date;
  this.remainDate = remainDate;
  this.url = url;
  this.id = id;
  //this.isNewProgram = false;
  this.version = version;
  this.remainLabel = remainLabel;
  this.isClosed = isClosed;
};

let newProgramList = []; // 새롭게 펀시스템에서 파싱해온 프로그램들 저장할 배열
let oldProgramList; // DB에 저장되어있던, 이전에 파싱해둔 펀시스템 프로그램들 저장할 배열

async function checkFunSystem(pageNum) {
  // 숭실대 펀시스템 파싱하는 함수
  //console.log("checkFunSystem()");

  await getHTML(funSystemURL + pageNum).then((html) => {
    // 펀시스템 pageNum번째 페이지의 HTML을 가져온다
    const $ = cheerio.load(html.data);

    $("ul.columns-4 li").each(function (index, element) {
      const remainLabel = $(element).find("label").attr("class"); // 종료 임박순 정렬을 위해 레이블 문자열 저장
      if (remainLabel === "CLOSED") {
        // 마감 생태인 프로그램을 읽었다면 그 뒤에 있는 프로그램들은 모두 마감상태이므로 더이상 읽을 필요 없음
        return false; // 파싱 종료
      }

      //const title = $(element).find(".content .title").text(); // 프로그램 제목 읽어옴
      const title = $(element).find(".content").first().find(".title").text(); // 프로그램 제목 읽어옴
      const department = $(element)
        .find(".content .department")
        .text()
        .replace(/\s/g, ""); // 부서 읽어옴
      const tmpDate = $(element).find(".content small :nth-child(2)").text(); // 날짜 읽어옴
      const date =
        tmpDate.slice(15) + " ~ " + tmpDate.slice(15, tmpDate.length); // 읽어온 날짜 사이에 물결문자 넣어서 가독성 좋게 만든다
      const remainDate = $(element).find("label").first().find("b").text(); // 디데이 읽어옴
      let url = $(element).find("a").attr("href"); // 해당 프로그램 상세 페이지 주소 읽어옴
      // 상세페이지 주소에서 id 추출한다
      let tmpId = ""; // 임시로 id 저장할 변수
      let i = 21; // url의 21번째 문자부터가 id이기 때문에 21에서 시작
      while (true) {
        const convertedNum = Number(url[i]); // 해당 문자를 숫자형으로 변환한다
        if (convertedNum >= 0 && convertedNum <= 9) {
          // 숫자로 제대로 변환됐다면 id를 구성하던 문자가 맞으므로
          tmpId += url[i];
        } else {
          // 해당 문자가 숫자로 변환되지 않았다면 url에서 id는 모두 추출해 낸 것이므로 반복 종료
          break;
        }
        ++i;
      }
      const id = Number(tmpId); // 임시로 저장해뒀던 id를 숫자형으로 변환한 한다
      url = "https://fun.ssu.ac.kr" + url;

      const newProgram = new Program(
        title,
        department,
        date,
        remainDate,
        url,
        id,
        remainLabel,
        0,
        false
      ); // 새로운 프로그램 정보 객체를 만들어 위에서 읽은 내용을 저장한다
      //console.log(newProgram);
      newProgramList.push(newProgram); // 새 프로그램 리스트에 추가한다

      if (index == 11) {
        // 펀시스템에는 한 페이지당 총 12개의 프로그램이 표시된다. 12번째(인덱스는 11) 프로그램을 확인했다면 해당 페이지는 모두 확인했으니 다음 페이지로 넘어간다.
        checkFunSystem(pageNum + 1); // 재귀호출하여 다음 페이지 확인
      }
    });
  });
}

let currentVersion = 0;
let isListChanged = false; // 프로그램 리스트가 갱신되었는지 확인하는데 사용하는 변수
function checkProgramsState(newProgramList) {
  //console.log("checkProgramsState()");
  // 새로운 프로그램 리스트를 읽어오는데 실패했다면 바로 리턴
  if (!newProgramList) return;
  if (newProgramList.length == 0) return;

  isListChanged = false;

  getOldFunPrograms().then(function (oldProgramList) {
    //  DB에서 이전에 읽어왔던 프로그램 목록을 가져온 뒤,
    insertNewPrograms(oldProgramList, newProgramList); // 새로 추가된 프로그램이 있는지 확인하고, 새로 추가된게 있다면 DB에 삽입
    deleteClosedPrograms(oldProgramList, newProgramList); // 마감된 프로그램이 있는지 확인하고, 마감된게 있다면 DB에서 삭제
    setTimeout(function () {
      // 위의 두 함수에서 프로그램 삭제/추가가 비동기적으로 이루어지므로 그 과정이 끝나기를 기다린 후 진행한다
      if (isListChanged) {
        // 프로그램 삭제 or 추가된 경우에
        // for (oldProgram of oldProgramList) {
        //   // 기존 리스트에 있던 프로그램들은 더이상 새로운 프로그램이 아니므로 isNewProgram을 false로 재설정한다
        //   if (oldProgram.isNewProgram) {
        //     for (program of newProgramList) {
        //       if (oldProgram.id == program.id) { // 기존의 리스트에 있던 프로그램이라면
        //         FunProgram.updateOne({
        //           id: program.id
        //         }, {
        //           $set: {
        //             isNewProgram: false
        //           }
        //         }, function(err) {
        //           if (err) {
        //             console.log(err);
        //             console.log("mongoose updateOne error in checkProgramsState()");
        //           }
        //         })
        //         break;
        //       }
        //     }
        //   }
        // }
        changeVersion(currentVersion);
      }
    }, 5000);
  });
}

async function getOldFunPrograms() {
  // DB에 저장되어 있던 프로그램 리스트 가져오는 함수
  //console.log("getOldFunPrograms()");
  return await FunProgram.find({ isClosed: false }, async function (
    err,
    foundFunPrograms
  ) {
    if (!err) {
      return await foundFunPrograms;
    } else {
      console.log(err);
      console.log("mongoose find error in checkProgramsState()");
    }
  });
}

async function insertNewPrograms(oldProgramList, newProgramList) {
  //console.log("insertNewProgramList()");

  if (!oldProgramList) {
    // DB에서 이전 프로그램 목록을 읽어오는데 실패했다면
    console.log("error in insertNewPrograms() - fail to read oldProgramList");
    oldProgramList = [];
  }

  newProgramList.forEach((newProgram) => {
    FunProgram.findOne({ id: newProgram.id }, function (err, foundProgram) {
      if (!err) {
        if (foundProgram) {
          // 기존에도 있던 프로그램인 경우
          if (foundProgram.isClosed == true){ // 신청 종료라고 되어있는 프로그램인 경우
            FunProgram.updateOne(
              { id: foundProgram.id },
              { $set: { isClosed: false } },
              function (err) {
                if (err) {
                  console.log(err);
                  console.log(
                    "mongoose updateOne error in insertNewPrograms()"
                  );
                }
              }
            );
            console.log("isClosed true -> false");
          }
        } else {
          // 기존에 없던 새로운 프로그램인 경우
          if (currentVersion != 0) {
            // 버전이 제대로 불러와 진 경우에만 수행
            newProgram.version = currentVersion + 1;
            const funProgram = new FunProgram(newProgram);
            funProgram.save(function (err) {
              // DB에 추가
              if (err) {
                console.log(err);
                console.log("mongoose save error in insertNewProgramList()");
              } else {
                isListChanged = true;
              }
            });
            console.log("INSERT a new program");
            console.log(newProgram);
          }
        }
      } else {
        console.log(err);
        console.log("mongoose findOne error in insertNewPrograms()");
      }
    });
  });

  // for (newProgram of newProgramList) {
  //   FunProgram.findOne({id: newProgram.id}, function(err, foundProgram){
  //     if (!err) {
  //       if (foundProgram) { // 기존에도 있던 프로그램인 경우
  //         ;
  //       } else { // 기존에 없던 새로운 프로그램인 경우
  //         if (currentVersion != 0) { // 버전이 제대로 불러와 진 경우에만 수행
  //           newProgram.version = currentVersion + 1;
  //           const funProgram = new FunProgram(newProgram);
  //           funProgram.save(function (err) {
  //             // DB에 추가
  //             if (err) {
  //               console.log(err);
  //               console.log("mongoose save error in insertNewProgramList()");
  //             } else {
  //               isListChanged = true;
  //             }
  //           });
  //           console.log("INSERT a new program");
  //           console.log(newProgram);
  //         }
  //       }
  //     } else {
  //       console.log(err);
  //       console.log("mongoose findOne error in insertNewPrograms()");
  //     }
  //   });

  // let notFoundFlag = true;
  // for (oldProgram of oldProgramList) {
  //   if (oldProgram.id == newProgram.id) {
  //     // 해당 프로그램이 이전에도 존재하던 프로그램이라면 (새로 등록된 프로그램이 아니라면)
  //     notFoundFlag = false;
  //     break; // 탐색 종료하고 다음 프로그램 검사하기 위해 break
  //   }
  // }
  // if (notFoundFlag) {
  //   // 새로 등록된 프로그램인 경우
  //   //newProgram.isNewProgram = true;
  //   if (currentVersion != 0) { // 버전이 제대로 불러와 진 경우에만 수행
  //     newProgram.version = currentVersion + 1;
  //     const funProgram = new FunProgram(newProgram);
  //     funProgram.save(function (err) {
  //       // DB에 추가
  //       if (err) {
  //         console.log(err);
  //         console.log("mongoose save error in insertNewProgramList()");
  //       } else {
  //         isListChanged = true;
  //       }
  //     });
  //     console.log("INSERT a new program");
  //     console.log(newProgram);
  //   }
  // }
  //}
}

function deleteClosedPrograms(oldProgramList, newProgramList) {
  //console.log("deleteClosedPrograms()");
  if (!oldProgramList) return false;

  for (oldProgram of oldProgramList) {
    let notFoundFlag = true;
    for (newProgram of newProgramList) {
      if (oldProgram.id == newProgram.id) {
        // 새로운 프로그램 목록에서도 동일한 프로그램이 발견됐다면
        notFoundFlag = false;
        if (isProgramModified(oldProgram, newProgram)) {
          // 남은 날짜 (remainDate/d-day)와 프로그램 진행 날짜(date)는 변경될 수 있다. 따라서 펀시스템 상에서 이 둘 중 하나가 수정되면 DB의 내용도 수정해준다
          // 하지만 이 때는 새로운 프로그램이 추가되거나, 종료된 프로그램이 있는 것이 아니므로 버전 수정은 하지 않는다.
          console.log("change date in " + oldProgram.id);
          FunProgram.updateOne(
            {
              id: oldProgram.id,
            },
            {
              $set: {
                date: newProgram.date,
                remainDate: newProgram.remainDate,
              },
            },
            function (err) {
              if (err) {
                console.log(err);
                console.log(
                  "mongoose updateOne error in deleteClosedPrograms()"
                );
              }
            }
          );
        }
        break;
      }
    }
    if (notFoundFlag) {
      // 마감된(삭제된) 프로그램이라면
      FunProgram.findOne({ id: oldProgram.id }, function (err, foundProgram) {
        if (!err) {
          if (foundProgram) {
            FunProgram.updateOne(
              { id: foundProgram.id },
              { $set: { isClosed: true } },
              function (err) {
                if (err) {
                  console.log(err);
                  console.log(
                    "mongoose updateOne error in deleteClosedPrograms()"
                  );
                } else {
                  isListChanged = true;
                }
              }
            );
          } else {
          }
        } else {
          console.log(err);
          console.log("mongoose findOne error in deleteClosedPrograms()");
        }
      });

      // FunProgram.deleteOne(
      //   {
      //     // DB에서 삭제
      //     id: oldProgram.id,
      //   },
      //   function (err) {
      //     if (err) {
      //       console.log(err);
      //       console.log("mongoose deleteOne error in checkClosedPrograms()");
      //     } else {
      //       isListChanged = true;
      //     }
      //   }
      // );
      console.log("DELETE a closed program :");
      console.log(oldProgram);
    }
  }
}

function getVersion() {
  Version.findOne({}, function (err, foundVersion) {
    if (!err) {
      if (foundVersion) {
        currentVersion = foundVersion.version;
      } else {
        // 기존에 저장된 버전이 없는경우
        currentVersion = 1;
        let version = new Version({
          version: currentVersion,
        });
        version.save(function (err) {
          if (err) {
            console.log(err);
            console.log("mongoose save error in getVersion()");
          } else {
            console.log("FIRST version : " + currentVersion);
          }
        });
      }
    } else {
      console.log(err);
      console.log("mongoose find error in getVersion()");
    }
  });
}

function changeVersion(currentVersion) {
  //console.log("changeVersion()");
  Version.updateOne(
    {
      version: currentVersion,
    },
    {
      version: currentVersion + 1,
    },
    function (err) {
      if (err) {
        console.log(err);
        console.log("mongoose updateOne error in changeVersion()");
      } else {
        console.log("UPDATE version : " + (currentVersion + 1));
      }
    }
  );
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
  try {
    newProgramList = [];
    console.log(" ");
    console.log("==============================================");
    console.log(new Date().toString());
    currentVersion = 0;
    getVersion();
    checkFunSystem(1);

    setTimeout(function () {
      checkProgramsState(newProgramList);
    }, 5000);
  } catch (exception) {
    console.log(exception);
  }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
console.log("service start");
setInterval(parseFunSystemAndUpdateDB, 60000);
