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

                let stream = await fs.createWriteStream(chunkMetadata.file, { flags: 'w' })

                stream.on('close', async file => {
                    UPLOAD[id].chunk[chunkMetadata.file].status = "done"
                    UPLOAD[id].chunk[chunkMetadata.file].commpletedAt = new Date()
                    if (this.testAllChunkExists(id)) {
                        UPLOAD[id].status = "done"
                        UPLOAD[id].completedAt = new Date()
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
                // resolve(id)
            })

            req.pipe(req.busboy)
        }
    }
}


module.exports = Resumable