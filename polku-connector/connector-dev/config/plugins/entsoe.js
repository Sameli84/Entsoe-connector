"use strict";
var parser = require('fast-xml-parser');
var parseString = require('xml2js').parseString;

/**
 *
 * @param {Object} body
 * @return {Object}
 */
const dataManipulation = (body) => {
    let xml = body
    xml = xml.replace(/\.(?=[^<>]*>)/g, '')
    console.log('xml text', xml)
    var jsonObj = parser.parse(xml);
    console.log('inside entsoe.js plugin dataManipulation', jsonObj.Publication_MarketDocument.TimeSeries.Period.Point)
    // console.log('inside restjs parsebody', jsonObj.Publication_MarketDocument.TimeSeries.Period.Point[0])
    // console.log('inside restjs parsebody', jsonObj.Publication_MarketDocument.TimeSeries)
    return jsonObj.Publication_MarketDocument.TimeSeries.Period.Point;
};

/**
 * Expose plugin methods.
 */
module.exports = {
    name: 'siemens-navigator',
    dataManipulation
};
