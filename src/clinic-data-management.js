const mongodb = require("./mongodb")
const { extend } = require("lodash")


getStateChart = async (req, res) => {

    try {

        const { db } = req.body.cache.currentDataset

        let { matchExamination } = req.body.options
        let matchExaminationPipeline = matchExamination || []
        let pipeline = matchExaminationPipeline.concat(
            [{
                    $project: {
                        state: 1,
                    },
                },
                {
                    $group: {
                        _id: "$state",
                        patients: {
                            $push: 1,
                        },
                    },
                },
                {
                    $project: {
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
            db,
            collection: `${db.name}.${db.examinationCollection}`,
            pipeline
        })

        res.send({
            options: req.body.options,
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


const getExams1 = async (req, res) => {
    try {

        const calcQtyAI = (patientId, qty) => {
            const categories = ["good", "bad"]
            return categories.map(c => ({
                value: c,
                count: qty.filter(d => d.patientId == patientId).filter(d => d.qty == c).length
            }))

        }

        const calcQtyEXPERT = (patientId, records) => {
            const categories = ["Good", "Poor", "Uninformative", "Non assessed"]
            return categories.map(c => ({
                value: c,
                count: records.filter(d => d.patientId == patientId).filter(d => d.qtyEXPERT == c).length
            }))

        }

        const { db } = req.body.cache.currentDataset

        let { options } = req.body
        let matchExaminationPipeline = options.matchExamination || []
        let limit = options.limit || 100

        let pipelines = []

        let pipeline = matchExaminationPipeline.concat(
            [{
                    $sort: {
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
                        updatedBy: "$updatedBy"
                    },
                },
            ])

        pipelines.push({
            collection: db.examinationCollection,
            pipeline
        })


        let examinations = await mongodb.aggregate({
            db,
            collection: `${db.name}.${db.examinationCollection}`,
            pipeline
        })


        pipeline = [{
                $match: {
                    "Examination ID": {
                        $in: examinations.map(d => d.patientId)
                    },
                    "Body Spot": {
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
                }
            },
            {
                $project: {
                    _id: 0,
                    patientId: "$Examination ID",
                    aiSegmentation: 1,
                    spot: "$Body Spot",
                    "qtyEXPERT": "$Heart Sound Informativeness"
                }
            }
        ]

        pipelines.push({
            collection: db.labelingCollection,
            pipeline
        })


        let records = await mongodb.aggregate({
            db,
            collection: `${db.name}.${db.labelingCollection}`,
            pipeline
        })

        pipeline = [{
                $match: {
                    "examinationId": {
                        $in: examinations.map(d => d.e_id)
                    }
                }
            },
            {
                $project: {
                    _id: 0,

                }
            }
        ]

        pipelines.push({
            collection: db.formCollection,
            pipeline
        })

        let forms = await mongodb.aggregate({
            db,
            collection: `${db.name}.${db.formCollection}`,
            pipeline
        })

        pipeline = [{
                $match: {
                    "id": {
                        $in: records.map(d => d.aiSegmentation)
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    patientId: 1,
                    qty: "$data.quality"
                }
            }
        ]

        pipelines.push({
            collection: db.segmentCollection,
            pipeline
        })

        let qty = await mongodb.aggregate({
            db,
            collection: `${db.name}.${db.segmentCollection}`,
            pipeline
        })

        examinations = examinations.map(examination => {

            examination.echoForm = forms.filter(f => f.examinationId == examination.e_id && f.type == "echo")[0]
            examination.echoForm = (examination.echoForm) ? examination.echoForm.data.uk : {}

            examination.ekgForm = forms.filter(f => f.examinationId == examination.e_id && f.type == "ekg")[0]
            examination.ekgForm = (examination.ekgForm) ? examination.ekgForm.data.uk : {}

            examination.patientForm = forms.filter(f => f.examinationId == examination.e_id && f.type == "patient")[0]
            examination.patientForm = (examination.patientForm) ? examination.patientForm.data.uk : {}

            examination.qtyAI = calcQtyAI(examination.patientId, qty)
            examination.records = records.filter(r => r.patientId == examination.patientId)
            examination.recordCount = examination.records.length
            examination.qtyEXPERT = calcQtyEXPERT(examination.patientId, records)

            return examination

        })

        // console.log("examinations", examinations)

        res.send({
            options,
            pipelines,
            collection: examinations
        })


    } catch (e) {
        console.log(e.toString(), e.stack)
        res.send({
            error: e.toString(),
            requestBody: req.body
        })
    }
}



const acceptExaminations = async (req, res) => {
    try {

        const { db } = req.body.cache.currentDataset
        let { selection, user } = req.body.options

        const commands = selection.map(s => ({
            updateOne: {
                filter: {
                    patientId: s
                },
                update: {
                    $set: {
                        state: "accepted",
                        updatedAt: new Date(),
                        updatedBy: {
                            user: user.altname,
                            role: user.role
                        }    
                    }
                }
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

        const { db } = req.body.cache.currentDataset
        let { selection, user } = req.body.options

        const commands = selection.map(s => ({
            updateOne: {
                filter: {
                    patientId: s
                },
                update: {
                    $set: {
                        state: "rejected",
                        updatedAt: new Date(),
                        updatedBy: {
                            user: user.altname,
                            role: user.role
                        }    
                    }
                }
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
    getExams: getExams1,
    getStateChart,
    acceptExaminations,
    rejectExaminations
}