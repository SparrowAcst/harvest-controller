const mongodb = require("./mongodb")
const { extend, sortBy, uniq, flattenDeep, minBy } = require("lodash")
const { getPage } = require("./utils/paginate")
const { hist } = require("./utils/hist")


const getTasks1 = async (req, res) => {

    try {

        let { me, excludeFilter, eventData } = req.body.options
        const { db } = req.body.cache.currentDataset


        let paginationPipeline = [{
                $group: {
                    _id: "$Examination ID",
                    "1st expert": {
                        $addToSet: "$1st expert",
                    },
                    "2nd expert": {
                        $addToSet: "$2nd expert",
                    },
                    update: {
                        $push: {
                            by: "$updated by",
                            at: {
                                $toDate: "$updated at"
                            },
                        },
                    },
                    "updated at": {
                        $max: {
                            $toDate: "$updated at"
                        },
                    },
                },
            },
            {
                $addFields: {
                    "updated by": {
                        $arrayElemAt: [{
                                $filter: {
                                    input: "$update",
                                    as: "item",
                                    cond: {
                                        $eq: [
                                            "$updated at",
                                            "$$item.at"
                                        ],
                                    },
                                },
                            },
                            0,
                        ],
                    },
                },
            },
            {
                $project: {
                    _id: 0,
                    "Examination ID": "$_id",
                    "updated at": 1
                }
            }
        ]

        let userFilter = (me) ?
            [{
                '$match': {
                    '$or': [{
                        'updated by': me
                    }, {
                        '1st expert': me
                    }, {
                        '2nd expert': me
                    }, {
                        'CMO': me
                    }]
                }
            }] :
            []


        let data = await mongodb.aggregate({
            db,
            collection: `${db.name}.${db.labelingCollection}`,
            pipeline: (excludeFilter || [])
                .concat(eventData.filter || [])
                .concat(userFilter)
                .concat(paginationPipeline)

        })


        // console.log("---------------1------------------")  

        let count = data.length

        eventData = extend(eventData, {
            total: count,
            pagePosition: `${eventData.skip+1} - ${Math.min(eventData.skip + eventData.limit, count)} from ${count}`
        })

        let exams = getPage(
            data,
            eventData.skip,
            eventData.limit,
            d => new Date(d["updated at"]),
            d => d["Examination ID"],
            "desc"
        )

        let nestedPipeline = (excludeFilter || []).concat(
            [{
                $project: {
                    _id: 0,
                    "updated at": {
                        $toDate: "$updated at"
                    },
                    update: {
                        at: {
                            $toDate: "$updated at"
                        },
                        by: "$updated by",
                    },
                    "Recording Informativeness": 1,
                    "1st expert": 1,
                    "2nd expert": 1,
                    TODO: 1,
                },
            }]
        )


        let mainPipeline = [{
                $match: {
                    patientId: {
                        $in: exams
                    },
                },
            },
            {
                $lookup: {
                    from: db.labelingCollection,
                    localField: "patientId",
                    foreignField: "Examination ID",
                    pipeline: nestedPipeline,
                    as: "r",
                },
            },
            {
                $addFields: {
                    "updated at": {
                        $max: "$r.updated at"
                    },
                    "1st expert": {
                        $map: {
                            input: "$r",
                            as: "item",
                            in: "$$item.1st expert",
                        },
                    },
                    "2nd expert": {
                        $map: {
                            input: "$r",
                            as: "item",
                            in: "$$item.2nd expert",
                        },
                    },
                    qty: {
                        $map: {
                            input: "$r",
                            as: "item",
                            in: "$$item.Recording Informativeness",
                        },
                    },
                    TODO: {
                        $map: {
                            input: "$r",
                            as: "item",
                            in: "$$item.TODO",
                        },
                    },
                    update: {
                        $map: {
                            input: "$r",
                            as: "item",
                            in: "$$item.update",
                        },
                    },
                },
            },
            {
                $addFields: {
                    "updated by": {
                        $arrayElemAt: [{
                                $filter: {
                                    input: "$update",
                                    as: "item",
                                    cond: {
                                        $eq: [
                                            "$updated at",
                                            "$$item.at"
                                        ],
                                    },
                                },
                            },
                            0,
                        ],
                    },
                },
            },
            {
                $lookup: {
                    from: db.formCollection,
                    localField: "id",
                    foreignField: "examinationId",
                    pipeline: [{
                            $match: {
                                type: "patient",
                            },
                        },
                        {
                            $project: {
                                _id: 0,
                                dia: "$data.en.diagnosisTags",
                            },
                        },
                    ],
                    as: "dia",
                },
            },
            {
                $project: {
                    _id: 0,
                    id: 1,
                    state: 1,
                    "Examination ID": "$patientId",
                    qty: 1,
                    TODO: 1,
                    "1st expert": 1,
                    "2nd expert": 1,
                    "updated at": 1,
                    "updated by": "$updated by.by",
                    "protocol": 1,
                    dia: {
                        $arrayElemAt: ["$dia.dia", 0],
                    },
                },
            },
            {
                $sort: {
                    "updated at": -1
                }
            }
        ]

        // console.log(JSON.stringify(mainPipeline, null, ' '))


        ////////////////////////////////////////////////////////////////////////

        const ddata = await mongodb.aggregate({
            db,
            collection: `${db.name}.${db.examinationCollection}`,
            pipeline: mainPipeline
        })

        // console.log("---------------------3---------------------------")
        // console.log(ddata.length)

        const result = {
            options: req.body.options,
            collection: ddata.map(d => {

                d.Recordings = d["1st expert"].length

                d["1st expert"] = sortBy(uniq(flattenDeep(d["1st expert"]))).filter(d => d)
                d["2nd expert"] = sortBy(uniq(flattenDeep(d["2nd expert"]))).filter(d => d)
                d["CMO"] = sortBy(uniq(flattenDeep(d["CMO"]))).filter(d => d)

                d.stat = {
                    stat: hist(d.TODO, d => d, "TODO", "count"),
                    total: d.TODO.length
                }

                d.qty = {
                    hist: hist(d.qty, d => d, "value", "count"),
                    total: d.qty.length
                }

                return d
            })
        }

        res.send(result)

    } catch (e) {
        res.send({
            error: e.toString(),
            requestBody: req.body
        })
    }
}


