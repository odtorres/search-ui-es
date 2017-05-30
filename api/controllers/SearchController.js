/**
 * SearchController
 *
 * @description :: Server-side logic for managing Searches
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */

module.exports = {

	indices:(req, res)=>{
        ElasticService.getIndices((result)=>{
            res.json(result)
        })
    },

    full:(req, res)=>{
        ElasticService.searchAll((result)=>{
            res.json(result)
        })
    },

    //http://localhost:1337/search/suggest?suggest=Ja
    suggest:(req, res)=>{
        let params = req.allParams()
        ElasticService.suggest(params,(result)=>{
            res.json(result)
        })
    },

    //http://localhost:1337/search?index=website&q=all&exactTerms=about&excludeTerms=Just
    index:(req, res)=>{
        let params = req.allParams()
        ElasticService.search(params,(result)=>{
            res.json(result)
        })
    }
};