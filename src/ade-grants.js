const mongodb = require("./mongodb")
const { extend, find } = require("lodash")
const moment = require("moment")


const getDatasetList = async (req, res) => {

    try {

        res.send(req.body.cache.datasets.map(d => d.name))

    } catch (e) {
        res.send({
            error: e.toString(),
            requestBody: req.body
        })
    }

}

const getGrants = async (req, res) => {
    try {

        let userProfiles = req.body.cache.userProfiles
        let { user } = req.body.options 
        let result = userProfiles.filter(p => p.email.includes(user.email))
        res.send(result)

    } catch (e) {
        res.send({
            error: e.toString(),
            requestBody: req.body
        })
    }
}



module.exports = {
    getDatasetList,
    getGrants,
}