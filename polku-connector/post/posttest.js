const unirest = require("unirest");

const headers = {
  "X-Pot-Signature": "a",
  "X-App-Token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzY29wZSI6bnVsbCwiZXhwIjoxNTkwNTYxMDA2LCJpZCI6IjlmYzZhMDNiLTkwYWItNGRmZi05NGZkLWE5NDk1N2NjOTc1NyIsInN1YiI6ImVmN2ZkZDEwLWJiN2ItNDNmZi04OTgzLTYyMDQ2MzkwMWYzOSIsImF1ZCI6ImY3NzNkYWZlLTIwYzAtNGEyNS1hYTNlLTlkYTBiODFiOTMwNCIsInR5cGUiOiJVc2VyIiwiaXNzIjoiUG9ULXNhbmRib3giLCJpYXQiOjE1OTA0NzQ2MDYuMCwic2NvcGVzIjoiIn0.VRNF0jwkRrP32jPiGZwYmY6g5yA45j5DAguwwmNaGbAsSixhxhNo1IRQt_2Ka5RWPeVBojkPQyc_JCkoqZnGmsYEwjuiI7mT63KdUuzo4-RmarWvFA45pQpuDYAwRWHCT6IB8aSiqm-nTI2D6A12c2jwYN2tQS5yMltxSIcc3G9daZJq9fQ2lZPjtwbzzghN71GRglGGMox2GbEPyCM-WvzJ-9muhFra9sfOBzyHyvumCResPE_cYcwlqov6deNlGPIlCekO7FeuRv8ObPYuNTVrGL029ayic3BTIQNqj_Qqv9tqCsWD-lur93-N217MA57A7dzqOPOwtvWgxHjqSG_MOiiaDXRQ_9zIJ8zw8UU58YVQjeHphbr3rRP2-mvzPCSXM3kUX00kktrZrZ8eaeDnIBw2JA_ZOWHUmNctGWltURhRxLXINkQNnip56Y_0XrULs09kvOS0yEROOD93PV_8DPaOXVTPLIgnPrV8UsgywjwOH7AiqL5e6CYW8ESG1nxeTxYskKVlvfw1J4NADIMnGu0osst9PjsZKSK8khoZCggE27xPWfjI1EfXHYiDW_Q8e8B9tuY8SWeVqOt6yKbBUEKCcS8yqR-zAwaifk0owXfRSKrA_BP-yg7Dqeq45o3zAzzJx9O1pMxXOu_YsSyYd7TICW58taK9hWIW27I",
  "Content-Type": "application/json"
};

//SAMPSA: Laitoin tänne ton periodin (josta en oikeestaan tajuu miten se toimii,
//mutta jotenki templaatissa ja entsoen datassa olevan timeIntervalin kautta sen hakee), ja sit ton tilatun targetObjectin.
body = {
  "@context": "https://standards-ontotest.oftrust.net/v2/Context/DataProductParameters/Forecast/Price/Electricity/",
  "timestamp": "2020-05-25T13:02:13.142Z",
  "productCode": "entsoe",
  "parameters": {
    "period": "2020-06-16T00:00Z/2021-01-01T01:00Z",
    "targetObject": "10YCZ-CEPS-----N"
  }
}

unirest
  .post("http://localhost:8080/translator/v1/fetch")
  .headers(headers)
  .send(body)
  .then(({ raw_body, status, code }) => {
    console.log(JSON.stringify({ raw_body, status, code }, null, 4));
  });