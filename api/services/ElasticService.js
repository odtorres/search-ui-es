/**
 * Elastic Service
 *
 * @description :: Service logic for managing elasticsearch endpoint
 */
let elasticsearch = require('elasticsearch')
let moment = require('moment')

let esClient = new elasticsearch.Client({
    host: '127.0.0.1:9200',
    log: 'error'
})

/** Check Indices */
const indices = function indices(done) {
    return esClient.cat.indices({ v: true })
        .then(results => {
            done(results.split("\n"))
        }).catch(error => {
            done(error.msg)
        })
}

/**
 * Bulk to specific index and type
 * 
 * */
const bulkIndex = function bulkIndex(index = 'website', type = 'general', data) {
    let bulkBody = []
    data.forEach(item => {

        bulkBody.push({
            index: {
                _index: index,
                _type: type,
            }
        })

        bulkBody.push(item);
    })

    esClient.bulk({ body: bulkBody }).then(response => {
        sails.log('Elastic Service bulk operatio:')
        let errorCount = 0;
        response.items.forEach(item => {
            if (item.index && item.index.error) {
                sails.log(++errorCount, item.index.error);
            }
        })
        sails.log(`Successfully indexed ${data.length - errorCount} out of ${data.length} items`)
    }).catch(sails.log)
}

/**Check if the site exist in elastic*/
const isSiteAvailable = function isSiteAvailable(url, done) {
    let body = {
        size: 20,
        from: 0,
        query: {
            match: {
                url: {
                    query: url,
                    type: "phrase"
                }
            }
        },
        _source: ["url"]
    }

    esClient.search({ body: body }).then(results => {
        sails.log(`found ${results.hits.total} items in ${results.took}ms`)
        done(results.hits.total >= 1)
    }).catch(error => {
        done(error.msg)
    })
}

/**Check if the index exist in elastic*/
const isMappingAvailable = function isMappingAvailable(options, done) {
    esClient.indices.getMapping({
        index: options.index,
        type: options.type
    }, (error, results) => {
        if (error) { sails.log("Error isMappingAvailable: ", error) }
        done(results.error == null)
    })
}

/** Configure Mapping */
const configureMappings = function (options, done) {
    let mappingQuery = {
        index: options.index,
        type: options.type,
        body: {
            "properties": {
                "date_published": { "type": "date", "format": "MM-dd-yyyy" },
                "suggest": { "type": "completion" }
            }
        }
    }
    esClient.indices.putMapping(mappingQuery, (result) => {
        done(result)
    })
}

const prepareMappings = function (options, done) {
    esClient.indices.exists({ index: options.index }, (error, results) => {
        if (!results) {
            esClient.indices.create({ index: options.index }, (error, results) => {
                sails.log(results)
                isMappingAvailable(options, (result) => {
                    configureMappings(options, (result) => {
                        done(result)
                    })
                })
            })
        } else {
            isMappingAvailable(options, (result) => {
                sails.log("there is a map: ", result)
                if (!result) {
                    configureMappings(options, (result) => {
                        done(result)
                    })
                } else {
                    done()
                }
            })
        }
    })
}

/**
 * 
 */