const getOrganizations = async (req, res) => {
    try {

        const { db } = req.body.cache.currentDataset

        const result = await mongodb.aggregate({
            db,
            collection: `${db.name}.${db.organizationCollection}`,
            pipeline: [{
                $project: { _id: 0 }
            }]
        })
        res.send(result)

    } catch (e) {
        res.send({
            error: e.toString(),
            requestBody: req.body
        })
    }
}



const getStat = async (req, res) => {
    try {

        let { userFilter, me, eventData, excludeFilter } = req.body.options
        const { db } = req.body.cache.currentDataset

        let pipeline = [{
            '$facet': {
                'total': [{
                    '$count': 'count'
                }],
                'examinations': [{
                    '$group': {
                        '_id': {
                            'Examination ID': '$Examination ID'
                        },
                        'ids': {
                            '$addToSet': {}
                        }
                    }
                }, {
                    '$project': {
                        'count': {
                            '$size': '$ids'
                        },
                        '_id': 0
                    }
                }],
                'stat': [{
                    '$group': {
                        '_id': {
                            'TODO': '$TODO'
                        },
                        'count': {
                            '$count': {}
                        }
                    }
                }, {
                    '$project': {
                        'TODO': '$_id.TODO',
                        'count': 1,
                        '_id': 0
                    }
                }]
            }
        }, {
            '$project': {
                'total': {
                    '$first': '$total'
                },
                'stat': 1,
                'examinations': {
                    '$size': '$examinations'
                }
            }
        }, {
            '$project': {
                'total': '$total.count',
                'stat': 1,
                'examinations': 1
            }
        }]

        userFilter = (me) ?
            [{
                '$match': {
                    '$or': [{
                        'updated by': me
                    }, {
                        '1st expert': me
                    }, {
                        '2nd expert': me
                    }, {
                        'CMO': me
                    }]
                }
            }] :
            []

        
        const result = await mongodb.aggregate({
          db,
          collection: `${db.name}.${db.labelingCollection}`,
            pipeline: (excludeFilter || [])
                .concat(eventData.filter)
                .concat(userFilter)
                .concat(pipeline) 
        })

        res.send(result[0])

    } catch (e) {
        res.send({
            error: e.toString(),
            requestBody: req.body
        })
    }
}


