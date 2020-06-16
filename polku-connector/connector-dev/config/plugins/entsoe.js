"use strict";
var parser = require('fast-xml-parser');
const response = async (config, response) => {
    try {
        // Remove dots from xml response < > tags
        response = parser.parse(response.body.replace(/\.(?=[^<>]*>)/g, ''));
        return response;
    } catch (e) {
        return response;
    }
};
const data = async (config, data) => {
    let output = {};

    try {
        output['ForecastElectricityPriceMWH'] = data.ForecastElectricityPriceMWH.TimeSeries.Period.Point.map((p) => {
          //SAMPSA: Täällä muutetaan 'kauniisti' toi period ontologiassa tilattuun muotoon, voin siivoilla huomenna tän johki funktioon.
          let art = new Date(data.ForecastElectricityPriceMWH.TimeSeries.Period.timeInterval.start)
          art = addHours(art, p.position-1)
          console.log(art)
          let periodStart = art.toISOString()
          console.log(periodStart)
          periodStart = periodStart.split("T")[0]
          periodStart = periodStart.replace(/-/g, ".")
          periodStart = periodStart.split(".")[2] + "." + periodStart.split(".")[1] + "." + periodStart.split(".")[0] + "T"
          periodStart = periodStart + art.toISOString().split("T")[1].split(":")[0]
          return {
                '@type': "PricePlan",
                currency: data.ForecastElectricityPriceMWH.TimeSeries.currency_Unitname,
                period:  periodStart + '/1h',
                rate: p.priceamount
            }
        });
        return output;
    } catch (e) {
        return data;
    }
};

  //SAMPSA: funktio, joka lisää tunnin päivämäärään nätisti.
  function addHours(time, h) {
  time.setTime(time.getTime() + (h*60*60*1000));
  return time;
}
/**
 * Expose plugin methods.
 */
module.exports = {
    name: 'entsoe',
    response,
    data
};