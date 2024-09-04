const mongodb = require("./mongodb")
const { extend, find } = require("lodash")
const moment = require("moment")
const createTaskController = require("./utils/task-controller")
// const { getSegmentationAnalysis } = require("./utils/segment-analysis")
// const getAISegmentation = require("./utils/ai-segmentation")

const dataStrategy = require("./strategies/data")


const dataView = d => ({
    "Patient ID": d["Examination ID"],
    "Device": d.model,
    "Body Spot": d["Body Spot"],
    "S3": (d.segmentation && d.segmentation.S3 && d.segmentation.S3.length > 0) ? "present" : " ",
    "Murmurs": (
        (d["Systolic murmurs"].filter(d => d != "No systolic murmurs").length +
            d["Diastolic murmurs"].filter(d => d != "No diastolic murmurs").length +
            d["Other murmurs"].filter(d => d != "No Other Murmurs").length) > 0
    ) ? "present" : " ",
    "Complete": d.complete
})


const getRecordData = async (req, res) => {
    try {

        let { options } = req.body
        options = extend(options, req.body.cache.currentDataset, { dataView })

        options.eventHub = req.eventHub
       
        let handler = (dataStrategy[options.strategy]) ? dataStrategy[options.strategy].get : undefined
        let result
        if(handler){
            result = await handler(options)
        } else {
            result = {}
        }

        res.send(result)

    } catch (e) {

        res.send({
            error: `${e.toString()}\n${e.stack}`,
            requestBody: req.body
        })
    }
}


// const saveRecordData = async (req, res) => {
//     try {

//         let { options } = req.body
//         options = extend(options, req.body.cache.currentDataset)

//         options = extend({}, options, { dataView })

//         const controller = createTaskController(options)
//         let brancher = await controller.getBrancher(options)

//         let result = await brancher.save(options)

//         res.send(result)

//     } catch (e) {
//         res.send({
//             error: e.toString(),
//             requestBody: req.body
//         })
//     }
// }

const saveRecordData = async (req, res) => {
    try {

        let { options } = req.body
        options = extend(options, req.body.cache.currentDataset, { dataView })
       
        options.eventHub = req.eventHub
       
        let handler = (dataStrategy[options.strategy]) ? dataStrategy[options.strategy].save : undefined
        let result
        if(handler){
            result = await handler(options)
        } else {
            result = {}
        }

        res.send(result)

    } catch (e) {

        res.send({
            error: `${e.toString()}\n${e.stack}`,
            requestBody: req.body
        })
    }

}



const submitRecordData = async (req, res) => {
    try {

        let { options } = req.body
        options = extend(options, req.body.cache.currentDataset, { dataView })
        
        options.eventHub = req.eventHub
       
        let handler = (dataStrategy[options.strategy]) ? dataStrategy[options.strategy].submit : undefined
        let result
        if(handler){
            result = await handler(options)
        } else {
            result = {}
        }

        res.send(result)

    } catch (e) {

        res.send({
            error: `${e.toString()}\n${e.stack}`,
            requestBody: req.body
        })
    }

}


const rollbackRecordData = async (req, res) => {

    try {

        let { options } = req.body
        options = extend(options, req.body.cache.currentDataset, { dataView })
        
        options.eventHub = req.eventHub
       
        let handler = (dataStrategy[options.strategy]) ? dataStrategy[options.strategy].rollback : undefined
        let result
        if(handler){
            result = await handler(options)
        } else {
            result = {}
        }

        res.send(result)

    } catch (e) {

        res.send({
            error: `${e.toString()}\n${e.stack}`,
            requestBody: req.body
        })
    }


    // try {

    //     let { options } = req.body
    //     options = extend(options, req.body.cache.currentDataset)

    //     options = extend({}, options, { dataView, dataId: options.recordId })

    //     const controller = createTaskController(options)
    //     let brancher = await controller.getBrancher(options)

    //     let result = await brancher.rollback(options)

    //     res.send(result)

    // } catch (e) {
    //     res.send({
    //         error: e.toString(),
    //         requestBody: req.body
    //     })
    // }
}


const getVersionChart = async (req, res) => {
    try {

        let { options } = req.body
        options = extend(options, req.body.cache.currentDataset)

        options = extend({}, options, { dataView })

        const controller = createTaskController(options)
        let brancher = await controller.getBrancher(options)

        let result = await brancher.getChart(options)

        res.send(result)

    } catch (e) {
        res.send({
            error: e.toString(),
            requestBody: req.body
        })
    }
}


const getMetadata = async (req, res) => {
    try {

        let options = req.body.options
        let { db } = req.body.cache.currentDataset


        const result = await mongodb.aggregate({
            db,
            collection: `settings.metadata`,
            pipeline: [{
                    $project: { _id: 0 }
                }

            ]
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

            let formType = ["patient", "echo", "ekg"]
            let forms = formType.map(type => {
                let f = find(data.forms, d => d.type == type)
                if (f && f.data) {
                    let form = f.data.en || f.data.uk
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


const getChangelog = async (req, res) => {
    try {

        let options = req.body.options
        let { db } = req.body.cache.currentDataset

        const changelog = await mongodb.aggregate({
            db,
            collection: `${db.name}.changelog-recordings`,
            pipeline: [{
                    $match: {
                        recordingId: options.recordingId,
                    },
                },
                {
                    $project: {
                        _id: 0,
                    },
                },
                {
                    $sort: {
                        startedAt: -1,
                    },
                },
            ]
        })

        res.status(200).send(changelog)

    } catch (e) {

        res.status(500).send(e.toString())

    }
}


const getSegmentation = async (req, res) => {
    try {

        let { options } = req.body
        options = extend(options, req.body.cache.currentDataset, { dataView })
        console.log(dataStrategy[options.strategy], "options", options)

        let handler = (dataStrategy[options.strategy]) ? dataStrategy[options.strategy].getSegmentation : undefined
        let result
        if(handler){
            result = await handler(options)
        } else {
            result = {}
        }

        res.send(result)

    } catch (e) {

        res.send({
            error: `${e.toString()}\n${e.stack}`,
            requestBody: req.body
        })
    }
}



const getRecords = async (req, res) => {
    try {

        let options = req.body.options
        let { db } = req.body.cache.currentDataset

        let pipeline = options.excludeFilter
            .concat(options.valueFilter)
            .concat([{
                '$project': {
                    '_id': 0
                }
            }])

        const data = await mongodb.aggregate({
            db,
            collection: `${db.name}.labels`,
            pipeline
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



module.exports = {
    getRecordData,
    saveRecordData,
    submitRecordData,
    rollbackRecordData,
    getVersionChart,
    getMetadata,
    getForms,
    getChangelog,
    getSegmentation,
    getRecords
}