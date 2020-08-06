# Soongsil_Fun_System_Notification_Service
숭실대 펀시스템( https://fun.ssu.ac.kr )에 새로운 프로그램이 등록되면 알림해주는 서비스이다.


API 사용법

* GET /version
* * DB에 저장된 프로그램 리스트의 버전을 가져온다. 버전은 양의 정수로 표시, 값이 클 수록 최신 버전이다. 버전에 대한 자세한 설명은 Parsing Application 설명 참고.

* GET /programs
* * DB에 저장된 프로그램 리스트를 마감일 임박순으로 정렬하여 가져온다. 프로그램 정보는 _id(mongodb id), title(프로그램 제목), department(주관 부서), date(진행 날짜), remainDate(신청 마감 기간), url(상세 정보 페이지 주소), id(프로그램의 id), isNewProgram(true이면 새로 등록된 프로그램), remainLabel(신청 마감 기간에 따른 레이블), length(remainLabel의 길이, 마감일 임박순 정렬에 사용) 로 이루어져 있다.


Parsing Application
* 숭실대 펀시스템을 1분마다 파싱하여, 신청 가능한 프로그램을 찾아내고, 프로그램 리스트를 만들어 DB서버에 저장하는 어플리케이션이다. 프로그램이 추가/삭제 될 때마다 DB의 리스트를 갱신한다. 새로운 리스트로 갱신 될 때마다 버전을 1씩 올리고, 갱신된 버전을 DB서버에 저장한다.
