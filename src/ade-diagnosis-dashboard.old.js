const mongodb = require("./mongodb")
const {extend, sortBy, uniq, flattenDeep, find, first, last, isUndefined, isNull, keys, isArray, isString, isObject, remove} = require("lodash")

const moment = require("moment")

const uuid = require("uuid").v4
const isValidUUID = require("uuid").validate
const isUUID = data => isString(data) && isValidUUID(data)



const getMetadata = async (req, res) => {
    try {

        res.send(req.body.cache.metadata)

    } catch (e) {
        res.send({
            error: e.toString(),
            requestBody: req.body
        })
    }
}

const getTagList = async (req, res) => {
    try {

        let {tagScope} = req.body.options
        const pool = req.dbCache.workflowTags
        
        let scope = (
            !isUndefined(tagScope) && 
            !isNull(tagScope) && 
            tagScope && 
            tagScope != "null") ? new RegExp(tagScope) : { test: () => true }
        
        
        let result = pool.filter(d => scope.test(d.name) && d.enabled)        

        res.send(result)
    

    } catch(e) {
        res.send({ 
            error: e.toString(),
            requestBody: req.body
        })
    }
}

const getRecords = async (req, res) => {
    try {

        let options = req.body.options
        const { db } = req.body.cache.currentDataset

        let count = await mongodb.aggregate({
            db,
            collection: `${db.name}.${db.labelingCollection}`,
            pipeline:   []
                        .concat(options.valueFilter)
                        .concat(options.eventData.filter)
                        .concat([
                            { $count: 'count'},
                            { $project: {_id: 0} }
                        ])
        }) 

        count = (count[0]) ? count[0].count || 0 : 0
        options.eventData = extend(options.eventData, {
            total: count,
            pagePosition: `${options.eventData.skip+1} - ${Math.min(options.eventData.skip + options.eventData.limit, count)} from ${count}`
        })

        let data = await mongodb.aggregate({
            db,
            collection: `${db.name}.${db.labelingCollection}`,
            pipeline:   []
                        .concat(options.valueFilter || [])
                        .concat(options.eventData.filter || [])
                        .concat([
                          {
                            '$project': {
                              '_id': 0
                            }
                          }, 
                          { 
                            $sort: (options.sort == "updated at, Z-A") 
                                ?   {
                                        "updated at": -1
                                    }
                                :   {
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


    } catch(e){
        res.send({ 
            error: e.toString(),
            requestBody: req.body
        })
    }
}


const getExams = async (req, res) => {
    try {

        let options = req.body.options
        const { db } = req.body.cache.currentDataset

        options.bodySpots = options.bodySpots || [
            "Apex",
            "Tricuspid",
            "Pulmonic",
            "Aortic",
            "Right Carotid",
            "Left Carotid",
            "Erb's",
            "Erb's Right",
            "unknown",
            "Left Clavicule"
        ]


        // console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!", `${db.name}.examinations`)

        let count = await mongodb.aggregate({
            db,
            collection: `${db.name}.${db.examinationCollection}`,
            pipeline:   []
                        .concat(options.valueFilter)
                        .concat(options.eventData.filter)
                        .concat([
                            { $count: 'count'},
                            { $project: {_id: 0} }
                        ])
        }) 

        count = (count[0]) ? count[0].count || 0 : 0
        options.eventData = extend(options.eventData, {
            total: count,
            pagePosition: `${options.eventData.skip+1} - ${Math.min(options.eventData.skip + options.eventData.limit, count)} from ${count}`
        })

        const statPipeline = [
            {
                $lookup:
                  {
                    from: db.labelingCollection,
                    localField: "patientId",
                    foreignField: "Examination ID",
                    as: "result",
                    pipeline:[{
                        $match:{
                            'Body Spot': {
                                '$in': options.bodySpots
                            }
                        }
                    }]
                  },
              },
              {
                $addFields:
                  {
                    todos: "$result.TODO",
                  },
              },
              {
                $project:
                  {
                    result: 0,
                  },
              }
        ]

        const pipeline = []
                        .concat(options.valueFilter || [])
                        .concat(options.eventData.filter || [])
                        .concat([
                          {
                            '$project': {
                              '_id': 0
                            }
                          }, 
                          { 
                            $sort: (options.sort == "updated at, Z-A") 
                                ?   {
                                        "updated at": -1
                                    }
                                :   {
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
                        .concat(statPipeline)

        let data = await mongodb.aggregate({
            db,
            collection: `${db.name}.${db.examinationCollection}`,
            pipeline  
        })

        res.send({
            options,
            pipeline,
            collection: data
        })


    } catch(e){
        res.send({ 
            error: e.toString(),
            requestBody: req.body
        })
    }
}

const selectExams = async (req, res) => {
    try {

        let options = req.body.options
        const { db } = req.body.cache.currentDataset

        if(options.pipeline.length == 0){
            res.send({
                options,
                collection: []
            })

            return          
        }

        let data = await mongodb.aggregate({
            db,
            collection: `${db.name}.${db.labelingCollection}`,
            pipeline: options.pipeline.concat([{$project: { id: "$_id"}}])    
        })

        // fetch _id of examinations? that consistenced to criteria

        // console.log(data)

        res.send({
            options,
            collection: data.map(d => d.id)
        })


    } catch(e){
        res.send({ 
            error: e.toString(),
            requestBody: req.body
        })
    }
}

const removeLastTag = async (req, res) => {
    try {

        let options = req.body.options
        const { db } = req.body.cache.currentDataset

        let scopeRegEx = new RegExp(options.tagScope || ".*")
    
        let records = await mongodb.aggregate({
            db,
            collection: `${db.name}.${db.labelingCollection}`,
            pipeline:   [
                { 
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
        
        records.forEach( r => {
            
            let outOfScope = remove(r.tags, d => !scopeRegEx.test(d.tag))


            r.tags = sortBy ( r.tags.map(t => {
                t.createdAt = new Date(t.createdAt)
                return t
            }), d => d.createdAt)

            
            r.tags.reverse()

            if(r.tags && r.tags.length>0 && !r.tags[0].tag.startsWith("TASK:") && !r.tags[0].tag.startsWith("SOURCE:")){
                r.tags.shift()
            }

            r.tags = r.tags.concat(outOfScope)

            r.tags = sortBy ( r.tags.map(t => {
                t.createdAt = new Date(t.createdAt)
                return t
            }), d => d.createdAt)


            r["updated at"] = new Date()
            r["Stage Comment"] = "Last Tag removed."
            r["updated by"] = options.user.namedAs
        })

        const commands = records.map( r => ({
            replaceOne:{
                filter:{
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

        res.send(result)

    } catch(e) {
        res.send({ 
            error: e.toString(),
            requestBody: req.body
        })  
    }
}

const addTags = async (req, res) => {
    try {

        let options = req.body.options
        const { db } = req.body.cache.currentDataset


        options.tags = (options.tags || []).map( t => ({
            tag: t,
            createdAt: new Date(),
            createdBy: {
                email: options.user.email,
                namedAs: options.user.namedAs,
                photo: options.user.photo
            }
        }))
        
        let records = await mongodb.aggregate({
            db,
            collection: `${db.name}.${db.labelingCollection}`,
            pipeline:   [
                { 
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
        
        records.forEach( r => {
            r.tags = r.tags.map(t => {
                t.createdAt = new Date(t.createdAt)
                return t
            })
            r.tags = sortBy(r.tags, d => d.createdAt)
            // console.log(last(r.tags).tag, first(options.tags).tag)
            if(last(r.tags).tag == first(options.tags).tag) {
                r.tags.pop()
            }   
            r.tags = r.tags.concat(options.tags)
            r["updated at"] = new Date()
            r["Stage Comment"] = "Tags added."
            r["updated by"] = options.user.namedAs
        })

        const commands = records.map( r => ({
            replaceOne:{
                filter:{
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

        res.send(result)

    } catch(e) {
        res.send({ 
            error: e.toString(),
            requestBody: req.body
        })  
    }
}


const addTagsDia = async (req, res) => {
    try {

        let {tags, examinations, comment, user} = req.body.options
        const { db } = req.body.cache.currentDataset

        if( 
            (!tags) ||
            (tags && tags.length == 0) ||
            (!examinations) ||
            (examinations && examinations.length == 0)
        ){
            res.send({})
            return
        }    

        tags = (tags || []).map( t => ({
            tag: t,
            createdAt: new Date(),
            createdBy: {
                email: user.email,
                namedAs: user.namedAs,
                photo: user.photo
            }
        }))
        
        let records = await mongodb.aggregate({
            db,
            collection: `${db.name}.${db.examinationCollection}`,
            pipeline:   [
                { 
                    $match: {
                        id: {
                            $in: examinations
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
        
        records.forEach( r => {
            r.workflowTags = (r.workflowTags || []).map(t => {
                t.createdAt = new Date(t.createdAt)
                return t
            })
            r.workflowTags = sortBy(r.workflowTags, d => d.createdAt)
            if(r.workflowTags.length > 0 && last(r.workflowTags).tag == first(tags).tag) {
                r.workflowTags.pop()
            }   
            r.workflowTags = r.workflowTags.concat(tags)
            r["updated at"] = new Date()
            r["Stage Comment"] = comment || "Tags added."
            r["updated by"] = user.namedAs
        })


        const commands = records.map( r => ({
            replaceOne:{
                filter:{
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

    } catch(e) {
        res.send({ 
            error: e.toString(),
            requestBody: req.body
        })  
    }
}

const removeLastTagDia = async (req, res) => {
    try {

        let options = req.body.options
        const { db } = req.body.cache.currentDataset

        let scopeRegEx = new RegExp(options.tagScope || ".*")

        let records = await mongodb.aggregate({
            db,
            collection: `${db.name}.${db.examinationCollection}`,
            pipeline:   [
                { 
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
        
        records.forEach( r => {
            
            let outOfScope = remove(r.workflowTags, d => !scopeRegEx.test(d.tag))


            r.workflowTags = sortBy ( r.workflowTags.map(t => {
                t.createdAt = new Date(t.createdAt)
                return t
            }), d => d.createdAt)

            
            r.workflowTags.reverse()

            if(r.workflowTags && r.workflowTags.length>0 && !r.workflowTags[0].tag.startsWith("TASK:") && !r.workflowTags[0].tag.startsWith("SOURCE:")){
                r.workflowTags.shift()
            }

            r.workflowTags = r.workflowTags.concat(outOfScope)

            r.workflowTags = sortBy ( r.workflowTags.map(t => {
                t.createdAt = new Date(t.createdAt)
                return t
            }), d => d.createdAt)


            r["updated at"] = new Date()
            r["Stage Comment"] = "Last Tag removed."
            r["updated by"] = options.user.namedAs
        })

        const commands = records.map( r => ({
            replaceOne:{
                filter:{
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

    } catch(e) {
        res.send({ 
            error: e.toString(),
            requestBody: req.body
        })  
    }
}


const setConsistency = async (req, res) => {
    try {
        
        const { db } = req.dbCache.currentDataset
        let { selection, consistency } = req.body

        const commands = selection.map( r => ({
            updateOne:{
                filter:{
                    id: r
                },
                update: {$set:{diagnosisConsistency: consistency}}
            }
        }))

        const result = await mongodb.bulkWrite({
            db,
            collection: `${db.name}.${db.labelingCollection}`,
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


const getForms = async (req, res) => {
    try {

        let options = req.body.options
        let { db } = req.body.cache.currentDataset

        let data = await mongodb.aggregate({
            db,
            collection: `${db.name}.${db.examinationCollection}`,
            pipeline: [{
                '$match': {
                    'patientId': options.patientId
                }
            }, {
                '$lookup': {
                    'from': db.formCollection,
                    'localField': 'id',
                    'foreignField': 'examinationId',
                    'as': 'forms'
                }
            }, 
            // {
            //     '$lookup': {
            //         'from': "actors",
            //         'localField': 'actorId',
            //         'foreignField': 'id',
            //         'as': 'physician'
            //     }
            // }, 
            {
                '$lookup': {
                    'from': db.labelingCollection,
                    'localField': 'id',
                    'foreignField': 'Examination ID',
                    'as': 'records'
                }
            }, {
                '$project': {
                    '_id': 0,
                    'type': 1,
                    'comment': 1,
                    'state': 1,
                    'dateTime': 1,
                    'protocol': 1,
                    'patientId': 1,
                    'forms': 1,
                    // 'physician': 1,
                    'recordCount': {
                        '$size': '$records'
                    }
                }
            }, {
                '$project': {
                    'records': 0
                }
            }]
        })

        data = data[0]

        if (data) {

            let formType = ["patient", "echo", "ekg", "attachements"]
            let forms = formType.map(type => {
                let f = find(data.forms, d => d.type == type)
                if (f && f.data) {
                    let form = f.data.en || f.data.uk || f.data
                    if (form) return extend(form, { formType: type })
                }
            }).filter(f => f)

            let patientForm = find(forms, f => f.formType == "patient")

            if (patientForm) {
                if (patientForm.diagnosisTags) {
                    if (patientForm.diagnosisTags.tags) {
                        let tags = req.dbCache.diagnosisTags
                        // await mongodb.aggregate({
                        //     db,
                        //     collection: `settings.tags`,
                        //     pipeline: [{
                        //             $match: {
                        //                 id: {
                        //                     $in: patientForm.diagnosisTags.tags
                        //                 }
                        //             }
                        //         },
                        //         {
                        //             $project: {
                        //                 _id: 0,
                        //                 name: 1
                        //             }
                        //         }
                        //     ]
                        // })

                        patientForm.diagnosisTags.tags = tags.map(t => last(t.name.split("/")))

                    } else {
                        patientForm.diagnosisTags.tags = []
                    }
                }
            }


            // let physician
            // if (data.physician) {
            //     physician = data.physician[0]
            //     physician = (physician) ? {
            //         name: `${physician.firstName} ${physician.lastName}`,
            //         email: physician.email
            //     } : { name: "", email: "" }
            // } else {
            //     physician = { name: "", email: "" }
            // }


            result = {
                examination: {
                    patientId: data.patientId,
                    recordCount: data.recordCount,
                    state: data.state,
                    comment: data.comment,
                    protocol,
                    date: moment(new Date(data.dateTime)).format("YYYY-MM-DD HH:mm:ss"),
                    // physician
                },
                patient: find(forms, f => f.formType == "patient"),
                ekg: find(forms, f => f.formType == "ekg"),
                echo: find(forms, f => f.formType == "echo"),
                attachements: find(forms, f => f.formType == "attachements"),
            }
        } else {
            result = {}
        }

        res.send(result)

    } catch (e) {
        res.send({
            error: e.toString(),
            requestBody: req.body
        })
    }
}

const updateDiagnosis = async (req, res) => {
    
    
    try {
        
    
        let { form } = req.body.options
        let { db } = req.body.cache.currentDataset

        
        // console.log("updateDiagnosisTags", options.form.id, options.form.diagnosis)


        let result = await mongodb.updateOne({
            db,
            collection: `${db.name}.forms`,
            filter: { 
                id: form.id 
            },
            data: { 
                "data.en.diagnosisTags": form.diagnosisTags,
                "data.en.diagnosis": form.diagnosis,
                "data.en.diagnosisReliability": form.diagnosisReliability
            }
        })
        res.send(result)
    
    } catch (e) {
        console.log(e.toString())
        res.send({ 
            error: e.toString(),
            requestBody: req.body
        })
    
    }    

}



module.exports = {
    getRecords,
    getTagList,
    addTags,
    removeLastTag,
    getExams,
    selectExams,
    addTagsDia,
    removeLastTagDia,
    setConsistency,
    getForms,
    updateDiagnosis
}

