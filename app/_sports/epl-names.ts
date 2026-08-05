// FotMob 영문 이름 → 한글 표기. FotMob 은 영문만 주고, 네이버는 가나다순 500명에서 잘려
// 상위권 선수 일부(콜 파머, 비르츠, 후벵 디아스 등)의 한글 이름을 아예 얻을 수 없다.
// 그래서 네이버에서 긁을 수 있는 만큼 긁고(165명) 나머지 68명은 직접 적었다.
// 여기 없는 이름은 영문 그대로 카드에 나온다. 시즌이 바뀌면 새 선수만 추가하면 된다.

export const KOREAN_NAME: Record<string, string> = {
  "Aaron Wan-Bissaka": "아론 완-비사카",
  "Adam Wharton": "아담 워튼",
  "Adrien Truffert": "아드리앙 트뤼페르",
  "Alex Iwobi": "알렉스 이워비",
  "Álex Jiménez": "알렉스 히메네스",
  "Alex Scott": "알렉스 스콧",
  "Alexis Mac Allister": "알렉시스 맥 알리스터",
  "Alisson Becker": "알리송 베케르",
  "Alphonse Areola": "알폰스 아레올라",
  "Amad Diallo": "아마드 디알로", // 네이버에 없어 직접 적었다
  "Amadou Onana": "아마두 오나나",
  "André": "안드레",
  "Anthony Gordon": "앤서니 고든",
  "Antoine Semenyo": "앙투안 세메뇨",
  "Anton Stach": "안톤 슈타흐",
  "Bart Verbruggen": "바르트 페르브뤼헌",
  "Benjamin Sesko": "베냐민 셰슈코",
  "Bernardo Silva": "베르나르도 실바",
  "Bernd Leno": "베른트 레노",
  "Beto": "베투",
  "Brenden Aaronson": "브렌든 애런슨",
  "Brennan Johnson": "브레넌 존슨",
  "Brian Brobbey": "브라이언 브로베이",
  "Bruno Fernandes": "브루노 페르난데스",
  "Bruno Guimarães": "브루노 기마랑이스",
  "Bryan Mbeumo": "브라이언 음뵈모",
  "Bukayo Saka": "부카요 사카",
  "Callum Hudson-Odoi": "캘럼 허드슨-오도이", // 네이버에 없어 직접 적었다
  "Calvin Bassey": "칼빈 배시", // 네이버에 없어 직접 적었다
  "Caoimhín Kelleher": "카오이민 켈러허", // 네이버에 없어 직접 적었다
  "Carlos Baleba": "카를로스 발레바", // 네이버에 없어 직접 적었다
  "Casemiro": "카세미루", // 네이버에 없어 직접 적었다
  "Chemsdine Talbi": "셈스딘 탈비", // 네이버에 없어 직접 적었다
  "Chris Richards": "크리스 리처즈", // 네이버에 없어 직접 적었다
  "Cody Gakpo": "코디 학포", // 네이버에 없어 직접 적었다
  "Cole Palmer": "콜 파머", // 네이버에 없어 직접 적었다
  "Cristian Romero": "크리스티안 로메로", // 네이버에 없어 직접 적었다
  "Crysencio Summerville": "크리센시오 서머빌", // 네이버에 없어 직접 적었다
  "Curtis Jones": "커티스 존스", // 네이버에 없어 직접 적었다
  "Daichi Kamada": "카마다 다이치", // 네이버에 없어 직접 적었다
  "Dango Ouattara": "단고 와타라",
  "Daniel Ballard": "댄 발라드",
  "Daniel Burn": "댄 번",
  "Daniel Muñoz": "다니엘 무뇨스",
  "Danny Welbeck": "대니 웰백",
  "David Raya": "다비드 라야",
  "Dean Henderson": "딘 헨더슨",
  "Declan Rice": "데클란 라이스",
  "Diego Gómez": "디에고 고메스",
  "Diogo Dalot": "디오고 달로트",
  "Djed Spence": "제드 스펜스",
  "Djordje Petrovic": "디오르지 페트로비치",
  "Dominic Calvert-Lewin": "도미니크 칼버트-르윈",
  "Dominik Szoboszlai": "도미니크 소보슬러이",
  "Eberechi Eze": "에베레치 에제",
  "Elliot Anderson": "엘리엇 앤더슨",
  "Emile Smith Rowe": "에밀 스미스 로우",
  "Emiliano Buendía": "에밀리아노 부엔디아",
  "Emiliano Martínez": "에밀리아노 마르티네스",
  "Enzo Fernández": "엔소 페르난데스",
  "Enzo Le Fée": "엔초 르 페",
  "Erling Haaland": "엘링 홀란",
  "Ethan Ampadu": "이선 암파두",
  "Evanilson": "에바니우송",
  "Ezri Konsa": "에즈리 콘사",
  "Ferdi Kadioglu": "페르디 카드올루", // 네이버에 없어 직접 적었다
  "Florentino": "플로렌티누", // 네이버에 없어 직접 적었다
  "Florian Wirtz": "플로리안 비르츠", // 네이버에 없어 직접 적었다
  "Gabriel": "가브리엘 마갈량이스", // 네이버에 없어 직접 적었다
  "Gabriel Gudmundsson": "가브리엘 구드문드손",
  "Georginio Rutter": "조르지니오 뤼테르", // 네이버에 없어 직접 적었다
  "Gianluigi Donnarumma": "잔루이지 돈나룸마",
  "Granit Xhaka": "그라니트 자카",
  "Guglielmo Vicario": "굴리엘모 비카리오", // 네이버에 없어 직접 적었다
  "Harry Maguire": "해리 매과이어", // 네이버에 없어 직접 적었다
  "Harry Wilson": "해리 윌슨", // 네이버에 없어 직접 적었다
  "Harvey Barnes": "하비 반스", // 네이버에 없어 직접 적었다
  "Hugo Bueno": "우고 부에노", // 네이버에 없어 직접 적었다
  "Hugo Ekitiké": "우고 에키티케",
  "Ian Maatsen": "이안 마트센",
  "Ibrahim Sangaré": "이브라힘 상가레",
  "Ibrahima Konaté": "이브라히마 코나테",
  "Idrissa Gana Gueye": "이드리사 게예",
  "Igor Jesus": "이고르 제수스",
  "Igor Thiago": "이고르 치아구",
  "Iliman Ndiaye": "일리만 은디아예",
  "Ismaïla Sarr": "이스마일라 사르",
  "Jack Grealish": "잭 그릴리쉬",
  "Jack Hinshelwood": "잭 하인셀우드",
  "Jackson Tchatchoua": "잭슨 차추아",
  "Jacob Murphy": "제이콥 머피",
  "Jaidon Anthony": "제이돈 앤서니",
  "Jaka Bijol": "야카 비욜",
  "Jake O'Brien": "제이크 오브라이언", // 네이버에 없어 직접 적었다
  "James Garner": "제임스 가너",
  "James Hill": "제임스 힐",
  "James Justin": "제임스 저스틴",
  "James Tarkowski": "제임스 타코우스키",
  "Jan Paul van Hecke": "얀 폴 반 헤케",
  "Jarrod Bowen": "제로드 보웬",
  "Jayden Bogle": "제이든 보글",
  "Jean-Clair Todibo": "장클레르 토디보",
  "Jean-Philippe Mateta": "장-필리프 마테타",
  "Jefferson Lerma": "제퍼슨 레르마",
  "Jérémy Doku": "제레미 도쿠",
  "Joachim Andersen": "요아힘 안데르센",
  "João Gomes": "주앙 고메스", // 네이버에 없어 직접 적었다
  "João Palhinha": "주앙 팔리냐", // 네이버에 없어 직접 적었다
  "João Pedro": "주앙 페드루", // 네이버에 없어 직접 적었다
  "Joe Rodon": "조 로던", // 네이버에 없어 직접 적었다
  "Joelinton": "조엘린톤", // 네이버에 없어 직접 적었다
  "John McGinn": "존 맥긴", // 네이버에 없어 직접 적었다
  "Jordan Henderson": "조던 헨더슨",
  "Jordan Pickford": "조던 픽포드",
  "Jørgen Strand Larsen": "야콥 브룬 라르센",
  "José Sá": "조제 사", // 네이버에 없어 직접 적었다
  "Josh Laurent": "조시 로랑", // 네이버에 없어 직접 적었다
  "Junior Kroupi": "주니오르 크루피", // 네이버에 없어 직접 적었다
  "Jurriën Timber": "위리엔 팀버르",
  "Kaoru Mitoma": "미토마 가오루", // 네이버에 없어 직접 적었다
  "Karl Darlow": "칼 달로우", // 네이버에 없어 직접 적었다
  "Keane Lewis-Potter": "킨 루이스-포터", // 네이버에 없어 직접 적었다
  "Kenny Tete": "케니 테테", // 네이버에 없어 직접 적었다
  "Kevin Schade": "케빈 샤데", // 네이버에 없어 직접 적었다
  "Kieran Trippier": "키어런 트리피어", // 네이버에 없어 직접 적었다
  "Kiernan Dewsbury-Hall": "키어넌 듀스버리-홀", // 네이버에 없어 직접 적었다
  "Kobbie Mainoo": "코비 마이누", // 네이버에 없어 직접 적었다
  "Konstantinos Mavropanos": "콘스탄티노스 마브로파노스", // 네이버에 없어 직접 적었다
  "Kristoffer Ajer": "크리스토페르 아예르", // 네이버에 없어 직접 적었다
  "Kyle Walker": "카일 워커", // 네이버에 없어 직접 적었다
  "Ladislav Krejcí": "라디슬라프 크레이치",
  "Leandro Trossard": "레안드로 트로사르",
  "Leny Yoro": "레니 요로",
  "Lesley Ugochukwu": "레슬리 우고추쿠",
  "Lewis Dunk": "루이스 덩크",
  "Lewis Hall": "루이스 홀",
  "Lucas Digne": "뤼카 디뉴",
  "Luke Shaw": "루크 쇼",
  "Lutsharel Geertruida": "루트샤렐 헤르트루이다",
  "Malick Diouf": "말리크 디우프", // 네이버에 없어 직접 적었다
  "Malick Thiaw": "말릭 티아우",
  "Malo Gusto": "말로 귀스토",
  "Marc Cucurella": "마르크 쿠쿠레야",
  "Marc Guéhi": "마크 게히",
  "Marcos Senesi": "마르코스 세네시",
  "Marcus Tavernier": "마르쿠스 태버니어",
  "Martin Dúbravka": "마르틴 두브라프카",
  "Martín Zubimendi": "마르틴 수비멘디",
  "Mateus Fernandes": "마테우스 페르난데스",
  "Mateus Mané": "마테우스 Mané",
  "Matheus Cunha": "마테우스 쿠냐",
  "Matheus Nunes": "마테우스 누네스",
  "Mathias Jensen": "마티아스 옌센",
  "Mats Wieffer": "마츠 위버",
  "Matty Cash": "매티 캐쉬",
  "Matz Sels": "마츠 셀스",
  "Maxence Lacroix": "막상스 라크루아",
  "Maxime Estève": "막심 에스테베",
  "Michael Kayode": "마이클 카요데",
  "Michael Keane": "마이클 킨",
  "Micky van de Ven": "미키 판 더 펜",
  "Mikkel Damsgaard": "미켈 담스가르",
  "Milos Kerkez": "밀로스 케르케즈",
  "Mohamed Salah": "모하메드 살라",
  "Mohammed Kudus": "모하메드 쿠두스",
  "Moisés Caicedo": "모이세스 카이세도",
  "Morgan Gibbs-White": "모건 깁스-화이트",
  "Morgan Rogers": "모건 로저스",
  "Murillo": "무리요",
  "Nathan Collins": "네이선 콜린스",
  "Neco Williams": "네코 윌리엄스",
  "Nick Pope": "닉 포프",
  "Nick Woltemade": "닉 볼테마데",
  "Nico González": "니코 곤살레스",
  "Nico O'Reilly": "니코 오라일리", // 네이버에 없어 직접 적었다
  "Nikola Milenkovic": "니콜라 밀렌코비치",
  "Noah Okafor": "노아 오카포르",
  "Noah Sadiki": "노아 사디키",
  "Nordi Mukiele": "노르디 무키엘",
  "Ollie Watkins": "올리 왓킨스",
  "Omar Alderete": "오마르 알데레테",
  "Omari Hutchinson": "오마리 허치슨",
  "Pascal Groß": "파스칼 그로스", // 네이버에 없어 직접 적었다
  "Pascal Struijk": "파스칼 스트라위크", // 네이버에 없어 직접 적었다
  "Pau Torres": "파우 토레스", // 네이버에 없어 직접 적었다
  "Pedro Neto": "페드로 네투", // 네이버에 없어 직접 적었다
  "Pedro Porro": "페드로 포로", // 네이버에 없어 직접 적었다
  "Phil Foden": "필 포든", // 네이버에 없어 직접 적었다
  "Piero Hincapié": "피에로 인카피에", // 네이버에 없어 직접 적었다
  "Quilindschy Hartman": "퀼린치 하르트만", // 네이버에 없어 직접 적었다
  "Randal Kolo Muani": "랑달 콜로 무아니",
  "Raul Jiménez": "라울 히메네스",
  "Rayan Cherki": "라얀 셰르키",
  "Reece James": "리스 제임스",
  "Reinildo": "헤이닐두", // 네이버에 없어 직접 적었다
  "Riccardo Calafiori": "리카르도 칼라피오리",
  "Richarlison": "히샬리송", // 네이버에 없어 직접 적었다
  "Robert Sánchez": "로베르트 산체스",
  "Robin Roefs": "로빈 루에프스",
  "Rodri": "로드리",
  "Rodrigo Bentancur": "로드리고 벤탄쿠르",
  "Rúben Dias": "후벵 디아스", // 네이버에 없어 직접 적었다
  "Ryan Gravenberch": "라이언 흐라벤베르흐",
  "Ryan Sessegnon": "라이언 세세뇽",
  "Sander Berge": "산데르 베르게",
  "Sandro Tonali": "산드로 토날리",
  "Santiago Bueno": "산티아고 부에노",
  "Sasa Lukic": "사샤 루키치",
  "Senne Lammens": "세네 라멘스",
  "Sepp van den Berg": "세프 판 덴 베르흐",
  "Sven Botman": "스벤 보트만",
  "Thierno Barry": "티에르노 바리", // 네이버에 없어 직접 적었다
  "Tijjani Reijnders": "티자니 레인더스", // 네이버에 없어 직접 적었다
  "Timothy Castagne": "티모시 카스타뉴", // 네이버에 없어 직접 적었다
  "Tomás Soucek": "토마시 소우체크", // 네이버에 없어 직접 적었다
  "Trai Hume": "트라이 흄", // 네이버에 없어 직접 적었다
  "Trevoh Chalobah": "트레보 찰로바", // 네이버에 없어 직접 적었다
  "Tyler Adams": "타일러 아담스", // 네이버에 없어 직접 적었다
  "Tyrick Mitchell": "타이릭 미첼", // 네이버에 없어 직접 적었다
  "Viktor Gyökeres": "빅토르 요케레스",
  "Virgil van Dijk": "버질 반 다이크",
  "Vitaliy Mykolenko": "비탈리 미콜렌코",
  "Wesley Fofana": "웨슬리 포파나",
  "Will Hughes": "윌 휴즈",
  "William Saliba": "윌리엄 살리바",
  "Xavi Simons": "자비 시몬스",
  "Yankuba Minteh": "얀쿠바 민테",
  "Yasin Ayari": "야신 아야리",
  "Yehor Yarmoliuk": "에고르 야르몰류크",
  "Yéremi Pino": "예레미 피노",
  "Yerson Mosquera": "예르손 모스케라", // 네이버에 없어 직접 적었다
  "Youri Tielemans": "유리 틸레만스",
  "Zian Flemming": "지안 플레밍", // 네이버에 없어 직접 적었다
};
