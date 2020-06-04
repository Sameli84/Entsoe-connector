"use strict";
var parser = require('fast-xml-parser');
/**
 *
 * @param {Object} body
 * @return {Object}
 */
const dataManipulation = (body) => {
    var jsonObj = parser.parse(body);
//   console.log('inside restjs parsebody', jsonObj.Publication_MarketDocument.TimeSeries.Period.Point[0])
    // console.log('inside restjs parsebody', jsonObj)
    return jsonObj.Publication_MarketDocument.TimeSeries.Period.Point;
    
};

/**
 * Expose plugin methods.
 */
module.exports = {
    name: 'siemens-navigator',
    dataManipulation
};
