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

const finalize = async (config, mergedData) => {
  try {
      return mergedData;
  } catch (e) {
      return mergedData;
  }
};

const data = async (config, data) => {
    let output = {};
    
    try {
        //SAMPSA: Jos dataa useammalla päivältä, laitetaan ne samaan listaan.
        if (Array.isArray(data.ForecastElectricityPriceMWH.TimeSeries)) {

          let totSer = data.ForecastElectricityPriceMWH.TimeSeries[0].Period.Point

          for (let index = 1; index < data.ForecastElectricityPriceMWH.TimeSeries.length; index++) {

            let tSer = data.ForecastElectricityPriceMWH.TimeSeries[index].Period.Point

            tSer.forEach(element => {
              element.position = element.position + 24*index
            });
  
            totSer = totSer.concat(tSer)
            
          }

          data.ForecastElectricityPriceMWH.TimeSeries[0].Period.Point = totSer

          data.ForecastElectricityPriceMWH.TimeSeries = data.ForecastElectricityPriceMWH.TimeSeries[0]
        }


        //SAMPSA: Rajataan data vastaamaan post-pyyntöä

        let postStart = new Date(config.parameters.period.split("/")[0])
        let postEnd = new Date(config.parameters.period.split("/")[1])
        let dataStart = new Date(data.ForecastElectricityPriceMWH.periodtimeInterval.start)
        let dataEnd = new Date(data.ForecastElectricityPriceMWH.periodtimeInterval.end)

        if(postStart > dataStart) {
          let beginningIndex = Math.abs(postStart - dataStart) / 36e5
          data.ForecastElectricityPriceMWH.TimeSeries.Period.Point = data.ForecastElectricityPriceMWH.TimeSeries.Period.Point.slice(beginningIndex)
        }

        if(postEnd < dataEnd) {
          let endingIndex = Math.abs(dataEnd - postEnd) / 36e5
          for (let index = 0; index < endingIndex; index++) {
            data.ForecastElectricityPriceMWH.TimeSeries.Period.Point.pop()            
          }
        }

        output['ForecastElectricityPriceMWH'] = data.ForecastElectricityPriceMWH.TimeSeries.Period.Point.map((p) => {
          //SAMPSA: Täällä muutetaan 'kauniisti' toi period ontologiassa tilattuun muotoon, voin siivoilla huomenna tän johki funktioon.
          let art = new Date(data.ForecastElectricityPriceMWH.TimeSeries.Period.timeInterval.start)
          art = addHours(art, p.position-1)
          let periodStart = art.toISOString()
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
    data,
    finalize
};