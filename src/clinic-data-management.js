const mongodb = require("./mongodb")
const { extend, sortBy, uniq, flattenDeep, find, first, last, isUndefined, isNull, keys, isArray, isString, isObject, remove } = require("lodash")
const moment = require("moment")
const YAML = require("js-yaml")
const fs = require("fs")
const path = require("path")
const uuid = require("uuid").v4
const axios = require("axios")
const URL = require("url")

const CONFIG = YAML.load(fs.readFileSync(path.join(__dirname, `../../sync-data/.config/db/mongodb.conf.yml`)).toString().replace(/\t/gm, " "))

let expiration = 10000
let requestPool = {}


const getDatasetList = async (req, res) => {
    try {

        let options = req.body.options

        options = extend({}, options, {
            collection: `${options.db.name}.dataset`,
            pipeline: [{
                    $match: {
                        "settings.availableSync": true
                    }
                },
                {
                    $project: { _id: 0 }
                }
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


const getTagList = async (req, res) => {
    try {

        let options = req.body.options

        let scope = (!isUndefined(options.tagScope) && !isNull(options.tagScope) && options.tagScope && options.tagScope != "null") ? [{ $match: { "name": { $regex: options.tagScope } } }] : []

        options = extend({}, options, {
            collection: `${options.db.name}.taged-tags`,
            pipeline: scope.concat([{
                    $match: {
                        enabled: true
                    }
                },
                {
                    $project: { _id: 0 }
                }
            ])
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



const getRecords = async (req, res) => {
    try {

        let options = req.body.options

        let count = await mongodb.aggregate({
            db: options.db,
            collection: `${options.db.name}.${options.db.labelingCollection}`,
            pipeline: []
                .concat(options.valueFilter)
                .concat(options.eventData.filter)
                .concat([
                    { $count: 'count' },
                    { $project: { _id: 0 } }
                ])
        })

        count = (count[0]) ? count[0].count || 0 : 0
        options.eventData = extend(options.eventData, {
            total: count,
            pagePosition: `${options.eventData.skip+1} - ${Math.min(options.eventData.skip + options.eventData.limit, count)} from ${count}`
        })

        let data = await mongodb.aggregate({
            db: options.db,
            collection: `${options.db.name}.${options.db.labelingCollection}`,
            pipeline: []
                .concat(options.valueFilter || [])
                .concat(options.eventData.filter || [])
                .concat([
                    //  {
                    //      $addFields:{
                    //        "updated at": {
                    //      $max: "$tags.createdAt"
                    //   }
                    // }
                    //  },  
                    {
                        '$project': {
                            '_id': 0
                        }
                    },
                    {
                        $sort: (options.sort == "updated at, Z-A") ? {
                            "updated at": -1
                        } : {
                            "updated at": 1
                        }
                    },
                    {
                        '$skip': options.eventData.skip
                    },
                    {
                        '$limit': options.eventData.limit
                    }
                ])
        })

        res.send({
            options,
            collection: data
        })


    } catch (e) {
        res.send({
            error: e.toString(),
            requestBody: req.body
        })
    }
}


getStateChart = async (req, res) => {

    try {

        let { options } = req.body
        let matchExaminationPipeline = options.matchExamination || []
        let pipeline = matchExaminationPipeline.concat(
            [
                {
                    $project: {
                      state: 1,
                    },
                  },
                  {
                    $group:
                      {
                        _id: "$state",
                        patients: {
                          $push: 1,
                        },
                      },
                  },
                  {
                    $project:
                      {
                        _id: 0,
                        label: "$_id",
                        value: {
                          $size: "$patients",
                        },
                      },
                  }
            ]      
        )    

        let data = await mongodb.aggregate({
            db: options.db,
            collection: `${options.db.name}.${options.db.examinationCollection}`,
            pipeline
        })

        res.send({
            options,
            pipeline,
            values: data
        })





    } catch (e) {
        res.send({
            error: e.toString(),
            requestBody: req.body
        })
    }

}    

const getExams = async (req, res) => {
    try {


        let { options } = req.body
        let matchExaminationPipeline = options.matchExamination || []
        let limit = options.limit || 100
        // let pipeline = [{
        //         '$lookup': {
        //             'from': options.db.userCollection,
        //             'localField': 'actorId',
        //             'foreignField': 'id',
        //             'as': 'physician'
        //         }
        //     }, {
        //         '$lookup': {
        //             'from': options.db.organizationCollection,
        //             'localField': 'organization',
        //             'foreignField': 'id',
        //             'as': 'organization'
        //         }
        //     },
        //     {
        //         $project: {
        //             _id: 0,
        //             "Examination ID": "$patientId",
        //             organization: {
        //                 $arrayElemAt: ["$organization", 0],
        //             },
        //             physician: {
        //                 $arrayElemAt: ["$physician", 0],
        //             },
        //             updatedAt: "$updatedAt",
        //             synchronizedAt: "$synchronizedAt",
        //             state: "$state",
        //             protocol: "$protocol",
        //             // records: "$records",
        //             validation: "$_validation",
        //         },
        //     },
        //     {
        //         $sort: {
        //             updatedAt: -1,
        //             "Examination ID": -1
        //         }
        //     },
        //     {
        //         $limit: limit
        //     }
        // ]
        let pipeline = matchExaminationPipeline.concat(
            [
                {
                  $sort:{
                      updatedAt: -1,
                      patientId: -1
                  }
                },
                {
                    $limit: Number.parseInt(limit) 
                },
                {
                    $project: {
                        e_id: "$id",
                        org: "$org",
                        state: "$state",
                        protocol: "$protocol",
                        patientId: "$patientId",
                        syncAt: "$synchronizedAt",
                        updatedAt: "$updatedAt",
                    },
                },
                {
                    $lookup: {
                        from: options.db.labelingCollection,
                        localField: "patientId",
                        foreignField: "Examination ID",
                        as: "records",
                    },
                },
                {
                    $unwind: {
                        path: "$records",
                    },
                },
                {
                    $match: {
                        "records.Body Spot": {
                            $in: [
                                "Apex",
                                "Tricuspid",
                                "Pulmonic",
                                "Aortic",
                                "Right Carotid",
                                "Erb's",
                                "Erb's Right",
                            ],
                        },
                    },
                },
                {
                    $addFields: {
                        qty: "$records.Heart Sound Informativeness",
                    },
                },
                {
                    $project: {
                        records: 0,
                    },
                },
                {
                    $group: {
                        _id: {
                            patientId: "$patientId",
                            qty: "$qty",
                        },
                        org: {
                            $first: "$org",
                        },
                        state: {
                          $first: "$state",
                        },
                        protocol: {
                            $first: "$protocol",
                        },
                        e_id: {
                            $first: "$e_id",
                        },
                        syncAt: {
                            $first: "$syncAt",
                        },
                        updatedAt: {
                            $first: "$updatedAt",
                        },
                        count: {
                            $count: {},
                        },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        org: 1,
                        state: 1,
                        e_id: 1,
                        patientId: "$_id.patientId",
                        protocol: "$protocol",
                        qty: "$_id.qty",
                        syncAt: 1,
                        updatedAt: 1,
                        count: 1,
                    },
                },
                {
                    $group: {
                        _id: "$patientId",
                        org: {
                            $first: "$org",
                        },
                        e_id: {
                            $first: "$e_id",
                        },
                        patientId: {
                            $first: "$patientId",
                        },
                        qty: {
                            $push: {
                                value: "$qty",
                                count: "$count",
                            },
                        },
                        protocol: {
                            $first: "$protocol",
                        },
                        syncAt: {
                            $first: "$syncAt",
                        },
                        updatedAt: {
                            $first: "$updatedAt",
                        },
                        state: {
                          $first: "$state",
                        },
                    },
                },
                {
                    $lookup: {
                        from: "H3-FORM",
                        localField: "e_id",
                        foreignField: "examinationId",
                        as: "forms",
                    },
                },
                {
                    $addFields: {
                        patientForm: {
                            $first: {
                                $filter: {
                                    input: "$forms",
                                    as: "item",
                                    cond: {
                                        $eq: ["$$item.type", "patient"],
                                    },
                                },
                            },
                        },
                        echoForm: {
                            $first: {
                                $filter: {
                                    input: "$forms",
                                    as: "item",
                                    cond: {
                                        $eq: ["$$item.type", "echo"],
                                    },
                                },
                            },
                        },
                        ekgForm: {
                            $first: {
                                $filter: {
                                    input: "$forms",
                                    as: "item",
                                    cond: {
                                        $eq: ["$$item.type", "ekg"],
                                    },
                                },
                            },
                        },
                    },
                },
                {
                    $project: {
                        patientId: 1,
                        org: 1,
                        syncAt: 1,
                        updatedAt: 1,
                        state: 1,
                        protocol: 1,
                        qty: 1,
                        patientForm: "$patientForm.data.en",
                        echoForm: "$echoForm.data.en",
                        ekgForm: "$ekgForm.data.en",
                    },
                },
                {
                  $sort:{
                      updatedAt: -1,
                      patientId: -1
                  }
                }
            ]
        )

        let data = await mongodb.aggregate({
            db: options.db,
            collection: `${options.db.name}.${options.db.examinationCollection}`,
            pipeline
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


const selectExams = async (req, res) => {
    try {

        let options = req.body.options

        if (options.pipeline.length == 0) {
            res.send({
                options,
                collection: []
            })

            return
        }

        let data = await mongodb.aggregate({
            db: options.db,
            collection: `${options.db.name}.${options.db.labelingCollection}`,
            pipeline: options.pipeline.concat([{ $project: { id: "$_id" } }])
        })

        // fetch _id of examinations? that consistenced to criteria

        console.log(data)

        res.send({
            options,
            collection: data.map(d => d.id)
        })


    } catch (e) {
        res.send({
            error: e.toString(),
            requestBody: req.body
        })
    }
}



const removeLastTag = async (req, res) => {
    try {

        let options = req.body.options

        let scopeRegEx = new RegExp(options.tagScope || ".*")

        // options.tags = (options.tags || []).map( t => ({
        //  tag: t,
        //  createdAt: new Date(),
        //  createdBy: {
        //      email: options.user.email,
        //      namedAs: options.user.namedAs,
        //      photo: options.user.photo
        //  }
        // }))

        let records = await mongodb.aggregate({
            db: options.db,
            collection: `${options.db.name}.${options.db.labelingCollection}`,
            pipeline: [{
                    $match: {
                        id: {
                            $in: options.records
                        }
                    }
                },
                {
                    $project: {
                        _id: 0
                    }
                }
            ]
        })

        records.forEach(r => {

            let outOfScope = remove(r.tags, d => !scopeRegEx.test(d.tag))


            r.tags = sortBy(r.tags.map(t => {
                t.createdAt = new Date(t.createdAt)
                return t
            }), d => d.createdAt)


            r.tags.reverse()

            if (r.tags && r.tags.length > 0 && !r.tags[0].tag.startsWith("TASK:") && !r.tags[0].tag.startsWith("SOURCE:")) {
                r.tags.shift()
            }

            r.tags = r.tags.concat(outOfScope)

            r.tags = sortBy(r.tags.map(t => {
                t.createdAt = new Date(t.createdAt)
                return t
            }), d => d.createdAt)


            r["updated at"] = new Date()
            r["Stage Comment"] = "Last Tag removed."
            r["updated by"] = options.user.namedAs
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
            db: options.db,
            collection: `${options.db.name}.${options.db.labelingCollection}`,
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

const addTags = async (req, res) => {
    try {

        let options = req.body.options


        options.tags = (options.tags || []).map(t => ({
            tag: t,
            createdAt: new Date(),
            createdBy: {
                email: options.user.email,
                namedAs: options.user.namedAs,
                photo: options.user.photo
            }
        }))

        let records = await mongodb.aggregate({
            db: options.db,
            collection: `${options.db.name}.${options.db.labelingCollection}`,
            pipeline: [{
                    $match: {
                        id: {
                            $in: options.records
                        }
                    }
                },
                {
                    $project: {
                        _id: 0
                    }
                }
            ]
        })

        records.forEach(r => {
            r.tags = r.tags.map(t => {
                t.createdAt = new Date(t.createdAt)
                return t
            })
            r.tags = sortBy(r.tags, d => d.createdAt)
            console.log(last(r.tags).tag, first(options.tags).tag)
            if (last(r.tags).tag == first(options.tags).tag) {
                r.tags.pop()
            }
            r.tags = r.tags.concat(options.tags)
            r["updated at"] = new Date()
            r["Stage Comment"] = "Tags added."
            r["updated by"] = options.user.namedAs
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
            db: options.db,
            collection: `${options.db.name}.${options.db.labelingCollection}`,
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


const addTagsDia = async (req, res) => {
    try {

        let options = req.body.options

        options.tags = (options.tags || []).map(t => ({
            tag: t,
            createdAt: new Date(),
            createdBy: {
                email: options.user.email,
                namedAs: options.user.namedAs,
                photo: options.user.photo
            }
        }))


        let records = await mongodb.aggregate({
            db: options.db,
            collection: `${options.db.name}.${options.db.examinationCollection}`,
            pipeline: [{
                    $match: {
                        id: {
                            $in: options.examinations
                        }
                    }
                },
                {
                    $project: {
                        _id: 0
                    }
                }
            ]
        })

        records.forEach(r => {
            r.workflowTags = (r.workflowTags || []).map(t => {
                t.createdAt = new Date(t.createdAt)
                return t
            })
            r.workflowTags = sortBy(r.workflowTags, d => d.createdAt)
            if (r.workflowTags.length > 0 && last(r.workflowTags).tag == first(options.tags).tag) {
                r.workflowTags.pop()
            }
            r.workflowTags = r.workflowTags.concat(options.tags)
            r["updated at"] = new Date()
            r["Stage Comment"] = "Tags added."
            r["updated by"] = options.user.namedAs
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
            db: options.db,
            collection: `${options.db.name}.${options.db.examinationCollection}`,
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

const removeLastTagDia = async (req, res) => {
    try {

        let options = req.body.options

        let scopeRegEx = new RegExp(options.tagScope || ".*")

        let records = await mongodb.aggregate({
            db: options.db,
            collection: `${options.db.name}.${options.db.examinationCollection}`,
            pipeline: [{
                    $match: {
                        id: {
                            $in: options.examinations
                        }
                    }
                },
                {
                    $project: {
                        _id: 0
                    }
                }
            ]
        })

        records.forEach(r => {

            let outOfScope = remove(r.workflowTags, d => !scopeRegEx.test(d.tag))


            r.workflowTags = sortBy(r.workflowTags.map(t => {
                t.createdAt = new Date(t.createdAt)
                return t
            }), d => d.createdAt)


            r.workflowTags.reverse()

            if (r.workflowTags && r.workflowTags.length > 0 && !r.workflowTags[0].tag.startsWith("TASK:") && !r.workflowTags[0].tag.startsWith("SOURCE:")) {
                r.workflowTags.shift()
            }

            r.workflowTags = r.workflowTags.concat(outOfScope)

            r.workflowTags = sortBy(r.workflowTags.map(t => {
                t.createdAt = new Date(t.createdAt)
                return t
            }), d => d.createdAt)


            r["updated at"] = new Date()
            r["Stage Comment"] = "Last Tag removed."
            r["updated by"] = options.user.namedAs
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
            db: options.db,
            collection: `${options.db.name}.${options.db.examinationCollection}`,
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



const getGrants = async (req, res) => {
    try {

        let options = req.body.options

        let { user, db, grantCollection, profileCollection } = options

        options = extend({}, options, {
            collection: `${db.name}.${grantCollection}`,
            pipeline: [{
                    $match: {
                        email: user.email,
                    },
                },
                {
                    $lookup: {
                        from: profileCollection,
                        localField: "profile",
                        foreignField: "name",
                        as: "result",
                        pipeline: [{
                            $project: {
                                _id: 0,
                            },
                        }, ],
                    },
                },
                {
                    $addFields: {
                        profile: {
                            $first: "$result",
                        },
                    },
                },
                {
                    $project: {
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


const addToTask = async (req, res) => {
    try {


        let prodSourceEndpoint = {
            "production(US)": "https://s6uorvdusht462ycb5evujwi5y0rpmoh.lambda-url.us-east-1.on.aws/",
            "production(UA)": "https://7y7bhy6ztqgymcvo72i6zmc4ji0hthyd.lambda-url.eu-central-1.on.aws/",
            // "testing": "",
            // "demo": ""
        }

        /////////////////////////////////////////////////////////////////////////////////////////
        // check body
        let options = req.body

        options.db = CONFIG.db
        options.selector = options.selector || {}

        if (!options.tags || options.tags.length == 0) {
            res.status(400).send(`"tags" array is required in\n${JSON.stringify(req.body, null, " ")}`)
            return
        }

        if (!isObject(options.selector)) {
            res.status(400).send(`"selector" object is required in\n${JSON.stringify(req.body, null, " ")}`)
            return
        }

        // if(options.tags.filter(t => t.startsWith("SOURCE:")).length > 1){
        //  res.status(400).send(`only one tag "SOURCE:<source name>" is required in\n${JSON.stringify(req.body, null, " ")}`)
        //  return
        // }

        // let source = find(options.tags, t => t.startsWith("SOURCE:"))

        // if(!source) {
        //  res.status(400).send(`tag "SOURCE:<source name>" is required in\n${JSON.stringify(req.body, null, " ")}`)
        //  return  
        // }

        // source = last(source.split(":")).trim()

        // if(!keys(prodSourceEndpoint).includes(source)){
        //  res.status(400).send(` unknown "SOURCE:${source}". Available sources: ${keys(prodSourceEndpoint).map(d => "'"+d+"'").join(", ")}`)
        //  return  

        // }

        if (options.tags.filter(d => d.startsWith("TASK:")).length == 0) {
            res.status(400).send(`tag "TASK:<task name>" is required in\n${JSON.stringify(req.body, null, " ")}`)
            return
        }

        options.records = options.records || []

        if (options.records.length == 0) {
            res.status(400).send(`not empty "records" array is required in\n${JSON.stringify(req.body, null, " ")}`)
            return
        }


        /////////////////////////////////////////////////////////////////////////////////////////
        // update taged-records collection

        let response = {
            tags: options.tags,
            records: []
        }

        /////////////////////////////////////////////////////////////////////////////////////////
        // Process existed records

        let idSelector = eval(options.selector.id || "(d => d)")
        let pathSelector = eval(options.selector.path || "(d => null)")
        let urlSelector = eval(options.selector.url || "(d => null)")
        let patientSelector = eval(options.selector.patient || "(d => null)")
        let deviceSelector = eval(options.selector.device || "(d => null)")
        let noteSelector = eval(options.selector.note || "(d => null)")

        let existedRecords = await mongodb.aggregate({
            db: options.db,
            collection: `${options.db.name}.taged-records`,
            pipeline: [{
                    $match: {
                        id: {
                            $in: options.records.map(d => idSelector(d))
                        }
                    }
                },
                {
                    $project: {
                        _id: 0
                    }
                }
            ]
        })

        if (existedRecords.length > 0) {
            let commands = existedRecords.map(r => {

                let addedTags = options.tags.filter(t => !t.startsWith("SOURCE:")).filter(t => !r.tags.map(t => t.tag).includes(t))

                response.records.push({
                    id: r.id,
                    status: "updated",
                    reason: `Add ${addedTags.map(d => "'"+d+"'").join(", ")}`
                })


                addedTags = addedTags.map(t => ({
                    tag: t,
                    createdAt: new Date(),
                    createdBy: {
                        namedAs: "import utils",
                        email: "",
                        photo: ""
                    }
                }))

                r.tags = r.tags.concat(addedTags)

                return {
                    replaceOne: {
                        filter: {
                            id: r.id
                        },
                        replacement: extend({}, r)
                    }
                }

            })


            let result = await mongodb.bulkWrite({
                db: options.db,
                collection: `${options.db.name}.taged-records`,
                commands
            })
        }

        //////////////////////////////////////////////////////////////////////////////////////////////////////
        // process new record

        let newRecords = options.records.filter(r => !existedRecords.map(d => d.id).includes(idSelector(r)))

        if (newRecords.length == 0) {
            res.send(response)
            return
        }

        ////////////////////////////////////////////////////////////////////////////////////////
        // get metadata from prod 

        let sources = keys(prodSourceEndpoint)
        let file_ids = newRecords.map(r => idSelector(r))
        let metadata = []
        for (let source of sources) {

            let r = await axios.post(prodSourceEndpoint[source], { file_ids })

            metadata = metadata.concat(r.data.map(d => {
                d.tags = [{
                    tag: `SOURCE: ${source}`,
                    createdAt: new Date(),
                    createdBy: {
                        namedAs: "import utils",
                        email: "",
                        photo: ""
                    }
                }]
                return d
            }))

        }

        // console.log(metadata)
        ////////////////////////////////////////////////////////////////////////////////////////

        let addedTags = options.tags.map(t => ({
            tag: t,
            createdAt: new Date(),
            createdBy: {
                namedAs: "import utils",
                email: "",
                photo: ""
            }
        }))


        ////////////////////////////////////////////////////////////////////////////////////////////////////////
        // TODO process AI segmentation


        ////////////////////////////////////////////////////////////////////////////////////////////////////////

        newRecords = newRecords.map(r => {
            let m = find(metadata, d => d.file_id == idSelector(r))

            if (m) {

                let pu = URL.parse(urlSelector(r), true)
                let segUrl = `${pu.protocol}//${pu.host}/?record_v3=${pu.query.record_v3}&patientId=${pu.query.patientId}&position=${m.record_body_position}&spot=${m.record_spot}&device=${pu.query.device}`

                return {
                    "id": idSelector(r),
                    "Segmentation URL": segUrl, //urlSelector(r),
                    "Examination ID": patientSelector(r),

                    "examination_created_at": m.examination_created_at,
                    "examination_id": m.examination_id,
                    "examination_modified_at": m.examination_modified_at,
                    "examination_notes": m.examination_notes,
                    "examination_title": m.examination_title,
                    "file_created_at": m.file_created_at,


                    "Clinic": "PRODUCTION DATA",
                    "model": deviceSelector(r),
                    "deviceDescription": "unknown",
                    "Body Position": m.record_body_position,
                    "Body Spot": m.record_spot,
                    "Type of artifacts , Artifact": [],
                    "Systolic murmurs": [],
                    "Diastolic murmurs": [],
                    "Other murmurs": [],
                    "Pathological findings": [],
                    "path": pathSelector(r),
                    "state": "",
                    "CMO": "",
                    "TODO": "",
                    "updated at": new Date(),
                    "updated by": "import utils",
                    "Stage Comment": noteSelector(r) || "Added by import utils",
                    "assigned to": "",
                    "1st expert": "",
                    "2nd expert": "",
                    "Confidence": "Not Confident",
                    "nextTodo": "",
                    "complete": 0,
                    "FINALIZED": false,
                    // "segmentation": "FRON PG DB",
                    "tags": m.tags.concat(addedTags),
                    "importNote": noteSelector(r)
                }
            } else {
                return {
                    id: idSelector(r),
                    fails: true
                }
            }
        })

        newRecords.forEach(r => {
            response.records.push({
                id: r.id,
                status: (r.fails) ? "failed" : "created",
                reason: (r.fails) ? `Unknown record ID: ${r.id}` : `Add ${addedTags.map(d => "'"+d.tag+"'").join(", ")}`
            })
            if (r.fails) {
                console.log(r.id)
            }

        })

        commands = newRecords.filter(r => !r.fails)

        if (commands.length > 0) {

            commands = commands.map(r => {

                return {
                    replaceOne: {
                        filter: {
                            id: r.id
                        },
                        replacement: extend({}, r),
                        upsert: true
                    }
                }

            })

            result = await mongodb.bulkWrite({
                db: options.db,
                collection: `${options.db.name}.taged-records`,
                commands
            })
        }

        res.send(response)

    } catch (e) {
        res.status(503).send({
            error: e.toString(),
            requestBody: req.body
        })
    }
}


const getFieldList = async (req, res) => {

    try {

        const db = CONFIG.db
        let response = await mongodb.aggregate({
            db: db,
            collection: `${db.name}.taged-records`,
            pipeline: [{
                    $limit: 1
                },
                {
                    $project: {
                        _id: 0
                    }
                }
            ]
        })

        res.send(sortBy(keys(response[0])))

    } catch (e) {
        res.status(503).send({
            error: e.toString()
        })
    }

}

const exportSelection = async (req, res) => {
    try {

        let options = extend({}, req.body)
        options.db = CONFIG.db
        options.id = uuid()
        options.requestedAt = new Date()
        options.requestedBy = options.user.namedAs
        options.download = options.download || false

        let projection = {
            _id: 0
        }

        if (options.filter.fields && options.filter.fields.length > 0) {
            options.filter.fields.forEach(f => {
                projection[f] = 1
            })
        }

        options.pipeline.push({
            $project: projection
        })

        if (options.download) {
            requestPool[options.id] = {
                id: options.id,
                db: options.db,
                requestedAt: options.requestedAt,
                requestedBy: options.requestedBy,
                filter: options.filter,
                pipeline: options.pipeline
            }
            res.send({
                id: options.id,
                requestedAt: options.requestedAt,
                requestedBy: options.requestedBy,
                filter: options.filter,
            })
            return
        }

        const response = await mongodb.aggregate({
            db: options.db,
            collection: `${options.db.name}.taged-records`,
            pipeline: options.pipeline
        })


        res.send({
            query: {
                id: options.id,
                requestedAt: options.requestedAt,
                requestedBy: options.requestedBy,
                filter: options.filter
            },
            data: response
        })


    } catch (e) {
        res.status(503).send({
            error: e.toString(),
            requestBody: req.body
        })
    }
}


const exportFile = async (req, res) => {

    try {

        let id = req.query.id || req.params.id
        let options = requestPool[id]
        if (!options) {
            res.status(404).send()
            return
        }


        const response = await mongodb.aggregate({
            db: options.db,
            collection: `${options.db.name}.taged-records`,
            pipeline: options.pipeline
        })

        delete options.db

        res.setHeader('Content-disposition', `attachment; filename=${id}.json`);
        res.setHeader('Content-type', "application/json");

        res.send({
            query: {
                id: options.id,
                requestedAt: options.requestedAt,
                requestedBy: options.requestedBy,
                filter: options.filter
            },
            data: response
        })

        delete requestPool[id]

    } catch (e) {

        res.status(503).send({
            error: e.toString(),
            requestBody: req.body
        })

    }
}


const setConsistency = async (req, res) => {
    try {

        let options = req.body.options
        let selection = req.body.selection
        let consistency = req.body.consistency


        const commands = selection.map(r => ({
            updateOne: {
                filter: {
                    id: r
                },
                update: { $set: { diagnosisConsistency: consistency } }
            }
        }))

        const result = await mongodb.bulkWrite({
            db: options.db,
            collection: `${options.db.name}.${options.db.labelingCollection}`,
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



// const exportSelection = async (req, res) => {
//  try {

//      let options = extend({}, req.body)
//      options.db = CONFIG.db

//      options.id = uuid()
//      req.body.id = options.id
//      options.requestedAt = new Date()
//      req.body.requestedAt = options.requestedAt

//      options.hasTags = (options.hasTags) ? options.includeTags || [] : []
//      options.hasLastTags = (options.hasLastTag) ? options.hasLastTags || [] : []
//      options.withoutTags = (options.withoutTags) ? options.excludeTags || [] : []
//      options.regexp = (options.hasText) ? options.search || "" : ""
//      options.comment = (options.hasComment) ? options.comment || "" : ""
//      options.rid = (options.hasId) ? options.rid || "" : ""
//      options.select = options.fields || []

//      options.download = options.download || false

//      if(options.download){
//          requestPool[options.id] = options
//          res.send(req.body)
//          return
//      }

//      if(!isArray(options.hasTags)){
//          res.status(400).send(`"hasTags" array expected in\n${JSON.stringify(req.body, null, " ")}`)
//          return
//      }

//      if(!isArray(options.withoutTags)){
//          res.status(400).send(`"withoutTags" array expected in\n${JSON.stringify(req.body, null, " ")}`)
//          return
//      }

//      if(!isArray(options.select)){
//          res.status(400).send(`"select" array expected in\n${JSON.stringify(req.body, null, " ")}`)
//          return
//      }

//      if(!isString(options.regexp)){
//          res.status(400).send(`"regexp" string expected in\n${JSON.stringify(req.body, null, " ")}`)
//          return
//      }

//      if(!isString(options.comment)){
//          res.status(400).send(`"comment" string expected in\n${JSON.stringify(req.body, null, " ")}`)
//          return
//      }



//      let pipeline = []


//      if(options.tagScope){

//          pipeline.push({
//              $match:{
//                  "tags.tag": {
//                      $regex: options.tagScope
//                  }   
//              }
//          })

//      }

//      if(options.hasId && options.rid){
//          pipeline.push({
//              $match:{
//                  "id": {
//                      $regex: options.rid
//                  }   
//              }
//          })          
//      }

//      if(options.lastTags.length > 0){
//          pipeline = pipeline.concat([
//                {
//                  $addFields:
//                    {
//                      lastTag: {
//                        $last: "$tags.tag",
//                      },
//                    },
//                },
//                {
//                  $match:
//                    {
//                      lastTag: {
//                        $in: [
//                          "STATE: Murmurs binary: 2nd: finalized",
//                        ],
//                      },
//                    },
//                }
//            ])
//      }


//      if(options.hasTags.length > 0){
//          pipeline.push({
//              $match:{
//                  "tags.tag": {
//                      $in: options.hasTags
//                  }   
//              }
//          })
//      }

//      if(options.withoutTags.length > 0){
//          pipeline.push({
//              $match:{
//                  "tags.tag": {
//                      $nin: options.withoutTags
//                  }   
//              }
//          })
//      }

//      if(options.regexp){
//          pipeline.push({
//              $match:{
//                  $or:[
//                         {
//                          "tags.tag":{
//                                  $regex: options.regexp
//                          }
//                         },
//                         {
//                           "tags.createdBy.namedAs":{
//                                  $regex: options.regexp
//                          }
//                         }
//                       ]
//              }           
//          })
//      }

//      if(options.comment){
//          pipeline.push({
//                 $match:
//                     {
//                         $or:[
//                             {
//                              "Stage Comment":{
//                                      $regex: options.comment
//                              }
//                             },
//                             {
//                               "importNote":{
//                                      $regex: options.comment
//                              }
//                             }
//                           ]
//                     }      
//             })
//         }    

//      if(options.select.length > 0){

//          let projection = {
//              _id: 0
//          }

//          options.select.forEach( key => {
//              projection[key] = 1
//          })

//          pipeline.push({
//              $project: projection
//          })
//      }

//      const response = await mongodb.aggregate({
//          db: options.db,
//          collection: `${options.db.name}.taged-records`,
//          pipeline
//      })


//      res.send({
//          query: req.body,
//          data: response
//      })


//  } catch(e) {
//      res.status(503).send({ 
//          error: e.toString(),
//          requestBody: req.body
//      })
//  }
// }






// const exportFile = async (req, res) => {

//  try {

//      let id = req.query.id || req.params.id
//      let options = requestPool[id]
//      if(!options){
//          res.status(404).send()
//          return
//      }

//      if(!isArray(options.hasTags)){
//          res.status(400).send(`"hasTags" array expected in\n${JSON.stringify(req.body, null, " ")}`)
//          return
//      }

//      if(!isArray(options.withoutTags)){
//          res.status(400).send(`"withoutTags" array expected in\n${JSON.stringify(req.body, null, " ")}`)
//          return
//      }

//      if(!isArray(options.select)){
//          res.status(400).send(`"select" array expected in\n${JSON.stringify(req.body, null, " ")}`)
//          return
//      }

//      if(!isString(options.regexp)){
//          res.status(400).send(`"regexp" string expected in\n${JSON.stringify(req.body, null, " ")}`)
//          return
//      }

//      if(!isString(options.comment)){
//          res.status(400).send(`"comment" string expected in\n${JSON.stringify(req.body, null, " ")}`)
//          return
//      }


//      let pipeline = []

//      if(options.tagScope){

//          pipeline.push({
//              $match:{
//                  "tags.tag": {
//                      $regex: options.tagScope
//                  }   
//              }
//          })

//      }

//      if(options.hasId && options.rid){
//          pipeline.push({
//              $match:{
//                  "id": {
//                      $regex: options.rid
//                  }   
//              }
//          })          
//      }

//      if(options.lastTags.length > 0){
//          pipeline = pipeline.concat([
//                {
//                  $addFields:
//                    {
//                      lastTag: {
//                        $last: "$tags.tag",
//                      },
//                    },
//                },
//                {
//                  $match:
//                    {
//                      lastTag: {
//                        $in: options.lastTags
//                      },
//                    },
//                }
//            ])
//      }


//      if(options.hasTags.length > 0){
//          pipeline.push({
//              $match:{
//                  "tags.tag": {
//                      $in: options.hasTags
//                  }   
//              }
//          })
//      }

//      if(options.withoutTags.length > 0){
//          pipeline.push({
//              $match:{
//                  "tags.tag": {
//                      $nin: options.withoutTags
//                  }   
//              }
//          })
//      }

//      if(options.regexp){
//          pipeline.push({
//              $match:{
//                  $or:[
//                         {
//                          "tags.tag":{
//                                  $regex: options.regexp
//                          }
//                         },
//                         {
//                           "tags.createdBy.namedAs":{
//                                  $regex: options.regexp
//                          }
//                         }
//                       ]
//              }           
//          })
//      }

//      if(options.comment){
//          pipeline.push({
//                 $match:
//                     {
//                         $or:[
//                             {
//                              "Stage Comment":{
//                                      $regex: options.comment
//                              }
//                             },
//                             {
//                               "importNote":{
//                                      $regex: options.comment
//                              }
//                             }
//                           ]
//                     }      
//             })
//         }    

//      if(options.select.length > 0){

//          let projection = {
//              _id: 0
//          }

//          options.select.forEach( key => {
//              projection[key] = 1
//          })

//          pipeline.push({
//              $project: projection
//          })
//      }

//      const response = await mongodb.aggregate({
//          db: options.db,
//          collection: `${options.db.name}.taged-records`,
//          pipeline
//      })

//      delete options.db

//      res.setHeader('Content-disposition', `attachment; filename=${id}.json`);
//          res.setHeader('Content-type', "application/json");

//      res.send({
//          query: options,
//          pipeline,
//          data: response
//      })

//      delete requestPool[id]

//  } catch(e) {

//      res.status(503).send({ 
//          error: e.toString(),
//          requestBody: req.body
//      })

//  }   
// }


const getSegmentation = async (req, res) => {
    try {

        let options = req.body.options

        let data = await mongodb.aggregate({
            db: options.db,
            collection: `${options.db.name}.segmentation-history`,
            pipeline: [{
                    $match: {
                        collection: options.db.labelingCollection,
                        recordId: options.recordId
                    }
                },
                {
                    $sort: {
                        updatedAt: -1
                    }
                },
                {
                    $project: {
                        _id: 0
                    }
                }
            ]
        })

        res.send(data)

    } catch (e) {

        res.status(503).send({
            error: e.toString(),
            requestBody: req.body
        })

    }
}


module.exports = {
    getDatasetList,
    getGrants,
    getRecords,
    getTagList,
    addTags,
    removeLastTag,
    addToTask,
    exportSelection,
    exportFile,
    getSegmentation,
    getFieldList,
    getExams,
    selectExams,

    addTagsDia,
    removeLastTagDia,

    setConsistency,
    getStateChart

}