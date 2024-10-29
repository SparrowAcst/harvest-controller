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

        let {options} = req.body
        const { db } = req.body.cache.currentDataset

        let scope = (
            !isUndefined(options.tagScope) && 
            !isNull(options.tagScope) && 
            options.tagScope && 
            options.tagScope != "null") ? 
                [{$match:{ "name": { $regex: options.tagScope}}}] : 
                []
        
       
        const result = await mongodb.aggregate({
            db,
            collection: `settings.workflow_tags`,
            pipeline: scope.concat([   
                {
                    $match: {
                        enabled: true
                    } 
                },
                {
                    $project:{ _id: 0 }
                }
            ])
        })

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
            collection: `${db.name}.labels`,
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
            collection: `${db.name}.labels`,
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


        console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!", `${db.name}.examinations`)

        let count = await mongodb.aggregate({
            db,
            collection: `${db.name}.examinations`,
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
                    from: "labels",
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
            collection: `${db.name}.examinations`,
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
            collection: `${db.name}.labels`,
            pipeline: options.pipeline.concat([{$project: { id: "$_id"}}])    
        })

        // fetch _id of examinations? that consistenced to criteria

        console.log(data)

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
            collection: `${db.name}.labels`,
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
            collection: `${db.name}.labels`,
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
            collection: `${db.name}.labels`,
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
            console.log(last(r.tags).tag, first(options.tags).tag)
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
            collection: `${db.name}.labels`,
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
            collection: `${db.name}.examinations`,
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
            collection: `${db.name}.examinations`,
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
            collection: `${db.name}.examinations`,
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
            collection: `${db.name}.examinations`,
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
        
        const { db } = req.body.cache.currentDataset
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
            collection: `${db.name}.labels`,
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
            collection: `${db.name}.examinations`,
            pipeline: [{
                '$match': {
                    'patientId': options.patientId
                }
            }, {
                '$lookup': {
                    'from': "forms",
                    'localField': 'id',
                    'foreignField': 'examinationId',
                    'as': 'forms'
                }
            }, {
                '$lookup': {
                    'from': "actors",
                    'localField': 'actorId',
                    'foreignField': 'id',
                    'as': 'physician'
                }
            }, {
                '$lookup': {
                    'from': "labels",
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
                    'patientId': 1,
                    'forms': 1,
                    'physician': 1,
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
                        let tags = await mongodb.aggregate({
                            db,
                            collection: `settings.tags`,
                            pipeline: [{
                                    $match: {
                                        id: {
                                            $in: patientForm.diagnosisTags.tags
                                        }
                                    }
                                },
                                {
                                    $project: {
                                        _id: 0,
                                        name: 1
                                    }
                                }
                            ]
                        })

                        patientForm.diagnosisTags.tags = tags.map(t => last(t.name.split("/")))

                    } else {
                        patientForm.diagnosisTags.tags = []
                    }
                }
            }


            let physician
            if (data.physician) {
                physician = data.physician[0]
                physician = (physician) ? {
                    name: `${physician.firstName} ${physician.lastName}`,
                    email: physician.email
                } : { name: "", email: "" }
            } else {
                physician = { name: "", email: "" }
            }


            result = {
                examination: {
                    patientId: data.patientId,
                    recordCount: data.recordCount,
                    state: data.state,
                    comment: data.comment,
                    date: moment(new Date(data.dateTime)).format("YYYY-MM-DD HH:mm:ss"),
                    physician
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














// const getForms = async (req, res) => {
//     try {

//         let options = req.body.options
//         let { db } = req.body.cache.currentDataset

//         let data = await mongodb.aggregate({
//             db,
//             collection: `${db.name}.examinations`,
//             pipeline: [{
//                 '$match': {
//                     'patientId': options.patientId
//                 }
//             }, {
//                 '$lookup': {
//                     'from': "forms",
//                     'localField': 'id',
//                     'foreignField': 'examinationId',
//                     'as': 'forms'
//                 }
//             }, {
//                 '$lookup': {
//                     'from': "actors",
//                     'localField': 'actorId',
//                     'foreignField': 'id',
//                     'as': 'physician'
//                 }
//             }, {
//                 '$lookup': {
//                     'from': "labels",
//                     'localField': 'id',
//                     'foreignField': 'Examination ID',
//                     'as': 'records'
//                 }
//             }, {
//                 '$project': {
//                     '_id': 0,
//                     'type': 1,
//                     'comment': 1,
//                     'state': 1,
//                     'dateTime': 1,
//                     'patientId': 1,
//                     'forms': 1,
//                     'physician': 1,
//                     'recordCount': {
//                         '$size': '$records'
//                     }
//                 }
//             }, {
//                 '$project': {
//                     'records': 0
//                 }
//             }]
//         })

//         data = data[0]

//         if (data) {

//             let formType = ["patient", "echo", "ekg", "attachements"]
//             let forms = formType.map(type => {
//                 let f = find(data.forms, d => d.type == type)
//                 if (f && f.data) {
//                     let form = f.data.en || f.data.uk || f.data
//                     if (form) return extend(form, { formType: type })
//                 }
//             }).filter(f => f)

//             let patientForm = find(forms, f => f.formType == "patient")

//             if (patientForm) {
//                 if (patientForm.diagnosisTags) {
//                     if (patientForm.diagnosisTags.tags) {
//                         let tags = await mongodb.aggregate({
//                             db,
//                             collection: `settings.tags`,
//                             pipeline: [{
//                                     $match: {
//                                         id: {
//                                             $in: patientForm.diagnosisTags.tags
//                                         }
//                                     }
//                                 },
//                                 {
//                                     $project: {
//                                         _id: 0,
//                                         name: 1
//                                     }
//                                 }
//                             ]
//                         })

//                         patientForm.diagnosisTags.tags = tags.map(t => last(t.name.split("/")))

//                     } else {
//                         patientForm.diagnosisTags.tags = []
//                     }
//                 }
//             }


//             let physician
//             if (data.physician) {
//                 physician = data.physician[0]
//                 physician = (physician) ? {
//                     name: `${physician.firstName} ${physician.lastName}`,
//                     email: physician.email
//                 } : { name: "", email: "" }
//             } else {
//                 physician = { name: "", email: "" }
//             }


//             result = {
//                 examination: {
//                     patientId: data.patientId,
//                     recordCount: data.recordCount,
//                     state: data.state,
//                     comment: data.comment,
//                     date: moment(new Date(data.dateTime)).format("YYYY-MM-DD HH:mm:ss"),
//                     physician
//                 },
//                 patient: find(forms, f => f.formType == "patient"),
//                 ekg: find(forms, f => f.formType == "ekg"),
//                 echo: find(forms, f => f.formType == "echo"),
//                 attachements: find(forms, f => f.formType == "attachements"),
//             }
//         } else {
//             result = {}
//         }

//         res.send(result)

//     } catch (e) {
//         res.send({
//             error: e.toString(),
//             requestBody: req.body
//         })
//     }
// }



// const getSegmentation = async (req, res) => {
//     try {

//         let { options } = req.body

//         options = extend(
//             options,
//             req.body.cache.currentDataset, { userProfiles: req.body.cache.userProfiles }
//         )

//         let handler = (dataStrategy[options.strategy]) ? dataStrategy[options.strategy].getSegmentation : undefined
//         let result
//         if (handler) {
//             result = await handler(options)
//         } else {
//             result = {}
//         }

//         res.send(result)

//     } catch (e) {

//         res.send({
//             error: `${e.toString()}\n${e.stack}`,
//             requestBody: req.body
//         })
//     }
// }



// const getRecords = async (req, res) => {
//     try {

//         let options = req.body.options
//         let { db } = req.body.cache.currentDataset

//         const resolveSegmentation = async segmentation => {


//             if (!segmentation) return

//             if (isUUID(segmentation)) {
//                 let d = await mongodb.aggregate({
//                     db,
//                     collection: `${db.name}.segmentations`,
//                     pipeline: [{
//                         $match: {
//                             id: segmentation
//                         }
//                     }]
//                 })

//                 return (d[0]) ? d[0].data : undefined

//             }

//         }

//         let pipeline = [
//           {
//             $match:
//               {
//                 "Examination ID": options.id,
//               },
//           },
//           {
//             $lookup:
//               {
//                 from: "segmentations",
//                 localField: "segmentation",
//                 foreignField: "id",
//                 as: "result",
//               },
//           },
//           {
//             $addFields:
//               {
//                 segmentation: {
//                   $first: "$result",
//                 },
//               },
//           },
//           {
//             $addFields:
//               {
//                 segmentation: "$segmentation.data",
//               },
//           },
//           {
//             $project:
//               {
//                 _id: 0,
//                 result: 0,
//               },
//           },
//         ]
//         // options.excludeFilter
//         //     .concat(options.valueFilter)
//         //     .concat([{
//         //         '$project': {
//         //             '_id': 0
//         //         }
//         //     }])

//         const data = await mongodb.aggregate({
//             db,
//             collection: `${db.name}.labels`,
//             pipeline
//         })

//         // for(let d of data){
//         //     d.segmentation = await resolveSegmentation(d.segmentation)
//         // }

//         res.send({
//             options,
//             collection: data
//         })

//     } catch (e) {
//         res.send({
//             error: e.toString(),
//             requestBody: req.body
//         })
//     }

// }

// const getTags = async (req, res) => {
//     try {
    
//        let { db } = req.body.cache.currentDataset

//         options = {
//             db,
//             collection: `settings.tags`,
//             pipeline: [   
//                 {
//                     $match:{
//                         classification: "Diagnosis"
//                     }
//                 },
//                 {
//                     $project:{ _id: 0 }
//                 }
//             ] 
//         }
        
//         const result = await mongodb.aggregate(options)
//         res.send(result)

//     } catch (e) {
        
//         res.send({
//             command: "getTags", 
//             error: e.toString(),
//             requestBody: req.body
//         })
    
//     }   

// }

// module.exports = {
//     getMetadata,
//     getForms,
//     getSegmentation,
//     getRecords,
//     getTags
// }