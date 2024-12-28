const mongodb = require("./mongodb")
const { extend, find, last } = require("lodash")
const moment = require("moment")
const createTaskController = require("./utils/task-controller")

const dataStrategy = require("./strategies/data")

const assignTasks = require("./long-term/assign-task")

const LongTerm = require("./utils/long-term-queue")

const getRecordData = async (req, res) => {
    try {


        let { options } = req.body

        options = extend(
            options,
            req.body.cache.currentDataset, { userProfiles: req.body.cache.userProfiles }
        )

        console.log("options", options)
        
        options.eventHub = req.eventHub

        let { user, recordId } = options

        await LongTerm.endLongTermOperation({
            section: "update-segmentation-request",
            test: task =>   {
                return task.metadata.user == ((user.altname) ? user.altname : user) &&
                            task.metadata.dataId == recordId
            }                
        })


        let handler = (dataStrategy[options.strategy]) ? dataStrategy[options.strategy].get : dataStrategy.Default.get
        let result
        if (handler) {
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


const saveRecordData = async (req, res) => {
    try {

        let { options } = req.body

        options = extend(
            options,
            req.body.cache.currentDataset, { userProfiles: req.body.cache.userProfiles }
        )

        options.eventHub = req.eventHub

        let { user, recordId } = options
        
        await LongTerm.endLongTermOperation({
            section: "update-segmentation-request",
            test: task =>   task.metadata.user == ((user.altname) ? user.altname : user) &&
                            task.metadata.dataId == recordId
        })


        let handler = (dataStrategy[options.strategy]) ? dataStrategy[options.strategy].save : undefined
        let result
        if (handler) {
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


const rejectRecordData = async (req, res) => {
    try {

        let { options } = req.body

        options = extend(
            options, 
            req.body.cache.currentDataset,
            { userProfiles: req.body.cache.userProfiles}
        )

        options.eventHub = req.eventHub
        options.initiator = find(options.userProfiles, p => p.namedAs == options.user)


        let { user, recordId } = options
        
        await LongTerm.endLongTermOperation({
            section: "update-segmentation-request",
            test: task =>   task.metadata.user == ((user.altname) ? user.altname : user) &&
                            task.metadata.dataId == recordId
        })


        let handler = (dataStrategy[options.strategy]) ? dataStrategy[options.strategy].reject : undefined
        let result
        if (handler) {
            result = await handler(options)

            // if (req.eventHub.listenerCount("assign-tasks") == 0) {
            //     req.eventHub.on("assign-tasks", assignTasks)
            // }

            // req.eventHub.emit("assign-tasks", options)

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

        options = extend(
            options, 
            req.body.cache.currentDataset,
            { userProfiles: req.body.cache.userProfiles}
        )

        options.eventHub = req.eventHub
        options.initiator = find(options.userProfiles, p => p.namedAs == options.user)

        let { user, recordId } = options
        
        await LongTerm.endLongTermOperation({
            section: "update-segmentation-request",
            test: task =>   task.metadata.user == ((user.altname) ? user.altname : user) &&
                            task.metadata.dataId == recordId
        })


        let handler = (dataStrategy[options.strategy]) ? dataStrategy[options.strategy].submit : undefined
        let result
        if (handler) {
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

        options = extend(
            options,
            req.body.cache.currentDataset, { userProfiles: req.body.cache.userProfiles }
        )

        options.eventHub = req.eventHub

        let { user, recordId } = options
        
        await LongTerm.endLongTermOperation({
            section: "update-segmentation-request",
            test: task =>   task.metadata.user == ((user.altname) ? user.altname : user) &&
                            task.metadata.dataId == recordId
        })


        let handler = (dataStrategy[options.strategy]) ? dataStrategy[options.strategy].rollback : undefined
        let result
        if (handler) {
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


const getVersionChart = async (req, res) => {
    try {

        let { options } = req.body

        options = extend(
            options,
            req.body.cache.currentDataset, { userProfiles: req.body.cache.userProfiles }
        )

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

        res.send(req.body.cache.metadata)

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

        options = extend(
            options,
            req.body.cache.currentDataset, { userProfiles: req.body.cache.userProfiles }
        )

        let handler = (dataStrategy[options.strategy]) ? dataStrategy[options.strategy].getSegmentation : undefined
        let result
        if (handler) {
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

const getLongTermTask = async (req, res) => {
    let {type, id} = req.body
    res.send(LongTerm.pool.getTask(type, id))
}



module.exports = {
    getRecordData,
    saveRecordData,
    rejectRecordData,
    submitRecordData,
    rollbackRecordData,
    getVersionChart,
    getMetadata,
    getForms,
    getChangelog,
    getSegmentation,
    getRecords,
    getLongTermTask
}