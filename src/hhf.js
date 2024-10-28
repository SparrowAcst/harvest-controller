const mongodb = require("./mongodb")
const {
    extend,
    sortBy,
    uniq,
    flattenDeep,
    find,
    difference,
    isArray,
    maxBy,
    keys,
    first,
    last,
    isUndefined,
    groupBy,
    isString
} = require("lodash")
const moment = require("moment")
const s3Bucket = require("./utils/s3-bucket")
const path = require("path")
const uuid = require("uuid").v4
const axios = require("axios")
const fs = require("fs")
const fsp = require("fs").promises
const filesize = require("file-size")

// const syncOneExamination = require("../../sync-data/src/actions/sync-one-examination")
// const { updateAISegmentation } = require("./long-term/ai-segmentation")

const { transferClinicData } = require("./long-term/transfer-clinic-data")

const TEMP_UPLOAD_DIR = path.resolve('./.tmp/uploads/')

const getDatasetList = async (req, res) => {
    try {

        let options = req.body.options

        options = extend({}, options, {
            collection: `${options.db.name}.dataset`,
            pipeline: [{
                $project: { _id: 0 }
            }]
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


const getRules = async (req, res) => {
    try {

        let options = req.body.options

        let prefix = options.examinationID.substr(0, 3)
        options = extend({}, options, {
            collection: `${options.db.name}.validation-rules`,
            pipeline: [{
                    $match: {
                        patientPrefix: prefix,
                    }
                },
                {
                    $project: { _id: 0 }
                }
            ]
        })

        let rules = await mongodb.aggregate(options)
        rules = (rules[0]) ? rules[0] : {
            recordings: [],
            files: []
        }


        res.send(rules)


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

        options = extend({}, options, {
            collection: `${options.db.name}.${options.collection.users}`,
            pipeline: [{
                    $match: {
                        email: options.user.email,
                    }
                },
                {
                    $project: { _id: 0 }
                }
            ]
        })

        let grants = await mongodb.aggregate(options)
        grants = grants[0]

        if (!grants) {
            res.send({
                error: `Access denied for user ${options.user.email}`
            })
            return
        }

        if (!isUndefined(options.examinationID)) {
            if (grants.patientPrefix.filter(d => options.examinationID.startsWith(d)).length == 0) {
                grants.role = "reader"
                // res.send ({
                //  error: `Examination ${options.examinationID} not available for user ${options.user.email}`
                // })
                // return
            } else {
                grants.role = "writer"
            }
        }

        res.send(grants)

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


        let data = await mongodb.aggregate({
            db: options.db,
            collection: `${options.db.name}.${options.collection.forms}`,
            pipeline: [{
                    '$match': {
                        'examination.patientId': options.examinationID
                    }
                },
                {
                    '$project': {
                        '_id': 0
                    }
                }
            ]
        })

        data = data[0]
        if (data) {
            if (data.examination.state == "pending") {
                data.readonly = false
                res.send(data)
            } else {

                /////////////////////////////////////////////////
                data.readonly = true
                /////////////////////////////////////////////////

                res.send(data)
            }
        } else {
            res.send({
                error: `Examination ${options.examinationID} not available for user ${options.user.email}`
            })
        }


    } catch (e) {
        res.send({
            error: e.toString(),
            requestBody: req.body
        })
    }
}


const lockForms = async (req, res) => {
    try {

        let options = req.body.options


        let data = await mongodb.aggregate({
            db: options.db,
            collection: `${options.db.name}.${options.collection.forms}`,
            pipeline: [{
                    '$match': {
                        'examination.patientId': options.examinationID
                    }
                },
                {
                    '$project': {
                        '_id': 0
                    }
                }
            ]
        })

        data = data[0]
        if (data) {

            data["locked by"] = options.grants.name
            data["locked at"] = new Date()

            const result = await mongodb.replaceOne({
                db: options.db,
                collection: `${options.db.name}.${options.collection.forms}`,
                filter: {
                    'examination.patientId': data.examination.patientId
                },
                data
            })

            res.send(result)

        } else {
            res.send({
                error: `Examination ${options.examinationID} not available for user ${options.user.email}`
            })
        }


    } catch (e) {
        res.send({
            error: e.toString(),
            requestBody: req.body
        })
    }
}


const unlockForms = async (req, res) => {
    try {
        let options = (isString(req.body)) ? JSON.parse(req.body).options : req.body.options
        // console.log("unlock", options)

        let data = await mongodb.aggregate({
            db: options.db,
            collection: `${options.db.name}.${options.collection.forms}`,
            pipeline: [{
                    '$match': {
                        'examination.patientId': options.examinationID
                    }
                },
                {
                    '$project': {
                        '_id': 0
                    }
                }
            ]
        })

        data = data[0]
        // console.log("data", data)
        if (data) {

            delete data["locked by"]
            delete data["locked at"]
            const result = await mongodb.replaceOne({
                db: options.db,
                collection: `${options.db.name}.${options.collection.forms}`,
                filter: {
                    'examination.patientId': data.examination.patientId
                },
                data
            })
            // console.log("result", result)
            res.send(result)

        } else {
            // console.log(`Examination ${options.examinationID} not available for user ${options.user.email}`)

            res.send({
                error: `Examination ${options.examinationID} not available for user ${options.user.email}`
            })
        }


    } catch (e) {
        console.log("ERROR", e.toString())

        res.send({
            error: e.toString(),
            requestBody: req.body
        })
    }
}

const updateForms = async (req, res) => {
    try {

        let options = req.body.options

        delete options.form["locked by"]
        delete options.form["locked at"]


        const result = await mongodb.replaceOne({
            db: options.db,
            collection: `${options.db.name}.${options.collection.forms}`,
            filter: {
                'examination.patientId': options.form.examination.patientId
            },
            data: options.form
        })


        res.send(result)

    } catch (e) {
        res.send({
            error: e.toString(),
            requestBody: req.body
        })
    }
}


const getExaminationList = async (req, res) => {

    let options = req.body.options

    let availableForms = await mongodb.aggregate({
        db: options.db,
        collection: `${options.db.name}.forms`,
        pipeline: [{
                '$match': {
                    'examination.state': "pending"
                }
            },
            {
                $project: {
                    _id: 0,
                    "Patient ID": "$examination.patientId",
                    "Patient Form": "$completeness.Patient Form",
                    "EKG Form": "$completeness.EKG Form",
                    "Echo Form": "$completeness.Echo Form",
                    "Recordings": "$completeness.Recordings",
                    "Files": "$completeness.Files",

                    "updated at": "$updated at",
                    comment: "$comment",
                    status: "$status",
                    protocol: "$protocol",
                    "updated by": "$updated by",
                    "locked by": "$locked by",
                    "locked at": "$locked at",
                    // "recordings":"$recordings",
                    // "files":"$files"
                },
            },
            {
                $sort: {
                    "Patient ID": 1,
                },
            }
        ]
    })

    res.send(availableForms)
}


const downloadFromUrl = async ({ source, target }) => {

    // axios image download with response type "stream"
    const response = await axios({
        method: 'GET',
        url: source,
        responseType: 'stream'
    })

    // pipe the result stream into a file on disc
    response.data.pipe(fs.createWriteStream(target))

    // return a promise and resolve when download finishes
    return new Promise((resolve, reject) => {
        response.data.on('end', () => {
            resolve()
        })

        response.data.on('error', () => {
            reject()
        })
    })

}

const copyFromURLToS3 = async ({ source, target }) => {
    try {

        let tempFileName = `${TEMP_UPLOAD_DIR}/${uuid()}.temp`
        console.log(source)
        console.log(target)
        console.log(tempFileName)

        await downloadFromUrl({
            source,
            target: tempFileName
        })

        await s3Bucket.uploadLt20M({
            source: tempFileName,
            target
        })

        let res = await s3Bucket.metadata(target)
        console.log(res)


        await fsp.unlink(tempFileName)

        return {
            id: uuid(),
            name: last(res.Key.split("/")),
            publicName: last(res.Key.split("/")),
            path: res.Key,
            mimeType: res.ContentType,
            size: res.ContentLength,
            updatedAt: res.LastModified,
            source: "Stetophone Data",
            storage: "s3",
            url: res.url,
            valid: true
        }

    } catch (e) {
        console.log(`copyFromURLToS3`, e.toString(), e.stack)
    }

}




const syncAssets = async (req, res) => {

    try{
        let { examinationID, grants, eid } = req.body.options

        const controller = await require("../../sync-data/src/controller")({
            console,
            firebaseService: {
                noprefetch: true
            }
        })

        let assets = await controller.getFbAssets(eid)
        
        console.log(assets.files)


        assets.files = assets.files.map(a => {
            a.source = "Stethophone Data"
            if (a.mimeType == "application/octet-stream") {
                a.mimeType = "image/jpg"
                a.name = a.name.replace("octet-stream", "jpg")
            }
            if (!a.mimeType) {
                a.mimeType = "image/jpg"
                a.name = a.name.replace("undefined", "jpg")
            }
            return a
        })

        let upd = []
        for (let f of assets.files) {

            let target = `${grants.backup.home}/${examinationID}/FILES/${f.name}`
            let metadata = await s3Bucket.metadata(target)
            
            console.log(f.name, metadata)
            console.log("target", target)


            if (!metadata) {

                await s3Bucket.uploadFromURL({
                    source: f.url,
                    target,
                    callback: (progress) => {
                        console.log(`UPLOAD ${target}: ${filesize(progress.loaded).human("jedec")} from ${filesize(progress.total).human("jedec")} (${(100*progress.loaded/progress.total).toFixed(1)}%)`)
                    }

                })

                metadata = await s3Bucket.metadata(target)
            }

            upd.push({
                id: uuid(),
                name: last(metadata.Key.split("/")),
                publicName: last(metadata.Key.split("/")),
                path: metadata.Key,
                mimeType: metadata.ContentType,
                size: metadata.ContentLength,
                updatedAt: metadata.LastModified,
                source: "Stetophone Data",
                storage: "s3",
                url: metadata.url,
                valid: true
            })
        }

        assets.files = upd

        res.send(assets)
    } catch (e) {
        console.log("Sync Assets Error", e.toString(), e.stack, JSON.stringify(req.body))
        throw e
    }    

}


const syncExaminations = async (req, res) => {

    const controller = await require("../../sync-data/src/controller")({
        console,
        firebaseService: {
            noprefetch: true
        }
    })

    const fb = controller.firebaseService




    const prepareForms = async examination => {

        examination = await controller.expandExaminations(...[examination])

        examination = (isArray(examination)) ? examination[0] : examination

        // console.log("examination", examination.$extention.assets)


        let formRecords = examination.$extention.forms.map(f => {
            let res = extend({}, f)
            res.examinationId = examination.id
            let key = maxBy(keys(f.data))
            res.data = res.data[key]
            res.id = f.id
            return res
        })


        let form = {}
        let ftypes = ["patient", "ekg", "echo"]
        ftypes.forEach(type => {
            let f = find(formRecords, d => d.type == type)
            form[type] = (f && f.data) ? f.data.en : {}

        })

        form.examination = {
            "id": examination.id,
            "dateTime": examination.dateTime,
            "patientId": examination.patientId,
            "comment": examination.comment,
            "state": examination.state
        }

        // let recordings = groupBy(examination.$extention.assets.filter(d => d.type == 'recording'), d=> d.device)

        // form.recordings = keys(recordings).map( key => ({device: key, count: recordings[key].length}))

        // form.attachements = examination.$extention.assets.filter(d => d.type != 'recording')

        return form

    }


    try {

        let options = req.body.options

        options = extend({}, options, {
            collection: `${options.db.name}.${options.collection.users}`,
            pipeline: [{
                    $match: {
                        email: options.user.email,
                    }
                },
                {
                    $project: { _id: 0 }
                }
            ]
        })

        let grants = await mongodb.aggregate(options)
        grants = grants[0]

        if (!grants) {
            res.send({
                error: `Access denied for user ${options.user.email}`
            })
            return
        }

        // if( grants.patientPrefix.filter( d => options.examinationID.startsWith(d)).length == 0){
        //  res.send ({
        //      error: `Examination ${options.examinationID} not available for user ${options.user.email}`
        //  })
        //  return
        // }

        let examinations_fb = await fb.execute.getCollectionItems(
            "examinations",
            [
                ["state", "==", "pending"]
            ]
        )

        examinations_fb = examinations_fb.filter(e => grants.patientPrefix.map(p => e.patientId.startsWith(p)).reduce((a, b) => a || b, false))

        let examinations_mg = await mongodb.aggregate({
            db: options.db,
            collection: `${options.db.name}.forms`,
            pipeline: [{
                    '$match': {
                        'examination.state': "pending"
                    }
                },
                {
                    '$project': {
                        '_id': 0
                    }
                }
            ]
        })

        examinations_mg = examinations_mg.filter(e => grants.patientPrefix.map(p => e.examination.patientId.startsWith(p)).reduce((a, b) => a || b, false))


        //    console.log(`fb: ${examinations_fb.map(d => d.patientId).join(', ')}`)
        // console.log(`mg: ${examinations_mg.map(d => d.examination.patientId).join(', ')}`)



        let toBeAdded = difference(examinations_fb.map(d => d.patientId), examinations_mg.map(d => d.examination.patientId))
        let toBeLocked = difference(examinations_mg.map(d => d.examination.patientId), examinations_fb.map(d => d.patientId))


        toBeAdded = examinations_fb.filter(e => {
            return toBeAdded.includes(e.patientId)
        })

        let forms = []

        for (let i = 0; i < toBeAdded.length; i++) {
            let exam = toBeAdded[i]
            let form = await prepareForms(exam)
            forms.push(form)
        }


        if (forms.length > 0) {

            for (let i = 0; i < forms.length; i++) {
                let form = forms[i]
                let f = await mongodb.aggregate({
                    db: options.db,
                    collection: `${options.db.name}.forms`,
                    pipeline: [{
                        '$match': {
                            'examination.patientId': form.examination.patientId
                        }
                    }]
                })

                if (f.length == 0) {
                    await mongodb.replaceOne({
                        db: options.db,
                        collection: `${options.db.name}.forms`,
                        filter: { 'examination.patientId': form.examination.patientId },
                        data: form
                    })
                } else {
                    console.log(`Ignore create doublicate for ${form.examination.patientId}`)
                }
            }


            // await mongodb.insertAll({
            //  db: options.db,
            //  collection: `${options.db.name}.forms`,
            //  data: forms
            // })   

        }

        toBeLocked = examinations_mg.filter(e => toBeLocked.includes(e.patientId))

        for (let i = 0; i < toBeLocked.length; i++) {
            let form = examinations_mg[i]
            form.examination.state = "locked"
            await mongodb.replaceOne({
                db: options.db,
                collection: `${options.db.name}.forms`,
                filter: {
                    'examination.patientId': form.examination.patientId
                },
                data: form
            })
        }

        let availablePatents = examinations_fb.map(f => f.patientId)

        let availableForms = await mongodb.aggregate({
            db: options.db,
            collection: `${options.db.name}.forms`,
            pipeline: [{
                    '$match': {
                        'examination.state': "pending",
                        "examination.patientId": {
                            $in: availablePatents
                        }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        "Patient ID": "$examination.patientId",
                        "Patient Form": "$completeness.Patient Form",
                        "EKG Form": "$completeness.EKG Form",
                        "Echo Form": "$completeness.Echo Form",
                        "Recordings": "$completeness.Recordings",
                        "Files": "$completeness.Files",
                        "Protocol": "$protocol",

                        "updated at": "$updated at",
                        comment: "$comment",
                        status: "$status",
                        "updated by": "$updated by",
                        "locked by": "$locked by",
                        "locked at": "$locked at",
                        // "recordings":"$recordings",
                        // "files":"$attachements"
                    },
                },
                {
                    $sort: {
                        "Patient ID": 1,
                    },
                }
            ]
        })

        res.send(availableForms)

    } catch (e) {
        res.send({
            error: e.toString(),
            requestBody: req.body
        })
    }

}


const postSubmitOneExamination = async (req, res) => {
    try {

        const { settings } = req.body

        if (req.eventHub.listenerCount("transfer-clinic-data") == 0) {
            req.eventHub.on("transfer-clinic-data", transferClinicData)
        }

        req.eventHub.emit("transfer-clinic-data", settings)

        // if (req.eventHub.listenerCount("update-ai-segmentation") == 0) {
        //           req.eventHub.on("update-ai-segmentation", updateAISegmentation)
        //       }

        // console.log("postSubmitOneExamination", req.body.settings)
        // let result = await syncOneExamination(req.body.settings)

        // console.log("RESULT", JSON.stringify(result, null, " "))
        // req.eventHub.emit("update-ai-segmentation", extend( {}, result, {patientId: req.body.settings.patientId}))

        res.status(200).send()

    } catch (e) {
        res.status(500).send(e.toString() + e.stack)
        console.log("ERROR: postSubmitOneExamination", e.toString())
    }
}


module.exports = {
    getGrants,
    getForms,
    updateForms,
    syncExaminations,
    getExaminationList,
    lockForms,
    unlockForms,
    syncAssets,
    getRules,
    postSubmitOneExamination
}