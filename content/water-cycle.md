<!-- section:overview -->
## 雨水怎麼走過這棟建築

「向雨而生」是這個設計的四個方向之一：下雨時，玻璃屋頂把雨水帶到低的一端，落成一面雨簾，再收集起來沖廁所。這一頁跟著雨水走一遍：臺中一年下多少雨、屋頂接得到多少、雨水會經過哪些地方，還有哪些問題到現在沒有答案。

頁面上的水量都是概念估算，用來想像規模，不是設備的設計值。

<!-- section:rainfall -->
## 臺中一年下多少雨

依{{data:provider|text}}{{data:stationName|text}}（站號 {{data:stationNumber|text}}）{{data:statisticalPeriod|text}} 年的月平均降水量，臺中平均一年下 {{data:annualMm|millimetre}} 的雨，而且集中在一年當中的幾個月。

### 雨集中在暖季

5 月到 9 月合計 {{data:warmSeasonMm|millimetre}}，佔全年的 {{data:warmSeasonShare|percent}}。雨最多的是 {{data:wettestMonth.month|number}} 月，平均 {{data:wettestMonth.millimetres|millimetre}}。

### 冷季很少下雨

10 月到隔年 4 月合計只有 {{data:coolSeasonMm|millimetre}}。雨最少的是 {{data:driestMonth.month|number}} 月，平均 {{data:driestMonth.millimetres|millimetre}}。

### 這些數字是什麼

這是三十年的長期平均，不是任何一年實際下的雨，也不是預報。測站離學校大約 {{data:stationDistanceKm|kilometre}}，不是在游泳池現場量的。資料取自[中央氣象署的氣候月平均](https://www.cwa.gov.tw/V8/E/C/Statistics/MonthlyMean/MOD/Taiwan_precp.html)，依氣象署的[政府網站資料開放宣告](https://www.cwa.gov.tw/V8/C/information.html)註明出處使用。

<!-- section:roof -->
## 玻璃屋頂接得到多少雨

泳池上方的玻璃屋頂從正上方看是一個長方形。把每個月的雨量乘上這個長方形的面積，就是落在屋頂上的雨水。

### 怎麼算

每一毫米的雨落在一平方公尺上，剛好是一公升。屋頂從正上方看的面積是 {{data:roofAreaM2|squareMetre}}，一年 {{data:annualMm|millimetre}} 的雨落在上面，合計大約 {{data:annualVolumeM3|cubicMetre}}。

### 和泳池比一比

泳池裝滿大約是 {{data:poolVolumeM3|cubicMetre}} 的水。一年落在屋頂上的雨，大約可以裝滿 {{data:annualVolumeInPools|decimal1}} 座這樣的泳池。這只是幫助想像水量的比較：回收的雨水只用來沖廁所，不會放進泳池。

### 每個月差很多

雨最多的 {{data:wettestMonth.month|number}} 月，落在屋頂上的雨大約 {{data:wettestMonth.volumeM3|cubicMetre}}；雨最少的 {{data:driestMonth.month|number}} 月大約只有 {{data:driestMonth.volumeM3|cubicMetre}}。

### 這不是可以回收的水量

上面算的是落在屋頂上的雨水總量。實際能存下來的會比較少：剛開始下雨時比較髒的水要先排掉，雨太大時超過的部分會直接排走，儲水槽滿了也裝不下。這些要等設備設計之後才算得出來。

<!-- section:path -->
## 一滴雨的路

雨水從落到屋頂到沖進馬桶，依序經過下面八個地方。這是概念上的流程，溝槽、管線與設備的尺寸都還沒有設計。想看下雨時的樣子，可以到 [3D 頁的雨天場景](?view=3d-viewer#rain)。

### 玻璃屋頂

屋頂的坡度是 {{active:roof.pitch|degree}}，從高的一端 {{active:roof.highElevation|elevation}} 降到低的一端 {{active:roof.lowElevation|elevation}}。雨水順著玻璃流向低的一端。

### 雨簾

雨水在屋頂低的一端整排落下。雨小的時候是細細的水絲，雨大的時候連成一片水幕。它不使用泵浦，只在下雨時出現。

### 承接溝

雨簾正下方是一條封閉、可以拆下來清洗的溝，只接屋頂的水，和地面的水分開，孩童接觸不到溝內。

### 濾網

先擋下落葉和比較大的雜物。

### 初雨分流

剛開始下雨時，屋頂上的灰塵會被第一批雨水沖下來。這一段比較髒的水先排掉，不收集。

### 沉砂與過濾

讓細小的泥沙沉到底部，再過濾一次。

### 加蓋儲水槽

處理過的雨水存進加蓋的儲水槽。容量還沒有計算。

### 一樓廁所

儲水槽的水走一條獨立、有標示的管線，只用來沖洗一樓的廁所。

<!-- section:seasons -->
## 雨太多和雨太少的時候

暖季五個月落在屋頂上的雨大約 {{data:warmSeasonVolumeM3|cubicMetre}}，冷季七個月合計大約 {{data:coolSeasonVolumeM3|cubicMetre}}。同一套系統要同時面對這兩種情況。

### 雨太大的時候

雨量超過系統能處理的量時，多出來的水改走另一條位置比較高的溢流路線，不經過儲水槽，直接排到基地的排水或滲進土裡。實際的排法還要專業確認。

### 很久沒下雨的時候

儲水槽空了，廁所就改用自來水沖洗。自來水補進來的地方要和雨水隔開，雨水才不會倒流進自來水管。

### 晴天沒有雨簾

雨簾是真的雨，晴天時不會用泵浦把水打上屋頂做出水景。

<!-- section:open -->
## 還沒有答案的問題

下面這些問題需要水電與建築的專業來回答，在公開的[待決事項](https://github.com/kuohappiness/Swimming-Pool-Design/blob/main/docs/backlog.md)裡的編號是 OPEN-014。

### 儲水槽要多大

要先知道廁所一天用多少水、想撐過多長的乾季，才能決定容量。這兩件事現在都沒有數字。

### 廁所一天用多少水

要看使用的人數、馬桶的型式和一年開放的天數，目前沒有資料。

### 雨簾在不同雨量下的樣子

多大的雨才會連成水幕、暴雨時水會不會濺出承接溝，要靠屋頂低端的均壓槽和承接溝的尺寸來回答。

### 水質與維護

回收的雨水要處理到什麼程度，濾網和儲水槽多久清洗一次、由誰負責。

### 排水與核准

溢流的水最後排到哪裡，需要哪些單位核准。
