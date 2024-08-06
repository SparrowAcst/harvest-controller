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

        let options = req.body.options

        let { user } = options 

        let { db, grantCollection, profileCollection } = req.body.cache.currentDataset

        options = extend({}, options, {
            db,
            collection: `${db.name}.${grantCollection}`,
            pipeline: [
              {
                $match:
                  {
                    email: user.email,
                  },
              },
              {
                $lookup:
                  {
                    from: profileCollection,
                    localField: "profile",
                    foreignField: "name",
                    as: "result",
                    pipeline: [
                      {
                        $project: {
                          _id: 0,
                        },
                      },
                    ],
                  },
              },
              {
                $addFields:
                  {
                    profile: {
                      $first: "$result",
                    },
                  },
              },
              {
                $project:
                  {
                    _id: 0,
                    result: 0,
                  },
              },
            ]
        })


        const result = await mongodb.aggregate(options)
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