const getSyncStat = async (req, res) => {
    try {

        let { syncFilter } = req.body.options
        const { db } = req.body.cache.currentDataset


        let preparePipeline = [{
            '$lookup': {
                'from': db.userCollection,
                'localField': 'actorId',
                'foreignField': 'id',
                'as': 'physician'
            }
        }, {
            '$lookup': {
                'from': db.organizationCollection,
                'localField': 'organization',
                'foreignField': 'id',
                'as': 'organization'
            }
        }, {
            '$project': {
                '_id': 0,
                'Examination ID': '$patientId',
                'organization': {
                    '$arrayElemAt': [
                        '$organization', 0
                    ]
                },
                'physician': {
                    '$arrayElemAt': [
                        '$physician', 0
                    ]
                },
                "updatedAt": "$updatedAt",
                "synchronizedAt": "$synchronizedAt",
                'state': '$state',
                protocol: "$protocol",
                'validation': '$_validation'
            }
        }, {
            $sort: {
                updatedAt: -1,
                organization: 1,
                state: 1
            }
        }]

        let pipeline = [{
            '$group': {
                '_id': '$state',
                'count': {
                    '$count': {}
                }
            }
        }, {
            '$project': {
                '_id': 0,
                'state': '$_id',
                'count': '$count'
            }
        }]

        let result = await mongodb.aggregate({
          db, 
          collection: `${db.name}.${db.examinationCollection}`,
            pipeline: preparePipeline
                .concat(syncFilter)
                .concat(pipeline)

        })

        result = {
            total: result.map(d => d.count).reduce((s, d) => s + d, 0),
            stat: result,
            options: req.body.options
        }

        res.send(result)

    } catch (e) {
        res.send({
            error: e.toString(),
            requestBody: req.body
        })
    }
}


const getSyncExaminations = async (req, res) => {
    try {

        let options = req.body.options
        const { db } = req.body.cache.currentDataset
  
        options.pipeline = [{
                '$lookup': {
                    'from': db.userCollection,
                    'localField': 'actorId',
                    'foreignField': 'id',
                    'as': 'physician'
                }
            }, {
                '$lookup': {
                    'from': db.organizationCollection,
                    'localField': 'organization',
                    'foreignField': 'id',
                    'as': 'organization'
                }
            },
            {
                $project: {
                    _id: 0,
                    "Examination ID": "$patientId",
                    organization: {
                        $arrayElemAt: ["$organization", 0],
                    },
                    physician: {
                        $arrayElemAt: ["$physician", 0],
                    },
                    updatedAt: "$updatedAt",
                    synchronizedAt: "$synchronizedAt",
                    state: "$state",
                    protocol: "$protocol",
                    // records: "$records",
                    validation: "$_validation",
                },
            },
            {
                $sort: {
                    updatedAt: -1,
                    "Examination ID": -1
                }
            }
        ]


        options.filter = []

        if ((options.eventData.skip + options.eventData.limit) == options.eventData.total) {
            options.pageFilter = [{
                '$skip': options.eventData.skip
            }]
        } else {

            options.pageFilter = [{
                '$skip': options.eventData.skip
            }, {
                '$limit': options.eventData.limit
            }]

        }

        // options.pageFilter = [] 

        options.countPipeline = [
            { $count: 'count' },
            { $project: { _id: 0 } }
        ]

        let count = await mongodb.aggregate({
            db,
            collection: `${db.name}.${db.examinationCollection}`,
            pipeline: options.pipeline
                .concat(options.syncFilter)
                .concat(options.countPipeline)
        })

        count = (count[0]) ? count[0].count : 0
        options.eventData = extend(options.eventData, {
            total: count,
            pagePosition: `${options.eventData.skip+1} - ${Math.min(options.eventData.skip + options.eventData.limit, count)} from ${count}`
        })

        let pipeline = options.pipeline
            .concat(options.syncFilter)
            .concat(options.pageFilter)
            .concat([{
                $lookup: {
                    from: db.labelingCollection,
                    localField: "Examination ID",
                    foreignField: "Examination ID",
                    pipeline: options.excludeFilter.concat([{
                        $project: {
                            _id: 0,
                            todo: "$TODO",
                            qty: "$Recording Informativeness",
                        },
                    }]),
                    as: "records",
                }
            }])

        let data = await mongodb.aggregate({
            db,
            collection: `${db.name}.${db.examinationCollection}`,
            pipeline
        })


        data = data.map(d => {
            d.stat = {
                stat: hist(d.records, d => d.todo, "TODO", "count"),
                total: d.records.length
            }

            d.qty = {
                hist: hist(d.records, d => d.qty, "value", "count"),
                total: d.records.length
            }

            d.records = undefined

            return d
        })

        res.send({
            options,
            pipeline,
            collection: data
        })

    } catch (e) {
        res.send({
            error: e.toString(),
            requestBody: req.body
        })
    }
}

const resolveTodo = r => {
    if (["Assign 2nd expert", "Assign 1st expert"].includes(r.TODO)) {
        if (!r["1st expert"] && !r["2nd expert"]) return "Assign 2nd expert"
        if (!r["1st expert"] && r["2nd expert"]) return "Assign 1st expert"
        if (r["1st expert"]) return "Continue Labeling"
    } else {
        return r.TODO
    }
}