const buildSearch = function buildSearch(options, done) {
    let allFields = ['keywords', 'resourceName', 'Author', 'Title', 'LinkFilename', 'content']
    let linksFields = ['links', 'content', 'url']
    let searchQuery = {
        body: {
            query: {
                bool: {
                    should: [],
                    must: [],
                    must_not: []

                }
            }
        }
    }
    //generals
    if (options.index) {
        searchQuery.index = options.index
    }
    if (options.type) {
        searchQuery.type = options.type
    }
    if (options.num) {
        searchQuery.size = options.num
    }
    if (options.start) {
        searchQuery.from = options.start
    }
    if (options.sort) {
        let sortParam = options.sort.split(":")
        if (sortParam.length == 2 && (sortParam[1] == "asc" || sortParam[1] == "desc")) {
            searchQuery.sort = options.sort
        }
    }
    // query
    if (options.q && !options.hq && !options.orTerms) {
        searchQuery.body.query.bool.should.push({
            multi_match: {
                query: options.q,
                fields: allFields
            }
        })
    }
    // query_string
    if (options.query_string) {//http://localhost:1337/search?index=website&query_string=john%20OR%20web
        searchQuery.body.query.bool.must.push({
            "query_string": {
                "fields": allFields,
                "query": options.query_string
            }
        })
    }
    // AND
    if (options.hq && options.q) {//http://localhost:1337/search?index=website&query_string=john%20OR%20web
        searchQuery.body.query.bool.must.push({
            "query_string": {
                "fields": allFields,
                "query": options.q + " AND " + options.hq
            }
        })
    }
    // or
    if (options.orTerms && options.q) {//http://localhost:1337/search?index=website&query_string=john%20OR%20web
        searchQuery.body.query.bool.must.push({
            "query_string": {
                "fields": allFields,
                "query": options.q + " OR " + options.orTerms
            }
        })
    }
    // terms
    if (options.exactTerms) {
        searchQuery.body.query.bool.should.push({
            multi_match: {
                query: options.exactTerms,
                fields: allFields,
                type: 'phrase'
            }
        })
    }
    if (options.excludeTerms) {
        searchQuery.body.query.bool.must_not.push({
            multi_match: {
                query: options.excludeTerms,
                fields: allFields,
                type: 'phrase'
            }
        })
    }
    //Sites
    if (options.linkSite) {
        searchQuery.body.query.bool.should.push({
            match: {
                links: {
                    query: options.linkSite
                }
            }
        })
    }
    if (options.relatedSite) {
        searchQuery.body.query.bool.should.push({
            multi_match: {
                query: options.relatedSite,
                fields: linksFields,
                type: 'phrase'
            }
        })
    }
    if (options.siteSearch) {
        if (options.siteSearchFilter == null || options.siteSearchFilter != "e") {
            options.siteSearch.split(",").forEach((e, i, a) => {
                searchQuery.body.query.bool.should.push({
                    match: {
                        url: {
                            query: e,
                            type: 'phrase'
                        }
                    }
                })
            })
        } else if (options.siteSearchFilter == "e") {
            options.siteSearch.split(",").forEach((e, i, a) => {
                searchQuery.body.query.bool.must_not.push({
                    match: {
                        url: {
                            query: e,
                            type: 'phrase'
                        }
                    }
                })
            })
        }
    }
    // filters
    if (options.dateRestrict) {
        let dateToFilter = ""
        let number = options.dateRestrict.substring(1, options.dateRestrict.length)
        switch (options.dateRestrict.charAt(0)) {
            case "d":
                dateToFilter = moment().subtract(number, 'days').format("MM-DD-YYYY")
                break
            case "w":
                dateToFilter = moment().subtract(number, 'weeks').format("MM-DD-YYYY")
                break
            case "m":
                dateToFilter = moment().subtract(number, 'months').format("MM-DD-YYYY")
                break
            case "y":
                dateToFilter = moment().subtract(number, 'years').format("MM-DD-YYYY")
                break
            default:
                dateToFilter = moment().subtract(1, 'years').format("MM-DD-YYYY")
                break
        }

        sails.log("Filter dates: ", dateToFilter, " ", number)

        searchQuery.body.query.bool.filter = [{
            range: {
                date_published: {
                    gte: dateToFilter/*2011,
                        lte: 2015*/
                }
            }
        }
        ]
    }
    esClient.search(searchQuery).then(async (results) => {
        sails.log(`found ${results.hits.total} items in ${results.took}ms`);
        let response = {}
        /*response.items = await results.hits.hits.map(e => {
            return {
                "title": e._source.title,
                "snippet": e._source.userSynopsis,
                "link": e._source.url,
                "pagemap": {
                    "imageobject": [{
                        url:  e._source.lead_image_url
                    }],
                    "metatags": [{
                        "author": e._source.author,
                        "article:published": e._source.date_published
                    }]
                }
            }
        })*/
        done(results)
    }).catch(error => {
        done(error)
    })

}

const suggest = function suggest(options, done) {
    if (options.suggest) {
        esClient.search({
            index: "website",
            body: {
                "suggest": {
                    "song-suggest": {
                        "prefix": options.suggest,
                        "completion": {
                            "field": "suggest"
                        }
                    }
                }
            }
        }, function (error, response) {
            done(response)
        })
    } else {
        done("Please give me some term")
    }
}

module.exports = {

    bulkSite: function (options, done) {
        isSiteAvailable(options.articles[0].url, results => {
            if (!results)
                bulkIndex(options.index, options.type, options.articles)
        })
    },

    getIndices: function (done) {
        indices(done)
    },

    search: function (options, done) {
        buildSearch(options, done)
    },

    suggest: function (options, done) {
        suggest(options, done)
    },

    prepareMap: function (options, done) {
        prepareMappings(options, done)
    },

    searchAll: function (done) {
        let body = {
            size: 20,
            from: 0,
            query: {
                match_all: {}
            }
        }

        esClient.search({ body: body }).then(results => {
            sails.log(`found ${results.hits.total} items in ${results.took}ms`);
            done(results)
        })
    }
}