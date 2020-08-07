# Soongsil_Fun_System_Notification_Service
숭실대 펀시스템( https://fun.ssu.ac.kr )에 새로운 프로그램이 등록되면 알림해주는 서비스이다.


## API 사용법

* GET /version
  * DB에 저장된 프로그램 리스트의 버전을 가져온다. 버전은 양의 정수로 표시, 값이 클 수록 최신 버전이다. 버전에 대한 자세한 설명은 Parsing Application 설명 참고.

* GET /programs
  * DB에 저장된 프로그램 리스트를 마감일 임박순으로 정렬하여 가져온다.
  
  * 프로그램 정보는 다음과 같이 이루어져 있다.
    1. _id(mongodb id)
    2. title(프로그램 제목)
    3. department(주관 부서)
    4. date(진행 날짜)
    5. remainDate(신청 마감 기간)
    6. url(상세 정보 페이지 주소)
    7. id(프로그램의 id)
    8. version(프로그램 등록 당시의 리스트 버전)
    9. remainLabel(신청 마감 기간에 따른 레이블)
    10. length(remainLabel의 길이, 마감일 임박순 정렬에 사용)

API 사용 시 무작정 "GET /programs"로 프로그램을 가져오지 말고, "GET /version"을 이용해 프로그램 리스트의 버전을 먼저 가져온다. 그 후 기존에 갖고 있던 리스트의 버전과 비교하여 업데이트가 이루어졌다면(API로 가져온 버전 > 갖고있던 버전) 프로그램 리스트를 가져오도록 해야 한다.

## Parsing Application
숭실대 펀시스템을 1분마다 파싱하여, 신청 가능한 프로그램을 찾아내고, 프로그램 리스트를 만들어 DB서버에 저장하는 어플리케이션이다. 프로그램이 추가/삭제 될 때마다 DB의 리스트를 갱신한다. 새로운 리스트로 갱신 될 때마다 버전을 1씩 올리고, 갱신된 버전을 DB서버에 저장한다.
