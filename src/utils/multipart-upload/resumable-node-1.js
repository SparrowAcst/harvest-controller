const fs = require('fs')
const path = require('path')
const { sortBy, keys } = require("lodash")
const Stream = require('stream').Stream;

const cleanIdentifier = identifier => identifier.replace(/^0-9A-Za-z_-/img, '')

const UPLOAD = {}

const Resumable = class {

    constructor(temporaryFolder) {
        this.temporaryFolder = temporaryFolder;
        try {
            fs.mkdirSync(this.temporaryFolder);
        } catch (e) {}
    }

    testAllChunkExists(id) {
        console.log(UPLOAD[id].chunk)
        return keys(UPLOAD[id].chunk)
            .map(key => UPLOAD[id].chunk[key].status)
            .filter(status => status == "done")
            .length == UPLOAD[id].totalChunks
    }

    async post(req) {
        if (req.busboy) {
            let query = req.query;
            let eventHub = req.eventHub

            req.busboy.on('field', (fieldname, val, fieldnameTruncated, valTruncated) => {
                if (fieldname) query[fieldname] = val;
            })

            req.busboy.on('file', async (name, file, info) => {
                try {
                    
                    console.log("busboy.on('file'", name, file, info)
                    let id = cleanIdentifier(query.resumableIdentifier)

                    let chunkMetadata = {
                        file: path.join(this.temporaryFolder, `./resumable-${id}.${query.resumableChunkNumber}`),
                        status: "processed"
                    }

                    UPLOAD[id] = UPLOAD[id] || {
                        id,
                        file: info.filename,
                        size: query.resumableTotalSize,
                        status: "processed",
                        totalChunks: query.resumableTotalChunks,
                        chunk: {}
                    }

                    UPLOAD[id].chunk[chunkMetadata.file] = chunkMetadata

                    let stream = await fs.createWriteStream(chunkMetadata.file) //, { flags: 'w' })
                    console.log(stream)
                    stream.on('close', () => {
                        UPLOAD[id].chunk[chunkMetadata.file].status = "done"
                        UPLOAD[id].chunk[chunkMetadata.file].commpletedAt = new Date()
                        console.log("close stream", chunkMetadata.file)
                        console.log(UPLOAD)
                        if (this.testAllChunkExists(id)) {
                            UPLOAD[id].status = "done"
                            UPLOAD[id].completedAt = new Date()
                            console.log('all chunks ready', UPLOAD[id])
                            eventHub.emit("resumable-done", UPLOAD[id])
                            delete UPLOAD[id]
                        }
                    })

                    stream.on('error', e => {
                        UPLOAD[id].status = "error"
                        UPLOAD[id].chunk[chunkMetadata.file].status = "error"
                        UPLOAD[id].chunk[chunkMetadata.file].error = e.toString() + " " + e.stack
                        eventHub.emit("resumable-error", UPLOAD[id])
                        delete UPLOAD[id]
                        console.log(`upload error: ${e.toString()}`)
                    })

                    file.pipe(stream);
                
                } catch (e) {
                    console.log("UPLOAD CHUNK ERROR", id, e.toString(), e.stack)
                }    
                // resolve(id)
            })

            req.pipe(req.busboy)
        }
    }
}


module.exports = Resumable