const resolveAssigment = r => {
    switch (r.TODO) {
        case "Assign 2nd expert":
            return r["CMO"]
            break
        case "Assign 1st expert":
            return r["2nd expert"]
            break
        case "Continue Labeling":
            return r["1st expert"]
            break
        case "Complete 2nd Stage":
            return r["2nd expert"]
            break
        case "Complete Labeling":
            return r["CMO"]
            break
        case "Finalized":
            return ""
            break
    }
}


const updateTasks = async (req, res) => {
    try {

        let { options, selection, assignator } = req.body
        const { db, name: currentDatasetName } = req.body.cache.currentDataset

        let records = await mongodb.aggregate({
            db,
            collection: `${db.name}.${db.labelingCollection}`,
            pipeline: [{
                '$match': {
                    'Examination ID': {
                        '$in': selection
                    }
                }
            }, {
                '$project': {
                    '_id': 0
                }
            }]
        })

        records = records.map(r => {

            if (["Assign 2nd expert", "Assign 1st expert"].includes(r.TODO)) {
                r = extend({}, r, assignator)
                r.TODO = resolveTodo(r)
                r["assigned to"] = resolveAssigment(r)
            } else {
                r["1st expert"] = (r["1st expert"]) ? r["1st expert"] : assignator["1st expert"]
                r["2nd expert"] = (r["2nd expert"]) ? r["2nd expert"] : assignator["2nd expert"]
                r["updated at"] = assignator["updated at"]
                r["updated by"] = assignator["updated by"]
                r.TODO = resolveTodo(r)
                r["assigned to"] = resolveAssigment(r)
            }
            // console.log(r["updated at"], r["updated by"], assignator)    
            return r
        })

        const commands = records.map(r => ({
            replaceOne: {
                filter: {
                    id: r.id
                },
                replacement: extend({}, r)
            }
        }))

        const result = await mongodb.bulkWrite({
            db,
            collection: `${db.name}.${db.labelingCollection}`,
            commands
        })


        const events = records.map(r => {

            const id = uuid()

            return {
                replaceOne: {
                    filter: {
                        id
                    },
                    replacement: {
                        id,
                        dataset: currentDatasetName,
                        labelingId: r.id,
                        todo: r.TODO,
                        assignedBy: r["updated by"],
                        assignedTo: r["assigned to"],
                        date: r["updated at"]
                    }

                }
            }
        })

        await mongodb.bulkWrite({
            db,
            collection: `${db.name}.workflow-events`,
            events
        })


        res.send(result)

    } catch (e) {
        res.send({
            error: e.toString(),
            requestBody: req.body
        })
    }
}


const acceptExaminations = async (req, res) => {
    try {

        let { selection } = req.body
        const { db } = req.body.cache.currentDataset



        let records = await mongodb.aggregate({
            db,
            collection: `${db.name}.${db.examinationCollection}`,
            pipeline: [{
                '$match': {
                    'patientId': {
                        '$in': selection
                    }
                }
            }, {
                '$project': {
                    '_id': 0
                }
            }]
        })

        records = records.map(r => {
            r.state = "accepted"
            r.updatedAt = new Date()
            return r
        })

        const commands = records.map(r => ({
            replaceOne: {
                filter: {
                    id: r.id
                },
                replacement: extend({}, r)
            }
        }))

        const result = await mongodb.bulkWrite({
            db,
            collection: `${db.name}.${db.examinationCollection}`,
            commands
        })

        res.send(result)

    } catch (e) {
        res.send({
            error: e.toString(),
            requestBody: req.body
        })
    }
}

const rejectExaminations = async (req, res) => {
    try {

        let { selection } = req.body
        const { db } = req.body.cache.currentDataset


        let records = await mongodb.aggregate({
            db,
            collection: `${db.name}.${db.examinationCollection}`,
            pipeline: [{
                '$match': {
                    'patientId': {
                        '$in': selection
                    }
                }
            }, {
                '$project': {
                    '_id': 0
                }
            }]
        })

        records = records.map(r => {
            r.state = "rejected"
            r.updatedAt = new Date()
            return r
        })

        const commands = records.map(r => ({
            replaceOne: {
                filter: {
                    id: r.id
                },
                replacement: extend({}, r)
            }
        }))

        const result = await mongodb.bulkWrite({
            db,
            collection: `${db.name}.${db.examinationCollection}`,
            commands
        })

        res.send(result)

    } catch (e) {
        res.send({
            error: e.toString(),
            requestBody: req.body
        })
    }
}


module.exports = {
    getTasks: getTasks1,
    getStat,
    getSyncStat,
    getSyncExaminations,
    updateTasks,
    getOrganizations,
    acceptExaminations,
    rejectExaminations
}